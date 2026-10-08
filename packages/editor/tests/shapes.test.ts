import { describe, expect, it } from 'vitest';
import { caret, makeBlock } from '../src/model';
import { applyOps, invertOps } from '../src/ops';
import { insertShape, setShape } from '../src/commands';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { tidyShape } from '../src/shape';

describe('text boxes and shapes', () => {
  it('go in at the caret, change, and undo', () => {
    const doc = { blocks: [makeBlock('paragraph', 'Before')] };
    const t = insertShape({ doc, selection: caret({ block: doc.blocks[0].id, offset: 6 }), storedMarks: null }, 'rect', true);
    const after = applyOps(doc, t.ops);
    const shape = after.blocks[1];
    expect(shape.type).toBe('shape');
    expect(shape.shape).toMatchObject({ kind: 'rect', w: 3, h: 1, fill: '#ffffff', wrap: 'inline', text: '' });
    const changed = applyOps(after, setShape({ doc: after, selection: t.selectionAfter, storedMarks: null }, shape.id, { text: 'Inside **bold**', fill: '#fff2cc', wrap: 'right' }).ops);
    expect(changed.blocks[1].shape).toMatchObject({ text: 'Inside **bold**', fill: '#fff2cc', wrap: 'right' });
    expect(applyOps(after, invertOps(t.ops))).toEqual(doc);
  });

  it('are a line of their own in the file, and text that looks like one stays text', () => {
    const doc = {
      blocks: [
        { ...makeBlock('shape'), shape: tidyShape({ kind: 'ellipse', w: 2, h: 1.25, fill: '#cfe2f3', line: null, wrap: 'left', text: 'A *note*' }), align: 'center' as const },
        makeBlock('shape', '', [], { shape: tidyShape({ kind: 'arrow' }) }),
        makeBlock('paragraph', '{shape rect} is how a shape is written'),
      ],
    };
    const md = toMarkdown(doc);
    expect(md).toContain('{shape ellipse w=2 h=1.25 fill=#cfe2f3 line=none wrap=left align=center} A *note*');
    const back = fromMarkdown(md).blocks;
    expect(back.map((b) => [b.type, b.shape, b.align])).toEqual(doc.blocks.map((b) => [b.type, b.shape, b.align]));
    expect(back[2].runs.map((r) => r.text).join('')).toBe('{shape rect} is how a shape is written');
  });
});
