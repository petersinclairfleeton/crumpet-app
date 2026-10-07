// The vault as plain data, the same shape whichever side it comes from: this
// device's notes, the files in the cloud, or the last version both agreed on.
// Sync works by merging three trees, so everything here is simple values that
// compare and store easily. Note bodies are Markdown.

import { toMarkdown } from '@crumpet/editor/markdown';
import type { AppState } from '../data/store';
import type { ChapterStatus, OutlineItem } from '../data/types';

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
  created: number;
  updated: number;
  trashed: number | null;
  /** Markdown. */
  body: string;
  /** Front matter Crumpet doesn't use, kept as written. */
  extra: string;
}

export interface TProject {
  id: string;
  name: string;
  goal: number | null;
  outline: OutlineItem[];
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
  created: number;
  updated: number;
  /** Markdown. */
  body: string;
}

export interface Tree {
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
export function localTree(state: Pick<AppState, 'stacks' | 'notebooks' | 'notes'> & Partial<Pick<AppState, 'projects' | 'chapters'>>): Tree {
  const tree = emptyTree();
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
      created: n.createdAt,
      updated: n.updatedAt,
      trashed: n.trashedAt,
      body: toMarkdown(n.doc),
      extra: n.extra ?? '',
    };
  }
  for (const p of state.projects ?? []) tree.projects[p.id] = { id: p.id, name: p.name, goal: p.goal, outline: p.outline, created: p.createdAt, updated: p.updatedAt };
  for (const c of state.chapters ?? []) {
    if (!tree.projects[c.projectId]) continue;
    tree.chapters[c.id] = { id: c.id, projectId: c.projectId, title: c.title, status: c.status, synopsis: c.synopsis, goal: c.goal, created: c.createdAt, updated: c.updatedAt, body: toMarkdown(c.doc) };
  }
  return tree;
}

export function sameOutline(a: OutlineItem[], b: OutlineItem[]): boolean {
  return a.length === b.length && a.every((x, i) => x.type === b[i].type && x.id === b[i].id && (x.type !== 'part' || x.title === (b[i] as typeof x).title));
}

export function sameProject(a: TProject | undefined, b: TProject | undefined): boolean {
  return a === b || (!!a && !!b && a.name === b.name && a.goal === b.goal && a.created === b.created && a.updated === b.updated && sameOutline(a.outline, b.outline));
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
      a.created === b.created &&
      a.updated === b.updated &&
      a.trashed === b.trashed &&
      a.body === b.body &&
      a.extra === b.extra)
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
