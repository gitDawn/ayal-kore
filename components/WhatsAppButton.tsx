'use client';

// "Ask about this book on WhatsApp": opens a chat with the store and a ready message.
import { STORE_PHONE_INTL, formatPrice } from '@/lib/inventory';
import './whatsapp.css';

export function whatsappLink(title: string, author: string, price: number, condition: string, url: string, outOfStock = false) {
  const details = [formatPrice(price), condition].filter(Boolean).join(', ');
  const book = `"${title}"${author ? ` מאת ${author}` : ''}`;
  const text = outOfStock
    ? `שלום, אני מחפש/ת את הספר ${book}. ראיתי באתר שהוא לא במלאי כרגע. אם יגיע עותק, אשמח לשמוע.\n${url}`
    : `שלום, אני מתעניין/ת בספר ${book} (${details}). האם הוא עדיין זמין?\n${url}`;
  return `https://wa.me/${STORE_PHONE_INTL.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export default function WhatsAppButton({ title, author, price, condition, url, small = false, outOfStock = false }: {
  title: string; author: string; price: number; condition: string; url: string; small?: boolean; outOfStock?: boolean;
}) {
  return (
    <a
      className={small ? 'wa-btn small' : 'wa-btn'}
      href={whatsappLink(title, author, price, condition, url, outOfStock)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12Z" />
      </svg>
      {outOfStock ? 'עדכנו אותי כשיגיע (וואטסאפ)' : small ? 'שאלה בוואטסאפ' : 'שאלה על הספר בוואטסאפ'}
    </a>
  );
}
