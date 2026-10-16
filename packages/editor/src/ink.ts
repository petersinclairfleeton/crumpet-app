// Drawing (Word's Draw tab and drawing canvas): a ```ink block holds strokes
// drawn with a pen, pencil or highlighter, as JSON; drawn here as SVG. Ink to
// Shape turns a rough stroke into the line, rectangle, oval or triangle it
// looks like.

export type InkTool = 'pen' | 'pencil' | 'highlighter';

export interface Stroke {
  /** The tool it was drawn with. */
  t: InkTool;
  /** Its colour. */
  c: string;
  /** Its width (in the drawing's units, a pixel at 100%). */
  w: number;
  /** Its points: x, y (and pressure, 0 to 1, when the pen gives it). */
  p: [number, number, number?][];
  /** A shape made from it (Ink to Shape): drawn with straight lines, or as an oval. */
  s?: 'line' | 'rect' | 'oval' | 'tri';
}

export interface Ink {
  w: number;
  h: number;
  strokes: Stroke[];
}

export const INK_COLOURS = ['#1f1f1f', '#2f5fd0', '#d0312d', '#1e8e3e', '#f29900', '#8e24aa', '#ffeb3b', '#ffffff'];

const TOOLS: InkTool[] = ['pen', 'pencil', 'highlighter'];

/** A drawing from its text (an empty one if it can't be read). */
export function parseInk(text: string): Ink {
  try {
    const j = JSON.parse(text) as Partial<Ink>;
    const num = (n: unknown, d: number) => (typeof n === 'number' && Number.isFinite(n) ? n : d);
    const strokes = (Array.isArray(j.strokes) ? j.strokes : []).flatMap((s): Stroke[] => {
      if (!s || !Array.isArray(s.p)) return [];
      const p = s.p.filter((q) => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1])).map((q) => (q[2] !== undefined && Number.isFinite(q[2]) ? [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10, Math.round(q[2] * 100) / 100] : [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]) as [number, number, number?]);
      if (!p.length) return [];
      return [{ t: TOOLS.includes(s.t) ? s.t : 'pen', c: /^#[0-9a-f]{6}$/i.test(s.c ?? '') ? s.c : '#1f1f1f', w: Math.min(60, Math.max(0.5, num(s.w, 3))), p, ...(s.s && ['line', 'rect', 'oval', 'tri'].includes(s.s) ? { s: s.s } : {}) }];
    });
    return { w: Math.min(2000, Math.max(100, num(j.w, 600))), h: Math.min(2000, Math.max(60, num(j.h, 300))), strokes };
  } catch {
    return { w: 600, h: 300, strokes: [] };
  }
}

