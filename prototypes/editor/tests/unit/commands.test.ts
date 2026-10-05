import { describe, expect, it } from 'vitest';
import { type Doc, type Mark, type Selection, caret, makeBlock, runsText } from '../../src/model';
import { applyOps, invertOps } from '../../src/ops';
import {
  type EditorState,
  deleteChar,
  deleteSelection,
  insertText,
  joinBackward,
  markdownShortcut,
  setBlockType,
  splitBlock,
  syncBlockText,
  toggleMark,
  toggleTodo,
  graphemeStep,
} from '../../src/commands';
import { History } from '../../src/history';

function state(doc: Doc, selection?: Selection): EditorState {
  return { doc, selection: selection ?? caret({ block: doc.blocks[0].id, offset: 0 }), storedMarks: null };
}

function texts(doc: Doc): string[] {
  return doc.blocks.map((b) => runsText(b.runs));
}

describe('commands', () => {
  it('types text with the marks of the preceding character', () => {
    const doc: Doc = { blocks: [{ ...makeBlock('paragraph'), runs: [{ text: 'ab', marks: ['bold'] }] }] };
    const id = doc.blocks[0].id;
    const t = insertText(state(doc, caret({ block: id, offset: 2 })), 'c');
    const after = applyOps(doc, t.ops);
    expect(after.blocks[0].runs).toEqual([{ text: 'abc', marks: ['bold'] }]);
    expect(t.selectionAfter.focus.offset).toBe(3);
  });

  it('splits a block on Enter and joins it back on Backspace', () => {
    const doc: Doc = { blocks: [makeBlock('paragraph', 'hello world')] };
    const id = doc.blocks[0].id;
    let s = state(doc, caret({ block: id, offset: 5 }));
    const split = splitBlock(s);
    s = { ...s, doc: applyOps(s.doc, split.ops), selection: split.selectionAfter };
    expect(texts(s.doc)).toEqual(['hello', ' world']);
    const join = joinBackward(s)!;
    s = { ...s, doc: applyOps(s.doc, join.ops), selection: join.selectionAfter };
    expect(texts(s.doc)).toEqual(['hello world']);
    expect(s.selection.focus).toEqual({ block: id, offset: 5 });
  });

  it('deletes a selection across three blocks', () => {
    const doc: Doc = { blocks: [makeBlock('paragraph', 'one'), makeBlock('heading2', 'two'), makeBlock('todo', 'three')] };
    const [a, , c] = doc.blocks;
    const t = deleteSelection(state(doc, { anchor: { block: a.id, offset: 1 }, focus: { block: c.id, offset: 2 } }))!;
    const after = applyOps(doc, t.ops);
    expect(texts(after)).toEqual(['oree']);
    expect(after.blocks[0].type).toBe('paragraph');
  });

  it('turns "# " into a heading and Backspace at its start back into a paragraph', () => {
    const doc: Doc = { blocks: [makeBlock('paragraph', '# ')] };
    const id = doc.blocks[0].id;
    const t = markdownShortcut(state(doc, caret({ block: id, offset: 2 })))!;
    const after = applyOps(doc, t.ops);
    expect(after.blocks[0].type).toBe('heading1');
    expect(texts(after)).toEqual(['']);
    const back = joinBackward(state(after, caret({ block: id, offset: 0 })))!;
    expect(applyOps(after, back.ops).blocks[0].type).toBe('paragraph');
  });

  it('leaves a checklist when Enter is pressed on an empty item', () => {
    const doc: Doc = { blocks: [makeBlock('todo', 'milk'), makeBlock('todo', '')] };
    const t = splitBlock(state(doc, caret({ block: doc.blocks[1].id, offset: 0 })));
    const after = applyOps(doc, t.ops);
    expect(after.blocks.map((b) => b.type)).toEqual(['todo', 'paragraph']);
  });

  it('continues a checklist with an unchecked item on Enter', () => {
    const doc: Doc = { blocks: [makeBlock('todo', 'milk', [], { checked: true })] };
    const t = splitBlock(state(doc, caret({ block: doc.blocks[0].id, offset: 4 })));
    const after = applyOps(doc, t.ops);
    expect(after.blocks.map((b) => [b.type, b.checked])).toEqual([
      ['todo', true],
      ['todo', false],
    ]);
  });

  it('toggles bold across part of two blocks', () => {
    const doc: Doc = { blocks: [makeBlock('paragraph', 'abcd'), makeBlock('paragraph', 'efgh')] };
    const [a, b] = doc.blocks;
    const t = toggleMark(state(doc, { anchor: { block: a.id, offset: 2 }, focus: { block: b.id, offset: 2 } }), 'bold');
    const after = applyOps(doc, t.ops);
    expect(after.blocks[0].runs).toEqual([
      { text: 'ab', marks: [] },
      { text: 'cd', marks: ['bold'] },
    ]);
    expect(after.blocks[1].runs).toEqual([
      { text: 'ef', marks: ['bold'] },
      { text: 'gh', marks: [] },
    ]);
  });

  it('stores marks for the next typed text when nothing is selected', () => {
    const doc: Doc = { blocks: [makeBlock('paragraph', 'ab')] };
    const s = state(doc, caret({ block: doc.blocks[0].id, offset: 2 }));
    const t = toggleMark(s, 'italic');
    expect(t.ops).toEqual([]);
    const typed = insertText({ ...s, storedMarks: t.storedMarks! }, 'c');
    expect(applyOps(doc, typed.ops).blocks[0].runs).toEqual([
      { text: 'ab', marks: [] },
      { text: 'c', marks: ['italic'] },
    ]);
  });

  it('deletes whole grapheme clusters (emoji, accents)', () => {
    const text = 'a👍🏽e\u0301'; // e + combining accent: two code units, one character
    expect(graphemeStep(text, text.length, -1)).toBe(text.length - 2);
    const doc: Doc = { blocks: [makeBlock('paragraph', 'a👍🏽')] };
    const t = deleteChar(state(doc, caret({ block: doc.blocks[0].id, offset: 'a👍🏽'.length })), -1)!;
    expect(texts(applyOps(doc, t.ops))).toEqual(['a']);
  });

  it('pastes multi-line text as separate blocks', () => {
    const doc: Doc = { blocks: [makeBlock('paragraph', 'XY')] };
    const t = insertText(state(doc, caret({ block: doc.blocks[0].id, offset: 1 })), 'one\ntwo\r\nthree');
    expect(texts(applyOps(doc, t.ops))).toEqual(['Xone', 'two', 'threeY']);
  });

  it('reads IME results back from the DOM as a minimal edit', () => {
    const doc: Doc = { blocks: [{ ...makeBlock('paragraph'), runs: [{ text: 'ab', marks: ['bold'] }, { text: 'cd', marks: [] }] }] };
    const id = doc.blocks[0].id;
    const t = syncBlockText(state(doc), id, 'ab日本cd', caret({ block: id, offset: 4 }))!;
    expect(t.ops).toEqual([{ type: 'insert', block: id, offset: 2, runs: [{ text: '日本', marks: ['bold'] }] }]);
  });
});

