'use client';

// A list of tags (categories, subcategories) with suggestions: remove with ×, add from the list or type a new one.
import { useState } from 'react';
import './BookEditor.css';
import { cleanList } from '@/lib/categories';

export default function TagInput({ label, values, onChange, suggestions, listId }: {
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
