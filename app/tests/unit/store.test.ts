import { describe, expect, it } from 'vitest';
import { makeBlock } from '@crumpet/editor/model';
import { MemoryStorage, openStorage } from '../../src/data/db';
import { AppStore, cleanTag, visibleIn } from '../../src/data/store';
import { seed } from '../../src/data/seed';
import { groupByDate, listedNotes, matches, notebookTree, preview, wordCount } from '../../src/data/selectors';

const DAY = 86_400_000;

async function fresh(now = () => 1_700_000_000_000) {
  const storage = new MemoryStorage();
  const store = new AppStore(storage, now);
  await store.load();
  return { store, storage };
}

describe('store', () => {
  it('starts with an Inbox notebook and puts new notes there', async () => {
    const { store } = await fresh();
    expect(store.getState().notebooks.map((n) => n.name)).toEqual(['Inbox']);
    const note = store.createNote();
    expect(store.notebook(note.notebookId)?.name).toBe('Inbox');
    expect(store.getState().selectedId).toBe(note.id);
  });

  it('new notes go into the open notebook, get the open tag, or are pinned in Shortcuts', async () => {
    const { store } = await fresh();
    const nb = store.createNotebook('Novel');
    store.setView({ kind: 'notebook', id: nb.id });
    expect(store.createNote().notebookId).toBe(nb.id);
    store.setView({ kind: 'tag', tag: 'ideas' });
    expect(store.createNote().tags).toEqual(['ideas']);
    store.setView({ kind: 'shortcuts' });
    expect(store.createNote().pinned).toBe(true);
  });

  it('saves to a real database and loads it back', async () => {
    const name = `test-${Math.random()}`;
    const a = new AppStore(await openStorage(name));
    await a.load();
    const nb = a.createNotebook('Journal', '2 Areas');
    const note = a.createNote({ notebookId: nb.id, title: 'Hello', doc: { blocks: [makeBlock('paragraph', 'Body text')] } });
    a.addTag(note.id, '#Daily Notes');
    a.setTitle(note.id, 'Hello again');
    a.flush();
    await new Promise((r) => setTimeout(r, 50));

    const b = new AppStore(await openStorage(name));
    await b.load();
    const loaded = b.note(note.id)!;
    expect(loaded.title).toBe('Hello again');
    expect(loaded.tags).toEqual(['daily-notes']);
    expect(loaded.doc.blocks[0].runs[0].text).toBe('Body text');
    expect(b.notebook(nb.id)).toMatchObject({ name: 'Journal', stack: '2 Areas' });
  });

  it('waits for typing to pause before saving a note body, and flush saves at once', async () => {
    const { store, storage } = await fresh();
    const note = store.createNote();
    store.setDoc(note.id, { blocks: [makeBlock('paragraph', 'draft')] });
    expect(storage.notes.get(note.id)!.doc.blocks[0].runs).toEqual([]);
    store.flush();
    await Promise.resolve();
    expect(storage.notes.get(note.id)!.doc.blocks[0].runs[0].text).toBe('draft');
  });

  it('moves notes to Trash and back, and deletes forever', async () => {
    const { store, storage } = await fresh();
    const a = store.createNote({ title: 'a' });
    const b = store.createNote({ title: 'b' });
    store.trashNote(a.id);
    expect(visibleIn(store.getState(), { kind: 'all' }).map((n) => n.title)).toEqual(['b']);
    expect(visibleIn(store.getState(), { kind: 'trash' }).map((n) => n.title)).toEqual(['a']);
    store.restoreNote(a.id);
    expect(visibleIn(store.getState(), { kind: 'trash' })).toEqual([]);
    store.trashNote(b.id);
    store.deleteForever(b.id);
    await Promise.resolve();
    expect(store.note(b.id)).toBeUndefined();
    expect(storage.notes.has(b.id)).toBe(false);
  });

  it('empties notes that have been in the Trash for over 30 days when loading', async () => {
    let t = 1_700_000_000_000;
    const storage = new MemoryStorage();
    const s1 = new AppStore(storage, () => t);
    await s1.load();
    const old = s1.createNote({ title: 'old' });
    const recent = s1.createNote({ title: 'recent' });
    s1.trashNote(old.id);
    t += 20 * DAY;
    s1.trashNote(recent.id);
    await Promise.resolve();
    t += 15 * DAY;
    const s2 = new AppStore(storage, () => t);
    await s2.load();
    expect(s2.note(old.id)).toBeUndefined();
    expect(s2.note(recent.id)?.title).toBe('recent');
  });

  it('deleting a notebook moves its notes to Trash; restoring sends them to Inbox', async () => {
    const { store } = await fresh();
    const nb = store.createNotebook('Old project');
    const note = store.createNote({ notebookId: nb.id, title: 'x' });
    store.deleteNotebook(nb.id);
    expect(store.notebook(nb.id)).toBeUndefined();
    expect(store.note(note.id)?.trashedAt).not.toBeNull();
    store.restoreNote(note.id);
    expect(store.notebook(store.note(note.id)!.notebookId)?.name).toBe('Inbox');
  });

  it('never deletes the last notebook', async () => {
    const { store } = await fresh();
    store.deleteNotebook(store.getState().notebooks[0].id);
    expect(store.getState().notebooks).toHaveLength(1);
  });

  it('renames stacks and groups notebooks into a tree', async () => {
    const { store } = await fresh();
    store.createNotebook('B', '1 Projects');
    store.createNotebook('A', '1 Projects');
    store.createNotebook('Journal', '2 Areas');
    store.renameStack('1 Projects', 'Projects');
    const tree = notebookTree(store.getState().notebooks);
    expect(tree.loose.map((n) => n.name)).toEqual(['Inbox']);
    expect(tree.stacks.map((s) => [s.name, s.notebooks.map((n) => n.name)])).toEqual([
      ['2 Areas', ['Journal']],
      ['Projects', ['A', 'B']],
    ]);
  });

  it('cleans tags', () => {
    expect(cleanTag('  #Big Idea ')).toBe('big-idea');
    expect(cleanTag('###')).toBe('');
  });
});

