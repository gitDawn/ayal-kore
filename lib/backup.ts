// Staff backups, made in the browser and downloaded to the computer:
//   backupData()   one ZIP with every table, the current inventory (CSV and the original file)
//                  and the full inventory history list;
//   backupCovers() the cover pictures (and recommendation pictures), in ZIP parts.
import { publicFileUrl, supabase } from './supabase';
import { COLUMNS, decodeSnapshot, inStock } from './inventory';
import { coverUrl, COVER_BUCKET } from './covers';
import { imageUrl } from './recommendations';
import { ZipWriter, download } from './zip';

/** Tables and the column to page them by (each is unique, so paging never skips or repeats a row). */
const TABLES: [string, string][] = [
  ['inventory_versions', 'id'],
  ['book_categories', 'book_key'],
  ['book_covers', 'book_key'],
  ['book_cover_links', 'book_key'],
  ['book_descriptions', 'book_key'],
  ['recommendations', 'id'],
  ['simania_items', 'owned_id'],
  ['search_log', 'id'],
  ['staff', 'email'],
];

const stamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
};

async function fetchAll(table: string, key: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; from < 2_000_000; from += 1000) {
    const { data, error } = await supabase().from(table).select('*').order(key).range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header: string[], rows: unknown[][]) => '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

const README_DATA = `גיבוי הנתונים של אתר האיל הקורא

מה יש בקובץ:
- מלאי-נוכחי.csv: כל הספרים באתר, כולל עמודה "במלאי" (כן / לא). נפתח באקסל.
- מלאי-נוכחי-מקורי.json.gz: אותו מלאי בדיוק כפי שהאתר שומר אותו. משמש לשחזור.
- טבלאות/: כל טבלה במסד הנתונים כקובץ JSON (קטגוריות, כריכות, תיאורים, המלצות, נתוני סימניה, חיפושים, גרסאות המלאי).
- טבלאות-csv/: אותן טבלאות כקובצי CSV, לצפייה באקסל.

תמונות הכריכות לא נמצאות כאן. יש להן כפתור נפרד: "גיבוי כריכות".

שחזור: שומרים את הקובץ כמו שהוא. אם יהיה צורך לשחזר, הקבצים בתיקייה "טבלאות" והקובץ המקורי של המלאי מספיקים כדי לבנות את הנתונים מחדש.
`;

/** Download one ZIP with all the site's data. */
export async function backupData(onProgress: (text: string) => void): Promise<{ fileName: string; tables: number; rows: number }> {
  const when = new Date();
  const zip = new ZipWriter(when);
  await zip.add('קרא-אותי.txt', README_DATA);
  let rows = 0, tables = 0;

  for (const [table, key] of TABLES) {
    onProgress(`קורא את הטבלה ${table}…`);
    let data: Record<string, unknown>[];
    try { data = await fetchAll(table, key); } catch { continue; } // a table this account cannot read is skipped
    tables++; rows += data.length;
    await zip.add(`טבלאות/${table}.json`, JSON.stringify(data));
    const cols = [...new Set(data.flatMap((r) => Object.keys(r)))];
    await zip.add(`טבלאות-csv/${table}.csv`, toCsv(cols, data.map((r) => cols.map((c) => r[c]))));
  }

  onProgress('קורא את המלאי הנוכחי…');
  const { data: v, error } = await supabase().from('inventory_versions').select('*').order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  const latest = v?.[0] as { file_path: string } | undefined;
  if (latest) {
    const res = await fetch(publicFileUrl(latest.file_path), { cache: 'no-store' });
    if (!res.ok) throw new Error('snapshot');
    const buf = new Uint8Array(await res.arrayBuffer());
    await zip.add('מלאי-נוכחי-מקורי.json.gz', buf, false);
    const snap = await decodeSnapshot(buf.buffer as ArrayBuffer);
    await zip.add('מלאי-נוכחי.csv', toCsv([...COLUMNS, 'במלאי'], snap.rows.map((r) => [...r.slice(0, 8), inStock(r) ? 'כן' : 'לא'])));
  }

  onProgress('מכין את הקובץ להורדה…');
  const fileName = `גיבוי-האיל-הקורא-${stamp(when)}.zip`;
  download(zip.finish(), fileName);
  onProgress('');
  return { fileName, tables, rows };
}

