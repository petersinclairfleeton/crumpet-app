// Reminders on notes: the bell beside a note's star sets one (later today,
// tomorrow morning, next week, or any date and time), marks it done or takes
// it off. While Crumpet is open, a reminder that comes due shows a message in
// the app and, if allowed, a notification from the browser.

import { useEffect, useState } from 'react';
import type { Note } from '../data/types';
import { dueReminders, quickTimes, reminderText } from '../data/reminders';
import { displayTitle } from '../data/selectors';
import { useAppState, useAppStore } from './hooks';
import { IconBell, IconClose } from './icons';
import { Popover } from './Sidebar';

/** The browser's notifications, asked for when the first reminder is set (it has to be from a click). */
function askToNotify(): void {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission().catch(() => {});
}

/** A date and time as a datetime-local field wants it. */
function localInput(t: number): string {
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

export function ReminderButton({ note }: { note: Note }) {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const r = note.reminder;
  const now = Date.now();
  const [when, setWhen] = useState('');
  const set = (at: number) => {
    askToNotify();
    store.setReminder(note.id, { at });
    setOpen(false);
  };
  const label = r ? `Reminder: ${reminderText(r.at, now)}${r.done ? ' (done)' : ''}` : 'Add a reminder';
  return (
    <>
      <button
        type="button"
        className={`icon-btn${r && !r.done ? ' on' : ''}${r && !r.done && r.at <= now ? ' due' : ''}`}
        aria-label={label}
        data-tip={label}
        aria-expanded={open}
        onClick={() => {
          setWhen(localInput(r?.at ?? quickTimes(now)[0].at));
          setOpen(!open);
        }}
      >
        <IconBell size={16} />
      </button>
      {open && (
        <Popover onClose={() => setOpen(false)} label="Reminder">
          {r && (
            <p className="menu-label reminder-now">
              {r.done ? 'Done · ' : ''}
              {reminderText(r.at, now)}
            </p>
          )}
          {r && (
            <button type="button" className="menu-item" onClick={() => (store.setReminder(note.id, { at: r.at, done: !r.done }), setOpen(false))}>
              {r.done ? 'Not done yet' : 'Mark as done'}
            </button>
          )}
          <p className="menu-label">{r ? 'Change to' : 'Remind me'}</p>
          {quickTimes(now).map((q) => (
            <button key={q.label} type="button" className="menu-item" onClick={() => set(q.at)}>
              {q.label}
              <span className="menu-time">{reminderText(q.at, now)}</span>
            </button>
          ))}
          <form
            className="reminder-pick"
            onSubmit={(e) => {
              e.preventDefault();
              const at = new Date(when).getTime();
              if (Number.isFinite(at)) set(at);
            }}
          >
            <input type="datetime-local" aria-label="Reminder date and time" value={when} onChange={(e) => setWhen(e.target.value)} />
            <button type="submit" className="btn small">
              Set
            </button>
          </form>
          {r && (
            <button type="button" className="menu-item danger" onClick={() => (store.setReminder(note.id, null), setOpen(false))}>
              Remove reminder
            </button>
          )}
        </Popover>
      )}
    </>
  );
}

/** A small bell and time on a note's card in the list. */
export function ReminderTag({ note, now }: { note: Note; now: number }) {
  const r = note.reminder;
  if (!r) return null;
  const late = !r.done && r.at <= now;
  return (
    <span className={`card-reminder${late ? ' due' : ''}${r.done ? ' done' : ''}`} title={`Reminder${r.done ? ' (done)' : ''}`}>
      <IconBell size={10} /> {reminderText(r.at, now)}
    </span>
  );
}

const SEEN_KEY = 'crumpet.remindersShown';

function shown(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Watches for reminders coming due while the app is open: each shows once
 * (a message here, with Open and Done, and a notification if allowed).
 */
export function ReminderAlerts({ onOpen }: { onOpen(id: string): void }) {
  const state = useAppState();
  const store = useAppStore();
  const [tick, setTick] = useState(0);
  const [alerts, setAlerts] = useState<string[]>([]);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    const wake = () => document.visibilityState === 'visible' && setTick((n) => n + 1);
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);
  useEffect(() => {
    const seen = shown();
    const due = dueReminders(state.notes, Date.now()).filter((n) => !seen.has(`${n.id}@${n.reminder!.at}`));
    if (!due.length) return;
    for (const n of due) {
      seen.add(`${n.id}@${n.reminder!.at}`);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const note = new Notification(displayTitle(n), { body: `Reminder · ${reminderText(n.reminder!.at, Date.now())}`, tag: `crumpet-${n.id}`, icon: './icons/icon-192.png' });
          note.onclick = () => {
            window.focus();
            onOpen(n.id);
            note.close();
          };
        } catch {
          // Some browsers only notify from a service worker: the message in the app is enough.
        }
      }
    }
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
    } catch {
      // Not kept: it may show again next time.
    }
    setAlerts((a) => [...new Set([...a, ...due.map((n) => n.id)])]);
  }, [state.notes, tick, onOpen]);

  const live = alerts.map((id) => state.notes.find((n) => n.id === id)).filter((n): n is Note => !!n && !!n.reminder && !n.reminder.done && n.trashedAt === null);
  if (!live.length) return null;
  const dismiss = (id: string) => setAlerts((a) => a.filter((x) => x !== id));
  return (
    <div className="reminder-alerts" role="region" aria-label="Reminders due">
      {live.map((n) => (
        <div key={n.id} className="reminder-alert" role="alert">
          <IconBell size={16} />
          <div className="grow">
            <b>{displayTitle(n)}</b>
            <small>{reminderText(n.reminder!.at, Date.now())}</small>
          </div>
          <button type="button" className="btn small" onClick={() => (onOpen(n.id), dismiss(n.id))}>
            Open
          </button>
          <button type="button" className="btn quiet small" onClick={() => (store.setReminder(n.id, { at: n.reminder!.at, done: true }), dismiss(n.id))}>
            Done
          </button>
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => dismiss(n.id)}>
            <IconClose size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
