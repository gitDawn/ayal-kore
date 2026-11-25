'use client';

import { useCallback, useEffect, useState } from 'react';
import './CoverReview.css';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase';
import { saveGoogleImage } from '@/lib/covers';

interface Row {
  book_key: string;
  title: string | null;
  author: string | null;
  reason: string | null;
  query: string | null;
  google_id: string | null;
  google_title: string | null;
  google_authors: string | null;
  google_image: string | null;
}

const PAGE = 40;

const REASONS: [string, string][] = [
  ['', 'כל הסיבות'],
  ['plain', 'נפסלה ככריכה חלקה'],
  ['inner', 'נפסלה כעמוד פנימי'],
  ['no-match', 'גוגל החזיר ספר אחר'],
  ['no-image', 'נמצא בגוגל בלי תמונה'],
  ['no-results', 'אין תוצאות בגוגל'],
  ['old', 'נבדק בחיפוש הישן'],
];
const reasonLabel = (r: string | null) => REASONS.find(([k]) => k === (r ?? 'old'))?.[1] ?? r ?? '';

async function loadPage(page: number, reason: string, text: string): Promise<{ rows: Row[]; total: number }> {
  let f = '&source=eq.none';
  if (reason === 'old') f += '&reason=is.null';
  else if (reason) f += `&reason=eq.${reason}`;
  const t = text.trim();
  if (t) f += `&or=(title.ilike.*${encodeURIComponent(t)}*,author.ilike.*${encodeURIComponent(t)}*)`;
  const from = page * PAGE;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/book_covers?select=book_key,title,author,reason,query,google_id,google_title,google_authors,google_image${f}&order=updated_at.desc,book_key`,
    { headers: { apikey: SUPABASE_KEY, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items', Prefer: 'count=exact' }, cache: 'no-store' },
  );
  if (!res.ok && res.status !== 416) throw new Error(String(res.status));
  const total = Number((res.headers.get('content-range') || '').split('/')[1]) || 0;
  return { rows: res.status === 416 ? [] : ((await res.json()) as Row[]), total };
}

export default function CoverMisses() {
  const [page, setPage] = useState(0);
  const [reason, setReason] = useState('');
  const [text, setText] = useState('');
  const [applied, setApplied] = useState('');
  const [data, setData] = useState<{ rows: Row[]; total: number } | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = useCallback(() => {
    setData(null); setMsg(null);
    loadPage(page, reason, applied).then(setData).catch(() => setMsg({ ok: false, text: 'לא הצלחנו לטעון את הרשימה. נסו שוב.' }));
  }, [page, reason, applied]);
  useEffect(reload, [reload]);

  async function accept(r: Row) {
    if (!r.google_image || !r.google_id) return;
    setBusy(r.book_key); setMsg(null);
    try {
      await saveGoogleImage(
        { key: r.book_key, title: r.title || '', author: r.author || '' },
        { id: r.google_id, title: r.google_title || '', authors: r.google_authors || '', image: r.google_image },
        { reviewed: true, query: r.query },
      );
      setSaved((s) => new Set(s).add(r.book_key));
    } catch {
      setMsg({ ok: false, text: 'השמירה נכשלה. נסו שוב.' });
    } finally { setBusy(''); }
  }

  const rows = data?.rows ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <section className="panel stack">
      <div>
        <h2>ספרים בלי כריכה</h2>
        <p className="sub" style={{ margin: 0 }}>
          לכל ספר רואים מה חיפשנו בגוגל, מה גוגל החזיר ולמה לא נשמרה כריכה. אם התמונה של גוגל בכל זאת נכונה,
          אפשר לשמור אותה מכאן. הקישורים פותחים את הספר או את החיפוש בגוגל ספרים, כדי לבדוק ידנית.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={reason} onChange={(e) => { setPage(0); setReason(e.target.value); }} aria-label="סיבה">
          {REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied(text); }} style={{ display: 'flex', gap: 6 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="שם ספר או מחבר" aria-label="סינון לפי שם" />
          <button className="btn ghost" type="submit">סינון</button>
        </form>
        {data && <span className="sub" style={{ margin: 0 }}>{data.total.toLocaleString('he-IL')} ספרים</span>}
      </div>

      {msg && <p className={msg.ok ? 'msg ok' : 'msg err'} role="status">{msg.text}</p>}
      {!data && !msg && <p className="status">טוען…</p>}
      {data && rows.length === 0 && <p className="msg info">אין ספרים ברשימה הזו.</p>}

      {rows.length > 0 && (
        <ul className="miss-list">
          {rows.map((r) => {
            const done = saved.has(r.book_key);
            const q = encodeURIComponent(`${r.title || ''} ${r.author || ''}`.trim());
            return (
              <li key={r.book_key} className={done ? 'miss done' : 'miss'}>
                <div className="img">{r.google_image ? <img src={r.google_image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>אין תמונה</span>}</div>
                <div className="body">
                  <div><b>{r.title}</b> <span className="muted">· {r.author || 'מחבר לא ידוע'}</span></div>
                  <div><span className={`reason r-${r.reason ?? 'old'}`}>{reasonLabel(r.reason)}</span></div>
                  {r.query && <div className="muted">חיפשנו: <span dir="auto">{r.query}</span></div>}
                  {r.google_title && (
                    <div className="muted">גוגל החזיר: <span dir="auto">{r.google_title}</span>{r.google_authors ? <> · <span dir="auto">{r.google_authors}</span></> : null}</div>
                  )}
                  <div className="links">
                    {r.google_id && <a href={`https://books.google.com/books?id=${r.google_id}`} target="_blank" rel="noreferrer">הספר בגוגל ספרים</a>}
                    <a href={`https://www.google.com/search?tbm=bks&q=${q}`} target="_blank" rel="noreferrer">חיפוש ידני בגוגל ספרים</a>
                  </div>
                </div>
                <div className="acts">
                  {done ? <span className="muted">נשמרה ✓</span> : r.google_image && (
                    <button className="btn ghost" type="button" disabled={!!busy} onClick={() => accept(r)}>
                      {busy === r.book_key ? 'שומר…' : 'זו הכריכה, לשמור'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn ghost" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>הקודם</button>
          <span className="sub" style={{ margin: 0 }}>עמוד {page + 1} מתוך {pages}</span>
          <button className="btn ghost" type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>הבא</button>
        </div>
      )}
    </section>
  );
}
