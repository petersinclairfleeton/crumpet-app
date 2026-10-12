import { describe, expect, it } from 'vitest';
import { caret, listLabels, makeBlock } from '../src/model';
import { applyOps } from '../src/ops';
import { setMultilevel } from '../src/commands';
import { fromMarkdown, toMarkdown } from '../src/markdown';

describe('multilevel lists', () => {
  it('number every level of the list in its own style and pattern', () => {
    const items = [makeBlock('numbered', 'Start'), makeBlock('numbered', 'Inner', [], { indent: 1 }), makeBlock('numbered', 'Inner two', [], { indent: 1 }), makeBlock('numbered', 'Deep', [], { indent: 2 }), makeBlock('numbered', 'Next')];
    const doc = { blocks: items };
    const s = { doc, selection: caret({ block: items[1].id, offset: 0 }), storedMarks: null };
    const out = applyOps(doc, setMultilevel(s, [{ num: 'upper-roman', text: 'Part %1' }, { num: 'decimal', text: '%1.%2' }, { num: 'lower-alpha', text: '(%3)' }]).ops);
    const labels = listLabels(out.blocks);
    expect(out.blocks.map((b) => labels.get(b.id))).toEqual(['Part I', 'I.1', 'I.2', '(a)', 'Part II']);
  });

  it('show a legal level in plain figures, under a Roman level', () => {
    const items = [makeBlock('numbered', 'Terms', [], { para: { num: 'upper-roman', numText: 'Article %1.' } }), makeBlock('numbered', 'Scope', [], { indent: 1, para: { num: 'legal', numText: 'Section %1.0%2' } })];
    const labels = listLabels(items);
    expect(items.map((b) => labels.get(b.id))).toEqual(['Article I.', 'Section 1.01']);
  });

  it('keep their patterns in the file', () => {
    const md = '1. Chapter one {num=upper-roman numtext="Chapter %1"}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].para).toEqual({ num: 'upper-roman', numText: 'Chapter %1' });
    expect(toMarkdown(doc)).toBe(md);
    expect(listLabels(doc.blocks).get(doc.blocks[0].id)).toBe('Chapter I');
  });

  it('paragraph border styles and widow control are saved too', () => {
    const md = 'Boxed. {.nowidow border=tblr bstyle=double bcolor=#2f6fd1}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].para).toEqual({ nowidow: true, border: 'tblr', bstyle: 'double', bcolor: '#2f6fd1' });
    expect(toMarkdown(doc)).toBe(md);
  });
});
