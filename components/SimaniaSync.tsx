'use client';

// Staff "עדכון מסימניה": open the store's inventory on Simania, read it with the bookmarklet,
// review the changes and only then update the site.
import { useEffect, useRef, useState } from 'react';
import './SimaniaSync.css';
import {
  BOOKMARKLET, DEFAULT_LIMIT, MESSAGE_KIND, SIMANIA_ORIGIN, TIME_LIMITS,
  applySimania, inventoryUrl, planSimania, readPayload, type SimaniaPlan, type TimeLimit,
} from '@/lib/simania-sync';

type Phase = 'idle' | 'waiting' | 'planning' | 'review' | 'applying' | 'done';

const nf = (n: number) => n.toLocaleString('he-IL');
const LIMIT_LABEL: Record<TimeLimit, string> = { day: 'יום', week: 'שבוע', month: 'חודש', all: 'הכל' };
const LIMIT_TIME: Record<TimeLimit, string> = { day: 'כמה שניות', week: 'כמה שניות', month: 'עד דקה', all: 'כשלוש דקות' };
const PERIOD: Record<TimeLimit, string> = { day: 'ביום האחרון', week: 'בשבוע האחרון', month: 'בחודש האחרון', all: '' };

function friendly(err: unknown): string {
  const msg = (err as { message?: string })?.message || String(err || '');
  if (msg === 'stale') return 'המלאי באתר השתנה מאז הקריאה. קראו שוב מסימניה כדי לראות תצוגה מקדימה עדכנית.';
  if (msg === 'bad payload') return 'הקובץ הזה אינו רשימה שנקראה מסימניה.';
  if (/row-level security|violates|permission|unauthorized|403/i.test(msg)) return 'החשבון הזה לא מורשה לעדכן את המלאי.';
  if (/jwt|expired|session/i.test(msg)) return 'פג תוקף ההתחברות. התחברו מחדש ונסו שוב.';
  if (/fetch|network/i.test(msg)) return 'אין חיבור לשרת כרגע. נסו שוב בעוד דקה.';
  return 'משהו השתבש. נסו שוב.';
}

