// The editor: owns the state, listens to the browser, and turns every input
// into a transaction. The browser's own editing is cancelled wherever we can
// (beforeinput); where we cannot (IME composition, some spellcheck and
// autocorrect paths), we let the DOM change and then read it back into the
// model as ordinary ops.

import { type InkGestureKind, type InkPoint, classifyGesture, nearestGap, toWords } from './inkedit';
import {
  type Align,
  makeBlock,
  isHeading,
  blockIndex,
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
  FIELD,
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
  type Run,
  newId,
  type TocLook,
  tidyToc,
} from './model';
import { type Op, applyOps, attrsOf, blockAttrs } from './ops';
import { type CellAlign, type CellLook, type TableBorders, type TableLook, type TableShape, isTableStyle, addCol, addRow, alignCol, deleteCol, deleteRow, distributeCols, distributeRows, mergeAt, mergeCells, setCellLooks, setRowHeight, setTableLook, setWidths, shadeCell, sortTable, splitCell } from './table';
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
  moveBlocks,
  sectionOf,
  shiftLevel,
  insertTable,
  insertTableOf,
  textToTable,
  tableToText,
  insertFootnote,
  convertNotes,
  setFootnote,
  addComment,
  setComment,
  trackedInsertText,
  trackedDelete,
  resolveChanges,
  insertBlocks,
  sliceDoc,
  sortParagraphs,
  setMultilevel,
  type ListLevel,
  type SortBy,
  trackedSplit,
  trackedJoin,
  setTableRows,
  setLook,
  setLooks,
  lookValue,
  clearFormatting,
  changeCase,
  type CaseChange,
  setPara,
  setDocPara,
  cycleScript,
  paraValue,
  stepIndent,
  insertPageBreak,
  insertBlankPage,
  insertField,
  setFieldAt,
  insertAfterBlock,
  mathToBlock,
  setListStyle,
  setListStart,
  insertToc,
  insertShape,
  setShape,
  setPic,
  insertCode,
  setCode,
  insertColumnBreak,
  insertSectionBreak,
  setSection,
  insertCover,
  removeCover,
  setAllSections,
  type SectionPatch,
} from './commands';
import { History } from './history';
import { fieldValue } from './fields';
import { type AutoCorrectOptions, autoCorrect } from './autocorrect';
import { type FindOptions, type Match, findMatches, replaceMatches } from './find';
import { type TocEntry, View, readTable } from './view';
import { type ShapeKind, type ShapeLook, SHAPE_STYLES, cornersOf, isFloating, isLineKind, tidyShape } from './shape';
import { type CoverDesign, type CoverText, coverBlocks, hasCover } from './cover';
import type { PicLook } from './picture';
import { cellPlain, fillCell, readCell, cellLookValue, cellMarkActive, clearCellFormat, refocusCell, rememberCellSelection, setCellLook, toggleCellMark } from './cells';
import { fromMarkdown, noteLink, toMarkdown } from './markdown';

/** The clipboard's type for Crumpet's own text, as Markdown. */
const CRUMPET_TYPE = 'application/x-crumpet-markdown';

/** What's pasted: the plain text, and Crumpet's own Markdown or HTML when there is any. */
export interface Pasted {
  text: string;
  md?: string;
  html?: string;
}
import { type PageBox, type PageGeometry, Paginator } from './paginate';
import { type Step, mapSelectionThrough } from './sync/transform';
import { chartFromRows } from './chart';
import { isBlankDoc, splitTitleBlocks, splitTitleText } from './pastetitle';

/** A macro's step: typed words, Enter, a deleted character, a caret move, or one of the editor's commands. */
export type MacroStep =
  | { k: 'text'; v: string }
  | { k: 'enter' }
  | { k: 'del'; v: -1 | 1 }
  | { k: 'move'; v: string; word?: boolean; extend?: boolean }
  | { k: 'call'; m: string; a: unknown[] };

/** The editor's commands a macro keeps (formatting, styles, inserting things). */
export const MACRO_COMMANDS = ['toggleMark', 'setBlockStyle', 'setAlign', 'setBlockType', 'setLook', 'setPara', 'setListStyle', 'setListStart', 'clearFormatting', 'changeCase', 'insertField', 'insertPageBreak', 'insertColumnBreak', 'insertSectionBreak', 'insertTable', 'insertTableOf', 'insertToc', 'insertChart', 'insertSpreadsheet', 'insertCode', 'insertMath', 'insertFootnote', 'insertCaption', 'insertShape', 'insertList', 'sortParagraphs', 'formatAtCaret', 'typeText'];

/** A new chart's numbers, to change. */
const SAMPLE_CHART = 'type: column\ntitle: Chart title\n, Series 1, Series 2\nFirst, 4, 2\nSecond, 3, 5\nThird, 5, 3';

export interface ChangeEvent {
  ops: Op[];
  source: 'input' | 'undo' | 'redo' | 'native' | 'command' | 'remote';
}

type Listener = (state: EditorState, change: ChangeEvent | null) => void;

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Changes made by typing (or undoing it): the caret is kept in sight after them. */
const REVEALING = new Set<ChangeEvent['source']>(['input', 'native', 'undo', 'redo']);

/** The box that scrolls the text: the nearest one around it that can scroll. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** Blocks that are a line of text (no table, picture or other box inside). */
const INLINE_TYPES = new Set<string>(['paragraph', 'heading1', 'heading2', 'heading3', 'heading4', 'quote', 'bullet', 'numbered', 'todo']);

