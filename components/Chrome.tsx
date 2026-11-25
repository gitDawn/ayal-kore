import Link from 'next/link';
import './Chrome.css';
import { SITE_NAME, STORE_FACEBOOK, STORE_PHONE, STORE_PHONE_INTL } from '@/lib/inventory';

const STORE_ADDRESS = 'רחוב השקמה 1, אזור';
const STORE_MAP = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('השקמה 1 אזור');
// Logo stored in the public covers bucket (verified byte-for-byte after upload).
const LOGO_URL = 'https://hrsqrehrrkklntmvxbns.supabase.co/storage/v1/object/public/covers/site/logo-v2.png';
const STORE_SIMANIA = 'https://simania.co.il/userPage.php?userId=36217&tab=bookWorld';

export function SiteNav({ active }: { active: 'search' | 'recommendations' | 'facebook' | 'admin' }) {
  return (
    <header className="site-nav">
      <nav className="site-nav-inner" aria-label="ניווט ראשי">
        <Link href="/" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_URL} alt="" width={34} height={34} />
          {SITE_NAME}
        </Link>
        <ul className="nav-links">
          <li><Link href="/" aria-current={active === 'search' ? 'page' : undefined}>חיפוש ספר</Link></li>
          <li><Link href="/recommendations" aria-current={active === 'recommendations' ? 'page' : undefined}>המלצות</Link></li>
          <li><Link href="/facebook" aria-current={active === 'facebook' ? 'page' : undefined}>מהפייסבוק שלנו</Link></li>
          <li><Link href="/admin" aria-current={active === 'admin' ? 'page' : undefined}>כניסת צוות</Link></li>
        </ul>
      </nav>
    </header>
  );
}

export function Banner({ title, subtitle, logo = false }: { title: string; subtitle: string; logo?: boolean }) {
  return (
    <div className="banner">
      <Leaf className="leaf" />
      <Leaf className="leaf two" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logo && <img className="logo-badge" src={LOGO_URL} alt={`הלוגו של ${SITE_NAME}`} width={140} height={140} style={{ width: 140, height: 140 }} />}
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function Leaf({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 120 160" aria-hidden="true" fill="none" stroke="#f1e4cc" strokeWidth="2" strokeLinecap="round">
      <path d="M60 158 C60 110 58 70 62 8" />
      <path d="M61 40 C40 30 26 14 24 2 C44 6 58 20 61 40Z" fill="#f1e4cc" fillOpacity=".25" />
      <path d="M61 62 C84 52 98 34 102 18 C80 22 64 40 61 62Z" fill="#f1e4cc" fillOpacity=".25" />
      <path d="M60 90 C36 82 20 64 16 46 C40 50 56 68 60 90Z" fill="#f1e4cc" fillOpacity=".25" />
      <path d="M60 116 C84 108 100 90 106 72 C82 76 64 94 60 116Z" fill="#f1e4cc" fillOpacity=".25" />
    </svg>
  );
}

/** Contact line shown under the search card. */
export function StoreStrip() {
  return (
    <div className="store-strip">
      <span>כתובת: <a href={STORE_MAP} target="_blank" rel="noopener noreferrer">{STORE_ADDRESS}</a></span>
      <span>טלפון: <a href={`tel:${STORE_PHONE_INTL}`} dir="ltr">{STORE_PHONE}</a></span>
      <span><a href={STORE_SIMANIA} target="_blank" rel="noopener noreferrer">הספרים שלנו למכירה בסימניה</a></span>
      <span><a href={STORE_FACEBOOK} target="_blank" rel="noopener noreferrer">הדף שלנו בפייסבוק</a></span>
    </div>
  );
}

export function SiteFoot({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="site-foot">
      <div className="site-foot-inner">
        <div className="contact">
          <span>{SITE_NAME}</span>
          <a href={STORE_MAP} target="_blank" rel="noopener noreferrer">{STORE_ADDRESS}</a>
          <a href={`tel:${STORE_PHONE_INTL}`} dir="ltr">{STORE_PHONE}</a>
          <a href={STORE_SIMANIA} target="_blank" rel="noopener noreferrer">סימניה</a>
          <a href={STORE_FACEBOOK} target="_blank" rel="noopener noreferrer">פייסבוק</a>
          <Link href="/category">קטגוריות</Link>
        </div>
        <span>{children}</span>
      </div>
    </footer>
  );
}
