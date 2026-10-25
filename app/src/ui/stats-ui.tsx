// Writing stats: words today, this week and this month against their goals,
// streaks (days off don't break them), the last 30 days as bars, and a
// calendar of the last few months.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type PeriodGoal, addDays, allDailyWords, dayKey, monthOf, periodGoal, streaks, weekOf, weekday } from '../data/stats';
import { useAppState, useAppStore } from './hooks';
import { IconClose } from './icons';

const WEEKS = 30;

function shortDate(day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

const fmt = (n: number) => n.toLocaleString();

/** Monday first, as the calendar has them. */
const WEEKDAYS: [number, string, string][] = [
  [1, 'M', 'Monday'],
  [2, 'T', 'Tuesday'],
  [3, 'W', 'Wednesday'],
  [4, 'T', 'Thursday'],
  [5, 'F', 'Friday'],
  [6, 'S', 'Saturday'],
  [0, 'S', 'Sunday'],
];

/** This week's and this month's goals, as they stand today (null when there's no goal). */
export function usePeriodGoals(): { week: PeriodGoal | null; month: PeriodGoal | null; restToday: boolean } {
  const state = useAppState();
  const s = state.settings;
  const now = Date.now();
  const today = dayKey(now);
  const days = allDailyWords(s.stats, s.statsElsewhere, now);
  const rest = s.restDays ?? [];
  return {
    week: s.weeklyGoal ? periodGoal(days, s.weeklyGoal, weekOf(today), today, rest) : null,
    month: s.monthlyGoal ? periodGoal(days, s.monthlyGoal, monthOf(today), today, rest) : null,
    restToday: rest.includes(weekday(today)),
  };
}

/** "1,200 to go · about 400 a day" or "Goal met". */
export function goalLine(g: PeriodGoal): string {
  if (!g.left) return 'Goal met';
  return g.daysLeft > 1 ? `${fmt(g.left)} to go · about ${fmt(g.perDay)} a day` : `${fmt(g.left)} to go`;
}

function GoalTile({ label, words, goal, note }: { label: string; words: number; goal: PeriodGoal | null; note: string }) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <b>{fmt(words)}</b>
      {goal ? (
        <>
          <div className="stat-meter" role="progressbar" aria-label={`${label}: goal`} aria-valuemin={0} aria-valuemax={goal.goal} aria-valuenow={Math.min(goal.goal, words)}>
            <i style={{ width: `${Math.min(100, (words / goal.goal) * 100)}%` }} />
          </div>
          <small>{goalLine(goal)}</small>
        </>
      ) : (
        <small>{note}</small>
      )}
    </div>
  );
}

/** A goal's number box: words a day, a week or a month. */
function GoalInput({ label, unit, value, step, onChange }: { label: string; unit: string; value: number; step: number; onChange(n: number): void }) {
  return (
    <label className="field goal-field">
      <span>{label}</span>
      <span className="with-unit">
        <input type="number" min={0} step={step} value={value || ''} placeholder="None" aria-label={`${label} in words`} onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
        <small>{unit}</small>
      </span>
    </label>
  );
}

/** Words written today, for the sidebar. */
export function useTodayWords(): number {
  const state = useAppState();
  return allDailyWords(state.settings.stats, state.settings.statsElsewhere, Date.now())[dayKey(Date.now())] ?? 0;
}

interface Tip {
  x: number;
  y: number;
  text: string;
}

