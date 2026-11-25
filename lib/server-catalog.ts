import 'server-only';
// The catalog as search engines see it: one entry per book (title + author), with all its copies.
// Built on the server from the latest inventory snapshot, category edits and covers,
// and kept in memory until one of them changes.
import { A, CAT, COND, P, PUB, SUB, T, Y, decodeSnapshot, inStock, type BookRow } from './inventory';
import { fetchCategoryEdits, rowKey } from './categories';
import { fetchAllCovers } from './coverLinks';
import { latestVersion, snapshotUrl } from './server-inventory';
import { bookId, bookPathFor } from './bookUrl';
import { SUPABASE_KEY, SUPABASE_URL } from './supabase';

export interface Copy { condition: string; price: number; row: BookRow; }
export interface Book {
  key: string;
  id: string;
  path: string;
  title: string;
  author: string;
  publisher: string;
  year: number | null;
  cats: string[];
  subs: string[];
  cover?: string;
  /** False for a book kept from an earlier inventory that sold out; its one copy is the last one known. */
  inStock: boolean;
  copies: Copy[];
}
export interface Catalog {
  versionId: string;
  updatedAt: string | null;
  books: Book[];
  byId: Map<string, Book>;
  byCat: Map<string, Book[]>;
}

// The catalog is rebuilt when the inventory, a cover or a category edit changes. A tiny check of
// the latest change times runs at most every CHECK; a full rebuild happens at the latest after TTL.
const TTL = 30 * 60_000;
const CHECK = 20_000;
let cached: { at: number; checked: number; stamp: string; data: Catalog } | null = null;
let loading: Promise<Catalog | null> | null = null;
const collator = new Intl.Collator('he');

async function build(): Promise<Catalog | null> {
  const v = await latestVersion();
  if (!v) return null;
  const [res, edits, covers] = await Promise.all([
    fetch(snapshotUrl(v), { cache: 'no-store' }),
    fetchCategoryEdits().catch(() => new Map()),
    fetchAllCovers().catch(() => new Map<string, string>()),
  ]);
  if (!res.ok) throw new Error(`snapshot ${res.status}`);
  const snap = await decodeSnapshot(await res.arrayBuffer());

  const map = new Map<string, Book>();
  for (const r of snap.rows) {
    if (!r[T]) continue;
    const key = rowKey(r);
    let b = map.get(key);
    if (!b) {
      b = {
        key, id: bookId(key), path: bookPathFor(r[T], r[A]),
        title: r[T], author: r[A] || '', publisher: r[PUB] || '', year: r[Y] ?? null,
        cats: [], subs: [], cover: covers.get(key), inStock: false, copies: [],
      };
      map.set(key, b);
    }
    if (!b.publisher && r[PUB]) b.publisher = r[PUB];
    if (b.year == null && r[Y] != null) b.year = r[Y];
    if (r[CAT] && !b.cats.includes(r[CAT])) b.cats.push(r[CAT]);
    if (r[SUB] && !b.subs.includes(r[SUB])) b.subs.push(r[SUB]);
    b.copies.push({ condition: r[COND] || '', price: r[P], row: r });
  }

  const books = [...map.values()];
  const byId = new Map<string, Book>();
  const byCat = new Map<string, Book[]>();
  for (const b of books) {
    const e = edits.get(b.key);
    if (e) { b.cats = e.categories; b.subs = e.subcategories; }
    const available = b.copies.filter((c) => inStock(c.row));
    b.inStock = available.length > 0;
    b.copies = (b.inStock ? available : b.copies.slice(0, 1)).sort((x, y) => x.price - y.price);
    byId.set(b.id, b);
    for (const c of b.cats) {
      if (!byCat.has(c)) byCat.set(c, []);
      byCat.get(c)!.push(b);
    }
  }
  const order = (x: Book, y: Book) => Number(y.inStock) - Number(x.inStock) || collator.compare(x.title, y.title);
  books.sort(order);
  for (const list of byCat.values()) list.sort(order);
  return { versionId: v.id, updatedAt: v.created_at ?? null, books, byId, byCat };
}

/** Latest change times of what the catalog is built from (a few tiny public queries). */
async function changeStamp(): Promise<string> {
  const last = async (table: string, col: string) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${col}&order=${col}.desc&limit=1`,
      { headers: { apikey: SUPABASE_KEY }, cache: 'no-store' });
    if (!res.ok) throw new Error(`${table} ${res.status}`);
    const rows = (await res.json()) as Record<string, string>[];
    return rows[0]?.[col] ?? '';
  };
  const parts = await Promise.all([
    last('inventory_versions', 'created_at'), last('book_covers', 'updated_at'), last('book_categories', 'updated_at'),
  ]);
  return parts.join('|');
}

export async function getCatalog(): Promise<Catalog | null> {
  const now = Date.now();
  if (cached && now - cached.at < TTL) {
    if (now - cached.checked < CHECK) return cached.data;
    const c = cached;
    c.checked = now;
    const stamp = await changeStamp().catch(() => c.stamp);
    if (stamp === c.stamp) return c.data;
  }
  if (!loading) {
    // The stamp is taken before building, so a change made during the build is caught by the next check.
    loading = changeStamp().catch(() => '')
      .then(async (stamp) => { const data = await build(); if (data) cached = { at: Date.now(), checked: Date.now(), stamp, data }; return data; })
      .catch((e) => { console.error('catalog build failed', e); return cached?.data ?? null; })
      .finally(() => { loading = null; });
  }
  return loading;
}

/** Categories with their number of books in stock, largest first. */
export function categoryList(c: Catalog): [string, number][] {
  return [...c.byCat.entries()].map(([k, v]) => [k, v.filter((b) => b.inStock).length] as [string, number]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
}

export const inStockCount = (c: Catalog) => c.books.filter((b) => b.inStock).length;
