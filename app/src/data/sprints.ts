// Writing sprints: a timer that counts the words written while it runs (in
// every note and chapter, as the day's stats count them), kept running
// through a reload, with a log of the sprints done.

import { addDays, dayKey } from './stats';

/** A sprint under way. */
export interface Sprint {
  /** When it began, and how long it's for. */
  start: number;
  minutes: number;
  /** The day it began on, and the words written that day before it began. */
  day: string;
  base: number;
  /** Paused since then (ms since 1970), and for how long in all before that (ms). */
  pausedAt?: number;
  paused?: number;
}

/** A sprint done: when it ended, how long it ran (minutes) and the words written. */
export interface SprintDone {
  at: number;
  minutes: number;
  words: number;
}

export const SPRINT_LENGTHS = [10, 15, 20, 25, 30, 45, 60];

/** Starts a sprint of `minutes` now, from the words written today so far. */
export function startSprint(minutes: number, days: Record<string, number>, now: number): Sprint {
  const day = dayKey(now);
  return { start: now, minutes, day, base: days[day] ?? 0 };
}

/** Milliseconds left (a paused sprint's time stands still). */
export function sprintLeft(s: Sprint, now: number): number {
  const paused = (s.paused ?? 0) + (s.pausedAt ? now - s.pausedAt : 0);
  return Math.max(0, s.start + s.minutes * 60_000 + paused - now);
}

/** Minutes it has run so far (not counting pauses). */
export function sprintRan(s: Sprint, now: number): number {
  return Math.min(s.minutes, (s.minutes * 60_000 - sprintLeft(s, now)) / 60_000);
}

export function pauseSprint(s: Sprint, now: number): Sprint {
  return s.pausedAt ? s : { ...s, pausedAt: now };
}

export function resumeSprint(s: Sprint, now: number): Sprint {
  if (!s.pausedAt) return s;
  const { pausedAt, ...rest } = s;
  return { ...rest, paused: (s.paused ?? 0) + (now - pausedAt) };
}

/** Words written since it began (across midnight too), never below zero. */
export function sprintWords(s: Sprint, days: Record<string, number>, now: number): number {
  const today = dayKey(now);
  let n = 0;
  for (let d = s.day; d <= today; d = addDays(d, 1)) n += days[d] ?? 0;
  return Math.max(0, n - s.base);
}

/** Its record once done, rounded to whole minutes (at least one). */
export function finishSprint(s: Sprint, days: Record<string, number>, now: number): SprintDone {
  return { at: now, minutes: Math.max(1, Math.round(sprintRan(s, now))), words: sprintWords(s, days, now) };
}

/** The log with a sprint added, newest first, the last 100 kept. */
export function logSprint(log: SprintDone[] | undefined, done: SprintDone): SprintDone[] {
  return [done, ...(log ?? [])].slice(0, 100);
}

/** Words a minute, to one decimal place when under ten. */
export function perMinute(words: number, minutes: number): string {
  const r = words / Math.max(1, minutes);
  return r < 10 ? String(Math.round(r * 10) / 10) : String(Math.round(r));
}

/** The best sprint by words a minute, and words in all, from the log. */
export function sprintBest(log: SprintDone[] | undefined): { best: SprintDone | null; words: number } {
  let best: SprintDone | null = null;
  let words = 0;
  for (const s of log ?? []) {
    words += s.words;
    if (!best || s.words / s.minutes > best.words / best.minutes) best = s;
  }
  return { best, words };
}

/** "18:42" (or "1:02:05" for an hour or more). */
export function clock(ms: number): string {
  const t = Math.ceil(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
