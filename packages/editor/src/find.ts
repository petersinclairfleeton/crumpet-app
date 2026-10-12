// Find and replace. Matches are found in the plain text of each paragraph
// (tables, pictures and files are left alone, as is text already deleted
// with track changes). Replacing builds ordinary ops, so it undoes and syncs
// like any other edit.

import { type Block, type Doc, type Mark, type Run, FOOTNOTE, getBlock, isMedia, sliceRuns } from './model';
import { type EditorState, type Transaction, trackedInsertText } from './commands';
import { type Op, applyOp } from './ops';

export interface FindOptions {
  matchCase?: boolean;
  wholeWord?: boolean;
  /** Word's wildcards: ? one character, * any run of them, [abc] [a-z] [!abc], @ one or more, {n,m}, < > word starts and ends, ( ) groups. */
  wildcards?: boolean;
  /** Only text with this formatting (with no words to find: every stretch of text with it). */
  format?: FindFormat;
}

/** Formatting to find: marks the text must have, highlighted or coloured, in paragraphs that pass `block`. */
export interface FindFormat {
  marks?: Mark[];
  highlight?: boolean;
  color?: boolean;
  /** Paragraphs to look in (a paragraph style, say). */
  block?: (b: Block) => boolean;
  /** Text to look for, run by run (text formatted just so). */
  run?: (r: Run) => boolean;
}

export interface Match {
  block: string;
  from: number;
  to: number;
  /** The wildcard groups ( ) caught, for \1… in the replacement. */
  groups?: string[];
}

/** Word's special characters (^t a tab, ^l a line break, ^? any character, ^# a digit, ^$ a letter, ^w white space, ^s a no-break space, ^+ an em dash, ^= an en dash, ^~ a no-break hyphen, ^- a soft hyphen, ^f a footnote, ^^ a caret) as a pattern. */
function special(c: string): string | null {
  const map: Record<string, string> = { t: '\\t', l: '\\n', '?': '.', '#': '\\p{N}', $: '\\p{L}', w: '[ \\t\\u00a0]+', s: '\\u00a0', '+': '\u2014', '=': '\u2013', '~': '\u2011', '-': '\u00ad', f: FOOTNOTE, e: FOOTNOTE, '^': '\\^' };
  return map[c] ?? null;
}

/** What to look for, as a regular expression's source. */
export function findPattern(query: string, opts: FindOptions = {}): string {
  let out = '';
  for (let i = 0; i < query.length; i++) {
    const c = query[i];
    if (c === '^' && i + 1 < query.length) {
      const sp = special(query[i + 1]);
      if (sp !== null) {
        out += sp;
        i++;
        continue;
      }
    }
    if (!opts.wildcards) {
      out += escape(c);
      continue;
    }
    if (c === '\\' && i + 1 < query.length) {
      out += escape(query[++i]);
    } else if (c === '?') out += '.';
    else if (c === '*') out += '[^]*?';
    else if (c === '@') out += '+';
    else if (c === '<') out += '(?<![\\p{L}\\p{N}_])';
    else if (c === '>') out += '(?![\\p{L}\\p{N}_])';
    else if (c === '(' || c === ')') out += c;
    else if (c === '{') {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(query.slice(i));
      if (m) {
        out += m[0];
        i += m[0].length - 1;
      } else out += '\\{';
    } else if (c === '[') {
      const end = query.indexOf(']', i + 2);
      if (end < 0) out += '\\[';
      else {
        let set = query.slice(i + 1, end);
        const not = set.startsWith('!');
        if (not) set = set.slice(1);
        out += `[${not ? '^' : ''}${set.replace(/[\\\]^]/g, '\\$&')}]`;
        i = end;
      }
    } else out += escape(c);
  }
  return out;
}

/** Whether every character from `from` to `to` has the formatting looked for. */
function formatted(runs: Run[], from: number, to: number, f: FindFormat): boolean {
  let at = 0;
  for (const r of runs) {
    const end = at + r.text.length;
    if (end > from && at < to) {
      if (f.marks?.some((m) => !r.marks.includes(m))) return false;
      if (f.highlight && !r.look?.highlight) return false;
      if (f.color && !r.look?.color) return false;
      if (f.run && !f.run(r)) return false;
    }
    at = end;
    if (at >= to) break;
  }
  return true;
}

const anyFormat = (f: FindFormat | undefined) => !!f && (!!f.marks?.length || !!f.highlight || !!f.color || !!f.block || !!f.run);
const anyRunFormat = (f: FindFormat | undefined) => !!f && (!!f.marks?.length || !!f.highlight || !!f.color || !!f.run);

