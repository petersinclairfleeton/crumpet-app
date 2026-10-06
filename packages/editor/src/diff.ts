// Turning one document into another with ordinary ops. Used when a note
// changes outside the editor (a file edited on another device): applying the
// difference as ops, instead of replacing the document, keeps the caret next
// to the same text and keeps undo working.

import { type Block, type Doc, MARK_ORDER, type Run, blockIndex, getBlock, newId, runsLength, runsText, setMarkOnRuns, sliceRuns } from './model';
import { type Op, applyOp, attrsOf, sameAttrs } from './ops';

/**
 * `next` with the ids of `prev`'s blocks wherever a block carries on: blocks
 * that are unchanged, and blocks edited in place between unchanged ones.
 */
export function matchIds(prev: Doc, next: Doc): Doc {
  const a = prev.blocks;
  const b = next.blocks;
  const key = (x: Block) => `${x.type}|${x.checked ? 1 : 0}|${x.indent ?? 0}|${JSON.stringify(x.runs)}`;
  // Longest common subsequence of identical blocks.
  const n = a.length;
  const m = b.length;
  const ka = a.map(key);
  const kb = b.map(key);
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = ka[i] === kb[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const ids: (string | null)[] = new Array(m).fill(null);
  const pairGap = (i0: number, i1: number, j0: number, j1: number) => {
    // Blocks between two unchanged ones were edited in place, in order.
    for (let k = 0; k < Math.min(i1 - i0, j1 - j0); k++) ids[j0 + k] = a[i0 + k].id;
  };
  let i = 0;
  let j = 0;
  let gi = 0;
  let gj = 0;
  while (i < n && j < m) {
    if (ka[i] === kb[j]) {
      pairGap(gi, i, gj, j);
      ids[j] = a[i].id;
      i++;
      j++;
      gi = i;
      gj = j;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  pairGap(gi, n, gj, m);
  const used = new Set<string>();
  return {
    blocks: b.map((x, k) => {
      const id = ids[k];
      if (id && !used.has(id)) {
        used.add(id);
        return { ...x, id };
      }
      return a.some((y) => y.id === x.id) ? { ...x, id: newId() } : x;
    }),
  };
}

/**
 * Ops that turn `from` into a document with `to`'s content, and that
 * document. Blocks are matched by id (see matchIds); the result has `to`'s
 * ids except where a first block had to be removed.
 */
export function diffDocs(from: Doc, to: Doc): { ops: Op[]; doc: Doc } {
  const ops: Op[] = [];
  let doc = from;
  const apply = (op: Op) => {
    doc = applyOp(doc, op);
    ops.push(op);
  };
  const has = (id: string) => doc.blocks.some((x) => x.id === id);
  // A block that had to move out of the way keeps its content under another id.
  const alias = new Map<string, string>();
  const real = (id: string) => alias.get(id) ?? id;

  let prev: string | null = null;
  for (const target of to.blocks) {
    let id = target.id;
    if (!has(real(id))) {
      if (prev !== null) {
        const p = getBlock(doc, prev);
        apply({ type: 'split', block: prev, offset: runsLength(p.runs), newBlock: id, newAttrs: attrsOf(target) });
      } else {
        // A new first block: split the current first block at its start, so it
        // becomes the new empty block and its content moves to a fresh id.
        const first = doc.blocks[0];
        const fresh = newId();
        apply({ type: 'split', block: first.id, offset: 0, newBlock: fresh, newAttrs: attrsOf(first) });
        for (const [k, v] of alias) if (v === first.id) alias.set(k, fresh);
        alias.set(first.id, fresh);
        alias.set(id, first.id);
      }
    }
    id = real(id);
    editBlock(() => doc, id, target, apply);
    prev = id;
  }
  // Remove what's left over, last first, by joining each (emptied) block onto the one above.
  const keep = new Set(to.blocks.map((x) => real(x.id)));
  for (const x of [...doc.blocks].reverse()) {
    if (keep.has(x.id)) continue;
    const i = blockIndex(doc, x.id);
    const cur = doc.blocks[i];
    if (runsLength(cur.runs)) apply({ type: 'remove', block: cur.id, offset: 0, runs: cur.runs });
    if (i > 0) {
      const above = doc.blocks[i - 1];
      apply({ type: 'join', block: above.id, second: cur.id, offset: runsLength(above.runs), secondAttrs: attrsOf(cur) });
    } else {
      // The first block: it takes on the next block's attributes and content.
      const next = doc.blocks[1];
      if (!sameAttrs(cur, next)) apply({ type: 'setAttrs', block: cur.id, from: attrsOf(cur), to: attrsOf(next) });
      apply({ type: 'join', block: cur.id, second: next.id, offset: 0, secondAttrs: attrsOf(next) });
      for (const [k, v] of alias) if (v === next.id) alias.set(k, cur.id);
      keep.add(cur.id);
    }
  }
  return { ops, doc };
}

/** Ops that make block `id` look like `target`: attributes, text, then formatting. */
function editBlock(doc: () => Doc, id: string, target: Block, apply: (op: Op) => void): void {
  let cur = getBlock(doc(), id);
  if (!sameAttrs(cur, target)) apply({ type: 'setAttrs', block: id, from: attrsOf(cur), to: attrsOf(target) });
  const a = runsText(cur.runs);
  const b = runsText(target.runs);
  if (a !== b) {
    let p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    let s = 0;
    while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    if (a.length - s > p) apply({ type: 'remove', block: id, offset: p, runs: sliceRuns(cur.runs, p, a.length - s) });
    if (b.length - s > p) apply({ type: 'insert', block: id, offset: p, runs: sliceRuns(target.runs, p, b.length - s) });
  }
  // Formatting, one mark at a time, then links.
  const len = b.length;
  const at = (runs: Run[], i: number) => sliceRuns(runs, i, i + 1)[0];
  for (const mark of MARK_ORDER) {
    for (let i = 0; i < len; ) {
      cur = getBlock(doc(), id);
      const want = at(target.runs, i).marks.includes(mark);
      if (at(cur.runs, i).marks.includes(mark) === want) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < len && at(target.runs, j).marks.includes(mark) === want && at(cur.runs, j).marks.includes(mark) !== want) j++;
      const before = sliceRuns(cur.runs, i, j);
      apply({ type: 'format', block: id, offset: i, before, after: setMarkOnRuns(before, mark, want), mark, on: want });
      i = j;
    }
  }
  for (let i = 0; i < len; ) {
    cur = getBlock(doc(), id);
    const want = at(target.runs, i).link ?? null;
    if ((at(cur.runs, i).link ?? null) === want) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < len && (at(target.runs, j).link ?? null) === want && (at(cur.runs, j).link ?? null) !== want) j++;
    const before = sliceRuns(cur.runs, i, j);
    apply({ type: 'format', block: id, offset: i, before, after: before.map((r) => (want ? { ...r, link: want } : { text: r.text, marks: r.marks })), link: want });
    i = j;
  }
}
