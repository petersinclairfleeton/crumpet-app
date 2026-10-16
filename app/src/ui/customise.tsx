// Customise the formatting bar (Word's Customize the Ribbon): every button,
// shown or hidden, and those kept on the bar (never moved under More when the
// window is narrow). Kept in settings.toolbarCustom.

import { useEffect, useState } from 'react';
import type { ToolItem } from './toolbar';
import { useAppState, useAppStore } from './hooks';

const OPEN = 'crumpet:customise-bar';
let taken = false;
export const openCustomise = () => window.dispatchEvent(new Event(OPEN));

/** The bar's buttons as the person likes them: hidden ones left out, pinned ones kept on the bar. */
export function customised(items: ToolItem[], custom: { hide?: string[]; pin?: string[] } | undefined): ToolItem[] {
  const hide = new Set(custom?.hide ?? []);
  const pin = new Set(custom?.pin ?? []);
  return items.filter((i) => !hide.has(i.key)).map((i) => (pin.has(i.key) ? { ...i, pri: 9 } : i));
}

/** Names for buttons without a label of their own. */
const NAMES: Record<string, string> = {
  sup: 'Superscript', sub: 'Subscript', fontdlg: 'Font window', grow: 'Grow font', shrink: 'Shrink font', clear: 'Clear formatting', case: 'Change case', color: 'Font colour',
  blankpage: 'Blank page', screenshot: 'Screenshot', chart: 'Chart', draw: 'Draw', dropcap: 'Drop cap', textbox: 'Text box', toc: 'Table of contents', pagesetup: 'Page setup',
  linenumbers: 'Line numbers', pageborders: 'Page borders', pageslayout: 'Pages on screen', outlineview: 'Outline view', newwindow: 'New window', syncscroll: 'Scroll together',
  multilevel: 'Multilevel list', numbered: 'Numbering', bullet: 'Bullets', h: 'Headings', marks: 'Show/hide ¶', bright: 'Corrections', strike: 'Strikethrough', object: 'Object', model3d: '3D model',
};

/** A button's name for the list (its own label, or its key in words). */
function nameOf(i: ToolItem): string {
  return i.label ?? NAMES[i.key] ?? i.key.replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** The window listing every button; `items` is the bar's full list. */
export function CustomiseHost({ items }: { items: ToolItem[] }) {
  const { settings } = useAppState();
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Several bars can be on screen (panes): the first to hear opens the window.
    const on = () => {
      if (taken) return;
      taken = true;
      setOpen(true);
    };
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  if (!open) return null;
  const close = () => {
    taken = false;
    setOpen(false);
  };
  const custom = settings.toolbarCustom ?? {};
  const hide = custom.hide ?? [];
  const pin = custom.pin ?? [];
  const set = (next: { hide?: string[]; pin?: string[] }) => store.updateSettings({ toolbarCustom: { ...custom, ...next } });
  const list = items.filter((i) => i.key !== 'customise');
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog customise" role="dialog" aria-modal="true" aria-label="Customise the formatting bar" onKeyDown={(e) => e.key === 'Escape' && close()}>
        <header className="dialog-head">
          <h2>Customise the formatting bar</h2>
          <button type="button" className="btn quiet small" onClick={() => close()} autoFocus>
            Done
          </button>
        </header>
        <div className="dialog-body">
          <p>Tick the buttons you want. “Keep on the bar” stops one moving under More when there isn’t room.</p>
          <ul className="customise-list">
            {list.map((i) => {
              const shown = !hide.includes(i.key);
              return (
                <li key={i.key}>
                  <label>
                    <input type="checkbox" checked={shown} aria-label={`Show ${nameOf(i)}`} onChange={() => set({ hide: shown ? [...hide, i.key] : hide.filter((k) => k !== i.key) })} />
                    {nameOf(i)}
                  </label>
                  <label className="customise-pin">
                    <input type="checkbox" disabled={!shown} checked={pin.includes(i.key)} aria-label={`Keep ${nameOf(i)} on the bar`} onChange={(e) => set({ pin: e.target.checked ? [...pin, i.key] : pin.filter((k) => k !== i.key) })} />
                    Keep on the bar
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
        <footer className="print-foot">
          <button type="button" className="btn quiet" onClick={() => store.updateSettings({ toolbarCustom: undefined })}>
            Reset
          </button>
          <button type="button" className="btn primary" onClick={() => close()}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
