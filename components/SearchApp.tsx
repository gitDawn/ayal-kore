'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './SearchApp.css';
import { A, COND, P, PUB, T, Y, decodeSnapshot, formatPrice, inStock, norm, type BookRow } from '@/lib/inventory';
import { readCached, writeCached } from '@/lib/snapshot-cache';
import { fetchCategoryEdits, fileCategories, rowKey } from '@/lib/categories';
import { fetchAllCovers } from '@/lib/coverLinks';
import CoverImg from '@/components/CoverImg';
import BookDialog from '@/components/BookDialog';
import ReadingList, { ListToggle } from '@/components/ReadingList';
import { itemId, toggleItem, useReadingList } from '@/lib/readingList';
import { logSearch } from '@/lib/searchLog';

type Field = 'all' | 'title' | 'author';
type Sort = 'title' | 'author' | 'price-asc' | 'price-desc' | 'year-desc';

interface Indexed { row: BookRow; t: string; a: string; cats: string[]; subs: string[]; cover?: string; out: boolean; }

const PAGE = 50;
const collator = new Intl.Collator('he');

const CONDITION_ORDER = ['חדש לגמרי', 'כחדש', 'טוב', 'בינוני'];
function condClass(c: string) {
  if (c === 'חדש לגמרי') return 'badge new';
  if (c === 'כחדש') return 'badge';
  if (c === 'טוב') return 'badge good';
  return 'badge fair';
}

interface Query { text: string; field: Field; category: string; condition: string; maxPrice: string; }
const EMPTY: Query = { text: '', field: 'all', category: '', condition: '', maxPrice: '' };

