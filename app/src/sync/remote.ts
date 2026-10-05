// Reading the files back into a tree.
//
// Folders and files can be changed by anything (Finder, the Drive website,
// another Markdown app), so reading is forgiving:
// - Ids and colours of stacks and notebooks come from `.crumpet/vault.json`.
//   A folder it doesn't know is a new notebook, or a new stack if it holds
//   only folders. A known folder renamed elsewhere is recognised by the notes
//   inside it, so it keeps its id.
// - A note's id comes from its front matter, or, for files without one, from
//   the path it had last time.
// - A note file renamed elsewhere takes its new name as its title.

import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { NOTEBOOK_COLORS } from '../data/types';
import { type Layout, META_FILE, TRASH, baseName, emptyLayout, fitsName, parentOf, safeName } from './layout';
import { type NoteFile, parseNoteFile } from './notefile';
import type { Entry, Provider } from './provider';
import { type TNote, type Tree, emptyTree, hashId } from './tree';

export interface VaultMeta {
  version: 1;
  stacks: { id: string; name: string; folder: string; created: number }[];
  notebooks: { id: string; name: string; color: string; folder: string; created: number }[];
}

/** A note file as last read, by path. Bodies are already in Crumpet's own Markdown form. */
export type FileCache = Record<string, { rev: string; file: NoteFile }>;

export interface Snapshot {
  entries: Entry[];
  files: Record<string, { rev: string; modified: number; file: NoteFile }>;
  meta: VaultMeta | null;
  metaText: string | null;
}

/** What the last sync left behind, which reading uses to recognise things. */
export interface Base {
  tree: Tree;
  layout: Layout;
  /** Note id by path, for files without an id of their own. */
  ids: Record<string, string>;
}

export function emptyBase(): Base {
  return { tree: emptyTree(), layout: emptyLayout(), ids: {} };
}

/** Markdown files, leaving alone anything in hidden folders (other apps' settings) apart from the Trash. */
export function isNotePath(path: string): boolean {
  if (!path.toLowerCase().endsWith('.md')) return false;
  const parts = path.split('/');
  if (parts.length === 2 && parts[0] === TRASH) return !parts[1].startsWith('.');
  return parts.every((s) => !s.startsWith('.'));
}

/** Lists the files and reads the ones that changed since they were cached. */
export async function readRemote(provider: Provider, cache: FileCache, metaCache: { rev: string; text: string } | null): Promise<Snapshot> {
  const entries = await provider.list();
  const files: Snapshot['files'] = {};
  await parallel(
    entries.filter((e) => e.kind === 'file' && isNotePath(e.path)),
    async (e) => {
      const cached = cache[e.path];
      if (cached && cached.rev === e.rev) {
        files[e.path] = { rev: e.rev, modified: e.modified, file: cached.file };
        return;
      }
      const { text, rev } = await provider.read(e.path);
      files[e.path] = { rev, modified: e.modified, file: normalise(parseNoteFile(text)) };
    },
  );
  let metaText: string | null = null;
  const metaEntry = entries.find((e) => e.kind === 'file' && e.path === META_FILE);
  if (metaEntry) metaText = metaCache && metaCache.rev === metaEntry.rev ? metaCache.text : (await provider.read(META_FILE)).text;
  return { entries, files, meta: parseMeta(metaText), metaText };
}

/** The body as Crumpet would write it, so formatting differences alone never count as a change. */
export function normalise(f: NoteFile): NoteFile {
  return { ...f, body: toMarkdown(fromMarkdown(f.body)) };
}

export function parseMeta(text: string | null): VaultMeta | null {
  if (!text) return null;
  try {
    const m = JSON.parse(text) as Partial<VaultMeta>;
    return {
      version: 1,
      stacks: Array.isArray(m.stacks) ? m.stacks.filter((s) => s && typeof s.id === 'string' && typeof s.folder === 'string') : [],
      notebooks: Array.isArray(m.notebooks) ? m.notebooks.filter((n) => n && typeof n.id === 'string' && typeof n.folder === 'string') : [],
    };
  } catch {
    return null;
  }
}

