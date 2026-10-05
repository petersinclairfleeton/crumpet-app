// Undo/redo that survives other devices' edits.
//
// Every change to the note, from anywhere, is appended to a timeline of steps.
// An undo entry remembers the note as it was right after the edit and where
// it sat on the timeline. To undo it, its inverse is rebased over every step
// that came after it (other devices' edits included), using the same
// machinery as sync, so it removes your words from where they are now and
// leaves everyone else's edits alone.
//
// Consecutive typing in the same place within a short window merges into one
// undo step, as in most editors.

import { type Doc, type Selection, docsEqual } from './model';
import { type Op, applyOps, compressOps, invertOps } from './ops';
import type { Transaction } from './commands';
import { type Step, mapSelectionThrough, rebaseSteps, stepsOf, taggedSteps } from './sync/transform';

interface Entry {
  /** The edit, as it applied at the time. */
  ops: Op[];
  /** The note right after the edit. */
  docAfter: Doc;
  /** Timeline length right after the edit. */
  at: number;
  selectionBefore: Selection;
  selectionAfter: Selection;
  kind: Transaction['kind'];
  time: number;
  /** Ties an edit to its undo and redo, so positions inside text that is removed and restored survive. */
  tag: string;
  /** 0 for the edit itself, then +1 for each undo or redo of it. */
  generation: number;
}

const MERGE_MS = 800;
const MAX_ENTRIES = 200;
let undoTag = 0;

export class History {
  private undoStack: Entry[] = [];
  private redoStack: Entry[] = [];
  /** Every step applied to the note since the oldest entry still kept, in order. */
  private timeline: Step[] = [];
  private timelineStart = 0;

  /** Records a local edit that has just been applied, giving `docAfter`. */
  record(t: Transaction, docAfter: Doc, now = Date.now()): void {
    if (!t.ops.length) return;
    const atBefore = this.length;
    this.redoStack = [];
    const last = this.undoStack[this.undoStack.length - 1];
    const mergeable =
      last &&
      last.at === atBefore &&
      t.kind === last.kind &&
      (t.kind === 'typing' || t.kind === 'delete') &&
      now - last.time < MERGE_MS &&
      sameSelection(last.selectionAfter, t.selectionBefore);
    if (mergeable) {
      this.push(taggedSteps(t.ops, last.tag, last.generation));
      last.ops = compressOps([...last.ops, ...t.ops]);
      last.docAfter = docAfter;
      last.at = this.length;
      last.selectionAfter = t.selectionAfter;
      last.time = now;
    } else {
      const tag = `h${++undoTag}`;
      this.push(taggedSteps(t.ops, tag, 0));
      this.undoStack.push({ ops: t.ops, docAfter, at: this.length, selectionBefore: t.selectionBefore, selectionAfter: t.selectionAfter, kind: t.kind, time: now, tag, generation: 0 });
      if (this.undoStack.length > MAX_ENTRIES) this.undoStack.shift();
    }
    this.trim();
  }

  /** Records changes that came from somewhere else (another device). */
  external(steps: Step[]): void {
    if (!this.undoStack.length && !this.redoStack.length) return;
    this.push(steps);
  }

  /** Stops the current typing run from merging with what comes next. */
  breakMerge(): void {
    const last = this.undoStack[this.undoStack.length - 1];
    if (last) last.time = 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.timeline = [];
    this.timelineStart = 0;
  }

  undo(current: Doc): { ops: Op[]; selection: Selection } | null {
    const e = this.undoStack.pop();
    if (!e) return null;
    const step = this.replay(e, invertOps(e.ops), e.selectionBefore, current);
    this.redoStack.push(step.entry);
    return step.result;
  }

  redo(current: Doc): { ops: Op[]; selection: Selection } | null {
    const e = this.redoStack.pop();
    if (!e) return null;
    const step = this.replay(e, invertOps(e.ops), e.selectionBefore, current);
    step.entry.time = 0;
    this.undoStack.push(step.entry);
    return step.result;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private get length(): number {
    return this.timelineStart + this.timeline.length;
  }

  private push(steps: Step[]): void {
    this.timeline.push(...steps);
  }

  private since(at: number): Step[] {
    return this.timeline.slice(at - this.timelineStart);
  }

  /**
   * Applies `ops` (made on `e.docAfter`) to the current note by rebasing them
   * over everything since, and returns the opposite entry for the other stack.
   */
  private replay(e: Entry, ops: Op[], selection: Selection, current: Doc) {
    const later = this.since(e.at);
    // If the note is exactly as this entry left it (nothing from elsewhere is still in effect),
    // the ops apply as they are, which is exact. Otherwise rebase them over what happened since.
    const exact = docsEqual(current, e.docAfter);
    const result = exact ? ops : rebaseSteps(e.docAfter, ops, later).local;
    const tag = e.tag;
    const generation = e.generation + 1;
    this.push(taggedSteps(result, tag, generation));
    const docAfter = applyOps(current, result);
    const moved = exact ? [] : later;
    const mappedSelection = exact ? selection : mapSelectionThrough(selection, [...moved, ...stepsOf(result)], docAfter);
    const opposite: Entry = {
      ops: result,
      docAfter,
      at: this.length,
      selectionBefore: exact ? e.selectionAfter : mapSelectionThrough(e.selectionAfter, [...moved, ...stepsOf(result)], docAfter),
      selectionAfter: mappedSelection,
      kind: e.kind,
      time: 0,
      tag,
      generation,
    };
    return { entry: opposite, result: { ops: result, selection: mappedSelection } };
  }

  /** Drops timeline steps that no entry can need any more. */
  private trim(): void {
    const all = [...this.undoStack, ...this.redoStack];
    if (!all.length) {
      this.timelineStart = this.length;
      this.timeline = [];
      return;
    }
    const oldest = Math.min(...all.map((e) => e.at));
    if (oldest - this.timelineStart > 500) {
      this.timeline = this.since(oldest);
      this.timelineStart = oldest;
    }
  }
}

function sameSelection(a: Selection, b: Selection): boolean {
  return a.anchor.block === b.anchor.block && a.anchor.offset === b.anchor.offset && a.focus.block === b.focus.block && a.focus.offset === b.focus.offset;
}
