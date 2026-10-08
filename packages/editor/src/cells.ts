// Formatted text in table cells. A cell's text is kept as a line of inline
// Markdown (so **bold** in a cell is bold, as in any pipe table); in the page
// each cell is its own little editable box, read back into Markdown as typed.

import { type Look, type LookKey, type Mark, type Run, MARK_ORDER, clearFormatOnRuns, commonLook, normalizeRuns, setLookOnRuns, sliceRuns, sortMarks, tidyLook } from './model';
import { inlineMarkdown, parseInline } from './markdown';
import { runNode } from './view';

/** A cell's text as runs. */
export function cellRuns(text: string): Run[] {
  return text ? parseInline(text) : [];
}

/** Runs as a cell's text. */
export function cellText(runs: Run[]): string {
  return inlineMarkdown(normalizeRuns(runs)).replace(/[\r\n]+/g, ' ');
}

/** A cell's text without its formatting (for counting words and searching). */
export function cellPlain(text: string): string {
  return cellRuns(text)
    .map((r) => r.text)
    .join('');
}

/** Draws a cell's text into its box. */
export function fillCell(box: HTMLElement, text: string): void {
  box.textContent = '';
  for (const run of cellRuns(text)) box.appendChild(runNode(run));
}

const TAG_MARKS: Record<string, Mark> = { B: 'bold', STRONG: 'bold', I: 'italic', EM: 'italic', U: 'underline', S: 'strike', STRIKE: 'strike', DEL: 'strike', CODE: 'code' };

