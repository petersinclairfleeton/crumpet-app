// The colour of the paper you write on (Word's Page Color): a few ready-made
// ones, or any colour, with ink that reads well on it. Unset: the theme's own.

export interface Paper {
  name: string;
  hex: string;
}

export const PAPERS: Paper[] = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Ivory', hex: '#fffcf2' },
  { name: 'Cream', hex: '#f7efdc' },
  { name: 'Sepia', hex: '#efe0c2' },
  { name: 'Grey', hex: '#efefec' },
  { name: 'Sage', hex: '#e6f0e6' },
  { name: 'Sky', hex: '#e5eef8' },
  { name: 'Blush', hex: '#f9e8e6' },
  { name: 'Slate', hex: '#2b3038' },
  { name: 'Night', hex: '#1b1c20' },
];

export function isHex(s: unknown): s is string {
  return typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
}

/** How light a colour looks, from 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [16, 8, 0].map((s) => {
    const v = ((n >> s) & 255) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Ink for writing on this paper: near-black on light paper, near-white on dark. */
export function inkFor(paper: string): string {
  return luminance(paper) > 0.22 ? '#22201c' : '#e8e6e1';
}

/** A paper's name, or "Custom" for one picked by hand. */
export function paperName(hex: string | undefined): string {
  if (!isHex(hex)) return 'The theme’s own';
  return PAPERS.find((p) => p.hex.toLowerCase() === hex.toLowerCase())?.name ?? 'Custom';
}
