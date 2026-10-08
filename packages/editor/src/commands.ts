// Editing commands. Each takes the editor state and returns a transaction:
// the ops to apply plus where the selection should end up. They never touch
// the DOM, so they can be tested directly.

import {
  type Align,
  type Block,
  type BlockType,
  type Doc,
  type Mark,
  type Pos,
  type Run,
  type Selection,
  caret,
  getBlock,
  blockIndex,
  isCollapsed,
  isList,
  isMedia,
  isHeading,
  commonLink,
  linkAt,
  normalizeLink,
  setLinkOnRuns,
  marksAt,
  lookAt,
  commonLook,
  setLookOnRuns,
  tidyLook,
  tidyPara,
  MAX_INDENT,
  type ParaLook,
  type ParaKey,
  sameFormat,
  LOOK_KEYS,
  MARK_ORDER,
  type Look,
  type LookKey,
  newId,
  orderedRange,
  runsLength,
  runsText,
  setMarkOnRuns,
  sliceRuns,
  sortMarks,
  FOOTNOTE,
  type Comment,
  commentAt,
  setCommentOnRuns,
  type Change,
  makeChange,
  setChangeOnRuns,
  sectionStart,
  foldedUnder,
  foldable,
  isWidget,
  type CodeLook,
  tidyCode,
} from './model';
import { type Op, applyOp, applyOps, attrsOf, blockAttrs, sameAttrs } from './ops';
import type { BlockAttrs, BulletKind, NumFormat } from './model';
import type { TableLook } from './table';
import { type ShapeKind, type ShapeLook, defaultShape, tidyShape } from './shape';

export interface EditorState {
  doc: Doc;
  selection: Selection;
  /** Marks toggled with a collapsed selection, applied to the next typed text. */
  storedMarks: Mark[] | null;
  /** Likewise a font, size or colour chosen with nothing selected. */
  storedLook?: Look | null;
}

export interface Transaction {
  ops: Op[];
  selectionBefore: Selection;
  selectionAfter: Selection;
  storedMarks?: Mark[] | null;
  storedLook?: Look | null;
  /** Lets history merge consecutive typing into one undo step. */
  kind?: 'typing' | 'delete' | 'other';
}

/** Builds a transaction while applying each op, so later steps see the updated doc. */
class Builder {
  ops: Op[] = [];
  constructor(public doc: Doc) {}
  step(op: Op): this {
    this.doc = applyOp(this.doc, op);
    this.ops.push(op);
    return this;
  }
}

function tx(state: EditorState, b: Builder, selectionAfter: Selection, extra: Partial<Transaction> = {}): Transaction {
  return { ops: b.ops, selectionBefore: state.selection, selectionAfter, kind: 'other', ...extra };
}

/** Removes everything between two positions (in document order), joining blocks. Returns the collapsed position. */
function deleteRange(b: Builder, from: Pos, to: Pos): Pos {
  if (from.block === to.block) {
    if (to.offset > from.offset) {
      const runs = sliceRuns(getBlock(b.doc, from.block).runs, from.offset, to.offset);
      b.step({ type: 'remove', block: from.block, offset: from.offset, runs });
    }
    return from;
  }
  const first = getBlock(b.doc, from.block);
  const firstLen = runsLength(first.runs);
  if (firstLen > from.offset) {
    b.step({ type: 'remove', block: first.id, offset: from.offset, runs: sliceRuns(first.runs, from.offset, firstLen) });
  }
  const last = getBlock(b.doc, to.block);
  if (to.offset > 0) {
    b.step({ type: 'remove', block: last.id, offset: 0, runs: sliceRuns(last.runs, 0, to.offset) });
  }
  // Empty and join every block after `from` up to and including `to`.
  for (;;) {
    const i = blockIndex(b.doc, from.block);
    const next = b.doc.blocks[i + 1];
    const isLast = next.id === to.block;
    if (!isLast && runsLength(next.runs) > 0) {
      b.step({ type: 'remove', block: next.id, offset: 0, runs: next.runs });
    }
    const after = getBlock(b.doc, next.id);
    b.step({
      type: 'join',
      block: from.block,
      second: next.id,
      offset: runsLength(getBlock(b.doc, from.block).runs),
      secondAttrs: attrsOf(after),
    });
    if (isLast) break;
  }
  return from;
}

export function deleteSelection(state: EditorState): Transaction | null {
  if (isCollapsed(state.selection)) return null;
  const b = new Builder(state.doc);
  const { from, to } = orderedRange(state.doc, state.selection);
  const at = deleteRange(b, from, to);
  return tx(state, b, caret(at), { kind: 'delete' });
}

const MARKDOWN_PREFIXES: [string, BlockType, boolean?][] = [
  ['#', 'heading1'],
  ['##', 'heading2'],
  ['###', 'heading3'],
  ['####', 'heading4'],
  ['[]', 'todo', false],
  ['[ ]', 'todo', false],
  ['[x]', 'todo', true],
  ['-', 'bullet'],
  ['*', 'bullet'],
  ['1.', 'numbered'],
  ['>', 'quote'],
];

export function insertText(state: EditorState, text: string): Transaction {
  const b = new Builder(state.doc);
  const { from, to } = orderedRange(state.doc, state.selection);
  const at = deleteRange(b, from, to);
  const block = getBlock(b.doc, at.block);
  const marks = state.storedMarks ?? marksAt(block.runs, at.offset);
  const look = state.storedLook !== undefined && state.storedLook !== null ? state.storedLook : lookAt(block.runs, at.offset);
  // Typing inside a link keeps it linked; typing at its edge does not extend it.
  const link = linkAt(block.runs, at.offset);
  const comment = commentAt(block.runs, at.offset);
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let pos = at;
  lines.forEach((line, n) => {
    if (n > 0) pos = splitAt(b, pos);
    if (line) {
      const run: Run = link && n === 0 ? { text: line, marks: sortMarks(marks), link } : { text: line, marks: sortMarks(marks) };
      if (comment && n === 0) run.comment = comment;
      if (look) run.look = look;
      b.step({ type: 'insert', block: pos.block, offset: pos.offset, runs: [run] });
      pos = { block: pos.block, offset: pos.offset + line.length };
    }
  });
  return tx(state, b, caret(pos), { kind: lines.length === 1 && text.length <= 2 ? 'typing' : 'other', storedMarks: null, storedLook: null });
}

/** Markdown-style shortcut: typing "# " etc. at the start of a paragraph turns it into that block type. */
export function markdownShortcut(state: EditorState): Transaction | null {
  if (!isCollapsed(state.selection)) return null;
  const pos = state.selection.focus;
  const block = getBlock(state.doc, pos.block);
  if (block.type !== 'paragraph') return null;
  const before = runsText(block.runs).slice(0, pos.offset);
  if (!before.endsWith(' ')) return null;
  const prefix = before.slice(0, -1);
  const match = MARKDOWN_PREFIXES.find(([p]) => p === prefix);
  if (!match) return null;
  const [, type, checked] = match;
  const b = new Builder(state.doc);
  b.step({ type: 'remove', block: block.id, offset: 0, runs: sliceRuns(block.runs, 0, pos.offset) });
  b.step({ type: 'setAttrs', block: block.id, from: attrsOf(block), to: blockAttrs(type, checked) });
  return tx(state, b, caret({ block: block.id, offset: 0 }));
}

/** Styles whose next paragraph (after Enter at the end) is plain body text, as in Word. */
const ENDS_ON_ENTER = new Set(['title', 'subtitle', 'caption', 'scenebreak', 'epigraph', 'toggle']);

/**
 * What Enter at the end of a block creates: lists, quotes and body text carry
 * on in the same style and alignment; headings, titles and the like are
 * followed by body text.
 */
