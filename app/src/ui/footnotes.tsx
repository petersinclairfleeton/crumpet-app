// Footnotes: a small number in the text (Ctrl+Alt+F or "/footnote" adds one),
// with what it says written in a little card beside it, and listed under the
// note so they can be read all together.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { type Doc, type Pos, footnotes } from '@crumpet/editor/model';

interface Open {
  at: Pos;
  text: string;
  el: HTMLElement;
}

/** The card for writing a footnote, opened by clicking its number (or adding one). */
export function FootnoteCard({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [value, setValue] = useState('');
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const latest = useRef({ open, value });
  latest.current = { open, value };

  useEffect(() => {
    if (!editor) return;
    editor.onFootnoteClick = (pos, text, el) => {
      setOpen({ at: pos, text, el });
      setValue(text);
    };
    return () => {
      editor.onFootnoteClick = null;
    };
  }, [editor]);

  /** Saves (an emptied footnote is taken out) and goes back to the text after it. */
  const close = (save: boolean) => {
    const { open: o, value: v } = latest.current;
    if (!editor || !o) return;
    setOpen(null);
    const text = v.replace(/\s+/g, ' ').trim();
    // Esc on a new footnote takes it out again; saving an empty one does too.
    const gone = save ? !text : !o.text;
    if (gone) editor.setFootnote(o.at, null);
    else if (save) editor.setFootnote(o.at, text);
    editor.focusPos({ block: o.at.block, offset: o.at.offset + (gone ? 0 : 1) });
  };

  useLayoutEffect(() => {
    if (!open) return setAt(null);
    const r = open.el.getBoundingClientRect();
    const w = Math.min(340, window.innerWidth - 16);
    const h = card.current?.offsetHeight ?? 150;
    const below = r.bottom + 8 + h < window.innerHeight;
    setAt({ top: below ? r.bottom + 8 : Math.max(8, r.top - 8 - h), left: Math.min(window.innerWidth - w - 8, Math.max(8, r.left - 20)) });
  }, [open]);

  // Into the card once it's in place (it can't take the focus while hidden).
  useEffect(() => {
    if (!at || !field.current || field.current === document.activeElement) return;
    field.current.focus();
    field.current.setSelectionRange(field.current.value.length, field.current.value.length);
  }, [at]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (card.current && !card.current.contains(e.target as Node)) close(true);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  });

  if (!open) return null;
  const n = (editor ? footnotes(editor.state.doc).findIndex((f) => f.block === open.at.block && f.offset === open.at.offset) : -1) + 1;
  return createPortal(
    <div ref={card} className="footnote-card" role="dialog" aria-label={`Footnote ${n}`} style={at ? { top: at.top, left: at.left } : { visibility: 'hidden', top: 0, left: 0 }}>
      <label className="footnote-head">
        <span>Footnote {n}</span>
        <textarea
          ref={field}
          rows={3}
          value={value}
          placeholder="What the footnote says"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              close(true);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              close(false);
            }
          }}
        />
      </label>
      <div className="footnote-actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setValue('');
            latest.current.value = '';
            close(true);
          }}
        >
          Remove
        </button>
        <span className="grow" />
        <button type="button" className="btn primary" onClick={() => close(true)}>
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** The note's footnotes, listed under it; clicking one opens it. */
export function FootnoteList({ doc, editor }: { doc: Doc; editor: Editor | null }) {
  const list = footnotes(doc);
  if (!list.length) return null;
  return (
    <section className="footnote-list" aria-label="Footnotes">
      <ol>
        {list.map((f) => (
          <li key={`${f.block}:${f.offset}`}>
            <button
              type="button"
              onClick={() => {
                const el = editor?.footnoteElement(f);
                if (!editor || !el) return;
                el.scrollIntoView({ block: 'center' });
                editor.onFootnoteClick?.({ block: f.block, offset: f.offset }, f.text, el);
              }}
            >
              {f.text || <em>Empty footnote</em>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
