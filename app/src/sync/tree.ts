// The vault as plain data, the same shape whichever side it comes from: this
// device's notes, the files in the cloud, or the last version both agreed on.
// Sync works by merging three trees, so everything here is simple values that
// compare and store easily. Note bodies are Markdown.

import { encodeReminder } from '../data/reminders';
import { toMarkdown } from '@crumpet/editor/markdown';
import type { AppState } from '../data/store';
import type { CastMember, ChapterStatus, Deadline, OutlineItem } from '../data/types';
import type { PageSetup, StyleSheet } from '../data/styles';

export interface TStack {
  id: string;
  name: string;
  created: number;
}

export interface TNotebook {
  id: string;
  name: string;
  color: string;
  stackId: string | null;
  created: number;
}

export interface TNote {
  id: string;
  title: string;
  notebookId: string | null;
  tags: string[];
  favorite: boolean;
  /** A reminder, as one string ("ISO date", " done" once dealt with). */
  reminder?: string;
  created: number;
  updated: number;
  trashed: number | null;
  /** Markdown. */
  body: string;
  /** Front matter Crumpet doesn't use, kept as written. */
  extra: string;
  /** Research for this project. */
  projectId?: string | null;
}

export interface TProject {
  id: string;
  name: string;
  goal: number | null;
  outline: OutlineItem[];
  /** Named styles and page setup (absent: the defaults). */
  styles?: StyleSheet;
  page?: PageSetup;
  cast?: CastMember[];
  deadline?: Deadline;
  created: number;
  updated: number;
}

export interface TChapter {
  id: string;
  projectId: string;
  title: string;
  status: ChapterStatus;
  synopsis: string;
  goal: number | null;
  /** Only when there are some. */
  keywords?: string[];
  created: number;
  updated: number;
  /** Markdown. */
  body: string;
}

/** Settings shared by every device: how notes look on the page. */
export interface TSettings {
  noteStyles?: StyleSheet;
  notePage?: PageSetup;
  /** When they last changed. */
  updated: number;
}

export interface Tree {
  /** Absent: the defaults. */
  settings?: TSettings;
  stacks: Record<string, TStack>;
  notebooks: Record<string, TNotebook>;
  notes: Record<string, TNote>;
  projects: Record<string, TProject>;
  chapters: Record<string, TChapter>;
}

export function emptyTree(): Tree {
  return { stacks: {}, notebooks: {}, notes: {}, projects: {}, chapters: {} };
}

/** A tree saved by an earlier version, with every part present. */
export function fullTree(t: Partial<Tree> | undefined): Tree {
  return { ...emptyTree(), ...(t ?? {}) };
}

/** This device's notes as a tree. */
export function localTree(state: Pick<AppState, 'stacks' | 'notebooks' | 'notes'> & Partial<Pick<AppState, 'projects' | 'chapters' | 'settings'>>): Tree {
  const tree = emptyTree();
  const st = state.settings;
  if (st && (st.noteStyles || st.notePage)) tree.settings = { ...(st.noteStyles ? { noteStyles: st.noteStyles } : {}), ...(st.notePage ? { notePage: st.notePage } : {}), updated: st.sharedAt ?? 0 };
  for (const s of state.stacks) tree.stacks[s.id] = { id: s.id, name: s.name, created: s.createdAt };
  for (const nb of state.notebooks) {
    tree.notebooks[nb.id] = { id: nb.id, name: nb.name, color: nb.color, stackId: nb.stackId && tree.stacks[nb.stackId] ? nb.stackId : null, created: nb.createdAt };
  }
  for (const n of state.notes) {
    tree.notes[n.id] = {
      id: n.id,
      title: n.title,
      // A note whose notebook was deleted (it's in the Trash) isn't in any notebook.
      notebookId: n.notebookId && tree.notebooks[n.notebookId] ? n.notebookId : null,
      tags: n.tags,
      favorite: n.favorite,
      ...(n.reminder ? { reminder: encodeReminder(n.reminder) } : {}),
      created: n.createdAt,
      updated: n.updatedAt,
      trashed: n.trashedAt,
      body: toMarkdown(n.doc),
      extra: n.extra ?? '',
      ...(n.projectId && (state.projects ?? []).some((p) => p.id === n.projectId) ? { projectId: n.projectId } : {}),
    };
  }
  for (const p of state.projects ?? []) {
    tree.projects[p.id] = { id: p.id, name: p.name, goal: p.goal, outline: p.outline, created: p.createdAt, updated: p.updatedAt, ...(p.styles ? { styles: p.styles } : {}), ...(p.page ? { page: p.page } : {}), ...(p.cast?.length ? { cast: p.cast } : {}), ...(p.deadline ? { deadline: p.deadline } : {}) };
  }
  for (const c of state.chapters ?? []) {
    if (!tree.projects[c.projectId]) continue;
    tree.chapters[c.id] = { id: c.id, projectId: c.projectId, title: c.title, status: c.status, synopsis: c.synopsis, goal: c.goal, ...(c.keywords?.length ? { keywords: c.keywords } : {}), created: c.createdAt, updated: c.updatedAt, body: toMarkdown(c.doc) };
  }
  return tree;
}

export function sameOutline(a: OutlineItem[], b: OutlineItem[]): boolean {
  return a.length === b.length && a.every((x, i) => x.type === b[i].type && x.id === b[i].id && (x.type !== 'part' || x.title === (b[i] as typeof x).title));
}

export function sameProject(a: TProject | undefined, b: TProject | undefined): boolean {
  return (
    a === b ||
    (!!a && !!b && a.name === b.name && a.goal === b.goal && a.created === b.created && a.updated === b.updated && sameOutline(a.outline, b.outline) && sameJson(a.styles, b.styles) && sameJson(a.page, b.page) && sameJson(a.cast, b.cast) && sameJson(a.deadline, b.deadline))
  );
}

/** Same value, for plain data like style sheets. */
export function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function sameChapter(a: TChapter | undefined, b: TChapter | undefined): boolean {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.projectId === b.projectId &&
      a.title === b.title &&
      a.status === b.status &&
      a.synopsis === b.synopsis &&
      a.goal === b.goal &&
      sameTags(a.keywords ?? [], b.keywords ?? []) &&
      a.created === b.created &&
      a.updated === b.updated &&
      a.body === b.body)
  );
}

export function sameStack(a: TStack | undefined, b: TStack | undefined): boolean {
  return a === b || (!!a && !!b && a.name === b.name && a.created === b.created);
}

export function sameNotebook(a: TNotebook | undefined, b: TNotebook | undefined): boolean {
  return a === b || (!!a && !!b && a.name === b.name && a.color === b.color && a.stackId === b.stackId && a.created === b.created);
}

export function sameNote(a: TNote | undefined, b: TNote | undefined): boolean {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.title === b.title &&
      a.notebookId === b.notebookId &&
      sameTags(a.tags, b.tags) &&
      a.favorite === b.favorite &&
      (a.reminder ?? null) === (b.reminder ?? null) &&
      a.created === b.created &&
      a.updated === b.updated &&
      a.trashed === b.trashed &&
      a.body === b.body &&
      a.extra === b.extra &&
      (a.projectId ?? null) === (b.projectId ?? null))
  );
}

export function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

/** A short id derived from a string, so two devices discovering the same new folder agree on its id. */
export function hashId(prefix: string, s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return `${prefix}-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}
