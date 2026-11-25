'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './CoverReview.css';
import { SUPABASE_KEY, SUPABASE_URL, supabase } from '@/lib/supabase';
import { coverUrl, markNoCover } from '@/lib/covers';
import { rotateCover } from '@/lib/rotate';

interface Row { book_key: string; title: string | null; author: string | null; path: string; reviewed: boolean; suspect: string | null; }

const PAGE = 60;

async function loadPage(page: number, showReviewed: boolean, onlyWhite: boolean): Promise<{ rows: Row[]; total: number }> {
  const filter = (showReviewed ? '' : '&reviewed=eq.false') + (onlyWhite ? '&suspect=not.is.null' : '');
  const from = page * PAGE;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/book_covers?select=book_key,title,author,path,reviewed,suspect&source=eq.google&path=not.is.null${filter}&order=updated_at.desc,book_key`,
    { headers: { apikey: SUPABASE_KEY, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items', Prefer: 'count=exact' }, cache: 'no-store' },
  );
  if (!res.ok && res.status !== 416) throw new Error(String(res.status));
  const total = Number((res.headers.get('content-range') || '').split('/')[1]) || 0;
  return { rows: res.status === 416 ? [] : ((await res.json()) as Row[]), total };
}

// Covers waiting for review that the import flagged as a possible inside page (from before such
// pictures were rejected automatically).
const INNER_FILTER = 'source=eq.google&path=not.is.null&reviewed=eq.false&suspect=ilike.*white*';

async function countInner(): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/book_covers?select=book_key&${INNER_FILTER}`,
    { headers: { apikey: SUPABASE_KEY, Range: '0-0', 'Range-Unit': 'items', Prefer: 'count=exact' }, cache: 'no-store' });
  if (!res.ok && res.status !== 416) throw new Error(String(res.status));
  return Number((res.headers.get('content-range') || '').split('/')[1]) || 0;
}

interface InnerRow {
  book_key: string; title: string | null; author: string | null; path: string; query: string | null;
  google_id: string | null; google_title: string | null; google_authors: string | null; google_image: string | null;
}

/** Move every flagged cover to the books without a cover, as "inside page", keeping Google's picture so it can be restored. */
async function rejectAllInner(onProgress: (done: number) => void): Promise<number> {
  let done = 0;
  for (let round = 0; round < 200; round++) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/book_covers?select=book_key,title,author,path,query,google_id,google_title,google_authors,google_image&${INNER_FILTER}&order=book_key&limit=100`,
      { headers: { apikey: SUPABASE_KEY }, cache: 'no-store' },
    );
    if (!res.ok) throw new Error(String(res.status));
    const rows = (await res.json()) as InnerRow[];
    if (!rows.length) break;
    for (const r of rows) {
      await markNoCover({ key: r.book_key, title: r.title || '', author: r.author || '' }, 'none', {
        reason: 'inner', query: r.query, google_id: r.google_id, google_title: r.google_title,
        google_authors: r.google_authors, google_image: r.google_image,
      }, r.path);
      onProgress(++done);
    }
  }
  return done;
}

/** Rows for specific books (covers just saved by a running import). */
async function loadRows(keys: string[]): Promise<Row[]> {
  const list = keys.map((k) => `"${k.replace(/"/g, '\\"')}"`).join(',');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/book_covers?select=book_key,title,author,path,reviewed,suspect&source=eq.google&path=not.is.null&book_key=in.(${encodeURIComponent(list)})`,
    { headers: { apikey: SUPABASE_KEY }, cache: 'no-store' },
  );
  return res.ok ? ((await res.json()) as Row[]) : [];
}

