import { describe, expect, it } from 'vitest';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import { blockText } from '../../src/data/selectors';
import { bookParts, finalDoc } from '../../src/data/wordfiles';

async function book() {
  const store = new AppStore(new MemoryStorage(), () => 1_700_000_000_000);
  await store.load();
  store.updateSettings({ name: 'Alex Rowan' });
  const p = store.createProject('The Lighthouse');
  const first = store.getState().chapters.find((c) => c.projectId === p.id)!;
  store.setChapterTitle(first.id, 'Arrival');
  store.setChapterDoc(first.id, fromMarkdown('The boat {++left++}{--went--} her {==there==}{>>Sam (2026-01-01): which steps?<<}.\n'));
  const second = store.addChapter(p.id)!;
  store.setChapterTitle(second.id, 'Storm');
  store.addPart(p.id, 'Part One');
  store.moveOutlineItem(p.id, store.project(p.id)!.outline.at(-1)!.id, 0);
  return { store, project: store.project(p.id)! };
}

describe('exporting a book', () => {
  it('is its chapters under their titles, as before, with nothing asked for', async () => {
    const { store, project } = await book();
    expect(bookParts(store.getState(), project).map((p) => p.heading)).toEqual(['Arrival', 'Storm']);
  });

  it('adds a title page and a page for each part when asked', async () => {
    const { store, project } = await book();
    const parts = bookParts(store.getState(), project, { titlePage: true, partHeadings: true });
    expect(parts.map((p) => p.heading)).toEqual([undefined, 'Part One', 'Arrival', 'Storm']);
    const title = parts[0].doc.blocks.map(blockText).filter(Boolean);
    expect(title).toEqual(['The Lighthouse', 'by Alex Rowan', 'About 100 words']);
    expect(parts[0].doc.blocks.find((b) => blockText(b) === 'The Lighthouse')?.style).toBe('title');
  });

  it('reads as if every change were accepted, without comments, unless they’re kept', async () => {
    const { store, project } = await book();
    const clean = bookParts(store.getState(), project, { notes: false })[0].doc;
    expect(blockText(clean.blocks[0])).toBe('The boat left her there.');
    expect(clean.blocks[0].runs.some((r) => r.change || r.comment)).toBe(false);
    const kept = bookParts(store.getState(), project, { notes: true })[0].doc;
    expect(kept.blocks[0].runs.some((r) => r.change)).toBe(true);
    expect(kept.blocks[0].runs.some((r) => r.comment)).toBe(true);
  });

  it('leaves a doc with nothing to clean as it was', () => {
    const doc = fromMarkdown('Plain words.\n');
    expect(finalDoc(doc)).toBe(doc);
  });
});