export function inkText(ink: Ink): string {
  return JSON.stringify({ w: Math.round(ink.w), h: Math.round(ink.h), strokes: ink.strokes });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** A stroke's outline as an SVG path: smooth curves through its points (straight sides for shapes). */
export function strokePath(s: Stroke): string {
  const p = s.p;
  if (s.s === 'oval' && p.length >= 2) {
    const xs = p.map((q) => q[0]);
    const ys = p.map((q) => q[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const [cx, cy, rx, ry] = [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2];
    return `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0 Z`;
  }
  if (s.s) return `M${p.map((q) => `${q[0]},${q[1]}`).join(' L')}${s.s === 'line' ? '' : ' Z'}`;
  if (p.length === 1) return `M${p[0][0]},${p[0][1]} l0.01,0`;
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2;
    const my = (p[i][1] + p[i + 1][1]) / 2;
    d += ` Q${p[i][0]},${p[i][1]} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const last = p[p.length - 1];
  return `${d} L${last[0]},${last[1]}`;
}

/** A stroke's width, from its pen pressure when there is any (an Apple Pencil, a tablet pen). */
function widthOf(s: Stroke): number {
  const ps = s.p.map((q) => q[2]).filter((x): x is number => x !== undefined && x > 0);
  if (!ps.length || s.t === 'highlighter') return s.w;
  const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
  return s.w * (0.5 + avg);
}

/** One stroke as SVG. */
export function strokeSvg(s: Stroke): string {
  const hl = s.t === 'highlighter';
  const pencil = s.t === 'pencil';
  return `<path d="${strokePath(s)}" fill="none" stroke="${esc(s.c)}" stroke-width="${(hl ? s.w * 4 : widthOf(s)).toFixed(1)}" stroke-linecap="${hl ? 'square' : 'round'}" stroke-linejoin="round"${hl ? ' stroke-opacity="0.4" style="mix-blend-mode:multiply"' : pencil ? ' stroke-opacity="0.75" filter="url(#pencil)"' : ''}/>`;
}

/** The drawing as SVG (it scales to the width it's given). */
export function inkSvg(ink: Ink): string {
  const pencil = ink.strokes.some((s) => s.t === 'pencil') ? '<defs><filter id="pencil"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.2"/></filter></defs>' : '';
  return `<svg class="ink-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ink.w} ${ink.h}" width="${ink.w}" height="${ink.h}" role="img" aria-label="Drawing">${pencil}${ink.strokes.map(strokeSvg).join('')}</svg>`;
}

// ---------------------------------------------------------------- Ink to Shape

const dist = (a: readonly (number | undefined)[], b: readonly (number | undefined)[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);

/** How far a point is from the line through a and b. */
function offLine(p: number[], a: number[], b: number[]): number {
  const len = dist(a, b) || 1;
  return Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
}

/** The corners of a rough outline (Ramer–Douglas–Peucker). */
function corners(p: number[][], tol: number): number[][] {
  if (p.length < 3) return p;
  let far = 0;
  let at = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = offLine(p[i], p[0], p[p.length - 1]);
    if (d > far) [far, at] = [d, i];
  }
  if (far < tol) return [p[0], p[p.length - 1]];
  return [...corners(p.slice(0, at + 1), tol).slice(0, -1), ...corners(p.slice(at), tol)];
}

/** The shape a stroke looks like (Ink to Shape), or null if it's not near enough to one. */
export function recognizeShape(s: Stroke): Stroke | null {
  const p = s.p.map((q) => [q[0], q[1]]);
  if (p.length < 4) return null;
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (size < 12) return null;
  const length = p.slice(1).reduce((n, q, i) => n + dist(q, p[i]), 0);
  const ends = dist(p[0], p[p.length - 1]);
  const plain = { t: s.t, c: s.c, w: s.w };
  // Nearly straight: a line from end to end.
  if (ends > length * 0.85) return { ...plain, p: [[p[0][0], p[0][1]], [p[p.length - 1][0], p[p.length - 1][1]]], s: 'line' };
  // Closed shapes: the ends meet.
  if (ends > size * 0.35) return null;
  // A closed outline: split at the point farthest from the start, and find the corners of each half.
  const loop = [...p, p[0]];
  let far = 0;
  for (let i = 1; i < loop.length; i++) if (dist(loop[i], loop[0]) > dist(loop[far], loop[0])) far = i;
  const pts = [...corners(loop.slice(0, far + 1), size * 0.12).slice(0, -1), ...corners(loop.slice(far), size * 0.12)];
  const n = pts.length - 1;
  const round = (q: number[]) => [Math.round(q[0]), Math.round(q[1])] as [number, number];
  if (n === 3) return { ...plain, p: pts.slice(0, 3).map(round), s: 'tri' };
  if (n === 4 || n === 5) {
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return { ...plain, p: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(round), s: 'rect' };
  }
  // Round: the points all about as far from the middle.
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  const rs = p.map((q) => Math.hypot((q[0] - cx) / (Math.max(...xs) - Math.min(...xs) || 1), (q[1] - cy) / (Math.max(...ys) - Math.min(...ys) || 1)));
  const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
  const spread = Math.sqrt(rs.reduce((a, r) => a + (r - mean) ** 2, 0) / rs.length) / mean;
  if (spread < 0.2) return { ...plain, p: [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]].map(round), s: 'oval' };
  return null;
}

/** Whether a stroke passes within `r` of a point (for the eraser and picking). */
export function strokeNear(s: Stroke, x: number, y: number, r: number): boolean {
  const p = s.s === 'rect' || s.s === 'tri' ? [...s.p, s.p[0]] : s.p;
  if (s.s === 'oval') {
    const [a, b] = s.p;
    const [cx, cy, rx, ry] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 || 1, Math.abs(b[1] - a[1]) / 2 || 1];
    return Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry) < r + s.w;
  }
  if (p.length === 1) return dist(p[0], [x, y]) < r + s.w;
  for (let i = 1; i < p.length; i++) {
    const [a, b] = [p[i - 1], p[i]];
    const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / l2));
    if (Math.hypot(x - (a[0] + t * (b[0] - a[0])), y - (a[1] + t * (b[1] - a[1]))) < r + s.w / 2) return true;
  }
  return false;
}

/** Whether a point is inside a lasso (a closed outline). */
export function insideLasso(lasso: number[][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = lasso.length - 1; i < lasso.length; j = i++) {
    const [xi, yi] = lasso[i];
    const [xj, yj] = lasso[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
