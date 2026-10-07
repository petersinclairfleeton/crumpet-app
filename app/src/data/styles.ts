// Named styles, like Word's: Normal, Title, Heading 1… each with a font,
// size, spacing and indents. A project has its own set; notes share one.
// Styles are turned into CSS for the editor, scoped to the document using
// them.

import type { Align, Block, BlockType } from '@crumpet/editor/model';
import type { NoteFont } from './types';
import { type HeadersFooters, cleanHF, manuscriptHeaders } from './headers';

export type StyleKey =
  | 'normal'
  | 'nospacing'
  | 'title'
  | 'subtitle'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'quote'
  | 'intense'
  | 'epigraph'
  | 'caption'
  | 'scenebreak'
  | 'list'
  | 'header'
  | 'footer';

export interface StyleDef {
  /** null: the writing font from Settings. */
  font: NoteFont | null;
  /** Points; null: the text size from Settings. */
  size: number | null;
  bold: boolean;
  italic: boolean;
  /** Capital letters. */
  caps: boolean;
  align: Align;
  /** Points. */
  spaceBefore: number;
  spaceAfter: number;
  /** Multiple of the font size (1 = single, 2 = double). */
  lineSpacing: number;
  /** Inches. */
  firstIndent: number;
  leftIndent: number;
}

export interface StyleSheet {
  /** The preset it started from. */
  preset: PresetId;
  styles: Record<StyleKey, StyleDef>;
}

/** The styles in the order Word's style menu shows them, and the block each one makes. */
export const STYLE_LIST: { key: StyleKey; name: string; type: BlockType; style?: string; inMenu: boolean }[] = [
  { key: 'normal', name: 'Normal', type: 'paragraph', inMenu: true },
  { key: 'nospacing', name: 'No Spacing', type: 'paragraph', style: 'nospacing', inMenu: true },
  { key: 'title', name: 'Title', type: 'paragraph', style: 'title', inMenu: true },
  { key: 'subtitle', name: 'Subtitle', type: 'paragraph', style: 'subtitle', inMenu: true },
  { key: 'heading1', name: 'Heading 1', type: 'heading1', inMenu: true },
  { key: 'heading2', name: 'Heading 2', type: 'heading2', inMenu: true },
  { key: 'heading3', name: 'Heading 3', type: 'heading3', inMenu: true },
  { key: 'heading4', name: 'Heading 4', type: 'heading4', inMenu: true },
  { key: 'quote', name: 'Quote', type: 'quote', inMenu: true },
  { key: 'intense', name: 'Intense Quote', type: 'quote', style: 'intense', inMenu: true },
  { key: 'epigraph', name: 'Epigraph', type: 'paragraph', style: 'epigraph', inMenu: true },
  { key: 'caption', name: 'Caption', type: 'paragraph', style: 'caption', inMenu: true },
  { key: 'scenebreak', name: 'Scene Break', type: 'paragraph', style: 'scenebreak', inMenu: true },
  { key: 'list', name: 'List Paragraph', type: 'bullet', inMenu: false },
  { key: 'header', name: 'Header', type: 'paragraph', inMenu: false },
  { key: 'footer', name: 'Footer', type: 'paragraph', inMenu: false },
];

export function styleName(key: StyleKey): string {
  return STYLE_LIST.find((s) => s.key === key)?.name ?? key;
}

/** Which named style a block has. */
export function styleKeyOf(block: Pick<Block, 'type' | 'style'>): StyleKey {
  if (block.type === 'bullet' || block.type === 'numbered' || block.type === 'todo') return 'list';
  if (block.type === 'quote') return block.style === 'intense' ? 'intense' : 'quote';
  if (block.type === 'paragraph') return (block.style as StyleKey | undefined) ?? 'normal';
  return block.type as StyleKey;
}

// ---------------------------------------------------------------- presets

export type PresetId = 'crumpet' | 'manuscript' | 'book' | 'modern';

const base: StyleDef = { font: null, size: null, bold: false, italic: false, caps: false, align: 'left', spaceBefore: 0, spaceAfter: 7.5, lineSpacing: 1.75, firstIndent: 0, leftIndent: 0 };
const s = (patch: Partial<StyleDef>, from: StyleDef = base): StyleDef => ({ ...from, ...patch });

