// What tables of contents list, worked out from the text alone: the
// headings (and paragraphs added to the contents), a table of figures'
// captions, and an index's entries. Drawn by the view; written to Word and
// e-books too.

import type { Block, Doc } from './model';

export interface TocEntry {
  id?: string;
  chapter?: string;
  level: number;
  text: string;
  page?: number;
  /** An index entry's places: page view fills in the pages of them all. */
  targets?: string[];
  /** A line with no place (a bibliography's). */
  plain?: boolean;
}

const runText = (b: Block) =>
  b.runs
    .filter((r) => r.change?.kind !== 'del' && r.footnote === undefined && r.field === undefined)
    .map((r) => r.text)
    .join('')
    .trim();

/**
 * The headings a table of contents lists (Heading 1 to 4; up to the levels
 * it's set to show), and paragraphs added to it (Word's Add Text); a heading
 * set to stay out is left out.
 */
export function tocEntries(doc: Doc, levels = 3): TocEntry[] {
  return doc.blocks
    .map((b) => {
      const level = b.para?.outline !== undefined ? b.para.outline : /^heading[1-4]$/.test(b.type) ? Number(b.type.slice(-1)) : 0;
      return { b, level };
    })
    .filter(({ b, level }) => level > 0 && level <= levels && b.runs.some((r) => r.text.trim() && r.change?.kind !== 'del'))
    .map(({ b, level }) => ({ id: b.id, level, text: runText(b) }));
}

/** A table of figures: each caption with `label` (its seq field), numbered as in the text. */
export function figureEntries(doc: Doc, label: string): TocEntry[] {
  const counters = new Map<string, number>();
  const out: TocEntry[] = [];
  for (const b of doc.blocks) {
    let text = '';
    let mine = false;
    for (const r of b.runs) {
      if (r.change?.kind === 'del' || r.footnote !== undefined) continue;
      if (r.field?.startsWith('seq:')) {
        const l = r.field.slice(4);
        const n = (counters.get(l) ?? 0) + 1;
        counters.set(l, n);
        if (l === label) mine = true;
        text += String(n);
      } else if (r.field === undefined) text += r.text;
    }
    if (mine) out.push({ id: b.id, level: 1, text: text.replace(/\s+/g, ' ').trim() });
  }
  return out;
}

/** An index: each term marked with an index entry, A to Z, with every place it's marked ("Term:Subterm" goes under Term). */
export function indexEntries(doc: Doc): TocEntry[] {
  const terms = new Map<string, string[]>();
  for (const b of doc.blocks)
    for (const r of b.runs)
      if (r.field?.startsWith('xe:') && r.change?.kind !== 'del') {
        const term = r.field.slice(3).trim();
        terms.set(term, [...new Set([...(terms.get(term) ?? []), b.id])]);
      }
  // Main terms mentioned only as "Main:Sub" still get a line of their own.
  for (const t of [...terms.keys()]) {
    const main = t.split(':')[0].trim();
    if (main !== t && !terms.has(main)) terms.set(main, []);
  }
  return [...terms.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }))
    .map(([term, ids]) => {
      const sub = term.includes(':');
      return { id: ids[0], targets: ids, level: sub ? 2 : 1, text: sub ? term.slice(term.indexOf(':') + 1).trim() : term };
    });
}

