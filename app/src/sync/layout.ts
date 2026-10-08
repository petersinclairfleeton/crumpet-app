// Where everything lives as files:
//
//   Stack/Notebook/Note title.md     a note in a notebook in a stack
//   Notebook/Note title.md           a notebook that isn't in a stack
//   Note title.md                    a note that isn't in a notebook
//   .trash/Note title.md             the Trash
//   .crumpet/vault.json              ids and colours of stacks and notebooks
//   Projects/Book/project.json       a project: name, goal, order of parts and chapters
//   Projects/Book/01 Opening.md      its chapters, numbered in order
//   Projects/Book/Research/Map.md    notes kept as research for it
//
// Names are made safe for every file system, and kept unique within a folder
// ignoring case (macOS and Windows don't tell "Ideas" and "ideas" apart).
// Anything that already has a fitting place keeps it, so a sync never shuffles
// files around for no reason.

import type { Tree } from './tree';

export const TRASH = '.trash';
export const META_DIR = '.crumpet';
export const META_FILE = `${META_DIR}/vault.json`;
export const PROJECTS = 'Projects';
/** Pictures and other files attached to notes. */
export const ATTACHMENTS = 'Attachments';
export const PROJECT_FILE = 'project.json';
/** A project's research notes, in a folder inside the project's. */
export const RESEARCH = 'Research';

export interface Layout {
  stacks: Record<string, string>;
  notebooks: Record<string, string>;
  notes: Record<string, string>;
  /** Project folders. */
  projects: Record<string, string>;
  chapters: Record<string, string>;
}

export function emptyLayout(): Layout {
  return { stacks: {}, notebooks: {}, notes: {}, projects: {}, chapters: {} };
}

/** A layout saved by an earlier version, with every part present. */
export function fullLayout(l: Partial<Layout> | undefined): Layout {
  return { ...emptyLayout(), ...(l ?? {}) };
}

const MAX_NAME = 100;

/** A file or folder name that works everywhere. */
export function safeName(name: string): string {
  let s = name
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '');
  if ([...s].length > MAX_NAME) s = [...s].slice(0, MAX_NAME).join('').trim();
  // Names Windows reserves for devices.
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s = `${s}-`;
  return s || 'Untitled';
}

export function parentOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function join(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

/** True if `name` is `base`, or `base` with a number added to tell it apart ("Ideas 2"). */
export function fitsName(name: string, base: string): boolean {
  if (name.toLowerCase() === base.toLowerCase()) return true;
  const m = /^(.*) (\d+)$/.exec(name);
  return !!m && m[1].toLowerCase() === base.toLowerCase() && Number(m[2]) >= 2;
}

/**
 * Lays the tree out as files. `prev` is where things are now: anything whose
 * current place still fits keeps it.
 */
export function layout(tree: Tree, prev: Layout): Layout {
  const taken = new Map<string, Set<string>>();
  const take = (dir: string, name: string) => {
    let set = taken.get(dir);
    if (!set) taken.set(dir, (set = new Set(dir ? [TRASH, META_DIR] : [TRASH, META_DIR, ATTACHMENTS.toLowerCase()])));
    if (set.has(name.toLowerCase())) return false;
    set.add(name.toLowerCase());
    return true;
  };
  const place = <T extends { id: string; created: number }>(items: T[], dirOf: (x: T) => string, base: (x: T) => string, ext: string, prevPaths: Record<string, string>) => {
    const out: Record<string, string> = {};
    // Things already in a fitting place first, then the rest oldest first.
    const keeps = items.filter((x) => {
      const p = prevPaths[x.id];
      return p !== undefined && parentOf(p) === dirOf(x) && p.endsWith(ext) && fitsName(baseName(p).slice(0, baseName(p).length - ext.length), base(x));
    });
    for (const x of keeps.sort((a, b) => (prevPaths[a.id] < prevPaths[b.id] ? -1 : 1))) {
      const name = baseName(prevPaths[x.id]);
      if (take(dirOf(x), name)) out[x.id] = prevPaths[x.id];
    }
    for (const x of [...items].sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1))) {
      if (out[x.id] !== undefined) continue;
      const dir = dirOf(x);
      let name = base(x);
      for (let n = 2; !take(dir, `${name}${ext}`); n++) name = `${base(x)} ${n}`;
      out[x.id] = join(dir, `${name}${ext}`);
    }
    return out;
  };

  const stacks = place(Object.values(tree.stacks), () => '', (s) => safeName(s.name), '', prev.stacks);
  const notebooks = place(Object.values(tree.notebooks), (nb) => (nb.stackId ? (stacks[nb.stackId] ?? '') : ''), (nb) => safeName(nb.name), '', prev.notebooks);
  const projects = place(Object.values(tree.projects), () => PROJECTS, (p) => safeName(p.name), '', prev.projects ?? {});
  const notes = place(
    Object.values(tree.notes),
    (n) => (n.trashed !== null ? TRASH : n.projectId && projects[n.projectId] ? join(projects[n.projectId], RESEARCH) : n.notebookId ? (notebooks[n.notebookId] ?? '') : ''),
    (n) => safeName(n.title || 'Untitled'),
    '.md',
    prev.notes,
  );
  // Chapters are numbered in outline order, so they sort the same way anywhere.
  const chapters: Record<string, string> = {};
  for (const p of Object.values(tree.projects)) {
    const ids = chapterOrder(tree, p.id);
    const width = Math.max(2, String(ids.length).length);
    ids.forEach((id, i) => {
      const c = tree.chapters[id];
      chapters[id] = join(projects[p.id], `${String(i + 1).padStart(width, '0')} ${safeName(c.title || 'Untitled')}.md`);
    });
  }
  return { stacks, notebooks, notes, projects, chapters };
}

/** A project's chapter ids in outline order (any missing from the outline last). */
export function chapterOrder(tree: Tree, projectId: string): string[] {
  const project = tree.projects[projectId];
  const ids = (project?.outline ?? []).filter((x) => x.type === 'chapter' && tree.chapters[x.id]?.projectId === projectId).map((x) => x.id);
  const seen = new Set(ids);
  for (const c of Object.values(tree.chapters)) if (c.projectId === projectId && !seen.has(c.id)) ids.push(c.id);
  return ids;
}
