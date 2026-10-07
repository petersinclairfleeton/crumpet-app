// Headers and footers, like Word's: text at the top and bottom of every page,
// in three places (left, centre, right), with fields such as the page number
// or the chapter title that fill themselves in. The first page, the first page
// of each chapter, and left (even) pages can each have their own.

export type HFField = 'page' | 'pages' | 'chapterPages' | 'title' | 'chapter' | 'chapterTitle' | 'part' | 'author' | 'date' | 'time' | 'words' | 'created' | 'updated';

export type DateFormat = 'long' | 'short' | 'iso' | 'month';

/** A piece of header or footer text: plain text, or a field. */
export interface HFRun {
  text?: string;
  field?: HFField;
  /** Dates: how they're written. */
  fmt?: DateFormat;
  b?: boolean;
  i?: boolean;
  u?: boolean;
}

export type HFSlotName = 'left' | 'center' | 'right';
export const SLOTS: HFSlotName[] = ['left', 'center', 'right'];

export type HFBand = Record<HFSlotName, HFRun[]>;
export interface HFSet {
  header: HFBand;
  footer: HFBand;
}

/** Which header and footer a page uses. */
export type HFVariant = 'main' | 'even' | 'first' | 'chapterFirst';

export type NumberFormat = '1' | 'i' | 'I' | 'a' | 'A';

export interface HeadersFooters {
  sets: Partial<Record<HFVariant, HFSet>>;
  /** The very first page has its own (often none, for a title page). */
  differentFirst: boolean;
  /** The first page of each chapter has its own, like printed books. */
  differentChapterFirst: boolean;
  /** Left (even) and right (odd) pages differ. */
  differentOddEven: boolean;
  numberFormat: NumberFormat;
  /** Number of the first page. */
  startAt: number;
  /** Inches from the top edge to the header, and from the bottom edge to the footer. */
  headerFrom: number;
  footerFrom: number;
  /** A thin line under the header and above the footer. */
  headerLine: boolean;
  footerLine: boolean;
  /** Name for the Author field; the name from Settings when empty. */
  author?: string;
}

export const FIELDS: { id: HFField; name: string; hint: string }[] = [
  { id: 'page', name: 'Page number', hint: 'The number of this page' },
  { id: 'pages', name: 'Number of pages', hint: 'How many pages there are in all' },
  { id: 'chapterPages', name: 'Pages in this chapter', hint: 'How many pages this chapter has' },
  { id: 'title', name: 'Title', hint: 'The project’s or note’s title' },
  { id: 'chapter', name: 'Chapter number', hint: 'The chapter’s number' },
  { id: 'chapterTitle', name: 'Chapter title', hint: 'The title of the chapter on this page' },
  { id: 'part', name: 'Part', hint: 'The part the chapter is in' },
  { id: 'author', name: 'Author', hint: 'Your name, from Settings, or the one set here' },
  { id: 'date', name: 'Date', hint: 'Today’s date' },
  { id: 'time', name: 'Time', hint: 'The time now' },
  { id: 'words', name: 'Word count', hint: 'How many words there are' },
  { id: 'created', name: 'Date created', hint: 'When it was first written' },
  { id: 'updated', name: 'Date last changed', hint: 'When it was last edited' },
];

export const NUMBER_FORMATS: { id: NumberFormat; name: string }[] = [
  { id: '1', name: '1, 2, 3' },
  { id: 'i', name: 'i, ii, iii' },
  { id: 'I', name: 'I, II, III' },
  { id: 'a', name: 'a, b, c' },
  { id: 'A', name: 'A, B, C' },
];

export const DATE_FORMATS: { id: DateFormat; name: string }[] = [
  { id: 'long', name: '7 October 2026' },
  { id: 'short', name: '07/10/2026' },
  { id: 'iso', name: '2026-10-07' },
  { id: 'month', name: 'October 2026' },
];

export const emptyBand = (): HFBand => ({ left: [], center: [], right: [] });
export const emptySet = (): HFSet => ({ header: emptyBand(), footer: emptyBand() });

const BASE: Omit<HeadersFooters, 'sets'> = {
  differentFirst: false,
  differentChapterFirst: false,
  differentOddEven: false,
  numberFormat: '1',
  startAt: 1,
  headerFrom: 0.5,
  footerFrom: 0.5,
  headerLine: false,
  footerLine: false,
};

