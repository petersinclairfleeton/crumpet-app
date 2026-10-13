// Word's Layout tab for the formatting bar: Breaks (page, column, and
// section breaks), Columns, and Orientation for the section the caret is in.

import { useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { PageSetup } from '../data/styles';
import { PageSetupDialog } from './pagesetup';
import { Popover } from './Sidebar';
import type { ToolItem } from './toolbar';
import { isMac } from './editing';
import { PaperSwatches } from './paper';

const svg = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICON_BREAK = svg('M5 3v5h14V3M5 21v-5h14v5M3 12h3M9 12h2M14 12h2M19 12h2');
const ICON_COLS = svg('M4 5h6M4 9h6M4 13h6M4 17h6M14 5h6M14 9h6M14 13h6M14 17h6');
const ICON_ORIENT = svg('M7 3h8l3 3v15H7zM3 14h4M5 12l-2 2 2 2');
const ICON_LINES = svg('M9 5h11M9 10h11M9 15h11M9 20h11M4 4v2M3.5 9.5h1M4 14v2M3.5 19.5h1');
const ICON_HYPH = svg('M3 8h7M3 12h9M3 16h7M15 12h3M13 8h8M13 16h8');

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

/** Word's Page Color: the document's own, saved in it. */
const DOC_COLOURS: [string, string][] = [
  ['#fffcf2', 'Ivory'],
  ['#fff2cc', 'Butter'],
  ['#fde9d9', 'Peach'],
  ['#e5eef8', 'Sky'],
  ['#e6f0e6', 'Sage'],
  ['#efefec', 'Grey'],
];

function DocColour({ ed, onPicked }: { ed: Editor; onPicked(): void }) {
  const current = ed.docPara().pgc;
  const set = (pgc: string | undefined) => {
    ed.setDocPara({ pgc });
    onPicked();
  };
  return (
    <div className="paper-swatches" role="group" aria-label="Document page colour">
      <button type="button" className={`paper-swatch theme-own${current ? '' : ' on'}`} aria-pressed={!current} aria-label="No colour" title="No colour" onClick={() => set(undefined)}>
        <span aria-hidden="true">∅</span>
      </button>
      {DOC_COLOURS.map(([hex, name]) => (
        <button key={hex} type="button" className={`paper-swatch${current === hex ? ' on' : ''}`} style={{ background: hex }} aria-pressed={current === hex} aria-label={`${name} pages`} title={name} onClick={() => set(hex)} />
      ))}
      <label className="paper-swatch custom" title="Any colour" style={current && !DOC_COLOURS.some(([h]) => h === current) ? { background: current } : undefined}>
        <span aria-hidden="true">+</span>
        <input type="color" aria-label="Any page colour" value={current ?? '#ffffff'} onChange={(e) => ed.setDocPara({ pgc: e.target.value })} />
      </label>
    </div>
  );
}

/** A sheet of paper in the colour chosen. */
const ICON_PAPER = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3h9l4 4v14H6z" fill="var(--paper, transparent)" />
    <path d="M15 3v4h4" />
  </svg>
);

const ICON_SETUP = svg('M6 3h9l4 4v14H6zM9 12h6M9 16h6M12 9v10');

/** Breaks, Columns, Orientation and Page Setup, as toolbar items (and the Page Setup window when it's open). */
export function useLayoutItems(ed: Editor | null, off: boolean, pageCtx: { page?: PageSetup | null; onPage?(p: PageSetup): void; chapters?: boolean } = {}): { items: ToolItem[]; dialog: React.ReactNode } {
  const [setup, setSetup] = useState(false);
  const items = layoutItems(ed, off);
  const open = () => setSetup(true);
  items.push({
    key: 'paper',
    label: 'Page colour',
    pri: 2,
    node: (
      <Drop label="Page colour" glyph={ICON_PAPER} off={false}>
        {(close) => (
          <div className="menu-list">
            {ed && (
              <>
                <span className="menu-head">This document’s pages</span>
                <DocColour ed={ed} onPicked={close} />
                <p className="menu-note">Saved with the document: page view, printing and Word.</p>
              </>
            )}
            <span className="menu-head">Paper you write on</span>
            <PaperSwatches onPicked={close} />
            <p className="menu-note">On screen, for every note and chapter.</p>
          </div>
        )}
      </Drop>
    ),
  });
  items.push({
    key: 'pagesetup',
    pri: 1,
    node: (
      <button type="button" aria-label="Page setup" title="Page setup" disabled={off} onClick={open}>
        {ICON_SETUP}
      </button>
    ),
    menu: (
      <button type="button" className="menu-item" disabled={off} onClick={open}>
        <span className="menu-glyph">{ICON_SETUP}</span> Page setup…
      </button>
    ),
  });
  return { items, dialog: setup && ed ? <PageSetupDialog editor={ed} page={pageCtx.page} onPage={pageCtx.onPage} chapters={pageCtx.chapters} onClose={() => setSetup(false)} /> : null };
}

