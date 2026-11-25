import type { MetadataRoute } from 'next';
import { categoryPath, SITE_URL } from '@/lib/bookUrl';
import { getCatalog } from '@/lib/server-catalog';

export const dynamic = 'force-dynamic';

// Search engines accept up to 50,000 addresses in one sitemap.
const LIMIT = 49_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const c = await getCatalog();
  const updated = c?.updatedAt ? new Date(c.updatedAt) : new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: updated, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/category`, lastModified: updated, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/recommendations`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/facebook`, changeFrequency: 'weekly', priority: 0.5 },
  ];
  if (!c) return fixed;
  const cats = [...c.byCat.keys()].map((name) => ({
    url: SITE_URL + categoryPath(name), lastModified: updated, changeFrequency: 'weekly' as const, priority: 0.6,
  }));
  const books = c.books.slice(0, LIMIT - fixed.length - cats.length).map((b) => ({
    url: SITE_URL + encodeURI(b.path), lastModified: updated, changeFrequency: 'weekly' as const, priority: 0.5,
  }));
  return [...fixed, ...cats, ...books];
}
