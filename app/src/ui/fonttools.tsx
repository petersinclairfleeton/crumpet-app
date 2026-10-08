// Word's Font group for the formatting bar: font, size, grow and shrink,
// text colour, highlighter, superscript and subscript, change case and clear
// formatting. They act on the selected text, or on what's typed next.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { CaseChange } from '@crumpet/editor/commands';
import type { Doc } from '@crumpet/editor/model';
import { type StyleSheet, styleKeyOf } from '../data/styles';
import { DEFAULT_NOTE_SIZE } from '../data/types';
import { type FontChoice, DEFAULT_FONT, googleFonts, loadGoogleFont, systemFonts } from './fonts';
import { useAppState } from './hooks';
import { Popover } from './Sidebar';
import type { ToolItem } from './toolbar';

/** Word's list of sizes. */
export const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

/** The font and size a paragraph has when nothing is set on its text. */
function useBase(ed: Editor | null, sheet: StyleSheet): { font: string; size: number } {
  const settings = useAppState().settings;
  const def = ed ? sheet.styles[styleKeyOf(ed.currentBlock())] : undefined;
  return {
    font: def?.font?.family ?? settings.noteFont?.family ?? DEFAULT_FONT.family,
    size: def?.size ?? Math.round((settings.noteSize ?? DEFAULT_NOTE_SIZE) * 0.75 * 2) / 2,
  };
}

/** Fonts used anywhere in a document, for the top of the font list. */
export function docFonts(doc: Doc): string[] {
  const out = new Set<string>();
  for (const b of doc.blocks) for (const r of b.runs) if (r.look?.font) out.add(r.look.font);
  return [...out].sort();
}

/** Loads the Google fonts a document uses (fonts on the device need nothing). */
export function useDocFontsLoaded(editor: Editor | null): void {
  useEffect(() => {
    if (!editor) return;
    let list: FontChoice[] | null = null;
    const load = () => {
      const used = docFonts(editor.state.doc);
      if (!used.length) return;
      const go = (all: FontChoice[]) => used.forEach((f) => {
        const g = all.find((x) => x.family === f);
        if (g) loadGoogleFont(g.family, g.styles ?? 1);
      });
      if (list) go(list);
      else void googleFonts().then((all) => go((list = all)));
    };
    load();
    return editor.onChange(load);
  }, [editor]);
}