/** Headers and footers: no indents or space around them. */
const BAND: Partial<StyleDef> = { spaceBefore: 0, spaceAfter: 0, firstIndent: 0, leftIndent: 0, lineSpacing: 1.2, align: 'left' };

function sheet(preset: PresetId, normal: StyleDef, rest: Partial<Record<StyleKey, Partial<StyleDef>>>): StyleSheet {
  const styles = {} as Record<StyleKey, StyleDef>;
  for (const { key } of STYLE_LIST) styles[key] = s({ ...(key === 'header' || key === 'footer' ? BAND : {}), ...rest[key] }, normal);
  return { preset, styles };
}

const TIMES: NoteFont = { family: 'Times New Roman', source: 'system', category: 'serif' };
const LITERATA: NoteFont = { family: 'Literata', source: 'google', styles: 15, category: 'serif' };
const INTER: NoteFont = { family: 'Inter', source: 'google', styles: 15, category: 'sans-serif' };

export const PRESETS: { id: PresetId; name: string; hint: string; make(): StyleSheet }[] = [
  {
    id: 'crumpet',
    name: 'Crumpet',
    hint: 'Crumpet’s own: your writing font, roomy and simple',
    make: () =>
      sheet('crumpet', base, {
        nospacing: { spaceAfter: 0 },
        title: { size: 25.5, bold: true, lineSpacing: 1.2, spaceAfter: 4.5 },
        subtitle: { size: 14, lineSpacing: 1.4, spaceAfter: 12 },
        heading1: { size: 22.5, bold: true, lineSpacing: 1.2, spaceAfter: 10.5 },
        heading2: { size: 14, bold: true, lineSpacing: 1.35, spaceBefore: 13.5, spaceAfter: 4.5 },
        heading3: { size: 12, bold: true, lineSpacing: 1.4, spaceBefore: 10.5, spaceAfter: 3 },
        heading4: { size: 10, bold: true, caps: true, lineSpacing: 1.4, spaceBefore: 9, spaceAfter: 3 },
        quote: { spaceBefore: 3, spaceAfter: 9 },
        intense: { italic: true, bold: true, spaceBefore: 3, spaceAfter: 9 },
        epigraph: { italic: true, leftIndent: 2 },
        caption: { size: 10, italic: true },
        scenebreak: { align: 'center', spaceBefore: 13.5, spaceAfter: 13.5 },
        list: { spaceAfter: 3 },
        header: { size: 10 },
        footer: { size: 10 },
      }),
  },
  {
    id: 'manuscript',
    name: 'Manuscript',
    hint: 'Standard manuscript format: 12 pt Times, double-spaced, indented paragraphs',
    make: () =>
      sheet('manuscript', s({ font: TIMES, size: 12, lineSpacing: 2, spaceAfter: 0, firstIndent: 0.5 }), {
        nospacing: { firstIndent: 0 },
        title: { align: 'center', firstIndent: 0, caps: true },
        subtitle: { align: 'center', firstIndent: 0 },
        heading1: { align: 'center', firstIndent: 0, spaceAfter: 24 },
        heading2: { align: 'center', firstIndent: 0 },
        heading3: { firstIndent: 0, bold: true },
        heading4: { firstIndent: 0, italic: true },
        quote: { firstIndent: 0, leftIndent: 0.5 },
        intense: { firstIndent: 0, leftIndent: 0.5, italic: true },
        epigraph: { firstIndent: 0, leftIndent: 1, italic: true },
        caption: { firstIndent: 0, align: 'center' },
        scenebreak: { firstIndent: 0, align: 'center' },
        list: { firstIndent: 0 },
      }),
  },
  {
    id: 'book',
    name: 'Book',
    hint: 'Like a printed novel: Literata, justified, indented paragraphs',
    make: () =>
      sheet('book', s({ font: LITERATA, size: 11, lineSpacing: 1.45, spaceAfter: 0, firstIndent: 0.25, align: 'justify' }), {
        nospacing: { firstIndent: 0 },
        title: { size: 26, align: 'center', firstIndent: 0, spaceAfter: 6, lineSpacing: 1.2 },
        subtitle: { size: 14, italic: true, align: 'center', firstIndent: 0, spaceAfter: 24 },
        heading1: { size: 18, align: 'center', firstIndent: 0, spaceBefore: 36, spaceAfter: 24, lineSpacing: 1.2 },
        heading2: { size: 13, caps: true, align: 'center', firstIndent: 0, spaceBefore: 18, spaceAfter: 12 },
        heading3: { size: 11, bold: true, align: 'left', firstIndent: 0, spaceBefore: 12, spaceAfter: 6 },
        heading4: { size: 11, italic: true, align: 'left', firstIndent: 0, spaceBefore: 12, spaceAfter: 6 },
        quote: { firstIndent: 0, leftIndent: 0.4, spaceBefore: 6, spaceAfter: 6, align: 'left' },
        intense: { firstIndent: 0, leftIndent: 0.4, italic: true, spaceBefore: 6, spaceAfter: 6, align: 'left' },
        epigraph: { firstIndent: 0, leftIndent: 1.5, italic: true, size: 10, align: 'left', spaceAfter: 18 },
        caption: { firstIndent: 0, size: 9, italic: true, align: 'center' },
        scenebreak: { firstIndent: 0, align: 'center', spaceBefore: 12, spaceAfter: 12 },
        list: { firstIndent: 0, align: 'left' },
        header: { size: 8.5, caps: true },
        footer: { size: 9 },
      }),
  },
  {
    id: 'modern',
    name: 'Modern',
    hint: 'Clean and airy: Inter, space between paragraphs',
    make: () =>
      sheet('modern', s({ font: INTER, size: 11, lineSpacing: 1.6, spaceAfter: 9 }), {
        nospacing: { spaceAfter: 0 },
        title: { size: 28, bold: true, lineSpacing: 1.15, spaceAfter: 6 },
        subtitle: { size: 14, lineSpacing: 1.4, spaceAfter: 18 },
        heading1: { size: 20, bold: true, lineSpacing: 1.25, spaceBefore: 18, spaceAfter: 9 },
        heading2: { size: 15, bold: true, lineSpacing: 1.3, spaceBefore: 15, spaceAfter: 6 },
        heading3: { size: 12.5, bold: true, spaceBefore: 12, spaceAfter: 4 },
        heading4: { size: 11, bold: true, caps: true, spaceBefore: 12, spaceAfter: 4 },
        quote: { italic: true, leftIndent: 0.3 },
        intense: { italic: true, bold: true, leftIndent: 0.3 },
        epigraph: { italic: true, leftIndent: 1.5 },
        caption: { size: 9, italic: true },
        scenebreak: { align: 'center', spaceBefore: 12, spaceAfter: 12 },
        list: { spaceAfter: 3 },
        header: { size: 9 },
        footer: { size: 9 },
      }),
  },
];

