// Records a catalog search (text, filters and number of results; nothing about the visitor).
import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase';

export interface SearchEntry { q: string; field: string; category: string; condition: string; maxPrice: string; results: number; }

export function logSearch(e: SearchEntry) {
  const max = e.maxPrice ? Number(e.maxPrice) : null;
  fetch(`${SUPABASE_URL}/rest/v1/search_log`, {
    method: 'POST',
    keepalive: true,
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      q: e.q.trim().slice(0, 200),
      field: e.field,
      category: e.category.slice(0, 100) || null,
      condition: e.condition.slice(0, 50) || null,
      max_price: max != null && Number.isFinite(max) && max >= 0 && max < 100000 ? max : null,
      results: e.results,
    }),
  }).catch(() => { /* logging must never disturb the search */ });
}

export interface SearchStat { q: string; searches: number; zero_results: number; last_results: number; last_at: string; }

/** Staff only: searches grouped by text for the last `days` days. */
export async function fetchSearchStats(days: number): Promise<SearchStat[]> {
  const { data, error } = await supabase().rpc('search_stats', { days });
  if (error) throw error;
  return (data ?? []) as SearchStat[];
}
