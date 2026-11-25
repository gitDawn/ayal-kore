// Permanent addresses for book pages, shared by the server pages and the search page.
// The address holds a readable name and a short id derived from the book key (title + author),
// so it stays the same when the inventory file is uploaded again.
import { A, T, type BookRow } from './inventory';
import { bookKey } from './categories';

export const SITE_URL = 'https://haayal-kore.codata-io.app';

/** Two FNV-1a hashes with different seeds: 12 hex characters, the same in the browser and on the server. */
export function bookId(key: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x01000193 + 0x2f) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 12);
}

function slugText(title: string, author: string): string {
  return [title, author].filter(Boolean).join(' ')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
}

export function bookPathFor(title: string, author: string): string {
  const text = slugText(title, author);
  const id = bookId(bookKey(title, author));
  return `/book/${text ? `${text}-` : ''}${id}`;
}

export const bookPath = (r: BookRow) => bookPathFor(r[T], r[A]);

/** The id at the end of a book address (the readable part is ignored). */
export function idFromSlug(slug: string): string {
  let s = slug;
  try { s = decodeURIComponent(slug); } catch { /* already decoded */ }
  const m = s.match(/([0-9a-f]{12})$/);
  return m ? m[1] : '';
}

export const categoryPath = (name: string) => `/category/${encodeURIComponent(name)}`;
