// A folder on this computer, chosen by the person (the browser's File System
// Access API: Chrome and Edge on computers). Notes are kept there as the same
// Markdown files as in Google Drive, so a folder that Dropbox, OneDrive or
// iCloud Drive keeps in step works too.
//
// The browser remembers the folder (its handle is kept in IndexedDB), but
// after a restart it may ask again before Crumpet can use it: that shows as
// a sign-in problem, and "Allow access" asks (it has to be from a click).

import { type Entry, type Provider, ProviderError } from './provider';

type Mode = { mode: 'readwrite' };
type PermissionHandle = FileSystemHandle & {
  queryPermission?(opts: Mode): Promise<PermissionState>;
  requestPermission?(opts: Mode): Promise<PermissionState>;
};
type DirectoryHandle = FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };

/** True when this browser can keep notes in a folder on the computer. */
export const canUseFolder = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/** Asks the person for a folder (call from a click). Null if they cancel. */
export async function chooseFolder(): Promise<FileSystemDirectoryHandle | null> {
  const pick = (window as unknown as { showDirectoryPicker(opts: object): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
  try {
    return await pick.call(window, { id: 'crumpet-notes', mode: 'readwrite' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}

/** Whether Crumpet may use the folder now; with `ask`, asks the person (call from a click). */
export async function folderAllowed(handle: FileSystemDirectoryHandle, ask = false): Promise<boolean> {
  const h = handle as PermissionHandle;
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return ask && !!h.requestPermission && (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
}

export class FolderProvider implements Provider {
  constructor(private root: FileSystemDirectoryHandle) {}

  async list(): Promise<Entry[]> {
    await this.allowed();
    const out: Entry[] = [];
    const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
      for await (const h of (dir as DirectoryHandle).values()) {
        // The browser's own half-written files.
        if (h.name.endsWith('.crswap')) continue;
        const path = prefix + h.name;
        if (h.kind === 'directory') {
          out.push({ path, kind: 'folder', rev: '', modified: 0 });
          await walk(h as FileSystemDirectoryHandle, `${path}/`);
        } else {
          const f = await (h as FileSystemFileHandle).getFile();
          out.push({ path, kind: 'file', rev: rev(f), modified: f.lastModified });
        }
      }
    };
    await this.wrap(() => walk(this.root, ''));
    return out;
  }

  async read(path: string): Promise<{ text: string; rev: string }> {
    const f = await this.file(path);
    return { text: await f.text(), rev: rev(f) };
  }

  async readBytes(path: string): Promise<Blob> {
    return this.file(path);
  }

  write(path: string, text: string): Promise<Entry> {
    return this.put(path, text);
  }

  writeBytes(path: string, data: Blob): Promise<Entry> {
    return this.put(path, data);
  }

  async mkdir(path: string): Promise<void> {
    await this.allowed();
    await this.wrap(() => this.dir(path, true));
  }

  async move(from: string, to: string): Promise<Entry> {
    await this.allowed();
    if (await this.exists(to)) throw new ProviderError(`${to} exists`, 'conflict');
    const data = await this.file(from);
    const entry = await this.put(to, data);
    await this.remove(from);
    return entry;
  }

  async remove(path: string): Promise<void> {
    await this.allowed();
    const { dir, name } = await this.parent(path, false);
    await this.wrap(() => dir.removeEntry(name));
  }

  private async put(path: string, data: string | Blob): Promise<Entry> {
    await this.allowed();
    return this.wrap(async () => {
      const { dir, name } = await this.parent(path, true);
      const handle = await dir.getFileHandle(name, { create: true });
      const out = await handle.createWritable();
      await out.write(data);
      await out.close();
      const f = await handle.getFile();
      return { path, kind: 'file' as const, rev: rev(f), modified: f.lastModified };
    });
  }

  private async file(path: string): Promise<File> {
    await this.allowed();
    return this.wrap(async () => {
      const { dir, name } = await this.parent(path, false);
      return (await dir.getFileHandle(name)).getFile();
    });
  }

  private async exists(path: string): Promise<boolean> {
    try {
      const { dir, name } = await this.parent(path, false);
      await dir.getFileHandle(name).catch(() => dir.getDirectoryHandle(name));
      return true;
    } catch {
      return false;
    }
  }

  /** The folder a path is in, and its last part. */
  private async parent(path: string, create: boolean): Promise<{ dir: FileSystemDirectoryHandle; name: string }> {
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) throw new ProviderError(`No name in ${path}`, 'other');
    return { dir: await this.dir(parts.join('/'), create), name };
  }

  private async dir(path: string, create: boolean): Promise<FileSystemDirectoryHandle> {
    let dir = this.root;
    for (const part of path.split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(part, { create });
    return dir;
  }

  private async allowed(): Promise<void> {
    if (!(await folderAllowed(this.root))) throw new ProviderError('Crumpet needs your permission to use the folder again.', 'auth');
  }

  /** The browser's errors, as ours. */
  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'NotFoundError') throw new ProviderError(e instanceof Error ? e.message : 'Not found', 'missing');
      if (name === 'NotAllowedError' || name === 'SecurityError') throw new ProviderError('Crumpet needs your permission to use the folder again.', 'auth');
      if (name === 'InvalidModificationError' || name === 'TypeMismatchError') throw new ProviderError(e instanceof Error ? e.message : 'Can’t change that', 'conflict');
      throw new ProviderError(e instanceof Error ? e.message : String(e), 'other');
    }
  }
}

/** A file's version: changes when it's saved again. */
function rev(f: File): string {
  return `${f.lastModified}-${f.size}`;
}
