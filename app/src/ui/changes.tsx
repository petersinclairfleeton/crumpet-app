// Track changes, like Word's: when it's on, what you type is underlined and
// what you delete is struck through, so someone can accept or reject each
// change (or all of them) later.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { type Change, type Doc, changes } from '@crumpet/editor/model';
import { REVISIONS, revisionColor } from '../data/revisions';
import { useAppState, useAppStore } from './hooks';

interface Open {
  where: { block: string; from: number; to: number };
  change: Change;
  el: HTMLElement;
}

function when(at: number): string {
  if (!at) return '';
  const d = new Date(at);
  return new Date().toDateString() === d.toDateString() ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Keeps the editor tracking (or not) as Settings say. */
export function useTracking(editor: Editor | null): void {
  const state = useAppState();
  const on = !!state.settings.trackChanges;
  const author = state.settings.name.trim() || 'You';
  useEffect(() => {
    editor?.setTracking(on ? author : null);
  }, [editor, on, author]);
  // Revision mode: typing in the round's colour.
  const color = revisionColor(state.settings.revision);
  useEffect(() => {
    if (editor) editor.revisionColor = color;
  }, [editor, color]);
}

/** The button that turns tracking on and off. */
export function TrackToggle() {
  const state = useAppState();
  const store = useAppStore();
  const on = !!state.settings.trackChanges;
  return (
    <button type="button" className={`track-toggle${on ? ' on' : ''}`} aria-pressed={on} data-tip={on ? 'Tracking changes: click to stop' : 'Track changes: mark what’s added and deleted'} onClick={() => store.updateSettings({ trackChanges: !on })}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20h4L19 9l-4-4L4 16v4z" />
        <path d="M13 7l4 4" />
      </svg>
      {on ? 'Tracking changes' : 'Track changes'}
    </button>
  );
}

/** While revising: which round, in its colour; click to stop. */
export function RevisionChip() {
  const state = useAppState();
  const store = useAppStore();
  const round = state.settings.revision ?? 0;
  const r = REVISIONS[round - 1];
  if (!r) return null;
  return (
    <button type="button" className="revision-chip" style={{ '--rev': r.color } as React.CSSProperties} data-tip="Revision mode: what you type is in this colour. Click to stop." onClick={() => store.updateSettings({ revision: 0 })}>
      {r.name} revision
    </button>
  );
}

/** How many changes there are, with Accept all and Reject all. */
export function ChangesBar({ doc, editor }: { doc: Doc; editor: Editor | null }) {
  const n = changes(doc).length;
  if (!n || !editor) return null;
  return (
    <div className="changes-bar" role="region" aria-label="Tracked changes">
      <span>
        {n} tracked change{n === 1 ? '' : 's'}
      </span>
      <span className="grow" />
      <button type="button" className="btn" onClick={() => editor.resolveChanges(false)}>
        Reject all
      </button>
      <button type="button" className="btn primary" onClick={() => editor.resolveChanges(true)}>
        Accept all
      </button>
    </div>
  );
}

/** The card for one change: who made it, and Accept or Reject. */
export function ChangeCard({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;
    editor.onChangeClick = (hit, el) => setOpen({ where: { block: hit.block, from: hit.from, to: hit.to }, change: hit.change, el });
    return () => {
      editor.onChangeClick = null;
    };
  }, [editor]);

  useLayoutEffect(() => {
    if (!open) return setAt(null);
    const r = open.el.getBoundingClientRect();
    const w = 260;
    setAt({ top: r.bottom + 6, left: Math.min(window.innerWidth - w - 8, Math.max(8, r.left)) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!card.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open || !editor) return null;
  const resolve = (accept: boolean) => {
    editor.resolveChanges(accept, open.where);
    setOpen(null);
  };
  const c = open.change;
  const what = open.where.from < 0 ? 'paragraph break' : 'text';
  return createPortal(
    <div ref={card} className="change-card" role="dialog" aria-label={`${c.kind === 'ins' ? 'Added' : 'Deleted'} ${what}`} style={at ? { top: at.top, left: at.left } : { visibility: 'hidden', top: 0, left: 0 }}>
      <p>
        <b>{c.kind === 'ins' ? 'Added' : 'Deleted'}</b>
        {open.where.from < 0 ? ' a paragraph break' : ''} by {c.author || 'someone'}
        {c.at ? <small> · {when(c.at)}</small> : null}
      </p>
      <div className="comment-actions">
        <button type="button" className="btn" onClick={() => resolve(false)}>
          Reject
        </button>
        <span className="grow" />
        <button type="button" className="btn primary" onClick={() => resolve(true)}>
          Accept
        </button>
      </div>
    </div>,
    document.body,
  );
}
