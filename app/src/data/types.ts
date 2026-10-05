import type { Doc } from '@crumpet/editor/model';

export interface Notebook {
  id: string;
  name: string;
  /** One of NOTEBOOK_COLORS. */
  color: string;
  /** Name of the stack this notebook sits in, or null for none. */
  stack: string | null;
  createdAt: number;
}

export interface Note {
  id: string;
  notebookId: string;
  title: string;
  doc: Doc;
  tags: string[];
  /** Shown under Shortcuts. */
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  /** When it was moved to Trash; null if not in Trash. */
  trashedAt: number | null;
}

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  name: string;
  accent: string;
  theme: Theme;
  listStyle: 'cards' | 'table';
}

/** What the note list is showing. */
export type View =
  | { kind: 'all' }
  | { kind: 'shortcuts' }
  | { kind: 'notebook'; id: string }
  | { kind: 'stack'; name: string }
  | { kind: 'tag'; tag: string }
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
