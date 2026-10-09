// The editor: owns the state, listens to the browser, and turns every input
// into a transaction. The browser's own editing is cancelled wherever we can
// (beforeinput); where we cannot (IME composition, some spellcheck and
// autocorrect paths), we let the DOM change and then read it back into the
// model as ordinary ops.

import {
  type Align,
  type Block,
  type BlockType,
  type Doc,
  type Mark,
  type Pos,
  type Selection,
  caret,
  getBlock,
  isCollapsed,
  normalizeLink,
  orderedRange,
  runsLength,
  tidyRows,
  sectionLook,
  type SectionLook,
  runsText,
  sliceRuns,
  footnotes,
  FOOTNOTE,
  type Comment,
  comments,
  type Change,
  changes,
  makeChange,
  type Look,
  type LookKey,
  type ParaLook,
  type ParaKey,
  type NumFormat,
  type BulletKind,
  type CodeLook,
  lookAt,
} from './model';
import { type Op, applyOps, attrsOf, blockAttrs } from './ops';
import { type CellAlign, type TableBorders, type TableShape, isTableStyle, addCol, addRow, alignCol, deleteCol, deleteRow, mergeAt, mergeCells, setTableLook, setWidths, shadeCell, splitCell } from './table';
import {
  type EditorState,
  type Transaction,
  deleteBetween,
  deleteChar,
  autoLink,
  currentLink,
  deleteSelection,
  indent,
  insertText,
  pasteLink,
  insertMedia,
  insertLinkedText,
  setLink,
  joinBackward,
  joinForward,
  markActive,
  markdownShortcut,
  setBlockType,
  setBlockStyle,
  setAlign,
  splitBlock,
  syncBlockText,
  toggleMark,
  toggleTodo,
  toggleFold,
  insertTable,
  insertFootnote,
  setFootnote,
  addComment,
  setComment,
  trackedInsertText,
  trackedDelete,
  resolveChanges,
  insertBlocks,
  trackedSplit,
  trackedJoin,
  setTableRows,
  setLook,
  lookValue,
  clearFormatting,
  changeCase,
  type CaseChange,
  setPara,
  paraValue,
  stepIndent,
  insertPageBreak,
  setListStyle,
  setListStart,
  insertToc,
  insertShape,
  setShape,
  insertCode,
  setCode,
  insertColumnBreak,
  insertSectionBreak,
  setSection,
  setAllSections,
  type SectionPatch,
} from './commands';
import { History } from './history';
import { type FindOptions, type Match, findMatches, replaceMatches } from './find';
import { type TocEntry, View, readTable } from './view';
import { type ShapeKind, type ShapeLook } from './shape';
import { readCell, cellLookValue, cellMarkActive, clearCellFormat, refocusCell, rememberCellSelection, setCellLook, toggleCellMark } from './cells';
import { noteLink } from './markdown';
import { type PageBox, type PageGeometry, Paginator } from './paginate';
import { type Step, mapSelectionThrough } from './sync/transform';

export interface ChangeEvent {
  ops: Op[];
  source: 'input' | 'undo' | 'redo' | 'native' | 'command' | 'remote';
}

