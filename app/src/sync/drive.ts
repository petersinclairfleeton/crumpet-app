// Google Drive as a place for the files, through Drive's REST API (v3).
//
// Crumpet asks only for the `drive.file` permission: it can see and change
// files it created (on any of your devices), and nothing else in your Drive.
// Notes go in one folder at the top of My Drive ("Crumpet" unless you choose
// another name). Deleting moves files to Drive's own bin, so nothing is lost
// for 30 days.

import { type Entry, type Provider, ProviderError } from './provider';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const FIELDS = 'id,name,mimeType,md5Checksum,version,modifiedTime,parents';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  md5Checksum?: string;
  version?: string;
  modifiedTime?: string;
}

export interface DriveOptions {
  /** An access token; `fresh` asks for a new one after the old was refused. */
  getToken(fresh?: boolean): Promise<string>;
  /** The vault's folder id (see findOrCreateFolder). */
  rootId: string;
  fetch?: typeof fetch;
}

export class DriveProvider implements Provider {
  private ids = new Map<string, string>([['', '']]);
  private kinds = new Map<string, 'file' | 'folder'>();
  private fetchFn: typeof fetch;

  constructor(private opts: DriveOptions) {
    this.fetchFn = opts.fetch ?? fetch.bind(globalThis);
    this.ids.set('', opts.rootId);
  }

  async list(): Promise<Entry[]> {
    const out: Entry[] = [];
    this.ids = new Map([['', this.opts.rootId]]);
    this.kinds = new Map();
    const queue: string[] = [''];
    while (queue.length) {
      const dir = queue.shift()!;
      const files = await this.children(this.ids.get(dir)!);
      const seen = new Set<string>();
      for (const f of files) {
        // A name Drive allows but a path can't hold, or a second file with the same name: left alone.
        if (f.name.includes('/') || seen.has(f.name)) continue;
        seen.add(f.name);
        const path = dir ? `${dir}/${f.name}` : f.name;
        const kind = f.mimeType === FOLDER ? 'folder' : 'file';
        this.ids.set(path, f.id);
        this.kinds.set(path, kind);
        out.push({ path, kind, rev: rev(f), modified: f.modifiedTime ? Date.parse(f.modifiedTime) : 0 });
        if (kind === 'folder') queue.push(path);
      }
    }
    return out;
  }

  async read(path: string) {
    const id = await this.idOf(path);
    const res = await this.call(`${API}/files/${id}?alt=media`);
    const text = await res.text();
    const meta = (await (await this.call(`${API}/files/${id}?fields=${FIELDS}`)).json()) as DriveFile;
    return { text, rev: rev(meta) };
  }

