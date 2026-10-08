import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import { SyncEngine, type SyncState } from '../../src/sync/engine';
import { parseNoteFile, writeNoteFile } from '../../src/sync/notefile';
import { MemoryProvider } from '../../src/sync/provider';
import { mergeText } from '../../src/sync/textmerge';
import { localTree } from '../../src/sync/tree';
import { defaultPage, presetSheet } from '../../src/data/styles';

let clock = 1_700_000_000_000;
const now = () => (clock += 1000);
let ids = 0;
const newId = () => `id-${++ids}`;

async function device(provider: MemoryProvider) {
  const store = new AppStore(new MemoryStorage(), now);
  await store.load();
  let saved: SyncState | null = null;
  const engine = new SyncEngine(
    store,
    provider,
    {
      load: async () => (saved ? structuredClone(saved) : null),
      save: async (s) => {
        saved = structuredClone(s);
      },
    },
    { now, newId },
  );
  return { store, engine };
}

const md = (text: string) => fromMarkdown(text);
const body = (store: AppStore, title: string) => toMarkdown(store.getState().notes.find((n) => n.title === title)!.doc);
const titles = (store: AppStore) => store.getState().notes.map((n) => n.title).sort();
/** The files in the folder, leaving out each device's writing stats. */
const fileList = (cloud: MemoryProvider) => [...cloud.files.keys()].filter((f) => !f.startsWith('.crumpet/stats/')).sort();
/** Everything that syncs, without ids that are only local (block ids). */
const shape = (store: AppStore) => localTree(store.getState());

describe('note files', () => {
  it('write and read back', () => {
    const f = { id: 'abc', title: 'Ideas: a list', tags: ['one', 'two words', '#x'], favorite: true, created: 1, updated: 2, trashed: null, from: null, extra: 'aliases: [x]', body: 'Hello\n' };
    const text = writeNoteFile(f);
    expect(text).toBe('---\nid: abc\ntitle: "Ideas: a list"\ntags: [one, "two words", "#x"]\nfavorite: true\ncreated: 1970-01-01T00:00:00.001Z\nupdated: 1970-01-01T00:00:00.002Z\naliases: [x]\n---\n\nHello\n');
    expect(parseNoteFile(text)).toEqual({ ...f, tags: ['one', 'two words', 'x'] });
  });

  it('reads front matter written by other apps', () => {
    const f = parseNoteFile("---\ntitle: 'It''s here'\ntags:\n  - a\n  - b\ndate: 2024-01-01\ncustom:\n  nested: 1\n---\nBody");
    expect(f.title).toBe("It's here");
    expect(f.tags).toEqual(['a', 'b']);
    expect(f.extra).toBe('date: 2024-01-01\ncustom:\n  nested: 1');
    expect(f.body).toBe('Body');
    expect(parseNoteFile('No front matter').body).toBe('No front matter');
  });
});

describe('merging text', () => {
  it('combines edits in different places and refuses overlapping ones', () => {
    const base = 'One fish.\n\nTwo fish.\n\nRed fish.\n';
    expect(mergeText(base, 'One big fish.\n\nTwo fish.\n\nRed fish.\n', 'One fish.\n\nTwo fish.\n\nBlue fish.\n')).toBe('One big fish.\n\nTwo fish.\n\nBlue fish.\n');
    expect(mergeText(base, 'One cat.\n\nTwo fish.\n\nRed fish.\n', 'One dog.\n\nTwo fish.\n\nRed fish.\n')).toBeNull();
  });
});

