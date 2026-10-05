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

import { type Doc, type Pos, type Selection, blockIndex, getBlock, runsLength, runsText, setMarkOnRuns, sliceRuns } from '../model';
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

/**
 * One change in a sequence of changes. Tags pair up "undo our insert" with
 * "replay our rewritten insert", so positions inside our own text survive the round trip.
 */
export interface Step {
  op: Op;
  undoOf?: string;
  redoOf?: string;
}

export function stepsOf(ops: Op[]): Step[] {
  return ops.map((op) => ({ op }));
}

/**
 * Steps for one pass of an edit's undo/redo lineage (generation 0 = the edit, 1 = its undo,
 * 2 = its redo, ...). What a pass removes is remembered and restored only if the *next* pass puts
 * it back, never by an insert in the same pass (typing over a selection is not an undo).
 */
export function taggedSteps(ops: Op[], tag: string, generation: number): Step[] {
  return ops.map((op) =>
    op.type === 'remove' || op.type === 'join'
      ? { op, undoOf: `${tag}:${generation}` }
      : op.type === 'insert' || op.type === 'split'
        ? { op, redoOf: `${tag}:${generation - 1}` }
        : { op },
  );
}

type Memory =
  /** `at` is the paragraph the text was removed from, kept up to date as later steps move it. */
  | { kind: 'text'; delta: number; text: string; at: Anchor }
  | { kind: 'break'; second: string; inSecond: boolean; delta: number };

/** Where some removed text belongs. `origin` remembers a paragraph that was merged away, so it can go back. */
interface Anchor {
  block: string;
  offset: number;
  origin?: string;
}

function mapAnchor(a: Anchor, op: Op): Anchor {
  if (op.type === 'join' && a.block === op.second) return { block: op.block, offset: op.offset + a.offset, origin: op.second };
  if (op.type === 'split' && a.origin === op.newBlock && a.block === op.block) {
    return { block: op.newBlock, offset: Math.max(0, a.offset - op.offset) };
  }
  const p = mapPos(a, op, -1);
  return { block: p.block, offset: p.offset, origin: a.origin };
}

/**
 * Maps a position through the steps. When a tagged step removes something that a
 * later step with the same tag puts back (our own text, or a paragraph break), the
 * position is restored to where it was relative to it, instead of being squashed.
 */
export function mapThrough(start: Pos, steps: Step[], assoc: Assoc): Pos {
  let p = start;
  // Memories in the order they were made. Restoring one makes everything remembered after it
  // stale (those described the position after it had moved away), so they are dropped.
  const memories: { tag: string; m: Memory }[] = [];
  const recall = (tag: string, match: (m: Memory) => boolean): Memory | undefined => {
    for (let i = memories.length - 1; i >= 0; i--) {
      if (memories[i].tag === tag && match(memories[i].m)) {
        const { m } = memories[i];
        memories.length = i;
        return m;
      }
    }
    return undefined;
  };
  for (const s of steps) {
    const op = s.op;
    let restored: Pos | null = null;
    if (s.redoOf !== undefined && op.type === 'insert') {
      const text = runsText(op.runs);
      // A position that was inside (or at the end of) the text goes back inside it. One that was
      // at its very start only goes back if nothing else was inserted in front of the text meanwhile.
      // The text must come back into the paragraph it was taken from: equal text elsewhere is a different piece.
      const atStart = p.block === op.block && p.offset === op.offset;
      const back = recall(
        s.redoOf,
        (m) => m.kind === 'text' && m.text === text && m.at.block === op.block && (m.delta > 0 || atStart),
      );
      if (back && back.kind === 'text') restored = { block: op.block, offset: op.offset + back.delta };
    } else if (s.redoOf !== undefined && op.type === 'split') {
      const back = recall(s.redoOf, (m) => m.kind === 'break' && m.second === op.newBlock);
      // The same paragraph break came back: put the position back on the side it was on.
      if (back && back.kind === 'break') restored = back.inSecond ? { block: op.newBlock, offset: back.delta } : { block: op.block, offset: op.offset };
    }
    if (s.undoOf !== undefined) {
      if (op.type === 'remove' && p.block === op.block) {
        const len = runsLength(op.runs);
        if (p.offset >= op.offset && p.offset <= op.offset + len) {
          memories.push({ tag: s.undoOf, m: { kind: 'text', delta: p.offset - op.offset, text: runsText(op.runs), at: { block: op.block, offset: op.offset } } });
        }
      } else if (op.type === 'join') {
        if (p.block === op.second) memories.push({ tag: s.undoOf, m: { kind: 'break', second: op.second, inSecond: true, delta: p.offset } });
        else if (p.block === op.block && p.offset === op.offset) memories.push({ tag: s.undoOf, m: { kind: 'break', second: op.second, inSecond: false, delta: p.offset } });
      }
    }
    // Keep each remembered removal point up to date (the step that made it is already accounted for).
    for (const { m } of memories) {
      if (m.kind === 'text') m.at = mapAnchor(m.at, op);
    }
    p = restored ?? mapPos(p, op, assoc);
  }
  return p;
}

