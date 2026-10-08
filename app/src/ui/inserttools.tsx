// Word's Insert extras for the formatting bar: symbols and special
// characters, and today's date or the time in a choice of forms.

import { useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
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

export function insertItems(ed: Editor | null, off: boolean): ToolItem[] {
  const toc = () => {
    ed?.focus();
    ed?.insertToc();
  };
  return [
    { key: 'symbol', pri: 1, sep: true, node: <SymbolTool ed={ed} off={off} /> },
    { key: 'date', pri: 1, node: <DateTool ed={ed} off={off} /> },
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
