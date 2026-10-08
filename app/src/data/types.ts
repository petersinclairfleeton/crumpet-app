import type { StatsElsewhere, WritingStats } from './stats';
import type { Doc } from '@crumpet/editor/model';
import type { PageSetup, StyleSheet } from './styles';

export interface Stack {
  id: string;
  name: string;
  createdAt: number;
}

export interface Notebook {
  id: string;
  name: string;
  /** One of NOTEBOOK_COLORS. */
  color: string;
  /** The stack this notebook sits in, or null for none. */
  stackId: string | null;
  createdAt: number;
}

export interface Note {
  id: string;
  /** The notebook it's in, or null for a note that isn't in any notebook. */
  notebookId: string | null;
  title: string;
  doc: Doc;
  tags: string[];
  /** Shown under Favorites. */
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  /** When it was moved to Trash; null if not in Trash. */
  trashedAt: number | null;
  /** Research for this project (kept with it, not in the note list). */
  projectId?: string | null;
  /** Front matter from the note's file that Crumpet doesn't use, kept so syncing never drops it. */
  extra?: string;
}

/** Crumpet's own looks follow the device (system) or are fixed light or dark; the rest are styles of their own. */
/** Where a chapter is in the writing. */
export type ChapterStatus = 'todo' | 'draft' | 'revised' | 'done';

/** A project's order of parts and chapters. A chapter belongs to the part above it. */
export type OutlineItem = { type: 'part'; id: string; title: string } | { type: 'chapter'; id: string };

/** A date to reach a project's word goal by, and where the writing stood when it was set (for keeping pace). */
export interface Deadline {
  /** The day to finish by (YYYY-MM-DD, inclusive). */
  date: string;
  /** The day it was set, and the project's words then. */
  from: string;
  startWords: number;
}

/** A piece of writing made of chapters, optionally grouped into parts: a book, an essay, a thesis. */
export interface Project {
  id: string;
  name: string;
  /** Word goal for the whole project, or null. */
  goal: number | null;
  outline: OutlineItem[];
  /** The project's named styles; Manuscript when unset. */
  styles?: StyleSheet;
  /** Page size and margins for page view and printing. */
  page?: PageSetup;
  /** The book's characters and places. */
  cast?: CastMember[];
  /** A finish date for the word goal. */
  deadline?: Deadline;
  createdAt: number;
  updatedAt: number;
}

/** A character or place in a book: spotted by name in its chapters. */
export interface CastMember {
  id: string;
  kind: 'character' | 'place';
  name: string;
  /** Other names it goes by ("Tam", "the keeper"). */
  aliases: string[];
  /** A picture (an attachment's path), if any. */
  picture?: string;
  /** A line or two, shown when hovering over the name. */
  description: string;
  notes: string;
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  doc: Doc;
  status: ChapterStatus;
  /** A short summary of what happens. */
  synopsis: string;
  /** Word goal for this chapter, or null. */
  goal: number | null;
  createdAt: number;
  updatedAt: number;
}

export type Theme = 'system' | 'light' | 'dark' | 'classic' | 'vapor' | 'console' | 'mac' | 'glass' | 'sepia' | 'midnight';

/** The font notes are written in. */
export interface NoteFont {
  family: string;
  /** default = Crumpet's own (Newsreader); google = loaded from Google Fonts; system = installed on this device. */
  source: 'default' | 'google' | 'system';
  /** Google fonts: which styles exist (bit 1 regular, 2 italic, 4 bold, 8 bold italic). */
  styles?: number;
  /** For the fallback while it loads: serif, sans-serif, monospace, cursive or display. */
  category?: string;
}

export interface Settings {
  name: string;
  accent: string;
  theme: Theme;
  listStyle: 'cards' | 'table';
  /** Font for note text; Crumpet's own when unset. */
  noteFont?: NoteFont;
  /** Note text size in px; DEFAULT_NOTE_SIZE when unset. */
  noteSize?: number;
  /** The named styles notes use; Crumpet's own when unset. */
  noteStyles?: StyleSheet;
  notePage?: PageSetup;
  /** Words written each day on this device. */
  stats?: WritingStats;
  /** This device's own id, naming its stats file in the synced folder. */
  deviceId?: string;
  /** Words written each day on the other devices, as of the last sync. */
  statsElsewhere?: StatsElsewhere;
  /** Words to write each day, for streaks; 0 or unset: any writing counts. */
  dailyGoal?: number;
  /** When the note styles or page setup (shared with other devices) last changed. */
  sharedAt?: number;
  /** Track changes: typing is marked as added, deleting strikes text through. */
  trackChanges?: boolean;
  /** How the note list is sorted. */
  sort?: 'edited' | 'created' | 'title';
  /** Searches kept in the sidebar. */
  savedSearches?: { id: string; name: string; query: string }[];
  /** The formatting bar: always shown, or floating above selected text (the default). */
  toolbar?: 'always' | 'selection';
  /** How the window is arranged (computers and tablets). */
  layout?: LayoutPrefs;
  /** Typewriter mode: keep the typing line mid-screen, fade other paragraphs, typing sounds. */
  typewriter?: { scroll?: boolean; fade?: boolean; sound?: boolean };
  /** Show notes and projects as pages. */
  pageView?: { notes?: boolean; projects?: boolean };
  /** Version of one-off data clean-ups already applied to this device's notes. */
  dataVersion?: number;
}

/** The arrangement of panes, chosen in the Layout menu. */
export interface LayoutPrefs {
  /** The sidebar in full, as a strip of icons, or hidden. */
  sidebar?: 'full' | 'icons' | 'hidden';
  /** The note list (or a project's outline); shown unless false. */
  list?: boolean;
  /** Widths in px, from dragging the edges. */
  sidebarWidth?: number;
  listWidth?: number;
  /** One note, or two side by side or one above the other. */
  split?: 'one' | 'side' | 'stacked';
  /** The first note's share of the space when two are open (0.2 to 0.8). */
  splitRatio?: number;
}

/** What the note list is showing. */
export type View =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'notebook'; id: string }
  | { kind: 'stack'; id: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'project'; id: string }
  | { kind: 'trash' };

export const NOTEBOOK_COLORS = ['#C98A4B', '#6F93BF', '#D4A257', '#9A82BC', '#78A88A', '#C27D74', '#B39A73', '#9A9A9A'];

/** Accent choices from the design: muted, with the right text colour on top of each. */
export const ACCENTS: { name: string; hex: string; ink: string; on: string }[] = [
  { name: 'Honey', hex: '#D4A257', ink: '#6a5130', on: '#2A1F0E' },
  { name: 'Sage', hex: '#2F8A57', ink: '#2F8A57', on: '#FFFFFF' },
  { name: 'Rosehip', hex: '#B84A5A', ink: '#B84A5A', on: '#FFFFFF' },
  { name: 'Blueberry', hex: '#3E6DB5', ink: '#3E6DB5', on: '#FFFFFF' },
  { name: 'Plum', hex: '#7E5BB5', ink: '#7E5BB5', on: '#FFFFFF' },
];

export const TRASH_DAYS = 30;

/** Note text size in px when none is chosen. */
export const DEFAULT_NOTE_SIZE = 18;
