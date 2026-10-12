// Word's Paragraph group for the formatting bar: line and paragraph spacing,
// decrease and increase indent, show/hide ¶, and the Paragraph window with
// every spacing, indent and page-break setting.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import type { ParaLook } from '@crumpet/editor/model';
import type { SortBy } from '@crumpet/editor/commands';
import { IconClose } from './icons';
import { Popover } from './Sidebar';
import type { ToolItem } from './toolbar';
import { useAppState, useAppStore } from './hooks';
import { TabsDialog } from './tabstops';

const LINE_SPACINGS = [1, 1.15, 1.5, 2, 2.5, 3];

const svg = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICON_SPACING = svg('M10 6h11M10 12h11M10 18h11M5 4v16M3 6l2-2 2 2M3 18l2 2 2-2');
const ICON_INDENT = svg('M11 6h10M11 12h10M11 18h10M3 9l3 3-3 3');
const ICON_OUTDENT = svg('M11 6h10M11 12h10M11 18h10M7 9l-3 3 3 3');
const ICON_PARA_WINDOW = svg('M4 4h16v16H4zM10 14l6-6M11 8h5v5');

function SpacingTool({ ed, off, onMore }: { ed: Editor | null; off: boolean; onMore(): void }) {
  const [open, setOpen] = useState(false);
  const line = ed?.paraValue('line');
  const before = ed?.paraValue('before');
  const after = ed?.paraValue('after');
  const act = (f: () => void) => () => {
    setOpen(false);
    f();
    ed?.focus();
  };
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Line and paragraph spacing" aria-expanded={open} title="Line and paragraph spacing" disabled={off} onClick={() => setOpen(!open)}>
        {ICON_SPACING}
        <span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && (
        <Popover label="Line and paragraph spacing" onClose={() => setOpen(false)}>
          {LINE_SPACINGS.map((n) => (
            <button key={n} type="button" role="menuitemradio" aria-checked={line === n} className={`menu-item${line === n ? ' on' : ''}`} onClick={act(() => ed?.setPara({ line: n }))}>
              {n.toFixed(n === 1.15 ? 2 : 1)}
            </button>
          ))}
          <hr className="menu-sep" />
          <button type="button" className="menu-item" onClick={act(() => ed?.setPara({ before: before ? undefined : 12 }))}>
            {before ? 'Remove space before paragraph' : 'Add space before paragraph'}
          </button>
          <button type="button" className="menu-item" onClick={act(() => ed?.setPara({ after: after === 0 ? undefined : 0 }))}>
            {after === 0 ? 'Add space after paragraph' : 'Remove space after paragraph'}
          </button>
          <hr className="menu-sep" />
          <button type="button" className="menu-item" onClick={act(onMore)}>
            Line spacing options…
          </button>
        </Popover>
      )}
    </span>
  );
}

/** The Paragraph group, as toolbar items (see OverflowRow). */
export function useParaItems(ed: Editor | null, off: boolean): { items: ToolItem[]; dialog: React.ReactNode } {
  const [open, setOpen] = useState(false);
  const [tabs, setTabs] = useState(false);
  const [sorting, setSorting] = useState(false);
  const store = useAppStore();
  const marks = !!useAppState().settings.showMarks;
  const toggleMarks = () => store.updateSettings({ showMarks: !marks });
  const marksLabel = 'Show/hide ¶ (Ctrl+Shift+8)';
  const simple = (key: string, pri: number, label: string, glyph: React.ReactNode, onClick: () => void, sep = false): ToolItem => ({
    key,
    pri,
    sep,
    node: (
      <button type="button" aria-label={label} title={label} disabled={off} onClick={onClick}>
        {glyph}
      </button>
    ),
    menu: (
      <button type="button" className="menu-item" disabled={off} onClick={onClick}>
        <span className="menu-glyph">{glyph}</span> {label}
      </button>
    ),
  });
  return {
    items: [
      { key: 'spacing', label: 'Line spacing', pri: 2, sep: true, node: <SpacingTool ed={ed} off={off} onMore={() => setOpen(true)} />, menu: undefined },
      simple('outdent', 2, 'Decrease indent', ICON_OUTDENT, () => ed?.stepIndent(-1)),
      simple('indent', 2, 'Increase indent', ICON_INDENT, () => ed?.stepIndent(1)),
      {
        key: 'marks',
        pri: 1,
        node: (
          <button type="button" className={marks ? 'active' : ''} aria-label="Show/hide ¶" aria-pressed={marks} title={marksLabel} onClick={toggleMarks}>
            <span className="glyph-para">¶</span>
          </button>
        ),
        menu: (
          <button type="button" className="menu-item" aria-pressed={marks} onClick={toggleMarks}>
            <span className="menu-glyph glyph-para">¶</span> {marks ? 'Hide formatting marks' : 'Show formatting marks'}
          </button>
        ),
      },
      simple('sort', 1, 'Sort paragraphs…', <span className="glyph-sort">A↓Z</span>, () => setSorting(true)),
      simple('paragraph', 1, 'Paragraph settings…', ICON_PARA_WINDOW, () => setOpen(true)),
    ],
    dialog:
      open && ed ? (
        <ParagraphDialog
          editor={ed}
          onClose={() => setOpen(false)}
          onTabs={() => {
            setOpen(false);
            setTabs(true);
          }}
        />
      ) : tabs && ed ? (
        <TabsDialog editor={ed} onClose={() => setTabs(false)} />
      ) : sorting && ed ? (
        <SortDialog editor={ed} onClose={() => setSorting(false)} />
      ) : null,
  };
}