  async write(path: string, text: string): Promise<Entry> {
    const existing = this.ids.get(path);
    let f: DriveFile;
    if (existing && this.kinds.get(path) === 'file') {
      f = await (await this.call(`${UPLOAD}/files/${existing}?uploadType=media&fields=${FIELDS}`, { method: 'PATCH', headers: { 'Content-Type': 'text/markdown; charset=UTF-8' }, body: text })).json();
    } else {
      const parent = await this.folder(parentOf(path));
      const boundary = `crumpet${Math.random().toString(36).slice(2)}`;
      const meta = { name: baseName(path), parents: [parent], mimeType: path.endsWith('.json') ? 'application/json' : 'text/markdown' };
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${meta.mimeType}; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`;
      f = await (await this.call(`${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })).json();
      this.ids.set(path, f.id);
      this.kinds.set(path, 'file');
    }
    return { path, kind: 'file', rev: rev(f), modified: f.modifiedTime ? Date.parse(f.modifiedTime) : Date.now() };
  }

  async mkdir(path: string): Promise<void> {
    await this.folder(path);
  }

  async move(from: string, to: string): Promise<Entry> {
    const id = await this.idOf(from);
    if (this.ids.has(to)) throw new ProviderError(`${to} exists`, 'conflict');
    const oldParent = this.ids.get(parentOf(from))!;
    const newParent = await this.folder(parentOf(to));
    const params = oldParent === newParent ? '' : `&addParents=${newParent}&removeParents=${oldParent}`;
    const f: DriveFile = await (
      await this.call(`${API}/files/${id}?fields=${FIELDS}${params}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: baseName(to) }) })
    ).json();
    this.ids.delete(from);
    this.kinds.delete(from);
    this.ids.set(to, id);
    this.kinds.set(to, 'file');
    return { path: to, kind: 'file', rev: rev(f), modified: f.modifiedTime ? Date.parse(f.modifiedTime) : Date.now() };
  }

  async remove(path: string): Promise<void> {
    const id = await this.idOf(path);
    if (this.kinds.get(path) === 'folder' && [...this.ids.keys()].some((p) => p.startsWith(`${path}/`))) throw new ProviderError(`${path} isn't empty`, 'conflict');
    // To Drive's bin rather than gone for good.
    await this.call(`${API}/files/${id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
    this.ids.delete(path);
    this.kinds.delete(path);
  }

  /** A folder directly inside the root, found or made. */
  async topFolder(name: string): Promise<string> {
    return (await this.findTopFolder(name)) ?? this.folder(name);
  }

  /** A folder directly inside the root that Crumpet can see, if there is one. */
  async findTopFolder(name: string): Promise<string | null> {
    const q = encodeURIComponent(`'${this.opts.rootId}' in parents and trashed = false and mimeType = '${FOLDER}' and name = '${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`);
    const res = (await (await this.call(`${API}/files?q=${q}&fields=files(${FIELDS})&orderBy=createdTime`)).json()) as { files: DriveFile[] };
    return res.files[0]?.id ?? null;
  }

  // ---- helpers

  private async children(folderId: string): Promise<DriveFile[]> {
    const out: DriveFile[] = [];
    let page: string | undefined;
    do {
      const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const url = `${API}/files?q=${q}&fields=nextPageToken,files(${FIELDS})&pageSize=1000&orderBy=createdTime${page ? `&pageToken=${page}` : ''}`;
      const res = (await (await this.call(url)).json()) as { files: DriveFile[]; nextPageToken?: string };
      out.push(...res.files);
      page = res.nextPageToken;
    } while (page);
    return out;
  }

  private async idOf(path: string): Promise<string> {
    const id = this.ids.get(path);
    if (!id) throw new ProviderError(`No file ${path}`, 'missing');
    return id;
  }

  /** The id of a folder, creating it (and any above it) if needed. */
  private async folder(path: string): Promise<string> {
    const known = this.ids.get(path);
    if (known !== undefined) {
      if (path && this.kinds.get(path) !== 'folder') throw new ProviderError(`${path} is a file`, 'conflict');
      return known;
    }
    const parent = await this.folder(parentOf(path));
    const f: DriveFile = await (
      await this.call(`${API}/files?fields=${FIELDS}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: baseName(path), mimeType: FOLDER, parents: [parent] }) })
    ).json();
    this.ids.set(path, f.id);
    this.kinds.set(path, 'folder');
    return f.id;
  }

  /** A request with the access token, refreshing it once if refused and waiting out rate limits. */
  private async call(url: string, init: RequestInit = {}): Promise<Response> {
    let fresh = false;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        const token = await this.opts.getToken(fresh);
        res = await this.fetchFn(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError("Couldn't reach Google Drive. Are you online?", 'offline');
      }
      if (res.ok) return res;
      if (res.status === 401 && !fresh) {
        fresh = true;
        continue;
      }
      if ((res.status === 429 || res.status === 403 || res.status >= 500) && attempt < 4 && (res.status !== 403 || /rate|quota/i.test(await res.clone().text()))) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }
      if (res.status === 401) throw new ProviderError('Google Drive needs you to sign in again.', 'auth');
      if (res.status === 404) throw new ProviderError('A file or folder is missing in Google Drive.', 'missing');
      throw new ProviderError(`Google Drive said no (${res.status}).`, 'other');
    }
  }
}

/** Finds the vault folder at the top of My Drive (one Crumpet made earlier, on any device), or makes it. */
export async function findOrCreateFolder(name: string, getToken: DriveOptions['getToken'], fetchFn?: typeof fetch): Promise<string> {
  return new DriveProvider({ getToken, rootId: 'root', fetch: fetchFn }).topFolder(name);
}

/** The vault folder at the top of My Drive, if Crumpet made one earlier (on any device). */
export async function findFolder(name: string, getToken: DriveOptions['getToken'], fetchFn?: typeof fetch): Promise<string | null> {
  return new DriveProvider({ getToken, rootId: 'root', fetch: fetchFn }).findTopFolder(name);
}

function rev(f: DriveFile): string {
  return f.md5Checksum ?? f.version ?? '';
}

function parentOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
