// Fonts for note text: Crumpet's own, any Google font, or a font installed on
// this device. Google fonts are fetched from Google only when chosen.

import type { NoteFont } from '../data/types';

export const DEFAULT_FONT: NoteFont = { family: 'Figtree', source: 'default', category: 'sans-serif' };

export interface FontChoice extends NoteFont {
  category: string;
}

const CATEGORY: Record<string, string> = { s: 'sans-serif', r: 'serif', d: 'display', h: 'handwriting', m: 'monospace' };

let googleList: Promise<FontChoice[]> | null = null;

/** Every Google font (about 1,900), loaded the first time the font picker opens. */
export function googleFonts(): Promise<FontChoice[]> {
  googleList ??= import('./fonts/google-fonts.json').then((m) =>
    (m.default as string[]).map((row) => {
      const [family, c, styles] = row.split('|');
      return { family, source: 'google' as const, category: CATEGORY[c] ?? 'sans-serif', styles: Number(styles) };
    }),
  );
  return googleList;
}

/** Fonts found on most computers and phones. Only those this device has are offered. */
const COMMON_SYSTEM_FONTS: [string, string][] = [
  ['Georgia', 'serif'], ['Times New Roman', 'serif'], ['Palatino', 'serif'], ['Palatino Linotype', 'serif'], ['Baskerville', 'serif'], ['Hoefler Text', 'serif'],
  ['Iowan Old Style', 'serif'], ['New York', 'serif'], ['Charter', 'serif'], ['Cambria', 'serif'], ['Book Antiqua', 'serif'], ['Didot', 'serif'], ['Garamond', 'serif'], ['Constantia', 'serif'],
  ['Helvetica', 'sans-serif'], ['Helvetica Neue', 'sans-serif'], ['Arial', 'sans-serif'], ['Avenir', 'sans-serif'], ['Avenir Next', 'sans-serif'], ['Gill Sans', 'sans-serif'],
  ['Optima', 'sans-serif'], ['Futura', 'sans-serif'], ['Verdana', 'sans-serif'], ['Tahoma', 'sans-serif'], ['Trebuchet MS', 'sans-serif'], ['Segoe UI', 'sans-serif'], ['Calibri', 'sans-serif'],
  ['San Francisco', 'sans-serif'], ['SF Pro Text', 'sans-serif'], ['Roboto', 'sans-serif'], ['Ubuntu', 'sans-serif'], ['Noto Sans', 'sans-serif'], ['Noto Serif', 'serif'],
  ['Menlo', 'monospace'], ['Monaco', 'monospace'], ['SF Mono', 'monospace'], ['Consolas', 'monospace'], ['Courier New', 'monospace'], ['Courier', 'monospace'], ['American Typewriter', 'serif'],
  ['Marker Felt', 'handwriting'], ['Bradley Hand', 'handwriting'], ['Comic Sans MS', 'handwriting'], ['Noteworthy', 'handwriting'],
];

/** Whether this device has a font, by measuring text in it against the fallbacks. */
function installed(family: string): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas').getContext('2d');
  if (!canvas) return false;
  const sample = 'mmmmmmmmmmlli1WQ@#';
  return ['monospace', 'serif', 'sans-serif'].some((fallback) => {
    canvas.font = `72px ${fallback}`;
    const base = canvas.measureText(sample).width;
    canvas.font = `72px "${family}", ${fallback}`;
    return canvas.measureText(sample).width !== base;
  });
}

/**
 * Fonts installed on this device. Where the browser can list them all (Chrome
 * and Edge on computers, after asking), that list; otherwise the common ones
 * this device has.
 */
export async function systemFonts(askForAll = false): Promise<FontChoice[]> {
  const query = (window as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> }).queryLocalFonts;
  if (askForAll && query) {
    try {
      const families = [...new Set((await query()).map((f) => f.family))].sort((a, b) => a.localeCompare(b));
      if (families.length) return families.map((family) => ({ family, source: 'system', category: 'sans-serif' }));
    } catch {
      // Not allowed: fall back to the common list.
    }
  }
  return COMMON_SYSTEM_FONTS.filter(([f]) => installed(f)).map(([family, category]) => ({ family, source: 'system', category }));
}

export const canListAllSystemFonts = typeof window !== 'undefined' && 'queryLocalFonts' in window;

const loaded = new Set<string>();

/** Makes a Google font available on the page (regular, italic, bold and bold italic, as far as it has them). */
export function loadGoogleFont(family: string, styles = 1, text?: string): void {
  const key = `${family}|${text ?? ''}`;
  if (loaded.has(key) || typeof document === 'undefined') return;
  loaded.add(key);
  const want: string[] = [];
  if (styles & 1) want.push('0,400');
  if (styles & 4) want.push('0,700');
  if (styles & 2) want.push('1,400');
  if (styles & 8) want.push('1,700');
  const spec = want.length ? `${family.replace(/ /g, '+')}:ital,wght@${want.join(';')}` : family.replace(/ /g, '+');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap${text ? `&text=${encodeURIComponent(text)}` : ''}`;
  document.head.appendChild(link);
}

const FALLBACK: Record<string, string> = {
  serif: 'Georgia, serif',
  monospace: 'ui-monospace, Menlo, monospace',
  handwriting: 'cursive',
  display: 'system-ui, sans-serif',
  'sans-serif': 'system-ui, sans-serif',
};

/** The CSS font-family for a note font, with a fallback of the same kind. */
export function fontStack(font: NoteFont | undefined): string {
  const f = font ?? DEFAULT_FONT;
  if (f.source === 'default') return "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif";
  return `"${f.family.replace(/"/g, '')}", ${FALLBACK[f.category ?? 'sans-serif'] ?? FALLBACK['sans-serif']}`;
}
