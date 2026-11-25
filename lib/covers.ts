// Book cover images: stored small (WebP, up to ~300px wide) in the public
// Supabase bucket "covers", with one row per book in table book_covers.
// A book is identified by the same key as category edits (title + author).
import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase';
import { saveDescription, usableDescription } from './descriptions';

export const COVER_BUCKET = 'covers';

/** Stored width: Google's larger covers keep more detail; small thumbnails stay small. */
const HQ_WIDTH = 600;
const STD_WIDTH = 300;
/** Marks files saved at the larger width, so they are not upgraded again. */
export const isWideFile = (path: string | null | undefined) => !!path && path.includes('-w6');

// Google Books key: only allows searching the public book catalog.
const GOOGLE_KEY = 'AIzaSyCJpcXMmFSFqBg-dS9QYXjB_i7Rl3IwrR0';

export type CoverSource = 'google' | 'staff' | 'none' | 'removed';

/** Why a book has no cover from Google. */
export type MissReason = 'no-results' | 'no-match' | 'no-image' | 'plain' | 'inner';

export interface CoverRow {
  book_key: string;
  path: string | null;
  source: CoverSource;
  reason?: string | null;
  google_id?: string | null;
  title?: string | null;
  author?: string | null;
  suspect?: string | null;
  reviewed?: boolean;
  hq?: boolean | null;
  query?: string | null;
}

