import { describe, expect, it } from 'vitest';
import { SHAPE_KINDS, WORD_SHAPES, readShapeLine, shapeLine, shapePath, tidyShape } from '../src/shape';

describe('more shapes, fills, lines and effects', () => {
  it('every shape has an outline (or is drawn its own way) and a Word name', () => {
    for (const k of SHAPE_KINDS) {
      expect(WORD_SHAPES[k]).toBeTruthy();
      if (!['rect', 'rounded', 'ellipse', 'line', 'arrow', 'freeform', 'path'].includes(k)) expect(shapePath(k, 100, 60)).toMatch(/^M/);
    }
  });

  it('keeps a gradient or picture fill, line thickness and dashes, line ends, an effect and the text colour in the file', () => {
    for (const line of ['{shape star5 w=1.5 h=1.5 fill=#4472c4 line=none grad=#2f5597 fx=glow tc=#ffffff} Star', '{shape callout w=2 h=1 fill=#ffffff line=#333333 img=Attachments/a.png lw=3 dash=dot} Hi', '{shape line w=2 h=0.25 fill=none line=#c00000 head=open tail=dot}']) {
      expect(shapeLine(readShapeLine(line)!.shape)).toBe(line);
    }
  });

  it('keeps only what suits the shape', () => {
    const line = tidyShape({ kind: 'line', grad: '#000000', img: 'x.png', head: 'arrow' });
    expect(line.grad).toBeUndefined();
    expect(line.img).toBeUndefined();
    expect(line.head).toBe('arrow');
    expect(tidyShape({ kind: 'rect', head: 'arrow', lw: 1.5 }).head).toBeUndefined();
    expect(tidyShape({ kind: 'rect', lw: 1.5 }).lw).toBeUndefined();
    expect(readShapeLine('{shape blob w=1 h=1 fill=none line=none}')).toBeNull();
  });
});
