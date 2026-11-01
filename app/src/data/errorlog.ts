// Recent errors, for bug reports (Help → Report a problem): the last few
// things that went wrong in this session, kept in memory only (never saved
// or sent by themselves). Only the error's message and where in Crumpet's
// code it happened: never the text of notes.

export interface LoggedError {
  /** When, as a time of day. */
  at: string;
  message: string;
  /** The first lines of where it happened in the code. */
  where: string;
}

const KEEP = 5;
const MAX_MESSAGE = 200;
const errors: LoggedError[] = [];

function clip(s: string, n: number): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

/** The code's lines from a stack, shortened to file:line (addresses differ between builds anyway). */
function whereFrom(stack: string | undefined): string {
  if (!stack) return '';
  return stack
    .split('\n')
    .slice(1)
    .map((l) => l.trim().replace(/^at\s+/, ''))
    .filter(Boolean)
    .slice(0, 2)
    .map((l) => clip(l.replace(/\(?(?:https?|app|file):\/\/[^/)]*\/(?:[^)]*\/)?([^/)]+)\)?/g, '$1'), 90))
    .join(' ← ');
}

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err) ?? String(err);
  } catch {
    return String(err);
  }
}

/** Notes something that went wrong (also used by tests); `label` says what Crumpet was doing. */
export function logError(err: unknown, at: Date = new Date(), label = ''): void {
  const e = err instanceof Error ? err : null;
  const message = clip([label, err === undefined ? '' : describe(err)].filter(Boolean).join(': '), MAX_MESSAGE);
  if (!message) return;
  const last = errors[errors.length - 1];
  if (last && last.message === message) return;
  errors.push({ at: at.toTimeString().slice(0, 8), message, where: whereFrom(e?.stack) });
  if (errors.length > KEEP) errors.shift();
}

export function recentErrors(): LoggedError[] {
  return errors.slice();
}

export function clearErrors(): void {
  errors.length = 0;
}

let started = false;
/** Listens for errors nothing else caught (called once, as the app starts). */
export function startErrorLog(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('error', (e) => logError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => logError(e.reason));
  // Crumpet's own reports ("[crumpet] Sync could not start", …) and errors handed to the console.
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const err = args.find((a) => a instanceof Error);
      const first = typeof args[0] === 'string' ? args[0] : '';
      if (first.startsWith('[crumpet]')) logError(err, new Date(), first.replace(/^\[crumpet\]\s*/, ''));
      else if (err) logError(err);
    } catch {
      // Never let the log get in the way.
    }
    original(...args);
  };
}
