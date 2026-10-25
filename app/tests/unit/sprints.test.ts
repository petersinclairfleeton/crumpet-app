import { describe, expect, it } from 'vitest';
import { clock, finishSprint, logSprint, pauseSprint, perMinute, resumeSprint, sprintBest, sprintLeft, sprintWords, startSprint } from '../../src/data/sprints';

const at = (day: string, h: number, m = 0) => {
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m).getTime();
};

describe('writing sprints', () => {
  it('count the words written since the start, and the time left', () => {
    const s = startSprint(25, { '2026-10-07': 300 }, at('2026-10-07', 9));
    expect(s).toMatchObject({ minutes: 25, day: '2026-10-07', base: 300 });
    expect(sprintLeft(s, at('2026-10-07', 9, 10))).toBe(15 * 60_000);
    expect(sprintWords(s, { '2026-10-07': 712 }, at('2026-10-07', 9, 10))).toBe(412);
    // Cutting more than was written doesn't go below zero.
    expect(sprintWords(s, { '2026-10-07': 250 }, at('2026-10-07', 9, 10))).toBe(0);
    expect(sprintLeft(s, at('2026-10-07', 10))).toBe(0);
  });

  it('a pause holds the clock still', () => {
    let s = startSprint(10, {}, at('2026-10-07', 9));
    s = pauseSprint(s, at('2026-10-07', 9, 4));
    expect(sprintLeft(s, at('2026-10-07', 9, 30))).toBe(6 * 60_000);
    s = resumeSprint(s, at('2026-10-07', 9, 30));
    expect(sprintLeft(s, at('2026-10-07', 9, 31))).toBe(5 * 60_000);
    // Stopped early: the minutes it actually ran.
    expect(finishSprint(s, { '2026-10-07': 90 }, at('2026-10-07', 9, 32))).toMatchObject({ minutes: 6, words: 90 });
  });

  it('carry on across midnight', () => {
    const s = startSprint(30, { '2026-10-07': 1000 }, at('2026-10-07', 23, 50));
    expect(sprintWords(s, { '2026-10-07': 1200, '2026-10-08': 150 }, at('2026-10-08', 0, 10))).toBe(350);
  });

  it('a log, the best by words a minute, and the clock', () => {
    let log = logSprint(undefined, { at: 1, minutes: 25, words: 500 });
    log = logSprint(log, { at: 2, minutes: 10, words: 300 });
    expect(log.map((s) => s.at)).toEqual([2, 1]);
    expect(sprintBest(log)).toEqual({ best: { at: 2, minutes: 10, words: 300 }, words: 800 });
    expect(perMinute(300, 10)).toBe('30');
    expect(perMinute(45, 10)).toBe('4.5');
    expect(clock(18 * 60_000 + 42_000)).toBe('18:42');
    expect(clock(62 * 60_000 + 5_000)).toBe('1:02:05');
  });
});