export function coverUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${COVER_BUCKET}/${encodeURIComponent(path)}`;
}

/** All cover rows (public read). With onlyWithImage, just the books that have a picture. */
export async function fetchCoverRows(onlyWithImage: boolean, full = false): Promise<CoverRow[]> {
  const out: CoverRow[] = [];
  const page = 1000;
  const filter = onlyWithImage ? '&path=not.is.null' : '';
  const cols = full ? 'book_key,path,source,reason,google_id,title,author,suspect,reviewed,hq,query' : 'book_key,path,source,reason';
  for (let from = 0; from < 500000; from += page) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/book_covers?select=${cols}&order=book_key${filter}`,
      { headers: { apikey: SUPABASE_KEY, Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' }, cache: 'no-store' },
    );
    if (!res.ok) break;
    const rows = (await res.json()) as CoverRow[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

/** book_key → public image URL, for books that have a cover. */
export async function fetchCoverMap(): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (const r of await fetchCoverRows(true)) if (r.path) m.set(r.book_key, coverUrl(r.path));
  return m;
}

// ── Google Books lookup ──

/** Google refused the search. `daily` is true only when the day's quota is really used up;
 *  otherwise it is a short-term rate limit and the search can be retried after a pause. */
export class QuotaError extends Error {
  constructor(message: string, public daily = false) { super(message); }
}

const hasHebrew = (s: string) => /[֐-׿]/.test(s);

const cleanTitle = (s: string) =>
  s.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/[‎‏֑-ׇ]/g, '')
    .split(/[:;]| - /)[0]
    .replace(/["'׳״?!.,]/g, '')
    .replace(/[־-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Titles, roles and placeholders that appear in the author column but not in Google's author names.
const AUTHOR_NOISE = [
  /(^|\s)(ד["״]?ר|דוקטור|פרופ['׳]?|פרופסור|הרב|הרבי|רבי|מר|גב['׳])(?=\s|$)/g,
  /(^|\s)(בחר[הו]?|ערכ[הו]?|עורכ(ים|ת)|עורך|עריכה|מאת|תרגו?ם|ליקט[הו]?|בעריכת)(\s+ו?(ערכ[הו]?|ליקט[הו]?))?(?=\s|:|$)\s*:?/g,
  /\b(Dr|Prof|Rabbi|Mr|Mrs|Ms|Ed|Eds)\b\.?/gi,
];
const AUTHOR_PLACEHOLDERS = new Set(['מחברים שונים', 'כללי', 'שונים', 'אנונימי', 'marvel']);

export function cleanAuthor(s: string): string {
  let a = (s || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ');
  for (const re of AUTHOR_NOISE) a = a.replace(re, ' ');
  a = cleanTitle(a);
  return AUTHOR_PLACEHOLDERS.has(a.toLowerCase()) ? '' : a;
}

/**
 * A looser identity than the book key: ignores notes in brackets, punctuation
 * and the vowel letters א ה ו י, so spelling variants such as קרנגי / קארנגי
 * and "אל דאגה [מהדורת 2007]" count as the same book for cover lookup.
 */
export function looseKey(title: string, author: string): string {
  const f = (s: string) => s.toLowerCase().replace(/[אהוי]/g, '').replace(/\s+/g, ' ').trim();
  return `${f(cleanTitle(title))}|${f(cleanAuthor(author))}`;
}

const words = (s: string) => cleanTitle(s).split(' ').filter((w) => w.length > 1);

function titleScore(ours: string, theirs: string) {
  const a = words(ours);
  if (!a.length) return 0;
  const b = ` ${cleanTitle(theirs || '')} `;
  return a.filter((w) => b.includes(w)).length / a.length;
}

function authorMatch(ours: string, theirs: string[] | undefined) {
  const a = cleanAuthor(ours).split(' ').filter((w) => w.length > 1);
  if (!a.length || !theirs?.length) return true; // nothing to compare
  const s = theirs.join(' ').replace(/["'׳״]/g, '').replace(/[־-]/g, ' ');
  return a.some((w) => s.includes(w));
}

interface Volume { id: string; volumeInfo: { title?: string; authors?: string[]; description?: string; imageLinks?: { thumbnail?: string } } }

const thumb = (v: Volume) =>
  v.volumeInfo.imageLinks?.thumbnail?.replace(/^http:/, 'https:').replace(/&edge=curl/g, '') ?? null;

async function search(q: string): Promise<Volume[]> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?maxResults=10&printType=books&key=${GOOGLE_KEY}&q=${encodeURIComponent(q)}`,
  );
  if (res.status === 429 || res.status === 403) {
    // Tell a per-minute rate limit apart from the daily quota by Google's reason text.
    let reason = '';
    try {
      const j = await res.json() as { error?: { message?: string; errors?: { reason?: string }[]; details?: { reason?: string; metadata?: { quota_limit?: string } }[] } };
      reason = [j.error?.message, ...(j.error?.errors ?? []).map((e) => e.reason), ...(j.error?.details ?? []).map((d) => `${d.reason} ${d.metadata?.quota_limit ?? ''}`)].join(' ');
    } catch { /* no body */ }
    console.warn('Google Books refused:', res.status, reason);
    const daily = /daily|per ?day|PerDay/i.test(reason) && !/minute/i.test(reason);
    throw new QuotaError(`${res.status} ${reason}`.trim(), daily);
  }
  if (!res.ok) throw new Error(`google ${res.status}`);
  return ((await res.json()) as { items?: Volume[] }).items || [];
}

export interface Candidate { id: string; title: string; authors: string; image: string | null; }

export interface Lookup {
  query: string;
  hit: Candidate | null;           // matched book with a picture
  titleOnly?: boolean;             // matched by title alone: the author could not be confirmed
  reason?: Exclude<MissReason, 'plain' | 'inner'>;
  candidate?: Candidate;           // closest result when nothing matched, for diagnosis
  description?: string | null;     // the matched book's description, when usable
  descriptionId?: string | null;   // Google id of the volume the description came from
}

const asCandidate = (v: Volume): Candidate => ({
  id: v.id, title: v.volumeInfo.title || '', authors: (v.volumeInfo.authors || []).join(', '), image: thumb(v),
});

/**
 * How many searches to run for a book:
 *   'both'   title + author, then (if nothing matched) title only, which catches
 *            books Google lists under the author's English name;
 *   'first'  only title + author (one search, so the daily quota covers twice the books);
 *   'second' only the title-only search, for books the first search already missed.
 */
export type SearchMode = 'both' | 'first' | 'second';

/** The recorded query of a book that so far had only the first search, so it can get the second. */
export const needsSecondSearch = (query: string | null | undefined) =>
  !!query && query.includes('inauthor:') && !query.includes('  |  ');

export async function findGoogleCover(title: string, author: string, mode: SearchMode = 'both'): Promise<Lookup> {
  const t = cleanTitle(title);
  if (!t) return { query: '', hit: null, reason: 'no-results' };
  const a = cleanAuthor(author);
  const queries: string[] = [];
  let matchedNoImage: Volume | null = null;
  let firstSeen: Volume | null = null;

  const scan = (items: Volume[], strict: boolean) => {
    for (const v of items) {
      firstSeen ??= v;
      const vt = v.volumeInfo.title || '';
      const score = titleScore(title, vt);
      let ok: boolean;
      if (!strict) {
        ok = score >= 0.8 && authorMatch(author, v.volumeInfo.authors);
      } else {
        // Title-only search: the title must match fully; a Hebrew author may appear in English.
        const exact = cleanTitle(vt) === t;
        const full = words(title).length >= 2 && score === 1;
        const theirs = (v.volumeInfo.authors || []).join(' ');
        const authorOk = authorMatch(author, v.volumeInfo.authors) || (hasHebrew(a) && !hasHebrew(theirs));
        ok = (exact || full) && authorOk;
      }
      if (!ok) continue;
      if (thumb(v)) return v;
      matchedNoImage ??= v;
    }
    return null;
  };

  let q = `intitle:${t}${a ? ` inauthor:${a}` : ''}`;
  queries.push(q);
  let found = mode === 'second' ? null : scan(await search(q), false);
  let titleOnly = false;
  if (!found && a && mode !== 'first') {
    q = `intitle:${t}`;
    queries.push(q);
    found = scan(await search(q), true);
    titleOnly = !!found && !authorMatch(author, found.volumeInfo.authors);
  }
  const query = queries.join('  |  ');
  // The description of the matched book (with or without a picture).
  const matched: Volume | null = found ?? matchedNoImage;
  const desc = matched ? { description: usableDescription(matched.volumeInfo.description, title), descriptionId: matched.id } : {};
  if (found) return { query, hit: asCandidate(found), titleOnly, ...desc };
  if (matchedNoImage) return { query, hit: null, reason: 'no-image', candidate: asCandidate(matchedNoImage), ...desc };
  if (firstSeen) return { query, hit: null, reason: 'no-match', candidate: asCandidate(firstSeen) };
  return { query, hit: null, reason: 'no-results' };
}

// ── Image handling ──

export async function loadGoogleImage(url: string): Promise<ImageBitmap> {
  const res = await fetch(`/cover-image?u=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`image ${res.status}`);
  return createImageBitmap(await res.blob());
}

const googleCoverUrl = (id: string, zoom: number) =>
  `https://books.google.com/books/content?id=${encodeURIComponent(id)}&printsec=frontcover&img=1&zoom=${zoom}&source=gbs_api`;

// Google keeps larger cover sizes for some books (zoom 3 is about 575px wide,
// zoom 2 about 300px). When a size does not exist it answers a wide strip or a
// gray "image not available" page instead, so each large image is checked.
// Google's gray "image not available" page at zoom 3 is a 575×829 JPEG of exactly this size.
const PLACEHOLDER_BYTES = new Set([246264]);

/** A tiny grayscale fingerprint, used to check that two images show the same cover. */
function fingerprint(img: ImageBitmap): number[] {
  const c = document.createElement('canvas');
  c.width = 12; c.height = 18;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, 12, 18);
  const d = ctx.getImageData(0, 0, 12, 18).data;
  const g: number[] = [];
  for (let i = 0; i < d.length; i += 4) g.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]);
  return g;
}
const fingerprintDiff = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

export async function loadLargeGoogleImage(id: string): Promise<ImageBitmap | null> {
  // The small thumbnail (zoom 1) is always the real cover when Google has one.
  // A large version only counts if it looks like that thumbnail; Google sometimes
  // answers a gray "image not available" page instead of the large cover.
  let small: number[] | null = null;
  try {
    const res = await fetch(`/cover-image?u=${encodeURIComponent(googleCoverUrl(id, 1))}`);
    if (res.ok) small = fingerprint(await createImageBitmap(await res.blob()));
  } catch { /* compare without it */ }
  if (!small) return null;
  for (const zoom of [3, 2]) {
    try {
      const res = await fetch(`/cover-image?u=${encodeURIComponent(googleCoverUrl(id, zoom))}`);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.includes('jpeg') || PLACEHOLDER_BYTES.has(blob.size)) continue;
      const img = await createImageBitmap(blob);
      if (img.width < 250 || img.height / img.width < 1.1) continue;
      if (fingerprintDiff(fingerprint(img), small) > 42) continue;
      return img;
    } catch { /* try the next size */ }
  }
  return null;
}

/** The largest available version of a Google cover, falling back to the small thumbnail. */
async function loadBestGoogleImage(c: Candidate): Promise<{ img: ImageBitmap; hq: boolean }> {
  const big = await loadLargeGoogleImage(c.id);
  if (big) return { img: big, hq: true };
  return { img: await loadGoogleImage(c.image as string), hq: false };
}

/**
 * 'plain'  → a library binding in one color: never a usable cover.
 * 'white'  → mostly white with almost no color: a text page, or a minimalist
 *            white cover. Rejected as an inside page (staff can restore it).
 */
export function judgeImage(img: ImageBitmap): 'ok' | 'plain' | 'white' {
  const w = 48, h = Math.max(1, Math.round((img.height / img.width) * 48));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  let sum = 0, sum2 = 0, white = 0, colorful = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += l; sum2 += l * l;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (min > 215) white++;
    if (max > 40 && (max - min) / max > 0.3 && min < 200) colorful++;
  }
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  if (std < 16) return 'plain';
  if (white / n > 0.65 && colorful / n < 0.02) return 'white';
  return 'ok';
}

/** Shrink to at most maxW wide and encode as WebP (JPEG where WebP is unsupported). */
export async function toSmallImage(img: ImageBitmap, maxW = 300): Promise<Blob> {
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const enc = (type: string, q: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, type, q));
  const webp = await enc('image/webp', 0.75);
  if (webp && webp.type === 'image/webp') return webp;
  const jpg = await enc('image/jpeg', 0.75);
  if (!jpg) throw new Error('encode');
  return jpg;
}

async function fileStem(bookKey: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(bookKey));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

interface BookRef { key: string; title: string; author: string; }

/** Extra details stored with a row, so staff can see what the search did. */
export interface CoverMeta {
  google_id?: string | null;
  reason?: MissReason | null;
  query?: string | null;
  google_title?: string | null;
  google_authors?: string | null;
  google_image?: string | null;
  suspect?: string | null;
  reviewed?: boolean;
  hq?: boolean | null;
}

const EMPTY_META: CoverMeta = {
  google_id: null, reason: null, query: null, google_title: null, google_authors: null, google_image: null, suspect: null, hq: null,
};

/** Upload a cover and record it. Replaces (and deletes) any previous file. */
export async function saveCover(book: BookRef, blob: Blob, source: 'google' | 'staff', meta: CoverMeta = {}, oldPath?: string | null) {
  const sb = supabase();
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${await fileStem(book.key)}-${Date.now().toString(36)}${meta.hq ? '-w6' : ''}.${ext}`;
  const up = await sb.storage.from(COVER_BUCKET).upload(path, blob, { contentType: blob.type, upsert: true, cacheControl: '31536000' });
  if (up.error) throw up.error;
  const { error } = await sb.from('book_covers').upsert({
    book_key: book.key, title: book.title, author: book.author || null, path, source,
    ...EMPTY_META, reviewed: source === 'staff', ...meta,
  }, { onConflict: 'book_key' });
  if (error) { await sb.storage.from(COVER_BUCKET).remove([path]); throw error; }
  if (oldPath && oldPath !== path) await sb.storage.from(COVER_BUCKET).remove([oldPath]);
  return path;
}

/** Record that a book has no cover ('none' = searched and not found, 'removed' = staff removed it). */
export async function markNoCover(book: BookRef, source: 'none' | 'removed', meta: CoverMeta = {}, oldPath?: string | null) {
  const sb = supabase();
  const { error } = await sb.from('book_covers').upsert({
    book_key: book.key, title: book.title, author: book.author || null, path: null, source,
    ...EMPTY_META, ...meta,
  }, { onConflict: 'book_key' });
  if (error) throw error;
  if (oldPath) await sb.storage.from(COVER_BUCKET).remove([oldPath]);
}

/** Fetch a Google thumbnail and store it as the book's cover. */
export async function saveGoogleImage(book: BookRef, c: Candidate, meta: CoverMeta = {}, oldPath?: string | null) {
  if (!c.image) throw new Error('no image');
  const { img, hq } = await loadBestGoogleImage(c);
  const blob = await toSmallImage(img, hq ? HQ_WIDTH : STD_WIDTH);
  return saveCover(book, blob, 'google', {
    google_id: c.id, google_title: c.title, google_authors: c.authors, google_image: c.image, hq, ...meta,
  }, oldPath);
}

/** Give a book the cover already found for a similar book (copies the small image file). */
export async function copyCoverFrom(book: BookRef, from: CoverRow): Promise<string> {
  if (!from.path) throw new Error('no cover to copy');
  const sb = supabase();
  const ext = from.path.split('.').pop() || 'webp';
  const path = `${await fileStem(book.key)}-${Date.now().toString(36)}${isWideFile(from.path) ? '-w6' : ''}.${ext}`;
  const cp = await sb.storage.from(COVER_BUCKET).copy(from.path, path);
  if (cp.error) throw cp.error;
  const { error } = await sb.from('book_covers').upsert({
    book_key: book.key, title: book.title, author: book.author || null, path,
    source: from.source === 'staff' ? 'staff' : 'google',
    ...EMPTY_META, google_id: from.google_id ?? null, suspect: from.suspect ?? null, reviewed: !!from.reviewed, hq: from.hq ?? null,
    query: `הועתק מספר דומה: ${from.title ?? ''}${from.author ? ` · ${from.author}` : ''}`,
  }, { onConflict: 'book_key' });
  if (error) { await sb.storage.from(COVER_BUCKET).remove([path]); throw error; }
  return path;
}

/** Record a miss without searching, because a similar book was already searched and not found. */
export async function copyMissFrom(book: BookRef, from: CoverRow) {
  await markNoCover(book, 'none', {
    reason: (from.reason as MissReason) ?? null, google_id: from.google_id ?? null,
    query: `לא חיפשנו שוב, כמו ספר דומה: ${from.title ?? ''}${from.author ? ` · ${from.author}` : ''}`,
  });
}

export type ImportResult =
  | { result: 'saved'; path: string; suspect: boolean; query: string }
  | { result: 'not-found' | 'rejected'; reason: MissReason; query: string };

/**
 * Look a book up on Google and store its cover if one is found.
 * Plain one-color bindings are rejected, and so are mostly-white images (an inside page);
 * both are kept in the list of books without a cover, with Google's image, so staff can
 * still restore one as the cover. Every miss is recorded with its reason and the closest
 * Google result. Throws QuotaError when Google's daily limit is used up.
 */
export async function importFromGoogle(book: BookRef, oldPath?: string | null, recordMiss = true, mode: SearchMode = 'both'): Promise<ImportResult> {
  const look = await findGoogleCover(book.title, book.author, mode);
  const base = { query: look.query };
  if (look.description) await saveDescription(book.key, look.description, look.descriptionId).catch(() => {});
  if (!look.hit) {
    const c = look.candidate;
    if (recordMiss) {
      await markNoCover(book, 'none', {
        ...base, reason: look.reason, google_id: c?.id ?? null, google_title: c?.title ?? null,
        google_authors: c?.authors ?? null, google_image: c?.image ?? null,
      });
    }
    return { result: 'not-found', reason: look.reason ?? 'no-results', query: look.query };
  }
  const hit = look.hit;
  const { img, hq } = await loadBestGoogleImage(hit);
  const verdict = judgeImage(img);
  if (verdict === 'plain' || verdict === 'white') {
    const reason: MissReason = verdict === 'plain' ? 'plain' : 'inner';
    if (recordMiss) {
      await markNoCover(book, 'none', {
        ...base, reason, google_id: hit.id, google_title: hit.title, google_authors: hit.authors, google_image: hit.image,
      });
    }
    return { result: 'rejected', reason, query: look.query };
  }
  const blob = await toSmallImage(img, hq ? HQ_WIDTH : STD_WIDTH);
  const path = await saveCover(book, blob, 'google', {
    ...base, google_id: hit.id, google_title: hit.title, google_authors: hit.authors, google_image: hit.image, hq,
    suspect: look.titleOnly ? 'title-only' : null,
  }, oldPath);
  return { result: 'saved', path, suspect: !!look.titleOnly, query: look.query };
}

/**
 * Replace an existing Google cover with Google's larger version, when one exists.
 * Keeps every other detail of the row. Records hq=false when there is no larger version.
 */
export async function upgradeCover(row: CoverRow): Promise<string | null> {
  if (!row.google_id || !row.path) return null;
  const sb = supabase();
  const big = await loadLargeGoogleImage(row.google_id);
  if (!big) {
    const { error } = await sb.from('book_covers').update({ hq: false }).eq('book_key', row.book_key);
    if (error) throw error;
    return null;
  }
  const blob = await toSmallImage(big, HQ_WIDTH);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${await fileStem(row.book_key)}-${Date.now().toString(36)}-w6.${ext}`;
  const up = await sb.storage.from(COVER_BUCKET).upload(path, blob, { contentType: blob.type, upsert: true, cacheControl: '31536000' });
  if (up.error) throw up.error;
  const { error } = await sb.from('book_covers').update({ path, hq: true }).eq('book_key', row.book_key);
  if (error) { await sb.storage.from(COVER_BUCKET).remove([path]); throw error; }
  await sb.storage.from(COVER_BUCKET).remove([row.path]);
  return path;
}
