// Operations: the only way the document changes. Each one is small,
// serialisable and has an exact inverse, which gives us undo/redo now and a
// unit to send between devices for sync later.

import {
  type BlockAttrs,
  type BlockType,
  type Doc,
  type Mark,
  type Comment,
  MAX_INDENT,
  styleAllowed,
  commonLink,
  isList,
  tidyRows,
  isHeading,
  type Run,
  blockIndex,
  insertRuns,
  normalizeRuns,
  removeRuns,
  replaceRuns,
  runsLength,
  runsText,
  sliceRuns,
} from './model';

export type Op =
  /** Insert `runs` into `block` at `offset`. */
  | { type: 'insert'; block: string; offset: number; runs: Run[] }
  /** Remove the text at `offset` in `block`; `runs` is exactly what is removed. */
  | { type: 'remove'; block: string; offset: number; runs: Run[] }
  /** Split `block` at `offset`; the tail moves into a new block placed right after it. */
  | { type: 'split'; block: string; offset: number; newBlock: string; newAttrs: BlockAttrs }
  /** Join `second` (directly after `block`) onto the end of `block`. `offset` is `block`'s length before the join. */
  | { type: 'join'; block: string; second: string; offset: number; secondAttrs: BlockAttrs }
  /** Change a block's type/attributes. */
  | { type: 'setAttrs'; block: string; from: BlockAttrs; to: BlockAttrs }
  /**
   * Replace formatting on a span; `before` and `after` hold the same text. The intent is recorded
   * for sync: either a mark switched on/off, or a link set (a URL) or removed (null).
   */
  | ({ type: 'format'; block: string; offset: number; before: Run[]; after: Run[] } & ({ mark: Mark; on: boolean; link?: undefined; comment?: undefined } | { link: string | null; mark?: undefined; comment?: undefined } | { comment: Comment | null; mark?: undefined; link?: undefined }));

export class OpError extends Error {}

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new OpError(msg);
}

/** A block's attributes in canonical form: `checked` only on checklist items, `indent` only on nested list items. */
export function attrsOf(b: BlockAttrs): BlockAttrs {
  const a = blockAttrs(b.type, b.checked, b.indent);
  if (b.style && styleAllowed(b.type, b.style)) a.style = b.style;
  if (b.align && b.align !== 'left') a.align = b.align;
  if ((b.type === 'image' || b.type === 'file') && b.src) a.src = b.src;
  if (b.type === 'table') a.rows = tidyRows(b.rows);
  if (isHeading(b.type) && b.folded) a.folded = true;
  return a;
}

export function sameAttrs(a: BlockAttrs, b: BlockAttrs): boolean {
  const x = attrsOf(a);
  const y = attrsOf(b);
  return x.type === y.type && !!x.checked === !!y.checked && (x.indent ?? 0) === (y.indent ?? 0) && (x.style ?? '') === (y.style ?? '') && (x.align ?? 'left') === (y.align ?? 'left') && (x.src ?? '') === (y.src ?? '') && !!x.folded === !!y.folded && JSON.stringify(x.rows ?? null) === JSON.stringify(y.rows ?? null);
}

