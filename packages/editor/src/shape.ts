// Text boxes and shapes (Word's Insert > Shapes and Text Box): a block
// holding a drawn shape of a set size, with a fill and a line, and text
// inside (a line of inline Markdown, like a table cell). It sits in line
// with the text, floats left or right with the text wrapping round it, or
// sits in front of the text wherever it's dragged (placed from the top left
// of its paragraph). It can be turned to any angle.

export const SHAPE_KINDS = [
  // Lines and the basic shapes.
  'line', 'arrow', 'rect', 'rounded', 'ellipse', 'triangle', 'rtriangle', 'diamond', 'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'octagon', 'plus', 'can', 'heart', 'cloud',
  // Block arrows.
  'rarrow', 'larrow', 'uarrow', 'darrow', 'lrarrow', 'chevron',
  // Stars and banners.
  'star4', 'star5', 'star8', 'banner', 'wave',
  // Callouts.
  'callout', 'ocallout',
  // Flowchart.
  'terminator', 'document', 'data', 'predefined',
  // Drawn by hand (Edit Points: corners at `pts`), and drawings (an icon, or an SVG made a shape: `d` in a `vb` box).
  'freeform', 'path',
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** The shapes gallery: groups of shapes and their names, as Word's Insert > Shapes. */
export const SHAPE_GROUPS: { name: string; kinds: [ShapeKind, string][] }[] = [
  { name: 'Lines', kinds: [['line', 'Line'], ['arrow', 'Arrow']] },
  { name: 'Basic shapes', kinds: [['rect', 'Rectangle'], ['rounded', 'Rounded rectangle'], ['ellipse', 'Oval'], ['triangle', 'Triangle'], ['rtriangle', 'Right triangle'], ['diamond', 'Diamond'], ['parallelogram', 'Parallelogram'], ['trapezoid', 'Trapezoid'], ['pentagon', 'Pentagon'], ['hexagon', 'Hexagon'], ['octagon', 'Octagon'], ['plus', 'Cross'], ['can', 'Cylinder'], ['heart', 'Heart'], ['cloud', 'Cloud']] },
  { name: 'Block arrows', kinds: [['rarrow', 'Right arrow'], ['larrow', 'Left arrow'], ['uarrow', 'Up arrow'], ['darrow', 'Down arrow'], ['lrarrow', 'Left-right arrow'], ['chevron', 'Chevron']] },
  { name: 'Stars and banners', kinds: [['star4', '4-point star'], ['star5', '5-point star'], ['star8', '8-point star'], ['banner', 'Ribbon'], ['wave', 'Wave']] },
  { name: 'Callouts', kinds: [['callout', 'Speech bubble'], ['ocallout', 'Oval speech bubble']] },
  { name: 'Flowchart', kinds: [['terminator', 'Start or end'], ['document', 'Document'], ['data', 'Data'], ['predefined', 'Predefined process']] },
];

/** A line (no inside to fill or write in). */
export const isLineKind = (k: ShapeKind) => k === 'line' || k === 'arrow';

/** Ends of a line: none, an arrowhead, an open arrowhead, a dot. */
export type LineEnd = 'arrow' | 'open' | 'dot';
export type ShapeEffect = 'shadow' | 'glow' | 'soft' | 'bevel' | 'reflect';
/** In line; square (or tight) on the left or right; in front of or behind the text, anywhere; on its own lines, the text above and below (`topbottom`, moved across by `x`). */
export type ShapeWrap = 'inline' | 'left' | 'right' | 'free' | 'behind' | 'topbottom';
/** Placed anywhere: in front of or behind the text. */
export const isFloating = (s: Pick<ShapeLook, 'wrap'>) => s.wrap === 'free' || s.wrap === 'behind';

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
  /** Turned clockwise, in degrees (unset: not turned). */
  rot?: number;
  /** In front of the text: where, in inches from the top left of its paragraph. */
  x?: number;
  y?: number;
  /** Hidden from view (Word's Selection Pane), kept in the document. */
  hide?: boolean;
  /** Square wrapping that hugs the shape's outline (Word's Tight). */
  tight?: boolean;
  /** Placed anywhere: `x`, `y` from the page's corner or its margins instead of the paragraph. */
  rel?: 'margin' | 'page';
  /** Placed anywhere: its place in the stack (higher in front). */
  z?: number;
  /** Shapes grouped together move together. */
  grp?: string;
  /** Fill: fading to this colour (a gradient, top to bottom), or a picture (where the file is). */
  grad?: string;
  img?: string;
  /** The line's thickness in points (unset: 1.5), and dashes. */
  lw?: number;
  dash?: 'dash' | 'dot' | 'dashdot';
  /** Lines: what's at the start and end (unset: nothing; an arrow ends in an arrowhead). */
  head?: LineEnd;
  tail?: LineEnd;
  /** An effect: a shadow, glow, soft edges, a bevel (3-D) or a reflection. */
  fx?: ShapeEffect;
  /** The colour of the text inside. */
  tc?: string;
  /** The text's alignment across (unset: centred) and down (unset: middle), and its direction (turned to read up or down). */
  ta?: 'left' | 'right';
  tv?: 'top' | 'bottom';
  dir?: 'down' | 'up';
  /** Linked text boxes: boxes with the same chain name share one text, running on from one to the next (in the document's order). */
  chain?: string;
  /** A freeform's corners, as fractions of its width and height. */
  pts?: [number, number][];
  /** A drawing's outline (SVG path data) in a box `vb` wide and high. */
  d?: string;
  vb?: [number, number];
}

