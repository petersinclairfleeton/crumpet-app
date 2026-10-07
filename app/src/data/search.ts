// Searching: plain words, plus filters typed into the search box (or added
// from the Filters menu), like Evernote's:
//   tag:idea  #idea          notes with that tag
//   in:"Novel ideas"         notes in that notebook (or stack)
//   is:favorite              starred notes
//   has:picture has:file has:link has:checklist has:todo has:table
//   after:2026-09-01 before:2026-10-01   edited in that span

import type { Note } from './types';

export type Has = 'picture' | 'file' | 'link' | 'checklist' | 'todo' | 'table';
const HAS: Has[] = ['picture', 'file', 'link', 'checklist', 'todo', 'table'];

export interface Filters {
  words: string[];
  tags: string[];
  /** Notebook or stack names. */
  places: string[];
  favorite: boolean;
  has: Has[];
  /** Edited on or after / before these days (local midnight, ms). */
  after?: number;
  before?: number;
}

export interface Token {
  /** As written in the search box. */
  text: string;
  /** What it means, in words, for a chip. */
  label: string;
}

const TOKEN = /(\S+?):(?:"([^"]*)"|(\S+))|#(\S+)|"([^"]*)"|(\S+)/g;

function day(s: string): number | undefined {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

/** The search box's text, split into words and filters. */
export function parseQuery(query: string): { filters: Filters; tokens: Token[] } {
  const filters: Filters = { words: [], tags: [], places: [], favorite: false, has: [] };
  const tokens: Token[] = [];
  for (const m of query.matchAll(TOKEN)) {
    const [text, key, quoted, plain, hash, phrase, word] = m;
    if (hash) {
      filters.tags.push(hash.toLowerCase());
      tokens.push({ text, label: `#${hash}` });
      continue;
    }
    if (key) {
      const value = (quoted ?? plain ?? '').trim();
      const k = key.toLowerCase();
      if (k === 'tag' && value) {
        filters.tags.push(value.replace(/^#/, '').toLowerCase());
        tokens.push({ text, label: `#${value.replace(/^#/, '')}` });
        continue;
      }
      if ((k === 'in' || k === 'notebook' || k === 'stack') && value) {
        filters.places.push(value.toLowerCase());
        tokens.push({ text, label: `In ${value}` });
        continue;
      }
      if (k === 'is' && /^(favou?rite|starred)s?$/i.test(value)) {
        filters.favorite = true;
        tokens.push({ text, label: 'Favorites' });
        continue;
      }
      if (k === 'has' && HAS.includes(value.toLowerCase() as Has)) {
        const h = value.toLowerCase() as Has;
        filters.has.push(h);
        tokens.push({ text, label: { picture: 'With pictures', file: 'With files', link: 'With links', checklist: 'With checklists', todo: 'With unticked items', table: 'With tables' }[h] });
        continue;
      }
      if ((k === 'after' || k === 'before') && day(value) !== undefined) {
        filters[k] = day(value);
        tokens.push({ text, label: `${k === 'after' ? 'Edited since' : 'Edited before'} ${new Date(day(value)!).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` });
        continue;
      }
    }
    // Anything else is words to find (a "quoted phrase" stays together).
    const w = (phrase ?? word ?? text).toLowerCase();
    if (w) filters.words.push(w);
  }
  return { filters, tokens };
}

/** The query with one filter taken out. */
export function withoutToken(query: string, token: Token): string {
  const i = query.indexOf(token.text);
  if (i < 0) return query;
  return `${query.slice(0, i)}${query.slice(i + token.text.length)}`.replace(/\s+/g, ' ').trim();
}

/** The query with a filter added (if it isn't there yet). */
export function withToken(query: string, token: string): string {
  if (query.split(/\s+/).includes(token)) return query;
  return `${query.trim()} ${token}`.trim();
}

/** A token for a name, quoted when it has spaces. */
export function quoted(key: string, name: string): string {
  return /\s/.test(name) ? `${key}:"${name}"` : `${key}:${name}`;
}

function has(note: Note, h: Has): boolean {
  const blocks = note.doc.blocks;
  switch (h) {
    case 'picture':
      return blocks.some((b) => b.type === 'image');
    case 'file':
      return blocks.some((b) => b.type === 'file');
    case 'link':
      return blocks.some((b) => b.runs.some((r) => !!r.link));
    case 'checklist':
      return blocks.some((b) => b.type === 'todo');
    case 'todo':
      return blocks.some((b) => b.type === 'todo' && !b.checked);
    case 'table':
      return blocks.some((b) => b.type === 'table');
  }
}

/** Whether a note matches; `text` is its searchable text, `places` its notebook's and stack's names. */
export function matchesFilters(note: Note, f: Filters, text: string, places: string[]): boolean {
  if (f.favorite && !note.favorite) return false;
  if (f.tags.length && !f.tags.every((t) => note.tags.some((nt) => nt.toLowerCase() === t))) return false;
  if (f.places.length && !f.places.every((p) => places.some((name) => name.toLowerCase() === p))) return false;
  if (f.after !== undefined && note.updatedAt < f.after) return false;
  if (f.before !== undefined && note.updatedAt >= f.before) return false;
  if (!f.has.every((h) => has(note, h))) return false;
  const hay = text.toLowerCase();
  return f.words.every((w) => hay.includes(w));
}

export type SortBy = 'edited' | 'created' | 'title';

export function sortNotes(notes: Note[], by: SortBy): Note[] {
  if (by === 'edited') return notes;
  if (by === 'created') return [...notes].sort((a, b) => b.createdAt - a.createdAt);
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  return [...notes].sort((a, b) => collator.compare(a.title.trim() || '￿', b.title.trim() || '￿'));
}