describe('history', () => {
  it('merges quick typing into one undo step and restores the document', () => {
    const doc: Doc = { blocks: [makeBlock('paragraph', '')] };
    const h = new History();
    let s = state(doc);
    let now = 1000;
    for (const ch of 'hello') {
      const t = insertText(s, ch);
      s = { ...s, doc: applyOps(s.doc, t.ops), selection: t.selectionAfter };
      h.record(t, s.doc, (now += 100));
    }
    expect(texts(s.doc)).toEqual(['hello']);
    const u = h.undo(s.doc)!;
    expect(u.ops).toHaveLength(1); // five keystrokes, one remove
    expect(texts(applyOps(s.doc, u.ops))).toEqual(['']);
    expect(h.undo(s.doc)).toBeNull();
  });
});

// ---- Randomised check: every transaction can be exactly undone ----

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function randomPos(doc: Doc, r: () => number) {
  const b = doc.blocks[Math.floor(r() * doc.blocks.length)];
  return { block: b.id, offset: Math.floor(r() * (runsText(b.runs).length + 1)) };
}

describe('invertibility (randomised)', () => {
  it('applying a transaction and then its inverse gives back the same document', () => {
    const r = rng(42);
    const marks: Mark[] = ['bold', 'italic', 'underline', 'strike', 'code'];
    let doc: Doc = { blocks: [makeBlock('paragraph', 'The quick brown fox'), makeBlock('todo', 'jumps'), makeBlock('heading1', 'over')] };
    for (let i = 0; i < 3000; i++) {
      const sel: Selection = r() < 0.6 ? caret(randomPos(doc, r)) : { anchor: randomPos(doc, r), focus: randomPos(doc, r) };
      const s = state(doc, sel);
      const pick = Math.floor(r() * 9);
      const t =
        pick === 0 ? insertText(s, ['x', 'yz', ' ', 'a\nb', '日本'][Math.floor(r() * 5)])
        : pick === 1 ? splitBlock(s)
        : pick === 2 ? deleteChar(s, -1)
        : pick === 3 ? deleteChar(s, 1)
        : pick === 4 ? deleteSelection(s)
        : pick === 5 ? toggleMark(s, marks[Math.floor(r() * marks.length)])
        : pick === 6 ? setBlockType(s, (['paragraph', 'heading1', 'heading2', 'todo', 'quote'] as const)[Math.floor(r() * 5)])
        : pick === 7 ? toggleTodo(s, doc.blocks.find((b) => b.type === 'todo')?.id ?? doc.blocks[0].id)
        : markdownShortcut(s);
      if (!t) continue;
      const after = applyOps(doc, t.ops);
      const back = applyOps(after, invertOps(t.ops));
      expect(back).toEqual(doc);
      doc = after;
      // Keep the document from growing without bound.
      if (doc.blocks.length > 30) doc = { blocks: doc.blocks.slice(0, 10) };
    }
  });
});
