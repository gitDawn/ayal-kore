// Home page: the latest recommendations, each with its books in stock in a row that scrolls sideways.
import Link from 'next/link';
import { getCatalog } from '@/lib/server-catalog';
import { fetchPublished } from '@/lib/recommendations';
import { formatPrice } from '@/lib/inventory';
import './HomeRecommendations.css';

const SHOW = 3;       // recommendations on the home page
const PER_REC = 12;   // books per recommendation

export default async function HomeRecommendations() {
  let c: Awaited<ReturnType<typeof getCatalog>> = null;
  let recs: Awaited<ReturnType<typeof fetchPublished>> = [];
  try { [c, recs] = await Promise.all([getCatalog(), fetchPublished()]); } catch { return null; }
  if (!c) return null;

  const rows = recs
    .map((r) => ({ r, books: r.book_ids.map((id) => c!.byId.get(id)).filter((b) => !!b && b.inStock).slice(0, PER_REC) }))
    .filter((x) => x.books.length > 0)
    .slice(0, SHOW);
  if (!rows.length) return null;

  return (
    <section className="section home-recs" aria-labelledby="home-recs-title">
      <div className="home-recs-head">
        <h2 id="home-recs-title">ספרים מומלצים</h2>
        <Link href="/recommendations">לכל ההמלצות ←</Link>
      </div>
      {rows.map(({ r, books }) => (
        <div key={r.id} className="home-rec">
          <h3><Link href={`/recommendations#${r.id}`}>{r.title}</Link></h3>
          <ul className="home-rec-row">
            {books.map((b) => (
              <li key={b!.id}>
                <Link href={b!.path} className="home-rec-book">
                  <div className="book-cover">
                    {b!.cover
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={b!.cover} alt={`כריכת ${b!.title}`} loading="lazy" decoding="async" />
                      : <div className="no-cover" aria-hidden="true">אין תמונה זמינה</div>}
                  </div>
                  <span className="home-rec-title">{b!.title}</span>
                  {b!.author && <span className="home-rec-author">{b!.author}</span>}
                  <span className="book-price">{b!.copies.length > 1 ? 'מ־' : ''}{formatPrice(b!.copies[0].price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
