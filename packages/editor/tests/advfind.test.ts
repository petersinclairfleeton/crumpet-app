import { describe, expect, it } from 'vitest';
import { caret, makeBlock, runsText } from '../src/model';
import { applyOps } from '../src/ops';
import { findMatches, findPattern, replaceMatches, similarFormat } from '../src/find';

const docOf = (...texts: string[]) => ({ blocks: texts.map((t) => makeBlock('paragraph', t)) });
const found = (doc: ReturnType<typeof docOf>, q: string, opts = {}) => findMatches(doc, q, opts).map((m) => runsText(doc.blocks.find((b) => b.id === m.block)!.runs).slice(m.from, m.to));

describe('advanced find', () => {
  it('Word wildcards', () => {
    const doc = docOf('The cat sat on the mat; a coat.', 'Call 0123 or 99.');
    expect(found(doc, '?at', { wildcards: true })).toEqual(['cat', 'sat', 'mat', 'oat']);
    expect(found(doc, '<?at>', { wildcards: true })).toEqual(['cat', 'sat', 'mat']);
    expect(found(doc, 'c*t', { wildcards: true })).toEqual(['cat', 'coat']);
    expect(found(doc, '[0-9]{3,}', { wildcards: true })).toEqual(['0123']);
    expect(found(doc, '[!a-z ]@', { wildcards: true, matchCase: true }).slice(0, 2)).toEqual(['T', ';']);
    expect(findPattern('a.b', { wildcards: true })).toBe('a\\.b');
  });

  it('special characters, with or without wildcards', () => {
    const doc = docOf('One\ttwo – three 42');
    expect(found(doc, '^t')).toEqual(['\t']);
    expect(found(doc, '^#^#')).toEqual(['42']);
    expect(found(doc, '^=')).toEqual(['–']);
    expect(found(doc, '^$^$^$', { matchCase: true })).toEqual(['One', 'two', 'thr']);
  });

  it('formatting: alone, or with the words', () => {
    const p = makeBlock('paragraph', '', [], { runs: [{ text: 'plain ', marks: [] }, { text: 'bold words', marks: ['bold'] }, { text: ' and ', marks: [] }, { text: 'bold', marks: ['bold'] }] });
    const doc = { blocks: [p] };
    expect(found(doc, '', { format: { marks: ['bold'] } })).toEqual(['bold words', 'bold']);
    expect(found(doc, 'words', { format: { marks: ['bold'] } })).toEqual(['words']);
    expect(found(doc, 'plain', { format: { marks: ['bold'] } })).toEqual([]);
    expect(found(doc, 'bold', { format: { block: () => false } })).toEqual([]);
  });

  it('replace with what was found and the wildcard groups', () => {
    const doc = docOf('Quinn, Mara and Hale, Tom.');
    const matches = findMatches(doc, '(<[A-Z][a-z]@), (<[A-Z][a-z]@)', { wildcards: true, matchCase: true });
    expect(matches).toHaveLength(2);
    const t = replaceMatches({ doc, selection: caret({ block: doc.blocks[0].id, offset: 0 }), storedMarks: null }, matches, '\\2 \\1')!;
    expect(runsText(applyOps(doc, t.ops).blocks[0].runs)).toBe('Mara Quinn and Tom Hale.');
    const t2 = replaceMatches({ doc, selection: caret({ block: doc.blocks[0].id, offset: 0 }), storedMarks: null }, findMatches(doc, 'Tom'), '[^&]')!;
    expect(runsText(applyOps(doc, t2.ops).blocks[0].runs)).toBe('Quinn, Mara and Hale, [Tom].');
  });
});

describe('text with similar formatting', () => {
  it('finds text formatted exactly the same, not merely including it', () => {
    const p = makeBlock('paragraph', '', [], { runs: [{ text: 'red ', marks: ['bold'], look: { color: '#cc0000' } }, { text: 'bold ', marks: ['bold'] }, { text: 'also red', marks: ['bold'], look: { color: '#cc0000' } }] });
    const doc = { blocks: [p] };
    expect(found(doc, '', { format: similarFormat(['bold'], { color: '#cc0000' }) })).toEqual(['red ', 'also red']);
    expect(found(doc, '', { format: similarFormat(['bold'], undefined) })).toEqual(['bold ']);
  });
});
