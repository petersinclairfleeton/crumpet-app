// Print-ready books, as self-publishers need them for Amazon KDP, IngramSpark
// or a local printer: a trade trim size, margins wider at the spine the more
// pages there are (mirrored, so the wider one is always on the inside), a
// book typeface, chapter openings in one of three designs with a drop cap,
// scene breaks as an ornament, chapters starting on a right-hand page, and
// running heads (the author on left-hand pages, the title on right-hand ones).
// Kept with the book (`project.design`); printed through Crumpet's print
// window, whose PDF is the interior file to upload.

import { type Block, type Doc, makeBlock, runsText } from '@crumpet/editor/model';
import type { HFBand, HFRun } from './headers';
import { numberInWords } from './selectors';
import type { PageSetup } from './styles';

export type TrimSize = '5x8' | '5.25x8' | '5.5x8.5' | '6x9';
export type HeadingDesign = 'classic' | 'modern' | 'simple';
export type SceneBreak = 'fleuron' | 'asterisks' | 'space';
export type BookFont = 'EB Garamond' | 'Libre Baskerville' | 'Crimson Pro';

export interface BookDesign {
  trim: TrimSize;
  font: BookFont;
  headings: HeadingDesign;
  dropCaps: boolean;
  sceneBreak: SceneBreak;
  /** Chapters start on a right-hand page (a blank page before them when needed). */
  recto: boolean;
}

export const TRIMS: { id: TrimSize; name: string; w: number; h: number; hint: string; size: number }[] = [
  { id: '5x8', name: '5 × 8 in', w: 5, h: 8, hint: 'Compact, for shorter novels', size: 10.5 },
  { id: '5.25x8', name: '5.25 × 8 in', w: 5.25, h: 8, hint: 'A little wider', size: 10.5 },
  { id: '5.5x8.5', name: '5.5 × 8.5 in', w: 5.5, h: 8.5, hint: 'Novels and memoir', size: 11 },
  { id: '6x9', name: '6 × 9 in', w: 6, h: 9, hint: 'The most common trade size', size: 11.5 },
];

export const BOOK_FONTS: { id: BookFont; hint: string }[] = [
  { id: 'EB Garamond', hint: 'Classic and light' },
  { id: 'Libre Baskerville', hint: 'Sturdy and clear' },
  { id: 'Crimson Pro', hint: 'Warm and modern' },
];

export const HEADING_DESIGNS: { id: HeadingDesign; name: string; hint: string }[] = [
  { id: 'classic', name: 'Classic', hint: '“Chapter One” in small capitals, the title under it, centred a third of the way down' },
  { id: 'modern', name: 'Modern', hint: 'A large number, the title under it and a rule, on the left' },
  { id: 'simple', name: 'Simple', hint: 'The title alone, centred, in italics' },
];

export const SCENE_BREAKS: { id: SceneBreak; name: string; mark: string }[] = [
  { id: 'fleuron', name: 'Fleuron ❦', mark: '❦' },
  { id: 'asterisks', name: 'Asterisks * * *', mark: '* * *' },
  { id: 'space', name: 'A blank line', mark: '' },
];

export const DEFAULT_DESIGN: BookDesign = { trim: '5.5x8.5', font: 'EB Garamond', headings: 'classic', dropCaps: true, sceneBreak: 'fleuron', recto: true };

const pick = <T extends string>(v: unknown, list: { id: T }[], or: T): T => (list.some((x) => x.id === v) ? (v as T) : or);

/** A design as read from a file: anything missing or unknown is the default. */
export function cleanDesign(v: unknown): BookDesign | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const d = v as Record<string, unknown>;
  return {
    trim: pick(d.trim, TRIMS, DEFAULT_DESIGN.trim),
    font: pick(d.font, BOOK_FONTS, DEFAULT_DESIGN.font),
    headings: pick(d.headings, HEADING_DESIGNS, DEFAULT_DESIGN.headings),
    dropCaps: d.dropCaps !== false,
    sceneBreak: pick(d.sceneBreak, SCENE_BREAKS, DEFAULT_DESIGN.sceneBreak),
    recto: d.recto !== false,
  };
}

export function trimOf(design: BookDesign) {
  return TRIMS.find((x) => x.id === design.trim) ?? TRIMS[2];
}

/** About how many pages a book of this many words makes at this trim size (for the spine margin; the pages laid out tell exactly). */
export function estimatePages(words: number, design: BookDesign): number {
  const perPage = { '5x8': 250, '5.25x8': 265, '5.5x8.5': 290, '6x9': 330 }[design.trim] ?? 290;
  return Math.max(1, Math.ceil(words / perPage));
}

