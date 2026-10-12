// Comparing two notes or chapters (from the command palette, like Word's
// Compare): the differences shown, with the two swapped round, or made into a
// new note where they're tracked changes to accept or reject one by one. And
// Word's Combine: several reviewers' copies of a document made into one, each
// reviewer's changes tracked in their name.

import { useAppState, useAppStore } from './hooks';
import { CompareDialog } from './snapshots';
import { combinedComparison, plainText, trackedComparison } from '../data/compare';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './icons';
import { displayTitle } from '../data/selectors';
import { usePanes } from './panes';

export function CompareDocs({ a, b, onSwap, onClose }: { a: string; b: string; onSwap(): void; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const panes = usePanes();
  const find = (id: string) => {
    const n = state.notes.find((x) => x.id === id);
    if (n) return { title: displayTitle(n), doc: n.doc };
    const c = state.chapters.find((x) => x.id === id);
    return c ? { title: c.title.trim() || 'Untitled chapter', doc: c.doc } : null;
  };
  const from = find(a);
  const to = find(b);
  if (!from || !to) return null;
  return (
    <CompareDialog
      label="Compare documents"
      title={
        <>
          From “{from.title}” to “{to.title}”
        </>
      }
      before={plainText(from.doc)}
      after={plainText(to.doc)}
      onClose={onClose}
      actions={
        <span className="compare-actions">
          <button type="button" className="btn quiet small" onClick={onSwap}>
            Swap
          </button>
          <button
            type="button"
            className="btn small"
            title="A new note with the differences as tracked changes, to accept or reject one by one"
            onClick={() => {
              const n = store.createNote({ title: `${from.title} → ${to.title} (compared)`, doc: trackedComparison(from.doc, to.doc, state.settings.name.trim() || 'Compare') });
              panes.open({ kind: 'note', id: n.id });
              onClose();
            }}
          >
            Make a copy with tracked changes
          </button>
        </span>
      }
    />
  );
}

const OPEN = 'crumpet-open-combine';

/** Opens Combine for a note or chapter (the original). */
export function openCombine(original: string): void {
  window.dispatchEvent(new CustomEvent(OPEN, { detail: original }));
}

export function CombineHost() {
  const [original, setOriginal] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: Event) => setOriginal((e as CustomEvent<string>).detail);
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  return original ? <CombineDialog original={original} onClose={() => setOriginal(null)} /> : null;
}

/** Choosing the reviewers' copies (any notes or chapters), with each reviewer's name. */
function CombineDialog({ original, onClose }: { original: string; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const panes = usePanes();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const panel = useRef<HTMLFormElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    panel.current?.querySelector('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const docs = [
    ...state.notes.filter((n) => !n.trashedAt && !n.file).map((n) => ({ id: n.id, title: displayTitle(n), doc: n.doc })),
    ...state.chapters.map((c) => ({ id: c.id, title: c.title.trim() || 'Untitled chapter', doc: c.doc })),
  ];
  const base = docs.find((d) => d.id === original);
  if (!base) return null;
  const q = query.trim().toLowerCase();
  const others = docs.filter((d) => d.id !== original && (!q || d.title.toLowerCase().includes(q) || d.id in chosen));
  const picked = Object.entries(chosen);
  const combine = () => {
    const copies = picked.map(([id, name]) => ({ doc: docs.find((d) => d.id === id)!.doc, author: name.trim() || docs.find((d) => d.id === id)!.title }));
    const n = store.createNote({ title: `${base.title} (combined)`, doc: combinedComparison(base.doc, copies) });
    panes.open({ kind: 'note', id: n.id });
    onClose();
  };
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        ref={panel}
        className="dialog para-dialog combine-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Combine reviewers’ copies"
        onSubmit={(e) => {
          e.preventDefault();
          if (picked.length) combine();
        }}
      >
        <header className="dialog-head">
          <h2>Combine reviewers’ copies</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <p className="sync-hint">
            A new note: “{base.title}” with each reviewer’s changes tracked in their name, to accept or reject one by one. Choose their copies (notes or chapters, from Word files they sent back, say) and who each is from.
          </p>
          <input className="combine-search" aria-label="Find a copy" placeholder="Find a note or chapter" value={query} onChange={(e) => setQuery(e.target.value)} />
          <ul className="combine-list" aria-label="Copies">
            {others.slice(0, 60).map((d) => (
              <li key={d.id}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={d.id in chosen}
                    onChange={(e) => {
                      const next = { ...chosen };
                      if (e.target.checked) next[d.id] = '';
                      else delete next[d.id];
                      setChosen(next);
                    }}
                  />
                  <span className="grow">{d.title}</span>
                </label>
                {d.id in chosen && <input aria-label={`Reviewer of ${d.title}`} placeholder="Reviewer’s name" value={chosen[d.id]} onChange={(e) => setChosen({ ...chosen, [d.id]: e.target.value })} />}
              </li>
            ))}
          </ul>
          <div className="para-foot">
            <span className="grow" />
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={!picked.length}>
              Combine
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
