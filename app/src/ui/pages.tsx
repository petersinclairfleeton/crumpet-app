// Page view: the text laid out on sheets of paper, with margins, headers and
// footers. The editor works out where each page ends (see the editor's
// paginate.ts); this draws the sheets behind it, and scales them down to fit
// narrow screens.

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { type HFBand, type HFContext, type HFRun, type HFSlotName, type HFVariant, type HeadersFooters, SLOTS, emptySet, fieldValue, setFor, variantFor, variantName } from '../data/headers';
import { PAGE_GAP, PAGE_SIZES, PX_PER_IN, type PageSetup, pageHF, pageSize } from '../data/styles';
import { Band, HFOptions, HFToolbar, insertRun, useSlotCaret } from './headers';
import { useAppState } from './hooks';
import { DEFAULT_NOTE_SIZE } from '../data/types';
import { footnotes } from '@crumpet/editor/model';

/** What the header and footer fields show. */
export interface PageFields {
  title: string;
  chapter?: number;
  chapterTitle?: string;
  part?: string;
  words: number;
  created?: number;
  updated?: number;
}

/** Where these pages sit in the whole document. */
export interface PagePlacement {
  /** Pages before these ones. */
  offset: number;
  /** The first of these pages starts a chapter. */
  chapterStart: boolean;
  /** Pages in the whole document, when known. */
  total?: number;
}

interface Props {
  enabled: boolean;
  editor: Editor | null;
  page: PageSetup;
  sheetClass: string;
  children: ReactNode;
  /** Saving changes to the headers and footers; without it they can't be edited. */
  onPage?(p: PageSetup): void;
  fields?: PageFields;
  place?: PagePlacement;
  /** The page setup belongs to a project with chapters. */
  chapters?: boolean;
  /** Told how many pages there are. */
  onPages?(n: number): void;
  /** Printing: no space between pages, and real size. */
  print?: boolean;
}

/**
 * Sheets of paper behind the text. `children` is the editor's element. The
 * same elements are drawn whether page view is on or off, so switching never
 * recreates the editor's element.
 */
