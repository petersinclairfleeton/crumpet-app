import { describe, expect, it } from 'vitest';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import { listedNotes } from '../../src/data/selectors';
import { parseQuery, sortNotes, withToken, withoutToken } from '../../src/data/search';

describe('search filters', () => {
  it('reads words and filters from the search box', () => {
    const { filters, tokens } = parseQuery('lamp #idea in:"Novel ideas" is:favorite has:picture after:2026-09-01 "harbour wall" tag:Draft');
    expect(filters.words).toEqual(['lamp', 'harbour wall']);
    expect(filters.tags).toEqual(['idea', 'draft']);
    expect(filters.places).toEqual(['novel ideas']);
    expect(filters.favorite).toBe(true);
    expect(filters.has).toEqual(['picture']);
    expect(filters.after).toBe(new Date(2026, 8, 1).getTime());
    expect(tokens.map((t) => t.label)).toContain('In Novel ideas');
    expect(withoutToken('lamp in:"Novel ideas" #idea', tokens.find((t) => t.label === 'In Novel ideas')!)).toBe('lamp #idea');
    expect(withToken('lamp', 'has:picture')).toBe('lamp has:picture');
    expect(withToken('lamp has:picture', 'has:picture')).toBe('lamp has:picture');
  });

  it('finds the right notes, and sorts them', async () => {
    let t = 1_700_000_000_000;
    const store = new AppStore(new MemoryStorage(), () => (t += 1000));
    await store.load();
    const novel = store.createNotebook('Novel ideas');
    const a = store.createNote({ title: 'Banana lamp', notebookId: novel.id, tags: ['idea'], doc: fromMarkdown('- [ ] buy oil\n') });
    const b = store.createNote({ title: 'apple', doc: fromMarkdown('![x](Attachments/aaaaaaa-x.png)\n') });
    store.createNote({ title: 'Cherry', tags: ['idea'], favorite: true });
    const find = (q: string) => (store.setQuery(q), listedNotes(store.getState()).map((n) => n.title));
    expect(find('#idea')).toEqual(['Cherry', 'Banana lamp']);
    expect(find('in:"novel ideas"')).toEqual(['Banana lamp']);
    expect(find('has:todo')).toEqual(['Banana lamp']);
    expect(find('has:picture')).toEqual(['apple']);
    expect(find('is:favorite #idea')).toEqual(['Cherry']);
    expect(find('lamp')).toEqual(['Banana lamp']);
    expect(sortNotes([store.note(a.id)!, store.note(b.id)!], 'title').map((n) => n.title)).toEqual(['apple', 'Banana lamp']);
    expect(sortNotes([store.note(b.id)!, store.note(a.id)!], 'created').map((n) => n.title)).toEqual(['apple', 'Banana lamp']);
  });
});
