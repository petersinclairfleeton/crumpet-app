// Writing sprints: start one (10 minutes to an hour) from the Writing tab,
// Writing stats or the command palette; a small bar shows the time left and
// the words written so far, with Pause and Stop; at the end a soft chime and
// what was written, kept in a log.

import { useEffect, useState } from 'react';
import { type SprintDone, SPRINT_LENGTHS, clock, finishSprint, logSprint, pauseSprint, perMinute, resumeSprint, sprintBest, sprintLeft, sprintWords, startSprint } from '../data/sprints';
import { dailyWords } from '../data/stats';
import type { AppStore } from '../data/store';
import { useAppState, useAppStore } from './hooks';

const fmt = (n: number) => n.toLocaleString();

/** Starts a sprint of `minutes` (ending any under way). */
export function beginSprint(store: AppStore, minutes: number): void {
  const s = store.getState().settings;
  store.updateSettings({ sprint: startSprint(minutes, dailyWords(s.stats, Date.now()), Date.now()) });
}

/** Ends the sprint under way now, keeping it in the log (the command palette's Stop; the bar shows what was written). */
export function stopSprint(store: AppStore): void {
  window.dispatchEvent(new Event(STOP));
  if (store.getState().settings.sprint) endSprint(store);
}

const STOP = 'crumpet:stop-sprint';

/** Ends the sprint under way, keeping it in the log; returns what was written. */
function endSprint(store: AppStore): SprintDone | null {
  const s = store.getState().settings;
  if (!s.sprint) return null;
  const now = Date.now();
  const done = finishSprint(s.sprint, dailyWords(s.stats, now), now);
  store.updateSettings({ sprint: null, sprints: logSprint(s.sprints, done) });
  return done;
}

/** A soft two-note chime (when the browser allows sound). */
function chime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [660, 880].forEach((hz, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = hz;
      o.type = 'sine';
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // No sound: the card still says it's done.
  }
}

/** The bar while a sprint runs, and the card when it ends. */
export function SprintBar() {
  const state = useAppState();
  const store = useAppStore();
  const sprint = state.settings.sprint ?? null;
  const [, setTick] = useState(0);
  const [done, setDone] = useState<SprintDone | null>(null);
  // Stopped from the command palette: show what was written.
  useEffect(() => {
    const stop = () => setDone(endSprint(store));
    window.addEventListener(STOP, stop);
    return () => window.removeEventListener(STOP, stop);
  }, [store]);
  useEffect(() => {
    if (!sprint || sprint.pausedAt) return;
    const t = setInterval(() => {
      if (sprintLeft(sprint, Date.now()) > 0) setTick((n) => n + 1);
      else {
        chime();
        setDone(endSprint(store));
      }
    }, 500);
    return () => clearInterval(t);
  }, [sprint, store]);
  if (done && !sprint) {
    return (
      <div className="sprint-bar done" role="status" aria-label="Sprint done">
        <span className="sprint-dot" aria-hidden="true" />
        <span>
          Sprint done: <b>{fmt(done.words)}</b> word{done.words === 1 ? '' : 's'} in {done.minutes} minute{done.minutes === 1 ? '' : 's'} · {perMinute(done.words, done.minutes)} a minute
        </span>
        <button type="button" className="btn small" onClick={() => (setDone(null), beginSprint(store, done.minutes))}>
          Another
        </button>
        <button type="button" className="btn small quiet" onClick={() => setDone(null)}>
          Close
        </button>
      </div>
    );
  }
  if (!sprint) return null;
  const now = Date.now();
  const words = sprintWords(sprint, dailyWords(state.settings.stats, now), now);
  const keep = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div className="sprint-bar" role="status" aria-label="Writing sprint">
      <span className={`sprint-dot${sprint.pausedAt ? ' paused' : ''}`} aria-hidden="true" />
      <span className="sprint-clock" aria-label="Time left">
        {clock(sprintLeft(sprint, now))}
      </span>
      <span className="sprint-words">
        <b>{fmt(words)}</b> word{words === 1 ? '' : 's'}
      </span>
      <button type="button" className="btn small" onMouseDown={keep} onClick={() => store.updateSettings({ sprint: sprint.pausedAt ? resumeSprint(sprint, Date.now()) : pauseSprint(sprint, Date.now()) })}>
        {sprint.pausedAt ? 'Resume' : 'Pause'}
      </button>
      <button type="button" className="btn small quiet" onMouseDown={keep} onClick={() => setDone(endSprint(store))}>
        Stop
      </button>
    </div>
  );
}

/** Choosing a length and starting, and the last few sprints (the Writing tab and Writing stats). */
export function SprintStart({ log = 3 }: { log?: number }) {
  const state = useAppState();
  const store = useAppStore();
  const [minutes, setMinutes] = useState(25);
  const running = !!state.settings.sprint;
  const recent = (state.settings.sprints ?? []).slice(0, log);
  const { best } = sprintBest(state.settings.sprints);
  return (
    <div className="sprint-start">
      <div className="sprint-row">
        <select aria-label="Sprint length" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {SPRINT_LENGTHS.map((m) => (
            <option key={m} value={m}>
              {m} minutes
            </option>
          ))}
        </select>
        <button type="button" className="btn small" disabled={running} aria-label={running ? 'Sprint under way' : `Start a sprint of ${minutes} minutes`} onClick={() => beginSprint(store, minutes)}>
          {running ? 'Under way' : 'Start a sprint'}
        </button>
      </div>
      {recent.length > 0 && (
        <ul className="sprint-log" aria-label="Recent sprints">
          {recent.map((s) => (
            <li key={s.at}>
              <span>{new Date(s.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
              <span>
                {fmt(s.words)} in {s.minutes} min
              </span>
              <span className="muted">{perMinute(s.words, s.minutes)}/min</span>
            </li>
          ))}
        </ul>
      )}
      {best && (state.settings.sprints?.length ?? 0) > 1 && (
        <p className="sprint-best">
          Best: {perMinute(best.words, best.minutes)} words a minute ({fmt(best.words)} in {best.minutes} minutes)
        </p>
      )}
    </div>
  );
}
