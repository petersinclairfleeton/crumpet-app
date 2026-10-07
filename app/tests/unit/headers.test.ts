import { describe, expect, it } from 'vitest';
import { type HFContext, cleanHF, fieldValue, formatNumber, hasPageNumbers, manuscriptHeaders, pageNumberFooter, tidyRuns, variantFor, withPageNumbers } from '../../src/data/headers';

const ctx: HFContext = { title: 'The Lighthouse', author: 'Mara Quinn', chapter: 3, chapterTitle: 'Salt', part: 'Part One', words: 81234, pages: 120, chapterPages: 9, now: Date.UTC(2026, 9, 7, 12) };

describe('headers and footers', () => {
  it('numbers pages in every format Word has', () => {
    expect([1, 4, 9, 14, 2026].map((n) => formatNumber(n, 'i'))).toEqual(['i', 'iv', 'ix', 'xiv', 'mmxxvi']);
    expect(formatNumber(49, 'I')).toBe('XLIX');
    expect([1, 26, 27, 53].map((n) => formatNumber(n, 'a'))).toEqual(['a', 'z', 'aa', 'aaa']);
    expect(formatNumber(2, 'A')).toBe('B');
    expect(formatNumber(12, '1')).toBe('12');
  });

  it('fills in fields', () => {
    const hf = manuscriptHeaders();
    expect(fieldValue({ field: 'page' }, ctx, 7, { ...hf, numberFormat: 'I' })).toBe('VII');
    expect(fieldValue({ field: 'pages' }, ctx, 7, hf)).toBe('120');
    expect(fieldValue({ field: 'chapterPages' }, ctx, 7, hf)).toBe('9');
    expect(fieldValue({ field: 'chapterTitle' }, ctx, 7, hf)).toBe('Salt');
    expect(fieldValue({ field: 'author' }, ctx, 7, hf)).toBe('Mara Quinn');
    expect(fieldValue({ field: 'author' }, ctx, 7, { ...hf, author: 'M. Q. Pen' })).toBe('M. Q. Pen');
    expect(fieldValue({ field: 'date', fmt: 'iso' }, ctx, 7, hf)).toBe('2026-10-07');
    expect(fieldValue({ text: 'plain' }, ctx, 7, hf)).toBe('plain');
  });

  it('picks the first page, chapter openings, and left and right pages', () => {
    const hf = { ...manuscriptHeaders(), differentChapterFirst: true, differentOddEven: true };
    expect(variantFor(hf, { index: 0, chapterStart: true })).toBe('first');
    expect(variantFor(hf, { index: 5, chapterStart: true })).toBe('chapterFirst');
    expect(variantFor(hf, { index: 1, chapterStart: false })).toBe('even'); // page 2
    expect(variantFor(hf, { index: 2, chapterStart: false })).toBe('main'); // page 3
    // Starting at 2 swaps which pages are even.
    expect(variantFor({ ...hf, startAt: 2 }, { index: 2, chapterStart: false })).toBe('even');
    expect(variantFor(pageNumberFooter(), { index: 0, chapterStart: true })).toBe('main');
  });

  it('turns page numbers on and off', () => {
    const none = withPageNumbers(pageNumberFooter(), false);
    expect(hasPageNumbers(none)).toBe(false);
    const back = withPageNumbers(none, true);
    expect(back.sets.main!.footer.center).toEqual([{ field: 'page' }]);
    // The manuscript header keeps its words when numbers go.
    expect(withPageNumbers(manuscriptHeaders(), false).sets.main!.header.right).toEqual([{ field: 'author' }, { text: ' / ' }, { field: 'title' }, { text: ' / ' }]);
  });

  it('reads older and hand-edited setups safely', () => {
    expect(hasPageNumbers(cleanHF(undefined, true))).toBe(true);
    expect(hasPageNumbers(cleanHF(undefined, false))).toBe(false);
    const odd = cleanHF({ sets: { main: { header: { left: [{ text: 'ok' }, { field: 'nope' }, 3], center: 'x' } } }, startAt: -4, numberFormat: 'Q' } as never, false);
    expect(odd.sets.main!.header).toEqual({ left: [{ text: 'ok' }], center: [], right: [] });
    expect(odd.startAt).toBe(0);
    expect(odd.numberFormat).toBe('1');
  });

  it('tidies runs', () => {
    expect(tidyRuns([{ text: 'a', b: true }, { text: 'b', b: true }, { text: '' }, { field: 'page', b: true }, { text: 'c', b: false }])).toEqual([{ text: 'ab', b: true }, { field: 'page', b: true }, { text: 'c' }]);
  });
});
