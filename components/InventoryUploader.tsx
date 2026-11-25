'use client';

// Staff tab "עדכון מלאי": upload the store's CSV, see what changes, publish, and manage versions.
// Books missing from a new file are kept and marked out of stock, so their covers and edits stay.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { BUCKET, publicFileUrl, supabase, type InventoryVersion } from '@/lib/supabase';
import {
  CAT, COLUMNS, COND, P,
  decodeSnapshot, encodeSnapshot, inStock, toCsv, toRows,
  type BookRow, type ParsedInventory, type Snapshot,
} from '@/lib/inventory';
import { addStock, replaceStock, type StockChange } from '@/lib/stock';
import { refreshCatalog } from '@/app/actions';

function friendly(err: unknown): string {
  const msg = (err as { message?: string })?.message || '';
  if (/row-level security|violates|permission|unauthorized|403/i.test(msg)) {
    return 'החשבון הזה לא מורשה לעדכן את המלאי.';
  }
  if (/jwt|expired|session/i.test(msg)) return 'פג תוקף ההתחברות. התחברו מחדש ונסו שוב.';
  if (/fetch|network/i.test(msg)) return 'אין חיבור לשרת כרגע. נסו שוב בעוד דקה.';
  return 'משהו השתבש. נסו שוב.';
}

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' }) : '';

// ── Upload & publish ──

type Mode = 'replace' | 'add';
interface Parsed extends ParsedInventory { fileName: string; }

