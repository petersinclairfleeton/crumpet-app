import type { Theme } from '../data/types';

export interface ThemeInfo {
  id: Theme;
  name: string;
  hint: string;
  /** Colours for the little preview: sidebar, list, page, accent. */
  preview: [string, string, string, string];
  /** Themes with an accent of their own; the others use the accent chosen in Settings. */
  accent?: string;
}

// Inspired-by looks get names of their own: the products they echo are other companies' trademarks.
export const THEMES: ThemeInfo[] = [
  { id: 'system', name: 'Paper and ink', hint: 'Crumpet’s own: light or dark, like your device', preview: ['#f3eee5', '#faf7f1', '#fffefb', '#d4a257'] },
  { id: 'light', name: 'Paper', hint: 'Always light', preview: ['#f3eee5', '#faf7f1', '#fffefb', '#d4a257'] },
  { id: 'dark', name: 'Ink', hint: 'Always dark', preview: ['#1b1916', '#211e1b', '#24211e', '#d4a257'] },
  { id: 'classic', name: 'Classic', hint: 'Old-school Evernote, with a dark sidebar', preview: ['#2b2e30', '#f4f4f4', '#ffffff', '#2dbe60'], accent: '#2dbe60' },
  { id: 'vapor', name: 'Vapor', hint: 'Steam’s deep blues', preview: ['#171a21', '#1b2838', '#1e2a36', '#66c0f4'], accent: '#66c0f4' },
  { id: 'console', name: 'Console', hint: 'Xbox black and green', preview: ['#0b0b0b', '#141414', '#1a1a1a', '#107c10'], accent: '#107c10' },
  { id: 'mac', name: 'Desktop', hint: 'Like macOS, light or dark with your device', preview: ['#e6e4e5', '#fafafa', '#ffffff', '#007aff'], accent: '#007aff' },
  { id: 'glass', name: 'Glass', hint: 'Liquid Glass: frosted, see-through panels', preview: ['#b9c8ff', '#e8dcff', '#f7f0ff', '#0a84ff'] },
  { id: 'sepia', name: 'Sepia', hint: 'Warm old-book pages', preview: ['#3e3226', '#efe5cc', '#f4ecd8', '#a8743a'] },
  { id: 'midnight', name: 'Midnight', hint: 'Pure black, for phones at night', preview: ['#000000', '#050505', '#000000', '#d4a257'] },
];

export function themeInfo(id: Theme): ThemeInfo {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