export default function CoverReview({ onOpenBook, fresh = [] }: {
  onOpenBook?: (bookKey: string) => void;
  /** Books whose cover was just saved by the running import, newest last: shown at the top of the first page. */
  fresh?: string[];
}) {
  const [page, setPage] = useState(0);
  const [showReviewed, setShowReviewed] = useState(false);
  const [onlyWhite, setOnlyWhite] = useState(false);
  const [data, setData] = useState<{ rows: Row[]; total: number } | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inner, setInner] = useState(0);
  useEffect(() => { countInner().then(setInner).catch(() => setInner(0)); }, [data]);

  async function rejectInner() {
    if (!window.confirm(`לפסול ${inner} כריכות שסומנו "אולי עמוד פנימי"? הן יעברו לספרים בלי כריכה, ואפשר יהיה להחזיר כל אחת משם.`)) return;
    setBusy('inner'); setMsg(null);
    try {
      const n = await rejectAllInner((d) => setMsg({ ok: true, text: `פוסל עמודים פנימיים: ${d} מתוך ${inner}…` }));
      setMsg({ ok: true, text: `${n} כריכות נפסלו כעמוד פנימי ועברו לספרים בלי כריכה.` });
    } catch {
      setMsg({ ok: false, text: 'הפסילה נעצרה באמצע בגלל שגיאה. לחצו שוב כדי להמשיך מאותה נקודה.' });
    } finally {
      setBusy('');
      reload(page, showReviewed, onlyWhite);
    }
  }

  const reload = useCallback((p: number, all: boolean, white: boolean) => {
    setData(null); setRemoved(new Set());
    loadPage(p, all, white).then(setData).catch(() => setMsg({ ok: false, text: 'לא הצלחנו לטעון את הכריכות. נסו שוב.' }));
  }, []);
  useEffect(() => { reload(page, showReviewed, onlyWhite); }, [page, showReviewed, onlyWhite, reload]);

  // Add covers saved by the running import to the top of the first page as they arrive.
  const shown = useRef(0);
  useEffect(() => {
    if (fresh.length <= shown.current) { shown.current = Math.min(shown.current, fresh.length); return; }
    const keys = fresh.slice(shown.current);
    shown.current = fresh.length;
    if (page !== 0) return;
    loadRows(keys).then((got) => {
      const add = got.filter((r) => (!onlyWhite || r.suspect) && (showReviewed || !r.reviewed));
      if (!add.length) return;
      const order = new Map(keys.map((k, i) => [k, i]));
      add.sort((a, b) => (order.get(b.book_key) ?? 0) - (order.get(a.book_key) ?? 0));
      setData((d) => {
        if (!d) return d;
        const have = new Set(d.rows.map((r) => r.book_key));
        const extra = add.filter((r) => !have.has(r.book_key));
        return { rows: [...extra, ...d.rows], total: d.total + extra.length };
      });
    }).catch(() => {});
  }, [fresh, page, onlyWhite, showReviewed]);

  async function remove(r: Row) {
    setBusy(r.book_key); setMsg(null);
    try {
      await markNoCover({ key: r.book_key, title: r.title || '', author: r.author || '' }, 'removed', {}, r.path);
      setRemoved((s) => new Set(s).add(r.book_key));
    } catch {
      setMsg({ ok: false, text: 'ההסרה נכשלה. נסו שוב.' });
    } finally { setBusy(''); }
  }

  async function rotate(r: Row) {
    setBusy(r.book_key + ':rot'); setMsg(null);
    try {
      const path = await rotateCover(r.book_key, r.path);
      setData((d) => d && { ...d, rows: d.rows.map((x) => (x.book_key === r.book_key ? { ...x, path } : x)) });
    } catch {
      setMsg({ ok: false, text: 'הסיבוב נכשל. נסו שוב.' });
    } finally { setBusy(''); }
  }

  async function markReviewed(keys: string[]) {
    if (!keys.length) return;
    setBusy('page'); setMsg(null);
    const { error } = await supabase().from('book_covers').update({ reviewed: true }).in('book_key', keys);
    setBusy('');
    if (error) { setMsg({ ok: false, text: 'השמירה נכשלה. נסו שוב.' }); return; }
    setMsg({ ok: true, text: `${keys.length} כריכות סומנו כמתאימות.` });
    if (showReviewed) setData((d) => d && { ...d, rows: d.rows.map((r) => keys.includes(r.book_key) ? { ...r, reviewed: true } : r) });
    else reload(page, false, onlyWhite);
  }

  const rows = data?.rows ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  const pending = rows.filter((r) => !removed.has(r.book_key) && !r.reviewed).map((r) => r.book_key);

  return (
    <section className="panel stack">
      <div>
        <h2>בדיקת כריכות מגוגל</h2>
        <p className="sub" style={{ margin: 0 }}>
          מתחת לכל תמונה מופיעים השם והמחבר כפי שהם במלאי. מסירים את הכריכות שלא מתאימות,
          ואז לוחצים &quot;כל השאר מתאימות&quot; כדי לסמן את העמוד כנבדק ולעבור לבאות.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={showReviewed} onChange={(e) => { setPage(0); setShowReviewed(e.target.checked); }} />
          להציג גם כריכות שכבר נבדקו
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={onlyWhite} onChange={(e) => { setPage(0); setOnlyWhite(e.target.checked); }} />
          רק כריכות שסומנו לבדיקה
        </label>
        {data && <span className="sub" style={{ margin: 0 }}>{data.total.toLocaleString('he-IL')} כריכות {showReviewed ? 'בסך הכול' : 'מחכות לבדיקה'}</span>}
        {inner > 0 && (
          <button className="btn ghost danger" type="button" disabled={!!busy} onClick={rejectInner}>
            {busy === 'inner' ? 'פוסל…' : `פסילת כל המסומנות "אולי עמוד פנימי" (${inner.toLocaleString('he-IL')})`}
          </button>
        )}
      </div>

      {msg && <p className={msg.ok ? 'msg ok' : 'msg err'} role="status">{msg.text}</p>}
      {!data && !msg && <p className="status">טוען…</p>}
      {data && rows.length === 0 && <p className="msg info">אין כריכות לבדיקה כרגע.</p>}

      {rows.length > 0 && (
        <div className="review-grid">
          {rows.map((r) => {
            const gone = removed.has(r.book_key);
            return (
              <figure key={r.book_key} className={gone ? 'review-card gone' : r.reviewed ? 'review-card ok' : 'review-card'}>
                <div className="img">{gone ? <span>הוסרה</span> : (
                  <button type="button" className="cover-link" title={`${r.title ?? ''}: פתיחה בעריכת ספרים`} onClick={() => onOpenBook?.(r.book_key)}>
                    <img src={coverUrl(r.path)} alt="" loading="lazy" />
                  </button>
                )}</div>
                <figcaption>
                  {r.suspect?.includes('white') && <span className="flag">אולי עמוד פנימי</span>}
                  {r.suspect?.includes('title-only') && <span className="flag">נמצא לפי השם בלבד, לבדוק מחבר</span>}
                  <b>{r.title}</b>
                  <span>{r.author || 'מחבר לא ידוע'}</span>
                </figcaption>
                {!gone && (
                  <div className="acts">
                    {!r.reviewed && (
                      <button type="button" className="btn ghost" disabled={!!busy} onClick={() => markReviewed([r.book_key])}>מתאימה</button>
                    )}
                    <button type="button" className="btn ghost" disabled={!!busy} onClick={() => rotate(r)} title="סיבוב התמונה ב-180 מעלות">
                      {busy === r.book_key + ':rot' ? '…' : 'סיבוב 180°'}
                    </button>
                    <button type="button" className="btn ghost danger" disabled={!!busy} onClick={() => remove(r)}>
                      {busy === r.book_key ? '…' : 'הסרה'}
                    </button>
                  </div>
                )}
              </figure>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {pending.length > 0 && (
            <button className="btn dark" type="button" disabled={!!busy} onClick={() => markReviewed(pending)}>
              {busy === 'page' ? 'שומר…' : `כל השאר מתאימות (${pending.length})`}
            </button>
          )}
          {pages > 1 && (
            <>
              <button className="btn ghost" type="button" disabled={page === 0 || !!busy} onClick={() => setPage(page - 1)}>הקודם</button>
              <span className="sub" style={{ margin: 0 }}>עמוד {page + 1} מתוך {pages}</span>
              <button className="btn ghost" type="button" disabled={page >= pages - 1 || !!busy} onClick={() => setPage(page + 1)}>הבא</button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
