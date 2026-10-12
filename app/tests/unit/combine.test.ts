import { describe, expect, it } from 'vitest';
import { changes, makeBlock, runsText } from '@crumpet/editor/model';
import { combinedComparison } from '../../src/data/compare';

const doc = (...lines: string[]) => ({ blocks: lines.map((l) => makeBlock('paragraph', l)) });

describe('combining reviewers’ copies', () => {
  it('puts each reviewer’s changes in their name into the original', () => {
    const original = doc('The big sea was grey.', 'Gulls cried.');
    const ann = doc('The wide sea was grey.', 'Gulls cried.');
    const ben = doc('The big sea was grey and cold.', 'Gulls cried overhead.');
    const out = combinedComparison(original, [
      { doc: ann, author: 'Ann' },
      { doc: ben, author: 'Ben' },
    ]);
    const list = changes(out).map((c) => [c.change.kind, c.change.author, runsText(out.blocks.find((b) => b.id === c.block)!.runs).slice(c.from, c.to)]);
    expect(list).toEqual([
      ['del', 'Ann', 'big'],
      ['ins', 'Ann', 'wide'],
      ['ins', 'Ben', ' and cold'],
      ['ins', 'Ben', ' overhead'],
    ]);
    // Accepting everything gives each reviewer's edits together; the original's words are all still there.
    expect(out.blocks.map((b) => runsText(b.runs.filter((r) => r.change?.kind !== 'ins')))).toEqual(['The big sea was grey.', 'Gulls cried.']);
  });

  it('a copy with a new paragraph: a tracked paragraph break in that reviewer’s name', () => {
    const out = combinedComparison(doc('One.'), [{ doc: doc('One.', 'Two.'), author: 'Cy' }]);
    expect(out.blocks).toHaveLength(2);
    expect(out.blocks[1].brk).toMatchObject({ kind: 'ins', author: 'Cy' });
  });
});
