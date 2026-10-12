import { describe, expect, it } from 'vitest';
import { caret, makeBlock, runsText } from '../src/model';
import { applyOps } from '../src/ops';
import { type TableShape, addRow, deleteRow, distributeCols, linesToRows, readTableAttrs, setCellLooks, setRowHeight, sortTable, tableAttrs, tidyTable } from '../src/table';
import { tableToText, textToTable } from '../src/commands';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { cellText } from '../src/cells';

describe('tables: cells of their own, heights, options', () => {
  it('keeps every setting through the file', () => {
    const tbl = tidyTable({ firstCol: true, totalRow: true, bandedCols: true, noRepeat: true, pad: 0.15, heights: [null, 0.5], cells: { '1,0': { h: 'center', v: 'middle', dir: 'up', bd: 'tb', bs: 'double', bc: '#2f6fd1' } } }, 3, 2)!;
    const line = tableAttrs(tbl);
    expect(line).toBe('{table .firstcol .totalrow .bandedcols .norepeat pad=0.15 heights=x-0.5 cell=1-0:h=center,v=middle,dir=up,bd=tb,bs=double,bc=#2f6fd1}');
    expect(tidyTable(readTableAttrs(line)!, 3, 2)).toEqual(tbl);
    const md = `| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n${line}\n`;
    expect(toMarkdown(fromMarkdown(md))).toBe(md);
  });

  it('keeps cells and heights in step as rows come and go', () => {
    let shape: TableShape = { rows: [['a', 'b'], ['c', 'd'], ['e', 'f']], tbl: tidyTable({ heights: [null, 0.4, 0.6], cells: { '2,1': { v: 'bottom' } } }, 3, 2) };
    shape = addRow(shape, 1);
    expect(shape.tbl?.heights).toEqual([null, null, 0.4, 0.6]);
    expect(shape.tbl?.cells).toEqual({ '3,1': { v: 'bottom' } });
    shape = deleteRow(shape, 2);
    expect(shape.tbl?.heights).toEqual([null, null, 0.6]);
    shape = setRowHeight(shape, 0, 1);
    expect(shape.tbl?.heights).toEqual([1, null, 0.6]);
    shape = setCellLooks(shape, [[2, 1]], { v: null, h: 'right' });
    expect(shape.tbl?.cells).toEqual({ '2,1': { h: 'right' } });
    expect(distributeCols(shape).tbl?.widths).toEqual([50, 50]);
  });

  it('sorts the rows under the heading by a column, as numbers or words', () => {
    const shape = { rows: [['Name', 'Age'], ['Tom', '9'], ['ann', '31'], ['Bea', '12']], tbl: tidyTable({ shades: { '1,0': '#ffff00' } }, 4, 2) };
    expect(sortTable(shape, 0).rows.map((r) => r[0])).toEqual(['Name', 'ann', 'Bea', 'Tom']);
    const byAge = sortTable(shape, 1, true);
    expect(byAge.rows.map((r) => r[1])).toEqual(['Age', '31', '12', '9']);
    // Shading goes with its row.
    expect(byAge.tbl?.shades).toEqual({ '3,0': '#ffff00' });
  });

  it('turns lines into a table and a table back into lines', () => {
    expect(linesToRows(['a,b,c', 'd,e'], ',')).toEqual([['a', 'b', 'c'], ['d', 'e', '']]);
    const doc = { blocks: [makeBlock('paragraph', 'Name\tAge'), makeBlock('paragraph', '', [], { runs: [{ text: 'Tom', marks: ['bold'] }, { text: '\t9', marks: [] }] })] };
    const sel = { anchor: { block: doc.blocks[0].id, offset: 0 }, focus: { block: doc.blocks[1].id, offset: 3 } };
    const out = applyOps(doc, textToTable({ doc, selection: sel, storedMarks: null }, '\t')!.ops);
    expect(out.blocks[0].type).toBe('table');
    expect(out.blocks[0].rows).toEqual([['Name', 'Age'], ['**Tom**', '9']]);
    const back = applyOps(out, tableToText({ doc: out, selection: caret({ block: out.blocks[1].id, offset: 0 }), storedMarks: null }, out.blocks[0].id)!.ops);
    expect(back.blocks.slice(0, 2).map((b) => runsText(b.runs))).toEqual(['Name\tAge', 'Tom\t9']);
    expect(back.blocks[1].runs[0].marks).toEqual(['bold']);
  });

  it('keeps several lines in a cell', () => {
    const text = cellText([{ text: 'One\n• two', marks: [] }]);
    expect(text).toBe('One&#10;• two');
    const md = `| A |\n| --- |\n| ${text} |\n`;
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].rows?.[1][0]).toBe('One&#10;• two');
    expect(toMarkdown(doc)).toBe(md);
  });
});
