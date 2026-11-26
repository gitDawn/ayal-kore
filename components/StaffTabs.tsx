'use client';

// Staff pages: each tab has its own address, so the browser's back and forward work.
// Adding a tab: add it to Section, PATHS, BANNERS, useSection, the tab row and the switch below,
// and create app/admin/<name>/page.tsx (returning null).
// "סימניה" has two inner tabs with their own addresses: updating from Simania, and adding books to Simania.
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import BookEditor from '@/components/BookEditor';
import CoverImporter from '@/components/CoverImporter';
import SimaniaTab from '@/components/SimaniaTab';
import SimaniaSync from '@/components/SimaniaSync';
import SearchStats from '@/components/SearchStats';
import RecommendationsAdmin from '@/components/RecommendationsAdmin';
import BackupTab from '@/components/BackupTab';
import SimaniaAddTab from '@/components/SimaniaAddTab';

export type Section = 'upload' | 'edit' | 'covers' | 'simania' | 'searches' | 'recommendations' | 'backup' | 'simania-add';

const PATHS: Record<Section, string> = {
  upload: '/admin/upload', edit: '/admin/edit-books', covers: '/admin', simania: '/admin/simania',
  searches: '/admin/searches', recommendations: '/admin/recommendations', backup: '/admin/backup',
  'simania-add': '/admin/simania-add',
};
export const BANNERS: Record<Section, [string, string]> = {
  upload: ['עדכון מלאי', 'העלאת קובץ מלאי בפורמט CSV'],
  edit: ['עריכת ספרים', 'קטגוריות וכריכה לכל ספר'],
  covers: ['ייבוא כריכות', 'כריכות מגוגל ספרים, בדיקה ותיקון'],
  simania: ['סימניה', 'עדכון המלאי מסימניה, והוספת ספרים לסימניה'],
  searches: ['חיפושים באתר', 'מה מבקרים מחפשים, ומה חיפשו ולא מצאו'],
  recommendations: ['המלצות', 'סרטונים מפייסבוק והספרים שמופיעים בהם'],
  backup: ['גיבוי', 'הורדת הנתונים והכריכות למחשב'],
  'simania-add': ['הוספה לסימניה', 'זיהוי ספרים מתמונה או סרטון והוספתם למלאי בסימניה'],
};

export function useSection(): Section {
  const p = (usePathname() || '').replace(/\/$/, '');
  if (p.endsWith('/upload')) return 'upload';
  if (p.endsWith('/edit-books')) return 'edit';
  if (p.endsWith('/covers')) return 'covers';
  if (p.endsWith('/simania-add')) return 'simania-add';
  if (p.endsWith('/simania')) return 'simania';
  if (p.endsWith('/searches')) return 'searches';
  if (p.endsWith('/recommendations')) return 'recommendations';
  if (p.endsWith('/backup')) return 'backup';
  return 'covers'; // the staff area opens on cover import
}

export default function StaffTabs({ section, uploader }: { section: Section; uploader: React.ReactNode }) {
  const router = useRouter();
  const openKey = useSearchParams().get('book');
  const inSimania = section === 'simania' || section === 'simania-add';
  const tab = (s: Section, label: string) => {
    const on = section === s || (s === 'simania' && inSimania);
    return <Link href={PATHS[s]} role="tab" className="chip" aria-selected={on}>{label}</Link>;
  };
  const inner = (s: Section, label: string) => (
    <Link href={PATHS[s]} role="tab" className="chip" aria-selected={section === s}>{label}</Link>
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
        {tab('backup', 'גיבוי')}
      </div>
      {section === 'upload' ? uploader
        : inSimania ? (
          <>
            <div className="chips subtabs" role="tablist" aria-label="סימניה" style={{ justifyContent: 'flex-start', margin: 0 }}>
              {inner('simania', 'עדכון מסימניה')}
              {inner('simania-add', 'הוספה לסימניה מתמונה או סרטון')}
            </div>
            {section === 'simania' ? <><SimaniaSync /><SimaniaTab /></> : <SimaniaAddTab />}
          </>
        )
        : section === 'searches' ? <SearchStats />
        : section === 'recommendations' ? <RecommendationsAdmin />
        : section === 'backup' ? <BackupTab />
        : section === 'edit' ? <BookEditor key={openKey ?? 'all'} initialKey={openKey} />
        : <CoverImporter onOpenBook={(k) => router.push(`${PATHS.edit}?book=${encodeURIComponent(k)}`)} />}
    </>
  );
}
