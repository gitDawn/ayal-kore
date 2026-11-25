import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/bookUrl';

// Everyone may read the public catalog, including AI search tools; staff pages stay out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/auth', '/cover-image'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
