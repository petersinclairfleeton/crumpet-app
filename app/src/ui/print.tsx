// Printing, and saving as PDF: the text laid out on its pages exactly as page
// view shows them (size, margins, headers and footers, footnotes), with no
// gaps between the pages, handed to the browser's print window, which can
// also save a PDF. On a phone, Preview pages shows the same pages to look
// through (a phone writes in flowing text, without page view).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Doc } from '@crumpet/editor/model';
import { paperInches, type PageSetup, type StyleSheet } from '../data/styles';
import { type PageFields, PageView } from './pages';
import { useDocEditor } from './editing';
import { useFootnoteStart } from './booktoc';
import { footnotes } from '@crumpet/editor/model';
import { useSheetClass } from './styles-ui';
import { type BookDesign, bookOffsets, designCss, mirrorShift, trimOf } from '../data/bookdesign';
import { loadGoogleFont } from './fonts';

export interface PrintPart {
  id: string;
  doc: Doc;
  fields: PageFields;
}

function Part({ part, page, sheetClass, offset, total, chapters, onPages, footnoteStart }: { part: PrintPart; page: PageSetup; sheetClass: string; offset: number; total?: number; chapters: boolean; onPages(id: string, n: number): void; footnoteStart: number }) {
  const { host, editor } = useDocEditor({ docId: `print-${part.id}`, doc: part.doc, readOnly: true, onDoc: () => {} });
  useFootnoteStart(editor, footnoteStart);
  const report = useCallback((n: number) => onPages(part.id, n), [onPages, part.id]);
  return (
    <div className="print-part" data-offset={offset}>
      <PageView enabled print editor={editor} page={page} sheetClass={sheetClass} fields={part.fields} place={{ offset, chapterStart: true, total }} chapters={chapters} onPages={report}>
        <div ref={host} className="note-editor" />
      </PageView>
    </div>
  );
}

/** A blank page (before a chapter that starts on a right-hand page): its paper alone. */
function blankPage(sheet: HTMLElement, viewClass: string): HTMLElement {
  const box = document.createElement('div');
  box.className = 'print-page blank';
  box.style.width = sheet.style.width;
  box.style.height = sheet.style.height;
  const pv = document.createElement('div');
  pv.className = viewClass;
  const inner = document.createElement('div');
  inner.className = 'page-inner';
  inner.style.transform = `translate(${-(parseFloat(sheet.style.left) || 0)}px, ${-(parseFloat(sheet.style.top) || 0)}px)`;
  inner.appendChild(sheet.cloneNode(false));
  pv.appendChild(inner);
  box.appendChild(pv);
  return box;
}

/**
 * Each page on a sheet of its own for the printer: a copy of that page (its
 * paper, header and footer, footnotes and text) in a box the page's size,
 * so a landscape page can go on paper turned on its side. A printed book's
 * (`shift`) has blank pages where its parts' offsets leave a gap, and each
 * page's text moved sideways by `shift(page index)` pixels.
 */
function printPages(root: HTMLElement, shift?: (index: number) => number): void {
  root.querySelector(':scope > .print-pages')?.remove();
  const out = document.createElement('div');
  out.className = 'print-pages';
  let at = 0;
  for (const part of Array.from(root.querySelectorAll<HTMLElement>(':scope > .print-part'))) {
    const view = part.querySelector<HTMLElement>('.page-view');
    const editor = part.querySelector<HTMLElement>('.page-text > .note-editor, .page-text [contenteditable]');
    if (!view || !editor) continue;
    const sheets = Array.from(part.querySelectorAll<HTMLElement>('.page-inner > .sheet'));
    const start = Number(part.dataset.offset) || 0;
    while (shift && sheets[0] && at < start) {
      out.appendChild(blankPage(sheets[0], view.className));
      at++;
    }
    sheets.forEach((sheet, i) => {
      const dx = shift ? shift(at++) : 0;
      const moved = (el: HTMLElement) => {
        if (dx) el.style.translate = `${dx}px 0`;
        return el;
      };
      const top = parseFloat(sheet.style.top) || 0;
      const left = parseFloat(sheet.style.left) || 0;
      const landscape = sheet.classList.contains('landscape');
      const pageBox = document.createElement('div');
      pageBox.className = `print-page${landscape ? ' landscape' : ''}`;
      pageBox.style.width = sheet.style.width;
      pageBox.style.height = sheet.style.height;
      const pv = document.createElement('div');
      pv.className = view.className;
      const inner = document.createElement('div');
      inner.className = 'page-inner';
      inner.style.transform = `translate(${-left}px, ${-top}px)`;
      inner.appendChild(sheet.cloneNode(true));
      for (const sel of [`.hf-page[data-sheet="${i}"]`, `.page-notes-zone[data-notes-page="${i}"]`]) {
        const el = part.querySelector(sel);
        if (el) inner.appendChild(moved(el.cloneNode(true) as HTMLElement));
      }
      const pg = editor.querySelector<HTMLElement>(`:scope > .pg[data-page="${i}"]`);
      if (pg) {
        const text = document.createElement('div');
        text.className = 'page-text';
        const ed = document.createElement('div');
        ed.className = editor.className;
        const copy = pg.cloneNode(true) as HTMLElement;
        copy.style.position = 'absolute';
        copy.style.top = `${top}px`;
        copy.style.left = `${left}px`;
        copy.style.margin = '0';
        ed.appendChild(copy);
        text.appendChild(ed);
        inner.appendChild(moved(text));
      }
      pv.appendChild(inner);
      pageBox.appendChild(pv);
      out.appendChild(pageBox);
    });
  }
  root.appendChild(out);
}