describe('syncing two devices through files', () => {
  it('brings notes, notebooks and stacks across, laid out as folders', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    const phone = await device(cloud);
    const stack = mac.store.createStack('Writing');
    const nb = mac.store.createNotebook('Novel', stack.id);
    const note = mac.store.createNote({ title: 'Opening scene', notebookId: nb.id, doc: md('It was **dark**.\n') });
    mac.store.addTag(note.id, 'draft');
    mac.store.createNote({ title: 'Loose thought', notebookId: null, doc: md('Hm.\n') });
    await mac.engine.sync();
    expect(fileList(cloud)).toEqual(['.crumpet/vault.json', 'Loose thought.md', 'Writing/Novel/Opening scene.md']);
    await phone.engine.sync();
    expect(shape(phone.store)).toEqual(shape(mac.store));
    expect(phone.store.getState().notebooks[0]).toMatchObject({ id: nb.id, name: 'Novel', stackId: stack.id, color: nb.color });
  });

  it('does nothing when nothing changed', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    mac.store.createNote({ title: 'A', doc: md('a\n') });
    await mac.engine.sync();
    cloud.log = [];
    await mac.engine.sync();
    expect(cloud.log).toEqual([]);
  });

  it('adds up writing stats from every device', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    const phone = await device(cloud);
    const n = mac.store.createNote({ title: 'Diary' });
    mac.store.setDoc(n.id, md('one two three four five\n'));
    mac.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    const p = phone.store.getState().notes.find((x) => x.title === 'Diary')!;
    phone.store.setDoc(p.id, md('one two three four five six seven\n'));
    phone.store.flush();
    await phone.engine.sync();
    await mac.engine.sync();
    const { allDailyWords, dayKey } = await import('../../src/data/stats');
    const today = dayKey(clock);
    const total = (store: AppStore) => allDailyWords(store.getState().settings.stats, store.getState().settings.statsElsewhere, clock)[today];
    expect(total(mac.store)).toBe(7);
    expect(total(phone.store)).toBe(7);
    // Each device writes only its own file.
    expect([...cloud.files.keys()].filter((f) => f.startsWith('.crumpet/stats/')).length).toBe(2);
  });

  it('copies snapshots to every device, restores one, and deletes one everywhere', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    const phone = await device(cloud);
    const n = mac.store.createNote({ title: 'Draft', doc: md('The first version.\n') });
    const snap = mac.store.takeSnapshot(n.id, 'First go')!;
    mac.store.setDoc(n.id, md('A rewrite.\n'));
    mac.store.flush();
    await mac.engine.sync();
    expect([...cloud.files.keys()].filter((f) => f.startsWith('.crumpet/snapshots/'))).toHaveLength(1);
    await phone.engine.sync();
    expect(phone.store.getState().snapshots.map((x) => x.name)).toEqual(['First go']);
    // Going back on the phone keeps a snapshot of the rewrite first.
    phone.store.restoreSnapshot(snap.id);
    phone.store.flush();
    expect(body(phone.store, 'Draft')).toBe('The first version.\n');
    expect(phone.store.getState().snapshots).toHaveLength(2);
    await phone.engine.sync();
    await mac.engine.sync();
    expect(body(mac.store, 'Draft')).toBe('The first version.\n');
    expect(mac.store.getState().snapshots).toHaveLength(2);
    // Deleted on the Mac: gone from the folder, and then from the phone.
    mac.store.deleteSnapshot(snap.id);
    await new Promise((r) => setTimeout(r));
    await mac.engine.sync();
    await phone.engine.sync();
    expect(phone.store.getState().snapshots.map((x) => x.id)).not.toContain(snap.id);
    expect([...cloud.files.keys()].filter((f) => f.startsWith('.crumpet/snapshots/'))).toHaveLength(1);
  });

  it('merges edits to different parts of the same note', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    const phone = await device(cloud);
    const n = mac.store.createNote({ title: 'List', doc: md('First line.\n\nSecond line.\n') });
    await mac.engine.sync();
    await phone.engine.sync();
    mac.store.setDoc(n.id, md('First line, edited on the Mac.\n\nSecond line.\n'));
    phone.store.setDoc(n.id, md('First line.\n\nSecond line, edited on the phone.\n'));
    phone.store.addTag(n.id, 'phone');
    mac.store.toggleFavorite(n.id);
    await mac.engine.sync();
    await phone.engine.sync();
    await mac.engine.sync();
    expect(body(mac.store, 'List')).toBe('First line, edited on the Mac.\n\nSecond line, edited on the phone.\n');
    expect(shape(phone.store)).toEqual(shape(mac.store));
    expect(mac.store.note(n.id)).toMatchObject({ tags: ['phone'], favorite: true });
  });

  it('keeps both versions when the same words were changed on both', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    const phone = await device(cloud);
    const n = mac.store.createNote({ title: 'Clash', doc: md('Original.\n') });
    await mac.engine.sync();
    await phone.engine.sync();
    mac.store.setDoc(n.id, md('Mac version.\n'));
    phone.store.setDoc(n.id, md('Phone version.\n'));
    await mac.engine.sync();
    await phone.engine.sync();
    await mac.engine.sync();
    expect(phone.engine.getStatus().conflicts).toBe(1);
    expect(body(phone.store, 'Clash')).toBe('Phone version.\n');
    const copy = phone.store.getState().notes.find((x) => x.title.startsWith('Clash (conflicted copy'))!;
    expect(toMarkdown(copy.doc)).toBe('Mac version.\n');
    expect(shape(mac.store)).toEqual(shape(phone.store));
  });

  it('brings a deleted note back if the other device edited it', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    const phone = await device(cloud);
    const n = mac.store.createNote({ title: 'Keep me', doc: md('v1\n') });
    await mac.engine.sync();
    await phone.engine.sync();
    mac.store.deleteForever(n.id);
    phone.store.setDoc(n.id, md('v2\n'));
    await mac.engine.sync();
    await phone.engine.sync();
    await mac.engine.sync();
    expect(body(mac.store, 'Keep me')).toBe('v2\n');
  });

  it('deletes, trashes and restores across devices', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    const phone = await device(cloud);
    const nb = mac.store.createNotebook('Ideas');
    const a = mac.store.createNote({ title: 'A', notebookId: nb.id });
    const b = mac.store.createNote({ title: 'B', notebookId: nb.id });
    await mac.engine.sync();
    await phone.engine.sync();
    mac.store.trashNote(a.id);
    mac.store.deleteForever(b.id);
    await mac.engine.sync();
    expect(fileList(cloud)).toEqual(['.crumpet/vault.json', '.trash/A.md']);
    expect(parseNoteFile(cloud.files.get('.trash/A.md')!.text).from).toBe('Ideas');
    await phone.engine.sync();
    expect(phone.store.note(a.id)?.trashedAt).not.toBeNull();
    expect(phone.store.note(b.id)).toBeUndefined();
    phone.store.restoreNote(a.id);
    await phone.engine.sync();
    await mac.engine.sync();
    expect(mac.store.note(a.id)).toMatchObject({ trashedAt: null, notebookId: nb.id });
    expect(cloud.files.has('Ideas/A.md')).toBe(true);
  });

  it('moves files when notes, notebooks and stacks are renamed or moved', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    const phone = await device(cloud);
    const st = mac.store.createStack('Work');
    const nb = mac.store.createNotebook('Plans', st.id);
    const n = mac.store.createNote({ title: 'Q1', notebookId: nb.id });
    await mac.engine.sync();
    await phone.engine.sync();
    mac.store.renameStack(st.id, 'Job');
    mac.store.renameNotebook(nb.id, 'Roadmap');
    mac.store.setTitle(n.id, 'Q2');
    mac.store.flush();
    await mac.engine.sync();
    expect(fileList(cloud)).toEqual(['.crumpet/vault.json', 'Job/Roadmap/Q2.md']);
    expect([...cloud.folders].sort()).toEqual(['.crumpet', 'Job', 'Job/Roadmap']);
    await phone.engine.sync();
    expect(shape(phone.store)).toEqual(shape(mac.store));
  });

  it('keeps names unique ignoring case, and keeps a note where it is', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    mac.store.createNote({ title: 'Idea' });
    mac.store.createNote({ title: 'idea' });
    mac.store.createNote({ title: 'a/b: c?' });
    await mac.engine.sync();
    expect(fileList(cloud)).toEqual(['.crumpet/vault.json', 'Idea.md', 'a-b- c-.md', 'idea 2.md']);
    await mac.engine.sync();
    expect(fileList(cloud)).toEqual(['.crumpet/vault.json', 'Idea.md', 'a-b- c-.md', 'idea 2.md']);
  });

  it('notices files and folders changed by other apps', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    const nb = mac.store.createNotebook('Journal');
    const n = mac.store.createNote({ title: 'Monday', notebookId: nb.id, doc: md('Rain.\n') });
    await mac.engine.sync();
    // Edited in another editor, then the folder and file renamed in Finder.
    const file = cloud.files.get('Journal/Monday.md')!;
    await cloud.write('Journal/Monday.md', file.text.replace('Rain.', 'Rain, then *sun*.'));
    await cloud.move('Journal/Monday.md', 'Diary/Mon.md');
    cloud.folders.delete('Journal');
    // A note written elsewhere, with no front matter at all.
    await cloud.write('Diary/Tuesday.md', '# Tuesday\n\n- [x] walk\n');
    await mac.engine.sync();
    const s = mac.store.getState();
    expect(s.notebooks).toMatchObject([{ id: nb.id, name: 'Diary' }]);
    expect(mac.store.note(n.id)).toMatchObject({ title: 'Mon', notebookId: nb.id });
    expect(body(mac.store, 'Mon')).toBe('Rain, then _sun_.\n');
    expect(body(mac.store, 'Tuesday')).toBe('# Tuesday\n\n- [x] walk\n');
    // Files written by others aren't rewritten just to change their formatting.
    expect(cloud.files.get('Diary/Tuesday.md')!.text).toBe('# Tuesday\n\n- [x] walk\n');
    cloud.log = [];
    await mac.engine.sync();
    expect(cloud.log).toEqual([]);
  });

  it('leaves other apps’ hidden folders alone', async () => {
    const cloud = new MemoryProvider(now);
    await cloud.write('.obsidian/workspace.md', 'x');
    await cloud.write('Note.md', 'Hello\n');
    const mac = await device(cloud);
    await mac.engine.sync();
    expect(titles(mac.store)).toEqual(['Note']);
    expect(cloud.files.has('.obsidian/workspace.md')).toBe(true);
  });

  it('refuses to delete everything when the folder seems to have gone', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    mac.store.createNote({ title: 'Precious' });
    await mac.engine.sync();
    cloud.files.clear();
    cloud.folders.clear();
    await expect(mac.engine.sync()).rejects.toThrow(/empty or missing/);
    expect(titles(mac.store)).toEqual(['Precious']);
  });

  it('keeps typing done while a sync runs', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    const phone = await device(cloud);
    const n = mac.store.createNote({ title: 'Live', doc: md('One.\n\nTwo.\n') });
    await mac.engine.sync();
    await phone.engine.sync();
    phone.store.setDoc(n.id, md('One, from the phone.\n\nTwo.\n'));
    await phone.engine.sync();
    // Type on the Mac while its sync is reading the files.
    const read = cloud.read.bind(cloud);
    cloud.read = async (path) => {
      mac.store.setDoc(n.id, md('One.\n\nTwo, typed during sync.\n'));
      cloud.read = read;
      return read(path);
    };
    await mac.engine.sync();
    expect(body(mac.store, 'Live')).toBe('One, from the phone.\n\nTwo, typed during sync.\n');
    await phone.engine.sync();
    expect(body(phone.store, 'Live')).toBe('One, from the phone.\n\nTwo, typed during sync.\n');
  });
});

