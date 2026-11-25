// Inventory snapshot format shared by the public search page and the staff upload page.
// The snapshot mirrors the store's CSV exactly: same eight columns, same order.

export const SITE_NAME = 'האיל הקורא';
export const SITE_TAGLINE = 'כל ספר קורא לך';
export const STORE_PHONE = '052-838-3390';
export const STORE_PHONE_INTL = '+972528383390';
export const STORE_FACEBOOK = 'https://www.facebook.com/profile.php?id=61581802951253';

export const COLUMNS = ['שם הספר', 'סופר', 'מצב', 'מחיר', 'קטגוריה', 'תת-קטגוריה', 'הוצאה', 'שנה'] as const;

/** One inventory line: [title, author, condition, price, category, subcategory, publisher, year, out?]
 *  The ninth field is 1 for a book that was in stock before and is not now (kept, shown as out of stock). */
export type BookRow = [string, string, string, number, string, string, string, number | null, number?];

export interface Snapshot {
  columns: string[];
  rows: BookRow[];
  createdAt?: string;
  sourceFileName?: string;
}

export const T = 0, A = 1, COND = 2, P = 3, CAT = 4, SUB = 5, PUB = 6, Y = 7, OUT = 8;

/** False for a book kept from an earlier inventory that is not in stock now. */
export const inStock = (r: BookRow) => r[OUT] !== 1;

/** gzip a snapshot for storage. */
export async function encodeSnapshot(s: Snapshot): Promise<Blob> {
  const json = JSON.stringify(s);
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

/** Read a gzip (or plain JSON) snapshot. */
export async function decodeSnapshot(buf: ArrayBuffer): Promise<Snapshot> {
  const bytes = new Uint8Array(buf);
  let text: string;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  const s = JSON.parse(text) as Snapshot;
  if (!s || !Array.isArray(s.rows)) throw new Error('bad snapshot');
  return s;
}

/** Normalize Hebrew/English text for matching: drop niqqud, quotes, punctuation; lowercase. */
export function norm(s: string): string {
  return (s || '')
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '')
    .replace(/["'`״׳‘’“”]/g, '')
    .replace(/[-–—_.,:;!?()\[\]{}\/\\|]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ── CSV validation (upload page) ───────────────────────────────────────

export interface RowIssue { line: number; message: string; }
export interface ParsedInventory { rows: BookRow[]; issues: RowIssue[]; missingColumns: string[]; extraColumns: string[]; }

const clean = (v: unknown) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();

/** Turn parsed CSV records (header → value) into snapshot rows, collecting problems. */
export function toRows(records: Record<string, unknown>[], headers: string[]): ParsedInventory {
  const hs = headers.map((h) => clean(h).replace(/^﻿/, ''));
  const missingColumns = COLUMNS.filter((c) => !hs.includes(c));
  const extraColumns = hs.filter((h) => h && !(COLUMNS as readonly string[]).includes(h));
  const rows: BookRow[] = [];
  const issues: RowIssue[] = [];
  if (missingColumns.length) return { rows, issues, missingColumns, extraColumns };

  // Map cleaned header → original key so a BOM or stray spaces in the header don't break lookups.
  const key: Record<string, string> = {};
  headers.forEach((h, i) => { key[hs[i]] = h; });
  const get = (r: Record<string, unknown>, c: string) => clean(r[key[c]]);

  records.forEach((r, i) => {
    const line = i + 2; // header is line 1
    const title = get(r, 'שם הספר');
    const priceRaw = get(r, 'מחיר').replace(/[₪,\s]/g, '');
    const yearRaw = get(r, 'שנה');
    if (!title) { issues.push({ line, message: 'חסר שם ספר' }); return; }
    const price = Number(priceRaw);
    if (priceRaw === '' || !Number.isFinite(price) || price < 0) {
      issues.push({ line, message: `מחיר לא תקין: "${get(r, 'מחיר')}"` });
      return;
    }
    let year: number | null = null;
    if (yearRaw) {
      const y = Math.trunc(Number(yearRaw));
      if (Number.isFinite(y) && y > 0) year = y;
      else issues.push({ line, message: `שנה לא תקינה: "${yearRaw}" (נשמר בלי שנה)` });
    }
    rows.push([
      title,
      get(r, 'סופר'),
      get(r, 'מצב'),
      Math.round(price * 100) / 100,
      get(r, 'קטגוריה'),
      get(r, 'תת-קטגוריה'),
      get(r, 'הוצאה'),
      year,
    ]);
  });
  return { rows, issues, missingColumns, extraColumns };
}

/** Export snapshot rows back to CSV in the original format (with BOM for Excel). */
export function toCsv(rows: BookRow[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [COLUMNS.join(','), ...rows.map((r) => r.slice(0, 8).map(esc).join(','))].join('\r\n');
}

export function formatPrice(p: number): string {
  return Number.isInteger(p) ? `${p} ₪` : `${p.toFixed(2)} ₪`;
}
