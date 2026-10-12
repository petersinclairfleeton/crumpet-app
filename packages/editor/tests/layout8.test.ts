import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { sectionLook } from '../src/model';
import { isField } from '../src/fields';

describe('page layout settings', () => {
  it('keep odd and even section breaks, a section\'s own paper, hyphenation and line numbers in the file', () => {
    const md = 'First. {.hyphenate lnum=5 lnr=sect}\n\nMore. {sect=odd pw=5 ph=8}\n\nLast. {sect=even}\n\nA{{wrapbreak}}B\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].para).toEqual({ hyph: true, lnum: 5, lnr: 'sect' });
    expect(doc.blocks[1].para).toEqual({ sect: 'odd', pw: 5, ph: 8 });
    expect(sectionLook(doc.blocks, 2)).toMatchObject({ start: 'even', paper: { w: 5, h: 8 } });
    expect(isField('wrapbreak')).toBe(true);
    expect(toMarkdown(doc)).toBe(md);
  });
});
