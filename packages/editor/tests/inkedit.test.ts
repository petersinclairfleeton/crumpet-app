import { describe, expect, it } from 'vitest';
import { classifyGesture, nearestGap, toWords } from '../src/inkedit';

const line = (x0: number, y0: number, x1: number, y1: number, n = 12) => Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n }));

describe('ink gestures', () => {
  it('reads a line through as striking out', () => {
    expect(classifyGesture(line(100, 50, 220, 53))?.kind).toBe('strike');
  });
  it('reads back and forth as a scribble', () => {
    const pts = [0, 1, 2, 3, 4, 5, 6].flatMap((i) => line(i % 2 ? 160 : 100, 40 + i * 2, i % 2 ? 100 : 160, 42 + i * 2, 4));
    expect(classifyGesture(pts)?.kind).toBe('scribble');
  });
  it('reads a loop back to its start as a circle', () => {
    const pts = Array.from({ length: 40 }, (_, i) => ({ x: 200 + 80 * Math.cos((i / 39) * 2 * Math.PI), y: 100 + 20 * Math.sin((i / 39) * 2 * Math.PI) }));
    expect(classifyGesture(pts)?.kind).toBe('circle');
  });
  it('reads a line down as a new paragraph, starting at its top', () => {
    const g = classifyGesture(line(150, 40, 152, 90));
    expect(g?.kind).toBe('split');
    expect(g?.at.y).toBe(40);
  });
  it('reads a ^ as a place to write, at its point', () => {
    const g = classifyGesture([...line(100, 80, 115, 55, 6), ...line(115, 55, 130, 80, 6).slice(1)]);
    expect(g?.kind).toBe('insert');
    expect(g?.at).toEqual({ x: 115, y: 55 });
  });
  it('ignores dots and specks', () => {
    expect(classifyGesture(line(10, 10, 14, 12))).toBeNull();
    expect(classifyGesture(line(10, 10, 30, 11))?.kind).toBe('strike');
    expect(classifyGesture([{ x: 1, y: 1 }])).toBeNull();
  });
  it('widens to whole words, taking one space with them', () => {
    const t = 'Take the boat home.';
    expect(t.slice(...toWords(t, 6, 11))).toBe('the boat ');
    const [a, z] = toWords(t, 15, 17);
    expect(t.slice(0, a) + t.slice(z)).toBe('Take the boat.');
    expect(t.slice(...toWords(t, 6, 11, false))).toBe('the boat');
  });
  it('finds the nearest gap between words', () => {
    const t = 'Take the boat';
    expect(nearestGap(t, 6)).toBe(5);
    expect(nearestGap(t, 12)).toBe(13);
    expect(nearestGap(t, 4)).toBe(4);
  });
});
