// Fetches a cover image on the server, so the staff page can read its pixels
// (Google's and Simania's image hosts do not allow cross-site reads).
// Only these image hosts are allowed, so this is not an open proxy.
export const runtime = 'nodejs';

const ALLOWED = new Set(['books.google.com', 'books.googleusercontent.com', 'cdn.simania.co.il']);
const MAX_BYTES = 4_000_000;

function allowed(u: URL) {
  return u.protocol === 'https:' && (ALLOWED.has(u.hostname) || u.hostname.endsWith('.googleusercontent.com'));
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('u') || '';
  let target: URL;
  try { target = new URL(raw.replace(/^http:/, 'https:')); } catch { return new Response('bad url', { status: 400 }); }
  if (!allowed(target)) return new Response('host not allowed', { status: 400 });

  const res = await fetch(target, { redirect: 'follow', cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return new Response('not found', { status: 404 });
  if (!allowed(new URL(res.url))) return new Response('host not allowed', { status: 400 });
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) return new Response('not an image', { status: 415 });
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return new Response('too large', { status: 413 });

  return new Response(buf, {
    headers: { 'content-type': type, 'cache-control': 'public, max-age=86400' },
  });
}
