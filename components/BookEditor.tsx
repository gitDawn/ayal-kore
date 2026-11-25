'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import './BookEditor.css';
import { supabase } from '@/lib/supabase';
import { A, COND, P, PUB, T, Y, norm, type BookRow } from '@/lib/inventory';
import { cleanList, fetchCategoryEdits, fileCategories, type CategoryEdit } from '@/lib/categories';
import { bookRef, loadUniqueBooks, type Book } from '@/lib/catalog-client';
import { fetchSimaniaItems, type SimaniaItem } from '@/lib/simania';
import { bookCopies, saveCopyPrices } from '@/lib/inventory-edit';
import CoverCropper from '@/components/CoverCropper';
import { rotateCover } from '@/lib/rotate';
import { coverUrl, fetchCoverRows, markNoCover, saveCover, toSmallImage } from '@/lib/covers';

const MAX_RESULTS = 40;

/** Plain Google image search for "title" + "author" (opens in a new tab; uses no API quota). */
function googleImages(title: string, author: string) {
  const q = [title, author].map((x) => (x || '').replace(/["״]/g, '').trim()).filter(Boolean).map((x) => `"${x}"`).join(' + ');
  return `https://www.google.com/search?udm=2&q=${encodeURIComponent(q)}`;
}

export default function BookEditor({ initialKey = null }: { initialKey?: string | null }) {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [edits, setEdits] = useState<Map<string, CategoryEdit>>(new Map());
  const [loadErr, setLoadErr] = useState('');
  const [text, setText] = useState('');
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [selected, setSelected] = useState<string | null>(initialKey);
  const [covers, setCovers] = useState<Map<string, string>>(new Map()); // book_key → file path

  useEffect(() => {
    (async () => {
      try {
        const [list, ed, cv] = await Promise.all([loadUniqueBooks(), fetchCategoryEdits(), fetchCoverRows(true)]);
        setBooks(list);
        setEdits(ed);
        setCovers(new Map(cv.filter((r) => r.path).map((r) => [r.book_key, r.path as string])));
      } catch {
        setLoadErr('לא הצלחנו לטעון את רשימת הספרים. רעננו את הדף ונסו שוב.');
      }
    })();
  }, []);

  // Every category and subcategory in use (from the file and from edits), for suggestions.
  const vocab = useMemo(() => {
    const cats = new Set<string>();
    const subs = new Set<string>();
    if (books) for (const b of books) {
      const c = fileCategories(b.row);
      c.categories.forEach((x) => cats.add(x));
      c.subcategories.forEach((x) => subs.add(x));
    }
    edits.forEach((e) => { e.categories.forEach((x) => cats.add(x)); e.subcategories.forEach((x) => subs.add(x)); });
    const sort = (s: Set<string>) => [...s].sort((x, y) => x.localeCompare(y, 'he'));
    return { cats: sort(cats), subs: sort(subs) };
  }, [books, edits]);

  const results = useMemo(() => {
    if (!books) return [];
    const tokens = norm(text).split(' ').filter(Boolean);
    if (!tokens.length && !onlyEdited) return [];
    const out: Book[] = [];
    for (const b of books) {
      if (onlyEdited && !edits.has(b.key)) continue;
      const hay = b.t + ' ' + b.a;
      if (tokens.every((tok) => hay.includes(tok))) {
        out.push(b);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [books, edits, text, onlyEdited]);

  const current = selected && books ? books.find((b) => b.key === selected) ?? null : null;

  return (
    <section className="panel stack">
      <div>
        <h2>עריכת ספרים</h2>
        <p className="sub" style={{ margin: 0 }}>
          חפשו ספר כדי לשנות את הקטגוריות שלו או את תמונת הכריכה. אפשר כמה קטגוריות לכל ספר, ואפשר להקליד קטגוריה חדשה.
          השינוי חל על כל העותקים של אותו ספר ונשמר גם אחרי העלאת קובץ מלאי חדש.
        </p>
      </div>

      {loadErr && <p className="msg err">{loadErr}</p>}
      {!books && !loadErr && <p className="status">טוען ספרים…</p>}

      {books && (
        <>
          <div className="search-bar" style={{ margin: 0, maxWidth: 'none' }}>
            <input
              type="search"
              value={text}
              onChange={(e) => { setText(e.target.value); setSelected(null); }}
              placeholder="שם ספר או מחבר"
              aria-label="חיפוש ספר לעריכה"
            />
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <input type="checkbox" checked={onlyEdited} onChange={(e) => { setOnlyEdited(e.target.checked); setSelected(null); }} />
            רק ספרים שכבר נערכו ({edits.size.toLocaleString('he-IL')})
          </label>

          {current ? (
            <Editor
              key={current.key}
              book={current}
              edit={edits.get(current.key) ?? null}
              vocab={vocab}
              coverPath={covers.get(current.key) ?? null}
              onCover={(path) => {
                const next = new Map(covers);
                if (path) next.set(current.key, path); else next.delete(current.key);
                setCovers(next);
              }}
              onClose={() => setSelected(null)}
              onSaved={(e) => {
                const next = new Map(edits);
                if (e) next.set(e.book_key, e); else next.delete(current.key);
                setEdits(next);
              }}
            />
          ) : results.length > 0 ? (
            <ul className="edit-list">
              {results.map((b) => {
                const e = edits.get(b.key);
                const c = e ?? fileCategories(b.row);
                return (
                  <li key={b.key}>
                    <button type="button" onClick={() => setSelected(b.key)}>
                      <span className="t">{covers.has(b.key) && <span className="has-cover" title="יש כריכה">▣</span>}{b.row[T]}</span>
                      <span className="a">{b.row[A] || 'מחבר לא ידוע'}{b.copies > 1 ? ` · ${b.copies} עותקים` : ''}</span>
                      <span className="c">
                        {c.categories.join(', ') || 'בלי קטגוריה'}
                        {c.subcategories.length ? ` › ${c.subcategories.join(', ')}` : ''}
                        {e && <span className="edited-tag">נערך</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
              {results.length >= MAX_RESULTS && <li className="more-hint">מוצגות {MAX_RESULTS} התוצאות הראשונות. דייקו את החיפוש.</li>}
            </ul>
          ) : (text.trim() || onlyEdited) ? (
            <p className="status">לא נמצאו ספרים.</p>
          ) : null}
        </>
      )}
    </section>
  );
}

function Editor({ book, edit, vocab, coverPath, onCover, onClose, onSaved }: {
  book: Book;
  edit: CategoryEdit | null;
  vocab: { cats: string[]; subs: string[] };
  coverPath: string | null;
  onCover: (path: string | null) => void;
  onClose: () => void;
  onSaved: (e: CategoryEdit | null) => void;
}) {
  const fromFile = fileCategories(book.row);
  const [cats, setCats] = useState<string[]>(edit?.categories ?? fromFile.categories);
  const [subs, setSubs] = useState<string[]>(edit?.subcategories ?? fromFile.subcategories);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    const row: CategoryEdit = {
      book_key: book.key,
      title: book.row[T],
      author: book.row[A] || null,
      categories: cleanList(cats),
      subcategories: cleanList(subs),
    };
    const { error } = await supabase().from('book_categories').upsert(row, { onConflict: 'book_key' });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: /row-level|violates|permission/i.test(error.message) ? 'החשבון הזה לא מורשה לערוך.' : 'השמירה נכשלה. נסו שוב.' });
      return;
    }
    onSaved(row);
    setMsg({ ok: true, text: 'נשמר. השינוי מופיע באתר.' });
  }

  async function resetToFile() {
    setBusy(true); setMsg(null);
    const { error } = await supabase().from('book_categories').delete().eq('book_key', book.key);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: 'לא הצלחנו לבטל את העריכה. נסו שוב.' }); return; }
    setCats(fromFile.categories);
    setSubs(fromFile.subcategories);
    onSaved(null);
    setMsg({ ok: true, text: 'הספר חזר לקטגוריות שבקובץ המלאי.' });
  }

  return (
    <div className="editor stack">
      <div>
        <button type="button" className="linkish" onClick={onClose}>חזרה לרשימה</button>
        <h3 style={{ margin: '8px 0 2px' }}>{book.row[T]}</h3>
        <p className="sub" style={{ margin: 0 }}>
          {[book.row[A], book.row[PUB], book.row[Y]].filter(Boolean).join(' · ')}
          {book.copies > 1 ? ` · ${book.copies} עותקים במלאי` : ''}
        </p>
      </div>

      <SimaniaInfo bookKey={book.key} />

      <PriceEditor bookKey={book.key} title={book.row[T]} />

      <CoverEditor book={book} path={coverPath} onChange={onCover} />

      <TagInput label="קטגוריות" values={cats} onChange={setCats} suggestions={vocab.cats} listId="cat-suggest" />
      <TagInput label="תתי קטגוריות" values={subs} onChange={setSubs} suggestions={vocab.subs} listId="sub-suggest" />

      <p className="sub" style={{ margin: 0 }}>
        בקובץ המלאי: {fromFile.categories.join(', ') || 'בלי קטגוריה'}
        {fromFile.subcategories.length ? ` › ${fromFile.subcategories.join(', ')}` : ''}
      </p>

      {msg && <p className={msg.ok ? 'msg ok' : 'msg err'} role="status">{msg.text}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn dark" type="button" onClick={save} disabled={busy}>{busy ? 'שומר…' : 'שמירה'}</button>
        {edit && (
          <button className="btn ghost" type="button" onClick={resetToFile} disabled={busy}>החזרה לקטגוריות מהקובץ</button>
        )}
      </div>
    </div>
  );
}

function TagInput({ label, values, onChange, suggestions, listId }: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  listId: string;
}) {
  const [draft, setDraft] = useState('');

  function add(v: string) {
    const clean = cleanList([...values, v]);
    onChange(clean);
    setDraft('');
  }

  const isNew = draft.trim() !== '' && !suggestions.includes(draft.trim());

  return (
    <div className="field">
      {label}
      <div className="tags">
        {values.map((v) => (
          <span key={v} className="tag">
            {v}
            <button type="button" aria-label={`הסרת ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>×</button>
          </span>
        ))}
        {values.length === 0 && <span className="tag-empty">אין</span>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          list={listId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (draft.trim()) add(draft); } }}
          placeholder="בחרו מהרשימה או הקלידו חדשה"
          style={{ flex: 1 }}
        />
        <button className="btn ghost" type="button" disabled={!draft.trim()} onClick={() => add(draft)}>
          {isNew ? 'הוספת חדשה' : 'הוספה'}
        </button>
      </div>
      <datalist id={listId}>
        {suggestions.map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}

function CoverEditor({ book, path, onChange }: { book: Book; path: string | null; onChange: (p: string | null) => void }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [zoom, setZoom] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // Photo waiting in the crop step. Camera photos get automatic corner detection;
  // gallery images start with the whole image selected.
  const [pending, setPending] = useState<{ file: File; detect: boolean } | null>(null);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setMsg(null);
    try { await fn(); } catch (e) {
      const m = (e as { message?: string })?.message || '';
      setMsg({ ok: false, text: /row-level|violates|permission|unauthorized/i.test(m) ? 'החשבון הזה לא מורשה לשנות כריכות.' : 'הפעולה נכשלה. נסו שוב.' });
    } finally { setBusy(''); }
  }

  const pick = (file: File, detect: boolean) => {
    if (!file.type.startsWith('image/')) { setMsg({ ok: false, text: 'יש לבחור קובץ תמונה.' }); return; }
    setMsg(null);
    setPending({ file, detect });
  };

  const upload = (img: ImageBitmap) => run('upload', async () => {
    const blob = await toSmallImage(img, 600);
    const p = await saveCover(bookRef(book), blob, 'staff', { hq: img.width >= 450 }, path);
    onChange(p);
    setMsg({ ok: true, text: `הכריכה נשמרה (${Math.max(1, Math.round(blob.size / 1024))} קילובייט).` });
  });

  const rotate = () => run('rotate', async () => {
    if (!path) return;
    const p = await rotateCover(book.key, path);
    onChange(p);
    setMsg({ ok: true, text: 'הכריכה סובבה ב-180 מעלות. לחיצה נוספת מחזירה אותה.' });
  });

  const remove = () => run('remove', async () => {
    await markNoCover(bookRef(book), 'removed', {}, path);
    onChange(null);
    setMsg({ ok: true, text: 'הכריכה הוסרה. הייבוא האוטומטי לא יחזיר אותה.' });
  });

  return (
    <div className="cover-edit">
      <div className="cover-box">
        {path ? (
          <button type="button" className="cover-zoom" onClick={() => setZoom(true)} title="הגדלת הכריכה" aria-label="הגדלת הכריכה">
            <img src={coverUrl(path)} alt="" />
            <span className="zoom-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" />
              </svg>
            </span>
          </button>
        ) : <span>אין כריכה</span>}
      </div>
      {pending && (
        <CoverCropper
          file={pending.file}
          detect={pending.detect}
          onCancel={() => setPending(null)}
          onDone={(img) => { setPending(null); upload(img); }}
        />
      )}
      {zoom && path && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`כריכת ${book.row[T]}`} onClick={() => setZoom(false)}>
          <img src={coverUrl(path)} alt={`כריכת ${book.row[T]}`} />
          <button type="button" className="lightbox-close" aria-label="סגירה" onClick={() => setZoom(false)}>×</button>
        </div>
      )}
      <div className="stack" style={{ gap: 8 }}>
        <strong style={{ fontSize: 15 }}>תמונת כריכה</strong>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn ghost" type="button" disabled={!!busy} onClick={() => cameraRef.current?.click()}>
            {busy === 'upload' ? 'מעלה…' : 'צילום כריכה'}
          </button>
          <button className="btn ghost" type="button" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            {path ? 'החלפה מהגלריה' : 'העלאה מהגלריה'}
          </button>
          <a className="btn ghost" href={googleImages(book.row[T], book.row[A] || '')} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            חיפוש בגוגל ↗
          </a>
          {path && (
            <button className="btn ghost" type="button" disabled={!!busy} onClick={rotate}>
              {busy === 'rotate' ? 'מסובב…' : 'סיבוב 180°'}
            </button>
          )}
          {path && (
            <button className="btn ghost" type="button" disabled={!!busy} onClick={remove}>
              {busy === 'remove' ? 'מסיר…' : 'הסרה'}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f, false); }}
        />
        {/* Opens the camera directly on phones (the gallery picker on newer Android may not offer it). */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f, true); }}
        />
        <span className="sub" style={{ margin: 0, fontSize: 13 }}>בטלפון, "צילום כריכה" פותח את המצלמה. אחרי הצילום אפשר לחתוך, ליישר ולתקן את התמונה.</span>
        {msg && <p className={msg.ok ? 'msg ok' : 'msg err'} role="status" style={{ margin: 0 }}>{msg.text}</p>}
      </div>
    </div>
  );
}

const fmtDay = (s: string) => new Date(s).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', year: 'numeric' });

function ago(s: string) {
  const days = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  if (days < 1) return 'היום';
  if (days < 2) return 'אתמול';
  if (days < 31) return `לפני ${days} ימים`;
  const months = Math.floor(days / 30.4);
  if (months < 12) return months === 1 ? 'לפני חודש' : `לפני ${months} חודשים`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'לפני שנה' : `לפני ${years} שנים`;
}

/** The book's copies as listed in Simania: price, condition, last update and Simania's tags. */
function SimaniaInfo({ bookKey }: { bookKey: string }) {
  const [items, setItems] = useState<SimaniaItem[] | null>(null);
  useEffect(() => { fetchSimaniaItems(bookKey).then(setItems); }, [bookKey]);
  if (!items || items.length === 0) return null;
  return (
    <div className="simania-info">
      <strong>בסימניה</strong>
      <ul>
        {items.map((i) => (
          <li key={i.owned_id}>
            <span>{i.price != null ? `${i.price} ₪` : ''}{i.condition ? ` · ${i.condition}` : ''}</span>
            {i.simania_updated_at && <span className="when">עודכן {fmtDay(i.simania_updated_at)} ({ago(i.simania_updated_at)})</span>}
            {i.tags.map((t) => <span key={t} className={`stag stag-${t}`}>{t}</span>)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Price of each copy of the book in the current inventory. Saving creates a new inventory version. */
function PriceEditor({ bookKey, title }: { bookKey: string; title: string }) {
  const [copies, setCopies] = useState<BookRow[] | null>(null);
  const [prices, setPrices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    bookCopies(bookKey).then((c) => { setCopies(c); setPrices(c.map((r) => String(r[P]))); }).catch(() => setCopies([]));
  }, [bookKey]);

  if (!copies) return <p className="status" style={{ textAlign: 'start', margin: 0 }}>טוען מחירים…</p>;
  if (copies.length === 0) return null;

  const parsed = prices.map((v) => Number(v.replace(',', '.')));
  const dirty = copies.some((r, i) => parsed[i] !== r[P]);
  const valid = parsed.every((n) => Number.isFinite(n) && n >= 0);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const n = await saveCopyPrices(bookKey, title, parsed);
      const fresh = await bookCopies(bookKey);
      setCopies(fresh); setPrices(fresh.map((r) => String(r[P])));
      setMsg({ ok: true, text: n ? 'המחיר נשמר ומופיע באתר.' : 'לא היה שינוי לשמור.' });
    } catch (e) {
      const m = (e as { message?: string })?.message || '';
      setMsg({ ok: false, text: /row-level|violates|permission/i.test(m) ? 'החשבון הזה לא מורשה לשנות מחירים.' : 'השמירה נכשלה. נסו שוב.' });
    } finally { setBusy(false); }
  }

  return (
    <div className="field price-edit">
      מחיר
      <ul>
        {copies.map((r, i) => (
          <li key={i}>
            {copies.length > 1 && <span className="copy-n">עותק {i + 1}</span>}
            <input
              type="number" inputMode="decimal" min={0} step="1" value={prices[i] ?? ''}
              onChange={(e) => setPrices(prices.map((v, j) => (j === i ? e.target.value : v)))}
              aria-label={`מחיר עותק ${i + 1}`}
            />
            <span>₪</span>
            {r[COND] && <span className="cond">{r[COND]}</span>}
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn dark" type="button" disabled={busy || !dirty || !valid} onClick={save}>{busy ? 'שומר…' : 'שמירת מחיר'}</button>
        <span className="sub" style={{ margin: 0, fontSize: 12 }}>ייבוא מסימניה יחליף את המחיר במחיר שבסימניה.</span>
      </div>
      {msg && <p className={msg.ok ? 'msg ok' : 'msg err'} role="status" style={{ margin: 0 }}>{msg.text}</p>}
    </div>
  );
}