/** The inside (spine) margin for a book of this many pages: KDP's least for it, plus a quarter inch so no words sink into the fold. */
export function insideMargin(pages: number): number {
  return pages <= 150 ? 0.625 : pages <= 300 ? 0.75 : pages <= 500 ? 0.875 : pages <= 700 ? 1 : 1.125;
}

/** The outside margin. */
export const OUTSIDE = 0.5;
const TOP = 0.75;

const band = (center: HFRun[]): HFBand => ({ left: [], center, right: [] });

/**
 * The page setup for the book: the trim size, and side margins that average the inside and outside (each
 * page's text is then moved towards the outside edge, `mirrorShift`, so the spine side is the wider). Running
 * heads: the author on left-hand pages, the title on right-hand ones, none on a chapter's first page or the
 * title page; the page number at the foot.
 */
export function printPage(design: BookDesign, pages: number, author?: string): PageSetup {
  const t = trimOf(design);
  const side = (insideMargin(pages) + OUTSIDE) / 2;
  const caps = (field: HFRun['field']): HFRun[] => [{ field }];
  return {
    size: 'custom',
    w: t.w,
    h: t.h,
    margins: { top: TOP, bottom: TOP, left: side, right: side },
    pageNumbers: false,
    hf: {
      sets: {
        main: { header: band(caps('title')), footer: band([{ field: 'page' }]) },
        even: { header: band(caps('author')), footer: band([{ field: 'page' }]) },
        first: { header: band([]), footer: band([]) },
        chapterFirst: { header: band([]), footer: band([{ field: 'page' }]) },
      },
      differentFirst: true,
      differentChapterFirst: true,
      differentOddEven: true,
      numberFormat: '1',
      startAt: 1,
      headerFrom: 0.4,
      footerFrom: 0.4,
      headerLine: false,
      footerLine: false,
      ...(author ? { author } : {}),
    },
  };
}

/**
 * How far (inches) page `index`'s text moves sideways (0 is the first page, a right-hand one): right-hand pages
 * have the spine on their left, so their text moves right; left-hand pages, left.
 */
export function mirrorShift(pages: number, index: number): number {
  const d = (insideMargin(pages) - OUTSIDE) / 2;
  return index % 2 === 0 ? d : -d;
}

/**
 * Where each part's pages start in the book, given how many pages each has: with `recto`, each chapter (every
 * part after the first) starts on a right-hand page, a blank page before it when it would fall on a left one.
 */
export function bookOffsets(counts: number[], recto: boolean): { offsets: number[]; total: number } {
  const offsets: number[] = [];
  let at = 0;
  counts.forEach((n, i) => {
    if (recto && i > 0 && at % 2 === 1) at++;
    offsets.push(at);
    at += n;
  });
  return { offsets, total: at };
}

/** A chapter's opening in the design: its number (in words, or a figure) above its title, or the title alone. */
export function chapterOpening(design: BookDesign, number: number, title: string): Block[] {
  const t = title.trim();
  const words = `Chapter ${numberInWords(number)}`;
  if (design.headings === 'simple') return [makeBlock('heading1', t || words)];
  const label = design.headings === 'classic' ? words : String(number);
  // An untitled chapter (or one still called "Chapter 3"): its number alone.
  if (!t || t === `Chapter ${number}`) return design.headings === 'classic' ? [makeBlock('heading1', words)] : [makeBlock('paragraph', label, [], { style: 'c-chapter-number' })];
  return [makeBlock('paragraph', label, [], { style: 'c-chapter-number' }), makeBlock('heading1', t)];
}

/** The book's title page: its title, and the author under it. */
export function titlePage(title: string, author: string): Block[] {
  return [makeBlock('paragraph', title.trim() || 'Untitled', [], { style: 'c-book-title' }), ...(author.trim() ? [makeBlock('paragraph', author.trim(), [], { style: 'c-book-author' })] : [])];
}