export function writeMeta(tree: Tree, l: Layout): string {
  const meta: VaultMeta = {
    version: 1,
    stacks: Object.values(tree.stacks)
      .map((s) => ({ id: s.id, name: s.name, folder: l.stacks[s.id], created: s.created }))
      .sort((a, b) => (a.folder < b.folder ? -1 : 1)),
    notebooks: Object.values(tree.notebooks)
      .map((n) => ({ id: n.id, name: n.name, color: n.color, folder: l.notebooks[n.id], created: n.created }))
      .sort((a, b) => (a.folder < b.folder ? -1 : 1)),
  };
  return `${JSON.stringify(meta, null, 2)}\n`;
}

/** The files as a tree, and where each thing is. */
export function remoteTree(snap: Snapshot, base: Base): { tree: Tree; layout: Layout } {
  const tree = emptyTree();
  const where = emptyLayout();
  const meta = snap.meta ?? { version: 1, stacks: [], notebooks: [] };

  // ---- folders
  const folders = new Set<string>();
  const addFolder = (p: string) => {
    for (; p; p = parentOf(p)) folders.add(p);
  };
  for (const e of snap.entries) {
    if (e.path.split('/').some((s) => s.startsWith('.'))) continue;
    if (e.kind === 'folder') addFolder(e.path);
    else if (isNotePath(e.path)) addFolder(parentOf(e.path));
  }
  const hasNotes = new Set(Object.keys(snap.files).map(parentOf));
  const hasFolders = new Set([...folders].map(parentOf));
  const metaStack = new Map(meta.stacks.map((s) => [s.folder, s]));
  const metaNotebook = new Map(meta.notebooks.map((n) => [n.folder, n]));
  const top = (p: string) => p.split('/')[0];
  const isStack = (p: string) => !p.includes('/') && (metaStack.has(p) || (!metaNotebook.has(p) && !hasNotes.has(p) && hasFolders.has(p)));
  const sorted = [...folders].sort();
  const stackFolders = sorted.filter(isStack);
  const notebookFolders = sorted.filter((p) => !isStack(p));

  // ---- note ids (needed to recognise renamed folders)
  const notePaths = Object.keys(snap.files).sort();
  const idOf: Record<string, string> = {};
  const used = new Set<string>();
  for (const path of notePaths) {
    const f = snap.files[path].file;
    // A copy of a file (same id twice) becomes a note of its own.
    let id = f.id ?? base.ids[path] ?? hashId('note', path);
    if (used.has(id)) id = hashId('note', `${path}#${id}`);
    used.add(id);
    idOf[path] = id;
  }

  // ---- notebooks
  const gone = (layoutFolders: Record<string, string>, id: string) => {
    const p = layoutFolders[id];
    return p === undefined || !folders.has(p);
  };
  const notebookIdOf = new Map<string, string>();
  const taken = new Set<string>();
  for (const p of notebookFolders) {
    const m = metaNotebook.get(p);
    if (m && !taken.has(m.id)) {
      notebookIdOf.set(p, m.id);
      taken.add(m.id);
    }
  }
  for (const p of notebookFolders) {
    if (notebookIdOf.has(p)) continue;
    // A notebook renamed or moved elsewhere: most of its notes used to be in a notebook whose folder has gone.
    const votes = new Map<string, number>();
    for (const path of notePaths) {
      if (parentOf(path) !== p) continue;
      const was = base.tree.notes[idOf[path]]?.notebookId;
      if (was && base.tree.notebooks[was] && !taken.has(was) && gone(base.layout.notebooks, was)) votes.set(was, (votes.get(was) ?? 0) + 1);
    }
    const best = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
    const id = best ?? hashId('notebook', p);
    notebookIdOf.set(p, id);
    taken.add(id);
  }

  // ---- stacks
  const stackIdOf = new Map<string, string>();
  const takenStacks = new Set<string>();
  for (const p of stackFolders) {
    const m = metaStack.get(p);
    if (m && !takenStacks.has(m.id)) {
      stackIdOf.set(p, m.id);
      takenStacks.add(m.id);
    }
  }
  for (const p of stackFolders) {
    if (stackIdOf.has(p)) continue;
    const votes = new Map<string, number>();
    for (const nbPath of notebookFolders) {
      if (top(nbPath) !== p || nbPath === p) continue;
      const was = base.tree.notebooks[notebookIdOf.get(nbPath)!]?.stackId;
      if (was && base.tree.stacks[was] && !takenStacks.has(was) && gone(base.layout.stacks, was)) votes.set(was, (votes.get(was) ?? 0) + 1);
    }
    const best = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
    const id = best ?? hashId('stack', p);
    stackIdOf.set(p, id);
    takenStacks.add(id);
  }

  for (const [p, id] of stackIdOf) {
    const m = metaStack.get(p);
    const was = base.tree.stacks[id];
    const name = nameFor(baseName(p), m?.id === id ? m.name : was?.name);
    tree.stacks[id] = { id, name, created: (m?.id === id ? m.created : was?.created) ?? 0 };
    where.stacks[id] = p;
  }
  for (const [p, id] of notebookIdOf) {
    const m = metaNotebook.get(p);
    const was = base.tree.notebooks[id];
    const name = nameFor(baseName(p), m?.id === id ? m.name : was?.name);
    const stackPath = p.includes('/') ? top(p) : null;
    const color = (m?.id === id ? m.color : was?.color) ?? NOTEBOOK_COLORS[parseInt(id.slice(-4), 16) % NOTEBOOK_COLORS.length];
    tree.notebooks[id] = {
      id,
      name,
      color: typeof color === 'string' ? color : NOTEBOOK_COLORS[0],
      stackId: stackPath && stackIdOf.has(stackPath) ? stackIdOf.get(stackPath)! : null,
      created: (m?.id === id ? m.created : was?.created) ?? 0,
    };
    where.notebooks[id] = p;
  }

  // ---- notes
  for (const path of notePaths) {
    const { file: f, modified } = snap.files[path];
    const id = idOf[path];
    const dir = parentOf(path);
    const inTrash = dir === TRASH;
    const fileTitle = baseName(path).replace(/\.md$/i, '');
    // Renamed elsewhere: the file name wins over the title inside.
    let title = f.title ?? (fileTitle === 'Untitled' ? '' : fileTitle);
    if (f.title !== null && !fitsName(fileTitle, safeName(f.title || 'Untitled'))) title = fileTitle;
    const from = inTrash ? (f.from ?? '') : dir;
    const note: TNote = {
      id,
      title,
      notebookId: from && notebookIdOf.has(from) ? notebookIdOf.get(from)! : null,
      tags: f.tags,
      favorite: f.favorite,
      created: f.created ?? modified,
      updated: f.updated ?? modified,
      trashed: inTrash ? (f.trashed ?? modified) : null,
      body: f.body,
      extra: f.extra,
    };
    // Edited by another app, which didn't update the date inside: the file's own date says when.
    const was = base.tree.notes[id];
    if (was && note.updated === was.updated && (note.body !== was.body || note.title !== was.title || note.extra !== was.extra)) note.updated = Math.max(modified, was.updated + 1);
    tree.notes[id] = note;
    where.notes[id] = path;
  }
  return { tree, layout: where };
}

/** A folder's name: its recorded name when the folder still fits it, else the folder's own name. */
function nameFor(folder: string, recorded: string | undefined): string {
  return recorded !== undefined && fitsName(folder, safeName(recorded)) ? recorded : folder;
}

async function parallel<T>(items: T[], fn: (x: T) => Promise<void>, limit = 6): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length) await fn(items[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
