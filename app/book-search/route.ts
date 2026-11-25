// Stock search for the staff recommendation editor: ?q=words (title or author) or ?ids=a,b,c.
import { getCatalog, type Book } from '@/lib/server-catalog';
import { norm } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

const hit = (b: Book) => ({
  id: b.id, path: b.path, title: b.title, author: b.author,
  price: b.copies[0]?.price ?? 0, condition: b.copies[0]?.condition ?? '', copies: b.copies.length, cover: b.cover, inStock: b.inStock,
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const c = await getCatalog();
  if (!c) return Response.json([], { status: 503 });

  const ids = (url.searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (ids.length) return Response.json(ids.map((id) => c.byId.get(id)).filter((b): b is Book => !!b).map(hit));

  const tokens = norm(url.searchParams.get('q') || '').split(' ').filter(Boolean).slice(0, 8);
  if (!tokens.length) return Response.json([]);
  const out: Book[] = [];
  for (const b of c.books) {
    const hay = norm(`${b.title} ${b.author}`);
    if (tokens.every((t) => hay.includes(t))) { out.push(b); if (out.length >= 30) break; }
  }
  return Response.json(out.map(hit));
}
