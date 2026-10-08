import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import { DriveProvider, findOrCreateFolder } from '../../src/sync/drive';
import { SyncEngine, type SyncState } from '../../src/sync/engine';
import { localTree } from '../../src/sync/tree';
import { FakeDrive } from '../support/fake-drive';

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
    // The phone wrote two words, so it has a stats file of its own.
    const stats = drive.paths(root).filter((p) => p.startsWith('.crumpet/stats/'));
    expect(stats.length).toBe(2);
    expect(drive.paths(root).filter((p) => !p.startsWith('.crumpet/stats/'))).toEqual(['.crumpet/', '.crumpet/vault.json', 'Writing/', 'Writing/Book/', 'Writing/Book/Chapter 1.md']);

    mac.store.deleteForever(n.id);
    await mac.engine.sync();
    // Deleted files go to Drive's bin, not away for good.
    expect([...drive.files.values()].some((f) => f.name === 'Chapter 1.md' && f.trashed)).toBe(true);

    drive.calls = [];
    await mac.engine.sync();
    expect(drive.calls.filter((c) => !c.startsWith('GET'))).toEqual([]);
  });

  it('syncs a project, renumbering chapter files when they move', async () => {
    const drive = new FakeDrive();
    const root = await findOrCreateFolder('Crumpet', getToken, drive.fetch);
    const mac = await device(drive, root);
    const phone = await device(drive, root);
    const p = mac.store.createProject('Novel');
    const first = mac.store.getState().chapters[0];
    mac.store.setChapterTitle(first.id, 'Opening');
    const second = mac.store.addChapter(p.id)!;
    mac.store.setChapterTitle(second.id, 'Ending');
    mac.store.flush();
    await mac.engine.sync();
    expect(drive.paths(root)).toEqual(['.crumpet/', '.crumpet/vault.json', 'Projects/', 'Projects/Novel/', 'Projects/Novel/01 Opening.md', 'Projects/Novel/02 Ending.md', 'Projects/Novel/project.json']);
    mac.store.moveOutlineItem(p.id, second.id, 0);
    await mac.engine.sync();
    expect(drive.paths(root)).toContain('Projects/Novel/01 Ending.md');
    expect(drive.paths(root)).toContain('Projects/Novel/02 Opening.md');
    await phone.engine.sync();
    expect(localTree(phone.store.getState())).toEqual(localTree(mac.store.getState()));
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