/** Word's paragraph keys: Ctrl+Enter page break, Ctrl+1/2/5 line spacing, Ctrl+M / Ctrl+Shift+M indent, Ctrl+Shift+8 show/hide ¶. */
export function useParaKeys(ed: Editor | null): void {
  const store = useAppStore();
  const marks = !!useAppState().settings.showMarks;
  // Show/hide ¶ is for every note and chapter (as Settings keep it).
  useEffect(() => {
    ed?.setShowMarks(marks);
  }, [ed, marks]);
  const marksRef = useRef(marks);
  marksRef.current = marks;
  useEffect(() => {
    if (!ed) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      let done = true;
      if (e.key === 'Enter' && !e.shiftKey) ed.insertPageBreak();
      else if (e.key === 'Enter' && e.shiftKey) ed.insertColumnBreak();
      else if (!e.shiftKey && e.code === 'Digit1') ed.setPara({ line: 1 });
      else if (!e.shiftKey && e.code === 'Digit2') ed.setPara({ line: 2 });
      else if (!e.shiftKey && e.code === 'Digit5') ed.setPara({ line: 1.5 });
      else if (e.code === 'KeyM' && e.ctrlKey) ed.stepIndent(e.shiftKey ? -1 : 1);
      else if (e.shiftKey && e.code === 'Digit8') store.updateSettings({ showMarks: !marksRef.current });
      else done = false;
      if (done) e.preventDefault();
    };
    const root = ed.view.root;
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [ed, store]);
}

/** Word's Sort Text: the selected paragraphs by their text, a number in them or a date, A to Z or Z to A. */
function SortDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const [by, setBy] = useState<SortBy>('text');
  const [down, setDown] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="dialog para-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Sort paragraphs"
        onSubmit={(e) => {
          e.preventDefault();
          editor.sortParagraphs(by, down);
          onClose();
          editor.focus();
        }}
      >
        <header className="dialog-head">
          <h2>Sort paragraphs</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <p className="sync-hint">The paragraphs you’ve selected (or the one the caret is in), each with its own formatting. Empty ones go last.</p>
          <label className="para-field">
            <span>Sort by</span>
            <select aria-label="Sort by" value={by} onChange={(e) => setBy(e.target.value as SortBy)}>
              <option value="text">Text</option>
              <option value="number">Number (the first in each paragraph)</option>
              <option value="date">Date (each paragraph starting with one)</option>
            </select>
          </label>
          <label className="check-row">
            <input type="radio" name="sort-dir" checked={!down} onChange={() => setDown(false)} /> Ascending (A to Z, 1 to 9, oldest first)
          </label>
          <label className="check-row">
            <input type="radio" name="sort-dir" checked={down} onChange={() => setDown(true)} /> Descending
          </label>
          <div className="para-foot">
            <span className="grow" />
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              Sort
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}

type Special = 'none' | 'first' | 'hanging';

