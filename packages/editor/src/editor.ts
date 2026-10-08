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
} from './model';
import { type Op, applyOps, attrsOf, blockAttrs } from './ops';
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
} from './commands';
import { History } from './history';
import { type FindOptions, type Match, findMatches, replaceMatches } from './find';
import { View, readTable } from './view';
import { noteLink } from './markdown';
import { type PageGeometry, Paginator } from './paginate';
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
    this.paged = !!geometry;
    this.paginator.set(geometry);
    this.emit(null);
  }

  /** How many pages the text fills in page view. */
  get pages(): number {
    return this.paginator.pages;
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
      const before = `${this.paginator.pages}|${JSON.stringify(this.paginator.pageNotes)}`;
      this.paginator.update();
      if (`${this.paginator.pages}|${JSON.stringify(this.paginator.pageNotes)}` !== before) this.emit(null);
    }
  }

  /** Draws the document, then (in page view) its pages. Never during IME composition, which must not be disturbed. */
  private draw(doc: Doc, force?: Set<string>): void {
    this.view.render(doc, force);
    if (this.paged && !this.isComposing) this.paginator.update();
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
    root.addEventListener('paste', (e) => (inWidget(e.target) ? pastePlain(e) : this.onPaste(e)), { signal });
    root.addEventListener('cut', (e) => inWidget(e.target) || this.onCut(e), { signal });
    root.addEventListener('copy', (e) => inWidget(e.target) || this.onCopy(e), { signal });
    root.addEventListener('focusout', (e) => inWidget(e.target) && this.commitTables(), { signal });
    root.addEventListener('drop', (e) => this.onDrop(e), { signal });
    root.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('Files') && this.onFiles) e.preventDefault();
    }, { signal });
    root.addEventListener('mousedown', (e) => this.onMouseDown(e), { signal });
    root.ownerDocument.addEventListener('selectionchange', () => this.onSelectionChange(), { signal });
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
    if (!el || !this.state.doc.blocks.some((b) => b.id === id)) return;
    this.dispatch(setTableRows(this.state, id, readTable(el)), 'input', true, true);
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

  /** Changes a table's shape (adding or removing rows and columns) from the cell at r, c. */
  private reshapeTable(id: string, action: string, r: number, c: number): void {
    this.commitTable(id);
    const el = this.view.blockElement(id);
    if (!el) return;
    const rows = readTable(el);
    const width = rows[0]?.length ?? 1;
    let next = rows;
    let at = { r, c };
    if (action === 'row') {
      next = [...rows.slice(0, r + 1), Array(width).fill(''), ...rows.slice(r + 1)];
      at = { r: r + 1, c };
    } else if (action === 'col') {
      next = rows.map((row) => [...row.slice(0, c + 1), '', ...row.slice(c + 1)]);
      at = { r, c: c + 1 };
    } else if (action === 'del-row' && rows.length > 1) {
      next = rows.filter((_, i) => i !== r);
      at = { r: Math.max(0, Math.min(r, next.length - 1)), c };
    } else if (action === 'del-col' && width > 1) {
      next = rows.map((row) => row.filter((_, i) => i !== c));
      at = { r, c: Math.max(0, Math.min(c, width - 2)) };
    } else if (action === 'delete' || (action === 'del-col' && width === 1)) {
      // The table goes; an empty line takes its place.
      const blk = this.state.doc.blocks.find((b) => b.id === id)!;
      this.dispatch({ ops: [{ type: 'setAttrs', block: id, from: attrsOf(blk), to: blockAttrs('paragraph') }], selectionBefore: this.state.selection, selectionAfter: caret({ block: id, offset: 0 }) }, 'command');
      this.focus();
      return;
    } else return;
    this.dispatch(setTableRows(this.state, id, next), 'command', true, true);
    this.focusCell(id, at.r, at.c);
  }

  /** Tab and Enter move between cells (adding a row at the end); Esc leaves the table. */
  private onTableKey(e: KeyboardEvent): void {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.cell');
    const id = cell?.closest<HTMLElement>('[data-block]')?.dataset.block;
    if (!cell || !id || e.isComposing) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const el = this.view.blockElement(id)!;
    const rows = el.querySelector('table')!.rows.length;
    const cols = el.querySelector('table')!.rows[0].cells.length;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.commitTables();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const i = r * cols + c + (e.shiftKey ? -1 : 1);
      if (i < 0) return;
      if (i >= rows * cols) return this.reshapeTable(id, 'row', r, 0);
      this.commitTable(id);
      this.focusCell(id, Math.floor(i / cols), i % cols);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (r + 1 >= rows) return this.reshapeTable(id, 'row', r, c);
      this.commitTable(id);
      this.focusCell(id, r + 1, c);
    } else if (e.key === 'Escape' || (e.key === 'ArrowDown' && r === rows - 1) || (e.key === 'ArrowUp' && r === 0)) {
      e.preventDefault();
      this.commitTable(id);
      // Out of the table: to the line after it (or before it, going up).
      const i = this.state.doc.blocks.findIndex((b) => b.id === id);
      const to = this.state.doc.blocks[e.key === 'ArrowUp' ? i - 1 : i + 1];
      if (to) {
        this.state = { ...this.state, selection: caret({ block: to.id, offset: e.key === 'ArrowUp' ? runsLength(to.runs) : 0 }) };
        this.focus();
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

  toggleMark(mark: Mark): void {
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
    this.syncSelectionFromDom();
    this.dispatch(setLook(this.state, key, value), 'command');
  }

  /** One part of the look at the caret or across the selection; undefined when mixed or unset. */
  lookValue<K extends LookKey>(key: K): Look[K] | undefined {
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
    this.syncSelectionFromDom();
    this.dispatch(clearFormatting(this.state), 'command');
  }

  changeCase(how: CaseChange): void {
    this.syncSelectionFromDom();
    this.dispatch(changeCase(this.state, how), 'command');
  }

  isMarkActive(mark: Mark): boolean {
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
    this.focus();
    this.emit(null);
  }

  focus(): void {
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
    queueMicrotask(() => this.readBackFromDom(new Set([comp.block])));
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
    const action = (e.target as Element).closest?.<HTMLElement>('[data-table-action]');
    if (action) {
      e.preventDefault();
      const id = action.closest<HTMLElement>('[data-block]')!.dataset.block!;
      const cell = this.view.root.ownerDocument.activeElement as HTMLElement | null;
      const inThis = cell?.classList.contains('cell') && action.closest('[data-block]')!.contains(cell);
      const r = inThis ? Number(cell!.dataset.r) : -1;
      const c = inThis ? Number(cell!.dataset.c) : -1;
      const el = this.view.blockElement(id)!;
      const rows = el.querySelector('table')!.rows.length;
      const cols = el.querySelector('table')!.rows[0].cells.length;
      // Without a cell to work from: add at the end, remove the last.
      this.reshapeTable(id, action.dataset.tableAction!, r >= 0 ? r : rows - 1, c >= 0 ? c : cols - 1);
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

  private onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    this.syncSelectionFromDom();
    const files = Array.from(e.clipboardData?.files ?? []);
    if (files.length && this.onFiles && !this.isReadOnly) {
      this.onFiles(files);
      return;
    }
    // Formatted text (from a web page, Word, Google Docs): kept with its headings, lists and formatting.
    const html = e.clipboardData?.getData('text/html');
    if (html && this.htmlToBlocks && !this.isReadOnly) {
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

/** Paste in a table cell: plain text only, on one line. */
function pastePlain(e: ClipboardEvent): void {
  e.preventDefault();
  const text = (e.clipboardData?.getData('text/plain') ?? '').replace(/\s*[\r\n]+\s*/g, ' ');
  e.target && (e.target as HTMLElement).ownerDocument.execCommand('insertText', false, text);
}
