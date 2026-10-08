import { describe, expect, it } from 'vitest';
import { makeBlock } from '@crumpet/editor/model';
import { REVISIONS, hasRevisions, removeRevisionColors } from '../../src/data/revisions';

describe('revision colours', () => {
  it('takes off revision colours, all rounds or one, keeping other looks', () => {
    const b = makeBlock('paragraph', '');
    b.runs = [
      { text: 'Kept ', marks: [] },
      { text: 'first ', marks: [], look: { color: REVISIONS[0].color } },
      { text: 'second', marks: ['bold'], look: { color: REVISIONS[1].color, size: 14 } },
      { text: ' red', marks: [], look: { color: '#ff0000' } },
    ];
    const doc = { blocks: [b] };
    expect(hasRevisions(doc)).toBe(true);
    const one = removeRevisionColors(doc, 1);
    expect(one.blocks[0].runs.map((r) => r.look)).toEqual([undefined, undefined, { color: REVISIONS[1].color, size: 14 }, { color: '#ff0000' }]);
    const all = removeRevisionColors(doc);
    expect(all.blocks[0].runs.map((r) => r.look)).toEqual([undefined, undefined, { size: 14 }, { color: '#ff0000' }]);
    expect(hasRevisions(all)).toBe(false);
    expect(removeRevisionColors(all)).toBe(all);
  });
});
