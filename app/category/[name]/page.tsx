import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteNav, SiteFoot, StoreStrip } from '@/components/Chrome';
import { getCatalog } from '@/lib/server-catalog';
import { categoryPath } from '@/lib/bookUrl';
import { SITE_NAME, formatPrice } from '@/lib/inventory';
import '@/components/SearchApp.css';
import '../../book/book.css';

export const dynamic = 'force-dynamic';

const PAGE = 60;
type Props = { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string }> };

function decode(s: string) { try { return decodeURIComponent(s); } catch { return s; } }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const name = decode((await params).name);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const c = await getCatalog();
  const n = c?.byCat.get(name)?.filter((b) => b.inStock).length ?? 0;
  if (!c?.byCat.get(name)?.length) return { title: `קטגוריה לא נמצאה | ${SITE_NAME}`, robots: { index: false } };
  return {
    title: `${name}: ספרים יד שנייה${page > 1 ? ` (עמוד ${page})` : ''} | ${SITE_NAME}`,
    description: `${n.toLocaleString('he-IL')} ספרי ${name} יד שנייה במלאי של ${SITE_NAME}, חנות ספרים יד שנייה באזור.`,
    alternates: { canonical: categoryPath(name) + (page > 1 ? `?page=${page}` : '') },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const name = decode((await params).name);
  const c = await getCatalog();
  const all = c?.byCat.get(name);
  if (!all?.length) notFound();
  const available = all.filter((b) => b.inStock).length;
  const pages = Math.ceil(all.length / PAGE);
  const page = Math.min(pages, Math.max(1, Number((await searchParams).page) || 1));
  const books = all.slice((page - 1) * PAGE, page * PAGE);
  const href = (p: number) => categoryPath(name) + (p > 1 ? `?page=${p}` : '');

  return (
    <>
      <SiteNav active="search" />
      <main className="stage">
        <div className="card">
          <div className="section">
            <nav className="crumbs" aria-label="מיקום באתר">
              <Link href="/">חיפוש בקטלוג</Link> › <Link href="/category">כל הקטגוריות</Link>
            </nav>
            <div className="cat-head">
              <h1>{name}</h1>
              <p className="search-hint">{available.toLocaleString('he-IL')} ספרים יד שנייה במלאי{pages > 1 ? ` · עמוד ${page} מתוך ${pages}` : ''}</p>
            </div>
            <ul className="book-grid">
              {books.map((b) => (
                <li key={b.id} className={b.inStock ? 'book-card' : 'book-card is-out'}>
                  <Link href={b.path} className="book-link">
                    <div className="book-cover">
                      {b.cover
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={b.cover} alt={`כריכת ${b.title}`} loading="lazy" decoding="async" />
                        : <div className="no-cover" aria-hidden="true">אין תמונה זמינה</div>}
                    </div>
                    <div className="book-info">
                      <h2 className="book-title">{b.title}</h2>
                      {b.author && <div className="book-author">{b.author}</div>}
                      <div className="book-bottom">
                        {b.inStock ? (
                          <>
                            <span className="book-price">{b.copies.length > 1 ? 'מ־' : ''}{formatPrice(b.copies[0].price)}</span>
                            {b.copies[0].condition && <span className="badge">{b.copies[0].condition}</span>}
                          </>
                        ) : <span className="badge out">לא במלאי</span>}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <nav className="pager" aria-label="עמודים">
                {page > 1 && <Link href={href(page - 1)}>› הקודם</Link>}
                <span>עמוד {page} מתוך {pages}</span>
                {page < pages && <Link href={href(page + 1)}>הבא ‹</Link>}
              </nav>
            )}
          </div>
          <StoreStrip />
        </div>
      </main>
      <SiteFoot />
    </>
  );
}
