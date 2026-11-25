// Edited categories per book, stored in Supabase (table book_categories).
// A book is identified by its normalized title + author, so edits survive
// re-uploading the inventory CSV. An edit replaces the file's category and
// subcategory for every copy of that book.
import { SUPABASE_KEY, SUPABASE_URL } from './supabase';
import { A, CAT, SUB, T, norm, type BookRow } from './inventory';

export interface CategoryEdit {
  book_key: string;
  title: string;
  author: string | null;
  categories: string[];
  subcategories: string[];
  updated_at?: string;
}

export function bookKey(title: string, author: string): string {
  return `${norm(title)}|${norm(author)}`;
}

export function rowKey(r: BookRow): string {
  return bookKey(r[T], r[A]);
}

/** Categories as written in the inventory file (single values). */
export function fileCategories(r: BookRow): { categories: string[]; subcategories: string[] } {
  return {
    categories: r[CAT] ? [r[CAT]] : [],
    subcategories: r[SUB] ? [r[SUB]] : [],
  };
}

/** Load all edits with the public key (read is open to everyone). */
export async function fetchCategoryEdits(): Promise<Map<string, CategoryEdit>> {
  const out = new Map<string, CategoryEdit>();
  const page = 1000;
  for (let from = 0; from < 200000; from += page) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/book_categories?select=book_key,title,author,categories,subcategories,updated_at&order=book_key`,
      { headers: { apikey: SUPABASE_KEY, Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' }, cache: 'no-store' },
    );
    if (!res.ok) {
      // Table not created yet, or temporarily unavailable: show the file's categories.
      if (from === 0) return out;
      break;
    }
    const rows = (await res.json()) as CategoryEdit[];
    for (const r of rows) out.set(r.book_key, r);
    if (rows.length < page) break;
  }
  return out;
}

/** Clean a list typed by staff: trim, collapse spaces, drop empties and duplicates. */
export function cleanList(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = raw.replace(/\s+/g, ' ').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
