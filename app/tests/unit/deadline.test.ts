import { describe, expect, it } from 'vitest';
import { pace } from '../../src/data/deadline';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { writeProject } from '../../src/sync/remote';

const deadline = { date: '2026-10-10', from: '2026-10-01', startWords: 0 };

describe('deadline pace', () => {
  it('shares the words left over the days left, today included', () => {
    // 10 days from 1 to 10 October, 10,000 words: 1,000 a day.
    const p = pace(deadline, 10_000, 4_000, 0, '2026-10-05');
    expect(p.daysLeft).toBe(6);
    expect(p.todayTarget).toBe(1_000);
    expect(p.state).toBe('on-track');
  });

  it('is behind when short of a steady pace by this morning, and catches up by writing today', () => {
    const behind = pace(deadline, 10_000, 3_000, 0, '2026-10-05');
    expect(behind.state).toBe('behind');
    expect(behind.behindBy).toBe(1_000);
    expect(behind.todayTarget).toBe(1_167);
    expect(pace(deadline, 10_000, 4_100, 1_100, '2026-10-05').state).toBe('on-track');
  });

  it('knows when the goal is reached or the date has passed', () => {
    expect(pace(deadline, 10_000, 10_500, 0, '2026-10-08').state).toBe('done');
    const late = pace(deadline, 10_000, 9_000, 0, '2026-10-11');
    expect(late.state).toBe('passed');
    expect(late.daysLeft).toBe(0);
  });

  it('is set from this morning’s words, and saved in project.json', async () => {
    let t = new Date(2026, 9, 5, 9).getTime();
    const store = new AppStore(new MemoryStorage(), () => (t += 1000));
    await store.load();
    const p = store.createProject('Book');
    const c = store.getState().chapters[0];
    store.setChapterDoc(c.id, fromMarkdown('one two three four'));
    store.setProjectGoal(p.id, 1000);
    store.setProjectDeadline(p.id, '2026-10-14');
    const d = store.project(p.id)!.deadline!;
    expect(d).toEqual({ date: '2026-10-14', from: '2026-10-05', startWords: 0 });
    const json = JSON.parse(writeProject({ id: p.id, name: 'Book', goal: 1000, outline: [], created: 0, updated: 0, deadline: d }));
    expect(json.deadline).toEqual(d);
    store.setProjectDeadline(p.id, null);
    expect(store.project(p.id)!.deadline).toBeUndefined();
  });
});
