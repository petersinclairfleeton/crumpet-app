import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import { chapterDrafts, draftBadge, draftInUse, nextBookDraftName, nextDraftName } from '../../src/data/drafts';
import { SyncEngine, type SyncState } from '../../src/sync/engine';
import { MemoryProvider } from '../../src/sync/provider';
import { localTree } from '../../src/sync/tree';

let clock = 1_700_000_000_000;
const now = () => (clock += 1000);
let ids = 0;
const newId = () => `id-${++ids}`;
const md = (text: string) => fromMarkdown(text);

async function device(provider: MemoryProvider) {
  const store = new AppStore(new MemoryStorage(), now);
  await store.load();
  let saved: SyncState | null = null;
  const engine = new SyncEngine(store, provider, { load: async () => (saved ? structuredClone(saved) : null), save: async (s) => void (saved = structuredClone(s)) }, { now, newId });
  return { store, engine };
}

async function book() {
  const store = new AppStore(new MemoryStorage(), now);
  await store.load();
  store.createProject('Book');
  const c = store.getState().chapters[0];
  store.setChapterTitle(c.id, 'Opening');
  store.setChapterDoc(c.id, md('The first try.\n'));
  return { store, id: c.id };
}

const text = (store: AppStore, id: string) => toMarkdown(store.chapter(id)!.doc);
const names = (store: AppStore, id: string) => chapterDrafts(store.chapter(id)!).map((d) => `${d.name}${d.inUse ? '*' : ''}`);
const fileList = (cloud: MemoryProvider) => [...cloud.files.keys()].filter((f) => !f.startsWith('.crumpet/')).sort();

describe('drafts of a chapter', () => {
  it('names drafts', () => {
    expect(nextDraftName(['Draft 1'])).toBe('Draft 2');
    expect(nextDraftName(['Draft 1', 'Rewrite', 'Draft 4'])).toBe('Draft 5');
    expect(nextDraftName(['First go'])).toBe('Draft 2');
    expect(draftBadge('Draft 12')).toBe('D12');
  });

  it('starts a new draft as a copy or a blank page, and the book uses it', async () => {
    const { store, id } = await book();
    expect(names(store, id)).toEqual(['Draft 1*']);
    const d2 = store.newDraft(id)!;
    expect(names(store, id)).toEqual(['Draft 1', 'Draft 2*']);
    expect(text(store, id)).toBe('The first try.\n');
    store.setChapterDoc(id, md('The second try.\n'));
    store.newDraft(id, { blank: true, note: 'From scratch' });
    expect(names(store, id)).toEqual(['Draft 1', 'Draft 2', 'Draft 3*']);
    expect(text(store, id)).toBe('');
    expect(store.chapter(id)!.draft?.note).toBe('From scratch');
    // Back to the second.
    store.useDraft(id, d2);
    expect(names(store, id)).toEqual(['Draft 1', 'Draft 2*', 'Draft 3']);
    expect(text(store, id)).toBe('The second try.\n');
  });

  it('edits, renames and deletes drafts the book is not using', async () => {
    const { store, id } = await book();
    store.newDraft(id);
    const first = chapterDrafts(store.chapter(id)!)[0];
    expect(first.id).toBe(id);
    store.setDraftDoc(id, first.id, md('The first try, mended.\n'));
    store.setDraftInfo(id, first.id, { name: 'Rough', note: 'Kept for the ending' });
    const again = chapterDrafts(store.chapter(id)!)[0];
    expect([again.name, again.note, toMarkdown(again.doc)]).toEqual(['Rough', 'Kept for the ending', 'The first try, mended.\n']);
    // Deleting the one in use: the book uses the other.
    store.deleteDraft(id, draftInUse(store.chapter(id)!));
    expect(names(store, id)).toEqual(['Rough*']);
    expect(text(store, id)).toBe('The first try, mended.\n');
    // The last draft can't go.
    store.deleteDraft(id, draftInUse(store.chapter(id)!));
    expect(names(store, id)).toEqual(['Rough*']);
  });

  it('a chapter whose drafts all went but its first needs nothing extra', async () => {
    const { store, id } = await book();
    const d2 = store.newDraft(id)!;
    store.deleteDraft(id, d2);
    const c = store.chapter(id)!;
    expect(c.draft).toBeUndefined();
    expect(c.drafts).toBeUndefined();
  });
});

describe('drafts of the whole book', () => {
  it('starts a draft of every chapter at once, named for the book', async () => {
    const { store, id } = await book();
    const p = store.getState().projects[0];
    const two = store.addChapter(p.id)!;
    store.setChapterDoc(two.id, md('Chapter two.\n'));
    // One chapter is already on its second draft: the book's next is the third.
    store.newDraft(id);
    expect(nextBookDraftName(store.getState().chapters)).toBe('Draft 3');
    expect(store.newBookDraft(p.id, { note: 'Cut the subplot' })).toBe('Draft 3');
    expect(names(store, id)).toEqual(['Draft 1', 'Draft 2', 'Draft 3*']);
    expect(names(store, two.id)).toEqual(['Draft 1', 'Draft 3*']);
    expect(text(store, two.id)).toBe('Chapter two.\n');
    expect(store.project(p.id)!.draft).toMatchObject({ name: 'Draft 3', note: 'Cut the subplot' });
    store.setBookDraftNote(p.id, 'Cut the subplot, sooner');
    expect(store.project(p.id)!.draft!.note).toBe('Cut the subplot, sooner');
    // Blank pages.
    store.newBookDraft(p.id, { blank: true });
    expect(text(store, two.id)).toBe('');
    expect(store.project(p.id)!.draft!.name).toBe('Draft 4');
  });
});