export function defaultShape(kind: ShapeKind, textBox = false): ShapeLook {
  const flat = isLineKind(kind);
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
  const kind = (SHAPE_KINDS as readonly string[]).includes(s?.kind as string) ? (s!.kind as ShapeKind) : 'rect';
  const size = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(0.1, Math.min(20, v)) * 100) / 100 : d);
  const base = defaultShape(kind);
  const out: ShapeLook = {
    kind,
    w: size(s?.w, base.w),
    h: size(s?.h, base.h),
    fill: s?.fill === null ? null : (hex(s?.fill) ?? (s?.fill === undefined ? base.fill : null)),
    line: s?.line === null ? null : (hex(s?.line) ?? (s?.line === undefined ? base.line : null)),
    wrap: s?.wrap === 'left' || s?.wrap === 'right' || s?.wrap === 'free' || s?.wrap === 'behind' || s?.wrap === 'topbottom' ? s.wrap : 'inline',
    text: typeof s?.text === 'string' ? s.text.replace(/[\r\n]+/g, ' ') : '',
  };
  const rot = typeof s?.rot === 'number' && Number.isFinite(s.rot) ? ((Math.round(s.rot) % 360) + 360) % 360 : 0;
  if (rot) out.rot = rot;
  if (s?.hide === true) out.hide = true;
  const at = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(-20, Math.min(20, v)) * 100) / 100 : 0);
  if (isFloating(out)) {
    out.x = at(s?.x);
    out.y = at(s?.y);
    if (s?.rel === 'margin' || s?.rel === 'page') out.rel = s.rel;
    if (typeof s?.z === 'number' && Number.isFinite(s.z) && Math.round(s.z) !== 0) out.z = Math.max(0, Math.min(40, Math.round(s.z)));
    if (out.z === 0) delete out.z;
    if (typeof s?.grp === 'string' && /^[a-z0-9]{1,12}$/.test(s.grp)) out.grp = s.grp;
  } else if (out.wrap === 'topbottom') {
    const x = at(s?.x);
    if (x) out.x = x;
  }
  if (s?.tight === true && (out.wrap === 'left' || out.wrap === 'right')) out.tight = true;
  if (!isLineKind(kind)) {
    if (hex(s?.grad)) out.grad = hex(s?.grad)!;
    if (typeof s?.img === 'string' && /^[^\s{}"]{1,2000}$/.test(s.img)) out.img = s.img;
  }
  if (typeof s?.lw === 'number' && Number.isFinite(s.lw) && s.lw !== 1.5) out.lw = Math.round(Math.max(0.25, Math.min(12, s.lw)) * 100) / 100;
  if (s?.dash === 'dash' || s?.dash === 'dot' || s?.dash === 'dashdot') out.dash = s.dash;
  const end = (v: unknown) => (v === 'arrow' || v === 'open' || v === 'dot' ? v : undefined);
  if (isLineKind(kind)) {
    const head = end(s?.head);
    const tail = end(s?.tail);
    if (head) out.head = head;
    if (tail) out.tail = tail;
  }
  if (s?.fx === 'shadow' || s?.fx === 'glow' || s?.fx === 'soft' || s?.fx === 'bevel' || s?.fx === 'reflect') out.fx = s.fx;
  if (hex(s?.tc)) out.tc = hex(s?.tc)!;
  if (s?.ta === 'left' || s?.ta === 'right') out.ta = s.ta;
  if (s?.tv === 'top' || s?.tv === 'bottom') out.tv = s.tv;
  if (s?.dir === 'down' || s?.dir === 'up') out.dir = s.dir;
  if (typeof s?.chain === 'string' && /^[a-z0-9]{1,12}$/.test(s.chain) && !isLineKind(kind)) out.chain = s.chain;
  if (kind === 'freeform') {
    const pts = Array.isArray(s?.pts) ? s!.pts.filter((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n))).map(([x, y]) => [Math.round(Math.max(0, Math.min(1, x)) * 1000) / 1000, Math.round(Math.max(0, Math.min(1, y)) * 1000) / 1000] as [number, number]) : [];
    out.pts = pts.length >= 3 ? pts.slice(0, 200) : [[0.5, 0], [1, 1], [0, 1]];
  }
  if (kind === 'path') {
    out.d = typeof s?.d === 'string' && /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\- ]{1,20000}$/.test(s.d) ? s.d.trim() : 'M0 0H24V24H0Z';
    out.vb = Array.isArray(s?.vb) && s!.vb.length === 2 && s!.vb.every((n) => typeof n === 'number' && n > 0 && n < 100000) ? [s!.vb[0], s!.vb[1]] : [24, 24];
  }
  return out;
}

