// Printing, and saving as PDF: the text laid out on its pages exactly as page
// view shows them (size, margins, headers and footers, footnotes), with no
// gaps between the pages, handed to the browser's print window, which can
// also save a PDF.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Doc } from '@crumpet/editor/model';
import { PAGE_SIZES, type PageSetup, type StyleSheet } from '../data/styles';
import { type PageFields, PageView } from './pages';
import { useDocEditor } from './editing';
import { useSheetClass } from './styles-ui';

export interface PrintPart {
  id: string;
  doc: Doc;
  fields: PageFields;
}

function Part({ part, page, sheetClass, offset, total, chapters, onPages }: { part: PrintPart; page: PageSetup; sheetClass: string; offset: number; total?: number; chapters: boolean; onPages(id: string, n: number): void }) {
  const { host, editor } = useDocEditor({ docId: `print-${part.id}`, doc: part.doc, readOnly: true, onDoc: () => {} });
  const report = useCallback((n: number) => onPages(part.id, n), [onPages, part.id]);
  return (
    <div className="print-part">
      <PageView enabled print editor={editor} page={page} sheetClass={sheetClass} fields={part.fields} place={{ offset, chapterStart: true, total }} chapters={chapters} onPages={report}>
        <div ref={host} className="note-editor" />
      </PageView>
    </div>
  );
}

/** Lays the parts out on pages, opens the print window, and calls `onDone` when it closes. */
export function PrintJob({ title, parts, page, sheet, chapters = false, onDone }: { title: string; parts: PrintPart[]; page: PageSetup; sheet: StyleSheet; chapters?: boolean; onDone(): void }) {
  const sheetClass = useSheetClass(sheet);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const printed = useRef(false);
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

  // The paper size for the printer.
  useEffect(() => {
    const size = PAGE_SIZES.find((s) => s.id === page.size) ?? PAGE_SIZES[0];
    const style = document.createElement('style');
    style.textContent = `@page { size: ${size.width}in ${size.height}in; margin: 0; }`;
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
    <div className={`print-root ${sheetClass}`} aria-hidden="true">
      {parts.map((p, i) => (
        <Part key={p.id} part={p} page={page} sheetClass={sheetClass} offset={offsets[i]} total={ready ? total : undefined} chapters={chapters} onPages={onPages} />
      ))}
    </div>,
    document.body,
  );
}