/** A page number in the middle of the footer. */
export function pageNumberFooter(): HeadersFooters {
  return { ...BASE, sets: { main: { header: emptyBand(), footer: { ...emptyBand(), center: [{ field: 'page' }] } } } };
}

/** Standard manuscript format: “Author / TITLE / page” at the top right, and none on the first page. */
export function manuscriptHeaders(): HeadersFooters {
  const right: HFRun[] = [{ field: 'author' }, { text: ' / ' }, { field: 'title' }, { text: ' / ' }, { field: 'page' }];
  return { ...BASE, differentFirst: true, sets: { main: { header: { ...emptyBand(), right }, footer: emptyBand() }, first: emptySet() } };
}

const isRun = (r: unknown): r is HFRun => !!r && typeof r === 'object' && (typeof (r as HFRun).text === 'string' || FIELDS.some((f) => f.id === (r as HFRun).field));

function cleanBand(b: Partial<HFBand> | undefined): HFBand {
  const out = emptyBand();
  for (const s of SLOTS) out[s] = Array.isArray(b?.[s]) ? b[s].filter(isRun) : [];
  return out;
}

/** Headers and footers saved earlier (or by an older version, or edited by hand), made whole. */
export function cleanHF(hf: Partial<HeadersFooters> | undefined, pageNumbers: boolean): HeadersFooters {
  if (!hf || typeof hf !== 'object') return pageNumbers ? pageNumberFooter() : { ...BASE, sets: { main: emptySet() } };
  const sets: HeadersFooters['sets'] = {};
  for (const v of ['main', 'even', 'first', 'chapterFirst'] as HFVariant[]) {
    const s = hf.sets?.[v];
    if (s) sets[v] = { header: cleanBand(s.header), footer: cleanBand(s.footer) };
  }
  sets.main ??= emptySet();
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    sets,
    differentFirst: !!hf.differentFirst,
    differentChapterFirst: !!hf.differentChapterFirst,
    differentOddEven: !!hf.differentOddEven,
    numberFormat: NUMBER_FORMATS.some((f) => f.id === hf.numberFormat) ? hf.numberFormat! : '1',
    startAt: Math.max(0, Math.round(num(hf.startAt, 1))),
    headerFrom: Math.max(0, num(hf.headerFrom, 0.5)),
    footerFrom: Math.max(0, num(hf.footerFrom, 0.5)),
    headerLine: !!hf.headerLine,
    footerLine: !!hf.footerLine,
    ...(typeof hf.author === 'string' && hf.author ? { author: hf.author } : {}),
  };
}

export interface PagePlace {
  /** Index of the page in the whole document (0 = first). */
  index: number;
  /** The page starts a chapter. */
  chapterStart: boolean;
}

/** Which header and footer a page shows. */
export function variantFor(hf: HeadersFooters, place: PagePlace): HFVariant {
  if (hf.differentFirst && place.index === 0) return 'first';
  if (hf.differentChapterFirst && place.chapterStart) return 'chapterFirst';
  if (hf.differentOddEven && (hf.startAt + place.index) % 2 === 0) return 'even';
  return 'main';
}

export function setFor(hf: HeadersFooters, v: HFVariant): HFSet {
  return hf.sets[v] ?? emptySet();
}

export function variantName(hf: HeadersFooters, v: HFVariant): string {
  if (v === 'first') return 'First page';
  if (v === 'chapterFirst') return 'First page of a chapter';
  if (v === 'even') return 'Even (left) pages';
  if (hf.differentOddEven) return 'Odd (right) pages';
  return hf.differentFirst || hf.differentChapterFirst ? 'Other pages' : 'Every page';
}

function roman(n: number): string {
  if (n <= 0) return String(n);
  const table: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  for (const [v, s] of table) while (n >= v) (out += s), (n -= v);
  return out;
}

function letters(n: number): string {
  if (n <= 0) return String(n);
  // Like Word: a … z, then aa … zz.
  const ch = String.fromCharCode(97 + ((n - 1) % 26));
  return ch.repeat(Math.floor((n - 1) / 26) + 1);
}

