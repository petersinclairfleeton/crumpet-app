// Cover pages, like Word's Insert > Cover Page: a few ready-made designs put
// at the start of the document as a section of their own, with no header or
// footer on it. Its paragraphs are marked `cover`, so it can be swapped for
// another design or taken away again.

import { type Block, type ParaLook, type Run, makeBlock, tidyPara } from './model';

export type CoverDesign = 'classic' | 'banner' | 'rule' | 'frame';

export const COVER_DESIGNS: { id: CoverDesign; name: string; hint: string }[] = [
  { id: 'classic', name: 'Classic', hint: 'The title in the middle of the page, the author below' },
  { id: 'banner', name: 'Banner', hint: 'The title on a coloured band' },
  { id: 'rule', name: 'Rule', hint: 'A large title on the left over a thick line' },
  { id: 'frame', name: 'Frame', hint: 'A line round the title, like a book plate' },
];

export interface CoverText {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
}

/** The whole document's settings, kept on its first paragraph (they move to the cover's first paragraph and back). */
export const DOC_KEYS = ['track', 'lock', 'hyph', 'lnum', 'lnr', 'wm', 'wmimg', 'wmc', 'wmflat', 'pgc', 'pgb', 'pgbc'] as const;

export function docPart(p: ParaLook | undefined): ParaLook {
  const out: ParaLook = {};
  for (const k of DOC_KEYS) if (p?.[k] !== undefined) (out as Record<string, unknown>)[k] = p[k];
  return out;
}

export function withoutDoc(p: ParaLook | undefined): ParaLook {
  const out: ParaLook = { ...p };
  for (const k of DOC_KEYS) delete out[k];
  return out;
}

const run = (text: string, look?: Run['look'], bold = false): Run[] => (text ? [{ text, marks: bold ? ['bold'] : [], ...(look ? { look } : {}) }] : []);

function para(text: Run[], extra: Partial<Block>, p: ParaLook = {}): Block {
  const b = makeBlock('paragraph', '', [], extra);
  b.runs = text;
  b.para = tidyPara({ ...p, cover: true });
  return b;
}

/** The cover's paragraphs in a design. */
export function coverBlocks(design: CoverDesign, t: CoverText, accent = '#2f5d8a'): Block[] {
  const title = t.title.trim() || 'Title';
  const sub = t.subtitle?.trim() ?? '';
  const author = t.author?.trim() ?? '';
  const date = t.date?.trim() ?? '';
  switch (design) {
    case 'banner':
      return [
        para([], {}, { before: 96 }),
        para(run(title, { size: 36, color: '#ffffff' }, true), { align: 'center' }, { shade: accent, before: 12, after: 0, line: 1.2 }),
        para(run(sub || ' ', { size: 16, color: '#ffffff' }), { align: 'center' }, { shade: accent, after: 0 }),
        para(run(author, { size: 14 }), { align: 'center' }, { before: 240 }),
        para(run(date, { size: 12, color: '#666666' }), { align: 'center' }),
      ];
    case 'rule':
      return [
        para(run(title, { size: 40 }, true), {}, { before: 160, after: 6, border: 'b', bstyle: 'thick', bcolor: accent, line: 1.1 }),
        para(run(sub, { size: 16, color: accent }), {}, { before: 6 }),
        para(run(author, { size: 14 }), {}, { before: 260 }),
        para(run(date, { size: 12, color: '#666666' }), {}),
      ];
    case 'frame':
      return [
        para([], {}, { before: 120 }),
        para(run(title, { size: 30, caps: 'small' }), { align: 'center' }, { border: 'tblr', bstyle: 'double', bcolor: accent, before: 6, after: 0, left: 0.75, right: 0.75 }),
        para(run(sub || ' ', { size: 14, color: '#555555' }), { align: 'center' }, { border: 'blr', bstyle: 'double', bcolor: accent, after: 0, left: 0.75, right: 0.75 }),
        para(run(author, { size: 14 }), { align: 'center' }, { before: 200 }),
        para(run(date, { size: 12, color: '#666666' }), { align: 'center' }),
      ];
    default:
      return [
        para([], {}, { before: 180 }),
        para(run(title), { style: 'title', align: 'center' }),
        para(run(sub), { style: 'subtitle', align: 'center' }),
        para(run(author, { size: 14 }), { align: 'center' }, { before: 220 }),
        para(run(date, { size: 12, color: '#666666' }), { align: 'center' }),
      ];
  }
}

/** The document has a cover page. */
export function hasCover(blocks: Block[]): boolean {
  return !!blocks[0]?.para?.cover;
}
