import { describe, expect, it } from 'vitest';
import { picAttrs, readPicAttrs } from '../src/picture';
import { readShapeLine, shapeLine, tidyShape } from '../src/shape';

describe('objects hidden in the Selection pane', () => {
  it('a picture keeps being hidden in the file', () => {
    expect(picAttrs({ w: 2, hide: true })).toBe('{pic w=2 hide=1}');
    expect(readPicAttrs('![x](a.png){pic w=2 hide=1}').pic).toEqual({ w: 2, hide: true });
  });
  it('so does a shape', () => {
    const line = shapeLine(tidyShape({ kind: 'ellipse', hide: true, text: 'Hi' }));
    expect(line).toContain('hide=1');
    expect(readShapeLine(line)?.shape.hide).toBe(true);
    expect(tidyShape({ kind: 'rect' }).hide).toBeUndefined();
  });
});
