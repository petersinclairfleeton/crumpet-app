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
  newId,
  orderedRange,
  runsLength,
  runsText,
  setMarkOnRuns,
  sliceRuns,
  sortMarks,
} from './model';
import { type Op, applyOp, applyOps, attrsOf, blockAttrs, sameAttrs } from './ops';

export interface EditorState {
  doc: Doc;
  selection: Selection;
  /** Marks toggled with a collapsed selection, applied to the next typed text. */
  storedMarks: Mark[] | null;
}

export interface Transaction {
  ops: Op[];
  selectionBefore: Selection;
  selectionAfter: Selection;
  storedMarks?: Mark[] | null;
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
  // Typing inside a link keeps it linked; typing at its edge does not extend it.
  const link = linkAt(block.runs, at.offset);
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let pos = at;
  lines.forEach((line, n) => {
    if (n > 0) pos = splitAt(b, pos);
    if (line) {
      const run: Run = link && n === 0 ? { text: line, marks: sortMarks(marks), link } : { text: line, marks: sortMarks(marks) };
      b.step({ type: 'insert', block: pos.block, offset: pos.offset, runs: [run] });
      pos = { block: pos.block, offset: pos.offset + line.length };
    }
  });
  return tx(state, b, caret(pos), { kind: lines.length === 1 && text.length <= 2 ? 'typing' : 'other', storedMarks: null });
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
const ENDS_ON_ENTER = new Set(['title', 'subtitle', 'caption', 'scenebreak', 'epigraph']);

/**
 * What Enter at the end of a block creates: lists, quotes and body text carry
 * on in the same style and alignment; headings, titles and the like are
 * followed by body text.
 */
function nextBlockAttrs(block: Block) {
  if (isMedia(block.type)) return blockAttrs('paragraph');
  if (isList(block.type)) return { ...blockAttrs(block.type, false, block.indent), ...(block.align ? { align: block.align } : {}) };
  if (isHeading(block.type) || (block.style && ENDS_ON_ENTER.has(block.style))) return blockAttrs('paragraph');
  return { ...attrsOf(block), checked: undefined };
}

function splitAt(b: Builder, pos: Pos): Pos {
  const block = getBlock(b.doc, pos.block);
  const atEnd = pos.offset === runsLength(block.runs);
  // Text after the caret in a caption becomes a paragraph of its own, not another picture.
  const newAttrs = atEnd ? nextBlockAttrs(block) : isMedia(block.type) ? blockAttrs('paragraph') : attrsOf({ ...block, checked: false });
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
  const block = getBlock(b.doc, at.block);
  // Enter on an empty list item moves it out one level, and out of the list at the top level.
  // On an empty quote or heading it turns back into a paragraph instead of adding another.
  if (block.type !== 'paragraph' && !isMedia(block.type) && runsLength(block.runs) === 0) {
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
    const to = attrsOf({ type, checked: false, indent: isList(type) && isList(blk.type) ? blk.indent : 0, ...(style ? { style } : {}), ...(blk.align ? { align: blk.align } : {}) });
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
  if (endOld > start) b.step({ type: 'remove', block: id, offset: start, runs: sliceRuns(blk.runs, start, endOld) });
  const inserted = domText.slice(start, endNew);
  if (inserted) b.step({ type: 'insert', block: id, offset: start, runs: [{ text: inserted, marks }] });
  return tx(state, b, selectionAfter, { kind: 'typing', storedMarks: null });
}

/**
 * Puts a picture or file after the block with the caret (or in place of an
 * empty paragraph), with a paragraph after it to carry on writing.
 */
export function insertMedia(state: EditorState, type: 'image' | 'file', src: string, caption = ''): Transaction {
  const b = new Builder(state.doc);
  const { from, to } = orderedRange(state.doc, state.selection);
  const at = deleteRange(b, from, to);
  const block = getBlock(b.doc, at.block);
  const len = runsLength(block.runs);
  const media = attrsOf({ type, src });
  let id: string;
  if (block.type === 'paragraph' && len === 0 && !block.style) {
    // An empty line becomes the picture.
    b.step({ type: 'setAttrs', block: block.id, from: attrsOf(block), to: media });
    id = block.id;
  } else {
    // Text after the caret moves below the picture.
    if (at.offset < len) b.step({ type: 'split', block: block.id, offset: at.offset, newBlock: newId(), newAttrs: attrsOf({ ...block, checked: false }) });
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
