import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { SiteNav, SiteFoot, StoreStrip } from '@/components/Chrome';
import CopyToggle from '@/components/CopyToggle';
import WhatsAppButton from '@/components/WhatsAppButton';
import ReadingList from '@/components/ReadingList';
import { getCatalog, type Book } from '@/lib/server-catalog';
import { fetchDescription } from '@/lib/descriptions';
import { SITE_URL, categoryPath, idFromSlug } from '@/lib/bookUrl';
import { SITE_NAME, STORE_PHONE, STORE_PHONE_INTL, formatPrice } from '@/lib/inventory';
import { jsonLd, storeLd } from '@/lib/jsonLd';
import '@/components/SearchApp.css';
import '../book.css';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function find(slug: string): Promise<Book | null> {
  const c = await getCatalog();
  return c?.byId.get(idFromSlug(slug)) ?? null;
}

const hasHebrew = (s: string) => /[֐-׿]/.test(s);
const condText = (b: Book) => [...new Set(b.copies.map((c) => c.condition).filter(Boolean))].join(', ');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await find((await params).slug);
  if (!b) return { title: `הספר לא נמצא | ${SITE_NAME}`, robots: { index: false } };
  const desc = await fetchDescription(b.key).catch(() => null);
  const min = b.copies[0]?.price;
  const lead = `${b.title}${b.author ? ` מאת ${b.author}` : ''}${b.publisher ? `, ${b.publisher}` : ''}${b.year ? ` ${b.year}` : ''}.`;
  const offer = b.inStock
    ? ` ספר יד שנייה${condText(b) ? ` במצב ${condText(b)}` : ''}${min != null ? ` החל מ־${formatPrice(min)}` : ''} בחנות ${SITE_NAME} באזור.`
    : ` ספר יד שנייה בחנות ${SITE_NAME} באזור, לא במלאי כרגע.`;
  const description = (lead + offer + (desc ? ` ${desc}` : '')).slice(0, 300);
  return {
    title: `${b.title}${b.author ? `, ${b.author}` : ''} | ספר יד שנייה | ${SITE_NAME}`,
    description,
    alternates: { canonical: b.path },
    openGraph: {
      type: 'book',
      title: `${b.title}${b.author ? `, ${b.author}` : ''}`,
      description,
      url: b.path,
      siteName: SITE_NAME,
      locale: 'he_IL',
      images: b.cover ? [{ url: b.cover }] : undefined,
    },
  };
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params;
  const b = await find(slug);
  if (!b) notFound();
  // An old or mistyped readable part: send to the current address.
  let decoded = slug;
  try { decoded = decodeURIComponent(slug); } catch { /* keep */ }
  if (`/book/${decoded}` !== decodeURIComponent(b.path)) permanentRedirect(b.path);

  const desc = await fetchDescription(b.key).catch(() => null);
  const url = SITE_URL + b.path;

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Book', 'Product'],
        '@id': `${url}#book`,
        name: b.title,
        url,
        ...(b.author ? { author: { '@type': 'Person', name: b.author } } : {}),
        ...(b.publisher ? { publisher: { '@type': 'Organization', name: b.publisher } } : {}),
        ...(b.year ? { datePublished: String(b.year) } : {}),
        inLanguage: hasHebrew(b.title) ? 'he' : undefined,
        ...(b.cover ? { image: b.cover } : {}),
        ...(desc ? { description: desc } : {}),
        ...(b.cats.length ? { genre: b.cats } : {}),
        offers: b.copies.map((c) => ({
          '@type': 'Offer',
          price: c.price,
          priceCurrency: 'ILS',
          availability: b.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: c.condition === 'חדש לגמרי' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
          url,
          seller: { '@id': `${SITE_URL}/#store` },
        })),
      },
      storeLd,
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
          ...(b.cats[0] ? [{ '@type': 'ListItem', position: 2, name: b.cats[0], item: SITE_URL + categoryPath(b.cats[0]) }] : []),
          { '@type': 'ListItem', position: b.cats[0] ? 3 : 2, name: b.title, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <SiteNav active="search" />
      <main className="stage">
        <div className="card">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
          <div className="section book-page">
            <nav className="crumbs" aria-label="מיקום באתר">
              <Link href="/">חיפוש בקטלוג</Link>
              {b.cats[0] && <> › <Link href={categoryPath(b.cats[0])}>{b.cats[0]}</Link></>}
            </nav>
            <article className="book-page-grid">
              <div className="book-dialog-cover">
                {b.cover
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={b.cover} alt={`כריכת ${b.title}`} />
                  : <div className="no-cover" aria-hidden="true">אין תמונה זמינה</div>}
              </div>
              <div className="book-dialog-body">
                <h1>{b.title}</h1>
                {b.author && <div className="book-author">{b.author}</div>}
                {(b.publisher || b.year) && <div className="book-meta">{[b.publisher, b.year].filter(Boolean).join(', ')}</div>}
                {b.cats.length > 0 && (
                  <div className="book-meta">
                    {b.cats.map((c, i) => <span key={c}>{i > 0 && ', '}<Link href={categoryPath(c)}>{c}</Link></span>)}
                    {b.subs.length ? ` · ${b.subs.join(', ')}` : ''}
                  </div>
                )}

                {!b.inStock ? (
                  <>
                    <h2 className="copies-title">לא במלאי כרגע</h2>
                    <p className="book-contact" style={{ marginTop: 0 }}>הספר היה אצלנו ונמכר. אם יגיע עותק נוסף, נשמח לעדכן.</p>
                    <WhatsAppButton title={b.title} author={b.author} price={b.copies[0]?.price ?? 0} condition="" url={SITE_URL + encodeURI(b.path)} outOfStock />
                  </>
                ) : (<>
                <h2 className="copies-title">{b.copies.length > 1 ? `${b.copies.length} עותקים במלאי` : 'במלאי'}</h2>
                <ul className="copies">
                  {b.copies.map((c, i) => (
                    <li key={i}>
                      <span className="book-price">{formatPrice(c.price)}</span>
                      {c.condition && <span className="badge">{c.condition}</span>}
                      <CopyToggle row={c.row} />
                      <WhatsAppButton small title={b.title} author={b.author} price={c.price} condition={c.condition} url={SITE_URL + encodeURI(b.path)} />
                    </li>
                  ))}
                </ul>
                <p className="book-contact">
                  רוצים לשמור את הספר או לשאול עליו? התקשרו: <a href={`tel:${STORE_PHONE_INTL}`} dir="ltr">{STORE_PHONE}</a>
                </p>
                </>)}

                {desc && (
                  <div className="book-desc">
                    <h2>על הספר</h2>
                    <p>{desc}</p>
                  </div>
                )}
              </div>
            </article>
          </div>
          <StoreStrip />
        </div>
      </main>
      <SiteFoot />
      <ReadingList />
    </>
  );
}
