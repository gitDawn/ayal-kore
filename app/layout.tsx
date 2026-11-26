import type { Metadata, Viewport } from 'next';
import './globals.css';
import './a11y.css';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/inventory';
import RecoveryRedirect from '@/components/RecoveryRedirect';
import SkipLink from '@/components/SkipLink';
import { SITE_URL } from '@/lib/bookUrl';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `חיפוש ספר בקטלוג | ${SITE_NAME}`,
  description: `${SITE_NAME}: חנות ספרים יד שנייה באזור. חיפוש בקטלוג המלא של הספרים במלאי. ${SITE_TAGLINE}`,
  openGraph: { siteName: SITE_NAME, locale: 'he_IL', type: 'website' },
  verification: { google: 'qk-SCpjOh28wmRNevklkhsXGeD15tYB646T2p6lPfTs' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Heebo:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <SkipLink />
        <RecoveryRedirect />
        {children}
      </body>
    </html>
  );
}
