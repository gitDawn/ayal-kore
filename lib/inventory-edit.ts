// Staff edits to single copies in the current inventory (for example, a price change).
// Each save writes a new inventory version, so the previous one can be restored.
import { BUCKET, publicFileUrl, supabase, type InventoryVersion } from './supabase';
import { COLUMNS, P, decodeSnapshot, encodeSnapshot, type BookRow, type Snapshot } from './inventory';
import { rowKey } from './categories';
import { countInStock } from './stock';
import { refreshCatalog } from '@/app/actions';

async function latest(): Promise<{ version: InventoryVersion; rows: BookRow[] }> {
  const { data, error } = await supabase().from('inventory_versions').select('*').order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  const version = data?.[0] as unknown as InventoryVersion | undefined;
  if (!version) throw new Error('no inventory');
  const res = await fetch(publicFileUrl(version.file_path), { cache: 'no-store' });
  if (!res.ok) throw new Error('snapshot');
  return { version, rows: (await decodeSnapshot(await res.arrayBuffer())).rows };
}

/** The copies of one book in the current inventory, in file order. */
export async function bookCopies(key: string): Promise<BookRow[]> {
  const { rows } = await latest();
  return rows.filter((r) => rowKey(r) === key);
}

/** Set new prices for the copies of one book (same order as bookCopies). Returns how many changed. */
export async function saveCopyPrices(key: string, title: string, prices: number[]): Promise<number> {
  const sb = supabase();
  const { rows } = await latest();
  let i = 0, changed = 0;
  const next = rows.map((r) => {
    if (rowKey(r) !== key) return r;
    const p = prices[i++];
    if (p == null || !Number.isFinite(p) || p === r[P]) return r;
    changed++;
    const c = [...r] as BookRow;
    c[P] = p;
    return c;
  });
  if (!changed) return 0;
  const snap: Snapshot = { columns: [...COLUMNS], rows: next, createdAt: new Date().toISOString(), sourceFileName: 'עריכת מחיר' };
  const blob = await encodeSnapshot(snap);
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-price.json.gz`;
  const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'application/gzip', upsert: false });
  if (up.error) throw up.error;
  const ins = await sb.from('inventory_versions').insert({
    file_path: path, row_count: countInStock(next), source_file_name: 'עריכת מחיר',
    note: `עריכת מחיר: ${title}`,
  });
  if (ins.error) { await sb.storage.from(BUCKET).remove([path]); throw ins.error; }
  await refreshCatalog().catch(() => {});
  return changed;
}
