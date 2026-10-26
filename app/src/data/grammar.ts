// Grammar checking with Harper (writewithharper.com), an open-source grammar
// checker that runs on this device: the text never leaves it. Its engine
// (WebAssembly, about 8 MB to download) is fetched the first time a check
// runs, then kept for working offline. This file turns a document into the
// text Harper reads and its findings back into places in the document.

import type { Doc } from '@crumpet/editor/model';

/** The paragraphs Harper reads: ordinary text, headings, lists and quotes (not code, tables, contents or pictures). */
const CHECKED = new Set(['paragraph', 'heading1', 'heading2', 'heading3', 'heading4', 'todo', 'bullet', 'numbered', 'quote']);

/** A place in the document: a block and an offset in its text. */
export interface Place {
  block: string;
  offset: number;
}

/**
 * The document's words as one text, a blank line between paragraphs, with where each character came from.
 * Deleted tracked text, fields and footnote marks are left out (the words around them are kept apart by a space).
 */
export function grammarText(doc: Doc): { text: string; places: (Place | null)[] } {
  let text = '';
  const places: (Place | null)[] = [];
  for (const b of doc.blocks) {
    if (!CHECKED.has(b.type) || b.style === 'scenebreak') continue;
    if (text) {
      text += '\n\n';
      places.push(null, null);
    }
    let at = 0;
    for (const r of b.runs) {
      const skip = r.change?.kind === 'del' || r.field !== undefined || r.footnote !== undefined;
      if (skip) {
        if (r.field !== undefined && !/\s$/.test(text) && text) {
          text += ' ';
          places.push(null);
        }
      } else {
        for (let i = 0; i < r.text.length; i++) {
          text += r.text[i];
          places.push({ block: b.id, offset: at + i });
        }
      }
      at += r.text.length;
    }
  }
  return { text, places };
}

/** What Harper found: where (in characters, as Harper counts them: whole letters, not UTF-16 halves), and what to do. */
export interface GrammarLint {
  start: number;
  end: number;
  message: string;
  /** Its kind, as Harper names it (Agreement, Punctuation, Repetition…). */
  kind: string;
  /** The rule that found it (for turning it off). */
  rule: string;
  suggestions: { kind: 'replace' | 'remove' | 'insert'; text: string }[];
}

/** A finding in the document: its words, what's wrong, and fixes to choose from. */
export interface GrammarIssue {
  block: string;
  from: number;
  to: number;
  /** The words it's about. */
  text: string;
  message: string;
  kind: string;
  rule: string;
  fixes: { label: string; from: number; to: number; text: string }[];
}

/** Harper's kinds put plainly. */
export const KIND_NAMES: Record<string, string> = {
  Agreement: 'Agreement',
  BoundaryError: 'Word boundary',
  Capitalization: 'Capital letters',
  Eggcorn: 'Mixed-up phrase',
  Enhancement: 'Better word',
  Formatting: 'Formatting',
  Grammar: 'Grammar',
  Malapropism: 'Wrong word',
  Miscellaneous: 'Grammar',
  Nonstandard: 'Nonstandard',
  Punctuation: 'Punctuation',
  Readability: 'Readability',
  Redundancy: 'Saying it twice',
  Regionalism: 'Regional word',
  Repetition: 'Repeated word',
  Spelling: 'Spelling',
  Style: 'Style',
  Typo: 'Typo',
  Usage: 'Usage',
  WordChoice: 'Word choice',
  WordOrder: 'Word order',
};

/** Harper's spelling findings are left to the spelling check (and its dictionary of names). */
export const SKIPPED_KINDS = new Set(['Spelling']);

/** UTF-16 positions of each whole character (as Harper counts), plus the end. */
function charStarts(text: string): number[] {
  const out: number[] = [];
  let i = 0;
  for (const ch of text) {
    out.push(i);
    i += ch.length;
  }
  out.push(i);
  return out;
}

/** Harper's findings as places in the document: those that run across paragraphs (or are spelling) are left out. */
export function grammarIssues(source: { text: string; places: (Place | null)[] }, lints: GrammarLint[], off: string[] = []): GrammarIssue[] {
  const starts = charStarts(source.text);
  const out: GrammarIssue[] = [];
  for (const l of lints) {
    if (SKIPPED_KINDS.has(l.kind) || off.includes(l.rule)) continue;
    const a = starts[l.start];
    const z = starts[l.end];
    if (a === undefined || z === undefined || z < a) continue;
    const first = source.places[a];
    const last = z > a ? source.places[z - 1] : first;
    if (!first || !last || first.block !== last.block) continue;
    const from = first.offset;
    const to = z > a ? last.offset + 1 : from;
    const fixes = l.suggestions.slice(0, 4).map((s) => {
      if (s.kind === 'remove') return { label: 'Remove it', from, to, text: '' };
      if (s.kind === 'insert') return { label: `Add “${s.text.trim() || s.text}”`, from: to, to, text: s.text };
      return { label: s.text, from, to, text: s.text };
    });
    out.push({ block: first.block, from, to, text: source.text.slice(a, z), message: l.message, kind: l.kind, rule: l.rule, fixes });
  }
  return out;
}

/** A finding's key, for leaving it out once ignored (the same words with the same complaint). */
export function issueKey(i: Pick<GrammarIssue, 'block' | 'text' | 'rule'>): string {
  return `${i.block}:${i.rule}:${i.text}`;
}
