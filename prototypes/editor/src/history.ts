// Undo/redo built from inverted operations. Consecutive typing in the same
// block within a short window merges into one undo step, as in most editors.

import type { Selection } from './model';
import { type Op, invertOps } from './ops';
import type { Transaction } from './commands';

interface Entry {
  ops: Op[];
  selectionBefore: Selection;
  selectionAfter: Selection;
  kind: Transaction['kind'];
  time: number;
}

const MERGE_MS = 800;

export class History {
  private undoStack: Entry[] = [];
  private redoStack: Entry[] = [];

  record(t: Transaction, now = Date.now()): void {
    if (!t.ops.length) return;
    this.redoStack = [];
    const last = this.undoStack[this.undoStack.length - 1];
    const mergeable =
      last &&
      t.kind === last.kind &&
      (t.kind === 'typing' || t.kind === 'delete') &&
      now - last.time < MERGE_MS &&
      sameSelection(last.selectionAfter, t.selectionBefore);
    if (mergeable) {
      last.ops = [...last.ops, ...t.ops];
      last.selectionAfter = t.selectionAfter;
      last.time = now;
    } else {
      this.undoStack.push({ ops: t.ops, selectionBefore: t.selectionBefore, selectionAfter: t.selectionAfter, kind: t.kind, time: now });
    }
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /** Stops the current typing run from merging with what comes next. */
  breakMerge(): void {
    const last = this.undoStack[this.undoStack.length - 1];
    if (last) last.time = 0;
  }

  undo(): { ops: Op[]; selection: Selection } | null {
    const e = this.undoStack.pop();
    if (!e) return null;
    this.redoStack.push(e);
    return { ops: invertOps(e.ops), selection: e.selectionBefore };
  }

  redo(): { ops: Op[]; selection: Selection } | null {
    const e = this.redoStack.pop();
    if (!e) return null;
    e.time = 0;
    this.undoStack.push(e);
    return { ops: e.ops, selection: e.selectionAfter };
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}

function sameSelection(a: Selection, b: Selection): boolean {
  return a.anchor.block === b.anchor.block && a.anchor.offset === b.anchor.offset && a.focus.block === b.focus.block && a.focus.offset === b.focus.offset;
}
