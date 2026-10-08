// Spotting a book's characters and places in its text, by their names and
// nicknames, as whole words ("Mara" in "Mara's", not in "Marathon").

import type { Doc } from '@crumpet/editor/model';
import type { CastMember, Chapter } from './types';

export interface Mention {
  from: number;
  to: number;
  id: string;
}

export interface CastMatcher {
  re: RegExp;
  /** Who each name belongs to. */
  owner: Map<string, string>;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A matcher for the names and nicknames of `cast`, or null if there are none. */
export function castMatcher(cast: CastMember[] | undefined): CastMatcher | null {
  const owner = new Map<string, string>();
  for (const m of cast ?? []) {
    for (const n of [m.name, ...m.aliases]) {
      const name = n.trim();
      if (name.length >= 2 && !owner.has(name)) owner.set(name, m.id);
    }
  }
  if (!owner.size) return null;
  // Longest first, so "Old Tam" wins over "Tam".
  const names = [...owner.keys()].sort((a, b) => b.length - a.length).map(escapeRe);
  return { re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.join('|')})(?![\\p{L}\\p{N}])`, 'gu'), owner };
}

/** Where the cast is mentioned in some text. */
export function findMentions(text: string, matcher: CastMatcher | null): Mention[] {
  if (!matcher) return [];
  const out: Mention[] = [];
  matcher.re.lastIndex = 0;
  for (const m of text.matchAll(matcher.re)) out.push({ from: m.index!, to: m.index! + m[0].length, id: matcher.owner.get(m[0])! });
  return out;
}

function docText(doc: Doc): string {
  return doc.blocks.map((b) => b.runs.filter((r) => r.change?.kind !== 'del').map((r) => r.text).join('')).join('\n');
}

/** Each character's or place's chapters, with how often they're mentioned in each. */
export function appearances(cast: CastMember[] | undefined, chapters: Chapter[]): Map<string, { chapter: Chapter; count: number }[]> {
  const out = new Map<string, { chapter: Chapter; count: number }[]>();
  const matcher = castMatcher(cast);
  if (!matcher) return out;
  for (const c of chapters) {
    const counts = new Map<string, number>();
    for (const m of findMentions(docText(c.doc), matcher)) counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
    for (const [id, count] of counts) {
      const list = out.get(id) ?? [];
      list.push({ chapter: c, count });
      out.set(id, list);
    }
  }
  return out;
}
