import type { Metadata } from 'next';
import { SiteNav, SiteFoot } from '@/components/Chrome';
import { SITE_NAME, STORE_PHONE, STORE_PHONE_INTL } from '@/lib/inventory';
import '../accessibility/accessibility.css';
import '@/components/whatsapp.css';

export const metadata: Metadata = {
  title: `ביטול עסקה והחזרות | ${SITE_NAME}`,
  description: `תנאי ביטול עסקה והחזרה בקנייה מרחוק ב${SITE_NAME}, לפי חוק הגנת הצרכן, ואיך מודיעים על ביטול.`,
  alternates: { canonical: '/cancel' },
};

const UPDATED = '27 בנובמבר 2026';
const ADDRESS = 'רחוב השקמה 1, אזור';
const STORE_EMAIL = 'ayalmer@gmail.com';
const CANCEL_TEXT = `שלום, אני מבקש/ת לבטל עסקה.
שם מלא:
מספר תעודת זהות:
הספר או הספרים שהוזמנו:
תאריך ההזמנה:`;
const WHATSAPP_CANCEL = `https://wa.me/${STORE_PHONE_INTL.replace(/\D/g, '')}?text=${encodeURIComponent(CANCEL_TEXT)}`;

export default function CancelPage() {
  return (
    <>
      <SiteNav />
      <main className="stage">
        <div className="card">
          <article className="section a11y">
            <h1>ביטול עסקה והחזרות</h1>
            <p className="a11y-date">התנאים עודכנו בתאריך {UPDATED}.</p>

            <p>
              התנאים בעמוד הזה חלים על קנייה מרחוק: הזמנה בטלפון, בוואטסאפ או בעקבות האתר. הם נקבעו לפי חוק
              הגנת הצרכן, התשמ&quot;א 1981, ותקנות הגנת הצרכן (ביטול עסקה), התשע&quot;א 2010. אם יש סתירה בין
              העמוד הזה לבין החוק, החוק קובע.
            </p>

            <div className="a11y-contact">
              <h2 style={{ marginTop: 0 }}>רוצים לבטל הזמנה?</h2>
              <p style={{ margin: '0 0 8px' }}>
                <a className="wa-btn" href={WHATSAPP_CANCEL} target="_blank" rel="noopener noreferrer">שליחת הודעת ביטול בוואטסאפ</a>
              </p>
              <p style={{ margin: 0 }}>
                או בטלפון <a href={`tel:${STORE_PHONE_INTL}`} dir="ltr">{STORE_PHONE}</a>, או בדואר אלקטרוני <a href={`mailto:${STORE_EMAIL}`} dir="ltr">{STORE_EMAIL}</a>. כל הדרכים מפורטות למטה.
              </p>
            </div>

            <h2>עד מתי אפשר לבטל</h2>
            <ul>
              <li>
                בתוך 14 ימים מיום קבלת הספר, או מיום קבלת המסמך עם פרטי העסקה, לפי המאוחר מביניהם. אפשר לבטל
                גם לפני שהספר הגיע.
              </li>
              <li>
                אדם עם מוגבלות, אדם בן 65 ומעלה ועולה חדש רשאים לבטל בתוך 4 חודשים, אם ההזמנה כללה שיחה בינם
                לבין החנות, למשל בטלפון. הזכות הזו קיימת גם כשהספר נקנה עבור מישהו אחר.
              </li>
              <li>אין צורך לנמק את הביטול.</li>
            </ul>

            <h2>איך מודיעים על ביטול</h2>
            <p>אפשר למסור הודעת ביטול בכל אחת מהדרכים האלה:</p>
            <ul>
              <li>בוואטסאפ, בכפתור שלמעלה או במספר <a href={`tel:${STORE_PHONE_INTL}`} dir="ltr">{STORE_PHONE}</a>.</li>
              <li>בטלפון, במספר <a href={`tel:${STORE_PHONE_INTL}`} dir="ltr">{STORE_PHONE}</a>.</li>
              <li>בדואר אלקטרוני: <a href={`mailto:${STORE_EMAIL}`} dir="ltr">{STORE_EMAIL}</a>.</li>
              <li>בעל פה בחנות, ב{ADDRESS}.</li>
              <li>בדואר רשום, לכתובת: {SITE_NAME}, {ADDRESS}.</li>
            </ul>
            <p>
              בהודעה יש לציין שם מלא ומספר תעודת זהות, ואת הספר או הספרים שהוזמנו. נאשר לכם שקיבלנו את
              ההודעה.
            </p>

            <h2>החזרת הספר</h2>
            <ul>
              <li>אם הספר כבר הגיע אליכם, מחזירים אותו לחנות ב{ADDRESS}, או במקום שבו קיבלתם אותו, בתיאום איתנו.</li>
              <li>מחזירים את הספר במצב שבו התקבל, בלי שנפגם.</li>
              <li>אם הביטול נובע מפגם, מאי התאמה לתיאור או מאיחור באספקה, אנחנו נאסוף את הספר על חשבוננו.</li>
            </ul>

            <h2>החזר כספי</h2>
            <ul>
              <li>נחזיר את הכסף ששילמתם, כולל דמי המשלוח אם שולמו, בתוך 14 ימים מיום קבלת הודעת הביטול.</li>
              <li>ההחזר יבוצע ככל האפשר באותו אמצעי תשלום שבו שילמתם.</li>
            </ul>

            <h2>דמי ביטול</h2>
            <ul>
              <li>בביטול מסיבה של חרטה, ננכה דמי ביטול של 5% ממחיר העסקה או 100 ₪, הסכום הנמוך מביניהם.</li>
              <li>
                לא ייגבו דמי ביטול אם הביטול נובע מפגם בספר, מאי התאמה בין הספר שקיבלתם לבין התיאור שלו, מאי
                אספקה במועד שסוכם, או מכל הפרה אחרת שלנו.
              </li>
            </ul>

            <h2>קנייה בחנות</h2>
            <p>
              קנייה שנעשתה בחנות עצמה כפופה לכללי הביטול של קנייה בחנות לפי החוק. אפשר לשאול אותנו על כך
              בחנות או בטלפון.
            </p>

            <p>
              ראו גם את <a href="/terms">תנאי המכירה</a> ואת <a href="/privacy">מדיניות הפרטיות</a>.
            </p>
          </article>
        </div>
      </main>
      <SiteFoot />
    </>
  );
}
