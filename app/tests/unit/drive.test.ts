import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import { DriveProvider, findOrCreateFolder } from '../../src/sync/drive';
import { SyncEngine, type SyncState } from '../../src/sync/engine';
import { localTree } from '../../src/sync/tree';

const FOLDER = 'application/vnd.google-apps.folder';

interface FakeFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  content: string;
  trashed: boolean;
  version: number;
  modifiedTime: string;
  createdTime: number;
}

/** Just enough of Google Drive's REST API, in memory. */
class FakeDrive {
  files = new Map<string, FakeFile>();
  calls: string[] = [];
  /** Respond 401 to the next request (an expired token). */
  expireNext = false;
  /** Respond 429 to the next N requests. */
  throttle = 0;
  private n = 0;

  fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    this.calls.push(`${method} ${url.pathname}`);
    if (!String((init.headers as Record<string, string>)?.Authorization).startsWith('Bearer ')) return new Response('no token', { status: 401 });
    if (this.expireNext) {
      this.expireNext = false;
      return new Response('expired', { status: 401 });
    }
    if (this.throttle > 0) {
      this.throttle--;
      return new Response('rate limit exceeded', { status: 429 });
    }
    const path = url.pathname.replace(/^\/(upload\/)?drive\/v3/, '');
    const m = /^\/files(?:\/([^/]+))?$/.exec(path);
    if (!m) return new Response('not found', { status: 404 });
    const id = m[1];
    const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (!id && method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const parent = /'([^']+)' in parents/.exec(q)![1];
      const name = /name = '((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replace(/\\(.)/g, '$1');
      const folderOnly = q.includes(`mimeType = '${FOLDER}'`);
      const out = [...this.files.values()]
        .filter((f) => !f.trashed && f.parents.includes(parent) && (!name || f.name === name) && (!folderOnly || f.mimeType === FOLDER))
        .sort((a, b) => a.createdTime - b.createdTime);
      return json({ files: out.map(meta) });
    }
    if (!id && method === 'POST') {
      let metaIn: { name: string; parents?: string[]; mimeType?: string };
      let content = '';
      if (url.pathname.startsWith('/upload')) {
        const boundary = /boundary=(.+)$/.exec((init.headers as Record<string, string>)['Content-Type'])![1];
        const parts = String(init.body).split(`--${boundary}`).slice(1, -1).map((p) => p.slice(p.indexOf('\r\n\r\n') + 4, -2));
        metaIn = JSON.parse(parts[0]);
        content = parts[1];
      } else metaIn = JSON.parse(String(init.body));
      const f = this.add(metaIn.name, metaIn.parents?.[0] ?? 'root', metaIn.mimeType ?? 'text/plain', content);
      return json(meta(f));
    }
    const f = id ? this.files.get(id) : undefined;
    if (!f) return new Response('not found', { status: 404 });
    if (method === 'GET') return url.searchParams.get('alt') === 'media' ? new Response(f.content) : json(meta(f));
    if (method === 'PATCH') {
      if (url.pathname.startsWith('/upload')) {
        f.content = String(init.body);
      } else {
        const body = JSON.parse(String(init.body)) as { name?: string; trashed?: boolean };
        if (body.name) f.name = body.name;
        if (body.trashed) f.trashed = true;
        const add = url.searchParams.get('addParents');
        const remove = url.searchParams.get('removeParents');
        if (add && remove) f.parents = f.parents.filter((p) => p !== remove).concat(add);
      }
      f.version++;
      f.modifiedTime = new Date(Date.now() + this.n).toISOString();
      return json(meta(f));
    }
    return new Response('bad', { status: 400 });
  };

  add(name: string, parent: string, mimeType: string, content = ''): FakeFile {
    const f: FakeFile = { id: `f${++this.n}`, name, parents: [parent], mimeType, content, trashed: false, version: 1, modifiedTime: new Date().toISOString(), createdTime: this.n };
    this.files.set(f.id, f);
    return f;
  }

  /** Live files under a folder, as paths. */
  paths(root: string, prefix = ''): string[] {
    return [...this.files.values()]
      .filter((f) => !f.trashed && f.parents.includes(root))
      .flatMap((f) => (f.mimeType === FOLDER ? [`${prefix}${f.name}/`, ...this.paths(f.id, `${prefix}${f.name}/`)] : [`${prefix}${f.name}`]))
      .sort();
  }
}

