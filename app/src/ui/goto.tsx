// Word's Go To (F5): jump to a page, heading, footnote or comment by its
// number (or +2 / -1 from where the caret is), or step to the previous or
// next one. Also the commands for the next and previous footnote.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { type Pos, changes, comments, footnotes, isHeading } from '@crumpet/editor/model';
import { currentHelped } from './helpers';
import { IconClose } from './icons';

export type GoToKind = 'page' | 'heading' | 'footnote' | 'comment' | 'change';
const KINDS: [GoToKind, string][] = [
  ['page', 'Page'],
  ['heading', 'Heading'],
  ['footnote', 'Footnote'],
  ['comment', 'Comment'],
  ['change', 'Change'],
];

/** The places of one kind in the text, in order. */
function places(editor: Editor, kind: Exclude<GoToKind, 'page'>): Pos[] {
  const doc = editor.state.doc;
  if (kind === 'heading') return doc.blocks.filter((b) => isHeading(b.type)).map((b) => ({ block: b.id, offset: 0 }));
  if (kind === 'footnote') return footnotes(doc).map((f) => ({ block: f.block, offset: f.offset }));
  if (kind === 'change') return changes(doc).map((c) => ({ block: c.block, offset: Math.max(0, c.from) }));
  return comments(doc).map((c) => ({ block: c.block, offset: c.offset }));
}

/** Where the caret is among them: the index of the last one at or before it (-1: before them all). */
function placeOfCaret(editor: Editor, list: Pos[]): number {
  const doc = editor.state.doc;
  const order = (p: Pos) => doc.blocks.findIndex((b) => b.id === p.block) * 1e7 + p.offset;
  const here = order(editor.state.selection.focus);
  let i = -1;
  list.forEach((p, k) => {
    if (order(p) <= here) i = k;
  });
  return i;
}

/** The page the caret is on, from 1 (page view), or 0. */
function pageOfCaret(editor: Editor): number {
  const p = editor.pageOfBlock(editor.state.selection.focus.block);
  return p === undefined ? 0 : p + 1;
}

/**
 * Goes to the `target` place of a kind: a number (1 is the first), `+n` or
 * `-n` from the caret, or 'next' / 'previous'. Returns what went wrong, or null.
 */
export function goToPlace(editor: Editor, kind: GoToKind, target: string): string | null {
  const t = target.trim();
  if (kind === 'page') {
    const pages = editor.pages;
    if (!editor.pageBoxes.length) return 'Pages are numbered in page view.';
    const cur = pageOfCaret(editor) || 1;
    const n = t === 'next' ? cur + 1 : t === 'previous' ? cur - 1 : /^[+-]\d+$/.test(t) ? cur + Number(t) : Number(t);
    if (!Number.isInteger(n) || n < 1 || n > pages) return `There ${pages === 1 ? 'is 1 page' : `are ${pages} pages`}.`;
    editor.goToPage(n);
    return null;
  }
  const list = places(editor, kind);
  const name = KINDS.find((k) => k[0] === kind)![1].toLowerCase();
  if (!list.length) return `There’s no ${name} here.`;
  const here = placeOfCaret(editor, list);
  const atOne = here >= 0 && editor.state.selection.focus.block === list[here].block && editor.state.selection.focus.offset === list[here].offset;
  let i: number;
  if (t === 'next' || t === '') i = here + 1;
  else if (t === 'previous') i = atOne ? here - 1 : here;
  else if (/^[+-]\d+$/.test(t)) i = Math.max(here, 0) + Number(t);
  else i = Number(t) - 1;
  if (!Number.isInteger(i) || i < 0 || i >= list.length) return t === 'next' || t === '' ? `That was the last ${name}.` : t === 'previous' ? `That was the first ${name}.` : `There ${list.length === 1 ? `is 1 ${name}` : `are ${list.length} ${name}s`}.`;
  editor.goTo(list[i]);
  return null;
}

const OPEN = 'crumpet-open-goto';

/** Opens Go To on the text being written (F5, the command palette, the page number in page view). */
export function openGoTo(kind: GoToKind = 'page'): void {
  window.dispatchEvent(new CustomEvent(OPEN, { detail: kind }));
}

/** Shows Go To when asked for. */
export function GoToHost() {
  const [open, setOpen] = useState<{ editor: Editor; kind: GoToKind } | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      const h = currentHelped();
      if (h) setOpen({ editor: h.editor, kind: (e as CustomEvent<GoToKind>).detail });
    };
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  return open ? <GoToDialog editor={open.editor} first={open.kind} onClose={() => setOpen(null)} /> : null;
}

function GoToDialog({ editor, first, onClose }: { editor: Editor; first: GoToKind; onClose(): void }) {
  const paged = editor.pageBoxes.length > 0;
  const [kind, setKind] = useState<GoToKind>(first === 'page' && !paged ? 'heading' : first);
  const [what, setWhat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const go = (target: string, closeAfter: boolean) => {
    const problem = goToPlace(editor, kind, target);
    setError(problem);
    if (!problem && closeAfter) onClose();
    else if (!problem) input.current?.focus({ preventScroll: true });
  };
  const name = KINDS.find((k) => k[0] === kind)![1].toLowerCase();
  return createPortal(
    <div className="goto-panel" role="dialog" aria-label="Go to">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(what, true);
        }}
      >
        <header className="dialog-head">
          <h2>Go to</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={14} />
          </button>
        </header>
        <div className="goto-kinds" role="radiogroup" aria-label="Go to what">
          {KINDS.map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} disabled={k === 'page' && !paged} title={k === 'page' && !paged ? 'Pages are numbered in page view' : undefined} onClick={() => (setKind(k), setError(null))}>
              {label}
            </button>
          ))}
        </div>
        <label className="para-field">
          <span>Enter {name} number</span>
          <input ref={input} aria-label={`${name[0].toUpperCase()}${name.slice(1)} number`} value={what} placeholder="e.g. 3, or +1 to go one on" onChange={(e) => setWhat(e.target.value)} />
        </label>
        {error && (
          <p className="sync-hint goto-error" role="status">
            {error}
          </p>
        )}
        <div className="para-foot">
          <button type="button" className="btn" onClick={() => go('previous', false)}>
            Previous
          </button>
          <button type="button" className="btn" onClick={() => go('next', false)}>
            Next
          </button>
          <span className="grow" />
          <button type="submit" className="btn primary" disabled={!what.trim()}>
            Go to
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
