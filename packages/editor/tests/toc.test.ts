import { describe, expect, it } from 'vitest';
import { caret, makeBlock } from '../src/model';
import { applyOps } from '../src/ops';
import { insertToc, splitBlock } from '../src/commands';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { tocEntries } from '../src/view';

describe('table of contents', () => {
  it('is [TOC] in the file, and text that says [TOC] stays text', () => {
    const doc = { blocks: [makeBlock('toc'), makeBlock('paragraph', '[TOC]'), makeBlock('heading1', 'One')] };
    const md = toMarkdown(doc);
    expect(md.startsWith('[TOC]\n')).toBe(true);
    expect(fromMarkdown(md).blocks.map((b) => [b.type, b.runs.map((r) => r.text).join('')])).toEqual([
      ['toc', ''],
      ['paragraph', '[TOC]'],
      ['heading1', 'One'],
    ]);
  });

  it('lists headings 1 to 3, and goes in on an empty line with a line after it', () => {
    const doc = { blocks: [makeBlock('paragraph'), makeBlock('heading1', 'One'), makeBlock('heading2', 'Two'), makeBlock('heading4', 'Four'), makeBlock('heading3', '')] };
    const t = insertToc({ doc, selection: caret({ block: doc.blocks[0].id, offset: 0 }), storedMarks: null });
    const after = applyOps(doc, t.ops);
    expect(after.blocks[0].type).toBe('toc');
    expect(tocEntries(after).map((e) => [e.level, e.text])).toEqual([
      [1, 'One'],
      [2, 'Two'],
    ]);
    // Enter in it never makes a second one.
    const split = applyOps(after, splitBlock({ doc: after, selection: caret({ block: after.blocks[0].id, offset: 0 }), storedMarks: null }).ops);
    expect(split.blocks.filter((b) => b.type === 'toc')).toHaveLength(1);
  });
});