export function presetSheet(id: PresetId): StyleSheet {
  return (PRESETS.find((p) => p.id === id) ?? PRESETS[0]).make();
}

/** A style sheet saved earlier, completed with anything added since. */
export function fullSheet(sheet: StyleSheet | undefined, fallback: PresetId): StyleSheet {
  const preset = presetSheet(sheet?.preset ?? fallback);
  if (!sheet) return preset;
  const styles = { ...preset.styles };
  for (const key of Object.keys(styles) as StyleKey[]) if (sheet.styles?.[key]) styles[key] = { ...preset.styles[key], ...sheet.styles[key] };
  return { preset: sheet.preset, styles };
}

// ---------------------------------------------------------------- CSS

const SELECTORS: Record<StyleKey, string> = {
  normal: '.blk-paragraph:not([data-style])',
  nospacing: ".blk-paragraph[data-style='nospacing']",
  title: ".blk-paragraph[data-style='title']",
  subtitle: ".blk-paragraph[data-style='subtitle']",
  heading1: '.blk-heading1',
  heading2: '.blk-heading2',
  heading3: '.blk-heading3',
  heading4: '.blk-heading4',
  quote: '.blk-quote:not([data-style])',
  intense: ".blk-quote[data-style='intense']",
  epigraph: ".blk-paragraph[data-style='epigraph']",
  caption: ".blk-paragraph[data-style='caption']",
  scenebreak: ".blk-paragraph[data-style='scenebreak']",
  list: '.blk-list',
  header: '.hf-header',
  footer: '.hf-footer',
};

