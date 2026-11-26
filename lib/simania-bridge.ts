'use client';

// The site side of the Simania bridge: a Simania tab opened from the staff area, where the
// bookmarklet runs the bridge (see BRIDGE in simania-reader). The site asks it to search
// Simania's catalog and to add books to the store's stock, and waits for its answers.
import {
  BRIDGE_CALL, BRIDGE_KEY, BRIDGE_READY, BRIDGE_REPLY, SIMANIA_INVENTORY, SIMANIA_ORIGIN,
} from './simania-reader';

/** A book in Simania's catalog, as the bridge returns it. */
export interface CatalogBook {
  bookId: number;
  title: string;
  author: string | null;
  year: number | null;
  publisher: string | null;
  owned: boolean;          // already in the store's stock (for sale or not)
  status: string | null;
  avg: number | null;      // market prices on Simania
  min: number | null;
  max: number | null;
  sellers: number | null;
}

export interface AddResult { bookId: number; ok: boolean; status: number; error: string | null; }

/** Simania's conditions, as its add form numbers them. */
export const CONDITIONS: [number, string][] = [[5, 'חדש לגמרי'], [4, 'כחדש'], [3, 'טוב'], [2, 'בינוני'], [1, 'רעוע']];

export class SimaniaBridge {
  private win: Window | null = null;
  private ready = false;
  private seq = 0;
  private waiting = new Map<number, { ok: (v: unknown) => void; bad: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private onReady: (() => void) | null = null;

  constructor() {
    window.addEventListener('message', this.onMessage);
  }

  dispose() {
    window.removeEventListener('message', this.onMessage);
    for (const w of this.waiting.values()) { clearTimeout(w.timer); w.bad(new Error('closed')); }
    this.waiting.clear();
  }

  private onMessage = (e: MessageEvent) => {
    if (e.origin !== SIMANIA_ORIGIN || !this.win || e.source !== this.win) return;
    const m = e.data as { kind?: string; id?: number; ok?: boolean; result?: unknown; error?: string };
    if (m?.kind === BRIDGE_READY) { this.ready = true; this.onReady?.(); return; }
    if (m?.kind !== BRIDGE_REPLY || typeof m.id !== 'number') return;
    const w = this.waiting.get(m.id);
    if (!w) return;
    this.waiting.delete(m.id);
    clearTimeout(w.timer);
    if (m.ok) w.ok(m.result); else w.bad(new Error(m.error || 'bridge'));
  };

  /** Open the Simania tab (must run from a click). `onReady` fires once the bookmarklet connects it. */
  open(onReady: () => void) {
    this.ready = false;
    this.onReady = onReady;
    this.win = window.open(`${SIMANIA_INVENTORY}#${BRIDGE_KEY}`, '_blank');
  }

  get connected() { return this.ready && !!this.win && !this.win.closed; }

  private call<T>(payload: Record<string, unknown>, timeoutMs: number): Promise<T> {
    if (!this.connected) return Promise.reject(new Error('not connected'));
    const id = ++this.seq;
    return new Promise<T>((ok, bad) => {
      const timer = setTimeout(() => { this.waiting.delete(id); bad(new Error('timeout')); }, timeoutMs);
      this.waiting.set(id, { ok: ok as (v: unknown) => void, bad, timer });
      this.win!.postMessage({ kind: BRIDGE_CALL, id, ...payload }, SIMANIA_ORIGIN);
    });
  }

  search(q: string) { return this.call<CatalogBook[]>({ op: 'search', q }, 30_000); }

  add(items: { bookId: number; price: number; condition: number }[]) {
    return this.call<AddResult[]>({ op: 'add', items }, 30_000 + items.length * 5_000);
  }
}

// ── Matching a recognized title to Simania's catalog ──

const norm = (s: string) => (s || '').normalize('NFKD').replace(/[֑-ׇ]/g, '')
  .replace(/["'`״׳‘’“”]/g, '').replace(/[-–—_.,:;!?()\[\]{}\/\\|]/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
const words = (s: string) => norm(s).split(' ').filter((w) => w.length > 1);

/** How well a catalog book fits a recognized title and author (0–1). */
export function fit(title: string, author: string | undefined, b: CatalogBook): number {
  const tw = words(title), bw = new Set(words(b.title));
  if (!tw.length || !bw.size) return 0;
  let hits = 0;
  for (const w of tw) if (bw.has(w)) hits++;
  let score = (2 * hits) / (tw.length + bw.size);
  const aw = words(author || '');
  if (aw.length && b.author) {
    const ba = new Set(words(b.author));
    if (aw.some((w) => ba.has(w))) score += 0.2;
  }
  return Math.min(1, score);
}

/** Search queries to try for a recognized book, best first. */
export function queriesFor(title: string, author?: string): string[] {
  const t = title.replace(/\s+/g, ' ').trim();
  const short = t.split(/\s[:\-–]\s|:/)[0].split(' ').slice(0, 4).join(' ');
  // Without a volume mark ("חלק ב", "כרך 2", a trailing number), which catalog titles often write differently.
  const base = short.replace(/\s+(חלק|כרך|ספר|vol\.?|volume|book)\s*\S*$/i, '').replace(/\s+\d+$/, '').trim();
  const out = [t];
  if (short && short !== t) out.push(short);
  if (base && base !== short) out.push(base);
  if (author) out.push(`${base || short} ${author.split(' ').slice(-1)[0]}`);
  const two = t.split(' ').slice(0, 2).join(' ');
  if (two.length >= 6) out.push(two);
  return [...new Set(out)];
}

/** A suggested price from Simania's market prices: the average, rounded to whole shekels. */
export function suggestPrice(b: CatalogBook | null): number | null {
  if (!b) return null;
  const p = b.avg ?? (b.min != null && b.max != null ? (b.min + b.max) / 2 : null);
  return p == null ? null : Math.max(1, Math.round(p));
}
