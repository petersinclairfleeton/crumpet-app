import { describe, expect, it } from 'vitest';
import { bookCast, findMember, seriesBooks, seriesCast, seriesLine, seriesNames, seriesResearch } from '../../src/data/series';
import type { CastMember, Note, Project } from '../../src/data/types';

const member = (id: string, name: string): CastMember => ({ id, kind: 'character', name }) as CastMember;
const book = (id: string, name: string, series?: string, cast: CastMember[] = []): Project => ({ id, name, series, cast, outline: [] }) as unknown as Project;

describe('a series', () => {
  const one = book('one', 'The Lighthouse', 'Gull Rock', [member('mara', 'Mara')]);
  const two = book('two', 'The Storm', 'gull rock ', [member('tom', 'Tom')]);
  const other = book('three', 'Elsewhere', undefined, [member('zed', 'Zed')]);
  const all = [one, two, other];

  it('groups books by name, in any case', () => {
    expect(seriesBooks(all, two).map((p) => p.id)).toEqual(['one', 'two']);
    expect(seriesBooks(all, other).map((p) => p.id)).toEqual(['three']);
    expect(seriesNames(all)).toEqual(['Gull Rock']);
    expect(seriesLine(all, two)).toBe('Book 2 of 2 in gull rock ');
    expect(seriesLine([one], one)).toBe('In Gull Rock');
  });

  it('shares characters, places and research across its books, each kept in its own', () => {
    expect(seriesCast(all, two).map((s) => [s.member.name, s.book.id])).toEqual([['Mara', 'one']]);
    expect(bookCast(all, two).map((m) => m.name)).toEqual(['Tom', 'Mara']);
    expect(bookCast(all, other).map((m) => m.name)).toEqual(['Zed']);
    expect(findMember(all, two, 'mara')?.book.id).toBe('one');
    expect(findMember(all, other, 'mara')).toBeNull();
    const notes = [
      { id: 'n1', projectId: 'one', trashedAt: null },
      { id: 'n2', projectId: 'one', trashedAt: 5 },
      { id: 'n3', projectId: 'two', trashedAt: null },
    ] as unknown as Note[];
    expect(seriesResearch(notes, all, two).map((x) => [x.note.id, x.book.id])).toEqual([['n1', 'one']]);
  });
});
