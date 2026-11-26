// Staff "עדכון מסימניה": read the store's seller inventory on Simania (with the bookmarklet below),
// show what would change on the site, and apply it only after staff approve.
import { BUCKET, publicFileUrl, supabase, type InventoryVersion } from './supabase';
import { COLUMNS, COND, OUT, P, decodeSnapshot, encodeSnapshot, inStock, type BookRow, type Snapshot } from './inventory';
import { countInStock } from './stock';
import { bookKey, rowKey } from './categories';
import { IMPORT_BUCKET, simaniaTags, type SimaniaRaw } from './simania';
import { refreshCatalog } from '@/app/actions';

export {
  SITE_ORIGIN, SIMANIA_ORIGIN, SIMANIA_INVENTORY, MESSAGE_KIND, TIME_LIMITS, DEFAULT_LIMIT, BOOKMARKLET, type TimeLimit,
} from './simania-reader';
import { HASH_KEY, SIMANIA_INVENTORY, TIME_LIMITS, type TimeLimit } from './simania-reader';

export interface SimaniaChange { title: string; author: string; fromCond: string; toCond: string; fromPrice: number; toPrice: number; }

export interface SimaniaPlan {
  items: SimaniaRaw[];
  fetchedAt: string;
  since: TimeLimit | null;   // the period read ('all' or null = the whole list)
  pages: number | null;      // pages read
  totalPages: number | null; // pages in the whole list
  base: InventoryVersion | null;
  rows: BookRow[];          // the site's rows after the merge (without the added ones)
  added: BookRow[];
  returned: BookRow[];      // were marked out of stock, listed on Simania again
  removed: BookRow[];       // in stock on the site but no longer listed on Simania: marked out of stock
  full: boolean;            // the whole list was read, so books missing from it were removed on Simania
  changed: SimaniaChange[];
}

const toRow = (i: SimaniaRaw): BookRow => [
  (i.bookTitle || '').trim(), (i.bookAuthor || '').trim(), (i.conditionText || '').trim(), Number(i.price) || 0,
  (i.categoryName || '').trim(), (i.subcategoryName || '').trim(), (i.publisher || '').trim(), i.year ?? null,
];

/** Accepts what the reader sent (or the saved file) and keeps only valid copies. */
export interface SimaniaPayload { items: SimaniaRaw[]; fetchedAt: string; since: TimeLimit | null; pages: number | null; totalPages: number | null; }

/** The Simania address to open for a given period. */
export const inventoryUrl = (limit: TimeLimit) => `${SIMANIA_INVENTORY}#${HASH_KEY}=${limit}`;

export function readPayload(data: unknown): SimaniaPayload {
  const d = data as { items?: unknown; fetchedAt?: unknown; since?: unknown; pages?: unknown; totalPages?: unknown };
  const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : null);
  if (!d || !Array.isArray(d.items)) throw new Error('bad payload');
  const byId = new Map<number, SimaniaRaw>();
  for (const x of d.items as SimaniaRaw[]) if (x && x.ownedId && x.bookTitle) byId.set(x.ownedId, x);
  return {
    items: [...byId.values()], fetchedAt: typeof d.fetchedAt === 'string' ? d.fetchedAt : new Date().toISOString(),
    since: TIME_LIMITS.includes(d.since as TimeLimit) ? (d.since as TimeLimit) : null,
    pages: num(d.pages), totalPages: num(d.totalPages),
  };
}

async function latest(): Promise<InventoryVersion | null> {
  const { data, error } = await supabase().from('inventory_versions').select('*').order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as InventoryVersion | null;
}

