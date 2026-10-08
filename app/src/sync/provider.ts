// Where the files live: Google Drive, a folder on this computer, and later
// other services. A provider only moves files around; everything Crumpet-
// specific happens in the sync engine, so each new service is small.
//
// Paths are relative to the vault's root folder and use "/".

export interface Entry {
  path: string;
  kind: 'file' | 'folder';
  /** Changes whenever the file's content changes. */
  rev: string;
  /** Last modified, in ms. */
  modified: number;
}

export interface Provider {
  /** Everything under the root, recursively. */
  list(): Promise<Entry[]>;
  read(path: string): Promise<{ text: string; rev: string }>;
  /** Creates or replaces a file, creating folders above it as needed. */
  write(path: string, text: string): Promise<Entry>;
  /** Creates a folder (and any above it). Fine if it already exists. */
  mkdir(path: string): Promise<void>;
  /** Moves or renames a file, creating folders above the new path as needed. The new path must be free. */
  move(from: string, to: string): Promise<Entry>;
  /** Removes a file, or a folder that is empty. */
  remove(path: string): Promise<void>;
  /** Pictures and other attached files. */
  readBytes?(path: string): Promise<Blob>;
  writeBytes?(path: string, data: Blob): Promise<Entry>;
}

/** Raised when the place the files live can't be reached (offline, signed out...). */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: 'offline' | 'auth' | 'missing' | 'conflict' | 'other' = 'other',
  ) {
    super(message);
  }
}

/** Files kept in memory: for tests, and to try syncing without an account. */
export class MemoryProvider implements Provider {
  files = new Map<string, { text: string; rev: number; modified: number }>();
  folders = new Set<string>();
  private counter = 0;
  /** Calls made, for tests. */
  log: string[] = [];

  constructor(private now: () => number = Date.now) {}

  async list(): Promise<Entry[]> {
    const out: Entry[] = [];
    for (const f of this.folders) out.push({ path: f, kind: 'folder', rev: '', modified: 0 });
    for (const [path, f] of this.files) out.push({ path, kind: 'file', rev: String(f.rev), modified: f.modified });
    return out;
  }

  async read(path: string) {
    const f = this.files.get(path);
    if (!f) throw new ProviderError(`No file ${path}`, 'missing');
    return { text: f.text, rev: String(f.rev) };
  }

  async write(path: string, text: string): Promise<Entry> {
    this.log.push(`write ${path}`);
    this.mkdirs(parent(path));
    if (this.folders.has(path)) throw new ProviderError(`${path} is a folder`, 'conflict');
    const f = { text, rev: ++this.counter, modified: this.now() };
    this.files.set(path, f);
    return { path, kind: 'file', rev: String(f.rev), modified: f.modified };
  }

  blobs = new Map<string, Blob>();

  async readBytes(path: string): Promise<Blob> {
    const b = this.blobs.get(path);
    if (!b) throw new ProviderError(`No file ${path}`, 'missing');
    return b;
  }

  async writeBytes(path: string, data: Blob): Promise<Entry> {
    this.log.push(`write ${path}`);
    this.blobs.set(path, data);
    // Listed like any other file (its text is never read).
    return this.write(path, '').then((e) => (this.log.pop(), e));
  }

  async mkdir(path: string) {
    this.log.push(`mkdir ${path}`);
    this.mkdirs(path);
  }

  async move(from: string, to: string): Promise<Entry> {
    this.log.push(`move ${from} -> ${to}`);
    const f = this.files.get(from);
    if (!f) throw new ProviderError(`No file ${from}`, 'missing');
    if (this.files.has(to) || this.folders.has(to)) throw new ProviderError(`${to} exists`, 'conflict');
    this.mkdirs(parent(to));
    this.files.delete(from);
    this.files.set(to, f);
    return { path: to, kind: 'file', rev: String(f.rev), modified: f.modified };
  }

  async remove(path: string) {
    this.log.push(`remove ${path}`);
    this.blobs.delete(path);
    if (this.files.delete(path)) return;
    if (!this.folders.has(path)) throw new ProviderError(`No file ${path}`, 'missing');
    const inside = [...this.files.keys(), ...this.folders].some((p) => p.startsWith(`${path}/`));
    if (inside) throw new ProviderError(`${path} isn't empty`, 'conflict');
    this.folders.delete(path);
  }

  private mkdirs(path: string) {
    for (let p = path; p; p = parent(p)) this.folders.add(p);
  }
}

function parent(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}
