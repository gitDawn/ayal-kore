// Merging a new inventory file with the current one, so books that sold out are kept
// (marked out of stock) instead of disappearing with their covers and edits.
import { OUT, inStock, type BookRow } from './inventory';
import { rowKey } from './categories';

export interface StockChange {
  rows: BookRow[];
  added: number;    // books (title + author) that are new
  returned: number; // books that were out of stock and are back
  gone: number;     // books that were in stock and are not in the file: now out of stock
  inStock: number;  // copies in stock after the change
}

const plain = (r: BookRow) => r.slice(0, 8) as BookRow;
const outRow = (r: BookRow) => { const c = plain(r); c[OUT] = 1; return c; };

/** The file is everything in stock now. Earlier books missing from it stay, one row each, marked out of stock. */
export function replaceStock(prev: BookRow[], file: BookRow[]): StockChange {
  const fileKeys = new Set(file.map(rowKey));
  const prevIn = new Set(prev.filter(inStock).map(rowKey));
  const prevOut = new Set(prev.filter((r) => !inStock(r)).map(rowKey));
  let added = 0, returned = 0, gone = 0;
  for (const k of fileKeys) {
    if (prevIn.has(k)) continue;
    if (prevOut.has(k)) returned++; else added++;
  }
  const kept = new Map<string, BookRow>();
  for (const r of prev) {
    const k = rowKey(r);
    if (fileKeys.has(k) || kept.has(k)) continue;
    if (prevIn.has(k)) gone++;
    kept.set(k, outRow(r));
  }
  return { rows: [...file.map(plain), ...kept.values()], added, returned, gone, inStock: file.length };
}

/** The file holds more copies: add them. A book that was out of stock and is in the file is back in stock. */
export function addStock(prev: BookRow[], file: BookRow[]): StockChange {
  const fileKeys = new Set(file.map(rowKey));
  const prevIn = new Set(prev.filter(inStock).map(rowKey));
  const prevOut = new Set(prev.filter((r) => !inStock(r)).map(rowKey));
  let added = 0, returned = 0;
  for (const k of fileKeys) {
    if (prevIn.has(k)) continue;
    if (prevOut.has(k)) returned++; else added++;
  }
  const rows = [...prev.filter((r) => inStock(r) || !fileKeys.has(rowKey(r))), ...file.map(plain)];
  return { rows, added, returned, gone: 0, inStock: rows.filter(inStock).length };
}

export const countInStock = (rows: BookRow[]) => rows.filter(inStock).length;