/**
 * Lays the parts out on pages, opens the print window (or, with `preview`, the pages to look through), and calls
 * `onDone` when it closes. With `book`, a printed book: its design's look, chapters starting on right-hand pages,
 * and the text moved towards each page's outside edge for the spine (`pages`: the length its margins were made for).
 */
export function PrintJob({ title, parts, page, sheet, chapters = false, preview = false, book, onDone }: { title: string; parts: PrintPart[]; page: PageSetup; sheet: StyleSheet; chapters?: boolean; preview?: boolean; book?: { design: BookDesign; pages: number }; onDone(): void }) {
  const ownClass = useSheetClass(sheet);
  const sheetClass = book ? `${ownClass} book-design` : ownClass;
  const [looking, setLooking] = useState(preview);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const printed = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const onPages = useCallback((id: string, n: number) => setCounts((c) => (c[id] === n ? c : { ...c, [id]: n })), []);
  // Where each part's pages start (a book's chapters on right-hand pages, a blank page before them when needed).
  const recto = !!book?.design.recto;
  const { offsets, total } = useMemo(() => bookOffsets(parts.map((p) => counts[p.id] ?? 1), recto), [parts, counts, recto]);
  const ready = parts.every((p) => counts[p.id]);

  // A book: its typeface (loaded first, so the pages are laid out in it) and its look.
  const [fontsIn, setFontsIn] = useState(!book);
  const design = book?.design;
  useEffect(() => {
    if (!design) return;
    const style = document.createElement('style');
    style.textContent = designCss(design);
    document.head.appendChild(style);
    loadGoogleFont(design.font, 1 | 2 | 4);
    let on = true;
    const wait = document.fonts?.load(`${trimOf(design).size}pt "${design.font}"`) ?? Promise.resolve();
    void Promise.race([wait, new Promise((r) => setTimeout(r, 3000))])
      .catch(() => undefined)
      .then(() => on && setFontsIn(true));
    return () => {
      on = false;
      style.remove();
    };
  }, [design]);

  // The paper size for the printer (landscape sections' pages are printed on their side).
  useEffect(() => {
    const size = paperInches(page);
    const long = Math.max(size.width, size.height);
    const short = Math.min(size.width, size.height);
    const style = document.createElement('style');
    style.textContent = `@page { size: ${size.width}in ${size.height}in; margin: 0; } @page crumpet-portrait { size: ${short}in ${long}in; margin: 0; } @page crumpet-landscape { size: ${long}in ${short}in; margin: 0; }`;
    document.head.appendChild(style);
    const before = document.title;
    // The PDF is named after the title.
    document.title = title;
    document.documentElement.classList.add('printing');
    return () => {
      style.remove();
      document.title = before;
      document.documentElement.classList.remove('printing');
    };
  }, [page.size, title]);

  // Once every page is laid out (and the fonts are in): the pages ready to print, and the print window to choose from.
  const [pagesReady, setPagesReady] = useState(0);
  useEffect(() => {
    if (!ready || printed.current) return;
    let cancelled = false;
    const go = async () => {
      await document.fonts?.ready;
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled || printed.current) return;
      printed.current = true;
      if (root.current) printPages(root.current, book ? (i) => mirrorShift(book.pages, i) * 96 : undefined);
      setPagesReady(root.current?.querySelectorAll(':scope > .print-pages > .print-page').length ?? 0);
    };
    void go();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  /** The pages chosen, as many copies as asked for, to the browser's print window. */
  const print = (pages: number[], copies: number) => {
    const out = root.current?.querySelector<HTMLElement>(':scope > .print-pages');
    if (!out) return;
    const all = Array.from(out.children) as HTMLElement[];
    const chosen = pages.map((n) => all[n - 1]).filter(Boolean);
    out.textContent = '';
    for (let c = 0; c < copies; c++) for (const el of chosen) out.appendChild(c === 0 ? el : (el.cloneNode(true) as HTMLElement));
    const done = () => {
      window.removeEventListener('afterprint', done);
      onDone();
    };
    window.addEventListener('afterprint', done);
    window.print();
  };

  return (
    <>
      {createPortal(
        <div ref={root} className={`print-root ${sheetClass}`} aria-hidden="true">
          {fontsIn && parts.map((p, i) => (
            <Part key={p.id} part={p} page={page} sheetClass={ownClass} offset={offsets[i]} total={ready ? total : undefined} chapters={chapters} onPages={onPages} footnoteStart={parts.slice(0, i).reduce((n, x) => n + footnotes(x.doc).length, 0)} />
          ))}
        </div>,
        document.body,
      )}
      {createPortal(looking ? <PagePreview title={title} count={pagesReady} root={root} sheetClass={sheetClass} onPrint={() => setLooking(false)} onClose={onDone} /> : <PrintDialog title={title} count={pagesReady} root={root} sheetClass={sheetClass} onPrint={print} onCancel={onDone} />, document.body)}
    </>
  );
}

/** The pages to look through, one under another across the screen; Actual size shows them as big as on paper (scroll sideways). */
function PagePreview({ title, count, root, sheetClass, onPrint, onClose }: { title: string; count: number; root: React.RefObject<HTMLDivElement>; sheetClass: string; onPrint(): void; onClose(): void }) {
  const box = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(false);
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 390 : window.innerWidth));
  useEffect(() => {
    const on = () => setWidth(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => {
    const el = box.current;
    const src = root.current?.querySelector(':scope > .print-pages');
    if (!el || !src || !count) return;
    el.textContent = '';
    Array.from(src.children).forEach((pg, i) => {
      const page = pg as HTMLElement;
      const w = parseFloat(page.style.width) || 816;
      const h = parseFloat(page.style.height) || 1056;
      const scale = actual ? 1 : Math.min(1, (width - 32) / w);
      const item = document.createElement('div');
      item.className = 'preview-page';
      item.style.width = `${w * scale}px`;
      item.style.height = `${h * scale}px`;
      const copy = page.cloneNode(true) as HTMLElement;
      copy.style.transform = `scale(${scale})`;
      copy.style.transformOrigin = '0 0';
      const holder = document.createElement('div');
      holder.className = `print-thumb-page ${sheetClass}`;
      holder.appendChild(copy);
      const num = document.createElement('span');
      num.className = 'preview-num';
      num.textContent = `${i + 1}`;
      item.append(holder, num);
      el.appendChild(item);
    });
  }, [count, root, sheetClass, actual, width]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="page-preview print-backdrop" role="dialog" aria-modal="true" aria-label="Preview pages">
      <header className="page-preview-head">
        <button type="button" className="btn quiet" onClick={onClose}>
          Done
        </button>
        <span className="grow ellipsis page-preview-title">
          {title}
          <small>{count ? `${count} page${count === 1 ? '' : 's'}` : 'Laying out the pages…'}</small>
        </span>
        <button type="button" className="btn quiet" aria-pressed={actual} disabled={!count} onClick={() => setActual(!actual)}>
          {actual ? 'Fit to screen' : 'Actual size'}
        </button>
        <button type="button" className="btn quiet" disabled={!count} onClick={onPrint}>
          Print…
        </button>
      </header>
      <div className={`page-preview-pages${actual ? ' actual' : ''}`} ref={box} aria-label="Pages" />
    </div>
  );
}

/** "1-3, 5, 8-" as page numbers (from 1 to `count`), or null when it doesn't read. */
export function pageRange(text: string, count: number): number[] | null {
  const out: number[] = [];
  for (const part of text.split(/[,;]/).map((x) => x.trim()).filter(Boolean)) {
    const m = /^(\d+)?\s*(?:(-|–)\s*(\d+)?)?$/.exec(part);
    if (!m || (!m[1] && !m[3])) return null;
    const from = m[1] ? Number(m[1]) : 1;
    const to = m[2] ? (m[3] ? Number(m[3]) : count) : from;
    if (from < 1 || to < from) return null;
    for (let n = from; n <= Math.min(to, count); n++) if (!out.includes(n)) out.push(n);
  }
  return out.length ? out.sort((a, b) => a - b) : null;
}

/** Crumpet's print window: a preview of every page, which pages, how many copies; then the browser's own window (printer, or save as PDF). */
function PrintDialog({ title, count, root, sheetClass, onPrint, onCancel }: { title: string; count: number; root: React.RefObject<HTMLDivElement>; sheetClass: string; onPrint(pages: number[], copies: number): void; onCancel(): void }) {
  const [which, setWhich] = useState<'all' | 'range'>('all');
  const [range, setRange] = useState('');
  const [copies, setCopies] = useState(1);
  const preview = useRef<HTMLDivElement>(null);
  const pages = which === 'all' ? Array.from({ length: count }, (_, i) => i + 1) : pageRange(range, count);
  // A small copy of each page.
  useEffect(() => {
    const box = preview.current;
    const src = root.current?.querySelector(':scope > .print-pages');
    if (!box || !src || !count) return;
    box.textContent = '';
    Array.from(src.children).forEach((pg, i) => {
      const el = pg as HTMLElement;
      const w = parseFloat(el.style.width) || 816;
      const h = parseFloat(el.style.height) || 1056;
      const scale = 132 / Math.max(w, h * 0.77);
      const item = document.createElement('div');
      item.className = 'print-thumb';
      item.dataset.page = String(i + 1);
      item.style.width = `${w * scale}px`;
      item.style.height = `${h * scale}px`;
      const copy = el.cloneNode(true) as HTMLElement;
      copy.style.transform = `scale(${scale})`;
      copy.style.transformOrigin = '0 0';
      const holder = document.createElement('div');
      holder.className = `print-thumb-page ${sheetClass}`;
      holder.appendChild(copy);
      const num = document.createElement('span');
      num.className = 'thumb-num';
      num.textContent = String(i + 1);
      item.append(holder, num);
      box.appendChild(item);
    });
  }, [count, root, sheetClass]);
  useEffect(() => {
    preview.current?.querySelectorAll<HTMLElement>('.print-thumb').forEach((t) => t.classList.toggle('left-out', !!pages && !pages.includes(Number(t.dataset.page))));
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="dialog-backdrop print-backdrop">
      <div className="dialog print-dialog" role="dialog" aria-modal="true" aria-label="Print">
        <header className="dialog-head">
          <h2>Print {title ? `“${title}”` : ''}</h2>
        </header>
        <div className="print-body">
          <div className="print-preview" ref={preview} aria-label="Preview">
            {!count && <p className="sync-hint">Laying out the pages…</p>}
          </div>
          <div className="print-options">
            <fieldset>
              <legend>Pages</legend>
              <label className="check">
                <input type="radio" name="print-which" checked={which === 'all'} onChange={() => setWhich('all')} /> All {count ? `${count} page${count === 1 ? '' : 's'}` : ''}
              </label>
              <label className="check">
                <input type="radio" name="print-which" checked={which === 'range'} onChange={() => setWhich('range')} /> Pages
              </label>
              <input aria-label="Pages to print" placeholder="e.g. 1-3, 5" value={range} onFocus={() => setWhich('range')} onChange={(e) => setRange(e.target.value)} />
              {which === 'range' && range && !pages && <p className="error">Write pages like 1-3, 5 (from 1 to {count}).</p>}
            </fieldset>
            <label className="style-num">
              <span>Copies</span>
              <input type="number" min={1} max={99} aria-label="Copies" value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(99, Math.round(Number(e.target.value) || 1))))} />
            </label>
            <p className="sync-hint">Next, your browser’s print window chooses the printer, or saves a PDF.</p>
          </div>
        </div>
        <footer className="dialog-foot print-foot">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={!count || !pages} onClick={() => pages && onPrint(pages, copies)}>
            Print{pages && count ? ` ${pages.length * copies} page${pages.length * copies === 1 ? '' : 's'}` : ''}
          </button>
        </footer>
      </div>
    </div>
  );
}
