import { describe, expect, it } from 'vitest';
import { type Doc, caret, makeBlock } from '../src/model';
import { applyOps, invertOps } from '../src/ops';
import { setListStart, setListStyle, setPara, splitBlock } from '../src/commands';
import { fromMarkdown, toMarkdown } from '../src/markdown';

const st = (doc: Doc, i = 0, offset = 0) => ({ doc, selection: caret({ block: doc.blocks[i].id, offset }), storedMarks: null });
const item = (type: 'numbered' | 'bullet', text: string, indent = 0) => ({ ...makeBlock(type, text), ...(indent ? { indent } : {}) });

describe('list styles, numbering values, borders and shading', () => {
  it('a number style goes to the whole list at that level, and undoes', () => {
    const doc = { blocks: [item('numbered', 'One'), item('numbered', 'Sub', 1), item('numbered', 'Two'), makeBlock('paragraph', 'After')] };
    const t = setListStyle(st(doc, 2), { num: 'upper-roman' });
    const after = applyOps(doc, t.ops);
    expect(after.blocks.map((b) => b.para?.num)).toEqual(['upper-roman', undefined, 'upper-roman', undefined]);
    expect(applyOps(after, invertOps(t.ops))).toEqual(doc);
    const legal = applyOps(doc, setListStyle(st(doc), { num: 'legal' }).ops);
    expect(legal.blocks.map((b) => b.para?.num)).toEqual(['legal', 'legal', 'legal', undefined]);
  });

  it('turns a paragraph into a list in that style, and the style carries on after Enter (not the start)', () => {
    const doc = { blocks: [makeBlock('paragraph', 'Milk')] };
    const listed = applyOps(doc, setListStyle(st(doc), { bullet: 'check' }).ops);
    expect(listed.blocks[0]).toMatchObject({ type: 'bullet', para: { bullet: 'check' } });
    const n = { blocks: [{ ...item('numbered', 'Five'), para: { num: 'paren' as const, start: 5 } }] };
    const next = applyOps(n, splitBlock(st(n, 0, 4)).ops);
    expect(next.blocks[1]).toMatchObject({ type: 'numbered', para: { num: 'paren' } });
    expect(next.blocks[1].para?.start).toBeUndefined();
    expect(applyOps(next, setListStart(st(next, 1), 1).ops).blocks[1].para?.start).toBe(1);
  });

  it('keeps list styles, numbering values, borders and shading in the file', () => {
    const doc = {
      blocks: [
        { ...item('numbered', 'Five'), para: { num: 'lower-alpha' as const, start: 5 } },
        { ...item('bullet', 'Dash'), para: { bullet: 'dash' as const } },
        { ...makeBlock('paragraph', 'Boxed'), para: { border: 'tblr', shade: '#fff2cc' } },
      ],
    };
    const md = toMarkdown(doc);
    expect(md).toContain('{num=lower-alpha start=5}');
    expect(md).toContain('{border=tblr shade=#fff2cc}');
    const back = fromMarkdown(md).blocks;
    expect(back.map((b) => b.para)).toEqual(doc.blocks.map((b) => b.para));
  });

  it('tidies borders and refuses odd values', () => {
    const doc = { blocks: [makeBlock('paragraph', 'Hi')] };
    const p = applyOps(doc, setPara(st(doc), { border: 'rlbt', shade: 'red' }).ops).blocks[0].para;
    expect(p).toEqual({ border: 'tblr' });
  });
});
