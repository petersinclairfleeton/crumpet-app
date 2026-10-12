// Document model: a flat list of blocks, each holding runs of marked text.
// Everything here is immutable: an edit returns new objects for what changed
// and reuses the rest, so the view can tell changed blocks apart by identity.

export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code';
export const MARK_ORDER: Mark[] = ['bold', 'italic', 'underline', 'strike', 'code'];

export interface Run {
  text: string;
  marks: Mark[]; // always sorted by MARK_ORDER, no duplicates
  /** Link target, if this text is a link. */
  link?: string;
  /**
   * A footnote's text. A footnote is a run of its own holding one FOOTNOTE
   * character, shown as its number; it never merges with its neighbours.
   */
  footnote?: string;
  /**
   * A field (Word's Insert > Date and Time with "update automatically", and
   * the like): a run of its own holding one FIELD character, shown as what
   * the field says now (`date`, `date-full`, `date-short`, `date-iso`,
   * `month`, `time`, `datetime`). It never merges with its neighbours.
   */
  field?: string;
  /** A comment on this text (the same comment on every run it covers). */
  comment?: Comment;
  /** With track changes: this text was added, or deleted (still shown, struck through, until accepted). */
  change?: Change;
  /** Font, size, colour, highlight, raised or lowered: how this text looks beyond bold and italic. */
  look?: Look;
}

/** Character formatting beyond the marks, as in Word's Font group. */
export interface Look {
  /** A font family name. */
  font?: string;
  /** Size in points. */
  size?: number;
  /** Text colour and highlight, as #rrggbb. */
  color?: string;
  highlight?: string;
  /** Superscript or subscript. */
  va?: 'super' | 'sub';
  /** Word's Font window: small capitals or all capitals. */
  caps?: 'small' | 'all';
  /** Double strikethrough, and hidden text (shown only with Show/hide ¶), as 1. */
  dstrike?: 1;
  hidden?: 1;
  /** An underline of a style of its own (and its colour, as #rrggbb). */
  ul?: 'single' | 'double' | 'dotted' | 'dashed' | 'wavy' | 'thick';
  ulc?: string;
  /** Character spacing (expanded, or condensed when below 0) and raised or lowered by, in points. */
  sp?: number;
  pos?: number;
  /** OpenType: kerning off (1), ligatures, number forms and spacing, a stylistic set (1 to 20). */
  nokern?: 1;
  lig?: 'none' | 'common' | 'contextual' | 'all';
  num?: 'lining' | 'oldstyle';
  nsp?: 'tabular' | 'proportional';
  ss?: number;
  /** A text effect. */
  fx?: 'outline' | 'shadow' | 'glow' | 'reflect' | 'emboss' | 'engrave';
}
export type LookKey = keyof Look;
export const LOOK_KEYS: LookKey[] = ['font', 'size', 'color', 'highlight', 'va', 'caps', 'dstrike', 'hidden', 'ul', 'ulc', 'sp', 'pos', 'nokern', 'lig', 'num', 'nsp', 'ss', 'fx'];

/** The words each of a look's settings may be (the rest are numbers, colours or names). */
const LOOK_WORDS: Partial<Record<LookKey, readonly string[]>> = {
  va: ['super', 'sub'],
  caps: ['small', 'all'],
  ul: ['single', 'double', 'dotted', 'dashed', 'wavy', 'thick'],
  lig: ['none', 'common', 'contextual', 'all'],
  num: ['lining', 'oldstyle'],
  nsp: ['tabular', 'proportional'],
  fx: ['outline', 'shadow', 'glow', 'reflect', 'emboss', 'engrave'],
};

/** Whether `v` is something look setting `k` can be. */
export function lookValueOk(k: LookKey, v: unknown): boolean {
  if (v === undefined || v === null || v === '') return false;
  if (LOOK_WORDS[k]) return LOOK_WORDS[k]!.includes(v as string);
  switch (k) {
    case 'font':
      return typeof v === 'string';
    case 'size':
      return typeof v === 'number' && v > 0 && v <= 400;
    case 'color':
    case 'highlight':
    case 'ulc':
      return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
    case 'dstrike':
    case 'hidden':
    case 'nokern':
      return v === 1;
    case 'sp':
      return typeof v === 'number' && v >= -10 && v <= 50 && v !== 0;
    case 'pos':
      return typeof v === 'number' && v >= -50 && v <= 50 && v !== 0;
    case 'ss':
      return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 20;
    default:
      return false;
  }
}

/** A look with nothing unset left in it, or undefined if it's empty. */
export function tidyLook(l: Look | undefined): Look | undefined {
  if (!l) return undefined;
  const out: Look = {};
  for (const k of LOOK_KEYS) if (l[k] !== undefined && l[k] !== null && l[k] !== '') (out as Record<string, unknown>)[k] = l[k];
  return Object.keys(out).length ? out : undefined;
}

export function sameLook(a: Look | undefined, b: Look | undefined): boolean {
  return LOOK_KEYS.every((k) => (a?.[k] ?? undefined) === (b?.[k] ?? undefined));
}

/** A tracked change: who made it and when (ms, to the minute; 0 if unknown). */
export interface Change {
  kind: 'ins' | 'del';
  author: string;
  at: number;
}

export function sameChange(a: Change | undefined, b: Change | undefined): boolean {
  return a === b || (!!a && !!b && a.kind === b.kind && a.author === b.author && a.at === b.at);
}

