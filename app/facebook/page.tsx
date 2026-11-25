import type { Metadata } from 'next';
import { SiteNav, SiteFoot, StoreStrip } from '@/components/Chrome';
import FacebookFeed from '@/components/FacebookFeed';
import { SITE_NAME } from '@/lib/inventory';
import './facebook.css';

export const metadata: Metadata = { title: `מהפייסבוק שלנו | ${SITE_NAME}` };

export default function FacebookPage() {
  return (
    <>
      <SiteNav active="facebook" />
      <main className="stage">
        <div className="card">
          <div className="section">
            <h1 className="search-title">מהפייסבוק שלנו</h1>
            <p className="search-hint">המלצות, סרטונים וספרים חדשים שהגיעו לחנות. הפוסטים מתעדכנים כאן אוטומטית.</p>
            <FacebookFeed />
          </div>
          <StoreStrip />
        </div>
      </main>
      <SiteFoot />
    </>
  );
}
