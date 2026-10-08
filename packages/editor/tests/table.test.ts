import { describe, expect, it } from 'vitest';
import { caret, makeBlock } from '../src/model';
import { applyOps, invertOps } from '../src/ops';
import { setTableRows } from '../src/commands';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { addCol, addRow, alignCol, deleteCol, deleteRow, isCovered, mergeCells, setTableLook, shadeCell, splitCell } from '../src/table';

const grid = () => [
  ['A', 'B', 'C'],
  ['1', '2', '3'],
  ['4', '5', '6'],
];

describe('table formatting', () => {
  it('merges right and down, keeping both texts, and splits again', () => {
    let t = mergeCells({ rows: grid() }, 1, 0, 'right');
    expect(t.rows[1]).toEqual(['1 2', '', '3']);
    expect(t.tbl?.merges).toEqual([[1, 0, 1, 2]]);
    t = mergeCells(t, 1, 1, 'down'); // from inside the merged cell: the whole of it goes down, but 4 and 5 aren't merged, so it can't
    expect(t.tbl?.merges).toEqual([[1, 0, 1, 2]]);
    t = mergeCells(mergeCells(t, 2, 0, 'right'), 1, 0, 'down');
    expect(t.tbl?.merges).toEqual([[1, 0, 2, 2]]);
    expect(t.rows[1][0]).toBe('1 2 4 5');
    expect(isCovered(t.tbl, 2, 1)).toBe(true);
    expect(splitCell(t, 2, 1).tbl).toBeUndefined();
  });

  it('keeps merges, shading and alignment in step when rows and columns come and go', () => {
    let t = shadeCell(alignCol(mergeCells({ rows: grid() }, 1, 0, 'right'), 2, 'right'), 2, 2, '#fff2cc');
    t = addRow(t, 0);
    expect(t.tbl).toEqual({ merges: [[2, 0, 1, 2]], shades: { '3,2': '#fff2cc' }, aligns: [null, null, 'right'] });
    t = addCol(t, 1); // inside the merge: it widens
    expect(t.tbl?.merges).toEqual([[2, 0, 1, 3]]);
    expect(t.tbl?.aligns).toEqual([null, null, null, 'right']);
    t = deleteCol(deleteCol(t, 0), 0);
    expect(t.tbl).toEqual({ shades: { '3,1': '#fff2cc' }, aligns: [null, 'right'] });
    t = deleteRow(t, 3);
    expect(t.tbl).toEqual({ aligns: [null, 'right'] });
  });

  it('is kept in the file: alignment in the rule row, the rest on a line under the table', () => {
    let t = mergeCells({ rows: grid() }, 1, 0, 'right');
    t = shadeCell(alignCol(t, 1, 'center'), 2, 2, '#d9ead3');
    t = setTableLook(t, { banded: true, borders: 'rows', noHeader: true });
    const doc = { blocks: [makeBlock('table', '', [], { rows: t.rows, tbl: t.tbl }), makeBlock('paragraph', 'After')] };
    const md = toMarkdown(doc);
    expect(md).toContain('| --- | :---: | --- |');
    expect(md).toContain('{table .noheader .banded borders=rows merge=1-0-1-2 shade=2-2-#d9ead3}');
    const back = fromMarkdown(md).blocks;
    expect(back[0].tbl).toEqual(t.tbl);
    expect(back[1].runs[0].text).toBe('After');
  });

  it('changes with undo, and reading a plain table has no look', () => {
    const doc = { blocks: [makeBlock('table', '', [], { rows: grid() })] };
    const st = { doc, selection: caret({ block: doc.blocks[0].id, offset: 0 }), storedMarks: null };
    const next = mergeCells({ rows: grid() }, 0, 0, 'right');
    const t = setTableRows(st, doc.blocks[0].id, next.rows, next.tbl);
    const after = applyOps(doc, t.ops);
    expect(after.blocks[0].tbl).toEqual({ merges: [[0, 0, 1, 2]] });
    expect(applyOps(after, invertOps(t.ops)).blocks[0].tbl).toBeUndefined();
    // Typing in a cell keeps the look.
    const typed = applyOps(after, setTableRows({ ...st, doc: after }, doc.blocks[0].id, [['A B', '', 'Cx'], ...grid().slice(1)]).ops);
    expect(typed.blocks[0].tbl).toEqual({ merges: [[0, 0, 1, 2]] });
    expect(fromMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |').blocks[0].tbl).toBeUndefined();
  });
});
