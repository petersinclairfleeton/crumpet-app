// Word's Paragraph group for the formatting bar: line and paragraph spacing,
// decrease and increase indent, page break, and the Paragraph window with
// every spacing, indent and page-break setting.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import type { ParaLook } from '@crumpet/editor/model';
import { IconClose } from './icons';
import { Popover } from './Sidebar';
import type { ToolItem } from './toolbar';

const LINE_SPACINGS = [1, 1.15, 1.5, 2, 2.5, 3];

const svg = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICON_SPACING = svg('M10 6h11M10 12h11M10 18h11M5 4v16M3 6l2-2 2 2M3 18l2 2 2-2');
const ICON_INDENT = svg('M11 6h10M11 12h10M11 18h10M3 9l3 3-3 3');
const ICON_OUTDENT = svg('M11 6h10M11 12h10M11 18h10M7 9l-3 3 3 3');
const ICON_BREAK = svg('M5 3v5h14V3M5 21v-5h14v5M3 12h3M9 12h2M14 12h2M19 12h2');

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
      { key: 'spacing', pri: 2, sep: true, node: <SpacingTool ed={ed} off={off} onMore={() => setOpen(true)} />, menu: undefined },
      simple('outdent', 2, 'Decrease indent', ICON_OUTDENT, () => ed?.stepIndent(-1)),
      simple('indent', 2, 'Increase indent', ICON_INDENT, () => ed?.stepIndent(1)),
      simple('pagebreak', 1, 'Page break (Ctrl+Enter)', ICON_BREAK, () => ed?.insertPageBreak()),
      simple('paragraph', 1, 'Paragraph settings…', <span className="glyph-para">¶</span>, () => setOpen(true)),
    ],
    dialog: open && ed ? <ParagraphDialog editor={ed} onClose={() => setOpen(false)} /> : null,
  };
}

/** Word's paragraph keys: Ctrl+Enter page break, Ctrl+1/2/5 line spacing, Ctrl+M / Ctrl+Shift+M indent. */
export function useParaKeys(ed: Editor | null): void {
  useEffect(() => {
    if (!ed) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      let done = true;
      if (e.key === 'Enter' && !e.shiftKey) ed.insertPageBreak();
      else if (!e.shiftKey && e.code === 'Digit1') ed.setPara({ line: 1 });
      else if (!e.shiftKey && e.code === 'Digit2') ed.setPara({ line: 2 });
      else if (!e.shiftKey && e.code === 'Digit5') ed.setPara({ line: 1.5 });
      else if (e.code === 'KeyM' && e.ctrlKey) ed.stepIndent(e.shiftKey ? -1 : 1);
      else done = false;
      if (done) e.preventDefault();
    };
    const root = ed.view.root;
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [ed]);
}

type Special = 'none' | 'first' | 'hanging';

/** Word's Paragraph window: indents, spacing, and line and page breaks for the selected paragraphs. */
export function ParagraphDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
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

  useEffect(() => {
    panel.current?.querySelector('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
