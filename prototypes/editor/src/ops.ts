// Operations: the only way the document changes. Each one is small,
// serialisable and has an exact inverse, which gives us undo/redo now and a
// unit to send between devices for sync later.

import {
  type BlockAttrs,
  type BlockType,
  type Doc,
  type Run,
  blockIndex,
  insertRuns,
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
  /** Replace formatting on a span; `before` and `after` hold the same text. */
  | { type: 'format'; block: string; offset: number; before: Run[]; after: Run[] };

export class OpError extends Error {}

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new OpError(msg);
}

function attrsOf(b: BlockAttrs): BlockAttrs {
  return b.type === 'todo' ? { type: b.type, checked: !!b.checked } : { type: b.type };
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
      return { type: 'format', block: op.block, offset: op.offset, before: op.after, after: op.before };
  }
}

export function applyOps(doc: Doc, ops: Op[]): Doc {
  return ops.reduce(applyOp, doc);
}

export function invertOps(ops: Op[]): Op[] {
  return ops.slice().reverse().map(invertOp);
}

export function blockAttrs(type: BlockType, checked?: boolean): BlockAttrs {
  return type === 'todo' ? { type, checked: !!checked } : { type };
}