function nextBlockAttrs(block: Block) {
  if (isMedia(block.type) || isWidget(block.type)) return blockAttrs('paragraph');
  if (isList(block.type)) return { ...blockAttrs(block.type, false, block.indent), ...(block.align ? { align: block.align } : {}) };
  if (isHeading(block.type) || (block.style && ENDS_ON_ENTER.has(block.style))) return blockAttrs('paragraph');
  return { ...attrsOf(block), checked: undefined, brk: undefined };
}

function splitAt(b: Builder, pos: Pos): Pos {
  const block = getBlock(b.doc, pos.block);
  const atEnd = pos.offset === runsLength(block.runs);
  // Text after the caret in a caption becomes a paragraph of its own, not another picture.
  // A new paragraph carries on the spacing and indents of the one before (not a page break, nor after a heading).
  const carried = isHeading(block.type) || isMedia(block.type) ? undefined : tidyPara({ ...block.para, pageBefore: undefined, colBefore: undefined, start: undefined, sect: undefined, cols: undefined, orient: undefined, mt: undefined, mb: undefined, ml: undefined, mr: undefined });
  const newAttrs = atEnd ? { ...nextBlockAttrs(block), para: carried } : isMedia(block.type) ? blockAttrs('paragraph') : attrsOf({ ...block, checked: false, brk: undefined, para: carried });
  const newBlock = newId();
  b.step({ type: 'split', block: block.id, offset: pos.offset, newBlock, newAttrs });
  // Enter at the very start of a heading keeps the heading below and leaves an empty paragraph above.
  if (!atEnd && pos.offset === 0 && isHeading(block.type)) {
    b.step({ type: 'setAttrs', block: block.id, from: attrsOf(block), to: blockAttrs('paragraph') });
  }
  return { block: newBlock, offset: 0 };
}

export function splitBlock(state: EditorState): Transaction {
  const b = new Builder(state.doc);
  const { from, to } = orderedRange(state.doc, state.selection);
  const at = deleteRange(b, from, to);
  let block = getBlock(b.doc, at.block);
  // Enter on a folded heading opens its section first, so the new line isn't hidden.
  if (block.folded) {
    b.step({ type: 'setAttrs', block: block.id, from: attrsOf(block), to: attrsOf({ ...block, folded: false }) });
    block = getBlock(b.doc, at.block);
  }
  // Enter on an empty list item moves it out one level, and out of the list at the top level.
  // On an empty quote or heading it turns back into a paragraph instead of adding another.
  if (block.type !== 'paragraph' && !isMedia(block.type) && !isWidget(block.type) && runsLength(block.runs) === 0) {
    const to = isList(block.type) && block.indent ? blockAttrs(block.type, false, block.indent - 1) : blockAttrs('paragraph');
    b.step({ type: 'setAttrs', block: block.id, from: attrsOf(block), to });
    return tx(state, b, caret(at));
  }
  return tx(state, b, caret(splitAt(b, at)));
}

/** Backspace at the start of a block: first drop its type, then join it to the previous block. */
export function joinBackward(state: EditorState): Transaction | null {
  const pos = state.selection.focus;
  if (!isCollapsed(state.selection) || pos.offset !== 0) return null;
  const b = new Builder(state.doc);
  const block = getBlock(state.doc, pos.block);
  if (block.type !== 'paragraph') {
    b.step({ type: 'setAttrs', block: block.id, from: attrsOf(block), to: blockAttrs('paragraph') });
    return tx(state, b, state.selection);
  }
  const i = blockIndex(state.doc, block.id);
  if (i === 0) return tx(state, b, state.selection);
  const prev = state.doc.blocks[i - 1];
  const prevLen = runsLength(prev.runs);
  // After a picture, Backspace moves into its caption rather than pulling the text in (an empty line just goes).
  if (isMedia(prev.type) && runsLength(block.runs)) return tx(state, b, caret({ block: prev.id, offset: prevLen }));
  b.step({ type: 'join', block: prev.id, second: block.id, offset: prevLen, secondAttrs: attrsOf(block) });
  return tx(state, b, caret({ block: prev.id, offset: prevLen }), { kind: 'delete' });
}

/** Delete at the end of a block: pull the next block up into this one. */
export function joinForward(state: EditorState): Transaction | null {
  const pos = state.selection.focus;
  const block = getBlock(state.doc, pos.block);
  const len = runsLength(block.runs);
  if (!isCollapsed(state.selection) || pos.offset !== len) return null;
  const i = blockIndex(state.doc, block.id);
  const b = new Builder(state.doc);
  const next = state.doc.blocks[i + 1];
  // A picture below isn't pulled up into the text.
  if (!next || isMedia(next.type)) return tx(state, b, state.selection);
  b.step({ type: 'join', block: block.id, second: next.id, offset: len, secondAttrs: attrsOf(next) });
  return tx(state, b, state.selection, { kind: 'delete' });
}