/** A tracked change made now by `author`. */
export function makeChange(kind: Change['kind'], author: string, at = Date.now()): Change {
  return { kind, author: author.replace(/\s+/g, ' ').trim(), at: Math.floor(at / 60000) * 60000 };
}

/** A remark left on some text, with any replies. */
export interface Comment {
  id: string;
  author: string;
  /** When it was written (ms), 0 if unknown. */
  at: number;
  text: string;
  replies?: CommentReply[];
  /** Done with: kept, greyed out, until it's reopened or deleted (Word's Resolve). */
  resolved?: boolean;
}

export interface CommentReply {
  author: string;
  at: number;
  text: string;
}

/**
 * A comment's id, made from who wrote it, when and what it says, so the same
 * comment read from a file twice (or on another device) gets the same id.
 */
export function commentId(author: string, at: number, text: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${author}|${at}|${text}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `c${h.toString(36)}`;
}

/** A new comment: its time to the minute (as files keep it) and its text on one line. */
export function makeComment(author: string, text: string, at = Date.now()): Comment {
  const t = Math.floor(at / 60000) * 60000;
  const clean = text.replace(/\s+/g, ' ').trim();
  return { id: commentId(author, t, clean), author: author.replace(/\s+/g, ' ').trim(), at: t, text: clean };
}

export function sameComment(a: Comment | undefined, b: Comment | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.id !== b.id || a.author !== b.author || a.at !== b.at || a.text !== b.text) return false;
  const ra = a.replies ?? [];
  const rb = b.replies ?? [];
  return ra.length === rb.length && ra.every((r, i) => r.author === rb[i].author && r.at === rb[i].at && r.text === rb[i].text);
}

/** The character a footnote's marker stands on in the text (invisible; the number is drawn instead). */
export const FOOTNOTE = '\u2063';
/** The character a field stands on in the text (shown as the field's value). */
export const FIELD = '\u2062';

export type BlockType = 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'todo' | 'bullet' | 'numbered' | 'quote' | 'image' | 'file' | 'table' | 'toc' | 'shape' | 'code';

/** Maths (LaTeX, drawn with KaTeX), a diagram (Mermaid), or a board (JSON Canvas, shown by the app), written as text. */
export type CodeLang = 'math' | 'mermaid' | 'canvas';
export interface CodeLook {
  lang: CodeLang;
  /** The source, any number of lines. */
  text: string;
}

export function tidyCode(c: Partial<CodeLook> | undefined): CodeLook {
  return { lang: c?.lang === 'mermaid' || c?.lang === 'canvas' ? c.lang : 'math', text: typeof c?.text === 'string' ? c.text.replace(/\r\n?/g, '\n') : '' };
}

/** Blocks that are boxes of their own (with their own editing), not text: tables, contents, shapes, maths and diagrams. */
export function isWidget(type: BlockType): boolean {
  return type === 'table' || type === 'toc' || type === 'shape' || type === 'code';
}

export const HEADINGS: readonly BlockType[] = ['heading1', 'heading2', 'heading3', 'heading4'];

export function isHeading(type: BlockType): boolean {
  return HEADINGS.includes(type);
}

/**
 * Blocks that show something other than flowing text (a picture, an attached
 * file, a table). Pictures and files have a caption as their text; a table's
 * text is unused (its cells hold the words).
 */
export const MEDIA_TYPES: readonly BlockType[] = ['image', 'file', 'table'];

export function isMedia(type: BlockType): boolean {
  return MEDIA_TYPES.includes(type);
}

/** Paragraph alignment; left is the default and never stored. */
export type Align = 'left' | 'center' | 'right' | 'justify';

/**
 * Named styles a block can have on top of its type, like Word's: paragraphs can
 * be Title, Subtitle, No Spacing, Epigraph, Caption or a Scene break; quotes can
 * be Intense. How each looks is set by the app's style sheet.
 */
export const BLOCK_STYLES: Partial<Record<BlockType, readonly string[]>> = {
  paragraph: ['nospacing', 'title', 'subtitle', 'epigraph', 'caption', 'scenebreak', 'toggle'],
  // Callouts (Notion's and Obsidian's): a quote in a coloured box with an icon.
  quote: ['intense', 'note', 'tip', 'warning', 'important'],
};

/** A style of the person's own (Word's New Style): `c-` and a name made from letters, figures and dashes. */
export const CUSTOM_STYLE = /^c-[a-z0-9][a-z0-9-]{0,39}$/;
/** Block types a style of one's own can be based on. */
const CUSTOM_TYPES: readonly BlockType[] = ['paragraph', 'heading1', 'heading2', 'heading3', 'heading4', 'quote'];

export function styleAllowed(type: BlockType, style: string): boolean {
  return !!BLOCK_STYLES[type]?.includes(style) || (CUSTOM_TYPES.includes(type) && CUSTOM_STYLE.test(style));
}

/**
 * A table of contents' settings, Word's Table of Contents dialog: the levels
 * of headings listed, its title, page numbers and dotted leaders. With
 * `kind` it's another list made from the text: a table of figures (captions
 * labelled `label`), an index (of index entries) or a bibliography (of the
 * sources cited).
 */
export interface TocLook {
  levels?: number;
  kind?: 'figures' | 'index' | 'sources';
  label?: string;
  title?: string;
  noPages?: boolean;
  noDots?: boolean;
}

