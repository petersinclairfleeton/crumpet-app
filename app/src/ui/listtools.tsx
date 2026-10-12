// Word's list and border buttons for the formatting bar: Bullets and
// Numbering, each with its library of styles (and for numbering, starting
// again or from a number), Multilevel List (a gallery, and lists of your own
// design), and Borders (sides, line style and colour) and Shading for paragraphs.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import type { ListLevel } from '@crumpet/editor/commands';
import { BULLETS, type BulletKind, type NumFormat, type ParaLook, makeBlock, listLabels, tidyBorder } from '@crumpet/editor/model';
import { IconClose } from './icons';
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
const ICON_MULTI = svg('M9 6h12M12 12h9M15 18h6M3 5h2v3M3 11h3l-3 3h3M6 17H4v4h2');
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

/** Word's border line styles and some colours. */
const BORDER_STYLES: [NonNullable<ParaLook['bstyle']>, string, string][] = [
  ['single', 'Single', '1px solid currentColor'],
  ['thick', 'Thick', '3px solid currentColor'],
  ['double', 'Double', '3px double currentColor'],
  ['dotted', 'Dotted', '2px dotted currentColor'],
  ['dashed', 'Dashed', '2px dashed currentColor'],
];
const BORDER_COLORS: [string, string][] = [
  ['', 'Automatic'],
  ['#7a7a7a', 'Grey'],
  ['#2f6fd1', 'Blue'],
  ['#2e8b57', 'Green'],
  ['#c0392b', 'Red'],
  ['#d08a00', 'Gold'],
  ['#7b4fb8', 'Purple'],
];

function BorderTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  const now = ed?.paraValue('border') ?? '';
  const style = ed?.paraValue('bstyle');
  const color = ed?.paraValue('bcolor');
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
          <hr className="menu-sep" />
          <span className="menu-head">Line</span>
          <div className="border-styles" role="group" aria-label="Border line">
            {BORDER_STYLES.map(([st, name, css]) => (
              <button key={st} type="button" title={name} aria-label={`${name} line`} aria-pressed={(style ?? 'single') === st} className={`border-style${(style ?? 'single') === st ? ' on' : ''}`} onClick={() => ed?.setPara({ bstyle: st === 'single' ? undefined : st, border: now || 'tblr' })}>
                <i style={{ borderBottom: css }} />
              </button>
            ))}
          </div>
          <div className="accents" role="group" aria-label="Border colour">
            {BORDER_COLORS.map(([c, name]) => (
              <button key={name} type="button" className={`swatch${(color ?? '') === c ? ' on' : ''}`} style={{ background: c || 'var(--text)' }} aria-label={`${name} border`} title={name} onClick={() => ed?.setPara({ bcolor: c || undefined, border: now || 'tblr' })} />
            ))}
          </div>
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
/** Word's multilevel list gallery. */
const MULTILEVELS: [string, ListLevel[]][] = [
  ['1. a. i.', [{ num: 'decimal' }, { num: 'lower-alpha' }, { num: 'lower-roman' }]],
  ['1) a) i)', [{ num: 'paren' }, { num: 'lower-alpha', text: '%2)' }, { num: 'lower-roman', text: '%3)' }]],
  ['1. 1.1. 1.1.1.', [{ num: 'decimal', text: '%1.' }, { num: 'decimal', text: '%1.%2.' }, { num: 'decimal', text: '%1.%2.%3.' }, { num: 'decimal', text: '%1.%2.%3.%4.' }]],
  ['I. A. 1. a)', [{ num: 'upper-roman' }, { num: 'upper-alpha' }, { num: 'decimal' }, { num: 'lower-alpha', text: '%4)' }, { num: 'lower-roman', text: '(%5)' }]],
  ['(1) (a) (i)', [{ num: 'decimal', text: '(%1)' }, { num: 'lower-alpha', text: '(%2)' }, { num: 'lower-roman', text: '(%3)' }]],
  ['Chapter 1, 1.1', [{ num: 'decimal', text: 'Chapter %1' }, { num: 'decimal', text: '%1.%2' }, { num: 'decimal', text: '%1.%2.%3' }]],
  ['Article I, Section 1.01', [{ num: 'upper-roman', text: 'Article %1.' }, { num: 'legal', text: 'Section %1.0%2' }, { num: 'lower-alpha', text: '(%3)' }]],
];

/** How a multilevel list's first three levels look, for the gallery and the preview. */
function sampleLabels(levels: ListLevel[], depth = 3): string[] {
  const blocks = Array.from({ length: depth }, (_, i) => makeBlock('numbered', '', [], { indent: i, para: { num: levels[Math.min(i, levels.length - 1)].num, ...(levels[Math.min(i, levels.length - 1)].text ? { numText: levels[Math.min(i, levels.length - 1)].text } : {}) } }));
  const labels = listLabels(blocks);
  return blocks.map((b) => labels.get(b.id) ?? '');
}

function MultilevelTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  const pick = (levels: ListLevel[]) => {
    setOpen(false);
    ed?.setMultilevel(levels);
    ed?.focus();
  };
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Multilevel list" aria-expanded={open} title="Multilevel list" disabled={off} onClick={() => setOpen(!open)}>
        {ICON_MULTI}
        <span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && (
        <Popover label="Multilevel list" onClose={() => setOpen(false)}>
          <div className="multi-gallery" role="group" aria-label="Multilevel lists">
            {MULTILEVELS.map(([name, levels]) => (
              <button key={name} type="button" className="multi-sample" aria-label={name} title={name} onClick={() => pick(levels)}>
                {sampleLabels(levels).map((l, i) => (
                  <span key={i} style={{ paddingLeft: `${i * 10}px` }}>
                    {l} <i />
                  </span>
                ))}
              </button>
            ))}
          </div>
          <hr className="menu-sep" />
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              // The window lives outside the bar (the More menu closes as it opens).
              window.dispatchEvent(new Event(DEFINE_EVENT));
            }}
          >
            Define new multilevel list…
          </button>
        </Popover>
      )}
    </span>
  );
}

const DEFINE_EVENT = 'crumpet:define-list';

/** Shows the Define New Multilevel List window when asked, for the formatting bar's editor. */
export function DefineListHost({ ed }: { ed: Editor | null }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(DEFINE_EVENT, show);
    return () => window.removeEventListener(DEFINE_EVENT, show);
  }, []);
  return open && ed ? <DefineListDialog editor={ed} onClose={() => setOpen(false)} /> : null;
}

/** Word's Define New Multilevel List: each level's number style and how its number is shown. */
function DefineListDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const [levels, setLevels] = useState<ListLevel[]>([
    { num: 'decimal', text: '%1.' },
    { num: 'lower-alpha', text: '%2.' },
    { num: 'lower-roman', text: '%3.' },
    { num: 'decimal', text: '(%4)' },
    { num: 'lower-alpha', text: '(%5)' },
  ]);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const set = (i: number, patch: Partial<ListLevel>) => setLevels(levels.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const preview = sampleLabels(levels, levels.length);
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="dialog para-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Define new multilevel list"
        onSubmit={(e) => {
          e.preventDefault();
          editor.setMultilevel(levels.map((l) => ({ num: l.num, ...(l.text && /%[1-9]/.test(l.text) ? { text: l.text } : {}) })));
          onClose();
          editor.focus();
        }}
      >
        <header className="dialog-head">
          <h2>Define new multilevel list</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <p className="sync-hint">For each level: its number style, and how its number is shown. %1 is the number at level 1, %2 at level 2, and so on, so “%1.%2” shows 1.1, and “Chapter %1” shows Chapter 1.</p>
          <div className="define-levels">
            {levels.map((l, i) => (
              <div key={i} className="define-level">
                <span className="define-n">Level {i + 1}</span>
                <select aria-label={`Level ${i + 1} number style`} value={l.num} onChange={(e) => set(i, { num: e.target.value as NumFormat })}>
                  {NUMBERS.filter(([f]) => f !== 'legal').map(([f, , name]) => (
                    <option key={f} value={f}>
                      {name}
                    </option>
                  ))}
                </select>
                <input aria-label={`Level ${i + 1} number shown as`} value={l.text ?? ''} onChange={(e) => set(i, { text: e.target.value })} />
                <span className="define-sample" style={{ paddingLeft: `${i * 12}px` }}>
                  {preview[i]}
                </span>
              </div>
            ))}
          </div>
          <div className="para-foot">
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

export function listItems(ed: Editor | null, off: boolean): ToolItem[] {
  return [
    { key: 'bullet', label: 'Bullets', pri: 2, sep: true, node: <ListTool ed={ed} off={off} kind="bullet" /> },
    { key: 'numbered', label: 'Numbering', pri: 2, node: <ListTool ed={ed} off={off} kind="numbered" /> },
    { key: 'multilevel', label: 'Multilevel list', pri: 1, node: <MultilevelTool ed={ed} off={off} /> },
  ];
}

/** Borders and Shading, as toolbar items. */
export function borderItems(ed: Editor | null, off: boolean): ToolItem[] {
  return [
    { key: 'borders', label: 'Borders', pri: 1, node: <BorderTool ed={ed} off={off} /> },
    { key: 'shading', label: 'Shading', pri: 1, node: <ShadingTool ed={ed} off={off} /> },
  ];
}
