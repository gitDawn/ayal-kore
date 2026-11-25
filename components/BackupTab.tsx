'use client';

// Staff tab "גיבוי": download the site's data and the cover pictures to the computer.
import { useEffect, useRef, useState } from 'react';
import './SimaniaSync.css';
import { COVERS_PER_PART, backupCovers, backupData, countCovers } from '@/lib/backup';

const nf = (n: number) => n.toLocaleString('he-IL');

export default function BackupTab() {
  const [busy, setBusy] = useState<'' | 'data' | 'covers'>('');
  const [progress, setProgress] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [covers, setCovers] = useState<number | null>(null);
  const [part, setPart] = useState(0); // 0 = all parts
  const stop = useRef(false);

  useEffect(() => { countCovers().then(setCovers).catch(() => setCovers(null)); }, []);
  const parts = covers ? Math.max(1, Math.ceil(covers / COVERS_PER_PART)) : 0;

  async function runData() {
    setBusy('data'); setMsg(null);
    try {
      const r = await backupData(setProgress);
      setMsg({ ok: true, text: `הגיבוי ירד למחשב: ${r.fileName} (${nf(r.tables)} טבלאות, ${nf(r.rows)} שורות).` });
    } catch {
      setMsg({ ok: false, text: 'הגיבוי לא הצליח. בדקו שאתם מחוברים ונסו שוב.' });
    } finally { setBusy(''); setProgress(''); }
  }

  async function runCovers() {
    stop.current = false;
    setBusy('covers'); setMsg(null);
    try {
      const r = await backupCovers(setProgress, () => stop.current, part || undefined);
      if (stop.current) setMsg({ ok: false, text: `גיבוי הכריכות נעצר. ${nf(r.parts)} חלקים ירדו למחשב.` });
      else setMsg({
        ok: true,
        text: `גיבוי הכריכות ירד למחשב: ${nf(r.parts)} ${r.parts === 1 ? 'קובץ' : 'קבצים'}, ${nf(r.files)} תמונות.`
          + (r.failed ? ` ${nf(r.failed)} תמונות לא ירדו, אפשר להריץ שוב.` : ''),
      });
    } catch {
      setMsg({ ok: false, text: 'גיבוי הכריכות לא הצליח. בדקו שאתם מחוברים ונסו שוב.' });
    } finally { setBusy(''); setProgress(''); }
  }

  return (
    <>
      <section className="panel stack">
        <div>
          <h2>גיבוי הנתונים</h2>
          <p className="sub" style={{ margin: 0 }}>
            מוריד למחשב קובץ אחד (ZIP) עם כל הנתונים של האתר: המלאי הנוכחי, היסטוריית גרסאות המלאי, הקטגוריות,
            פרטי הכריכות, התיאורים, ההמלצות, נתוני סימניה והחיפושים באתר. לוקח כחצי דקה.
          </p>
        </div>
        <div>
          <button className="btn dark" type="button" disabled={!!busy} onClick={runData}>
            {busy === 'data' ? 'מגבה…' : 'גיבוי'}
          </button>
        </div>
        <details className="sim-setup">
          <summary>מה יש בקובץ ואיך משתמשים בו</summary>
          <ul style={{ margin: '8px 0 0', paddingInlineStart: 22, display: 'grid', gap: 6, fontSize: 14 }}>
            <li><b>מלאי-נוכחי.csv</b>: כל הספרים באתר עם מחיר, מצב וקטגוריה, ועמודה &quot;במלאי&quot;. נפתח באקסל.</li>
            <li><b>טבלאות</b> ו<b>טבלאות-csv</b>: כל טבלה במסד הנתונים, פעם בפורמט לשחזור ופעם לצפייה באקסל.</li>
            <li><b>מלאי-נוכחי-מקורי.json.gz</b>: המלאי בדיוק כפי שהאתר שומר אותו, לשחזור.</li>
            <li>את הקובץ שומרים כמו שהוא, בלי לפתוח ולשנות. מומלץ להעלות אותו ל־Google Drive או לשמור בכונן חיצוני.</li>
            <li>מומלץ לגבות פעם בשבוע, ותמיד לפני שינוי גדול, כמו העלאת מלאי חדש.</li>
            <li>אם יהיה צורך לשחזר, הקבצים האלה מספיקים כדי לבנות את הנתונים מחדש.</li>
          </ul>
        </details>
      </section>

      <section className="panel stack">
        <div>
          <h2>גיבוי כריכות</h2>
          <p className="sub" style={{ margin: 0 }}>
            מוריד את תמונות הכריכות ואת תמונות ההמלצות.
            {covers != null && <> יש באתר {nf(covers)} כריכות, והן יורדות ב־{nf(parts)} {parts === 1 ? 'קובץ' : 'קבצים'} של עד {nf(COVERS_PER_PART)} תמונות.</>}
            {' '}הגיבוי המלא לוקח כמה דקות, וצריך להשאיר את הדף פתוח עד שהוא נגמר.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {busy === 'covers' ? (
            <button className="btn ghost" type="button" onClick={() => { stop.current = true; }}>עצירה</button>
          ) : (
            <button className="btn dark" type="button" disabled={!!busy} onClick={runCovers}>גיבוי כריכות</button>
          )}
          {parts > 1 && (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
              מה להוריד:
              <select value={part} disabled={!!busy} onChange={(e) => setPart(Number(e.target.value))}>
                <option value={0}>כל החלקים</option>
                {Array.from({ length: parts }, (_, i) => <option key={i} value={i + 1}>רק חלק {i + 1}</option>)}
              </select>
            </label>
          )}
        </div>
        <details className="sim-setup">
          <summary>מה יש בקבצים ואיך משתמשים בהם</summary>
          <ul style={{ margin: '8px 0 0', paddingInlineStart: 22, display: 'grid', gap: 6, fontSize: 14 }}>
            <li>כל קובץ הוא חלק אחד מהגיבוי. בכל חלק יש תיקייה &quot;תמונות&quot; וקובץ <b>רשימה.csv</b> שאומר לאיזה ספר שייכת כל תמונה.</li>
            <li>בפעם הראשונה כרום עשוי לשאול אם לאפשר לאתר להוריד כמה קבצים. צריך ללחוץ &quot;אפשר&quot;, אחרת יורד רק החלק הראשון.</li>
            <li>אם חלק לא ירד, בוחרים אותו ברשימה &quot;מה להוריד&quot; ומורידים רק אותו.</li>
            <li>שומרים את כל החלקים יחד באותה תיקייה. אין צורך לגבות כריכות לעתים קרובות: פעם בחודש מספיקה.</li>
          </ul>
        </details>
      </section>

      {progress && <p className="status" style={{ textAlign: 'start' }}>{progress}</p>}
      {msg && <p className={msg.ok ? 'msg ok' : 'msg err'} role="status">{msg.text}</p>}
    </>
  );
}