/** Word's Paragraph window: indents, spacing, and line and page breaks for the selected paragraphs. */
export function ParagraphDialog({ editor, onClose, onTabs }: { editor: Editor; onClose(): void; onTabs?(): void }) {
  const v = <K extends keyof ParaLook>(k: K) => editor.paraValue(k);
  const num = (x: number | undefined) => (x === undefined ? '' : String(x));
  const first = v('first');
  const [left, setLeft] = useState(num(v('left')));
  const [right, setRight] = useState(num(v('right')));
  const [special, setSpecial] = useState<Special>(first === undefined || first === 0 ? 'none' : first > 0 ? 'first' : 'hanging');
  const [by, setBy] = useState(first ? String(Math.abs(first)) : '0.5');
  const [before, setBefore] = useState(num(v('before')));
  const [after, setAfter] = useState(num(v('after')));
  const [line, setLine] = useState(num(v('line')));
  const [pageBefore, setPageBefore] = useState(!!v('pageBefore'));
  const [keepNext, setKeepNext] = useState(!!v('keepNext'));
  const [keepLines, setKeepLines] = useState(!!v('keepLines'));
  const panel = useRef<HTMLFormElement>(null);

  // Focus once, on opening: a redraw mustn't pull the caret back.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    panel.current?.querySelector('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const n = (s: string) => (s.trim() === '' || !Number.isFinite(+s) ? undefined : +s);
  const apply = () => {
    const b = n(by) ?? 0;
    editor.setPara({
      left: n(left),
      right: n(right),
      first: special === 'none' || !b ? undefined : special === 'first' ? b : -b,
      before: n(before),
      after: n(after),
      line: n(line),
      pageBefore: pageBefore || undefined,
      keepNext: keepNext || undefined,
      keepLines: keepLines || undefined,
    });
    onClose();
    editor.focus();
  };
  const field = (label: string, value: string, set: (s: string) => void, unit: string, step = 0.1) => (
    <label className="para-field">
      <span>{label}</span>
      <span className="para-input">
        <input type="number" aria-label={label} step={step} min={unit === "pt" || label !== "Left" ? 0 : undefined} value={value} placeholder="—" onChange={(e) => set(e.target.value)} />
        <small>{unit}</small>
      </span>
    </label>
  );

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        ref={panel}
        className="dialog para-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Paragraph"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <header className="dialog-head">
          <h2>Paragraph</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <fieldset>
            <legend>Indentation</legend>
            <div className="para-row">
              {field('Left', left, setLeft, 'in')}
              {field('Right', right, setRight, 'in')}
              <label className="para-field">
                <span>Special</span>
                <select value={special} onChange={(e) => setSpecial(e.target.value as Special)}>
                  <option value="none">(none)</option>
                  <option value="first">First line</option>
                  <option value="hanging">Hanging</option>
                </select>
              </label>
              {special !== 'none' && field('By', by, setBy, 'in')}
            </div>
          </fieldset>
          <fieldset>
            <legend>Spacing</legend>
            <div className="para-row">
              {field('Before', before, setBefore, 'pt', 1)}
              {field('After', after, setAfter, 'pt', 1)}
              <label className="para-field">
                <span>Line spacing</span>
                <select value={LINE_SPACINGS.includes(n(line) ?? -1) || line === '' ? line : 'multiple'} onChange={(e) => e.target.value !== 'multiple' && setLine(e.target.value)}>
                  <option value="">Style’s own</option>
                  <option value="1">Single</option>
                  <option value="1.15">1.15</option>
                  <option value="1.5">1.5 lines</option>
                  <option value="2">Double</option>
                  <option value="2.5">2.5</option>
                  <option value="3">Triple</option>
                  <option value="multiple">Multiple…</option>
                </select>
              </label>
              {field('At', line, setLine, '×', 0.05)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Line and page breaks</legend>
            <label className="check-row">
              <input type="checkbox" checked={pageBefore} onChange={(e) => setPageBefore(e.target.checked)} /> Page break before
            </label>
            <label className="check-row">
              <input type="checkbox" checked={keepNext} onChange={(e) => setKeepNext(e.target.checked)} /> Keep with next
            </label>
            <label className="check-row">
              <input type="checkbox" checked={keepLines} onChange={(e) => setKeepLines(e.target.checked)} /> Keep lines together
            </label>
          </fieldset>
          <div className="para-foot">
            <button
              type="button"
              className="btn quiet"
              onClick={() => {
                editor.setPara(null);
                onClose();
                editor.focus();
              }}
            >
              Back to the style’s own
            </button>
            {onTabs && (
              <button type="button" className="btn quiet" onClick={onTabs}>
                Tabs…
              </button>
            )}
            <span className="grow" />
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              OK
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
