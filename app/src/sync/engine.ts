// Keeping this device and the files in step.
//
// One sync:
//   1. List the files and read the ones that changed (remote.ts).
//   2. Merge three ways: this device, the files, and the version both last
//      agreed on (merge.ts).
//   3. Write the result to the files: new and changed notes, moves and
//      renames, deletions, folders, and `.crumpet/vault.json`.
//   4. Apply the result here, keeping anything typed while the sync ran.
//   5. Remember the result as the new agreed version.
//
// If anything fails part way, nothing is remembered and the next sync starts
// again from the last agreed version. Every step is safe to repeat.

import type { AppStore } from '../data/store';
import { type Layout, META_FILE, PROJECT_FILE, fullLayout, layout, parentOf } from './layout';
import { mergeTrees } from './merge';
import { type NoteFile, writeNoteFile } from './notefile';
import { type Provider, ProviderError } from './provider';
import { type Base, type FileCache, type ProjectCache, type Snapshot, emptyBase, readRemote, remoteTree, writeMeta, writeProject } from './remote';
import { type TChapter, type TNote, type Tree, fullTree, localTree, sameChapter, sameNote } from './tree';

export interface SyncState {
  base: Base;
  cache: FileCache;
  meta: { rev: string; text: string } | null;
  lastSynced: number;
  /** project.json files as last read or written. */
  projectFiles?: ProjectCache;
}

export interface SyncStatePersistence {
  load(): Promise<SyncState | null>;
  save(state: SyncState): Promise<void>;
}

export interface SyncStatus {
  phase: 'idle' | 'syncing' | 'error';
  lastSynced: number | null;
  error: { message: string; kind: ProviderError['kind'] } | null;
  /** Conflicted copies made by the last sync. */
  conflicts: number;
}

export interface SyncOptions {
  now?: () => number;
  newId?: () => string;
  /** Copies attached files to the folder after the notes (see data/files.ts). */
  uploadFiles?: (p: Provider) => Promise<unknown>;
}

export class SyncEngine {
  private status: SyncStatus = { phase: 'idle', lastSynced: null, error: null, conflicts: 0 };
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private applying = false;
  private unsubscribe: (() => void) | null = null;
  private now: () => number;
  private newId: () => string;
  private uploadFiles?: (p: Provider) => Promise<unknown>;

  constructor(
    private store: AppStore,
    private provider: Provider,
    private persistence: SyncStatePersistence,
    opts: SyncOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.newId = opts.newId ?? (() => crypto.randomUUID());
    this.uploadFiles = opts.uploadFiles;
  }

