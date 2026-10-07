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

/** Copies files added on this device to the cloud folder. */
export async function uploadFiles(provider: Provider): Promise<number> {
  if (!storage || !provider.writeBytes) return 0;
  const pending = await storage.unsyncedFiles();
  for (const f of pending) {
    await provider.writeBytes(f.path, f.blob);
    await storage.putFile({ ...f, synced: true });
  }
  return pending.length;
}
