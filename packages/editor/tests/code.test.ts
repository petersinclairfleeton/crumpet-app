import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '../src/markdown';
import { makeBlock } from '../src/model';
import { insertCode, setCode, type EditorState } from '../src/commands';
import { applyOps } from '../src/ops';
import { caret } from '../src/model';

describe('maths and diagrams', () => {
  it('are fenced blocks in the file, read back the same', () => {
    const doc = {
      blocks: [
        makeBlock('paragraph', 'Before'),
        makeBlock('code', '', [], { code: { lang: 'math', text: 'E = mc^2\n\\frac{a}{b}' } }),
        makeBlock('code', '', [], { code: { lang: 'mermaid', text: 'graph LR\n  A --> B' } }),
        makeBlock('paragraph', 'After'),
      ],
    };
    const md = toMarkdown(doc);
    expect(md).toBe('Before\n\n```math\nE = mc^2\n\\frac{a}{b}\n```\n\n```mermaid\ngraph LR\n  A --> B\n```\n\nAfter\n');
    expect(fromMarkdown(md).blocks.map((b) => [b.type, b.code])).toEqual(doc.blocks.map((b) => [b.type, b.code]));
  });

  it('reads latex fences, an unclosed fence, and a source with backticks in it', () => {
    expect(fromMarkdown('```latex\nx^2').blocks.map((b) => b.code)).toEqual([{ lang: 'math', text: 'x^2' }]);
    const tricky = { blocks: [makeBlock('code', '', [], { code: { lang: 'math', text: '```\nx' } })] };
    expect(fromMarkdown(toMarkdown(tricky)).blocks[0].code).toEqual({ lang: 'math', text: '```\nx' });
    // Other code fences are code lines, as before.
    expect(fromMarkdown('```js\nlet a = 1;\n```').blocks[0].type).toBe('paragraph');
  });

  it('a paragraph that looks like a fence stays a paragraph', () => {
    const doc = { blocks: [makeBlock('paragraph', '```math')] };
    expect(fromMarkdown(toMarkdown(doc)).blocks.map((b) => [b.type, b.runs.map((r) => r.text).join('')])).toEqual([['paragraph', '```math']]);
  });

  it('inserts and changes them as undoable steps', () => {
    const doc = { blocks: [makeBlock('paragraph', '')] };
    const state: EditorState = { doc, selection: caret({ block: doc.blocks[0].id, offset: 0 }), storedMarks: null };
    const t = insertCode(state, 'math');
    const d2 = applyOps(doc, t.ops);
    const code = d2.blocks.find((b) => b.type === 'code')!;
    const t2 = setCode({ ...state, doc: d2 }, code.id, { text: 'x^2' });
    expect(applyOps(d2, t2.ops).blocks.find((b) => b.type === 'code')!.code).toEqual({ lang: 'math', text: 'x^2' });
  });
});
