// Writing stats: words today against the daily goal, streaks, the last 30
// days as bars, and a calendar of the last few months.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, dailyWords, dayKey, streaks } from '../data/stats';
import { useAppState, useAppStore } from './hooks';
import { IconClose } from './icons';

const WEEKS = 30;

function shortDate(day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

const fmt = (n: number) => n.toLocaleString();

/** Words written today, for the sidebar. */
export function useTodayWords(): number {
  const state = useAppState();
  return dailyWords(state.settings.stats, Date.now())[dayKey(Date.now())] ?? 0;
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
  const days = useMemo(() => dailyWords(state.settings.stats, now), [state.settings.stats, now]);
  const { current, best } = streaks(days, goal, now);
  const todayWords = days[today] ?? 0;
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const week = last30.slice(-7).reduce((n, d) => n + (days[d] ?? 0), 0);
  const month = last30.reduce((n, d) => n + (days[d] ?? 0), 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    // On a narrow screen the calendar scrolls; start at the latest weeks.
    if (calendar.current) calendar.current.scrollLeft = calendar.current.scrollWidth;
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const show = (e: React.MouseEvent | React.FocusEvent, text: string) => {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top, text });
  };
  const hide = () => setTip(null);
  const describe = (d: string) => `${shortDate(d)}: ${fmt(days[d] ?? 0)} word${days[d] === 1 ? '' : 's'}${goal && (days[d] ?? 0) >= goal ? ' · goal met' : ''}`;

  // Bars: the last 30 days, with the goal as a dashed line.
  const max = Math.max(goal, ...last30.map((d) => days[d] ?? 0), 1);
  const chartH = 120;

  // Calendar: weeks as columns, Monday at the top.
  const start = (() => {
    const [y, m, d] = today.split('-').map(Number);
    const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
    return addDays(today, -dow - (WEEKS - 1) * 7);
  })();
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
              {goal > 0 ? (
                <>
                  <div className="stat-meter" role="progressbar" aria-label="Today’s goal" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(goal, todayWords)}>
                    <i style={{ width: `${Math.min(100, (todayWords / goal) * 100)}%` }} />
                  </div>
                  <small>{todayWords >= goal ? 'Goal met' : `${fmt(goal - todayWords)} to go`}</small>
                </>
              ) : (
                <small>words</small>
              )}
            </div>
            <div className="stat-tile">
              <span>Streak</span>
              <b>{current}</b>
              <small>{current === 1 ? 'day' : 'days'} in a row</small>
            </div>
            <div className="stat-tile">
              <span>Best streak</span>
              <b>{best}</b>
              <small>{best === 1 ? 'day' : 'days'}</small>
            </div>
            <div className="stat-tile">
              <span>Last 7 days</span>
              <b>{fmt(week)}</b>
              <small>{fmt(month)} in 30 days</small>
            </div>
          </div>

          <label className="field goal-field">
            <span>Daily goal</span>
            <span className="with-unit">
              <input
                type="number"
                min={0}
                step={50}
                value={goal || ''}
                placeholder="None"
                aria-label="Daily goal in words"
                onChange={(e) => store.updateSettings({ dailyGoal: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              />
              <small>words a day</small>
            </span>
            <small className="sync-hint">{goal ? 'Your streak counts days you meet the goal.' : 'With no goal, any day you write counts toward your streak.'}</small>
          </label>

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
            {Array.from({ length: WEEKS }, (_, w) => (
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
                      className={`cal-day l${level(days[d] ?? 0)}${d === today ? ' today' : ''}`}
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
          <p className="sync-hint">Counted on this device: words added to notes and chapters each day, after any deleting.</p>
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
