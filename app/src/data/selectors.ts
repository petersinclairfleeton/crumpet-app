// Things the UI derives from the state: what the list shows, search, date
// groups, previews, counts and the sidebar tree.

import { runsText } from '@crumpet/editor/model';
import { type AppState, visibleIn } from './store';
import type { Note, Notebook, View } from './types';

/** Plain text of a note's body, one line per block. */
export function noteText(note: Note): string {
  return note.doc.blocks.map((b) => runsText(b.runs)).join('\n');
}

export function preview(note: Note, max = 160): string {
  // Join blocks into one line; list items and other lines without their own punctuation get a separator.
  const parts = note.doc.blocks.map((b) => runsText(b.runs).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const text = parts.reduce((acc, p) => (!acc ? p : /[.!?:;…,]$/.test(acc) ? `${acc} ${p}` : `${acc} · ${p}`), '');
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function displayTitle(note: Note): string {
  return note.title.trim() || 'Untitled';
}

export function wordCount(note: Note): number {
  const text = `${note.title} ${noteText(note)}`;
  return (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** Every search word must appear in the title, body, tags or notebook name (any order, any case). */
export function matches(note: Note, query: string, notebookName = ''): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${note.title}\n${noteText(note)}\n${note.tags.map((t) => '#' + t).join(' ')}\n${notebookName}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** The notes the list shows: the current view, or, while searching, matching notes from every notebook. */
export function listedNotes(state: AppState): Note[] {
  if (!state.query.trim()) return visibleIn(state, state.view);
  const names = new Map(state.notebooks.map((n) => [n.id, n.name]));
  return visibleIn(state, { kind: 'all' }).filter((n) => matches(n, state.query, names.get(n.notebookId)));
}

/** Notebooks and stacks whose names match the search, to jump straight to. */
export function matchingNotebooks(state: AppState): Notebook[] {
  const words = state.query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return state.notebooks.filter((nb) => words.every((w) => nb.name.toLowerCase().includes(w) || (nb.stack ?? '').toLowerCase().includes(w))).slice(0, 5);
}

export interface Group {
  label: string;
  notes: Note[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Groups notes (already sorted newest first) into Today, Yesterday, This week, then months. */
export function groupByDate(notes: Note[], now: number, key: (n: Note) => number = (n) => n.updatedAt): Group[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const startToday = today.getTime();
  const startYesterday = startToday - 86_400_000;
  const startWeek = startToday - 6 * 86_400_000;
  const groups: Group[] = [];
  for (const n of notes) {
    const t = key(n);
    const d = new Date(t);
    const label =
      t >= startToday ? 'Today'
      : t >= startYesterday ? 'Yesterday'
      : t >= startWeek ? 'This week'
      : d.getFullYear() === today.getFullYear() ? MONTHS[d.getMonth()]
      : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.notes.push(n);
    else groups.push({ label, notes: [n] });
  }
  return groups;
}

/** Short time for a list row: "09:41" today, "Mon" this week, "28 Sep" this year, else "28 Sep 2025". */
export function shortTime(t: number, now: number): string {
  const d = new Date(t);
  const n = new Date(now);
  const sameDay = d.toDateString() === n.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (now - t < 6 * 86_400_000) return d.toLocaleDateString([], { weekday: 'short' });
  if (d.getFullYear() === n.getFullYear()) return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export function longTime(t: number): string {
  return new Date(t).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export interface Stack {
  name: string;
  notebooks: Notebook[];
}

/** Sidebar tree: notebooks outside stacks first (Inbox at the top), then stacks, all by name. */
export function notebookTree(notebooks: Notebook[]): { loose: Notebook[]; stacks: Stack[] } {
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  const loose = notebooks.filter((n) => !n.stack).sort(byName);
  const map = new Map<string, Notebook[]>();
  for (const nb of notebooks) if (nb.stack) map.set(nb.stack, [...(map.get(nb.stack) ?? []), nb]);
  const stacks = [...map.entries()].map(([name, nbs]) => ({ name, notebooks: nbs.sort(byName) })).sort(byName);
  return { loose, stacks };
}

export function noteCounts(notes: Note[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const n of notes) if (n.trashedAt === null) m.set(n.notebookId, (m.get(n.notebookId) ?? 0) + 1);
  return m;
}

export function allTags(notes: Note[]): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  for (const n of notes) if (n.trashedAt === null) for (const t of n.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}

export function recentNotes(notes: Note[], n = 3): Note[] {
  return notes.filter((x) => x.trashedAt === null).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, n);
}

export function viewTitle(view: View, notebooks: Notebook[]): string {
  switch (view.kind) {
    case 'all':
      return 'All Notes';
    case 'shortcuts':
      return 'Shortcuts';
    case 'trash':
      return 'Trash';
    case 'tag':
      return `#${view.tag}`;
    case 'stack':
      return view.name;
    case 'notebook':
      return notebooks.find((n) => n.id === view.id)?.name ?? 'Notebook';
  }
}

export function sameView(a: View, b: View): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'notebook' && b.kind === 'notebook') return a.id === b.id;
  if (a.kind === 'stack' && b.kind === 'stack') return a.name === b.name;
  if (a.kind === 'tag' && b.kind === 'tag') return a.tag === b.tag;
  return true;
}
