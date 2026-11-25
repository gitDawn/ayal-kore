'use client';

// Staff tab: add, edit, order and remove recommendations (a Facebook video or a picture, and the books from it).
import { useCallback, useEffect, useRef, useState } from 'react';
import FacebookVideo from '@/components/FacebookVideo';
import VideoScan from '@/components/VideoScan';
import { formatPrice } from '@/lib/inventory';
import {
  cleanPostUrl, cleanVideoUrl, deleteRecommendation, fetchAllRecommendations, findBooks, imageUrl, prepareImage,
  removeImage, saveOrder, saveRecommendation, uploadImage,
  type BookHit, type PreparedImage, type Recommendation,
} from '@/lib/recommendations';
import '@/app/recommendations/recommendations.css';

type Media = 'video' | 'image';
/** The picture: either the stored one (path) or a new one waiting to be uploaded on save (prepared). */
interface DraftImage { path: string | null; prepared: PreparedImage | null; preview: string; width: number; height: number; }
interface Draft {
  id: string | null; title: string; text: string; media: Media; video: string; vertical: boolean;
  image: DraftImage | null; oldImage: string | null; post: string; published: boolean; books: BookHit[];
}
const EMPTY: Draft = { id: null, title: '', text: '', media: 'video', video: '', vertical: true, image: null, oldImage: null, post: '', published: true, books: [] };