/** Deletes an explicit range (from the browser's target ranges or our own grapheme logic). */
export function deleteBetween(state: EditorState, a: Pos, c: Pos): Transaction {
  const b = new Builder(state.doc);
  const range = orderedRange(state.doc, { anchor: a, focus: c });
  const at = deleteRange(b, range.from, range.to);
  return tx(state, b, caret(at), { kind: 'delete' });
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** Offset one grapheme (user-perceived character) before/after `offset`. */
export function graphemeStep(text: string, offset: number, dir: -1 | 1): number {
  if (!segmenter) return Math.max(0, Math.min(text.length, offset + dir));
  let prev = 0;
  for (const { index } of segmenter.segment(text)) {
    if (dir === 1 && index > offset) return index;
    if (dir === -1 && index >= offset) return prev;
    prev = index;
  }
  return dir === 1 ? text.length : prev;
}

export function deleteChar(state: EditorState, dir: -1 | 1): Transaction | null {
  if (!isCollapsed(state.selection)) return deleteSelection(state);
  const pos = state.selection.focus;
  const block = getBlock(state.doc, pos.block);
  const text = runsText(block.runs);
  if (dir === -1 && pos.offset === 0) return joinBackward(state);
  if (dir === 1 && pos.offset === text.length) return joinForward(state);
  const other = graphemeStep(text, pos.offset, dir);
  return deleteBetween(state, pos, { block: pos.block, offset: other });
}

/** Every block touched by the selection, with the offsets inside each. */
function selectedSpans(doc: Doc, sel: Selection): { id: string; from: number; to: number }[] {
  const { from, to } = orderedRange(doc, sel);
  const start = blockIndex(doc, from.block);
  const end = blockIndex(doc, to.block);
  const out = [];
  for (let i = start; i <= end; i++) {
    const blk = doc.blocks[i];
    const len = runsLength(blk.runs);
    out.push({ id: blk.id, from: i === start ? from.offset : 0, to: i === end ? to.offset : len });
  }
  return out;
}

export function markActive(state: EditorState, mark: Mark): boolean {
  if (isCollapsed(state.selection)) {
    const pos = state.selection.focus;
    return (state.storedMarks ?? marksAt(getBlock(state.doc, pos.block).runs, pos.offset)).includes(mark);
  }
  const spans = selectedSpans(state.doc, state.selection).filter((s) => s.to > s.from);
  return spans.length > 0 && spans.every((s) => sliceRuns(getBlock(state.doc, s.id).runs, s.from, s.to).every((r) => r.marks.includes(mark)));
}

export function toggleMark(state: EditorState, mark: Mark): Transaction {
  const on = !markActive(state, mark);
  const b = new Builder(state.doc);
  if (isCollapsed(state.selection)) {
    const pos = state.selection.focus;
    const current = state.storedMarks ?? marksAt(getBlock(state.doc, pos.block).runs, pos.offset);
    const next = on ? sortMarks([...current, mark]) : current.filter((m) => m !== mark);
    return tx(state, b, state.selection, { storedMarks: next });
  }
  for (const s of selectedSpans(state.doc, state.selection)) {
    if (s.to <= s.from) continue;
    const before: Run[] = sliceRuns(getBlock(b.doc, s.id).runs, s.from, s.to);
    const after = setMarkOnRuns(before, mark, on);
    b.step({ type: 'format', block: s.id, offset: s.from, before, after, mark, on });
  }
  return tx(state, b, state.selection);
}

/** One part of the look where the caret is, or shared by all the selected text (undefined when mixed or unset). */
export function lookValue<K extends LookKey>(state: EditorState, key: K): Look[K] | undefined {
  if (isCollapsed(state.selection)) {
    const pos = state.selection.focus;
    const stored = state.storedLook;
    return (stored ?? lookAt(getBlock(state.doc, pos.block).runs, pos.offset))?.[key];
  }
  const runs = selectedSpans(state.doc, state.selection)
    .filter((s) => s.to > s.from)
    .flatMap((s) => sliceRuns(getBlock(state.doc, s.id).runs, s.from, s.to));
  return runs.length ? commonLook(runs, key) : undefined;
}

/** Sets one part of the look (font, size, colour, highlight, raised/lowered) on the selection, or for the next typing. */
export function setLook(state: EditorState, key: LookKey, value: string | number | null): Transaction {
  const b = new Builder(state.doc);
  if (isCollapsed(state.selection)) {
    const pos = state.selection.focus;
    const current = state.storedLook ?? lookAt(getBlock(state.doc, pos.block).runs, pos.offset);
    return tx(state, b, state.selection, { storedLook: tidyLook({ ...current, [key]: value ?? undefined }) ?? {} });
  }
  for (const s of selectedSpans(state.doc, state.selection)) {
    if (s.to <= s.from) continue;
    const before = sliceRuns(getBlock(b.doc, s.id).runs, s.from, s.to);
    const after = setLookOnRuns(before, key, value);
    if (!sameRunsFormat(before, after)) b.step({ type: 'format', block: s.id, offset: s.from, before, after, look: key, value });
  }
  return tx(state, b, state.selection);
}

function sameRunsFormat(a: Run[], b: Run[]): boolean {
  return a.length === b.length && a.every((r, i) => r.text === b[i].text && sameFormat(r, b[i]));
}

/** Word's Clear Formatting: bold, italic and the rest, fonts, sizes and colours all taken off the selection. */
export function clearFormatting(state: EditorState): Transaction {
  const b = new Builder(state.doc);
  if (isCollapsed(state.selection)) return tx(state, b, state.selection, { storedMarks: [], storedLook: {} });
  for (const s of selectedSpans(state.doc, state.selection)) {
    if (s.to <= s.from) continue;
    for (const mark of MARK_ORDER) {
      const before = sliceRuns(getBlock(b.doc, s.id).runs, s.from, s.to);
      if (!before.some((r) => r.marks.includes(mark))) continue;
      b.step({ type: 'format', block: s.id, offset: s.from, before, after: setMarkOnRuns(before, mark, false), mark, on: false });
    }
    for (const key of LOOK_KEYS) {
      const before = sliceRuns(getBlock(b.doc, s.id).runs, s.from, s.to);
      if (!before.some((r) => r.look?.[key] !== undefined)) continue;
      b.step({ type: 'format', block: s.id, offset: s.from, before, after: setLookOnRuns(before, key, null), look: key, value: null });
    }
  }
  return tx(state, b, state.selection);
}

export type CaseChange = 'upper' | 'lower' | 'title' | 'sentence' | 'toggle';

function recase(text: string, how: CaseChange, startOfSentence: boolean): string {
  switch (how) {
    case 'upper':
      return text.toLocaleUpperCase();
    case 'lower':
      return text.toLocaleLowerCase();
    case 'toggle':
      return [...text].map((c) => (c === c.toLocaleUpperCase() ? c.toLocaleLowerCase() : c.toLocaleUpperCase())).join('');
    case 'title':
      return text.toLocaleLowerCase().replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_, a: string, c: string) => a + c.toLocaleUpperCase());
    case 'sentence': {
      let start = startOfSentence;
      return [...text.toLocaleLowerCase()]
        .map((c) => {
          if (start && /\p{L}/u.test(c)) {
            start = false;
            return c.toLocaleUpperCase();
          }
          if (/[.!?]/.test(c)) start = true;
          return c;
        })
        .join('');
    }
  }
}

/** Word's Change Case on the selected text, keeping its formatting. */
export function changeCase(state: EditorState, how: CaseChange): Transaction {
  const b = new Builder(state.doc);
  const { from, to } = orderedRange(state.doc, state.selection);
  let focusEnd = to;
  for (const s of selectedSpans(state.doc, state.selection)) {
    if (s.to <= s.from) continue;
    const runs = getBlock(b.doc, s.id).runs;
    const before = sliceRuns(runs, s.from, s.to);
    const prior = runsText(sliceRuns(runs, 0, s.from));
    let sentence = !/\S/.test(prior) || /[.!?]\s*$/.test(prior);
    const after = before.map((r) => {
      const t = r.footnote !== undefined ? r.text : recase(r.text, how, sentence);
      if (/\S/.test(r.text)) sentence = /[.!?]\s*$/.test(t);
      return { ...r, text: t };
    });
    if (runsText(after) === runsText(before)) continue;
    b.step({ type: 'remove', block: s.id, offset: s.from, runs: before });
    b.step({ type: 'insert', block: s.id, offset: s.from, runs: after });
    if (s.id === to.block) focusEnd = { block: s.id, offset: s.from + runsLength(after) };
  }
  return tx(state, b, { anchor: from, focus: focusEnd });
}

/** One paragraph setting shared by all the selected paragraphs (undefined when they differ or it's unset). */
export function paraValue<K extends ParaKey>(state: EditorState, key: K): ParaLook[K] | undefined {
  const blocks = selectedBlocks(state).filter((b) => !isMedia(b.type));
  const v = blocks[0]?.para?.[key];
  return blocks.every((b) => b.para?.[key] === v) ? v : undefined;
}

/** Word's Paragraph settings on the selected paragraphs: a value sets one, undefined takes it off; null clears them all. */
export function setPara(state: EditorState, patch: Partial<ParaLook> | null): Transaction {
  const b = new Builder(state.doc);
  for (const blk of selectedBlocks(state)) {
    if (isMedia(blk.type)) continue;
    const to = attrsOf({ ...blk, para: patch === null ? undefined : tidyPara({ ...blk.para, ...patch }) });
    if (!sameAttrs(attrsOf(blk), to)) b.step({ type: 'setAttrs', block: blk.id, from: attrsOf(blk), to });
  }
  return tx(state, b, state.selection);
}

/**
 * Word's bullet and numbering libraries: makes the selected paragraphs a
 * bulleted or numbered list in that style. With just a caret in a list, the
 * whole list at that level takes the style (1.1.1 takes every level).
 */