export function sameShape(a: ShapeLook | undefined, b: ShapeLook | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// ---------------------------------------------------------------- Markdown

/** The line a shape is written as: `{shape rect w=3 h=1 fill=#fff2cc line=#333333 wrap=right rot=15} Text inside` (in front of the text: `wrap=free x=1.5 y=-0.25`, from the page: `rel=page`, in the stack: `z=2`, grouped: `grp=g1`). */
export function shapeLine(s: ShapeLook, align?: string): string {
  const parts = [`shape ${s.kind}`, `w=${s.w}`, `h=${s.h}`, `fill=${s.fill ?? 'none'}`, `line=${s.line ?? 'none'}`];
  if (s.wrap !== 'inline') parts.push(`wrap=${s.wrap}`);
  if (isFloating(s)) parts.push(`x=${s.x ?? 0}`, `y=${s.y ?? 0}`);
  if (s.wrap === 'topbottom' && s.x) parts.push(`x=${s.x}`);
  if (s.tight) parts.push('tight=1');
  if (s.rel) parts.push(`rel=${s.rel}`);
  if (s.z) parts.push(`z=${s.z}`);
  if (s.grp) parts.push(`grp=${s.grp}`);
  if (s.grad) parts.push(`grad=${s.grad}`);
  if (s.img) parts.push(`img=${s.img}`);
  if (s.lw) parts.push(`lw=${s.lw}`);
  if (s.dash) parts.push(`dash=${s.dash}`);
  if (s.head) parts.push(`head=${s.head}`);
  if (s.tail) parts.push(`tail=${s.tail}`);
  if (s.fx) parts.push(`fx=${s.fx}`);
  if (s.tc) parts.push(`tc=${s.tc}`);
  if (s.ta) parts.push(`ta=${s.ta}`);
  if (s.tv) parts.push(`tv=${s.tv}`);
  if (s.dir) parts.push(`dir=${s.dir}`);
  if (s.chain) parts.push(`chain=${s.chain}`);
  if (s.pts) parts.push(`pts=${s.pts.map((p) => p.join(',')).join(';')}`);
  if (s.vb) parts.push(`vb=${s.vb.join(',')}`);
  if (s.d) parts.push(`d=${encodeURIComponent(s.d)}`);
  if (s.rot) parts.push(`rot=${s.rot}`);
  if (s.hide) parts.push('hide=1');
  if (align) parts.push(`align=${align}`);
  return `{${parts.join(' ')}}${s.text ? ` ${s.text}` : ''}`;
}

export const SHAPE_LINE = /^\{shape ([a-z0-9]+)((?: [a-z]+=[^\s}]+)*)\}(?: (.*))?$/;

