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

// Photos or a video of books to add to the store's stock: piles, tables and shelves (spines).
const SHELF_PROMPT = `These are photos, or frames in order from a short video, of books in Israel: on a table, in a pile or on shelves (spines),
and possibly the video's sound track. Some photos are followed by close-up crops of the same photo, to make small print readable.
List every distinct book whose title you can actually read.
- Most titles are in Hebrew. Write the title exactly as printed (in Hebrew when it is Hebrew), without quotes.
- Put the author in "author" only, never inside the title. Write the author's name as printed on the book.
- Keep a subtitle or a volume / part number that is printed on the book (for example "חלק ב").
- Ignore library labels and stickers (shelf marks such as "פנטזיה 3 מרטי").
- The same book seen in several photos, frames or crops is one entry. copies = how many copies of that same book you see.
- featured = true for a book shown from the front (its cover); false for a book seen only by its spine.
- source: "cover", "spine", or "speech" (only mentioned in the sound).
- Do not guess: leave out any title you cannot read with confidence.
- For a book whose FRONT COVER is visible: cover_image = the number of the image (0 = the first image sent) where that front cover
  is seen best (largest, sharpest, least hidden), and cover_box = [ymin, xmin, ymax, xmax] of the whole front cover in that image,
  each from 0 to 1000 relative to that image's height and width. Box the full cover edge to edge, not the title alone, and not a spine.
  Leave both out for a book seen only by its spine, or when its cover is mostly hidden.`;

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
          copies: { type: 'INTEGER' },
        },
        required: ['title', 'featured'],
      },
    },
  },
  required: ['books'],
};

const SHELF_SCHEMA = {
  ...SCHEMA,
  properties: {
    books: {
      ...SCHEMA.properties.books,
      items: {
        ...SCHEMA.properties.books.items,
        properties: {
          ...SCHEMA.properties.books.items.properties,
          cover_image: { type: 'INTEGER' },
          cover_box: { type: 'ARRAY', items: { type: 'INTEGER' } },
        },
      },
    },
  },
};

interface Found { title: string; author?: string; featured: boolean; source?: string; copies?: number; cover_image?: number; cover_box?: number[]; }

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

// Staff timing tests may ask for one model and thinking level (from this list only).
const TEST_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest'];

