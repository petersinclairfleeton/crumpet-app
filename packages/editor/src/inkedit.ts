// Ink editing, like Word's ink editor: a stroke drawn over the text is read as a
// gesture. Strike a line through words or scribble over them to delete them,
// circle words to select them, draw a line down to start a new paragraph, and
// a ^ under the text to put the caret there. No handwriting is read.

export interface InkPoint {
  x: number;
  y: number;
}

export type InkGestureKind = 'strike' | 'scribble' | 'circle' | 'split' | 'insert';

export interface InkGesture {
  kind: InkGestureKind;
  box: { left: number; top: number; right: number; bottom: number };
  /** The ^'s point (insert), or where the line down starts (split). */
  at: InkPoint;
}

/** How many times the stroke turns back along x (or y), ignoring wobbles under `min` pixels. */
function turns(points: InkPoint[], axis: 'x' | 'y', min = 8): number {
  let dir = 0;
  let turnsSoFar = 0;
  let anchor = points[0][axis];
  for (const p of points) {
    const d = p[axis] - anchor;
    if (Math.abs(d) < min) continue;
    const now = Math.sign(d);
    if (dir && now !== dir) turnsSoFar++;
    dir = now;
    anchor = p[axis];
  }
  return turnsSoFar;
}

/** Which gesture a stroke is, or null when it's none of them. Points are in screen pixels. */
export function classifyGesture(points: InkPoint[]): InkGesture | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const box = { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  const w = box.right - box.left;
  const h = box.bottom - box.top;
  if (Math.max(w, h) < 12) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const gap = Math.hypot(last.x - first.x, last.y - first.y);
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const xTurns = turns(points, 'x');
  const yTurns = turns(points, 'y');

  // Back and forth over the words.
  if (xTurns >= 3 && w >= 20) return { kind: 'scribble', box, at: first };
  // A loop that comes back to where it started.
  if (w >= 24 && h >= 12 && gap < 0.35 * Math.max(w, h) && length > 1.2 * (w + h)) return { kind: 'circle', box, at: first };
  // A ^: up to a point and back down to about the same height.
  const apex = points.reduce((a, p) => (p.y < a.y ? p : a), first);
  const rise = Math.min(first.y, last.y) - apex.y;
  if (xTurns === 0 && yTurns === 1 && rise >= 10 && Math.abs(first.y - last.y) < Math.max(10, 0.5 * h) && apex.x > box.left + w * 0.2 && apex.x < box.right - w * 0.2 && w <= 2.5 * h) {
    return { kind: 'insert', box, at: apex };
  }
  // A line down.
  if (h >= 24 && w <= 0.35 * h && yTurns === 0) return { kind: 'split', box, at: first.y < last.y ? first : last };
  // A line through.
  if (w >= 12 && h <= Math.max(12, 0.35 * w) && xTurns <= 1) return { kind: 'strike', box, at: first };
  return null;
}

/** Widens [from, to) in `text` out to whole words (a stroke rarely starts and ends on a word's edge). */
export function toWords(text: string, from: number, to: number, withSpace = true): [number, number] {
  let a = Math.max(0, Math.min(from, to));
  let z = Math.min(text.length, Math.max(from, to));
  const word = (c: string | undefined) => !!c && /[\p{L}\p{N}'’-]/u.test(c);
  while (a > 0 && word(text[a - 1]) && word(text[a])) a--;
  while (z < text.length && word(text[z - 1]) && word(text[z])) z++;
  if (!withSpace) return [a, z];
  // Striking out whole words takes one of the spaces around them too.
  if (text[z] === ' ' && (a === 0 || text[a - 1] === ' ')) z++;
  else if (a > 0 && text[a - 1] === ' ' && (z === text.length || /[\s.,;:!?]/.test(text[z]))) a--;
  return [a, z];
}

/** The nearest place between words to `at` (for the ^ gesture). */
export function nearestGap(text: string, at: number): number {
  if (at <= 0 || at >= text.length || text[at - 1] === ' ' || text[at] === ' ') return at;
  let back = at;
  let on = at;
  while (back > 0 && text[back - 1] !== ' ') back--;
  while (on < text.length && text[on] !== ' ') on++;
  return at - back <= on - at ? back : on;
}
