// Document model: a flat list of blocks, each holding runs of marked text.
// Everything here is immutable: an edit returns new objects for what changed
// and reuses the rest, so the view can tell changed blocks apart by identity.

export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code';
export const MARK_ORDER: Mark[] = ['bold', 'italic', 'underline', 'strike', 'code'];

export interface Run {
  text: string;
  marks: Mark[]; // always sorted by MARK_ORDER, no duplicates
}

export type BlockType = 'paragraph' | 'heading1' | 'heading2' | 'todo' | 'quote';

export interface BlockAttrs {
  type: BlockType;
  checked?: boolean;
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

/** Drops empty runs and merges neighbours with identical marks. */
export function normalizeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && sameMarks(last.marks, r.marks)) {
      out[out.length - 1] = { text: last.text + r.text, marks: last.marks };
    } else {
      out.push({ text: r.text, marks: sortMarks(r.marks) });
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
      out.push({ text: r.text.slice(Math.max(0, from - pos), Math.min(r.text.length, to - pos)), marks: r.marks });
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
      text: r.text,
      marks: on ? sortMarks([...r.marks.filter((m) => m !== mark), mark]) : r.marks.filter((m) => m !== mark),
    })),
  );
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
  return block;
}
