// Structured data (schema.org) that search engines and AI tools read from the page.
import { SITE_NAME, STORE_FACEBOOK, STORE_PHONE_INTL } from './inventory';
import { SITE_URL } from './bookUrl';

export const LOGO_URL = 'https://hrsqrehrrkklntmvxbns.supabase.co/storage/v1/object/public/covers/site/logo-v2.png';

/** Safe to put inside a <script> tag. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

export const storeLd = {
  '@type': 'BookStore',
  '@id': `${SITE_URL}/#store`,
  name: SITE_NAME,
  alternateName: ['האייל הקורא', 'Haayal Kore'],
  url: SITE_URL,
  logo: LOGO_URL,
  image: LOGO_URL,
  telephone: STORE_PHONE_INTL,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'השקמה 1',
    addressLocality: 'אזור',
    addressCountry: 'IL',
  },
  sameAs: [STORE_FACEBOOK],
  description: 'חנות ספרים יד שנייה באזור: ספרות, עיון, ילדים ועוד. חיפוש בקטלוג המלא באתר.',
};
