import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Public project details. The publishable key is meant to be shipped to browsers;
// all write protection lives in the database and storage policies.
export const SUPABASE_URL = 'https://hrsqrehrrkklntmvxbns.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_yyW8YZE1_jaipSH-r-mOkg_YaOX-ObW';
export const BUCKET = 'inventory';

export interface InventoryVersion {
  id: string;
  file_path: string;
  row_count: number;
  source_file_name: string | null;
  note: string | null;
  created_at: string;
}

export function publicFileUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

let browserClient: SupabaseClient | null = null;

/** Browser client: keeps the staff session and picks up invite/reset links. */
export function supabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
    });
  }
  return browserClient;
}
