// Find and replace. Matches are found in the plain text of each paragraph
// (tables, pictures and files are left alone, as is text already deleted
// with track changes). Replacing builds ordinary ops, so it undoes and syncs
// like any other edit.

import { type Doc, type Run, FOOTNOTE, getBlock, isMedia, sliceRuns } from './model';
import { type EditorState, type Transaction, trackedInsertText } from './commands';
import { type Op, applyOp } from './ops';

export interface FindOptions {
  matchCase?: boolean;
  wholeWord?: boolean;
}

export interface Match {
  block: string;
  from: number;
  to: number;
}

const WORD_CHAR = /[\p{L}\p{N}_'’]/u;

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every place `query` appears, in document order. */
export function findMatches(doc: Doc, query: string, opts: FindOptions = {}): Match[] {
  if (!query) return [];
  const re = new RegExp(escape(query), opts.matchCase ? 'gu' : 'giu');
  const out: Match[] = [];
  for (const block of doc.blocks) {
    if (isMedia(block.type)) continue;
    const text = block.runs.map((r) => r.text).join('');
    // Characters in text deleted with track changes can't be part of a match.
    const deleted = new Uint8Array(text.length);
    let at = 0;
    for (const r of block.runs) {
      if (r.change?.kind === 'del') deleted.fill(1, at, at + r.text.length);
      at += r.text.length;
    }
    for (const m of text.matchAll(re)) {
      const from = m.index!;
      const to = from + m[0].length;
      // Skip text already deleted with track changes, and matches running over a footnote's number.
      if (deleted.subarray(from, to).some((x) => x) || m[0].includes(FOOTNOTE)) continue;
      if (opts.wholeWord && ((from > 0 && WORD_CHAR.test(text[from - 1])) || (to < text.length && WORD_CHAR.test(text[to])))) continue;
      out.push({ block: block.id, from, to });
    }
  }
  return out;
}

/** The replacement keeps the formatting (and link or comment) of the first character it replaces. */
function replacementRun(runs: Run[], from: number, text: string): Run {
  const first = sliceRuns(runs, from, from + 1)[0];
  const run: Run = { text, marks: first ? [...first.marks] : [] };
  if (first?.link) run.link = first.link;
  if (first?.comment) run.comment = first.comment;
  if (first?.change && first.change.kind === 'ins') run.change = first.change;
  return run;
}

/**
 * Replaces the given matches with `text`, as one step to undo. With an
 * author (track changes on), the old text is marked deleted and the new text
 * added, as if typed.
 */
export function replaceMatches(state: EditorState, matches: Match[], text: string, author: string | null = null): Transaction | null {
  if (!matches.length) return null;
  // From the end backwards, so earlier offsets stay valid.
  const sorted = [...matches].sort((a, b) => {
    const ia = state.doc.blocks.findIndex((x) => x.id === a.block);
    const ib = state.doc.blocks.findIndex((x) => x.id === b.block);
    return ib - ia || b.from - a.from;
  });
  let doc = state.doc;
  const ops: Op[] = [];
  let end = { block: sorted[sorted.length - 1].block, offset: sorted[sorted.length - 1].from + text.length };
  for (const m of sorted) {
    if (author) {
      const t = trackedInsertText({ doc, selection: { anchor: { block: m.block, offset: m.from }, focus: { block: m.block, offset: m.to } }, storedMarks: null }, text, author);
      for (const op of t.ops) {
        doc = applyOp(doc, op);
        ops.push(op);
      }
      // The last one done is the first in the document: the caret ends after it.
      end = t.selectionAfter.focus;
      continue;
    }
    const runs = getBlock(doc, m.block).runs;
    const step = (op: Op) => {
      doc = applyOp(doc, op);
      ops.push(op);
    };
    const ins = replacementRun(runs, m.from, text);
    step({ type: 'remove', block: m.block, offset: m.from, runs: sliceRuns(runs, m.from, m.to) });
    if (text) step({ type: 'insert', block: m.block, offset: m.from, runs: [ins] });
  }
  // The caret ends after the first replacement in the document.
  return { ops, selectionBefore: state.selection, selectionAfter: { anchor: end, focus: end }, kind: 'other' };
}
