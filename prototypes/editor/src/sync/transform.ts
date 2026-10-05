// Rebasing local edits onto other devices' edits.
//
// A device has pending edits L0..Ln made on top of the last document the
// server confirmed (`base`). Meanwhile the server accepted other devices'
// edits R. To send ours, each Li is rewritten to apply after R and after the
// already-rewritten L0'..L(i-1)'. Every position Li mentions is mapped:
//
//   back through our own earlier edits (undoing them)  ->  base
//   forward through R                                   ->  base + R
//   forward through our rewritten earlier edits         ->  base + R + L'<i
//
// Undoing our own insert would lose positions inside the text we typed, so
// those are remembered and restored when the rewritten insert is replayed
// ("mirroring"). Then the op's data (removed text, formatting, offsets) is
// re-read from the document it will actually apply to. Ops that no longer
// make sense, such as retyping a block the other side merged away, drop out.
//
// The server's order is the only truth: every device applies the same ops in
// the same order, so they always end up identical. This file only has to make
// the rewritten edits land where the person meant them.

import { type Doc, type Pos, type Selection, blockIndex, getBlock, runsLength, setMarkOnRuns, sliceRuns } from '../model';
import { type Op, applyOp, blockAttrs, invertOp } from '../ops';

type Assoc = -1 | 1;

/** Moves a position (in the document before `op`) to the document after it. */
export function mapPos(p: Pos, op: Op, assoc: Assoc): Pos {
  switch (op.type) {
    case 'insert': {
      if (p.block !== op.block) return p;
      const len = runsLength(op.runs);
      if (p.offset > op.offset || (p.offset === op.offset && assoc > 0)) return { block: p.block, offset: p.offset + len };
      return p;
    }
    case 'remove': {
      if (p.block !== op.block) return p;
      const len = runsLength(op.runs);
      if (p.offset >= op.offset + len) return { block: p.block, offset: p.offset - len };
      if (p.offset > op.offset) return { block: p.block, offset: op.offset };
      return p;
    }
    case 'split': {
      if (p.block !== op.block) return p;
      if (p.offset > op.offset || (p.offset === op.offset && assoc > 0)) return { block: op.newBlock, offset: p.offset - op.offset };
      return p;
    }
    case 'join':
      return p.block === op.second ? { block: op.block, offset: op.offset + p.offset } : p;
    default:
      return p;
  }
}

export function mapPosThrough(p: Pos, ops: Op[], assoc: Assoc): Pos {
  return ops.reduce((pos, op) => mapPos(pos, op, assoc), p);
}

interface Step {
  op: Op;
  /** This step undoes our own edit number k. */
  undoOf?: number;
  /** This step replays our rewritten edit number k. */
  redoOf?: number;
}

/** Maps a position through the steps, restoring positions inside our own typed text (see top of file). */
function mapThrough(start: Pos, steps: Step[], assoc: Assoc): Pos {
  let p = start;
  const remembered = new Map<number, number>();
  for (const s of steps) {
    const op = s.op;
    if (s.undoOf !== undefined && op.type === 'remove' && p.block === op.block) {
      // Undoing our insert: remember where inside (or at the edges of) that text we were.
      const len = runsLength(op.runs);
      if (p.offset >= op.offset && p.offset <= op.offset + len) remembered.set(s.undoOf, p.offset - op.offset);
    }
    if (s.redoOf !== undefined && op.type === 'insert' && remembered.has(s.redoOf)) {
      p = { block: op.block, offset: op.offset + remembered.get(s.redoOf)! };
      remembered.delete(s.redoOf);
      continue;
    }
    p = mapPos(p, op, assoc);
  }
  return p;
}

function has(doc: Doc, id: string): boolean {
  return doc.blocks.some((b) => b.id === id);
}

function clamp(doc: Doc, p: Pos): Pos {
  return { block: p.block, offset: Math.min(p.offset, runsLength(getBlock(doc, p.block).runs)) };
}

/** Every block span covered by a range, in document order (empty if the range has collapsed or inverted). */
function spans(doc: Doc, from: Pos, to: Pos): { id: string; from: number; to: number }[] {
  if (!has(doc, from.block) || !has(doc, to.block)) return [];
  const i = blockIndex(doc, from.block);
  const j = blockIndex(doc, to.block);
  if (i > j) return [];
  const out = [];
  for (let k = i; k <= j; k++) {
    const b = doc.blocks[k];
    const len = runsLength(b.runs);
    const s = k === i ? Math.min(from.offset, len) : 0;
    const e = k === j ? Math.min(to.offset, len) : len;
    if (e > s) out.push({ id: b.id, from: s, to: e });
  }
  return out;
}

