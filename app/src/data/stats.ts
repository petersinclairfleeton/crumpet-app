// Writing stats: how many words were written each day, and streaks of days
// writing (or meeting the daily goal).
//
// A day's words are counted per note or chapter: how many more words it has
// now than when it was first touched that day (never below zero), so editing,
// deleting and retyping don't inflate the count. Only edits made here count,
// not notes arriving from other devices.

import type { Doc } from '@crumpet/editor/model';

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
      for (const row of b.rows ?? []) for (const cell of row) n += (cell.match(WORD) ?? []).length;
      continue;
    }
    const text = b.runs.filter((r) => r.footnote === undefined && r.change?.kind !== 'del').map((r) => r.text).join('');
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
 * not done yet doesn't break the current streak; it just doesn't add to it.
 */
export function streaks(days: Record<string, number>, goal: number, now: number): { current: number; best: number } {
  const met = (d: string) => (days[d] ?? 0) >= Math.max(1, goal);
  const today = dayKey(now);
  let current = 0;
  for (let d = met(today) ? today : addDays(today, -1); met(d); d = addDays(d, -1)) current++;
  let best = 0;
  for (const d of Object.keys(days).sort()) {
    if (!met(d) || met(addDays(d, -1))) continue;
    let run = 0;
    for (let x = d; met(x); x = addDays(x, 1)) run++;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current) };
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
