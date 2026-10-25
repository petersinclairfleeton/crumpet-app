// Writing stats: how many words were written each day, streaks of days
// writing (or meeting the daily goal; days off don't break them), and goals
// for the week and the month.
//
// A day's words are counted per note or chapter: how many more words it has
// now than when it was first touched that day (never below zero), so editing,
// deleting and retyping don't inflate the count. Only edits made here count,
// not notes arriving from other devices.

import type { Doc } from '@crumpet/editor/model';
import { cellPlain } from '@crumpet/editor/cells';

export interface WritingStats {
  /** The day being counted (local date, YYYY-MM-DD). */
  day: string;
  /** Words in each note or chapter when first edited that day, and now. */
  base: Record<string, number>;
  now: Record<string, number>;
  /** Words written on earlier days. */
  history: Record<string, number>;
}

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** Words in a document (footnote markers and deleted tracked text don't count). */
export function wordsIn(doc: Doc): number {
  let n = 0;
  for (const b of doc.blocks) {
    if (b.type === 'table') {
      for (const row of b.rows ?? []) for (const cell of row) n += (cellPlain(cell).match(WORD) ?? []).length;
      continue;
    }
    const text = b.runs.filter((r) => r.footnote === undefined && r.field === undefined && r.change?.kind !== 'del').map((r) => r.text).join('');
    n += (text.match(WORD) ?? []).length;
  }
  return n;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A date as YYYY-MM-DD, in local time. */
export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The day before or after (YYYY-MM-DD). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n, 12).getTime());
}

export function emptyStats(now: number): WritingStats {
  return { day: dayKey(now), base: {}, now: {}, history: {} };
}

function todayWords(s: WritingStats): number {
  let n = 0;
  for (const id of Object.keys(s.now)) n += Math.max(0, s.now[id] - (s.base[id] ?? s.now[id]));
  return n;
}

/** Moves on to a new day, keeping the last one's total. */
export function rollOver(s: WritingStats, now: number): WritingStats {
  const day = dayKey(now);
  if (s.day === day) return s;
  const done = todayWords(s);
  return { day, base: {}, now: {}, history: done ? { ...s.history, [s.day]: (s.history[s.day] ?? 0) + done } : s.history };
}

/** Counts an edit to a note or chapter that went from `before` to `after` words. */
export function recordEdit(s: WritingStats | undefined, id: string, before: number, after: number, now: number): WritingStats {
  const cur = rollOver(s ?? emptyStats(now), now);
  if (before === after && id in cur.base) return cur;
  return { ...cur, base: id in cur.base ? cur.base : { ...cur.base, [id]: before }, now: { ...cur.now, [id]: after } };
}

/** Words written on each day, today included. */
export function dailyWords(s: WritingStats | undefined, now: number): Record<string, number> {
  if (!s) return {};
  const cur = rollOver(s, now);
  const today = todayWords(cur);
  return today ? { ...cur.history, [cur.day]: today } : { ...cur.history };
}

/**
 * Days in a row meeting the goal (or writing at all, with no goal). Today
 * not done yet doesn't break the current streak; it just doesn't add to it,
 * and nor does a day off (`restDays`, 0 Sunday to 6 Saturday) unless written on.
 */
export function streaks(days: Record<string, number>, goal: number, now: number, restDays: number[] = []): { current: number; best: number } {
  const met = (d: string) => (days[d] ?? 0) >= Math.max(1, goal);
  const today = dayKey(now);
  const first = Object.keys(days).filter((d) => days[d] > 0 && d <= today).sort()[0];
  let run = 0;
  let best = 0;
  for (let d = first ?? today; d <= today; d = addDays(d, 1)) {
    if (met(d)) run++;
    else if (d !== today && !restDays.includes(weekday(d))) run = 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

/** The day of the week (0 Sunday to 6 Saturday), as JavaScript numbers them. */
export function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getDay();
}

/** The week a day is in, Monday to Sunday. */
export function weekOf(day: string): { from: string; to: string } {
  const from = addDays(day, -((weekday(day) + 6) % 7));
  return { from, to: addDays(from, 6) };
}

/** The month a day is in, first day to last. */
export function monthOf(day: string): { from: string; to: string } {
  const [y, m] = day.split('-').map(Number);
  return { from: `${y}-${pad(m)}-01`, to: dayKey(new Date(y, m, 0, 12).getTime()) };
}

/** A goal for a stretch of days (a week, a month), and how it's going. */
export interface PeriodGoal {
  words: number;
  goal: number;
  /** Words still to write (0 once met). */
  left: number;
  /** Writing days left, today included (days off left out). */
  daysLeft: number;
  /** Words a day, over the writing days left, to meet it. */
  perDay: number;
}

/** How a goal for the days `from` to `to` stands on `today`: words so far, what's left, and how many a day keeps it on track. */
export function periodGoal(days: Record<string, number>, goal: number, span: { from: string; to: string }, today: string, restDays: number[] = []): PeriodGoal {
  let words = 0;
  for (let d = span.from; d <= span.to && d <= today; d = addDays(d, 1)) words += days[d] ?? 0;
  let daysLeft = 0;
  for (let d = today < span.from ? span.from : today; d <= span.to; d = addDays(d, 1)) if (!restDays.includes(weekday(d))) daysLeft++;
  const left = Math.max(0, goal - words);
  return { words, goal, left, daysLeft, perDay: left ? Math.ceil(left / Math.max(1, daysLeft)) : 0 };
}

/** Words written today (on this device) in some notes or chapters, such as a project's. */
export function wordsToday(s: WritingStats | undefined, ids: string[], now: number): number {
  if (!s || s.day !== dayKey(now)) return 0;
  let n = 0;
  for (const id of ids) if (id in s.now) n += Math.max(0, s.now[id] - (s.base[id] ?? s.now[id]));
  return n;
}

/** Days from one day to another (YYYY-MM-DD), negative if it's earlier. */
export function daysBetween(from: string, to: string): number {
  const t = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((t(to) - t(from)) / 86_400_000);
}

/** Words written each day on other devices, by device id (read from their files when syncing). */
export type StatsElsewhere = Record<string, Record<string, number>>;

/** Words written each day on every device: this one's, plus the others' as of the last sync. */
export function allDailyWords(s: WritingStats | undefined, elsewhere: StatsElsewhere | undefined, now: number): Record<string, number> {
  const days = dailyWords(s, now);
  for (const other of Object.values(elsewhere ?? {})) for (const [day, n] of Object.entries(other)) if (n > 0) days[day] = (days[day] ?? 0) + n;
  return days;
}
