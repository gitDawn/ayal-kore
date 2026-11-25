'use client';

// "Find the books in the video": the staff member picks the video file from the phone,
// Gemini lists the books, and each one can be added to the recommendation with one click.
import { useState } from 'react';
import { formatPrice } from '@/lib/inventory';
import { scanVideo, type ScanResult } from '@/lib/videoFrames';
import type { BookHit } from '@/lib/recommendations';

export default function VideoScan({ chosen, onAdd }: { chosen: Set<string>; onAdd: (b: BookHit) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [err, setErr] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true); setErr(''); setResult(null);
    try { setResult(await scanVideo(file, setProgress)); }
    catch (e) { setErr((e as Error).message || 'הזיהוי לא הצליח.'); }
    finally { setBusy(false); setProgress(''); }
  }

  // The best match of each book that the video features, in stock and not chosen yet.
  const best = (result?.books ?? [])
    .filter((b) => b.featured && b.matches[0] && b.matches[0].score >= 0.75 && b.matches[0].inStock)
    .map((b) => b.matches[0])
    .filter((m) => !chosen.has(m.id));

  return (
    <div className="vscan">
      <b>זיהוי ספרים מהסרטון (Gemini)</b>
      <p className="sub" style={{ margin: 0 }}>בחרו את קובץ הסרטון מהטלפון או מהמחשב. הסרטון לא נשמר, רק תמונות ממנו והקול נשלחים לזיהוי.</p>
      <div className="rl-row">
        <input type="file" accept="video/*" disabled={busy} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setErr(''); }} />
        <button className="btn" type="button" disabled={!file || busy} onClick={run}>{busy ? 'מזהה…' : 'זיהוי ספרים'}</button>
      </div>
      {progress && <p className="status" style={{ margin: 0 }}>{progress}</p>}
      {err && <p className="msg err" style={{ margin: 0 }}>{err}</p>}

      {result && (
        result.books.length === 0 ? <p className="msg info" style={{ margin: 0 }}>לא זוהו ספרים בסרטון.</p> : (
          <>
            <p className="sub" style={{ margin: 0 }}>
              זוהו {result.books.length} ספרים ({result.frames} תמונות{result.audio ? ' וקול' : ', בלי קול'}).
              {best.length > 0 && <> <button className="btn ghost" type="button" onClick={() => best.forEach(onAdd)}>הוספת כל ההתאמות הבטוחות ({best.length})</button></>}
            </p>
            <ul className="vscan-list">
              {result.books.map((b, i) => (
                <li key={i} className={b.featured ? 'featured' : ''}>
                  <div className="vscan-found">
                    <b>{b.title}</b>{b.author ? `, ${b.author}` : ''}
                    <span>{b.featured ? 'מוצג בסרטון' : 'ברקע'}{b.source === 'speech' ? ' · נאמר בקול' : b.source === 'spine' ? ' · משדרה' : ''}</span>
                  </div>
                  {b.matches.length === 0 ? <span className="vscan-none">לא בקטלוג</span> : (
                    <ul className="vscan-matches">
                      {b.matches.map((m) => (
                        <li key={m.id}>
                          <span>{m.title}{m.author ? `, ${m.author}` : ''} · {m.inStock ? `${formatPrice(m.price)}${m.condition ? ` · ${m.condition}` : ''}` : 'לא במלאי'}{m.score < 0.75 ? ' · התאמה חלקית' : ''}</span>
                          <button className="btn ghost" type="button" disabled={chosen.has(m.id)} onClick={() => onAdd(m)}>{chosen.has(m.id) ? 'נבחר ✓' : 'הוספה'}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </div>
  );
}
