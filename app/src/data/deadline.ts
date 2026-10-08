// Keeping pace with a deadline: how many words a day are needed to reach a
// project's goal by its date, and whether the writing is keeping up with a
// steady pace from the day the deadline was set.

import { daysBetween } from './stats';
import type { Deadline } from './types';

export interface Pace {
  /** Days left, today included (0 once the date has gone). */
  daysLeft: number;
  /** Words to write today to stay on course, and written so far today. */
  todayTarget: number;
  writtenToday: number;
  /** done: the goal is reached; passed: the date has gone; behind: short of a steady pace (by `behindBy` words). */
  state: 'done' | 'passed' | 'behind' | 'on-track';
  behindBy: number;
}

export function pace(d: Deadline, goal: number, total: number, writtenToday: number, today: string): Pace {
  const daysLeft = Math.max(0, daysBetween(today, d.date) + 1);
  const startOfToday = Math.max(0, total - writtenToday);
  const todayTarget = daysLeft > 0 ? Math.ceil(Math.max(0, goal - startOfToday) / daysLeft) : 0;
  if (total >= goal) return { daysLeft, todayTarget: 0, writtenToday, state: 'done', behindBy: 0 };
  if (daysLeft === 0) return { daysLeft, todayTarget, writtenToday, state: 'passed', behindBy: goal - total };
  // A steady pace from the day it was set: where the writing should have been by this morning.
  const span = Math.max(1, daysBetween(d.from, d.date) + 1);
  const before = Math.min(span, Math.max(0, daysBetween(d.from, today)));
  const expected = d.startWords + ((goal - d.startWords) * before) / span;
  const behindBy = Math.max(0, Math.round(expected - total));
  return { daysLeft, todayTarget, writtenToday, state: behindBy > 0 ? 'behind' : 'on-track', behindBy };
}
