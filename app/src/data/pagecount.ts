// How many pages each chapter takes, for page numbers that carry on from one
// chapter to the next. Counts are remembered whenever a chapter is laid out
// in page view; a chapter not laid out yet is estimated from its words.

import type { PageSetup } from './styles';

const counts = new Map<string, number>();

/** Manuscripts run about 250 words to a page. */
const WORDS_PER_PAGE = 250;

const key = (chapterId: string, page: PageSetup, styles: string) => `${chapterId}|${page.size}|${JSON.stringify(page.margins)}|${styles}`;

export function rememberPages(chapterId: string, page: PageSetup, styles: string, n: number): void {
  counts.set(key(chapterId, page, styles), n);
}

export function knownPages(chapterId: string, page: PageSetup, styles: string): number | undefined {
  return counts.get(key(chapterId, page, styles));
}

/** Pages for a chapter: as last laid out, or estimated from its words (`perPage` when it's known for this layout). */
export function chapterPages(chapterId: string, words: number, page: PageSetup, styles: string, perPage = WORDS_PER_PAGE): number {
  return knownPages(chapterId, page, styles) ?? Math.max(1, Math.ceil(words / Math.max(1, perPage)));
}