export default function SimaniaSync({ onDone }: { onDone?: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [limit, setLimit] = useState<TimeLimit>(DEFAULT_LIMIT);
  const [plan, setPlan] = useState<SimaniaPlan | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ inStock: number } | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const busy = useRef(false);

  // React does not render javascript: links, so the bookmarklet address is set directly.
  useEffect(() => { linkRef.current?.setAttribute('href', BOOKMARKLET); }, []);

  const receive = async (data: unknown) => {
    if (busy.current) return;
    busy.current = true;
    setError(''); setPhase('planning'); setProgress('משווה למלאי באתר…');
    try {
      setPlan(await planSimania(readPayload(data)));
      setPhase('review');
    } catch (e) {
      setError(friendly(e)); setPhase('idle');
    } finally {
      setProgress(''); busy.current = false;
    }
  };

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== SIMANIA_ORIGIN) return;
      if ((e.data as { kind?: string })?.kind !== MESSAGE_KIND) return;
      void receive(e.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const open = () => {
    setError(''); setResult(null); setPlan(null);
    window.open(inventoryUrl(limit), '_blank');
    setPhase('waiting');
  };

  const fromFile = async (f: File | undefined) => {
    if (!f) return;
    try { await receive(JSON.parse(await f.text())); }
    catch { setError('לא הצלחתי לקרוא את הקובץ.'); }
  };

  const apply = async () => {
    if (!plan) return;
    setError(''); setPhase('applying');
    try {
      setResult(await applySimania(plan, setProgress));
      setPhase('done');
      onDone?.();
    } catch (e) {
      setError(friendly(e)); setPhase('review');
    } finally {
      setProgress('');
    }
  };

  const cancel = () => { setPlan(null); setPhase('idle'); setError(''); };

  return (
    <section className="panel stack sim-sync">
      <div>
        <h2>עדכון מסימניה</h2>
        <p className="sub" style={{ margin: 0 }}>
          קוראים את המלאי של החנות בסימניה, רואים מה ישתנה באתר, ומעדכנים רק אחרי אישור.
          ספרים שסומנו &quot;לא במלאי&quot; חוזרים למלאי רק אם הם מוצעים למכירה בסימניה.
          ספרים שהורדו מסימניה מסומנים באתר &quot;לא במלאי&quot; רק בקריאה של &quot;הכל&quot;, כי רק אז נקראת הרשימה המלאה.
        </p>
      </div>

      <details className="sim-setup">
        <summary>הכנה חד־פעמית: הוספת הסימנייה &quot;קריאת מלאי מסימניה&quot;</summary>
        <ol>
          <li>אם סרגל הסימניות בכרום מוסתר, לחצו Ctrl+Shift+B כדי להציג אותו.</li>
          <li>
            גררו את הכפתור הזה אל סרגל הסימניות:{' '}
            <a ref={linkRef} className="bookmarklet" onClick={(e) => e.preventDefault()} draggable>קריאת מלאי מסימניה</a>
          </li>
          <li>זהו. אין צורך לעשות את זה שוב.</li>
        </ol>
      </details>

      {(phase === 'idle' || phase === 'waiting' || phase === 'done') && (
        <ol className="sim-steps">
          <li>
            <span className="sim-limit" role="radiogroup" aria-label="אילו עותקים לקרוא">
              <span>לקרוא את העותקים שעודכנו בסימניה ב:</span>
              {TIME_LIMITS.map((l) => (
                <label key={l}>
                  <input type="radio" name="sim-limit" value={l} checked={limit === l} onChange={() => setLimit(l)} /> {LIMIT_LABEL[l]}
                </label>
              ))}
            </span>
          </li>
          <li>
            <button className="btn" type="button" onClick={open}>פתיחת המלאי בסימניה</button>
            <span className="muted"> (יש להיות מחוברים לסימניה בדפדפן הזה)</span>
          </li>
          <li>בלשונית של סימניה שנפתחה, לחצו על הסימנייה &quot;קריאת מלאי מסימניה&quot;. הקריאה לוקחת {LIMIT_TIME[limit]}.</li>
          <li>כשהקריאה מסתיימת, התצוגה המקדימה תופיע כאן.</li>
        </ol>
      )}

      {phase === 'waiting' && <p className="msg info">ממתין לרשימה מסימניה…</p>}

      {(phase === 'idle' || phase === 'waiting') && (
        <p className="sub" style={{ margin: 0 }}>
          אם הסימנייה הופעלה בלשונית שלא נפתחה מכאן, היא שומרת קובץ. אפשר להעלות אותו כאן:{' '}
          <input type="file" accept="application/json,.json" onChange={(e) => { void fromFile(e.target.files?.[0]); e.target.value = ''; }} />
        </p>
      )}

      {progress && <p className="status" style={{ textAlign: 'start' }}>{progress}</p>}
      {error && <p className="msg err">{error}</p>}

      {plan && (phase === 'review' || phase === 'applying') && (
        <div className="stack sim-preview">
          <h3 style={{ margin: 0 }}>תצוגה מקדימה</h3>
          {plan.since && plan.since !== 'all' ? (
            <p className="sub" style={{ margin: 0 }}>
              נקראו רק העותקים שעודכנו בסימניה {PERIOD[plan.since]}. ספרים שלא נקראו נשארים באתר בלי שינוי,
              וגם ספרים שהורדו מסימניה לא יזוהו. כדי לזהות אותם, קראו עם &quot;הכל&quot;.
            </p>
          ) : !plan.since && plan.pages && plan.totalPages && plan.pages < plan.totalPages ? (
            <p className="sub" style={{ margin: 0 }}>
              נקראו {nf(plan.pages)} עמודים מתוך {nf(plan.totalPages)}: העותקים שעודכנו לאחרונה בסימניה.
              ספרים שלא נקראו נשארים באתר בלי שינוי.
            </p>
          ) : null}
          <div className="stats">
            <div className="stat"><b>{nf(plan.items.length)}</b><span>עותקים בסימניה</span></div>
            <div className="stat"><b>{nf(plan.added.length)}</b><span>ספרים חדשים</span></div>
            <div className="stat"><b>{nf(plan.returned.length)}</b><span>יחזרו למלאי</span></div>
            {plan.full && <div className="stat"><b>{nf(plan.removed.length)}</b><span>ירדו מסימניה</span></div>}
            <div className="stat"><b>{nf(plan.changed.filter((c) => c.fromPrice !== c.toPrice).length)}</b><span>שינויי מחיר</span></div>
            <div className="stat"><b>{nf(plan.changed.filter((c) => c.fromCond !== c.toCond).length)}</b><span>שינויי מצב</span></div>
          </div>

          {plan.added.length > 0 && (
            <details open={plan.added.length <= 30}>
              <summary>ספרים שיתווספו ({nf(plan.added.length)})</summary>
              <ul className="sim-changes">
                {plan.added.map((r, i) => <li key={i}>{r[0]}{r[1] ? `, ${r[1]}` : ''} · {r[2] || 'ללא מצב'} · {r[3]} ₪</li>)}
              </ul>
            </details>
          )}
          {plan.returned.length > 0 && (
            <details open={plan.returned.length <= 30}>
              <summary>ספרים שיחזרו למלאי ({nf(plan.returned.length)})</summary>
              <ul className="sim-changes">
                {plan.returned.map((r, i) => <li key={i}>{r[0]}{r[1] ? `, ${r[1]}` : ''}</li>)}
              </ul>
            </details>
          )}
          {plan.removed.length > 0 && (
            <details open={plan.removed.length <= 30}>
              <summary>ספרים שהורדו מסימניה ויסומנו באתר &quot;לא במלאי&quot; ({nf(plan.removed.length)})</summary>
              {plan.removed.length > plan.items.length / 2 && (
                <p className="msg err">שימו לב: זה הרבה ספרים ביחס לרשימה שנקראה. אם הקריאה נקטעה באמצע, אל תעדכנו, וקראו שוב.</p>
              )}
              <ul className="sim-changes">
                {plan.removed.map((r, i) => <li key={i}>{r[0]}{r[1] ? `, ${r[1]}` : ''} · {r[2] || 'ללא מצב'} · {r[3]} ₪</li>)}
              </ul>
            </details>
          )}
          {plan.changed.length > 0 && (
            <details open={plan.changed.length <= 30}>
              <summary>שינויי מחיר או מצב ({nf(plan.changed.length)})</summary>
              <ul className="sim-changes">
                {plan.changed.map((c, i) => (
                  <li key={i}>
                    {c.title}{c.author ? `, ${c.author}` : ''}:{' '}
                    {c.fromPrice !== c.toPrice && <span>מחיר {c.fromPrice} ← {c.toPrice} ₪ </span>}
                    {c.fromCond !== c.toCond && <span>מצב &quot;{c.fromCond || 'ריק'}&quot; ← &quot;{c.toCond}&quot;</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {!plan.added.length && !plan.returned.length && !plan.removed.length && !plan.changed.length && (
            <p className="msg info">אין שינויים במלאי. העדכון ישמור רק תאריכי עדכון ותגיות.</p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="button" onClick={apply} disabled={phase === 'applying'}>עדכון האתר</button>
            <button className="btn ghost" type="button" onClick={cancel} disabled={phase === 'applying'}>ביטול</button>
          </div>
        </div>
      )}

      {phase === 'done' && result && plan && (
        <p className="msg ok">
          האתר עודכן: נוספו {nf(plan.added.length)} ספרים, חזרו למלאי {nf(plan.returned.length)}{plan.full ? `, ירדו מהמלאי ${nf(plan.removed.length)}` : ''}, עודכנו {nf(plan.changed.length)} עותקים.
          יש עכשיו {nf(result.inStock)} ספרים במלאי. החיפוש באתר יתעדכן תוך כמה דקות.
        </p>
      )}
    </section>
  );
}
