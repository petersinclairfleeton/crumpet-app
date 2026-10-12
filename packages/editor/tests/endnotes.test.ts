import { describe, expect, it } from 'vitest';
import { caret, footnotes } from '../src/model';
import { applyOps } from '../src/ops';
import { convertNotes } from '../src/commands';
import { fromMarkdown, toMarkdown } from '../src/markdown';

describe('endnotes', () => {
  it('keep apart from footnotes in the file', () => {
    const md = 'A gull.^[Larus argentatus.] The lamp.^^[Lit in 1902.]\n';
    const doc = fromMarkdown(md);
    expect(footnotes(doc).map((f) => f.text)).toEqual(['Larus argentatus.']);
    expect(footnotes(doc, 'end').map((f) => f.text)).toEqual(['Lit in 1902.']);
    expect(toMarkdown(doc)).toBe(md);
  });

  it('turn footnotes into endnotes and back', () => {
    const doc = fromMarkdown('One.^[a] Two.^^[b]\n');
    const state = { doc, selection: caret({ block: doc.blocks[0].id, offset: 0 }), storedMarks: null };
    const ends = applyOps(doc, convertNotes(state, 'end')!.ops);
    expect(footnotes(ends, 'end').map((f) => f.text)).toEqual(['a', 'b']);
    expect(footnotes(ends)).toEqual([]);
    const feet = applyOps(ends, convertNotes({ ...state, doc: ends }, 'foot')!.ops);
    expect(toMarkdown(feet)).toBe('One.^[a] Two.^[b]\n');
  });
});