export function tidyToc(t: Partial<TocLook> | undefined): TocLook | undefined {
  if (!t || typeof t !== 'object') return undefined;
  const out: TocLook = {};
  if (typeof t.levels === 'number' && Number.isFinite(t.levels) && t.levels !== 3) out.levels = Math.max(1, Math.min(4, Math.round(t.levels)));
  if (t.kind === 'figures' || t.kind === 'index' || t.kind === 'sources') out.kind = t.kind;
  if (out.kind === 'figures') out.label = typeof t.label === 'string' && /^[A-Za-z][\w ]{0,30}$/.test(t.label) ? t.label : 'Figure';
  if (typeof t.title === 'string' && t.title.trim()) out.title = t.title.replace(/["{}\n]/g, '').trim().slice(0, 60);
  if (t.noPages) out.noPages = true;
  if (t.noDots) out.noDots = true;
  return Object.keys(out).length ? out : undefined;
}

/** Block types that are list items: they can be indented, and Enter continues them. */
export const LIST_TYPES: readonly BlockType[] = ['todo', 'bullet', 'numbered'];
export const MAX_INDENT = 6;
/** Most columns a section can have. */
export const MAX_COLS = 4;

/** A toggle: a line whose content (the lines after it, up to a blank line or a heading) folds away under it. */
export function isToggle(b: Pick<Block, 'type' | 'style'>): boolean {
  return b.type === 'paragraph' && b.style === 'toggle';
}

/** Headings fold their sections; toggles fold their content. */
export function foldable(b: Pick<Block, 'type' | 'style'>): boolean {
  return isHeading(b.type) || isToggle(b);
}

/**
 * The blocks a heading or toggle folds away: a heading's section (up to the
 * next heading of the same level or higher), or a toggle's content (up to a
 * blank line, a heading or another toggle).
 */
export function foldedUnder(doc: { blocks: Block[] }, i: number): Block[] {
  const blk = doc.blocks[i];
  const out: Block[] = [];
  if (isToggle(blk)) {
    for (let j = i + 1; j < doc.blocks.length; j++) {
      const x = doc.blocks[j];
      if (isHeading(x.type) || isToggle(x) || (x.type === 'paragraph' && !x.runs.some((r) => r.text.trim()))) break;
      out.push(x);
    }
    return out;
  }
  const level = (t: BlockType) => (isHeading(t) ? Number(t.slice(-1)) : 99);
  const own = level(blk.type);
  for (let j = i + 1; j < doc.blocks.length && level(doc.blocks[j].type) > own; j++) out.push(doc.blocks[j]);
  return out;
}

export function isList(type: BlockType): boolean {
  return LIST_TYPES.includes(type);
}

import type { PicLook } from './picture';
import type { TableLook } from './table';
import type { ShapeLook } from './shape';

export interface BlockAttrs {
  type: BlockType;
  /** Checklist items only. */
  checked?: boolean;
  /** List items only; nesting level, 0 = not nested. */
  indent?: number;
  /** A named style (see BLOCK_STYLES). */
  style?: string;
  /** Alignment other than left. */
  align?: Align;
  /** Headings only: the section under it is folded away. */
  folded?: boolean;
  /** Tables only: the cells' text, row by row (the first row is the header). */
  rows?: string[][];
  /** Tables only: merged cells, shading, alignment, heading row, banding and lines (see table.ts). */
  tbl?: TableLook;
  /** Text boxes and shapes only (see shape.ts). */
  shape?: ShapeLook;
  /** Maths or a diagram. */
  code?: CodeLook;
  /** A table of contents' settings (or a table of figures, an index, a bibliography). */
  tocl?: TocLook;
  /** Track changes: the paragraph break before this block was added, or deleted (still there until accepted). */
  brk?: Change;
  /** Pictures only: size, wrapping, position, turn and alt text (see picture.ts). */
  pic?: PicLook;
  /** Pictures and files: where the file is (a path like "Attachments/abc-photo.jpg", or a web address). */
  src?: string;
  /** Spacing, indents and page breaks set on this paragraph by hand (Word's Paragraph settings). */
  para?: ParaLook;
}

/** Paragraph formatting set by hand, on top of the paragraph's style. */
export interface ParaLook {
  /** Line spacing, as a multiple (1 = single, 2 = double). */
  line?: number;
  /** Space before and after, in points. */
  before?: number;
  after?: number;
  /** Indents in inches; `first` is the first line's (negative: a hanging indent). */
  left?: number;
  right?: number;
  first?: number;
  /** Starts on a new page. */
  pageBefore?: boolean;
  /** Starts at the top of the next column (Word's column break). */
  colBefore?: boolean;
  /** Kept on the same page as the next paragraph; its lines kept together. */
  keepNext?: boolean;
  keepLines?: boolean;
  /** Numbered lists: how this level is numbered (Word's number library), and the number to start again from. */
  num?: NumFormat;
  start?: number;
  /** Bulleted lists: the bullet. */
  bullet?: BulletKind;
  /** Lines around the paragraph: any of t, b, l, r (top, bottom, left, right). */
  border?: string;
  /** The lines' style and colour (unset: a thin single line in the text's colour). */
  bstyle?: 'single' | 'double' | 'dotted' | 'dashed' | 'thick';
  bcolor?: string;
  /** Widow/orphan control off: a single line of it may sit alone at the foot or top of a page. */
  nowidow?: boolean;
  /**
   * Numbered lists: what the number looks like at this level (Word's number
   * format), %1 to %9 standing for the numbers at each level ("Chapter %1",
   * "%1.%2", "(%1)"); unset: the number and a full stop (or bracket).
   */
  numText?: string;
  /** Shading behind the paragraph, as #rrggbb. */
  shade?: string;
  /** Word's Drop Cap: the first letter is this many lines tall (2 to 10), dropped into the text. */
  drop?: number;
  /** Word's Add Text: in the table of contents at this level (1 to 4), or 0 for a heading kept out of it. */
  outline?: number;
  /** Tab stops, in order: where a tab in the paragraph takes the text after it (past them, every half inch). */
  tabs?: TabStop[];
  /**
   * The whole document's: on its first paragraph (as the first section's
   * settings are). Track changes for everyone who edits it ('all'), and
   * tracking locked: `lock` is a salted hash of the password ('open' when
   * locked without one).
   */
  track?: 'all';
  lock?: string;
  /**
   * A section break before this paragraph (Word's Breaks > Section Breaks):
   * the new section starts on a new page, or carries on down the same one.
   * The section's columns and orientation, when they change here.
   */
  sect?: 'page' | 'cont';
  cols?: number;
  orient?: 'portrait' | 'landscape';
  /** The section's margins, in inches, when they differ from the page setup's (top, bottom, left, right). */
  mt?: number;
  mb?: number;
  ml?: number;
  mr?: number;
}
export type ParaKey = keyof ParaLook;

/** A tab stop: `at` inches from the left margin; text after the tab starts there (left), is centred on it, ends there (right), or has its decimal point there. */
export interface TabStop {
  at: number;
  align: 'left' | 'center' | 'right' | 'decimal';
  /** What fills the gap: dots, dashes or a line (as in a table of contents). */
  leader?: 'dot' | 'dash' | 'line';
}
const TAB_ALIGNS = ['left', 'center', 'right', 'decimal'] as const;
const TAB_LEADERS = ['dot', 'dash', 'line'] as const;
/** Word's default tab stops: every half inch, past the paragraph's own. */
export const DEFAULT_TAB = 0.5;

/** Tab stops tidied: in order, each on its own spot, between 0 and 22 inches; undefined if none. */
export function tidyTabs(tabs: TabStop[] | undefined): TabStop[] | undefined {
  if (!Array.isArray(tabs)) return undefined;
  const out: TabStop[] = [];
  for (const t of tabs) {
    if (!t || !Number.isFinite(t.at) || t.at < 0 || t.at > 22) continue;
    const at = Math.round(t.at * 1000) / 1000;
    if (out.some((x) => Math.abs(x.at - at) < 0.01)) continue;
    const stop: TabStop = { at, align: (TAB_ALIGNS as readonly string[]).includes(t.align) ? t.align : 'left' };
    if (t.leader && (TAB_LEADERS as readonly string[]).includes(t.leader)) stop.leader = t.leader;
    out.push(stop);
  }
  out.sort((a, b) => a.at - b.at);
  return out.length ? out : undefined;
}

/** Tab stops written short, for Markdown: 1.5,c3,r6.5dot (left is plain, then c, r or d, then the leader). */
export function tabsToText(tabs: TabStop[]): string {
  return tabs.map((t) => `${t.align === 'left' ? '' : t.align[0]}${t.at}${t.leader ?? ''}`).join(',');
}

export function tabsFromText(text: string): TabStop[] | undefined {
  const out: TabStop[] = [];
  for (const part of text.split(',')) {
    const m = /^([lcrd]?)(\d+(?:\.\d+)?)(dot|dash|line)?$/.exec(part.trim());
    if (!m) continue;
    const align = ({ '': 'left', l: 'left', c: 'center', r: 'right', d: 'decimal' } as const)[m[1] as '' | 'l' | 'c' | 'r' | 'd'];
    out.push({ at: +m[2], align, ...(m[3] ? { leader: m[3] as TabStop['leader'] } : {}) });
  }
  return tidyTabs(out);
}
export const PARA_KEYS: ParaKey[] = ['line', 'before', 'after', 'left', 'right', 'first', 'pageBefore', 'colBefore', 'keepNext', 'keepLines', 'num', 'start', 'bullet', 'border', 'bstyle', 'bcolor', 'nowidow', 'numText', 'shade', 'drop', 'outline', 'tabs', 'track', 'lock', 'sect', 'cols', 'orient', 'mt', 'mb', 'ml', 'mr'];

/** Word's number library: 1. 1) A. a. I. i. and 1.1.1 (each level numbered from the one above). */
export const NUM_FORMATS = ['decimal', 'paren', 'upper-alpha', 'lower-alpha', 'upper-roman', 'lower-roman', 'legal'] as const;
export type NumFormat = (typeof NUM_FORMATS)[number];
/** Word's bullet library. */
export const BULLETS = { disc: '•', circle: '◦', square: '▪', dash: '–', arrow: '➢', check: '✓', diamond: '❖', star: '★' } as const;
export type BulletKind = keyof typeof BULLETS;

/** A paragraph border's sides, tidied to t, b, l, r in that order; '' when none. */
export function tidyBorder(sides: string | undefined): string {
  return ['t', 'b', 'l', 'r'].filter((c) => sides?.includes(c)).join('');
}

/** A paragraph look with nothing unset in it, or undefined if it's empty. */
export function tidyPara(p: ParaLook | undefined): ParaLook | undefined {
  if (!p) return undefined;
  const out: ParaLook = {};
  for (const k of PARA_KEYS) {
    const v = p[k];
    if (typeof v === 'number' && Number.isFinite(v)) (out as Record<string, unknown>)[k] = Math.round(v * 1000) / 1000;
    else if (v === true) (out as Record<string, unknown>)[k] = true;
  }
  if (out.start !== undefined) out.start = Math.max(0, Math.round(out.start));
  if (out.drop !== undefined) out.drop = Math.max(2, Math.min(10, Math.round(out.drop)));
  if (out.outline !== undefined) out.outline = Math.max(0, Math.min(4, Math.round(out.outline)));
  if (p.num && (NUM_FORMATS as readonly string[]).includes(p.num)) out.num = p.num;
  if (p.bullet && p.bullet in BULLETS) out.bullet = p.bullet;
  const border = tidyBorder(p.border);
  if (border) out.border = border;
  if (border && p.bstyle && ['single', 'double', 'dotted', 'dashed', 'thick'].includes(p.bstyle) && p.bstyle !== 'single') out.bstyle = p.bstyle;
  if (border && p.bcolor && /^#[0-9a-f]{6}$/i.test(p.bcolor)) out.bcolor = p.bcolor.toLowerCase();
  if (typeof p.numText === 'string' && /%[1-9]/.test(p.numText) && p.numText.length <= 40) out.numText = p.numText.replace(/["{}\n]/g, '');
  if (p.shade && /^#[0-9a-f]{6}$/i.test(p.shade)) out.shade = p.shade.toLowerCase();
  const tabs = tidyTabs(p.tabs);
  if (tabs) out.tabs = tabs;
  if (p.track === 'all') out.track = 'all';
  if (typeof p.lock === 'string' && /^(open|[0-9a-f]{16,128})$/.test(p.lock)) out.lock = p.lock;
  if (p.sect === 'page' || p.sect === 'cont') {
    out.sect = p.sect;
    if (out.cols !== undefined) out.cols = Math.max(1, Math.min(MAX_COLS, Math.round(out.cols)));
    if (p.orient === 'portrait' || p.orient === 'landscape') out.orient = p.orient;
    for (const k of ['mt', 'mb', 'ml', 'mr'] as const) if (out[k] !== undefined) out[k] = Math.max(0, Math.min(5, out[k]!));
  } else {
    delete out.cols;
    delete out.mt;
    delete out.mb;
    delete out.ml;
    delete out.mr;
  }
  return Object.keys(out).length ? out : undefined;
}

export function samePara(a: ParaLook | undefined, b: ParaLook | undefined): boolean {
  return PARA_KEYS.every((k) => (k === 'tabs' ? JSON.stringify(a?.tabs ?? null) === JSON.stringify(b?.tabs ?? null) : (a?.[k] ?? undefined) === (b?.[k] ?? undefined)));
}

export interface Block extends BlockAttrs {
  id: string;
  runs: Run[];
}

export interface Doc {
  blocks: Block[];
}

export interface Pos {
  block: string;
  offset: number;
}

export interface Selection {
  anchor: Pos;
  focus: Pos;
}

let idCounter = 0;
const idPrefix = Math.random().toString(36).slice(2, 6);
export function newId(): string {
  idCounter += 1;
  return `${idPrefix}${idCounter.toString(36)}`;
}

export function sortMarks(marks: Mark[]): Mark[] {
  return MARK_ORDER.filter((m) => marks.includes(m));
}

export function sameMarks(a: Mark[], b: Mark[]): boolean {
  return a.length === b.length && a.every((m, i) => m === b[i]);
}

export function runsLength(runs: Run[]): number {
  let n = 0;
  for (const r of runs) n += r.text.length;
  return n;
}

export function runsText(runs: Run[]): string {
  return runs.map((r) => r.text).join('');
}

/** A copy of `r` with different text, keeping its formatting and link. */
export function withText(r: Run, text: string): Run {
  const out: Run = { text, marks: r.marks };
  if (r.link) out.link = r.link;
  if (r.footnote !== undefined) out.footnote = r.footnote;
  if (r.field !== undefined) out.field = r.field;
  if (r.comment) out.comment = r.comment;
  if (r.change) out.change = r.change;
  const look = tidyLook(r.look);
  if (look) out.look = look;
  return out;
}

export function sameFormat(a: Run, b: Run): boolean {
  return sameMarks(a.marks, b.marks) && a.link === b.link && a.footnote === b.footnote && a.field === b.field && sameComment(a.comment, b.comment) && sameChange(a.change, b.change) && sameLook(a.look, b.look);
}

/** Drops empty runs and merges neighbours with identical formatting. */
export function normalizeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && sameFormat(last, r) && last.footnote === undefined && last.field === undefined) {
      out[out.length - 1] = withText(last, last.text + r.text);
    } else {
      out.push(withText({ ...r, marks: sortMarks(r.marks) }, r.text));
    }
  }
  return out;
}

export function sliceRuns(runs: Run[], from: number, to: number): Run[] {
  const out: Run[] = [];
  let pos = 0;
  for (const r of runs) {
    const end = pos + r.text.length;
    if (end > from && pos < to) {
      out.push(withText(r, r.text.slice(Math.max(0, from - pos), Math.min(r.text.length, to - pos))));
    }
    pos = end;
    if (pos >= to) break;
  }
  return normalizeRuns(out);
}

export function insertRuns(runs: Run[], offset: number, ins: Run[]): Run[] {
  const len = runsLength(runs);
  return normalizeRuns([...sliceRuns(runs, 0, offset), ...ins, ...sliceRuns(runs, offset, len)]);
}

export function removeRuns(runs: Run[], from: number, to: number): Run[] {
  const len = runsLength(runs);
  return normalizeRuns([...sliceRuns(runs, 0, from), ...sliceRuns(runs, to, len)]);
}

export function replaceRuns(runs: Run[], from: number, to: number, ins: Run[]): Run[] {
  const len = runsLength(runs);
  return normalizeRuns([...sliceRuns(runs, 0, from), ...ins, ...sliceRuns(runs, to, len)]);
}

/** Marks a character typed at `offset` should inherit: those of the character before it. */
export function marksAt(runs: Run[], offset: number): Mark[] {
  let pos = 0;
  for (const r of runs) {
    const end = pos + r.text.length;
    if (offset > pos && offset <= end) return r.marks;
    pos = end;
  }
  return runs.length && offset === 0 ? runs[0].marks.filter((m) => m !== 'code') : [];
}

/** Applies `mark` (on or off) to every run, keeping the text. */
export function setMarkOnRuns(runs: Run[], mark: Mark, on: boolean): Run[] {
  return normalizeRuns(
    runs.map((r) => ({
      ...r,
      marks: on ? sortMarks([...r.marks.filter((m) => m !== mark), mark]) : r.marks.filter((m) => m !== mark),
    })),
  );
}

/** Sets one part of the look (or, with null, takes it away) on every run, keeping the text and the rest. */
export function setLookOnRuns(runs: Run[], key: LookKey, value: string | number | null): Run[] {
  return normalizeRuns(runs.map((r) => ({ ...r, look: tidyLook({ ...r.look, [key]: value ?? undefined }) })));
}

/** Takes every look and mark away (Word's Clear Formatting), keeping links, comments and tracked changes. */
export function clearFormatOnRuns(runs: Run[]): Run[] {
  return normalizeRuns(runs.map((r) => ({ ...r, marks: [], look: undefined })));
}

/** The look a character typed at `offset` should take: that of the character before it. */
export function lookAt(runs: Run[], offset: number): Look | undefined {
  let pos = 0;
  for (const r of runs) {
    const end = pos + r.text.length;
    if (offset > pos && offset <= end) return r.look;
    pos = end;
  }
  return runs.length && offset === 0 ? runs[0].look : undefined;
}

/** The value of one part of the look shared by all these runs: undefined when it's mixed or unset. */
export function commonLook<K extends LookKey>(runs: Run[], key: K): Look[K] | undefined {
  const v = runs[0]?.look?.[key];
  return runs.every((r) => r.look?.[key] === v) ? v : undefined;
}

/** Sets (or, with null, removes) the link on every run, keeping the text and formatting. */
export function setLinkOnRuns(runs: Run[], link: string | null): Run[] {
  return normalizeRuns(runs.map((r) => withLink(r, link)));
}

/** A copy of `r` with a different link (or none). */
export function withLink(r: Run, link: string | null): Run {
  const out = withText({ text: r.text, marks: r.marks, footnote: r.footnote, field: r.field, comment: r.comment, change: r.change, look: r.look }, r.text);
  if (link) out.link = link;
  return out;
}

/** Sets (or, with null, removes) the comment on every run. */
export function setCommentOnRuns(runs: Run[], comment: Comment | null): Run[] {
  return normalizeRuns(
    runs.map((r) => {
      const out = withText({ text: r.text, marks: r.marks, link: r.link, footnote: r.footnote, field: r.field, change: r.change, look: r.look }, r.text);
      if (comment) out.comment = comment;
      return out;
    }),
  );
}

/** Sets (or, with null, removes) the tracked change on every run. */
export function setChangeOnRuns(runs: Run[], change: Change | null): Run[] {
  return normalizeRuns(
    runs.map((r) => {
      const out = withText({ text: r.text, marks: r.marks, link: r.link, footnote: r.footnote, field: r.field, comment: r.comment, look: r.look }, r.text);
      if (change) out.change = change;
      return out;
    }),
  );
}

/**
 * Every tracked change in the document: each stretch of text with one change
 * on it, and each paragraph break added or deleted (from -1 to 0, before its block).
 */
export function changes(doc: Doc): { change: Change; block: string; from: number; to: number; text: string }[] {
  const out: { change: Change; block: string; from: number; to: number; text: string }[] = [];
  for (const b of doc.blocks) {
    if (b.brk) out.push({ change: b.brk, block: b.id, from: -1, to: 0, text: '¶' });
    let pos = 0;
    for (const r of b.runs) {
      const end = pos + r.text.length;
      if (r.change) {
        const last = out[out.length - 1];
        if (last && last.block === b.id && last.to === pos && sameChange(last.change, r.change)) {
          last.to = end;
          last.text += r.text;
        } else out.push({ change: r.change, block: b.id, from: pos, to: end, text: r.text });
      }
      pos = end;
    }
  }
  return out;
}

/** The comment typed text at `offset` should join: only inside a commented stretch, not at its edge. */
export function commentAt(runs: Run[], offset: number): Comment | undefined {
  let pos = 0;
  let before: Comment | undefined;
  let after: Comment | undefined;
  for (const r of runs) {
    const end = pos + r.text.length;
    if (offset > pos && offset <= end) before = r.comment;
    if (offset >= pos && offset < end) after = r.comment;
    pos = end;
  }
  return before && after && before.id === after.id ? before : undefined;
}

/** Every comment in the document, once each, in order of where it starts. */
export function comments(doc: Doc): { comment: Comment; block: string; offset: number; quote: string }[] {
  const out = new Map<string, { comment: Comment; block: string; offset: number; quote: string }>();
  for (const b of doc.blocks) {
    let pos = 0;
    for (const r of b.runs) {
      if (r.comment) {
        const seen = out.get(r.comment.id);
        if (seen) seen.quote += (seen.block === b.id ? '' : ' ') + r.text.replaceAll(FOOTNOTE, '');
        else out.set(r.comment.id, { comment: r.comment, block: b.id, offset: pos, quote: r.text.replaceAll(FOOTNOTE, '') });
      }
      pos += r.text.length;
    }
  }
  return [...out.values()];
}

/** The link shared by every run, or null if they differ or have none. */
export function commonLink(runs: Run[]): string | null {
  const first = runs[0]?.link;
  return first && runs.every((r) => r.link === first) ? first : null;
}

/** The link typed text at `offset` should join: only when it lands inside a link, not at its edge. */
export function linkAt(runs: Run[], offset: number): string | undefined {
  let pos = 0;
  let before: string | undefined;
  let after: string | undefined;
  for (const r of runs) {
    const end = pos + r.text.length;
    if (offset > pos && offset <= end) before = r.link;
    if (offset >= pos && offset < end) after = r.link;
    pos = end;
  }
  return before && before === after ? before : undefined;
}

/**
 * Turns what someone typed or pasted into a safe link target, or null if it isn't one.
 * Bare domains get https://; only http(s) and mailto are allowed.
 */
export function normalizeLink(input: string): string | null {
  const t = input.trim();
  if (!t || /\s/.test(t)) return null;
  if (/^mailto:[^@\s]+@[^@\s]+$/i.test(t)) return t;
  // A bookmark in the same document.
  if (/^#bm:[A-Za-z_][\w-]{0,39}$/.test(t)) return t;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : /^(www\.|[a-z0-9-]+(\.[a-z0-9-]+)+)(\/|$|:)/i.test(t) ? `https://${t}` : null;
  if (!withScheme) return null;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function blockIndex(doc: Doc, id: string): number {
  const i = doc.blocks.findIndex((b) => b.id === id);
  if (i < 0) throw new Error(`No block ${id}`);
  return i;
}

export function getBlock(doc: Doc, id: string): Block {
  return doc.blocks[blockIndex(doc, id)];
}

export function comparePos(doc: Doc, a: Pos, b: Pos): number {
  if (a.block === b.block) return a.offset - b.offset;
  return blockIndex(doc, a.block) - blockIndex(doc, b.block);
}

export function orderedRange(doc: Doc, sel: Selection): { from: Pos; to: Pos } {
  return comparePos(doc, sel.anchor, sel.focus) <= 0
    ? { from: sel.anchor, to: sel.focus }
    : { from: sel.focus, to: sel.anchor };
}

export function isCollapsed(sel: Selection): boolean {
  return sel.anchor.block === sel.focus.block && sel.anchor.offset === sel.focus.offset;
}

export function caret(pos: Pos): Selection {
  return { anchor: pos, focus: pos };
}

export function makeBlock(type: BlockType, text = '', marks: Mark[] = [], extra: Partial<Block> = {}): Block {
  const block: Block = { id: newId(), type, runs: text ? [{ text, marks: sortMarks(marks) }] : [], ...extra };
  if (type === 'todo') block.checked = !!block.checked;
  if (!isList(type) || !block.indent) delete block.indent;
  if (!block.style || !styleAllowed(type, block.style)) delete block.style;
  if (!block.align || block.align === 'left') delete block.align;
  if ((type !== 'image' && type !== 'file') || !block.src) delete block.src;
  if (type !== 'table' || !block.rows) delete block.rows;
  if (type !== 'table' || !block.tbl) delete block.tbl;
  if (type !== 'toc' || !block.tocl) delete block.tocl;
  if (type !== 'shape' || !block.shape) delete block.shape;
  if (type !== 'code' || !block.code) delete block.code;
  if (!foldable(block) || !block.folded) delete block.folded;
  if (!block.brk) delete block.brk;
  return block;
}

/** True if two documents have the same blocks, attributes, text and formatting. */
export function docsEqual(a: Doc, b: Doc): boolean {
  if (a === b) return true;
  if (a.blocks.length !== b.blocks.length) return false;
  return a.blocks.every((x, i) => {
    const y = b.blocks[i];
    if (x === y) return true;
    if (x.id !== y.id || x.type !== y.type || !!x.checked !== !!y.checked || (x.indent ?? 0) !== (y.indent ?? 0) || (x.style ?? '') !== (y.style ?? '') || (x.align ?? 'left') !== (y.align ?? 'left') || (x.src ?? '') !== (y.src ?? '') || !!x.folded !== !!y.folded || !sameChange(x.brk, y.brk) || JSON.stringify(x.rows ?? null) !== JSON.stringify(y.rows ?? null) || JSON.stringify(x.tbl ?? null) !== JSON.stringify(y.tbl ?? null) || JSON.stringify(x.shape ?? null) !== JSON.stringify(y.shape ?? null) || JSON.stringify(x.code ?? null) !== JSON.stringify(y.code ?? null) || JSON.stringify(x.tocl ?? null) !== JSON.stringify(y.tocl ?? null) || x.runs.length !== y.runs.length) return false;
    return x.runs.every((r, j) => r.text === y.runs[j].text && sameFormat(r, y.runs[j]));
  });
}

/** A table's rows with every row the same width, at least one row and column. */
export function tidyRows(rows: string[][] | undefined): string[][] {
  const list = rows?.length ? rows : [['']];
  const width = Math.max(1, ...list.map((r) => r.length));
  return list.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').replace(/[\r\n]+/g, ' ')));
}

/** Every footnote in the document, in order: where it is and what it says. */
export function footnotes(doc: Doc): { block: string; offset: number; text: string }[] {
  const out: { block: string; offset: number; text: string }[] = [];
  for (const b of doc.blocks) {
    let pos = 0;
    for (const r of b.runs) {
      if (r.footnote !== undefined) out.push({ block: b.id, offset: pos, text: r.footnote });
      pos += r.text.length;
    }
  }
  return out;
}

// ---------------------------------------------------------------- list numbers

const DEFAULT_NUMS: NumFormat[] = ['decimal', 'lower-alpha', 'lower-roman'];

function alpha(n: number): string {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(97 + ((x - 1) % 26)) + s;
  return s || '0';
}

function roman(n: number): string {
  if (n <= 0 || n >= 4000) return String(n);
  const parts: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let s = '';
  for (const [v, r] of parts) for (; n >= v; n -= v) s += r;
  return s;
}

/**
 * The number each numbered list item shows ("3.", "b.", "iv.", "1.2"): a
 * numbered item counts at its level and starts the levels below it again;
 * a bulleted item starts its level again, and anything else every level.
 */
export function listLabels(blocks: Block[]): Map<string, string> {
  const out = new Map<string, string>();
  let counts: number[] = [];
  /** The number style each level was last seen in (for patterns showing the levels above). */
  const formats: string[] = [];
  for (const b of blocks) {
    const level = Math.min(MAX_INDENT, b.indent ?? 0);
    if (b.type === 'numbered') {
      counts[level] = b.para?.start !== undefined ? b.para.start : (counts[level] ?? 0) + 1;
      counts = counts.slice(0, level + 1);
      const fmt = b.para?.num ?? DEFAULT_NUMS[level % 3];
      formats[level] = fmt;
      const show = (k: number, f: string) => {
        const v = counts[k] ?? 0;
        return f === 'upper-alpha' ? alpha(v).toUpperCase() : f === 'lower-alpha' ? alpha(v) : f === 'upper-roman' ? roman(v).toUpperCase() : f === 'lower-roman' ? roman(v) : String(v);
      };
      // A pattern of its own ("Chapter %1", "%1.%2"): each level's number in that level's style (all in plain figures when the level is legal, "Section 1.01").
      if (b.para?.numText) out.set(b.id, b.para.numText.replace(/%([1-9])/g, (_, d) => (Number(d) - 1 <= level ? show(Number(d) - 1, Number(d) - 1 === level || fmt === 'legal' ? fmt : (formats[Number(d) - 1] ?? 'decimal')) : '')));
      else if (fmt === 'legal') out.set(b.id, Array.from({ length: level + 1 }, (_, i) => counts[i] ?? 0).join('.') + (level === 0 ? '.' : ''));
      else out.set(b.id, show(level, fmt) + (fmt === 'paren' ? ')' : '.'));
    } else if (isList(b.type)) counts = counts.slice(0, level);
    else counts = [];
  }
  return out;
}

/** The index of the block that starts the section block `i` is in (0 for the first section). */
export function sectionStart(blocks: Block[], i: number): number {
  for (let k = Math.min(i, blocks.length - 1); k > 0; k--) if (blocks[k].para?.sect) return k;
  return 0;
}

/** A section's columns and orientation, as they come out after every break before it (undefined orientation: the page setup's). */
export interface SectionLook {
  cols: number;
  orient?: 'portrait' | 'landscape';
  /** Margins in inches (unset: the page setup's). */
  margins: { top?: number; bottom?: number; left?: number; right?: number };
  /** How the section starts (the first section: 'page'). */
  start: 'page' | 'cont';
  /** It's the document's first section. */
  first: boolean;
}

export function sectionLook(blocks: Block[], i: number): SectionLook {
  let cols = 1;
  let orient: 'portrait' | 'landscape' | undefined;
  const margins: SectionLook['margins'] = {};
  const start = sectionStart(blocks, i);
  for (let k = 0; k <= start; k++) {
    const p = blocks[k].para;
    if (!p?.sect) continue;
    if (p.cols) cols = p.cols;
    if (p.orient) orient = p.orient;
    if (p.mt !== undefined) margins.top = p.mt;
    if (p.mb !== undefined) margins.bottom = p.mb;
    if (p.ml !== undefined) margins.left = p.ml;
    if (p.mr !== undefined) margins.right = p.mr;
  }
  return { cols, orient, margins, start: start > 0 && blocks[start].para?.sect === 'cont' ? 'cont' : 'page', first: start === 0 };
}
