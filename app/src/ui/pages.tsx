// Page view: the text laid out on sheets of paper, with margins and page
// numbers. The editor works out where each page ends (see the editor's
// paginate.ts); this draws the sheets behind it, and scales them down to fit
// narrow screens.

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { PAGE_GAP, PAGE_SIZES, PX_PER_IN, type PageSetup, pageSize } from '../data/styles';
import { useAppState } from './hooks';

/**
 * Sheets of paper behind the text. `children` is the editor's element. The
 * same elements are drawn whether page view is on or off, so switching never
 * recreates the editor's element.
 */
export function PageView({ enabled, editor, page, sheetClass, children }: { enabled: boolean; editor: Editor | null; page: PageSetup; sheetClass: string; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { width, height } = pageSize(page);
  const m = page.margins;
  const content = height - (m.top + m.bottom) * PX_PER_IN;
  const between = (m.top + m.bottom) * PX_PER_IN + PAGE_GAP;

  // Fit the page to the width available (never larger than real size).
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el || !enabled) return;
    const fit = () => setScale(Math.min(1, Math.max(0.3, (el.clientWidth - 24) / width)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, enabled]);

  // Tell the editor how big a page is; lay out again when fonts arrive or the styles change.
  useEffect(() => {
    if (!editor || !enabled) return;
    editor.setPages({ content, between });
    return () => editor.setPages(null);
  }, [editor, content, between, enabled]);
  // The writing font and text size from Settings change the layout too.
  const { noteFont, noteSize } = useAppState().settings;
  const fontKey = `${noteFont?.family ?? ''}|${noteSize ?? 16}`;
  useEffect(() => {
    if (!editor || !enabled) return;
    // Next frame: the new font or size is applied to the page by then.
    const frame = requestAnimationFrame(() => editor.repaginate());
    const again = () => editor.repaginate();
    document.fonts?.addEventListener('loadingdone', again);
    void document.fonts?.ready.then(again);
    return () => {
      cancelAnimationFrame(frame);
      document.fonts?.removeEventListener('loadingdone', again);
    };
  }, [editor, sheetClass, enabled, fontKey]);

  const pages = enabled ? (editor?.pages ?? 1) : 0;
  const pitch = height + PAGE_GAP;
  return (
    <div className={enabled ? 'page-view' : 'page-off'} ref={outer}>
      <div className="page-scaler" style={enabled ? { width: width * scale, height: (pages * pitch - PAGE_GAP) * scale } : undefined}>
        <div className="page-inner" style={enabled ? { width, transform: scale === 1 ? undefined : `scale(${scale})` } : undefined}>
          {Array.from({ length: pages }, (_, i) => (
            <div key={i} className="sheet" style={{ top: i * pitch, height }} aria-hidden="true">
              {page.pageNumbers && (
                <span className="page-no" style={{ bottom: (m.bottom * PX_PER_IN) / 2 - 8 }}>
                  {i + 1}
                </span>
              )}
            </div>
          ))}
          <div className="page-text" style={enabled ? { top: m.top * PX_PER_IN, left: m.left * PX_PER_IN, width: width - (m.left + m.right) * PX_PER_IN } : undefined}>
            {children}
          </div>
        </div>
      </div>
      {enabled && (
        <p className="visually-hidden" role="status">
          {pages} {pages === 1 ? 'page' : 'pages'}
        </p>
      )}
    </div>
  );
}

/** The page view switch for a toolbar. */
export function PageToggle({ on, onChange }: { on: boolean; onChange(on: boolean): void }) {
  return (
    <button type="button" className={`icon-btn${on ? ' on' : ''}`} aria-pressed={on} aria-label="Page view" title={on ? 'Page view: on' : 'Page view'} onClick={() => onChange(!on)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M9 9h6M9 13h6M9 17h4" />
      </svg>
    </button>
  );
}

const metric = typeof navigator !== 'undefined' && !/^en-(US|CA)|^es-(US|MX)/.test(navigator.language || 'en-US');

/** Page size, margins and page numbers. */
export function PageSetupForm({ page, onChange }: { page: PageSetup; onChange(p: PageSetup): void }) {
  const unit = metric ? 'cm' : 'in';
  const show = (inches: number) => Math.round((metric ? inches * 2.54 : inches) * 100) / 100;
  const read = (v: number) => (metric ? v / 2.54 : v);
  const margin = (side: keyof PageSetup['margins'], label: string) => (
    <label className="style-num">
      <span>{label}</span>
      <span className="with-unit">
        <input type="number" step={0.1} min={0} value={show(page.margins[side])} onChange={(e) => e.target.value !== '' && onChange({ ...page, margins: { ...page.margins, [side]: Math.max(0, read(Number(e.target.value))) } })} />
        <small>{unit}</small>
      </span>
    </label>
  );
  return (
    <div className="style-form page-form" role="group" aria-label="Page">
      <label className="field">
        <span>Page size</span>
        <select aria-label="Page size" value={page.size} onChange={(e) => onChange({ ...page, size: e.target.value as PageSetup['size'] })}>
          {PAGE_SIZES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        <span>Margins</span>
        <div className="style-row">
          {margin('top', 'Top')}
          {margin('bottom', 'Bottom')}
          {margin('left', 'Left')}
          {margin('right', 'Right')}
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={page.pageNumbers} onChange={(e) => onChange({ ...page, pageNumbers: e.target.checked })} /> Page numbers
      </label>
    </div>
  );
}