describe('syncing pictures and files', () => {
  it('copies attached files to the Attachments folder, which never becomes a notebook', async () => {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    const phone = await device(cloud);
    const uploads: string[] = [];
    const engine = new SyncEngine(mac.store, cloud, { load: async () => null, save: async () => {} }, { now, newId, uploadFiles: async (p) => (await p.writeBytes!('Attachments/abc1234-lamp.png', new Blob(['png'])), uploads.push('lamp')) });
    const nb = mac.store.createNotebook('Pictures');
    mac.store.createNote({ title: 'With a picture', notebookId: nb.id, doc: md('Here:\n\n![The lamp](Attachments/abc1234-lamp.png)\n') });
    mac.store.flush();
    await engine.sync();
    expect(uploads).toEqual(['lamp']);
    expect(cloud.blobs.has('Attachments/abc1234-lamp.png')).toBe(true);
    await phone.engine.sync();
    expect(phone.store.getState().notebooks.map((n) => n.name)).toEqual(['Pictures']);
    expect(body(phone.store, 'With a picture')).toBe('Here:\n\n![The lamp](Attachments/abc1234-lamp.png)\n');
    // A notebook called Attachments gets a folder of its own.
    mac.store.createNotebook('Attachments');
    mac.store.createNote({ title: 'Odd', notebookId: mac.store.getState().notebooks.find((n) => n.name === 'Attachments')!.id });
    mac.store.flush();
    await engine.sync();
    expect(cloud.files.has('Attachments 2/Odd.md')).toBe(true);
    await phone.engine.sync();
    expect(phone.store.getState().notebooks.map((n) => n.name).sort()).toEqual(['Attachments', 'Pictures']);
  });
});