type Listener = (state: EditorState, change: ChangeEvent | null) => void;

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export class Editor {
  state: EditorState;
  readonly view: View;
  readonly history = new History();
  private listeners: Listener[] = [];
  private composing: { block: string } | null = null;
  /** Set when we let a beforeinput through, so the following input event knows to read the DOM back. */
  private nativeEdit = false;
  /** Logged so the prototype can show what the browser asked for. */
  readonly inputLog: string[] = [];
  private paginator: Paginator;
  private paged = false;

  /** Page view: lays the text out in pages of this size (null: one long page). */
  setPages(geometry: PageGeometry | null): void {
    const sel = this.keepSelection();
    this.paged = !!geometry;
    this.paginator.set(geometry);
    sel();
    this.emit(null);
  }

  /** How many pages the text fills in page view. */
  get pages(): number {
    return this.paginator.pages;
  }

  /** Page view: where each page is and how big (unscaled px from the top left of the text). */
  get pageBoxes(): PageBox[] {
    return this.paginator.pageBoxes;
  }

  /**
   * A table of contents listing more than this document (a book's chapters
   * and their headings); null: this document's headings.
   */
  setTocEntries(entries: TocEntry[] | null): void {
    if (JSON.stringify(entries) === JSON.stringify(this.view.tocOverride)) return;
    this.view.tocOverride = entries;
    const tocs = this.state.doc.blocks.filter((b) => b.type === 'toc');
    if (tocs.length) this.draw(this.state.doc, new Set(tocs.map((b) => b.id)));
  }

  /** Pages before this document's first, for the page numbers in its table of contents. */
  setPageOffset(n: number): void {
    if (this.paginator.pageOffset === n) return;
    this.paginator.pageOffset = n;
    if (this.paged && this.state.doc.blocks.some((b) => b.type === 'toc')) this.repaginate();
  }

  /** Footnotes before this document's first, so a book's footnote numbers run on from chapter to chapter. */
  get footnoteStart(): number {
    return this.view.footnoteStart;
  }

  setFootnoteStart(n: number): void {
    if (this.view.footnoteStart === n) return;
    this.view.footnoteStart = n;
    this.view.numberFootnotes();
    this.emit(null);
  }

  /** A line of the table of contents for something not in this document (another chapter) was clicked. */
  onTocTarget: ((target: { chapter: string; block?: string }) => void) | null = null;

  /** Page view: the page (from 0) a block starts on. */
  pageOfBlock(id: string): number | undefined {
    return this.paginator.pageOf.get(id);
  }

  /** Page view: the footnotes at the foot of each page (numbers from 0), page by page. */
  get pageNotes(): number[][] {
    return this.paginator.pageNotes;
  }

  /** Page view: how tall footnote `index` is at the foot of a page; null leaves footnotes out of the pages. */
  setNoteHeights(fn: ((index: number) => number) | null): void {
    this.paginator.noteHeight = fn;
    this.repaginate();
  }

  /** Lays out the pages again, e.g. after fonts load or the styles change. */
  repaginate(): void {
    if (this.paged && !this.isComposing) {
      const before = this.layoutKey();
      const sel = this.keepSelection();
      this.paginator.update();
      sel();
      if (this.layoutKey() !== before) this.emit(null);
    }
  }

  private layoutKey(): string {
    return `${this.paginator.pages}|${JSON.stringify(this.paginator.pageNotes)}|${JSON.stringify(this.paginator.pageBoxes)}`;
  }

  /** Remembers the selection (as places in the text) and returns how to put it back after the page moves things around. */
  private keepSelection(): () => void {
    const focused = this.view.root.contains(this.view.root.ownerDocument.activeElement) && !this.activeCell();
    const sel = focused ? this.view.readSelection() : null;
    return () => {
      if (sel) this.view.writeSelection(sel);
    };
  }

  /**
   * Draws the document, then (in page view) its pages. In page view the
   * pages are taken apart first, so the blocks are one flow again while
   * they're drawn. Never during IME composition, which must not be
   * disturbed: it's drawn when that ends.
   */
  private draw(doc: Doc, force?: Set<string>): void {
    if (this.paged && this.isComposing) return;
    if (this.paged) {
      const sel = this.keepSelection();
      this.paginator.clear();
      this.view.render(doc, force);
      this.paginator.update();
      sel();
      return;
    }
    this.view.render(doc, force);
  }

  constructor(root: HTMLElement, doc: Doc) {
    const first = doc.blocks[0];
    this.state = { doc, selection: caret({ block: first.id, offset: 0 }), storedMarks: null };
    this.view = new View(root);
    this.paginator = new Paginator(root);
    this.draw(doc);

    const signal = this.listening.signal;
    // Tables are boxes of their own inside the text: their cells handle typing themselves.
    root.addEventListener('beforeinput', (e) => inWidget(e.target) || this.onBeforeInput(e), { signal });
    root.addEventListener('input', (e) => (inWidget(e.target) ? this.onTableInput(e.target as HTMLElement) : this.onInput()), { signal });
    root.addEventListener('keydown', (e) => (inWidget(e.target) ? this.onTableKey(e) : this.onKeyDown(e)), { signal });
    root.addEventListener('compositionstart', (e) => inWidget(e.target) || this.onCompositionStart(), { signal });
    root.addEventListener('compositionend', (e) => inWidget(e.target) || this.onCompositionEnd(), { signal });
    root.addEventListener('paste', (e) => (inWidget(e.target) ? isSource(e.target) || pastePlain(e) : this.onPaste(e)), { signal });
    // Maths and diagrams: their kind, and their source box shown while it's being edited.
    root.addEventListener(
      'change',
      (e) => {
        const kind = (e.target as Element).closest?.<HTMLSelectElement>('select[data-code-lang]');
        const id = kind?.closest<HTMLElement>('[data-block]')?.dataset.block;
        if (kind && id) this.dispatch(setCode(this.state, id, { lang: kind.value as CodeLook['lang'] }), 'command');
      },
      { signal },
    );
    root.addEventListener('focusin', (e) => isSource(e.target) && (e.target as HTMLElement).closest('.code-wrap')?.classList.add('editing'), { signal });
    root.addEventListener('focusout', (e) => isSource(e.target) && (e.target as HTMLElement).closest('.code-wrap')?.classList.remove('editing'), { signal });
    // Ctrl+Shift+V pastes just the text (Word's Keep Text Only).
    root.addEventListener(
      'keydown',
      (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyV') {
          this.plainPaste = true;
          setTimeout(() => (this.plainPaste = false), 500);
        }
      },
      { signal, capture: true },
    );
    root.addEventListener('cut', (e) => inWidget(e.target) || this.onCut(e), { signal });
    root.addEventListener('copy', (e) => inWidget(e.target) || this.onCopy(e), { signal });
    root.addEventListener('focusout', (e) => inWidget(e.target) && this.commitTables(), { signal });
    root.addEventListener('drop', (e) => this.onDrop(e), { signal });
    root.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('Files') && this.onFiles) e.preventDefault();
    }, { signal });
    root.addEventListener('mousedown', (e) => this.onMouseDown(e), { signal });
    root.ownerDocument.addEventListener('selectionchange', () => (this.trackCell(), this.onSelectionChange()), { signal });
  }

  private listening = new AbortController();

  /** Stops listening to the page and clears the element, so it can be reused or removed. */
  destroy(): void {
    this.listening.abort();
    this.listeners = [];
    this.view.root.contentEditable = 'false';
    this.view.root.replaceChildren();
  }

  /** Calls `fn` after every change (and selection move). Returns a function that stops it. */
  onChange(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  // ---------- applying changes ----------

  dispatch(t: Transaction | null, source: ChangeEvent['source'] = 'input', record = true, keepDomSelection = false): void {
    if (!t) return;
    const doc = applyOps(this.state.doc, t.ops);
    this.state = {
      doc,
      selection: t.selectionAfter,
      storedMarks: t.storedMarks !== undefined ? t.storedMarks : t.ops.length ? null : this.state.storedMarks,
      storedLook: t.storedLook !== undefined ? t.storedLook : t.ops.length ? null : this.state.storedLook,
    };
    if (record) this.history.record(t, doc);
    this.draw(doc);
    if (!keepDomSelection) this.view.writeSelection(this.state.selection);
    this.emit({ ops: t.ops, source });
  }

  // ---------- tables ----------

  private tableTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Puts a table of contents at the caret. */
  insertToc(): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    this.dispatch(insertToc(this.state), 'command');
  }

  /** Puts the caret at the start of a block and brings it into view. */
  goToBlock(id: string): void {
    this.focusPos({ block: id, offset: 0 });
    this.view.blockElement(id)?.scrollIntoView({ block: 'center' });
  }

  /** Puts a table at the caret. */
  insertTable(rows = 2, cols = 3): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    this.dispatch(insertTable(this.state, rows, cols), 'command');
    // Start typing in the first heading cell.
    const table = this.state.doc.blocks.find((b, i, all) => b.type === 'table' && all[i + 1]?.id === this.state.selection.focus.block);
    if (table) this.focusCell(table.id, 0, 0);
  }

  private onTableInput(target: HTMLElement): void {
    const id = target.closest<HTMLElement>('[data-block]')?.dataset.block;
    if (!id) return;
    clearTimeout(this.tableTimers.get(id));
    this.tableTimers.set(id, setTimeout(() => this.commitTable(id), 300));
  }

  /** Saves what's been typed in a table's cells into the document. */
  private commitTable(id: string): void {
    clearTimeout(this.tableTimers.get(id));
    this.tableTimers.delete(id);
    const el = this.view.blockElement(id);
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    if (!el || !blk) return;
    // Maths or a diagram: its source.
    if (blk.type === 'code') {
      const src = el.querySelector<HTMLTextAreaElement>('.code-src');
      if (src) this.dispatch(setCode(this.state, id, { text: src.value }), 'input', true, true);
      return;
    }
    // A text box: its text.
    if (blk.type === 'shape') {
      const box = el.querySelector<HTMLElement>('.shape-text');
      if (box) this.dispatch(setShape(this.state, id, { text: readCell(box) }), 'input', true, true);
      return;
    }
    this.dispatch(setTableRows(this.state, id, readTable(el, blk)), 'input', true, true);
  }

  private commitTables(): void {
    for (const id of [...this.tableTimers.keys()]) this.commitTable(id);
  }

  private focusCell(id: string, r: number, c: number): void {
    const cell = this.view.blockElement(id)?.querySelector<HTMLElement>(`.cell[data-r="${r}"][data-c="${c}"]`);
    if (!cell) return;
    cell.focus();
    const sel = cell.ownerDocument.getSelection();
    sel?.selectAllChildren(cell);
    sel?.collapseToEnd();
  }

  /** Changes a table's shape or look (Word's Table Layout and Design) from the cell at r, c. */
  private reshapeTable(id: string, action: string, r: number, c: number, value?: string): void {
    this.commitTable(id);
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    if (!blk || blk.type !== 'table') return;
    const now: TableShape = { rows: tidyRows(blk.rows), tbl: blk.tbl };
    const width = now.rows[0].length;
    // A merged cell counts as its whole span: rows go below it, columns to its right.
    const [mr, mc, rs, cs] = mergeAt(now.tbl, r, c) ?? [r, c, 1, 1];
    let next: TableShape | null = null;
    let at = { r: mr, c: mc };
    if (action === 'row') (next = addRow(now, mr + rs)), (at = { r: mr + rs, c: mc });
    else if (action === 'row-above') (next = addRow(now, mr)), (at = { r: mr, c: mc });
    else if (action === 'col') (next = addCol(now, mc + cs)), (at = { r: mr, c: mc + cs });
    else if (action === 'col-left') (next = addCol(now, mc)), (at = { r: mr, c: mc });
    else if (action === 'del-row' && now.rows.length > 1) {
      next = deleteRow(now, r);
      at = { r: Math.max(0, Math.min(r, next.rows.length - 1)), c };
    } else if (action === 'del-col' && width > 1) {
      next = deleteCol(now, c);
      at = { r, c: Math.max(0, Math.min(c, width - 2)) };
    } else if (action === 'merge-right' || action === 'merge-down') next = mergeCells(now, r, c, action === 'merge-right' ? 'right' : 'down');
    else if (action === 'split') next = splitCell(now, r, c);
    else if (action === 'shade') next = shadeCell(now, r, c, value || null);
    else if (action === 'align') next = alignCol(now, c, (value || null) as CellAlign | null);
    else if (action === 'header') next = setTableLook(now, { noHeader: !now.tbl?.noHeader });
    else if (action === 'banded') next = setTableLook(now, { banded: !now.tbl?.banded });
    else if (action === 'borders') next = setTableLook(now, { borders: (value || undefined) as TableBorders | undefined });
    // A style from the gallery comes with banded rows, as in Word.
    else if (action === 'style') next = setTableLook(now, isTableStyle(value) ? { style: value, banded: true } : { style: undefined });
    else if (action === 'delete' || (action === 'del-col' && width === 1)) {
      // The table goes; an empty line takes its place.
      this.dispatch({ ops: [{ type: 'setAttrs', block: id, from: attrsOf(blk), to: blockAttrs('paragraph') }], selectionBefore: this.state.selection, selectionAfter: caret({ block: id, offset: 0 }) }, 'command');
      this.focusText();
      return;
    }
    if (!next) return;
    this.dispatch(setTableRows(this.state, id, next.rows, next.tbl), 'command', true, true);
    const m = mergeAt(next.tbl, at.r, at.c);
    this.focusCell(id, m ? m[0] : at.r, m ? m[1] : at.c);
  }

  /** Each column's width in the table now, in px (from the cells' edges; a column inside merged cells shares its span). */
  private columnWidths(table: HTMLTableElement, cols: number): number[] {
    const left = table.getBoundingClientRect().left;
    const edges: (number | undefined)[] = Array(cols).fill(undefined);
    for (const box of table.querySelectorAll<HTMLElement>('.cell')) {
      const cell = box.parentElement as HTMLTableCellElement;
      const c = Number(box.dataset.c) + cell.colSpan - 1;
      if (edges[c] === undefined) edges[c] = cell.getBoundingClientRect().right - left;
    }
    edges[cols - 1] = table.getBoundingClientRect().width;
    // Edges no cell ends at are shared out evenly between the ones around them.
    const out: number[] = [];
    let prev = 0;
    for (let c = 0; c < cols; c++) {
      if (edges[c] === undefined) continue;
      let k = out.length;
      const n = c - k + 1;
      for (; k <= c; k++) out.push((edges[c]! - prev) / n);
      prev = edges[c]!;
    }
    return out;
  }

  /** Drags the edge between column `grip.dataset.col` and the next, as in Word. */
  private dragColumn(grip: HTMLElement, startX: number): void {
    const id = grip.closest<HTMLElement>('[data-block]')?.dataset.block;
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    const table = grip.closest('table');
    if (!id || !blk || !table || this.isReadOnly) return;
    this.commitTable(id);
    const cols = tidyRows(blk.rows)[0].length;
    const k = Number(grip.dataset.col);
    const start = this.columnWidths(table, cols);
    const total = start.reduce((a, b) => a + b, 0) || 1;
    const min = Math.max(24, total * 0.04);
    let widths = start;
    // Live while dragging: fixed layout with the widths so far.
    const show = () => {
      table.style.tableLayout = 'fixed';
      let group = table.querySelector('colgroup');
      if (!group) {
        group = document.createElement('colgroup');
        for (let i = 0; i < cols; i++) group.appendChild(document.createElement('col'));
        table.prepend(group);
      }
      Array.from(group.children).forEach((col, i) => ((col as HTMLElement).style.width = `${(widths[i] / total) * 100}%`));
    };
    grip.classList.add('dragging');
    const move = (ev: PointerEvent) => {
      const scale = table.getBoundingClientRect().width / (table.offsetWidth || 1) || 1;
      const dx = (ev.clientX - startX) / scale;
      const d = Math.max(min - start[k], Math.min(start[k + 1] - min, dx));
      widths = start.map((w, i) => (i === k ? w + d : i === k + 1 ? w - d : w));
      show();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      grip.classList.remove('dragging');
      if (widths === start) return;
      const fresh = this.state.doc.blocks.find((b) => b.id === id);
      if (!fresh) return;
      const next = setWidths({ rows: tidyRows(fresh.rows), tbl: fresh.tbl }, widths.map((w) => (w / total) * 100));
      this.dispatch(setTableRows(this.state, id, next.rows, next.tbl), 'command', true, true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Double-clicking a column's edge evens out all the columns again. */
  private evenColumns(grip: HTMLElement): void {
    const id = grip.closest<HTMLElement>('[data-block]')?.dataset.block;
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    if (!id || !blk || this.isReadOnly || !blk.tbl?.widths) return;
    const next = setWidths({ rows: tidyRows(blk.rows), tbl: blk.tbl }, undefined);
    this.dispatch(setTableRows(this.state, id, next.rows, next.tbl), 'command', true, true);
  }

  /** In a text box: bold and the rest, undo; Escape (or Tab) leaves it for the line after. */
  private onShapeKey(e: KeyboardEvent, cell: HTMLElement, id: string): void {
    const mod = isMac ? e.metaKey : e.ctrlKey;
    const keyMark: Record<string, Mark> = { b: 'bold', i: 'italic', u: 'underline' };
    if (mod && !e.altKey && !e.shiftKey && keyMark[e.key.toLowerCase()]) {
      e.preventDefault();
      toggleCellMark(cell, keyMark[e.key.toLowerCase()]);
      return;
    }
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.commitTables();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    // One paragraph of text in a box.
    if (e.key === 'Enter') e.preventDefault();
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      this.commitTable(id);
      const i = this.state.doc.blocks.findIndex((b) => b.id === id);
      const to = this.state.doc.blocks[i + 1];
      if (to) {
        this.state = { ...this.state, selection: caret({ block: to.id, offset: 0 }) };
        this.focusText();
        this.emit(null);
      }
    }
  }

  /** Puts a text box or shape at the caret. */
  insertShape(kind: ShapeKind, textBox = false): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    this.dispatch(insertShape(this.state, kind, textBox), 'command');
    const shape = this.state.doc.blocks.find((b, i, all) => b.type === 'shape' && all[i + 1]?.id === this.state.selection.focus.block);
    const text = shape && this.view.blockElement(shape.id)?.querySelector<HTMLElement>('.shape-text');
    if (textBox && text) text.focus();
  }

  /** Inserts maths or a diagram, with its source box ready to type in. */
  insertCode(lang: CodeLook['lang'], text = ''): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    this.dispatch(insertCode(this.state, lang, text), 'command');
    const blk = this.state.doc.blocks.find((b, i, all) => b.type === 'code' && all[i + 1]?.id === this.state.selection.focus.block);
    const src = blk && this.view.blockElement(blk.id)?.querySelector<HTMLTextAreaElement>('.code-src');
    if (src) {
      src.closest('.code-wrap')?.classList.add('editing');
      src.focus();
    }
  }

  /** Keys in a maths or diagram source box: undo and redo as everywhere; Esc goes back to the text. */
  private onSourceKey(e: KeyboardEvent, src: HTMLTextAreaElement): void {
    const id = src.closest<HTMLElement>('[data-block]')?.dataset.block;
    if (!id || e.isComposing) return;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.commitTables();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.commitTable(id);
      const i = this.state.doc.blocks.findIndex((b) => b.id === id);
      const next = this.state.doc.blocks[i + 1];
      if (next) this.focusPos({ block: next.id, offset: 0 });
      else this.view.root.focus();
    }
  }

  /** Changes a shape's look (fill, line, wrapping, size). */
  setShapeLook(id: string, patch: Partial<ShapeLook>): void {
    this.commitTable(id);
    this.dispatch(setShape(this.state, id, patch), 'command');
  }

  /** Drags a shape's corner to resize it. */
  private resizeShape(grip: HTMLElement, startX: number, startY: number): void {
    const el = grip.closest<HTMLElement>('[data-block]');
    const id = el?.dataset.block;
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    const box = grip.closest<HTMLElement>('.shape-box');
    if (!id || !blk?.shape || !box || this.isReadOnly) return;
    const scale = box.getBoundingClientRect().width / (box.offsetWidth || 1) || 1;
    const { w, h } = blk.shape;
    let size = { w, h };
    const move = (ev: PointerEvent) => {
      size = { w: Math.max(0.2, w + (ev.clientX - startX) / scale / 96), h: Math.max(0.1, h + (ev.clientY - startY) / scale / 96) };
      box.style.width = `${size.w}in`;
      box.style.height = `${size.h}in`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (size.w !== w || size.h !== h) this.setShapeLook(id, { w: Math.round(size.w * 100) / 100, h: Math.round(size.h * 100) / 100 });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Tab and Enter move between cells (adding a row at the end); Esc leaves the table. */
  private onTableKey(e: KeyboardEvent): void {
    if (isSource(e.target)) return this.onSourceKey(e, e.target as HTMLTextAreaElement);
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.cell');
    const id = cell?.closest<HTMLElement>('[data-block]')?.dataset.block;
    if (!cell || !id || e.isComposing) return;
    if (cell.classList.contains('shape-text')) return this.onShapeKey(e, cell, id);
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const el = this.view.blockElement(id)!;
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    const rows = blk?.rows?.length ?? 1;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    // Bold, italic and underline work in a cell as anywhere else.
    const keyMark: Record<string, Mark> = { b: 'bold', i: 'italic', u: 'underline' };
    if (mod && !e.altKey && !e.shiftKey && keyMark[e.key.toLowerCase()]) {
      e.preventDefault();
      toggleCellMark(cell, keyMark[e.key.toLowerCase()]);
      this.emit(null);
      return;
    }
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.commitTables();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      // Cell to cell in reading order (a merged cell is one stop); past the last, a new row.
      const cells = Array.from(el.querySelectorAll<HTMLElement>('table .cell'));
      const i = cells.indexOf(cell) + (e.shiftKey ? -1 : 1);
      if (i < 0) return;
      if (i >= cells.length) return this.reshapeTable(id, 'row', r, 0);
      this.commitTable(id);
      this.focusCell(id, Number(cells[i].dataset.r), Number(cells[i].dataset.c));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const below = r + (mergeAt(blk?.tbl, r, c)?.[2] ?? 1);
      if (below >= rows) return this.reshapeTable(id, 'row', r, c);
      this.commitTable(id);
      const m = mergeAt(blk?.tbl, below, c);
      this.focusCell(id, m ? m[0] : below, m ? m[1] : c);
    } else if (e.key === 'Escape' || (e.key === 'ArrowDown' && r + (mergeAt(blk?.tbl, r, c)?.[2] ?? 1) >= rows) || (e.key === 'ArrowUp' && r === 0)) {
      e.preventDefault();
      this.commitTable(id);
      // Out of the table: to the line after it (or before it, going up).
      const i = this.state.doc.blocks.findIndex((b) => b.id === id);
      const to = this.state.doc.blocks[e.key === 'ArrowUp' ? i - 1 : i + 1];
      if (to) {
        this.state = { ...this.state, selection: caret({ block: to.id, offset: e.key === 'ArrowUp' ? runsLength(to.runs) : 0 }) };
        this.focusText();
        this.view.writeSelection(this.state.selection);
        this.emit(null);
      }
    }
  }

  private applyHistory(step: { ops: Op[]; selection: Selection } | null, source: 'undo' | 'redo'): void {
    if (!step) return;
    this.history.breakMerge();
    this.dispatch({ ops: step.ops, selectionBefore: this.state.selection, selectionAfter: step.selection }, source, false);
  }

  get isComposing(): boolean {
    return this.composing !== null;
  }

  /**
   * Shows a document that changed because of another device. `steps` turn the
   * current document into `doc`; they move the caret so it stays next to the
   * same text, and keep the undo history valid.
   */
  applyRemote(doc: Doc, steps: Step[]): void {
    this.history.external(steps);
    this.state = { doc, selection: mapSelectionThrough(this.state.selection, steps, doc), storedMarks: this.state.storedMarks };
    this.draw(doc);
    // Only touch the page selection if this editor has focus; otherwise we would steal it from wherever the person is.
    if (this.view.root.ownerDocument.activeElement === this.view.root) this.view.writeSelection(this.state.selection);
    this.emit({ ops: [], source: 'remote' });
  }

  /** Replaces the whole document (e.g. "reset sample"), clearing history. */
  load(doc: Doc): void {
    this.state = { doc, selection: caret({ block: doc.blocks[0].id, offset: 0 }), storedMarks: null };
    this.history.clear();
    this.draw(doc, new Set(doc.blocks.map((b) => b.id)));
    // Don't pull the page selection into the note unless it already has focus (e.g. a title field may).
    if (this.view.root.ownerDocument.activeElement === this.view.root) this.view.writeSelection(this.state.selection);
    this.emit({ ops: [], source: 'command' });
  }

  /** Stops (or allows) editing, e.g. for notes in the Trash. */
  private get isReadOnly(): boolean {
    return this.view.root.contentEditable === 'false';
  }

  setReadOnly(readOnly: boolean): void {
    this.view.root.contentEditable = readOnly ? 'false' : 'true';
    this.view.root.setAttribute('aria-readonly', String(readOnly));
  }

  /** Puts the caret at the start or end of the note and focuses it. */
  focusAt(where: 'start' | 'end'): void {
    const blocks = this.state.doc.blocks;
    const b = where === 'start' ? blocks[0] : blocks[blocks.length - 1];
    this.state = { ...this.state, selection: caret({ block: b.id, offset: where === 'start' ? 0 : runsText(b.runs).length }) };
    this.view.root.focus();
    this.view.writeSelection(this.state.selection);
    this.emit(null);
  }

  undo(): void {
    this.applyHistory(this.history.undo(this.state.doc), 'undo');
  }

  redo(): void {
    this.applyHistory(this.history.redo(this.state.doc), 'redo');
  }

  /** The table cell being typed in, if any: formatting then goes to it. */
  activeCell(): HTMLElement | null {
    const el = this.view.root.ownerDocument.activeElement as HTMLElement | null;
    if (el?.classList.contains('cell') && this.view.root.contains(el)) return el;
    // The font or size box has the focus for a moment: the cell typed in last.
    const last = this.lastCell;
    return last && last.isConnected && !this.view.root.contains(el) ? last : null;
  }

  /** The cell last typed in, until the caret goes back into the text. */
  private lastCell: HTMLElement | null = null;

  private trackCell(): void {
    const el = this.view.root.ownerDocument.activeElement as HTMLElement | null;
    if (el?.classList.contains('cell') && this.view.root.contains(el)) {
      this.lastCell = el;
      rememberCellSelection(el);
    } else if (el && this.view.root.contains(el)) this.lastCell = null;
  }

  toggleMark(mark: Mark): void {
    const cell = this.activeCell();
    if (cell) return void toggleCellMark(cell, mark);
    this.syncSelectionFromDom();
    this.dispatch(toggleMark(this.state, mark), 'command');
  }

  /** Applies a named style: a block type, plus for paragraphs and quotes a style on top. */
  setBlockStyle(type: BlockType, style?: string): void {
    this.dispatch(setBlockStyle(this.state, type, style), 'command');
    this.view.root.focus();
  }

  setAlign(align: Align): void {
    this.dispatch(setAlign(this.state, align), 'command');
    this.view.root.focus();
  }

  setBlockType(type: BlockType): void {
    this.syncSelectionFromDom();
    this.dispatch(setBlockType(this.state, type), 'command');
  }

  /** Sets a font, size, colour, highlight or raised/lowered on the selection (or for what's typed next). */
  setLook(key: LookKey, value: string | number | null): void {
    const cell = this.activeCell();
    if (cell) return void setCellLook(cell, key, value);
    this.syncSelectionFromDom();
    this.dispatch(setLook(this.state, key, value), 'command');
  }

  /** One part of the look at the caret or across the selection; undefined when mixed or unset. */
  lookValue<K extends LookKey>(key: K): Look[K] | undefined {
    const cell = this.activeCell();
    if (cell) return cellLookValue(cell, key);
    return lookValue(this.state, key);
  }

  /** Paragraph settings (Word's Paragraph group) on the selected paragraphs; null clears them. */
  setPara(patch: Partial<ParaLook> | null): void {
    this.syncSelectionFromDom();
    this.dispatch(setPara(this.state, patch), 'command');
  }

  paraValue<K extends ParaKey>(key: K): ParaLook[K] | undefined {
    return paraValue(this.state, key);
  }

  /** Increase (1) or decrease (-1) indent. */
  /** Word's Column Break (Ctrl+Shift+Enter). */
  insertColumnBreak(): void {
    this.syncSelectionFromDom();
    this.dispatch(insertColumnBreak(this.state), 'command');
  }

  /** Word's Section Breaks: Next Page, or Continuous. */
  insertSectionBreak(kind: 'page' | 'cont'): void {
    this.syncSelectionFromDom();
    this.dispatch(insertSectionBreak(this.state, kind), 'command');
  }

  /** Columns and orientation for the section the caret is in. */
  setSection(patch: SectionPatch): void {
    this.syncSelectionFromDom();
    this.dispatch(setSection(this.state, patch), 'command');
  }

  /** Page Setup's "Whole document": no section has its own margins or orientation, and they all have `cols` columns. */
  setAllSections(cols: number): void {
    this.dispatch(setAllSections(this.state, cols), 'command');
  }

  /** How the section the caret is in is set up (no orientation or margins: the page setup's). */
  sectionLook(): SectionLook {
    return sectionLook(this.state.doc.blocks, this.state.doc.blocks.findIndex((b) => b.id === this.state.selection.focus.block));
  }

  /** Word's bullet and numbering libraries (see setListStyle). */
  setListStyle(style: { num: NumFormat } | { bullet: BulletKind }): void {
    this.syncSelectionFromDom();
    this.dispatch(setListStyle(this.state, style), 'command');
  }

  setListStart(start: number | undefined): void {
    this.syncSelectionFromDom();
    this.dispatch(setListStart(this.state, start), 'command');
  }

  stepIndent(delta: 1 | -1): void {
    this.syncSelectionFromDom();
    this.dispatch(stepIndent(this.state, delta), 'command');
  }

  insertPageBreak(): void {
    this.syncSelectionFromDom();
    this.dispatch(insertPageBreak(this.state), 'command');
    this.view.writeSelection(this.state.selection);
  }

  clearFormatting(): void {
    const cell = this.activeCell();
    if (cell) return void clearCellFormat(cell);
    this.syncSelectionFromDom();
    this.dispatch(clearFormatting(this.state), 'command');
  }

  changeCase(how: CaseChange): void {
    this.syncSelectionFromDom();
    this.dispatch(changeCase(this.state, how), 'command');
  }

  isMarkActive(mark: Mark): boolean {
    const cell = this.activeCell();
    if (cell) return cellMarkActive(cell, mark);
    return markActive(this.state, mark);
  }

  currentBlock(): Block {
    return getBlock(this.state.doc, this.state.selection.focus.block);
  }

  /** Selects `sel` (without moving the focus). */
  select(sel: Selection): void {
    this.state = { ...this.state, selection: sel };
    this.emit(null);
  }

  /** Puts the caret at `pos` and the focus in the text. */
  focusPos(pos: Pos): void {
    this.state = { ...this.state, selection: caret(pos) };
    this.focusText();
    this.emit(null);
  }

  focus(): void {
    // Back to the cell being formatted, if that's where the caret was.
    const cell = this.activeCell();
    if (cell) return refocusCell(cell);
    this.focusText();
  }

  /** The focus in the text itself (out of any table cell). */
  private focusText(): void {
    this.lastCell = null;
    this.view.root.focus();
    this.view.writeSelection(this.state.selection);
  }

  private emit(change: ChangeEvent | null): void {
    for (const fn of this.listeners) fn(this.state, change);
  }

  // ---------- selection ----------

  private syncSelectionFromDom(): void {
    const sel = this.view.readSelection();
    if (!sel) return;
    const cur = this.state.selection;
    const same =
      sel.anchor.block === cur.anchor.block && sel.anchor.offset === cur.anchor.offset && sel.focus.block === cur.focus.block && sel.focus.offset === cur.focus.offset;
    if (same) return;
    this.state = { ...this.state, selection: sel, storedMarks: null };
    this.history.breakMerge();
  }

  private onSelectionChange(): void {
    if (this.composing) return;
    // Typing in a table's cell isn't a place in the text.
    const sel = this.view.root.ownerDocument.getSelection();
    if (sel?.anchorNode && inWidget(sel.anchorNode)) return;
    const before = this.state.selection;
    this.syncSelectionFromDom();
    if (this.state.selection !== before) this.emit(null);
  }

  // ---------- input ----------

  private onBeforeInput(e: InputEvent): void {
    this.inputLog.push(e.inputType);
    if (this.inputLog.length > 50) this.inputLog.shift();

    // During IME composition the browser owns the DOM; we read the result back at compositionend.
    if (this.composing || e.inputType === 'insertCompositionText' || e.inputType === 'deleteCompositionText' || e.inputType === 'insertFromComposition') {
      this.nativeEdit = true;
      return;
    }

    this.syncSelectionFromDom();
    if (/^insert(Text|ReplacementText|FromPaste|FromDrop)/.test(e.inputType)) this.reviseLook();
    const s = this.state;
    if (this.tracking && this.trackedInput(e)) return;

    switch (e.inputType) {
      case 'insertText': {
        e.preventDefault();
        if (e.data == null) return;
        this.dispatch(insertText(s, e.data));
        if (e.data === ' ') {
          this.dispatch(markdownShortcut(this.state));
          this.dispatch(autoLink(this.state), 'command');
        }
        return;
      }
      case 'insertReplacementText': {
        // Spellcheck/autocorrect replacing a word: the target range says which.
        e.preventDefault();
        const text = e.dataTransfer?.getData('text/plain') ?? e.data ?? '';
        const range = this.targetRange(e);
        const state = range ? { ...s, selection: range } : s;
        this.dispatch(insertText(state, text));
        return;
      }
      case 'insertParagraph':
      case 'insertLineBreak': {
        e.preventDefault();
        this.dispatch(splitBlock(s));
        return;
      }
      case 'deleteContentBackward':
      case 'deleteContentForward': {
        e.preventDefault();
        this.dispatch(deleteChar(s, e.inputType === 'deleteContentBackward' ? -1 : 1));
        return;
      }
      case 'deleteWordBackward':
      case 'deleteWordForward':
      case 'deleteSoftLineBackward':
      case 'deleteSoftLineForward':
      case 'deleteHardLineBackward':
      case 'deleteHardLineForward':
      case 'deleteEntireSoftLine': {
        e.preventDefault();
        if (!isCollapsed(s.selection)) return this.dispatch(deleteSelection(s));
        const backward = e.inputType.includes('Backward');
        const pos = s.selection.focus;
        const len = runsText(getBlock(s.doc, pos.block).runs).length;
        if (backward && pos.offset === 0) return this.dispatch(joinBackward(s));
        if (!backward && pos.offset === len) return this.dispatch(joinForward(s));
        const range = this.targetRange(e);
        if (range) return this.dispatch(deleteBetween(s, range.anchor, range.focus));
        return this.dispatch(deleteChar(s, backward ? -1 : 1));
      }
      case 'deleteByCut':
      case 'deleteByDrag':
      case 'deleteContent': {
        e.preventDefault();
        this.dispatch(deleteSelection(s));
        return;
      }
      case 'formatBold':
        e.preventDefault();
        return this.dispatch(toggleMark(s, 'bold'), 'command');
      case 'formatItalic':
        e.preventDefault();
        return this.dispatch(toggleMark(s, 'italic'), 'command');
      case 'formatUnderline':
        e.preventDefault();
        return this.dispatch(toggleMark(s, 'underline'), 'command');
      case 'formatStrikeThrough':
        e.preventDefault();
        return this.dispatch(toggleMark(s, 'strike'), 'command');
      case 'historyUndo':
        e.preventDefault();
        return this.undo();
      case 'historyRedo':
        e.preventDefault();
        return this.redo();
      case 'insertFromPaste':
      case 'insertFromPasteAsQuotation':
      case 'insertFromDrop': {
        e.preventDefault();
        const text = e.dataTransfer?.getData('text/plain');
        if (text) this.dispatch(insertText(s, text));
        return;
      }
      default:
        // Anything we don't model yet (e.g. insertOrderedList from a context menu) is ignored
        // rather than allowed to change the DOM behind the model's back.
        e.preventDefault();
    }
  }

  /** Turns pasted HTML into paragraphs (set by the app); null or nothing returned pastes plain text. */
  htmlToBlocks: ((html: string) => Block[] | null) | null = null;

  /** Track changes: who is editing, or null when changes aren't tracked. */
  tracking: { author: string } | null = null;

  /** Revision mode, like Scrivener's: text typed now is in this colour (#rrggbb), or null. */
  revisionColor: string | null = null;

  /** With revision mode on, what's typed next takes the round's colour (on top of the look where it's typed). */
  private reviseLook(): void {
    if (!this.revisionColor) return;
    const at = this.state.selection.focus;
    const block = this.state.doc.blocks.find((b) => b.id === at.block);
    const look = this.state.storedLook ?? (block ? lookAt(block.runs, at.offset) : undefined);
    this.state = { ...this.state, storedLook: { ...(look ?? {}), color: this.revisionColor } };
  }

  // ---------- find and replace ----------

  /** Every place `query` appears in this document. */
  find(query: string, opts: FindOptions = {}): Match[] {
    return findMatches(this.state.doc, query, opts);
  }

  /** Replaces matches with `text` (tracked, if track changes is on), as one step to undo. */
  replace(matches: Match[], text: string): void {
    this.dispatch(replaceMatches(this.state, matches, text, this.tracking?.author ?? null), 'command');
  }

  /** A DOM range over a match, to highlight it or scroll it into view. */
  rangeOf(m: Match): Range | null {
    const a = this.view.posToDom({ block: m.block, offset: m.from });
    const b = this.view.posToDom({ block: m.block, offset: m.to });
    if (!a || !b) return null;
    const r = this.view.root.ownerDocument.createRange();
    try {
      r.setStart(a.node, a.offset);
      r.setEnd(b.node, b.offset);
    } catch {
      return null;
    }
    return r;
  }

  setTracking(author: string | null): void {
    this.tracking = author === null ? null : { author };
  }

  /** Typing and deleting with track changes on. True if handled. */
  private trackedInput(e: InputEvent): boolean {
    const s = this.state;
    const author = this.tracking!.author;
    switch (e.inputType) {
      case 'insertText':
      case 'insertReplacementText':
      case 'insertFromPaste':
      case 'insertFromPasteAsQuotation':
      case 'insertFromDrop': {
        e.preventDefault();
        const text = e.inputType === 'insertText' ? e.data : (e.dataTransfer?.getData('text/plain') ?? e.data);
        if (!text) return true;
        const range = e.inputType === 'insertReplacementText' ? this.targetRange(e) : null;
        this.dispatch(trackedInsertText(range ? { ...s, selection: range } : s, text.replaceAll(FOOTNOTE, ''), author));
        return true;
      }
      case 'insertParagraph':
      case 'insertLineBreak':
        // A selection is marked deleted first; the new paragraph's break is marked as added.
        e.preventDefault();
        if (!isCollapsed(s.selection)) this.dispatch(trackedDelete(s, 1, author));
        this.dispatch(trackedSplit(this.state, author));
        return true;
      case 'deleteContentBackward':
      case 'deleteContentForward':
      case 'deleteWordBackward':
      case 'deleteWordForward':
      case 'deleteSoftLineBackward':
      case 'deleteSoftLineForward':
      case 'deleteHardLineBackward':
      case 'deleteHardLineForward':
      case 'deleteByCut':
      case 'deleteByDrag':
      case 'deleteContent': {
        const backward = !e.inputType.includes('Forward');
        const range = isCollapsed(s.selection) && !e.inputType.startsWith('deleteContent') ? this.targetRange(e) : null;
        // At the edge of a paragraph: the break between the two paragraphs is marked deleted.
        const t = trackedDelete(s, backward ? -1 : 1, author, range ?? undefined) ?? (isCollapsed(s.selection) ? trackedJoin(s, backward ? -1 : 1, author) : null);
        if (!t) return false;
        e.preventDefault();
        this.dispatch(t);
        return true;
      }
      default:
        return false;
    }
  }

  /** Accepts or rejects tracked changes: in one stretch of a paragraph, or everywhere. */
  resolveChanges(accept: boolean, where?: { block: string; from: number; to: number }): void {
    this.dispatch(resolveChanges(this.state, accept, where), 'command');
  }

  /** Clicks on a tracked change. */
  onChangeClick: ((change: { block: string; from: number; to: number; change: Change }, el: HTMLElement) => void) | null = null;

  /** After an edit we let through (outside composition), read changed blocks back from the DOM. */
  private onInput(): void {
    if (this.composing || !this.nativeEdit) return;
    this.nativeEdit = false;
    this.readBackFromDom();
  }

  private readBackFromDom(force: Set<string> = new Set()): void {
    if (!this.view.structureIntact(this.state.doc)) {
      // The browser changed the block structure itself; we can't trust it, so redraw from the model.
      console.warn('[crumpet] DOM structure changed outside the model; redrawing');
      this.draw(this.state.doc, new Set(this.state.doc.blocks.map((b) => b.id)));
      this.view.writeSelection(this.state.selection);
      return;
    }
    const domSel = this.view.readSelection();
    for (const block of this.state.doc.blocks) {
      const domText = this.view.blockText(block.id);
      if (domText == null) continue;
      if (domText === runsText(block.runs) && !force.has(block.id)) continue;
      let t = syncBlockText(this.state, block.id, domText, domSel ?? this.state.selection);
      if (t && this.tracking) {
        const change = makeChange('ins', this.tracking.author);
        t = { ...t, ops: t.ops.map((op) => (op.type === 'insert' ? { ...op, runs: op.runs.map((r) => ({ ...r, change })) } : op)) };
      }
      // Text a phone keyboard typed straight into the page: in the revision colour too.
      if (t && this.revisionColor) {
        const color = this.revisionColor;
        t = { ...t, ops: t.ops.map((op) => (op.type === 'insert' ? { ...op, runs: op.runs.map((r) => ({ ...r, look: { ...(r.look ?? {}), color } })) } : op)) };
      }
      if (t) {
        this.state = { ...this.state, doc: applyOps(this.state.doc, t.ops), selection: t.selectionAfter, storedMarks: null };
        this.history.record(t, this.state.doc);
        this.emit({ ops: t.ops, source: 'native' });
      }
      force.add(block.id);
    }
    // Rebuild the blocks the browser touched so the DOM is exactly what we would have drawn.
    this.draw(this.state.doc, force);
    this.view.writeSelection(this.state.selection);
  }

  private onCompositionStart(): void {
    this.syncSelectionFromDom();
    const s = this.state;
    // A selection across blocks is deleted first, so the composition happens inside one block.
    if (!isCollapsed(s.selection) && s.selection.anchor.block !== s.selection.focus.block) {
      this.dispatch(deleteSelection(s));
    }
    this.composing = { block: this.state.selection.focus.block };
  }

  private onCompositionEnd(): void {
    const comp = this.composing;
    this.composing = null;
    this.nativeEdit = false;
    if (!comp) return;
    // Some browsers fire the final input event after compositionend; read the DOM once things settle.
    queueMicrotask(() => {
      this.readBackFromDom(new Set([comp.block]));
      // Page view waited for the composition to end: lay the pages out again.
      if (this.paged) this.draw(this.state.doc);
    });
  }

  /** Gets keys first (e.g. while a menu at the caret is open); returning true means it handled them. */
  onKeyIntercept: ((e: KeyboardEvent) => boolean) | null = null;

  /** Removes the `n` characters before the caret. */
  deleteBefore(n: number): void {
    this.syncSelectionFromDom();
    const pos = this.state.selection.focus;
    if (n <= 0 || pos.offset < n) return;
    this.dispatch(deleteBetween(this.state, { block: pos.block, offset: pos.offset - n }, pos), 'command');
  }

  /** Puts a link to another note at the caret, showing `label`. */
  insertNoteLink(title: string, label = title): void {
    this.syncSelectionFromDom();
    this.dispatch(insertLinkedText(this.state, label, noteLink(title)), 'command');
  }

  /** Adds a footnote after the selection and returns where it is. */
  insertFootnote(text = ''): Pos {
    this.syncSelectionFromDom();
    this.dispatch(insertFootnote(this.state, text), 'command');
    const f = this.state.selection.focus;
    return { block: f.block, offset: f.offset - 1 };
  }

  /** Adds an empty footnote after the selection and opens it for writing (see onFootnoteClick). */
  addFootnote(): void {
    if (this.isReadOnly) return;
    const at = this.insertFootnote('');
    const el = this.footnoteElement(at);
    if (el) this.onFootnoteClick?.(at, '', el);
  }

  /** Changes what the footnote at `at` says; null takes it out. */
  setFootnote(at: Pos, text: string | null): void {
    this.dispatch(setFootnote(this.state, at, text), 'command');
  }

  /** The footnote's number in the text, to show its editor beside it. */
  footnoteElement(at: Pos): HTMLElement | null {
    const dom = this.view.posToDom({ block: at.block, offset: at.offset + 1 });
    const el = dom?.node.nodeType === 1 ? (dom.node as Element) : dom?.node.parentElement;
    const sup = el?.closest?.<HTMLElement>('sup.fn');
    if (sup) return sup;
    // posToDom can land just past the marker; look for it by order instead.
    const i = footnotes(this.state.doc).findIndex((f) => f.block === at.block && f.offset === at.offset);
    return i < 0 ? null : (this.view.root.querySelectorAll<HTMLElement>('sup.fn')[i] ?? null);
  }

  /** Puts a comment on the selected text. */
  addComment(comment: Comment): boolean {
    this.syncSelectionFromDom();
    const t = addComment(this.state, comment);
    if (!t) return false;
    this.dispatch(t, 'command');
    return true;
  }

  /** Changes a comment everywhere it is; null takes it off the text. */
  setComment(id: string, comment: Comment | null): void {
    this.dispatch(setComment(this.state, id, comment), 'command');
  }

  /** The first highlighted stretch of a comment, to show it beside. */
  commentElement(id: string): HTMLElement | null {
    return this.view.root.querySelector<HTMLElement>(`mark.cmt[data-comment="${CSS.escape(id)}"]`);
  }

  /** Clicks on commented text (the caret still goes there). */
  onCommentClick: ((comment: Comment, el: HTMLElement) => void) | null = null;

  /** Ctrl+Alt+M (⌘⌥M) with text selected: the app asks for a comment. */
  onCommentKey: (() => void) | null = null;

  /** Clicks on a footnote's number. */
  onFootnoteClick: ((at: Pos, text: string, el: HTMLElement) => void) | null = null;

  /** Types `text` at the caret, as if typed. */
  typeText(text: string): void {
    this.syncSelectionFromDom();
    this.reviseLook();
    this.dispatch(insertText(this.state, text), 'command');
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.isComposing || e.keyCode === 229) return;
    if (this.onKeyIntercept?.(e)) {
      e.preventDefault();
      return;
    }
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (e.key === 'Tab') {
      // Tab nests list items (Shift+Tab un-nests); elsewhere it does nothing rather than leaving the note.
      e.preventDefault();
      this.syncSelectionFromDom();
      this.dispatch(indent(this.state, e.shiftKey ? -1 : 1), 'command');
      return;
    }
    if (!mod) return;
    const key = e.key.toLowerCase();
    let handled = true;
    if (key === 'z' && !e.shiftKey) this.undo();
    else if ((key === 'z' && e.shiftKey) || key === 'y') this.redo();
    else if (e.shiftKey && e.code === 'KeyL') this.setAlign('left');
    else if (e.shiftKey && e.code === 'KeyE') this.setAlign('center');
    else if (e.shiftKey && e.code === 'KeyR') this.setAlign('right');
    else if (e.shiftKey && e.code === 'KeyJ') this.setAlign('justify');
    else if (key === 'b') this.toggleMark('bold');
    else if (key === 'i') this.toggleMark('italic');
    else if (key === 'u') this.toggleMark('underline');
    else if (key === 'x' && e.shiftKey) this.toggleMark('strike');
    else if (key === 'e') this.toggleMark('code');
    else if (e.altKey && e.code === 'Digit1') this.setBlockType('heading1');
    else if (e.altKey && e.code === 'Digit2') this.setBlockType('heading2');
    else if (e.altKey && e.code === 'Digit3') this.setBlockType('heading3');
    else if (e.altKey && e.code === 'Digit4') this.setBlockType('heading4');
    else if (e.altKey && e.code === 'Digit0') this.setBlockType('paragraph');
    else if (e.altKey && e.code === 'KeyT') this.setBlockType('todo');
    else if (e.altKey && e.code === 'KeyL') this.setBlockType('bullet');
    else if (e.altKey && e.code === 'KeyN') this.setBlockType('numbered');
    else if (e.altKey && e.code === 'KeyQ') this.setBlockType('quote');
    else if (e.altKey && e.code === 'KeyF') this.addFootnote();
    else if (e.altKey && e.code === 'KeyM' && this.onCommentKey) this.onCommentKey();
    else handled = false;
    if (handled) e.preventDefault();
  }

  /** Clicks on links the app handles itself (links to other notes). Returning true means handled. */
  onLinkClick: ((href: string, e: MouseEvent) => boolean) | null = null;

  private onMouseDown(e: MouseEvent): void {
    const brk = (e.target as Element).closest?.<HTMLElement>('.brk');
    if (brk && this.onChangeClick) {
      const id = brk.closest<HTMLElement>('[data-block]')?.dataset.block;
      const hit = changes(this.state.doc).find((c) => c.block === id && c.from === -1);
      if (hit) {
        e.preventDefault();
        setTimeout(() => this.onChangeClick?.(hit, brk), 0);
        return;
      }
    }
    const trk = (e.target as Element).closest?.<HTMLElement>('ins.trk, del.trk');
    if (trk && this.onChangeClick) {
      const blockEl = trk.closest<HTMLElement>('[data-block]');
      const at = this.view.domToPos(trk.firstChild ?? trk, 0);
      if (blockEl && at) {
        const hit = changes(this.state.doc).find((c) => c.block === at.block && at.offset >= c.from && at.offset < c.to);
        if (hit) setTimeout(() => this.onChangeClick?.(hit, trk), 0);
      }
    }
    const cmt = (e.target as Element).closest?.<HTMLElement>('mark.cmt');
    if (cmt && this.onCommentClick) {
      const id = cmt.dataset.comment;
      const found = comments(this.state.doc).find((c) => c.comment.id === id);
      // After the caret has moved, so the card isn't closed by the click itself.
      if (found) setTimeout(() => this.onCommentClick?.(found.comment, cmt), 0);
    }
    const fn = (e.target as Element).closest?.<HTMLElement>('sup.fn');
    if (fn && this.onFootnoteClick) {
      const i = [...this.view.root.querySelectorAll('sup.fn')].indexOf(fn);
      const at = footnotes(this.state.doc)[i];
      if (at) {
        e.preventDefault();
        this.onFootnoteClick({ block: at.block, offset: at.offset }, at.text, fn);
        return;
      }
    }
    const link = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (link && this.onLinkClick?.(link.getAttribute('href') ?? '', e)) {
      e.preventDefault();
      return;
    }
    if (link && (isMac ? e.metaKey : e.ctrlKey)) {
      // ⌘/Ctrl-click opens a link; a plain click just places the caret, so links stay editable.
      e.preventDefault();
      window.open(link.href, '_blank', 'noopener');
      return;
    }
    // Clicking drawn maths or a diagram opens its source to edit.
    const drawn = (e.target as Element).closest?.<HTMLElement>('[data-code-preview]');
    if (drawn && !this.isReadOnly) {
      e.preventDefault();
      const src = drawn.parentElement?.querySelector<HTMLTextAreaElement>('.code-src');
      src?.closest('.code-wrap')?.classList.add('editing');
      src?.focus();
      return;
    }
    const shapeAction = (e.target as Element).closest?.<HTMLElement>('[data-shape-action]');
    if (shapeAction) {
      e.preventDefault();
      const id = shapeAction.closest<HTMLElement>('[data-block]')!.dataset.block!;
      const action = shapeAction.dataset.shapeAction!;
      const tools = shapeAction.closest<HTMLElement>('.shape-tools');
      if (action === 'resize') return this.resizeShape(shapeAction, e.clientX, e.clientY);
      if (action === 'menu') {
        tools?.classList.toggle('open');
        return;
      }
      tools?.classList.remove('open');
      const value = shapeAction.dataset.value ?? '';
      if (action === 'fill') this.setShapeLook(id, { fill: value || null });
      else if (action === 'line') this.setShapeLook(id, { line: value || null });
      else if (action === 'wrap') this.setShapeLook(id, { wrap: value as ShapeLook['wrap'] });
      else if (action === 'delete') {
        const blk = this.state.doc.blocks.find((b) => b.id === id)!;
        this.dispatch({ ops: [{ type: 'setAttrs', block: id, from: attrsOf(blk), to: blockAttrs('paragraph') }], selectionBefore: this.state.selection, selectionAfter: caret({ block: id, offset: 0 }) }, 'command');
        this.focusText();
      }
      return;
    }
    const grip = (e.target as Element).closest?.<HTMLElement>('.col-grip');
    if (grip) {
      e.preventDefault();
      if (e.detail >= 2) this.evenColumns(grip);
      else this.dragColumn(grip, e.clientX);
      return;
    }
    const entry = (e.target as Element).closest?.<HTMLElement>('[data-toc-target], [data-toc-chapter]');
    if (entry) {
      // A line in the table of contents goes to its heading (or, for another chapter, the app opens it).
      e.preventDefault();
      const id = entry.dataset.tocTarget;
      if (id && this.state.doc.blocks.some((b) => b.id === id)) this.goToBlock(id);
      else if (entry.dataset.tocChapter) this.onTocTarget?.({ chapter: entry.dataset.tocChapter, block: id });
      return;
    }
    const action = (e.target as Element).closest?.<HTMLElement>('[data-table-action]');
    if (action) {
      e.preventDefault();
      const id = action.closest<HTMLElement>('[data-block]')!.dataset.block!;
      const cell = this.view.root.ownerDocument.activeElement as HTMLElement | null;
      const inThis = cell?.classList.contains('cell') && action.closest('[data-block]')!.contains(cell);
      const r = inThis ? Number(cell!.dataset.r) : -1;
      const c = inThis ? Number(cell!.dataset.c) : -1;
      const blk = this.state.doc.blocks.find((b) => b.id === id);
      const rows = blk?.rows?.length ?? 1;
      const cols = blk?.rows?.[0]?.length ?? 1;
      const tools = action.closest<HTMLElement>('.table-tools');
      if (action.dataset.tableAction === 'menu') {
        tools?.classList.toggle('open');
        return;
      }
      tools?.classList.remove('open');
      // Without a cell to work from: add at the end, remove the last.
      this.reshapeTable(id, action.dataset.tableAction!, r >= 0 ? r : rows - 1, c >= 0 ? c : cols - 1, action.dataset.value);
      return;
    }
    const fold = (e.target as Element).closest?.('.fold');
    if (fold) {
      e.preventDefault();
      this.dispatch(toggleFold(this.state, fold.closest<HTMLElement>('[data-block]')!.dataset.block!), 'command');
      return;
    }
    const box = (e.target as Element).closest?.('.check');
    if (!box) return;
    e.preventDefault();
    const id = box.closest<HTMLElement>('[data-block]')!.dataset.block!;
    this.dispatch(toggleTodo(this.state, id), 'command');
  }

  /** Files dropped or pasted in (pictures, PDFs...); the app stores them and calls insertMedia. */
  onFiles: ((files: File[]) => void) | null = null;

  /** Puts a picture or an attached file at the caret. */
  insertMedia(type: 'image' | 'file', src: string, caption = ''): void {
    if (this.isReadOnly) return;
    this.dispatch(insertMedia(this.state, type, src, caption), 'command');
  }

  private onDrop(e: DragEvent): void {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length || !this.onFiles || this.isReadOnly) return;
    // Put the caret where the files were dropped.
    const doc = this.view.root.ownerDocument as Document & { caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null };
    const at = doc.caretPositionFromPoint?.(e.clientX, e.clientY);
    const range = at ? null : doc.caretRangeFromPoint?.(e.clientX, e.clientY);
    const node = at?.offsetNode ?? range?.startContainer;
    const offset = at?.offset ?? range?.startOffset ?? 0;
    const pos = node ? this.view.domToPos(node, offset) : null;
    if (pos) this.state = { ...this.state, selection: caret(pos) };
    this.onFiles(files);
  }

  private plainPaste = false;

  private onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const plain = this.plainPaste;
    this.plainPaste = false;
    this.syncSelectionFromDom();
    const files = Array.from(e.clipboardData?.files ?? []);
    if (files.length && this.onFiles && !this.isReadOnly) {
      this.onFiles(files);
      return;
    }
    // Formatted text (from a web page, Word, Google Docs): kept with its headings, lists and formatting.
    const html = e.clipboardData?.getData('text/html');
    if (html && this.htmlToBlocks && !this.isReadOnly && !plain) {
      let blocks = this.htmlToBlocks(html);
      if (blocks?.length) {
        if (this.tracking) {
          const change = makeChange('ins', this.tracking.author);
          blocks = blocks.map((b, i) => ({ ...b, runs: b.runs.map((r) => ({ ...r, change })), ...(i > 0 ? { brk: change } : {}) }));
          // Pasting over a selection marks it deleted first.
          if (!isCollapsed(this.state.selection)) this.dispatch(trackedDelete(this.state, 1, this.tracking.author));
        }
        this.dispatch(insertBlocks(this.state, blocks));
        return;
      }
    }
    const text = e.clipboardData?.getData('text/plain')?.replaceAll(FOOTNOTE, '');
    if (!text) return;
    this.reviseLook();
    if (this.tracking) return this.dispatch(trackedInsertText(this.state, text, this.tracking.author));
    this.dispatch(pasteLink(this.state, text) ?? insertText(this.state, text));
  }

  /** Links the selection (or the link under the caret) to `href`; empty or null removes it. Returns false if `href` isn't a valid link. */
  setLink(href: string | null): boolean {
    const target = href ? normalizeLink(href) : null;
    if (href && !target) return false;
    this.dispatch(setLink(this.state, target), 'command');
    return true;
  }

  currentLink(): string | null {
    this.syncSelectionFromDom();
    return currentLink(this.state);
  }

  /** The selection as the page currently shows it (the model can lag a moment behind keyboard selection). */
  currentSelection(): Selection {
    this.syncSelectionFromDom();
    return this.state.selection;
  }

  private onCopy(e: ClipboardEvent): void {
    this.syncSelectionFromDom();
    const text = this.selectedText();
    if (text == null) return;
    e.preventDefault();
    e.clipboardData?.setData('text/plain', text.replaceAll(FOOTNOTE, ''));
  }

  private onCut(e: ClipboardEvent): void {
    this.onCopy(e);
    this.dispatch(this.tracking ? trackedDelete(this.state, -1, this.tracking.author) : deleteSelection(this.state));
  }

  selectedText(): string | null {
    const s = this.state;
    if (isCollapsed(s.selection)) return null;
    const { from, to } = orderedRange(s.doc, s.selection);
    const start = s.doc.blocks.findIndex((b) => b.id === from.block);
    const end = s.doc.blocks.findIndex((b) => b.id === to.block);
    const lines = [];
    for (let i = start; i <= end; i++) {
      const b = s.doc.blocks[i];
      const len = runsText(b.runs).length;
      lines.push(runsText(sliceRuns(b.runs, i === start ? from.offset : 0, i === end ? to.offset : len)));
    }
    return lines.join('\n');
  }

  private targetRange(e: InputEvent): Selection | null {
    const ranges = e.getTargetRanges?.() ?? [];
    if (!ranges.length) return null;
    const r = ranges[0];
    const a = this.view.domToPos(r.startContainer, r.startOffset);
    const f = this.view.domToPos(r.endContainer, r.endOffset);
    return a && f ? { anchor: a, focus: f } : null;
  }
}

/** True for events and nodes inside a table (or another box with its own editing). */
function inWidget(t: EventTarget | Node | null): boolean {
  const n = t as Node | null;
  const el = n && (n.nodeType === 1 ? (n as Element) : n.parentElement);
  return !!el?.closest('[data-widget]');
}

/** A maths or diagram source box (an ordinary text area: pasting and new lines work as usual). */
function isSource(t: EventTarget | null): boolean {
  return !!t && (t as Element).nodeName === 'TEXTAREA' && !!(t as Element).closest?.('.code-wrap');
}

/** Paste in a table cell: plain text only, on one line. */
function pastePlain(e: ClipboardEvent): void {
  e.preventDefault();
  const text = (e.clipboardData?.getData('text/plain') ?? '').replace(/\s*[\r\n]+\s*/g, ' ');
  e.target && (e.target as HTMLElement).ownerDocument.execCommand('insertText', false, text);
}
