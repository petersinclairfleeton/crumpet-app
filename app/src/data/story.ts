// Each chapter's story, as story editors (Fictionary, say) look at it: whose
// point of view it's told from, what that character wants in it, and how
// tense it is (1, calm, to 5, as tense as the book gets). Kept in the book's
// plan (`plan.chapters`). From them: how much of the book each point of view
// has, the tension across the book and its flat stretches, and what's not
// filled in yet.

import type { BookPlan, ChapterStory } from './plan';
import type { CastMember } from './types';

/** A chapter's story details (empty when none are set). */
export function storyOf(plan: BookPlan | undefined, chapterId: string): ChapterStory {
  return plan?.chapters?.find((c) => c.id === chapterId) ?? { id: chapterId };
}

/** The plan with one chapter's details changed (a chapter with none left is taken out). */
export function withStory(plan: BookPlan | undefined, chapterId: string, patch: Partial<Omit<ChapterStory, 'id'>>): BookPlan {
  const list = plan?.chapters ?? [];
  const next: ChapterStory = { ...storyOf(plan, chapterId), ...patch };
  for (const k of ['pov', 'aim', 'tension'] as const) if (next[k] === undefined || next[k] === '' || next[k] === 0) delete next[k];
  const empty = Object.keys(next).length === 1;
  const others = list.filter((c) => c.id !== chapterId);
  const at = list.findIndex((c) => c.id === chapterId);
  const chapters = empty ? others : at < 0 ? [...list, next] : list.map((c) => (c.id === chapterId ? next : c));
  return { ...plan, chapters: chapters.length ? chapters : undefined };
}

/** How much of the book each point of view has: its chapters and words, the most first; chapters with none last. */
export function povShare(chapters: { id: string; words: number }[], plan: BookPlan | undefined, cast: CastMember[]): { id: string | null; name: string; chapters: number; words: number; share: number }[] {
  const total = chapters.reduce((n, c) => n + c.words, 0);
  const by = new Map<string | null, { chapters: number; words: number }>();
  for (const c of chapters) {
    const pov = storyOf(plan, c.id).pov ?? null;
    const id = pov && cast.some((m) => m.id === pov) ? pov : null;
    const x = by.get(id) ?? { chapters: 0, words: 0 };
    by.set(id, { chapters: x.chapters + 1, words: x.words + c.words });
  }
  return [...by.entries()]
    .map(([id, x]) => ({ id, name: id ? cast.find((m) => m.id === id)!.name || 'Unnamed' : 'No point of view yet', ...x, share: total ? x.words / total : x.chapters / chapters.length }))
    .sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : b.words - a.words || b.chapters - a.chapters));
}

/** Stretches of `min` or more chapters in a row whose tension stays at `low` or below (chapter numbers, from 1). */
export function flatStretches(tension: (number | undefined)[], low = 2, min = 3): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  let start = -1;
  tension.forEach((t, i) => {
    const flat = t !== undefined && t <= low;
    if (flat && start < 0) start = i;
    if ((!flat || i === tension.length - 1) && start >= 0) {
      const end = flat ? i : i - 1;
      if (end - start + 1 >= min) out.push({ from: start + 1, to: end + 1 });
      start = -1;
    }
  });
  return out;
}

/** What's not filled in yet: chapters with no point of view, and with no goal for it. */
export function storyGaps(chapters: { id: string; number: number }[], plan: BookPlan | undefined): { noPov: number[]; noAim: number[] } {
  const noPov: number[] = [];
  const noAim: number[] = [];
  for (const c of chapters) {
    const s = storyOf(plan, c.id);
    if (!s.pov) noPov.push(c.number);
    if (!s.aim?.trim()) noAim.push(c.number);
  }
  return { noPov, noAim };
}

/** "3", "3 and 5", "3, 5 and 8": chapter numbers in words. */
export function numberList(n: number[]): string {
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

/** A point of view's colour: always the same for the same character. */
export const POV_COLORS = ['#c0703a', '#4f7cac', '#6f9a5b', '#a35d8f', '#c79a2b', '#4d9a9a', '#8a6fbf', '#b5544f'];
export function povColor(cast: CastMember[], id: string | undefined): string | undefined {
  if (!id) return undefined;
  const people = cast.filter((m) => m.kind === 'character');
  const i = people.findIndex((m) => m.id === id);
  return i < 0 ? undefined : POV_COLORS[i % POV_COLORS.length];
}