describe('random syncing', () => {
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
  }

  it('always ends with every device and the files agreeing', async () => {
    const WORDS = ['alpha', 'beta', 'gamma', 'delta', '**bold**', '_it_', 'x/y', 'Idea', 'idea'];
    for (let seed = 1; seed <= Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SEEDS ?? 25); seed++) {
      const rand = rng(seed);
      const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
      const cloud = new MemoryProvider(now);
      const devices = [await device(cloud), await device(cloud), await device(cloud)];
      for (let step = 0; step < 60; step++) {
        const d = pick(devices);
        const s = d.store;
        const st = s.getState();
        const r = rand();
        const live = st.notes.filter((n) => n.trashedAt === null);
        if (r < 0.15 || !st.notes.length) s.createNote({ title: pick(WORDS), notebookId: st.notebooks.length && rand() < 0.6 ? pick(st.notebooks).id : null, doc: md(`${pick(WORDS)} ${pick(WORDS)}\n`) });
        else if (r < 0.4 && live.length) {
          const n = pick(live);
          const paras = toMarkdown(n.doc).trim().split('\n\n');
          const i = Math.floor(rand() * (paras.length + 1));
          if (rand() < 0.3 && paras.length > 1) paras.splice(Math.min(i, paras.length - 1), 1);
          else paras.splice(i, 0, `${pick(WORDS)} ${pick(WORDS)}`);
          s.setDoc(n.id, md(`${paras.join('\n\n')}\n`));
        } else if (r < 0.45 && live.length) s.setTitle(pick(live).id, pick(WORDS));
        else if (r < 0.5 && live.length) s.trashNote(pick(live).id);
        else if (r < 0.53 && st.notes.some((n) => n.trashedAt !== null)) s.restoreNote(pick(st.notes.filter((n) => n.trashedAt !== null)).id);
        else if (r < 0.56) s.deleteForever(pick(st.notes).id);
        else if (r < 0.6 && live.length) s.addTag(pick(live).id, pick(['red', 'blue']));
        else if (r < 0.63 && live.length) s.toggleFavorite(pick(live).id);
        else if (r < 0.66 && live.length) s.moveNote(pick(live).id, st.notebooks.length && rand() < 0.7 ? pick(st.notebooks).id : null);
        else if (r < 0.7) s.createNotebook(pick(WORDS), st.stacks.length && rand() < 0.5 ? pick(st.stacks).id : null);
        else if (r < 0.72 && st.notebooks.length) s.renameNotebook(pick(st.notebooks).id, pick(WORDS));
        else if (r < 0.74 && st.notebooks.length) s.deleteNotebook(pick(st.notebooks).id);
        else if (r < 0.76) s.createStack(pick(WORDS));
        else if (r < 0.78 && st.notebooks.length) s.setStack(pick(st.notebooks).id, st.stacks.length && rand() < 0.7 ? pick(st.stacks).id : null);
        else if (r < 0.8 && st.stacks.length) s.renameStack(pick(st.stacks).id, pick(WORDS));
        else if (r < 0.81 && st.stacks.length) s.deleteStack(pick(st.stacks).id);
        else if (r < 0.84) s.createProject(pick(WORDS));
        else if (r < 0.88 && st.projects.length) s.addChapter(pick(st.projects).id);
        else if (r < 0.9 && st.projects.length) s.addPart(pick(st.projects).id, pick(WORDS));
        else if (r < 0.92 && st.chapters.length) {
          const c = pick(st.chapters);
          s.setChapterDoc(c.id, md(`${toMarkdown(c.doc).trim()}\n\n${pick(WORDS)} ${pick(WORDS)}\n`));
        } else if (r < 0.93 && st.chapters.length) s.setChapterTitle(pick(st.chapters).id, pick(WORDS));
        else if (r < 0.94 && st.chapters.length) s.setChapterStatus(pick(st.chapters).id, pick(['todo', 'draft', 'revised', 'done'] as const));
        else if (r < 0.95 && st.projects.length) {
          const p = pick(st.projects);
          if (p.outline.length) s.moveOutlineItem(p.id, pick(p.outline).id, Math.floor(rand() * (p.outline.length + 1)));
        } else if (r < 0.955 && st.chapters.length) s.deleteChapter(pick(st.chapters).id);
        else if (r < 0.96 && st.projects.length) s.renameProject(pick(st.projects).id, pick(WORDS));
        else if (r < 0.962 && st.projects.length) s.deleteProject(pick(st.projects).id);
        else await d.engine.sync();
        s.flush();
      }
      // Settle: everyone syncs until nothing changes.
      for (let round = 0; round < 3; round++) for (const d of devices) await d.engine.sync();
      const want = shape(devices[0].store);
      for (const d of devices.slice(1)) expect(shape(d.store), `seed ${seed}`).toEqual(want);
      // A newcomer reading only the files sees the same.
      const fresh = await device(cloud);
      await fresh.engine.sync();
      expect(shape(fresh.store), `seed ${seed} (from files)`).toEqual(want);
      cloud.log = [];
      for (const d of devices) await d.engine.sync();
      expect(cloud.log, `seed ${seed} (quiet)`).toEqual([]);
    }
  }, 1_200_000);
});

