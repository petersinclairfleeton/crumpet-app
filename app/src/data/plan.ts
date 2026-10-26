// A book's plan: its plotlines (and what each does in every chapter), the
// story's timeline (events at story times, in chapters, with who's there), and
// a structure's beats (Save the Cat, the hero's journey...) placed along the
// book. Kept in project.json as `plan`.

import { cleanMaps } from './maps';

/** A plot thread (the mystery, the romance): a column of the plotline grid and a lane of the timeline. */
export interface Plotline {
  id: string;
  name: string;
  color: string;
  /** What it does in each chapter: chapter id → a line. */
  cells: Record<string, string>;
}

/** Something that happens, at a time in the story. */
export interface StoryEvent {
  id: string;
  title: string;
  /** When: a date ("2026-10-07"), with a time ("2026-10-07 14:30"), or a day of the story ("Day 3", "Day 3 14:30"); blank: not placed yet. */
  when: string;
  /** The chapter it's told in, its plotline, and who and where (characters' and places' ids). */
  chapterId?: string;
  plotlineId?: string;
  cast?: string[];
  note?: string;
}

/** A structure's beat: where it falls in the book (a share, 0 to 1), what it's for, and the chapter it's in. */
export interface StructureBeat {
  id: string;
  name: string;
  at: number;
  hint: string;
  chapterId?: string;
}

/** A chapter's story: whose point of view it's told from (a character's id), what they want in it, and how tense it is (1 to 5). */
export interface ChapterStory {
  id: string;
  pov?: string;
  aim?: string;
  tension?: number;
}

export interface BookPlan {
  plotlines?: Plotline[];
  events?: StoryEvent[];
  /** The structure chosen (a STRUCTURES id) and its beats. */
  structure?: { id: string; beats: StructureBeat[] };
  /** Each chapter's point of view, goal and tension (story.ts), by chapter id. */
  chapters?: ChapterStory[];
  /** Maps of the story's world, with pins on its places (maps.ts). */
  maps?: import('./maps').BookMap[];
}

export const PLOTLINE_COLORS = ['#c0703a', '#4f7cac', '#6f9a5b', '#a35d8f', '#c79a2b', '#4d9a9a', '#8a6fbf', '#b5544f'];

// ---------------------------------------------------------------- the timeline

/** A story time, comparable with others of its kind: real dates, or days of the story. */
export interface When {
  kind: 'date' | 'day';
  /** Minutes from the start of its kind's day 0 (for sorting), and whether a time of day was given. */
  key: number;
  timed: boolean;
}

/** Reads a story time ("2026-10-07", "2026-10-07 14:30", "Day 3", "day 3, 9:15", "3"); null when blank or not understood. */
export function parseWhen(text: string): When | null {
  const t = text.trim();
  const date = /^(\d{1,6})-(\d{1,2})-(\d{1,2})(?:[ T,]+(\d{1,2}):(\d{2}))?$/.exec(t);
  if (date) {
    const [, y, m, d, hh, mm] = date;
    const days = Math.floor(Date.UTC(Number(y), Number(m) - 1, Number(d)) / 86_400_000);
    return { kind: 'date', key: days * 1440 + (hh ? Number(hh) * 60 + Number(mm) : 0), timed: !!hh };
  }
  const day = /^(?:day\s*)?(-?\d+)(?:[ ,]+(\d{1,2}):(\d{2}))?$/i.exec(t);
  if (day) {
    const [, n, hh, mm] = day;
    return { kind: 'day', key: Number(n) * 1440 + (hh ? Number(hh) * 60 + Number(mm) : 0), timed: !!hh };
  }
  return null;
}

/** Events in story order: days of the story first, then dates; within a time, the order they were added; not placed yet at the end. */
export function timelineOrder(events: StoryEvent[]): StoryEvent[] {
  const at = new Map(events.map((e, i) => [e.id, i]));
  return [...events].sort((a, b) => {
    const x = parseWhen(a.when);
    const y = parseWhen(b.when);
    if (!x || !y) return x ? -1 : y ? 1 : at.get(a.id)! - at.get(b.id)!;
    if (x.kind !== y.kind) return x.kind === 'day' ? -1 : 1;
    return x.key - y.key || at.get(a.id)! - at.get(b.id)!;
  });
}

/** The same moment: the same day and time, or the same day when neither has a time. */
function sameMoment(a: When, b: When): boolean {
  return a.kind === b.kind && a.key === b.key && a.timed === b.timed;
}

