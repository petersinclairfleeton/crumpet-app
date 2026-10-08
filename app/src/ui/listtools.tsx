// Word's list and border buttons for the formatting bar: Bullets and
// Numbering, each with its library of styles (and for numbering, starting
// again or from a number), and Borders and Shading for paragraphs.

import { useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { BULLETS, type BulletKind, type NumFormat, tidyBorder } from '@crumpet/editor/model';
import { Popover } from './Sidebar';
import type { ToolItem } from './toolbar';

const NUMBERS: [NumFormat, string, string][] = [
  ['decimal', '1. 2. 3.', 'Numbers'],
  ['paren', '1) 2) 3)', 'Numbers with brackets'],
  ['upper-alpha', 'A. B. C.', 'Capital letters'],
  ['lower-alpha', 'a. b. c.', 'Small letters'],
  ['upper-roman', 'I. II. III.', 'Capital Roman numerals'],
  ['lower-roman', 'i. ii. iii.', 'Small Roman numerals'],
  ['legal', '1. 1.1 1.1.1', 'Outline numbers (1.1.1)'],
];

const BULLET_NAMES: Record<BulletKind, string> = { disc: 'Round bullet', circle: 'Hollow bullet', square: 'Square bullet', dash: 'Dash', arrow: 'Arrow', check: 'Tick', diamond: 'Diamond', star: 'Star' };

const SHADES = [
  ['#f2f2f2', 'Light grey'], ['#d9d9d9', 'Grey'], ['#fff2cc', 'Light gold'], ['#fce5cd', 'Light orange'], ['#f4cccc', 'Light red'], ['#ead1dc', 'Light plum'],
  ['#d9d2e9', 'Light purple'], ['#cfe2f3', 'Light blue'], ['#d0e0e3', 'Light teal'], ['#d9ead3', 'Light green'], ['#ffff00', 'Yellow'], ['#000000', 'Black'],
];

const svg = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICON_BORDER = svg('M4 4h16v16H4z M4 12h16 M12 4v16');
const ICON_SHADE = svg('M5 13l7-7 6 6-7 7z M5 13l13 0 M19 15c0 1.5 1 2.5 1 3.5a1 1 0 0 1-2 0c0-1 1-2 1-3.5');

function ListTool({ ed, off, kind }: { ed: Editor | null; off: boolean; kind: 'bullet' | 'numbered' }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const blk = ed?.currentBlock();
  const active = blk?.type === kind;
  const label = kind === 'bullet' ? 'Bulleted list' : 'Numbered list';
  const act = (f: () => void) => () => {
    setOpen(false);
    f();
    ed?.focus();
  };
  const current = kind === 'bullet' ? (active ? (blk?.para?.bullet ?? null) : undefined) : active ? (blk?.para?.num ?? null) : undefined;
  return (
    <span className="tool-drop split-tool">
      <button type="button" className={active ? 'active' : ''} aria-label={label} aria-pressed={active} title={label} disabled={off} onClick={() => ed?.setBlockType(kind)}>
        {kind === 'bullet' ? '•≡' : '1≡'}
      </button>
      <button type="button" className="split-caret" aria-label={kind === 'bullet' ? 'Bullet styles' : 'Numbering styles'} aria-expanded={open} title={kind === 'bullet' ? 'Bullet styles' : 'Numbering styles'} disabled={off} onClick={() => setOpen(!open)}>
        ▾
      </button>
      {open && (
        <Popover label={kind === 'bullet' ? 'Bullet library' : 'Numbering library'} onClose={() => setOpen(false)}>
          <div className="list-library" role="group" aria-label={kind === 'bullet' ? 'Bullet library' : 'Numbering library'}>
            {kind === 'bullet'
              ? (Object.keys(BULLETS) as BulletKind[]).map((k) => (
                  <button key={k} type="button" className={`list-choice bullet-choice${current === k || (current === null && k === 'disc') ? ' on' : ''}`} aria-label={BULLET_NAMES[k]} title={BULLET_NAMES[k]} onClick={act(() => ed?.setListStyle({ bullet: k }))}>
                    {BULLETS[k]}
                  </button>
                ))
              : NUMBERS.map(([f, sample, name]) => (
                  <button key={f} type="button" className={`list-choice${current === f || (current === null && f === 'decimal') ? ' on' : ''}`} aria-label={name} title={name} onClick={act(() => ed?.setListStyle({ num: f }))}>
                    {sample}
                  </button>
                ))}
          </div>
          {kind === 'numbered' && active && (
            <>
              <hr className="menu-sep" />
              <button type="button" className="menu-item" onClick={act(() => ed?.setListStart(1))}>
                Restart at 1
              </button>
              <button type="button" className="menu-item" onClick={act(() => ed?.setListStart(undefined))}>
                Continue numbering
              </button>
              <form
                className="menu-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Math.round(Number(value));
                  if (value.trim() && Number.isFinite(n) && n >= 0) act(() => ed?.setListStart(n))();
                }}
              >
                <label>
                  Set value to <input type="number" min={0} aria-label="Numbering value" value={value} placeholder={String(blk?.para?.start ?? '')} onChange={(e) => setValue(e.target.value)} />
                </label>
                <button type="submit" className="btn quiet">
                  Set
                </button>
              </form>
            </>
          )}
        </Popover>
      )}
    </span>
  );
}