describe('selectors', () => {
  it('searches titles, bodies, tags and notebook names with every word required', async () => {
    const { store } = await fresh();
    const nb = store.createNotebook('Lighthouse');
    store.createNote({ notebookId: nb.id, title: 'Opening', doc: { blocks: [makeBlock('paragraph', 'She counted the steps')] }, tags: ['draft'] });
    store.createNote({ title: 'Shopping', doc: { blocks: [makeBlock('paragraph', 'milk, eggs')] } });
    const titles = (q: string) => {
      store.setQuery(q);
      return listedNotes(store.getState()).map((n) => n.title);
    };
    expect(titles('steps counted')).toEqual(['Opening']);
    expect(titles('#draft')).toEqual(['Opening']);
    expect(titles('lighthouse')).toEqual(['Opening']);
    expect(titles('EGGS')).toEqual(['Shopping']);
    expect(titles('steps eggs')).toEqual([]);
    expect(matches(store.getState().notes[0], '')).toBe(true);
  });

  it('groups by Today, Yesterday, This week and month', () => {
    const now = new Date(2026, 9, 5, 15, 0).getTime();
    const at = (d: Date) => ({ updatedAt: d.getTime() }) as never;
    const groups = groupByDate(
      [at(new Date(2026, 9, 5, 9)), at(new Date(2026, 9, 4, 22)), at(new Date(2026, 9, 1)), at(new Date(2026, 8, 20)), at(new Date(2025, 11, 2))],
      now,
    );
    expect(groups.map((g) => [g.label, g.notes.length])).toEqual([
      ['Today', 1],
      ['Yesterday', 1],
      ['This week', 1],
      ['September', 1],
      ['December 2025', 1],
    ]);
  });

  it('makes previews and counts words', async () => {
    const { store } = await fresh();
    const n = store.createNote({ title: 'Two words', doc: { blocks: [makeBlock('heading1', 'A heading'), makeBlock('paragraph', 'and some body text that’s here')] } });
    expect(preview(n, 22)).toBe('A heading · and some…');
    expect(wordCount(n)).toBe(10);
  });

  it('seeds a first run with a welcome note and example notebooks', async () => {
    const s2 = new AppStore(new MemoryStorage());
    await s2.load((st) => seed(st));
    const st = s2.getState();
    expect(st.notes.length).toBeGreaterThan(3);
    expect(st.notes.some((n) => n.title === 'Welcome to Crumpet')).toBe(true);
    expect(notebookTree(st.notebooks).stacks.map((s) => s.name)).toContain('1 Projects');
    expect(listedNotes(st)[0].title).toBe('Welcome to Crumpet');
  });
});