/** A character in two places at once: the character, the two events, and the two places. */
export interface Clash {
  who: string;
  events: [StoryEvent, StoryEvent];
  places: [string, string];
}

/** Characters placed in two different places at the same moment. `isPlace` says whether a cast id is a place. */
export function clashes(events: StoryEvent[], isPlace: (id: string) => boolean): Clash[] {
  const out: Clash[] = [];
  const placed = events.map((e) => ({ e, w: parseWhen(e.when), place: (e.cast ?? []).find(isPlace) })).filter((x) => x.w && x.place);
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      if (a.place === b.place || !sameMoment(a.w!, b.w!)) continue;
      for (const who of a.e.cast ?? []) {
        if (!isPlace(who) && (b.e.cast ?? []).includes(who)) out.push({ who, events: [a.e, b.e], places: [a.place!, b.place!] });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- plotlines

/** A plotline's chapters with something in them, as a share of all the chapters (how much of the book it runs through). */
export function plotlineReach(p: Plotline, chapterIds: string[]): number {
  if (!chapterIds.length) return 0;
  return chapterIds.filter((id) => p.cells[id]?.trim()).length / chapterIds.length;
}

/** The longest run of chapters in a row where a plotline goes quiet, between its first and last appearance (0 when it never pauses). */
export function longestGap(p: Plotline, chapterIds: string[]): number {
  const on = chapterIds.map((id) => !!p.cells[id]?.trim());
  const first = on.indexOf(true);
  const last = on.lastIndexOf(true);
  let best = 0;
  let run = 0;
  for (let i = first + 1; first >= 0 && i < last; i++) {
    run = on[i] ? 0 : run + 1;
    best = Math.max(best, run);
  }
  return best;
}

// ---------------------------------------------------------------- structures

export interface Structure {
  id: string;
  name: string;
  about: string;
  beats: { name: string; at: number; hint: string }[];
}

export const STRUCTURES: Structure[] = [
  {
    id: 'three-act',
    name: 'Three acts',
    about: 'The classic shape: set-up, confrontation, resolution.',
    beats: [
      { name: 'Set-up', at: 0, hint: 'The hero’s world as it is, and what they want.' },
      { name: 'Inciting incident', at: 0.12, hint: 'Something happens that upsets that world.' },
      { name: 'Plot point one', at: 0.25, hint: 'The hero commits: there’s no going back. Act two begins.' },
      { name: 'Midpoint', at: 0.5, hint: 'A turn: a false victory or defeat raises the stakes.' },
      { name: 'Plot point two', at: 0.75, hint: 'The lowest point, or a discovery that leads to the end. Act three begins.' },
      { name: 'Climax', at: 0.9, hint: 'The final confrontation.' },
      { name: 'Resolution', at: 0.98, hint: 'The new world after it.' },
    ],
  },
  {
    id: 'save-the-cat',
    name: 'Save the Cat',
    about: 'Blake Snyder’s fifteen beats, as Jessica Brody set them out for novels.',
    beats: [
      { name: 'Opening image', at: 0, hint: 'A snapshot of the hero before the story changes them.' },
      { name: 'Theme stated', at: 0.05, hint: 'Someone hints at the lesson the hero needs to learn.' },
      { name: 'Set-up', at: 0.06, hint: 'The hero’s life, flaws and what’s missing.' },
      { name: 'Catalyst', at: 0.1, hint: 'The life-changing event.' },
      { name: 'Debate', at: 0.15, hint: 'The hero hesitates: should they go?' },
      { name: 'Break into two', at: 0.2, hint: 'They decide, and step into a new world.' },
      { name: 'B story', at: 0.22, hint: 'A new character who carries the theme.' },
      { name: 'Fun and games', at: 0.3, hint: 'The promise of the premise: the hero in the new world.' },
      { name: 'Midpoint', at: 0.5, hint: 'A false victory or false defeat; the stakes rise.' },
      { name: 'Bad guys close in', at: 0.62, hint: 'Pressure from outside and doubts inside.' },
      { name: 'All is lost', at: 0.75, hint: 'The lowest point; something or someone is lost.' },
      { name: 'Dark night of the soul', at: 0.78, hint: 'The hero takes in the loss.' },
      { name: 'Break into three', at: 0.8, hint: 'The answer: the lesson learned, a plan made.' },
      { name: 'Finale', at: 0.9, hint: 'The plan carried out; the hero proves they’ve changed.' },
      { name: 'Final image', at: 0.99, hint: 'The opening image’s mirror: how much has changed.' },
    ],
  },
  {
    id: 'heros-journey',
    name: 'The hero’s journey',
    about: 'Joseph Campbell’s monomyth in Christopher Vogler’s twelve stages.',
    beats: [
      { name: 'The ordinary world', at: 0, hint: 'The hero at home, before the adventure.' },
      { name: 'The call to adventure', at: 0.08, hint: 'A problem or a challenge appears.' },
      { name: 'Refusal of the call', at: 0.12, hint: 'Fear or doubt holds the hero back.' },
      { name: 'Meeting the mentor', at: 0.17, hint: 'Advice, training or a gift.' },
      { name: 'Crossing the threshold', at: 0.25, hint: 'The hero leaves the ordinary world.' },
      { name: 'Tests, allies and enemies', at: 0.35, hint: 'The rules of the new world; who’s who.' },
      { name: 'Approach to the inmost cave', at: 0.45, hint: 'Preparing for the central ordeal.' },
      { name: 'The ordeal', at: 0.5, hint: 'Facing the greatest fear; a death and rebirth.' },
      { name: 'Reward', at: 0.6, hint: 'Seizing the sword: what was won.' },
      { name: 'The road back', at: 0.75, hint: 'Turning for home, chased.' },
      { name: 'Resurrection', at: 0.9, hint: 'The last test, where everything is at stake.' },
      { name: 'Return with the elixir', at: 0.98, hint: 'Home again, changed, with something to share.' },
    ],
  },
  {
    id: 'seven-point',
    name: 'Seven points',
    about: 'Dan Wells’s structure: plan the end first, then the turns that get there.',
    beats: [
      { name: 'Hook', at: 0, hint: 'The hero in the state opposite to how they end.' },
      { name: 'Plot turn one', at: 0.15, hint: 'The call to adventure: the story gets going.' },
      { name: 'Pinch one', at: 0.35, hint: 'Pressure: the villain or the problem shows its teeth.' },
      { name: 'Midpoint', at: 0.5, hint: 'The hero moves from reacting to acting.' },
      { name: 'Pinch two', at: 0.65, hint: 'More pressure; the plan fails, all seems lost.' },
      { name: 'Plot turn two', at: 0.85, hint: 'The hero finds the last piece they need.' },
      { name: 'Resolution', at: 1, hint: 'The climax and the end: the opposite of the hook.' },
    ],
  },
  {
    id: 'story-circle',
    name: 'Story circle',
    about: 'Dan Harmon’s eight steps, around a circle and back.',
    beats: [
      { name: 'You', at: 0, hint: 'A character in their comfort zone.' },
      { name: 'Need', at: 0.125, hint: 'But they want something.' },
      { name: 'Go', at: 0.25, hint: 'They enter an unfamiliar situation.' },
      { name: 'Search', at: 0.375, hint: 'They adapt to it.' },
      { name: 'Find', at: 0.5, hint: 'They get what they wanted.' },
      { name: 'Take', at: 0.625, hint: 'They pay a heavy price for it.' },
      { name: 'Return', at: 0.75, hint: 'They go back to where they started.' },
      { name: 'Change', at: 0.875, hint: 'Having changed.' },
    ],
  },
  {
    id: 'kishotenketsu',
    name: 'Kishōtenketsu',
    about: 'Four acts from Chinese and Japanese storytelling: a twist rather than a conflict.',
    beats: [
      { name: 'Ki: introduction', at: 0, hint: 'The characters and their world.' },
      { name: 'Shō: development', at: 0.25, hint: 'Their story deepens; nothing big changes yet.' },
      { name: 'Ten: twist', at: 0.5, hint: 'Something unexpected, seen in a new light.' },
      { name: 'Ketsu: reconciliation', at: 0.75, hint: 'The twist and what came before brought together.' },
    ],
  },
];

/** A structure's beats for a book, with ids, each matched to the chapter it falls in (when there are chapters). */
export function structureBeats(s: Structure, chapters: { id: string; words: number }[], newId: () => string): StructureBeat[] {
  return s.beats.map((b) => {
    const chapterId = chapterAt(b.at, chapters);
    return { id: newId(), ...b, ...(chapterId ? { chapterId } : {}) };
  });
}

/** Where each chapter starts and ends in the book (shares, by words; by count while there are hardly any words). */
export function chapterSpans(chapters: { id: string; words: number }[]): { id: string; from: number; to: number }[] {
  const total = chapters.reduce((n, c) => n + c.words, 0);
  const byWords = total >= chapters.length * 50;
  let at = 0;
  return chapters.map((c, i) => {
    const size = byWords ? c.words / total : 1 / chapters.length;
    const span = { id: c.id, from: byWords ? at : i / chapters.length, to: byWords ? at + size : (i + 1) / chapters.length };
    at += size;
    return span;
  });
}

/** The chapter a share of the book falls in. */
export function chapterAt(at: number, chapters: { id: string; words: number }[]): string | null {
  const spans = chapterSpans(chapters);
  return (spans.find((s) => at >= s.from && at < s.to) ?? spans[spans.length - 1])?.id ?? null;
}

/** How far a beat's chapter is from where the beat would fall (a share of the book; 0 when it's in the right chapter). */
export function beatDrift(beat: StructureBeat, chapters: { id: string; words: number }[]): number {
  const span = chapterSpans(chapters).find((s) => s.id === beat.chapterId);
  if (!span) return 0;
  return beat.at < span.from ? span.from - beat.at : beat.at >= span.to ? beat.at - span.to : 0;
}

// ---------------------------------------------------------------- keeping

/** A plan without its empty parts (undefined when nothing's left). */
export function tidyPlan(plan: BookPlan | undefined): BookPlan | undefined {
  if (!plan) return undefined;
  const out: BookPlan = {};
  if (plan.plotlines?.length) out.plotlines = plan.plotlines;
  if (plan.events?.length) out.events = plan.events;
  if (plan.structure) out.structure = plan.structure;
  if (plan.chapters?.length) out.chapters = plan.chapters;
  if (plan.maps?.length) out.maps = plan.maps;
  return Object.keys(out).length ? out : undefined;
}

const str = (x: unknown) => (typeof x === 'string' ? x : '');

/** A plan from a project.json (written by hand, perhaps, or by another version): only what's well formed. */
export function cleanPlan(raw: unknown): BookPlan | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as Record<string, unknown>;
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is Record<string, unknown> => !!i && typeof i === 'object' && typeof (i as { id?: unknown }).id === 'string') : []);
  const plotlines: Plotline[] = list(p.plotlines).map((x) => ({
    id: x.id as string,
    name: str(x.name),
    color: /^#[0-9a-f]{3,8}$/i.test(str(x.color)) ? str(x.color) : PLOTLINE_COLORS[0],
    cells: x.cells && typeof x.cells === 'object' ? Object.fromEntries(Object.entries(x.cells as Record<string, unknown>).filter(([, v]) => typeof v === 'string' && v)) as Record<string, string> : {},
  }));
  const events: StoryEvent[] = list(p.events).map((x) => {
    const e: StoryEvent = { id: x.id as string, title: str(x.title), when: str(x.when) };
    if (str(x.chapterId)) e.chapterId = str(x.chapterId);
    if (str(x.plotlineId)) e.plotlineId = str(x.plotlineId);
    if (Array.isArray(x.cast)) {
      const cast = x.cast.filter((c): c is string => typeof c === 'string');
      if (cast.length) e.cast = cast;
    }
    if (str(x.note)) e.note = str(x.note);
    return e;
  });
  const s = p.structure as { id?: unknown; beats?: unknown } | undefined;
  const structure =
    s && typeof s === 'object' && typeof s.id === 'string'
      ? {
          id: s.id,
          beats: list(s.beats).map((b) => {
            const beat: StructureBeat = { id: b.id as string, name: str(b.name), at: typeof b.at === 'number' ? Math.min(1, Math.max(0, b.at)) : 0, hint: str(b.hint) };
            if (str(b.chapterId)) beat.chapterId = str(b.chapterId);
            return beat;
          }),
        }
      : undefined;
  const chapters: ChapterStory[] = list(p.chapters).map((x) => {
    const c: ChapterStory = { id: x.id as string };
    if (str(x.pov)) c.pov = str(x.pov);
    if (str(x.aim)) c.aim = str(x.aim);
    if (typeof x.tension === 'number' && x.tension >= 1) c.tension = Math.min(5, Math.round(x.tension));
    return c;
  });
  return tidyPlan({ plotlines, events, structure, chapters, maps: cleanMaps(p.maps) });
}
