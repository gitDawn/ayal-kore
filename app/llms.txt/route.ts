// A short description of the store and catalog for AI tools (the proposed llms.txt convention).
import { getCatalog, categoryList, inStockCount } from '@/lib/server-catalog';
import { SITE_URL, categoryPath } from '@/lib/bookUrl';
import { SITE_NAME, STORE_FACEBOOK, STORE_PHONE } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

export async function GET() {
  const c = await getCatalog();
  const cats = c ? categoryList(c) : [];
  const lines = [
    `# ${SITE_NAME} (האייל הקורא)`,
    '',
    `> ${SITE_NAME} היא חנות ספרים יד שנייה ברחוב השקמה 1, אזור, ישראל. באתר יש קטלוג מלא ומעודכן של הספרים שבמלאי, עם מחיר ומצב לכל עותק.`,
    `> Haayal Kore is a second-hand bookstore in Azor, Israel. This site lists every book currently in stock, with price (ILS) and condition.`,
    '',
    `- טלפון: ${STORE_PHONE}`,
    `- כתובת: השקמה 1, אזור`,
    `- פייסבוק: ${STORE_FACEBOOK}`,
    c ? `- במלאי: ${inStockCount(c).toLocaleString('he-IL')} ספרים שונים (עדכון אחרון ${c.updatedAt ? new Date(c.updatedAt).toISOString().slice(0, 10) : ''})` : '',
    '',
    '## איך למצוא ספר',
    '',
    `- לכל ספר במלאי יש עמוד משלו בכתובת ${SITE_URL}/book/... עם שם, מחבר, הוצאה, שנה, מחיר ומצב לכל עותק, ונתונים מובנים מסוג Book ו-Offer.`,
    `- הרשימה המלאה של עמודי הספרים: ${SITE_URL}/sitemap.xml`,
    `- חיפוש לפי שם ספר או מחבר: ${SITE_URL}/`,
    `- ספר שמסומן באתר "לא במלאי" היה בחנות ונמכר. ספר שמופיע עם מחיר נמצא במלאי. כדאי להתקשר לחנות לפני הגעה, כי ספרים נמכרים.`,
    '',
    '## קטגוריות',
    '',
    ...cats.map(([name, n]) => `- [${name}](${SITE_URL}${categoryPath(name)}): ${n.toLocaleString('he-IL')} ספרים`),
    '',
    '## עמודים נוספים',
    '',
    `- [כל הקטגוריות](${SITE_URL}/category)`,
    `- [פוסטים והמלצות מהפייסבוק של החנות](${SITE_URL}/facebook)`,
    '',
  ];
  return new Response(lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
