// The app's state and every action on it. Components read a snapshot through
// useAppState() and call actions; the store saves changes in the background.
// Note bodies are saved a moment after typing pauses (and immediately when the
// page is hidden or closed), everything else straight away.
//
// Nothing is created for the person: a new Crumpet starts with no notebooks
// or stacks. Notes don't need a notebook; they can be filed later.

import { makeBlock, type Doc } from '@crumpet/editor/model';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { matchIds } from '@crumpet/editor/diff';
import type { Tree } from '../sync/tree';
import type { Persisted, Storage } from './db';
import { type Note, type Notebook, NOTEBOOK_COLORS, type Settings, type Stack, TRASH_DAYS, type View } from './types';

export interface AppState {
  ready: boolean;
  /** Changes are only kept in memory (the browser refused storage). */
  temporary: boolean;
  stacks: Stack[];
  notebooks: Notebook[];
  notes: Note[];
  settings: Settings;
  view: View;
  selectedId: string | null;
  query: string;
}

export const DEFAULT_SETTINGS: Settings = { name: '', accent: '#D4A257', theme: 'system', listStyle: 'cards' };

/** Bumped when a one-off clean-up of saved data is added to `upgrade()`. */
export const DATA_VERSION = 2;

const SAVE_DELAY_MS = 500;
const DAY = 24 * 60 * 60 * 1000;

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function emptyDoc(): Doc {
  return { blocks: [makeBlock('paragraph')] };
}

export class AppStore {
  private state: AppState = {
    ready: false,
    temporary: false,
    stacks: [],
    notebooks: [],
    notes: [],
    settings: DEFAULT_SETTINGS,
    view: { kind: 'all' },
    selectedId: null,
    query: '',
  };
  private listeners = new Set<() => void>();
  private pendingDocs = new Map<string, ReturnType<typeof setTimeout>>();
  private failures = 0;

  constructor(
    private storage: Storage,
    private now: () => number = Date.now,
  ) {}

  // ---------- reading ----------

  getState = (): AppState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  note(id: string | null): Note | undefined {
    return id ? this.state.notes.find((n) => n.id === id) : undefined;
  }

  notebook(id: string | null): Notebook | undefined {
    return id ? this.state.notebooks.find((n) => n.id === id) : undefined;
  }

  stack(id: string | null): Stack | undefined {
    return id ? this.state.stacks.find((s) => s.id === id) : undefined;
  }

  /** Saves that have failed (shown to the person; 0 normally). */
  get saveFailures(): number {
    return this.failures;
  }

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  private save(p: Promise<void>): void {
    p.catch((err) => {
      this.failures += 1;
      console.error('[crumpet] Save failed', err);
      this.set({});
    });
  }

  // ---------- loading ----------

