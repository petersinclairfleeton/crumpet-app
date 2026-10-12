// Word's Insert > Table, for the formatting bar: a grid to pick the size,
// Draw Table (lines drawn across a box become rows and columns), Convert
// Text to Table, and Quick Tables (a calendar, a list, a matrix, a table
// with subheadings and totals). The windows live outside the bar (the More
// menu closes as they open), shown by TableHost.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import type { TableLook } from '@crumpet/editor/table';
import { Popover } from './Sidebar';
import { type ToolItem, closeMore } from './toolbar';

const EVENT = 'crumpet:table-window';
type Win = 'draw' | 'convert';
const openWindow = (w: Win) => window.dispatchEvent(new CustomEvent<Win>(EVENT, { detail: w }));

/** Quick Tables: ready-made tables to start from. */
export function quickTables(now = new Date()): { name: string; rows: string[][]; tbl?: TableLook }[] {
  // This month as a calendar, weeks starting on Monday.
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const cal: string[][] = [['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']];
  for (let d = 1 - lead; d <= days; d += 7) cal.push(Array.from({ length: 7 }, (_, k) => (d + k >= 1 && d + k <= days ? String(d + k) : '')));
  const monthName = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return [
    { name: `Calendar: ${monthName}`, rows: cal, tbl: { style: 'blue', heights: cal.map((_, i) => (i ? 0.6 : null)), aligns: Array(7).fill('center') } },
    {
      name: 'Tabular list',
      rows: [
        ['Item', 'Needed'],
        ['Notebooks', '2'],
        ['Pencils', '12'],
        ['Index cards', '1 pack'],
      ],
      tbl: { borders: 'rows', aligns: [null, 'right'] },
    },
    {
      name: 'Matrix',
      rows: [
        ['', 'Point A', 'Point B', 'Point C'],
        ['Point A', '—', '', ''],
        ['Point B', '', '—', ''],
        ['Point C', '', '', '—'],
      ],
      tbl: { firstCol: true, aligns: [null, 'center', 'center', 'center'] },
    },
    {
      name: 'Subheadings and totals',
      rows: [
        ['College', 'New students', 'Graduating', 'Change'],
        ['Undergraduate', '', '', ''],
        ['Cedar University', '110', '103', '=B3-C3'],
        ['Elm College', '223', '214', '=B4-C4'],
        ['Graduate', '', '', ''],
        ['Cedar University', '24', '20', '=B6-C6'],
        ['Total', '=SUM(B3:B6)', '=SUM(C3:C6)', '=D3+D4+D6'],
      ],
      tbl: { style: 'teal', totalRow: true, merges: [[1, 0, 1, 4], [4, 0, 1, 4]], shades: { '1,0': '#d0e0e3', '4,0': '#d0e0e3' }, aligns: [null, 'right', 'right', 'right'] },
    },
  ];
}

function TableTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  const insert = (rows: number, cols: number) => {
    setOpen(false);
    closeMore();
    ed?.focus();
    // The grid counts the heading row as one of the rows.
    ed?.insertTable(Math.max(1, rows - 1), cols);
  };
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Table" aria-expanded={open} title="Table" disabled={off} onClick={() => setOpen(!open)}>
        {ICON_TABLE}
        <span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && (
        <Popover label="Insert table" onClose={() => setOpen(false)}>
          <div className="table-pick-menu">
          <div className="table-pick">
            <p className="table-pick-size" aria-live="polite">{size[0] ? `${size[1]} × ${size[0]} table` : 'Insert table'}</p>
            <div className="table-grid" role="grid" aria-label="Table size" onMouseLeave={() => setSize([0, 0])}>
              {Array.from({ length: 8 }, (_, r) => (
                <div key={r} role="row" className="table-grid-row">
                  {Array.from({ length: 8 }, (_, c) => (
                    <button key={c} type="button" role="gridcell" aria-label={`${c + 1} by ${r + 1}`} className={r < size[0] && c < size[1] ? 'on' : ''} onMouseEnter={() => setSize([r + 1, c + 1])} onFocus={() => setSize([r + 1, c + 1])} onClick={() => insert(r + 1, c + 1)} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <hr className="menu-sep" />
          <button type="button" className="menu-item" onClick={() => (setOpen(false), openWindow('draw'))}>
            Draw table…
          </button>
          <button type="button" className="menu-item" onClick={() => (setOpen(false), openWindow('convert'))}>
            Convert text to table…
          </button>
          <div className="menu-head">Quick tables</div>
          {quickTables().map((q) => (
            <button
              key={q.name}
              type="button"
              className="menu-item"
              onClick={() => {
                setOpen(false);
                closeMore();
                ed?.focus();
                ed?.insertTableOf(q.rows, q.tbl);
              }}
            >
              {q.name}
            </button>
          ))}
          </div>
        </Popover>
      )}
    </span>
  );
}

export function tableItems(ed: Editor | null, off: boolean): ToolItem[] {
  return [{ key: 'table', label: 'Table', pri: 1, node: <TableTool ed={ed} off={off} /> }];
}

/** Shows Draw Table and Convert Text to Table when asked, for the bar's editor. */
export function TableHost({ ed }: { ed: Editor | null }) {
  const [win, setWin] = useState<Win | null>(null);
  useEffect(() => {
    const on = (e: Event) => setWin((e as CustomEvent<Win>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  if (!win || !ed) return null;
  return win === 'draw' ? <DrawTableDialog editor={ed} onClose={() => setWin(null)} /> : <ConvertDialog editor={ed} onClose={() => setWin(null)} />;
}

function useEscape(onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

/** Box size in px: 6 inches by 3.5, drawn at 70 px to the inch. */
const PX = 70;
const BOX_W = 6 * PX;
const BOX_H = 3.5 * PX;

/**
 * Word's Draw Table: the table's outline, with lines dragged across it
 * (between rows) or down it (between columns); a line clicked is rubbed out.
 * The lines' places become the columns' widths and the rows' heights.
 */
function DrawTableDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
  useEscape(onClose);
  const [rowsAt, setRowsAt] = useState<number[]>([BOX_H / 3, (BOX_H * 2) / 3]);
  const [colsAt, setColsAt] = useState<number[]>([BOX_W / 3, (BOX_W * 2) / 3]);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const at = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(BOX_W, e.clientX - r.left)), y: Math.max(0, Math.min(BOX_H, e.clientY - r.top)) };
  };
  const finish = () => {
    if (!drag) return;
    const dx = Math.abs(drag.x - drag.x0);
    const dy = Math.abs(drag.y - drag.y0);
    // A line drawn mostly across splits rows; mostly down, columns. Too near another line or the edge: not drawn.
    if (dx > 30 && dx > dy) {
      const y = drag.y0;
      if (y > 12 && y < BOX_H - 12 && rowsAt.every((v) => Math.abs(v - y) > 12)) setRowsAt([...rowsAt, y].sort((a, b) => a - b));
    } else if (dy > 30) {
      const x = drag.x0;
      if (x > 20 && x < BOX_W - 20 && colsAt.every((v) => Math.abs(v - x) > 20)) setColsAt([...colsAt, x].sort((a, b) => a - b));
    }
    setDrag(null);
  };
  const insert = () => {
    const xs = [0, ...colsAt, BOX_W];
    const ys = [0, ...rowsAt, BOX_H];
    const widths = xs.slice(1).map((x, i) => ((x - xs[i]) / BOX_W) * 100);
    const heights = ys.slice(1).map((y, i) => Math.round(((y - ys[i]) / PX) * 100) / 100);
    const rows = heights.map(() => widths.map(() => ''));
    editor.focus();
    editor.insertTableOf(rows, { widths, heights });
    onClose();
  };
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog draw-table" role="dialog" aria-modal="true" aria-label="Draw table">
        <header className="dialog-head">
          <h2>Draw table</h2>
        </header>
        <div className="settings">
        <p className="sync-hint">Drag across the box to draw a line between rows, or down it for a line between columns. Click a line to rub it out.</p>
        <div
          ref={box}
          className="draw-box"
          role="img"
          aria-label={`A table of ${rowsAt.length + 1} rows and ${colsAt.length + 1} columns`}
          style={{ width: BOX_W, height: BOX_H }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).dataset.line) return;
            const p = at(e);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDrag({ x0: p.x, y0: p.y, x: p.x, y: p.y });
          }}
          onPointerMove={(e) => drag && setDrag({ ...drag, ...at(e) })}
          onPointerUp={finish}
        >
          {rowsAt.map((y) => (
            <button key={`r${y}`} type="button" data-line="row" className="draw-line row" style={{ top: y - 4 }} aria-label="Rub out this line between rows" onClick={() => setRowsAt(rowsAt.filter((v) => v !== y))} />
          ))}
          {colsAt.map((x) => (
            <button key={`c${x}`} type="button" data-line="col" className="draw-line col" style={{ left: x - 4 }} aria-label="Rub out this line between columns" onClick={() => setColsAt(colsAt.filter((v) => v !== x))} />
          ))}
          {drag && <span className="draw-pencil" style={Math.abs(drag.x - drag.x0) > Math.abs(drag.y - drag.y0) ? { top: drag.y0, left: Math.min(drag.x0, drag.x), width: Math.abs(drag.x - drag.x0), height: 2 } : { left: drag.x0, top: Math.min(drag.y0, drag.y), height: Math.abs(drag.y - drag.y0), width: 2 }} />}
        </div>
        <footer className="para-foot">
          <span className="muted grow">
            {rowsAt.length + 1} rows × {colsAt.length + 1} columns
          </span>
          <button type="button" className="btn quiet" onClick={() => (setRowsAt([]), setColsAt([]))}>
            Clear lines
          </button>
          <button type="button" className="btn quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={insert}>
            Insert table
          </button>
        </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Word's Convert Text to Table: the selected lines, cut into cells at tabs, commas, spaces or a character of one's own. */
function ConvertDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
  useEscape(onClose);
  const [sep, setSep] = useState<'\t' | ',' | ' ' | 'other'>('\t');
  const [other, setOther] = useState(';');
  const [failed, setFailed] = useState(false);
  const go = () => {
    editor.focus();
    if (!editor.textToTable(sep === 'other' ? other || ';' : sep)) {
      setFailed(true);
      return;
    }
    onClose();
  };
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="dialog para-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Convert text to table"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <header className="dialog-head">
          <h2>Convert text to table</h2>
        </header>
        <div className="settings">
        <p className="sync-hint">Each selected line becomes a row; its text is cut into cells at:</p>
        <fieldset className="radio-list">
          {(
            [
              ['\t', 'Tabs'],
              [',', 'Commas'],
              [' ', 'Spaces'],
            ] as const
          ).map(([v, label]) => (
            <label key={label}>
              <input type="radio" name="sep" checked={sep === v} onChange={() => setSep(v)} /> {label}
            </label>
          ))}
          <label>
            <input type="radio" name="sep" checked={sep === 'other'} onChange={() => setSep('other')} /> Other:
            <input aria-label="Other separator" className="sep-other" maxLength={3} value={other} onChange={(e) => (setOther(e.target.value), setSep('other'))} />
          </label>
        </fieldset>
        {failed && <p className="error">Select some lines of text first (pictures and tables can't be part of it).</p>}
        <footer className="para-foot">
          <button type="button" className="btn quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            OK
          </button>
        </footer>
        </div>
      </form>
    </div>,
    document.body,
  );
}

const ICON_TABLE = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M3 15h18M9 4v16M15 4v16" />
  </svg>
);
