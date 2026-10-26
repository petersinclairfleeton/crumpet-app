// A book's glossary: its invented words and terms (worldbuilding cards of the
// kind "Word or term"), each with what it means and how it's said. The
// spelling check passes over them, a near miss is offered the right spelling,
// and an exported book can end with them in alphabetical order.

import { type Block, type Doc, makeBlock, normalizeRuns } from '@crumpet/editor/model';
import type { CastMember } from './types';

export const PRONOUNCE = 'Pronunciation';
export const WORD_KIND = 'Kind of word';

const field = (m: CastMember, label: string) => m.fields?.find((f) => f.label === label)?.value.trim() ?? '';

/** The book's words and terms, in alphabetical order. */
export function glossaryTerms(cast: CastMember[]): CastMember[] {
  return cast.filter((m) => m.kind === 'term' && m.name.trim()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** How a term is said, as written on its card. */
export const pronunciation = (m: CastMember) => field(m, PRONOUNCE);

/** One entry: the term in bold, how it's said and what kind of word, then what it means. */
export function glossaryBlock(m: CastMember): Block {
  const said = pronunciation(m);
  const kind = field(m, WORD_KIND);
  const runs = [
    { text: m.name.trim(), marks: ['bold' as const] },
    ...(said ? [{ text: ` (${said})`, marks: [] }] : []),
    ...(kind ? [{ text: ` ${kind}`, marks: ['italic' as const] }] : []),
    ...(m.description.trim() ? [{ text: `${said || kind ? '.' : ':'} ${m.description.trim()}`, marks: [] }] : []),
  ];
  const b = makeBlock('paragraph');
  b.runs = normalizeRuns(runs);
  return b;
}

/** The glossary as a document of its own (to end a book with). */
export function glossaryDoc(cast: CastMember[]): Doc {
  return { blocks: glossaryTerms(cast).map(glossaryBlock) };
}

/** Optimal string alignment distance (a swap of two letters counts once), giving up past `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1);
      row.push(d);
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    rows.push(row);
  }
  return rows[a.length][b.length];
}

/**
 * The book's names and terms a word might be a misspelling of (one letter out, or two in a longer word), closest
 * first: "Elvaryn" → Elvarin. Each word of a name counts on its own, so "Ashfrod" finds Ashford in "Mara Ashford".
 */
export function nearNames(word: string, cast: CastMember[]): string[] {
  const w = word.toLowerCase();
  if (w.length < 4) return [];
  const max = w.length >= 7 ? 2 : 1;
  const found = new Map<string, number>();
  for (const m of cast) {
    for (const n of [m.name, ...m.aliases].flatMap((x) => x.split(/[\s.,;:!?()"“”]+/))) {
      if (n.length < 4 || !/\p{L}/u.test(n)) continue;
      const d = editDistance(w, n.toLowerCase(), max);
      if (d > 0 && d <= max) found.set(n, Math.min(d, found.get(n) ?? d));
    }
  }
  // Written as the word was: capitalised at the start of a sentence, say.
  const cased = (n: string) => (word[0] === word[0].toUpperCase() ? n[0].toUpperCase() + n.slice(1) : n);
  return [...found].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([n]) => cased(n)).filter((n, i, all) => all.indexOf(n) === i);
}
