import styles from './StorePhoto.module.css';
import { SITE_NAME } from '@/lib/inventory';

const STORE_ADDRESS = 'רחוב השקמה 1, אזור';
const STORE_MAP = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('השקמה 1 אזור');

/** A small "visit the shop" strip with a photo of the shelves, above the contact details. */
export default function StorePhoto() {
  return (
    <section className={styles.wrap} aria-label="החנות">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.img}
        src="/store.avif"
        alt={`מדפי הספרים בחנות ${SITE_NAME}`}
        width={800}
        height={360}
        loading="lazy"
      />
      <div className={styles.text}>
        <h3 className={styles.title}>בואו לבקר בחנות</h3>
        <p className={styles.body}>
          אלפי ספרים יד שנייה מחכים על המדפים. מוזמנים לעבור, לדפדף ולמצוא את הספר הבא.
        </p>
        <a className={styles.link} href={STORE_MAP} target="_blank" rel="noopener noreferrer">{STORE_ADDRESS}</a>
      </div>
    </section>
  );
}
