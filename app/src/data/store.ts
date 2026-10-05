// The app's state and every action on it. Components read a snapshot through
// useStore() and call actions; the store saves changes in the background.
// Note bodies are saved a moment after typing pauses (and immediately when the
// page is hidden or closed), everything else straight away.

import { makeBlock, type Doc } from '@crumpet/editor/model';
import type { Storage } from './db';
import { type Note, type Notebook, NOTEBOOK_COLORS, type Settings, TRASH_DAYS, type View } from './types';

export interface AppState {
  ready: boolean;
  /** Changes are only kept in memory (the browser refused storage). */
  temporary: boolean;
  notebooks: Notebook[];
  notes: Note[];
  settings: Settings;
  view: View;
  selectedId: string | null;
  query: string;
}

export const DEFAULT_SETTINGS: Settings = { name: '', accent: '#D4A257', theme: 'system', listStyle: 'cards' };

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

  notebook(id: string): Notebook | undefined {
    return this.state.notebooks.find((n) => n.id === id);
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

  /** Loads saved data. `seed` fills an empty first run with example notebooks and notes. */
  async load(seed?: (store: AppStore) => void): Promise<void> {
    const data = await this.storage.load();
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
    // Empty the Trash of anything older than 30 days.
    const cutoff = this.now() - TRASH_DAYS * DAY;
    const expired = data.notes.filter((n) => n.trashedAt !== null && n.trashedAt < cutoff);
    for (const n of expired) this.save(this.storage.deleteNote(n.id));
    const notes = data.notes.filter((n) => !expired.includes(n));
    this.set({ ready: true, temporary: this.storage.temporary, notebooks: data.notebooks, notes, settings });
    if (!data.notebooks.length && !data.notes.length && seed) seed(this);
    if (!this.state.notebooks.length) this.createNotebook('Inbox');
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

  /** The notebook new notes go into when no notebook is open: Inbox if there is one. */
  defaultNotebook(): Notebook {
    const nbs = this.state.notebooks;
    return nbs.find((n) => /^(0\s+)?inbox$/i.test(n.name)) ?? nbs[0] ?? this.createNotebook('Inbox');
  }

  createNote(init: Partial<Pick<Note, 'title' | 'doc' | 'notebookId' | 'tags' | 'pinned'>> = {}): Note {
    const view = this.state.view;
    const t = this.now();
    const note: Note = {
      id: newId(),
      notebookId: init.notebookId ?? (view.kind === 'notebook' ? view.id : this.defaultNotebook().id),
      title: init.title ?? '',
      doc: init.doc ?? emptyDoc(),
      tags: init.tags ?? (view.kind === 'tag' ? [view.tag] : []),
      pinned: init.pinned ?? view.kind === 'shortcuts',
      createdAt: t,
      updatedAt: t,
      trashedAt: null,
    };
    // A new note made from the Trash or a stack view goes to its notebook, so show that notebook.
    const nextView: View = view.kind === 'trash' || view.kind === 'stack' ? { kind: 'notebook', id: note.notebookId } : view;
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

  /** Sets a note's created and edited time (for example content). */
  backdate(id: string, t: number): void {
    this.updateNote(id, { createdAt: t, updatedAt: t }, { touch: false });
  }

  setTitle(id: string, title: string): void {
    this.updateNote(id, { title }, { delaySave: true });
  }

  setDoc(id: string, doc: Doc): void {
    this.updateNote(id, { doc }, { delaySave: true });
  }

  moveNote(id: string, notebookId: string): void {
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

  togglePin(id: string): void {
    const note = this.note(id);
    if (note) this.updateNote(id, { pinned: !note.pinned }, { touch: false });
  }

  trashNote(id: string): void {
    this.updateNote(id, { trashedAt: this.now() }, { touch: false });
    this.selectNeighbourIfHidden(id);
  }

  restoreNote(id: string): void {
    const note = this.note(id);
    if (!note) return;
    // If its notebook was deleted meanwhile, it comes back to the default notebook.
    const notebookId = this.notebook(note.notebookId) ? note.notebookId : this.defaultNotebook().id;
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

  // ---------- notebooks ----------

  createNotebook(name: string, stack: string | null = null): Notebook {
    const used = new Set(this.state.notebooks.map((n) => n.color));
    const nb: Notebook = {
      id: newId(),
      name: name.trim() || 'Untitled notebook',
      color: NOTEBOOK_COLORS.find((c) => !used.has(c)) ?? NOTEBOOK_COLORS[this.state.notebooks.length % NOTEBOOK_COLORS.length],
      stack: stack?.trim() || null,
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

  /** Puts a notebook in a stack (by name; a new name makes a new stack), or takes it out with null. */
  setStack(id: string, stack: string | null): void {
    this.updateNotebook(id, { stack: stack?.trim() || null });
  }

  renameStack(from: string, to: string): void {
    const name = to.trim();
    if (!name) return;
    for (const nb of this.state.notebooks.filter((n) => n.stack === from)) this.updateNotebook(nb.id, { stack: name });
    const v = this.state.view;
    if (v.kind === 'stack' && v.name === from) this.set({ view: { kind: 'stack', name } });
  }

  /** Deletes a notebook and moves its notes to the Trash (they can be restored to the default notebook). */
  deleteNotebook(id: string): void {
    if (this.state.notebooks.length <= 1) return; // always keep one notebook
    const t = this.now();
    const notes = this.state.notes.map((n) => (n.notebookId === id && n.trashedAt === null ? { ...n, trashedAt: t } : n));
    for (const n of notes) if (n.notebookId === id && n.trashedAt === t) this.save(this.storage.putNote(n));
    const notebooks = this.state.notebooks.filter((n) => n.id !== id);
    const view: View = this.state.view.kind === 'notebook' && this.state.view.id === id ? { kind: 'all' } : this.state.view;
    this.set({ notes, notebooks, view });
    this.save(this.storage.deleteNotebook(id));
    const visible = visibleIn(this.state, view);
    if (!visible.some((n) => n.id === this.state.selectedId)) this.set({ selectedId: visible[0]?.id ?? null });
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
    case 'shortcuts':
      out = live.filter((n) => n.pinned);
      break;
    case 'notebook':
      out = live.filter((n) => n.notebookId === view.id);
      break;
    case 'stack': {
      const ids = new Set(state.notebooks.filter((nb) => nb.stack === view.name).map((nb) => nb.id));
      out = live.filter((n) => ids.has(n.notebookId));
      break;
    }
    case 'tag':
      out = live.filter((n) => n.tags.includes(view.tag));
      break;
    case 'trash':
      out = state.notes.filter((n) => n.trashedAt !== null).sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
      return out;
  }
  return [...out].sort((a, b) => b.updatedAt - a.updatedAt);
}