/** Compare Simania's list to the site's inventory. Nothing is written. */
export async function planSimania({ items, fetchedAt, since, pages, totalPages }: SimaniaPayload): Promise<SimaniaPlan> {
  const base = await latest();
  let rows: BookRow[] = [];
  if (base) {
    const res = await fetch(publicFileUrl(base.file_path), { cache: 'no-store' });
    if (!res.ok) throw new Error('snapshot');
    rows = (await decodeSnapshot(await res.arrayBuffer())).rows.map((r) => [...r] as BookRow);
  }
  const free = new Map<string, number[]>();
  rows.forEach((r, idx) => { const k = rowKey(r); (free.get(k) ?? free.set(k, []).get(k)!).push(idx); });
  const added: BookRow[] = [], returned: BookRow[] = [], changed: SimaniaChange[] = [];
  for (const i of items) {
    const row = toRow(i);
    const list = free.get(rowKey(row));
    if (!list || list.length === 0) { added.push(row); continue; }
    // Prefer the site copy that already agrees, then one in the same condition, then any.
    let pos = list.findIndex((x) => rows[x][COND] === row[COND] && rows[x][P] === row[P]);
    if (pos < 0) pos = list.findIndex((x) => rows[x][COND] === row[COND]);
    if (pos < 0) pos = 0;
    const idx = list.splice(pos, 1)[0];
    const was = rows[idx];
    let site = was;
    if (!inStock(site)) { site = rows[idx] = site.slice(0, 8) as BookRow; returned.push(was); }
    if ((row[COND] && site[COND] !== row[COND]) || (row[P] && site[P] !== row[P])) {
      const next = [...site] as BookRow;
      if (row[COND]) next[COND] = row[COND];
      if (row[P]) next[P] = row[P];
      rows[idx] = next;
      changed.push({ title: site[0], author: site[1], fromCond: site[COND], toCond: next[COND], fromPrice: site[P], toPrice: next[P] });
    }
  }
  // Only a read of the whole list shows which books were taken off Simania. Those that are still
  // in stock on the site are marked out of stock (kept on the site for reference, like sold books).
  const full = items.length > 0 && (since === 'all' || (since === null && !!pages && !!totalPages && pages >= totalPages));
  const removed: BookRow[] = [];
  if (full) {
    for (const list of free.values()) {
      for (const idx of list) {
        if (!inStock(rows[idx])) continue;
        removed.push(rows[idx]);
        const next = rows[idx].slice(0, 8) as BookRow;
        next[OUT] = 1;
        rows[idx] = next;
      }
    }
  }
  return { items, fetchedAt, since, pages, totalPages, base, rows, added, returned, removed, full, changed };
}

/** Write the approved plan: Simania details, a new inventory version, the raw list.
 *  Simania's cover images are not used or recorded (copyright), by staff decision. */
export async function applySimania(plan: SimaniaPlan, onProgress: (text: string) => void): Promise<{ inStock: number }> {
  const sb = supabase();
  const now = new Date().toISOString();

  onProgress('בודק שהמלאי באתר לא השתנה בינתיים…');
  const cur = await latest();
  if ((cur?.id ?? null) !== (plan.base?.id ?? null)) throw new Error('stale');

  onProgress('שומר תאריכי עדכון ותגיות…');
  const rows = plan.items.map((i) => ({
    owned_id: i.ownedId,
    book_key: bookKey(i.bookTitle, i.bookAuthor || ''),
    simania_book_id: i.bookId,
    title: i.bookTitle, author: i.bookAuthor, publisher: i.publisher, year: i.year,
    price: i.price, condition: i.conditionText, category: i.categoryName, subcategory: i.subcategoryName,
    cover_url: null,
    simania_updated_at: i.updatedAt,
    tags: simaniaTags(i),
    market: { min: i.marketMinPrice, max: i.marketMaxPrice, avg: i.marketAvgPrice, sellers: i.sellerCount, views: i.viewsCount },
    imported_at: now,
  }));
  for (let k = 0; k < rows.length; k += 500) {
    onProgress(`שומר תאריכי עדכון ותגיות: ${Math.min(k + 500, rows.length).toLocaleString('he-IL')} מתוך ${rows.length.toLocaleString('he-IL')}`);
    const { error } = await sb.from('simania_items').upsert(rows.slice(k, k + 500), { onConflict: 'owned_id' });
    if (error) throw error;
  }
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  const fileName = `${stamp}-${plan.items.length}.json`;

  const all = [...plan.rows, ...plan.added];
  let inStockNow = countInStock(all);
  const touched = plan.changed.length + plan.returned.length + plan.removed.length;
  if (plan.added.length || touched) {
    onProgress('מעדכן את המלאי באתר…');
    const snap: Snapshot = { columns: [...COLUMNS], rows: all, createdAt: now, sourceFileName: `סימניה ${fileName}` };
    const blob = await encodeSnapshot(snap);
    const path = `${now.slice(0, 10)}/${Date.now()}-simania.json.gz`;
    const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'application/gzip', upsert: false });
    if (up.error) throw up.error;
    const ins = await sb.from('inventory_versions').insert({
      file_path: path, row_count: inStockNow, source_file_name: `סימניה ${fileName}`,
      note: `מסימניה: נוספו ${plan.added.length} ספרים, חזרו למלאי ${plan.returned.length}, ירדו מהמלאי ${plan.removed.length}, עודכנו מחיר או מצב של ${plan.changed.length} עותקים`,
    });
    if (ins.error) { await sb.storage.from(BUCKET).remove([path]); throw ins.error; }
  } else {
    inStockNow = plan.base?.row_count ?? inStockNow;
  }

  onProgress('שומר את הרשימה שנקראה…');
  const raw = new Blob([JSON.stringify({ fetchedAt: plan.fetchedAt, items: plan.items })], { type: 'application/json' });
  await sb.storage.from(IMPORT_BUCKET).upload(`simania/${fileName}`, raw, { contentType: 'application/json', upsert: false });

  await refreshCatalog().catch(() => {});
  onProgress('');
  return { inStock: inStockNow };
}
