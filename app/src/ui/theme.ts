import { ACCENTS, type Settings } from '../data/types';

function mix(hex: string, toward: string, amt: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(toward.slice(1), 16);
  const ch = (v: number, s: number) => (v >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * amt);
  return '#' + [16, 8, 0].map((s) => m(s).toString(16).padStart(2, '0')).join('');
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [16, 8, 0].map((s) => {
    const v = ((n >> s) & 255) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Sets the theme attribute and the accent colour tokens on the page root. */
export function applyTheme(settings: Settings): void {
  const root = document.documentElement;
  if (settings.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', settings.theme);
  const accent = /^#[0-9a-f]{6}$/i.test(settings.accent) ? settings.accent : ACCENTS[0].hex;
  const light = luminance(accent) > 0.3;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--on-accent', light ? '#2A1F0E' : '#FFFFFF');
  root.style.setProperty('--accent-ink-light', light ? mix(accent, '#000000', 0.5) : accent);
  root.style.setProperty('--accent-ink-dark', mix(accent, '#FFFFFF', light ? 0.2 : 0.45));
  root.style.setProperty('--accent-soft-light', mix(accent, '#FFFFFF', 0.85));
  root.style.setProperty('--accent-soft-dark', mix(accent, '#1E1F21', 0.78));
}
