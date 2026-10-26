// The Plan's Point of view tab: for each chapter, whose point of view it's
// told from, what they want in it and how tense it is; then the tension
// across the book (and its flat stretches), how much of the book each point
// of view has, and what's not filled in yet.

import { useMemo } from 'react';
import { flatStretches, numberList, povColor, povShare, storyGaps, storyOf, withStory } from '../data/story';
import { chapterWords, projectChapters } from '../data/selectors';
import type { Project } from '../data/types';
import { useAppState, useAppStore } from './hooks';

const TENSION = ['Calm', 'Uneasy', 'Rising', 'High', 'As tense as it gets'];

export function StoryTab({ project }: { project: Project }) {
  const state = useAppState();
  const store = useAppStore();
  const plan = project.plan;
  const cast = project.cast ?? [];
  const people = cast.filter((m) => m.kind === 'character').sort((a, b) => a.name.localeCompare(b.name));
  const chapters = useMemo(() => projectChapters(project, state.chapters).map(({ chapter, number }) => ({ chapter, number, words: chapterWords(chapter) })), [project, state.chapters]);
  const set = (id: string, patch: Parameters<typeof withStory>[2]) => store.setPlan(project.id, withStory(plan, id, patch));
  if (!chapters.length) return <p className="plan-empty">Add a chapter to the book first.</p>;

  const tension = chapters.map((c) => storyOf(plan, c.chapter.id).tension);
  const flat = flatStretches(tension);
  const gaps = storyGaps(chapters.map((c) => ({ id: c.chapter.id, number: c.number })), plan);
  const share = povShare(chapters.map((c) => ({ id: c.chapter.id, words: c.words })), plan, cast);
  const anyPov = share.some((s) => s.id);
  const anyTension = tension.some((t) => t !== undefined);

  // The tension chart: a point for each chapter with a tension, coloured by its point of view.
  const W = Math.max(320, chapters.length * 44);
  const H = 130;
  const x = (i: number) => 24 + (i * (W - 48)) / Math.max(1, chapters.length - 1);
  const y = (t: number) => H - 22 - ((t - 1) * (H - 44)) / 4;
  const points = tension.map((t, i) => (t === undefined ? null : { i, t })).filter((p): p is { i: number; t: number } => !!p);

  return (
    <div className="story-tab">
      {!anyPov && !anyTension && <p className="plan-intro">Whose point of view each chapter is told from, what they want in it, and how tense it is (the dots). The tension’s rise and fall and each point of view’s share of the book show below once you set them.</p>}
      {people.length === 0 && <p className="sync-hint">Add characters (Characters &amp; places, under the outline) to choose whose point of view a chapter is.</p>}
      <div className="story-grid" role="grid" aria-label="Chapters’ point of view and tension">
        <div role="row" className="story-row head">
          <span role="columnheader">Chapter</span>
          <span role="columnheader">Point of view</span>
          <span role="columnheader">What they want here</span>
          <span role="columnheader">Tension</span>
        </div>
        {chapters.map((c) => {
          const s = storyOf(plan, c.chapter.id);
          const color = povColor(cast, s.pov);
          return (
            <div key={c.chapter.id} role="row" className="story-row" style={color ? ({ '--pov': color } as React.CSSProperties) : undefined}>
              <span role="rowheader" className="story-chapter">
                {c.number}. {c.chapter.title || 'Untitled chapter'}
              </span>
              <span role="gridcell">
                <select aria-label={`Point of view of chapter ${c.number}`} value={s.pov ?? ''} onChange={(e) => set(c.chapter.id, { pov: e.target.value || undefined })}>
                  <option value="">—</option>
                  {people.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </span>
              <span role="gridcell">
                <input aria-label={`What they want in chapter ${c.number}`} placeholder="Their goal here" value={s.aim ?? ''} onChange={(e) => set(c.chapter.id, { aim: e.target.value })} />
              </span>
              <span role="gridcell" className="tension-pick" aria-label={`Tension of chapter ${c.number}`}>
                {TENSION.map((label, i) => (
                  <button key={label} type="button" aria-label={`${i + 1}: ${label}`} title={`${i + 1}: ${label}`} aria-pressed={(s.tension ?? 0) >= i + 1} onClick={() => set(c.chapter.id, { tension: s.tension === i + 1 ? undefined : i + 1 })} />
                ))}
              </span>
            </div>
          );
        })}
      </div>

      {anyTension && (
        <section className="story-section" aria-label="Tension across the book">
          <h3>Tension across the book</h3>
          <div className="story-chart-scroll">
            <svg className="story-chart" width={W} height={H} role="img" aria-label={`Tension by chapter: ${points.map((p) => `${chapters[p.i].number}: ${p.t}`).join(', ')}`}>
              {[1, 2, 3, 4, 5].map((t) => (
                <line key={t} className="grid" x1={16} x2={W - 16} y1={y(t)} y2={y(t)} />
              ))}
              {flat.map((f) => (
                <rect key={f.from} className="flat" x={x(f.from - 1) - 10} width={x(f.to - 1) - x(f.from - 1) + 20} y={8} height={H - 24} rx={6} />
              ))}
              <polyline points={points.map((p) => `${x(p.i)},${y(p.t)}`).join(' ')} />
              {points.map((p) => (
                <circle key={p.i} cx={x(p.i)} cy={y(p.t)} r={5} style={{ fill: povColor(cast, storyOf(plan, chapters[p.i].chapter.id).pov) ?? 'var(--accent)' }} />
              ))}
              {chapters.map((c, i) => (
                <text key={c.chapter.id} x={x(i)} y={H - 4} textAnchor="middle">
                  {c.number}
                </text>
              ))}
            </svg>
          </div>
          {flat.map((f) => (
            <p key={f.from} className="story-note">
              Chapters {f.from}–{f.to} stay calm (tension 2 or less) for {f.to - f.from + 1} chapters in a row. Is that on purpose?
            </p>
          ))}
        </section>
      )}

      {anyPov && (
        <section className="story-section" aria-label="Points of view">
          <h3>Points of view</h3>
          <ul className="pov-share">
            {share.map((s) => (
              <li key={s.id ?? 'none'} style={{ '--pov': povColor(cast, s.id ?? undefined) ?? 'var(--line2)' } as React.CSSProperties}>
                <span className="grow">{s.name}</span>
                <small>
                  {s.chapters} chapter{s.chapters === 1 ? '' : 's'} · {Math.round(s.share * 100)}%
                </small>
                <i style={{ width: `${Math.max(2, s.share * 100)}%` }} aria-hidden="true" />
              </li>
            ))}
          </ul>
          {gaps.noPov.length > 0 && <p className="story-note">No point of view yet: chapter{gaps.noPov.length === 1 ? '' : 's'} {numberList(gaps.noPov)}.</p>}
          {gaps.noAim.length > 0 && gaps.noAim.length < chapters.length && <p className="story-note">No goal yet: chapter{gaps.noAim.length === 1 ? '' : 's'} {numberList(gaps.noAim)}. A point-of-view character who wants nothing makes a chapter slack.</p>}
        </section>
      )}
    </div>
  );
}
