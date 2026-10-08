// Word's table formatting, kept beside a table's cells: merged cells, cell
// shading, each column's alignment, the heading row, banded rows and which
// lines are drawn. Changing a table's shape keeps all of it in step.

/** Lines drawn: every line (when unset), just the outside, just between rows, or none. */
export type TableBorders = 'outside' | 'rows' | 'none';
export type CellAlign = 'center' | 'right';

export interface TableLook {
  /** The first row is ordinary, not a heading row. */
  noHeader?: boolean;
  /** Every other row shaded. */
  banded?: boolean;
  borders?: TableBorders;
  /** Merged cells: [row, column, rows, columns] of each, from its top-left cell. */
  merges?: [number, number, number, number][];
  /** Cell shading, by "row,column". */
  shades?: Record<string, string>;
  /** Each column's alignment (unset: left). */
  aligns?: (CellAlign | null)[];
  /** Each column's share of the table's width, in percent (unset: shared out by the browser). */
  widths?: number[];
}

const BORDERS: TableBorders[] = ['outside', 'rows', 'none'];

/** A table's look in its simplest form (undefined when there's nothing set), fitted to rows × cols. */
export function tidyTable(t: TableLook | undefined, rows: number, cols: number): TableLook | undefined {
  if (!t) return undefined;
  const out: TableLook = {};
  if (t.noHeader) out.noHeader = true;
  if (t.banded) out.banded = true;
  if (t.borders && BORDERS.includes(t.borders)) out.borders = t.borders;
  const merges: [number, number, number, number][] = [];
  const taken = new Set<string>();
  for (const m of t.merges ?? []) {
    if (!Array.isArray(m) || m.length !== 4 || !m.every((n) => Number.isInteger(n) && n >= 0)) continue;
    const [r, c] = m;
    const rs = Math.min(m[2], rows - r);
    const cs = Math.min(m[3], cols - c);
    if (r >= rows || c >= cols || rs < 1 || cs < 1 || (rs === 1 && cs === 1)) continue;
    // Overlapping merges: the first wins.
    const cells: string[] = [];
    for (let i = r; i < r + rs; i++) for (let j = c; j < c + cs; j++) cells.push(`${i},${j}`);
    if (cells.some((k) => taken.has(k))) continue;
    cells.forEach((k) => taken.add(k));
    merges.push([r, c, rs, cs]);
  }
  if (merges.length) out.merges = merges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const shades: Record<string, string> = {};
  for (const [k, v] of Object.entries(t.shades ?? {}).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    const [r, c] = k.split(',').map(Number);
    if (Number.isInteger(r) && Number.isInteger(c) && r < rows && c < cols && /^#[0-9a-f]{6}$/i.test(v)) shades[`${r},${c}`] = v.toLowerCase();
  }
  if (Object.keys(shades).length) out.shades = shades;
  const aligns = Array.from({ length: cols }, (_, i) => (t.aligns?.[i] === 'center' || t.aligns?.[i] === 'right' ? t.aligns[i] : null));
  if (aligns.some(Boolean)) {
    while (aligns.length && !aligns[aligns.length - 1]) aligns.pop();
    out.aligns = aligns;
  }
  const w = t.widths;
  if (w && w.length === cols && w.every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0)) {
    const sum = w.reduce((a, b) => a + b, 0);
    out.widths = w.map((x) => Math.round((x / sum) * 1000) / 10);
  }
  return Object.keys(out).length ? out : undefined;
}

