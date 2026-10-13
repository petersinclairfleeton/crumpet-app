import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { applyOps, invertOps } from '../src/ops';
import { moveBlocks, sectionOf, shiftLevel } from '../src/commands';
import type { Doc } from '../src/model';

const state = (doc: Doc, i = 0) => ({ doc, selection: { anchor: { block: doc.blocks[i].id, offset: 0 }, focus: { block: doc.blocks[i].id, offset: 0 } }, storedMarks: null });
const md = '# One\n\nA\n\n## Sub\n\nB\n\n# Two\n\nC\n';

describe('outline view', () => {
  it('finds a heading’s section', () => {
    const doc = fromMarkdown(md);
    expect(sectionOf(doc, doc.blocks[0].id)).toHaveLength(4);
    expect(sectionOf(doc, doc.blocks[2].id)).toHaveLength(2);
    expect(sectionOf(doc, doc.blocks[1].id)).toEqual([doc.blocks[1].id]);
  });

  it('moves a heading with its section before another, or to the end, and undoes', () => {
    const doc = fromMarkdown(md);
    const two = sectionOf(doc, doc.blocks[4].id);
    const t = moveBlocks(state(doc), two, doc.blocks[0].id)!;
    const moved = applyOps(doc, t.ops);
    expect(toMarkdown(moved)).toBe('# Two\n\nC\n\n# One\n\nA\n\n## Sub\n\nB\n');
    expect(toMarkdown(applyOps(moved, invertOps(t.ops)))).toBe(md);
    const t2 = moveBlocks(state(doc), sectionOf(doc, doc.blocks[0].id), null)!;
    expect(toMarkdown(applyOps(doc, t2.ops))).toBe('# Two\n\nC\n\n# One\n\nA\n\n## Sub\n\nB\n');
    // Nowhere to go: right where it is.
    expect(moveBlocks(state(doc), [doc.blocks[1].id], doc.blocks[2].id)).toBeNull();
  });

  it('promotes and demotes: headings a level, body text to a heading under the one above, Heading 4 to body text', () => {
    const doc = fromMarkdown(md);
    expect(applyOps(doc, shiftLevel(state(doc, 2), -1).ops).blocks[2].type).toBe('heading1');
    expect(applyOps(doc, shiftLevel(state(doc, 0), 1).ops).blocks[0].type).toBe('heading2');
    expect(applyOps(doc, shiftLevel(state(doc, 3), -1).ops).blocks[3].type).toBe('heading3');
    expect(applyOps(doc, shiftLevel(state(doc, 0), 1, true).ops).blocks[0].type).toBe('paragraph');
    const h4 = fromMarkdown('#### Deep\n');
    expect(applyOps(h4, shiftLevel(state(h4), 1).ops).blocks[0].type).toBe('paragraph');
  });
});
