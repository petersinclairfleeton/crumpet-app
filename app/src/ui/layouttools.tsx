// Word's Layout tab for the formatting bar: Breaks (page, column, and
// section breaks), Columns, and Orientation for the section the caret is in.

import { useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { Popover } from './Sidebar';
import type { ToolItem } from './toolbar';
import { isMac } from './editing';

const svg = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICON_BREAK = svg('M5 3v5h14V3M5 21v-5h14v5M3 12h3M9 12h2M14 12h2M19 12h2');
const ICON_COLS = svg('M4 5h6M4 9h6M4 13h6M4 17h6M14 5h6M14 9h6M14 13h6M14 17h6');
const ICON_ORIENT = svg('M7 3h8l3 3v15H7zM3 14h4M5 12l-2 2 2 2');

function Drop({ label, glyph, off, children }: { label: string; glyph: React.ReactNode; off: boolean; children(close: () => void): React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="tool-drop">
      <button type="button" aria-label={label} aria-expanded={open} title={label} disabled={off} onClick={() => setOpen(!open)}>
        {glyph}
        <span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && (
        <Popover label={label} onClose={() => setOpen(false)}>
          {children(() => setOpen(false))}
        </Popover>
      )}
    </span>
  );
}

/** Breaks, Columns and Orientation, as toolbar items. */
export function layoutItems(ed: Editor | null, off: boolean): ToolItem[] {
  const mod = isMac ? '⌘' : 'Ctrl+';
  const act = (close: () => void, f: () => void) => () => {
    close();
    ed?.focus();
    f();
  };
  const look = ed?.sectionLook();
  const onPage = ed ? ed.pageOfBlock(ed.currentBlock().id) : undefined;
  const landscape = look?.orient ? look.orient === 'landscape' : onPage !== undefined ? !!ed?.pageBoxes[onPage]?.landscape : false;
  return [
    {
      key: 'breaks', label: 'Breaks',
      pri: 1,
      node: (
        <Drop label="Breaks" glyph={ICON_BREAK} off={off}>
          {(close) => (
            <div className="menu-list">
              <span className="menu-head">Page breaks</span>
              <button type="button" className="menu-item" onClick={act(close, () => ed?.insertPageBreak())}>
                Page <small className="menu-key">{mod}Enter</small>
              </button>
              <button type="button" className="menu-item" onClick={act(close, () => ed?.insertColumnBreak())}>
                Column <small className="menu-key">{mod}⇧Enter</small>
              </button>
              <hr className="menu-sep" />
              <span className="menu-head">Section breaks</span>
              <button type="button" className="menu-item" onClick={act(close, () => ed?.insertSectionBreak('page'))}>
                Next page
              </button>
              <button type="button" className="menu-item" onClick={act(close, () => ed?.insertSectionBreak('cont'))}>
                Continuous
              </button>
            </div>
          )}
        </Drop>
      ),
    },
    {
      key: 'columns', label: 'Columns',
      pri: 1,
      node: (
        <Drop label="Columns" glyph={ICON_COLS} off={off}>
          {(close) => (
            <div className="menu-list">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" role="menuitemradio" aria-checked={(look?.cols ?? 1) === n} className={`menu-item${(look?.cols ?? 1) === n ? ' on' : ''}`} onClick={act(close, () => ed?.setSection({ cols: n }))}>
                  {['One', 'Two', 'Three', 'Four'][n - 1]}
                </button>
              ))}
              <p className="menu-note">For this section (the whole document, until you add a section break).</p>
            </div>
          )}
        </Drop>
      ),
    },
    {
      key: 'orientation', label: 'Orientation',
      pri: 1,
      node: (
        <Drop label="Orientation" glyph={ICON_ORIENT} off={off}>
          {(close) => (
            <div className="menu-list">
              {(['portrait', 'landscape'] as const).map((o) => (
                <button key={o} type="button" role="menuitemradio" aria-checked={landscape === (o === 'landscape')} className={`menu-item${landscape === (o === 'landscape') ? ' on' : ''}`} onClick={act(close, () => ed?.setSection({ orient: o }))}>
                  {o === 'portrait' ? 'Portrait' : 'Landscape'}
                </button>
              ))}
              <p className="menu-note">For this section; page view shows it.</p>
            </div>
          )}
        </Drop>
      ),
    },
  ];
}