function safeDecode(v: string): string | undefined {
  try {
    return decodeURIComponent(v);
  } catch {
    return undefined;
  }
}

/** Reads a shape's line back: the look, its alignment, and the text. */
export function readShapeLine(line: string): { shape: ShapeLook; align?: string } | null {
  const m = SHAPE_LINE.exec(line.trim());
  if (!m || !(SHAPE_KINDS as readonly string[]).includes(m[1])) return null;
  const v: Record<string, string> = {};
  for (const tok of m[2].trim().split(/\s+/).filter(Boolean)) {
    const [k, val] = tok.split('=');
    v[k] = val;
  }
  const color = (c: string | undefined) => (c === 'none' ? null : c);
  const shape = tidyShape({ kind: m[1] as ShapeKind, w: Number(v.w), h: Number(v.h), fill: color(v.fill), line: color(v.line), wrap: v.wrap as ShapeWrap, text: m[3] ?? '', rot: v.rot ? Number(v.rot) : undefined, x: v.x ? Number(v.x) : undefined, y: v.y ? Number(v.y) : undefined, hide: v.hide === '1', tight: v.tight === '1', rel: v.rel as ShapeLook['rel'], z: v.z ? Number(v.z) : undefined, grp: v.grp, grad: v.grad, img: v.img, lw: v.lw ? Number(v.lw) : undefined, dash: v.dash as ShapeLook['dash'], head: v.head as LineEnd, tail: v.tail as LineEnd, fx: v.fx as ShapeEffect, tc: v.tc, ta: v.ta as ShapeLook['ta'], tv: v.tv as ShapeLook['tv'], dir: v.dir as ShapeLook['dir'], chain: v.chain, pts: v.pts ? v.pts.split(';').map((p) => p.split(',').map(Number) as [number, number]) : undefined, vb: v.vb ? (v.vb.split(',').map(Number) as [number, number]) : undefined, d: v.d ? safeDecode(v.d) : undefined });
  return { shape, align: v.align === 'center' || v.align === 'right' ? v.align : undefined };
}

// ---------------------------------------------------------------- outlines

