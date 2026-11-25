import 'server-only';
import { SUPABASE_KEY, SUPABASE_URL, publicFileUrl, type InventoryVersion } from '@/lib/supabase';

/** Newest published inventory version (public read), fetched on the server. */
export async function latestVersion(): Promise<InventoryVersion | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/inventory_versions?select=*&order=created_at.desc&limit=1`,
    { headers: { apikey: SUPABASE_KEY }, cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`inventory_versions ${res.status}`);
  const rows = (await res.json()) as InventoryVersion[];
  return rows[0] ?? null;
}

export function snapshotUrl(v: InventoryVersion): string {
  return publicFileUrl(v.file_path);
}
