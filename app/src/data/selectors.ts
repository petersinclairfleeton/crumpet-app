// Things the UI derives from the state: what the list shows, search, date
// groups, previews, counts and the sidebar tree.

import { matchesFilters, parseQuery } from './search';
import { comments, footnotes, runsText } from '@crumpet/editor/model';
import { type AppState, visibleIn } from './store';
import type { Doc } from '@crumpet/editor/model';
import type { Chapter, Note, Notebook, OutlineItem, Project, Stack, View } from './types';
import { boardOf, boardPreview, boardText, isBoard } from './board';
import { cellPlain } from '@crumpet/editor/cells';

/** A block's plain text; a table's cells are its text. */
export function blockText(b: Doc['blocks'][number]): string {
  if (b.type === 'table') return (b.rows ?? []).map((r) => r.map(cellPlain).join(' ')).join('\n');
  // Footnote markers and deleted text (tracked changes) aren't part of the text.
  return b.runs.some((r) => r.footnote !== undefined || r.change?.kind === 'del') ? runsText(b.runs.filter((r) => r.footnote === undefined && r.change?.kind !== 'del')) : runsText(b.runs);
}

/** Plain text of a note's body, one line per block; with `files`, the words in its PDFs and pictures too. */
export function noteText(note: Note, files?: Record<string, string>): string {
  if (isBoard(note)) return boardText(boardOf(note));
  // Footnotes and comments are searched too, after the text.
  const remarks = comments(note.doc).flatMap(({ comment: c }) => [c.text, ...(c.replies ?? []).map((r) => r.text)]);
  const inFiles = files ? note.doc.blocks.flatMap((b) => (b.src && files[b.src] ? [files[b.src]] : [])) : [];
  return [...note.doc.blocks.map(blockText), ...footnotes(note.doc).map((f) => f.text), ...remarks, ...inFiles].join('\n');
}

export function preview(note: Note, max = 160): string {
  if (isBoard(note)) {
    const p = boardPreview(boardOf(note));
    return p.length > max ? `${p.slice(0, max - 1).trimEnd()}…` : p;
  }
  // Join blocks into one line; list items and other lines without their own punctuation get a separator.
  // A table reads row by row, its cells joined by dashes.
  const line = (b: Doc['blocks'][number]) => (b.type === 'table' ? (b.rows ?? []).map((r) => r.map((c) => cellPlain(c).trim()).filter(Boolean).join(' – ')).filter(Boolean).join(' · ') : blockText(b));
  const parts = note.doc.blocks.map((b) => line(b).replace(/\s+/g, ' ').trim()).filter(Boolean);
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
  const { filters } = parseQuery(state.query);
  const stacks = new Map(state.stacks.map((s) => [s.id, s.name]));
  const books = new Map(state.notebooks.map((n) => [n.id, n]));
  return visibleIn(state, { kind: 'all' }, true).filter((n) => {
    const nb = books.get(n.notebookId ?? '');
    const places = nb ? [nb.name, stacks.get(nb.stackId ?? '') ?? ''] : [];
    return matchesFilters(n, filters, `${n.title}\n${noteText(n, state.fileText)}\n${n.tags.map((t) => '#' + t).join(' ')}\n${nb?.name ?? ''}`, places);
  });
}

/** Notebooks whose name, or whose stack's name, matches the search, to jump straight to. */
export function matchingNotebooks(state: AppState): Notebook[] {
  const words = parseQuery(state.query).filters.words;
  if (!words.length) return [];
  const stackName = new Map(state.stacks.map((s) => [s.id, s.name.toLowerCase()]));
  return state.notebooks
    .filter((nb) => words.every((w) => nb.name.toLowerCase().includes(w) || (stackName.get(nb.stackId ?? '') ?? '').includes(w)))
    .slice(0, 5);
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
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (now - t < 6 * 86_400_000) return d.toLocaleDateString([], { weekday: 'short' });
  if (d.getFullYear() === n.getFullYear()) return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export function longTime(t: number): string {
  return new Date(t).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export interface StackNode {
  stack: Stack;
  notebooks: Notebook[];
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

/** Sidebar tree: notebooks outside stacks, then every stack (empty ones too) with its notebooks, all by name. */
export function notebookTree(stacks: Stack[], notebooks: Notebook[]): { loose: Notebook[]; stacks: StackNode[] } {
  const ids = new Set(stacks.map((s) => s.id));
  const loose = notebooks.filter((n) => !n.stackId || !ids.has(n.stackId)).sort(byName);
  const nodes = [...stacks].sort(byName).map((stack) => ({ stack, notebooks: notebooks.filter((n) => n.stackId === stack.id).sort(byName) }));
  return { loose, stacks: nodes };
}

export function noteCounts(notes: Note[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const n of notes) if (n.trashedAt === null && n.notebookId) m.set(n.notebookId, (m.get(n.notebookId) ?? 0) + 1);
  return m;
}

export function allTags(notes: Note[]): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  for (const n of notes) if (n.trashedAt === null) for (const t of n.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}

export interface TagNode {
  /** The last part of the tag ("characters"), and the whole of it ("book/characters"). */
  name: string;
  path: string;
  /** Notes with this tag or one nested inside it. */
  count: number;
  children: TagNode[];
}

/** Tags as a tree: "book/characters" sits inside "book" (which shows even if no note has just "book"). */
export function tagTree(notes: Note[]): TagNode[] {
  const roots: TagNode[] = [];
  const nodes = new Map<string, TagNode>();
  const notesUnder = new Map<string, Set<string>>();
  for (const n of notes) {
    if (n.trashedAt !== null) continue;
    for (const t of n.tags) {
      const parts = t.split('/').filter(Boolean);
      for (let i = 1; i <= parts.length; i++) {
        const path = parts.slice(0, i).join('/');
        if (!nodes.has(path)) {
          const node: TagNode = { name: parts[i - 1], path, count: 0, children: [] };
          nodes.set(path, node);
          (i === 1 ? roots : nodes.get(parts.slice(0, i - 1).join('/'))!.children).push(node);
        }
        let set = notesUnder.get(path);
        if (!set) notesUnder.set(path, (set = new Set()));
        set.add(n.id);
      }
    }
  }
  for (const [path, set] of notesUnder) nodes.get(path)!.count = set.size;
  const sort = (list: TagNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    for (const x of list) sort(x.children);
  };
  sort(roots);
  return roots;
}

export function recentNotes(notes: Note[], n = 3): Note[] {
  return notes.filter((x) => x.trashedAt === null && !x.projectId).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, n);
}

export function viewTitle(view: View, state: Pick<AppState, 'notebooks' | 'stacks' | 'projects'>): string {
  switch (view.kind) {
    case 'all':
      return 'All Notes';
    case 'favorites':
      return 'Favorites';
    case 'trash':
      return 'Trash';
    case 'tag':
      return `#${view.tag}`;
    case 'stack':
      return state.stacks.find((s) => s.id === view.id)?.name ?? 'Stack';
    case 'notebook':
      return state.notebooks.find((n) => n.id === view.id)?.name ?? 'Notebook';
    case 'project':
      return state.projects.find((p) => p.id === view.id)?.name ?? 'Project';
  }
}

export function sameView(a: View, b: View): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'notebook' && b.kind === 'notebook') return a.id === b.id;
  if (a.kind === 'stack' && b.kind === 'stack') return a.id === b.id;
  if (a.kind === 'tag' && b.kind === 'tag') return a.tag === b.tag;
  if (a.kind === 'project' && b.kind === 'project') return a.id === b.id;
  return true;
}

