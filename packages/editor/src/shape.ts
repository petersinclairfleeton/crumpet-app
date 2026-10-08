// Text boxes and shapes (Word's Insert > Shapes and Text Box): a block
// holding a drawn shape of a set size, with a fill and a line, and text
// inside (a line of inline Markdown, like a table cell). It sits in line
// with the text, or floats left or right with the text wrapping round it.

export type ShapeKind = 'rect' | 'rounded' | 'ellipse' | 'line' | 'arrow';
export const SHAPE_KINDS: ShapeKind[] = ['rect', 'rounded', 'ellipse', 'line', 'arrow'];
export type ShapeWrap = 'inline' | 'left' | 'right';

export interface ShapeLook {
  kind: ShapeKind;
  /** Size in inches. */
  w: number;
  h: number;
  /** Fill and line colours as #rrggbb; null: none. */
  fill: string | null;
  line: string | null;
  /** How the text goes round it. */
  wrap: ShapeWrap;
  /** The text inside (inline Markdown). */
  text: string;
}

export function defaultShape(kind: ShapeKind, textBox = false): ShapeLook {
  const flat = kind === 'line' || kind === 'arrow';
  return {
    kind,
    w: textBox ? 3 : flat ? 2 : 1.5,
    h: textBox ? 1 : flat ? 0.25 : 1,
    fill: flat ? null : textBox ? '#ffffff' : '#cfe2f3',
    line: '#333333',
    wrap: 'inline',
    text: '',
  };
}

const hex = (v: unknown): string | null => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);

/** A shape's look made safe and simple. */
export function tidyShape(s: Partial<ShapeLook> | undefined): ShapeLook {
  const kind = SHAPE_KINDS.includes(s?.kind as ShapeKind) ? (s!.kind as ShapeKind) : 'rect';
  const size = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(0.1, Math.min(20, v)) * 100) / 100 : d);
  const base = defaultShape(kind);
  return {
    kind,
    w: size(s?.w, base.w),
    h: size(s?.h, base.h),
    fill: s?.fill === null ? null : (hex(s?.fill) ?? (s?.fill === undefined ? base.fill : null)),
    line: s?.line === null ? null : (hex(s?.line) ?? (s?.line === undefined ? base.line : null)),
    wrap: s?.wrap === 'left' || s?.wrap === 'right' ? s.wrap : 'inline',
    text: typeof s?.text === 'string' ? s.text.replace(/[\r\n]+/g, ' ') : '',
  };
}

export function sameShape(a: ShapeLook | undefined, b: ShapeLook | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// ---------------------------------------------------------------- Markdown

/** The line a shape is written as: `{shape rect w=3 h=1 fill=#fff2cc line=#333333 wrap=right} Text inside`. */
export function shapeLine(s: ShapeLook, align?: string): string {
  const parts = [`shape ${s.kind}`, `w=${s.w}`, `h=${s.h}`, `fill=${s.fill ?? 'none'}`, `line=${s.line ?? 'none'}`];
  if (s.wrap !== 'inline') parts.push(`wrap=${s.wrap}`);
  if (align) parts.push(`align=${align}`);
  return `{${parts.join(' ')}}${s.text ? ` ${s.text}` : ''}`;
}

export const SHAPE_LINE = /^\{shape (rect|rounded|ellipse|line|arrow)((?: [a-z]+=[^\s}]+)*)\}(?: (.*))?$/;

/** Reads a shape's line back: the look, its alignment, and the text. */
export function readShapeLine(line: string): { shape: ShapeLook; align?: string } | null {
  const m = SHAPE_LINE.exec(line.trim());
  if (!m) return null;
  const v: Record<string, string> = {};
  for (const tok of m[2].trim().split(/\s+/).filter(Boolean)) {
    const [k, val] = tok.split('=');
    v[k] = val;
  }
  const color = (c: string | undefined) => (c === 'none' ? null : c);
  const shape = tidyShape({ kind: m[1] as ShapeKind, w: Number(v.w), h: Number(v.h), fill: color(v.fill), line: color(v.line), wrap: v.wrap as ShapeWrap, text: m[3] ?? '' });
  return { shape, align: v.align === 'center' || v.align === 'right' ? v.align : undefined };
}
