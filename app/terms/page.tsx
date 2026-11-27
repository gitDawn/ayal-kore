import type { Metadata } from 'next';
import { SiteNav, SiteFoot } from '@/components/Chrome';
import { SITE_NAME, STORE_PHONE, STORE_PHONE_INTL } from '@/lib/inventory';
import '../accessibility/accessibility.css';

export const metadata: Metadata = {
  title: `תנאי מכירה | ${SITE_NAME}`,
  description: `תנאי המכירה של ${SITE_NAME}: פרטי העסק, מחירים, הזמנה, איסוף ומשלוח, ביטול עסקה והחזרות.`,
  alternates: { canonical: '/terms' },
};

const UPDATED = '27 בנובמבר 2026';
const STORE_EMAIL = 'ayalmer@gmail.com';
const WHATSAPP = `https://wa.me/${STORE_PHONE_INTL.replace(/\D/g, '')}`;

export default function TermsPage() {
  return (
    <>
      <SiteNav />
      <main className="stage">
        <div className="card">
          <article className="section a11y">
            <h1>תנאי מכירה</h1>
            <p className="a11y-date">התנאים עודכנו בתאריך {UPDATED}.</p>

            <h2>פרטי העסק</h2>
            <ul>
              <li>שם העסק: {SITE_NAME}, חנות ספרים יד שנייה</li>
              <li>כתובת: רחוב השקמה 1, אזור</li>
              <li>טלפון או וואטסאפ: <a href={`tel:${STORE_PHONE_INTL}`} dir="ltr">{STORE_PHONE}</a></li>
              <li>דואר אלקטרוני: <a href={`mailto:${STORE_EMAIL}`} dir="ltr">{STORE_EMAIL}</a></li>
            </ul>

            <h2>על האתר</h2>
            <p>
              האתר הוא קטלוג של הספרים שבחנות. אין בו קופה או תשלום מקוון. כדי לקנות ספר, פונים אלינו בטלפון,
              בוואטסאפ או בחנות עצמה. המלאי מתעדכן מעת לעת, ולכן ייתכן שספר שמופיע באתר כבר נמכר. נאשר לכם
              שהספר זמין לפני סגירת ההזמנה.
            </p>
            <p>
              ספרים שמסומנים &quot;לא במלאי&quot; היו אצלנו ונמכרו. הם נשארים באתר לעיון בלבד.
            </p>

            <h2>מחירים</h2>
            <ul>
              <li>המחיר שמופיע ליד כל ספר הוא המחיר הסופי לתשלום עבור הספר, כולל מס ערך מוסף ככל שהוא חל.</li>
              <li>מצב הספר (למשל &quot;כחדש&quot; או &quot;טוב&quot;) מופיע ליד המחיר. אלה ספרים משומשים, ואפשר לבקש תמונה או פרטים נוספים לפני הקנייה.</li>
              <li>אם נפלה טעות במחיר או בפרטי ספר, נעדכן אתכם לפני סגירת ההזמנה, ותוכלו לבחור אם להמשיך.</li>
            </ul>

            <h2>איסוף ומשלוח</h2>
            <ul>
              <li>אפשר לאסוף את הספרים מהחנות, בתיאום מראש.</li>
              <li>אם מתאמים משלוח, עלות המשלוח ומועד ההגעה המשוער יימסרו לכם מראש, לפני אישור ההזמנה, והם ייכללו במחיר הסופי.</li>
            </ul>

            <h2 id="cancel">ביטול עסקה והחזרות</h2>
            <p>
              בקנייה מרחוק אפשר לבטל את העסקה בתוך 14 ימים מיום קבלת הספר, לפי חוק הגנת הצרכן. כל הפרטים, כולל
              איך מודיעים על ביטול, החזר כספי ודמי ביטול, מופיעים בעמוד{' '}
              <a href="/cancel">ביטול עסקה והחזרות</a>.
            </p>

            <h2>פרטיות</h2>
            <p>
              מה האתר שומר ואיך אנחנו משתמשים בפרטים שתמסרו לנו מוסבר ב<a href="/privacy">מדיניות הפרטיות</a>.
            </p>

            <h2>יצירת קשר</h2>
            <p>
              לכל שאלה על הזמנה, ביטול או החזרה: טלפון <a href={`tel:${STORE_PHONE_INTL}`} dir="ltr">{STORE_PHONE}</a>,{' '}
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">הודעה בוואטסאפ</a>, דואר אלקטרוני <a href={`mailto:${STORE_EMAIL}`} dir="ltr">{STORE_EMAIL}</a>, או בחנות ברחוב השקמה 1, אזור.
            </p>
          </article>
        </div>
      </main>
      <SiteFoot />
    </>
  );
}
