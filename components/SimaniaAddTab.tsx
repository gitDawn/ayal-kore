'use client';

// Staff tab "הוספה לסימניה": photos or a video of books → recognized titles → matched to
// Simania's catalog → added to the store's stock on Simania, after staff check each book.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import './SimaniaSync.css';
import './SimaniaAdd.css';
import './BookEditor.css';
import { scanImages, scanVideo, type ScanBook } from '@/lib/videoFrames';
import { CONDITIONS, SimaniaBridge, fit, queriesFor, suggestPrice, type CatalogBook } from '@/lib/simania-bridge';

type Status = 'new' | 'searching' | 'ready' | 'nomatch' | 'owned' | 'adding' | 'added' | 'failed';

interface Row {
  key: number;
  title: string;
  author: string;
  copies: number;
  inSite: string | null;          // a matching book already on the site, for information
  include: boolean;
  candidates: CatalogBook[];
  chosen: number | null;          // bookId on Simania
  condition: number;
  price: string;
  status: Status;
  error?: string;
}

const nf = (n: number) => n.toLocaleString('he-IL');
let nextKey = 1;

export default function SimaniaAddTab() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [model, setModel] = useState('');
  const [condition, setCondition] = useState(4);
  const [connected, setConnected] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [done, setDone] = useState<{ added: number; failed: number } | null>(null);
  const bridge = useRef<SimaniaBridge | null>(null);
  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;

  useEffect(() => { bridge.current = new SimaniaBridge(); return () => bridge.current?.dispose(); }, []);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const video = files.length === 1 && files[0].type.startsWith('video/');
  const pickedOk = files.length > 0 && (video || files.every((f) => f.type.startsWith('image/')));

  async function recognize() {
    setError(''); setDone(null); setBusy('מתחיל…');
    try {
      const res = video ? await scanVideo(files[0], setBusy, 'shelf') : await scanImages(files, setBusy);
      setModel(res.model);
      const found: Row[] = res.books.map((b: ScanBook) => ({
        key: nextKey++, title: b.title, author: b.author || '', copies: b.copies || 1,
        inSite: b.matches?.[0] && b.matches[0].score >= 0.75 ? `${b.matches[0].title}${b.matches[0].inStock ? '' : ' (לא במלאי)'}` : null,
        include: true, candidates: [], chosen: null, condition, price: '', status: 'new',
      }));
      setRows(found);
      if (!found.length) setError('לא זוהו ספרים. נסו תמונה חדה יותר, או קרובה יותר לספרים.');
      if (connected) void searchAll(found);
    } catch (e) {
      setError((e as Error).message || 'הזיהוי לא הצליח.');
    } finally { setBusy(''); }
  }

  async function searchOne(r: Row) {
    const b = bridge.current;
    if (!b?.connected) return;
    update(r.key, { status: 'searching', error: undefined });
    try {
      // Try the queries in turn until one finds a close enough match; keep every result for the list.
      const byId = new Map<number, CatalogBook>();
      for (const q of queriesFor(r.title, r.author)) {
        for (const c of await b.search(q)) byId.set(c.bookId, c);
        if ([...byId.values()].some((c) => fit(r.title, r.author, c) >= 0.6)) break;
      }
      const found = [...byId.values()];
      const ranked = found.map((c) => ({ c, s: fit(r.title, r.author, c) })).sort((x, y) => y.s - x.s);
      const best = ranked[0] && ranked[0].s >= 0.45 ? ranked[0].c : null;
      update(r.key, {
        candidates: ranked.slice(0, 6).map((x) => x.c),
        chosen: best?.bookId ?? null,
        price: best ? String(suggestPrice(best) ?? '') : '',
        status: !best ? 'nomatch' : best.owned ? 'owned' : 'ready',
        include: !!best && !best.owned,
      });
    } catch (e) {
      update(r.key, { status: 'failed', error: (e as Error).message === 'not connected' ? 'סימניה לא מחוברת' : 'החיפוש בסימניה לא הצליח' });
    }
  }

  async function searchAll(list = rowsRef.current) {
    for (const r of list) {
      if (r.status === 'added') continue;
      await searchOne(rowsRef.current.find((x) => x.key === r.key) ?? r);
    }
  }

  function connect() {
    setWaiting(true);
    bridge.current?.open(() => {
      setWaiting(false); setConnected(true);
      void searchAll();
    });
  }

  function choose(r: Row, bookId: number | null) {
    const c = r.candidates.find((x) => x.bookId === bookId) ?? null;
    update(r.key, {
      chosen: bookId, price: c ? String(suggestPrice(c) ?? r.price) : r.price,
      status: !c ? 'nomatch' : c.owned ? 'owned' : 'ready', include: !!c && !c.owned,
    });
  }

  const ready = rows.filter((r) => r.include && r.chosen && Number(r.price) > 0 && r.status !== 'added');
  const missingPrice = rows.filter((r) => r.include && r.chosen && !(Number(r.price) > 0)).length;

  async function addAll() {
    const b = bridge.current;
    if (!b?.connected || !ready.length) return;
    if (!window.confirm(`להוסיף ${ready.length} ספרים למלאי של החנות בסימניה?`)) return;
    setError(''); setBusy('מוסיף לסימניה…');
    for (const r of ready) update(r.key, { status: 'adding' });
    try {
      const results = await b.add(ready.map((r) => ({ bookId: r.chosen!, price: Number(r.price), condition: r.condition })));
      let added = 0, failed = 0;
      for (const r of ready) {
        const res = results.find((x) => x.bookId === r.chosen);
        if (res?.ok) { added++; update(r.key, { status: 'added', include: false }); }
        else { failed++; update(r.key, { status: 'failed', error: res?.error || `סימניה החזירה שגיאה ${res?.status ?? ''}` }); }
      }
      setDone({ added, failed });
    } catch {
      setError('ההוספה לא הצליחה. בדקו שהלשונית של סימניה עדיין פתוחה.');
      for (const r of ready) update(r.key, { status: 'ready' });
    } finally { setBusy(''); }
  }

  function addManual() {
    setRows((rs) => [...rs, { key: nextKey++, title: '', author: '', copies: 1, inSite: null, include: true, candidates: [], chosen: null, condition, price: '', status: 'new' }]);
  }

  return (
    <>
      <section className="panel stack">
        <div>
          <h2>הוספת ספרים לסימניה מתמונה או סרטון</h2>
          <p className="sub" style={{ margin: 0 }}>
            מעלים תמונות של ספרים (על שולחן, בערימה או על מדף) או סרטון קצר. הספרים מזוהים, נמצאים בקטלוג של סימניה,
            ואחרי שבודקים מחיר ומצב לכל ספר, הם נוספים למלאי של החנות בסימניה. כלום לא נוסף בלי אישור.
          </p>
        </div>

        <ol className="sim-steps">
          <li>
            בחרו תמונות (אפשר כמה) או סרטון אחד:{' '}
            <input type="file" accept="image/*,video/*" multiple disabled={!!busy}
              onChange={(e) => { setFiles([...(e.target.files ?? [])]); setRows([]); setDone(null); setError(''); }} />
            {files.length > 0 && !pickedOk && <span className="msg err" style={{ display: 'block', marginTop: 6 }}>אפשר לבחור כמה תמונות, או סרטון אחד בלבד.</span>}
          </li>
          <li>
            <button className="btn dark" type="button" disabled={!pickedOk || !!busy} onClick={recognize}>זיהוי ספרים</button>
            {model && !busy && <span className="muted"> (זוהה בעזרת {model})</span>}
          </li>
          <li>
            {connected ? (
              <span className="msg ok" style={{ display: 'inline-block' }}>סימניה מחוברת ✓</span>
            ) : (
              <>
                <button className="btn" type="button" onClick={connect} disabled={!!busy}>חיבור לסימניה</button>
                <span className="muted"> נפתחת לשונית של סימניה. לוחצים בה על הסימנייה &quot;קריאת מלאי מסימניה&quot; בסרגל הסימניות, ומשאירים אותה פתוחה.</span>
                {waiting && <span className="msg info" style={{ display: 'block', marginTop: 6 }}>ממתין לחיבור מהלשונית של סימניה…</span>}
              </>
            )}
          </li>
        </ol>

        {busy && <p className="status" style={{ textAlign: 'start' }}>{busy}</p>}
        {error && <p className="msg err">{error}</p>}
      </section>

      {rows.length > 0 && (
        <section className="panel stack">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>ספרים שזוהו ({nf(rows.length)})</h2>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
              מצב ברירת מחדל:
              <select value={condition} onChange={(e) => {
                const c = Number(e.target.value);
                setCondition(c);
                setRows((rs) => rs.map((r) => (r.status === 'added' ? r : { ...r, condition: c })));
              }}>
                {CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          {!connected && <p className="msg info" style={{ margin: 0 }}>כדי למצוא את הספרים בקטלוג של סימניה ולקבל הצעת מחיר, חברו את סימניה (שלב 3).</p>}

          <ul className="add-list">
            {rows.map((r) => {
              const c = r.candidates.find((x) => x.bookId === r.chosen) ?? null;
              const locked = r.status === 'added' || r.status === 'adding';
              return (
                <li key={r.key} className={`add-row s-${r.status}${r.include ? '' : ' off'}`}>
                  <input type="checkbox" aria-label="לכלול" checked={r.include} disabled={locked || !r.chosen || r.status === 'owned'}
                    onChange={(e) => update(r.key, { include: e.target.checked })} />
                  <div className="add-cover">{c?.cover ? <img src={c.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>אין תמונה</span>}</div>
                  <div className="add-body">
                    <div className="add-found">
                      <input value={r.title} placeholder="שם הספר" disabled={locked} onChange={(e) => update(r.key, { title: e.target.value })} />
                      <input value={r.author} placeholder="מחבר" disabled={locked} onChange={(e) => update(r.key, { author: e.target.value })} />
                      <button className="btn ghost" type="button" disabled={!connected || locked || !r.title.trim()} onClick={() => searchOne(r)}>חיפוש בסימניה</button>
                    </div>
                    {r.candidates.length > 0 && (
                      <select value={r.chosen ?? ''} disabled={locked} onChange={(e) => choose(r, e.target.value ? Number(e.target.value) : null)}>
                        {r.candidates.map((x) => (
                          <option key={x.bookId} value={x.bookId}>
                            {x.title}{x.author ? ` · ${x.author}` : ''}{x.year ? ` · ${x.year}` : ''}{x.publisher ? ` · ${x.publisher}` : ''}{x.owned ? ' (כבר במלאי)' : ''}
                          </option>
                        ))}
                        <option value="">אף אחד מאלה</option>
                      </select>
                    )}
                    <div className="add-tags">
                      {r.copies > 1 && <span className="stag">נראו {r.copies} עותקים</span>}
                      {r.inSite && <span className="stag">כבר באתר: {r.inSite}</span>}
                      {r.status === 'searching' && <span className="stag">מחפש בסימניה…</span>}
                      {r.status === 'nomatch' && <span className="stag stag-יקר">לא נמצא בקטלוג של סימניה</span>}
                      {r.status === 'owned' && <span className="stag stag-מבוקש">כבר במלאי בסימניה</span>}
                      {r.status === 'added' && <span className="stag stag-זול">נוסף לסימניה ✓</span>}
                      {r.status === 'failed' && <span className="stag stag-יקר">{r.error || 'נכשל'}</span>}
                      {c && (c.avg != null || c.min != null) && (
                        <span className="stag">מחיר שוק: {c.min ?? '?'}–{c.max ?? '?'} ₪{c.sellers ? `, ${c.sellers} מוכרים` : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="add-sale">
                    <select value={r.condition} disabled={locked} onChange={(e) => update(r.key, { condition: Number(e.target.value) })} aria-label="מצב">
                      {CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <label className="add-price">
                      <input type="number" min={1} inputMode="numeric" value={r.price} disabled={locked}
                        onChange={(e) => update(r.key, { price: e.target.value })} aria-label="מחיר" /> ₪
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn dark" type="button" disabled={!connected || !ready.length || !!busy} onClick={addAll}>
              הוספה לסימניה ({nf(ready.length)} ספרים)
            </button>
            <button className="btn ghost" type="button" disabled={!!busy} onClick={addManual}>+ ספר שלא זוהה</button>
            {missingPrice > 0 && <span className="muted" style={{ fontSize: 13 }}>ל־{missingPrice} ספרים חסר מחיר, והם לא יתווספו עד שיהיה.</span>}
          </div>

          {done && (
            <p className={done.failed ? 'msg err' : 'msg ok'}>
              נוספו לסימניה {nf(done.added)} ספרים{done.failed ? `, ו־${nf(done.failed)} לא נוספו (הסיבה מופיעה ליד כל ספר)` : ''}.
              כדי שיופיעו גם באתר, עם הכריכה מסימניה, הריצו <Link href="/admin/simania">עדכון מסימניה</Link> עם &quot;יום&quot;.
            </p>
          )}
        </section>
      )}
    </>
  );
}