export default function RecommendationsAdmin() {
  const [list, setList] = useState<Recommendation[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    fetchAllRecommendations().then(setList).catch(() => { setList([]); setMsg({ ok: false, text: 'לא הצלחנו לטעון את ההמלצות.' }); });
  }, []);
  useEffect(reload, [reload]);

  async function edit(r: Recommendation) {
    setMsg(null);
    const books = await findBooks({ ids: r.book_ids }).catch(() => []);
    setDraft({
      id: r.id, title: r.title, text: r.text || '', media: r.image_path ? 'image' : 'video', video: r.video_url || '', vertical: r.vertical,
      image: r.image_path ? { path: r.image_path, prepared: null, preview: imageUrl(r.image_path), width: r.image_width || 0, height: r.image_height || 0 } : null,
      oldImage: r.image_path, post: r.post_url || '', published: r.published, books,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(r: Recommendation) {
    if (!window.confirm(`למחוק את ההמלצה "${r.title}"? אי אפשר לבטל את המחיקה.`)) return;
    setBusy(true); setMsg(null);
    try { await deleteRecommendation(r); setMsg({ ok: true, text: 'ההמלצה נמחקה.' }); reload(); }
    catch { setMsg({ ok: false, text: 'המחיקה לא הצליחה.' }); }
    finally { setBusy(false); }
  }

  async function move(i: number, dir: -1 | 1) {
    if (!list) return;
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next); setBusy(true);
    try { await saveOrder(next.map((r) => r.id)); } catch { setMsg({ ok: false, text: 'שמירת הסדר לא הצליחה.' }); reload(); }
    finally { setBusy(false); }
  }

  return (
    <>
      {draft ? (
        <Editor
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          onCancel={() => { setDraft(null); setMsg(null); }}
          onSave={async (d) => {
            setBusy(true); setMsg(null);
            let uploaded: string | null = null;
            try {
              const top = list && list.length ? Math.min(...list.map((r) => r.position)) - 1 : 0;
              const isImage = d.media === 'image' && !!d.image;
              let path = isImage ? d.image!.path : null;
              if (isImage && d.image!.prepared) path = uploaded = await uploadImage(d.image!.prepared.blob);
              await saveRecommendation(d.id, {
                title: d.title.trim(), text: d.text.trim() || null,
                video_url: isImage ? null : cleanVideoUrl(d.video)!, vertical: d.vertical,
                image_path: path, image_width: isImage ? d.image!.width : null, image_height: isImage ? d.image!.height : null,
                post_url: isImage ? cleanPostUrl(d.post) : null,
                published: d.published, book_ids: d.books.map((b) => b.id),
              }, top);
              // The old picture is no longer used once the new one (or a video) is saved.
              if (d.oldImage && d.oldImage !== path) await removeImage(d.oldImage).catch(() => {});
              if (d.image?.prepared) URL.revokeObjectURL(d.image.preview);
              setDraft(null);
              setMsg({ ok: true, text: d.published ? 'נשמר. ההמלצה מופיעה עכשיו בעמוד ההמלצות.' : 'נשמר כטיוטה (לא מוצג באתר).' });
              reload();
            } catch {
              if (uploaded) await removeImage(uploaded).catch(() => {});
              setMsg({ ok: false, text: 'השמירה לא הצליחה. בדקו את הקישור ונסו שוב.' });
            }
            finally { setBusy(false); }
          }}
        />
      ) : (
        <section className="panel">
          <h2>המלצות</h2>
          <p className="sub">סרטון מפייסבוק שמתנגן באתר או תמונה, ומתחתיהם הספרים שמופיעים בהם. ההמלצה העליונה מוצגת ראשונה.</p>
          <button className="btn dark" type="button" onClick={() => { setDraft({ ...EMPTY }); setMsg(null); }}>+ המלצה חדשה</button>
        </section>
      )}

      {msg && <p className={msg.ok ? 'msg ok' : 'msg err'} role="status">{msg.text}</p>}

      <section className="panel">
        <h2>ההמלצות באתר</h2>
        {!list ? <p className="status">טוען…</p> : list.length === 0 ? <p className="msg info">עדיין אין המלצות.</p> : (
          <ul className="rec-admin-list">
            {list.map((r, i) => (
              <li key={r.id}>
                <div>
                  <b>{r.title}</b>{!r.published && <span className="rec-draft-tag">טיוטה</span>}
                  <span>{r.book_ids.length} ספרים · {r.image_path
                    ? <a href={imageUrl(r.image_path)} target="_blank" rel="noopener noreferrer">התמונה</a>
                    : <a href={r.video_url || '#'} target="_blank" rel="noopener noreferrer">הסרטון</a>}</span>
                </div>
                <div className="rec-admin-actions">
                  <button className="btn ghost" type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="למעלה">↑</button>
                  <button className="btn ghost" type="button" disabled={busy || i === list.length - 1} onClick={() => move(i, 1)} aria-label="למטה">↓</button>
                  <button className="btn ghost" type="button" disabled={busy} onClick={() => edit(r)}>עריכה</button>
                  <button className="btn ghost" type="button" disabled={busy} onClick={() => remove(r)}>מחיקה</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="sub" style={{ margin: '12px 0 0' }}><a href="/recommendations" target="_blank" rel="noopener noreferrer">לעמוד ההמלצות באתר ↗</a></p>
      </section>
    </>
  );
}

function Editor({ draft, setDraft, busy, onCancel, onSave }: {
  draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft | null>>; busy: boolean; onCancel: () => void; onSave: (d: Draft) => void;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<BookHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);
  const [imgErr, setImgErr] = useState('');
  const [preparing, setPreparing] = useState(false);
  const video = cleanVideoUrl(draft.video);
  const post = cleanPostUrl(draft.post);
  const chosen = new Set(draft.books.map((b) => b.id));
  const mediaOk = draft.media === 'video' ? !!video : !!draft.image && (!draft.post.trim() || !!post);
  const canSave = !busy && !preparing && draft.title.trim().length > 0 && mediaOk;
  const isVideo = draft.media === 'video';

  async function pickImage(f: File | undefined) {
    if (!f) return;
    setImgErr('');
    if (!f.type.startsWith('image/')) { setImgErr('זה לא קובץ תמונה.'); return; }
    setPreparing(true);
    try {
      const p = await prepareImage(f);
      const preview = URL.createObjectURL(p.blob);
      setDraft((d) => {
        if (!d) return d;
        if (d.image?.prepared) URL.revokeObjectURL(d.image.preview);
        return { ...d, image: { path: null, prepared: p, preview, width: p.width, height: p.height } };
      });
    } catch {
      setImgErr('לא הצלחתי לעבד את התמונה. נסו תמונה אחרת.');
    } finally {
      setPreparing(false);
    }
  }

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    const n = ++seq.current;
    setSearching(true);
    try { const r = await findBooks({ q }); if (n === seq.current) setHits(r); }
    catch { if (n === seq.current) setHits([]); }
    finally { if (n === seq.current) setSearching(false); }
  }

  // Functional update, so several books can be added in one click.
  const add = (b: BookHit) => setDraft((d) => (!d || d.books.some((x) => x.id === b.id) ? d : { ...d, books: [...d.books, b] }));
  const drop = (id: string) => setDraft({ ...draft, books: draft.books.filter((b) => b.id !== id) });

  return (
    <section className="panel stack">
      <h2>{draft.id ? 'עריכת המלצה' : 'המלצה חדשה'}</h2>

      <label className="field">כותרת
        <input value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="למשל: כלכלה מכל הכיוונים" />
      </label>
      <div className="rec-media" role="radiogroup" aria-label="סוג ההמלצה">
        <label><input type="radio" name="rec-media" checked={isVideo} onChange={() => setDraft({ ...draft, media: 'video' })} /> סרטון מפייסבוק</label>
        <label><input type="radio" name="rec-media" checked={!isVideo} onChange={() => setDraft({ ...draft, media: 'image' })} /> תמונה</label>
      </div>

      {isVideo ? (
        <>
          <label className="field">קישור לסרטון בפייסבוק
            <input dir="ltr" value={draft.video} onChange={(e) => setDraft({ ...draft, video: e.target.value })} placeholder="https://www.facebook.com/reel/..." />
          </label>
          {draft.video && !video && <p className="msg err">זה לא נראה כמו קישור לסרטון בפייסבוק.</p>}
          <label className="rec-check">
            <input type="checkbox" checked={draft.vertical} onChange={(e) => setDraft({ ...draft, vertical: e.target.checked })} />
            סרטון לאורך (רילס). בטלו את הסימון לסרטון רגיל לרוחב.
          </label>
          {video && <div className="rec-preview"><FacebookVideo key={`${video}|${draft.vertical}`} href={video} title="תצוגה מקדימה" vertical={draft.vertical} /></div>}
        </>
      ) : (
        <>
          <label className="field">{draft.image ? 'החלפת התמונה' : 'התמונה'}
            <input type="file" accept="image/*" onChange={(e) => { void pickImage(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {preparing && <p className="status" style={{ textAlign: 'start' }}>מכין את התמונה…</p>}
          {imgErr && <p className="msg err">{imgErr}</p>}
          {draft.image && (
            <div className="rec-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rec-image" src={draft.image.preview} alt="תצוגה מקדימה" width={draft.image.width || undefined} height={draft.image.height || undefined} />
            </div>
          )}
          {draft.image?.prepared && (
            <p className="sub" style={{ margin: 0 }}>
              התמונה הוקטנה ל־{draft.image.width}×{draft.image.height} ({Math.round(draft.image.prepared.blob.size / 1024)} קילובייט). היא תעלה לאתר רק בשמירה.
            </p>
          )}
          <label className="field">קישור לפוסט המקורי בפייסבוק (לא חובה)
            <input dir="ltr" value={draft.post} onChange={(e) => setDraft({ ...draft, post: e.target.value })} placeholder="https://www.facebook.com/..." />
          </label>
          {draft.post.trim() && !post && <p className="msg err">זה לא נראה כמו קישור לפייסבוק.</p>}
        </>
      )}
      <label className="field">כמה מילים על ההמלצה (לא חובה)
        <textarea rows={3} maxLength={1000} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
      </label>

      <div className="stack" style={{ gap: 8 }}>
        <b>{isVideo ? 'הספרים מהסרטון' : 'הספרים מהתמונה'} ({draft.books.length})</b>
        {draft.books.length === 0 ? <p className="sub" style={{ margin: 0 }}>עדיין לא נבחרו ספרים. חפשו למטה והוסיפו.</p> : (
          <ul className="rec-pick chosen">
            {draft.books.map((b) => (
              <li key={b.id}>
                <span><b>{b.title}</b>{b.author ? `, ${b.author}` : ''} · {formatPrice(b.price)}{b.condition ? ` · ${b.condition}` : ''}</span>
                <button className="btn ghost" type="button" onClick={() => drop(b.id)}>הסרה</button>
              </li>
            ))}
          </ul>
        )}
        {isVideo && <VideoScan chosen={chosen} onAdd={add} />}
        <form className="rl-row" onSubmit={search}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש ספר במלאי לפי שם או מחבר" />
          <button className="btn" type="submit" disabled={searching || !q.trim()}>{searching ? '…' : 'חיפוש'}</button>
        </form>
        {hits && (hits.length === 0 ? <p className="msg info">לא נמצאו ספרים במלאי.</p> : (
          <ul className="rec-pick">
            {hits.map((b) => (
              <li key={b.id}>
                <span><b>{b.title}</b>{b.author ? `, ${b.author}` : ''} · {formatPrice(b.price)}{b.condition ? ` · ${b.condition}` : ''}{b.copies > 1 ? ` · ${b.copies} עותקים` : ''}</span>
                <button className="btn ghost" type="button" disabled={chosen.has(b.id)} onClick={() => add(b)}>{chosen.has(b.id) ? 'נבחר ✓' : 'הוספה'}</button>
              </li>
            ))}
          </ul>
        ))}
      </div>

      <label className="rec-check">
        <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} />
        להציג באתר (בלי סימון, נשמר כטיוטה)
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn dark" type="button" disabled={!canSave} onClick={() => onSave(draft)}>{busy ? 'שומר…' : 'שמירה'}</button>
        <button className="btn ghost" type="button" disabled={busy} onClick={onCancel}>ביטול</button>
      </div>
    </section>
  );
}