function FontBox({ ed, off, base }: { ed: Editor | null; off: boolean; base: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [google, setGoogle] = useState<FontChoice[]>([]);
  const [local, setLocal] = useState<FontChoice[]>([]);
  const current = ed?.lookValue('font');
  const used = useMemo(() => (open && ed ? docFonts(ed.state.doc) : []), [open, ed]);

  useEffect(() => {
    if (!open) return;
    void googleFonts().then(setGoogle);
    void systemFonts().then(setLocal);
  }, [open]);

  const q = query.trim().toLowerCase();
  const match = (f: string) => !q || f.toLowerCase().includes(q);
  const shownLocal = local.filter((f) => match(f.family)).slice(0, 30);
  const shownGoogle = google.filter((f) => match(f.family) && !local.some((l) => l.family === f.family)).slice(0, q ? 60 : 30);
  useEffect(() => {
    for (const f of shownGoogle) loadGoogleFont(f.family, f.styles ?? 1, f.family);
  }, [shownGoogle.map((f) => f.family).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (font: string | null, styles?: number) => {
    setOpen(false);
    setQuery('');
    if (font && styles !== undefined) loadGoogleFont(font, styles);
    ed?.setLook('font', font);
    ed?.focus();
  };
  const option = (family: string, note: string, styles?: number) => (
    <button key={`${note}:${family}`} type="button" role="option" aria-selected={current === family} className="menu-item font-option" style={{ fontFamily: `"${family}", var(--note-font)` }} onClick={() => pick(family, styles)}>
      {family}
      <small>{note}</small>
    </button>
  );
  return (
    <span className="tool-drop">
      <button type="button" className="font-box" aria-label="Font" aria-expanded={open} title="Font" disabled={off} onClick={() => setOpen(!open)}>
        <span className="ellipsis" style={{ fontFamily: `"${current ?? base}", var(--note-font)` }}>
          {current ?? base}
        </span>{' '}
        ▾
      </button>
      {open && (
        <Popover label="Fonts" onClose={() => setOpen(false)}>
          <input className="font-search" type="search" autoFocus placeholder="Search fonts" aria-label="Search fonts" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} />
          <div className="font-menu" role="listbox" aria-label="Fonts">
            {!q && (
              <button type="button" role="option" aria-selected={!current} className="menu-item font-option" onClick={() => pick(null)}>
                {base}
                <small>the style’s own</small>
              </button>
            )}
            {used.filter(match).length > 0 && <p className="menu-label">In this document</p>}
            {used.filter(match).map((f) => option(f, ''))}
            {shownLocal.length > 0 && <p className="menu-label">On this device</p>}
            {shownLocal.map((f) => option(f.family, ''))}
            {shownGoogle.length > 0 && <p className="menu-label">Google Fonts</p>}
            {shownGoogle.map((f) => option(f.family, f.category === 'sans-serif' ? 'sans' : f.category, f.styles ?? 1))}
          </div>
        </Popover>
      )}
    </span>
  );
}

function SizeBox({ ed, off, base }: { ed: Editor | null; off: boolean; base: number }) {
  const current = ed?.lookValue('size');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const shown = String(current ?? base);
  useEffect(() => setText(shown), [shown]);
  const apply = (n: number) => {
    setOpen(false);
    if (!(n > 0 && n <= 400)) return setText(shown);
    ed?.setLook('size', n === base ? null : n);
    ed?.focus();
  };
  return (
    <span className="tool-drop size-box">
      <input
        aria-label="Font size"
        title="Font size"
        inputMode="decimal"
        disabled={off}
        value={text}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply(parseFloat(text));
          } else if (e.key === 'Escape') {
            setText(shown);
            ed?.focus();
          }
        }}
      />
      <button type="button" aria-label="Font sizes" aria-expanded={open} disabled={off} onClick={() => setOpen(!open)}>
        ▾
      </button>
      {open && (
        <Popover label="Font sizes" onClose={() => setOpen(false)}>
          <div className="size-menu">
            {SIZES.map((n) => (
              <button key={n} type="button" className={`menu-item${n === (current ?? base) ? ' on' : ''}`} onClick={() => apply(n)}>
                {n}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </span>
  );
}

/** One size up or down Word's list (Ctrl+Shift+> and <). */
export function stepSize(ed: Editor, base: number, up: boolean): void {
  const now = ed.lookValue('size') ?? base;
  const next = up ? (SIZES.find((n) => n > now) ?? now + 10) : ([...SIZES].reverse().find((n) => n < now) ?? Math.max(1, now - 1));
  ed.setLook('size', next === base ? null : next);
}

const TEXT_COLORS = [
  ['#000000', 'Black'], ['#434343', 'Dark grey'], ['#666666', 'Grey'], ['#999999', 'Light grey'], ['#b7b7b7', 'Silver'], ['#ffffff', 'White'],
  ['#980000', 'Dark red'], ['#cc0000', 'Red'], ['#e69138', 'Orange'], ['#f1c232', 'Gold'], ['#6aa84f', 'Green'], ['#45818e', 'Teal'],
  ['#3c78d8', 'Blue'], ['#1155cc', 'Dark blue'], ['#674ea7', 'Purple'], ['#a64d79', 'Plum'], ['#783f04', 'Brown'], ['#0c343d', 'Ink'],
];
const HIGHLIGHT_COLORS = [
  ['#ffff00', 'Yellow'], ['#00ff00', 'Bright green'], ['#00ffff', 'Turquoise'], ['#ff00ff', 'Pink'], ['#0000ff', 'Blue'], ['#ff0000', 'Red'],
  ['#000080', 'Dark blue'], ['#008080', 'Teal'], ['#008000', 'Green'], ['#800080', 'Violet'], ['#800000', 'Dark red'], ['#808000', 'Dark yellow'],
  ['#808080', 'Grey 50%'], ['#c0c0c0', 'Grey 25%'], ['#000000', 'Black'],
];

function ColorTool({ ed, off, kind }: { ed: Editor | null; off: boolean; kind: 'color' | 'highlight' }) {
  const [open, setOpen] = useState(false);
  const custom = useRef<HTMLInputElement>(null);
  const current = ed?.lookValue(kind);
  const label = kind === 'color' ? 'Font colour' : 'Highlight';
  const swatches = kind === 'color' ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const pick = (c: string | null) => {
    setOpen(false);
    ed?.setLook(kind, c);
    ed?.focus();
  };
  return (
    <span className="tool-drop">
      <button type="button" className="color-tool" aria-label={label} aria-expanded={open} title={label} disabled={off} onClick={() => setOpen(!open)}>
        {kind === 'color' ? (
          <span className="color-a">A</span>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11l-5 5v3h6l5-5M9 11l6-6 4 4-6 6M9 11l4 4" />
          </svg>
        )}
        <i className="color-bar" style={{ background: current ?? (kind === 'color' ? 'var(--text)' : 'transparent') }} />
      </button>
      {open && (
        <Popover label={label} onClose={() => setOpen(false)}>
          <button type="button" className="menu-item" onClick={() => pick(null)}>
            {kind === 'color' ? 'Automatic' : 'No colour'}
          </button>
          <div className="swatches" role="group" aria-label={`${label} colours`}>
            {swatches.map(([hex, name]) => (
              <button key={hex} type="button" className={`swatch-btn${current === hex ? ' on' : ''}`} style={{ background: hex }} aria-label={name} title={name} onClick={() => pick(hex)} />
            ))}
          </div>
          <button type="button" className="menu-item" onClick={() => custom.current?.click()}>
            More colours…
          </button>
          <input ref={custom} type="color" className="visually-hidden" tabIndex={-1} aria-hidden="true" defaultValue={current ?? '#000000'} onChange={(e) => pick(e.target.value)} />
        </Popover>
      )}
    </span>
  );
}

const CASES: [CaseChange, string][] = [
  ['sentence', 'Sentence case.'],
  ['lower', 'lowercase'],
  ['upper', 'UPPERCASE'],
  ['title', 'Capitalize Each Word'],
  ['toggle', 'tOGGLE cASE'],
];

function CaseTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Change case" aria-expanded={open} title="Change case" disabled={off} onClick={() => setOpen(!open)}>
        Aa▾
      </button>
      {open && (
        <Popover label="Change case" onClose={() => setOpen(false)}>
          {CASES.map(([how, label]) => (
            <button
              key={how}
              type="button"
              className="menu-item"
              onClick={() => {
                setOpen(false);
                ed?.changeCase(how);
                ed?.focus();
              }}
            >
              {label}
            </button>
          ))}
        </Popover>
      )}
    </span>
  );
}

/** The Font group, as toolbar items (see OverflowRow). */
export function useFontItems(ed: Editor | null, off: boolean, sheet: StyleSheet): ToolItem[] {
  const base = useBase(ed, sheet);
  const va = ed?.lookValue('va');
  const simple = (key: string, pri: number, label: string, glyph: React.ReactNode, onClick: () => void, active?: boolean): ToolItem => ({
    key,
    pri,
    node: (
      <button type="button" className={active ? 'active' : ''} aria-label={label} aria-pressed={active} title={label} disabled={off} onClick={onClick}>
        {glyph}
      </button>
    ),
    menu: (
      <button type="button" className={`menu-item${active ? ' on' : ''}`} disabled={off} onClick={onClick}>
        <span className="menu-glyph">{glyph}</span> {label}
      </button>
    ),
  });
  return [
    { key: 'font', pri: 3, sep: true, node: <FontBox ed={ed} off={off} base={base.font} /> },
    { key: 'size', pri: 3, node: <SizeBox ed={ed} off={off} base={base.size} /> },
    simple('grow', 1, 'Increase font size (Ctrl+Shift+>)', <span className="glyph-grow">A<sup>▲</sup></span>, () => ed && stepSize(ed, base.size, true)),
    simple('shrink', 1, 'Decrease font size (Ctrl+Shift+<)', <span className="glyph-grow small">A<sup>▼</sup></span>, () => ed && stepSize(ed, base.size, false)),
    { key: 'color', pri: 2, label: 'Font colour', node: <ColorTool ed={ed} off={off} kind="color" /> },
    { key: 'highlight', pri: 2, label: 'Highlight', node: <ColorTool ed={ed} off={off} kind="highlight" /> },
    simple('sup', 1, 'Superscript (Ctrl+Shift+=)', <span>x<sup>2</sup></span>, () => ed?.setLook('va', va === 'super' ? null : 'super'), va === 'super'),
    simple('sub', 1, 'Subscript (Ctrl+=)', <span>x<sub>2</sub></span>, () => ed?.setLook('va', va === 'sub' ? null : 'sub'), va === 'sub'),
    { key: 'case', pri: 1, label: 'Change case', node: <CaseTool ed={ed} off={off} /> },
    simple('clear', 1, 'Clear formatting (Ctrl+Space)', <span className="glyph-clear">A<small>✕</small></span>, () => ed?.clearFormatting()),
  ];
}

/** Word's keys for the Font group, while typing in this editor. */
export function useFontKeys(ed: Editor | null, sheet: StyleSheet): void {
  const base = useBase(ed, sheet);
  const size = useRef(base.size);
  size.current = base.size;
  useEffect(() => {
    if (!ed) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      let done = true;
      if (e.shiftKey && (e.key === '>' || e.code === 'Period')) stepSize(ed, size.current, true);
      else if (e.shiftKey && (e.key === '<' || e.code === 'Comma')) stepSize(ed, size.current, false);
      else if (e.shiftKey && (e.key === '+' || e.code === 'Equal')) ed.setLook('va', ed.lookValue('va') === 'super' ? null : 'super');
      else if (!e.shiftKey && (e.key === '=' || e.code === 'Equal')) ed.setLook('va', ed.lookValue('va') === 'sub' ? null : 'sub');
      else if (!e.shiftKey && e.code === 'Space') ed.clearFormatting();
      else done = false;
      if (done) e.preventDefault();
    };
    const root = ed.view.root;
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [ed]);
}