export function setListStyle(state: EditorState, style: { num: NumFormat } | { bullet: BulletKind }): Transaction {
  const b = new Builder(state.doc);
  const type: BlockType = 'num' in style ? 'numbered' : 'bullet';
  const blocks = state.doc.blocks;
  let targets = selectedBlocks(state).filter((x) => !isMedia(x.type) && x.type !== 'table');
  const here = targets[0];
  if (targets.length === 1 && here?.type === type) {
    // The list the caret is in: list items next to each other, at this level (or every level for 1.1.1).
    let i = blockIndex(state.doc, here.id);
    let j = i;
    while (i > 0 && isList(blocks[i - 1].type)) i--;
    while (j < blocks.length - 1 && isList(blocks[j + 1].type)) j++;
    const all = 'num' in style && (style.num === 'legal' || here.para?.num === 'legal');
    targets = blocks.slice(i, j + 1).filter((x) => x.type === type && (all || (x.indent ?? 0) === (here.indent ?? 0)));
  }
  for (const blk of targets) {
    const list = blk.type === type ? blk : { ...blk, ...blockAttrs(type, false, isList(blk.type) ? blk.indent : 0), para: blk.para };
    const to = attrsOf({ ...list, para: tidyPara({ ...blk.para, ...style }) });
    if (!sameAttrs(attrsOf(blk), to)) b.step({ type: 'setAttrs', block: blk.id, from: attrsOf(blk), to });
  }
  return tx(state, b, state.selection);
}

/** Word's Restart at 1 / Set Numbering Value: the numbered item at the caret starts again from `start` (undefined: carries on). */
export function setListStart(state: EditorState, start: number | undefined): Transaction {
  const b = new Builder(state.doc);
  const blk = getBlock(state.doc, orderedRange(state.doc, state.selection).from.block);
  if (blk.type === 'numbered') {
    const to = attrsOf({ ...blk, para: tidyPara({ ...blk.para, start }) });
    if (!sameAttrs(attrsOf(blk), to)) b.step({ type: 'setAttrs', block: blk.id, from: attrsOf(blk), to });
  }
  return tx(state, b, state.selection);
}

/** Word's Increase / Decrease Indent: list items nest; other paragraphs move half an inch. */
export function stepIndent(state: EditorState, delta: 1 | -1): Transaction {
  const b = new Builder(state.doc);
  for (const blk of selectedBlocks(state)) {
    if (isMedia(blk.type)) continue;
    let to;
    if (isList(blk.type)) to = attrsOf({ ...blk, indent: Math.max(0, Math.min(MAX_INDENT, (blk.indent ?? 0) + delta)) });
    else {
      const left = Math.max(0, Math.round(((blk.para?.left ?? 0) + delta * 0.5) * 2) / 2);
      to = attrsOf({ ...blk, para: tidyPara({ ...blk.para, left: left || undefined }) });
    }
    if (!sameAttrs(attrsOf(blk), to)) b.step({ type: 'setAttrs', block: blk.id, from: attrsOf(blk), to });
  }
  return tx(state, b, state.selection);
}

/** Word's Page Break (Ctrl+Enter): what follows the caret starts on a new page. */
export function insertPageBreak(state: EditorState): Transaction {
  return insertBreak(state, { pageBefore: true });
}

/** Word's Column Break (Ctrl+Shift+Enter): what follows the caret starts at the top of the next column. */
export function insertColumnBreak(state: EditorState): Transaction {
  return insertBreak(state, { colBefore: true });
}

/** Word's Section Breaks: what follows the caret is a new section, on a new page or carrying on down this one. */
export function insertSectionBreak(state: EditorState, kind: 'page' | 'cont'): Transaction {
  return insertBreak(state, { sect: kind });
}

/** Splits the paragraph at the caret (unless it's at its very start) and sets `para` on what follows. */
function insertBreak(state: EditorState, patch: Partial<ParaLook>): Transaction {
  const b = new Builder(state.doc);
  const { from, to } = orderedRange(state.doc, state.selection);
  let at = deleteRange(b, from, to);
  const block = getBlock(b.doc, at.block);
  if (isMedia(block.type) || isWidget(block.type)) at = { block: block.id, offset: runsLength(block.runs) };
  // At the very start of a paragraph it moves on itself; otherwise the rest of it does.
  if (at.offset > 0 || isMedia(block.type) || isWidget(block.type)) at = splitAt(b, at);
  const blk = getBlock(b.doc, at.block);
  const next = attrsOf({ ...blk, para: tidyPara({ ...blk.para, ...patch }) });
  b.step({ type: 'setAttrs', block: blk.id, from: attrsOf(blk), to: next });
  return tx(state, b, caret(at));
}

/**
 * Word's Columns and Orientation: set on the section the caret is in (on
 * the paragraph its section break is on; for the first section, on the
 * very first paragraph).
 */
export type SectionPatch = Partial<Pick<ParaLook, 'cols' | 'orient' | 'mt' | 'mb' | 'ml' | 'mr' | 'sect'>>;

export function setSection(state: EditorState, patch: SectionPatch): Transaction {
  const b = new Builder(state.doc);
  const blocks = state.doc.blocks;
  let i = sectionStart(blocks, blockIndex(state.doc, orderedRange(state.doc, state.selection).from.block));
  let blk = blocks[i];
  if (isMedia(blk.type) || isWidget(blk.type)) {
    // A section starting with a picture or table: an empty line before it holds the section's settings.
    const id = newId();
    b.step({ type: 'split', block: blk.id, offset: 0, newBlock: id, newAttrs: attrsOf(blk) });
    b.step({ type: 'setAttrs', block: blk.id, from: attrsOf(getBlock(b.doc, blk.id)), to: blockAttrs('paragraph') });
    blk = getBlock(b.doc, blk.id);
    i = blockIndex(b.doc, blk.id);
  }
  // (The first section's start can't change: it starts the document.)
  const para = tidyPara({ ...blk.para, ...patch, sect: i === 0 ? 'page' : (patch.sect ?? blk.para?.sect ?? 'page') });
  const to = attrsOf({ ...blk, para });
  if (!sameAttrs(attrsOf(blk), to)) b.step({ type: 'setAttrs', block: blk.id, from: attrsOf(blk), to });
  return tx(state, b, state.selection);
}

/**
 * Page Setup's "Apply to: Whole document": every section takes the page
 * setup's margins and orientation again (no section's own), and `cols`
 * columns (set on the first section; the others follow it).
 */
export function setAllSections(state: EditorState, cols: number): Transaction {
  const b = new Builder(state.doc);
  state.doc.blocks.forEach((blk, i) => {
    if (!blk.para?.sect) {
      if (i > 0 || cols === 1 || isMedia(blk.type) || isWidget(blk.type)) return;
    }
    const keep = i === 0 ? { sect: 'page' as const, cols: cols > 1 ? cols : undefined } : { sect: blk.para!.sect, cols: undefined };
    const para = tidyPara({ ...blk.para, orient: undefined, mt: undefined, mb: undefined, ml: undefined, mr: undefined, ...keep });
    // A first paragraph whose section break only held settings that are gone now: no break at all.
    const tidy = i === 0 && para && para.sect && Object.keys(para).length === 1 ? tidyPara({ ...para, sect: undefined }) : para;
    const to = attrsOf({ ...blk, para: tidy });
    if (!sameAttrs(attrsOf(blk), to)) b.step({ type: 'setAttrs', block: blk.id, from: attrsOf(blk), to });
  });
  return tx(state, b, state.selection);
}

/** Selected blocks, first to last. */
function selectedBlocks(state: EditorState): Block[] {
  const { from, to } = orderedRange(state.doc, state.selection);
  return state.doc.blocks.slice(blockIndex(state.doc, from.block), blockIndex(state.doc, to.block) + 1);
}

/**
 * Applies a named style (Word's style menu): a block type, and for paragraphs
 * and quotes optionally a style on top. Alignment set by hand is kept.
 */