export function formatNumber(n: number, f: NumberFormat): string {
  if (f === 'i') return roman(n);
  if (f === 'I') return roman(n).toUpperCase();
  if (f === 'a') return letters(n);
  if (f === 'A') return letters(n).toUpperCase();
  return String(n);
}

export function formatDate(t: number, fmt: DateFormat = 'long', locale?: string): string {
  const d = new Date(t);
  if (fmt === 'iso') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (fmt === 'short') return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (fmt === 'month') return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** What fields are filled in with. */
export interface HFContext {
  title: string;
  author: string;
  chapter?: number;
  chapterTitle?: string;
  part?: string;
  words: number;
  created?: number;
  updated?: number;
  /** Pages in the whole document, and in this chapter. */
  pages: number;
  chapterPages: number;
  now: number;
}

export function fieldValue(run: HFRun, ctx: HFContext, page: number, hf: HeadersFooters): string {
  switch (run.field) {
    case 'page':
      return formatNumber(page, hf.numberFormat);
    case 'pages':
      return String(ctx.pages);
    case 'chapterPages':
      return String(ctx.chapterPages);
    case 'title':
      return ctx.title || 'Untitled';
    case 'chapter':
      return ctx.chapter ? String(ctx.chapter) : '';
    case 'chapterTitle':
      return ctx.chapterTitle ?? '';
    case 'part':
      return ctx.part ?? '';
    case 'author':
      return hf.author || ctx.author;
    case 'date':
      return formatDate(ctx.now, run.fmt);
    case 'time':
      return new Date(ctx.now).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    case 'words':
      return ctx.words.toLocaleString();
    case 'created':
      return ctx.created ? formatDate(ctx.created, run.fmt) : '';
    case 'updated':
      return ctx.updated ? formatDate(ctx.updated, run.fmt) : '';
    default:
      return run.text ?? '';
  }
}

export function bandEmpty(b: HFBand): boolean {
  return SLOTS.every((s) => b[s].every((r) => !r.field && !r.text?.trim()));
}

/** Joins neighbouring text with the same formatting, and drops empty text. */
export function tidyRuns(runs: HFRun[]): HFRun[] {
  const out: HFRun[] = [];
  for (const r of runs) {
    if (!r.field && !r.text) continue;
    const run: HFRun = r.field ? { field: r.field, ...(r.fmt ? { fmt: r.fmt } : {}) } : { text: r.text };
    if (r.b) run.b = true;
    if (r.i) run.i = true;
    if (r.u) run.u = true;
    const last = out[out.length - 1];
    if (last && !last.field && !run.field && !!last.b === !!run.b && !!last.i === !!run.i && !!last.u === !!run.u) last.text += run.text!;
    else out.push(run);
  }
  return out;
}

/** Whether any header or footer shows the page number. */
export function hasPageNumbers(hf: HeadersFooters): boolean {
  return Object.values(hf.sets).some((s) => s && [s.header, s.footer].some((b) => SLOTS.some((k) => b[k].some((r) => r.field === 'page'))));
}

/** Turns page numbers on (in the middle of the footer) or off (everywhere). */
export function withPageNumbers(hf: HeadersFooters, on: boolean): HeadersFooters {
  if (on === hasPageNumbers(hf)) return hf;
  const sets: HeadersFooters['sets'] = {};
  for (const [v, s] of Object.entries(hf.sets) as [HFVariant, HFSet][]) {
    if (on) {
      // Not on a first page set up to be blank.
      const add = v === 'main' || v === 'even';
      const slot = !s.footer.center.length ? 'center' : !s.footer.right.length ? 'right' : null;
      const footer = slot ? { ...s.footer, [slot]: [{ field: 'page' }] } : { ...s.footer, center: [...s.footer.center, { text: ' ' }, { field: 'page' as const }] };
      sets[v] = add ? { ...s, footer } : s;
    } else {
      const strip = (b: HFBand): HFBand => ({ left: tidyRuns(b.left.filter((r) => r.field !== 'page')), center: tidyRuns(b.center.filter((r) => r.field !== 'page')), right: tidyRuns(b.right.filter((r) => r.field !== 'page')) });
      sets[v] = { header: strip(s.header), footer: strip(s.footer) };
    }
  }
  return { ...hf, sets };
}
