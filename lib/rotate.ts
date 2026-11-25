// Turn a stored cover upside down (180°) and save it in place of the old file.
// Used for covers that Google (or a scan) delivered upside down.
import { supabase } from './supabase';
import { COVER_BUCKET, coverUrl, isWideFile } from './covers';

export async function rotateCover(bookKey: string, path: string): Promise<string> {
  const res = await fetch(coverUrl(path), { cache: 'no-store' });
  if (!res.ok) throw new Error(`image ${res.status}`);
  const img = await createImageBitmap(await res.blob());

  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width, c.height);
  ctx.rotate(Math.PI);
  ctx.drawImage(img, 0, 0);

  const enc = (type: string) => new Promise<Blob | null>((ok) => c.toBlob(ok, type, 0.9));
  let blob = await enc('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await enc('image/jpeg');
  if (!blob) throw new Error('encode');
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';

  // Same name stem as before, new suffix, so the browser does not show the old cached file.
  const stem = path.split('-')[0];
  const newPath = `${stem}-${Date.now().toString(36)}${isWideFile(path) ? '-w6' : ''}.${ext}`;
  const sb = supabase();
  const up = await sb.storage.from(COVER_BUCKET).upload(newPath, blob, { contentType: blob.type, upsert: true, cacheControl: '31536000' });
  if (up.error) throw up.error;
  const { error } = await sb.from('book_covers').update({ path: newPath }).eq('book_key', bookKey);
  if (error) { await sb.storage.from(COVER_BUCKET).remove([newPath]); throw error; }
  await sb.storage.from(COVER_BUCKET).remove([path]);
  return newPath;
}
