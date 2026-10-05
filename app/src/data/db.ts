// A small promise wrapper around IndexedDB: the browser's built-in database,
// which keeps data across reloads and is available on every platform we target.
// If it can't be opened (some private-browsing modes), the store falls back to
// memory and the app says so, rather than silently losing work.

import type { Note, Notebook, Settings, Stack } from './types';

const DB_NAME = 'crumpet';
const VERSION = 2;

export interface Persisted {
  stacks: Stack[];
  notebooks: Notebook[];
  notes: Note[];
  settings: Settings | null;
}

export interface Storage {
  load(): Promise<Persisted>;
  putNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;
  putNotebook(nb: Notebook): Promise<void>;
  deleteNotebook(id: string): Promise<void>;
  putStack(stack: Stack): Promise<void>;
  deleteStack(id: string): Promise<void>;
  putSettings(s: Settings): Promise<void>;
  /** True when changes are only kept in memory. */
  readonly temporary: boolean;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function open(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('notebooks')) db.createObjectStore('notebooks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('stacks')) db.createObjectStore('stacks', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database is blocked by another tab'));
  });
}

class IdbStorage implements Storage {
  readonly temporary = false;
  constructor(private db: IDBDatabase) {}

  async load(): Promise<Persisted> {
    const tx = this.db.transaction(['notes', 'notebooks', 'stacks', 'settings'], 'readonly');
    const [notes, notebooks, stacks, settings] = await Promise.all([
      request(tx.objectStore('notes').getAll() as IDBRequest<Note[]>),
      request(tx.objectStore('notebooks').getAll() as IDBRequest<Notebook[]>),
      request(tx.objectStore('stacks').getAll() as IDBRequest<Stack[]>),
      request(tx.objectStore('settings').get('settings') as IDBRequest<Settings | undefined>),
    ]);
    return { notes, notebooks, stacks, settings: settings ?? null };
  }

  private async write(store: string, fn: (s: IDBObjectStore) => IDBRequest): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite');
    fn(tx.objectStore(store));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  putNote(note: Note) {
    return this.write('notes', (s) => s.put(note));
  }
  deleteNote(id: string) {
    return this.write('notes', (s) => s.delete(id));
  }
  putNotebook(nb: Notebook) {
    return this.write('notebooks', (s) => s.put(nb));
  }
  deleteNotebook(id: string) {
    return this.write('notebooks', (s) => s.delete(id));
  }
  putSettings(settings: Settings) {
    return this.write('settings', (s) => s.put(settings, 'settings'));
  }
  putStack(stack: Stack) {
    return this.write('stacks', (s) => s.put(stack));
  }
  deleteStack(id: string) {
    return this.write('stacks', (s) => s.delete(id));
  }
}

/** Keeps everything in memory only. Used when IndexedDB is unavailable, and in tests. */
export class MemoryStorage implements Storage {
  readonly temporary = true;
  notes = new Map<string, Note>();
  notebooks = new Map<string, Notebook>();
  stacks = new Map<string, Stack>();
  settings: Settings | null = null;
  async load(): Promise<Persisted> {
    return { notes: [...this.notes.values()], notebooks: [...this.notebooks.values()], stacks: [...this.stacks.values()], settings: this.settings };
  }
  async putStack(s: Stack) {
    this.stacks.set(s.id, s);
  }
  async deleteStack(id: string) {
    this.stacks.delete(id);
  }
  async putNote(n: Note) {
    this.notes.set(n.id, n);
  }
  async deleteNote(id: string) {
    this.notes.delete(id);
  }
  async putNotebook(nb: Notebook) {
    this.notebooks.set(nb.id, nb);
  }
  async deleteNotebook(id: string) {
    this.notebooks.delete(id);
  }
  async putSettings(s: Settings) {
    this.settings = s;
  }
}

export async function openStorage(name = DB_NAME): Promise<Storage> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('No IndexedDB');
    return new IdbStorage(await open(name));
  } catch (err) {
    console.warn('[crumpet] Falling back to memory-only storage:', err);
    return new MemoryStorage();
  }
}
