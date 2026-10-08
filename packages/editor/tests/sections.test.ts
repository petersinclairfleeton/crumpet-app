import { describe, expect, it } from 'vitest';
import { caret, makeBlock, tidyPara } from '../src/model';
import { applyOps } from '../src/ops';
import { splitBlock } from '../src/commands';
import { fromMarkdown, toMarkdown } from '../src/markdown';

describe('section breaks', () => {
  it('are kept in the file with their columns and orientation', () => {
    const doc = { blocks: [makeBlock('paragraph', 'One'), { ...makeBlock('paragraph', 'Two'), para: { sect: 'cont' as const, cols: 2 } }, { ...makeBlock('heading1', 'Wide'), para: { sect: 'page' as const, orient: 'landscape' as const } }] };
    const md = toMarkdown(doc);
    expect(md).toContain('Two {sect=cont cols=2}');
    expect(md).toContain('# Wide {sect=page orient=landscape}');
    expect(fromMarkdown(md).blocks.map((b) => b.para)).toEqual([undefined, { sect: 'cont', cols: 2 }, { sect: 'page', orient: 'landscape' }]);
  });

  it('columns and orientation mean nothing without a break, and Enter doesn’t make another break', () => {
    expect(tidyPara({ cols: 2, orient: 'landscape' })).toBeUndefined();
    expect(tidyPara({ sect: 'page', cols: 9 })).toEqual({ sect: 'page', cols: 4 });
    const doc = { blocks: [{ ...makeBlock('paragraph', 'Start'), para: { sect: 'page' as const, cols: 2, line: 2 } }] };
    const next = applyOps(doc, splitBlock({ doc, selection: caret({ block: doc.blocks[0].id, offset: 5 }), storedMarks: null }).ops);
    expect(next.blocks[1].para).toEqual({ line: 2 });
  });
});
