// Chapter keywords, like Scrivener's: short labels (a point of view, a plot
// thread, a place) shown as coloured chips, and a filter that gathers the
// chapters with one into a working set.

import type { Chapter } from './types';

const COLORS = ['#c0504d', '#d4a257', '#4f81bd', '#9bbb59', '#8064a2', '#4bacc6', '#f79646', '#2c8c6a', '#b65d9a', '#7f7f7f'];

/** A keyword's colour: always the same for the same word. */
export function keywordColor(word: string): string {
  let h = 0;
  for (const ch of word.toLowerCase()) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return COLORS[h % COLORS.length];
}

/** Every keyword used in a project's chapters, A to Z. */
export function projectKeywords(chapters: Chapter[], projectId: string): string[] {
  const all = new Map<string, string>();
  for (const c of chapters) if (c.projectId === projectId) for (const k of c.keywords ?? []) if (!all.has(k.toLowerCase())) all.set(k.toLowerCase(), k);
  return [...all.values()].sort((a, b) => a.localeCompare(b));
}

export function hasKeyword(c: Chapter, word: string | null): boolean {
  return !word || (c.keywords ?? []).some((k) => k.toLowerCase() === word.toLowerCase());
}

/** Keywords tidied: trimmed, no repeats (ignoring case). */
export function tidyKeywords(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of list.map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean)) {
    if (seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    out.push(k);
  }
  return out;
}