/** A scene break as written in the text: a line of only *, #, ~ or • (with spaces), or a fleuron. */
export function isSceneBreak(text: string): boolean {
  return /^\s*(?:[*#~•·]\s*){1,5}$|^\s*[❦❧⁂]\s*$/.test(text);
}

/** The text for printing: scene breaks (written as * * *, or in the Scene Break style) as the design's ornament. */
export function designDoc(doc: Doc, design: BookDesign): Doc {
  const mark = SCENE_BREAKS.find((s) => s.id === design.sceneBreak)?.mark ?? '';
  let changed = false;
  const blocks = doc.blocks.map((b) => {
    if (b.type !== 'paragraph') return b;
    const text = runsText(b.runs);
    if (!isSceneBreak(text) && !(b.style === 'scenebreak' && text.trim().length <= 12)) return b;
    changed = true;
    return { ...b, style: 'scenebreak', runs: mark ? [{ text: mark, marks: [] }] : [] };
  });
  return changed ? { ...doc, blocks } : doc;
}

/** The type sizes and spacing of the design, for the book's pages (scoped to `.book-design`). */
export function designCss(design: BookDesign, scope = '.book-design'): string {
  const s = scope;
  const size = trimOf(design).size;
  const font = `'${design.font}', 'Iowan Old Style', Georgia, 'Times New Roman', serif`;
  const body = `${s} .blk-paragraph:not([data-style])`;
  // The chapter's first paragraph: under its title, or under its number alone.
  const open = `${s} :is(.blk-heading1, .blk-paragraph[data-style='c-chapter-number']) + .blk-paragraph:not([data-style])`;
  const num = `${s} .blk-paragraph[data-style='c-chapter-number']`;
  const h1 = `${s} .blk-heading1`;
  // The space above a chapter's opening is padding: a page's first paragraph keeps its padding, not its margin.
  const heads: Record<HeadingDesign, string[]> = {
    classic: [
      `${num} { text-align: center !important; text-indent: 0 !important; font-variant: small-caps; text-transform: lowercase !important; letter-spacing: 0.12em !important; font-size: ${size}pt !important; margin: 0 0 0.12in !important; padding-top: 1.9in; }`,
      `${h1} { text-align: center !important; font-weight: 400 !important; font-style: normal !important; font-size: ${size * 1.75}pt !important; line-height: 1.2 !important; margin: 0 0 0.55in !important; padding-top: 1.9in; }`,
      `${num} + .blk-heading1 { padding-top: 0; }`,
    ],
    modern: [
      `${num} { text-align: left !important; text-indent: 0 !important; font-weight: 700 !important; font-size: ${size * 3.4}pt !important; line-height: 1 !important; margin: 0 0 0.1in !important; padding-top: 1.3in; }`,
      `${h1} { text-align: left !important; font-weight: 600 !important; font-style: normal !important; font-size: ${size * 1.45}pt !important; line-height: 1.25 !important; margin: 0 0 0.45in !important; padding-top: 1.3in; padding-bottom: 0.12in; border-bottom: 0.75pt solid currentColor; }`,
      `${num} + .blk-heading1 { padding-top: 0; }`,
      // An untitled chapter: its number, then the text.
      `${num} + .blk-paragraph:not([data-style]) { margin-top: 0.4in !important; }`,
    ],
    simple: [`${h1} { text-align: center !important; font-weight: 400 !important; font-style: italic !important; font-size: ${size * 1.6}pt !important; line-height: 1.25 !important; margin: 0 0 0.5in !important; padding-top: 1.6in; }`],
  };

  return [
    `${s} .note-editor { --note-font: ${font}; }`,
    `${s} .blk { font-family: ${font} !important; }`,
    `${body}, ${s} .blk-paragraph[data-style='scenebreak'] { font-size: ${size}pt !important; line-height: 1.4 !important; margin-top: 0 !important; margin-bottom: 0 !important; }`,
    `${body} { text-indent: 1.4em !important; }`,
    `${body}:not([data-align]) { text-align: justify !important; hyphens: auto; }`,
    `${body}[data-opens], ${open} { text-indent: 0 !important; }`,
    // A paragraph carried over from the page before goes on without a new indent.
    `${body}[data-cont] { text-indent: 0 !important; }`,
    `${open}::first-line { font-variant: small-caps; letter-spacing: 0.03em; }`,
    design.dropCaps ? `${open}::first-letter { float: left; font-size: ${size * 3.25}pt; line-height: 0.8; margin: 0.05em 0.07em 0 0; }` : '',
    `${s} .blk-paragraph[data-style='scenebreak'] { text-align: center !important; text-indent: 0 !important; margin: 0.7em 0 !important; min-height: 1.4em; }`,
    ...heads[design.headings],
    `${s} .blk-paragraph[data-style='c-book-title'] { text-align: center !important; text-indent: 0 !important; font-size: ${size * 2.4}pt !important; line-height: 1.15 !important; margin: 0 0 0.35in !important; padding-top: 2.3in; }`,
    `${s} .blk-paragraph[data-style='c-book-author'] { text-align: center !important; text-indent: 0 !important; font-variant: small-caps; letter-spacing: 0.1em; font-size: ${size * 1.2}pt !important; margin: 0 !important; }`,
    `${s} .hf-band { font-family: ${font}; font-size: ${size * 0.8}pt; letter-spacing: 0.06em; }`,
  ]
    .filter(Boolean)
    .join('\n');
}
