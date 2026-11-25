// Recommendations: a Facebook video that plays on the site, or a picture stored on the site,
// with the books from it that are in stock.
// Books are listed by their book-page id (the 12 characters at the end of the book's address).
import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase';

/** Pictures live in the public covers bucket, under rec/. */
const IMAGE_BUCKET = 'covers';
const IMAGE_MAX_BYTES = 200 * 1024; // the bucket's size limit

export interface Recommendation {
  id: string;
  title: string;
  text: string | null;
  video_url: string | null;
  vertical: boolean;
  image_path: string | null;
  image_width: number | null;
  image_height: number | null;
  post_url: string | null;
  book_ids: string[];
  position: number;
  published: boolean;
}

/** Facebook video address in one standard form, or null if it is not one. */
export function cleanVideoUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.hostname === 'fb.watch') return `https://fb.watch${u.pathname}`;
  if (!/(^|\.)facebook\.com$/.test(u.hostname)) return null;
  const keep = u.pathname.startsWith('/watch') ? `?v=${u.searchParams.get('v') ?? ''}` : '';
  return `https://www.facebook.com${u.pathname.replace(/\/$/, '')}${keep}`;
}

/** Facebook post address (to link under a picture), or null if it is not one. Tracking parameters are dropped. */
export function cleanPostUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (!/(^|\.)facebook\.com$/.test(u.hostname)) return null;
  const keep = new URLSearchParams();
  for (const k of ['story_fbid', 'id', 'fbid', 'set', 'v']) { const v = u.searchParams.get(k); if (v) keep.set(k, v); }
  const q = keep.toString();
  const out = `https://www.facebook.com${u.pathname.replace(/\/$/, '')}${q ? `?${q}` : ''}`;
  return out.length <= 300 ? out : null;
}

export const imageUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;

export interface PreparedImage { blob: Blob; width: number; height: number; }

/** Shrink a picture for the site: up to 1200 pixels wide, re-encoded until it fits the size limit. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const img = await createImageBitmap(file);
  const tries: [number, number][] = [[1200, 0.82], [1200, 0.7], [1000, 0.7], [900, 0.6], [800, 0.55], [700, 0.5]];
  for (const [maxW, q] of tries) {
    const scale = Math.min(1, maxW / img.width, 2400 / img.height);
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const enc = (type: string) => new Promise<Blob | null>((ok) => c.toBlob(ok, type, q));
    let blob = await enc('image/webp');
    if (!blob || blob.type !== 'image/webp') blob = await enc('image/jpeg');
    if (!blob) throw new Error('encode');
    if (blob.size <= IMAGE_MAX_BYTES) return { blob, width: w, height: h };
  }
  throw new Error('too big');
}

/** Upload a prepared picture; returns its storage path. */
export async function uploadImage(blob: Blob): Promise<string> {
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `rec/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase().storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' });
  if (error) throw error;
  return path;
}

export async function removeImage(path: string | null | undefined) {
  if (!path || !path.startsWith('rec/')) return;
  await supabase().storage.from(IMAGE_BUCKET).remove([path]);
}

/** Published recommendations, for the public page (server side). */
export async function fetchPublished(): Promise<Recommendation[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/recommendations?select=*&published=eq.true&order=position.asc,created_at.desc`,
    { headers: { apikey: SUPABASE_KEY }, cache: 'no-store' },
  );
  if (!res.ok) return [];
  return (await res.json()) as Recommendation[];
}

// ── Staff ──

export async function fetchAllRecommendations(): Promise<Recommendation[]> {
  const { data, error } = await supabase().from('recommendations').select('*')
    .order('position', { ascending: true }).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Recommendation[];
}

export type RecommendationInput = Pick<Recommendation,
  'title' | 'text' | 'video_url' | 'vertical' | 'image_path' | 'image_width' | 'image_height' | 'post_url' | 'book_ids' | 'published'>;

export async function saveRecommendation(id: string | null, input: RecommendationInput, position: number) {
  const row = { ...input, updated_at: new Date().toISOString() };
  const sb = supabase().from('recommendations');
  const { error } = id ? await sb.update(row).eq('id', id) : await sb.insert({ ...row, position });
  if (error) throw error;
}

export async function deleteRecommendation(r: Pick<Recommendation, 'id' | 'image_path'>) {
  const { error } = await supabase().from('recommendations').delete().eq('id', r.id);
  if (error) throw error;
  await removeImage(r.image_path).catch(() => {});
}

/** Store a new order: position = index in the list. */
export async function saveOrder(ids: string[]) {
  const sb = supabase();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await sb.from('recommendations').update({ position: i }).eq('id', ids[i]);
    if (error) throw error;
  }
}

/** A book as the staff picker and the public page show it. */
export interface BookHit { id: string; path: string; title: string; author: string; price: number; condition: string; copies: number; cover?: string; inStock: boolean; }

/** Search the stock by title or author, or fetch books by id (public, through the site's own server). */
export async function findBooks(params: { q?: string; ids?: string[] }): Promise<BookHit[]> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.ids?.length) sp.set('ids', params.ids.join(','));
  const res = await fetch(`/book-search?${sp}`);
  if (!res.ok) throw new Error(`search ${res.status}`);
  return (await res.json()) as BookHit[];
}
