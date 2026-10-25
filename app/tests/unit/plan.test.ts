import { describe, expect, it } from 'vitest';
import { type StoryEvent, STRUCTURES, beatDrift, chapterAt, chapterSpans, clashes, longestGap, parseWhen, plotlineReach, structureBeats, timelineOrder } from '../../src/data/plan';

const ev = (id: string, when: string, cast: string[] = []): StoryEvent => ({ id, title: id, when, cast });

describe('the timeline', () => {
  it('reads dates, times and days of the story', () => {
    expect(parseWhen('2026-10-07')).toMatchObject({ kind: 'date', timed: false });
    expect(parseWhen('2026-10-07 14:30')!.key - parseWhen('2026-10-07')!.key).toBe(14 * 60 + 30);
    expect(parseWhen('Day 3')).toEqual({ kind: 'day', key: 3 * 1440, timed: false });
    expect(parseWhen('day 3, 9:15')).toEqual({ kind: 'day', key: 3 * 1440 + 555, timed: true });
    expect(parseWhen('3')).toEqual({ kind: 'day', key: 3 * 1440, timed: false });
    expect(parseWhen('')).toBeNull();
    expect(parseWhen('the spring after')).toBeNull();
  });

  it('puts events in story order: days, then dates, then those not placed yet', () => {
    const order = timelineOrder([ev('a', '2026-10-08'), ev('b', ''), ev('c', 'Day 2'), ev('d', '2026-10-07 18:00'), ev('e', 'Day 1'), ev('f', '2026-10-07 09:00')]);
    expect(order.map((e) => e.id)).toEqual(['e', 'c', 'f', 'd', 'a', 'b']);
  });

  it('finds a character in two places at once', () => {
    const isPlace = (id: string) => id.startsWith('place:');
    const events = [ev('harbour', 'Day 3 14:00', ['rose', 'place:harbour']), ev('church', 'Day 3 14:00', ['rose', 'tam', 'place:church']), ev('later', 'Day 3 18:00', ['rose', 'place:inn']), ev('tam', 'Day 3 14:00', ['tam', 'place:church'])];
    const found = clashes(events, isPlace);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ who: 'rose', places: ['place:harbour', 'place:church'] });
    // A day with no times: only two untimed events on the same day clash.
    expect(clashes([ev('a', 'Day 4', ['rose', 'place:a']), ev('b', 'Day 4 10:00', ['rose', 'place:b'])], isPlace)).toEqual([]);
  });
});

describe('plotlines', () => {
  it('how far a plotline reaches, and its longest quiet stretch', () => {
    const p = { id: 'p', name: 'The mystery', color: '#000', cells: { c1: 'A body', c2: '', c4: 'A clue', c7: 'Solved', c8: '' } };
    const chapters = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
    expect(plotlineReach(p, chapters)).toBe(3 / 8);
    expect(longestGap(p, chapters)).toBe(2);
    expect(longestGap({ ...p, cells: {} }, chapters)).toBe(0);
  });
});

describe('structures', () => {
  const chapters = [
    { id: 'c1', words: 1000 },
    { id: 'c2', words: 3000 },
    { id: 'c3', words: 1000 },
  ];
  it('lays chapters along the book by words (or by count while there are hardly any)', () => {
    expect(chapterSpans(chapters).map((s) => [s.from, s.to])).toEqual([
      [0, 0.2],
      [0.2, 0.8],
      [0.8, 1],
    ]);
    expect(chapterAt(0.5, chapters)).toBe('c2');
    expect(chapterAt(1, chapters)).toBe('c3');
    expect(chapterSpans([{ id: 'a', words: 0 }, { id: 'b', words: 10 }]).map((s) => s.to)).toEqual([0.5, 1]);
  });

  it('places each beat in the chapter it falls in, and says how far one has drifted', () => {
    let n = 0;
    const beats = structureBeats(STRUCTURES.find((s) => s.id === 'three-act')!, chapters, () => `b${++n}`);
    expect(beats.map((b) => b.chapterId)).toEqual(['c1', 'c1', 'c2', 'c2', 'c2', 'c3', 'c3']);
    expect(beatDrift(beats[3], chapters)).toBe(0);
    expect(beatDrift({ ...beats[3], chapterId: 'c3' }, chapters)).toBeCloseTo(0.3);
    expect(STRUCTURES.every((s) => s.beats.every((b, i) => b.at >= 0 && b.at <= 1 && (i === 0 || b.at >= s.beats[i - 1].at)))).toBe(true);
  });
});

describe('keeping a plan', () => {
  it('tidies empty parts away, and reads only what’s well formed', async () => {
    const { cleanPlan, tidyPlan } = await import('../../src/data/plan');
    expect(tidyPlan({ plotlines: [], events: [] })).toBeUndefined();
    expect(cleanPlan('nonsense')).toBeUndefined();
    const p = cleanPlan({
      plotlines: [{ id: 'p', name: 'Mystery', color: 'red', cells: { c1: 'A body', c2: 3 } }, { name: 'no id' }],
      events: [{ id: 'e', title: 'Storm', when: 'Day 3', cast: ['rose', 5], chapterId: '' }],
      structure: { id: 'three-act', beats: [{ id: 'b', name: 'Midpoint', at: 7, hint: '' }] },
    });
    expect(p).toEqual({
      plotlines: [{ id: 'p', name: 'Mystery', color: '#c0703a', cells: { c1: 'A body' } }],
      events: [{ id: 'e', title: 'Storm', when: 'Day 3', cast: ['rose'] }],
      structure: { id: 'three-act', beats: [{ id: 'b', name: 'Midpoint', at: 1, hint: '' }] },
    });
  });
});