export function applyOp(doc: Doc, op: Op): Doc {
  const blocks = doc.blocks.slice();
  const i = blockIndex(doc, op.block);
  const b = blocks[i];
  switch (op.type) {
    case 'insert': {
      check(op.offset >= 0 && op.offset <= runsLength(b.runs), 'insert: offset out of range');
      blocks[i] = { ...b, runs: insertRuns(b.runs, op.offset, op.runs) };
      break;
    }
    case 'remove': {
      const len = runsLength(op.runs);
      const actual = sliceRuns(b.runs, op.offset, op.offset + len);
      check(runsText(actual) === runsText(op.runs), 'remove: text does not match document');
      blocks[i] = { ...b, runs: removeRuns(b.runs, op.offset, op.offset + len) };
      break;
    }
    case 'split': {
      const len = runsLength(b.runs);
      check(op.offset >= 0 && op.offset <= len, 'split: offset out of range');
      check(!doc.blocks.some((x) => x.id === op.newBlock), 'split: new block id already exists');
      blocks[i] = { ...b, runs: sliceRuns(b.runs, 0, op.offset) };
      blocks.splice(i + 1, 0, { id: op.newBlock, ...attrsOf(op.newAttrs), runs: sliceRuns(b.runs, op.offset, len) });
      break;
    }
    case 'join': {
      const second = blocks[i + 1];
      check(second && second.id === op.second, 'join: second block is not directly after the first');
      check(runsLength(b.runs) === op.offset, 'join: offset does not match first block length');
      blocks[i] = { ...b, runs: insertRuns(b.runs, op.offset, second.runs) };
      blocks.splice(i + 1, 1);
      break;
    }
    case 'setAttrs': {
      const { id, runs } = b;
      blocks[i] = { id, ...attrsOf(op.to), runs };
      break;
    }
    case 'format': {
      const len = runsLength(op.before);
      check(runsText(op.before) === runsText(op.after), 'format: before/after text differ');
      check(runsText(sliceRuns(b.runs, op.offset, op.offset + len)) === runsText(op.before), 'format: text does not match document');
      blocks[i] = { ...b, runs: replaceRuns(b.runs, op.offset, op.offset + len, op.after) };
      break;
    }
  }
  return { blocks };
}

export function invertOp(op: Op): Op {
  switch (op.type) {
    case 'insert':
      return { type: 'remove', block: op.block, offset: op.offset, runs: op.runs };
    case 'remove':
      return { type: 'insert', block: op.block, offset: op.offset, runs: op.runs };
    case 'split':
      return { type: 'join', block: op.block, second: op.newBlock, offset: op.offset, secondAttrs: op.newAttrs };
    case 'join':
      return { type: 'split', block: op.block, offset: op.offset, newBlock: op.second, newAttrs: op.secondAttrs };
    case 'setAttrs':
      return { type: 'setAttrs', block: op.block, from: op.to, to: op.from };
    case 'format':
      if (op.comment !== undefined) return { type: 'format', block: op.block, offset: op.offset, before: op.after, after: op.before, comment: op.before[0]?.comment ?? null };
      return op.link !== undefined
        ? { type: 'format', block: op.block, offset: op.offset, before: op.after, after: op.before, link: commonLink(op.before) }
        : { type: 'format', block: op.block, offset: op.offset, before: op.after, after: op.before, mark: op.mark, on: !op.on };
  }
}

export function applyOps(doc: Doc, ops: Op[]): Doc {
  return ops.reduce(applyOp, doc);
}

export function invertOps(ops: Op[]): Op[] {
  return ops.slice().reverse().map(invertOp);
}

export function blockAttrs(type: BlockType, checked?: boolean, indent?: number): BlockAttrs {
  const a: BlockAttrs = { type };
  if (type === 'todo') a.checked = !!checked;
  if (isList(type) && indent) a.indent = Math.max(0, Math.min(MAX_INDENT, indent));
  return a;
}

/**
 * Merges neighbouring ops that are really one edit: consecutive typing becomes one
 * insert, and a run of Backspace or Delete presses becomes one remove. The result
 * applies to the same document and gives the same outcome.
 */
export function compressOps(ops: Op[]): Op[] {
  const out: Op[] = [];
  for (const op of ops) {
    const last = out[out.length - 1];
    if (last && last.type === 'insert' && op.type === 'insert' && last.block === op.block && op.offset === last.offset + runsLength(last.runs)) {
      out[out.length - 1] = { ...last, runs: normalizeRuns([...last.runs, ...op.runs]) };
      continue;
    }
    if (last && last.type === 'remove' && op.type === 'remove' && last.block === op.block) {
      if (op.offset + runsLength(op.runs) === last.offset) {
        // Backspace: the new removal sits just before the previous one.
        out[out.length - 1] = { ...last, offset: op.offset, runs: normalizeRuns([...op.runs, ...last.runs]) };
        continue;
      }
      if (op.offset === last.offset) {
        // Forward delete: the new removal starts where the previous one did.
        out[out.length - 1] = { ...last, runs: normalizeRuns([...last.runs, ...op.runs]) };
        continue;
      }
    }
    out.push(op);
  }
  return out;
}
