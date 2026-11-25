// Import of the store's own seller inventory from Simania.
// The raw list is read from Simania by staff and stored as a JSON file in the
// private "imports" bucket; this module turns it into:
//   1. one simania_items row per copy (update date, tags, market prices),
//   2. a new inventory version with copies that are missing from the site,
//   3. covers for books that do not have one yet.
import { BUCKET, publicFileUrl, supabase, type InventoryVersion } from './supabase';
import { COLUMNS, COND, P, decodeSnapshot, encodeSnapshot, inStock, type BookRow, type Snapshot } from './inventory';
import { countInStock } from './stock';
import { bookKey, rowKey } from './categories';
import { fetchCoverRows, saveCover, toSmallImage } from './covers';
import { refreshCatalog } from '@/app/actions';

export const IMPORT_BUCKET = 'imports';

/** The fields kept from each item of Simania's seller inventory list. */
export interface SimaniaRaw {
  ownedId: number;
  bookId: number | null;
  bookTitle: string;
  bookAuthor: string | null;
  publisher: string | null;
  year: number | null;
  price: number | null;
  conditionText: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  hasImage: boolean;
  coverImage: string | null;
  updatedAt: string | null;
  sellerCount: number | null;
  isCheapest: boolean;
  isMostExpensive: boolean;
  hasDemand: boolean;
  isExclusive: boolean;
  isStale: boolean;
  marketMinPrice: number | null;
  marketMaxPrice: number | null;
  marketAvgPrice: number | null;
  viewsCount: number | null;
}

export interface SimaniaFile { fetchedAt: string; items: SimaniaRaw[]; }

/** The tags Simania shows in the status column of the inventory page. */
export function simaniaTags(i: SimaniaRaw): string[] {
  const t: string[] = [];
  if (i.isCheapest) t.push('זול');
  if (i.isMostExpensive) t.push('יקר');
  if ((i.sellerCount ?? 0) > 5) t.push('תחרות');
  if (i.hasDemand) t.push('מבוקש');
  if (i.isExclusive) t.push('בלעדי');
  if (i.isStale) t.push('ישן');
  return t;
}

export interface SimaniaItem {
  owned_id: number;
  book_key: string;
  price: number | null;
  condition: string | null;
  simania_updated_at: string | null;
  tags: string[];
}

