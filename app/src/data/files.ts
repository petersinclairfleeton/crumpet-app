// Pictures and other files attached to notes. Each is kept on this device
// and, when a cloud folder is connected, copied to its Attachments folder,
// where other apps can open it too. Notes point at them by that path:
// ![caption](Attachments/k3j9a2x-photo.jpg).

import type { Storage, StoredFile } from './db';
import type { Provider } from '../sync/provider';
import { ATTACHMENTS } from '../sync/layout';

export const MAX_FILE_MB = 25;

let storage: Storage | null = null;
let remote: () => Provider | null = () => null;
const urls = new Map<string, string>();
const loading = new Map<string, Promise<string>>();

export function setFileStorage(s: Storage): void {
  storage = s;
}

/** Where files not on this device can be fetched from (the connected cloud folder). */
export function setRemoteFiles(fn: () => Provider | null): void {
  remote = fn;
}

/** A file name that's safe in any folder and in a Markdown link. */
export function safeFileName(name: string): string {
  const clean = name
    .normalize('NFC')
    .replace(/[\\/:*?"<>|#%()[\]{}\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-\./g, '.')
    .replace(/^[-.]+|-+$/g, '');
  return (clean || 'file').slice(-80);
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 9).padEnd(7, '0');
}

export function isImage(type: string, name = ''): boolean {
  return /^image\/(png|jpe?g|gif|webp|avif|svg\+xml|bmp)$/i.test(type) || /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i.test(name);
}

/** Keeps a dropped, pasted or chosen file. Returns what to put in the note. */
export async function addFile(file: File): Promise<{ type: 'image' | 'file'; src: string; caption: string }> {
  if (!storage) throw new Error('Files can’t be kept yet.');
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`${file.name || 'That file'} is bigger than ${MAX_FILE_MB} MB.`);
  const ext = file.type === 'image/png' ? '.png' : file.type === 'image/jpeg' ? '.jpg' : '';
  const name = safeFileName(file.name || `pasted${ext}`);
  const path = `${ATTACHMENTS}/${shortId()}-${name}`;
  await storage.putFile({ path, type: file.type, blob: file, synced: false });
  urls.set(path, URL.createObjectURL(file));
  const image = isImage(file.type, name);
  return { type: image ? 'image' : 'file', src: path, caption: image ? '' : (file.name || name) };
}

/** An address the browser can show for a picture or file in a note. */
export function mediaUrl(src: string): string | Promise<string> {
  if (!src.startsWith(`${ATTACHMENTS}/`)) return src;
  const known = urls.get(src);
  if (known) return known;
  let p = loading.get(src);
  if (!p) {
    p = (async () => {
      let f: StoredFile | null = (await storage?.getFile(src)) ?? null;
      if (f?.gone) throw new Error('Deleted');
      if (!f) {
        // Not on this device yet: fetch it from the cloud folder, and keep it.
        const provider = remote();
        if (!provider?.readBytes) throw new Error('Not on this device');
        const blob = await provider.readBytes(src);
        f = { path: src, type: blob.type, blob, synced: true };
        await storage?.putFile(f);
      }
      const url = URL.createObjectURL(f.blob);
      urls.set(src, url);
      return url;
    })();
    loading.set(src, p);
    p.catch(() => loading.delete(src));
  }
  return p;
}

/** A file's contents, if it's on this device. */
export async function fileBlob(path: string): Promise<Blob | null> {
  const f = await storage?.getFile(path);
  return f && !f.gone ? f.blob : null;
}

/** Copies files added on this device to the cloud folder, and removes those no note uses any more. */
export async function uploadFiles(provider: Provider): Promise<number> {
  if (!storage || !provider.writeBytes) return 0;
  const pending = await storage.unsyncedFiles();
  for (const f of pending) {
    await provider.writeBytes(f.path, f.blob);
    await storage.putFile({ ...f, synced: true });
  }
  const gone = await storage.goneFiles();
  for (const f of gone) {
    try {
      await provider.remove(f.path);
    } catch {
      // Already gone from the folder (or never got there).
    }
    await storage.deleteFile(f.path);
  }
  return pending.length + gone.length;
}

/** The attachments a document shows (pictures and files kept in Attachments). */
export function attachmentsIn(blocks: { type: string; src?: string }[]): string[] {
  return blocks.filter((b) => (b.type === 'image' || b.type === 'file') && b.src?.startsWith(`${ATTACHMENTS}/`)).map((b) => b.src!);
}

/**
 * Forgets attachments no note uses any more: gone from this device now, and
 * from the cloud folder at the next sync (if they were ever copied there).
 */
export async function forgetFiles(store: Storage, paths: string[]): Promise<void> {
  for (const path of new Set(paths)) {
    const known = urls.get(path);
    if (known) URL.revokeObjectURL(known);
    urls.delete(path);
    loading.delete(path);
    const f = await store.getFile(path);
    if (f && !f.synced) await store.deleteFile(path);
    // Copied to the cloud (or perhaps added on another device): removed from there at the next sync.
    else await store.putFile({ path, type: f?.type ?? '', blob: new Blob([]), synced: true, gone: true });
  }
}
