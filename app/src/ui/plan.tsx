// A book's Plan (the outline's Plan view): its story Timeline (events at
// story times, in lanes by plotline or by character, with a warning when
// someone is in two places at once), its Plotlines (a grid of chapters and
// plot threads, saying what each thread does where), and its Structure (a
// beat sheet such as Save the Cat, each beat matched to its chapter), and each
// chapter's Point of view, goal and tension (story.tsx), and Maps of its world (maps.tsx).

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { type BookPlan, type Plotline, PLOTLINE_COLORS, type StoryEvent, STRUCTURES, beatDrift, chapterSpans, clashes, longestGap, parseWhen, plotlineReach, structureBeats, timelineOrder } from '../data/plan';
import { chapterWords, projectChapters } from '../data/selectors';
import { newId } from '../data/store';
import type { CastMember, Chapter, Project } from '../data/types';
import { useAppState, useAppStore } from './hooks';
import { StoryTab } from './story';
import { MapTab } from './maps';
import { IconBack, IconClose, IconPlus, IconTrash } from './icons';

type Tab = 'timeline' | 'plotlines' | 'structure' | 'pov' | 'map';

/** `inTab`: under a phone's book, as its Plan tab (which says where it is already). */
export function PlanView({ project, narrow, onBack, inTab = false }: { project: Project; narrow: boolean; onBack(): void; inTab?: boolean }) {
  const [tab, setTab] = useState<Tab>('timeline');
  return (
    <section className={`pane plan-pane${inTab ? ' in-tab' : ''}`} aria-label="Plan">
      <header className="plan-head">
        {narrow && !inTab && (
          <button type="button" className="icon-btn back" aria-label="Back to outline" onClick={onBack}>
            <IconBack size={18} />
          </button>
        )}
        {!inTab && <h1>Plan</h1>}
        <div className="segmented" role="tablist" aria-label="Plan">
          {(
            [
              ['timeline', 'Timeline'],
              ['plotlines', 'Plotlines'],
              ['structure', 'Structure'],
              ['pov', 'Point of view'],
              ['map', 'Map'],
            ] as const
          ).map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="plan-body">
        {tab === 'timeline' && <Timeline project={project} narrow={narrow} />}
        {tab === 'plotlines' && <Plotlines project={project} />}
        {tab === 'structure' && <StructureTab project={project} />}
        {tab === 'pov' && <StoryTab project={project} />}
        {tab === 'map' && <MapTab project={project} />}
      </div>
    </section>
  );
}

/** The book's chapters in order, with their numbers and words. */
function useChapters(project: Project): { chapter: Chapter; number: number; words: number }[] {
  const state = useAppState();
  return useMemo(() => projectChapters(project, state.chapters).map(({ chapter, number }) => ({ chapter, number, words: chapterWords(chapter) })), [project, state.chapters]);
}

const chapterName = (c: { chapter: Chapter; number: number }) => `${c.number}. ${c.chapter.title || 'Untitled chapter'}`;

// ---------------------------------------------------------------- timeline

function Timeline({ project, narrow }: { project: Project; narrow: boolean }) {
  const store = useAppStore();
  const chapters = useChapters(project);
  const plan = project.plan ?? {};
  const events = plan.events ?? [];
  const plotlines = plan.plotlines ?? [];
  const cast = project.cast ?? [];
  const [lanes, setLanes] = useState<'plotlines' | 'characters'>('plotlines');
  const [editing, setEditing] = useState<string | null>(null);
  const set = (next: BookPlan) => store.setPlan(project.id, next);
  const ordered = timelineOrder(events);
  const isPlace = (id: string) => cast.find((m) => m.id === id)?.kind === 'place';
  const found = clashes(events, isPlace);
  const nameOf = (id: string) => cast.find((m) => m.id === id)?.name || 'Someone';

  const add = (patch: Partial<StoryEvent> = {}) => {
    const e: StoryEvent = { id: newId(), title: '', when: '', ...patch };
    set({ ...plan, events: [...events, e] });
    setEditing(e.id);
  };
  const fromChapters = () => {
    const have = new Set(events.map((e) => e.chapterId));
    const added = chapters.filter((c) => !have.has(c.chapter.id)).map((c): StoryEvent => ({ id: newId(), title: c.chapter.title || `Chapter ${c.number}`, when: '', chapterId: c.chapter.id, ...(c.chapter.synopsis ? { note: c.chapter.synopsis } : {}) }));
    if (added.length) set({ ...plan, events: [...events, ...added] });
  };

  // The moments (columns), in story order; events with no time yet together at the end.
  const moments: { key: string; label: string; events: StoryEvent[] }[] = [];
  for (const e of ordered) {
    const w = parseWhen(e.when);
    const key = w ? `${w.kind}:${w.key}:${w.timed}` : 'unplaced';
    const m = moments.find((x) => x.key === key);
    if (m) m.events.push(e);
    else moments.push({ key, label: w ? e.when.trim() : 'Not placed yet', events: [e] });
  }
  const laneList: { id: string; name: string; color?: string; has(e: StoryEvent): boolean }[] =
    lanes === 'plotlines'
      ? [...plotlines.map((p) => ({ id: p.id, name: p.name || 'Untitled plotline', color: p.color, has: (e: StoryEvent) => e.plotlineId === p.id })), { id: 'none', name: plotlines.length ? 'No plotline' : 'Events', has: (e: StoryEvent) => !e.plotlineId || !plotlines.some((p) => p.id === e.plotlineId) }]
      : [...cast.filter((m) => m.kind === 'character').map((m) => ({ id: m.id, name: m.name || 'Unnamed', has: (e: StoryEvent) => (e.cast ?? []).includes(m.id) })), { id: 'none', name: 'No one named', has: (e: StoryEvent) => !(e.cast ?? []).some((id) => !isPlace(id)) }];
  const shownLanes = laneList.filter((l) => l.id !== 'none' || events.some(l.has));

  const card = (e: StoryEvent) => {
    const ch = chapters.find((c) => c.chapter.id === e.chapterId);
    const pl = plotlines.find((p) => p.id === e.plotlineId);
    const people = (e.cast ?? []).filter((id) => cast.some((m) => m.id === id));
    return (
      <button key={e.id} type="button" className="event-card" style={pl ? ({ '--lane': pl.color } as React.CSSProperties) : undefined} onClick={() => setEditing(e.id)}>
        <b>{e.title || 'Untitled event'}</b>
        {ch && <span className="event-chapter">{chapterName(ch)}</span>}
        {people.length > 0 && <span className="event-cast">{people.map(nameOf).join(', ')}</span>}
      </button>
    );
  };

  return (
    <div className="timeline">
      <div className="plan-tools">
        <button type="button" className="btn primary small" onClick={() => add()}>
          <IconPlus size={13} /> Event
        </button>
        {chapters.some((c) => !events.some((e) => e.chapterId === c.chapter.id)) && (
          <button type="button" className="btn small" onClick={fromChapters}>
            Add the chapters
          </button>
        )}
        <span className="grow" />
        {!narrow && (
          <div className="segmented small" role="group" aria-label="Lanes">
            <button type="button" aria-pressed={lanes === 'plotlines'} onClick={() => setLanes('plotlines')}>
              By plotline
            </button>
            <button type="button" aria-pressed={lanes === 'characters'} onClick={() => setLanes('characters')}>
              By character
            </button>
          </div>
        )}
      </div>
      {found.length > 0 && (
        <ul className="plan-warnings" aria-label="Clashes">
          {found.map((c, i) => (
            <li key={i}>
              ⚠ {nameOf(c.who)} is in two places at once ({c.events[0].when.trim()}): {nameOf(c.places[0])} in “{c.events[0].title || 'Untitled event'}” and {nameOf(c.places[1])} in “{c.events[1].title || 'Untitled event'}”.
            </li>
          ))}
        </ul>
      )}
      {events.length === 0 ? (
        <p className="plan-empty">
          What happens when, in the story: add events with a date (2026-10-07 14:30) or a day of the story (Day 3, Day 3 14:30), the chapter that tells them, the plotline and who’s there. Or start from your chapters with Add the chapters.
        </p>
      ) : narrow ? (
        <ol className="timeline-list">
          {moments.map((m) => (
            <li key={m.key}>
              <h3>{m.label}</h3>
              {m.events.map(card)}
            </li>
          ))}
        </ol>
      ) : (
        <div className="timeline-grid" role="grid" aria-label="Timeline" style={{ gridTemplateColumns: `150px repeat(${moments.length}, 190px)` }}>
          <div role="row" className="timeline-row head">
            <span role="columnheader" />
            {moments.map((m) => (
              <span key={m.key} role="columnheader" className={m.key === 'unplaced' ? 'unplaced' : ''}>
                {m.label}
              </span>
            ))}
          </div>
          {shownLanes.map((l) => (
            <div key={l.id} role="row" className="timeline-row">
              <span role="rowheader" className="lane-name" style={l.color ? ({ '--lane': l.color } as React.CSSProperties) : undefined}>
                {l.name}
              </span>
              {moments.map((m) => (
                <span key={m.key} role="gridcell" className="timeline-cell">
                  {m.events.filter(l.has).map(card)}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
      {editing && events.some((e) => e.id === editing) && <EventDialog project={project} event={events.find((e) => e.id === editing)!} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EventDialog({ project, event, onClose }: { project: Project; event: StoryEvent; onClose(): void }) {
  const store = useAppStore();
  const chapters = useChapters(project);
  const plan = project.plan ?? {};
  const cast = project.cast ?? [];
  const update = (patch: Partial<StoryEvent>) => store.setPlan(project.id, { ...plan, events: (plan.events ?? []).map((e) => (e.id === event.id ? clean({ ...e, ...patch }) : e)) });
  const remove = () => {
    store.setPlan(project.id, { ...plan, events: (plan.events ?? []).filter((e) => e.id !== event.id) });
    onClose();
  };
  const toggle = (id: string) => update({ cast: (event.cast ?? []).includes(id) ? (event.cast ?? []).filter((x) => x !== id) : [...(event.cast ?? []), id] });
  const when = event.when.trim();
  const group = (kind: CastMember['kind']) => cast.filter((m) => m.kind === kind);
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog event-dialog" role="dialog" aria-modal="true" aria-label="Event" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <header className="dialog-head">
          <h2>Event</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <label className="field">
            <span>What happens</span>
            <input autoFocus value={event.title} placeholder="The storm reaches the island" onChange={(e) => update({ title: e.target.value })} />
          </label>
          <label className="field">
            <span>When, in the story</span>
            <input value={event.when} placeholder="Day 3 14:30, or 1912-04-14 23:40" onChange={(e) => update({ when: e.target.value })} />
            <small className="sync-hint">{!when ? 'A date (2026-10-07, with a time if you like) or a day of the story (Day 3).' : parseWhen(when) ? 'In story order on the timeline.' : 'Write it as a date (2026-10-07) or a day (Day 3) to put it in order.'}</small>
          </label>
          <div className="field-row">
            <label className="field">
              <span>Told in</span>
              <select value={event.chapterId ?? ''} onChange={(e) => update({ chapterId: e.target.value || undefined })}>
                <option value="">No chapter</option>
                {chapters.map((c) => (
                  <option key={c.chapter.id} value={c.chapter.id}>
                    {chapterName(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Plotline</span>
              <select value={event.plotlineId ?? ''} onChange={(e) => update({ plotlineId: e.target.value || undefined })}>
                <option value="">None</option>
                {(plan.plotlines ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || 'Untitled plotline'}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {cast.length > 0 && (
            <fieldset className="event-cast-pick">
              <legend>Who’s there, and where</legend>
              {(['character', 'place'] as const).map((k) =>
                group(k).length ? (
                  <div key={k} className="chips">
                    {group(k).map((m) => (
                      <button key={m.id} type="button" className="chip" aria-pressed={(event.cast ?? []).includes(m.id)} onClick={() => toggle(m.id)}>
                        {m.name || (k === 'place' ? 'Unnamed place' : 'Unnamed')}
                      </button>
                    ))}
                  </div>
                ) : null,
              )}
            </fieldset>
          )}
          <label className="field">
            <span>Note</span>
            <textarea rows={3} value={event.note ?? ''} onChange={(e) => update({ note: e.target.value })} />
          </label>
          <div className="dialog-actions">
            <button type="button" className="btn danger quiet" onClick={remove}>
              <IconTrash size={13} /> Delete event
            </button>
            <span className="grow" />
            <button type="button" className="btn primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** An event without its empty parts. */
function clean(e: StoryEvent): StoryEvent {
  const out = { ...e };
  if (!out.chapterId) delete out.chapterId;
  if (!out.plotlineId) delete out.plotlineId;
  if (!out.cast?.length) delete out.cast;
  if (!out.note) delete out.note;
  return out;
}

// ---------------------------------------------------------------- plotlines

function Plotlines({ project }: { project: Project }) {
  const store = useAppStore();
  const chapters = useChapters(project);
  const plan = project.plan ?? {};
  const plotlines = plan.plotlines ?? [];
  const ids = chapters.map((c) => c.chapter.id);
  const set = (next: Plotline[]) => store.setPlan(project.id, { ...plan, plotlines: next });
  const change = (id: string, patch: Partial<Plotline>) => set(plotlines.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const add = () => set([...plotlines, { id: newId(), name: '', color: PLOTLINE_COLORS[plotlines.length % PLOTLINE_COLORS.length], cells: {} }]);
  const remove = (p: Plotline) => {
    if (Object.values(p.cells).some((v) => v.trim()) && !confirm(`Delete the plotline “${p.name || 'Untitled plotline'}” and what it says for each chapter?`)) return;
    store.setPlan(project.id, { ...plan, plotlines: plotlines.filter((x) => x.id !== p.id), events: (plan.events ?? []).map((e) => (e.plotlineId === p.id ? { ...e, plotlineId: undefined } : e)) });
  };
  if (!chapters.length) return <p className="plan-empty">Add a chapter to the book first.</p>;
  return (
    <div className="plotlines">
      {plotlines.length === 0 && <p className="plan-intro">Each column is a thread of the story; say in a line what it does in each chapter, and see where it carries on or goes quiet.</p>}
      <div className="plot-grid" role="grid" aria-label="Plotlines" style={{ gridTemplateColumns: `minmax(140px, 200px) repeat(${plotlines.length}, minmax(170px, 1fr)) 120px` }}>
        <div role="row" className="plot-row head">
          <span role="columnheader">Chapter</span>
          {plotlines.map((p, i) => (
            <span key={p.id} role="columnheader" className="plot-head" style={{ '--lane': p.color } as React.CSSProperties}>
              <button type="button" className="plot-color" aria-label={`Colour of ${p.name || 'plotline'}`} title="Change the colour" onClick={() => change(p.id, { color: PLOTLINE_COLORS[(PLOTLINE_COLORS.indexOf(p.color) + 1) % PLOTLINE_COLORS.length] })} />
              <input aria-label={`Plotline ${i + 1} name`} value={p.name} placeholder="Plotline" onChange={(e) => change(p.id, { name: e.target.value })} />
              <button type="button" className="icon-btn" aria-label={`Delete ${p.name || 'plotline'}`} onClick={() => remove(p)}>
                <IconTrash size={12} />
              </button>
            </span>
          ))}
          <span role="columnheader">
            <button type="button" className="btn small" onClick={add}>
              <IconPlus size={12} /> Plotline
            </button>
          </span>
        </div>
        {chapters.map((c) => (
          <div key={c.chapter.id} role="row" className="plot-row">
            <span role="rowheader" className="plot-chapter">
              {chapterName(c)}
            </span>
            {plotlines.map((p) => (
              <span key={p.id} role="gridcell" className={`plot-cell${p.cells[c.chapter.id]?.trim() ? ' on' : ''}`} style={{ '--lane': p.color } as React.CSSProperties}>
                <textarea rows={2} aria-label={`${p.name || 'Plotline'} in ${chapterName(c)}`} value={p.cells[c.chapter.id] ?? ''} placeholder="—" onChange={(e) => change(p.id, { cells: tidyCells({ ...p.cells, [c.chapter.id]: e.target.value }) })} />
              </span>
            ))}
            <span role="gridcell" />
          </div>
        ))}
        {plotlines.length > 0 && (
          <div role="row" className="plot-row foot">
            <span role="rowheader">Runs through</span>
            {plotlines.map((p) => {
              const gap = longestGap(p, ids);
              return (
                <span key={p.id} role="gridcell" className="plot-reach">
                  {Math.round(plotlineReach(p, ids) * 100)}% of the chapters
                  {gap >= 3 && <small> · quiet for {gap} chapters in a row</small>}
                </span>
              );
            })}
            <span role="gridcell" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Cells without empty lines. */
function tidyCells(cells: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(cells).filter(([, v]) => v !== ''));
}

// ---------------------------------------------------------------- structure

function StructureTab({ project }: { project: Project }) {
  const store = useAppStore();
  const chapters = useChapters(project);
  const plan = project.plan ?? {};
  const [choosing, setChoosing] = useState(!plan.structure);
  const shape = chapters.map((c) => ({ id: c.chapter.id, words: c.words }));
  const spans = chapterSpans(shape);
  const chosen = plan.structure ? STRUCTURES.find((s) => s.id === plan.structure!.id) : undefined;
  // A new book (one empty chapter at most): it can start with a chapter for each beat.
  const empty = chapters.length <= 1 && chapters.every((c) => c.words === 0);

  const use = (id: string, makeChapters: boolean) => {
    const s = STRUCTURES.find((x) => x.id === id)!;
    if (makeChapters) {
      // A chapter for each beat, named after it, its synopsis what the beat is for (the empty first chapter becomes the first beat).
      let after: string | null = chapters[chapters.length - 1]?.chapter.id ?? null;
      const made: { id: string; words: number }[] = [];
      s.beats.forEach((b, i) => {
        const first = i === 0 && chapters.length === 1 && empty ? chapters[0].chapter : null;
        const c = first ?? store.addChapter(project.id, after);
        if (!c) return;
        store.setChapterTitle(c.id, b.name);
        store.setChapterSynopsis(c.id, b.hint);
        after = c.id;
        made.push({ id: c.id, words: 0 });
      });
      let n = 0;
      const beats = s.beats.map((b) => ({ id: newId(), ...b, chapterId: made[n++]?.id }));
      store.setPlan(project.id, { ...store.project(project.id)?.plan, structure: { id: s.id, beats } });
    } else store.setPlan(project.id, { ...plan, structure: { id: s.id, beats: structureBeats(s, shape, newId) } });
    setChoosing(false);
  };

  if (choosing || !plan.structure) {
    return (
      <div className="structures">
        <p className="plan-intro">A shape for the story: its beats are laid along the book, each matched to the chapter where it falls (by words written), to see whether the turns come where readers expect them.</p>
        <div className="structure-cards">
          {STRUCTURES.map((s) => (
            <div key={s.id} className="structure-card">
              <h3>{s.name}</h3>
              <p>{s.about}</p>
              <small>{s.beats.map((b) => b.name).join(' · ')}</small>
              <div className="structure-use">
                <button type="button" className="btn small" onClick={() => use(s.id, false)}>
                  Use this
                </button>
                {empty && (
                  <button type="button" className="btn small" onClick={() => use(s.id, true)}>
                    A chapter for each beat
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {plan.structure && (
          <button type="button" className="btn quiet" onClick={() => setChoosing(false)}>
            Keep {STRUCTURES.find((s) => s.id === plan.structure!.id)?.name ?? 'the one chosen'}
          </button>
        )}
      </div>
    );
  }

  const beats = plan.structure.beats;
  const setBeat = (id: string, chapterId: string) => store.setPlan(project.id, { ...plan, structure: { ...plan.structure!, beats: beats.map((b) => (b.id === id ? { ...b, chapterId: chapterId || undefined } : b)) } });
  return (
    <div className="structure">
      <div className="plan-tools">
        <h2>{chosen?.name ?? 'Structure'}</h2>
        <span className="grow" />
        <button type="button" className="btn small" onClick={() => setChoosing(true)}>
          Change…
        </button>
        <button type="button" className="btn small quiet" onClick={() => store.setPlan(project.id, { ...plan, structure: undefined })}>
          Remove
        </button>
      </div>
      <div className="beat-strip" aria-label="The book, start to end">
        {spans.map((s, i) => (
          <span key={s.id} className="beat-span" style={{ left: `${s.from * 100}%`, width: `${(s.to - s.from) * 100}%` }} title={chapterName(chapters[i])} />
        ))}
        {beats.map((b) => (
          <span key={b.id} className="beat-mark" style={{ left: `${b.at * 100}%` }} title={`${b.name} (${Math.round(b.at * 100)}%)`} />
        ))}
      </div>
      <ol className="beat-list">
        {beats.map((b) => {
          const drift = beatDrift(b, shape);
          const ideal = spans.find((s) => b.at >= s.from && b.at < s.to) ?? spans[spans.length - 1];
          const idealName = ideal ? chapterName(chapters.find((c) => c.chapter.id === ideal.id)!) : '';
          return (
            <li key={b.id} className="beat">
              <span className="beat-at">{Math.round(b.at * 100)}%</span>
              <div className="beat-text">
                <b>{b.name}</b>
                <small>{b.hint}</small>
                {drift > 0.08 && <small className="beat-drift">Falls {Math.round(drift * 100)}% of the book {(chapterSpans(shape).find((s) => s.id === b.chapterId)?.from ?? 0) > b.at ? 'later' : 'earlier'} than expected (around {idealName}).</small>}
              </div>
              <select aria-label={`Chapter for ${b.name}`} value={b.chapterId ?? ''} onChange={(e) => setBeat(b.id, e.target.value)}>
                <option value="">No chapter yet</option>
                {chapters.map((c) => (
                  <option key={c.chapter.id} value={c.chapter.id}>
                    {chapterName(c)}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
