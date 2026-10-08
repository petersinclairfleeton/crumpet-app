import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { plainText, trackedComparison } from '../../src/data/compare';

describe('comparing documents', () => {
  it('shows what changed as tracked changes, paragraph breaks included', () => {
    const before = fromMarkdown('The lamp was dark.\n\nShe climbed.\n');
    const after = fromMarkdown('The lamp was bright.\n\nShe climbed.\n\nThe end.\n');
    const doc = trackedComparison(before, after, 'Peter', Date.UTC(2026, 9, 8, 12));
    const md = toMarkdown(doc);
    expect(md).toContain('{--dark--}');
    expect(md).toContain('{++bright++}');
    expect(md).toContain('The end.');
    // Accepting everything gives the later version, rejecting everything the earlier one.
    const accept = { blocks: doc.blocks.map((b) => ({ ...b, runs: b.runs.filter((r) => r.change?.kind !== 'del') })).filter((b) => b.brk?.kind !== 'del' || b.runs.length) };
    expect(plainText(accept).replace(/\n+/g, '\n')).toBe(plainText(after));
  });
});