// ---- projects

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function docWords(doc: Doc): number {
  return doc.blocks.reduce((n, b) => n + (blockText(b).match(WORD) ?? []).length, 0);
}

export function chapterWords(c: Chapter): number {
  return docWords(c.doc);
}

/** The project's chapters in outline order, each with the part it's in. */
export function projectChapters(project: Project, chapters: Chapter[]): { chapter: Chapter; part: Extract<OutlineItem, { type: 'part' }> | null; number: number }[] {
  const byId = new Map(chapters.filter((c) => c.projectId === project.id).map((c) => [c.id, c]));
  const out: { chapter: Chapter; part: Extract<OutlineItem, { type: 'part' }> | null; number: number }[] = [];
  let part: Extract<OutlineItem, { type: 'part' }> | null = null;
  for (const item of project.outline) {
    if (item.type === 'part') part = item;
    else {
      const chapter = byId.get(item.id);
      if (chapter) out.push({ chapter, part, number: out.length + 1 });
    }
  }
  return out;
}

export function projectWords(project: Project, chapters: Chapter[]): number {
  return chapters.filter((c) => c.projectId === project.id).reduce((n, c) => n + chapterWords(c), 0);
}

/** Total of the chapters' goals when the project has none of its own. */
export function projectGoal(project: Project, chapters: Chapter[]): number | null {
  if (project.goal) return project.goal;
  const goals = chapters.filter((c) => c.projectId === project.id && c.goal).map((c) => c.goal!);
  return goals.length ? goals.reduce((a, b) => a + b, 0) : null;
}

/** A piece of a search snippet; `hit` marks a searched-for word. */
export interface SnippetPart {
  text: string;
  hit: boolean;
}

/**
 * A short stretch of text around the first searched-for word, split so the
 * words can be highlighted. Null when none of the words is in the text.
 */
export function snippet(text: string, words: string[], max = 150): SnippetPart[] | null {
  const flat = text.replace(/\s+/g, ' ').trim();
  const lower = flat.toLowerCase();
  const found = words.filter(Boolean).map((w) => lower.indexOf(w.toLowerCase())).filter((i) => i >= 0);
  if (!found.length) return null;
  const first = Math.min(...found);
  // Start a little before the word, at a word boundary.
  let start = max === Infinity ? 0 : Math.max(0, first - 40);
  if (start > 0) start = flat.indexOf(' ', start) + 1 || start;
  const end = Math.min(flat.length, start + max);
  const piece = `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
  const escaped = words.filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return piece
    .split(new RegExp(`(${escaped.join('|')})`, 'gi'))
    .filter(Boolean)
    .map((t) => ({ text: t, hit: escaped.length > 0 && words.some((w) => w.toLowerCase() === t.toLowerCase()) }));
}

/** A chapter's searchable text: its title, synopsis and writing. */
export function chapterText(c: Chapter, withTitle = true): string {
  return [...(withTitle ? [c.title] : []), c.synopsis, ...c.doc.blocks.map(blockText)].join('\n');
}

/** Chapters whose text has every searched-for word, for a plain word search (filters only apply to notes). */
export function matchingChapters(state: Pick<AppState, 'query' | 'projects' | 'chapters'>): { chapter: Chapter; project: Project }[] {
  const { filters: f } = parseQuery(state.query);
  if (!f.words.length || f.tags.length || f.places.length || f.favorite || f.has.length || f.after !== undefined || f.before !== undefined) return [];
  const out: { chapter: Chapter; project: Project }[] = [];
  for (const project of state.projects) {
    for (const { chapter } of projectChapters(project, state.chapters)) {
      const hay = chapterText(chapter).toLowerCase();
      if (f.words.every((w) => hay.includes(w))) out.push({ chapter, project });
    }
  }
  return out;
}