export function PageView({ enabled, editor, page, sheetClass, children, onPage, fields, place, chapters = false, onPages, print = false }: Props) {
  const gap = print ? 0 : PAGE_GAP;
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [editing, setEditing] = useState<{ i: number; band: 'header' | 'footer'; slot: HFSlotName } | null>(null);
  const activeSlot = useRef<HTMLElement | null>(null);
  const caret = useSlotCaret(activeSlot);
  const { width, height } = pageSize(page);
  const m = page.margins;
  const content = height - (m.top + m.bottom) * PX_PER_IN;
  const between = (m.top + m.bottom) * PX_PER_IN + gap;
  const hf = pageHF(page);
  const settings = useAppState().settings;

  // Fit the page to the width available (never larger than real size).
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el || !enabled || print) return;
    const fit = () => setScale(Math.min(1, Math.max(0.3, (el.clientWidth - 24) / width)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, enabled, print]);

  // Tell the editor how big a page is; lay out again when fonts arrive or the styles change.
  useEffect(() => {
    if (!editor || !enabled) return;
    editor.setPages({ content, between, noteGap: NOTE_GAP });
    return () => editor.setPages(null);
  }, [editor, content, between, enabled]);

  // Footnotes sit at the foot of their page: the editor asks how tall each one is.
  const measurer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editor || !enabled) return;
    editor.setNoteHeights((i) => {
      const box = measurer.current;
      const note = footnotes(editor.state.doc)[i];
      if (!box || !note) return 0;
      const p = document.createElement('p');
      p.className = 'page-note';
      p.textContent = `${i + 1} ${note.text || ' '}`;
      box.appendChild(p);
      const h = p.getBoundingClientRect().height / (box.getBoundingClientRect().width / box.offsetWidth || 1);
      p.remove();
      return h;
    });
    return () => editor.setNoteHeights(null);
  }, [editor, enabled, sheetClass]);
  // The writing font and text size from Settings change the layout too.
  const { noteFont, noteSize } = settings;
  const fontKey = `${noteFont?.family ?? ''}|${noteSize ?? DEFAULT_NOTE_SIZE}`;
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
  useEffect(() => {
    if (pages) onPages?.(pages);
  }, [pages, onPages]);
  useEffect(() => {
    if (!enabled) setEditing(null);
  }, [enabled]);

  // Editing starts in the slot that was double-clicked.
  useEffect(() => {
    if (!editing) return;
    const el = outer.current?.querySelector<HTMLElement>(`[data-sheet="${editing.i}"] .hf-${editing.band} [data-slot="${editing.slot}"]`);
    if (el && !el.contains(document.activeElement)) {
      el.focus();
      const sel = getSelection();
      sel?.selectAllChildren(el);
      sel?.collapseToEnd();
    }
  }, [editing]);

  const offset = place?.offset ?? 0;
  const ctx: HFContext = {
    title: fields?.title ?? '',
    author: settings.name || '',
    chapter: fields?.chapter,
    chapterTitle: fields?.chapterTitle,
    part: fields?.part,
    words: fields?.words ?? 0,
    created: fields?.created,
    updated: fields?.updated,
    pages: place?.total ?? offset + pages,
    chapterPages: pages,
    now: Date.now(),
  };
  const save = (next: HeadersFooters) => onPage?.({ ...page, hf: next });
  const setBand = (v: HFVariant, kind: 'header' | 'footer', band: HFBand) => {
    const set = setFor(hf, v);
    save({ ...hf, sets: { ...hf.sets, [v]: { ...set, [kind]: band } } });
  };

  const onSlotKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(null);
      e.currentTarget.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertLineBreak');
    } else if (e.key === 'Tab') {
      // Like Word's tab stops: on to the next place.
      const sheet = e.currentTarget.closest('[data-sheet]');
      const all = sheet ? Array.from(sheet.querySelectorAll<HTMLElement>('[data-slot]')) : [];
      const next = all[all.indexOf(e.currentTarget) + (e.shiftKey ? -1 : 1)];
      if (next) {
        e.preventDefault();
        next.focus();
        const sel = getSelection();
        sel?.selectAllChildren(next);
        sel?.collapseToEnd();
      }
    }
  };

  const startEditing = (i: number, band: 'header' | 'footer', e: React.MouseEvent<HTMLElement>) => {
    if (!onPage) return;
    const box = e.currentTarget.getBoundingClientRect();
    const third = Math.min(2, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * 3)));
    setEditing({ i, band, slot: SLOTS[third] });
  };

  const pitch = height + gap;
  const pageNotes = enabled ? (editor?.pageNotes ?? []) : [];
  const notes = enabled && editor ? footnotes(editor.state.doc) : [];
  const openNote = (i: number) => {
    const f = notes[i];
    const el = f && editor?.footnoteElement(f);
    if (editor && f && el) editor.onFootnoteClick?.({ block: f.block, offset: f.offset }, f.text, el);
  };
  const textLeft = m.left * PX_PER_IN;
  const textWidth = width - (m.left + m.right) * PX_PER_IN;
  const editVariant = editing ? variantFor(hf, { index: offset + editing.i, chapterStart: !!place?.chapterStart && editing.i === 0 }) : null;

  return (
    <div className={enabled ? `page-view${editing ? ' hf-editing' : ''}` : 'page-off'} ref={outer}>
      {editing && editVariant && (
        <HFToolbar
          label={`${variantName(hf, editVariant)} · page ${editing.i + 1 + offset}`}
          hf={hf}
          chapters={chapters}
          onHF={save}
          onInsert={(run: HFRun) => {
            const slot = activeSlot.current ?? outer.current?.querySelector<HTMLElement>(`[data-sheet="${editing.i}"] [data-slot]`);
            if (slot) insertRun(slot, caret.current, run, (r) => fieldValue(r, ctx, hf.startAt + offset + editing.i, hf));
          }}
          onClose={() => setEditing(null)}
          host={outer.current?.closest<HTMLElement>('.note-pane') ?? null}
        />
      )}
      <div className="page-scaler" style={enabled ? { width: width * scale, height: (pages * pitch - gap) * scale } : undefined}>
        <div className="page-inner" style={enabled ? { width, transform: scale === 1 ? undefined : `scale(${scale})` } : undefined}>
          {Array.from({ length: pages }, (_, i) => (
            <div key={i} className="sheet" style={{ top: i * pitch, height }} aria-hidden="true" />
          ))}
          {enabled && <div ref={measurer} className="page-notes measure" style={{ left: textLeft, width: textWidth }} aria-hidden="true" />}
          {pageNotes.map((list, i) =>
            list.length ? (
              <div key={`n${i}`} className="page-notes-zone" style={{ top: i * pitch + m.top * PX_PER_IN, height: content, left: textLeft, width: textWidth }}>
                <div className="page-notes" role="list" aria-label={`Footnotes on page ${offset + i + 1}`}>
                  {list.map((n) => (
                    <p key={n} className="page-note" role="listitem" onMouseDown={(e) => e.preventDefault()} onClick={() => openNote(n)}>
                      <sup>{n + 1}</sup> {notes[n]?.text || <em>Empty footnote</em>}
                    </p>
                  ))}
                </div>
              </div>
            ) : null,
          )}
          <div
            className="page-text"
            style={enabled ? { top: m.top * PX_PER_IN, left: textLeft, width: textWidth } : undefined}
            onMouseDown={() => editing && setEditing(null)}
          >
            {children}
          </div>
          {Array.from({ length: pages }, (_, i) => {
            const index = offset + i;
            const v = variantFor(hf, { index, chapterStart: !!place?.chapterStart && i === 0 });
            const set = hf.sets[v] ?? emptySet();
            const number = hf.startAt + index;
            const resolve = (r: HFRun) => fieldValue(r, ctx, number, hf);
            const isEditing = editing?.i === i;
            const band = (kind: 'header' | 'footer') => (
              <div
                className={`hf-zone ${kind}`}
                style={kind === 'header' ? { top: i * pitch, height: m.top * PX_PER_IN, left: textLeft, width: textWidth } : { top: i * pitch + height - m.bottom * PX_PER_IN, height: m.bottom * PX_PER_IN, left: textLeft, width: textWidth }}
                onDoubleClick={(e) => !isEditing && startEditing(i, kind, e)}
                title={onPage && !isEditing ? `Double-click to edit the ${kind}` : undefined}
              >
                <div className="hf-place" style={kind === 'header' ? { top: hf.headerFrom * PX_PER_IN } : { bottom: hf.footerFrom * PX_PER_IN }}>
                  <Band
                    kind={kind}
                    band={set[kind]}
                    resolve={resolve}
                    editing={isEditing}
                    line={kind === 'header' ? hf.headerLine : hf.footerLine}
                    onBand={(b) => setBand(v, kind, b)}
                    onFocusSlot={(el) => (activeSlot.current = el)}
                    onKey={onSlotKey}
                  />
                </div>
              </div>
            );
            return (
              <div key={i} className="hf-page" data-sheet={i} aria-hidden={isEditing ? undefined : 'true'}>
                {band('header')}
                {band('footer')}
              </div>
            );
          })}
        </div>
      </div>
      {enabled && onPage && !editing && (
        <button type="button" className="hf-edit-btn" onClick={() => setEditing({ i: 0, band: 'header', slot: 'center' })}>
          Edit header and footer
        </button>
      )}
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

/** Room for the short line above a page's footnotes, px. */
const NOTE_GAP = 18;

const metric = typeof navigator !== 'undefined' && !/^en-(US|CA)|^es-(US|MX)/.test(navigator.language || 'en-US');

/** Page size, margins and page numbers. */
export function PageSetupForm({ page, onChange, chapters = false }: { page: PageSetup; onChange(p: PageSetup): void; chapters?: boolean }) {
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
      <div className="field">
        <span>Header &amp; footer</span>
        <p className="sync-hint">In page view, double-click the top or bottom of a page to write in its header or footer.</p>
        <HFOptions hf={pageHF(page)} chapters={chapters} onChange={(hf) => onChange({ ...page, hf })} />
      </div>
    </div>
  );
}
