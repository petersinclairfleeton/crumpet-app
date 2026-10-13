import { describe, expect, it } from 'vitest';
import { readShapeLine, shapeLine, tidyShape } from '../src/shape';

describe('arranging shapes', () => {
  it('keeps behind-the-text, tight and top-and-bottom wrapping, where it is placed from, its place in the stack and its group', () => {
    for (const line of ['{shape rect w=2 h=1 fill=#cfe2f3 line=#333333 wrap=behind x=1 y=0.5 rel=page z=3 grp=g1} Behind', '{shape ellipse w=1.5 h=1.5 fill=#fff2cc line=#333333 wrap=left tight=1}', '{shape rounded w=2 h=1 fill=#cfe2f3 line=#333333 wrap=topbottom x=1.25}']) {
      const read = readShapeLine(line)!;
      expect(shapeLine(read.shape)).toBe(line);
    }
  });

  it('only keeps what fits the wrapping', () => {
    expect(tidyShape({ kind: 'rect', wrap: 'inline', tight: true, rel: 'page', z: 2, grp: 'g1', x: 1 })).toEqual(tidyShape({ kind: 'rect', wrap: 'inline' }));
    expect(tidyShape({ kind: 'rect', wrap: 'free', z: 99 }).z).toBe(40);
    expect(tidyShape({ kind: 'rect', wrap: 'free', z: 0 }).z).toBeUndefined();
  });
});
