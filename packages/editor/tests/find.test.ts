import { describe, expect, it } from 'vitest';
import { type Doc, caret, makeBlock, runsText } from '../src/model';
import { applyOps, invertOps } from '../src/ops';
import { findMatches, replaceMatches } from '../src/find';
import { fromMarkdown } from '../src/markdown';

const text = (doc: Doc) => doc.blocks.map((b) => runsText(b.runs));
const state = (doc: Doc) => ({ doc, selection: caret({ block: doc.blocks[0].id, offset: 0 }), storedMarks: null });

describe('find', () => {
  const doc = fromMarkdown('The lamp, the Lamp and the lampshade.\n\nNo lamps here? One **lamp**.');

  it('finds every place, in order, ignoring case unless asked', () => {
    expect(findMatches(doc, 'lamp').length).toBe(5);
    expect(findMatches(doc, 'Lamp', { matchCase: true }).length).toBe(1);
    expect(findMatches(doc, '')).toEqual([]);
  });

  it('can match whole words only', () => {
    const m = findMatches(doc, 'lamp', { wholeWord: true });
    expect(m.length).toBe(3);
    expect(m[2]).toMatchObject({ block: doc.blocks[1].id });
  });

  it('treats the search as plain text, not a pattern', () => {
    expect(findMatches(fromMarkdown('Is it (really)? Yes.'), '(really)?').length).toBe(1);
  });

  it('skips tables and text deleted with track changes', () => {
    const d = fromMarkdown('| lamp |\n|---|\n| lamp |\n\nA {--lamp--} {++lamp++}');
    const m = findMatches(d, 'lamp');
    expect(m.length).toBe(1);
  });
});

describe('replace', () => {
  it('replaces all as one undo step, keeping the formatting', () => {
    const doc = fromMarkdown('The lamp and the **lamp**.');
    const t = replaceMatches(state(doc), findMatches(doc, 'lamp'), 'light')!;
    const after = applyOps(doc, t.ops);
    expect(text(after)).toEqual(['The light and the light.']);
    expect(after.blocks[0].runs.find((r) => r.marks.includes('bold'))?.text).toBe('light');
    expect(text(applyOps(after, invertOps(t.ops)))).toEqual(text(doc));
  });

  it('replaces one, and can replace with nothing', () => {
    const doc = { blocks: [makeBlock('paragraph', 'a lamp, a lamp')] };
    const one = applyOps(doc, replaceMatches(state(doc), findMatches(doc, 'lamp').slice(1), 'light')!.ops);
    expect(text(one)).toEqual(['a lamp, a light']);
    const none = applyOps(doc, replaceMatches(state(doc), findMatches(doc, ' lamp'), '')!.ops);
    expect(text(none)).toEqual(['a, a']);
  });

  it('with track changes, marks the old text deleted and the new text added', () => {
    const doc = { blocks: [makeBlock('paragraph', 'the lamp')] };
    const after = applyOps(doc, replaceMatches(state(doc), findMatches(doc, 'lamp'), 'light', 'Peter')!.ops);
    const runs = after.blocks[0].runs;
    expect(runs.find((r) => r.change?.kind === 'del')?.text).toBe('lamp');
    expect(runs.find((r) => r.change?.kind === 'ins')?.text).toBe('light');
  });
});
