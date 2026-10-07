// A small promise wrapper around IndexedDB: the browser's built-in database,
// which keeps data across reloads and is available on every platform we target.
// If it can't be opened (some private-browsing modes), the store falls back to
// memory and the app says so, rather than silently losing work.

import type { Chapter, Note, Notebook, Project, Settings, Stack } from './types';

const DB_NAME = 'crumpet';
const VERSION = 5;

export interface Persisted {
  stacks: Stack[];
  notebooks: Notebook[];
  notes: Note[];
  projects: Project[];
  chapters: Chapter[];
  settings: Settings | null;
}

/** A picture or other file attached to a note, kept on this device. */
export interface StoredFile {
  /** Where it lives in the notes folder too, e.g. "Attachments/k3j9a2x-photo.jpg". */
  path: string;
  type: string;
  blob: Blob;
  /** Copied to the notes folder in the cloud. */
  synced: boolean;
}

export interface Storage {
  load(): Promise<Persisted>;
  getFile(path: string): Promise<StoredFile | null>;
  putFile(f: StoredFile): Promise<void>;
  /** Files not yet copied to the cloud. */
  unsyncedFiles(): Promise<StoredFile[]>;
  putNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;
  putNotebook(nb: Notebook): Promise<void>;
  deleteNotebook(id: string): Promise<void>;
  putStack(stack: Stack): Promise<void>;
  deleteStack(id: string): Promise<void>;
  putSettings(s: Settings): Promise<void>;
  putProject(p: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  putChapter(c: Chapter): Promise<void>;
  deleteChapter(id: string): Promise<void>;
  /** Sync's own records (connection, last agreed version), by key. */
  getSync<T>(key: string): Promise<T | null>;
  putSync(key: string, value: unknown): Promise<void>;
  deleteSync(key: string): Promise<void>;
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
      if (!db.objectStoreNames.contains('sync')) db.createObjectStore('sync');
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('chapters')) db.createObjectStore('chapters', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'path' });
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
    const tx = this.db.transaction(['notes', 'notebooks', 'stacks', 'settings', 'projects', 'chapters'], 'readonly');
    const [notes, notebooks, stacks, settings, projects, chapters] = await Promise.all([
      request(tx.objectStore('notes').getAll() as IDBRequest<Note[]>),
      request(tx.objectStore('notebooks').getAll() as IDBRequest<Notebook[]>),
      request(tx.objectStore('stacks').getAll() as IDBRequest<Stack[]>),
      request(tx.objectStore('settings').get('settings') as IDBRequest<Settings | undefined>),
      request(tx.objectStore('projects').getAll() as IDBRequest<Project[]>),
      request(tx.objectStore('chapters').getAll() as IDBRequest<Chapter[]>),
    ]);
    return { notes, notebooks, stacks, projects, chapters, settings: settings ?? null };
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
  async getFile(path: string): Promise<StoredFile | null> {
    const tx = this.db.transaction('files', 'readonly');
    return ((await request(tx.objectStore('files').get(path))) as StoredFile | undefined) ?? null;
  }
  putFile(f: StoredFile) {
    return this.write('files', (s) => s.put(f));
  }
  async unsyncedFiles(): Promise<StoredFile[]> {
    const tx = this.db.transaction('files', 'readonly');
    const all = (await request(tx.objectStore('files').getAll())) as StoredFile[];
    return all.filter((f) => !f.synced);
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
  putProject(p: Project) {
    return this.write('projects', (s) => s.put(p));
  }
  deleteProject(id: string) {
    return this.write('projects', (s) => s.delete(id));
  }
  putChapter(c: Chapter) {
    return this.write('chapters', (s) => s.put(c));
  }
  deleteChapter(id: string) {
    return this.write('chapters', (s) => s.delete(id));
  }
  async getSync<T>(key: string): Promise<T | null> {
    const tx = this.db.transaction('sync', 'readonly');
    return ((await request(tx.objectStore('sync').get(key))) as T | undefined) ?? null;
  }
  putSync(key: string, value: unknown) {
    return this.write('sync', (s) => s.put(value, key));
  }
  deleteSync(key: string) {
    return this.write('sync', (s) => s.delete(key));
  }
}

/** Keeps everything in memory only. Used when IndexedDB is unavailable, and in tests. */
export class MemoryStorage implements Storage {
  readonly temporary = true;
  notes = new Map<string, Note>();
  notebooks = new Map<string, Notebook>();
  stacks = new Map<string, Stack>();
  projects = new Map<string, Project>();
  chapters = new Map<string, Chapter>();
  settings: Settings | null = null;
  files = new Map<string, StoredFile>();
  async getFile(path: string) {
    return this.files.get(path) ?? null;
  }
  async putFile(f: StoredFile) {
    this.files.set(f.path, f);
  }
  async unsyncedFiles() {
    return [...this.files.values()].filter((f) => !f.synced);
  }
  async load(): Promise<Persisted> {
    return {
      notes: [...this.notes.values()],
      notebooks: [...this.notebooks.values()],
      stacks: [...this.stacks.values()],
      projects: [...this.projects.values()],
      chapters: [...this.chapters.values()],
      settings: this.settings,
    };
  }
  async putProject(p: Project) {
    this.projects.set(p.id, p);
  }
  async deleteProject(id: string) {
    this.projects.delete(id);
  }
  async putChapter(c: Chapter) {
    this.chapters.set(c.id, c);
  }
  async deleteChapter(id: string) {
    this.chapters.delete(id);
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
  sync = new Map<string, unknown>();
  async getSync<T>(key: string): Promise<T | null> {
    return this.sync.has(key) ? (structuredClone(this.sync.get(key)) as T) : null;
  }
  async putSync(key: string, value: unknown) {
    this.sync.set(key, structuredClone(value));
  }
  async deleteSync(key: string) {
    this.sync.delete(key);
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