/** Maps a selection through steps into `doc`, falling back to the start of the note if its block is gone. */
export function mapSelectionThrough(sel: Selection, steps: Step[], doc: Doc): Selection {
  const one = (p: Pos): Pos => {
    const m = mapThrough(p, steps, -1);
    return has(doc, m.block) ? clamp(doc, m) : { block: doc.blocks[0].id, offset: 0 };
  };
  return { anchor: one(sel.anchor), focus: one(sel.focus) };
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
      // If the text underneath is exactly as it was, apply the exact formatting (keeps mixed formatting on undo).
      if (from.block === to.block && has(target, from.block) && to.offset - from.offset === runsLength(op.before)) {
        const now = sliceRuns(getBlock(target, from.block).runs, from.offset, to.offset);
        if (JSON.stringify(now) === JSON.stringify(op.before)) return [{ ...op, block: from.block, offset: from.offset }];
      }
      return spans(target, from, to).map((s) => {
        const before = sliceRuns(getBlock(target, s.id).runs, s.from, s.to);
        return { type: 'format' as const, block: s.id, offset: s.from, before, after: setMarkOnRuns(before, op.mark, op.on), mark: op.mark, on: op.on };
      });
    }
  }
}

export interface Rebased {
  /** The local ops, rewritten to apply after the other changes. */
  local: Op[];
  /** base + other changes + rewritten local ops. */
  doc: Doc;
  /** Steps that turn the old document (base + old local) into `doc`, for moving carets and undo history. */
  steps: Step[];
  /** Local ops that could not be applied after rewriting (should stay 0). */
  dropped: number;
}

let tagCounter = 0;

/**
 * Rewrites `local` (sequential ops made on `base`) to apply after `other`
 * (steps that also start from `base`). Used for pending sync edits and for undo.
 */
export function rebaseSteps(base: Doc, local: Op[], other: Step[]): Rebased {
  let target = other.reduce((d, s) => applyOp(d, s.op), base);
  const prefix = `t${++tagCounter}:`;
  const rewritten: Op[][] = [];
  let dropped = 0;
  const stepsBefore = (i: number): Step[] => {
    const steps: Step[] = [];
    for (let k = i - 1; k >= 0; k--) steps.push({ op: invertOp(local[k]), undoOf: prefix + k });
    steps.push(...other);
    rewritten.forEach((ops, k) => ops.forEach((op) => steps.push({ op, redoOf: prefix + k })));
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
  return { local: rewritten.flat(), doc: target, steps: stepsBefore(local.length), dropped };
}

export function rebase(base: Doc, local: Op[], remote: Op[]): Rebased {
  return rebaseSteps(base, local, stepsOf(remote));
}
