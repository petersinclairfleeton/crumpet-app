// A book's table of contents: in a project, a table of contents in any
// chapter lists every chapter (with the page it starts on) and the headings
// in each, and clicking a line goes there.

import { useEffect } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { TocEntry } from '@crumpet/editor/view';
import { footnotes } from '@crumpet/editor/model';
import type { Chapter } from '../data/types';

/** Where each chapter's headings were last laid out: block → page within the chapter (from 0). */
const headingPages = new Map<string, Map<string, number>>();

/** A heading to go to once its chapter is open. */
let pending: { chapter: string; block?: string } | null = null;

export function goToLater(target: { chapter: string; block?: string }): void {
  pending = target;
}

/**
 * The book's contents as seen from chapter `self`: its own headings are
 * numbered by its page view (from `offset`), the other chapters' from where
 * they were last laid out (or, until they have been, a guess from their words).
 */
export function bookEntries(list: { chapter: Chapter; number: number }[], self: string, startOf: (c: Chapter) => number, pagesOf?: (c: Chapter) => number): TocEntry[] {
  const out: TocEntry[] = [];
  for (const { chapter, number } of list) {
    const start = startOf(chapter);
    // Not laid out yet: a heading's page is guessed from how far into the chapter's words it comes.
    const words = chapter.doc.blocks.map((b) => b.runs.map((r) => r.text).join('').split(/\s+/).filter(Boolean).length);
    const total = words.reduce((a, b) => a + b, 0) || 1;
    const pages = pagesOf?.(chapter) ?? 1;
    let before = 0;
    const guess = () => Math.min(pages - 1, Math.floor((before / total) * pages));
    out.push({ chapter: chapter.id, level: 1, text: chapter.title.trim() || `Chapter ${number}`, page: start + 1 });
    const known = headingPages.get(chapter.id);
    for (const [i, b] of chapter.doc.blocks.entries()) {
      before += words[i - 1] ?? 0;
      if (b.type !== 'heading1' && b.type !== 'heading2') continue;
      const text = b.runs
        .filter((r) => r.change?.kind !== 'del' && !r.footnote)
        .map((r) => r.text)
        .join('')
        .trim();
      if (!text) continue;
      const level = b.type === 'heading1' ? 2 : 3;
      if (chapter.id === self) out.push({ id: b.id, chapter: chapter.id, level, text });
      else {
        const at = known?.get(b.id) ?? (pagesOf ? guess() : undefined);
        out.push({ id: b.id, chapter: chapter.id, level, text, ...(at !== undefined ? { page: start + at + 1 } : {}) });
      }
    }
  }
  return out;
}

/**
 * Gives a chapter's editor the book's contents and the pages before it, and
 * remembers where its headings fall for the other chapters' contents.
 */
export function useBookToc(editor: Editor | null, chapterId: string, entries: TocEntry[] | null, offset: number, onTarget: (t: { chapter: string; block?: string }) => void): void {
  useEffect(() => {
    if (!editor) return;
    editor.setPageOffset(offset);
    editor.setTocEntries(entries);
  }, [editor, entries, offset]);
  useEffect(() => {
    if (!editor) return;
    editor.onTocTarget = onTarget;
    return () => {
      if (editor.onTocTarget === onTarget) editor.onTocTarget = null;
    };
  }, [editor, onTarget]);
  useEffect(() => {
    if (!editor) return;
    const remember = () => {
      const pages = new Map<string, number>();
      for (const b of editor.state.doc.blocks) {
        if (b.type !== 'heading1' && b.type !== 'heading2') continue;
        const n = editor.pageOfBlock(b.id);
        if (n !== undefined) pages.set(b.id, n);
      }
      if (pages.size) headingPages.set(chapterId, pages);
    };
    remember();
    const off = editor.onChange(remember);
    // Opened from another chapter's contents: go to the heading.
    if (pending?.chapter === chapterId) {
      const block = pending.block;
      pending = null;
      if (block) setTimeout(() => editor.goToBlock(block), 50);
    }
    return off;
  }, [editor, chapterId]);
}

/** How many footnotes come before a chapter in the book, so its numbers run on from the chapters before. */
export function footnotesBefore(list: { chapter: Chapter }[], chapterId: string): number {
  let n = 0;
  for (const { chapter } of list) {
    if (chapter.id === chapterId) return n;
    n += footnotes(chapter.doc).length;
  }
  return 0;
}

/** Gives a chapter's editor the number of footnotes before it. */
export function useFootnoteStart(editor: Editor | null, start: number): void {
  useEffect(() => {
    editor?.setFootnoteStart(start);
  }, [editor, start]);
}
