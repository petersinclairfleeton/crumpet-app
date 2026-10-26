import { describe, expect, it } from 'vitest';
import { cleanPlan } from '../../src/data/plan';
import { flatStretches, numberList, povColor, povShare, storyGaps, storyOf, withStory } from '../../src/data/story';
import type { CastMember } from '../../src/data/types';

const person = (id: string, name: string): CastMember => ({ id, kind: 'character', name, aliases: [], description: '', notes: '' });

describe('point of view and tension', () => {
  it('sets a chapter’s details, and drops a chapter with none left', () => {
    let plan = withStory(undefined, 'c1', { pov: 'mara', tension: 3 });
    plan = withStory(plan, 'c1', { aim: 'Reach the light' });
    expect(storyOf(plan, 'c1')).toEqual({ id: 'c1', pov: 'mara', tension: 3, aim: 'Reach the light' });
    plan = withStory(plan, 'c1', { pov: undefined, aim: '', tension: undefined });
    expect(plan.chapters).toBeUndefined();
    expect(storyOf(plan, 'c1')).toEqual({ id: 'c1' });
  });

  it('shares the book between points of view by words, with chapters without one last', () => {
    const cast = [person('mara', 'Mara'), person('tam', 'Tam')];
    let plan = withStory(undefined, 'a', { pov: 'mara' });
    plan = withStory(plan, 'b', { pov: 'tam' });
    plan = withStory(plan, 'c', { pov: 'mara' });
    const share = povShare([{ id: 'a', words: 1000 }, { id: 'b', words: 2500 }, { id: 'c', words: 1000 }, { id: 'd', words: 500 }], plan, cast);
    expect(share.map((s) => [s.name, s.chapters, Math.round(s.share * 100)])).toEqual([
      ['Tam', 1, 50],
      ['Mara', 2, 40],
      ['No point of view yet', 1, 10],
    ]);
    expect(povColor(cast, 'tam')).not.toBe(povColor(cast, 'mara'));
  });

  it('finds flat stretches of three calm chapters or more, and what’s not filled in', () => {
    expect(flatStretches([4, 2, 1, 2, 5, 1, 1, undefined, 2, 2, 2])).toEqual([
      { from: 2, to: 4 },
      { from: 9, to: 11 },
    ]);
    const plan = withStory(withStory(undefined, 'a', { pov: 'mara', aim: 'Escape' }), 'b', { pov: 'tam' });
    expect(storyGaps([{ id: 'a', number: 1 }, { id: 'b', number: 2 }, { id: 'c', number: 3 }], plan)).toEqual({ noPov: [3], noAim: [2, 3] });
    expect([numberList([3]), numberList([2, 3]), numberList([1, 4, 9])]).toEqual(['3', '2 and 3', '1, 4 and 9']);
  });

  it('keeps chapters’ details in project.json’s plan', () => {
    expect(cleanPlan({ chapters: [{ id: 'a', pov: 'mara', aim: 'Escape', tension: 9 }, { id: 'b', tension: 0 }, { nope: 1 }] })).toEqual({ chapters: [{ id: 'a', pov: 'mara', aim: 'Escape', tension: 5 }, { id: 'b' }] });
  });
});
