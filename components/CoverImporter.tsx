'use client';

import { useEffect, useRef, useState } from 'react';
import './BookEditor.css';
import { bookRef, loadUniqueBooks, type Book } from '@/lib/catalog-client';
import { QuotaError, copyCoverFrom, copyMissFrom, fetchCoverRows, importFromGoogle, isWideFile, looseKey, needsSecondSearch, upgradeCover, type CoverRow } from '@/lib/covers';
import { A, T } from '@/lib/inventory';
import CoverReview from '@/components/CoverReview';
import CoverMisses from '@/components/CoverMisses';
import { supabase } from '@/lib/supabase';

/** book_key → most recent Simania update time (staff only), to search recently updated books first. */
async function simaniaDates(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let from = 0; from < 200000; from += 1000) {
    const { data, error } = await supabase().from('simania_items').select('book_key,simania_updated_at')
      .not('simania_updated_at', 'is', null).order('owned_id').range(from, from + 999);
    if (error || !data) break;
    for (const r of data as { book_key: string; simania_updated_at: string }[]) {
      const t = Date.parse(r.simania_updated_at);
      if (t > (out.get(r.book_key) ?? 0)) out.set(r.book_key, t);
    }
    if (data.length < 1000) break;
  }
  return out;
}

interface Stats { total: number; checked: number; withCover: number; }

// Google's daily quota resets at midnight Pacific time.
function nextQuotaReset(now = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(now).map((p) => [p.type, p.value]),
  );
  const y = Number(parts.year), m = Number(parts.month), d = Number(parts.day);
  for (const h of [7, 8]) { // PDT is UTC-7, PST is UTC-8
    const t = new Date(Date.UTC(y, m - 1, d + 1, h));
    const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(t);
    if (Number(hour) === 0) return t;
  }
  return new Date(Date.UTC(y, m - 1, d + 1, 8));
}

const fmtReset = (t: Date) =>
  t.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

const QUOTA_KEY = 'haayal-google-quota-reset';
function readQuotaReset(): Date | null {
  try {
    const v = Number(localStorage.getItem(QUOTA_KEY));
    return v && v > Date.now() ? new Date(v) : null;
  } catch { return null; }
}
function saveQuotaReset(t: Date) { try { localStorage.setItem(QUOTA_KEY, String(t.getTime())); } catch { /* ignore */ } }
type Mode = 'new' | 'retry' | 'second' | 'upgrade';

