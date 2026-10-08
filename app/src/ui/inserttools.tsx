// Word's Insert extras for the formatting bar: symbols and special
// characters, and today's date or the time in a choice of forms.

import { useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { ShapeKind } from '@crumpet/editor/shape';
import { Popover } from './Sidebar';
import type { ToolItem } from './toolbar';

const SYMBOLS: [string, string][] = [
  ['—', 'Em dash'], ['–', 'En dash'], ['…', 'Ellipsis'], ['‘', 'Opening single quote'], ['’', 'Closing single quote'], ['“', 'Opening double quote'], ['”', 'Closing double quote'],
  ['«', 'Opening guillemet'], ['»', 'Closing guillemet'], ['„', 'Low double quote'], ['•', 'Bullet'], ['·', 'Middle dot'], ['§', 'Section'], ['¶', 'Pilcrow'],
  ['†', 'Dagger'], ['‡', 'Double dagger'], ['©', 'Copyright'], ['®', 'Registered'], ['™', 'Trade mark'], ['°', 'Degree'], ['±', 'Plus or minus'],
  ['×', 'Times'], ['÷', 'Divide'], ['≈', 'Almost equal'], ['≠', 'Not equal'], ['≤', 'Less or equal'], ['≥', 'Greater or equal'], ['∞', 'Infinity'],
  ['½', 'One half'], ['⅓', 'One third'], ['¼', 'One quarter'], ['¾', 'Three quarters'], ['€', 'Euro'], ['£', 'Pound'], ['¥', 'Yen'],
  ['¢', 'Cent'], ['←', 'Left arrow'], ['→', 'Right arrow'], ['↑', 'Up arrow'], ['↓', 'Down arrow'], ['✓', 'Tick'], ['✗', 'Cross'],
  ['★', 'Star'], ['♥', 'Heart'], ['♪', 'Note'], ['☐', 'Box'], ['☒', 'Ticked box'], [' ', 'Non-breaking space'], ['‑', 'Non-breaking hyphen'],
  ['é', 'e acute'], ['è', 'e grave'], ['ê', 'e circumflex'], ['ë', 'e diaeresis'], ['á', 'a acute'], ['à', 'a grave'], ['â', 'a circumflex'],
  ['ä', 'a umlaut'], ['å', 'a ring'], ['æ', 'ae'], ['ç', 'c cedilla'], ['ñ', 'n tilde'], ['ö', 'o umlaut'], ['ø', 'o slash'],
  ['œ', 'oe'], ['ü', 'u umlaut'], ['ß', 'sharp s'], ['í', 'i acute'], ['ó', 'o acute'], ['ú', 'u acute'], ['ý', 'y acute'],
  ['É', 'E acute'], ['À', 'A grave'], ['Ç', 'C cedilla'], ['Ñ', 'N tilde'], ['Ö', 'O umlaut'], ['Ü', 'U umlaut'], ['Æ', 'AE'],
  ['α', 'alpha'], ['β', 'beta'], ['γ', 'gamma'], ['δ', 'delta'], ['π', 'pi'], ['σ', 'sigma'], ['Ω', 'Omega'],
];

function SymbolTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Insert symbol" aria-expanded={open} title="Insert symbol" disabled={off} onClick={() => setOpen(!open)}>
        Ω
      </button>
      {open && (
        <Popover label="Symbols" onClose={() => setOpen(false)}>
          <div className="symbol-grid" role="group" aria-label="Symbols">
            {SYMBOLS.map(([c, name]) => (
              <button
                key={name}
                type="button"
                className="symbol-btn"
                aria-label={name}
                title={name}
                onClick={() => {
                  setOpen(false);
                  ed?.focus();
                  ed?.typeText(c);
                }}
              >
                {c === ' ' ? '⍽' : c === '‑' ? '‑' : c}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </span>
  );
}

function DateTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const forms = [
    now.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
    now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    now.toLocaleDateString(),
    now.toISOString().slice(0, 10),
    now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    now.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
  ];
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Insert date and time" aria-expanded={open} title="Insert date and time" disabled={off} onClick={() => setOpen(!open)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />
        </svg>
      </button>
      {open && (
        <Popover label="Date and time" onClose={() => setOpen(false)}>
          {[...new Set(forms)].map((f) => (
            <button
              key={f}
              type="button"
              className="menu-item"
              onClick={() => {
                setOpen(false);
                ed?.focus();
                ed?.typeText(f);
              }}
            >
              {f}
            </button>
          ))}
        </Popover>
      )}
    </span>
  );
}

const ICON_TOC = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h10M4 12h10M7 18h7M18 6h2M18 12h2M18 18h2" />
  </svg>
);

const SHAPES: [ShapeKind, string, string][] = [
  ['rect', 'Rectangle', 'M3 6h18v12H3z'],
  ['rounded', 'Rounded rectangle', 'M7 6h10a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4z'],
  ['ellipse', 'Oval', 'M12 6c5 0 9 2.7 9 6s-4 6-9 6-9-2.7-9-6 4-6 9-6z'],
  ['line', 'Line', 'M3 12h18'],
  ['arrow', 'Arrow', 'M3 12h16M15 8l4 4-4 4'],
];

const ICON_TEXTBOX = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 5h18v14H3zM8 9h8M12 9v7" />
  </svg>
);

/** Word's Insert > Shapes: a gallery of shapes. */
function ShapesTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Shapes" aria-expanded={open} title="Shapes" disabled={off} onClick={() => setOpen(!open)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 13h8v8H3zM17 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM14 21l4-7 4 7z" />
        </svg>
        <span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && (
        <Popover label="Shapes" onClose={() => setOpen(false)}>
          <div className="shape-gallery" role="group" aria-label="Shapes">
            {SHAPES.map(([kind, name, d]) => (
              <button
                key={kind}
                type="button"
                className="symbol-btn"
                aria-label={name}
                title={name}
                onClick={() => {
                  setOpen(false);
                  ed?.focus();
                  ed?.insertShape(kind);
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={d} />
                </svg>
              </button>
            ))}
          </div>
        </Popover>
      )}
    </span>
  );
}

export function insertItems(ed: Editor | null, off: boolean): ToolItem[] {
  const textBox = () => {
    ed?.focus();
    ed?.insertShape('rect', true);
  };
  const toc = () => {
    ed?.focus();
    ed?.insertToc();
  };
  return [
    { key: 'symbol', label: 'Symbol', pri: 1, sep: true, node: <SymbolTool ed={ed} off={off} /> },
    { key: 'date', label: 'Date and time', pri: 1, node: <DateTool ed={ed} off={off} /> },
    {
      key: 'textbox',
      pri: 1,
      node: (
        <button type="button" aria-label="Text box" title="Text box" disabled={off} onClick={textBox}>
          {ICON_TEXTBOX}
        </button>
      ),
      menu: (
        <button type="button" className="menu-item" disabled={off} onClick={textBox}>
          <span className="menu-glyph">{ICON_TEXTBOX}</span> Text box
        </button>
      ),
    },
    { key: 'shapes', label: 'Shapes', pri: 1, node: <ShapesTool ed={ed} off={off} /> },
    {
      key: 'toc',
      pri: 1,
      node: (
        <button type="button" aria-label="Table of contents" title="Table of contents" disabled={off} onClick={toc}>
          {ICON_TOC}
        </button>
      ),
      menu: (
        <button type="button" className="menu-item" disabled={off} onClick={toc}>
          <span className="menu-glyph">{ICON_TOC}</span> Table of contents
        </button>
      ),
    },
  ];
}
