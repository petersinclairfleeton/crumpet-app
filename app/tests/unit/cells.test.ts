// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeBlock } from '@crumpet/editor/model';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { cellPlain, cellText, fillCell, readCell, setCellLook, toggleCellMark } from '@crumpet/editor/cells';
import { addCol, deleteCol, setWidths } from '@crumpet/editor/table';

const select = (box: HTMLElement, from: number, to: number) => {
  const t = box.firstChild!;
  const r = document.createRange();
  r.setStart(t, from);
  r.setEnd(t, to);
  getSelection()!.removeAllRanges();
  getSelection()!.addRange(r);
};

describe('formatting in table cells', () => {
  it('cell text is inline Markdown, drawn and read back', () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    fillCell(box, '**Mara** and [Tom]{color=#cc0000}');
    expect(box.querySelector('strong')?.textContent).toBe('Mara');
    expect(readCell(box)).toBe('**Mara** and [Tom]{color=#cc0000}');
    expect(cellPlain('**Mara** and [Tom]{color=#cc0000}')).toBe('Mara and Tom');
    // Plain characters that look like Markdown stay plain.
    expect(cellText([{ text: 'a*b*c', marks: [] }])).toBe('a\\*b\\*c');
  });

  it('bold and a font size on the selected words, or on the word at the caret', () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    box.textContent = 'old lamp oil';
    select(box, 4, 8);
    toggleCellMark(box, 'bold');
    expect(readCell(box)).toBe('old **lamp** oil');
    box.textContent = 'old lamp oil';
    select(box, 10, 10);
    setCellLook(box, 'size', 14);
    expect(readCell(box)).toBe('old lamp [oil]{size=14}');
  });

  it('formatted cells and column widths are kept in the file', () => {
    let t = setWidths({ rows: [['**Name**', 'Age'], ['*Mara*', '32']] }, [70, 30]);
    const doc = { blocks: [makeBlock('table', '', [], { rows: t.rows, tbl: t.tbl })] };
    const md = toMarkdown(doc);
    expect(md).toContain('| **Name** | Age |');
    expect(md).toContain('{table widths=70-30}');
    const back = fromMarkdown(md).blocks[0];
    expect(back.rows).toEqual(t.rows);
    expect(back.tbl).toEqual({ widths: [70, 30] });
    t = addCol(t, 1);
    expect(t.tbl?.widths).toEqual([35, 35, 30]);
    expect(deleteCol(t, 0).tbl?.widths).toEqual([53.8, 46.2]);
  });
});