export default function CoverImporter({ onOpenBook }: { onOpenBook?: (bookKey: string) => void }) {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [rowsByKey, setRowsByKey] = useState<Map<string, CoverRow>>(new Map());
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [running, setRunning] = useState<Mode | null>(null);
  const [session, setSession] = useState({ saved: 0, inner: 0, notFound: 0, rejected: 0, errors: 0, copied: 0 });
  const [fresh, setFresh] = useState<string[]>([]); // books whose cover was saved in this run
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const stopRef = useRef(false);
  const [upgrade, setUpgrade] = useState({ done: 0, upgraded: 0, errors: 0 });
  const [quotaReset, setQuotaReset] = useState<Date | null>(null);
  useEffect(() => { setQuotaReset(readQuotaReset()); }, []);

  useEffect(() => {
    (async () => {
      try {
        const [raw, rows, dates] = await Promise.all([loadUniqueBooks(), fetchCoverRows(false, true), simaniaDates().catch(() => new Map<string, number>())]);
        // Most recently updated in Simania first; books without a Simania date at the end.
        const list = [...raw].sort((x, y) => (dates.get(y.key) ?? 0) - (dates.get(x.key) ?? 0));
        const keys = new Set(list.map((b) => b.key));
        const m = new Map(rows.filter((r) => keys.has(r.book_key)).map((r) => [r.book_key, r]));
        setBooks(list);
        setRowsByKey(m);
        setStats({ total: list.length, checked: m.size, withCover: [...m.values()].filter((r) => r.path).length });
      } catch {
        setLoadErr('לא הצלחנו לטעון את הנתונים. רעננו את הדף ונסו שוב.');
      }
    })();
  }, []);

  // Misses from before the improved search (no recorded reason) can be searched again.
  const retryable = books ? books.filter((b) => { const r = rowsByKey.get(b.key); return r?.source === 'none' && !r.reason; }) : [];

  // Misses that so far had only the title + author search; they can get the title-only search.
  const secondable = books ? books.filter((b) => { const r = rowsByKey.get(b.key); return r?.source === 'none' && r.reason !== 'plain' && r.reason !== 'inner' && needsSecondSearch(r.query); }) : [];

  // Google covers not yet checked for a larger version, or upgraded before covers were kept 600px wide.
  const upgradable = [...rowsByKey.values()].filter((r) => r.source === 'google' && r.path && r.google_id
    && (r.hq == null || (r.hq === true && !isWideFile(r.path))));

  async function startUpgrade() {
    stopRef.current = false;
    setRunning('upgrade'); setNote(null);
    const rows = new Map(rowsByKey);
    let errorsInRow = 0;
    for (const r of upgradable) {
      if (stopRef.current) break;
      try {
        const newPath = await upgradeCover(r);
        errorsInRow = 0;
        rows.set(r.book_key, newPath ? { ...r, path: newPath, hq: true } : { ...r, hq: false });
        setUpgrade((u) => ({ ...u, done: u.done + 1, upgraded: u.upgraded + (newPath ? 1 : 0) }));
      } catch {
        setUpgrade((u) => ({ ...u, errors: u.errors + 1 }));
        if (++errorsInRow >= 5) {
          setNote({ ok: false, text: 'היו כמה שגיאות ברצף, אז השדרוג נעצר. נסו שוב בעוד רגע.' });
          break;
        }
      }
    }
    setRowsByKey(rows);
    setRunning(null);
  }

  async function start(mode: Mode) {
    if (!books || !stats) return;
    stopRef.current = false;
    setRunning(mode); setNote(null); setQuotaReset(null);
    const queue = mode === 'new' ? books.filter((b) => !rowsByKey.has(b.key)) : mode === 'second' ? secondable : retryable;
    const rows = new Map(rowsByKey);
    // Covers (and confirmed misses) already known for similar books, by loose key.
    const similar = new Map<string, CoverRow>();
    const remember = (r: CoverRow) => {
      if (!r.title) return;
      const k = looseKey(r.title, r.author || '');
      const prev = similar.get(k);
      if (r.path ? !prev?.path : (!prev && r.source === 'none' && r.reason)) similar.set(k, r);
    };
    rows.forEach(remember);
    let st = { ...stats };
    let errorsInRow = 0;
    let limitWaits = 0;
    for (const b of queue) {
      if (stopRef.current) break;
      try {
        const ref = bookRef(b);
        const like = similar.get(looseKey(b.row[T], b.row[A] || ''));
        if (like && like.book_key !== b.key && (mode !== 'second' || like.path)) {
          const isNew = !rows.has(b.key);
          if (like.path) {
            const path = await copyCoverFrom(ref, like);
            const nr: CoverRow = { ...like, book_key: b.key, path, title: ref.title, author: ref.author };
            rows.set(b.key, nr);
            st = { ...st, checked: st.checked + (isNew ? 1 : 0), withCover: st.withCover + 1 };
            setFresh((x) => [...x, b.key]);
          } else {
            await copyMissFrom(ref, like);
            rows.set(b.key, { ...like, book_key: b.key, path: null, title: ref.title, author: ref.author });
            st = { ...st, checked: st.checked + (isNew ? 1 : 0) };
          }
          setStats(st);
          setSession((s) => ({ ...s, copied: s.copied + 1 }));
          errorsInRow = 0;
          continue;
        }
        // One search per book first; the title-only search runs later as its own pass.
        const r = await importFromGoogle(ref, undefined, true, mode === 'second' ? 'second' : 'first');
        errorsInRow = 0; limitWaits = 0;
        const isNew = !rows.has(b.key);
        rows.set(b.key, r.result === 'saved'
          ? { book_key: b.key, path: r.path, source: 'google', query: r.query }
          : { book_key: b.key, path: null, source: 'none', reason: r.reason, query: r.query });
        remember({ ...rows.get(b.key)!, title: ref.title, author: ref.author, suspect: r.result === 'saved' && r.suspect ? 'title-only' : null });
        st = { ...st, checked: st.checked + (isNew ? 1 : 0), withCover: st.withCover + (r.result === 'saved' ? 1 : 0) };
        setStats(st);
        setSession((s) => ({
          ...s,
          saved: s.saved + (r.result === 'saved' ? 1 : 0),
          inner: s.inner + (r.result === 'rejected' && r.reason === 'inner' ? 1 : 0),
          notFound: s.notFound + (r.result === 'not-found' ? 1 : 0),
          rejected: s.rejected + (r.result === 'rejected' ? 1 : 0),
        }));
        if (r.result === 'saved') setFresh((x) => [...x, b.key]);
      } catch (e) {
        if (e instanceof QuotaError && !e.daily && limitWaits < 3) {
          // Probably the per-minute limit: pause for a minute and retry the same book.
          limitWaits++;
          setNote({ ok: true, text: 'גוגל ביקש להאט. ממתין דקה וממשיך…' });
          await new Promise((z) => setTimeout(z, 65000));
          setNote(null);
          if (!stopRef.current) { queue.splice(queue.indexOf(b) + 1, 0, b); }
          continue;
        }
        if (e instanceof QuotaError) {
          const t = nextQuotaReset();
          saveQuotaReset(t);
          setQuotaReset(t);
          setNote({ ok: false, text: `תשובת גוגל (לבדיקה): ${e.message}` });
          break;
        }
        setSession((s) => ({ ...s, errors: s.errors + 1 }));
        if (++errorsInRow >= 5) {
          setNote({ ok: false, text: 'היו כמה שגיאות ברצף, אז הייבוא נעצר. בדקו את החיבור ונסו שוב.' });
          break;
        }
      }
      // About one book per second keeps us under Google's per-minute limit.
      await new Promise((z) => setTimeout(z, 1000));
    }
    setRowsByKey(rows);
    setRunning(null);
  }

  if (loadErr) return <section className="panel"><p className="msg err">{loadErr}</p></section>;
  if (!stats) return <section className="panel"><p className="status">טוען…</p></section>;

  const pct = stats.total ? Math.round((stats.checked / stats.total) * 100) : 0;
  const left = stats.total - stats.checked;

  return (
    <>
      <section className="panel stack">
        <div>
          <h2>ייבוא כריכות מגוגל</h2>
          <p className="sub" style={{ margin: 0 }}>
            מחפש כל ספר בגוגל ספרים לפי שם ומחבר, חיפוש אחד לכל ספר. ספרים שלא נמצאו אפשר לחפש אחר כך שוב לפי השם בלבד. כריכה חלקה בצבע אחד נפסלת,
            וגם תמונה לבנה ברובה, שהיא כמעט תמיד עמוד פנימי. ספרים שנפסלו עוברים לרשימת הספרים בלי כריכה, ומשם אפשר להחזיר תמונה ככריכה אם היא בכל זאת נכונה.
            גוגל מאפשר בערך אלף חיפושים ביום, אז הייבוא נעצר כשהמכסה נגמרת וממשיך מאותה נקודה בפעם הבאה.
            צריך להשאיר את הדף פתוח בזמן שהוא רץ.
          </p>
        </div>

        <div className="stats">
          <div className="stat"><b>{stats.total.toLocaleString('he-IL')}</b><span>ספרים שונים במלאי</span></div>
          <div className="stat"><b>{stats.checked.toLocaleString('he-IL')}</b><span>נבדקו</span></div>
          <div className="stat"><b>{stats.withCover.toLocaleString('he-IL')}</b><span>עם כריכה</span></div>
          <div className="stat"><b>{left.toLocaleString('he-IL')}</b><span>נשארו</span></div>
        </div>
        <div className="progress" aria-label={`${pct}%`}><div style={{ width: `${pct}%` }} /></div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {running ? (
            <>
              <button className="btn ghost" type="button" onClick={() => { stopRef.current = true; }}>עצירה</button>
              <span className="status" style={{ margin: 0 }}>{running === 'retry' ? 'מחפש שוב…' : running === 'second' ? 'מחפש לפי שם בלבד…' : running === 'upgrade' ? 'משדרג כריכות…' : 'מייבא…'}</span>
            </>
          ) : (
            <>
              <button className="btn dark" type="button" onClick={() => start('new')} disabled={left === 0}>
                {stats.checked ? 'המשך ייבוא' : 'התחלת ייבוא'}
              </button>
              {secondable.length > 0 && (
                <button className="btn ghost" type="button" onClick={() => start('second')}>
                  חיפוש שני לפי שם בלבד לספרים שלא נמצאו ({secondable.length.toLocaleString('he-IL')})
                </button>
              )}
              {upgradable.length > 0 && (
                <button className="btn ghost" type="button" onClick={startUpgrade}>
                  שדרוג כריכות קיימות לאיכות גבוהה ({upgradable.length.toLocaleString('he-IL')})
                </button>
              )}
              {retryable.length > 0 && (
                <button className="btn ghost" type="button" onClick={() => start('retry')}>
                  חיפוש חוזר לספרים שלא נמצאו קודם ({retryable.length.toLocaleString('he-IL')})
                </button>
              )}
            </>
          )}
        </div>
        {retryable.length > 0 && !running && (
          <p className="sub" style={{ margin: 0, fontSize: 13 }}>
            החיפוש החוזר עובר על ספרים שנבדקו לפני שיפור החיפוש, ומשתמש באותה מכסה יומית.
          </p>
        )}

        {(upgrade.done + upgrade.errors) > 0 && (
          <p className="sub" style={{ margin: 0 }}>
            שדרוג כריכות: נבדקו {upgrade.done} · {upgrade.upgraded} הוחלפו בגרסה גדולה יותר · {upgrade.done - upgrade.upgraded} בלי גרסה גדולה בגוגל
            {upgrade.errors ? ` · ${upgrade.errors} שגיאות` : ''}
          </p>
        )}
        {(session.saved + session.notFound + session.rejected + session.errors + session.copied) > 0 && (
          <p className="sub" style={{ margin: 0 }}>
            בהרצה הזו: {session.saved} כריכות נשמרו · {session.notFound} לא נמצאו · {session.rejected} נפסלו{session.inner ? ` (מתוכן ${session.inner} עמוד פנימי)` : ''}
            {session.copied ? ` · ${session.copied} הועתקו מספר דומה בלי חיפוש` : ''}
            {session.errors ? ` · ${session.errors} שגיאות` : ''}
          </p>
        )}
        {quotaReset && !running && (
          <p className="msg err" role="status">
            המכסה היומית של גוגל נגמרה. היא תתחדש ב{fmtReset(quotaReset)}, ואז אפשר להמשיך מאותה נקודה.
          </p>
        )}
        {note && <p className={note.ok ? 'msg ok' : 'msg err'} role="status">{note.text}</p>}

      </section>
      <CoverReview onOpenBook={onOpenBook} fresh={fresh} />
      <CoverMisses key={`m-${running ?? 'idle'}`} />
    </>
  );
}
