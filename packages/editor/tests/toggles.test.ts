import { describe, expect, it } from 'vitest';
import { applyOps } from '../src/ops';
import { caret, foldedUnder } from '../src/model';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { type EditorState, toggleFold } from '../src/commands';

describe('toggles and callouts', () => {
  it('a toggle folds the lines after it, up to a blank line or a heading', () => {
    const doc = fromMarkdown('Spoilers {.toggle}\n\nHidden one.\n\n- Hidden two\n\n&nbsp;\n\nShown again.\n');
    const i = doc.blocks.findIndex((b) => b.style === 'toggle');
    expect(foldedUnder(doc, i).map((b) => b.runs.map((r) => r.text).join(''))).toEqual(['Hidden one.', 'Hidden two']);
  });

  it('folds and opens, and saves both ways', () => {
    const doc = fromMarkdown('Spoilers {.toggle}\n\nHidden.\n');
    const state: EditorState = { doc, selection: caret({ block: doc.blocks[0].id, offset: 0 }), storedMarks: null };
    const t = toggleFold(state, doc.blocks[0].id);
    const after = applyOps(doc, t.ops);
    expect(after.blocks[0].folded).toBe(true);
    const md = toMarkdown(after);
    expect(md).toContain('{.toggle .folded}');
    expect(fromMarkdown(md).blocks[0].folded).toBe(true);
  });

  it('callouts are quotes with a kind, kept in the file', () => {
    const md = '> Remember the lamp. {.warning}\n\n> A good idea. {.tip}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks.map((b) => [b.type, b.style])).toEqual([
      ['quote', 'warning'],
      ['quote', 'tip'],
    ]);
    expect(toMarkdown(doc)).toBe(md);
  });
});
