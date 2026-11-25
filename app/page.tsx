import { SiteNav, Banner, SiteFoot, StoreStrip } from '@/components/Chrome';
import SearchApp from '@/components/SearchApp';
import StorePhoto from '@/components/StorePhoto';
import { latestVersion, snapshotUrl } from '@/lib/server-inventory';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/inventory';
import { jsonLd, storeLd } from '@/lib/jsonLd';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { alternates: { canonical: '/' } };

// Always read the current inventory version, so a new upload shows up immediately.
export const dynamic = 'force-dynamic';

async function load() {
  try {
    const v = await latestVersion();
    if (!v) return { state: 'empty' as const };
    return { state: 'ok' as const, v, url: snapshotUrl(v) };
  } catch (e) {
    console.error('inventory load failed', e);
    return { state: 'error' as const };
  }
}

export default async function Home() {
  const data = await load();
  const updated = data.state === 'ok' && data.v.created_at
    ? new Date(data.v.created_at).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })
    : null;

  return (
    <>
      <SiteNav active="search" />
      <main className="stage">
        <div className="card">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', ...storeLd }) }} />
          <Banner title={SITE_NAME} subtitle={SITE_TAGLINE} logo />
          {data.state === 'ok' ? (
            <SearchApp versionId={data.v.id} url={data.url} rowCount={data.v.row_count} />
          ) : (
            <div className="section">
              <p className="search-title">הקטלוג יעלה בקרוב</p>
              <p className="search-hint">
                {data.state === 'empty'
                  ? 'עדיין לא הועלה מלאי ספרים לאתר.'
                  : 'לא הצלחנו לטעון את הקטלוג כרגע. נסו לרענן את הדף בעוד רגע.'}
              </p>
            </div>
          )}
          <p className="search-hint all-cats"><Link href="/category">לעיון בכל הקטגוריות</Link></p>
          <StorePhoto />
          <StoreStrip />
        </div>
      </main>
      <SiteFoot>
        {data.state === 'ok' && (
          <>
            {data.v.row_count.toLocaleString('he-IL')} ספרים במלאי
            {updated ? ` · עודכן ${updated}` : ''}
          </>
        )}
      </SiteFoot>
    </>
  );
}
