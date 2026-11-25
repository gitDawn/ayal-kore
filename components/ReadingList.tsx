'use client';

// Floating "reading list" button and its panel: the list, and sending it to oneself
// through the visitor's own mail app (or the phone's share menu).
import { useEffect, useState } from 'react';
import { SITE_NAME, STORE_PHONE } from '@/lib/inventory';
import { clearList, removeItem, useReadingList, type ListItem } from '@/lib/readingList';

const STORE_ADDRESS = 'רחוב השקמה 1, אזור';
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

function listText(items: ListItem[]) {
  const lines = items.map((i, n) => {
    const details = [i.author, `${i.price} ₪`, i.condition].filter(Boolean).join(' · ');
    return `${n + 1}. ${i.title}${details ? ` (${details})` : ''}`;
  });
  return [
    `רשימת הקריאה שלי מ${SITE_NAME}:`,
    '',
    ...lines,
    '',
    `לחיפוש ספרים באתר: ${typeof window !== 'undefined' ? window.location.origin : ''}`,
    `${SITE_NAME}, ${STORE_ADDRESS}, טלפון ${STORE_PHONE}`,
  ].join('\n');
}

export default function ReadingList() {
  const items = useReadingList();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [canShare, setCanShare] = useState(false);

  useEffect(() => { setCanShare(typeof navigator !== 'undefined' && 'share' in navigator); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (items.length === 0 && !open) return null;

  function sendMail(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) { setNote('נא להקליד כתובת מייל תקינה.'); return; }
    const subject = `רשימת הקריאה שלי מ${SITE_NAME}`;
    window.location.href = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(listText(items))}`;
    setNote('נפתחה אפליקציית המייל עם הרשימה. נשאר רק ללחוץ "שליחה". אם שום דבר לא נפתח, אפשר להעתיק את הרשימה.');
  }

  async function copy() {
    try { await navigator.clipboard.writeText(listText(items)); setNote('הרשימה הועתקה. אפשר להדביק אותה במייל או בהודעה.'); }
    catch { setNote('לא הצלחנו להעתיק. נסו שוב.'); }
  }

  async function share() {
    try { await navigator.share({ title: `רשימת הקריאה שלי מ${SITE_NAME}`, text: listText(items) }); } catch { /* cancelled */ }
  }

  return (
    <>
      {!open && (
        <button type="button" className="rl-fab" onClick={() => { setOpen(true); setNote(''); }}>
          רשימת הקריאה שלי <span className="rl-count">{items.length}</span>
        </button>
      )}
      {open && (
        <div className="book-dialog-back" onClick={() => setOpen(false)}>
          <div className="rl-panel" role="dialog" aria-modal="true" aria-label="רשימת הקריאה שלי" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="book-dialog-close" aria-label="סגירה" onClick={() => setOpen(false)}>×</button>
            <h2>רשימת הקריאה שלי</h2>
            {items.length === 0 ? (
              <p className="search-hint">הרשימה ריקה. אפשר להוסיף ספרים מתוצאות החיפוש.</p>
            ) : (
              <>
                <ul className="rl-list">
                  {items.map((i) => (
                    <li key={i.id}>
                      <div>
                        <b>{i.title}</b>
                        <span>{[i.author, `${i.price} ₪`, i.condition].filter(Boolean).join(' · ')}</span>
                      </div>
                      <button type="button" className="rl-remove" aria-label={`הסרת ${i.title} מהרשימה`} onClick={() => removeItem(i.id)}>×</button>
                    </li>
                  ))}
                </ul>

                <form className="rl-send" onSubmit={sendMail}>
                  <label htmlFor="rl-email">שליחת הרשימה למייל שלי</label>
                  <div className="rl-row">
                    <input id="rl-email" type="email" dir="ltr" inputMode="email" autoComplete="email" placeholder="name@example.com"
                      value={email} onChange={(e) => { setEmail(e.target.value); setNote(''); }} />
                    <button type="submit" className="btn-search">שליחה</button>
                  </div>
                </form>
                <div className="rl-actions">
                  {canShare && <button type="button" className="chip" onClick={share}>שיתוף</button>}
                  <button type="button" className="chip" onClick={copy}>העתקת הרשימה</button>
                  <button type="button" className="chip" onClick={() => { clearList(); setNote(''); }}>ניקוי הרשימה</button>
                </div>
                {note && <p className="rl-note" role="status">{note}</p>}
                <p className="rl-small">הרשימה נשמרת רק בדפדפן הזה. ספרים במלאי עשויים להימכר, אז כדאי להתקשר לפני שמגיעים.</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Small add/remove button used on result cards and in the book window. */
export function ListToggle({ inList, onToggle, big = false }: { inList: boolean; onToggle: () => void; big?: boolean }) {
  return (
    <button
      type="button"
      className={`rl-toggle${inList ? ' on' : ''}${big ? ' big' : ''}`}
      aria-pressed={inList}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {inList ? '✓ ברשימת הקריאה' : '+ לרשימת הקריאה'}
    </button>
  );
}