function meta(f: FakeFile) {
  return { id: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents, version: String(f.version), modifiedTime: f.modifiedTime, ...(f.mimeType === FOLDER ? {} : { md5Checksum: `md5-${hash(f.content)}` }) };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

const tokens: boolean[] = [];
const getToken = async (fresh?: boolean) => {
  tokens.push(!!fresh);
  return 'token';
};

async function device(drive: FakeDrive, rootId: string) {
  const store = new AppStore(new MemoryStorage());
  await store.load();
  let saved: SyncState | null = null;
  const engine = new SyncEngine(store, new DriveProvider({ getToken, rootId, fetch: drive.fetch }), {
    load: async () => (saved ? structuredClone(saved) : null),
    save: async (s) => {
      saved = structuredClone(s);
    },
  });
  return { store, engine };
}

describe('Google Drive', () => {
  it('finds the same folder from every device', async () => {
    const drive = new FakeDrive();
    const a = await findOrCreateFolder("Tom's notes", getToken, drive.fetch);
    const b = await findOrCreateFolder("Tom's notes", getToken, drive.fetch);
    expect(a).toBe(b);
    expect(drive.paths('root')).toEqual(["Tom's notes/"]);
  });

  it('syncs two devices through a Drive folder', async () => {
    const drive = new FakeDrive();
    const root = await findOrCreateFolder('Crumpet', getToken, drive.fetch);
    const mac = await device(drive, root);
    const phone = await device(drive, root);
    const nb = mac.store.createNotebook('Novel', mac.store.createStack('Writing').id);
    const n = mac.store.createNote({ title: 'Chapter 1', notebookId: nb.id, doc: fromMarkdown('It was **dark**.\n') });
    await mac.engine.sync();
    expect(drive.paths(root)).toEqual(['.crumpet/', '.crumpet/vault.json', 'Writing/', 'Writing/Novel/', 'Writing/Novel/Chapter 1.md']);
    await phone.engine.sync();
    expect(localTree(phone.store.getState())).toEqual(localTree(mac.store.getState()));

    phone.store.renameNotebook(nb.id, 'Book');
    phone.store.setDoc(n.id, fromMarkdown('It was **dark**.\n\nAnd stormy.\n'));
    phone.store.flush();
    await phone.engine.sync();
    await mac.engine.sync();
    expect(toMarkdown(mac.store.note(n.id)!.doc)).toBe('It was **dark**.\n\nAnd stormy.\n');
    expect(drive.paths(root)).toEqual(['.crumpet/', '.crumpet/vault.json', 'Writing/', 'Writing/Book/', 'Writing/Book/Chapter 1.md']);

    mac.store.deleteForever(n.id);
    await mac.engine.sync();
    // Deleted files go to Drive's bin, not away for good.
    expect([...drive.files.values()].some((f) => f.name === 'Chapter 1.md' && f.trashed)).toBe(true);

    drive.calls = [];
    await mac.engine.sync();
    expect(drive.calls.filter((c) => !c.startsWith('GET'))).toEqual([]);
  });

  it('gets a new token when Google refuses the old one, and waits out rate limits', async () => {
    const drive = new FakeDrive();
    const root = await findOrCreateFolder('Crumpet', getToken, drive.fetch);
    const mac = await device(drive, root);
    mac.store.createNote({ title: 'Hi' });
    tokens.length = 0;
    drive.expireNext = true;
    drive.throttle = 0;
    await mac.engine.sync();
    expect(tokens).toContain(true);
    drive.throttle = 2;
    mac.store.createNote({ title: 'Again' });
    await mac.engine.sync();
    expect(drive.paths(root)).toContain('Again.md');
  });

  it('reports being offline', async () => {
    const drive = new FakeDrive();
    const root = await findOrCreateFolder('Crumpet', getToken, drive.fetch);
    const mac = await device(drive, root);
    drive.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    (mac.engine as unknown as { provider: DriveProvider }).provider = new DriveProvider({ getToken, rootId: root, fetch: drive.fetch });
    await expect(mac.engine.sync()).rejects.toThrow(/online/);
    expect(mac.engine.getStatus()).toMatchObject({ phase: 'error', error: { kind: 'offline' } });
  });
});
