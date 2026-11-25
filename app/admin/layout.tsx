import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SiteNav, SiteFoot } from '@/components/Chrome';
import AdminApp from '@/components/AdminApp';
import './admin.css';

export const metadata: Metadata = { robots: { index: false } };

// The staff area stays mounted while moving between its pages, so sign-in is checked once.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav active="admin" />
      <main className="stage">
        <div className="card">
          <Suspense fallback={<p className="status">טוען…</p>}>
            <AdminApp />
          </Suspense>
          {children}
        </div>
      </main>
      <SiteFoot>אזור צוות</SiteFoot>
    </>
  );
}