export default function SearchApp({ versionId, url, rowCount }: { versionId: string; url: string; rowCount: number }) {
  const router = useRouter();
  const [books, setBooks] = useState<Indexed[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  // Draft inputs (what the user is typing) vs. the submitted query (what results show).
  const [draft, setDraft] = useState<Query>(EMPTY);
  const [query, setQuery] = useState<Query | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<Sort>('title');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Indexed | null>(null); // book shown in the details window
  const list = useReadingList();
  const inList = useMemo(() => new Set(list.map((i) => i.id)), [list]);
  const resultsRef = useRef<HTMLDivElement>(null);
  const logged = useRef<Query | null>(null);
  const retried = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const editsP = fetchCategoryEdits().catch(() => new Map());
        const coversP = fetchAllCovers().catch(() => new Map<string, string>());
        let snap = await readCached(versionId);
        if (!snap) {
          const res = await fetch(url);
          if (!res.ok) throw new Error(String(res.status));
          snap = await decodeSnapshot(await res.arrayBuffer());
          writeCached(versionId, snap);
        }
        const [edits, covers] = await Promise.all([editsP, coversP]);
        if (cancelled) return;
        setBooks(snap.rows.map((row) => {
          const k = rowKey(row);
          const e = edits.get(k);
          const c = e ? { categories: e.categories, subcategories: e.subcategories } : fileCategories(row);
          return { row, t: norm(row[T]), a: norm(row[A]), cats: c.categories, subs: c.subcategories, cover: covers.get(k), out: !inStock(row) };
        }));
      } catch {
        if (cancelled) return;
        // The signed download link may have expired: refresh the page data once.
        if (!retried.current) { retried.current = true; router.refresh(); }
        else setLoadErr(true);
      }
    })();
    return () => { cancelled = true; };
  }, [versionId, url, router]);

  const categories = useMemo(() => {
    if (!books) return [] as [string, number][];
    const m = new Map<string, number>();
    for (const b of books) for (const c of b.cats) m.set(c, (m.get(c) || 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [books]);

  const conditions = useMemo(() => {
    if (!books) return [] as string[];
    const s = new Set<string>();
    for (const b of books) if (b.row[COND]) s.add(b.row[COND]);
    return [...s].sort((x, y) => {
      const i = CONDITION_ORDER.indexOf(x), j = CONDITION_ORDER.indexOf(y);
      return (i < 0 ? 99 : i) - (j < 0 ? 99 : j);
    });
  }, [books]);

  const results = useMemo(() => {
    if (!books || !query) return null;
    const tokens = norm(query.text).split(' ').filter(Boolean);
    const max = query.maxPrice ? Number(query.maxPrice) : null;
    const out = books.filter((b) => {
      if (query.category && !b.cats.includes(query.category)) return false;
      if (query.condition && b.row[COND] !== query.condition) return false;
      if (max != null && Number.isFinite(max) && b.row[P] > max) return false;
      if (!tokens.length) return true;
      const hay = query.field === 'title' ? b.t : query.field === 'author' ? b.a : b.t + ' ' + b.a;
      return tokens.every((tok) => hay.includes(tok));
    });
    const cmp: Record<Sort, (x: Indexed, y: Indexed) => number> = {
      title: (x, y) => collator.compare(x.row[T], y.row[T]),
      author: (x, y) => collator.compare(x.row[A] || 'ת', y.row[A] || 'ת') || collator.compare(x.row[T], y.row[T]),
      'price-asc': (x, y) => x.row[P] - y.row[P],
      'price-desc': (x, y) => y.row[P] - x.row[P],
      'year-desc': (x, y) => (y.row[Y] ?? 0) - (x.row[Y] ?? 0),
    };
    out.sort(cmp[sort]);
    // Books in stock first; books that sold out (kept for reference) after them.
    return [...out.filter((b) => !b.out), ...out.filter((b) => b.out)];
  }, [books, query, sort]);

  // Record each new search once (not when only the sort order changes).
  useEffect(() => {
    if (!query || !results || logged.current === query) return;
    logged.current = query;
    logSearch({ q: query.text, field: query.field, category: query.category, condition: query.condition, maxPrice: query.maxPrice, results: results.length });
  }, [query, results]);

  function run(q: Query) {
    setQuery(q);
    setShown(PAGE);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(draft);
  }

  function browseCategory(cat: string) {
    const q = { ...EMPTY, category: cat };
    setDraft(q);
    setShowFilters(true);
    run(q);
  }

  const closeDialog = useCallback(() => setOpen(null), []);

  const canSearch = Boolean(draft.text.trim() || draft.category || draft.condition || draft.maxPrice);

  return (
    <div className="section">
      <h2 className="search-title">מצאו את הספר הבא שלכם</h2>
      <p className="search-hint">חפשו לפי שם ספר או שם מחבר, גם חלק מהמילה</p>

      <form onSubmit={submit} role="search">
        <div className="search-bar">
          <input
            type="search"
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            placeholder="שם ספר או מחבר"
            aria-label="חיפוש ספר"
            enterKeyHint="search"
          />
          <button className="btn-search" type="submit" disabled={!books || !canSearch}>חפש</button>
        </div>

        <div className="chips" role="group" aria-label="חיפוש לפי">
          <span className="label">חפש ב:</span>
          {([['all', 'הכל'], ['title', 'שם ספר'], ['author', 'מחבר']] as [Field, string][]).map(([f, label]) => (
            <button
              key={f}
              type="button"
              className="chip"
              aria-pressed={draft.field === f}
              onClick={() => setDraft({ ...draft, field: f })}
            >{label}</button>
          ))}
        </div>

        <button type="button" className="filters-toggle" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
          {showFilters ? 'הסתר סינון' : 'סינון לפי קטגוריה, מצב ומחיר'}
        </button>

        {showFilters && (
          <div className="filters">
            <label className="field">קטגוריה
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                <option value="">כל הקטגוריות</option>
                {categories.map(([c]) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field">מצב הספר
              <select value={draft.condition} onChange={(e) => setDraft({ ...draft, condition: e.target.value })}>
                <option value="">כל המצבים</option>
                {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field">מחיר עד (₪)
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.maxPrice}
                onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })}
                placeholder="ללא הגבלה"
              />
            </label>
          </div>
        )}
      </form>

      <p className={loadErr ? 'status err' : 'status'} aria-live="polite">
        {loadErr
          ? 'לא הצלחנו לטעון את הקטלוג. נסו לרענן את הדף.'
          : !books
            ? `טוען את הקטלוג (${rowCount.toLocaleString('he-IL')} ספרים)…`
            : results
              ? `נמצאו ${results.length.toLocaleString('he-IL')} תוצאות`
              : ''}
      </p>

      {books && !query && categories.length > 0 && (
        <div className="browse">
          <h3>או דפדפו לפי קטגוריה</h3>
          <div className="chips">
            {categories.map(([c, n]) => (
              <button key={c} type="button" className="chip" onClick={() => browseCategory(c)}>
                {c}<small>{n.toLocaleString('he-IL')}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={resultsRef} />
      {results && (
        <div className="results">
          <div className="results-head">
            <h2>תוצאות חיפוש</h2>
            <label className="sort">מיון לפי:
              <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); setShown(PAGE); }}>
                <option value="title">שם הספר (א-ת)</option>
                <option value="author">מחבר (א-ת)</option>
                <option value="price-asc">מחיר: מהזול ליקר</option>
                <option value="price-desc">מחיר: מהיקר לזול</option>
                <option value="year-desc">שנת הוצאה: מהחדש</option>
              </select>
            </label>
          </div>

          {results.length === 0 ? (
            <p className="search-hint">לא נמצאו ספרים מתאימים. נסו מילה אחרת או חלק משם המחבר.</p>
          ) : (
            <ul className="book-grid">
              {results.slice(0, shown).map((b, i) => {
                const r = b.row;
                return (
                  <li
                    key={i}
                    className={b.out ? 'book-card clickable is-out' : 'book-card clickable'}
                    role="button"
                    tabIndex={0}
                    aria-label={`פרטים על ${r[T]}`}
                    onClick={() => setOpen(b)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(b); } }}
                  >
                    <div className="book-cover">
                      <CoverImg src={b.cover} alt={`כריכת ${r[T]}`} />
                    </div>
                    <div className="book-info">
                      <h3 className="book-title">{r[T]}</h3>
                      {r[A] && <div className="book-author">{r[A]}</div>}
                      {(r[PUB] || r[Y]) && <div className="book-meta">{[r[PUB], r[Y]].filter(Boolean).join(', ')}</div>}
                      {b.cats.length > 0 && (
                        <div className="book-meta">{b.cats.join(', ')}{b.subs.length ? ` · ${b.subs.join(', ')}` : ''}</div>
                      )}
                      <div className="book-bottom">
                        {b.out ? <span className="badge out">לא במלאי</span> : (
                          <>
                            <span className="book-price">{formatPrice(r[P])}</span>
                            {r[COND] && <span className={condClass(r[COND])}>{r[COND]}</span>}
                          </>
                        )}
                      </div>
                      {!b.out && <ListToggle inList={inList.has(itemId(r))} onToggle={() => toggleItem(r)} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {results.length > shown && (
            <button className="more" type="button" onClick={() => setShown(shown + PAGE)}>
              הצג עוד ({(results.length - shown).toLocaleString('he-IL')} נוספים)
            </button>
          )}
        </div>
      )}
      {open && <BookDialog row={open.row} cover={open.cover} cats={open.cats} subs={open.subs} onClose={closeDialog} />}
      <ReadingList />
    </div>
  );
}
