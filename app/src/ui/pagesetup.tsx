// Word's Page Setup window: margins, orientation, paper size, columns, how
// a section starts, and headers and footers — applied to the whole
// document, the section the caret is in, or from the caret on (a new
// section starting there).

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { PAGE_SIZES, type PageSetup, pageHF } from '../data/styles';
import { HFOptions } from './headers';
import { IconClose } from './icons';

type Tab = 'margins' | 'paper' | 'layout';
type ApplyTo = 'all' | 'section' | 'forward';

const metric = typeof navigator !== 'undefined' && !/^en-(US|CA)|^es-(US|MX)/.test(navigator.language || 'en-US');

export function PageSetupDialog({ editor, page, onPage, chapters = false, onClose }: { editor: Editor; page?: PageSetup | null; onPage?(p: PageSetup): void; chapters?: boolean; onClose(): void }) {
  const look = editor.sectionLook();
  const base = page?.margins ?? { top: 1, right: 1, bottom: 1, left: 1 };
  const unit = metric ? 'cm' : 'in';
  const show = (inches: number) => String(Math.round((metric ? inches * 2.54 : inches) * 100) / 100);
  const read = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Math.max(0, metric ? Number(s) / 2.54 : Number(s)));
  const [tab, setTab] = useState<Tab>('margins');
  const [margins, setMargins] = useState({
    top: show(look.margins.top ?? base.top),
    bottom: show(look.margins.bottom ?? base.bottom),
    left: show(look.margins.left ?? base.left),
    right: show(look.margins.right ?? base.right),
  });
  const [landscape, setLandscape] = useState(look.orient ? look.orient === 'landscape' : !!page?.landscape);
  const [size, setSize] = useState(page?.size ?? 'letter');
  const [cols, setCols] = useState(look.cols);
  const [start, setStart] = useState(look.start);
  const [hf, setHF] = useState(page ? pageHF(page) : null);
  const [applyTo, setApplyTo] = useState<ApplyTo>(look.first && !hasSections(editor) ? 'all' : 'section');
  const panel = useRef<HTMLFormElement>(null);

  useEffect(() => {
    panel.current?.querySelector('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const apply = () => {
    const mm = { top: read(margins.top) ?? base.top, bottom: read(margins.bottom) ?? base.bottom, left: read(margins.left) ?? base.left, right: read(margins.right) ?? base.right };
    // Paper size, and headers and footers, are the whole document's.
    const docPage = page ? { ...page, size, ...(hf ? { hf } : {}) } : null;
    if (applyTo === 'all') {
      if (docPage) onPage?.({ ...docPage, margins: mm, landscape: landscape || undefined });
      editor.setAllSections(cols);
    } else {
      if (docPage && (docPage.size !== page?.size || hf !== (page ? pageHF(page) : null))) onPage?.(docPage);
      if (applyTo === 'forward') editor.insertSectionBreak('page');
      // Only what differs from the page setup is the section's own.
      const own = (v: number, b: number) => (Math.abs(v - b) < 0.001 ? undefined : v);
      editor.setSection({
        cols,
        orient: landscape === !!page?.landscape && look.first ? undefined : landscape ? 'landscape' : 'portrait',
        mt: own(mm.top, base.top),
        mb: own(mm.bottom, base.bottom),
        ml: own(mm.left, base.left),
        mr: own(mm.right, base.right),
        ...(applyTo === 'section' && !look.first ? { sect: start } : {}),
      });
    }
    onClose();
    editor.focus();
  };

  const field = (side: keyof typeof margins, label: string) => (
    <label className="para-field">
      <span>{label}</span>
      <span className="para-input">
        <input type="number" aria-label={`${label} margin`} step={0.1} min={0} value={margins[side]} onChange={(e) => setMargins({ ...margins, [side]: e.target.value })} />
        <small>{unit}</small>
      </span>
    </label>
  );

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        ref={panel}
        className="dialog para-dialog page-setup"
        role="dialog"
        aria-modal="true"
        aria-label="Page setup"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <header className="dialog-head">
          <h2>Page setup</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <div className="segmented small" role="tablist">
            {(['margins', 'paper', 'layout'] as Tab[]).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>
                {t === 'margins' ? 'Margins' : t === 'paper' ? 'Paper' : 'Layout'}
              </button>
            ))}
          </div>
          {tab === 'margins' && (
            <>
              <fieldset>
                <legend>Margins</legend>
                <div className="para-row">
                  {field('top', 'Top')}
                  {field('bottom', 'Bottom')}
                  {field('left', 'Left')}
                  {field('right', 'Right')}
                </div>
              </fieldset>
              <fieldset>
                <legend>Orientation</legend>
                <div className="orient-pick">
                  {[false, true].map((land) => (
                    <button key={String(land)} type="button" className={`orient-card${landscape === land ? ' on' : ''}`} aria-pressed={landscape === land} onClick={() => setLandscape(land)}>
                      <span className={`orient-page${land ? ' wide' : ''}`} aria-hidden="true" />
                      {land ? 'Landscape' : 'Portrait'}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {tab === 'paper' && (
            <fieldset>
              <legend>Paper size</legend>
              <select aria-label="Paper size" value={size} onChange={(e) => setSize(e.target.value as PageSetup['size'])} disabled={!page}>
                {PAGE_SIZES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="sync-hint">The paper size is the whole document’s.</p>
            </fieldset>
          )}
          {tab === 'layout' && (
            <>
              <fieldset>
                <legend>Section</legend>
                <label className="para-field">
                  <span>Section starts</span>
                  <select aria-label="Section starts" value={start} disabled={look.first || applyTo !== 'section'} onChange={(e) => setStart(e.target.value as 'page' | 'cont')}>
                    <option value="page">On a new page</option>
                    <option value="cont">Continuous (on the same page)</option>
                  </select>
                </label>
                <label className="para-field">
                  <span>Columns</span>
                  <select aria-label="Number of columns" value={cols} onChange={(e) => setCols(Number(e.target.value))}>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </fieldset>
              {hf && (
                <fieldset>
                  <legend>Headers and footers</legend>
                  <HFOptions hf={hf} chapters={chapters} onChange={setHF} />
                </fieldset>
              )}
            </>
          )}
          <div className="para-foot">
            <label className="para-field apply-to">
              <span>Apply to</span>
              <select aria-label="Apply to" value={applyTo} onChange={(e) => setApplyTo(e.target.value as ApplyTo)}>
                <option value="all">Whole document</option>
                <option value="section">This section</option>
                <option value="forward">This point forward</option>
              </select>
            </label>
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

/** The document has section breaks (other than the first paragraph's settings). */
function hasSections(editor: Editor): boolean {
  return editor.state.doc.blocks.some((b, i) => i > 0 && !!b.para?.sect);
}
