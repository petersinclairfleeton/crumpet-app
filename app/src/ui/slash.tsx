// The "/" menu: type / in a note to add a heading, a list, a picture and
// more without reaching for the toolbar (like Notion). Typing after the /
// narrows the list; arrows and Enter pick; Esc closes it.

import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { runsText } from '@crumpet/editor/model';
import { chooseFiles } from './editing';

export interface SlashItem {
  id: string;
  label: string;
  hint: string;
  /** Other words it's found by. */
  words: string;
  glyph: string;
  run(ed: Editor): void;
}

/** Today's date, written out the way people write it here. */
export function longDate(t = Date.now()): string {
  return new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export const SLASH_ITEMS: SlashItem[] = [
  { id: 'text', label: 'Text', hint: 'Plain writing', words: 'paragraph normal body', glyph: '¶', run: (ed) => ed.setBlockStyle('paragraph') },
  { id: 'h1', label: 'Heading 1', hint: 'Big section heading', words: 'title h1 heading', glyph: 'H1', run: (ed) => ed.setBlockStyle('heading1') },
  { id: 'h2', label: 'Heading 2', hint: 'Medium heading', words: 'h2 subheading', glyph: 'H2', run: (ed) => ed.setBlockStyle('heading2') },
  { id: 'h3', label: 'Heading 3', hint: 'Small heading', words: 'h3', glyph: 'H3', run: (ed) => ed.setBlockStyle('heading3') },
  { id: 'h4', label: 'Heading 4', hint: 'Smallest heading', words: 'h4', glyph: 'H4', run: (ed) => ed.setBlockStyle('heading4') },
  { id: 'bullet', label: 'Bulleted list', hint: 'A simple list', words: 'ul unordered dots list', glyph: '•', run: (ed) => ed.setBlockType('bullet') },
  { id: 'numbered', label: 'Numbered list', hint: '1, 2, 3', words: 'ol ordered list', glyph: '1.', run: (ed) => ed.setBlockType('numbered') },
  { id: 'todo', label: 'Checklist', hint: 'Things to tick off', words: 'todo task checkbox to-do', glyph: '☐', run: (ed) => ed.setBlockType('todo') },
  { id: 'quote', label: 'Quote', hint: 'Set apart', words: 'blockquote callout', glyph: '❝', run: (ed) => ed.setBlockStyle('quote') },
  { id: 'title', label: 'Title', hint: 'The document’s title style', words: 'title', glyph: 'T', run: (ed) => ed.setBlockStyle('paragraph', 'title') },
  { id: 'scene', label: 'Scene break', hint: '* * *', words: 'divider separator line rule section break', glyph: '⁂', run: (ed) => ed.setBlockStyle('paragraph', 'scenebreak') },
  { id: 'picture', label: 'Picture or file', hint: 'From this device', words: 'image photo attachment upload pdf', glyph: '▣', run: (ed) => chooseFiles(ed) },
  { id: 'date', label: 'Today’s date', hint: longDate(), words: 'date today now', glyph: '◷', run: (ed) => ed.typeText(longDate()) },
];

/** Items matching what's typed after the /: by name first, then by other words. */
export function matchSlash(query: string, items: SlashItem[] = SLASH_ITEMS): SlashItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return items;
  const starts = items.filter((i) => i.label.toLowerCase().startsWith(q));
  const inside = items.filter((i) => !starts.includes(i) && (i.label.toLowerCase().includes(q) || i.words.split(' ').some((w) => w.startsWith(q))));
  return [...starts, ...inside];
}

interface Open {
  block: string;
  /** Where the / is. */
  start: number;
  query: string;
}

/** Finds a "/" just typed at the caret: at the start of a line or after a space. */
function trigger(ed: Editor): Open | null {
  const sel = ed.state.selection;
  if (sel.anchor.block !== sel.focus.block || sel.anchor.offset !== sel.focus.offset) return null;
  const block = ed.state.doc.blocks.find((b) => b.id === sel.focus.block);
  if (!block || block.type === 'image' || block.type === 'file') return null;
  const before = runsText(block.runs).slice(0, sel.focus.offset);
  const m = /(?:^|\s)\/([^\s/]{0,24})$/.exec(before);
  if (!m) return null;
  return { block: block.id, start: sel.focus.offset - m[1].length - 1, query: m[1] };
}

export function SlashMenu({ editor, host, items = SLASH_ITEMS }: { editor: Editor | null; host: RefObject<HTMLElement>; items?: SlashItem[] }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [active, setActive] = useState(0);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  /** A / dismissed with Esc stays plain text. */
  const dismissed = useRef<string | null>(null);
  const shown = open ? matchSlash(open.query, items) : [];
  const latest = useRef({ open, shown, active });
  latest.current = { open, shown, active };

  // Watch what's typed.
  useEffect(() => {
    if (!editor) return;
    const check = () => {
      const o = trigger(editor);
      if (o && dismissed.current === `${o.block}:${o.start}`) return setOpen(null);
      if (!o) dismissed.current = null;
      setOpen((prev) => {
        if (!o) return null;
        if (!prev || prev.block !== o.block || prev.start !== o.start || prev.query !== o.query) setActive(0);
        return o;
      });
    };
    const off = editor.onChange(() => check());
    return () => {
      off();
      editor.onKeyIntercept = null;
    };
  }, [editor]);

  const choose = (item: SlashItem | undefined) => {
    const o = latest.current.open;
    if (!editor || !o || !item) return;
    setOpen(null);
    editor.deleteBefore(o.query.length + 1);
    item.run(editor);
  };

  // Keys go to the menu while it's open.
  useEffect(() => {
    if (!editor) return;
    editor.onKeyIntercept = (e) => {
      const { open: o, shown: list, active: i } = latest.current;
      if (!o) return false;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!list.length) return false;
        setActive((i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length);
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (!list.length) return false;
        choose(list[i]);
        return true;
      }
      if (e.key === 'Escape') {
        dismissed.current = `${o.block}:${o.start}`;
        setOpen(null);
        return true;
      }
      return false;
    };
  });

  // Below the caret, or above it near the bottom of the window.
  useLayoutEffect(() => {
    if (!open) return setAt(null);
    const sel = getSelection();
    if (!sel || !sel.rangeCount || !host.current?.contains(sel.anchorNode)) return setAt(null);
    const r = sel.getRangeAt(0).getBoundingClientRect();
    const h = menu.current?.offsetHeight ?? 280;
    const below = r.bottom + 6 + h < window.innerHeight;
    setAt({ top: below ? r.bottom + 6 : r.top - 6 - h, left: Math.min(window.innerWidth - 300, Math.max(8, r.left)) });
  }, [open, host]);

  useEffect(() => {
    menu.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open || !shown.length) return null;
  return createPortal(
    <div ref={menu} className="slash-menu" role="listbox" aria-label="Add" style={at ? { top: at.top, left: at.left } : { visibility: 'hidden', top: 0, left: 0 }} onMouseDown={(e) => e.preventDefault()}>
      {shown.map((item, i) => (
        <button key={item.id} type="button" role="option" aria-selected={i === active} className="slash-item" onMouseEnter={() => setActive(i)} onClick={() => choose(item)}>
          <span className="slash-glyph" aria-hidden="true">
            {item.glyph}
          </span>
          <span className="slash-text">
            <b>{item.label}</b>
            <small>{item.hint}</small>
          </span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
