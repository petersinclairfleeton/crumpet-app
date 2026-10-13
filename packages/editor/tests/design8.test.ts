import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { applyOps } from '../src/ops';
import { insertCover, removeCover, setSection } from '../src/commands';
import { coverBlocks, hasCover } from '../src/cover';
import type { Doc } from '../src/model';

const state = (doc: Doc) => ({ doc, selection: { anchor: { block: doc.blocks[0].id, offset: 0 }, focus: { block: doc.blocks[0].id, offset: 0 } }, storedMarks: null });

describe('page design settings', () => {
  it('keep a watermark, page colour, page border and sections’ own headers in the file', () => {
    const md = 'Opening. {.hfirst sect=page pstart=3 pgc=#fff2cc pgb=double pgbc=#2f5d8a wmc=#d99594 pfmt="i" hdr="**Book**||%page%" wm="DRAFT"}\n\nPart two. {sect=page ftr="|Part two \\| %title%|"}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].para).toMatchObject({ hfirst: true, pstart: 3, pfmt: 'i', pgc: '#fff2cc', pgb: 'double', pgbc: '#2f5d8a', wm: 'DRAFT', wmc: '#d99594', hdr: '**Book**||%page%' });
    expect(doc.blocks[1].para).toEqual({ sect: 'page', ftr: '|Part two \\| %title%|' });
    expect(toMarkdown(doc)).toBe(md);
  });

  it('keeps an empty header of a section’s own (unlinked, blank)', () => {
    const doc = fromMarkdown('A\n\nB {sect=page hdr=""}\n');
    expect(doc.blocks[1].para).toEqual({ sect: 'page', hdr: '' });
    expect(toMarkdown(doc)).toContain('hdr=""');
  });

  it('sets a section’s header from any block, not just the caret’s', () => {
    const doc = fromMarkdown('A\n\nB {sect=page}\n\nC\n');
    const t = setSection(state(doc), { hdr: 'x||' }, doc.blocks[1].id);
    expect(applyOps(doc, t.ops).blocks[1].para).toEqual({ sect: 'page', hdr: 'x||' });
  });

  it('puts a cover page in front, carrying the document’s settings, and takes it away again', () => {
    const doc = fromMarkdown('Chapter one. {.hyphenate pgc=#fff2cc}\n\nMore.\n');
    const withCover = applyOps(doc, insertCover(state(doc), coverBlocks('classic', { title: 'My Book', author: 'Peter' })).ops);
    expect(hasCover(withCover.blocks)).toBe(true);
    const first = withCover.blocks[0];
    expect(first.para).toMatchObject({ cover: true, hfirst: true, sect: 'page', hyph: true, pgc: '#fff2cc' });
    const text = withCover.blocks.map((b) => b.runs.map((r) => r.text).join(''));
    expect(text).toContain('My Book');
    const rest = withCover.blocks.find((b) => b.runs.map((r) => r.text).join('') === 'Chapter one.')!;
    expect(rest.para).toEqual({ sect: 'page' });
    // Swapping designs keeps one cover.
    const again = applyOps(withCover, insertCover(state(withCover), coverBlocks('banner', { title: 'Two' })).ops);
    expect(again.blocks.filter((b) => b.runs.some((r) => r.text === 'My Book'))).toHaveLength(0);
    const back = applyOps(again, removeCover(state(again))!.ops);
    expect(hasCover(back.blocks)).toBe(false);
    expect(back.blocks.map((b) => b.runs.map((r) => r.text).join(''))).toEqual(['Chapter one.', 'More.']);
    expect(back.blocks[0].para).toEqual({ hyph: true, pgc: '#fff2cc' });
  });

  it('keeps the document’s theme colours, fonts, effects and paragraph spacing in the file', () => {
    const md = 'Hello. {thc=ocean thf=modern thx=soft psp=open}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].para).toEqual({ thc: 'ocean', thf: 'modern', thx: 'soft', psp: 'open' });
    expect(toMarkdown(doc)).toBe(md);
  });
});
