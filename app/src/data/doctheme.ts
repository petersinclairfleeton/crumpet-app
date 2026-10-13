// Word's Design tab: document themes, each a set of colours (headings, links
// and the colour menus' theme row), a pair of fonts (headings and body text)
// and effects (shadows on shapes and pictures), plus paragraph spacing.
// A document keeps their names on its first paragraph (`thc`, `thf`, `thx`,
// `psp`); the editor marks its page with them and the rules below draw them.

export interface ColourSet {
  id: string;
  name: string;
  /** Headings, the title, and links. */
  heading: string;
  title: string;
  link: string;
  /** Six accents, for the colour menus' theme row (and the swatch in the menu). */
  accents: string[];
}

export interface FontPair {
  id: string;
  name: string;
  head: string;
  body: string;
  /** Fonts to fetch from Google Fonts. */
  google?: string[];
}

export interface Effects {
  id: string;
  name: string;
  /** On shapes, text boxes and pictures. */
  shadow: string;
  radius?: number;
}

export interface Spacing {
  id: string;
  name: string;
  /** Points after a paragraph, and line spacing. */
  after: number;
  line: number;
  before?: number;
}

export interface DocTheme {
  id: string;
  name: string;
  thc: string;
  thf: string;
  thx: string;
}

export const COLOUR_SETS: ColourSet[] = [
  { id: 'office', name: 'Office', heading: '#2f5496', title: '#1f3864', link: '#0563c1', accents: ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'] },
  { id: 'ink', name: 'Ink', heading: '#1d2733', title: '#11161d', link: '#2a5d8f', accents: ['#1d2733', '#455a73', '#7b8ea6', '#a6763b', '#6b4e71', '#3d6b5a'] },
  { id: 'garden', name: 'Garden', heading: '#3c6e47', title: '#2b4f33', link: '#2f7a6b', accents: ['#3c6e47', '#8fae5a', '#c9a227', '#b0603a', '#5f8f8a', '#7a5c3e'] },
  { id: 'ocean', name: 'Ocean', heading: '#1f5f8b', title: '#123c5a', link: '#1a7fb5', accents: ['#1f5f8b', '#2e9cca', '#5cc4d6', '#29648a', '#7ba7bc', '#f2a541'] },
  { id: 'sunset', name: 'Sunset', heading: '#b4451f', title: '#7f2f15', link: '#c2571a', accents: ['#e07a2f', '#c94c4c', '#f2b134', '#8e3b5c', '#d9a07a', '#5b4a6e'] },
  { id: 'berry', name: 'Berry', heading: '#7a2955', title: '#561c3c', link: '#9c2f6b', accents: ['#7a2955', '#b8417f', '#e58fb3', '#5a3c8c', '#c97b63', '#3f6f8a'] },
  { id: 'grey', name: 'Greyscale', heading: '#404040', title: '#262626', link: '#404040', accents: ['#262626', '#595959', '#7f7f7f', '#a6a6a6', '#bfbfbf', '#d9d9d9'] },
];

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

export const FONT_PAIRS: FontPair[] = [
  { id: 'office', name: 'Office', head: `"Calibri Light", Carlito, ${SANS}`, body: `Calibri, Carlito, ${SANS}` },
  { id: 'classic', name: 'Classic', head: `Georgia, ${SERIF}`, body: `Georgia, ${SERIF}` },
  { id: 'garamond', name: 'Garamond', head: `"EB Garamond", Garamond, ${SERIF}`, body: `"EB Garamond", Garamond, ${SERIF}`, google: ['EB Garamond'] },
  { id: 'literary', name: 'Literary', head: `"Playfair Display", ${SERIF}`, body: `Lora, ${SERIF}`, google: ['Playfair Display', 'Lora'] },
  { id: 'modern', name: 'Modern', head: `Montserrat, ${SANS}`, body: `"Open Sans", ${SANS}`, google: ['Montserrat', 'Open Sans'] },
  { id: 'clean', name: 'Clean', head: `Inter, ${SANS}`, body: `Inter, ${SANS}`, google: ['Inter'] },
  { id: 'news', name: 'Newspaper', head: `"Libre Franklin", ${SANS}`, body: `Merriweather, ${SERIF}`, google: ['Libre Franklin', 'Merriweather'] },
  { id: 'typewriter', name: 'Typewriter', head: `"Courier Prime", "Courier New", monospace`, body: `"Courier Prime", "Courier New", monospace`, google: ['Courier Prime'] },
];

export const EFFECTS: Effects[] = [
  { id: 'flat', name: 'Flat', shadow: 'none' },
  { id: 'subtle', name: 'Subtle', shadow: '0 1px 3px rgba(0, 0, 0, 0.22)', radius: 2 },
  { id: 'soft', name: 'Soft shadow', shadow: '0 6px 16px rgba(0, 0, 0, 0.22)', radius: 6 },
  { id: 'lifted', name: 'Lifted', shadow: '4px 6px 0 rgba(0, 0, 0, 0.18)' },
  { id: 'glow', name: 'Glow', shadow: '0 0 12px rgba(68, 114, 196, 0.55)', radius: 4 },
];

export const SPACINGS: Spacing[] = [
  { id: 'none', name: 'No paragraph space', after: 0, line: 1 },
  { id: 'compact', name: 'Compact', after: 4, line: 1 },
  { id: 'tight', name: 'Tight', after: 6, line: 1.15 },
  { id: 'open', name: 'Open', after: 10, line: 1.15, before: 6 },
  { id: 'relaxed', name: 'Relaxed', after: 6, line: 1.5 },
  { id: 'double', name: 'Double', after: 8, line: 2 },
];

export const DOC_THEMES: DocTheme[] = [
  { id: 'office', name: 'Office', thc: 'office', thf: 'office', thx: 'subtle' },
  { id: 'manuscript', name: 'Manuscript', thc: 'ink', thf: 'classic', thx: 'flat' },
  { id: 'storybook', name: 'Storybook', thc: 'berry', thf: 'literary', thx: 'soft' },
  { id: 'botanical', name: 'Botanical', thc: 'garden', thf: 'garamond', thx: 'subtle' },
  { id: 'harbour', name: 'Harbour', thc: 'ocean', thf: 'modern', thx: 'lifted' },
  { id: 'ember', name: 'Ember', thc: 'sunset', thf: 'news', thx: 'soft' },
  { id: 'report', name: 'Report', thc: 'grey', thf: 'clean', thx: 'flat' },
  { id: 'draft', name: 'Typewriter', thc: 'grey', thf: 'typewriter', thx: 'flat' },
];

export const colourSet = (id: string | undefined) => COLOUR_SETS.find((c) => c.id === id);
export const fontPair = (id: string | undefined) => FONT_PAIRS.find((f) => f.id === id);
export const effects = (id: string | undefined) => EFFECTS.find((e) => e.id === id);
export const spacing = (id: string | undefined) => SPACINGS.find((s) => s.id === id);

/** The theme a document's colours, fonts and effects make up, if they're one of the gallery's. */
export function themeOf(p: { thc?: string; thf?: string; thx?: string } | undefined): DocTheme | undefined {
  return DOC_THEMES.find((t) => t.thc === p?.thc && t.thf === p?.thf && t.thx === p?.thx);
}

/** A font list's first family, as Word names it. */
export function firstFamily(stack: string): string {
  return stack.split(',')[0].trim().replace(/^"|"$/g, '');
}

const HEADINGS = ['.blk-heading1', '.blk-heading2', '.blk-heading3', '.blk-heading4', ".blk-paragraph[data-style='title']", ".blk-paragraph[data-style='subtitle']"];
const BODY = ['.blk-paragraph:not([data-style])', ".blk-paragraph[data-style='nospacing']", '.blk-list', '.blk-quote', ".blk-paragraph[data-style='epigraph']", ".blk-paragraph[data-style='caption']"];

/** The rules that draw every theme, colour set, font pair, effect and spacing (scoped to an editor marked with them). */
export function themeCss(): string {
  const r: string[] = [];
  const on = (attr: string, id: string, sels: string[]) => sels.map((s) => `.note-editor[data-${attr}='${id}'] ${s}`).join(', ');
  for (const c of COLOUR_SETS) {
    r.push(`${on('thc', c.id, HEADINGS.slice(0, 4))} { color: ${c.heading}; }`);
    r.push(`${on('thc', c.id, [HEADINGS[4]])} { color: ${c.title}; }`);
    r.push(`${on('thc', c.id, [HEADINGS[5]])} { color: ${c.accents[1]}; }`);
    r.push(`${on('thc', c.id, ['a', '.blk a'])} { color: ${c.link}; }`);
  }
  for (const f of FONT_PAIRS) {
    r.push(`${on('thf', f.id, HEADINGS)} { font-family: ${f.head}; }`);
    r.push(`${on('thf', f.id, BODY)} { font-family: ${f.body}; }`);
  }
  for (const e of EFFECTS) {
    r.push(`${on('thx', e.id, ['.shape-box', '.blk-image img'])} { box-shadow: ${e.shadow};${e.radius !== undefined ? ` border-radius: ${e.radius}px;` : ''} }`);
  }
  for (const s of SPACINGS) {
    r.push(`${on('psp', s.id, BODY)} { margin-bottom: ${s.after}pt; line-height: ${s.line * 1.15};${s.before !== undefined ? ` margin-top: ${s.before}pt;` : ' margin-top: 0;'} }`);
  }
  return r.join('\n');
}