describe('syncing projects', () => {
  async function pair() {
    const cloud = new MemoryProvider(now);
    return { cloud, mac: await device(cloud), phone: await device(cloud) };
  }
  const outline = (store: AppStore, id: string) => store.project(id)!.outline.map((x) => (x.type === 'part' ? `[${x.title}]` : store.chapter(x.id)!.title));

  it('writes a project as a folder of numbered chapters, and reads it back', async () => {
    const { cloud, mac, phone } = await pair();
    const p = mac.store.createProject('The Lighthouse');
    const c1 = mac.store.getState().chapters[0];
    mac.store.setChapterTitle(c1.id, 'The Keeper');
    mac.store.setChapterDoc(c1.id, md('The lamp had not been lit.\n'));
    mac.store.setChapterStatus(c1.id, 'draft');
    mac.store.setChapterSynopsis(c1.id, 'Mara climbs: the stairs.');
    mac.store.setChapterGoal(c1.id, 2000);
    const part = mac.store.addPart(p.id, 'Part Two')!;
    const c2 = mac.store.addChapter(p.id)!;
    mac.store.setChapterTitle(c2.id, 'Salt');
    mac.store.setProjectGoal(p.id, 80000);
    mac.store.flush();
    await mac.engine.sync();
    expect(fileList(cloud)).toEqual([
      '.crumpet/vault.json',
      'Projects/The Lighthouse/01 The Keeper.md',
      'Projects/The Lighthouse/02 Salt.md',
      'Projects/The Lighthouse/project.json',
    ]);
    expect(cloud.files.get('Projects/The Lighthouse/01 The Keeper.md')!.text).toContain('status: draft\nsynopsis: "Mara climbs: the stairs."\ngoal: 2000');
    await phone.engine.sync();
    expect(shape(phone.store)).toEqual(shape(mac.store));
    expect(outline(phone.store, p.id)).toEqual(['The Keeper', '[Part Two]', 'Salt']);
    expect(phone.store.project(p.id)?.outline.find((x) => x.id === part)).toBeTruthy();
    // Nothing more to do.
    cloud.log = [];
    await mac.engine.sync();
    await phone.engine.sync();
    expect(cloud.log).toEqual([]);
  });

  it('renumbers files when chapters are reordered, while text edits elsewhere still merge', async () => {
    const { cloud, mac, phone } = await pair();
    const p = mac.store.createProject('Book');
    const a = mac.store.getState().chapters[0];
    mac.store.setChapterTitle(a.id, 'A');
    mac.store.setChapterDoc(a.id, md('First.\n\nSecond.\n'));
    const b = mac.store.addChapter(p.id)!;
    mac.store.setChapterTitle(b.id, 'B');
    mac.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    mac.store.moveOutlineItem(p.id, b.id, 0);
    phone.store.setChapterDoc(a.id, md('First.\n\nSecond, from the phone.\n'));
    phone.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    await mac.engine.sync();
    expect([...cloud.files.keys()].filter((k) => k.endsWith('.md')).sort()).toEqual(['Projects/Book/01 B.md', 'Projects/Book/02 A.md']);
    expect(outline(mac.store, p.id)).toEqual(['B', 'A']);
    expect(toMarkdown(mac.store.chapter(a.id)!.doc)).toBe('First.\n\nSecond, from the phone.\n');
    expect(shape(phone.store)).toEqual(shape(mac.store));
  });

  it('keeps chapters and parts added on both devices at once', async () => {
    const { mac, phone } = await pair();
    const p = mac.store.createProject('Both');
    mac.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    const fromMac = mac.store.addChapter(p.id)!;
    mac.store.setChapterTitle(fromMac.id, 'Mac chapter');
    phone.store.addPart(p.id, 'Phone part');
    const fromPhone = phone.store.addChapter(p.id)!;
    phone.store.setChapterTitle(fromPhone.id, 'Phone chapter');
    mac.store.flush();
    phone.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    await mac.engine.sync();
    expect(outline(mac.store, p.id)).toEqual(['Chapter 1', 'Mac chapter', '[Phone part]', 'Phone chapter']);
    expect(shape(phone.store)).toEqual(shape(mac.store));
  });

  it('follows renames: a project folder, and a chapter file renamed in Finder', async () => {
    const { cloud, mac } = await pair();
    const p = mac.store.createProject('Draft');
    mac.store.setChapterTitle(mac.store.getState().chapters[0].id, 'Opening');
    mac.store.flush();
    await mac.engine.sync();
    mac.store.renameProject(p.id, 'Final');
    await mac.engine.sync();
    expect(fileList(cloud)).toEqual(['.crumpet/vault.json', 'Projects/Final/01 Opening.md', 'Projects/Final/project.json']);
    expect([...cloud.folders].sort()).toEqual(['.crumpet', 'Projects', 'Projects/Final']);
    await cloud.move('Projects/Final/01 Opening.md', 'Projects/Final/01 Beginning.md');
    await mac.engine.sync();
    expect(mac.store.getState().chapters[0].title).toBe('Beginning');
  });

  it('lives alongside a stack that happens to be called Projects', async () => {
    const { cloud, mac, phone } = await pair();
    const st = mac.store.createStack('Projects');
    const nb = mac.store.createNotebook('Ideas', st.id);
    mac.store.createNote({ title: 'An idea', notebookId: nb.id });
    mac.store.createProject('Novel');
    mac.store.flush();
    await mac.engine.sync();
    expect(fileList(cloud)).toEqual(['.crumpet/vault.json', 'Projects/Ideas/An idea.md', 'Projects/Novel/01 Chapter 1.md', 'Projects/Novel/project.json']);
    await phone.engine.sync();
    expect(shape(phone.store)).toEqual(shape(mac.store));
    expect(phone.store.getState().notes.map((n) => n.title)).toEqual(['An idea']);
  });

  it('syncs a project’s styles and page setup, keeping changes made to each on different devices', async () => {
    const { cloud, mac, phone } = await pair();
    const p = mac.store.createProject('Styled');
    mac.store.setProjectStyles(p.id, presetSheet('book'));
    mac.store.setProjectPage(p.id, { ...defaultPage(), size: 'a5' });
    mac.store.flush();
    await mac.engine.sync();
    expect(JSON.parse(cloud.files.get('Projects/Styled/project.json')!.text).page.size).toBe('a5');
    await phone.engine.sync();
    expect(phone.store.project(p.id)?.styles).toEqual(presetSheet('book'));
    expect(phone.store.project(p.id)?.page?.size).toBe('a5');
    // One device changes the styles while the other changes the page.
    mac.store.setProjectStyles(p.id, presetSheet('modern'));
    phone.store.setProjectPage(p.id, { ...phone.store.project(p.id)!.page!, pageNumbers: false });
    await mac.engine.sync();
    await phone.engine.sync();
    await mac.engine.sync();
    for (const d of [mac, phone]) {
      expect(d.store.project(p.id)?.styles).toEqual(presetSheet('modern'));
      expect(d.store.project(p.id)?.page).toMatchObject({ size: 'a5', pageNumbers: false });
    }
    cloud.log = [];
    await mac.engine.sync();
    await phone.engine.sync();
    expect(cloud.log).toEqual([]);
  });

  it('deletes a project everywhere', async () => {
    const { cloud, mac, phone } = await pair();
    const p = mac.store.createProject('Gone');
    mac.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    phone.store.deleteProject(p.id);
    await phone.engine.sync();
    await mac.engine.sync();
    expect(mac.store.getState().projects).toEqual([]);
    expect([...cloud.files.keys()]).toEqual(['.crumpet/vault.json']);
  });
});