/** Two versions of a block that differ only in their text (and its formatting). */
function sameButText(a: Block, b: Block): boolean {
  return JSON.stringify({ ...a, runs: null }) === JSON.stringify({ ...b, runs: null });
}

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
    if (!geometry) {
      this.view.pageOfBlock = null;
      this.view.pageCount = 1;
      this.view.fillFields();
    }
    sel();
    this.emit(null);
  }

  /** Show/hide ¶ (Word's formatting marks): dots for spaces, arrows for tabs, ¶ at each paragraph's end, and breaks labelled. */
  setShowMarks(on: boolean): void {
    if (this.view.showMarks === on) return;
    this.view.showMarks = on;
    this.view.root.classList.toggle('show-marks', on);
    const sel = this.keepSelection();
    this.draw(this.state.doc, new Set(this.state.doc.blocks.map((b) => b.id)));
    sel();
    this.emit(null);
  }

  /**
   * The browser's spelling check: on or off, the language it checks in
   * (where the browser supports it), and words it should pass over (your
   * dictionary, characters' names), matched in any case.
   */
  setSpelling(opts: { on: boolean; lang?: string; words?: Iterable<string> }): void {
    const root = this.view.root;
    root.spellcheck = opts.on;
    if (opts.lang) root.lang = opts.lang;
    else root.removeAttribute('lang');
    const words = [...new Set([...(opts.words ?? [])].map((w) => w.trim().toLowerCase()).filter((w) => w.length > 1))].sort((a, b) => b.length - a.length);
    const source = opts.on && words.length ? `(?<![\\p{L}\\p{N}])(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}])` : '';
    if ((this.view.noSpell?.source ?? '') === source) return;
    this.view.noSpell = source ? new RegExp(source, 'giu') : null;
    const sel = this.keepSelection();
    this.draw(this.state.doc, new Set(this.state.doc.blocks.map((b) => b.id)));
    sel();
  }

  /** The word at the caret (or the selected text, if it's one word), for spelling commands. */
  wordAtCaret(): string | null {
    this.syncSelectionFromDom();
    const s = this.state.selection;
    const block = getBlock(this.state.doc, s.focus.block);
    const text = runsText(block.runs);
    if (!isCollapsed(s)) {
      const sel = this.selectedText()?.trim() ?? '';
      return /^[\p{L}\p{N}'’-]+$/u.test(sel) ? sel : null;
    }
    const at = s.focus.offset;
    const before = /[\p{L}\p{N}'’-]*$/u.exec(text.slice(0, at))?.[0] ?? '';
    const after = /^[\p{L}\p{N}'’-]*/u.exec(text.slice(at))?.[0] ?? '';
    const word = (before + after).replace(/^['’-]+|['’-]+$/g, '');
    return word || null;
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

  /** A table of contents' options button was clicked (the app shows its settings). */
  onTocOptions: ((id: string) => void) | null = null;

  /** Changes a table of contents' settings (levels, title, page numbers, dotted leaders; or what kind of list it is). */
  setTocLook(id: string, look: TocLook | undefined): void {
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    if (!blk || blk.type !== 'toc' || this.isReadOnly) return;
    const to = attrsOf({ ...blk, tocl: tidyToc(look) });
    if (JSON.stringify(to) === JSON.stringify(attrsOf(blk))) return;
    this.dispatch({ ops: [{ type: 'setAttrs', block: id, from: attrsOf(blk), to }], selectionBefore: this.state.selection, selectionAfter: this.state.selection, kind: 'other' }, 'command');
  }

  /** Puts a table of contents of `kind` (a table of figures of captions labelled `label`, an index, a bibliography) at the caret. */
  insertList(look: TocLook): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    this.dispatch(insertToc(this.state), 'command');
    const toc = this.state.doc.blocks.find((b, i, all) => b.type === 'toc' && all[i + 1]?.id === this.state.selection.focus.block);
    if (toc) this.setTocLook(toc.id, look);
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
      this.holdingHeight(() => {
        // Fonts may have changed size: tabs are measured again first (in one flow).
        if (this.state.doc.blocks.some((b) => b.runs.some((r) => r.text.includes('\t')))) {
          this.paginator.clear();
          this.view.layoutTabs(this.state.doc);
        }
        this.paginator.update();
      });
      sel();
      if (this.layoutKey() !== before) this.emit(null);
    }
  }

  private layoutKey(): string {
    return `${this.paginator.pages}|${JSON.stringify(this.paginator.pageNotes)}|${JSON.stringify(this.paginator.pageBoxes)}`;
  }

  /** Remembers the selection (as places in the text) and returns how to put it back after the page moves things around. */
  private keepSelection(): () => void {
    const cell = this.activeCell();
    const focused = this.view.root.contains(this.view.root.ownerDocument.activeElement) && !cell;
    const sel = focused ? this.view.readSelection() : null;
    // A cell being typed in (in page view its row may move between pages and lose the focus).
    if (cell && cell.ownerDocument.activeElement === cell) rememberCellSelection(cell);
    return () => {
      if (sel) this.view.writeSelection(sel);
      if (cell?.isConnected && cell.ownerDocument.activeElement !== cell && cell.ownerDocument.activeElement === cell.ownerDocument.body) refocusCell(cell);
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
    // Line numbers (the whole document's, on its first paragraph).
    const p0 = doc.blocks[0]?.para;
    this.paginator.lineNumbers = p0?.lnum ? { every: p0.lnum, restart: p0.lnr ?? 'page' } : null;
    if (this.paged) {
      if (!force?.size && this.drawInPlace(doc)) return this.placeShapes();
      const sel = this.keepSelection();
      // The text is briefly one flow (shorter than its pages): hold the
      // height, so the scroll box doesn't jump up while it's laid out again.
      this.holdingHeight(() => {
        this.paginator.clear();
        this.view.render(doc, force);
        this.paginator.update();
      });
      sel();
      this.drawnIds = doc.blocks.map((b) => b.id);
      return this.placeShapes();
    }
    this.view.render(doc, force);
    this.placeShapes();
  }

  /** Where a shape placed from the page or its margins starts from, on screen. */
  private shapeOrigin(el: HTMLElement, rel: 'margin' | 'page' | undefined): { x: number; y: number } {
    if (!rel) {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top };
    }
    const box = el.closest<HTMLElement>('.pg') ?? this.view.root;
    const r = box.getBoundingClientRect();
    if (rel === 'page') return { x: r.left, y: r.top };
    const cs = getComputedStyle(box);
    const scale = r.width / (box.offsetWidth || 1) || 1;
    return { x: r.left + (parseFloat(cs.paddingLeft) || 0) * scale, y: r.top + (parseFloat(cs.paddingTop) || 0) * scale };
  }

  /** Shapes placed from the page's corner or its margins: put where they belong after the text is laid out. */
  private placeShapes(): void {
    // (A redraw makes new elements: shapes picked with Shift+click stay marked.)
    for (const id of this.pickedShapes) this.view.blockElement(id)?.classList.add('shape-picked');
    this.flowChains();
    if (this.editingPoints) this.drawPointHandles(this.editingPoints);
    this.markOutline();
    this.markSignatures();
    for (const el of Array.from(this.view.root.querySelectorAll<HTMLElement>('.blk-shape[data-rel]'))) {
      const blk = this.state.doc.blocks.find((b) => b.id === el.dataset.block);
      const s = blk?.shape;
      const wrap = el.querySelector<HTMLElement>(':scope > .shape-wrap');
      if (!s || !wrap || !isFloating(s)) continue;
      const scale = zoomOf(wrap);
      const o = this.shapeOrigin(el, s.rel);
      const r = el.getBoundingClientRect();
      wrap.style.left = `${(o.x - r.left) / scale + (s.x ?? 0) * 96}px`;
      wrap.style.top = `${(o.y - r.top) / scale + (s.y ?? 0) * 96}px`;
    }
  }

  /**
   * Linked text boxes: the first box of a chain holds the text; each box
   * after it shows where the text has got to (the text laid out at its own
   * width, moved up by what the boxes before it showed, a whole line at a time).
   */
  private flowChains(): void {
    const chains = new Map<string, Block[]>();
    for (const b of this.state.doc.blocks) if (b.shape?.chain) chains.set(b.shape.chain, [...(chains.get(b.shape.chain) ?? []), b]);
    for (const list of chains.values()) {
      const els = list.map((b) => this.view.blockElement(b.id)?.querySelector<HTMLElement>('.shape-text') ?? null);
      const first = els[0];
      if (!first) continue;
      const story = list[0].shape!.text;
      let shown = 0;
      els.forEach((el, k) => {
        if (!el) return;
        const cs = getComputedStyle(el);
        const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.35 || 18;
        const room = Math.max(0, el.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
        const lines = Math.floor(room / line) * line;
        if (k > 0) {
          el.contentEditable = 'false';
          el.closest('.shape-box')?.classList.add('chain-next');
          el.textContent = '';
          const flow = el.ownerDocument.createElement('div');
          flow.className = 'chain-flow';
          fillCell(flow, story);
          flow.style.marginTop = `${-shown}px`;
          el.appendChild(flow);
        } else el.style.maxHeight = '';
        // What this box shows: whole lines only (the next box carries on from there).
        el.style.setProperty('--shown', `${lines}px`);
        if (k < els.length - 1) el.style.clipPath = `inset(0 0 calc(100% - ${lines + (parseFloat(cs.paddingTop) || 0)}px) 0)`;
        shown += lines;
      });
    }
  }

  /** Links a text box to the next one below it, so text that doesn't fit runs on into it. */
  private linkTextBox(id: string): void {
    const blocks = this.state.doc.blocks;
    const i = blocks.findIndex((b) => b.id === id);
    const me = blocks[i]?.shape;
    if (!me) return;
    const next = blocks.slice(i + 1).find((b) => b.shape && !isLineKind(b.shape.kind) && (!me.chain || b.shape.chain !== me.chain));
    if (!next) return;
    const chain = me.chain ?? `c${Math.random().toString(36).slice(2, 8)}`;
    // The next box's own words join the end of the text.
    const head = blocks.find((b) => b.shape?.chain === chain) ?? blocks[i];
    const extra = next.shape!.text;
    const patches: [string, Partial<ShapeLook>][] = [[id, { chain }], [next.id, { chain, text: '' }]];
    if (extra) patches.push([head.id, { text: `${head.shape!.text}${head.shape!.text ? '&#10;' : ''}${extra}` }]);
    this.setShapes(patches);
  }

  /** Breaks a text box out of its chain (the text stays with the first box). */
  private unlinkTextBox(id: string): void {
    const chain = this.state.doc.blocks.find((b) => b.id === id)?.shape?.chain;
    if (!chain) return;
    const members = this.state.doc.blocks.filter((b) => b.shape?.chain === chain);
    const rest = members.filter((b) => b.id !== id);
    this.setShapes([[id, { chain: undefined, ...(members[0].id === id ? {} : { text: '' }) }], ...(rest.length === 1 ? [[rest[0].id, { chain: undefined }] as [string, Partial<ShapeLook>]] : [])]);
  }

  /** The shape whose corners are being edited (Edit Points). */
  private editingPoints: string | null = null;

  /** Starts (or stops) editing a shape's corners; a shape that isn't a freeform becomes one, keeping its outline. */
  private editPoints(id: string | null): void {
    const was = this.editingPoints;
    this.editingPoints = id;
    if (was) {
      const el = this.view.blockElement(was);
      el?.classList.remove('editing-points');
      el?.querySelectorAll('.pt-handle, .pt-mid').forEach((h) => h.remove());
    }
    if (!id) return;
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    if (!blk?.shape || blk.shape.kind === 'path' || isLineKind(blk.shape.kind)) return;
    if (blk.shape.kind !== 'freeform') {
      const pts = cornersOf(blk.shape.kind) ?? this.traceOutline(id);
      if (pts) this.setShapeLook(id, { kind: 'freeform', pts });
    }
    this.drawPointHandles(id);
  }

  /** Points round a curved shape's outline, read from its drawing (for Edit Points). */
  private traceOutline(id: string): [number, number][] | null {
    const el = this.view.blockElement(id);
    const svg = el?.querySelector<SVGSVGElement>('.shape-art');
    const body = svg?.querySelector<SVGGeometryElement>('path, rect, ellipse');
    const vb = svg?.viewBox.baseVal;
    if (!body || !vb || !vb.width || typeof body.getTotalLength !== 'function') return null;
    const len = body.getTotalLength();
    const n = 24;
    const pts: [number, number][] = [];
    for (let k = 0; k < n; k++) {
      const p = body.getPointAtLength((k / n) * len);
      pts.push([Math.round((p.x / vb.width) * 1000) / 1000, Math.round((p.y / vb.height) * 1000) / 1000]);
    }
    return pts;
  }

  /** Handles on a freeform's corners (drag to move, double-click to take away) and on its sides' middles (drag to add a corner). */
  private drawPointHandles(id: string): void {
    const el = this.view.blockElement(id);
    const box = el?.querySelector<HTMLElement>('.shape-box');
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    if (!el || !box || blk?.shape?.kind !== 'freeform') return;
    el.classList.add('editing-points');
    box.querySelectorAll('.pt-handle, .pt-mid').forEach((h) => h.remove());
    const pts = blk.shape.pts ?? [];
    const handle = (cls: string, x: number, y: number, k: number) => {
      const h = el.ownerDocument.createElement('span');
      h.className = cls;
      h.style.left = `${x * 100}%`;
      h.style.top = `${y * 100}%`;
      h.dataset.k = String(k);
      h.contentEditable = 'false';
      box.appendChild(h);
      return h;
    };
    pts.forEach(([x, y], k) => {
      const h = handle('pt-handle', x, y, k);
      h.title = 'Drag to move this corner; double-click to take it away';
      h.addEventListener('pointerdown', (e) => this.dragPoint(e, id, k, false));
      h.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (pts.length > 3) this.setShapeLook(id, { pts: pts.filter((_, j) => j !== k) });
      });
    });
    pts.forEach(([x, y], k) => {
      const [nx, ny] = pts[(k + 1) % pts.length];
      const h = handle('pt-mid', (x + nx) / 2, (y + ny) / 2, k);
      h.title = 'Drag to add a corner here';
      h.addEventListener('pointerdown', (e) => this.dragPoint(e, id, k, true));
    });
  }

  /** Drags a corner (or, from a side's middle, a new corner) of a freeform. */
  private dragPoint(e: PointerEvent, id: string, k: number, adding: boolean): void {
    e.preventDefault();
    e.stopPropagation();
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    const box = this.view.blockElement(id)?.querySelector<HTMLElement>('.shape-box');
    if (!blk?.shape?.pts || !box || this.isReadOnly) return;
    const r = box.getBoundingClientRect();
    let pts = blk.shape.pts.map((p) => [...p] as [number, number]);
    const at = adding ? k + 1 : k;
    if (adding) pts.splice(at, 0, [(pts[k][0] + pts[(k + 1) % pts.length][0]) / 2, (pts[k][1] + pts[(k + 1) % pts.length][1]) / 2]);
    const handle = e.target as HTMLElement;
    const move = (ev: PointerEvent) => {
      const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
      pts = pts.map((p, j) => (j === at ? [x, y] : p));
      handle.style.left = `${x * 100}%`;
      handle.style.top = `${y * 100}%`;
      const path = box.querySelector('.shape-art path');
      const vb = (box.querySelector('.shape-art') as SVGSVGElement | null)?.viewBox.baseVal;
      if (path && vb) path.setAttribute('d', `M${pts.map(([px, py]) => `${px * vb.width},${py * vb.height}`).join('L')}Z`);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.setShapeLook(id, { pts });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Reads an SVG picture's drawing as a shape's look (the app reads the file). */
  onSvgToShape: ((src: string) => Promise<Partial<ShapeLook> | null>) | null = null;

  /** Word's Convert to Shape: an SVG picture becomes a drawing shape of the same size, its colours changeable. */
  private async svgToShape(id: string): Promise<void> {
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    if (!blk?.src || blk.type !== 'image' || this.isReadOnly) return;
    const look = await this.onSvgToShape?.(blk.src);
    const now = this.state.doc.blocks.find((b) => b.id === id);
    if (!look || !now) return;
    const el = this.view.blockElement(id)?.querySelector<HTMLElement>('img');
    const w = blk.pic?.w ?? (el ? Math.min(6, el.offsetWidth / 96) : 2);
    const [vw, vh] = look.vb ?? [24, 24];
    const shape = tidyShape({ line: null, fill: '#333333', ...look, kind: 'path', w, h: (w * vh) / vw, wrap: 'inline', text: '' });
    const ops: Op[] = [];
    if (now.runs.length) ops.push({ type: 'remove', block: id, offset: 0, runs: now.runs });
    ops.push({ type: 'setAttrs', block: id, from: attrsOf(now), to: attrsOf({ type: 'shape', shape, align: now.align }) });
    this.dispatch({ ops, selectionBefore: this.state.selection, selectionAfter: this.state.selection }, 'command');
  }

  /** Asks the app for a picture to fill a shape with (Word's Shape Fill > Picture); resolves to where it's kept. */
  onShapePicture: (() => Promise<string | null>) | null = null;

  /** Signature lines: each marked as matching the document still, or not (it's changed since it was signed). */
  private markSignatures(): void {
    const sigs = this.state.doc.blocks.filter((b) => b.para?.sig);
    if (!sigs.length) return;
    const now = docPrint(this.state.doc);
    for (const b of sigs) this.view.blockElement(b.id)?.setAttribute('data-sig-ok', b.para!.sig === now ? 'yes' : 'no');
  }

  /** Puts a signature line at the end of the paragraph the caret is in (after it): the words given, and the document's fingerprint now. */
  insertSignature(text: string): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    // A line of its own after the caret's paragraph (an empty line after it to go on writing, which the fingerprint leaves out).
    const id = this.state.selection.focus.block;
    const end = { block: id, offset: runsLength(getBlock(this.state.doc, id).runs) };
    const t = insertBlocks({ ...this.state, selection: { anchor: end, focus: end } }, [makeBlock('paragraph'), makeBlock('paragraph', text, [], { para: { sig: docPrint(this.state.doc) } })]);
    if (t) this.dispatch(t, 'command');
  }

  /** The document's protection (final, restricted, the password's lock), set even while it's read only. */
  setProtection(patch: Partial<Pick<ParaLook, 'final' | 'restrict' | 'plock'>>): void {
    this.dispatch(setDocPara(this.state, patch), 'command');
  }

  /** Word's outline view: the levels shown (unset: all), and only each paragraph's first line. */
  private outline: { level?: number; firstLine?: boolean } | null = null;

  setOutlineView(opts: { level?: number; firstLine?: boolean } | null): void {
    this.outline = opts;
    const root = this.view.root;
    root.classList.toggle('outline-view', !!opts);
    root.classList.toggle('outline-first-line', !!opts?.firstLine);
    if (opts?.level) root.dataset.showLevel = String(opts.level);
    else delete root.dataset.showLevel;
    this.markOutline();
  }

  get outlineView(): { level?: number; firstLine?: boolean } | null {
    return this.outline;
  }

  /** Outline view: each paragraph's level (a heading's own; body text one in from its heading), and whether a heading has anything under it. */
  private markOutline(): void {
    if (!this.outline) {
      this.view.root.querySelectorAll<HTMLElement>('[data-ol]').forEach((el) => {
        delete el.dataset.ol;
        delete el.dataset.olMore;
        el.style.removeProperty('--ol');
      });
      return;
    }
    let level = 0;
    const blocks = this.state.doc.blocks;
    blocks.forEach((b, i) => {
      const el = this.view.blockElement(b.id);
      const h = isHeading(b.type) ? Number(b.type.slice(-1)) : 0;
      if (h) level = h;
      if (!el) return;
      el.dataset.ol = h ? String(h) : 'b';
      el.style.setProperty('--ol', String(h ? h - 1 : level));
      const next = blocks[i + 1];
      if (h && next && !(isHeading(next.type) && Number(next.type.slice(-1)) <= h)) el.dataset.olMore = '';
      else delete el.dataset.olMore;
    });
  }

  /** Word's Expand / Collapse: opens or folds the section of the heading the caret is under. */
  foldHere(fold: boolean): void {
    const doc = this.state.doc;
    const i = blockIndex(doc, this.state.selection.focus.block);
    const head = [...doc.blocks.slice(0, i + 1)].reverse().find((b) => isHeading(b.type));
    if (head && !!head.folded !== fold) this.dispatch(toggleFold(this.state, head.id), 'command');
  }

  /** Word's Promote / Demote (Alt+Shift+Left/Right). */
  promote(dir: -1 | 1, toBody = false): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    this.dispatch(shiftLevel(this.state, dir, toBody), 'command');
  }

  /** Word's Move Up / Move Down (Alt+Shift+Up/Down): the paragraph, or a folded heading with its section, past the one before or after. */
  moveParagraph(dir: -1 | 1): void {
    if (this.isReadOnly) return;
    const doc = this.state.doc;
    const id = this.state.selection.focus.block;
    const blk = getBlock(doc, id);
    const ids = blk.folded || (this.outline && isHeading(blk.type) && this.outlineHides(id)) ? sectionOf(doc, id) : [id];
    const first = blockIndex(doc, ids[0]);
    const last = blockIndex(doc, ids[ids.length - 1]);
    let t: Transaction | null = null;
    if (dir < 0) {
      if (first === 0) return;
      // Past the paragraph before (or, when that's under a folded heading, past that whole section).
      let k = first - 1;
      const owner = [...doc.blocks.slice(0, k + 1)].reverse().find((x) => x.folded && sectionOf(doc, x.id).includes(doc.blocks[k].id));
      if (owner) k = blockIndex(doc, owner.id);
      t = moveBlocks(this.state, ids, doc.blocks[k].id);
    } else {
      if (last >= doc.blocks.length - 1) return;
      const nextId = doc.blocks[last + 1].id;
      const span = getBlock(doc, nextId).folded ? sectionOf(doc, nextId) : [nextId];
      const after = blockIndex(doc, span[span.length - 1]) + 1;
      t = moveBlocks(this.state, ids, doc.blocks[after]?.id ?? null);
    }
    if (t) this.dispatch(t, 'command');
  }

  /** In outline view, whether what's under this heading is out of sight (a level not shown). */
  private outlineHides(id: string): boolean {
    const lvl = this.outline?.level;
    if (!lvl) return false;
    const sec = sectionOf(this.state.doc, id);
    return sec.length > 1;
  }

  /** Outline view: dragging a paragraph's marker (a heading's takes its section) to another place; a click folds a heading. */
  private dragOutline(e: MouseEvent, el: HTMLElement): void {
    const id = el.dataset.block!;
    const doc = this.state.doc;
    const ids = sectionOf(doc, id);
    const root = this.view.root;
    const line = root.ownerDocument.createElement('div');
    line.className = 'ol-drop';
    let moved = false;
    let before: string | null | undefined;
    const startY = e.clientY;
    const move = (ev: MouseEvent) => {
      if (!moved && Math.abs(ev.clientY - startY) < 4) return;
      moved = true;
      if (!line.isConnected) root.appendChild(line);
      const els = Array.from(root.querySelectorAll<HTMLElement>('.blk[data-block]')).filter((x) => x.offsetParent && !ids.includes(x.dataset.block!));
      const rootBox = root.getBoundingClientRect();
      const scale = rootBox.width / (root.offsetWidth || 1) || 1;
      before = null;
      let y = els.length ? els[els.length - 1].getBoundingClientRect().bottom : rootBox.top;
      for (const x of els) {
        const r = x.getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) {
          before = x.dataset.block!;
          y = r.top;
          break;
        }
      }
      line.style.top = `${(y - rootBox.top) / scale}px`;
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      line.remove();
      if (!moved) {
        if (isHeading(getBlock(this.state.doc, id).type)) this.dispatch(toggleFold(this.state, id), 'command');
        return;
      }
      if (before !== undefined) {
        const t = moveBlocks(this.state, ids, before);
        if (t) this.dispatch(t, 'command');
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  /** Shapes picked by Shift+click, to group or line up together. */
  private pickedShapes = new Set<string>();

  private pickShape(id: string): void {
    if (this.pickedShapes.has(id)) this.pickedShapes.delete(id);
    else this.pickedShapes.add(id);
    this.view.blockElement(id)?.classList.toggle('shape-picked', this.pickedShapes.has(id));
  }

  private clearPicked(): void {
    for (const id of this.pickedShapes) this.view.blockElement(id)?.classList.remove('shape-picked');
    this.pickedShapes.clear();
  }

  /** Gridlines behind the text (Word's View Gridlines); shapes snap to them as they're moved and sized. */
  private grid = false;
  setGridlines(on: boolean): void {
    this.grid = on;
    this.view.root.classList.toggle('show-grid', on);
  }
  private snap(inches: number): number {
    return this.grid ? Math.round(inches * 4) / 4 : inches;
  }

  /** Several shapes changed as one step (each with its own patch). */
  private setShapes(patches: [string, Partial<ShapeLook>][]): void {
    if (this.isReadOnly || !patches.length) return;
    let state = this.state;
    const ops: Op[] = [];
    for (const [id, patch] of patches) {
      const t = setShape(state, id, patch);
      ops.push(...t.ops);
      state = { ...state, doc: applyOps(state.doc, t.ops) };
    }
    this.dispatch({ ops, selectionBefore: this.state.selection, selectionAfter: this.state.selection }, 'command');
  }

  /** Word's Bring Forward / Send Backward: a shape's place in the stack of shapes in front of (or behind) the text. */
  private orderShape(id: string, how: string): void {
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    if (!blk?.shape || !isFloating(blk.shape)) return;
    const others = this.state.doc.blocks.filter((b) => b.id !== id && b.shape && b.shape.wrap === blk.shape!.wrap);
    const zs = others.map((b) => b.shape!.z ?? 0);
    const z = blk.shape.z ?? 0;
    if (how === 'front') return this.setShapeLook(id, { z: Math.min(40, Math.max(z, ...zs, -1) + 1) });
    if (how === 'forward') return this.setShapeLook(id, { z: Math.min(40, z + 1) });
    if (how === 'backward') return this.setShapeLook(id, { z: Math.max(0, z - 1) });
    // To the back: below all the others (lifting them if it's at the bottom already).
    if (zs.length && Math.min(...zs) <= 0) this.setShapes([[id, { z: 0 }], ...others.map((b): [string, Partial<ShapeLook>] => [b.id, { z: (b.shape!.z ?? 0) + 1 }])]);
    else this.setShapeLook(id, { z: 0 });
  }

  /** Word's Align: one shape against the margins, or the picked shapes against each other. */
  private alignShapes(id: string, how: string): void {
    const ids = [...new Set([id, ...this.pickedShapes])];
    const blocks = ids.map((x) => this.state.doc.blocks.find((b) => b.id === x)).filter((b): b is Block => !!b?.shape);
    const floating = blocks.filter((b) => isFloating(b.shape!));
    // Shapes in the text's flow line up left, centre or right.
    if (!floating.length) {
      if (how === 'left' || how === 'center' || how === 'right') {
        const ops = blocks.map((b) => ({ type: 'setAttrs' as const, block: b.id, from: attrsOf(b), to: attrsOf({ ...b, align: how === 'left' ? undefined : how }) }));
        this.dispatch({ ops, selectionBefore: this.state.selection, selectionAfter: this.state.selection }, 'command');
      }
      return;
    }
    const rects = floating.map((b) => this.view.blockElement(b.id)?.querySelector<HTMLElement>('.shape-box')?.getBoundingClientRect());
    if (rects.some((r) => !r)) return;
    let target: DOMRect | { left: number; top: number; right: number; bottom: number; width: number; height: number };
    if (floating.length > 1) {
      const rs = rects as DOMRect[];
      target = { left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)), right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)), width: 0, height: 0 };
    } else {
      // Against the margins of its page.
      const el = this.view.blockElement(floating[0].id)!;
      const box = el.closest<HTMLElement>('.pg') ?? this.view.root;
      const r = box.getBoundingClientRect();
      const cs = getComputedStyle(box);
      const sc = r.width / (box.offsetWidth || 1) || 1;
      const pad = (k: string) => (parseFloat(cs.getPropertyValue(k)) || 0) * sc;
      const bottom = box === this.view.root ? Math.min(r.bottom, r.top + 11 * 96 * sc) : r.bottom - pad('padding-bottom');
      target = { left: r.left + pad('padding-left'), top: r.top + pad('padding-top'), right: r.right - pad('padding-right'), bottom, width: 0, height: 0 };
    }
    const patches: [string, Partial<ShapeLook>][] = floating.map((b, i) => {
      const r = rects[i]!;
      const scale = zoomOf(this.view.blockElement(b.id)!.querySelector<HTMLElement>('.shape-wrap')!);
      let dx = 0;
      let dy = 0;
      if (how === 'left') dx = target.left - r.left;
      else if (how === 'right') dx = target.right - r.right;
      else if (how === 'center') dx = (target.left + target.right) / 2 - (r.left + r.right) / 2;
      else if (how === 'top') dy = target.top - r.top;
      else if (how === 'bottom') dy = target.bottom - r.bottom;
      else if (how === 'middle') dy = (target.top + target.bottom) / 2 - (r.top + r.bottom) / 2;
      const round = (v: number) => Math.round(v * 100) / 100;
      return [b.id, { x: round((b.shape!.x ?? 0) + dx / scale / 96), y: round((b.shape!.y ?? 0) + dy / scale / 96) }];
    });
    this.setShapes(patches);
  }

  /** Word's Group: the picked shapes and this one move together (each is put in front of the text if it wasn't placed anywhere). */
  private groupShapes(id: string): void {
    const ids = [...new Set([id, ...this.pickedShapes])].filter((x) => this.state.doc.blocks.some((b) => b.id === x && b.shape));
    if (ids.length < 2) return;
    const grp = `g${Math.random().toString(36).slice(2, 8)}`;
    this.setShapes(ids.map((x) => {
      const s = this.state.doc.blocks.find((b) => b.id === x)!.shape!;
      return [x, isFloating(s) ? { grp } : { grp, wrap: 'free', x: 0, y: 0 }];
    }));
    this.clearPicked();
  }

  private ungroupShapes(id: string): void {
    const grp = this.state.doc.blocks.find((b) => b.id === id)?.shape?.grp;
    if (!grp) return;
    this.setShapes(this.state.doc.blocks.filter((b) => b.shape?.grp === grp).map((b): [string, Partial<ShapeLook>] => [b.id, { grp: undefined }]));
  }

  /**
   * Page view: while the pages are laid out again the text is briefly one
   * flow, shorter than its pages; its height is held meanwhile, so the box
   * scrolling it doesn't jump up.
   */
  private holdingHeight(fn: () => void): void {
    const root = this.view.root;
    root.style.minHeight = `${root.offsetHeight}px`;
    try {
      fn();
    } finally {
      root.style.minHeight = '';
    }
  }

  /** The blocks in the order last laid out on pages. */
  private drawnIds: string[] = [];

  /**
   * Page view, typing inside paragraphs: when each one changed is just as
   * tall afterwards (most keys), it's redrawn where it stands on its page and
   * the pages stay as they are, instead of every page being taken apart and
   * laid out again (slow on a long text, and the page flickered). Returns
   * false when the pages do need laying out again.
   */
  private drawInPlace(doc: Doc): boolean {
    if (doc.blocks.length !== this.drawnIds.length || !this.paginator.active) return false;
    const changed: { id: string; height: number }[] = [];
    for (let i = 0; i < doc.blocks.length; i++) {
      const b = doc.blocks[i];
      if (b.id !== this.drawnIds[i]) return false;
      const before = this.view.drawnBlock(b.id);
      if (!before) return false;
      if (before === b) continue;
      if (!INLINE_TYPES.has(b.type) || !sameButText(before, b)) return false;
      // An empty line changing (or becoming one) changes the paragraphs around it; footnotes take room at the page's foot.
      if (!runsLength(before.runs) || !runsLength(b.runs) || before.runs.some((r) => r.footnote !== undefined) || b.runs.some((r) => r.footnote !== undefined)) return false;
      const el = this.view.blockElement(b.id);
      if (!el?.isConnected || el.hasAttribute('data-split') || !el.closest('.pg-col')) return false;
      changed.push({ id: b.id, height: el.offsetHeight });
    }
    const sel = this.keepSelection();
    this.view.render(doc, undefined, true);
    // Taller or shorter: the text after it moves on the pages.
    if (changed.some((c) => this.view.blockElement(c.id)?.offsetHeight !== c.height)) this.holdingHeight(() => this.paginator.update());
    sel();
    return true;
  }

  constructor(root: HTMLElement, doc: Doc) {
    const first = doc.blocks[0];
    this.state = { doc, selection: caret({ block: first.id, offset: 0 }), storedMarks: null };
    this.view = new View(root);
    this.paginator = new Paginator(root);
    // Page numbers in fields (page, cross-references) once the pages are laid out.
    this.paginator.onLaidOut = () => {
      this.view.pageOfBlock = (id) => this.paginator.pageOf.get(id);
      this.view.pageCount = this.paginator.pages;
      this.view.pageOffset = this.paginator.pageOffset;
      this.view.fillFields();
    };
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
        if (kind && id) {
          // A new chart gets numbers to change (in its text box too, which may have the focus).
          const sample = kind.value === 'chart' && !getBlock(this.state.doc, id).code?.text.trim();
          const box = kind.closest('.code-wrap')?.querySelector<HTMLTextAreaElement>('.code-src');
          if (sample && box) box.value = SAMPLE_CHART;
          this.dispatch(setCode(this.state, id, { lang: kind.value as CodeLook['lang'], ...(sample ? { text: SAMPLE_CHART } : {}) }), 'command');
        }
        // A chart's kind: its text's type line.
        const type = (e.target as Element).closest?.<HTMLSelectElement>('select[data-chart-type]');
        const cid = type?.closest<HTMLElement>('[data-block]')?.dataset.block;
        if (type && cid) {
          const text = getBlock(this.state.doc, cid).code?.text ?? '';
          const next = /^\s*type\s*:.*$/im.test(text) ? text.replace(/^(\s*type\s*:).*$/im, `$1 ${type.value}`) : `type: ${type.value}\n${text}`;
          // Its text box too, which keeps what's in it while it has the focus.
          const box = type.closest('.code-wrap')?.querySelector<HTMLTextAreaElement>('.code-src');
          if (box) box.value = next;
          this.dispatch(setCode(this.state, cid, { text: next }), 'command');
        }
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
    // Leaving a cell (for the font or size box, say) notes it and its selection
    // there and then, not when the selection change arrives a moment later.
    root.addEventListener('focusout', (e) => {
      const cell = e.target as HTMLElement;
      if (cell.classList?.contains('cell')) {
        this.lastCell = cell;
        rememberCellSelection(cell);
      }
    }, { signal });
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
    // A picture being cropped keeps its edges showing when it's drawn again.
    if (this.cropping) this.view.blockElement(this.cropping)?.classList.add('cropping');
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
    const el = this.view.blockElement(id);
    el?.scrollIntoView({ block: 'center' });
    // A shape behind the text comes up above it, to be moved or changed.
    if (el && this.state.doc.blocks.find((b) => b.id === id)?.shape?.wrap === 'behind') el.classList.add('obj-picked');
  }

  /** Changes where a shape is placed from, keeping it where it is. */
  private relShape(id: string, rel: ShapeLook['rel']): void {
    const el = this.view.blockElement(id);
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    const wrap = el?.querySelector<HTMLElement>(':scope > .shape-wrap');
    if (!el || !blk?.shape || !wrap) return;
    const scale = zoomOf(wrap);
    const r = wrap.getBoundingClientRect();
    const o = this.shapeOrigin(el, rel);
    const round = (v: number) => Math.round(v * 100) / 100;
    this.setShapeLook(id, { rel, x: round((r.left - o.x) / scale / 96), y: round((r.top - o.y) / scale / 96) });
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

  /** Puts a table made already at the caret (Quick Tables, Draw Table). */
  insertTableOf(rows: string[][], tbl?: TableLook): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    this.dispatch(insertTableOf(this.state, rows, tbl), 'command');
    const table = this.state.doc.blocks.find((b, i, all) => b.type === 'table' && all[i + 1]?.id === this.state.selection.focus.block);
    if (table) this.focusCell(table.id, tbl?.noHeader ? 0 : 1, 0);
  }

  /** Word's Convert Text to Table: the selected paragraphs, cut into cells at `sep`. False when the selection can't be. */
  textToTable(sep: string): boolean {
    if (this.isReadOnly) return false;
    this.syncSelectionFromDom();
    const t = textToTable(this.state, sep);
    if (!t) return false;
    this.dispatch(t, 'command');
    return true;
  }

  /** The table the caret is in or by (a cell has the focus, or the caret is on the line after it). */
  currentTable(): Block | null {
    const cell = this.activeCell();
    const id = cell?.closest<HTMLElement>('[data-block]')?.dataset.block;
    const blk = id ? this.state.doc.blocks.find((b) => b.id === id) : undefined;
    if (blk?.type === 'table') return blk;
    return this.state.doc.blocks.find((b, i, all) => b.type === 'table' && all[i + 1]?.id === this.state.selection.focus.block) ?? null;
  }

  private onTableInput(target: HTMLElement): void {
    // A maths block's or chart's kind is changed by its own handler (and the text box would write the old text back).
    if (target instanceof HTMLSelectElement) return;
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
    this.dispatch(setTableRows(this.state, id, readTable(this.view.pieces(id), blk)), 'input', true, true);
  }

  private commitTables(): void {
    for (const id of [...this.tableTimers.keys()]) this.commitTable(id);
  }

  /** Every cell of the table showing its text as it is now, the one being typed in too. */
  private refillCells(id: string): void {
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    if (!blk?.rows) return;
    for (const box of this.view.pieces(id).flatMap((p) => Array.from(p.querySelectorAll<HTMLElement>('table .cell')))) {
      const text = blk.rows[Number(box.dataset.r)]?.[Number(box.dataset.c)];
      if (text !== undefined && readCell(box) !== text) fillCell(box, text);
    }
  }

  private focusCell(id: string, r: number, c: number): void {
    const cell = this.view
      .pieces(id)
      .map((el) => el.querySelector<HTMLElement>(`.cell[data-r="${r}"][data-c="${c}"]`))
      .find(Boolean);
    if (!cell) return;
    cell.focus();
    const sel = cell.ownerDocument.getSelection();
    sel?.selectAllChildren(cell);
    sel?.collapseToEnd();
  }

  /** The line style and colour new cell lines are drawn in (the Table menu's Cell lines). */
  private cellLine: { bs?: CellLook['bs']; bc?: string } = {};
  /** Word's border painter: on, each cell clicked gets lines all round in the style above. */
  private borderPainter = false;

  /** Paints the border painter's lines onto the cell clicked. */
  private paintCell(cell: HTMLElement): void {
    const id = cell.closest<HTMLElement>('[data-block]')?.dataset.block;
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    if (!id || !blk || blk.type !== 'table') return;
    this.commitTable(id);
    const fresh = this.state.doc.blocks.find((b) => b.id === id)!;
    const next = setCellLooks({ rows: tidyRows(fresh.rows), tbl: fresh.tbl }, [[Number(cell.dataset.r), Number(cell.dataset.c)]], { bd: 'tblr', bs: this.cellLine.bs ?? null, bc: this.cellLine.bc ?? null });
    this.dispatch(setTableRows(this.state, id, next.rows, next.tbl), 'command', true, true);
    this.view.blockElement(id)?.querySelector('.table-wrap')?.classList.add('painting');
  }

  /** A Table menu action (`row`, `del-col`, `merge-right`, `delete`…) on the table cell `cell`, as from the app's right-click menu. */
  tableAction(cell: HTMLElement, action: string, value?: string): void {
    const id = cell.closest<HTMLElement>('[data-block]')?.dataset.block;
    if (!id || this.isReadOnly || !cell.classList.contains('cell')) return;
    this.reshapeTable(id, action, Number(cell.dataset.r), Number(cell.dataset.c), value);
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
    else if (action === 'first-col') next = setTableLook(now, { firstCol: !now.tbl?.firstCol });
    else if (action === 'last-col') next = setTableLook(now, { lastCol: !now.tbl?.lastCol });
    else if (action === 'total-row') next = setTableLook(now, { totalRow: !now.tbl?.totalRow });
    else if (action === 'banded-cols') next = setTableLook(now, { bandedCols: !now.tbl?.bandedCols });
    else if (action === 'sheet') next = setTableLook(now, { sheet: !now.tbl?.sheet });
    else if (action === 'repeat') next = setTableLook(now, { noRepeat: !now.tbl?.noRepeat });
    else if (action === 'pad') next = setTableLook(now, { pad: value ? Number(value) : undefined });
    else if (action === 'cell-h') next = setCellLooks(now, [[r, c]], { h: (value || null) as CellLook['h'] | null });
    else if (action === 'cell-v') next = setCellLooks(now, [[r, c]], { v: (value || null) as CellLook['v'] | null });
    else if (action === 'cell-dir') next = setCellLooks(now, [[r, c]], { dir: (value || null) as CellLook['dir'] | null });
    else if (action === 'cell-bd') next = setCellLooks(now, [[r, c]], value ? { bd: value, bs: this.cellLine.bs ?? null, bc: this.cellLine.bc ?? null } : { bd: null, bs: null, bc: null });
    else if (action === 'cell-bs' || action === 'cell-bc') {
      // The line style or colour for the next lines drawn (and this cell's, if it has lines of its own).
      if (action === 'cell-bs') this.cellLine.bs = (value || undefined) as CellLook['bs'];
      else this.cellLine.bc = value || undefined;
      const own = now.tbl?.cells?.[`${mr},${mc}`];
      if (own?.bd && own.bd !== '0') next = setCellLooks(now, [[r, c]], { bs: this.cellLine.bs ?? null, bc: this.cellLine.bc ?? null });
      else return;
    } else if (action === 'painter') {
      this.borderPainter = !this.borderPainter;
      const el = this.view.blockElement(id);
      el?.querySelector('.table-wrap')?.classList.toggle('painting', this.borderPainter);
      el?.querySelectorAll('[data-table-action="painter"]').forEach((b) => b.setAttribute('aria-checked', String(this.borderPainter)));
      return;
    } else if (action === 'row-h') next = setRowHeight(now, r, value ? Number(value) : null);
    else if (action === 'dist-cols') next = distributeCols(now);
    else if (action === 'dist-rows') {
      // Every row as tall as the average of them now (in inches).
      const trs = Array.from(this.view.pieces(id).flatMap((el) => Array.from(el.querySelectorAll<HTMLElement>('table tr:not(.repeat-head)'))));
      const avg = trs.reduce((n, tr) => n + tr.getBoundingClientRect().height / zoomOf(tr), 0) / Math.max(1, trs.length) / 96;
      next = distributeRows(now, Math.max(0.2, Math.round(avg * 100) / 100));
    } else if (action === 'sort-asc' || action === 'sort-desc') next = sortTable(now, c, action === 'sort-desc', cellPlain);
    else if (action === 'formula') {
      const rowsNow = now.rows.map((row) => [...row]);
      rowsNow[mr][mc] = '=SUM(ABOVE)';
      next = { rows: rowsNow, tbl: now.tbl };
    } else if (action === 'to-text') {
      this.dispatch(tableToText(this.state, id), 'command');
      this.focusText();
      return;
    } else if (action === 'chart') {
      // A chart of the table's numbers, under it.
      const t = insertAfterBlock(this.state, id, attrsOf({ type: 'code', code: { lang: 'chart', text: chartFromRows(now.rows.map((r) => r.map(cellPlain))) } }));
      if (t) this.dispatch(t, 'command');
      return;
    }
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
    // The cell being typed in isn't redrawn as the table changes; here its text may have changed too (a sort, a formula).
    this.refillCells(id);
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
    // Lines in a box (Enter starts a new one), and "- " starts a bullet.
    if (e.key === 'Enter') {
      e.preventDefault();
      cell.ownerDocument.execCommand('insertLineBreak');
      return;
    }
    if (e.key === ' ' && !mod && bulletStart(cell)) {
      e.preventDefault();
      cell.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
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
  insertShape(kind: ShapeKind, textBox = false, look?: Partial<ShapeLook>): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    this.dispatch(insertShape(this.state, kind, textBox, look), 'command');
    const shape = this.state.doc.blocks.find((b, i, all) => b.type === 'shape' && all[i + 1]?.id === this.state.selection.focus.block);
    const text = shape && this.view.blockElement(shape.id)?.querySelector<HTMLElement>('.shape-text');
    if (textBox && text) text.focus();
  }

  /** Inserts maths or a diagram, with its source box ready to type in. */
  /** Word's Excel spreadsheet: a table shown as a spreadsheet (letters and numbers round it), with sums ready. */
  insertSpreadsheet(): void {
    const rows = [['Item', 'Number', 'Price', 'Total'], ['', '', '', '=B2*C2'], ['', '', '', '=B3*C3'], ['', '', '', '=B4*C4'], ['Total', '=SUM(B2:B4)', '', '=SUM(D2:D4)']];
    this.insertTableOf(rows, { sheet: true, totalRow: true });
  }

  /** Clicks on a drawing (the app opens it to draw on). */
  onInkEdit: ((id: string, text: string) => void) | null = null;

  /** The text position under a point on the screen (null when it isn't over this editor's text). */
  posAtPoint(x: number, y: number): Pos | null {
    const doc = this.view.root.ownerDocument as Document & { caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null };
    const at = doc.caretPositionFromPoint?.(x, y);
    const range = at ? null : doc.caretRangeFromPoint?.(x, y);
    const node = at?.offsetNode ?? range?.startContainer;
    if (!node || !this.view.root.contains(node)) return null;
    return this.view.domToPos(node, at?.offset ?? range?.startOffset ?? 0);
  }

  /**
   * Word's ink editor: a stroke drawn over the text (screen pixels) as an edit. A line through
   * or a scribble deletes the words under it (tracked when tracking), a circle selects them, a
   * line down starts a new paragraph, and a ^ puts the caret between words. Returns what it did.
   */
  inkGesture(points: InkPoint[]): InkGestureKind | null {
    if (this.isReadOnly) return null;
    const g = classifyGesture(points);
    if (!g) return null;
    const { box } = g;
    const h = box.bottom - box.top;
    if (g.kind === 'split' || g.kind === 'insert') {
      const y = g.kind === 'split' ? g.at.y + 6 : g.at.y;
      const pos = this.posAtPoint(g.at.x, y);
      if (!pos) return null;
      const text = getBlock(this.state.doc, pos.block).runs.map((r) => r.text).join('');
      const where = caret({ block: pos.block, offset: nearestGap(text, pos.offset) });
      const s = { ...this.state, selection: where };
      if (g.kind === 'split') this.dispatch(this.tracking ? trackedSplit(s, this.tracking.author) : splitBlock(s), 'command');
      else this.select(where);
      this.focus();
      return g.kind;
    }
    // From the stroke's start to its end, on its middle line (or inside its corners when it covers several lines).
    const tall = g.kind !== 'strike' && h > 40;
    const a = this.posAtPoint(box.left + 2, tall ? box.top + h * 0.2 : (box.top + box.bottom) / 2);
    const z = this.posAtPoint(box.right - 2, tall ? box.bottom - h * 0.2 : (box.top + box.bottom) / 2);
    if (!a || !z) return null;
    let anchor = a;
    let focus = z;
    // Out to whole words when it starts and ends in one paragraph.
    if (a.block === z.block) {
      const text = getBlock(this.state.doc, a.block).runs.map((r) => r.text).join('');
      const [from, to] = toWords(text, a.offset, z.offset, g.kind !== 'circle');
      if (from === to) return null;
      anchor = { block: a.block, offset: from };
      focus = { block: a.block, offset: to };
    }
    const sel = { anchor, focus };
    if (g.kind === 'circle') {
      this.select(sel);
      this.focus();
      return 'circle';
    }
    const s = { ...this.state, selection: sel };
    this.dispatch(this.tracking ? trackedDelete(s, 1, this.tracking.author) : deleteSelection(s), 'command');
    return g.kind;
  }

  /** Word's Draw → Drawing canvas: an empty drawing at the caret, opened to draw on. */
  insertDrawing(): void {
    if (this.isReadOnly) return;
    const text = '{"w":600,"h":300,"strokes":[]}';
    this.insertCode('ink', text);
    // The new drawing: just before the caret's line.
    const blk = this.state.doc.blocks.find((b, i, all) => b.type === 'code' && b.code?.lang === 'ink' && all[i + 1]?.id === this.state.selection.focus.block);
    if (blk) this.onInkEdit?.(blk.id, text);
  }

  /** Changes a maths block's, chart's or drawing's text. */
  setCodeText(id: string, text: string): void {
    if (this.isReadOnly) return;
    this.dispatch(setCode(this.state, id, { text }), 'command');
  }

  /** A chart (Word's Insert Chart): a column chart of some numbers to change. */
  insertChart(text = SAMPLE_CHART): void {
    this.insertCode('chart', text);
  }

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

  /** A picture's handles and its menu. */
  private onPictureControl(el: HTMLElement, e: MouseEvent): void {
    const id = el.closest<HTMLElement>('[data-block]')!.dataset.block!;
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    if (!blk || blk.type !== 'image') return;
    const action = el.dataset.picAction!;
    const tools = el.closest<HTMLElement>('.pic-tools');
    if (action === 'resize') return this.resizePicture(el, e.clientX);
    if (action === 'crop-edge') return this.cropEdge(el, e.clientX, e.clientY);
    if (action === 'rotate') return this.rotatePicture(el);
    if (action === 'move') return this.movePicture(el, e.clientX, e.clientY);
    if (action === 'menu') {
      tools?.classList.toggle('open');
      return;
    }
    tools?.classList.remove('open');
    const value = el.dataset.value ?? '';
    const p = blk.pic ?? {};
    if (action === 'wrap') this.setPicture(id, { wrap: value as PicLook['wrap'], ...(value === 'free' && !p.w ? { w: this.pictureWidth(el) } : {}) });
    else if (action === 'rot') this.setPicture(id, { rot: value === '0' ? 0 : (p.rot ?? 0) + Number(value) });
    else if (action === 'size') this.setPicture(id, { w: undefined });
    else if (action === 'reset') this.setPicture(id, p.alt ? { alt: p.alt } : {}, true, p.orig);
    else if (action === 'toshape') void this.svgToShape(id);
    else if (action === 'alt' || action === 'change' || action === 'format' || action === 'background' || action === 'compress') this.onPictureAction?.(id, action);
    else if (action === 'crop') {
      // Crop mode: the edges to drag, until Crop is clicked again (or anything else).
      const on = !el.closest('.blk-image')!.classList.contains('cropping');
      this.endCropping();
      if (on) {
        this.cropping = id;
        // A width to crop within (cropping keeps the picture's scale).
        if (!p.w) this.setPicture(id, { w: this.pictureWidth(el) });
        this.view.blockElement(id)?.classList.add('cropping');
      }
    } else if (action === 'ratio') this.cropToRatio(id, el, Number(value));
    else if (action === 'uncrop') {
      const k = p.crop ? 1 - p.crop[1] - p.crop[3] : 1;
      this.setPicture(id, { crop: undefined, ...(p.w ? { w: Math.round((p.w / k) * 100) / 100 } : {}) });
    } else if (action === 'mask') this.setPicture(id, { mask: (value || undefined) as PicLook['mask'] });
    else if (action === 'style') this.setPicture(id, { style: (value || undefined) as PicLook['style'] });
    else if (action === 'delete') {
      const ops: Op[] = [];
      if (blk.runs.length) ops.push({ type: 'remove', block: id, offset: 0, runs: blk.runs });
      ops.push({ type: 'setAttrs', block: id, from: attrsOf(blk), to: blockAttrs('paragraph') });
      this.dispatch({ ops, selectionBefore: this.state.selection, selectionAfter: caret({ block: id, offset: 0 }) }, 'command');
      this.focusText();
    }
  }

  /** The app's part of a picture's menu: alt text (a box to type it in), Change picture (a file to choose), corrections and effects (a window). */
  onPictureAction: ((id: string, action: 'alt' | 'change' | 'format' | 'background' | 'compress') => void) | null = null;

  /** The picture being cropped (its edges showing), if any. */
  private cropping: string | null = null;

  private endCropping(): void {
    if (!this.cropping) return;
    this.view.blockElement(this.cropping)?.classList.remove('cropping');
    this.cropping = null;
  }

  /** The picture's own height for its width (from the file), or 2/3 until it's known. */
  private pictureRatio(el: HTMLElement): number {
    const img = el.closest<HTMLElement>('[data-block]')?.querySelector<HTMLImageElement>('.pic-box img');
    return img?.naturalWidth ? img.naturalHeight / img.naturalWidth : 2 / 3;
  }

  /** Drags one edge of a picture being cropped: the picture stays the same scale, its window grows or shrinks. */
  private cropEdge(handle: HTMLElement, startX: number, startY: number): void {
    const el = handle.closest<HTMLElement>('[data-block]')!;
    const id = el.dataset.block!;
    const p = this.state.doc.blocks.find((b) => b.id === id)?.pic ?? {};
    const win = el.querySelector<HTMLElement>('.pic-crop');
    if (!win) return;
    const side = handle.dataset.value as 't' | 'r' | 'b' | 'l';
    const scale = zoomOf(win);
    const [t0, r0, b0, l0] = p.crop ?? [0, 0, 0, 0];
    const w0 = p.w ?? win.getBoundingClientRect().width / scale / 96;
    // The whole picture's width and height at this scale, in inches.
    const full = w0 / (1 - l0 - r0);
    const tall = full * this.pictureRatio(el);
    let next = { crop: [t0, r0, b0, l0] as [number, number, number, number], w: w0 };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale / 96;
      const dy = (ev.clientY - startY) / scale / 96;
      const c: [number, number, number, number] = [t0, r0, b0, l0];
      const clamp = (v: number, other: number) => Math.max(0, Math.min(0.95 - other, v));
      if (side === 'l') c[3] = clamp(l0 + dx / full, r0);
      if (side === 'r') c[1] = clamp(r0 - dx / full, l0);
      if (side === 't') c[0] = clamp(t0 + dy / tall, b0);
      if (side === 'b') c[2] = clamp(b0 - dy / tall, t0);
      next = { crop: c, w: full * (1 - c[1] - c[3]) };
      win.classList.add('cropped');
      (['--ct', '--cr', '--cb', '--cl'] as const).forEach((v, i) => win.style.setProperty(v, String(c[i])));
      win.style.width = `${next.w}in`;
      el.style.setProperty('--pw', `${next.w}in`);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const round = (v: number) => Math.round(v * 1000) / 1000;
      this.setPicture(id, { crop: next.crop.map(round) as [number, number, number, number], w: Math.round(next.w * 100) / 100 });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Crops a picture to an aspect ratio (width over height), from its middle, at the same scale. */
  private cropToRatio(id: string, el: HTMLElement, ratio: number): void {
    const p = this.state.doc.blocks.find((b) => b.id === id)?.pic ?? {};
    const ar = this.pictureRatio(el);
    const [, r0, , l0] = p.crop ?? [0, 0, 0, 0];
    const full = (p.w ?? this.pictureWidth(el)) / (1 - l0 - r0);
    // As much of the picture as fits the ratio: the sides cut off if it's wider, the top and bottom if it's taller.
    const keepW = Math.min(1, ar * ratio);
    const side = (1 - keepW) / 2;
    const keepH = Math.min(1, 1 / (ar * ratio));
    const top = (1 - keepH) / 2;
    const round = (v: number) => Math.round(v * 1000) / 1000;
    this.setPicture(id, { crop: [round(top), round(side), round(top), round(side)], w: Math.round(full * keepW * 100) / 100 });
  }

  /** Changes a picture's look (size, wrapping, turn, alt text); `replace` sets it whole; `src` puts another picture in its place. */
  setPicture(id: string, patch: Partial<PicLook>, replace = false, src?: string): void {
    if (this.isReadOnly) return;
    this.dispatch(setPic(this.state, id, patch, replace, src), 'command');
  }

  /** A picture's width as shown, in inches (unscaled). */
  private pictureWidth(el: HTMLElement): number {
    const img = el.closest<HTMLElement>('[data-block]')?.querySelector<HTMLImageElement>('.pic-box img');
    if (!img) return 3;
    return Math.round((img.getBoundingClientRect().width / zoomOf(img) / 96) * 100) / 100 || 3;
  }

  /** Drags a picture's corner to resize it (it keeps its shape). */
  private resizePicture(grip: HTMLElement, startX: number): void {
    const el = grip.closest<HTMLElement>('[data-block]')!;
    const id = el.dataset.block!;
    const img = el.querySelector<HTMLImageElement>('.pic-box img');
    if (!img) return;
    const scale = zoomOf(img);
    const w = img.getBoundingClientRect().width / scale / 96;
    const rot = ((this.state.doc.blocks.find((b) => b.id === id)?.pic?.rot ?? 0) * Math.PI) / 180;
    let now = w;
    const move = (ev: PointerEvent) => {
      now = Math.max(0.3, w + ((ev.clientX - startX) / scale / 96) * (Math.abs(Math.cos(rot)) > 0.3 ? Math.sign(Math.cos(rot)) : 1));
      img.style.width = `${now}in`;
      img.style.maxHeight = 'none';
      el.style.setProperty('--pw', `${now}in`);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (Math.abs(now - w) > 0.005) this.setPicture(id, { w: Math.round(now * 100) / 100 });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Drags the handle above a picture round to turn it (Shift: in steps of 15°). */
  private rotatePicture(handle: HTMLElement): void {
    const id = handle.closest<HTMLElement>('[data-block]')!.dataset.block!;
    const frame = handle.closest<HTMLElement>('.pic-box');
    if (!frame) return;
    const r = frame.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const was = this.state.doc.blocks.find((b) => b.id === id)?.pic?.rot ?? 0;
    let rot = was;
    const move = (ev: PointerEvent) => {
      const a = (Math.atan2(ev.clientX - cx, cy - ev.clientY) * 180) / Math.PI;
      rot = ((Math.round(ev.shiftKey ? Math.round(a / 15) * 15 : a) % 360) + 360) % 360;
      frame.style.transform = rot ? `rotate(${rot}deg)` : '';
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (rot !== was) this.setPicture(id, { rot });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Drags a picture that's in front of the text to anywhere on the page. */
  private movePicture(handle: HTMLElement, startX: number, startY: number): void {
    const el = handle.closest<HTMLElement>('[data-block]')!;
    const id = el.dataset.block!;
    const p = this.state.doc.blocks.find((b) => b.id === id)?.pic ?? {};
    const scale = zoomOf(el);
    const { x = 0, y = 0 } = p;
    let at = { x, y };
    const move = (ev: PointerEvent) => {
      at = { x: x + (ev.clientX - startX) / scale / 96, y: y + (ev.clientY - startY) / scale / 96 };
      el.style.setProperty('--px', `${at.x}in`);
      el.style.setProperty('--py', `${at.y}in`);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (at.x !== x || at.y !== y) this.setPicture(id, { x: at.x, y: at.y });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
    const scale = zoomOf(box);
    const { w, h } = blk.shape;
    // A turned shape grows along its own sides.
    const a = ((blk.shape.rot ?? 0) * Math.PI) / 180;
    let size = { w, h };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale / 96;
      const dy = (ev.clientY - startY) / scale / 96;
      size = { w: Math.max(0.2, this.snap(w + dx * Math.cos(a) + dy * Math.sin(a))), h: Math.max(0.1, this.snap(h - dx * Math.sin(a) + dy * Math.cos(a))) };
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

  /** Drags a shape's handle above it round to turn it (Shift: in steps of 15°). */
  private rotateShape(handle: HTMLElement): void {
    const id = handle.closest<HTMLElement>('[data-block]')?.dataset.block;
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    const box = handle.closest<HTMLElement>('.shape-box');
    if (!id || !blk?.shape || !box || this.isReadOnly) return;
    const r = box.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let rot = blk.shape.rot ?? 0;
    const move = (ev: PointerEvent) => {
      // Straight up from the middle is 0°.
      const a = (Math.atan2(ev.clientX - cx, cy - ev.clientY) * 180) / Math.PI;
      rot = ((Math.round(ev.shiftKey ? Math.round(a / 15) * 15 : a) % 360) + 360) % 360;
      box.style.transform = rot ? `rotate(${rot}deg)` : '';
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (rot !== (blk.shape!.rot ?? 0)) this.setShapeLook(id, { rot });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Drags a shape that's placed anywhere (its whole group with it), or one on its own lines across. */
  private moveShape(handle: HTMLElement, startX: number, startY: number): void {
    const id = handle.closest<HTMLElement>('[data-block]')?.dataset.block;
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    const wrap = handle.closest<HTMLElement>('.shape-wrap');
    if (!id || !blk?.shape || !wrap || this.isReadOnly) return;
    const scale = zoomOf(wrap);
    const across = blk.shape.wrap === 'topbottom';
    const grp = blk.shape.grp;
    const moving = (grp ? this.state.doc.blocks.filter((b) => b.shape?.grp === grp && isFloating(b.shape)) : [blk]).map((b) => {
      const w = this.view.blockElement(b.id)?.querySelector<HTMLElement>(':scope > .shape-wrap') ?? null;
      return { b, w, left: w?.offsetLeft ?? 0, top: w?.offsetTop ?? 0, margin: (b.shape!.x ?? 0) * 96 };
    });
    let d = { x: 0, y: 0 };
    const move = (ev: PointerEvent) => {
      const raw = { x: (ev.clientX - startX) / scale / 96, y: across ? 0 : (ev.clientY - startY) / scale / 96 };
      // On the grid: the shape's own corner lands on a line.
      const x0 = blk.shape!.x ?? 0;
      const y0 = blk.shape!.y ?? 0;
      d = { x: this.snap(x0 + raw.x) - x0, y: across ? 0 : this.snap(y0 + raw.y) - y0 };
      for (const m of moving) {
        if (!m.w) continue;
        if (across) m.w.style.marginLeft = `${m.margin + d.x * 96}px`;
        else {
          m.w.style.left = `${m.left + d.x * 96}px`;
          m.w.style.top = `${m.top + d.y * 96}px`;
        }
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!d.x && !d.y) return;
      const round = (v: number) => Math.round(v * 100) / 100;
      this.setShapes(moving.map((m): [string, Partial<ShapeLook>] => [m.b.id, across ? { x: round(Math.max(0, (m.b.shape!.x ?? 0) + d.x)) } : { x: round((m.b.shape!.x ?? 0) + d.x), y: round((m.b.shape!.y ?? 0) + d.y) }]));
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
      const cells = this.view.pieces(id).flatMap((p) => Array.from(p.querySelectorAll<HTMLElement>('table .cell')));
      const i = cells.indexOf(cell) + (e.shiftKey ? -1 : 1);
      if (i < 0) return;
      if (i >= cells.length) return this.reshapeTable(id, 'row', r, 0);
      this.commitTable(id);
      this.focusCell(id, Number(cells[i].dataset.r), Number(cells[i].dataset.c));
    } else if (e.key === 'Enter' && (e.shiftKey || e.altKey)) {
      // Another line in the same cell.
      e.preventDefault();
      cell.ownerDocument.execCommand('insertLineBreak');
      this.onTableInput(cell);
    } else if (e.key === ' ' && !mod && bulletStart(cell)) {
      // "- " or "* " starting a line in a cell: a bullet.
      e.preventDefault();
      this.onTableInput(cell);
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

  /** Several parts of the look at once (Word's Font window), as one step to undo. */
  setLooks(patch: Partial<Record<LookKey, string | number | null>>): void {
    if (this.isReadOnly) return;
    const cell = this.activeCell();
    if (cell) {
      for (const [k, v] of Object.entries(patch) as [LookKey, string | number | null][]) setCellLook(cell, k, v);
      return;
    }
    this.syncSelectionFromDom();
    this.dispatch(setLooks(this.state, patch), 'command');
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

  /** The caret at the start of a paragraph, collapsed: that paragraph. */
  private paragraphStart(): Block | null {
    const s = this.state;
    if (this.isReadOnly || !isCollapsed(s.selection) || s.selection.focus.offset !== 0) return null;
    const blk = getBlock(s.doc, s.selection.focus.block);
    return blk.type === 'paragraph' ? blk : null;
  }

  /** How far the paragraph's first line is indented on screen (by hand or by its style), in pixels. */
  private firstIndentPx(id: string): number {
    const el = this.view.blockElement(id);
    return el ? parseFloat(getComputedStyle(el).textIndent) || 0 : 0;
  }

  /** Backspace at the start of an indented paragraph: its first line goes back to the margin. */
  private dropFirstIndent(): boolean {
    const blk = this.paragraphStart();
    if (!blk || this.firstIndentPx(blk.id) <= 0) return false;
    this.dispatch(setPara(this.state, { first: 0 }), 'command');
    return true;
  }

  /** Tab at the start of a paragraph whose indent was taken away: the style's indent comes back. */
  private restoreFirstIndent(): boolean {
    const blk = this.paragraphStart();
    if (!blk || blk.para?.first !== 0) return false;
    this.dispatch(setPara(this.state, { first: undefined }), 'command');
    // Its style has no indent of its own: Tab types a tab as usual.
    return this.firstIndentPx(blk.id) > 0;
  }

  /** Increase (1) or decrease (-1) indent. */
  /** Word's Column Break (Ctrl+Shift+Enter). */
  insertColumnBreak(): void {
    this.syncSelectionFromDom();
    this.dispatch(insertColumnBreak(this.state), 'command');
  }

  /** Word's Section Breaks: Next Page, or Continuous. */
  insertSectionBreak(kind: 'page' | 'cont' | 'odd' | 'even'): void {
    this.syncSelectionFromDom();
    this.dispatch(insertSectionBreak(this.state, kind), 'command');
  }

  /** Columns and orientation for the section the caret is in. */
  /** The whole document's hyphenation and line numbers (kept on its first paragraph). */
  setDocPara(patch: Partial<Pick<ParaLook, 'hyph' | 'lnum' | 'lnr' | 'wm' | 'wmimg' | 'wmc' | 'wmflat' | 'pgc' | 'pgb' | 'pgbc' | 'thc' | 'thf' | 'thx' | 'psp' | 'script'>>): void {
    if (this.isReadOnly) return;
    this.dispatch(setDocPara(this.state, patch), 'command');
  }

  /** The whole document's settings kept on its first paragraph. */
  docPara(): ParaLook {
    return this.state.doc.blocks[0]?.para ?? {};
  }

  /** Header and footer settings for the section starting at block `at` (see ParaLook's hdr, ftr, hfirst, pstart, pfmt). */
  setSectionAt(at: string, patch: SectionPatch): void {
    if (this.isReadOnly) return;
    // (Typed in a header or footer: the caret stays there.)
    this.dispatch(setSection(this.state, patch, at), 'command', true, true);
  }

  /** Word's Cover Page: a design at the start of the document (instead of any cover there). */
  insertCover(design: CoverDesign, text: CoverText, accent?: string): void {
    if (this.isReadOnly) return;
    this.dispatch(insertCover(this.state, coverBlocks(design, text, accent)), 'command');
  }

  /** Word's Remove Current Cover Page. */
  removeCover(): void {
    if (this.isReadOnly) return;
    const t = removeCover(this.state);
    if (t) this.dispatch(t, 'command');
  }

  get hasCover(): boolean {
    return hasCover(this.state.doc.blocks);
  }

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

  /** Puts a field at the caret: a date or time that shows the day it's read (see fields.ts). */
  insertField(name: string): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    this.dispatch(insertField(this.state, name), 'command');
  }

  /** Measures tabs again (after fonts load, say), outside page view; page view does it in `repaginate`. */
  relayoutTabs(): void {
    if (!this.paged) this.view.layoutTabs(this.state.doc);
  }

  /** Shows what each field says now (e.g. after midnight, or when the app's own fields change). */
  updateFields(): void {
    this.view.fillFields();
  }

  /** Word's Blank Page: an empty page at the caret. */
  insertBlankPage(): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    this.dispatch(insertBlankPage(this.state), 'command');
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

  /** Puts the caret at `pos` and brings it into the middle of the view (Word's Go To). */
  goTo(pos: Pos): void {
    this.focusPos(pos);
    const at = this.view.posToDom(pos);
    const el = at ? (at.node instanceof Element ? at.node : at.node.parentElement) : this.view.blockElement(pos.block);
    el?.scrollIntoView({ block: 'center' });
  }

  /**
   * Word's Insert Caption: "Figure 1: text", numbered by a seq field that
   * counts up through the text. A picture at the caret gets it as its
   * caption; a table (the caret on the line after it) gets a caption line
   * above or below it; otherwise it's a line after the caret's paragraph.
   */
  insertCaption(label: string, text: string, where: 'above' | 'below' = 'below'): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    const runs: Run[] = [{ text: `${label} `, marks: [] }, { text: FIELD, marks: [], field: `seq:${label}` }, ...(text ? [{ text: `: ${text}`, marks: [] as Mark[] }] : [])];
    const here = this.currentBlock();
    if (here.type === 'image') {
      // Its caption, numbered (what it said already stays after the number, unless there's new text).
      const old = runsText(here.runs).trim();
      const all = text || !old ? runs : [...runs, { text: `: ${old}`, marks: [] as Mark[] }];
      const ops: Op[] = [];
      if (here.runs.length) ops.push({ type: 'remove', block: here.id, offset: 0, runs: here.runs });
      ops.push({ type: 'insert', block: here.id, offset: 0, runs: all });
      this.dispatch({ ops, selectionBefore: this.state.selection, selectionAfter: caret({ block: here.id, offset: runsLength(all) }), kind: 'other' }, 'command');
      return;
    }
    const table = this.currentTable();
    const i = this.state.doc.blocks.findIndex((b) => b.id === (table ?? here).id);
    // Above: after the block before it (a table first in the text: below instead).
    const after = where === 'above' && i > 0 ? this.state.doc.blocks[i - 1] : (table ?? here);
    const id = newId();
    const ops: Op[] = [
      { type: 'split', block: after.id, offset: runsLength(after.runs), newBlock: id, newAttrs: { ...blockAttrs('paragraph'), style: 'caption' } },
      { type: 'insert', block: id, offset: 0, runs },
    ];
    this.dispatch({ ops, selectionBefore: this.state.selection, selectionAfter: caret({ block: id, offset: runsLength(runs) }), kind: 'other' }, 'command');
    this.focusText();
  }

  /** The caret to the end of the selection (to put something after what's selected). */
  collapseToEnd(): void {
    this.syncSelectionFromDom();
    const { anchor, focus } = this.state.selection;
    const blocks = this.state.doc.blocks;
    const ia = blocks.findIndex((b) => b.id === anchor.block);
    const ifo = blocks.findIndex((b) => b.id === focus.block);
    const end = ia > ifo || (ia === ifo && anchor.offset > focus.offset) ? anchor : focus;
    this.state = { ...this.state, selection: caret(end) };
    this.view.writeSelection(this.state.selection);
  }

  /** Takes out the field at `pos` (a bookmark or index entry, say). */
  removeFieldAt(pos: Pos): void {
    const blk = this.state.doc.blocks.find((b) => b.id === pos.block);
    if (!blk || this.isReadOnly) return;
    const runs = sliceRuns(blk.runs, pos.offset, pos.offset + 1);
    if (runs[0]?.field === undefined) return;
    this.dispatch({ ops: [{ type: 'remove', block: pos.block, offset: pos.offset, runs }], selectionBefore: this.state.selection, selectionAfter: this.state.selection, kind: 'other' }, 'command');
  }

  /** Lets the app fill in fields it knows (title, author, citations…). */
  setFieldValues(fn: ((name: string) => string | null) | null): void {
    this.view.fieldValue = fn;
    this.view.fillFields();
  }

  /** The keys of the sources this document cites, in the order first cited. */
  citedKeys(): string[] {
    const out: string[] = [];
    for (const b of this.state.doc.blocks) for (const r of b.runs) if (r.field?.startsWith('cite:') && r.change?.kind !== 'del' && !out.includes(r.field.slice(5))) out.push(r.field.slice(5));
    return out;
  }

  /** Citations' text, and a bibliography's lines (the sources cited, in the citation style), from the app. */
  setCitations(cite: ((key: string) => string | null) | null, list: (() => string[]) | null): void {
    this.view.citeText = cite;
    this.view.fillFields();
    this.setSourcesList(list);
  }

  setSourcesList(fn: (() => string[]) | null): void {
    this.view.sourcesList = fn;
    const lists = this.state.doc.blocks.filter((b) => b.type === 'toc' && b.tocl?.kind === 'sources');
    if (lists.length) this.draw(this.state.doc, new Set(lists.map((b) => b.id)));
  }

  /** The bookmarks in the document, in order: name and where. */
  bookmarks(): { name: string; pos: Pos }[] {
    const out: { name: string; pos: Pos }[] = [];
    for (const b of this.state.doc.blocks) {
      let at = 0;
      for (const r of b.runs) {
        if (r.field?.startsWith('bm:') && r.change?.kind !== 'del') out.push({ name: r.field.slice(3), pos: { block: b.id, offset: at } });
        at += r.text.length;
      }
    }
    return out;
  }

  /** Goes to the bookmark called `name`. False when there's none. */
  goToBookmark(name: string): boolean {
    const bm = this.bookmarks().find((x) => x.name === name);
    if (!bm) return false;
    this.goTo(bm.pos);
    return true;
  }

  /**
   * A bookmark at the start of block `id` for a cross-reference to point at
   * (one there already is used; otherwise a hidden one, _Ref and a number,
   * as Word makes). Returns its name.
   */
  bookmarkBlock(id: string): string {
    const blk = this.state.doc.blocks.find((b) => b.id === id);
    const have = blk?.runs.find((r) => r.field?.startsWith('bm:'));
    if (have) return have.field!.slice(3);
    const taken = new Set(this.bookmarks().map((b) => b.name));
    let name = `_Ref${Math.floor(Math.random() * 9e8 + 1e8)}`;
    while (taken.has(name)) name = `_Ref${Math.floor(Math.random() * 9e8 + 1e8)}`;
    const sel = this.state.selection;
    this.state = { ...this.state, selection: caret({ block: id, offset: 0 }) };
    this.dispatch(insertField(this.state, `bm:${name}`), 'command');
    this.state = { ...this.state, selection: mapSelectionAfterInsert(sel, id) };
    return name;
  }

  /** Page view: the caret to the top of page `n` (from 1). False if there's no such page. */
  goToPage(n: number): boolean {
    const page = this.view.root.querySelectorAll<HTMLElement>(':scope > .pg')[n - 1];
    const first = page?.querySelector<HTMLElement>('[data-block]');
    if (!page || !first) return false;
    this.focusPos({ block: first.dataset.block!, offset: Number(first.dataset.from ?? 0) });
    page.scrollIntoView({ block: 'start' });
    return true;
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
    if (change && REVEALING.has(change.source)) this.revealSoon();
  }

  private revealPending = false;

  /** After typing: the caret is brought into sight once the page has settled (next frame). */
  private revealSoon(): void {
    if (this.revealPending) return;
    this.revealPending = true;
    requestAnimationFrame(() => {
      this.revealPending = false;
      this.revealCaret();
    });
  }

  /**
   * Scrolls just enough to keep the caret in sight, with a little room below
   * it, as a word processor does while you type. (The browser doesn't do it
   * itself here, as the editor draws the text.) Also above the phone's
   * keyboard, which covers part of the screen.
   */
  revealCaret(): void {
    const root = this.view.root;
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    const sel = doc.getSelection();
    if (!win || !root.contains(doc.activeElement) || !sel?.rangeCount || !sel.focusNode || !root.contains(sel.focusNode)) return;
    const range = doc.createRange();
    range.setStart(sel.focusNode, sel.focusOffset);
    range.collapse(true);
    let box: DOMRect | null = range.getClientRects()[0] ?? null;
    if (!box?.height) {
      // A caret on an empty line has no box of its own: use its line's.
      const n = sel.focusNode;
      box = (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement)?.getBoundingClientRect() ?? null;
    }
    if (!box) return;
    const scroller = scrollParent(root);
    const vv = win.visualViewport;
    let top = vv ? vv.offsetTop : 0;
    let bottom = vv ? vv.offsetTop + vv.height : win.innerHeight;
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      top = Math.max(top, r.top);
      bottom = Math.min(bottom, r.bottom);
    }
    const room = Math.min(60, Math.max(0, (bottom - top) / 4));
    const delta = box.bottom > bottom - room ? box.bottom - (bottom - room) : box.top < top + room ? box.top - (top + room) : 0;
    if (Math.abs(delta) < 1) return;
    if (scroller) scroller.scrollTop += delta;
    else win.scrollBy(0, delta);
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
    // Backspace at the start of a paragraph with a first-line indent takes the indent away first, as in Word.
    if (e.inputType === 'deleteContentBackward' && this.dropFirstIndent()) {
      e.preventDefault();
      return;
    }
    if (this.tracking && this.trackedInput(e)) return;

    switch (e.inputType) {
      case 'insertText': {
        e.preventDefault();
        if (e.data == null) return;
        this.recordStep({ k: 'text', v: e.data });
        this.dispatch(insertText(s, e.data));
        if (e.data === ' ') {
          this.dispatch(markdownShortcut(this.state));
          this.dispatch(autoLink(this.state), 'command');
        }
        this.correct(e.data);
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
        this.recordStep({ k: 'enter' });
        this.dispatch(splitBlock(s));
        return;
      }
      case 'deleteContentBackward':
      case 'deleteContentForward': {
        e.preventDefault();
        this.recordStep({ k: 'del', v: e.inputType === 'deleteContentBackward' ? -1 : 1 });
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

  /** AutoCorrect while typing (curly quotes, dashes, typos, capitals…); null: off. */
  autocorrect: AutoCorrectOptions | null = null;

  /** Puts right what was just typed, as a step of its own (so Ctrl+Z takes back only the correction). */
  private correct(typed: string): void {
    if (!this.autocorrect) return;
    const t = autoCorrect(this.state, typed, this.autocorrect, !!this.tracking);
    if (t) this.dispatch(t, 'command');
  }

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

  /**
   * Does `cmd` on each of `matches` in turn, as if each were selected, as one
   * step to undo (Word's Select Text with Similar Formatting, then formatting).
   * For commands that leave the text where it is (formatting, styles).
   */
  applyToAll(matches: Match[], cmd: (s: EditorState) => Transaction | null): void {
    if (this.isReadOnly || !matches.length) return;
    let state = this.state;
    const ops: Op[] = [];
    for (const m of matches) {
      const t = cmd({ ...state, selection: { anchor: { block: m.block, offset: m.from }, focus: { block: m.block, offset: m.to } }, storedMarks: null });
      if (!t?.ops.length) continue;
      state = { ...state, doc: applyOps(state.doc, t.ops) };
      ops.push(...t.ops);
    }
    if (ops.length) this.dispatch({ ops, selectionBefore: this.state.selection, selectionAfter: this.state.selection, kind: 'other' }, 'command');
  }

  /** The text at the caret's formatting: its marks and look, to find text like it. */
  formatAtCaret(): { marks: Mark[]; look: Look | undefined } {
    const pos = this.state.selection.focus;
    const blk = getBlock(this.state.doc, pos.block);
    let at = 0;
    let run = blk.runs[0];
    for (const r of blk.runs) {
      // The character before the caret (or the first one, at the start).
      if (at < Math.max(1, pos.offset)) run = r;
      at += r.text.length;
    }
    return { marks: run ? [...run.marks] : [], look: run?.look };
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
        this.dispatch(trackedInsertText(range ? { ...s, selection: range } : s, text.replaceAll(FOOTNOTE, '').replaceAll(FIELD, ''), author));
        if (e.inputType === 'insertText') this.correct(text);
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

  /** The whole document's settings: track changes for everyone, and the lock on tracking (see ParaLook). */
  get docTracking(): { all: boolean; lock?: string } {
    const p = this.state.doc.blocks[0]?.para;
    return { all: p?.track === 'all', lock: p?.lock };
  }

  /** Sets the whole document's tracking settings (kept on its first paragraph). */
  setDocTracking(patch: { track?: 'all'; lock?: string }): void {
    if (this.isReadOnly) return;
    this.dispatch(setDocPara(this.state, patch), 'command');
  }

  /** Accepting or rejecting was asked for while tracking is locked (the app says how to unlock it). */
  onLockedReview: (() => void) | null = null;

  /** Accepts or rejects tracked changes: in one stretch of a paragraph, or everywhere. Not while tracking is locked. */
  resolveChanges(accept: boolean, where?: { block: string; from: number; to: number }): void {
    if (this.docTracking.lock) {
      this.onLockedReview?.();
      return;
    }
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
  insertFootnote(text = '', endnote = false): Pos {
    this.syncSelectionFromDom();
    this.dispatch(insertFootnote(this.state, text, endnote), 'command');
    const f = this.state.selection.focus;
    return { block: f.block, offset: f.offset - 1 };
  }

  /** Adds an empty footnote after the selection and opens it for writing (see onFootnoteClick). */
  addFootnote(endnote = false): void {
    if (this.isReadOnly) return;
    const at = this.insertFootnote('', endnote);
    const el = this.footnoteElement(at);
    if (el) this.onFootnoteClick?.(at, '', el);
  }

  /** Clicks on a drop-down list, date picker or fill-in box (the app opens its card). */
  onFormClick: ((at: Pos, name: string, el: HTMLElement) => void) | null = null;

  /** Only form controls can be changed (Restrict editing → Filling in forms): set by the app with read only. */
  formsOnly = false;

  /** Changes a form control (a choice made, a date picked, words typed), even while only forms may be filled in. */
  setForm(at: Pos, name: string): void {
    if (this.isReadOnly && !this.formsOnly) return;
    const t = setFieldAt(this.state, at, name);
    if (t) this.dispatch(t, 'command');
  }

  /** Clicks on an equation within the line (the app opens its editor). */
  onMathClick: ((at: Pos, tex: string, el: HTMLElement) => void) | null = null;

  /** Word's Insert Equation (Alt+=): an equation within the line at the caret, opened for writing. */
  insertMath(tex = ''): void {
    if (this.isReadOnly) return;
    this.insertField(`math:${tex || 'x'}`);
    const f = this.state.selection.focus;
    const at = { block: f.block, offset: f.offset - 1 };
    const el = this.fieldElement(at);
    if (el) this.onMathClick?.(at, tex, el);
  }

  /** Changes an equation within the line (empty: takes it out). */
  setMath(at: Pos, tex: string): void {
    const t = setFieldAt(this.state, at, tex.trim() ? `math:${tex.trim().replace(/\n/g, ' ')}` : '');
    if (t) this.dispatch(t, 'command');
  }

  /** An equation within the line made one of its own, on a line of its own. */
  mathOwnLine(at: Pos): void {
    const t = mathToBlock(this.state, at);
    if (t) this.dispatch(t, 'command');
  }

  /** The element drawing the field at `at`. */
  fieldElement(at: Pos): HTMLElement | null {
    for (const el of Array.from(this.view.root.querySelectorAll<HTMLElement>('span.fld'))) {
      const p = this.view.domToPos(el, 0);
      if (p && p.block === at.block && p.offset === at.offset) return el;
    }
    return null;
  }

  /** Adds an endnote (listed at the end, numbered i, ii, iii) and opens it for writing. */
  addEndnote(): void {
    this.addFootnote(true);
  }

  /** Word's Convert Notes: all footnotes made endnotes, or all endnotes footnotes. */
  convertNotes(to: 'end' | 'foot'): void {
    if (this.isReadOnly) return;
    this.dispatch(convertNotes(this.state, to), 'command');
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
    for (const which of ['foot', 'end'] as const) {
      const i = footnotes(this.state.doc, which).findIndex((f) => f.block === at.block && f.offset === at.offset);
      if (i >= 0) return this.view.root.querySelectorAll<HTMLElement>(which === 'end' ? 'sup.fn.en' : 'sup.fn:not(.en)')[i] ?? null;
    }
    return null;
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

  // ---------------------------------------------------------------- macros

  /** The steps of the macro being recorded (null: not recording). */
  private macro: MacroStep[] | null = null;
  private macroDepth = 0;
  private macroOriginals = new Map<string, unknown>();

  get recordingMacro(): boolean {
    return !!this.macro;
  }

  private recordStep(step: MacroStep): void {
    if (!this.macro || this.macroDepth > 0) return;
    const last = this.macro[this.macro.length - 1];
    // Typing in a row is one step.
    if (step.k === 'text' && last?.k === 'text') last.v += step.v;
    else this.macro.push(step);
  }

  /** Word's Record Macro: from now on, typing, Enter, Backspace, moving the caret and the formatting commands are kept. */
  startMacro(): void {
    this.macro = [];
    const self = this as unknown as Record<string, (...a: unknown[]) => unknown>;
    for (const name of MACRO_COMMANDS) {
      const original = self[name];
      if (typeof original !== 'function' || this.macroOriginals.has(name)) continue;
      this.macroOriginals.set(name, original);
      self[name] = (...args: unknown[]) => {
        // Only what can be kept as it is (words, numbers, plain settings).
        if (this.macro && this.macroDepth === 0 && args.every((a) => a === undefined || ['string', 'number', 'boolean'].includes(typeof a) || (a && typeof a === 'object' && JSON.stringify(a).length < 2000))) this.macro.push({ k: 'call', m: name, a: JSON.parse(JSON.stringify(args.map((a) => (a === undefined ? null : a)))) });
        this.macroDepth++;
        try {
          return original.apply(this, args);
        } finally {
          this.macroDepth--;
        }
      };
    }
  }

  /** Stops recording: the steps kept. */
  stopMacro(): MacroStep[] {
    const self = this as unknown as Record<string, unknown>;
    for (const [name, original] of this.macroOriginals) self[name] = original;
    this.macroOriginals.clear();
    const steps = this.macro ?? [];
    this.macro = null;
    return steps;
  }

  /** Plays a macro's steps at the caret. */
  playMacro(steps: MacroStep[]): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    for (const step of steps) {
      if (step.k === 'text') this.typeText(step.v);
      else if (step.k === 'enter') this.dispatch(splitBlock(this.state), 'command');
      else if (step.k === 'del') this.dispatch(deleteChar(this.state, step.v), 'command');
      else if (step.k === 'move') this.moveCaret(step.v, !!step.word, !!step.extend);
      else if (step.k === 'call' && MACRO_COMMANDS.includes(step.m)) {
        const f = (this as unknown as Record<string, (...a: unknown[]) => unknown>)[step.m];
        if (typeof f === 'function') f.apply(this, step.a.map((a) => (a === null ? undefined : a)));
      }
    }
    this.view.writeSelection(this.state.selection);
  }

  /** Moves the caret a character or word left or right, or to the start or end of its paragraph (Shift: selecting). */
  private moveCaret(key: string, word: boolean, extend: boolean): void {
    const { doc, selection } = this.state;
    const f = selection.focus;
    const blocks = doc.blocks;
    let i = blocks.findIndex((b) => b.id === f.block);
    let at = f.offset;
    const text = (n: number) => runsText(blocks[n].runs);
    if (key === 'Home') at = 0;
    else if (key === 'End') at = text(i).length;
    else {
      const dir = key === 'ArrowLeft' ? -1 : 1;
      if (word) {
        const t = text(i);
        if (dir < 0) {
          while (at > 0 && /\s/.test(t[at - 1])) at--;
          while (at > 0 && !/\s/.test(t[at - 1])) at--;
        } else {
          while (at < t.length && !/\s/.test(t[at])) at++;
          while (at < t.length && /\s/.test(t[at])) at++;
        }
      } else if (dir < 0 && at === 0 && i > 0) {
        i--;
        at = text(i).length;
      } else if (dir > 0 && at === text(i).length && i < blocks.length - 1) {
        i++;
        at = 0;
      } else at = Math.max(0, Math.min(text(i).length, at + dir));
    }
    const focus = { block: blocks[i].id, offset: at };
    this.state = { ...this.state, selection: { anchor: extend ? selection.anchor : focus, focus } };
    this.view.writeSelection(this.state.selection);
  }

  /** Types `text` at the caret, as if typed. */
  typeText(text: string): void {
    this.syncSelectionFromDom();
    this.reviseLook();
    this.dispatch(insertText(this.state, text), 'command');
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.isComposing || e.keyCode === 229) return;
    // Moving the caret while a macro is recorded: kept as a step (the browser moves it).
    if (this.macro && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) this.recordStep({ k: 'move', v: e.key, word: e.ctrlKey || e.altKey || undefined, extend: e.shiftKey || undefined });
    if (this.onKeyIntercept?.(e)) {
      e.preventDefault();
      return;
    }
    const mod = isMac ? e.metaKey : e.ctrlKey;
    // Word's outline keys: Alt+Shift+arrows promote, demote and move; in outline view Tab demotes a heading and Shift+Tab promotes it.
    // Alt+= (Word's Insert Equation): an equation within the line.
    if (e.altKey && !e.shiftKey && !mod && e.code === 'Equal' && this.onMathClick) {
      e.preventDefault();
      this.insertMath();
      return;
    }
    if (e.altKey && e.shiftKey && !mod && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      this.syncSelectionFromDom();
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') this.moveParagraph(e.key === 'ArrowUp' ? -1 : 1);
      else this.promote(e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (this.outline && e.key === 'Tab' && !mod && isHeading(getBlock(this.state.doc, this.state.selection.focus.block).type)) {
      e.preventDefault();
      this.syncSelectionFromDom();
      this.promote(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === 'Tab') {
      // Tab nests list items (Shift+Tab un-nests); elsewhere it types a tab, which goes to the next tab stop (as in Word).
      e.preventDefault();
      this.syncSelectionFromDom();
      // In a script, Tab changes the element instead.
      const script = this.isReadOnly ? null : cycleScript(this.state, e.shiftKey ? -1 : 1);
      if (script) {
        this.dispatch(script, 'command');
        return;
      }
      const nest = indent(this.state, e.shiftKey ? -1 : 1);
      if (nest) this.dispatch(nest, 'command');
      else if (!e.shiftKey && this.restoreFirstIndent()) return;
      else if (!e.shiftKey && !this.isReadOnly && INLINE_TYPES.has(getBlock(this.state.doc, this.state.selection.focus.block).type)) {
        this.reviseLook();
        this.dispatch(this.tracking ? trackedInsertText(this.state, '\t', this.tracking.author) : insertText(this.state, '\t'));
      }
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
    else if (key === '-' && !e.shiftKey && !e.altKey && !this.isReadOnly) this.typeText('\u00ad');
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
      const end = fn.classList.contains('en');
      const i = [...this.view.root.querySelectorAll(end ? 'sup.fn.en' : 'sup.fn:not(.en)')].indexOf(fn);
      const at = footnotes(this.state.doc, end ? 'end' : 'foot')[i];
      if (at) {
        e.preventDefault();
        this.onFootnoteClick({ block: at.block, offset: at.offset }, at.text, fn);
        return;
      }
    }
    // Form controls: a tick box ticks; the others open their card (also while only filling in forms is allowed).
    const form = (e.target as Element).closest?.<HTMLElement>('span.fld[data-field^="chk:"], span.fld[data-field^="drop:"], span.fld[data-field^="pick:"], span.fld[data-field^="fill:"]');
    if (form && (!this.isReadOnly || this.formsOnly)) {
      const at = this.view.domToPos(form, 0);
      const name = form.dataset.field!;
      if (at) {
        e.preventDefault();
        if (name.startsWith('chk:')) this.setForm(at, `chk:${name === 'chk:1' ? 0 : 1}`);
        else this.onFormClick?.(at, name, form);
        return;
      }
    }
    // Clicking an equation within the line opens it to edit.
    const math = (e.target as Element).closest?.<HTMLElement>('span.fld[data-field^="math:"]');
    if (math && this.onMathClick && !this.isReadOnly) {
      const at = this.view.domToPos(math, 0);
      if (at) {
        e.preventDefault();
        this.onMathClick(at, math.dataset.field!.slice(5), math);
        return;
      }
    }
    // Ctrl/⌘-click on a cross-reference, or a link to a bookmark, goes to the bookmark.
    const mod = isMac ? e.metaKey : e.ctrlKey;
    const ref = mod && (e.target as Element).closest?.<HTMLElement>('span.fld[data-target]');
    if (ref) {
      e.preventDefault();
      this.goToBookmark(ref.dataset.target!);
      return;
    }
    const link = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (link && mod && link.getAttribute('href')?.startsWith('#bm:')) {
      e.preventDefault();
      this.goToBookmark(link.getAttribute('href')!.slice(4));
      return;
    }
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
    // An attached file shown inside the page, or as an icon again.
    const fileAct = (e.target as Element).closest?.<HTMLElement>('[data-file-action]');
    const fileId = fileAct?.closest<HTMLElement>('[data-block]')?.dataset.block;
    if (fileAct && fileId && !this.isReadOnly) {
      e.preventDefault();
      const blk = getBlock(this.state.doc, fileId);
      const to = attrsOf({ ...blk, style: fileAct.dataset.fileAction === 'embed' ? 'embed' : undefined });
      this.dispatch({ ops: [{ type: 'setAttrs', block: fileId, from: attrsOf(blk), to }], selectionBefore: this.state.selection, selectionAfter: this.state.selection }, 'command');
      return;
    }
    // Clicking a drawing opens it to draw on (the app's drawing window).
    const inked = (e.target as Element).closest?.<HTMLElement>('.code-wrap[data-lang="ink"] [data-code-preview]');
    const inkId = inked?.closest<HTMLElement>('[data-block]')?.dataset.block;
    if (inked && inkId && !this.isReadOnly && this.onInkEdit) {
      e.preventDefault();
      this.onInkEdit(inkId, getBlock(this.state.doc, inkId).code?.text ?? '');
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
    if (this.cropping && (e.target as Element).closest?.('[data-block]') !== this.view.blockElement(this.cropping)) this.endCropping();
    const picAction = (e.target as Element).closest?.<HTMLElement>('[data-pic-action]');
    if (picAction && !this.isReadOnly) {
      e.preventDefault();
      return this.onPictureControl(picAction, e);
    }
    // Outline view: the marker left of a paragraph drags it (a heading with its section), and a click folds a heading.
    if (this.outline && e.button === 0 && !this.isReadOnly) {
      const blk = (e.target as Element).closest?.<HTMLElement>('.blk[data-ol]');
      if (blk && blk.parentElement && (e.target as Element).closest('.editor') === this.view.root) {
        const r = blk.getBoundingClientRect();
        const pad = parseFloat(getComputedStyle(blk).paddingLeft) * (r.width / (blk.offsetWidth || 1));
        if (e.clientX >= r.left && e.clientX < r.left + pad) {
          e.preventDefault();
          return this.dragOutline(e, blk);
        }
      }
    }
    // Shift+click on shapes picks several, to group or line up.
    const pickBox = e.shiftKey && (e.target as Element).closest?.<HTMLElement>('.shape-box');
    if (pickBox && !(e.target as Element).closest('[data-shape-action]')) {
      e.preventDefault();
      const pid = pickBox.closest<HTMLElement>('[data-block]')?.dataset.block;
      if (pid) this.pickShape(pid);
      return;
    }
    if (this.pickedShapes.size && !(e.target as Element).closest?.('.shape-tools')) this.clearPicked();
    if (this.editingPoints && !(e.target as Element).closest?.(`[data-block="${this.editingPoints}"]`)) this.editPoints(null);
    // A shape behind the text picked from the Selection pane: back under the text on the next click elsewhere.
    this.view.root.querySelectorAll('.obj-picked').forEach((x) => !x.contains(e.target as Node) && x.classList.remove('obj-picked'));
    const shapeAction = (e.target as Element).closest?.<HTMLElement>('[data-shape-action]');
    if (shapeAction) {
      e.preventDefault();
      const id = shapeAction.closest<HTMLElement>('[data-block]')!.dataset.block!;
      const action = shapeAction.dataset.shapeAction!;
      const tools = shapeAction.closest<HTMLElement>('.shape-tools');
      if (action === 'resize') return this.resizeShape(shapeAction, e.clientX, e.clientY);
      if (action === 'rotate') return this.rotateShape(shapeAction);
      if (action === 'move') return this.moveShape(shapeAction, e.clientX, e.clientY);
      if (action === 'menu') {
        tools?.classList.toggle('open');
        return;
      }
      tools?.classList.remove('open');
      const value = shapeAction.dataset.value ?? '';
      if (action === 'fill') this.setShapeLook(id, { fill: value || null, img: undefined, ...(value ? {} : { grad: undefined }) });
      else if (action === 'line') this.setShapeLook(id, { line: value || null });
      else if (action === 'wrap') {
        const tight = value === 'tleft' || value === 'tright';
        this.setShapeLook(id, { wrap: (tight ? value.slice(1) : value) as ShapeLook['wrap'], tight: tight || undefined });
      } else if (action === 'rel') this.relShape(id, (value || undefined) as ShapeLook['rel']);
      else if (action === 'style') {
        const st = SHAPE_STYLES[Number(value)];
        if (st) this.setShapeLook(id, { fill: null, line: null, lw: undefined, dash: undefined, grad: undefined, img: undefined, fx: undefined, tc: undefined, ...st.look });
      } else if (action === 'grad') {
        const now = this.state.doc.blocks.find((b) => b.id === id)?.shape;
        this.setShapeLook(id, { grad: now?.grad ? undefined : darker(now?.fill ?? '#4472c4'), img: undefined, fill: now?.fill ?? '#4472c4' });
      } else if (action === 'img') void this.onShapePicture?.().then((src) => src && this.setShapeLook(id, { img: src }));
      else if (action === 'lw') this.setShapeLook(id, { lw: Number(value) });
      else if (action === 'dash') this.setShapeLook(id, { dash: (value || undefined) as ShapeLook['dash'] });
      else if (action === 'head' || action === 'tail') this.setShapeLook(id, { [action]: value || undefined });
      else if (action === 'fx') this.setShapeLook(id, { fx: (value || undefined) as ShapeLook['fx'] });
      else if (action === 'tc') this.setShapeLook(id, { tc: value || undefined });
      else if (action === 'ta') this.setShapeLook(id, { ta: (value || undefined) as ShapeLook['ta'] });
      else if (action === 'tv') this.setShapeLook(id, { tv: (value || undefined) as ShapeLook['tv'] });
      else if (action === 'dir') this.setShapeLook(id, { dir: (value || undefined) as ShapeLook['dir'] });
      else if (action === 'link') this.linkTextBox(id);
      else if (action === 'unlink') this.unlinkTextBox(id);
      else if (action === 'points') this.editPoints(this.editingPoints === id ? null : id);
      else if (action === 'order') this.orderShape(id, value);
      else if (action === 'align') this.alignShapes(id, value);
      else if (action === 'group') this.groupShapes(id);
      else if (action === 'ungroup') this.ungroupShapes(id);
      else if (action === 'rot') {
        const now = this.state.doc.blocks.find((b) => b.id === id)?.shape?.rot ?? 0;
        this.setShapeLook(id, { rot: value === '0' ? 0 : now + Number(value) });
      }
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
    const tocOpts = (e.target as Element).closest?.<HTMLElement>('[data-toc-options]');
    if (tocOpts) {
      e.preventDefault();
      const id = tocOpts.closest<HTMLElement>('[data-block]')?.dataset.block;
      if (id) this.onTocOptions?.(id);
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
    // The border painter paints each cell clicked.
    const painted = this.borderPainter && (e.target as Element).closest?.<HTMLElement>('.table-wrap .cell');
    if (painted) {
      e.preventDefault();
      this.paintCell(painted);
      return;
    }
    const action = (e.target as Element).closest?.<HTMLElement>('[data-table-action]');
    if (action) {
      e.preventDefault();
      const id = action.closest<HTMLElement>('[data-block]')!.dataset.block!;
      const cell = this.view.root.ownerDocument.activeElement as HTMLElement | null;
      // (In page view the cell may be in a later part of the table.)
      const inThis = cell?.classList.contains('cell') && cell.closest<HTMLElement>('[data-block]')?.dataset.block === id;
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
      // Choosing a line style or colour, or the painter, keeps the menu open.
      if (!['cell-bs', 'cell-bc', 'painter'].includes(action.dataset.tableAction!)) tools?.classList.remove('open');
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
  insertMedia(type: 'image' | 'file', src: string, caption = '', style?: string): void {
    if (this.isReadOnly) return;
    this.dispatch(insertMedia(this.state, type, src, caption, style), 'command');
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
    const text = e.clipboardData?.getData('text/plain')?.replaceAll(FOOTNOTE, '').replaceAll(FIELD, '') ?? '';
    // Copied from Crumpet: its own formatting, as Markdown.
    const md = e.clipboardData?.getData(CRUMPET_TYPE) ?? '';
    const html = e.clipboardData?.getData('text/html') ?? '';
    this.paste({ text, md, html }, plain ? 'text' : 'keep');
  }

  /** The clipboard's type for Crumpet's own text (Markdown), so copying and pasting within Crumpet keeps everything. */
  static readonly CLIPBOARD_TYPE = CRUMPET_TYPE;

  /** What was last pasted, how far back to undo to paste it again another way, and whether its first line went to the title. */
  private lastPaste: { what: Pasted; depth: number; mode: 'keep' | 'merge' | 'text'; titled: boolean } | null = null;

  /** After a paste: the app offers Keep formatting, Merge formatting and Text only (Word's Paste Options), and keeping the first line in the text if it became the title. */
  onPasted: ((formatted: boolean, titled: boolean) => void) | null = null;

  /**
   * Pasting into an empty document (set by the app for a note's title box):
   * `take` is offered the first line and the rest's text, and returns true if
   * it made that line the title (it's then left out of the paste); `giveBack`
   * puts the title back as it was, when the paste is done again keeping it.
   */
  pasteTitle: { take(title: string, restText: string, heading: boolean): boolean; giveBack(): void } | null = null;

  /**
   * Pastes text: formatted (Crumpet's own, or HTML from a web page, Word or
   * Google Docs, with its headings, lists and formatting), merged (lists,
   * bold and italic kept, but the text taking on the look where it goes), or
   * plain text only.
   */
  paste(what: Pasted, mode: 'keep' | 'merge' | 'text' = 'keep', title = true): void {
    if (this.isReadOnly) return;
    const depth = this.history.depth;
    let blocks: Block[] | null = null;
    if (mode !== 'text') {
      if (what.md) blocks = fromMarkdown(what.md).blocks;
      else if (what.html && this.htmlToBlocks) blocks = this.htmlToBlocks(what.html);
    }
    let text = what.text;
    // A long piece pasted into an empty note: its first line may be the title.
    let titled = false;
    if (title && this.pasteTitle && !this.tracking && isBlankDoc(this.state.doc)) {
      const split = blocks?.length ? splitTitleBlocks(blocks) : text ? splitTitleText(text) : null;
      if (split && split.title && this.pasteTitle.take(split.title, split.restText, split.heading)) {
        titled = true;
        if (typeof split.rest === 'string') text = split.rest;
        else blocks = split.rest;
      }
    }
    if (blocks?.length) {
      if (mode === 'merge') blocks = blocks.map((b) => ({ ...b, style: undefined, align: undefined, para: undefined, runs: b.runs.map(({ look: _look, ...r }) => r) }));
      if (this.tracking) {
        const change = makeChange('ins', this.tracking.author);
        blocks = blocks.map((b, i) => ({ ...b, runs: b.runs.map((r) => ({ ...r, change })), ...(i > 0 ? { brk: change } : {}) }));
        // Pasting over a selection marks it deleted first.
        if (!isCollapsed(this.state.selection)) this.dispatch(trackedDelete(this.state, 1, this.tracking.author));
      }
      this.dispatch(insertBlocks(this.state, blocks));
    } else {
      if (!text) return;
      this.reviseLook();
      if (this.tracking) this.dispatch(trackedInsertText(this.state, text, this.tracking.author));
      else this.dispatch(pasteLink(this.state, text) ?? insertText(this.state, text));
    }
    this.lastPaste = { what, depth, mode, titled };
    this.onPasted?.(!!(what.md || (what.html && this.htmlToBlocks)), titled);
  }

  /** Pastes what was last pasted again, another way (Word's Paste Options), or keeping its first line in the text (`title` false) rather than as the title. */
  pasteAgain(mode?: 'keep' | 'merge' | 'text', title = true): void {
    const last = this.lastPaste;
    if (!last) return;
    while (this.history.depth > last.depth && this.history.canUndo) this.undo();
    if (last.titled) this.pasteTitle?.giveBack();
    this.paste(last.what, mode ?? last.mode, title);
  }

  /** Word's Multilevel List: every level of the list styled at once (see setMultilevel). */
  setMultilevel(levels: ListLevel[]): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    this.dispatch(setMultilevel(this.state, levels), 'command');
  }

  /** Word's Sort: the selected paragraphs in order (see sortParagraphs). */
  sortParagraphs(by: SortBy = 'text', descending = false): void {
    if (this.isReadOnly) return;
    this.syncSelectionFromDom();
    this.dispatch(sortParagraphs(this.state, by, descending), 'command');
  }

  /** The selection as Markdown (with its formatting), or null when nothing is selected. */
  selectedMarkdown(): string | null {
    this.syncSelectionFromDom();
    const doc = sliceDoc(this.state);
    return doc ? toMarkdown(doc) : null;
  }

  /** Something was copied or cut (for the app's clipboard history). */
  onCopied: ((text: string, md: string) => void) | null = null;

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
    // Crumpet's own formatting goes too, for pasting back into Crumpet.
    const doc = sliceDoc(this.state);
    const md = doc ? toMarkdown(doc) : '';
    if (md) e.clipboardData?.setData(CRUMPET_TYPE, md);
    this.onCopied?.(text.replaceAll(FOOTNOTE, ''), md);
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
      lines.push(sliceRuns(b.runs, i === start ? from.offset : 0, i === end ? to.offset : len).map((r) => (r.field !== undefined ? (this.view.fieldValue?.(r.field) ?? fieldValue(r.field)) : r.text)).join(''));
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

/** How much an element is scaled on screen (page view's zoom), from its unturned frame. */
function zoomOf(el: HTMLElement): number {
  const frame = el.closest<HTMLElement>('.shape-wrap') ?? el;
  return frame.getBoundingClientRect().width / (frame.offsetWidth || 1) || 1;
}

/**
 * In a cell: when the line the caret is on so far is just "-" or "*", it
 * becomes "• " (a bullet), and true is returned.
 */
function bulletStart(cell: HTMLElement): boolean {
  const sel = cell.ownerDocument.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return false;
  const node = sel.anchorNode;
  if (!node || node.nodeType !== Node.TEXT_NODE || !cell.contains(node)) return false;
  const text = node.textContent ?? '';
  const at = sel.anchorOffset;
  const lineStart = text.lastIndexOf('\n', at - 1) + 1;
  // The line must start the text node too, after a line break or the cell's start.
  const before = text.slice(lineStart, at);
  if (before !== '-' && before !== '*') return false;
  if (lineStart === 0) {
    // What comes before must end a line: a line break, or text ending in one.
    const prev = node.previousSibling;
    if (prev && prev.nodeName !== 'BR' && !(prev.nodeType === Node.TEXT_NODE && (prev.textContent ?? '').endsWith('\n'))) return false;
  }
  const r = cell.ownerDocument.createRange();
  r.setStart(node, lineStart);
  r.setEnd(node, at);
  sel.removeAllRanges();
  sel.addRange(r);
  cell.ownerDocument.execCommand('insertText', false, '• ');
  return true;
}

/** The selection after one character was put at the start of block `id`: offsets in that block move on by one. */
function mapSelectionAfterInsert(sel: Selection, id: string): Selection {
  const move = (p: Pos) => (p.block === id ? { block: id, offset: p.offset + 1 } : p);
  return { anchor: move(sel.anchor), focus: move(sel.focus) };
}

/** A colour a good deal darker (the other end of a gradient). */
function darker(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * 0.6);
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A fingerprint of the document's words and kinds of paragraph (signature
 * lines left out), to tell whether it's changed since it was signed. Two
 * FNV-1a hashes side by side: a check against changes, not a seal against
 * forgery.
 */
export function docPrint(doc: Doc): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (const blk of doc.blocks) {
    if (blk.para?.sig || (blk.type === 'paragraph' && !blk.rows && !blk.runs.some((r) => r.text.trim()))) continue;
    const text = `${blk.type}|${blk.runs.filter((r) => r.change?.kind !== 'del').map((r) => r.text).join('')}|${(blk.rows ?? []).flat().join('\t')}\n`;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193) >>> 0;
      b = Math.imul(b ^ c, 0x01000193 + 2) >>> 0;
    }
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
