import { ACCENTS, DEFAULT_NOTE_SIZE, type Settings } from '../data/types';
import { fontStack, loadGoogleFont } from './fonts';
import { themeInfo } from './themes';
import { inkFor, isHex, luminance } from '../data/paper';

function mix(hex: string, toward: string, amt: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(toward.slice(1), 16);
  const ch = (v: number, s: number) => (v >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * amt);
  return '#' + [16, 8, 0].map((s) => m(s).toString(16).padStart(2, '0')).join('');
}

/** Sets the theme, accent colour tokens and note font on the page root. */
export function applyTheme(settings: Settings): void {
  const root = document.documentElement;
  if (settings.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', settings.theme);
  // Crumpet's own themes have a frame of their own: a frosted window floating
  // over a soft wash (Crumpet), or paper around a floating sheet (Paper and ink).
  if (['system', 'light', 'dark'].includes(settings.theme)) root.setAttribute('data-look', 'crumpet');
  else if (settings.theme === 'paper') root.setAttribute('data-look', 'paper');
  else root.removeAttribute('data-look');
  // Some themes come with their own accent; the rest use the one chosen in Settings.
  const own = themeInfo(settings.theme).accent;
  const chosen = /^#[0-9a-f]{6}$/i.test(settings.accent) ? settings.accent : ACCENTS[0].hex;
  const accent = own ?? chosen;
  const light = luminance(accent) > 0.3;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--on-accent', light ? '#2A1F0E' : '#FFFFFF');
  root.style.setProperty('--accent-ink-light', light ? mix(accent, '#000000', 0.5) : accent);
  root.style.setProperty('--accent-ink-dark', mix(accent, '#FFFFFF', light ? 0.2 : 0.45));
  root.style.setProperty('--accent-soft-light', mix(accent, '#FFFFFF', 0.85));
  root.style.setProperty('--accent-soft-dark', mix(accent, '#1E1F21', 0.78));
  root.style.setProperty('--accent-sheet-dark', mix(accent, '#24211E', 0.8));
  // The paper the writing sits on, with ink to match.
  if (isHex(settings.paper)) {
    root.setAttribute('data-paper', '');
    root.style.setProperty('--paper', settings.paper);
    root.style.setProperty('--paper-ink', inkFor(settings.paper));
  } else {
    root.removeAttribute('data-paper');
    root.style.removeProperty('--paper');
    root.style.removeProperty('--paper-ink');
  }
  // The font notes are written in.
  const font = settings.noteFont;
  if (font?.source === 'google') loadGoogleFont(font.family, font.styles);
  root.style.setProperty('--note-font', fontStack(font));
  root.style.setProperty('--note-size', `${settings.noteSize ?? DEFAULT_NOTE_SIZE}px`);
}