describe('shared settings', () => {
  it('note styles and page setup reach other devices; the newer change wins', async () => {
    const cloud = new MemoryProvider();
    const mac = await device(cloud);
    const phone = await device(cloud);
    mac.store.createNote({ title: 'Hello', doc: md('Hi') });
    const page = { ...defaultPage(), size: 'a5' as const };
    mac.store.updateSettings({ notePage: page });
    await mac.engine.sync();
    expect(cloud.files.get('.crumpet/vault.json')!.text).toContain('"notePage"');
    await phone.engine.sync();
    expect(phone.store.getState().settings.notePage).toEqual(page);
    // Each changes something different: both changes are kept.
    phone.store.updateSettings({ noteStyles: presetSheet('manuscript') });
    mac.store.updateSettings({ notePage: { ...page, size: 'book' } });
    await phone.engine.sync();
    await mac.engine.sync();
    await phone.engine.sync();
    expect(mac.store.getState().settings.notePage?.size).toBe('book');
    expect(phone.store.getState().settings.notePage?.size).toBe('book');
    expect(mac.store.getState().settings.noteStyles).toEqual(presetSheet('manuscript'));
    // Both change the same thing: the later change wins.
    phone.store.updateSettings({ notePage: { ...page, size: 'legal' } });
    mac.store.updateSettings({ notePage: { ...page, size: 'letter' } });
    await phone.engine.sync();
    await mac.engine.sync();
    await phone.engine.sync();
    expect(phone.store.getState().settings.notePage?.size).toBe('letter');
    // Back to the defaults on one device: the other follows.
    mac.store.updateSettings({ notePage: undefined, noteStyles: undefined });
    await mac.engine.sync();
    await phone.engine.sync();
    expect(phone.store.getState().settings.notePage).toBeUndefined();
  });
});