/** A star's points: `n` points, the inner corners `inner` of the way out. */
function star(n: number, inner: number, W: number, H: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? inner : 1;
    pts.push(`${W / 2 + (W / 2) * r * Math.cos(a)},${H / 2 + (H / 2) * r * Math.sin(a)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** A shape's outline as an SVG path, in a box W wide and H tall (null: drawn some other way). */
export function shapePath(kind: ShapeKind, W: number, H: number): string | null {
  const x = (f: number) => f * W;
  const y = (f: number) => f * H;
  const poly = (pts: [number, number][]) => `M${pts.map(([a, b]) => `${x(a)},${y(b)}`).join('L')}Z`;
  switch (kind) {
    case 'triangle':
      return poly([[0.5, 0], [1, 1], [0, 1]]);
    case 'rtriangle':
      return poly([[0, 0], [1, 1], [0, 1]]);
    case 'diamond':
      return poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]);
    case 'parallelogram':
    case 'data':
      return poly([[0.22, 0], [1, 0], [0.78, 1], [0, 1]]);
    case 'trapezoid':
      return poly([[0.2, 0], [0.8, 0], [1, 1], [0, 1]]);
    case 'pentagon':
      return poly([[0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38]]);
    case 'hexagon':
      return poly([[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]]);
    case 'octagon':
      return poly([[0.29, 0], [0.71, 0], [1, 0.29], [1, 0.71], [0.71, 1], [0.29, 1], [0, 0.71], [0, 0.29]]);
    case 'plus':
      return poly([[0.33, 0], [0.67, 0], [0.67, 0.33], [1, 0.33], [1, 0.67], [0.67, 0.67], [0.67, 1], [0.33, 1], [0.33, 0.67], [0, 0.67], [0, 0.33], [0.33, 0.33]]);
    case 'can':
      return `M0,${y(0.12)}A${W / 2},${y(0.12)} 0 0 1 ${W},${y(0.12)}V${y(0.88)}A${W / 2},${y(0.12)} 0 0 1 0,${y(0.88)}ZM0,${y(0.12)}A${W / 2},${y(0.12)} 0 0 0 ${W},${y(0.12)}`;
    case 'heart':
      return `M${x(0.5)},${y(0.28)}C${x(0.5)},${y(0.02)} 0,${y(0.02)} 0,${y(0.32)}C0,${y(0.6)} ${x(0.5)},${y(0.78)} ${x(0.5)},${H}C${x(0.5)},${y(0.78)} ${W},${y(0.6)} ${W},${y(0.32)}C${W},${y(0.02)} ${x(0.5)},${y(0.02)} ${x(0.5)},${y(0.28)}Z`;
    case 'cloud': {
      // Bumps round an oval.
      const n = 9;
      let d = '';
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const px = x(0.5) + x(0.42) * Math.cos(a);
        const py = y(0.5) + y(0.38) * Math.sin(a);
        if (i === 0) d = `M${px},${py}`;
        else {
          const m = ((i - 0.5) / n) * Math.PI * 2;
          d += `Q${x(0.5) + x(0.62) * Math.cos(m)},${y(0.5) + y(0.6) * Math.sin(m)} ${px},${py}`;
        }
      }
      return `${d}Z`;
    }
    case 'rarrow':
      return poly([[0, 0.25], [0.6, 0.25], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.75], [0, 0.75]]);
    case 'larrow':
      return poly([[1, 0.25], [0.4, 0.25], [0.4, 0], [0, 0.5], [0.4, 1], [0.4, 0.75], [1, 0.75]]);
    case 'uarrow':
      return poly([[0.25, 1], [0.25, 0.4], [0, 0.4], [0.5, 0], [1, 0.4], [0.75, 0.4], [0.75, 1]]);
    case 'darrow':
      return poly([[0.25, 0], [0.25, 0.6], [0, 0.6], [0.5, 1], [1, 0.6], [0.75, 0.6], [0.75, 0]]);
    case 'lrarrow':
      return poly([[0, 0.5], [0.25, 0], [0.25, 0.25], [0.75, 0.25], [0.75, 0], [1, 0.5], [0.75, 1], [0.75, 0.75], [0.25, 0.75], [0.25, 1]]);
    case 'chevron':
      return poly([[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1], [0.25, 0.5]]);
    case 'star4':
      return star(4, 0.3, W, H);
    case 'star5':
      return star(5, 0.4, W, H);
    case 'star8':
      return star(8, 0.7, W, H);
    case 'banner':
      return poly([[0, 0.2], [1, 0.2], [0.86, 0.5], [1, 0.8], [0, 0.8], [0.14, 0.5]]);
    case 'wave':
      return `M0,${y(0.15)}Q${x(0.25)},${y(-0.05)} ${x(0.5)},${y(0.15)}T${W},${y(0.15)}V${y(0.85)}Q${x(0.75)},${y(1.05)} ${x(0.5)},${y(0.85)}T0,${y(0.85)}Z`;
    case 'callout':
      return poly([[0, 0], [1, 0], [1, 0.75], [0.45, 0.75], [0.2, 1], [0.28, 0.75], [0, 0.75]]);
    case 'ocallout':
      return `M${x(0.42)},${y(0.79)}A${W / 2},${y(0.4)} 0 1 0 ${x(0.28)},${y(0.76)}L${x(0.14)},${H}Z`;
    case 'terminator':
      return `M${Math.min(H / 2, W / 2)},0H${W - Math.min(H / 2, W / 2)}A${Math.min(H / 2, W / 2)},${H / 2} 0 0 1 ${W - Math.min(H / 2, W / 2)},${H}H${Math.min(H / 2, W / 2)}A${Math.min(H / 2, W / 2)},${H / 2} 0 0 1 ${Math.min(H / 2, W / 2)},0Z`;
    case 'document':
      return `M0,0H${W}V${y(0.82)}Q${x(0.75)},${y(0.64)} ${x(0.5)},${y(0.82)}T0,${y(0.82)}Z`;
    case 'predefined':
      return `M0,0H${W}V${H}H0ZM${x(0.12)},0V${H}M${x(0.88)},0V${H}`;
    default:
      return null;
  }
}

/** Word's name for each shape (its preset geometry). */
export const WORD_SHAPES: Record<ShapeKind, string> = {
  line: 'line', arrow: 'line', rect: 'rect', rounded: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', rtriangle: 'rtTriangle', diamond: 'diamond', parallelogram: 'parallelogram', trapezoid: 'trapezoid', pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon', plus: 'plus', can: 'can', heart: 'heart', cloud: 'cloud',
  rarrow: 'rightArrow', larrow: 'leftArrow', uarrow: 'upArrow', darrow: 'downArrow', lrarrow: 'leftRightArrow', chevron: 'chevron',
  star4: 'star4', star5: 'star5', star8: 'star8', banner: 'ribbon2', wave: 'wave', callout: 'wedgeRectCallout', ocallout: 'wedgeEllipseCallout',
  terminator: 'flowChartTerminator', document: 'flowChartDocument', data: 'flowChartInputOutput', predefined: 'flowChartPredefinedProcess',
  freeform: 'custom', path: 'custom',
};

/** A shape's corners for Edit Points, when it's made of straight sides (as fractions of its size); null for curved ones. */
export function cornersOf(kind: ShapeKind): [number, number][] | null {
  if (kind === 'rect') return [[0, 0], [1, 0], [1, 1], [0, 1]];
  const d = shapePath(kind, 1, 1);
  if (!d || /[AQCT]/.test(d) || (d.match(/M/g) ?? []).length > 1) return null;
  const nums = d.replace(/[MLZ]/g, ' ').trim().split(/[\s,]+/).map(Number);
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([Math.round(nums[i] * 1000) / 1000, Math.round(nums[i + 1] * 1000) / 1000]);
  return pts.length >= 3 ? pts : null;
}

/** Word's shape styles gallery: ready-made fills, lines, effects and text colours. */
export const SHAPE_STYLES: { name: string; look: Partial<ShapeLook> }[] = [
  { name: 'Blue outline', look: { fill: '#ffffff', line: '#4472c4', lw: 1.5, tc: '#1f3864', grad: undefined, fx: undefined } },
  { name: 'Blue fill', look: { fill: '#4472c4', line: '#2f528f', lw: 1, tc: '#ffffff', grad: undefined, fx: undefined } },
  { name: 'Blue gradient', look: { fill: '#8faadc', line: null, grad: '#2f5597', tc: '#ffffff', fx: undefined } },
  { name: 'Orange fill', look: { fill: '#ed7d31', line: '#ae5a21', lw: 1, tc: '#ffffff', grad: undefined, fx: undefined } },
  { name: 'Gold gradient', look: { fill: '#ffe699', line: null, grad: '#bf9000', tc: '#3d2f00', fx: undefined } },
  { name: 'Green, shadow', look: { fill: '#70ad47', line: null, tc: '#ffffff', grad: undefined, fx: 'shadow' } },
  { name: 'Grey, soft', look: { fill: '#d9d9d9', line: '#7f7f7f', lw: 0.75, tc: '#262626', grad: undefined, fx: undefined } },
  { name: 'Dark, glow', look: { fill: '#262626', line: null, tc: '#ffffff', grad: undefined, fx: 'glow' } },
  { name: 'Purple, bevel', look: { fill: '#7030a0', line: null, tc: '#ffffff', grad: undefined, fx: 'bevel' } },
  { name: 'Red, dashed', look: { fill: '#fde9e7', line: '#c00000', lw: 2, dash: 'dash', tc: '#7f0000', grad: undefined, fx: undefined } },
  { name: 'Sky, reflection', look: { fill: '#9dc3e6', line: '#2e75b6', lw: 1, tc: '#1f3864', grad: undefined, fx: 'reflect' } },
  { name: 'Paper', look: { fill: '#fffcf2', line: '#a6a6a6', lw: 0.75, tc: '#262626', grad: undefined, fx: 'shadow' } },
];