export function setBlockStyle(state: EditorState, type: BlockType, style?: string): Transaction {
  const b = new Builder(state.doc);
  for (const blk of selectedBlocks(state)) {
    if (isMedia(blk.type)) continue;
    const to = attrsOf({ type, checked: false, indent: isList(type) && isList(blk.type) ? blk.indent : 0, ...(style ? { style } : {}), ...(blk.align ? { align: blk.align } : {}), para: blk.para });
    if (!sameAttrs(attrsOf(blk), to)) b.step({ type: 'setAttrs', block: blk.id, from: attrsOf(blk), to });
  }
  return tx(state, b, state.selection);
}

/** Aligns the selected blocks. */
export function setAlign(state: EditorState, align: Align): Transaction {
  const b = new Builder(state.doc);
  for (const blk of selectedBlocks(state)) {
    const to = attrsOf({ ...blk, align });
    if (!sameAttrs(attrsOf(blk), to)) b.step({ type: 'setAttrs', block: blk.id, from: attrsOf(blk), to });
  }
  return tx(state, b, state.selection);
}

export function setBlockType(state: EditorState, type: BlockType): Transaction {
  const b = new Builder(state.doc);
  const { from, to } = orderedRange(state.doc, state.selection);
  const start = blockIndex(state.doc, from.block);
  const end = blockIndex(state.doc, to.block);
  const allAlready = state.doc.blocks.slice(start, end + 1).every((x) => x.type === type);
  const target = allAlready ? 'paragraph' : type;
  for (let i = start; i <= end; i++) {
    const blk = state.doc.blocks[i];
    if (blk.type === target || isMedia(blk.type)) continue;
    // Switching between list types keeps the nesting level.
    b.step({ type: 'setAttrs', block: blk.id, from: attrsOf(blk), to: blockAttrs(target, false, isList(blk.type) ? blk.indent : 0) });
  }
  return tx(state, b, state.selection);
}

/** The span of the link around a collapsed caret, if it sits inside or at the edge of one. */
function linkSpanAt(doc: Doc, pos: Pos): { from: number; to: number; link: string } | null {
  const runs = getBlock(doc, pos.block).runs;
  let start = 0;
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    const end = start + r.text.length;
    if (r.link && pos.offset >= start && pos.offset <= end) {
      // Extend over neighbouring runs with the same link (they differ only in other formatting).
      let from = start;
      let to = end;
      for (let j = i - 1; j >= 0 && runs[j].link === r.link; j--) from -= runs[j].text.length;
      for (let j = i + 1; j < runs.length && runs[j].link === r.link; j++) to += runs[j].text.length;
      return { from, to, link: r.link };
    }
    start = end;
  }
  return null;
}

/** The link under the selection or caret, for showing in the link editor. */
export function currentLink(state: EditorState): string | null {
  if (isCollapsed(state.selection)) return linkSpanAt(state.doc, state.selection.focus)?.link ?? null;
  const spans = selectedSpans(state.doc, state.selection).filter((x) => x.to > x.from);
  return spans.length ? commonLink(spans.flatMap((x) => sliceRuns(getBlock(state.doc, x.id).runs, x.from, x.to))) : null;
}

/**
 * Links the selected text to `href` (already normalised), or removes links with null.
 * With nothing selected, it edits or removes the link the caret is in.
 */
export function setLink(state: EditorState, href: string | null): Transaction | null {
  let sel = state.selection;
  if (isCollapsed(sel)) {
    const span = linkSpanAt(state.doc, sel.focus);
    if (!span) return null;
    sel = { anchor: { block: sel.focus.block, offset: span.from }, focus: { block: sel.focus.block, offset: span.to } };
  }
  const b = new Builder(state.doc);
  for (const sp of selectedSpans(state.doc, sel)) {
    if (sp.to <= sp.from) continue;
    const before = sliceRuns(getBlock(b.doc, sp.id).runs, sp.from, sp.to);
    const after = setLinkOnRuns(before, href);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    b.step({ type: 'format', block: sp.id, offset: sp.from, before, after, link: href });
  }
  return tx(state, b, state.selection);
}

/** After typing a space, turns a web address just before it into a link. */
export function autoLink(state: EditorState): Transaction | null {
  if (!isCollapsed(state.selection)) return null;
  const pos = state.selection.focus;
  const block = getBlock(state.doc, pos.block);
  const before = runsText(block.runs).slice(0, pos.offset);
  const m = /(?:^|\s)((?:https?:\/\/|www\.)[^\s]+)\s$/i.exec(before);
  if (!m) return null;
  const word = m[1].replace(/[.,;:!?)\]]+$/, ''); // leave trailing punctuation out of the link
  const href = normalizeLink(word);
  if (!href) return null;
  const from = before.length - 1 - m[1].length;
  const to = from + word.length;
  const runs = sliceRuns(block.runs, from, to);
  if (runs.some((r) => r.link)) return null;
  const t = setLink({ ...state, selection: { anchor: { block: block.id, offset: from }, focus: { block: block.id, offset: to } } }, href);
  return t && t.ops.length ? { ...t, selectionBefore: state.selection, selectionAfter: state.selection } : null;
}

/** Pasting a web address: links the selected text to it, or inserts it as a link. Returns null for other text. */
export function pasteLink(state: EditorState, text: string): Transaction | null {
  const href = normalizeLink(text);
  if (!href || !/^(https?:\/\/|www\.|mailto:)/i.test(text.trim())) return null;
  if (!isCollapsed(state.selection)) return setLink(state, href);
  const t = insertText(state, text.trim());
  const at = state.selection.focus;
  const linked = setLink(
    { ...state, doc: applyOps(state.doc, t.ops), selection: { anchor: at, focus: { block: at.block, offset: at.offset + text.trim().length } } },
    href,
  );
  return linked ? { ...t, ops: [...t.ops, ...linked.ops] } : t;
}

/** Tab / Shift+Tab: nest or un-nest the selected list items. Returns null if none are list items. */
export function indent(state: EditorState, delta: 1 | -1): Transaction | null {
  const { from, to } = orderedRange(state.doc, state.selection);
  const start = blockIndex(state.doc, from.block);
  const end = blockIndex(state.doc, to.block);
  const items = state.doc.blocks.slice(start, end + 1).filter((x) => isList(x.type));
  if (!items.length) return null;
  const b = new Builder(state.doc);
  for (const blk of items) {
    const next = blockAttrs(blk.type, blk.checked, (blk.indent ?? 0) + delta);
    if ((next.indent ?? 0) !== (blk.indent ?? 0)) b.step({ type: 'setAttrs', block: blk.id, from: attrsOf(blk), to: next });
  }
  return tx(state, b, state.selection);
}

export function toggleTodo(state: EditorState, id: string): Transaction {
  const blk = getBlock(state.doc, id);
  const b = new Builder(state.doc);
  if (blk.type !== 'todo') return tx(state, b, state.selection);
  b.step({ type: 'setAttrs', block: id, from: attrsOf(blk), to: blockAttrs('todo', !blk.checked, blk.indent) });
  return tx(state, b, state.selection);
}

/** Folds the section under a heading (or a toggle's content) away, or opens it again. */
export function toggleFold(state: EditorState, id: string): Transaction {
  const blk = getBlock(state.doc, id);
  const b = new Builder(state.doc);
  if (!foldable(blk)) return tx(state, b, state.selection);
  b.step({ type: 'setAttrs', block: id, from: attrsOf(blk), to: attrsOf({ ...blk, folded: !blk.folded }) });
  // A caret inside the folded part moves to the heading.
  const i = blockIndex(state.doc, id);
  const hidden = new Set(foldedUnder(state.doc, i).map((x) => x.id));
  const sel = blk.folded || !hidden.has(state.selection.focus.block) ? state.selection : caret({ block: id, offset: runsLength(blk.runs) });
  return tx(state, b, sel);
}

