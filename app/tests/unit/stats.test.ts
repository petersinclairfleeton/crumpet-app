import { describe, expect, it } from 'vitest';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import { addDays, dailyWords, dayKey, recordEdit, streaks, wordsIn } from '../../src/data/stats';

const at = (day: string, h = 12) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, h).getTime();
};

describe('writing stats', () => {
  it('count words added each day, net of deleting, per note', () => {
    let s = recordEdit(undefined, 'a', 100, 110, at('2026-10-01'));
    s = recordEdit(s, 'a', 110, 105, at('2026-10-01', 13)); // deleted some
    s = recordEdit(s, 'b', 0, 20, at('2026-10-01', 14));
    expect(dailyWords(s, at('2026-10-01', 15))).toEqual({ '2026-10-01': 25 });
    // Cutting more than was written that day doesn't go below zero.
    s = recordEdit(s, 'b', 20, 0, at('2026-10-01', 16));
    expect(dailyWords(s, at('2026-10-01', 17))).toEqual({ '2026-10-01': 5 });
    // The next day starts again; yesterday is kept.
    s = recordEdit(s, 'a', 105, 140, at('2026-10-02'));
    expect(dailyWords(s, at('2026-10-02', 13))).toEqual({ '2026-10-01': 5, '2026-10-02': 35 });
    expect(dailyWords(s, at('2026-10-05'))).toEqual({ '2026-10-01': 5, '2026-10-02': 35 });
  });

  it('count words like the editor shows them', () => {
    expect(wordsIn(fromMarkdown("It's a well-known fact.^[Not counted.] {--gone words--}\n\n| a b | c |\n| --- | --- |\n"))).toBe(7);
  });

  it('streaks: days in a row meeting the goal; today not done yet keeps it going', () => {
    const today = '2026-10-10';
    const days = { [addDays(today, -1)]: 600, [addDays(today, -2)]: 500, [addDays(today, -3)]: 200, [addDays(today, -6)]: 900, [addDays(today, -7)]: 900, [addDays(today, -8)]: 900 };
    expect(streaks(days, 500, at(today))).toEqual({ current: 2, best: 3 });
    expect(streaks(days, 0, at(today))).toEqual({ current: 3, best: 3 });
    expect(streaks({ ...days, [today]: 501 }, 500, at(today))).toEqual({ current: 3, best: 3 });
    expect(dayKey(at(today))).toBe(today);
  });

  it('the store counts edits made here, not ones arriving from elsewhere', async () => {
    const store = new AppStore(new MemoryStorage());
    await store.load();
    const n = store.createNote({ title: 'T', doc: fromMarkdown('One two') });
    store.setDoc(n.id, fromMarkdown('One two three four'));
    const today = dayKey(Date.now());
    expect(dailyWords(store.getState().settings.stats, Date.now())[today]).toBe(2);
    store.flush();
  });
});
