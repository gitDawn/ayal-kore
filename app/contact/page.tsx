import type { Metadata } from 'next';
import { SiteNav, SiteFoot } from '@/components/Chrome';
import { SITE_NAME, STORE_FACEBOOK, STORE_PHONE, STORE_PHONE_INTL } from '@/lib/inventory';
import '../accessibility/accessibility.css';
import './contact.css';

export const metadata: Metadata = {
  title: `יצירת קשר | ${SITE_NAME}`,
  description: `טלפון, וואטסאפ, דואר אלקטרוני וכתובת של ${SITE_NAME}, חנות ספרים יד שנייה ברחוב השקמה 1, אזור.`,
  alternates: { canonical: '/contact' },
};

const ADDRESS = 'רחוב השקמה 1, אזור';
const STORE_EMAIL = 'ayalmer@gmail.com';
const STORE_SIMANIA = 'https://simania.co.il/userPage.php?userId=36217&tab=bookWorld';
const WHATSAPP = `https://wa.me/${STORE_PHONE_INTL.replace(/\D/g, '')}`;
const MAP_QUERY = encodeURIComponent('השקמה 1 אזור');
const MAP_LINK = `https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`;
const MAP_EMBED = `https://maps.google.com/maps?q=${MAP_QUERY}&z=16&hl=he&output=embed`;

export default function ContactPage() {
  return (
    <>
      <SiteNav />
      <main className="stage">
        <div className="card">
          <article className="section a11y">
            <h1>יצירת קשר</h1>
            <p>נשמח לעזור למצוא ספר, לשמור לכם ספר או לענות על כל שאלה.</p>

            <ul className="contact-list">
              <li><b>טלפון:</b> <a href={`tel:${STORE_PHONE_INTL}`} dir="ltr">{STORE_PHONE}</a></li>
              <li><b>וואטסאפ:</b> <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">שליחת הודעה בוואטסאפ</a></li>
              <li><b>דואר אלקטרוני:</b> <a href={`mailto:${STORE_EMAIL}`} dir="ltr">{STORE_EMAIL}</a></li>
              <li><b>פייסבוק:</b> <a href={STORE_FACEBOOK} target="_blank" rel="noopener noreferrer">הדף שלנו בפייסבוק</a></li>
              <li><b>סימניה:</b> <a href={STORE_SIMANIA} target="_blank" rel="noopener noreferrer">הספרים שלנו למכירה בסימניה</a></li>
              <li><b>כתובת:</b> <a href={MAP_LINK} target="_blank" rel="noopener noreferrer">{ADDRESS}</a></li>
            </ul>

            <div className="contact-map">
              <iframe
                src={MAP_EMBED}
                title={`מפה: ${SITE_NAME}, ${ADDRESS}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <p className="a11y-date">
              המפה מוצגת מ־ Google Maps. אפשר גם <a href={MAP_LINK} target="_blank" rel="noopener noreferrer">לפתוח את הכתובת במפות גוגל</a>.
            </p>
          </article>
        </div>
      </main>
      <SiteFoot />
    </>
  );
}
