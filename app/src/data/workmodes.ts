// Parts of the app a person can switch off when their way of working doesn't
// need them, and work modes: ready-made sets of parts for a kind of work.
// Settings → Your workflow; the ⚙ menu switches mode. Nothing is deleted:
// a part switched off is only out of sight, and comes back as it was.

import type { Settings } from './types';

export const PARTS = [
  { id: 'today', label: 'Today and daily notes', hint: 'A note for each day, under Capture.' },
  { id: 'reminders', label: 'Reminders', hint: 'The bell on notes, and the Reminders list.' },
  { id: 'favourites', label: 'Favourites', hint: 'Starred notes, at the top of the sidebar.' },
  { id: 'graph', label: 'Graph of links', hint: 'The map of how notes link to each other.' },
  { id: 'distill', label: 'Distill', hint: 'Notebooks and stacks of your own thinking.' },
  { id: 'express', label: 'Books (Express)', hint: 'Books in chapters, with cards, a plan and characters.' },
  { id: 'submissions', label: 'Submissions', hint: 'Where your writing has been sent, and the replies.' },
  { id: 'tags', label: 'Tags', hint: 'The # at the foot of the sidebar.' },
  { id: 'boards', label: 'Boards', hint: 'Cards and arrows, from New → Board.' },
  { id: 'stats', label: 'Writing stats', hint: 'Words a day, streaks and goals, in the ⚙ menu.' },
] as const;

export type Part = (typeof PARTS)[number]['id'];

export const MODES: { id: string; label: string; hint: string; off: Part[] }[] = [
  { id: 'everything', label: 'Everything', hint: 'All of Crumpet.', off: [] },
  { id: 'notes', label: 'Notes', hint: 'Notes and notebooks to keep and find things. No books.', off: ['express', 'submissions', 'stats'] },
  { id: 'book', label: 'Writing a book', hint: 'Books first: chapters, cards, characters, submissions.', off: ['reminders', 'graph', 'distill', 'boards'] },
  { id: 'research', label: 'Research', hint: 'Gather, tag and connect: notebooks, tags, the graph and boards.', off: ['express', 'submissions', 'stats'] },
  { id: 'journal', label: 'Journal', hint: 'A page a day, with goals and streaks.', off: ['express', 'submissions', 'graph', 'distill', 'boards', 'reminders'] },
];

/** Whether a part of the app is on (everything is, unless switched off). */
export function partOn(settings: Pick<Settings, 'partsOff'>, part: Part): boolean {
  return !settings.partsOff?.includes(part);
}

/** The work mode the switches match, if any. */
export function currentMode(settings: Pick<Settings, 'partsOff' | 'workMode'>): string | null {
  const off = [...(settings.partsOff ?? [])].sort().join(',');
  const named = MODES.find((m) => m.id === settings.workMode);
  if (named && [...named.off].sort().join(',') === off) return named.id;
  return MODES.find((m) => [...m.off].sort().join(',') === off)?.id ?? null;
}

/** Settings for a work mode. */
export function modeSettings(id: string): Pick<Settings, 'partsOff' | 'workMode'> {
  const m = MODES.find((x) => x.id === id) ?? MODES[0];
  return { partsOff: m.off.length ? [...m.off] : undefined, workMode: m.id === 'everything' ? undefined : m.id };
}

/** Settings with one part switched on or off (the mode becomes your own mix). */
export function withPart(settings: Pick<Settings, 'partsOff'>, part: Part, on: boolean): Pick<Settings, 'partsOff' | 'workMode'> {
  const off = new Set(settings.partsOff ?? []);
  if (on) off.delete(part);
  else off.add(part);
  return { partsOff: off.size ? [...off] : undefined, workMode: undefined };
}
