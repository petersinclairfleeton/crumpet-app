import { describe, expect, it } from 'vitest';
import { type Doc, caret, makeBlock } from '../src/model';
import { applyOps, invertOps } from '../src/ops';
import { insertPageBreak, paraValue, setBlockStyle, setPara, splitBlock, stepIndent } from '../src/commands';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { diffDocs } from '../src/diff';

const st = (doc: Doc, i = 0, offset = 0) => ({ doc, selection: caret({ block: doc.blocks[i].id, offset }), storedMarks: null });

describe('paragraph spacing, indents and page breaks', () => {
  it('set by hand, undone, and kept when the style changes', () => {
    const doc = { blocks: [makeBlock('paragraph', 'Hello')] };
    const t = setPara(st(doc), { line: 2, before: 12, first: 0.5 });
    const after = applyOps(doc, t.ops);
    expect(after.blocks[0].para).toEqual({ line: 2, before: 12, first: 0.5 });
    expect(paraValue(st(after), 'line')).toBe(2);
    expect(applyOps(after, invertOps(t.ops))).toEqual(doc);
    const styled = applyOps(after, setBlockStyle(st(after), 'quote').ops);
    expect(styled.blocks[0].para).toEqual({ line: 2, before: 12, first: 0.5 });
    const cleared = applyOps(after, setPara(st(after), null).ops);
    expect(cleared.blocks[0].para).toBeUndefined();
  });

  it('carry on to the next paragraph after Enter, but not a page break or after a heading', () => {
    const doc = { blocks: [{ ...makeBlock('paragraph', 'One'), para: { line: 1.5, pageBefore: true } }] };
    const next = applyOps(doc, splitBlock(st(doc, 0, 3)).ops);
    expect(next.blocks[1].para).toEqual({ line: 1.5 });
    const h = { blocks: [{ ...makeBlock('heading1', 'Title'), para: { after: 24 } }] };
    expect(applyOps(h, splitBlock(st(h, 0, 5)).ops).blocks[1].para).toBeUndefined();
  });

  it('indent steps half an inch; a page break splits the paragraph', () => {
    const doc = { blocks: [makeBlock('paragraph', 'Hello world')] };
    const once = applyOps(doc, stepIndent(st(doc), 1).ops);
    expect(once.blocks[0].para).toEqual({ left: 0.5 });
    expect(applyOps(once, stepIndent(st(once), -1).ops).blocks[0].para).toBeUndefined();
    const broken = applyOps(doc, insertPageBreak(st(doc, 0, 6)).ops);
    expect(broken.blocks.map((b) => [b.runs.map((r) => r.text).join(''), b.para?.pageBefore])).toEqual([
      ['Hello ', undefined],
      ['world', true],
    ]);
  });

  it('saved in Markdown at the end of the line, and read back', () => {
    const md = 'Opening line. {.center .pagebreak line=2 before=12 first=0.5}\n\n> A quote. {left=1 right=1}\n\nShe said [hi]{size=14}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0]).toMatchObject({ align: 'center', para: { pageBefore: true, line: 2, before: 12, first: 0.5 } });
    expect(doc.blocks[1]).toMatchObject({ type: 'quote', para: { left: 1, right: 1 } });
    expect(doc.blocks[2].para).toBeUndefined();
    expect(doc.blocks[2].runs.at(-1)?.look).toEqual({ size: 14 });
    expect(toMarkdown(doc)).toBe(md);
    // Text that only looks like settings stays text.
    expect(fromMarkdown('Set {x=1} here').blocks[0].runs[0].text).toBe('Set {x=1} here');
    expect(toMarkdown(fromMarkdown('Ends in \\{line=2}'))).toBe('Ends in \\{line=2}\n');
  });

  it('sync from a changed file', () => {
    const a = fromMarkdown('One.\n\nTwo.');
    const b = fromMarkdown('One. {line=2}\n\nTwo.');
    expect(diffDocs(a, b).doc.blocks[0].para).toEqual({ line: 2 });
    expect(diffDocs(b, a).doc.blocks[0].para).toBeUndefined();
  });
});
