'use client';

// Staff pages: each tab has its own address, so the browser's back and forward work.
// Adding a tab: add it to Section, PATHS, BANNERS, useSection, the tab row and the switch below,
// and create app/admin/<name>/page.tsx (returning null).
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import BookEditor from '@/components/BookEditor';
import CoverImporter from '@/components/CoverImporter';
import SimaniaTab from '@/components/SimaniaTab';
import SimaniaSync from '@/components/SimaniaSync';
import SearchStats from '@/components/SearchStats';
import RecommendationsAdmin from '@/components/RecommendationsAdmin';

export type Section = 'upload' | 'edit' | 'covers' | 'simania' | 'searches' | 'recommendations';

const PATHS: Record<Section, string> = {
  upload: '/admin/upload', edit: '/admin/edit-books', covers: '/admin', simania: '/admin/simania',
  searches: '/admin/searches', recommendations: '/admin/recommendations',
};
export const BANNERS: Record<Section, [string, string]> = {
  upload: ['עדכון מלאי', 'העלאת קובץ מלאי בפורמט CSV'],
  edit: ['עריכת ספרים', 'קטגוריות וכריכה לכל ספר'],
  covers: ['ייבוא כריכות', 'כריכות מגוגל ספרים, בדיקה ותיקון'],
  simania: ['סימניה', 'מעקב אחרי הייבוא והעדכונים מסימניה'],
  searches: ['חיפושים באתר', 'מה מבקרים מחפשים, ומה חיפשו ולא מצאו'],
  recommendations: ['המלצות', 'סרטונים מפייסבוק והספרים שמופיעים בהם'],
};

export function useSection(): Section {
  const p = (usePathname() || '').replace(/\/$/, '');
  if (p.endsWith('/upload')) return 'upload';
  if (p.endsWith('/edit-books')) return 'edit';
  if (p.endsWith('/covers')) return 'covers';
  if (p.endsWith('/simania')) return 'simania';
  if (p.endsWith('/searches')) return 'searches';
  if (p.endsWith('/recommendations')) return 'recommendations';
  return 'covers'; // the staff area opens on cover import
}

export default function StaffTabs({ section, uploader }: { section: Section; uploader: React.ReactNode }) {
  const router = useRouter();
  const openKey = useSearchParams().get('book');
  const tab = (s: Section, label: string) => (
    <Link href={PATHS[s]} role="tab" className="chip" aria-pressed={section === s} aria-selected={section === s}>{label}</Link>
  );
  return (
    <>
      <div className="chips" role="tablist" style={{ justifyContent: 'flex-start', margin: 0 }}>
        {tab('covers', 'ייבוא כריכות')}
        {tab('simania', 'סימניה')}
        {tab('upload', 'עדכון מלאי')}
        {tab('searches', 'חיפושים באתר')}
        {tab('edit', 'עריכת ספרים')}
        {tab('recommendations', 'המלצות')}
      </div>
      {section === 'upload' ? uploader
        : section === 'simania' ? <><SimaniaSync /><SimaniaTab /></>
        : section === 'searches' ? <SearchStats />
        : section === 'recommendations' ? <RecommendationsAdmin />
        : section === 'edit' ? <BookEditor key={openKey ?? 'all'} initialKey={openKey} />
        : <CoverImporter onOpenBook={(k) => router.push(`${PATHS.edit}?book=${encodeURIComponent(k)}`)} />}
    </>
  );
}
