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
}

/** The character a footnote's marker stands on in the text (invisible; the number is drawn instead). */
export const FOOTNOTE = '\u2063';

export type BlockType = 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'todo' | 'bullet' | 'numbered' | 'quote' | 'image' | 'file' | 'table';

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
  paragraph: ['nospacing', 'title', 'subtitle', 'epigraph', 'caption', 'scenebreak'],
  quote: ['intense'],
};

export function styleAllowed(type: BlockType, style: string): boolean {
  return !!BLOCK_STYLES[type]?.includes(style);
}

/** Block types that are list items: they can be indented, and Enter continues them. */
export const LIST_TYPES: readonly BlockType[] = ['todo', 'bullet', 'numbered'];
export const MAX_INDENT = 6;

export function isList(type: BlockType): boolean {
  return LIST_TYPES.includes(type);
}

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
  /** Pictures and files: where the file is (a path like "Attachments/abc-photo.jpg", or a web address). */
  src?: string;
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
  return out;
}

export function sameFormat(a: Run, b: Run): boolean {
  return sameMarks(a.marks, b.marks) && a.link === b.link && a.footnote === b.footnote;
}

/** Drops empty runs and merges neighbours with identical formatting. */
export function normalizeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && sameFormat(last, r) && last.footnote === undefined) {
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

/** Sets (or, with null, removes) the link on every run, keeping the text and formatting. */
export function setLinkOnRuns(runs: Run[], link: string | null): Run[] {
  return normalizeRuns(runs.map((r) => withLink(r, link)));
}

/** A copy of `r` with a different link (or none). */
export function withLink(r: Run, link: string | null): Run {
  const out = withText({ text: r.text, marks: r.marks, footnote: r.footnote }, r.text);
  if (link) out.link = link;
  return out;
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
  if (!isHeading(type) || !block.folded) delete block.folded;
  return block;
}

/** True if two documents have the same blocks, attributes, text and formatting. */
export function docsEqual(a: Doc, b: Doc): boolean {
  if (a === b) return true;
  if (a.blocks.length !== b.blocks.length) return false;
  return a.blocks.every((x, i) => {
    const y = b.blocks[i];
    if (x === y) return true;
    if (x.id !== y.id || x.type !== y.type || !!x.checked !== !!y.checked || (x.indent ?? 0) !== (y.indent ?? 0) || (x.style ?? '') !== (y.style ?? '') || (x.align ?? 'left') !== (y.align ?? 'left') || (x.src ?? '') !== (y.src ?? '') || !!x.folded !== !!y.folded || JSON.stringify(x.rows ?? null) !== JSON.stringify(y.rows ?? null) || x.runs.length !== y.runs.length) return false;
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
