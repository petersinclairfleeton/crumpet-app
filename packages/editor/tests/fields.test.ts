import { describe, expect, it } from 'vitest';
import { FIELD, caret, makeBlock, normalizeRuns, runsText } from '../src/model';
import { applyOps } from '../src/ops';
import { type EditorState, insertBlankPage, insertField } from '../src/commands';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { fieldFromWord, fieldValue } from '../src/fields';

function state(text: string, offset: number): EditorState {
  const b = makeBlock('paragraph', text);
  return { doc: { blocks: [b] }, selection: caret({ block: b.id, offset }), storedMarks: null };
}

describe('fields', () => {
  it('are put at the caret and saved as {{name}}', () => {
    const s = state('Today is .', 9);
    const t = insertField(s, 'date');
    const doc = applyOps(s.doc, t.ops);
    expect(doc.blocks[0].runs.map((r) => r.field)).toEqual([undefined, 'date', undefined]);
    expect(t.selectionAfter.focus.offset).toBe(10);
    const md = toMarkdown(doc);
    expect(md).toBe('Today is {{date}}.\n');
    const back = fromMarkdown(md);
    expect(back.blocks[0].runs.find((r) => r.field)?.field).toBe('date');
  });

  it('never merge with each other, and literal {{ in text is kept', () => {
    const runs = normalizeRuns([
      { text: FIELD, marks: [], field: 'date' },
      { text: FIELD, marks: [], field: 'date' },
    ]);
    expect(runs).toHaveLength(2);
    const md = toMarkdown({ blocks: [makeBlock('paragraph', 'Write {{date}} or {{nope}}')] });
    expect(runsText(fromMarkdown(md).blocks[0].runs)).toBe('Write {{date}} or {{nope}}');
    expect(runsText(fromMarkdown('Unknown {{nope}} stays').blocks[0].runs)).toBe('Unknown {{nope}} stays');
  });

  it('show today', () => {
    const d = new Date(2026, 9, 12, 14, 30);
    expect(fieldValue('date-iso', d)).toBe('2026-10-12');
    expect(fieldValue('date', d)).toContain('2026');
    expect(fieldValue('time', d)).toMatch(/30/);
  });

  it('match Word’s DATE and TIME fields', () => {
    expect(fieldFromWord(' DATE \\@ "dddd, d MMMM yyyy" ')).toBe('date-full');
    expect(fieldFromWord(' TIME \\@ "HH:mm" ')).toBe('time');
    expect(fieldFromWord(' DATE \\@ "MMMM d, yyyy" ')).toBe('date');
    expect(fieldFromWord(' DATE ')).toBe('date-short');
    expect(fieldFromWord(' DATE \\@ "d/M/yyyy h:mm am/pm" ')).toBe('datetime');
    expect(fieldFromWord(' PAGE ')).toBe('page');
    expect(fieldFromWord(' FILENAME ')).toBeNull();
  });
});

describe('drop caps and blank pages', () => {
  it('a drop cap is saved on the paragraph, and Enter doesn’t carry it on', () => {
    const md = 'Once upon a time. {drop=3}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].para?.drop).toBe(3);
    expect(toMarkdown(doc)).toBe(md);
    expect(fromMarkdown('Big {drop=40}\n').blocks[0].para?.drop).toBe(10);
  });

  it('a blank page: what followed the caret moves on two pages, with the caret on the empty page', () => {
    const s = state('Before after', 7);
    const t = insertBlankPage(s);
    const doc = applyOps(s.doc, t.ops);
    expect(doc.blocks.map((b) => [runsText(b.runs), !!b.para?.pageBefore])).toEqual([
      ['Before ', false],
      ['', true],
      ['after', true],
    ]);
    expect(t.selectionAfter.focus.block).toBe(doc.blocks[1].id);
  });
});
