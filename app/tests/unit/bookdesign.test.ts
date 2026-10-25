import { describe, expect, it } from 'vitest';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { runsText } from '@crumpet/editor/model';
import { DEFAULT_DESIGN, bookOffsets, chapterOpening, cleanDesign, designCss, designDoc, estimatePages, insideMargin, isSceneBreak, mirrorShift, printPage } from '../../src/data/bookdesign';

describe('print-ready books', () => {
  it('widens the spine margin as the book gets longer, and mirrors it page by page', () => {
    expect([100, 151, 320, 600, 900].map(insideMargin)).toEqual([0.625, 0.75, 0.875, 1, 1.125]);
    const page = printPage({ ...DEFAULT_DESIGN, trim: '6x9' }, 320, 'Ann Writer');
    expect(page).toMatchObject({ size: 'custom', w: 6, h: 9, margins: { top: 0.75, bottom: 0.75, left: 0.6875, right: 0.6875 } });
    expect(page.hf).toMatchObject({ differentOddEven: true, differentChapterFirst: true, author: 'Ann Writer' });
    expect(page.hf?.sets.even?.header.center).toEqual([{ field: 'author' }]);
    expect(page.hf?.sets.main?.header.center).toEqual([{ field: 'title' }]);
    // Right-hand pages (the first, third…) have the spine on their left: their text moves right, 0.875 in inside, 0.5 out.
    expect(mirrorShift(320, 0)).toBeCloseTo(0.1875);
    expect(mirrorShift(320, 1)).toBeCloseTo(-0.1875);
    expect(page.margins.left + mirrorShift(320, 0)).toBeCloseTo(0.875);
    expect(page.margins.right - mirrorShift(320, 0)).toBeCloseTo(0.5);
    expect(estimatePages(87_000, { ...DEFAULT_DESIGN, trim: '5.5x8.5' })).toBe(300);
  });

  it('starts each chapter on a right-hand page, with a blank page before it when needed', () => {
    // A title page, then chapters of 3, 2 and 4 pages.
    expect(bookOffsets([1, 3, 2, 4], true)).toEqual({ offsets: [0, 2, 6, 8], total: 12 });
    expect(bookOffsets([1, 3, 2, 4], false)).toEqual({ offsets: [0, 1, 4, 6], total: 10 });
  });

  it('opens chapters in the design chosen', () => {
    const text = (blocks: ReturnType<typeof chapterOpening>) => blocks.map((b) => [b.type, b.style ?? '', runsText(b.runs)]);
    expect(text(chapterOpening({ ...DEFAULT_DESIGN, headings: 'classic' }, 3, 'The Storm'))).toEqual([
      ['paragraph', 'c-chapter-number', 'Chapter Three'],
      ['heading1', '', 'The Storm'],
    ]);
    expect(text(chapterOpening({ ...DEFAULT_DESIGN, headings: 'modern' }, 3, 'The Storm'))).toEqual([
      ['paragraph', 'c-chapter-number', '3'],
      ['heading1', '', 'The Storm'],
    ]);
    expect(text(chapterOpening({ ...DEFAULT_DESIGN, headings: 'simple' }, 3, 'The Storm'))).toEqual([['heading1', '', 'The Storm']]);
    // Untitled (or still "Chapter 3"): the number alone.
    expect(text(chapterOpening({ ...DEFAULT_DESIGN, headings: 'classic' }, 3, 'Chapter 3'))).toEqual([['heading1', '', 'Chapter Three']]);
    expect(text(chapterOpening({ ...DEFAULT_DESIGN, headings: 'modern' }, 12, ''))).toEqual([['paragraph', 'c-chapter-number', '12']]);
  });

  it('prints scene breaks as the design’s ornament', () => {
    expect(['* * *', '***', '#', ' ~ ~ ', '❦'].every(isSceneBreak)).toBe(true);
    expect(['* Not a break', 'The end.', ''].some(isSceneBreak)).toBe(false);
    const doc = fromMarkdown('The lamp went out.\n\n* * *\n\nMorning came.');
    const out = designDoc(doc, { ...DEFAULT_DESIGN, sceneBreak: 'fleuron' });
    expect(out.blocks.map((b) => [b.style ?? '', runsText(b.runs)])).toEqual([
      ['', 'The lamp went out.'],
      ['scenebreak', '❦'],
      ['', 'Morning came.'],
    ]);
    expect(runsText(designDoc(doc, { ...DEFAULT_DESIGN, sceneBreak: 'space' }).blocks[1].runs)).toBe('');
    // Nothing to change: the same document.
    const plain = fromMarkdown('Just prose.');
    expect(designDoc(plain, DEFAULT_DESIGN)).toBe(plain);
  });

  it('reads a design from a file, filling in what’s missing', () => {
    expect(cleanDesign({ trim: '6x9', headings: 'nonsense', dropCaps: false })).toEqual({ ...DEFAULT_DESIGN, trim: '6x9', dropCaps: false });
    expect(cleanDesign('6x9')).toBeUndefined();
  });

  it('gives the pages the design’s type: a drop cap only when chosen', () => {
    expect(designCss(DEFAULT_DESIGN)).toContain('::first-letter');
    expect(designCss({ ...DEFAULT_DESIGN, dropCaps: false })).not.toContain('::first-letter');
    expect(designCss({ ...DEFAULT_DESIGN, font: 'Crimson Pro' })).toContain("'Crimson Pro'");
  });
});