async function askGemini(key: string, parts: unknown[], schema: unknown = SCHEMA, opts: { model?: string; think?: string } = {}): Promise<{ model: string; books: Found[] }> {
  const models = [opts.model, process.env.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest']
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
      const generationConfig: Record<string, unknown> = { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 };
      // Reading titles needs little reasoning; keeping it low makes the answer much faster.
      if (think && opts.think !== 'off') generationConfig.thinkingConfig = { thinkingLevel: opts.think || 'low' };
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

/** One request to one model. `think` null means no thinking setting. Throws on failure or when `signal` aborts. */
async function callModel(key: string, model: string, parts: unknown[], schema: unknown, think: string | null, signal: AbortSignal): Promise<{ model: string; books: Found[] }> {
  const generationConfig: Record<string, unknown> = { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 };
  if (think) generationConfig.thinkingConfig = { thinkingLevel: think };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini ${res.status}`;
    // A model that does not take this thinking setting: ask again without it.
    if (think && /thinking/i.test(msg)) return callModel(key, model, parts, schema, null, signal);
    throw new Error(msg);
  }
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
  const parsed = JSON.parse(text || '{"books":[]}') as { books?: Found[] };
  return { model, books: (parsed.books || []).filter((b) => b && b.title && b.title.trim()) };
}

/** How alike two titles are, by shared words (0 to 1). Two readings of one cover often differ by a letter or a word. */
function alike(x: string, y: string): number {
  const a = new Set(norm(x).split(' ').filter((w) => w.length > 1)), b = new Set(norm(y).split(' ').filter((w) => w.length > 1));
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const w of a) if (b.has(w)) hits++;
  return (2 * hits) / (a.size + b.size);
}

/** Overlap of two cover boxes [ymin, xmin, ymax, xmax] (0 to 1). */
function overlap(p?: number[], q?: number[]): number {
  if (!p || !q || p.length !== 4 || q.length !== 4) return 0;
  const h = Math.min(p[2], q[2]) - Math.max(p[0], q[0]), w = Math.min(p[3], q[3]) - Math.max(p[1], q[1]);
  if (h <= 0 || w <= 0) return 0;
  const inter = h * w, area = (r: number[]) => (r[2] - r[0]) * (r[3] - r[1]);
  return inter / (area(p) + area(q) - inter);
}

/** The same book in two answers: a similar title, or the same cover box in the same picture. */
function sameBook(a: Found, b: Found): boolean {
  if (alike(a.title, b.title) >= 0.5) return true;
  if (a.author && b.author && alike(a.author, b.author) >= 0.5 && alike(a.title, b.title) >= 0.25) return true;
  return a.cover_image === b.cover_image && overlap(a.cover_box, b.cover_box) >= 0.5;
}

/** Several answers for the same pictures, as one list: the first answer, plus books only a later one found. */
function mergeFound(answers: Found[][]): Found[] {
  const out = answers[0].map((f) => ({ ...f }));
  for (const more of answers.slice(1)) {
    for (const f of more) {
      const same = out.find((o) => sameBook(o, f));
      if (!same) { out.push({ ...f }); continue; }
      if (!same.author && f.author) same.author = f.author;
      if (!same.cover_box && f.cover_box) { same.cover_box = f.cover_box; same.cover_image = f.cover_image; }
    }
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Books to add to stock. Gemini often answers "high demand" within a second or two, and a good answer
 * takes about 3 to 6 seconds, so two requests are kept running at all times: whenever one fails, it is sent
 * again at once (to the next model in turn), until the time limit. Each request is cut off after 15 seconds.
 * The first answer is used, together with the other one if it arrives within 2.5 seconds (two readings find more books).
 */
const SHELF_MODELS: [string, string][] = [
  ['gemini-3.5-flash-lite', 'minimal'], ['gemini-flash-lite-latest', 'minimal'],
  ['gemini-3.5-flash-lite', 'minimal'], ['gemini-3.5-flash', 'minimal'],
];

async function askShelf(key: string, parts: unknown[], schema: unknown, trace: string[] = []): Promise<{ model: string; books: Found[] }> {
  const t0 = Date.now(), until = t0 + DEADLINE_MS;
  const ctrls: AbortController[] = [];
  const answers: { model: string; books: Found[] }[] = [];
  let running = 0, last = '';
  const worker = async (first: number) => {
    running++;
    try {
      for (let n = 0; !answers.length && until - Date.now() > 3_000; n++) {
        const [model, think] = SHELF_MODELS[(first + n) % SHELF_MODELS.length];
        const ctrl = new AbortController();
        ctrls.push(ctrl);
        const timer = setTimeout(() => ctrl.abort(), Math.min(15_000, until - Date.now()));
        const s0 = Date.now() - t0;
        try {
          const r = await callModel(key, model, parts, schema, think, ctrl.signal);
          answers.push(r);
          trace.push(`${model} ${s0}-${Date.now() - t0}ms ok ${r.books.length}`);
          return;
        } catch (e) {
          last = (e as Error).message;
          trace.push(`${model} ${s0}-${Date.now() - t0}ms ${/demand/i.test(last) ? 'busy' : last.slice(0, 60)}`);
          await sleep(Math.min(400 * (n + 1), 1_500));
        } finally {
          clearTimeout(timer);
        }
      }
    } finally {
      running--;
    }
  };
  try {
    void worker(0);
    await sleep(250);
    void worker(1);
    while (!answers.length && running > 0) await sleep(100);
    if (answers.length) {
      const grace = Date.now() + 2_500;
      while (Date.now() < grace && running > 0 && answers.length < 2) await sleep(100);
      return { model: answers[0].model, books: mergeFound(answers.map((x) => x.books)) };
    }
  } finally {
    ctrls.forEach((c) => c.abort());
  }
  throw new Error(!last || /abort|demand|overload|unavailable|quota|rate|timeout/i.test(last) ? 'busy' : last);
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

  const shelf = form.get('mode') === 'shelf';
  const parts: unknown[] = [{ text: shelf ? SHELF_PROMPT : PROMPT }];
  for (const f of frames) parts.push({ inlineData: { mimeType: 'image/jpeg', data: await toBase64(f) } });
  if (audio instanceof File && audio.size > 0) parts.push({ inlineData: { mimeType: 'audio/wav', data: await toBase64(audio) } });

  const t0 = Date.now();
  const testModel = String(form.get('model') || '');
  const opts = {
    model: TEST_MODELS.includes(testModel) ? testModel : undefined,
    think: ['minimal', 'low', 'off'].includes(String(form.get('think'))) ? String(form.get('think')) : undefined,
  };
  const trace: string[] = [];
  try {
    const [found, c] = await Promise.all([shelf && !opts.model ? askShelf(key, parts, SHELF_SCHEMA, trace) : askGemini(key, parts, shelf ? SHELF_SCHEMA : SCHEMA, opts), getCatalog().finally(() => trace.push(`catalog ${Date.now() - t0}ms`))]);
    if (!c) return Response.json({ error: 'catalog' }, { status: 503 });
    const books = found.books.map((f) => ({ ...f, matches: match(c, f.title, f.author) }));
    books.sort((x, y) => Number(y.featured) - Number(x.featured));
    return Response.json({ model: found.model, frames: frames.length, audio: audio instanceof File && audio.size > 0, ms: Date.now() - t0, trace, books });
  } catch (e) {
    return Response.json({ error: (e as Error).message || 'failed', ms: Date.now() - t0, trace }, { status: 502 });
  }
}
