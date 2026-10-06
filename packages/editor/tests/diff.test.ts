import { describe, expect, it } from 'vitest';
import { type Block, type BlockType, type Doc, MARK_ORDER, type Run, makeBlock, normalizeRuns } from '../src/model';
import { applyOps, attrsOf, invertOps } from '../src/ops';
import { diffDocs, matchIds } from '../src/diff';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const TYPES: BlockType[] = ['paragraph', 'paragraph', 'heading1', 'heading2', 'quote', 'bullet', 'numbered', 'todo'];
const WORDS = ['a', 'b', 'cd', ' ', 'xy z', 'é'];

function randomRuns(rand: () => number): Run[] {
  const runs: Run[] = [];
  const n = Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const marks = MARK_ORDER.filter(() => rand() < 0.25);
    const link = rand() < 0.15 ? (rand() < 0.5 ? 'https://a.com/' : 'https://b.com/') : undefined;
    const text = WORDS[Math.floor(rand() * WORDS.length)] + WORDS[Math.floor(rand() * WORDS.length)];
    runs.push(link ? { text, marks, link } : { text, marks });
  }
  return normalizeRuns(runs);
}

function randomBlock(rand: () => number): Block {
  const type = TYPES[Math.floor(rand() * TYPES.length)];
  const b = makeBlock(type, '', [], { indent: Math.floor(rand() * 3), checked: rand() < 0.5 });
  b.runs = randomRuns(rand);
  return b;
}

/** A random edit of `doc`: some blocks kept, some changed, some removed, some added. */
function edited(doc: Doc, rand: () => number): Doc {
  const out: Block[] = [];
  for (const b of doc.blocks) {
    const r = rand();
    if (r < 0.15) continue;
    if (r < 0.3) out.push(randomBlock(rand));
    else if (r < 0.45) out.push({ ...randomBlock(rand), type: b.type, runs: normalizeRuns([...b.runs, ...randomRuns(rand)]) });
    else out.push({ ...b, id: `copy-${b.id}` });
    if (rand() < 0.15) out.push(randomBlock(rand));
  }
  if (!out.length || rand() < 0.2) out.unshift(randomBlock(rand));
  return { blocks: out };
}

const content = (d: Doc) => d.blocks.map((b) => ({ ...attrsOf(b), runs: b.runs }));

describe('matchIds', () => {
  it('keeps ids of unchanged and edited-in-place blocks', () => {
    const a: Doc = { blocks: [makeBlock('paragraph', 'one'), makeBlock('paragraph', 'two'), makeBlock('paragraph', 'three')] };
    const b = matchIds(a, { blocks: [makeBlock('paragraph', 'one'), makeBlock('paragraph', 'two, edited'), makeBlock('paragraph', 'new'), makeBlock('paragraph', 'three')] });
    expect(b.blocks.map((x) => x.id)).toEqual([a.blocks[0].id, a.blocks[1].id, b.blocks[2].id, a.blocks[2].id]);
    expect(a.blocks.map((x) => x.id)).not.toContain(b.blocks[2].id);
  });
});

describe('diffDocs', () => {
  it('turns one document into another, in ops that undo cleanly', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const rand = rng(seed);
      const a: Doc = { blocks: Array.from({ length: 1 + Math.floor(rand() * 6) }, () => randomBlock(rand)) };
      let b = edited(a, rand);
      if (rand() < 0.5) b = matchIds(a, b);
      const { ops, doc } = diffDocs(a, b);
      expect(content(doc), `seed ${seed}`).toEqual(content(b));
      expect(applyOps(a, ops)).toEqual(doc);
      expect(content(applyOps(doc, invertOps(ops))), `seed ${seed} (undo)`).toEqual(content(a));
      // With matched ids, nothing changes identity except a removed first block.
      if (b.blocks[0].id === a.blocks[0].id) expect(doc.blocks.map((x) => x.id)).toEqual(b.blocks.map((x) => x.id));
    }
  });

  it('makes no ops for the same document', () => {
    const a: Doc = { blocks: [makeBlock('paragraph', 'same', ['bold'])] };
    expect(diffDocs(a, a).ops).toEqual([]);
  });
});
