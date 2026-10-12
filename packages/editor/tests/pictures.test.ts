import { describe, expect, it } from 'vitest';
import { caret, makeBlock, runsText } from '../src/model';
import { applyOps } from '../src/ops';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { setPic } from '../src/commands';
import { tidyPic } from '../src/picture';

describe('pictures', () => {
  it('keep their size, wrapping, turn and alt text in the file', () => {
    const img = makeBlock('image', 'Gull', [], { src: 'Attachments/a-gull.jpg', align: 'center', pic: { w: 2.5, wrap: 'free', x: 1, y: -0.25, rot: 15, alt: 'A gull says "hi" {there}' } });
    const md = toMarkdown({ blocks: [img] });
    expect(md).toBe('![Gull](Attachments/a-gull.jpg) {pic w=2.5 wrap=free x=1 y=-0.25 rot=15 alt="A gull says &quot;hi&quot; {there&#125;" align=center}\n');
    const back = fromMarkdown(md).blocks[0];
    expect(back).toMatchObject({ type: 'image', src: 'Attachments/a-gull.jpg', align: 'center', pic: { w: 2.5, wrap: 'free', x: 1, y: -0.25, rot: 15, alt: 'A gull says "hi" {there}' } });
    expect(runsText(back.runs)).toBe('Gull');
  });

  it('without a look of their own are written as before', () => {
    expect(toMarkdown({ blocks: [makeBlock('image', 'x', [], { src: 'a.png', align: 'right' })] })).toBe('![x](a.png) {.right}\n');
    expect(fromMarkdown('![x](a.png) {.right}\n').blocks[0]).toMatchObject({ align: 'right' });
    expect(fromMarkdown('![x](a.png)\n').blocks[0].pic).toBeUndefined();
  });

  it('are tidied: wrapping positions only in front of the text, turns within a circle', () => {
    expect(tidyPic({ w: 0.01, wrap: 'left', x: 3, rot: 370 })).toEqual({ w: 0.2, wrap: 'left', rot: 10 });
    expect(tidyPic({ wrap: 'inline', alt: '  ' })).toBeUndefined();
  });

  it('change look as a step to undo, and can be reset', () => {
    const img = makeBlock('image', '', [], { src: 'a.png' });
    const s = { doc: { blocks: [img, makeBlock('paragraph', 'x')] }, selection: caret({ block: img.id, offset: 0 }), storedMarks: null };
    const t = setPic(s, img.id, { w: 3, wrap: 'left' });
    const doc = applyOps(s.doc, t.ops);
    expect(doc.blocks[0].pic).toEqual({ w: 3, wrap: 'left' });
    const reset = setPic({ ...s, doc }, img.id, { alt: 'Kept' }, true, 'b.png');
    const after = applyOps(doc, reset.ops);
    expect(after.blocks[0]).toMatchObject({ src: 'b.png', pic: { alt: 'Kept' } });
  });
});

describe('picture crops, styles and corrections', () => {
  it('are saved and read back', () => {
    const img = makeBlock('image', '', [], { src: 'a.png', pic: { w: 2, crop: [0.1, 0, 0.2, 0.05], mask: 'oval', style: 'shadow', border: '#2F6FD1', bright: 20, contrast: -10, sat: 30, fade: 25, effect: 'sepia' } });
    const md = toMarkdown({ blocks: [img] });
    expect(md).toBe('![](a.png) {pic w=2 crop=0.1,0,0.2,0.05 mask=oval style=shadow border=#2f6fd1 bright=20 contrast=-10 sat=30 fade=25 effect=sepia}\n');
    expect(fromMarkdown(md).blocks[0].pic).toEqual(tidyPic(img.pic));
  });

  it('always leave something of the picture, and drop unknown choices', () => {
    expect(tidyPic({ crop: [0.6, 0, 0.6, 0], mask: 'blob' as never, bright: 400, fade: 99 })).toEqual({ crop: [0.6, 0, 0.35, 0], bright: 100, fade: 90 });
  });
});

describe('a picture’s original file', () => {
  it('is kept in the file, for Reset picture', () => {
    const img = makeBlock('image', '', [], { src: 'Attachments/b-gull-small.jpg', pic: { orig: 'Attachments/a-gull.jpg' } });
    const md = toMarkdown({ blocks: [img] });
    expect(md).toBe('![](Attachments/b-gull-small.jpg) {pic orig="Attachments/a-gull.jpg"}\n');
    expect(fromMarkdown(md).blocks[0].pic).toEqual({ orig: 'Attachments/a-gull.jpg' });
  });
});
