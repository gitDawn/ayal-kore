'use client';

// The visitor's reading list, kept only in this browser (no sign-in).
import { useSyncExternalStore } from 'react';
import { A, COND, P, PUB, T, Y, type BookRow } from './inventory';
import { rowKey } from './categories';

export interface ListItem { id: string; title: string; author: string; price: number; condition: string; publisher: string; year: number | null; }

const STORE = 'haayal-reading-list';
const listeners = new Set<() => void>();
let cache: ListItem[] | null = null;
const EMPTY: ListItem[] = [];

function read(): ListItem[] {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || '[]');
    cache = Array.isArray(v) ? v : [];
  } catch { cache = []; }
  return cache;
}

function write(items: ListItem[]) {
  cache = items;
  try { localStorage.setItem(STORE, JSON.stringify(items)); } catch { /* private mode: keep in memory */ }
  listeners.forEach((l) => l());
}

/** One copy of a book: the same book in another condition or price is a separate item. */
export const itemId = (r: BookRow) => `${rowKey(r)}|${r[COND]}|${r[P]}`;

export function toggleItem(r: BookRow) {
  const id = itemId(r);
  const items = read();
  if (items.some((i) => i.id === id)) write(items.filter((i) => i.id !== id));
  else write([...items, { id, title: r[T], author: r[A] || '', price: r[P], condition: r[COND] || '', publisher: r[PUB] || '', year: r[Y] ?? null }]);
}

export const removeItem = (id: string) => write(read().filter((i) => i.id !== id));
export const clearList = () => write([]);

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === STORE) { cache = null; l(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(l); window.removeEventListener('storage', onStorage); };
}

export function useReadingList(): ListItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
