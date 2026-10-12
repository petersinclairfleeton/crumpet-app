import { describe, expect, it } from 'vitest';
import { lookValueOk, makeBlock } from '../src/model';
import { fromMarkdown, toMarkdown } from '../src/markdown';

describe('Word’s Font window settings', () => {
  it('are saved on the text and read back', () => {
    const p = makeBlock('paragraph', '');
    p.runs = [{ text: 'Small caps, wavy and spaced', marks: [], look: { caps: 'small', ul: 'wavy', ulc: '#c0392b', sp: 1.5, pos: -2, dstrike: 1, hidden: 1, nokern: 1, lig: 'none', num: 'oldstyle', nsp: 'tabular', ss: 3, fx: 'shadow' } }];
    const md = toMarkdown({ blocks: [p] });
    expect(md).toBe('[Small caps, wavy and spaced]{caps=small dstrike=1 hidden=1 ul=wavy ulc=#c0392b sp=1.5 pos=-2 nokern=1 lig=none num=oldstyle nsp=tabular ss=3 fx=shadow}\n');
    expect(fromMarkdown(md).blocks[0].runs[0].look).toEqual(p.runs[0].look);
  });

  it('only take values Crumpet knows', () => {
    expect(lookValueOk('ul', 'zigzag')).toBe(false);
    expect(lookValueOk('sp', 0)).toBe(false);
    expect(lookValueOk('ss', 21)).toBe(false);
    expect(fromMarkdown('[x]{ul=zigzag}\n').blocks[0].runs[0].look).toBeUndefined();
  });
});