/** Breaks, Columns and Orientation, as toolbar items. */
function layoutItems(ed: Editor | null, off: boolean): ToolItem[] {
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
              <button type="button" className="menu-item" onClick={act(close, () => ed?.insertSectionBreak('odd'))}>
                Odd page
              </button>
              <button type="button" className="menu-item" onClick={act(close, () => ed?.insertSectionBreak('even'))}>
                Even page
              </button>
              <hr className="menu-sep" />
              <span className="menu-head">Text</span>
              <button type="button" className="menu-item" title="The text after it starts below any picture or shape it's wrapping round" onClick={act(close, () => ed?.insertField('wrapbreak'))}>
                Text wrapping
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
      key: 'linenumbers', label: 'Line numbers',
      pri: 1,
      node: (
        <Drop label="Line numbers" glyph={ICON_LINES} off={off}>
          {(close) => {
            const p = ed?.docPara() ?? {};
            const now = !p.lnum ? 'none' : p.lnr === 'cont' ? 'cont' : p.lnr === 'sect' ? 'sect' : 'page';
            const pick = (v: 'none' | 'cont' | 'page' | 'sect') => act(close, () => ed?.setDocPara(v === 'none' ? { lnum: undefined, lnr: undefined } : { lnum: p.lnum ?? 1, lnr: v === 'page' ? undefined : v }));
            return (
              <div className="menu-list">
                {(
                  [
                    ['none', 'None'],
                    ['cont', 'Continuous'],
                    ['page', 'Restart each page'],
                    ['sect', 'Restart each section'],
                  ] as const
                ).map(([v, l]) => (
                  <button key={v} type="button" role="menuitemradio" aria-checked={now === v} className={`menu-item${now === v ? ' on' : ''}`} onClick={pick(v)}>
                    {l}
                  </button>
                ))}
                <label className="menu-row line-every">
                  Number every
                  <select aria-label="Number every" value={p.lnum ?? 1} disabled={!p.lnum} onChange={(e) => ed?.setDocPara({ lnum: Number(e.target.value) })}>
                    {[1, 2, 5, 10].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? 'line' : `${n} lines`}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="menu-note">In the margin, in page view (and printed).</p>
              </div>
            );
          }}
        </Drop>
      ),
    },
    {
      key: 'hyphenation', label: 'Hyphenation',
      pri: 1,
      node: (
        <Drop label="Hyphenation" glyph={ICON_HYPH} off={off}>
          {(close) => {
            const on = !!ed?.docPara().hyph;
            return (
              <div className="menu-list">
                <button type="button" role="menuitemradio" aria-checked={!on} className={`menu-item${!on ? ' on' : ''}`} onClick={act(close, () => ed?.setDocPara({ hyph: undefined }))}>
                  None
                </button>
                <button type="button" role="menuitemradio" aria-checked={on} className={`menu-item${on ? ' on' : ''}`} onClick={act(close, () => ed?.setDocPara({ hyph: true }))}>
                  Automatic
                </button>
                <hr className="menu-sep" />
                <button type="button" className="menu-item" title="A hyphen that shows only when the word breaks at the end of a line" onClick={act(close, () => ed?.typeText('\u00ad'))}>
                  Optional hyphen here <small className="menu-key">{mod}-</small>
                </button>
                <p className="menu-note">Automatic breaks long words at the ends of lines, in the language of the text.</p>
              </div>
            );
          }}
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