export function sameTable(a: TableLook | undefined, b: TableLook | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** The merge a cell is part of, if any. */
export function mergeAt(t: TableLook | undefined, r: number, c: number): [number, number, number, number] | undefined {
  return t?.merges?.find(([mr, mc, rs, cs]) => r >= mr && r < mr + rs && c >= mc && c < mc + cs);
}

/** True for a cell hidden under a merged cell (not its top-left). */
export function isCovered(t: TableLook | undefined, r: number, c: number): boolean {
  const m = mergeAt(t, r, c);
  return !!m && (m[0] !== r || m[1] !== c);
}

export interface TableShape {
  rows: string[][];
  tbl?: TableLook;
}

const remap = (t: TableLook | undefined, row: (r: number) => number | null, col: (c: number) => number | null, grow?: { row?: number; col?: number }): TableLook | undefined => {
  if (!t) return t;
  const out: TableLook = { ...t };
  if (t.merges)
    out.merges = t.merges.flatMap(([r, c, rs, cs]) => {
      // A merge keeps the rows and columns of it that are still there; a row or column added inside it widens it.
      const rows = Array.from({ length: rs }, (_, i) => row(r + i)).filter((x): x is number => x !== null);
      const cols = Array.from({ length: cs }, (_, i) => col(c + i)).filter((x): x is number => x !== null);
      if (!rows.length || !cols.length) return [];
      const extraR = grow?.row !== undefined && grow.row > r && grow.row < r + rs ? 1 : 0;
      const extraC = grow?.col !== undefined && grow.col > c && grow.col < c + cs ? 1 : 0;
      return [[rows[0], cols[0], rows.length + extraR, cols.length + extraC] as [number, number, number, number]];
    });
  if (t.shades) {
    out.shades = {};
    for (const [k, v] of Object.entries(t.shades)) {
      const [r, c] = k.split(',').map(Number);
      const nr = row(r);
      const nc = col(c);
      if (nr !== null && nc !== null) out.shades[`${nr},${nc}`] = v;
    }
  }
  if (t.aligns) {
    const aligns: (CellAlign | null)[] = [];
    t.aligns.forEach((a, c) => {
      const nc = col(c);
      if (nc !== null) aligns[nc] = a;
    });
    out.aligns = Array.from(aligns, (a) => a ?? null);
  }
  return out;
};

/** Adds a row at index `at` (cells copied in shape from the row before, empty). */
export function addRow({ rows, tbl }: TableShape, at: number): TableShape {
  const width = rows[0]?.length ?? 1;
  const next = [...rows.slice(0, at), Array(width).fill(''), ...rows.slice(at)];
  return { rows: next, tbl: tidyTable(remap(tbl, (r) => (r >= at ? r + 1 : r), (c) => c, { row: at }), next.length, width) };
}

export function addCol({ rows, tbl }: TableShape, at: number): TableShape {
  const next = rows.map((row) => [...row.slice(0, at), '', ...row.slice(at)]);
  const t = remap(tbl, (r) => r, (c) => (c >= at ? c + 1 : c), { col: at });
  if (t?.aligns) t.aligns[at] = t.aligns[at - 1] ?? null;
  if (t?.widths) {
    // The new column takes half of the one beside it.
    const w = [...t.widths];
    const from = Math.max(0, Math.min(at - 1, w.length - 1));
    const half = w[from] / 2;
    w[from] = half;
    w.splice(at, 0, half);
    t.widths = w;
  }
  return { rows: next, tbl: tidyTable(t, next.length, next[0].length) };
}

export function deleteRow({ rows, tbl }: TableShape, at: number): TableShape {
  if (rows.length <= 1) return { rows, tbl };
  const next = rows.filter((_, i) => i !== at);
  return { rows: next, tbl: tidyTable(remap(tbl, (r) => (r === at ? null : r > at ? r - 1 : r), (c) => c), next.length, next[0].length) };
}

export function deleteCol({ rows, tbl }: TableShape, at: number): TableShape {
  if ((rows[0]?.length ?? 1) <= 1) return { rows, tbl };
  const next = rows.map((row) => row.filter((_, i) => i !== at));
  const t = remap(tbl, (r) => r, (c) => (c === at ? null : c > at ? c - 1 : c));
  if (t?.widths) t.widths = t.widths.filter((_, i) => i !== at);
  return { rows: next, tbl: tidyTable(t, next.length, next[0].length) };
}

/**
 * Merges the cell (or merged cell) at r, c with the one to its right or below,
 * as Word's Merge Cells: the text of both is kept, one after the other.
 * Unchanged when the cells don't line up into a rectangle.
 */
export function mergeCells({ rows, tbl }: TableShape, r: number, c: number, dir: 'right' | 'down'): TableShape {
  const [mr, mc, rs, cs] = mergeAt(tbl, r, c) ?? [r, c, 1, 1];
  const nr = dir === 'down' ? mr + rs : mr;
  const nc = dir === 'right' ? mc + cs : mc;
  if (nr >= rows.length || nc >= (rows[0]?.length ?? 0)) return { rows, tbl };
  const [or, oc, ors, ocs] = mergeAt(tbl, nr, nc) ?? [nr, nc, 1, 1];
  // The two must share an edge exactly.
  if (dir === 'right' ? or !== mr || ors !== rs : oc !== mc || ocs !== cs) return { rows, tbl };
  const merged: [number, number, number, number] = dir === 'right' ? [mr, mc, rs, cs + ocs] : [mr, mc, rs + ors, cs];
  const next = rows.map((row) => [...row]);
  const texts = [next[mr][mc], next[or][oc]].filter((s) => s.trim());
  next[mr][mc] = texts.join(' ');
  for (let i = merged[0]; i < merged[0] + merged[2]; i++) for (let j = merged[1]; j < merged[1] + merged[3]; j++) if (i !== mr || j !== mc) next[i][j] = '';
  const merges = (tbl?.merges ?? []).filter((m) => !(m[0] === mr && m[1] === mc) && !(m[0] === or && m[1] === oc));
  return { rows: next, tbl: tidyTable({ ...tbl, merges: [...merges, merged] }, next.length, next[0].length) };
}

/** Splits a merged cell back into single cells. */
export function splitCell({ rows, tbl }: TableShape, r: number, c: number): TableShape {
  const m = mergeAt(tbl, r, c);
  if (!m) return { rows, tbl };
  return { rows, tbl: tidyTable({ ...tbl, merges: tbl!.merges!.filter((x) => x !== m) }, rows.length, rows[0].length) };
}

/** Shades a cell (all of a merged cell); null takes the shading off. */
export function shadeCell({ rows, tbl }: TableShape, r: number, c: number, color: string | null): TableShape {
  const [mr, mc] = mergeAt(tbl, r, c) ?? [r, c];
  const shades = { ...tbl?.shades };
  if (color) shades[`${mr},${mc}`] = color;
  else delete shades[`${mr},${mc}`];
  return { rows, tbl: tidyTable({ ...tbl, shades }, rows.length, rows[0].length) };
}

/** Aligns a column's cells. */
export function alignCol({ rows, tbl }: TableShape, c: number, align: CellAlign | null): TableShape {
  const aligns = [...(tbl?.aligns ?? [])];
  aligns[c] = align;
  return { rows, tbl: tidyTable({ ...tbl, aligns: Array.from(aligns, (a) => a ?? null) }, rows.length, rows[0].length) };
}

/** Sets each column's share of the width (percent); undefined lets the columns share it out again. */
export function setWidths({ rows, tbl }: TableShape, widths: number[] | undefined): TableShape {
  return { rows, tbl: tidyTable({ ...tbl, widths }, rows.length, rows[0].length) };
}

/** Sets the heading row, banded rows or lines. */
export function setTableLook({ rows, tbl }: TableShape, patch: Pick<TableLook, 'noHeader' | 'banded' | 'borders'>): TableShape {
  return { rows, tbl: tidyTable({ ...tbl, ...patch }, rows.length, rows[0].length) };
}

// ---------------------------------------------------------------- Markdown

/**
 * The look as the line written under a pipe table, e.g.
 * `{table .noheader .banded borders=rows merge=0-0-1-2 shade=1-2-#fff2cc}`.
 * Column alignment goes in the table's own rule row instead.
 */
export function tableAttrs(t: TableLook | undefined): string {
  if (!t) return '';
  const parts = [
    t.noHeader ? '.noheader' : '',
    t.banded ? '.banded' : '',
    t.borders ? `borders=${t.borders}` : '',
    ...(t.merges ?? []).map((m) => `merge=${m.join('-')}`),
    ...Object.entries(t.shades ?? {}).map(([k, v]) => `shade=${k.replace(',', '-')}-${v}`),
    t.widths ? `widths=${t.widths.join('-')}` : '',
  ].filter(Boolean);
  return parts.length ? `{table ${parts.join(' ')}}` : '';
}

export const TABLE_ATTRS = /^[ \t]*\{table((?:[ \t]+(?:\.noheader|\.banded|borders=[a-z]+|merge=\d+-\d+-\d+-\d+|shade=\d+-\d+-#[0-9a-fA-F]{6}|widths=[\d.]+(?:-[\d.]+)*))*)[ \t]*\}[ \t]*$/;

/** Reads the line written by tableAttrs (aligns come from the rule row). */
export function readTableAttrs(line: string): TableLook | null {
  const m = TABLE_ATTRS.exec(line);
  if (!m) return null;
  const t: TableLook = {};
  for (const tok of m[1].trim().split(/\s+/).filter(Boolean)) {
    if (tok === '.noheader') t.noHeader = true;
    else if (tok === '.banded') t.banded = true;
    else if (tok.startsWith('borders=')) t.borders = tok.slice(8) as TableBorders;
    else if (tok.startsWith('merge=')) (t.merges ??= []).push(tok.slice(6).split('-').map(Number) as [number, number, number, number]);
    else if (tok.startsWith('widths=')) t.widths = tok.slice(7).split('-').map(Number);
    else if (tok.startsWith('shade=')) {
      const [r, c, hex] = tok.slice(6).split('-');
      (t.shades ??= {})[`${r},${c}`] = hex;
    }
  }
  return t;
}
