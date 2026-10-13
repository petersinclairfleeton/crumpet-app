import { describe, expect, it } from 'vitest';
import { cornersOf, readShapeLine, shapeLine, tidyShape } from '../src/shape';
import { ICONS } from '../src/icons';

describe('freeforms, drawings, text in shapes and linked boxes', () => {
  it('keeps a freeform’s corners, a drawing’s outline, text alignment and direction, and a chain in the file', () => {
    for (const line of [
      '{shape freeform w=2 h=1 fill=#cfe2f3 line=#333333 pts=0,0;1,0.2;0.6,1} Hand drawn',
      '{shape path w=1 h=1 fill=#333333 line=none vb=24,24 d=M12%202L22%2022H2Z}',
      '{shape rect w=3 h=1 fill=#ffffff line=#333333 ta=left tv=top dir=down chain=c1} Line one&#10;• Line two',
    ]) {
      expect(shapeLine(readShapeLine(line)!.shape)).toBe(line);
    }
  });

  it('turns straight-sided shapes into corners for Edit Points, but not curved ones', () => {
    expect(cornersOf('triangle')).toEqual([[0.5, 0], [1, 1], [0, 1]]);
    expect(cornersOf('rect')).toHaveLength(4);
    expect(cornersOf('heart')).toBeNull();
  });

  it('keeps only sensible outlines', () => {
    expect(tidyShape({ kind: 'path', d: 'M0 0<script>' }).d).toBe('M0 0H24V24H0Z');
    expect(tidyShape({ kind: 'freeform', pts: [[0, 0], [1, 1]] }).pts).toHaveLength(3);
    expect(tidyShape({ kind: 'line', chain: 'c1' }).chain).toBeUndefined();
    for (const icon of ICONS) expect(tidyShape({ kind: 'path', d: icon.d }).d).toBe(icon.d);
  });
});
