// The editor: owns the state, listens to the browser, and turns every input
// into a transaction. The browser's own editing is cancelled wherever we can
// (beforeinput); where we cannot (IME composition, some spellcheck and
// autocorrect paths), we let the DOM change and then read it back into the
// model as ordinary ops.

import {
  type Block,
  type BlockType,
  type Doc,
  type Mark,
  type Selection,
  caret,
  getBlock,
  isCollapsed,
  orderedRange,
  runsText,
  sliceRuns,
} from './model';
import { type Op, applyOps } from './ops';
import {
  type EditorState,
  type Transaction,
  deleteBetween,
  deleteChar,
  deleteSelection,
  insertText,
  joinBackward,
  joinForward,
  markActive,
  markdownShortcut,
  setBlockType,
  splitBlock,
  syncBlockText,
  toggleMark,
  toggleTodo,
} from './commands';
import { History } from './history';
import { View } from './view';

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

  constructor(root: HTMLElement, doc: Doc) {
    const first = doc.blocks[0];
    this.state = { doc, selection: caret({ block: first.id, offset: 0 }), storedMarks: null };
    this.view = new View(root);
    this.view.render(doc);

    root.addEventListener('beforeinput', (e) => this.onBeforeInput(e));
    root.addEventListener('input', () => this.onInput());
    root.addEventListener('keydown', (e) => this.onKeyDown(e));
    root.addEventListener('compositionstart', () => this.onCompositionStart());
    root.addEventListener('compositionend', () => this.onCompositionEnd());
    root.addEventListener('paste', (e) => this.onPaste(e));
    root.addEventListener('cut', (e) => this.onCut(e));
    root.addEventListener('copy', (e) => this.onCopy(e));
    root.addEventListener('drop', (e) => e.preventDefault());
    root.addEventListener('mousedown', (e) => this.onMouseDown(e));
    root.ownerDocument.addEventListener('selectionchange', () => this.onSelectionChange());
  }

  onChange(fn: Listener): void {
    this.listeners.push(fn);
  }

  // ---------- applying changes ----------

  dispatch(t: Transaction | null, source: ChangeEvent['source'] = 'input', record = true): void {
    if (!t) return;
    const doc = applyOps(this.state.doc, t.ops);
    this.state = {
      doc,
      selection: t.selectionAfter,
      storedMarks: t.storedMarks !== undefined ? t.storedMarks : t.ops.length ? null : this.state.storedMarks,
    };
    if (record) this.history.record(t);
    this.view.render(doc);
    this.view.writeSelection(this.state.selection);
    this.emit({ ops: t.ops, source });
  }

  private applyHistory(step: { ops: Op[]; selection: Selection } | null, source: 'undo' | 'redo'): void {
    if (!step) return;
    this.dispatch({ ops: step.ops, selectionBefore: this.state.selection, selectionAfter: step.selection }, source, false);
  }

  get isComposing(): boolean {
    return this.composing !== null;
  }

  /**
   * Shows a document that changed because of another device. The caret is moved
   * so it stays next to the same text. Undo history is cleared: undoing across
   * other people's edits is not solved in this prototype.
   */
  applyRemote(doc: Doc, mapSelection: (sel: Selection) => Selection): void {
    this.state = { doc, selection: mapSelection(this.state.selection), storedMarks: this.state.storedMarks };
    this.history.clear();
    this.view.render(doc);
    // Only touch the page selection if this editor has focus; otherwise we would steal it from wherever the person is.
    if (this.view.root.ownerDocument.activeElement === this.view.root) this.view.writeSelection(this.state.selection);
    this.emit({ ops: [], source: 'remote' });
  }

  /** Replaces the whole document (e.g. "reset sample"), clearing history. */
  load(doc: Doc): void {
    this.state = { doc, selection: caret({ block: doc.blocks[0].id, offset: 0 }), storedMarks: null };
    this.history.clear();
    this.view.render(doc, new Set(doc.blocks.map((b) => b.id)));
    this.view.writeSelection(this.state.selection);
    this.emit({ ops: [], source: 'command' });
  }

  undo(): void {
    this.applyHistory(this.history.undo(), 'undo');
  }

  redo(): void {
    this.applyHistory(this.history.redo(), 'redo');
  }

  toggleMark(mark: Mark): void {
    this.syncSelectionFromDom();
    this.dispatch(toggleMark(this.state, mark), 'command');
  }

  setBlockType(type: BlockType): void {
    this.syncSelectionFromDom();
    this.dispatch(setBlockType(this.state, type), 'command');
  }

  isMarkActive(mark: Mark): boolean {
    return markActive(this.state, mark);
  }

  currentBlock(): Block {
    return getBlock(this.state.doc, this.state.selection.focus.block);
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

    switch (e.inputType) {
      case 'insertText': {
        e.preventDefault();
        if (e.data == null) return;
        this.dispatch(insertText(s, e.data));
        if (e.data === ' ') this.dispatch(markdownShortcut(this.state));
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
      this.view.render(this.state.doc, new Set(this.state.doc.blocks.map((b) => b.id)));
      this.view.writeSelection(this.state.selection);
      return;
    }
    const domSel = this.view.readSelection();
    for (const block of this.state.doc.blocks) {
      const domText = this.view.blockText(block.id);
      if (domText == null) continue;
      if (domText === runsText(block.runs) && !force.has(block.id)) continue;
      const t = syncBlockText(this.state, block.id, domText, domSel ?? this.state.selection);
      if (t) {
        this.state = { ...this.state, doc: applyOps(this.state.doc, t.ops), selection: t.selectionAfter, storedMarks: null };
        this.history.record(t);
        this.emit({ ops: t.ops, source: 'native' });
      }
      force.add(block.id);
    }
    // Rebuild the blocks the browser touched so the DOM is exactly what we would have drawn.
    this.view.render(this.state.doc, force);
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

  private onKeyDown(e: KeyboardEvent): void {
    if (e.isComposing || e.keyCode === 229) return;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (e.key === 'Tab') {
      e.preventDefault();
      return;
    }
    if (!mod) return;
    const key = e.key.toLowerCase();
    let handled = true;
    if (key === 'z' && !e.shiftKey) this.undo();
    else if ((key === 'z' && e.shiftKey) || key === 'y') this.redo();
    else if (key === 'b') this.toggleMark('bold');
    else if (key === 'i') this.toggleMark('italic');
    else if (key === 'u') this.toggleMark('underline');
    else if (key === 'x' && e.shiftKey) this.toggleMark('strike');
    else if (key === 'e') this.toggleMark('code');
    else if (e.altKey && e.code === 'Digit1') this.setBlockType('heading1');
    else if (e.altKey && e.code === 'Digit2') this.setBlockType('heading2');
    else if (e.altKey && e.code === 'Digit0') this.setBlockType('paragraph');
    else if (e.altKey && e.code === 'KeyT') this.setBlockType('todo');
    else if (e.altKey && e.code === 'KeyQ') this.setBlockType('quote');
    else handled = false;
    if (handled) e.preventDefault();
  }

  private onMouseDown(e: MouseEvent): void {
    const box = (e.target as Element).closest?.('.check');
    if (!box) return;
    e.preventDefault();
    const id = box.closest<HTMLElement>('[data-block]')!.dataset.block!;
    this.dispatch(toggleTodo(this.state, id), 'command');
  }

  private onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    this.syncSelectionFromDom();
    const text = e.clipboardData?.getData('text/plain');
    if (text) this.dispatch(insertText(this.state, text));
  }

  private onCopy(e: ClipboardEvent): void {
    this.syncSelectionFromDom();
    const text = this.selectedText();
    if (text == null) return;
    e.preventDefault();
    e.clipboardData?.setData('text/plain', text);
  }

  private onCut(e: ClipboardEvent): void {
    this.onCopy(e);
    this.dispatch(deleteSelection(this.state));
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
