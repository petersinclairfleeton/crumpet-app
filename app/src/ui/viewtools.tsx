// Word's View tab for the formatting bar: Outline view (with its Outlining
// bar: promote, demote, move, expand, collapse, show level, first line only)
// and how page view shows pages (one page, the page's width, several pages
// in a row, or side by side like a book).

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { Popover } from './Sidebar';
import { type ToolItem, closeMore } from './toolbar';
import { useAppState, useAppStore } from './hooks';

const svg = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICON_OUTLINE = svg('M4 6h2M9 6h11M7 12h2M12 12h8M7 18h2M12 18h8');
const ICON_PAGES = svg('M3 5h8v14H3zM13 5h8v14h-8z');

const OUTLINE = 'crumpet:outline';

/** Turns an editor's outline view on or off (and tells the bar). */
function setOutline(ed: Editor | null, o: { level?: number; firstLine?: boolean } | null): void {
  ed?.setOutlineView(o);
  window.dispatchEvent(new Event(OUTLINE));
}

/** Redraws when outline view changes. */
function useOutlineTick(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(OUTLINE, on);
    return () => window.removeEventListener(OUTLINE, on);
  }, []);
}

const keep = (e: React.MouseEvent) => e.preventDefault();

/** Word's Outlining tab, shown above the text while outline view is on. */
function OutlineBar({ ed, opts, onOpts }: { ed: Editor; opts: { level?: number; firstLine?: boolean }; onOpts(o: { level?: number; firstLine?: boolean } | null): void }) {
  const host = ed.view.root.closest<HTMLElement>('.note-pane, .chapter-pane, .project-pane');
  const btn = (label: string, title: string, glyph: string, act: () => void) => (
    <button type="button" className="icon-btn" aria-label={label} title={title} onMouseDown={keep} onClick={act}>
      {glyph}
    </button>
  );
  const bar = (
    <div className="hf-bar outline-bar" role="toolbar" aria-label="Outlining">
      <span className="hf-bar-title">Outline view</span>
      {btn('Promote to Heading 1', 'Promote to Heading 1', '⇤', () => {
        for (let i = 0; i < 4; i++) ed.promote(-1);
      })}
      {btn('Promote', 'Promote (Alt+Shift+Left)', '←', () => ed.promote(-1))}
      {btn('Demote', 'Demote (Alt+Shift+Right)', '→', () => ed.promote(1))}
      {btn('Demote to body text', 'Demote to body text', '⇥', () => ed.promote(1, true))}
      {btn('Move up', 'Move up (Alt+Shift+Up)', '↑', () => ed.moveParagraph(-1))}
      {btn('Move down', 'Move down (Alt+Shift+Down)', '↓', () => ed.moveParagraph(1))}
      {btn('Expand', 'Show what’s under this heading', '⊕', () => ed.foldHere(false))}
      {btn('Collapse', 'Fold away what’s under this heading', '⊖', () => ed.foldHere(true))}
      <label className="outline-level">
        <span>Show</span>
        <select aria-label="Show level" value={opts.level ?? ''} onChange={(e) => onOpts({ ...opts, level: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">All levels</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              Level {n}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={!!opts.firstLine} onChange={(e) => onOpts({ ...opts, firstLine: e.target.checked || undefined })} /> First line only
      </label>
      <span className="grow" />
      <button type="button" className="btn primary small" onClick={() => onOpts(null)}>
        Close outline view
      </button>
    </div>
  );
  return host ? createPortal(bar, host) : null;
}

function OutlineToggle({ ed, off }: { ed: Editor | null; off: boolean }) {
  useOutlineTick();
  const opts = ed?.outlineView ?? null;
  return (
    <button type="button" className={opts ? 'active' : ''} aria-label="Outline view" aria-pressed={!!opts} title="Outline view: headings and paragraphs as an outline, to promote, demote and move" disabled={off} onClick={() => (setOutline(ed, opts ? null : {}), closeMore())}>
      {ICON_OUTLINE}
    </button>
  );
}

/** The Outlining bar while the editor is in outline view (kept with the formatting bar, which is always there). */
export function OutlineHost({ ed }: { ed: Editor | null }) {
  useOutlineTick();
  const opts = ed?.outlineView ?? null;
  return opts && ed ? <OutlineBar ed={ed} opts={opts} onOpts={(o) => setOutline(ed, o)} /> : null;
}

/** Word's Zoom group (One Page, Multiple Pages, Page Width) and Page Movement (Side to Side), for page view. */
function PagesTool({ off }: { off: boolean }) {
  const [open, setOpen] = useState(false);
  const { settings } = useAppState();
  const store = useAppStore();
  const layout = settings.pageLayout;
  const per = settings.pagesPerRow ?? 2;
  const set = (pageLayout: typeof layout, extra: object = {}) => {
    store.updateSettings({ pageLayout, ...(pageLayout ? { zoom: undefined } : {}), ...extra });
    setOpen(false);
    closeMore();
  };
  const item = (label: string, on: boolean, act: () => void, hint: string) => (
    <button type="button" role="menuitemradio" aria-checked={on} className={`menu-item${on ? ' on' : ''}`} title={hint} onClick={act}>
      {label}
    </button>
  );
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Page layout on screen" aria-expanded={open} title="One page, page width, several pages, or side by side (page view)" disabled={off} onClick={() => setOpen(!open)}>
        {ICON_PAGES}
        <span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && (
        <Popover label="Pages on screen" onClose={() => setOpen(false)}>
          <div className="menu-list">
            <span className="menu-head">Pages on screen</span>
            {item('Page width', !layout, () => set(undefined), 'The page as wide as the window')}
            {item('One page', layout === 'one', () => set('one'), 'The whole page in the window')}
            {[2, 3, 4].map((n) => item(`${n} pages in a row`, layout === 'multi' && per === n, () => set('multi', { pagesPerRow: n }), `${n} pages side by side`))}
            {item('Side to side, like a book', layout === 'book', () => set('book'), 'Facing pages: left and right, the first page on its own on the right')}
            <p className="menu-note">For page view. Printing is one page to a sheet, as always.</p>
          </div>
        </Popover>
      )}
    </span>
  );
}

/** Outline view and Pages on screen, as toolbar items. */
export function viewItems(ed: Editor | null, off: boolean): ToolItem[] {
  return [
    { key: 'outlineview', label: 'Outline view', pri: 1, node: <OutlineToggle ed={ed} off={off} /> },
    { key: 'pageslayout', label: 'Pages on screen', pri: 1, node: <PagesTool off={off} /> },
  ];
}
