// Cover images linked from Simania (shown directly from its image server) for
// books without a stored cover. Read is public; the table holds only key + address.
import { SUPABASE_KEY, SUPABASE_URL } from './supabase';
import { fetchCoverMap } from './covers';

export async function fetchCoverLinks(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const page = 1000;
  for (let from = 0; from < 500000; from += page) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/book_cover_links?select=book_key,url&order=book_key`,
      { headers: { apikey: SUPABASE_KEY, Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' }, cache: 'no-store' },
    );
    if (!res.ok) break;
    const rows = (await res.json()) as { book_key: string; url: string }[];
    for (const r of rows) out.set(r.book_key, r.url);
    if (rows.length < page) break;
  }
  return out;
}

/**
 * book_key → image address for the public catalog.
 * Only covers stored on the site are shown. Simania's links (fetchCoverLinks)
 * are kept in the database but not displayed, by staff decision.
 */
export async function fetchAllCovers(): Promise<Map<string, string>> {
  return fetchCoverMap().catch(() => new Map<string, string>());
}