export function StatsDialog({ onClose }: { onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const panel = useRef<HTMLDivElement>(null);
  const calendar = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [asTable, setAsTable] = useState(false);
  const now = Date.now();
  const today = dayKey(now);
  const goal = state.settings.dailyGoal ?? 0;
  const rest = state.settings.restDays ?? [];
  const days = useMemo(() => allDailyWords(state.settings.stats, state.settings.statsElsewhere, now), [state.settings.stats, state.settings.statsElsewhere, now]);
  const { current, best } = streaks(days, goal, now, rest);
  const { week: weekGoal, month: monthGoal, restToday } = usePeriodGoals();
  const thisWeek = periodGoal(days, 0, weekOf(today), today).words;
  const thisMonth = periodGoal(days, 0, monthOf(today), today).words;
  const todayWords = days[today] ?? 0;
  const devices = Object.keys(state.settings.statsElsewhere ?? {}).length;
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const month = last30.reduce((n, d) => n + (days[d] ?? 0), 0);

  // Focus once, on opening: a redraw mustn't pull the caret back.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    // On a narrow screen the calendar scrolls; start at the latest weeks.
    if (calendar.current) calendar.current.scrollLeft = calendar.current.scrollWidth;
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const show = (e: React.MouseEvent | React.FocusEvent, text: string) => {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top, text });
  };
  const hide = () => setTip(null);
  const describe = (d: string) => `${shortDate(d)}: ${fmt(days[d] ?? 0)} word${days[d] === 1 ? '' : 's'}${goal && (days[d] ?? 0) >= goal ? ' · goal met' : ''}`;

  // Bars: the last 30 days, with the goal as a dashed line.
  const max = Math.max(goal, ...last30.map((d) => days[d] ?? 0), 1);
  const chartH = 120;

  // Calendar: weeks as columns, Monday at the top; from the first day written (at least 10 weeks, at most WEEKS).
  const toDate = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const monday = addDays(today, -((toDate(today).getDay() + 6) % 7));
  const first = Object.keys(days).filter((d) => days[d] > 0).sort()[0] ?? today;
  const weeks = Math.min(WEEKS, Math.max(10, Math.ceil(Math.round((toDate(monday).getTime() - toDate(first).getTime()) / 86_400_000) / 7) + 1));
  const start = addDays(monday, -(weeks - 1) * 7);
  const level = (n: number) => {
    if (!n) return 0;
    const ref = goal || Math.max(1, ...Object.values(days));
    const r = n / ref;
    return goal ? (r < 0.5 ? 1 : r < 1 ? 2 : r < 2 ? 3 : 4) : r < 0.25 ? 1 : r < 0.5 ? 2 : r < 0.75 ? 3 : 4;
  };

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog stats-dialog" role="dialog" aria-modal="true" aria-label="Writing stats" tabIndex={-1} ref={panel}>
        <header className="dialog-head">
          <h2>Writing stats</h2>
          <button type="button" className="icon-btn" aria-label="Close writing stats" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <div className="stat-tiles">
            <div className="stat-tile">
              <span>Today</span>
              <b>{fmt(todayWords)}</b>
              {goal > 0 && !(restToday && todayWords < goal) ? (
                <>
                  <div className="stat-meter" role="progressbar" aria-label="Today’s goal" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(goal, todayWords)}>
                    <i style={{ width: `${Math.min(100, (todayWords / goal) * 100)}%` }} />
                  </div>
                  <small>{todayWords >= goal ? 'Goal met' : `${fmt(goal - todayWords)} to go`}</small>
                </>
              ) : (
                <small>{restToday ? 'A day off' : 'words'}</small>
              )}
            </div>
            <GoalTile label="This week" words={thisWeek} goal={weekGoal} note="Monday to Sunday" />
            <GoalTile label="This month" words={thisMonth} goal={monthGoal} note={`${fmt(month)} in the last 30 days`} />
            <div className="stat-tile">
              <span>Streak</span>
              <b>{current}</b>
              <small>
                {current === 1 ? 'day' : 'days'} in a row · best {best}
              </small>
            </div>
          </div>

          <div className="stats-head">
            <h3>Goals</h3>
          </div>
          <div className="goal-fields">
            <GoalInput label="Daily goal" unit="words a day" step={50} value={goal} onChange={(n) => store.updateSettings({ dailyGoal: n })} />
            <GoalInput label="Weekly goal" unit="words a week" step={500} value={state.settings.weeklyGoal ?? 0} onChange={(n) => store.updateSettings({ weeklyGoal: n })} />
            <GoalInput label="Monthly goal" unit="words a month" step={1000} value={state.settings.monthlyGoal ?? 0} onChange={(n) => store.updateSettings({ monthlyGoal: n })} />
          </div>
          <div className="rest-days">
            <span id="rest-days-label">Days off</span>
            <div role="group" aria-labelledby="rest-days-label">
              {WEEKDAYS.map(([n, short, name]) => (
                <button key={n} type="button" aria-label={name} title={name} aria-pressed={rest.includes(n)} onClick={() => store.updateSettings({ restDays: rest.includes(n) ? rest.filter((x) => x !== n) : [...rest, n].sort() })}>
                  {short}
                </button>
              ))}
            </div>
          </div>
          <p className="sync-hint">
            {goal ? 'Your streak counts days you meet the daily goal.' : 'With no daily goal, any day you write counts toward your streak.'}
            {rest.length ? ' Days off don’t break it, and the week’s and month’s words a day leave them out.' : ' Days off don’t break a streak.'}
          </p>

          <div className="stats-head">
            <h3>Last 30 days</h3>
            <button type="button" className="link-btn" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
              {asTable ? 'Show as chart' : 'Show as table'}
            </button>
          </div>
          {asTable ? (
            <table className="stats-table">
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Words</th>
                </tr>
              </thead>
              <tbody>
                {[...last30].reverse().map((d) => (
                  <tr key={d}>
                    <td>{shortDate(d)}</td>
                    <td>{fmt(days[d] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="bars" role="img" aria-label={`Words written each day for the last 30 days: ${fmt(month)} in all.`} style={{ height: chartH }}>
              {goal > 0 && (
                <div className="goal-line" style={{ bottom: (goal / max) * chartH }}>
                  <span>Goal {fmt(goal)}</span>
                </div>
              )}
              {last30.map((d) => {
                const n = days[d] ?? 0;
                return (
                  <div key={d} className="bar-slot" onMouseEnter={(e) => show(e, describe(d))} onMouseLeave={hide}>
                    <i className={`bar${d === today ? ' today' : ''}`} style={{ height: n ? Math.max(3, (n / max) * chartH) : 0 }} />
                  </div>
                );
              })}
            </div>
          )}
          {!asTable && (
            <div className="bars-axis" aria-hidden="true">
              <span>{shortDate(last30[0], { day: 'numeric', month: 'short' })}</span>
              <span>Today</span>
            </div>
          )}

          <div className="stats-head">
            <h3>Since {shortDate(start, { month: 'long', day: 'numeric' })}</h3>
          </div>
          <div ref={calendar} className="calendar" role="grid" aria-label="Words written each day">
            {Array.from({ length: weeks }, (_, w) => (
              <div key={w} className="cal-week" role="row">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(start, w * 7 + i);
                  if (d > today) return <span key={i} className="cal-day future" role="presentation" />;
                  return (
                    <span
                      key={i}
                      role="gridcell"
                      tabIndex={-1}
                      aria-label={describe(d)}
                      className={`cal-day l${level(days[d] ?? 0)}${d === today ? ' today' : ''}${rest.includes(weekday(d)) ? ' rest' : ''}`}
                      onMouseEnter={(e) => show(e, describe(d))}
                      onMouseLeave={hide}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="cal-legend" aria-hidden="true">
            Less
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className={`cal-day l${l}`} />
            ))}
            More
          </div>
          <p className="sync-hint">
            Words added to notes and chapters each day, after any deleting.{' '}
            {devices > 0 ? `Added up across your ${devices + 1} devices (the others as of the last sync).` : 'With Google Drive connected, writing on your other devices is added in too.'}
          </p>
        </div>
        {tip && (
          <div className="chart-tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
            {tip.text}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