async function listVersions(): Promise<InventoryVersion[]> {
  const { data, error } = await supabase()
    .from('inventory_versions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as InventoryVersion[];
}

async function downloadSnapshot(v: InventoryVersion): Promise<Snapshot> {
  const res = await fetch(publicFileUrl(v.file_path), { cache: 'no-store' });
  if (!res.ok) throw new Error(`download ${res.status}`);
  return decodeSnapshot(await res.arrayBuffer());
}

export default function Uploader() {
  const [versions, setVersions] = useState<InventoryVersion[] | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [parseErr, setParseErr] = useState('');
  const [mode, setMode] = useState<Mode>('replace');
  const [note, setNote] = useState('');
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [over, setOver] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [prev, setPrev] = useState<{ id: string; rows: BookRow[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    listVersions().then(setVersions).catch(() => setVersions([]));
  }, []);
  useEffect(reload, [reload]);

  const current = versions?.[0] ?? null;

  // Load the current inventory once a file is chosen, to show what will change before publishing.
  useEffect(() => {
    if (!parsed || !current || prev?.id === current.id) return;
    let live = true;
    downloadSnapshot(current).then((s) => { if (live) setPrev({ id: current.id, rows: s.rows }); }).catch(() => {});
    return () => { live = false; };
  }, [parsed, current, prev?.id]);

  const change: StockChange | null = useMemo(() => {
    if (!parsed || !current || prev?.id !== current.id) return null;
    return (mode === 'add' ? addStock : replaceStock)(prev.rows, parsed.rows);
  }, [parsed, current, prev, mode]);

  function readFile(file: File) {
    setParsed(null); setParseErr(''); setResult(null); setStep(-1);
    if (!/\.csv$/i.test(file.name)) { setParseErr('יש לבחור קובץ CSV (סיומת ‎.csv).'); return; }
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (res) => {
        const headers = res.meta.fields ?? [];
        const p = toRows(res.data, headers);
        if (p.missingColumns.length) {
          setParseErr(`חסרות עמודות בקובץ: ${p.missingColumns.join(', ')}. העמודות הנדרשות: ${COLUMNS.join(', ')}.`);
          return;
        }
        if (!p.rows.length) { setParseErr('לא נמצאו שורות תקינות בקובץ.'); return; }
        setParsed({ ...p, fileName: file.name });
      },
      error: () => setParseErr('לא הצלחנו לקרוא את הקובץ. ודאו שהוא שמור כ-CSV בקידוד UTF-8.'),
    });
  }

  async function publish() {
    if (!parsed) return;
    setResult(null);
    const sb = supabase();
    try {
      let rows: BookRow[] = parsed.rows;
      let inCount = parsed.rows.length;
      let summary = '';
      if (current) {
        setStep(0);
        const before = prev?.id === current.id ? prev.rows : (await downloadSnapshot(current)).rows;
        const ch = (mode === 'add' ? addStock : replaceStock)(before, parsed.rows);
        rows = ch.rows;
        inCount = ch.inStock;
        summary = `נוספו ${ch.added}, חזרו למלאי ${ch.returned}` + (mode === 'replace' ? `, סומנו "לא במלאי" ${ch.gone}` : '') + '. ';
      }
      setStep(1);
      const snap: Snapshot = { columns: [...COLUMNS], rows, createdAt: new Date().toISOString(), sourceFileName: parsed.fileName };
      const blob = await encodeSnapshot(snap);
      setStep(2);
      const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json.gz`;
      const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'application/gzip', upsert: false });
      if (up.error) throw up.error;
      setStep(3);
      const noteText = (mode === 'add' ? `הוספה של ${parsed.rows.length} ספרים. ` : '') + summary + note.trim();
      const ins = await sb.from('inventory_versions').insert({
        file_path: path,
        row_count: inCount,
        source_file_name: parsed.fileName,
        note: noteText || null,
      });
      if (ins.error) {
        await sb.storage.from(BUCKET).remove([path]);
        throw ins.error;
      }
      setStep(4);
      await refreshCatalog().catch(() => {});
      setStep(5);
      setResult({ ok: true, text: `המלאי עודכן: ${inCount.toLocaleString('he-IL')} ספרים במלאי באתר.` });
      setParsed(null); setNote('');
      if (inputRef.current) inputRef.current.value = '';
      reload();
    } catch (e) {
      setResult({ ok: false, text: friendly(e) });
      setStep(-1);
    }
  }

  async function restore(v: InventoryVersion) {
    setBusyRow(v.id); setResult(null);
    try {
      const { error } = await supabase().from('inventory_versions').insert({
        file_path: v.file_path,
        row_count: v.row_count,
        source_file_name: v.source_file_name,
        note: `שחזור של הגרסה מ-${fmtDate(v.created_at)}`,
      });
      if (error) throw error;
      await refreshCatalog().catch(() => {});
      setResult({ ok: true, text: 'הגרסה שוחזרה והיא עכשיו המלאי באתר.' });
      reload();
    } catch (e) {
      setResult({ ok: false, text: friendly(e) });
    } finally {
      setBusyRow(null);
    }
  }

  async function exportCsv(v: InventoryVersion) {
    setBusyRow(v.id + ':csv'); setResult(null);
    try {
      const s = await downloadSnapshot(v);
      const blob = new Blob([toCsv(s.rows.filter(inStock))], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `inventory-${(v.created_at || '').slice(0, 10) || 'current'}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      setResult({ ok: false, text: friendly(e) });
    } finally {
      setBusyRow(null);
    }
  }

  const steps = ['השוואה למלאי הקיים', 'הכנת הקובץ', 'העלאה לשרת', 'שמירת הגרסה', 'רענון האתר'];
  const working = step >= 0 && step < 5;

  return (
    <>
      <section className="panel">
        <h2>העלאת קובץ מלאי</h2>
        <p className="sub">
          קובץ CSV עם העמודות: {COLUMNS.join(' · ')}. אפשר לשמור מאקסל בתור ״CSV UTF-8״.
        </p>

        <label
          className={over ? 'drop over' : 'drop'}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
        >
          <strong>גררו לכאן קובץ, או לחצו לבחירה</strong>
          <span>{parsed ? parsed.fileName : 'קובץ ‎.csv בלבד'}</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
          />
        </label>

        {parseErr && <p className="msg err" role="alert" style={{ marginTop: 12 }}>{parseErr}</p>}
      </section>

      {parsed && <Preview parsed={parsed} />}

      {parsed && (
        <section className="panel stack">
          <h2>איך לעדכן?</h2>
          <div className="radio-row" role="radiogroup">
            <label>
              <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              <span>עדכון המלאי לפי הקובץ (רגיל)
                <small>הקובץ הוא כל מה שבמלאי עכשיו. ספרים שהיו באתר ולא מופיעים בקובץ נשארים באתר עם הסימון ״לא במלאי״, יחד עם הכריכות שלהם.</small>
              </span>
            </label>
            <label>
              <input type="radio" name="mode" checked={mode === 'add'} onChange={() => setMode('add')} disabled={!current} />
              <span>הוספת עותקים למלאי הקיים
                <small>
                  {current
                    ? `הספרים בקובץ יתווספו ל-${current.row_count.toLocaleString('he-IL')} הספרים שכבר באתר.`
                    : 'זמין אחרי שיש מלאי באתר.'}
                </small>
              </span>
            </label>
          </div>
          <label className="field">הערה (לא חובה)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: ספירת מלאי נובמבר" maxLength={200} />
          </label>

          {current && (
            change ? (
              <div className="stats">
                <div className="stat"><b>{change.added.toLocaleString('he-IL')}</b><span>ספרים חדשים</span></div>
                <div className="stat"><b>{change.returned.toLocaleString('he-IL')}</b><span>חזרו למלאי</span></div>
                {mode === 'replace' && <div className="stat"><b>{change.gone.toLocaleString('he-IL')}</b><span>יסומנו ״לא במלאי״</span></div>}
                <div className="stat"><b>{change.inStock.toLocaleString('he-IL')}</b><span>עותקים במלאי אחרי העדכון</span></div>
              </div>
            ) : <p className="status">משווה למלאי הקיים…</p>
          )}
          {current && <p className="sub" style={{ margin: 0 }}>אפשר תמיד לחזור לגרסה קודמת מהרשימה למטה.</p>}

          <div>
            <button className="btn dark" type="button" onClick={publish} disabled={working}>
              {working ? 'מפרסם…' : `פרסום ${parsed.rows.length.toLocaleString('he-IL')} ספרים`}
            </button>
          </div>

          {step >= 0 && (
            <ol className="steps">
              {steps.map((s, i) => s && (
                <li key={i} className={step > i ? 'done' : step === i ? 'now' : ''}>
                  {step > i ? '✓ ' : step === i ? '… ' : '· '}{s}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {result && <p className={result.ok ? 'msg ok' : 'msg err'} role="status">{result.text}</p>}

      <section className="panel">
        <h2>גרסאות מלאי</h2>
        <p className="sub">כל העלאה נשמרת. אפשר להוריד כל גרסה כ-CSV או להחזיר אותה לאתר.</p>
        {!versions ? (
          <p className="status">טוען…</p>
        ) : versions.length === 0 ? (
          <p className="msg info">עדיין אין מלאי באתר. העלו את קובץ המלאי המלא כדי להתחיל.</p>
        ) : (
          <div className="scroll-x">
            <table className="mini history">
              <thead><tr><th>תאריך</th><th>ספרים</th><th>קובץ</th><th>הערה</th><th></th></tr></thead>
              <tbody>
                {versions.slice(0, 30).map((v, i) => (
                  <tr key={v.id}>
                    <td>{fmtDate(v.created_at)} {i === 0 && <span className="current-tag">באתר עכשיו</span>}</td>
                    <td>{v.row_count.toLocaleString('he-IL')}</td>
                    <td dir="auto">{v.source_file_name || ''}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 140 }}>{v.note || ''}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn ghost" type="button" disabled={busyRow !== null} onClick={() => exportCsv(v)}>
                        {busyRow === v.id + ':csv' ? '…' : 'הורדה'}
                      </button>
                      {i > 0 && (
                        <button className="btn ghost" type="button" disabled={busyRow !== null} onClick={() => restore(v)}>
                          {busyRow === v.id ? '…' : 'החזרה לאתר'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Preview({ parsed }: { parsed: Parsed }) {
  const cats = new Map<string, number>();
  const conds = new Map<string, number>();
  let noCat = 0;
  for (const r of parsed.rows) {
    if (r[CAT]) cats.set(r[CAT], (cats.get(r[CAT]) || 0) + 1); else noCat++;
    if (r[COND]) conds.set(r[COND], (conds.get(r[COND]) || 0) + 1);
  }
  const prices = parsed.rows.map((r) => r[P]);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  return (
    <section className="panel stack">
      <h2>בדיקת הקובץ</h2>
      <div className="stats">
        <div className="stat"><b>{parsed.rows.length.toLocaleString('he-IL')}</b><span>שורות תקינות</span></div>
        <div className="stat"><b>{parsed.issues.length.toLocaleString('he-IL')}</b><span>הערות ושגיאות</span></div>
        <div className="stat"><b>{cats.size}</b><span>קטגוריות</span></div>
        <div className="stat"><b>{Math.round(avg)} ₪</b><span>מחיר ממוצע</span></div>
      </div>

      {parsed.extraColumns.length > 0 && (
        <p className="msg info">עמודות שלא נשמרות: {parsed.extraColumns.join(', ')}</p>
      )}
      {parsed.issues.length > 0 && (
        <div className="msg info">
          שורות עם בעיה. שורות בלי שם ספר או עם מחיר לא תקין לא ייכללו:
          <ul className="issues">
            {parsed.issues.slice(0, 100).map((x, i) => <li key={i}>שורה {x.line}: {x.message}</li>)}
            {parsed.issues.length > 100 && <li>ועוד {parsed.issues.length - 100}…</li>}
          </ul>
        </div>
      )}

      <div className="scroll-x">
        <table className="mini">
          <thead><tr>{COLUMNS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {parsed.rows.slice(0, 5).map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} dir="auto">{c ?? ''}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sub" style={{ margin: 0 }}>
        מצב: {[...conds.entries()].map(([k, n]) => `${k} ${n.toLocaleString('he-IL')}`).join(' · ')}
        {noCat ? ` · בלי קטגוריה ${noCat.toLocaleString('he-IL')}` : ''}
      </p>
    </section>
  );
}
