import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { fieldFromWord, isField, wordInstr } from '../src/fields';
import { figureEntries, indexEntries, tocEntries } from '../src/lists';

describe('fields from the whole document', () => {
  it('keep captions, bookmarks, cross-references, index entries and document fields in the file', () => {
    const md = 'Figure {{seq:Figure}}: A gull {.caption}\n\nSee {{ref:gull}} on page {{ref:gull:page}}{{xe:Gulls:Herring}} and [the start](#bm:start).\n\nPage {{page}} of {{pages}}, {{words}} words, by {{author}}.\n';
    expect(toMarkdown(fromMarkdown(md))).toBe(md);
    expect(isField('seq:Figure')).toBe(true);
    expect(isField('ref:gull:text')).toBe(true);
    expect(isField('ref:gull:wrong')).toBe(false);
    expect(isField('bm:9bad')).toBe(false);
  });

  it('keep a table of contents\' settings, a table of figures and an index in the file', () => {
    const md = '[TOC levels=2 .nodots title="In this book"]\n\n[TOC figures="Table"]\n\n[TOC .index]\n\n[TOC .sources]\n\nKept out. {outline=0}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks.map((b) => b.tocl)).toEqual([{ levels: 2, noDots: true, title: 'In this book' }, { kind: 'figures', label: 'Table' }, { kind: 'index' }, { kind: 'sources' }, undefined]);
    expect(toMarkdown(doc)).toBe(md);
  });

  it('list headings and added paragraphs, captions and index entries', () => {
    const doc = fromMarkdown('# One\n\n## Two {outline=0}\n\nAdded. {outline=2}\n\nFigure {{seq:Figure}}: Sea\n\nTable {{seq:Table}}: Tides{{xe:Tides}}\n\nFigure {{seq:Figure}}: Rocks{{xe:Rocks}}{{xe:Tides:Spring}}\n');
    expect(tocEntries(doc).map((e) => [e.level, e.text])).toEqual([[1, 'One'], [2, 'Added.']]);
    expect(figureEntries(doc, 'Figure').map((e) => e.text)).toEqual(['Figure 1: Sea', 'Figure 2: Rocks']);
    expect(indexEntries(doc).map((e) => [e.level, e.text, e.targets?.length])).toEqual([
      [1, 'Rocks', 1],
      [1, 'Tides', 1],
      [2, 'Spring', 1],
    ]);
  });

  it('go to Word as field codes and come back', () => {
    for (const name of ['page', 'pages', 'words', 'title', 'author', 'seq:Figure', 'ref:gull', 'ref:gull:page', 'ref:gull:dir', 'xe:Gulls']) expect(fieldFromWord(wordInstr(name))).toBe(name);
    expect(wordInstr('ref:gull:text')).toBe(' REF gull \\h ');
  });
});
