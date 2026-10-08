import { describe, expect, it } from 'vitest';
import { fuzzy, rank } from '../../src/data/fuzzy';

describe('fuzzy matching', () => {
  it('finds letters in order, and nothing when they are not there', () => {
    expect(fuzzy('lgh', 'Lighthouse')).not.toBeNull();
    expect(fuzzy('hgl', 'Lighthouse')).toBeNull();
    expect(fuzzy('', 'Anything')?.score).toBe(0);
  });

  it('prefers whole words, word starts and shorter titles', () => {
    const titles = ['The drowned village', 'Salt and the sea', 'Salt', 'Assault plan'];
    expect(rank('salt', titles, (t) => t).map((r) => r.item)).toEqual(['Salt', 'Salt and the sea', 'Assault plan']);
    expect(rank('dv', titles, (t) => t)[0].item).toBe('The drowned village');
    expect(rank('village drowned', titles, (t) => t)).toEqual([]);
    expect(rank('drowned village', titles, (t) => t)[0].item).toBe('The drowned village');
  });

  it('marks which letters matched', () => {
    expect(fuzzy('sa', 'Salt')?.hits).toEqual([0, 1]);
    expect(fuzzy('st', 'Salt')?.hits).toEqual([0, 3]);
  });
});
