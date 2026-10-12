import { describe, expect, it } from 'vitest';
import { caret, makeBlock, runsText } from '../src/model';
import { applyOps } from '../src/ops';
import { type EditorState, sliceDoc, sortParagraphs } from '../src/commands';
import { toMarkdown } from '../src/markdown';

const doc = (...lines: string[]) => ({ blocks: lines.map((l) => makeBlock('paragraph', l)) });
const all = (d: ReturnType<typeof doc>): EditorState => {
  const last = d.blocks[d.blocks.length - 1];
  return { doc: d, selection: { anchor: { block: d.blocks[0].id, offset: 0 }, focus: { block: last.id, offset: runsText(last.runs).length } }, storedMarks: null };
};

describe('sorting paragraphs', () => {
  it('by text, A to Z and Z to A, empty ones last', () => {
    const d = doc('pear', 'Apple', '', 'banana 10', 'banana 9');
    const s = all(d);
    const after = applyOps(d, sortParagraphs(s).ops);
    expect(after.blocks.map((b) => runsText(b.runs))).toEqual(['Apple', 'banana 9', 'banana 10', 'pear', '']);
    const down = applyOps(d, sortParagraphs(s, 'text', true).ops);
    expect(down.blocks.map((b) => runsText(b.runs))).toEqual(['pear', 'banana 10', 'banana 9', 'Apple', '']);
  });

  it('by number and by date, keeping each paragraph’s formatting with it', () => {
    const d = doc('Chapter 12', 'Chapter 3', 'Chapter 100');
    d.blocks[1].type = 'heading2';
    const after = applyOps(d, sortParagraphs(all(d), 'number').ops);
    expect(after.blocks.map((b) => [b.type, runsText(b.runs)])).toEqual([
      ['heading2', 'Chapter 3'],
      ['paragraph', 'Chapter 12'],
      ['paragraph', 'Chapter 100'],
    ]);
    const dates = doc('12 March 2024, rain', '1 January 2024, snow', '5 February 2024');
    expect(applyOps(dates, sortParagraphs(all(dates), 'date').ops).blocks.map((b) => runsText(b.runs))).toEqual(['1 January 2024, snow', '5 February 2024', '12 March 2024, rain']);
  });
});

describe('copying with formatting', () => {
  it('takes just the selected part, as Markdown', () => {
    const d = doc('One two', 'three four');
    d.blocks[0].runs = [{ text: 'One ', marks: [] }, { text: 'two', marks: ['bold'] }];
    const s: EditorState = { doc: d, selection: { anchor: { block: d.blocks[0].id, offset: 4 }, focus: { block: d.blocks[1].id, offset: 5 } }, storedMarks: null };
    expect(toMarkdown(sliceDoc(s)!)).toBe('**two**\n\nthree\n');
    expect(sliceDoc({ ...s, selection: caret({ block: d.blocks[0].id, offset: 1 }) })).toBeNull();
  });
});
