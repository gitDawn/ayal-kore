// Staff-side helper: the current inventory as one entry per distinct book.
import { publicFileUrl, supabase, type InventoryVersion } from './supabase';
import { A, T, decodeSnapshot, norm, type BookRow } from './inventory';
import { rowKey } from './categories';

export interface Book {
  key: string;
  row: BookRow; // first copy, for title/author/publisher
  copies: number;
  t: string;
  a: string;
}

export async function loadUniqueBooks(): Promise<Book[]> {
  const { data, error } = await supabase()
    .from('inventory_versions').select('*').order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  const v = (data?.[0] ?? null) as unknown as InventoryVersion | null;
  if (!v) return [];
  const res = await fetch(publicFileUrl(v.file_path), { cache: 'no-store' });
  if (!res.ok) throw new Error('snapshot');
  const snap = await decodeSnapshot(await res.arrayBuffer());
  const byKey = new Map<string, Book>();
  for (const row of snap.rows) {
    const key = rowKey(row);
    const b = byKey.get(key);
    if (b) b.copies++;
    else byKey.set(key, { key, row, copies: 1, t: norm(row[T]), a: norm(row[A]) });
  }
  return [...byKey.values()];
}

export const bookRef = (b: Book) => ({ key: b.key, title: b.row[T], author: b.row[A] || '' });
