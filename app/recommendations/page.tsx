import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav, SiteFoot, StoreStrip } from '@/components/Chrome';
import FacebookVideo from '@/components/FacebookVideo';
import ReadingList from '@/components/ReadingList';
import { getCatalog } from '@/lib/server-catalog';
import { fetchPublished, imageUrl } from '@/lib/recommendations';
import { SITE_NAME, formatPrice } from '@/lib/inventory';
import '@/components/SearchApp.css';
import '../book/book.css';
import './recommendations.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `המלצות | ${SITE_NAME}`,
  description: `המלצות של ${SITE_NAME}: סרטונים ותמונות מהחנות והספרים שמופיעים בהם, זמינים במלאי החנות.`,
  alternates: { canonical: '/recommendations' },
};

export default async function RecommendationsPage() {
  const [c, recs] = await Promise.all([getCatalog(), fetchPublished().catch(() => [])]);
  return (
    <>
      <SiteNav active="recommendations" />
      <main className="stage">
        <div className="card">
          <div className="section">
            <div className="cat-head">
              <h1>המלצות</h1>
              <p className="search-hint">סרטונים ותמונות מהחנות, ומתחת לכל אחד הספרים שמופיעים בו ונמצאים במלאי.</p>
            </div>

            {recs.length === 0 && <p className="search-hint" style={{ textAlign: 'center' }}>המלצות חדשות יעלו בקרוב.</p>}
            {recs.map((r) => {
              const books = r.book_ids.map((id) => c?.byId.get(id)).filter((b) => !!b);
              const isImage = !!r.image_path;
              return (
                <section key={r.id} className="rec" id={r.id}>
                  <h2>{r.title}</h2>
                  {r.text && <p className="search-hint">{r.text}</p>}
                  {isImage ? (
                    <figure className="rec-figure">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="rec-image" src={imageUrl(r.image_path!)} alt={r.title} width={r.image_width || undefined} height={r.image_height || undefined} loading="lazy" decoding="async" />
                      {r.post_url && (
                        <figcaption><a className="fb-video-link" href={r.post_url} target="_blank" rel="noopener noreferrer">לפוסט המקורי בפייסבוק ↗</a></figcaption>
                      )}
                    </figure>
                  ) : r.video_url ? (
                    <FacebookVideo href={r.video_url} title={r.title} vertical={r.vertical} />
                  ) : null}
                  <h3 className="rec-books-title">{isImage ? 'הספרים מהתמונה' : 'הספרים מהסרטון'}</h3>
                  {books.length === 0 ? (
                    <p className="search-hint">{isImage ? 'הספרים מהתמונה כבר נמכרו.' : 'הספרים מהסרטון כבר נמכרו.'}</p>
                  ) : (
                    <ul className="book-grid">
                      {books.map((b) => (
                        <li key={b!.id} className={b!.inStock ? 'book-card' : 'book-card is-out'}>
                          <Link href={b!.path} className="book-link">
                            <div className="book-cover">
                              {b!.cover
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={b!.cover} alt={`כריכת ${b!.title}`} loading="lazy" decoding="async" />
                                : <div className="no-cover" aria-hidden="true">אין תמונה זמינה</div>}
                            </div>
                            <div className="book-info">
                              <h4 className="book-title">{b!.title}</h4>
                              {b!.author && <div className="book-author">{b!.author}</div>}
                              <div className="book-bottom">
                                {b!.inStock ? <span className="book-price">{b!.copies.length > 1 ? 'מ־' : ''}{formatPrice(b!.copies[0].price)}</span> : <span className="badge out">לא במלאי</span>}
                                {b!.copies[0].condition && b!.inStock && <span className="badge">{b!.copies[0].condition}</span>}
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
          <StoreStrip />
        </div>
      </main>
      <SiteFoot />
      <ReadingList />
    </>
  );
}