describe('syncing drafts', () => {
  async function pair() {
    const cloud = new MemoryProvider(now);
    const mac = await device(cloud);
    const phone = await device(cloud);
    mac.store.createProject('Book');
    const id = mac.store.getState().chapters[0].id;
    mac.store.setChapterTitle(id, 'Opening');
    mac.store.setChapterDoc(id, md('One.\n\nTwo.\n'));
    mac.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    return { cloud, mac, phone, id };
  }

  it('keeps drafts the book is not using in the Drafts folder, and reads them back', async () => {
    const { cloud, mac, phone, id } = await pair();
    mac.store.newDraft(id, { note: 'Tighter' });
    mac.store.setChapterDoc(id, md('One, again.\n'));
    mac.store.flush();
    await mac.engine.sync();
    expect(fileList(cloud)).toEqual(['Projects/Book/01 Opening.md', 'Projects/Book/Drafts/Draft 1/01 Opening.md', 'Projects/Book/project.json']);
    expect(cloud.files.get('Projects/Book/01 Opening.md')!.text).toContain('draft-name: Draft 2\ndraft-note: Tighter');
    expect(cloud.files.get('Projects/Book/Drafts/Draft 1/01 Opening.md')!.text).toContain(`chapter: ${id}`);
    await phone.engine.sync();
    expect(localTree(phone.store.getState())).toEqual(localTree(mac.store.getState()));
    expect(names(phone.store, id)).toEqual(['Draft 1', 'Draft 2*']);
    // Nothing more to do.
    cloud.log = [];
    await mac.engine.sync();
    await phone.engine.sync();
    expect(cloud.log).toEqual([]);
    // Back to the first: the files swap, and the empty folder goes.
    phone.store.useDraft(id, id);
    await phone.engine.sync();
    expect(fileList(cloud)).toEqual(['Projects/Book/01 Opening.md', 'Projects/Book/Drafts/Draft 2/01 Opening.md', 'Projects/Book/project.json']);
    expect([...cloud.files.keys()].some((k) => k.endsWith('Draft 1'))).toBe(false);
    await mac.engine.sync();
    expect(text(mac.store, id)).toBe('One.\n\nTwo.\n');
  });

  it('never mixes drafts: writing on one device while the other starts a new draft', async () => {
    const { mac, phone, id } = await pair();
    mac.store.newDraft(id, { blank: true });
    mac.store.setChapterDoc(id, md('Brand new.\n'));
    mac.store.flush();
    phone.store.setChapterDoc(id, md('One.\n\nTwo, from the phone.\n'));
    phone.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    await mac.engine.sync();
    for (const s of [mac.store, phone.store]) {
      expect(names(s, id)).toEqual(['Draft 1', 'Draft 2*']);
      expect(text(s, id)).toBe('Brand new.\n');
      expect(toMarkdown(chapterDrafts(s.chapter(id)!)[0].doc)).toBe('One.\n\nTwo, from the phone.\n');
    }
    expect(localTree(phone.store.getState())).toEqual(localTree(mac.store.getState()));
  });

  it('merges writing in the same old draft on both devices', async () => {
    const { mac, phone, id } = await pair();
    mac.store.newDraft(id);
    mac.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    mac.store.setDraftDoc(id, id, md('One, from the Mac.\n\nTwo.\n'));
    phone.store.setDraftDoc(id, id, md('One.\n\nTwo, from the phone.\n'));
    mac.store.flush();
    phone.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    await mac.engine.sync();
    for (const s of [mac.store, phone.store]) expect(toMarkdown(chapterDrafts(s.chapter(id)!)[0].doc)).toBe('One, from the Mac.\n\nTwo, from the phone.\n');
  });

  it('syncs the book\'s draft in project.json', async () => {
    const { cloud, mac, phone } = await pair();
    const p = mac.store.getState().projects[0];
    mac.store.newBookDraft(p.id, { note: 'Faster' });
    await mac.engine.sync();
    expect(cloud.files.get('Projects/Book/project.json')!.text).toContain('"draft"');
    await phone.engine.sync();
    expect(phone.store.project(p.id)!.draft).toMatchObject({ name: 'Draft 2', note: 'Faster' });
    expect(localTree(phone.store.getState())).toEqual(localTree(mac.store.getState()));
  });

  it('deleting a chapter deletes its drafts', async () => {
    const { cloud, mac, phone, id } = await pair();
    const c2 = mac.store.addChapter(mac.store.getState().projects[0].id)!;
    mac.store.newDraft(id);
    mac.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    phone.store.deleteChapter(id);
    await phone.engine.sync();
    expect(fileList(cloud)).toEqual(['Projects/Book/01 Chapter 2.md', 'Projects/Book/project.json']);
    await mac.engine.sync();
    expect(mac.store.getState().chapters.map((c) => c.id)).toEqual([c2.id]);
  });
});