export { foldedUnder };

/** Replaces a block's text with what the DOM now shows (after IME or other native edits), as a minimal remove + insert. */
export function syncBlockText(state: EditorState, id: string, domText: string, selectionAfter: Selection): Transaction | null {
  const blk = getBlock(state.doc, id);
  const oldText = runsText(blk.runs);
  if (oldText === domText) return null;
  let start = 0;
  while (start < oldText.length && start < domText.length && oldText[start] === domText[start]) start++;
  let endOld = oldText.length;
  let endNew = domText.length;
  while (endOld > start && endNew > start && oldText[endOld - 1] === domText[endNew - 1]) {
    endOld--;
    endNew--;
  }
  const b = new Builder(state.doc);
  const marks = state.storedMarks ?? marksAt(blk.runs, start);
  const look = state.storedLook ?? lookAt(blk.runs, start);
  if (endOld > start) b.step({ type: 'remove', block: id, offset: start, runs: sliceRuns(blk.runs, start, endOld) });
  const inserted = domText.slice(start, endNew);
  if (inserted) b.step({ type: 'insert', block: id, offset: start, runs: [look ? { text: inserted, marks, look } : { text: inserted, marks }] });
  return tx(state, b, selectionAfter, { kind: 'typing', storedMarks: null, storedLook: null });
}

/**
 * Puts a picture or file after the block with the caret (or in place of an
 * empty paragraph), with a paragraph after it to carry on writing.
 */
export function insertMedia(state: EditorState, type: 'image' | 'file', src: string, caption = ''): Transaction {
  return insertWidget(state, attrsOf({ type, src }), caption);
}

/** Puts a new table (an empty header row and `rows` rows) after the caret's block. */
export function insertTable(state: EditorState, rows = 2, cols = 3): Transaction {
  return insertWidget(state, attrsOf({ type: 'table', rows: Array.from({ length: rows + 1 }, () => Array.from({ length: cols }, () => '')) }));
}

/** Word's Table of Contents: a list of the headings (with page numbers in page view), kept up to date. */
export function insertToc(state: EditorState): Transaction {
  return insertWidget(state, attrsOf({ type: 'toc' }));
}

/** Word's Insert > Shapes / Text Box: a shape after the caret's paragraph (on it, when it's empty). */
export function insertShape(state: EditorState, kind: ShapeKind, textBox = false): Transaction {
  return insertWidget(state, attrsOf({ type: 'shape', shape: defaultShape(kind, textBox) }));
}

/** Changes a text box's or shape's look or text. */
export function setShape(state: EditorState, id: string, patch: Partial<ShapeLook>): Transaction {
  const blk = getBlock(state.doc, id);
  const b = new Builder(state.doc);
  if (blk.type === 'shape') {
    const to = attrsOf({ ...blk, shape: tidyShape({ ...blk.shape, ...patch }) });
    if (!sameAttrs(attrsOf(blk), to)) b.step({ type: 'setAttrs', block: id, from: attrsOf(blk), to });
  }
  return tx(state, b, state.selection);
}

/** Inserts maths or a diagram where the caret is. */
export function insertCode(state: EditorState, lang: CodeLook['lang'], text = ''): Transaction {
  return insertWidget(state, attrsOf({ type: 'code', code: { lang, text } }));
}

/** Changes the source (or the kind) of maths or a diagram. */
export function setCode(state: EditorState, id: string, patch: Partial<CodeLook>): Transaction {
  const blk = getBlock(state.doc, id);
  const b = new Builder(state.doc);
  if (blk.type === 'code') {
    const to = attrsOf({ ...blk, code: tidyCode({ ...blk.code, ...patch }) });
    if (!sameAttrs(attrsOf(blk), to)) b.step({ type: 'setAttrs', block: id, from: attrsOf(blk), to });
  }
  return tx(state, b, state.selection);
}

/** Changes a table's cells (or its rows and columns). */
export function setTableRows(state: EditorState, id: string, rows: string[][], tbl?: TableLook): Transaction {
  const blk = getBlock(state.doc, id);
  const b = new Builder(state.doc);
  const to = attrsOf({ ...blk, rows, ...(arguments.length > 3 ? { tbl } : {}) });
  if (blk.type === 'table' && !sameAttrs(attrsOf(blk), to)) b.step({ type: 'setAttrs', block: id, from: attrsOf(blk), to });
  return tx(state, b, state.selection);
}

function insertWidget(state: EditorState, media: BlockAttrs, caption = ''): Transaction {
  const b = new Builder(state.doc);
  const { from, to } = orderedRange(state.doc, state.selection);
  const at = deleteRange(b, from, to);
  const block = getBlock(b.doc, at.block);
  const len = runsLength(block.runs);
  let id: string;
  if (block.type === 'paragraph' && len === 0 && !block.style) {
    // An empty line becomes the picture.
    b.step({ type: 'setAttrs', block: block.id, from: attrsOf(block), to: media });
    id = block.id;
  } else {
    // Text after the caret moves below the picture.
    if (at.offset < len) b.step({ type: 'split', block: block.id, offset: at.offset, newBlock: newId(), newAttrs: attrsOf({ ...block, checked: false, brk: undefined }) });
    id = newId();
    b.step({ type: 'split', block: block.id, offset: at.offset, newBlock: id, newAttrs: media });
  }
  if (caption) b.step({ type: 'insert', block: id, offset: 0, runs: [{ text: caption, marks: [] }] });
  const next = b.doc.blocks[blockIndex(b.doc, id) + 1];
  if (next && !isMedia(next.type)) return tx(state, b, caret({ block: next.id, offset: 0 }));
  const para = newId();
  b.step({ type: 'split', block: id, offset: runsLength(getBlock(b.doc, id).runs), newBlock: para, newAttrs: blockAttrs('paragraph') });
  return tx(state, b, caret({ block: para, offset: 0 }));
}

/** Inserts `text` linked to `href` at the caret (replacing any selection), then a space after it unlinked. */
export function insertLinkedText(state: EditorState, text: string, href: string): Transaction {
  const b = new Builder(state.doc);
  const { from, to } = orderedRange(state.doc, state.selection);
  const at = deleteRange(b, from, to);
  b.step({ type: 'insert', block: at.block, offset: at.offset, runs: [{ text, marks: [], link: href }] });
  const after = { block: at.block, offset: at.offset + text.length };
  return tx(state, b, caret(after), { storedMarks: [] });
}

/** Puts a footnote just after the selection (or at the caret), with the caret after it. */
export function insertFootnote(state: EditorState, text: string): Transaction {
  const b = new Builder(state.doc);
  const { to } = orderedRange(state.doc, state.selection);
  const block = getBlock(state.doc, to.block);
  if (isMedia(block.type)) return tx(state, b, state.selection);
  b.step({ type: 'insert', block: to.block, offset: to.offset, runs: [{ text: FOOTNOTE, marks: [], footnote: text }] });
  return tx(state, b, caret({ block: to.block, offset: to.offset + 1 }), { storedMarks: [] });
}

/** Changes what the footnote at `at` says; null takes it out. */
export function setFootnote(state: EditorState, at: Pos, text: string | null): Transaction {
  const b = new Builder(state.doc);
  const run = sliceRuns(getBlock(state.doc, at.block).runs, at.offset, at.offset + 1)[0];
  if (!run || run.footnote === undefined || run.footnote === text) return tx(state, b, state.selection);
  b.step({ type: 'remove', block: at.block, offset: at.offset, runs: [run] });
  if (text !== null) b.step({ type: 'insert', block: at.block, offset: at.offset, runs: [{ ...run, footnote: text }] });
  const sel = state.selection;
  // The caret stays put, moving back one if it was after a removed footnote.
  const shift = (p: Pos): Pos => (text === null && p.block === at.block && p.offset > at.offset ? { block: p.block, offset: p.offset - 1 } : p);
  return tx(state, b, { anchor: shift(sel.anchor), focus: shift(sel.focus) });
}