  getStatus = (): SyncStatus => this.status;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.listeners) fn();
  }

  /** Syncs now. If a sync is running, one more runs after it (so nothing waits for the next timer). */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.run();
        } while (this.again);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  /** Syncs after `delay` ms, unless something sooner is already planned. */
  schedule(delay: number): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.sync().catch(() => {});
    }, delay);
  }

  /** Syncs a moment after each local change. */
  watch(delay = 2000): void {
    let last = this.store.getState();
    this.unsubscribe = this.store.subscribe(() => {
      const s = this.store.getState();
      const changed = s.notes !== last.notes || s.notebooks !== last.notebooks || s.stacks !== last.stacks;
      last = s;
      if (changed && !this.applying) this.schedule(delay);
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async run(): Promise<void> {
    this.setStatus({ phase: 'syncing' });
    try {
      const conflicts = await this.once();
      this.setStatus({ phase: 'idle', lastSynced: this.now(), error: null, conflicts });
    } catch (err) {
      const e = err instanceof ProviderError ? err : new ProviderError(err instanceof Error ? err.message : String(err));
      this.setStatus({ phase: 'error', error: { message: e.message, kind: e.kind } });
      throw e;
    }
  }

  private async once(): Promise<number> {
    const saved = (await this.persistence.load()) ?? { base: emptyBase(), cache: {}, meta: null, lastSynced: 0 };
    // State saved by an earlier version may not know about projects yet.
    const state: SyncState = { ...saved, base: { ...saved.base, tree: fullTree(saved.base.tree), layout: fullLayout(saved.base.layout) } };
    const snap = await readRemote(this.provider, state.cache, state.meta, state.projectFiles ?? {});
    const { tree: remote, layout: at } = remoteTree(snap, state.base);
    // Every file gone at once is far more likely a missing or disconnected folder than a decision to delete everything.
    const count = (t: Tree) => Object.keys(t.notes).length + Object.keys(t.chapters).length;
    if (!count(remote) && !snap.meta && count(state.base.tree)) {
      throw new ProviderError('The notes folder is empty or missing, so nothing was changed.', 'missing');
    }

    this.store.flush();
    const s0 = this.store.getState();
    const local = localTree(s0);
    const opts = { newId: this.newId, now: this.now() };
    const { tree: merged, copies } = mergeTrees(state.base.tree, local, remote, opts);
    const want = layout(merged, at);
    const pushed = await push(this.provider, snap, remote, at, merged, want);
    await this.uploadFiles?.(this.provider);

    // Apply here, keeping anything typed while the sync ran.
    this.store.flush();
    const s1 = this.store.getState();
    const unchanged = s1.notes === s0.notes && s1.notebooks === s0.notebooks && s1.stacks === s0.stacks && s1.projects === s0.projects && s1.chapters === s0.chapters;
    const final = unchanged ? merged : mergeTrees(local, localTree(s1), merged, opts).tree;
    this.applying = true;
    try {
      this.store.applyTree(final);
    } finally {
      this.applying = false;
    }
    await this.persistence.save({ base: { tree: merged, layout: want, ids: pushed.ids }, cache: pushed.cache, meta: pushed.meta, projectFiles: pushed.projectFiles, lastSynced: this.now() });
    if (!unchanged) this.again = true;
    return copies.length;
  }
}

/** A note as its file says it. */
export function fileOf(n: TNote, l: Layout): NoteFile {
  return {
    id: n.id,
    title: n.title,
    tags: n.tags,
    favorite: n.favorite,
    created: n.created,
    updated: n.updated,
    trashed: n.trashed,
    from: n.trashed !== null && n.notebookId ? (l.notebooks[n.notebookId] ?? null) : null,
    extra: n.extra,
    body: n.body,
  };
}

/** Whether a file already says what the note says. Where a note lives is its path, except in the Trash. */
function fileIsCurrent(n: TNote, r: TNote | undefined): boolean {
  if (!r) return false;
  return n.trashed !== null ? sameNote(n, r) : sameNote({ ...n, notebookId: null }, { ...r, notebookId: null });
}

/** Writes the merged tree to the files. */
async function push(p: Provider, snap: Snapshot, remote: Tree, at: Layout, merged: Tree, want: Layout) {
  const cache: FileCache = {};
  for (const [path, f] of Object.entries(snap.files)) cache[path] = { rev: f.rev, file: f.file };
  const live = new Set(snap.entries.map((e) => e.path));
  const addLive = (path: string) => {
    for (let q = path; q; q = parentOf(q)) live.add(q);
  };

  // Folders for every stack and notebook (an empty notebook is an empty folder).
  const folders = new Set([...Object.values(want.stacks), ...Object.values(want.notebooks), ...Object.values(want.projects)]);
  for (const f of [...folders].sort()) {
    if (live.has(f)) continue;
    await p.mkdir(f);
    addLive(f);
  }

  // Deleted notes.
  for (const id of Object.keys(remote.notes)) {
    if (merged.notes[id]) continue;
    const path = at.notes[id];
    await p.remove(path);
    live.delete(path);
    delete cache[path];
  }

  // Deleted chapters.
  for (const id of Object.keys(remote.chapters)) {
    if (merged.chapters[id]) continue;
    const path = at.chapters[id];
    await p.remove(path);
    live.delete(path);
    delete cache[path];
  }

  // Moves and renames. A file can only move into a free name; when files swap
  // names (chapters being reordered), one steps aside first.
  const moves = new Map<string, string>();
  for (const id of Object.keys(merged.notes)) {
    const from = at.notes[id];
    if (from !== undefined && from !== want.notes[id]) moves.set(from, want.notes[id]);
  }
  for (const id of Object.keys(merged.chapters)) {
    const from = at.chapters[id];
    if (from !== undefined && from !== want.chapters[id]) moves.set(from, want.chapters[id]);
  }
  const move = async (from: string, to: string) => {
    const e = await p.move(from, to);
    live.delete(from);
    addLive(to);
    if (cache[from]) cache[to] = { rev: e.rev, file: cache[from].file };
    delete cache[from];
  };
  let stepAside = 0;
  while (moves.size) {
    let progress = false;
    for (const [from, to] of [...moves]) {
      if (live.has(to)) continue;
      await move(from, to);
      moves.delete(from);
      progress = true;
    }
    if (progress) continue;
    const [from, to] = moves.entries().next().value!;
    if (stepAside++ > moves.size) throw new ProviderError(`Couldn't move ${from} to ${to}`, 'conflict');
    const aside = `${from.replace(/\.md$/i, '')} (moving ${Math.random().toString(36).slice(2, 8)}).md`;
    await move(from, aside);
    moves.delete(from);
    moves.set(aside, to);
  }

  // New and changed notes.
  for (const n of Object.values(merged.notes)) {
    if (at.notes[n.id] !== undefined && fileIsCurrent(n, remote.notes[n.id])) continue;
    const path = want.notes[n.id];
    const file = fileOf(n, want);
    const e = await p.write(path, writeNoteFile(file));
    addLive(path);
    cache[path] = { rev: e.rev, file };
  }

  // New and changed chapters.
  for (const c of Object.values(merged.chapters)) {
    const r = remote.chapters[c.id];
    if (at.chapters[c.id] !== undefined && r && sameChapter({ ...c, projectId: '' }, { ...r, projectId: '' })) continue;
    const path = want.chapters[c.id];
    const file = chapterFile(c);
    const e = await p.write(path, writeNoteFile(file));
    addLive(path);
    cache[path] = { rev: e.rev, file };
  }

  // Each project's name, goal and outline.
  const projectFiles: ProjectCache = {};
  for (const pr of Object.values(merged.projects)) {
    const path = `${want.projects[pr.id]}/${PROJECT_FILE}`;
    const was = at.projects[pr.id] !== undefined ? `${at.projects[pr.id]}/${PROJECT_FILE}` : null;
    const text = writeProject(pr);
    const current = was === path ? snap.projectFiles[path] : undefined;
    if (current && current.text === text) {
      projectFiles[path] = current;
      continue;
    }
    const e = await p.write(path, text);
    addLive(path);
    projectFiles[path] = { rev: e.rev, text };
    if (was && was !== path && live.has(was)) {
      await p.remove(was);
      live.delete(was);
    }
  }
  // Projects that went: their project.json (their chapters are already gone).
  for (const id of Object.keys(remote.projects)) {
    if (merged.projects[id]) continue;
    const path = `${at.projects[id]}/${PROJECT_FILE}`;
    if (live.has(path)) {
      await p.remove(path);
      live.delete(path);
    }
  }

  // Folders of stacks, notebooks and projects that moved or went, once nothing is left inside.
  const old = [...Object.values(at.stacks), ...Object.values(at.notebooks), ...Object.values(at.projects)].filter((f) => !folders.has(f));
  for (const f of old.sort((a, b) => b.split('/').length - a.split('/').length)) {
    if ([...live].some((q) => q.startsWith(`${f}/`))) continue;
    try {
      await p.remove(f);
      live.delete(f);
    } catch {
      // Something we don't know about is in it: leave it.
    }
  }

  // Ids and colours.
  const metaText = writeMeta(merged, want);
  let meta: SyncState['meta'] = null;
  if (metaText !== snap.metaText) {
    const e = await p.write(META_FILE, metaText);
    meta = { rev: e.rev, text: metaText };
  } else if (snap.metaText !== null) {
    const e = snap.entries.find((x) => x.path === META_FILE);
    meta = e ? { rev: e.rev, text: snap.metaText } : null;
  }

  const ids: Record<string, string> = {};
  for (const id of Object.keys(merged.notes)) ids[want.notes[id]] = id;
  for (const id of Object.keys(merged.chapters)) ids[want.chapters[id]] = id;
  return { cache, ids, meta, projectFiles };
}

/** A chapter as its file says it. */
export function chapterFile(c: TChapter): NoteFile {
  return {
    id: c.id,
    title: c.title,
    tags: [],
    favorite: false,
    created: c.created,
    updated: c.updated,
    trashed: null,
    from: null,
    extra: '',
    body: c.body,
    status: c.status,
    synopsis: c.synopsis,
    goal: c.goal,
  };
}
