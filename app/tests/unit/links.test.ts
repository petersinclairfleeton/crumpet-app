import { describe, expect, it, vi } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import { backlinks, findByTitle, linkedTitles, relinkDoc } from '../../src/data/links';

describe('links between notes', () => {
  it('finds what links where, and follows renames', () => {
    const doc = fromMarkdown('See [[The lighthouse]] and [[the LIGHTHOUSE|it]], not [[Mara]].\n');
    expect(linkedTitles(doc)).toEqual(['The lighthouse', 'the LIGHTHOUSE', 'Mara']);
    const moved = relinkDoc(doc, 'The lighthouse', 'The old light');
    expect(toMarkdown(moved)).toBe('See [[The old light]] and [[The old light|it]], not [[Mara]].\n');
    expect(relinkDoc(doc, 'Nothing', 'Else')).toBe(doc);
  });

  it('shows backlinks, and renaming a note updates links to it once typing stops', async () => {
    vi.useFakeTimers();
    try {
      const store = new AppStore(new MemoryStorage());
      await store.load();
      const light = store.createNote({ title: 'The lighthouse' });
      const mara = store.createNote({ title: 'Mara', doc: fromMarkdown('She keeps [[The lighthouse]].\n') });
      store.createNote({ title: 'Trash me', doc: fromMarkdown('[[The lighthouse]]\n') });
      store.trashNote(store.getState().notes.find((n) => n.title === 'Trash me')!.id);
      expect(backlinks(store.note(light.id)!, store.getState().notes).map((n) => n.title)).toEqual(['Mara']);
      expect(findByTitle(store.getState().notes, 'the lighthouse')?.id).toBe(light.id);
      for (const t of ['The light', 'The lightho', 'The old light']) store.setTitle(light.id, t);
      expect(toMarkdown(store.note(mara.id)!.doc)).toBe('She keeps [[The lighthouse]].\n');
      vi.advanceTimersByTime(2000);
      expect(toMarkdown(store.note(mara.id)!.doc)).toBe('She keeps [[The old light]].\n');
      expect(backlinks(store.note(light.id)!, store.getState().notes).map((n) => n.title)).toEqual(['Mara']);
    } finally {
      vi.useRealTimers();
    }
  });
});
