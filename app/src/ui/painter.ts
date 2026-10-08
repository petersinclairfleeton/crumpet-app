// Word's format painter: copy the formatting where the caret is (bold,
// italic, font, size, colour, highlight...), then select text (or click a
// word, or select with Shift and the arrows) to give it the same. Double-click the button to keep painting until
// Esc or a click on the button again.

import { useSyncExternalStore } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { LOOK_KEYS, type Look, type Mark } from '@crumpet/editor/model';

const MARKS: Mark[] = ['bold', 'italic', 'underline', 'strike', 'code'];

interface Brush {
  ed: Editor;
  marks: Mark[];
  look: Look;
  sticky: boolean;
  off(): void;
}

let brush: Brush | null = null;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((f) => f());

export function usePainter(): { on: boolean; sticky: boolean } {
  const on = useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => (brush ? (brush.sticky ? 2 : 1) : 0),
    () => 0,
  );
  return { on: on > 0, sticky: on === 2 };
}

export function stopPainting(): void {
  brush?.off();
  brush = null;
  tell();
}

/** Picks up the formatting at the caret; the next selection made gets it. */
export function startPainting(ed: Editor, sticky = false): void {
  stopPainting();
  ed.currentSelection();
  const marks = MARKS.filter((m) => ed.isMarkActive(m));
  const look: Look = {};
  for (const k of LOOK_KEYS) {
    const v = ed.lookValue(k);
    if (v !== undefined) (look as Record<string, unknown>)[k] = v;
  }
  const root = ed.view.root;
  root.classList.add('painting');
  const onUp = (e: MouseEvent) => {
    // After the browser has settled the selection.
    setTimeout(() => {
      if (!brush) return;
      const sel = window.getSelection();
      if (!sel) return;
      // A click without dragging paints the word clicked (where the mouse is: the editor may have put its caret back on focus).
      if (sel.isCollapsed || !root.contains(sel.anchorNode)) {
        const at = pointAt(e.clientX, e.clientY);
        if (!at || !root.contains(at.node)) return;
        sel.collapse(at.node, at.offset);
        sel.modify('move', 'backward', 'word');
        sel.modify('extend', 'forward', 'word');
        // Not the space after it.
        const t = sel.toString();
        const trail = t.length - t.trimEnd().length;
        for (let i = 0; i < trail; i++) sel.modify('extend', 'backward', 'character');
      }
      if (sel.isCollapsed) return;
      paint(ed, marks, look);
      if (!brush?.sticky) stopPainting();
    });
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stopPainting();
  // A selection made with the keyboard (Shift and the arrows) is painted when Shift is let go.
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key !== 'Shift' || !brush) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !root.contains(sel.anchorNode)) return;
    paint(ed, marks, look);
    if (!brush?.sticky) stopPainting();
  };
  root.addEventListener('mouseup', onUp);
  root.addEventListener('keyup', onKeyUp);
  window.addEventListener('keydown', onKey);
  brush = {
    ed,
    marks,
    look,
    sticky,
    off: () => {
      root.classList.remove('painting');
      root.removeEventListener('mouseup', onUp);
      root.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('keydown', onKey);
    },
  };
  tell();
}

/** The text position under the mouse. */
function pointAt(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & { caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null; caretRangeFromPoint?(x: number, y: number): Range | null };
  const p = d.caretPositionFromPoint?.(x, y);
  if (p) return { node: p.offsetNode, offset: p.offset };
  const r = d.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

/** Gives the selection exactly this formatting. */
function paint(ed: Editor, marks: Mark[], look: Look): void {
  ed.currentSelection();
  for (const m of MARKS) if (marks.includes(m) !== ed.isMarkActive(m)) ed.toggleMark(m);
  for (const k of LOOK_KEYS) {
    const want = look[k] ?? null;
    if ((ed.lookValue(k) ?? null) !== want) ed.setLook(k, want as string | number | null);
  }
}

/** The button: a click paints once, a double-click keeps painting. */
export function painterClick(ed: Editor | null, e: { detail: number }): void {
  if (!ed) return;
  if (brush && e.detail < 2) return stopPainting();
  startPainting(ed, e.detail >= 2);
}