/** #rrggbb from a CSS colour (hex or rgb()), or undefined for none. */
export function hexColor(css: string): string | undefined {
  const c = css.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  if (/^#[0-9a-f]{3}$/.test(c)) return `#${[...c.slice(1)].map((x) => x + x).join('')}`;
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(c);
  if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return undefined;
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

/** Points from a CSS font size (pt or px), or undefined. */
function points(css: string): number | undefined {
  const m = /^([\d.]+)(pt|px)$/.exec(css.trim());
  if (!m) return undefined;
  return Math.round((m[2] === 'px' ? Number(m[1]) * 0.75 : Number(m[1])) * 2) / 2;
}

/** The look an element's own inline style gives. */
export function lookOfStyle(style: CSSStyleDeclaration, tag = ''): Look {
  const look: Look = {};
  const font = style.fontFamily.split(',')[0]?.trim().replace(/^["']|["']$/g, '');
  if (font && !font.startsWith('var(') && !/^(inherit|initial|serif|sans-serif|monospace)$/.test(font)) look.font = font;
  const size = points(style.fontSize);
  if (size && style.verticalAlign !== 'super' && style.verticalAlign !== 'sub') look.size = size;
  const color = hexColor(style.color);
  if (color) look.color = color;
  const bg = hexColor(style.backgroundColor);
  if (bg) look.highlight = bg;
  if (style.verticalAlign === 'super' || tag === 'SUP') look.va = 'super';
  if (style.verticalAlign === 'sub' || tag === 'SUB') look.va = 'sub';
  return look;
}

/** What a cell's box shows, as runs. */
export function domRuns(root: HTMLElement): Run[] {
  const runs: Run[] = [];
  const walk = (node: Node, marks: Mark[], look: Look, link: string | undefined) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/[\r\n]+/g, ' ');
      if (text) runs.push({ text, marks: sortMarks([...new Set(marks)]), ...(tidyLook(look) ? { look: tidyLook(look) } : {}), ...(link ? { link } : {}) });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === 'BR') return;
    const m = TAG_MARKS[node.tagName];
    const style = node.style;
    const more: Mark[] = [...marks, ...(m ? [m] : [])];
    if (style.fontWeight === 'bold' || Number(style.fontWeight) >= 600) more.push('bold');
    if (style.fontStyle === 'italic') more.push('italic');
    if (style.textDecorationLine?.includes('underline') || style.textDecoration?.includes('underline')) more.push('underline');
    if (style.textDecorationLine?.includes('line-through') || style.textDecoration?.includes('line-through')) more.push('strike');
    const nextLook = { ...look, ...lookOfStyle(style, node.tagName) };
    const href = node.tagName === 'A' ? (node.getAttribute('href') ?? undefined) : link;
    node.childNodes.forEach((c) => walk(c, more.filter((x) => MARK_ORDER.includes(x)), nextLook, href));
  };
  root.childNodes.forEach((c) => walk(c, [], {}, undefined));
  return normalizeRuns(runs);
}

/** A cell's box read back as its text. */
export function readCell(box: HTMLElement): string {
  return cellText(domRuns(box));
}

// ---------------------------------------------------------------- formatting in a cell

/** Where the selection was in each cell when it was last there (the font box and others take the focus for a moment). */
const remembered = new WeakMap<HTMLElement, { from: number; to: number }>();

/** The selection in a cell as text offsets, exactly; remembered for when the focus is elsewhere. */
export function rememberCellSelection(box: HTMLElement): void {
  const sel = box.ownerDocument.getSelection();
  if (!sel?.rangeCount || !box.contains(sel.anchorNode) || !box.contains(sel.focusNode)) return;
  const at = (node: Node, offset: number) => {
    const r = box.ownerDocument.createRange();
    r.selectNodeContents(box);
    r.setEnd(node, offset);
    return r.toString().length;
  };
  const a = at(sel.anchorNode!, sel.anchorOffset);
  const b = at(sel.focusNode!, sel.focusOffset);
  remembered.set(box, { from: Math.min(a, b), to: Math.max(a, b) });
}

/** Puts the focus back in a cell, with the selection it had. */
export function refocusCell(box: HTMLElement): void {
  box.focus();
  const r = remembered.get(box);
  if (r) placeCaret(box, r.from, r.to);
}

/** The selection inside a cell's box, as text offsets (a caret widens to its word, as in Word). */
function cellRange(box: HTMLElement): { from: number; to: number } | null {
  const sel = box.ownerDocument.getSelection();
  if (!sel?.rangeCount || !box.contains(sel.anchorNode) || !box.contains(sel.focusNode)) {
    const r = remembered.get(box);
    if (!r) return null;
    return widen(box, r.from, r.to);
  }
  const at = (node: Node, offset: number) => {
    const r = box.ownerDocument.createRange();
    r.selectNodeContents(box);
    r.setEnd(node, offset);
    return r.toString().length;
  };
  const a = at(sel.anchorNode!, sel.anchorOffset);
  const b = at(sel.focusNode!, sel.focusOffset);
  return widen(box, Math.min(a, b), Math.max(a, b));
}

function widen(box: HTMLElement, from: number, to: number): { from: number; to: number } | null {
  if (from === to) {
    const text = box.textContent ?? '';
    const word = /[\p{L}\p{N}'’_-]/u;
    while (from > 0 && word.test(text[from - 1])) from--;
    while (to < text.length && word.test(text[to])) to++;
  }
  return from < to ? { from, to } : null;
}

function placeCaret(box: HTMLElement, from: number, to: number): void {
  const doc = box.ownerDocument;
  const find = (n: number): [Node, number] => {
    const walker = doc.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let last: Node = box;
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const len = t.textContent?.length ?? 0;
      if (n <= pos + len) return [t, n - pos];
      pos += len;
      last = t;
    }
    return [last, last === box ? 0 : (last.textContent?.length ?? 0)];
  };
  const range = doc.createRange();
  range.setStart(...find(from));
  range.setEnd(...find(to));
  const sel = doc.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/**
 * Changes the formatting of what's selected in a cell (or the word at the
 * caret) and redraws it; the cell then reports an edit, as typing does.
 */
export function formatCell(box: HTMLElement, change: (runs: Run[], all: Run[]) => Run[]): boolean {
  const range = cellRange(box);
  if (!range) return false;
  const runs = domRuns(box);
  const len = runs.reduce((n, r) => n + r.text.length, 0);
  const mid = change(sliceRuns(runs, range.from, range.to), runs);
  const next = normalizeRuns([...sliceRuns(runs, 0, range.from), ...mid, ...sliceRuns(runs, range.to, len)]);
  fillCell(box, cellText(next));
  remembered.set(box, range);
  if (box.ownerDocument.activeElement === box) placeCaret(box, range.from, range.to);
  box.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'formatBold' }));
  return true;
}

/** The selected text in a cell, as runs (for showing what's on in the toolbar). */
export function cellSelection(box: HTMLElement): Run[] {
  const range = cellRange(box);
  if (!range) return [];
  return sliceRuns(domRuns(box), range.from, range.to);
}

export function toggleCellMark(box: HTMLElement, mark: Mark): boolean {
  return formatCell(box, (runs) => {
    const on = runs.length > 0 && runs.every((r) => r.marks.includes(mark));
    return runs.map((r) => ({ ...r, marks: sortMarks(on ? r.marks.filter((m) => m !== mark) : [...r.marks.filter((m) => m !== mark), mark]) }));
  });
}

export function setCellLook(box: HTMLElement, key: LookKey, value: string | number | null): boolean {
  return formatCell(box, (runs) => setLookOnRuns(runs, key, value));
}

export function clearCellFormat(box: HTMLElement): boolean {
  return formatCell(box, (runs) => clearFormatOnRuns(runs));
}

export function cellMarkActive(box: HTMLElement, mark: Mark): boolean {
  const runs = cellSelection(box);
  return runs.length > 0 && runs.every((r) => r.marks.includes(mark));
}

export function cellLookValue<K extends LookKey>(box: HTMLElement, key: K): Look[K] | undefined {
  return commonLook(cellSelection(box), key);
}