/** Text formatted exactly like `marks` and `look` (Word's Select Text with Similar Formatting). */
export function similarFormat(marks: Mark[], look: Run['look']): FindFormat {
  const want = JSON.stringify([[...marks].sort(), look ?? null]);
  return { run: (r) => !r.change || r.change.kind !== 'del' ? JSON.stringify([[...r.marks].sort(), r.look ?? null]) === want : false };
}

const WORD_CHAR = /[\p{L}\p{N}_'’]/u;

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every place `query` appears, in document order. */
export function findMatches(doc: Doc, query: string, opts: FindOptions = {}): Match[] {
  const f = opts.format;
  if (!query && !anyFormat(f)) return [];
  let re: RegExp;
  try {
    // With no words, formatting alone: each stretch of text (a run is cut where the formatting stops, below).
    re = new RegExp(query ? findPattern(query, opts) : `[^${FOOTNOTE}]+`, opts.matchCase ? 'gu' : 'giu');
  } catch {
    return [];
  }
  const wantFootnote = /\^[fe]/.test(query);
  const out: Match[] = [];
  for (const block of doc.blocks) {
    if (isMedia(block.type)) continue;
    if (f?.block && !f.block(block)) continue;
    const text = block.runs.map((r) => r.text).join('');
    // Characters in text deleted with track changes can't be part of a match.
    const deleted = new Uint8Array(text.length);
    let at = 0;
    for (const r of block.runs) {
      if (r.change?.kind === 'del') deleted.fill(1, at, at + r.text.length);
      at += r.text.length;
    }
    for (const m of text.matchAll(re)) {
      if (!m[0].length) continue;
      const from = m.index!;
      const to = from + m[0].length;
      // Skip text already deleted with track changes, and matches running over a footnote's number (unless looking for one).
      if (deleted.subarray(from, to).some((x) => x) || (!wantFootnote && m[0].includes(FOOTNOTE))) continue;
      if (opts.wholeWord && ((from > 0 && WORD_CHAR.test(text[from - 1])) || (to < text.length && WORD_CHAR.test(text[to])))) continue;
      if (!query && anyRunFormat(f)) {
        // Formatting alone: the stretches of this text that have it.
        let start = -1;
        for (let i = from; i <= to; i++) {
          const ok = i < to && formatted(block.runs, i, i + 1, f!);
          if (ok && start < 0) start = i;
          if (!ok && start >= 0) {
            if (text.slice(start, i).trim()) out.push({ block: block.id, from: start, to: i });
            start = -1;
          }
        }
        continue;
      }
      if (f && !formatted(block.runs, from, to, f)) continue;
      out.push({ block: block.id, from, to, ...(m.length > 1 ? { groups: m.slice(1).map((g) => g ?? '') } : {}) });
    }
  }
  return out;
}

/** The replacement for one match: ^& is what was found, \\1 to \\9 the wildcard groups, ^t a tab, ^l a line break, ^^ a caret. */
export function replacementText(template: string, found: string, m: Match): string {
  return template.replace(/\^&|\\([1-9])|\^([tl^sm+=~-])/g, (all, g: string | undefined, sp: string | undefined) => {
    if (all === '^&') return found;
    if (g) return m.groups?.[Number(g) - 1] ?? '';
    return ({ t: '\t', l: '\n', '^': '^', s: '\u00a0', '+': '\u2014', '=': '\u2013', '~': '\u2011', '-': '\u00ad', m: '' } as Record<string, string>)[sp!] ?? all;
  });
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
export function replaceMatches(state: EditorState, matches: Match[], template: string, author: string | null = null): Transaction | null {
  if (!matches.length) return null;
  // From the end backwards, so earlier offsets stay valid.
  const sorted = [...matches].sort((a, b) => {
    const ia = state.doc.blocks.findIndex((x) => x.id === a.block);
    const ib = state.doc.blocks.findIndex((x) => x.id === b.block);
    return ib - ia || b.from - a.from;
  });
  let doc = state.doc;
  const ops: Op[] = [];
  const textOf = (doc: Doc, m: Match) => replacementText(template, getBlock(doc, m.block).runs.map((r) => r.text).join('').slice(m.from, m.to), m);
  let end = { block: sorted[sorted.length - 1].block, offset: sorted[sorted.length - 1].from + textOf(state.doc, sorted[sorted.length - 1]).length };
  for (const m of sorted) {
    const text = textOf(doc, m);
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