describe('project research', () => {
  it('lives in the project’s Research folder and comes back as research on another device', async () => {
    const cloud = new MemoryProvider();
    const mac = await device(cloud);
    const phone = await device(cloud);
    const p = mac.store.createProject('The Lighthouse');
    const r = mac.store.addResearchNote(p.id, { title: 'Lamps', doc: md('Fresnel lenses.') });
    mac.store.createNote({ title: 'Shopping', doc: md('Bread') });
    mac.store.flush();
    await mac.engine.sync();
    expect([...cloud.files.keys()].filter((k) => k.endsWith('.md')).sort()).toEqual(['Projects/The Lighthouse/01 Chapter 1.md', 'Projects/The Lighthouse/Research/Lamps.md', 'Shopping.md']);
    expect(cloud.files.has('Projects/The Lighthouse/Research/Lamps.md')).toBe(true);
    await phone.engine.sync();
    const there = phone.store.note(r.id);
    expect(there?.projectId).toBe(p.id);
    expect(phone.store.getState().notebooks).toEqual([]);
    expect(shape(phone.store)).toEqual(shape(mac.store));
    // Renaming the project moves its research along.
    mac.store.renameProject(p.id, 'Lamp');
    mac.store.flush();
    await mac.engine.sync();
    expect(cloud.files.has('Projects/Lamp/Research/Lamps.md')).toBe(true);
    expect([...cloud.files.keys()].some((k) => k.startsWith('Projects/The Lighthouse'))).toBe(false);
    expect([...cloud.folders].some((k) => k.startsWith('Projects/The Lighthouse'))).toBe(false);
    // Nothing more to do.
    cloud.log = [];
    await mac.engine.sync();
    await phone.engine.sync();
    expect(phone.store.note(r.id)?.projectId).toBe(p.id);
    await mac.engine.sync();
    expect(cloud.log.filter((l) => !l.startsWith('write .crumpet'))).toEqual([]);
  });
});