  async load(): Promise<void> {
    const data = this.upgrade(await this.storage.load());
    // Empty the Trash of anything older than 30 days.
    const cutoff = this.now() - TRASH_DAYS * DAY;
    const expired = new Set(data.notes.filter((n) => n.trashedAt !== null && n.trashedAt < cutoff).map((n) => n.id));
    for (const id of expired) this.save(this.storage.deleteNote(id));
    const notes = data.notes.filter((n) => !expired.has(n.id));
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}), dataVersion: DATA_VERSION };
    this.set({ ready: true, temporary: this.storage.temporary, stacks: data.stacks, notebooks: data.notebooks, notes, settings });
    if (data.settings?.dataVersion !== DATA_VERSION) this.save(this.storage.putSettings(settings));
    this.set({ selectedId: visibleIn(this.state, this.state.view)[0]?.id ?? null });
  }

  /**
   * Brings data saved by earlier versions up to date, saving what changes:
   * - Version 1 filled a first run with example notes and notebooks. Untouched
   *   examples are removed, and example notebooks left empty go too; anything
   *   the person wrote or edited stays.
   * - Stacks were names on notebooks; they become stacks of their own.
   * - Notes "pinned" to Shortcuts become Favorites.
   */
  private upgrade(data: Persisted): Persisted {
    if ((data.settings?.dataVersion ?? 1) >= DATA_VERSION) return data;
    type Legacy = { stack?: string | null; stackId?: string | null; pinned?: boolean; favorite?: boolean };
    const EXAMPLE_NOTES = new Set(['Welcome to Crumpet', 'Opening scene, first pass', 'Villain who is right', 'Names for the island', 'Weekly review', 'Tide tables for the finale']);
    const EXAMPLE_NOTEBOOKS = new Set(['Inbox', 'Novel: The Lighthouse', 'Essay: Why tides lag', 'Journal', 'Reading list']);

    const notes: Note[] = [];
    for (const raw of data.notes) {
      const n = raw as Note & Legacy;
      if (EXAMPLE_NOTES.has(n.title) && n.createdAt === n.updatedAt) {
        this.save(this.storage.deleteNote(n.id));
        continue;
      }
      const { pinned, ...rest } = n;
      const note: Note = { ...rest, favorite: n.favorite ?? !!pinned, notebookId: n.notebookId ?? null };
      notes.push(note);
      this.save(this.storage.putNote(note));
    }
    const used = new Set(notes.map((n) => n.notebookId));
    const stacks = [...data.stacks];
    const notebooks: Notebook[] = [];
    for (const raw of data.notebooks) {
      const nb = raw as Notebook & Legacy;
      if (EXAMPLE_NOTEBOOKS.has(nb.name) && !used.has(nb.id)) {
        this.save(this.storage.deleteNotebook(nb.id));
        continue;
      }
      let stackId = nb.stackId ?? null;
      if (!stackId && nb.stack) {
        let st = stacks.find((s) => s.name === nb.stack);
        if (!st) {
          st = { id: newId(), name: nb.stack, createdAt: nb.createdAt };
          stacks.push(st);
          this.save(this.storage.putStack(st));
        }
        stackId = st.id;
      }
      const { stack: _legacy, ...rest } = nb;
      void _legacy;
      const notebook: Notebook = { ...rest, stackId };
      notebooks.push(notebook);
      this.save(this.storage.putNotebook(notebook));
    }
    // Notes whose notebook was an (empty) example notebook can't exist, but be safe.
    const ids = new Set(notebooks.map((n) => n.id));
    for (const n of notes) if (n.notebookId && !ids.has(n.notebookId)) n.notebookId = null;
    return { ...data, notes, notebooks, stacks };
  }

  // ---------- navigation ----------

  setView(view: View): void {
    const notes = visibleIn(this.state, view);
    const keep = this.state.selectedId && notes.some((n) => n.id === this.state.selectedId);
    this.set({ view, query: '', selectedId: keep ? this.state.selectedId : (notes[0]?.id ?? null) });
  }

  select(id: string | null): void {
    this.flush();
    this.set({ selectedId: id });
  }

  setQuery(query: string): void {
    this.set({ query });
  }

  // ---------- notes ----------

  createNote(init: Partial<Pick<Note, 'title' | 'doc' | 'notebookId' | 'tags' | 'favorite'>> = {}): Note {
    const view = this.state.view;
    const t = this.now();
    const note: Note = {
      id: newId(),
      notebookId: init.notebookId !== undefined ? init.notebookId : view.kind === 'notebook' ? view.id : null,
      title: init.title ?? '',
      doc: init.doc ?? emptyDoc(),
      tags: init.tags ?? (view.kind === 'tag' ? [view.tag] : []),
      favorite: init.favorite ?? view.kind === 'favorites',
      createdAt: t,
      updatedAt: t,
      trashedAt: null,
    };
    // Show the new note where it lives: its notebook, or All Notes if it isn't in one.
    const nextView: View =
      view.kind === 'trash' || view.kind === 'stack' ? (note.notebookId ? { kind: 'notebook', id: note.notebookId } : { kind: 'all' }) : view;
    this.set({ notes: [note, ...this.state.notes], selectedId: note.id, view: nextView, query: '' });
    this.save(this.storage.putNote(note));
    return note;
  }

  private updateNote(id: string, patch: Partial<Note>, opts: { touch?: boolean; delaySave?: boolean } = {}): void {
    const touch = opts.touch ?? true;
    let updated: Note | undefined;
    const notes = this.state.notes.map((n) => {
      if (n.id !== id) return n;
      updated = { ...n, ...patch, ...(touch ? { updatedAt: this.now() } : {}) };
      return updated;
    });
    if (!updated) return;
    this.set({ notes });
    if (opts.delaySave) this.scheduleSave(id);
    else this.save(this.storage.putNote(updated));
  }

  setTitle(id: string, title: string): void {
    this.updateNote(id, { title }, { delaySave: true });
  }

  setDoc(id: string, doc: Doc): void {
    this.updateNote(id, { doc }, { delaySave: true });
  }

  /** Files a note in a notebook, or takes it out of any with null. */
  moveNote(id: string, notebookId: string | null): void {
    this.updateNote(id, { notebookId });
  }

  addTag(id: string, tag: string): void {
    const clean = cleanTag(tag);
    const note = this.note(id);
    if (!note || !clean || note.tags.includes(clean)) return;
    this.updateNote(id, { tags: [...note.tags, clean] });
  }

  removeTag(id: string, tag: string): void {
    const note = this.note(id);
    if (note) this.updateNote(id, { tags: note.tags.filter((t) => t !== tag) });
  }

  toggleFavorite(id: string): void {
    const note = this.note(id);
    if (note) this.updateNote(id, { favorite: !note.favorite }, { touch: false });
  }

  trashNote(id: string): void {
    this.updateNote(id, { trashedAt: this.now() }, { touch: false });
    this.selectNeighbourIfHidden(id);
  }

  restoreNote(id: string): void {
    const note = this.note(id);
    if (!note) return;
    // If its notebook was deleted meanwhile, it comes back without a notebook.
    const notebookId = this.notebook(note.notebookId) ? note.notebookId : null;
    this.updateNote(id, { trashedAt: null, notebookId }, { touch: false });
    this.selectNeighbourIfHidden(id);
  }

  deleteForever(id: string): void {
    this.cancelSave(id);
    this.set({ notes: this.state.notes.filter((n) => n.id !== id) });
    this.save(this.storage.deleteNote(id));
    this.selectNeighbourIfHidden(id);
  }

  emptyTrash(): void {
    for (const n of this.state.notes.filter((x) => x.trashedAt !== null)) this.deleteForever(n.id);
  }

  /** After a note leaves the current view, select the next one in the list. */
  private selectNeighbourIfHidden(id: string): void {
    if (this.state.selectedId !== id) return;
    const visible = visibleIn(this.state, this.state.view);
    if (visible.some((n) => n.id === id)) return;
    this.set({ selectedId: visible[0]?.id ?? null });
  }

  private reselectIfHidden(): void {
    const visible = visibleIn(this.state, this.state.view);
    if (!visible.some((n) => n.id === this.state.selectedId)) this.set({ selectedId: visible[0]?.id ?? null });
  }

  // ---------- notebooks ----------

  createNotebook(name: string, stackId: string | null = null): Notebook {
    const used = new Set(this.state.notebooks.map((n) => n.color));
    const nb: Notebook = {
      id: newId(),
      name: name.trim() || 'Untitled notebook',
      color: NOTEBOOK_COLORS.find((c) => !used.has(c)) ?? NOTEBOOK_COLORS[this.state.notebooks.length % NOTEBOOK_COLORS.length],
      stackId: this.stack(stackId) ? stackId : null,
      createdAt: this.now(),
    };
    this.set({ notebooks: [...this.state.notebooks, nb] });
    this.save(this.storage.putNotebook(nb));
    return nb;
  }

  private updateNotebook(id: string, patch: Partial<Notebook>): void {
    let updated: Notebook | undefined;
    const notebooks = this.state.notebooks.map((n) => (n.id === id ? (updated = { ...n, ...patch }) : n));
    if (!updated) return;
    this.set({ notebooks });
    this.save(this.storage.putNotebook(updated));
  }

  renameNotebook(id: string, name: string): void {
    if (name.trim()) this.updateNotebook(id, { name: name.trim() });
  }

  setNotebookColor(id: string, color: string): void {
    this.updateNotebook(id, { color });
  }

  /** Puts a notebook in a stack, or takes it out with null. */
  setStack(id: string, stackId: string | null): void {
    this.updateNotebook(id, { stackId: this.stack(stackId) ? stackId : null });
  }

  /** Deletes a notebook and moves its notes to the Trash (restoring one brings it back without a notebook). */
  deleteNotebook(id: string): void {
    const t = this.now();
    const notes = this.state.notes.map((n) => (n.notebookId === id && n.trashedAt === null ? { ...n, trashedAt: t } : n));
    for (const n of notes) if (n.notebookId === id && n.trashedAt === t) this.save(this.storage.putNote(n));
    const notebooks = this.state.notebooks.filter((n) => n.id !== id);
    const view: View = this.state.view.kind === 'notebook' && this.state.view.id === id ? { kind: 'all' } : this.state.view;
    this.set({ notes, notebooks, view });
    this.save(this.storage.deleteNotebook(id));
    this.reselectIfHidden();
  }

  // ---------- stacks ----------

  createStack(name: string): Stack {
    const st: Stack = { id: newId(), name: name.trim() || 'Untitled stack', createdAt: this.now() };
    this.set({ stacks: [...this.state.stacks, st] });
    this.save(this.storage.putStack(st));
    return st;
  }

  renameStack(id: string, name: string): void {
    const clean = name.trim();
    if (!clean) return;
    let updated: Stack | undefined;
    const stacks = this.state.stacks.map((s) => (s.id === id ? (updated = { ...s, name: clean }) : s));
    if (!updated) return;
    this.set({ stacks });
    this.save(this.storage.putStack(updated));
  }

  /** Deletes a stack. Its notebooks and notes stay; the notebooks are simply no longer in a stack. */
  deleteStack(id: string): void {
    for (const nb of this.state.notebooks.filter((n) => n.stackId === id)) this.updateNotebook(nb.id, { stackId: null });
    const view: View = this.state.view.kind === 'stack' && this.state.view.id === id ? { kind: 'all' } : this.state.view;
    this.set({ stacks: this.state.stacks.filter((s) => s.id !== id), view });
    this.save(this.storage.deleteStack(id));
    this.reselectIfHidden();
  }

  // ---------- sync ----------

  /**
   * Makes this device's notes, notebooks and stacks match a synced tree.
   * Only what differs is replaced and saved; dates come from the tree.
   */
  applyTree(tree: Tree): void {
    const { state } = this;
    const stacks: Stack[] = Object.values(tree.stacks).map((t) => {
      const cur = state.stacks.find((s) => s.id === t.id);
      if (cur && cur.name === t.name && cur.createdAt === t.created) return cur;
      const next: Stack = { id: t.id, name: t.name, createdAt: t.created };
      this.save(this.storage.putStack(next));
      return next;
    });
    const notebooks: Notebook[] = Object.values(tree.notebooks).map((t) => {
      const cur = state.notebooks.find((n) => n.id === t.id);
      if (cur && cur.name === t.name && cur.color === t.color && cur.stackId === t.stackId && cur.createdAt === t.created) return cur;
      const next: Notebook = { id: t.id, name: t.name, color: t.color, stackId: t.stackId, createdAt: t.created };
      this.save(this.storage.putNotebook(next));
      return next;
    });
    const byId = new Map(state.notes.map((n) => [n.id, n]));
    const notes: Note[] = Object.values(tree.notes).map((t) => {
      const cur = byId.get(t.id);
      const doc = cur && toMarkdown(cur.doc) === t.body ? cur.doc : matchIds(cur?.doc ?? emptyDoc(), fromMarkdown(t.body));
      const next: Note = {
        id: t.id,
        notebookId: t.notebookId,
        title: t.title,
        doc,
        tags: t.tags,
        favorite: t.favorite,
        createdAt: t.created,
        updatedAt: t.updated,
        trashedAt: t.trashed,
        ...(t.extra ? { extra: t.extra } : {}),
      };
      if (cur && sameNoteRecord(cur, next)) return cur;
      this.cancelSave(t.id);
      this.save(this.storage.putNote(next));
      return next;
    });
    for (const s of state.stacks) if (!tree.stacks[s.id]) this.save(this.storage.deleteStack(s.id));
    for (const n of state.notebooks) if (!tree.notebooks[n.id]) this.save(this.storage.deleteNotebook(n.id));
    for (const n of state.notes) {
      if (tree.notes[n.id]) continue;
      this.cancelSave(n.id);
      this.save(this.storage.deleteNote(n.id));
    }
    // Keep the order things were in, with anything new at the end (notes: newest first).
    const order = <T extends { id: string }>(prev: T[], next: T[]) => {
      const pos = new Map(prev.map((x, i) => [x.id, i]));
      return [...next].sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity));
    };
    const newNotes = notes.filter((n) => !byId.has(n.id));
    const kept = order(state.notes, notes.filter((n) => byId.has(n.id)));
    let view = state.view;
    if ((view.kind === 'notebook' && !tree.notebooks[view.id]) || (view.kind === 'stack' && !tree.stacks[view.id])) view = { kind: 'all' };
    this.set({ stacks: order(state.stacks, stacks), notebooks: order(state.notebooks, notebooks), notes: [...newNotes, ...kept], view });
    this.reselectIfHidden();
  }

  // ---------- settings ----------

  updateSettings(patch: Partial<Settings>): void {
    const settings = { ...this.state.settings, ...patch };
    this.set({ settings });
    this.save(this.storage.putSettings(settings));
  }

  // ---------- saving ----------

  private scheduleSave(id: string): void {
    this.cancelSave(id);
    this.pendingDocs.set(
      id,
      setTimeout(() => {
        this.pendingDocs.delete(id);
        const note = this.note(id);
        if (note) this.save(this.storage.putNote(note));
      }, SAVE_DELAY_MS),
    );
  }

  private cancelSave(id: string): void {
    const t = this.pendingDocs.get(id);
    if (t) clearTimeout(t);
    this.pendingDocs.delete(id);
  }

  /** Saves anything waiting for typing to pause. Called when switching notes and when the page is hidden. */
  flush(): void {
    for (const id of [...this.pendingDocs.keys()]) {
      this.cancelSave(id);
      const note = this.note(id);
      if (note) this.save(this.storage.putNote(note));
    }
  }
}

