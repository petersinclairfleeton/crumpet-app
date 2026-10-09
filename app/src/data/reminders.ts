// Reminders on notes, like Evernote's: a date and time on a note, a list of
// notes with reminders (overdue, today, coming up, done), and a nudge (a
// notification, and a message in the app) when one is due while Crumpet is
// open. Kept in the note's file as `reminder: 2026-10-10T09:00:00.000Z`, and
// `reminder-done: true` once it's been dealt with.

import type { Group } from './selectors';
import type { Note } from './types';

export interface Reminder {
  at: number;
  done?: boolean;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function startOfDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** The quick choices: later today (in three hours, on the hour), tomorrow at 9, next Monday at 9. */
export function quickTimes(now: number): { label: string; at: number }[] {
  const later = new Date(now + 3 * HOUR);
  later.setMinutes(0, 0, 0);
  const tomorrow = new Date(startOfDay(now));
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const monday = new Date(startOfDay(now));
  monday.setDate(monday.getDate() + (((8 - monday.getDay()) % 7) || 7));
  monday.setHours(9, 0, 0, 0);
  const out = [
    { label: 'Tomorrow morning', at: tomorrow.getTime() },
    { label: 'Next week', at: monday.getTime() },
  ];
  // Late in the evening, "later today" would be tomorrow.
  if (later.getDate() === new Date(now).getDate()) out.unshift({ label: 'Later today', at: later.getTime() });
  return out;
}

/** When a reminder is, in words: "Today, 3:00 PM", "Tomorrow, 9:00 AM", "Mon 12 Oct, 9:00 AM". */
export function reminderText(at: number, now: number): string {
  const time = new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days === -1) return `Yesterday, ${time}`;
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return `${new Date(at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' })}, ${time}`;
}

/** The reminders list: overdue, today, coming up, and done; soonest first (done: latest first). */
export function reminderGroups(notes: Note[], now: number): Group[] {
  const withR = notes.filter((n) => n.reminder);
  const todayEnd = startOfDay(now) + DAY;
  const by = (a: Note, b: Note) => a.reminder!.at - b.reminder!.at;
  const groups: Group[] = [
    { label: 'Overdue', notes: withR.filter((n) => !n.reminder!.done && n.reminder!.at < now).sort(by) },
    { label: 'Today', notes: withR.filter((n) => !n.reminder!.done && n.reminder!.at >= now && n.reminder!.at < todayEnd).sort(by) },
    { label: 'Coming up', notes: withR.filter((n) => !n.reminder!.done && n.reminder!.at >= todayEnd).sort(by) },
    { label: 'Done', notes: withR.filter((n) => n.reminder!.done).sort((a, b) => by(b, a)) },
  ];
  return groups.filter((g) => g.notes.length);
}

/** Reminders that have come due and haven't been dealt with. */
export function dueReminders(notes: Note[], now: number): Note[] {
  return notes.filter((n) => n.trashedAt === null && n.reminder && !n.reminder.done && n.reminder.at <= now);
}

/** Reminders not yet done (for the count in the sidebar). */
export function openReminders(notes: Note[]): number {
  return notes.filter((n) => n.trashedAt === null && n.reminder && !n.reminder.done).length;
}

/** A reminder made safe. */
export function tidyReminder(r: unknown): Reminder | undefined {
  const x = r as Reminder | null | undefined;
  if (!x || typeof x.at !== 'number' || !Number.isFinite(x.at)) return undefined;
  return x.done ? { at: x.at, done: true } : { at: x.at };
}

/** As kept while syncing: one string, so a change on either side merges like any other field. */
export function encodeReminder(r: Reminder | undefined): string | undefined {
  return r ? `${new Date(r.at).toISOString()}${r.done ? ' done' : ''}` : undefined;
}

export function decodeReminder(s: string | undefined | null): Reminder | undefined {
  if (!s) return undefined;
  const [iso, done] = s.split(' ');
  const at = Date.parse(iso);
  return Number.isFinite(at) ? (done === 'done' ? { at, done: true } : { at }) : undefined;
}
