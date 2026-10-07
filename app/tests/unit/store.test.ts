import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { describe, expect, it } from 'vitest';
import { makeBlock } from '@crumpet/editor/model';
import { MemoryStorage, openStorage } from '../../src/data/db';
import { BUILT_IN_TEMPLATES, longDate } from '../../src/data/templates';
import { AppStore, DATA_VERSION, cleanTag, visibleIn } from '../../src/data/store';
import { groupByDate, listedNotes, matches, matchingNotebooks, notebookTree, preview, projectChapters, projectGoal, projectWords, wordCount } from '../../src/data/selectors';
import type { Note, Notebook } from '../../src/data/types';

const DAY = 86_400_000;

async function fresh(now = () => 1_700_000_000_000) {
  const storage = new MemoryStorage();
  const store = new AppStore(storage, now);
  await store.load();
  return { store, storage };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('a new Crumpet', () => {
  it('starts completely empty: no notebooks, stacks or notes', async () => {
    const { store } = await fresh();
    const s = store.getState();
    expect([s.notebooks, s.stacks, s.notes]).toEqual([[], [], []]);
    expect(s.selectedId).toBeNull();
  });

  it('lets you write a note before making any notebook', async () => {
    const { store } = await fresh();
    const note = store.createNote({ title: 'First thought' });
    expect(note.notebookId).toBeNull();
    expect(listedNotes(store.getState()).map((n) => n.title)).toEqual(['First thought']);
  });
});

describe('notes', () => {
  it('new notes go into the open notebook, get the open tag, or become Favorites', async () => {
    const { store } = await fresh();
    const nb = store.createNotebook('Novel');
    store.setView({ kind: 'notebook', id: nb.id });
    expect(store.createNote().notebookId).toBe(nb.id);
    store.setView({ kind: 'tag', tag: 'ideas' });
    expect(store.createNote().tags).toEqual(['ideas']);
    store.setView({ kind: 'favorites' });
    expect(store.createNote().favorite).toBe(true);
    store.setView({ kind: 'all' });
    expect(store.createNote().notebookId).toBeNull();
  });

  it('files a note in a notebook and takes it out again', async () => {
    const { store } = await fresh();
    const nb = store.createNotebook('Recipes');
    const note = store.createNote();
    store.moveNote(note.id, nb.id);
    expect(visibleIn(store.getState(), { kind: 'notebook', id: nb.id })).toHaveLength(1);
    store.moveNote(note.id, null);
    expect(visibleIn(store.getState(), { kind: 'notebook', id: nb.id })).toHaveLength(0);
  });

  it('saves to a real database and loads it back', async () => {
    const name = `test-${Math.random()}`;
    const a = new AppStore(await openStorage(name));
    await a.load();
    const st = a.createStack('2 Areas');
    const nb = a.createNotebook('Journal', st.id);
    const note = a.createNote({ notebookId: nb.id, title: 'Hello', doc: { blocks: [makeBlock('paragraph', 'Body text')] } });
    a.addTag(note.id, '#Daily Notes');
    a.toggleFavorite(note.id);
    a.setTitle(note.id, 'Hello again');
    a.flush();
    await new Promise((r) => setTimeout(r, 50));

    const b = new AppStore(await openStorage(name));
    await b.load();
    const loaded = b.note(note.id)!;
    expect(loaded).toMatchObject({ title: 'Hello again', tags: ['daily-notes'], favorite: true, notebookId: nb.id });
    expect(loaded.doc.blocks[0].runs[0].text).toBe('Body text');
    expect(b.notebook(nb.id)).toMatchObject({ name: 'Journal', stackId: st.id });
    expect(b.stack(st.id)?.name).toBe('2 Areas');
  });

  it('waits for typing to pause before saving a note body, and flush saves at once', async () => {
    const { store, storage } = await fresh();
    const note = store.createNote();
    store.setDoc(note.id, { blocks: [makeBlock('paragraph', 'draft')] });
    expect(storage.notes.get(note.id)!.doc.blocks[0].runs).toEqual([]);
    store.flush();
    await tick();
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
    await tick();
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
    await tick();
    t += 15 * DAY;
    const s2 = new AppStore(storage, () => t);
    await s2.load();
    expect(s2.note(old.id)).toBeUndefined();
    expect(s2.note(recent.id)?.title).toBe('recent');
  });

  it('cleans tags', () => {
    expect(cleanTag('  #Big Idea ')).toBe('big-idea');
    expect(cleanTag('###')).toBe('');
  });
});

describe('notebooks and stacks', () => {
  it('deleting a notebook moves its notes to Trash; restoring brings them back without a notebook', async () => {
    const { store } = await fresh();
    const nb = store.createNotebook('Old project');
    const note = store.createNote({ notebookId: nb.id, title: 'x' });
    store.deleteNotebook(nb.id);
    expect(store.getState().notebooks).toEqual([]); // even the last notebook can go
    expect(store.note(note.id)?.trashedAt).not.toBeNull();
    store.restoreNote(note.id);
    expect(store.note(note.id)?.notebookId).toBeNull();
  });

  it('creates, renames and deletes stacks; empty stacks show; deleting keeps the notebooks', async () => {
    const { store } = await fresh();
    const projects = store.createStack('1 Projects');
    store.createStack('3 Resources');
    const a = store.createNotebook('A', projects.id);
    store.createNotebook('B', projects.id);
    store.createNotebook('Loose');
    store.renameStack(projects.id, 'Projects');
    let tree = notebookTree(store.getState().stacks, store.getState().notebooks);
    expect(tree.loose.map((n) => n.name)).toEqual(['Loose']);
    expect(tree.stacks.map((s) => [s.stack.name, s.notebooks.map((n) => n.name)])).toEqual([
      ['3 Resources', []],
      ['Projects', ['A', 'B']],
    ]);
    store.setView({ kind: 'stack', id: projects.id });
    store.deleteStack(projects.id);
    tree = notebookTree(store.getState().stacks, store.getState().notebooks);
    expect(tree.loose.map((n) => n.name)).toEqual(['A', 'B', 'Loose']);
    expect(store.notebook(a.id)?.stackId).toBeNull();
    expect(store.getState().view).toEqual({ kind: 'all' });
  });

  it('moves a notebook between stacks and out of them', async () => {
    const { store } = await fresh();
    const s1 = store.createStack('One');
    const s2 = store.createStack('Two');
    const nb = store.createNotebook('N', s1.id);
    store.setStack(nb.id, s2.id);
    expect(store.notebook(nb.id)?.stackId).toBe(s2.id);
    store.setStack(nb.id, null);
    expect(store.notebook(nb.id)?.stackId).toBeNull();
    store.setStack(nb.id, 'no-such-stack');
    expect(store.notebook(nb.id)?.stackId).toBeNull();
  });

  it('shows notes from every notebook in a stack', async () => {
    const { store } = await fresh();
    const st = store.createStack('Work');
    const a = store.createNotebook('A', st.id);
    const b = store.createNotebook('B', st.id);
    store.createNote({ notebookId: a.id, title: 'in a' });
    store.createNote({ notebookId: b.id, title: 'in b' });
    store.createNote({ title: 'loose' });
    expect(visibleIn(store.getState(), { kind: 'stack', id: st.id }).map((n) => n.title).sort()).toEqual(['in a', 'in b']);
  });
});

describe('upgrading notes saved by the first version', () => {
  it('removes untouched example notes and notebooks, keeps the person’s own, and converts stacks and Shortcuts', async () => {
    const storage = new MemoryStorage();
    const t = 1_700_000_000_000;
    const legacyNb = (id: string, name: string, stack: string | null) => ({ id, name, color: '#C98A4B', stack, createdAt: t }) as unknown as Notebook;
    const legacyNote = (id: string, notebookId: string, title: string, edited: boolean, pinned = false) =>
      ({ id, notebookId, title, doc: { blocks: [makeBlock('paragraph', 'x')] }, tags: [], pinned, createdAt: t, updatedAt: edited ? t + 1000 : t, trashedAt: null }) as unknown as Note;
    for (const nb of [legacyNb('inbox', 'Inbox', null), legacyNb('novel', 'Novel: The Lighthouse', '1 Projects'), legacyNb('journal', 'Journal', '2 Areas'), legacyNb('mine', 'Recipes', '2 Areas')]) storage.notebooks.set(nb.id, nb);
    for (const n of [
      legacyNote('w', 'inbox', 'Welcome to Crumpet', false),
      legacyNote('o', 'novel', 'Opening scene, first pass', true, true), // edited, so it stays
      legacyNote('wr', 'journal', 'Weekly review', false, true),
      legacyNote('m', 'mine', 'Soda bread', false, true),
    ])
      storage.notes.set(n.id, n);
    storage.settings = { name: 'Peter', accent: '#D4A257', theme: 'dark', listStyle: 'cards' };

    const store = new AppStore(storage);
    await store.load();
    const s = store.getState();
    expect(s.notes.map((n) => n.title).sort()).toEqual(['Opening scene, first pass', 'Soda bread']);
    expect(s.notebooks.map((n) => n.name).sort()).toEqual(['Novel: The Lighthouse', 'Recipes']);
    expect(s.stacks.map((st) => st.name).sort()).toEqual(['1 Projects', '2 Areas']);
    expect(store.stack(store.notebook('mine')!.stackId)?.name).toBe('2 Areas');
    expect(store.note('m')?.favorite).toBe(true);
    expect('pinned' in store.note('m')!).toBe(false);
    expect(s.settings).toMatchObject({ name: 'Peter', theme: 'dark', dataVersion: DATA_VERSION });
    await tick();
    // It's saved, so the next load doesn't need to do it again.
    expect(storage.notes.has('w')).toBe(false);
    expect(storage.notebooks.has('inbox')).toBe(false);
    expect(storage.settings?.dataVersion).toBe(DATA_VERSION);
    const again = new AppStore(storage);
    await again.load();
    expect(again.getState().notes).toHaveLength(2);
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

  it('offers notebooks to jump to by their name or their stack’s name', async () => {
    const { store } = await fresh();
    const st = store.createStack('Projects');
    store.createNotebook('Novel', st.id);
    store.createNotebook('Recipes');
    store.setQuery('projects');
    expect(matchingNotebooks(store.getState()).map((n) => n.name)).toEqual(['Novel']);
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
});

describe('projects', () => {
  const outline = (store: AppStore, id: string) =>
    store.project(id)!.outline.map((x) => (x.type === 'part' ? `[${x.title}]` : store.chapter(x.id)!.title));

  it('start with one chapter, and grow by chapters and parts', async () => {
    const { store } = await fresh();
    const p = store.createProject('Novel');
    expect(store.getState().view).toEqual({ kind: 'project', id: p.id });
    expect(outline(store, p.id)).toEqual(['Chapter 1']);
    expect(store.getState().chapterId).toBe(p.outline[0].id);
    store.addPart(p.id);
    store.addChapter(p.id);
    store.addPart(p.id, 'Coda');
    store.addChapter(p.id);
    expect(outline(store, p.id)).toEqual(['Chapter 1', '[Part One]', 'Chapter 2', '[Coda]', 'Chapter 3']);
    const parts = projectChapters(store.project(p.id)!, store.getState().chapters).map((x) => x.part?.title ?? null);
    expect(parts).toEqual([null, 'Part One', 'Coda']);
  });

  it('reorder, rename and remove parts and chapters', async () => {
    const { store } = await fresh();
    const p = store.createProject('Essay');
    const c2 = store.addChapter(p.id)!;
    const c3 = store.addChapter(p.id)!;
    const part = store.addPart(p.id)!;
    store.moveOutlineItem(p.id, part, 0);
    store.moveOutlineItem(p.id, c3.id, 1);
    expect(outline(store, p.id)).toEqual(['[Part One]', 'Chapter 3', 'Chapter 1', 'Chapter 2']);
    store.moveOutlineItem(p.id, c3.id, 4);
    expect(outline(store, p.id)).toEqual(['[Part One]', 'Chapter 1', 'Chapter 2', 'Chapter 3']);
    store.renamePart(p.id, part, 'Beginnings');
    store.deletePart(p.id, part);
    expect(outline(store, p.id)).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3']);
    store.selectChapter(c2.id);
    store.deleteChapter(c2.id);
    expect(outline(store, p.id)).toEqual(['Chapter 1', 'Chapter 3']);
    expect(store.getState().chapterId).toBe(c3.id);
  });

  it('count words against goals, per chapter and for the project', async () => {
    const { store } = await fresh();
    const p = store.createProject('Book');
    const c1 = store.getState().chapters[0];
    store.setChapterDoc(c1.id, { blocks: [makeBlock('paragraph', 'One two three four.')] });
    const c2 = store.addChapter(p.id)!;
    store.setChapterDoc(c2.id, { blocks: [makeBlock('paragraph', 'Five six.')] });
    store.setChapterGoal(c1.id, 1000);
    store.setChapterGoal(c2.id, 500);
    const st = () => store.getState();
    expect(projectWords(store.project(p.id)!, st().chapters)).toBe(6);
    expect(projectGoal(store.project(p.id)!, st().chapters)).toBe(1500);
    store.setProjectGoal(p.id, 80000);
    expect(projectGoal(store.project(p.id)!, st().chapters)).toBe(80000);
    store.setChapterStatus(c1.id, 'done');
    store.setChapterSynopsis(c1.id, 'It begins.');
    expect(store.chapter(c1.id)).toMatchObject({ status: 'done', synopsis: 'It begins.', goal: 1000 });
  });

  it('are saved, and deleting one removes its chapters', async () => {
    const { store, storage } = await fresh();
    const p = store.createProject('Saved');
    const c = store.addChapter(p.id)!;
    store.setChapterTitle(c.id, 'Typed');
    store.flush();
    await tick();
    expect(storage.projects.get(p.id)?.outline).toHaveLength(2);
    expect(storage.chapters.get(c.id)?.title).toBe('Typed');
    const again = new AppStore(storage);
    await again.load();
    expect(again.getState().projects.map((x) => x.name)).toEqual(['Saved']);
    store.deleteProject(p.id);
    await tick();
    expect([storage.projects.size, storage.chapters.size]).toEqual([0, 0]);
    expect(store.getState().view).toEqual({ kind: 'all' });
  });
});

describe('saving', () => {
  it('keeps unsaved edits through a page close, and saves regularly during long typing', async () => {
    const mem = new Map<string, string>();
    const ls = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    Object.assign(globalThis, { localStorage: ls });
    try {
      let t = 1_700_000_000_000;
      const { store, storage } = await fresh(() => t);
      const n = store.createNote({ title: '' });
      await tick();
      store.setTitle(n.id, 'Unsaved title');
      // The page closes before the delayed save; the database write is lost with it.
      store.rescue();
      expect(mem.has('crumpet:unsaved')).toBe(true);
      const again = new AppStore(storage, () => t);
      await again.load();
      expect(again.note(n.id)?.title).toBe('Unsaved title');
      await tick();
      expect(storage.notes.get(n.id)?.title).toBe('Unsaved title');
      expect(mem.has('crumpet:unsaved')).toBe(false);
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});

describe('templates and the daily note', () => {
  it('opens one note per day in Daily notes, made from your Daily note template if you have one', async () => {
    const { store } = await fresh();
    const first = store.openToday();
    expect(store.notebook(first.notebookId)?.name).toBe('Daily notes');
    expect(first.title).toBe(longDate(first.createdAt));
    expect(store.openToday().id).toBe(first.id);
    expect(store.getState().selectedId).toBe(first.id);
    // Tomorrow, with a template of your own.
    store.createNote({ title: 'Daily note', notebookId: store.createNotebook('Templates').id, doc: fromMarkdown('## Plans for {{date}}\n') });
    store.trashNote(first.id);
    const next = store.openToday();
    expect(next.id).not.toBe(first.id);
    expect(toMarkdown(next.doc)).toBe(`## Plans for ${longDate(next.createdAt)}\n`);
  });

  it('starts notes from templates, and saves a note as one without leaving it', async () => {
    const { store } = await fresh();
    const meeting = BUILT_IN_TEMPLATES.find((t) => t.id === 'meeting')!;
    const n = store.newFromTemplate(meeting);
    expect(n.title).toBe(`Meeting, ${longDate(n.createdAt)}`);
    expect(toMarkdown(n.doc)).toContain('## Next steps\n\n- [ ]');
    const copy = store.saveAsTemplate(n.id)!;
    expect(store.notebook(copy.notebookId)?.name).toBe('Templates');
    expect(store.getState().selectedId).toBe(n.id);
  });
});
