// Book descriptions (blurbs) saved from Google Books, one per book key.
import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase';

const hasHebrew = (s: string) => /[֐-׿]/.test(s);

/**
 * Clean a Google description and decide whether it can be shown for this book.
 * A Hebrew book only gets a description written mostly in Hebrew.
 */
export function usableDescription(raw: string | undefined | null, title: string): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<br\s*\/?>|<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length < 40) return null;
  if (hasHebrew(title)) {
    const heb = (text.match(/[א-ת]/g) || []).length;
    const latin = (text.match(/[A-Za-z]/g) || []).length;
    if (heb < 30 || heb < latin * 2) return null;
  }
  return text;
}

export async function saveDescription(bookKey: string, description: string, googleId?: string | null) {
  const { error } = await supabase().from('book_descriptions').upsert({
    book_key: bookKey, description, source: 'google', google_id: googleId ?? null, updated_at: new Date().toISOString(),
  }, { onConflict: 'book_key' });
  if (error) throw error;
}

/** The saved description of one book (public read), or null. */
export async function fetchDescription(bookKey: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/book_descriptions?select=description&book_key=eq.${encodeURIComponent(bookKey)}`,
    { headers: { apikey: SUPABASE_KEY } },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as { description: string }[];
  return rows[0]?.description ?? null;
}
