import { describe, expect, it } from 'vitest';
import { type Doc, caret, makeBlock, runsText } from '../src/model';
import { applyOps, invertOps } from '../src/ops';
import { changeCase, clearFormatting, insertText, lookValue, setLook } from '../src/commands';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { diffDocs } from '../src/diff';

const sel = (doc: Doc, from: number, to: number, i = 0) => ({ anchor: { block: doc.blocks[i].id, offset: from }, focus: { block: doc.blocks[i].id, offset: to } });

describe('fonts, sizes and colours', () => {
  it('set a look on selected text, undo it, and read it back', () => {
    const doc = { blocks: [makeBlock('paragraph', 'The lamp was lit.')] };
    const t = setLook({ doc, selection: sel(doc, 4, 8), storedMarks: null }, 'font', 'Garamond');
    const after = applyOps(doc, t.ops);
    expect(after.blocks[0].runs.map((r) => [r.text, r.look?.font])).toEqual([
      ['The ', undefined],
      ['lamp', 'Garamond'],
      [' was lit.', undefined],
    ]);
    expect(lookValue({ doc: after, selection: sel(after, 4, 8), storedMarks: null }, 'font')).toBe('Garamond');
    expect(lookValue({ doc: after, selection: sel(after, 0, 8), storedMarks: null }, 'font')).toBeUndefined();
    expect(applyOps(after, invertOps(t.ops))).toEqual(doc);
  });

  it('carries on into typing, and a look chosen with nothing selected applies to what is typed next', () => {
    const doc = { blocks: [makeBlock('paragraph', 'ab')] };
    const red = applyOps(doc, setLook({ doc, selection: sel(doc, 0, 2), storedMarks: null }, 'color', '#cc0000').ops);
    const typed = applyOps(red, insertText({ doc: red, selection: caret({ block: red.blocks[0].id, offset: 2 }), storedMarks: null }, 'c').ops);
    expect(typed.blocks[0].runs).toEqual([{ text: 'abc', marks: [], look: { color: '#cc0000' } }]);
    const stored = setLook({ doc, selection: caret({ block: doc.blocks[0].id, offset: 2 }), storedMarks: null }, 'size', 18);
    expect(stored.ops).toEqual([]);
    const next = applyOps(doc, insertText({ doc, selection: caret({ block: doc.blocks[0].id, offset: 2 }), storedMarks: null, storedLook: stored.storedLook }, 'X').ops);
    expect(next.blocks[0].runs.at(-1)).toEqual({ text: 'X', marks: [], look: { size: 18 } });
  });

  it('are saved in Markdown as [text]{…} and read back, with bold and links inside', () => {
    const md = 'Plain [**bold** and [a link](https://x.org)]{font="EB Garamond" size=14 color=#cc0000 highlight=#ffff00} H[2]{va=sub}O.\n';
    const doc = fromMarkdown(md);
    const runs = doc.blocks[0].runs;
    expect(runs.find((r) => r.text === 'bold')).toMatchObject({ marks: ['bold'], look: { font: 'EB Garamond', size: 14, color: '#cc0000', highlight: '#ffff00' } });
    expect(runs.find((r) => r.text === 'a link')).toMatchObject({ link: 'https://x.org', look: { font: 'EB Garamond' } });
    expect(runs.find((r) => r.text === '2')?.look).toEqual({ va: 'sub' });
    expect(toMarkdown(doc)).toBe(md);
    // Square brackets that aren't a look stay as they are.
    expect(runsText(fromMarkdown('A [note]{.aside} here.').blocks[0].runs)).toBe('A [note]{.aside} here.');
  });

  it('clear formatting and change case', () => {
    const doc = fromMarkdown('**Bold** [red]{color=#cc0000} words. more here.');
    const all = sel(doc, 0, runsText(doc.blocks[0].runs).length);
    const plain = applyOps(doc, clearFormatting({ doc, selection: all, storedMarks: null }).ops);
    expect(plain.blocks[0].runs).toEqual([{ text: 'Bold red words. more here.', marks: [] }]);
    const up = applyOps(plain, changeCase({ doc: plain, selection: all, storedMarks: null }, 'sentence').ops);
    expect(runsText(up.blocks[0].runs)).toBe('Bold red words. More here.');
    const title = applyOps(plain, changeCase({ doc: plain, selection: all, storedMarks: null }, 'title').ops);
    expect(runsText(title.blocks[0].runs)).toBe('Bold Red Words. More Here.');
  });

  it('sync from a changed file as format steps', () => {
    const a = fromMarkdown('One two three.');
    const b = fromMarkdown('One [two]{size=20} three.');
    const { doc } = diffDocs(a, b);
    expect(doc.blocks[0].runs.find((r) => r.text === 'two')?.look).toEqual({ size: 20 });
  });
});
