import { describe, expect, it } from 'vitest';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { appearances, castMatcher, findMentions } from '../../src/data/cast';
import type { CastMember, Chapter } from '../../src/data/types';

const cast: CastMember[] = [
  { id: 'mara', kind: 'character', name: 'Mara', aliases: ['Mara Quill'], description: '', notes: '' },
  { id: 'tam', kind: 'character', name: 'Tam', aliases: ['Old Tam', 'the keeper'], description: '', notes: '' },
  { id: 'rock', kind: 'place', name: 'Gull Rock', aliases: [], description: '', notes: '' },
];

describe('spotting characters and places', () => {
  it('finds whole names and nicknames, longest first', () => {
    const m = castMatcher(cast);
    const text = "Mara Quill met Old Tam on Gull Rock. Mara's lamp; Tamsin and the Marathon don't count. The keeper? the keeper!";
    expect(findMentions(text, m).map((x) => [text.slice(x.from, x.to), x.id])).toEqual([
      ['Mara Quill', 'mara'],
      ['Old Tam', 'tam'],
      ['Gull Rock', 'rock'],
      ['Mara', 'mara'],
      ['the keeper', 'tam'],
    ]);
    expect(castMatcher([])).toBeNull();
  });

  it('counts mentions per chapter', () => {
    const ch = (id: string, md: string) => ({ id, projectId: 'p', title: id, doc: fromMarkdown(md), status: 'todo', synopsis: '', goal: null, createdAt: 0, updatedAt: 0 }) as Chapter;
    const out = appearances(cast, [ch('one', 'Mara and Tam.\n\nMara again.'), ch('two', 'Only Gull Rock.'), ch('three', 'Nobody.')]);
    expect(out.get('mara')?.map((x) => [x.chapter.id, x.count])).toEqual([['one', 2]]);
    expect(out.get('rock')?.map((x) => [x.chapter.id, x.count])).toEqual([['two', 1]]);
    expect(out.has('nobody')).toBe(false);
  });
});