function sameNoteRecord(a: Note, b: Note): boolean {
  return (
    a.doc === b.doc &&
    a.notebookId === b.notebookId &&
    a.title === b.title &&
    a.tags.length === b.tags.length &&
    a.tags.every((t, i) => t === b.tags[i]) &&
    a.favorite === b.favorite &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt &&
    a.trashedAt === b.trashedAt &&
    (a.extra ?? '') === (b.extra ?? '')
  );
}

export function cleanTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase().slice(0, 40);
}

/** Notes in a view (before searching), newest first. */
export function visibleIn(state: Pick<AppState, 'notes' | 'notebooks'>, view: View): Note[] {
  const live = state.notes.filter((n) => n.trashedAt === null);
  let out: Note[];
  switch (view.kind) {
    case 'all':
      out = live;
      break;
    case 'favorites':
      out = live.filter((n) => n.favorite);
      break;
    case 'notebook':
      out = live.filter((n) => n.notebookId === view.id);
      break;
    case 'stack': {
      const ids = new Set(state.notebooks.filter((nb) => nb.stackId === view.id).map((nb) => nb.id));
      out = live.filter((n) => n.notebookId !== null && ids.has(n.notebookId));
      break;
    }
    case 'tag':
      out = live.filter((n) => n.tags.includes(view.tag));
      break;
    case 'trash':
      return state.notes.filter((n) => n.trashedAt !== null).sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
  }
  return [...out].sort((a, b) => b.updatedAt - a.updatedAt);
}