// ── Covers ──

/** Covers per ZIP part: keeps each part around 50–100 MB, so the browser handles it comfortably. */
export const COVERS_PER_PART = 2500;

interface CoverFile { path: string; book_key: string; title: string | null; author: string | null; source: string | null; }

/** Every picture to back up: book covers, then recommendation pictures. */
async function coverFiles(): Promise<CoverFile[]> {
  const out: CoverFile[] = [];
  for (let from = 0; from < 2_000_000; from += 1000) {
    const { data, error } = await supabase().from('book_covers').select('book_key,path,title,author,source')
      .not('path', 'is', null).order('book_key').range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as CoverFile[]));
    if (!data || data.length < 1000) break;
  }
  const { data: recs } = await supabase().from('recommendations').select('title,image_path').not('image_path', 'is', null);
  for (const r of (recs ?? []) as { title: string; image_path: string }[]) {
    out.push({ path: r.image_path, book_key: '', title: r.title, author: null, source: 'recommendation' });
  }
  return out;
}

export async function countCovers(): Promise<number> {
  const { count, error } = await supabase().from('book_covers').select('book_key', { count: 'exact', head: true }).not('path', 'is', null);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Download the pictures in ZIP parts (part 1, 2, …). Each part has the pictures and a list
 * (רשימה.csv) saying which book each file belongs to. `onlyPart` downloads just one part.
 */
export async function backupCovers(
  onProgress: (text: string) => void,
  shouldStop: () => boolean,
  onlyPart?: number,
): Promise<{ parts: number; files: number; failed: number }> {
  onProgress('קורא את רשימת הכריכות…');
  const all = await coverFiles();
  const totalParts = Math.max(1, Math.ceil(all.length / COVERS_PER_PART));
  const when = new Date();
  let files = 0, failed = 0, parts = 0;

  for (let p = 0; p < totalParts; p++) {
    if (onlyPart && p + 1 !== onlyPart) continue;
    if (shouldStop()) break;
    const slice = all.slice(p * COVERS_PER_PART, (p + 1) * COVERS_PER_PART);
    const zip = new ZipWriter(when);
    const listed: unknown[][] = [];
    let done = 0;
    // A few downloads at a time.
    const queue = [...slice];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        if (shouldStop()) return;
        try {
          const url = f.path.startsWith('rec/') ? imageUrl(f.path) : coverUrl(f.path);
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) throw new Error(String(res.status));
          const name = `תמונות/${f.path}`;
          await zip.add(name, new Uint8Array(await res.arrayBuffer()), false);
          listed.push([name, f.title, f.author, f.book_key, f.source]);
          files++;
        } catch { failed++; }
        done++;
        if (done % 25 === 0 || done === slice.length) {
          onProgress(`חלק ${p + 1} מתוך ${totalParts}: ${done.toLocaleString('he-IL')} מתוך ${slice.length.toLocaleString('he-IL')} תמונות`);
        }
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    if (shouldStop()) break;
    await zip.add('רשימה.csv', toCsv(['קובץ', 'שם הספר', 'מחבר', 'מפתח הספר', 'מקור'], listed));
    await zip.add('קרא-אותי.txt', `גיבוי כריכות של אתר האיל הקורא, חלק ${p + 1} מתוך ${totalParts}.

בתיקייה "תמונות" נמצאות תמונות הכריכות (ותמונות ההמלצות, שמתחילות ב-rec/).
הקובץ רשימה.csv אומר לאיזה ספר שייכת כל תמונה. נפתח באקסל.
שומרים את כל החלקים יחד. מקום האחסון באתר: ${COVER_BUCKET}.
`);
    download(zip.finish(), `גיבוי-כריכות-${stamp(when)}-חלק-${p + 1}-מתוך-${totalParts}.zip`);
    parts++;
    // Let the browser start the download before building the next part.
    await new Promise((r) => setTimeout(r, 1500));
  }
  onProgress('');
  return { parts, files, failed };
}

