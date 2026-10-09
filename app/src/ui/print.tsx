// Printing, and saving as PDF: the text laid out on its pages exactly as page
// view shows them (size, margins, headers and footers, footnotes), with no
// gaps between the pages, handed to the browser's print window, which can
// also save a PDF.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Doc } from '@crumpet/editor/model';
import { paperInches, type PageSetup, type StyleSheet } from '../data/styles';
import { type PageFields, PageView } from './pages';
import { useDocEditor } from './editing';
import { useFootnoteStart } from './booktoc';
import { footnotes } from '@crumpet/editor/model';
import { useSheetClass } from './styles-ui';

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
    <div className="print-part">
      <PageView enabled print editor={editor} page={page} sheetClass={sheetClass} fields={part.fields} place={{ offset, chapterStart: true, total }} chapters={chapters} onPages={report}>
        <div ref={host} className="note-editor" />
      </PageView>
    </div>
  );
}

/**
 * Each page on a sheet of its own for the printer: a copy of that page (its
 * paper, header and footer, footnotes and text) in a box the page's size,
 * so a landscape page can go on paper turned on its side.
 */
function printPages(root: HTMLElement): void {
  root.querySelector(':scope > .print-pages')?.remove();
  const out = document.createElement('div');
  out.className = 'print-pages';
  for (const part of Array.from(root.querySelectorAll<HTMLElement>(':scope > .print-part'))) {
    const view = part.querySelector<HTMLElement>('.page-view');
    const editor = part.querySelector<HTMLElement>('.page-text > .note-editor, .page-text [contenteditable]');
    if (!view || !editor) continue;
    Array.from(part.querySelectorAll<HTMLElement>('.page-inner > .sheet')).forEach((sheet, i) => {
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
        if (el) inner.appendChild(el.cloneNode(true));
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
        inner.appendChild(text);
      }
      pv.appendChild(inner);
      pageBox.appendChild(pv);
      out.appendChild(pageBox);
    });
  }
  root.appendChild(out);
}

/** Lays the parts out on pages, opens the print window, and calls `onDone` when it closes. */
export function PrintJob({ title, parts, page, sheet, chapters = false, onDone }: { title: string; parts: PrintPart[]; page: PageSetup; sheet: StyleSheet; chapters?: boolean; onDone(): void }) {
  const sheetClass = useSheetClass(sheet);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const printed = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const onPages = useCallback((id: string, n: number) => setCounts((c) => (c[id] === n ? c : { ...c, [id]: n })), []);
  const offsets = useMemo(() => {
    let sum = 0;
    return parts.map((p) => {
      const at = sum;
      sum += counts[p.id] ?? 1;
      return at;
    });
  }, [parts, counts]);
  const total = parts.reduce((n, p) => n + (counts[p.id] ?? 1), 0);
  const ready = parts.every((p) => counts[p.id]);

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

  // Once every page is laid out (and the fonts are in), print.
  useEffect(() => {
    if (!ready || printed.current) return;
    let cancelled = false;
    const go = async () => {
      await document.fonts?.ready;
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled || printed.current) return;
      printed.current = true;
      if (root.current) printPages(root.current);
      const done = () => {
        window.removeEventListener('afterprint', done);
        onDone();
      };
      window.addEventListener('afterprint', done);
      window.print();
    };
    void go();
    return () => {
      cancelled = true;
    };
  }, [ready, onDone]);

  return createPortal(
    <div ref={root} className={`print-root ${sheetClass}`} aria-hidden="true">
      {parts.map((p, i) => (
        <Part key={p.id} part={p} page={page} sheetClass={sheetClass} offset={offsets[i]} total={ready ? total : undefined} chapters={chapters} onPages={onPages} footnoteStart={parts.slice(0, i).reduce((n, x) => n + footnotes(x.doc).length, 0)} />
      ))}
    </div>,
    document.body,
  );
}
