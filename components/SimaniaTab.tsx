'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import './SimaniaTab.css';
import { supabase } from '@/lib/supabase';
import { coverUrl, fetchCoverRows } from '@/lib/covers';
import { loadUniqueBooks } from '@/lib/catalog-client';
import { listImportFiles } from '@/lib/simania';

const PAGE = 50;
const pct = (n: number, of: number) => `${of ? Math.round((n / of) * 100) : 0}%`;
const TAGS = ['תחרות', 'זול', 'יקר', 'מבוקש', 'בלעדי', 'ישן'];

const fmt = (s: string) => new Date(s).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' });
const fmtDay = (s: string) => new Date(s).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

function ago(s: string) {
  const days = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  if (days < 1) return 'היום';
  if (days < 2) return 'אתמול';
  if (days < 31) return `לפני ${days} ימים`;
  const months = Math.floor(days / 30.4);
  if (months < 12) return months === 1 ? 'לפני חודש' : `לפני ${months} חודשים`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'לפני שנה' : `לפני ${years} שנים`;
}

/** Google image search for "title" + "author" (quotes keep each name as one phrase). */
function googleImages(title: string | null, author: string | null) {
  const q = [title, author].map((x) => (x || '').replace(/["״]/g, '').trim()).filter(Boolean).map((x) => `"${x}"`).join(' + ');
  return `https://www.google.com/search?udm=2&q=${encodeURIComponent(q)}`;
}

interface Row {
  owned_id: number; book_key: string; simania_book_id: number | null; title: string | null; author: string | null; price: number | null;
  condition: string | null; simania_updated_at: string | null; tags: string[]; imported_at: string;
}

interface Stats { total: number; lastImport: string | null; byTag: Record<string, number>; ages: { label: string; n: number }[]; }

// Update-date periods: each copy is counted once, in the most recent period it falls in.
const PERIODS: [string, number][] = [
  ['ביום האחרון', 1], ['בשבוע האחרון', 7], ['בחודש האחרון', 30], ['בחצי השנה האחרונה', 182], ['בשנה האחרונה', 365],
];

async function loadStats(): Promise<Stats> {
  const sb = supabase();
  const head = () => sb.from('simania_items').select('owned_id', { count: 'exact', head: true });
  const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  const [all, last, ...rest] = await Promise.all([
    head(),
    sb.from('simania_items').select('imported_at').order('imported_at', { ascending: false }).limit(1),
    ...TAGS.map((t) => head().contains('tags', [t])),
    ...PERIODS.map(([, d]) => head().gte('simania_updated_at', since(d))),
  ]);
  const total = all.count ?? 0;
  const tagCounts = rest.slice(0, TAGS.length).map((r) => r.count ?? 0);
  const upTo = rest.slice(TAGS.length).map((r) => r.count ?? 0); // cumulative: updated within each period
  const ages = PERIODS.map(([label], i) => ({ label, n: upTo[i] - (i ? upTo[i - 1] : 0) }));
  ages.push({ label: 'לפני יותר משנה', n: total - (upTo[upTo.length - 1] ?? 0) });
  return {
    total,
    lastImport: (last.data?.[0] as { imported_at?: string } | undefined)?.imported_at ?? null,
    byTag: Object.fromEntries(TAGS.map((t, i) => [t, tagCounts[i]])),
    ages,
  };
}

export default function SimaniaTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [files, setFiles] = useState<{ name: string; created_at: string }[] | null>(null);

  // Filters live in the address (?tag=&q=&page=&nocover=1), so going back from a book link restores them.
  const params = useSearchParams();
  const [tag, setTag] = useState(params.get('tag') ?? '');
  const [text, setText] = useState(params.get('q') ?? '');
  const [applied, setApplied] = useState(params.get('q') ?? '');
  const [page, setPage] = useState(Math.max(0, Number(params.get('page') ?? 1) - 1) || 0);
  const [noCover, setNoCover] = useState(params.get('nocover') === '1');
  const [rows, setRows] = useState<{ list: Row[]; total: number } | null>(null);
  const [covers, setCovers] = useState<Map<string, string>>(new Map());
  const [coverStats, setCoverStats] = useState<{ books: number; withCover: number } | null>(null);

  useEffect(() => {
    loadStats().then(setStats).catch(() => setStats({ total: 0, lastImport: null, byTag: {}, ages: [] }));
    listImportFiles().then(setFiles).catch(() => setFiles([]));
  }, []);
  useEffect(() => {
    Promise.all([fetchCoverRows(true), loadUniqueBooks()]).then(([cv, books]) => {
      const m = new Map(cv.filter((r) => r.path).map((r) => [r.book_key, r.path as string]));
      setCovers(m);
      setCoverStats({ books: books.length, withCover: books.filter((b) => m.has(b.key)).length });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const u = new URL(window.location.href);
    const set = (k: string, v: string) => { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); };
    set('tag', tag); set('q', applied.trim()); set('page', page ? String(page + 1) : ''); set('nocover', noCover ? '1' : '');
    if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u.href);
  }, [tag, applied, page, noCover]);

  useEffect(() => {
    setRows(null);
    let q = supabase().from(noCover ? 'simania_items_nocover' : 'simania_items')
      .select('owned_id,book_key,simania_book_id,title,author,price,condition,simania_updated_at,tags,imported_at', { count: 'exact' })
      .order('simania_updated_at', { ascending: false, nullsFirst: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (tag) q = q.contains('tags', [tag]);
    const t = applied.trim().replace(/[,()*%]/g, ' ');
    if (t) q = q.or(`title.ilike.*${t}*,author.ilike.*${t}*`);
    q.then(({ data, count: n }) => setRows({ list: (data ?? []) as Row[], total: n ?? 0 }));
  }, [tag, applied, page, noCover]);

  const pages = rows ? Math.max(1, Math.ceil(rows.total / PAGE)) : 1;

  return (
    <>
      <section className="panel stack">
        <div>
          <h2>מצב הייבוא מסימניה</h2>
          <p className="sub" style={{ margin: 0 }}>
            לכל עותק נשמרים המחיר, המצב, תאריך העדכון האחרון בסימניה והתגיות שסימניה מציגה.
            ספרים שחסרים באתר נוספים למלאי, וספרים בלי כריכה מקבלים את הכריכה מסימניה.
          </p>
        </div>
        <div className="stats">
          <div className="stat"><b>{stats ? stats.total.toLocaleString('he-IL') : '…'}</b><span>עותקים מסימניה באתר</span></div>
          <div className="stat"><b style={{ fontSize: 16 }}>{stats?.lastImport ? fmt(stats.lastImport) : 'עדיין לא'}</b><span>ייבוא אחרון</span></div>
          {TAGS.filter((t) => stats?.byTag[t]).map((t) => (
            <div className="stat" key={t}><b>{stats!.byTag[t].toLocaleString('he-IL')}</b><span>{t}</span></div>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <h2>כריכות במלאי</h2>
        {!coverStats ? <p className="status" style={{ textAlign: 'start' }}>סופר…</p> : (
          <>
            <p style={{ margin: 0, fontSize: 15 }}>
              ל-<b>{coverStats.withCover.toLocaleString('he-IL')}</b> ספרים מתוך {coverStats.books.toLocaleString('he-IL')} ספרים שונים במלאי יש כריכה
              ({pct(coverStats.withCover, coverStats.books)}).
            </p>
            <div className="bar"><div style={{ width: pct(coverStats.withCover, coverStats.books) }} /></div>
            <p className="sub" style={{ margin: 0 }}>ספר שיש לו כמה עותקים נספר פעם אחת.</p>
          </>
        )}
      </section>

      <section className="panel stack">
        <h2>מתי עודכנו העותקים בסימניה</h2>
        {!stats ? <p className="status" style={{ textAlign: 'start' }}>סופר…</p> : stats.ages.length === 0 ? null : (
          <>
            <ul className="age-list">
              {stats.ages.map((a) => (
                <li key={a.label}>
                  <span className="lbl">{a.label}</span>
                  <span className="bar"><span style={{ width: pct(a.n, Math.max(...stats.ages.map((x) => x.n))) }} /></span>
                  <span className="num">{a.n.toLocaleString('he-IL')} <small>({pct(a.n, stats.total)})</small></span>
                </li>
              ))}
            </ul>
            <p className="sub" style={{ margin: 0 }}>כל עותק נספר פעם אחת, בתקופה הקצרה ביותר שבה הוא עודכן.</p>
          </>
        )}
      </section>

      <section className="panel stack">
        <h2>רשימות שנקראו מסימניה</h2>
        {!files ? <p className="status">טוען…</p> : files.length === 0 ? (
          <p className="msg info">עדיין לא נקראה רשימה מסימניה.</p>
        ) : (
          <>
            <ul className="sim-files">
              {files.map((f, i) => (
                <li key={f.name}>
                  <span>{fmt(f.created_at)}</span>
                  <span className="muted">{f.name.match(/-(\d+)\.json$/)?.[1] ? `${f.name.match(/-(\d+)\.json$/)![1]} עותקים` : ''}</span>
                  {i === 0 && <span className="current-tag">אחרונה</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel stack">
        <h2>עותקים לפי תאריך עדכון בסימניה</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={tag} onChange={(e) => { setPage(0); setTag(e.target.value); }} aria-label="תגית">
            <option value="">כל התגיות</option>
            {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <form onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied(text); }} style={{ display: 'flex', gap: 6 }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="שם ספר או מחבר" aria-label="סינון לפי שם" />
            <button className="btn ghost" type="submit">סינון</button>
          </form>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
            <input type="checkbox" checked={noCover} onChange={(e) => { setPage(0); setNoCover(e.target.checked); }} />
            רק ספרים בלי כריכה
          </label>
        </div>

        {!rows ? <p className="status">טוען…</p> : rows.list.length === 0 ? <p className="msg info">אין עותקים להצגה.</p> : (
          <ul className="sim-list">
            {rows.list.map((r) => (
              <li key={r.owned_id}>
                <Link className="img" href={`/admin/edit-books?book=${encodeURIComponent(r.book_key)}`} title="עריכת הספר והעלאת כריכה">
                  {covers.get(r.book_key) ? <img src={coverUrl(covers.get(r.book_key)!)} alt="" loading="lazy" /> : <span>אין כריכה</span>}
                </Link>
                <div className="body">
                  <Link href={`/admin/edit-books?book=${encodeURIComponent(r.book_key)}`}><b>{r.title}</b></Link>
                  <span className="muted">{r.author || 'מחבר לא ידוע'}</span>
                  <span>{r.price != null ? `${r.price} ₪` : ''}{r.condition ? ` · ${r.condition}` : ''}</span>
                  {r.simania_updated_at && <span className="muted">עודכן {fmtDay(r.simania_updated_at)} ({ago(r.simania_updated_at)})</span>}
                  <span className="tags-row">{r.tags.map((t) => <span key={t} className={`stag stag-${t}`}>{t}</span>)}</span>
                  <span className="ext-links">
                    {r.simania_book_id && (
                      <a className="ext" href={`https://simania.co.il/bookdetails.php?item_id=${r.simania_book_id}`} target="_blank" rel="noreferrer">לעמוד הספר בסימניה ↗</a>
                    )}
                    <a className="ext" href={googleImages(r.title, r.author)} target="_blank" rel="noreferrer">חיפוש הספר בגוגל ↗</a>
                  </span>
                </div>
              </li>
            ))}
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
    </>
  );
}
