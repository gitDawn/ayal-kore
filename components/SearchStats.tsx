'use client';

// Staff tab: what visitors searched for, and what they searched for and did not find.
import { useEffect, useMemo, useState } from 'react';
import { fetchSearchStats, type SearchStat } from '@/lib/searchLog';

const PERIODS: [number, string][] = [[7, 'שבוע'], [30, 'חודש'], [90, 'שלושה חודשים'], [365, 'שנה']];
const fmt = (s: string) => new Date(s).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

export default function SearchStats() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<SearchStat[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    setRows(null); setErr('');
    fetchSearchStats(days)
      .then((r) => { if (live) setRows(r); })
      .catch(() => { if (live) { setRows([]); setErr('לא הצלחנו לטעון את נתוני החיפוש.'); } });
    return () => { live = false; };
  }, [days]);

  const total = useMemo(() => (rows ?? []).reduce((a, r) => a + Number(r.searches), 0), [rows]);
  const missing = useMemo(() => (rows ?? []).filter((r) => r.last_results === 0), [rows]);

  return (
    <>
      <section className="panel stack">
        <h2>חיפושים באתר</h2>
        <p className="sub" style={{ margin: 0 }}>
          מה מבקרים חיפשו בקטלוג. נשמר רק טקסט החיפוש ומספר התוצאות, בלי שום פרט על המבקר.
        </p>
        <div className="chips" role="group" aria-label="תקופה" style={{ justifyContent: 'flex-start', margin: 0 }}>
          {PERIODS.map(([d, label]) => (
            <button key={d} type="button" className="chip" aria-pressed={days === d} onClick={() => setDays(d)}>{label} אחרון</button>
          ))}
        </div>
        {err && <p className="msg err" role="alert">{err}</p>}
        {rows && !err && (
          <div className="stats">
            <div className="stat"><b>{total.toLocaleString('he-IL')}</b><span>חיפושים</span></div>
            <div className="stat"><b>{rows.length.toLocaleString('he-IL')}</b><span>חיפושים שונים</span></div>
            <div className="stat"><b>{missing.length.toLocaleString('he-IL')}</b><span>בלי תוצאות</span></div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>חיפשו ולא מצאו</h2>
        <p className="sub">ספרים שמבקרים חיפשו ואין במלאי (לפי החיפוש האחרון). רעיון טוב לרכישה.</p>
        <Table rows={missing} loading={!rows} empty="אין חיפושים בלי תוצאות בתקופה הזו." showResults={false} />
      </section>

      <section className="panel">
        <h2>החיפושים הנפוצים</h2>
        <Table rows={rows ?? []} loading={!rows} empty="עדיין אין חיפושים בתקופה הזו." showResults />
      </section>
    </>
  );
}

function Table({ rows, loading, empty, showResults }: { rows: SearchStat[]; loading: boolean; empty: string; showResults: boolean }) {
  if (loading) return <p className="status">טוען…</p>;
  if (!rows.length) return <p className="msg info">{empty}</p>;
  return (
    <div className="scroll-x">
      <table className="mini">
        <thead>
          <tr><th>חיפוש</th><th>פעמים</th>{showResults && <th>תוצאות</th>}<th>לאחרונה</th></tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((r) => (
            <tr key={r.q}>
              <td dir="auto">{r.q}</td>
              <td>{Number(r.searches).toLocaleString('he-IL')}</td>
              {showResults && <td>{r.last_results.toLocaleString('he-IL')}</td>}
              <td>{fmt(r.last_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
