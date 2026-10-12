// Pictures, like Word's: a picture block's look beyond the file itself. Its
// width (it keeps its shape), how the text goes round it (in line, wrapping
// left or right, or in front of the text wherever it's dragged, placed from
// the top left of its paragraph), turned to any angle, and alt text of its
// own (apart from the caption under it). Saved after the picture's line as
// `{pic w=3 wrap=left rot=15 alt="A gull on a post"}`.

export type PicWrap = 'inline' | 'left' | 'right' | 'free';

export interface PicLook {
  /** Width in inches (the height follows); unset: the picture's own size, at most the column's width. */
  w?: number;
  /** How the text goes round it (unset: in line). */
  wrap?: PicWrap;
  /** In front of the text: where, in inches from the top left of its paragraph. */
  x?: number;
  y?: number;
  /** Turned clockwise, in degrees. */
  rot?: number;
  /** Alt text: what it shows, for screen readers and e-books (unset: the caption). */
  alt?: string;
}

const num = (v: unknown, lo: number, hi: number, places = 100): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(lo, Math.min(hi, v)) * places) / places : undefined);

/** A picture's look made safe and simple; undefined when there's nothing set. */
export function tidyPic(p: Partial<PicLook> | undefined): PicLook | undefined {
  if (!p || typeof p !== 'object') return undefined;
  const out: PicLook = {};
  const w = num(p.w, 0.2, 22);
  if (w !== undefined) out.w = w;
  if (p.wrap === 'left' || p.wrap === 'right' || p.wrap === 'free') out.wrap = p.wrap;
  if (out.wrap === 'free') {
    out.x = num(p.x, -22, 22) ?? 0;
    out.y = num(p.y, -22, 22) ?? 0;
  }
  const rot = typeof p.rot === 'number' && Number.isFinite(p.rot) ? ((Math.round(p.rot) % 360) + 360) % 360 : 0;
  if (rot) out.rot = rot;
  if (typeof p.alt === 'string' && p.alt.trim()) out.alt = p.alt.replace(/\s+/g, ' ').trim();
  return Object.keys(out).length ? out : undefined;
}

export function samePic(a: PicLook | undefined, b: PicLook | undefined): boolean {
  return JSON.stringify(tidyPic(a) ?? null) === JSON.stringify(tidyPic(b) ?? null);
}

const ORDER: (keyof PicLook)[] = ['w', 'wrap', 'x', 'y', 'rot', 'alt'];

/** The `{pic …}` written after a picture's line (alignment too, when there's a look to write). */
export function picAttrs(p: PicLook, align?: string): string {
  const parts = ['pic'];
  for (const k of ORDER) {
    const v = p[k];
    if (v === undefined) continue;
    parts.push(k === 'alt' ? `alt="${String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/}/g, '&#125;')}"` : `${k}=${v}`);
  }
  if (align && align !== 'left') parts.push(`align=${align}`);
  return `{${parts.join(' ')}}`;
}

/** A picture line's trailing `{pic …}`: the look, its alignment, and the line without it. */
export function readPicAttrs(line: string): { line: string; pic?: PicLook; align?: string } {
  const m = /[ \t]*\{pic((?:[ \t]+[a-z]+=(?:"[^"]*"|[^\s}"]+))*)[ \t]*\}[ \t]*$/.exec(line);
  if (!m) return { line };
  const v: Record<string, string> = {};
  for (const t of m[1].matchAll(/([a-z]+)=("([^"]*)"|[^\s}"]+)/g)) v[t[1]] = t[3] !== undefined ? t[3].replace(/&#125;/g, '}').replace(/&quot;/g, '"').replace(/&amp;/g, '&') : t[2];
  const n = (s: string | undefined) => (s === undefined ? undefined : Number(s));
  const pic = tidyPic({ w: n(v.w), wrap: v.wrap as PicWrap, x: n(v.x), y: n(v.y), rot: n(v.rot), alt: v.alt });
  return { line: line.slice(0, m.index), pic, align: v.align === 'center' || v.align === 'right' ? v.align : undefined };
}