const SIDES: [string, string][] = [
  ['b', 'Bottom border'],
  ['t', 'Top border'],
  ['l', 'Left border'],
  ['r', 'Right border'],
];

function BorderTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  const now = ed?.paraValue('border') ?? '';
  const set = (border: string) => {
    setOpen(false);
    ed?.setPara({ border: tidyBorder(border) || undefined });
    ed?.focus();
  };
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Borders" aria-expanded={open} title="Borders" disabled={off} onClick={() => setOpen(!open)}>
        {ICON_BORDER}
        <span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && (
        <Popover label="Borders" onClose={() => setOpen(false)}>
          {SIDES.map(([c, name]) => (
            <button key={c} type="button" role="menuitemcheckbox" aria-checked={now.includes(c)} className={`menu-item${now.includes(c) ? ' on' : ''}`} onClick={() => set(now.includes(c) ? now.replace(c, '') : now + c)}>
              {name}
            </button>
          ))}
          <hr className="menu-sep" />
          <button type="button" className={`menu-item${now === 'tblr' ? ' on' : ''}`} onClick={() => set('tblr')}>
            Box (all sides)
          </button>
          <button type="button" className="menu-item" onClick={() => set('')}>
            No border
          </button>
        </Popover>
      )}
    </span>
  );
}

function ShadingTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  const now = ed?.paraValue('shade');
  const pick = (c: string | undefined) => {
    setOpen(false);
    ed?.setPara({ shade: c });
    ed?.focus();
  };
  return (
    <span className="tool-drop">
      <button type="button" className="color-tool" aria-label="Shading" aria-expanded={open} title="Shading" disabled={off} onClick={() => setOpen(!open)}>
        {ICON_SHADE}
        <i className="color-bar" style={{ background: now ?? 'transparent' }} />
      </button>
      {open && (
        <Popover label="Shading" onClose={() => setOpen(false)}>
          <button type="button" className="menu-item" onClick={() => pick(undefined)}>
            No colour
          </button>
          <div className="swatches" role="group" aria-label="Shading colours">
            {SHADES.map(([hex, name]) => (
              <button key={hex} type="button" className={`swatch-btn${now === hex ? ' on' : ''}`} style={{ background: hex }} aria-label={name} title={name} onClick={() => pick(hex)} />
            ))}
          </div>
        </Popover>
      )}
    </span>
  );
}

/** Bullets and Numbering (with their libraries), as toolbar items. */
export function listItems(ed: Editor | null, off: boolean): ToolItem[] {
  return [
    { key: 'bullet', label: 'Bullets', pri: 2, sep: true, node: <ListTool ed={ed} off={off} kind="bullet" /> },
    { key: 'numbered', label: 'Numbering', pri: 2, node: <ListTool ed={ed} off={off} kind="numbered" /> },
  ];
}

/** Borders and Shading, as toolbar items. */
export function borderItems(ed: Editor | null, off: boolean): ToolItem[] {
  return [
    { key: 'borders', label: 'Borders', pri: 1, node: <BorderTool ed={ed} off={off} /> },
    { key: 'shading', label: 'Shading', pri: 1, node: <ShadingTool ed={ed} off={off} /> },
  ];
}
