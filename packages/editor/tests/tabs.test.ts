import { describe, expect, it } from 'vitest';
import { makeBlock, tabsFromText, tabsToText, tidyTabs } from '../src/model';
import { fromMarkdown, toMarkdown } from '../src/markdown';

describe('tab stops', () => {
  it('are tidied: in order, one per spot, known kinds only', () => {
    expect(tidyTabs([{ at: 3, align: 'right', leader: 'dot' }, { at: 1.5, align: 'left' }, { at: 1.501, align: 'center' }, { at: -1, align: 'left' }])).toEqual([
      { at: 1.5, align: 'left' },
      { at: 3, align: 'right', leader: 'dot' },
    ]);
    expect(tidyTabs([])).toBeUndefined();
  });

  it('are written short and read back', () => {
    const tabs = tidyTabs([{ at: 1.5, align: 'left' }, { at: 3, align: 'center' }, { at: 6.5, align: 'right', leader: 'dot' }, { at: 4.25, align: 'decimal', leader: 'line' }])!;
    expect(tabsToText(tabs)).toBe('1.5,c3,d4.25line,r6.5dot');
    expect(tabsFromText('1.5,c3,d4.25line,r6.5dot')).toEqual(tabs);
  });

  it('are saved at the end of the paragraph’s line, tabs in the text as &#9;', () => {
    const b = makeBlock('paragraph', 'Name\tPage', [], { para: { tabs: [{ at: 6, align: 'right', leader: 'dot' }] } });
    const md = toMarkdown({ blocks: [b] });
    expect(md).toBe('Name&#9;Page {tabs=r6dot}\n');
    const back = fromMarkdown(md).blocks[0];
    expect(back.runs[0].text).toBe('Name\tPage');
    expect(back.para?.tabs).toEqual([{ at: 6, align: 'right', leader: 'dot' }]);
    // With other settings too.
    const md2 = toMarkdown({ blocks: [makeBlock('paragraph', 'x', [], { align: 'center', para: { line: 2, tabs: [{ at: 1, align: 'left' }, { at: 2, align: 'center' }] } })] });
    expect(fromMarkdown(md2).blocks[0].para).toEqual({ line: 2, tabs: [{ at: 1, align: 'left' }, { at: 2, align: 'center' }] });
  });
});
