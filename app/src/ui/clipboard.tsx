// Word's Paste Options and Office Clipboard. After pasting, a small button
// by the text offers Keep formatting, Merge formatting (lists, bold and
// italic kept; the look of the text where it goes) and Text only. And what
// you copy or cut is kept (while Crumpet is open) in the right sidebar's
// Clipboard tab, to paste again from there.

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';

// ---------------------------------------------------------------- clipboard history

export interface Clip {
  id: number;
  text: string;
  md: string;
  at: number;
}

const MAX = 24;
let clips: Clip[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((f) => f());

export function addClip(text: string, md: string): void {
  if (!text.trim()) return;
  clips = [{ id: nextId++, text, md, at: Date.now() }, ...clips.filter((c) => c.text !== text || c.md !== md)].slice(0, MAX);
  tell();
}

export function removeClip(id: number): void {
  clips = clips.filter((c) => c.id !== id);
  tell();
}

export function clearClips(): void {
  clips = [];
  tell();
}

export function useClips(): Clip[] {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => clips,
    () => clips,
  );
}

/** The right sidebar's Clipboard tab. */
export function ClipboardPane({ editor }: { editor: Editor }) {
  const list = useClips();
  if (!list.length) return <p className="right-empty">Nothing copied yet. What you copy or cut is kept here while Crumpet is open, to paste again.</p>;
  return (
    <div className="clip-pane">
      <div className="review-row">
        <span>
          {list.length} item{list.length === 1 ? '' : 's'}
        </span>
        <span className="grow" />
        <button type="button" className="btn quiet" onClick={clearClips}>
          Clear all
        </button>
      </div>
      <ul className="clip-list" aria-label="Copied">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="clip-item"
              title="Paste this where the caret is"
              onClick={() => {
                editor.focus();
                editor.paste({ text: c.text, md: c.md });
              }}
            >
              {c.text.length > 160 ? `${c.text.slice(0, 159)}…` : c.text}
            </button>
            <button type="button" className="icon-btn clip-x" aria-label="Remove from the clipboard" onClick={() => removeClip(c.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- paste options

const OPEN = 'crumpet-pasted';

/** Lets an editor keep what's copied, and offer Paste Options after pasting. */
export function useClipboard(editor: Editor | null): void {
  useEffect(() => {
    if (!editor) return;
    editor.onCopied = (text, md) => addClip(text, md);
    editor.onPasted = (formatted) => window.dispatchEvent(new CustomEvent(OPEN, { detail: { editor, formatted } }));
    return () => {
      editor.onCopied = null;
      editor.onPasted = null;
    };
  }, [editor]);
}

/** The Paste Options button, by the text just pasted, until something else is done. */
export function PasteOptionsHost() {
  const [open, setOpen] = useState<{ editor: Editor; formatted: boolean } | null>(null);
  const [menu, setMenu] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = (e: Event) => {
      setOpen((e as CustomEvent<{ editor: Editor; formatted: boolean }>).detail);
      setMenu(false);
    };
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  // Where the caret is after pasting.
  useLayoutEffect(() => {
    if (!open) return setAt(null);
    const sel = getSelection();
    const r = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
    if (!r || (!r.width && !r.height && !r.top)) return setAt(null);
    setAt({ top: r.bottom + 4, left: Math.min(window.innerWidth - 60, r.right + 4) });
  }, [open]);
  // Gone at the next key, click elsewhere, or scroll.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (box.current?.contains(e.target as Node)) return;
      setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta' || e.key === 'Shift') return;
      if (e.key === 'Escape') setOpen(null);
      else if (!box.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', away, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', away, true);
    return () => {
      document.removeEventListener('mousedown', away, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', away, true);
    };
  }, [open]);
  if (!open || !at) return null;
  const choose = (mode: 'keep' | 'merge' | 'text') => {
    // Closed first: pasting again opens it afresh (to choose again).
    setOpen(null);
    open.editor.focus();
    open.editor.pasteAgain(mode);
  };
  return createPortal(
    <div ref={box} className="paste-options" style={{ top: at.top, left: at.left }}>
      <button type="button" className="paste-chip" aria-label="Paste options" aria-expanded={menu} title="Paste options" onClick={() => setMenu(!menu)}>
        📋 ▾
      </button>
      {menu && (
        <div className="paste-menu" role="menu" aria-label="Paste options">
          {open.formatted && (
            <button type="button" role="menuitem" className="menu-item" onClick={() => choose('keep')}>
              Keep formatting
            </button>
          )}
          {open.formatted && (
            <button type="button" role="menuitem" className="menu-item" onClick={() => choose('merge')}>
              Merge formatting
            </button>
          )}
          <button type="button" role="menuitem" className="menu-item" onClick={() => choose('text')}>
            Text only
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
