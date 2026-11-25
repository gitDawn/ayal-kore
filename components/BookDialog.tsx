'use client';

// Details of one book, opened by clicking a search result: large cover, details and,
// when one was saved, the book's description.
import { useEffect, useState } from 'react';
import { A, COND, P, PUB, T, Y, formatPrice, inStock, type BookRow } from '@/lib/inventory';
import { rowKey } from '@/lib/categories';
import { fetchDescription } from '@/lib/descriptions';
import CoverImg from '@/components/CoverImg';
import { ListToggle } from '@/components/ReadingList';
import { itemId, toggleItem, useReadingList } from '@/lib/readingList';
import Link from 'next/link';
import { SITE_URL, bookPath } from '@/lib/bookUrl';
import WhatsAppButton from '@/components/WhatsAppButton';

export default function BookDialog({ row, cover, cats, subs, onClose }: {
  row: BookRow;
  cover?: string;
  cats: string[];
  subs: string[];
  onClose: () => void;
}) {
  const [desc, setDesc] = useState<string | null | undefined>(undefined); // undefined = loading
  const list = useReadingList();
  const available = inStock(row);

  useEffect(() => {
    let live = true;
    fetchDescription(rowKey(row)).then((d) => { if (live) setDesc(d); }).catch(() => { if (live) setDesc(null); });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { live = false; window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [row, onClose]);

  return (
    <div className="book-dialog-back" onClick={onClose}>
      <div className="book-dialog" role="dialog" aria-modal="true" aria-label={row[T]} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="book-dialog-close" aria-label="סגירה" onClick={onClose}>×</button>
        <div className="book-dialog-cover"><CoverImg src={cover} alt={`כריכת ${row[T]}`} /></div>
        <div className="book-dialog-body">
          <h2>{row[T]}</h2>
          {row[A] && <div className="book-author">{row[A]}</div>}
          {(row[PUB] || row[Y]) && <div className="book-meta">{[row[PUB], row[Y]].filter(Boolean).join(', ')}</div>}
          {cats.length > 0 && <div className="book-meta">{cats.join(', ')}{subs.length ? ` · ${subs.join(', ')}` : ''}</div>}
          <div className="book-bottom">
            {available ? (
              <>
                <span className="book-price">{formatPrice(row[P])}</span>
                {row[COND] && <span className="badge">{row[COND]}</span>}
              </>
            ) : <span className="badge out">לא במלאי כרגע</span>}
          </div>
          <Link className="book-page-link" href={bookPath(row)}>לעמוד הספר (קישור לשיתוף)</Link>
          {available && <ListToggle big inList={list.some((i) => i.id === itemId(row))} onToggle={() => toggleItem(row)} />}
          <WhatsAppButton title={row[T]} author={row[A] || ''} price={row[P]} condition={row[COND] || ''} url={SITE_URL + encodeURI(bookPath(row))} outOfStock={!available} />
          {desc === undefined ? null : desc ? (
            <div className="book-desc">
              <h3>על הספר</h3>
              <p>{desc}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