type MapFn = (p: Pos, assoc: Assoc) => Pos;

/** Rewrites one op using a position mapping, re-reading its data from `target`. Returns zero or more ops. */
export function materialise(op: Op, map: MapFn, target: Doc): Op[] {
  switch (op.type) {
    case 'insert': {
      // Our text goes after anything the other side inserted at the same spot.
      const p = map({ block: op.block, offset: op.offset }, 1);
      if (!has(target, p.block)) return [];
      const at = clamp(target, p);
      return [{ type: 'insert', block: at.block, offset: at.offset, runs: op.runs }];
    }
    case 'remove': {
      // Shrink inward so text the other side added at either edge survives.
      const from = map({ block: op.block, offset: op.offset }, 1);
      const to = map({ block: op.block, offset: op.offset + runsLength(op.runs) }, -1);
      // Back to front, so earlier spans' offsets stay valid. Never joins blocks the other side split.
      return spans(target, from, to)
        .reverse()
        .map((s) => ({ type: 'remove' as const, block: s.id, offset: s.from, runs: sliceRuns(getBlock(target, s.id).runs, s.from, s.to) }));
    }
    case 'split': {
      if (has(target, op.newBlock)) return [];
      const p = map({ block: op.block, offset: op.offset }, 1);
      if (!has(target, p.block)) return [];
      const at = clamp(target, p);
      return [{ type: 'split', block: at.block, offset: at.offset, newBlock: op.newBlock, newAttrs: op.newAttrs }];
    }
    case 'join': {
      // Intent: "append this block onto whatever block is now directly above it".
      if (!has(target, op.second)) return [];
      const i = blockIndex(target, op.second);
      if (i === 0) return [];
      const prev = target.blocks[i - 1];
      const second = target.blocks[i];
      return [{ type: 'join', block: prev.id, second: second.id, offset: runsLength(prev.runs), secondAttrs: blockAttrs(second.type, second.checked) }];
    }
    case 'setAttrs': {
      if (!has(target, op.block)) return [];
      const b = getBlock(target, op.block);
      const from = blockAttrs(b.type, b.checked);
      if (from.type === op.to.type && !!from.checked === !!op.to.checked) return [];
      return [{ type: 'setAttrs', block: op.block, from, to: op.to }];
    }
    case 'format': {
      const from = map({ block: op.block, offset: op.offset }, 1);
      const to = map({ block: op.block, offset: op.offset + runsLength(op.before) }, -1);
      return spans(target, from, to).map((s) => {
        const before = sliceRuns(getBlock(target, s.id).runs, s.from, s.to);
        return { type: 'format' as const, block: s.id, offset: s.from, before, after: setMarkOnRuns(before, op.mark, op.on), mark: op.mark, on: op.on };
      });
    }
  }
}

export interface Rebased {
  /** Our pending edits, rewritten to apply after `remote`. */
  local: Op[];
  /** base + remote + local. */
  doc: Doc;
  /** Moves a selection from our old document (base + old local) into `doc`. */
  mapSelection(sel: Selection): Selection;
  /** Local ops that could not be applied after rewriting (should stay 0). */
  dropped: number;
}

export function rebase(base: Doc, local: Op[], remote: Op[]): Rebased {
  let target = remote.reduce(applyOp, base);
  const rewritten: Op[][] = [];
  let dropped = 0;
  const stepsBefore = (i: number): Step[] => {
    const steps: Step[] = [];
    for (let k = i - 1; k >= 0; k--) steps.push({ op: invertOp(local[k]), undoOf: k });
    for (const op of remote) steps.push({ op });
    rewritten.forEach((ops, k) => ops.forEach((op) => steps.push({ op, redoOf: k })));
    return steps;
  };
  local.forEach((op, i) => {
    const steps = stepsBefore(i);
    const out: Op[] = [];
    for (const candidate of materialise(op, (p, a) => mapThrough(p, steps, a), target)) {
      try {
        target = applyOp(target, candidate);
        out.push(candidate);
      } catch {
        dropped += 1;
      }
    }
    rewritten.push(out);
  });
  const all = stepsBefore(local.length);
  const mapSel = (p: Pos): Pos => {
    const m = mapThrough(p, all, -1);
    if (has(target, m.block)) return clamp(target, m);
    return { block: target.blocks[0].id, offset: 0 };
  };
  return {
    local: rewritten.flat(),
    doc: target,
    dropped,
    mapSelection: (sel) => ({ anchor: mapSel(sel.anchor), focus: mapSel(sel.focus) }),
  };
}