/** Puts a comment on the selected text (replacing any comment already there). */
export function addComment(state: EditorState, comment: Comment): Transaction | null {
  if (isCollapsed(state.selection)) return null;
  const b = new Builder(state.doc);
  const { from, to } = orderedRange(state.doc, state.selection);
  const start = blockIndex(state.doc, from.block);
  const end = blockIndex(state.doc, to.block);
  let any = false;
  for (let i = start; i <= end; i++) {
    const block = state.doc.blocks[i];
    if (isMedia(block.type)) continue;
    const a = i === start ? from.offset : 0;
    const z = i === end ? to.offset : runsLength(block.runs);
    if (z <= a) continue;
    const before = sliceRuns(block.runs, a, z);
    b.step({ type: 'format', block: block.id, offset: a, before, after: setCommentOnRuns(before, comment), comment });
    any = true;
  }
  return any ? tx(state, b, state.selection) : null;
}

/** Changes the comment with this id everywhere it is (null takes it off the text). */
export function setComment(state: EditorState, id: string, comment: Comment | null): Transaction | null {
  const b = new Builder(state.doc);
  for (const block of state.doc.blocks) {
    let pos = 0;
    // Each stretch of runs carrying the comment.
    const spans: [number, number][] = [];
    for (const r of block.runs) {
      const end = pos + r.text.length;
      if (r.comment?.id === id) {
        const last = spans[spans.length - 1];
        if (last && last[1] === pos) last[1] = end;
        else spans.push([pos, end]);
      }
      pos = end;
    }
    for (const [a, z] of spans) {
      const before = sliceRuns(getBlock(b.doc, block.id).runs, a, z);
      b.step({ type: 'format', block: block.id, offset: a, before, after: setCommentOnRuns(before, comment), comment });
    }
  }
  return b.ops.length ? tx(state, b, state.selection) : null;
}

// ---------- track changes ----------

/**
 * Marks the text between two positions as deleted instead of removing it.
 * Text that was itself a tracked addition goes for real. Paragraph breaks are
 * kept. Returns where `to` ends up.
 */
function markDeleted(b: Builder, from: Pos, to: Pos, change: Change): Pos {
  const start = blockIndex(b.doc, from.block);
  const end = blockIndex(b.doc, to.block);
  let endPos = to;
  for (let i = start; i <= end; i++) {
    const block = b.doc.blocks[i];
    if (isMedia(block.type)) continue;
    const a = i === start ? from.offset : 0;
    const z = i === end ? to.offset : runsLength(block.runs);
    // Stretches of runs, right to left so earlier offsets stay put.
    const parts: { from: number; to: number; run: Run }[] = [];
    let pos = 0;
    for (const r of block.runs) {
      const e = pos + r.text.length;
      const s0 = Math.max(a, pos);
      const e0 = Math.min(z, e);
      if (e0 > s0) parts.push({ from: s0, to: e0, run: r });
      pos = e;
    }
    let removed = 0;
    for (const p of parts.reverse()) {
      const runs = sliceRuns(getBlock(b.doc, block.id).runs, p.from, p.to);
      if (p.run.change?.kind === 'ins') {
        b.step({ type: 'remove', block: block.id, offset: p.from, runs });
        removed += p.to - p.from;
      } else if (p.run.change?.kind !== 'del') {
        b.step({ type: 'format', block: block.id, offset: p.from, before: runs, after: setChangeOnRuns(runs, change), change });
      }
    }
    if (i === end) endPos = { block: block.id, offset: z - removed };
    // The paragraph break before this block is deleted too (one added while tracking just goes).
    if (i > start && !getBlock(b.doc, block.id).brk) {
      const cur = getBlock(b.doc, block.id);
      b.step({ type: 'setAttrs', block: cur.id, from: attrsOf(cur), to: { ...attrsOf(cur), brk: change } });
    }
  }
  return endPos;
}

/** Typing with track changes on: the new text is marked as added; anything selected is marked deleted. */
export function trackedInsertText(state: EditorState, text: string, author: string): Transaction {
  const b = new Builder(state.doc);
  const { from, to } = orderedRange(state.doc, state.selection);
  const at = isCollapsed(state.selection) ? from : markDeleted(b, from, to, makeChange('del', author));
  const block = getBlock(b.doc, at.block);
  const marks = state.storedMarks ?? marksAt(block.runs, at.offset);
  const look = state.storedLook ?? lookAt(block.runs, at.offset);
  const link = linkAt(block.runs, at.offset);
  const comment = commentAt(block.runs, at.offset);
  const change = makeChange('ins', author);
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let pos = at;
  lines.forEach((line, n) => {
    if (n > 0) pos = splitAt(b, pos);
    if (line) {
      const run: Run = { text: line, marks: sortMarks(marks), change };
      if (link && n === 0) run.link = link;
      if (comment && n === 0) run.comment = comment;
      if (look) run.look = look;
      b.step({ type: 'insert', block: pos.block, offset: pos.offset, runs: [run] });
      pos = { block: pos.block, offset: pos.offset + line.length };
    }
  });
  return tx(state, b, caret(pos), { kind: lines.length === 1 && text.length <= 2 ? 'typing' : 'other', storedMarks: null, storedLook: null });
}

/**
 * Deleting with track changes on: the selection, or the character before
 * (dir -1) or after (dir 1) the caret, skipping text already marked deleted.
 * Null at the edge of a paragraph (the caller joins paragraphs as usual).
 */
export function trackedDelete(state: EditorState, dir: -1 | 1, author: string, range?: Selection): Transaction | null {
  const b = new Builder(state.doc);
  const change = makeChange('del', author);
  const sel = range ?? state.selection;
  if (!isCollapsed(sel)) {
    const { from, to } = orderedRange(state.doc, sel);
    const end = markDeleted(b, from, to, change);
    return tx(state, b, caret(dir < 0 ? from : end));
  }
  const pos = sel.focus;
  const runs = getBlock(state.doc, pos.block).runs;
  const len = runsLength(runs);
  const deletedAt = (i: number) => sliceRuns(runs, i, i + 1)[0]?.change?.kind === 'del';
  let i = pos.offset;
  // Step over text that is already deleted.
  if (dir < 0) while (i > 0 && deletedAt(i - 1)) i--;
  else while (i < len && deletedAt(i)) i++;
  if ((dir < 0 && i === 0) || (dir > 0 && i === len)) {
    return i === pos.offset ? null : tx(state, b, caret({ block: pos.block, offset: i }));
  }
  // A whole character, even outside the Basic Multilingual Plane.
  const text = runsText(runs);
  const width = dir < 0 ? (/[\uDC00-\uDFFF]/.test(text[i - 1]) && i > 1 ? 2 : 1) : /[\uD800-\uDBFF]/.test(text[i]) ? 2 : 1;
  const from = { block: pos.block, offset: dir < 0 ? i - width : i };
  const to = { block: pos.block, offset: dir < 0 ? i : i + width };
  const end = markDeleted(b, from, to, change);
  return tx(state, b, caret(dir < 0 ? from : end), { kind: 'typing' });
}

/**
 * Accepts (or rejects) the tracked changes in a stretch of one block, or, with
 * no block, everywhere. Accepting an addition keeps its text; accepting a
 * deletion removes it. Rejecting does the opposite.
 */
