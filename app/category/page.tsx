import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav, SiteFoot, StoreStrip } from '@/components/Chrome';
import { categoryList, getCatalog, inStockCount } from '@/lib/server-catalog';
import { categoryPath } from '@/lib/bookUrl';
import { SITE_NAME } from '@/lib/inventory';
import '@/components/SearchApp.css';
import '../book/book.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `קטגוריות ספרים יד שנייה | ${SITE_NAME}`,
  description: `כל הקטגוריות בקטלוג הספרים יד שנייה של ${SITE_NAME}: ספרות, עיון, ילדים, היסטוריה ועוד.`,
  alternates: { canonical: '/category' },
};

export default async function Categories() {
  const c = await getCatalog();
  const cats = c ? categoryList(c) : [];
  return (
    <>
      <SiteNav active="search" />
      <main className="stage">
        <div className="card">
          <div className="section">
            <div className="cat-head">
              <h1>כל הקטגוריות</h1>
              <p className="search-hint">{c ? `${inStockCount(c).toLocaleString('he-IL')} ספרים יד שנייה במלאי` : ''}</p>
            </div>
            <ul className="cat-index chips">
              {cats.map(([name, n]) => (
                <li key={name}><Link className="chip" href={categoryPath(name)}>{name}<small>{n.toLocaleString('he-IL')}</small></Link></li>
              ))}
            </ul>
          </div>
          <StoreStrip />
        </div>
      </main>
      <SiteFoot />
    </>
  );
}
