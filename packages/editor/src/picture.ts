// Pictures, like Word's: a picture block's look beyond the file itself. Its
// width (it keeps its shape), how the text goes round it (in line, wrapping
// left or right, or in front of the text wherever it's dragged, placed from
// the top left of its paragraph), turned to any angle, and alt text of its
// own (apart from the caption under it); cropped (by its edges, to a shape
// or a ratio), a style (frames, shadows), a border, and corrections
// (brightness, contrast, colour, see-through, effects). Saved after the
// picture's line as `{pic w=3 wrap=left crop=0.1,0,0.1,0 style=shadow alt="A gull"}`.

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
  /** Cropped off each side, as a share of the picture: top, right, bottom, left. */
  crop?: [number, number, number, number];
  /** Cropped to a shape (Word's Crop to Shape). */
  mask?: PicMask;
  /** A picture style: a frame, shadow, rounded corners or soft edges. */
  style?: PicStyle;
  /** A line round it, as #rrggbb. */
  border?: string;
  /** Corrections, each from -100 to 100 (0: as it is): brightness, contrast, colour saturation. */
  bright?: number;
  contrast?: number;
  sat?: number;
  /** See-through, from 0 (not at all) to 90 per cent. */
  fade?: number;
  /** An artistic effect. */
  effect?: PicEffect;
  /** Hidden from view (Word's Selection Pane), kept in the document. */
  hide?: boolean;
  /** The file as it was put in, before its background was removed or it was compressed (Reset picture goes back to it). */
  orig?: string;
}

export const PIC_MASKS = ['oval', 'rounded', 'triangle', 'diamond', 'hexagon', 'star'] as const;
export type PicMask = (typeof PIC_MASKS)[number];
export const PIC_STYLES = ['frame', 'white', 'shadow', 'rounded', 'soft', 'polaroid'] as const;
export type PicStyle = (typeof PIC_STYLES)[number];
export const PIC_EFFECTS = ['grey', 'sepia', 'washout', 'vintage', 'blur', 'invert'] as const;
export type PicEffect = (typeof PIC_EFFECTS)[number];

/** CSS clip paths for the shapes a picture can be cropped to. */
export const MASK_CLIPS: Record<PicMask, string> = {
  oval: 'ellipse(50% 50% at 50% 50%)',
  rounded: 'inset(0 round 14%)',
  triangle: 'polygon(50% 0, 100% 100%, 0 100%)',
  diamond: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
  hexagon: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)',
  star: 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
};

/** The CSS filter for a picture's corrections and effect ('' for none). */
export function picFilter(p: PicLook): string {
  const f: string[] = [];
  if (p.bright) f.push(`brightness(${1 + p.bright / 100})`);
  if (p.contrast) f.push(`contrast(${1 + p.contrast / 100})`);
  if (p.sat) f.push(`saturate(${1 + p.sat / 100})`);
  const effects: Record<PicEffect, string> = {
    grey: 'grayscale(1)',
    sepia: 'sepia(0.85)',
    washout: 'brightness(1.35) contrast(0.45) saturate(0.6)',
    vintage: 'sepia(0.4) contrast(0.85) saturate(0.75) brightness(1.05)',
    blur: 'blur(2px)',
    invert: 'invert(1)',
  };
  if (p.effect) f.push(effects[p.effect]);
  return f.join(' ');
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
  if (Array.isArray(p.crop) && p.crop.length === 4) {
    let [t, r, b, l] = p.crop.map((v) => num(v, 0, 0.95, 1000) ?? 0);
    // Something of the picture is always left.
    if (t + b > 0.95) b = Math.max(0, Math.round((0.95 - t) * 1000) / 1000);
    if (l + r > 0.95) r = Math.max(0, Math.round((0.95 - l) * 1000) / 1000);
    if (t || r || b || l) out.crop = [t, r, b, l];
  }
  if ((PIC_MASKS as readonly string[]).includes(p.mask as string)) out.mask = p.mask;
  if ((PIC_STYLES as readonly string[]).includes(p.style as string)) out.style = p.style;
  if (typeof p.border === 'string' && /^#[0-9a-f]{6}$/i.test(p.border)) out.border = p.border.toLowerCase();
  for (const k of ['bright', 'contrast', 'sat'] as const) {
    const v = num(p[k], -100, 100, 1);
    if (v) out[k] = v;
  }
  const fade = num(p.fade, 0, 90, 1);
  if (fade) out.fade = fade;
  if ((PIC_EFFECTS as readonly string[]).includes(p.effect as string)) out.effect = p.effect;
  if (typeof p.orig === 'string' && p.orig.trim()) out.orig = p.orig.trim();
  if (p.hide === true) out.hide = true;
  return Object.keys(out).length ? out : undefined;
}

export function samePic(a: PicLook | undefined, b: PicLook | undefined): boolean {
  return JSON.stringify(tidyPic(a) ?? null) === JSON.stringify(tidyPic(b) ?? null);
}

const ORDER: (keyof PicLook)[] = ['w', 'wrap', 'x', 'y', 'rot', 'crop', 'mask', 'style', 'border', 'bright', 'contrast', 'sat', 'fade', 'effect', 'hide', 'orig', 'alt'];

/** The `{pic …}` written after a picture's line (alignment too, when there's a look to write). */
export function picAttrs(p: PicLook, align?: string): string {
  const parts = ['pic'];
  for (const k of ORDER) {
    const v = p[k];
    if (v === undefined) continue;
    if (k === 'hide') {
      parts.push('hide=1');
      continue;
    }
    parts.push(k === 'crop' ? `crop=${(v as number[]).join(',')}` : k === 'alt' || k === 'orig' ? `${k}="${String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/}/g, '&#125;')}"` : `${k}=${v}`);
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
  const crop = v.crop?.split(',').map(Number);
  const pic = tidyPic({ w: n(v.w), wrap: v.wrap as PicWrap, x: n(v.x), y: n(v.y), rot: n(v.rot), alt: v.alt, crop: crop?.length === 4 ? (crop as [number, number, number, number]) : undefined, mask: v.mask as PicMask, style: v.style as PicStyle, border: v.border, bright: n(v.bright), contrast: n(v.contrast), sat: n(v.sat), fade: n(v.fade), effect: v.effect as PicEffect, orig: v.orig, hide: v.hide === '1' });
  return { line: line.slice(0, m.index), pic, align: v.align === 'center' || v.align === 'right' ? v.align : undefined };
}