describe('characters and places', () => {
  it('sync in project.json, each one merging on its own', async () => {
    const cloud = new MemoryProvider();
    const mac = await device(cloud);
    const phone = await device(cloud);
    const p = mac.store.createProject('The Lighthouse');
    const mara = mac.store.addCastMember(p.id, 'character', 'Mara')!;
    const rock = mac.store.addCastMember(p.id, 'place', 'Gull Rock')!;
    mac.store.flush();
    await mac.engine.sync();
    expect(cloud.files.get('Projects/The Lighthouse/project.json')!.text).toContain('"Gull Rock"');
    await phone.engine.sync();
    expect(phone.store.project(p.id)?.cast?.map((m) => m.name)).toEqual(['Mara', 'Gull Rock']);
    // Different changes on each device: both kept.
    mac.store.updateCastMember(p.id, mara.id, { description: 'The new keeper.' });
    phone.store.updateCastMember(p.id, rock.id, { aliases: ['the Rock'] });
    phone.store.addCastMember(p.id, 'character', 'Tam');
    await mac.engine.sync();
    await phone.engine.sync();
    await mac.engine.sync();
    const names = (s: AppStore) => s.project(p.id)?.cast?.map((m) => `${m.name}|${m.description}|${m.aliases.join(',')}`);
    expect(names(mac.store)).toEqual(['Mara|The new keeper.|', 'Gull Rock||the Rock', 'Tam||']);
    expect(names(phone.store)).toEqual(names(mac.store));
  });
});
