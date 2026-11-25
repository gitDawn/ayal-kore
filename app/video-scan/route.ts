// Staff only: find the books in a recommendation video with Gemini, and match them to the stock.
// The browser sends frames (JPEG) and, when it can, the sound (WAV) as form data.
import { getCatalog, type Book, type Catalog } from '@/lib/server-catalog';
import { norm } from '@/lib/inventory';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROMPT = `These are frames, in order, from a short video filmed in a second-hand bookstore in Israel, and possibly its sound track.
Find every book that the video shows or talks about and whose title you can actually read or hear.
- Most titles are in Hebrew. Write each title exactly as printed on the book (in Hebrew when it is Hebrew), without quotes.
- Add the author when it is printed or said.
- The same book seen in several frames, or several copies or editions of it, is one entry.
- featured = true for a book the presenter holds, shows up close or talks about; false for a book that is only visible in the background on a shelf.
- source: "cover" (front cover), "spine", or "speech" (only mentioned in the sound).
- Do not guess: leave out any title you cannot read with confidence.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    books: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          author: { type: 'STRING' },
          featured: { type: 'BOOLEAN' },
          source: { type: 'STRING', enum: ['cover', 'spine', 'speech'] },
        },
        required: ['title', 'featured'],
      },
    },
  },
  required: ['books'],
};

interface Found { title: string; author?: string; featured: boolean; source?: string; }

async function isStaff(token: string): Promise<boolean> {
  if (!token) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_staff`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return res.ok && (await res.json()) === true;
}

const toBase64 = async (f: File) => Buffer.from(await f.arrayBuffer()).toString('base64');

// Fast models first; a busy or missing model falls through to the next one, within the time limit.
const DEADLINE_MS = 52_000;

async function askGemini(key: string, parts: unknown[]): Promise<{ model: string; books: Found[] }> {
  const models = [process.env.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest']
    .filter((m, i, a): m is string => !!m && a.indexOf(m) === i);
  const until = Date.now() + DEADLINE_MS;
  let last = '';
  const attempts = models.flatMap((m) => [{ model: m, think: true }, { model: m, think: false }]);
  for (let i = 0; i < attempts.length; i++) {
    const { model, think } = attempts[i];
    if (!think && !/thinking/i.test(last)) continue; // the plain retry is only for a model that rejects the thinking setting
    const left = until - Date.now();
    if (left < 5_000) break;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), left);
    try {
      const generationConfig: Record<string, unknown> = { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.1 };
      // Reading titles needs little reasoning; keeping it low makes the answer much faster.
      if (think) generationConfig.thinkingConfig = { thinkingLevel: 'low' };
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        last = data?.error?.message || `Gemini ${res.status}`;
        if ([404, 429, 500, 503].includes(res.status) || /thinking|no longer available|not found|not supported/i.test(last)) continue; // try again or the next model
        throw new Error(last);
      }
      const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
      const parsed = JSON.parse(text || '{"books":[]}') as { books?: Found[] };
      return { model, books: (parsed.books || []).filter((b) => b && b.title && b.title.trim()) };
    } catch (e) {
      if ((e as Error).name === 'AbortError') { last = 'timeout'; break; }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(last === 'timeout' || /demand|overload|unavailable|quota|rate/i.test(last) ? 'busy' : last || 'no model');
}

const words = (s: string) => norm(s).split(' ').filter((w) => w.length > 1);

/** Books in the catalog whose title matches the found title best (Dice score on words, author as a bonus). */
function match(c: Catalog, title: string, author?: string) {
  const tw = words(title);
  if (!tw.length) return [];
  const aw = words(author || '');
  const out: { b: Book; score: number }[] = [];
  const dice = (bw: Set<string>) => {
    let hits = 0;
    for (const w of tw) if (bw.has(w)) hits++;
    return hits ? (2 * hits) / (tw.length + bw.size) : 0;
  };
  for (const b of c.books) {
    const bw = new Set(words(b.title));
    if (!bw.size) continue;
    // Also compare with the main title alone, before a subtitle ("החופש לבחור : עיקרי הכלכלה החופשית").
    const main = b.title.split(/\s[:\-–]\s|:/)[0];
    let score = Math.max(dice(bw), main !== b.title ? dice(new Set(words(main))) : 0);
    if (!score) continue;
    if (aw.length) {
      const ba = new Set(words(b.author));
      if (aw.some((w) => ba.has(w))) score += 0.15;
    }
    if (score >= 0.5) out.push({ b, score: Math.min(1, score) });
  }
  out.sort((x, y) => y.score - x.score || Number(y.b.inStock) - Number(x.b.inStock));
  return out.slice(0, 4).map(({ b, score }) => ({
    id: b.id, path: b.path, title: b.title, author: b.author,
    price: b.copies[0]?.price ?? 0, condition: b.copies[0]?.condition ?? '', copies: b.copies.length,
    cover: b.cover, inStock: b.inStock, score: Math.round(score * 100) / 100,
  }));
}

export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!(await isStaff(token))) return Response.json({ error: 'not staff' }, { status: 403 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'missing key' }, { status: 503 });

  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ error: 'bad request' }, { status: 400 }); }
  const frames = form.getAll('frames').filter((f): f is File => f instanceof File).slice(0, 60);
  const audio = form.get('audio');
  if (!frames.length) return Response.json({ error: 'no frames' }, { status: 400 });

  const parts: unknown[] = [{ text: PROMPT }];
  for (const f of frames) parts.push({ inlineData: { mimeType: 'image/jpeg', data: await toBase64(f) } });
  if (audio instanceof File && audio.size > 0) parts.push({ inlineData: { mimeType: 'audio/wav', data: await toBase64(audio) } });

  try {
    const [found, c] = await Promise.all([askGemini(key, parts), getCatalog()]);
    if (!c) return Response.json({ error: 'catalog' }, { status: 503 });
    const books = found.books.map((f) => ({ ...f, matches: match(c, f.title, f.author) }));
    books.sort((x, y) => Number(y.featured) - Number(x.featured));
    return Response.json({ model: found.model, frames: frames.length, audio: audio instanceof File && audio.size > 0, books });
  } catch (e) {
    return Response.json({ error: (e as Error).message || 'failed' }, { status: 502 });
  }
}