export function resolveChanges(state: EditorState, accept: boolean, where?: { block: string; from: number; to: number }): Transaction | null {
  const b = new Builder(state.doc);
  for (const block of state.doc.blocks) {
    if (where && block.id !== where.block) continue;
    const parts: { from: number; to: number; kind: 'ins' | 'del' }[] = [];
    let pos = 0;
    for (const r of block.runs) {
      const e = pos + r.text.length;
      const a = where ? Math.max(where.from, pos) : pos;
      const z = where ? Math.min(where.to, e) : e;
      if (r.change && z > a) parts.push({ from: a, to: z, kind: r.change.kind });
      pos = e;
    }
    for (const p of parts.reverse()) {
      const runs = sliceRuns(getBlock(b.doc, block.id).runs, p.from, p.to);
      const goes = (p.kind === 'ins') !== accept;
      if (goes) b.step({ type: 'remove', block: block.id, offset: p.from, runs });
      else b.step({ type: 'format', block: block.id, offset: p.from, before: runs, after: setChangeOnRuns(runs, null), change: null });
    }
  }
  // Paragraph breaks, last first (accepting a deletion or rejecting an addition joins two paragraphs).
  for (const block of [...b.doc.blocks].reverse()) {
    if (!block.brk || (where && (block.id !== where.block || where.from > -1))) continue;
    const goes = (block.brk.kind === 'del') === accept;
    b.step({ type: 'setAttrs', block: block.id, from: attrsOf(block), to: { ...attrsOf(block), brk: undefined } });
    const i = blockIndex(b.doc, block.id);
    const prev = b.doc.blocks[i - 1];
    if (goes && prev && !isMedia(prev.type) && !isMedia(block.type)) {
      const cur = getBlock(b.doc, block.id);
      b.step({ type: 'join', block: prev.id, second: cur.id, offset: runsLength(prev.runs), secondAttrs: attrsOf(cur) });
    }
  }
  if (!b.ops.length) return null;
  // Keep the caret inside the document.
  const doc = b.doc;
  const fix = (p: Pos): Pos => {
    const blk = doc.blocks.find((x) => x.id === p.block);
    return blk ? { block: p.block, offset: Math.min(p.offset, runsLength(blk.runs)) } : { block: doc.blocks[0].id, offset: 0 };
  };
  return tx(state, b, { anchor: fix(state.selection.anchor), focus: fix(state.selection.focus) });
}

/**
 * Pastes whole paragraphs (from a web page or Word): the first joins the
 * paragraph at the caret, the rest follow it as paragraphs of their own, and
 * the text after the caret ends up after the last one.
 */
export function insertBlocks(state: EditorState, blocks: Block[]): Transaction | null {
  if (!blocks.length) return null;
  const b = new Builder(state.doc);
  const { from, to } = orderedRange(state.doc, state.selection);
  const at = deleteRange(b, from, to);
  const here = getBlock(b.doc, at.block);
  const [first, ...rest] = blocks;
  // One stretch of text: just like typing it.
  if (!rest.length && !isMedia(first.type) && !isMedia(here.type)) {
    const runs = first.runs;
    if (!runs.length) return tx(state, b, caret(at));
    if (runsLength(here.runs) === 0 && here.type === 'paragraph' && !here.style && first.type !== 'paragraph') b.step({ type: 'setAttrs', block: here.id, from: attrsOf(here), to: attrsOf(first) });
    b.step({ type: 'insert', block: at.block, offset: at.offset, runs });
    return tx(state, b, caret({ block: at.block, offset: at.offset + runsLength(runs) }));
  }
  // The text after the caret waits in a block of its own.
  const tail = splitAt(b, at);
  let last = here.id;
  let start = 0;
  // A heading or list item pasted at the end of a line starts a line of its own rather than joining it.
  const ownLine = first.type !== 'paragraph' && at.offset > 0 && at.offset === runsLength(here.runs);
  const textual = !isMedia(first.type) && !isMedia(here.type) && !ownLine;
  if (textual) {
    // An empty plain line takes on the first paragraph's kind (a heading, a list item…).
    if (at.offset === 0 && runsLength(here.runs) === 0 && here.type === 'paragraph' && !here.style) b.step({ type: 'setAttrs', block: here.id, from: attrsOf(getBlock(b.doc, here.id)), to: attrsOf(first) });
    if (first.runs.length) b.step({ type: 'insert', block: here.id, offset: at.offset, runs: first.runs });
    start = 1;
  }
  for (const blk of blocks.slice(start)) {
    const prev = getBlock(b.doc, last);
    const id = newId();
    b.step({ type: 'split', block: last, offset: runsLength(prev.runs), newBlock: id, newAttrs: attrsOf(blk) });
    if (blk.runs.length) b.step({ type: 'insert', block: id, offset: 0, runs: blk.runs });
    last = id;
  }
  const lastBlock = getBlock(b.doc, last);
  const end = { block: last, offset: runsLength(lastBlock.runs) };
  // The text after the caret joins the last paragraph pasted, as in Word (unless that's a picture or table).
  const tailBlock = getBlock(b.doc, tail.block);
  if (!isMedia(lastBlock.type)) {
    b.step({ type: 'join', block: last, second: tail.block, offset: end.offset, secondAttrs: attrsOf(tailBlock) });
    return tx(state, b, caret(end));
  }
  return tx(state, b, caret(isMedia(lastBlock.type) ? { block: tail.block, offset: 0 } : end));
}

/** Enter with track changes on: a new paragraph, its break marked as added. */
export function trackedSplit(state: EditorState, author: string): Transaction {
  const t = splitBlock(state);
  const made = new Set(t.ops.flatMap((op) => (op.type === 'split' ? [op.newBlock] : [])));
  const doc = applyOps(state.doc, t.ops);
  const id = t.selectionAfter.focus.block;
  // Only when a paragraph was really made (Enter on an empty list item just ends the list).
  if (!made.has(id)) return t;
  const blk = getBlock(doc, id);
  return { ...t, ops: [...t.ops, { type: 'setAttrs', block: id, from: attrsOf(blk), to: { ...attrsOf(blk), brk: makeChange('ins', author) } }] };
}

/**
 * Backspace at the start of a paragraph (dir -1) or Delete at its end (1),
 * with track changes on: the break between the two paragraphs is marked
 * deleted (one added while tracking just goes). Null where there's nothing to join.
 */
export function trackedJoin(state: EditorState, dir: -1 | 1, author: string): Transaction | null {
  const pos = state.selection.focus;
  const i = blockIndex(state.doc, pos.block);
  const second = state.doc.blocks[dir < 0 ? i : i + 1];
  const first = state.doc.blocks[dir < 0 ? i - 1 : i];
  if (!first || !second || isMedia(first.type) || isMedia(second.type)) return null;
  if (second.brk?.kind === 'ins') return joinPlain(state, first, second);
  const b = new Builder(state.doc);
  if (!second.brk) b.step({ type: 'setAttrs', block: second.id, from: attrsOf(second), to: { ...attrsOf(second), brk: makeChange('del', author) } });
  // The caret moves over the break.
  return tx(state, b, caret(dir < 0 ? { block: first.id, offset: runsLength(first.runs) } : { block: second.id, offset: 0 }));
}

/** Joins two paragraphs as they are (no list or heading rules). */
function joinPlain(state: EditorState, first: Block, second: Block): Transaction {
  const b = new Builder(state.doc);
  const offset = runsLength(first.runs);
  b.step({ type: 'join', block: first.id, second: second.id, offset, secondAttrs: attrsOf(second) });
  return tx(state, b, caret({ block: first.id, offset }));
}
