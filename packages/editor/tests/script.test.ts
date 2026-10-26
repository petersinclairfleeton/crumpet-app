import { describe, expect, it } from 'vitest';
import { caret } from '../src/model';
import { cycleScript, splitBlock } from '../src/commands';
import { applyOps } from '../src/ops';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import type { EditorState } from '../src/commands';

const state = (md: string, block = 0, offset?: number): EditorState => {
  const doc = fromMarkdown(md);
  const b = doc.blocks[block];
  const at = offset ?? b.runs.reduce((n, r) => n + r.text.length, 0);
  return { doc, selection: caret({ block: b.id, offset: at }), storedMarks: null };
};
const styles = (s: EditorState) => s.doc.blocks.map((b) => b.style ?? b.type);
const run = (s: EditorState, t: ReturnType<typeof splitBlock> | null) => ({ ...s, doc: applyOps(s.doc, t!.ops), selection: t!.selectionAfter });

describe('scripts', () => {
  it('Enter goes on to the element that usually comes next', () => {
    let s = state('INT. LIGHTHOUSE - NIGHT {.sc-scene}');
    s = run(s, splitBlock(s));
    expect(styles(s)).toEqual(['sc-scene', 'sc-action']);
    const c = state('MARA {.sc-char}');
    expect(styles(run(c, splitBlock(c)))).toEqual(['sc-char', 'sc-dial']);
    const d = state('Eleven years. {.sc-dial}');
    expect(styles(run(d, splitBlock(d)))).toEqual(['sc-dial', 'sc-action']);
    const t = state('CUT TO: {.sc-trans}');
    expect(styles(run(t, splitBlock(t)))).toEqual(['sc-trans', 'sc-scene']);
  });

  it('Enter on an empty element makes it action; Tab and Shift+Tab change the element', () => {
    const e = state('MARA {.sc-char}\n\n&nbsp;{.sc-dial}', 1, 0);
    const empty = { ...e, doc: { blocks: [e.doc.blocks[0], { ...e.doc.blocks[1], runs: [] }] } };
    expect(styles(run(empty, splitBlock(empty)))).toEqual(['sc-char', 'sc-action']);
    const a = state('She climbs. {.sc-action}');
    expect(styles(run(a, cycleScript(a, 1)))).toEqual(['sc-char']);
    expect(styles(run(a, cycleScript(a, -1)))).toEqual(['sc-scene']);
    expect(cycleScript(state('Plain text.'), 1)).toBeNull();
  });

  it('keeps a script’s elements and a stage play’s layout in the file', () => {
    const md = 'ACT ONE {.sc-scene script=stage}\n\nMara {.sc-char}\n\nHello. {.sc-dial}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks.map((b) => b.style)).toEqual(['sc-scene', 'sc-char', 'sc-dial']);
    expect(doc.blocks[0].para?.script).toBe('stage');
    expect(toMarkdown(doc)).toBe(md);
  });
});