/** Simania copies of one book (staff only). */
export async function fetchSimaniaItems(key: string): Promise<SimaniaItem[]> {
  const { data, error } = await supabase()
    .from('simania_items')
    .select('owned_id,book_key,price,condition,simania_updated_at,tags')
    .eq('book_key', key)
    .order('simania_updated_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as SimaniaItem[];
}

export async function listImportFiles(): Promise<{ name: string; created_at: string }[]> {
  const { data, error } = await supabase().storage.from(IMPORT_BUCKET).list('simania', { sortBy: { column: 'created_at', order: 'desc' }, limit: 20 });
  if (error) throw error;
  return (data ?? []).filter((f) => f.name.endsWith('.json')).map((f) => ({ name: f.name, created_at: f.created_at }));
}

export async function readImportFile(name: string): Promise<SimaniaFile> {
  const { data, error } = await supabase().storage.from(IMPORT_BUCKET).download(`simania/${name}`);
  if (error || !data) throw error ?? new Error('download');
  const f = JSON.parse(await data.text()) as SimaniaFile;
  if (!Array.isArray(f.items)) throw new Error('bad file');
  return f;
}

const toRow = (i: SimaniaRaw): BookRow => [
  (i.bookTitle || '').trim(), (i.bookAuthor || '').trim(), (i.conditionText || '').trim(), Number(i.price) || 0,
  (i.categoryName || '').trim(), (i.subcategoryName || '').trim(), (i.publisher || '').trim(), i.year ?? null,
];

export interface ImportSummary {
  items: number;
  added: number;
  updated: number;
  covers: number;
  coverErrors: number;
  addedTitles: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs the whole import. Covers are fetched one at a time with a pause,
 * so Simania's image server sees slow, ordinary traffic.
 */
export async function importSimania(file: SimaniaFile, onProgress: (text: string) => void, fileName: string, withCovers = true): Promise<ImportSummary> {
  const sb = supabase();
  const items = file.items.filter((i) => i.ownedId && i.bookTitle);
  const summary: ImportSummary = { items: items.length, added: 0, updated: 0, covers: 0, coverErrors: 0, addedTitles: [] };

  // 1. Simania details per copy.
  onProgress('שומר תאריכי עדכון ותגיות…');
  const rows = items.map((i) => ({
    owned_id: i.ownedId,
    book_key: bookKey(i.bookTitle, i.bookAuthor || ''),
    simania_book_id: i.bookId,
    title: i.bookTitle, author: i.bookAuthor, publisher: i.publisher, year: i.year,
    price: i.price, condition: i.conditionText, category: i.categoryName, subcategory: i.subcategoryName,
    cover_url: i.hasImage ? i.coverImage : null,
    simania_updated_at: i.updatedAt,
    tags: simaniaTags(i),
    market: { min: i.marketMinPrice, max: i.marketMaxPrice, avg: i.marketAvgPrice, sellers: i.sellerCount, views: i.viewsCount },
    imported_at: new Date().toISOString(),
  }));
  for (let k = 0; k < rows.length; k += 500) {
    const { error } = await sb.from('simania_items').upsert(rows.slice(k, k + 500), { onConflict: 'owned_id' });
    if (error) throw error;
  }

  // Cover links (shown directly from Simania for books without a stored cover).
  const links = new Map<string, string>();
  for (const r of rows) if (r.cover_url && !links.has(r.book_key)) links.set(r.book_key, r.cover_url);
  const linkRows = [...links].map(([book_key, url]) => ({ book_key, url, updated_at: new Date().toISOString() }));
  for (let k = 0; k < linkRows.length; k += 500) {
    await sb.from('book_cover_links').upsert(linkRows.slice(k, k + 500), { onConflict: 'book_key' });
  }

  // 2. Merge into the site's inventory. Copies are matched by book; Simania's price and
  //    condition replace the site's. Copies beyond the site's count are added.
  onProgress('משווה למלאי באתר…');
  const { data: vs, error: ve } = await sb.from('inventory_versions').select('*').order('created_at', { ascending: false }).limit(1);
  if (ve) throw ve;
  const current = (vs?.[0] ?? null) as unknown as InventoryVersion | null;
  let siteRows: BookRow[] = [];
  if (current) {
    const res = await fetch(publicFileUrl(current.file_path), { cache: 'no-store' });
    if (!res.ok) throw new Error('snapshot');
    siteRows = (await decodeSnapshot(await res.arrayBuffer())).rows;
  }
  const free = new Map<string, number[]>(); // book key → indexes of site copies not matched yet
  siteRows.forEach((r, idx) => { const k = rowKey(r); (free.get(k) ?? free.set(k, []).get(k)!).push(idx); });
  const missing: BookRow[] = [];
  let updated = 0;
  for (const i of items) {
    const row = toRow(i);
    const list = free.get(rowKey(row));
    if (!list || list.length === 0) { missing.push(row); continue; }
    // Prefer the site copy that already agrees, then one in the same condition, then any.
    let pos = list.findIndex((x) => siteRows[x][COND] === row[COND] && siteRows[x][P] === row[P]);
    if (pos < 0) pos = list.findIndex((x) => siteRows[x][COND] === row[COND]);
    if (pos < 0) pos = 0;
    const idx = list.splice(pos, 1)[0];
    let site = siteRows[idx];
    // Listed on Simania, so it is for sale again: drop the out-of-stock mark.
    if (!inStock(site)) { site = siteRows[idx] = site.slice(0, 8) as BookRow; updated++; }
    if ((row[COND] && site[COND] !== row[COND]) || (row[P] && site[P] !== row[P])) {
      siteRows[idx] = [...site] as BookRow;
      if (row[COND]) siteRows[idx][COND] = row[COND];
      if (row[P]) siteRows[idx][P] = row[P];
      updated++;
    }
  }
  summary.updated = updated;
  if (missing.length || updated) {
    onProgress(`מעדכן את המלאי: ${missing.length} ספרים חדשים, ${updated} עדכוני מחיר ומצב…`);
    const snap: Snapshot = { columns: [...COLUMNS], rows: [...siteRows, ...missing], createdAt: new Date().toISOString(), sourceFileName: fileName };
    const blob = await encodeSnapshot(snap);
    const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-simania.json.gz`;
    const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'application/gzip', upsert: false });
    if (up.error) throw up.error;
    const ins = await sb.from('inventory_versions').insert({
      file_path: path, row_count: countInStock(snap.rows), source_file_name: fileName,
      note: `מסימניה: נוספו ${missing.length} ספרים, עודכנו מחיר או מצב של ${updated} עותקים`,
    });
    if (ins.error) { await sb.storage.from(BUCKET).remove([path]); throw ins.error; }
    await refreshCatalog().catch(() => {});
    summary.added = missing.length;
    summary.addedTitles = missing.map((r) => r[0]);
  }

  // 3. Covers, only for books without one (not for books whose cover staff removed).
  if (!withCovers) { onProgress(''); return summary; }
  const coverRows = await fetchCoverRows(false);
  const skip = new Set(coverRows.filter((r) => r.path || r.source === 'removed').map((r) => r.book_key));
  const todo = new Map<string, SimaniaRaw>();
  for (const i of items) {
    const key = bookKey(i.bookTitle, i.bookAuthor || '');
    if (i.hasImage && i.coverImage && !skip.has(key) && !todo.has(key)) todo.set(key, i);
  }
  let n = 0;
  for (const [key, i] of todo) {
    n++;
    onProgress(`שומר כריכות מסימניה: ${n} מתוך ${todo.size}`);
    try {
      const res = await fetch(`/cover-image?u=${encodeURIComponent(i.coverImage as string)}`);
      if (!res.ok) throw new Error(String(res.status));
      const img = await createImageBitmap(await res.blob());
      const hq = img.width >= 450;
      const blob = await toSmallImage(img, hq ? 600 : 300);
      // Stored with source 'simania' so it is not mixed up with Google covers awaiting review.
      await saveCover({ key, title: i.bookTitle, author: i.bookAuthor || '' }, blob, 'simania' as 'staff', {
        hq, reviewed: true, query: 'כריכה מסימניה',
      });
      summary.covers++;
    } catch {
      summary.coverErrors++;
    }
    await sleep(1500);
  }
  onProgress('');
  return summary;
}