/**
 * CSS for a style sheet, scoped under `scope`. `stack` turns a font into a
 * CSS font-family. Alignment set on a paragraph by hand wins over its style's.
 */
export function sheetCss(sheet: StyleSheet, scope: string, stack: (f: NoteFont) => string): string {
  const rules: string[] = [];
  for (const { key } of STYLE_LIST) {
    const d = sheet.styles[key];
    const decl = [
      `font-family: ${d.font ? stack(d.font) : 'var(--note-font, inherit)'}`,
      `font-size: ${d.size ? `${d.size}pt` : 'var(--note-size, 18px)'}`,
      `font-weight: ${d.bold ? 700 : 400}`,
      `font-style: ${d.italic ? 'italic' : 'normal'}`,
      `text-transform: ${d.caps ? 'uppercase' : 'none'}`,
      `letter-spacing: ${d.caps ? '0.04em' : 'normal'}`,
      `text-align: ${d.align}`,
      `margin-top: ${d.spaceBefore}pt`,
      `margin-bottom: ${d.spaceAfter}pt`,
      `line-height: ${d.lineSpacing}`,
      `text-indent: ${d.firstIndent}in`,
      key === 'list' ? `margin-left: calc(${d.leftIndent}in + var(--indent, 0) * 24px)` : `margin-left: ${d.leftIndent}in`,
    ];
    // Crumpet's own quotes sit in a tinted box; in the other sets they're plain, indented text.
    if ((key === 'quote' || key === 'intense') && sheet.preset !== 'crumpet') decl.push('background: none', 'padding: 0', 'border: none', 'border-radius: 0');
    rules.push(`${scope} ${SELECTORS[key]} { ${decl.join('; ')}; }`);
  }
  // Paragraph alignment chosen by hand.
  for (const a of ['left', 'center', 'right', 'justify']) rules.push(`${scope} .blk[data-align='${a}'] { text-align: ${a}; }`);
  return rules.join('\n');
}

/** A short stable hash, for naming the CSS scope of a style sheet. */
export function sheetId(sheet: StyleSheet): string {
  const text = JSON.stringify(sheet);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

// ---------------------------------------------------------------- pages

export type PageSize = 'letter' | 'a4' | 'a5' | 'book' | 'legal';

export const PAGE_SIZES: { id: PageSize; name: string; width: number; height: number }[] = [
  { id: 'letter', name: 'US Letter (8.5 × 11 in)', width: 8.5, height: 11 },
  { id: 'a4', name: 'A4 (21 × 29.7 cm)', width: 8.27, height: 11.69 },
  { id: 'a5', name: 'A5 (14.8 × 21 cm)', width: 5.83, height: 8.27 },
  { id: 'book', name: 'Book (6 × 9 in)', width: 6, height: 9 },
  { id: 'legal', name: 'US Legal (8.5 × 14 in)', width: 8.5, height: 14 },
];

export interface PageSetup {
  size: PageSize;
  /** Inches. */
  margins: { top: number; right: number; bottom: number; left: number };
  /** Older setups only: a page number in the footer. Headers and footers are in `hf`. */
  pageNumbers: boolean;
  hf?: HeadersFooters;
}

/** A page setup's headers and footers. */
export function pageHF(p: PageSetup): HeadersFooters {
  return cleanHF(p.hf, p.pageNumbers);
}

/** New projects: manuscript format, with “Author / TITLE / page” at the top of each page but the first. */
export function manuscriptPage(): PageSetup {
  return { ...defaultPage(), hf: manuscriptHeaders() };
}

/** Letter in the US and Canada, A4 elsewhere; 1-inch margins, as manuscripts want. */
export function defaultPage(): PageSetup {
  const lang = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
  const letter = /^(en-(US|CA)|es-(US|MX)|fr-CA)/.test(lang);
  return { size: letter ? 'letter' : 'a4', margins: { top: 1, right: 1, bottom: 1, left: 1 }, pageNumbers: true };
}

export const PX_PER_IN = 96;
/** Space between pages on screen, px. */
export const PAGE_GAP = 24;

export function pageSize(p: PageSetup): { width: number; height: number } {
  const s = PAGE_SIZES.find((x) => x.id === p.size) ?? PAGE_SIZES[0];
  return { width: s.width * PX_PER_IN, height: s.height * PX_PER_IN };
}
