import { describe, expect, it } from 'vitest';
import { type Doc, type Mark, type Selection, caret, makeBlock, runsText } from '../src/model';
import { applyOps, invertOps } from '../src/ops';
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
  indent,
  setLink,
  autoLink,
  pasteLink,
  currentLink,
  setBlockStyle,
  setAlign,
  insertMedia,
  joinForward,
  toggleFold,
  foldedUnder,
} from '../src/commands';
import { insertFootnote, setFootnote } from '../src/commands';
import { footnotes } from '../src/model';
import { diffDocs } from '../src/diff';
import { normalizeLink } from '../src/model';
import { History } from '../src/history';

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

describe('lists', () => {
  const apply = (s: EditorState, t: { ops: Parameters<typeof applyOps>[1]; selectionAfter: Selection } | null): EditorState =>
    t ? { ...s, doc: applyOps(s.doc, t.ops), selection: t.selectionAfter } : s;

  it('turns "- ", "* " and "1. " into bulleted and numbered lists', () => {
    for (const [prefix, type] of [['- ', 'bullet'], ['* ', 'bullet'], ['1. ', 'numbered']] as const) {
      const doc: Doc = { blocks: [makeBlock('paragraph', prefix)] };
      const t = markdownShortcut(state(doc, caret({ block: doc.blocks[0].id, offset: prefix.length })))!;
      expect(applyOps(doc, t.ops).blocks[0]).toMatchObject({ type, runs: [] });
    }
  });

  it('nests with Tab, continues at the same level on Enter, and steps out on Enter in an empty item', () => {
    const doc: Doc = { blocks: [makeBlock('bullet', 'one')] };
    const id = doc.blocks[0].id;
    let s = state(doc, caret({ block: id, offset: 3 }));
    s = apply(s, splitBlock(s));
    s = apply(s, indent(s, 1));
    s = apply(s, insertText(s, 'two'));
    s = apply(s, splitBlock(s));
    expect(s.doc.blocks.map((b) => [b.type, b.indent ?? 0, runsText(b.runs)])).toEqual([
      ['bullet', 0, 'one'],
      ['bullet', 1, 'two'],
      ['bullet', 1, ''],
    ]);
    s = apply(s, splitBlock(s)); // empty nested item: out one level
    expect(s.doc.blocks[2]).toMatchObject({ type: 'bullet' });
    expect(s.doc.blocks[2].indent ?? 0).toBe(0);
    s = apply(s, splitBlock(s)); // empty top-level item: out of the list
    expect(s.doc.blocks[2].type).toBe('paragraph');
  });

  it('keeps nesting when switching between list types, and ignores Tab outside lists', () => {
    const doc: Doc = { blocks: [makeBlock('bullet', 'a', [], { indent: 2 }), makeBlock('paragraph', 'b')] };
    const s = state(doc, caret({ block: doc.blocks[0].id, offset: 0 }));
    const t = setBlockType(s, 'numbered');
    expect(applyOps(doc, t.ops).blocks[0]).toMatchObject({ type: 'numbered', indent: 2 });
    expect(indent(state(doc, caret({ block: doc.blocks[1].id, offset: 0 })), 1)).toBeNull();
  });

  it('never nests deeper than the maximum or shallower than zero', () => {
    const doc: Doc = { blocks: [makeBlock('todo', 'x', [], { indent: 6 })] };
    const s = state(doc, caret({ block: doc.blocks[0].id, offset: 0 }));
    expect(indent(s, 1)!.ops).toEqual([]);
    const flat: Doc = { blocks: [makeBlock('todo', 'x')] };
    expect(indent(state(flat, caret({ block: flat.blocks[0].id, offset: 0 })), -1)!.ops).toEqual([]);
  });
});

describe('links', () => {
  it('only accepts http(s) and mailto links, adding https:// to bare addresses', () => {
    expect(normalizeLink('example.com')).toBe('https://example.com/');
    expect(normalizeLink('www.example.com/a?b=1')).toBe('https://www.example.com/a?b=1');
    expect(normalizeLink('http://x.org')).toBe('http://x.org/');
    expect(normalizeLink('mailto:me@example.com')).toBe('mailto:me@example.com');
    expect(normalizeLink('javascript:alert(1)')).toBeNull();
    expect(normalizeLink('data:text/html,hi')).toBeNull();
    expect(normalizeLink('not a link')).toBeNull();
  });

  it('links a selection across two blocks and removes it again from the caret', () => {
    const doc: Doc = { blocks: [makeBlock('paragraph', 'one two'), makeBlock('paragraph', 'three')] };
    const [a, b] = doc.blocks;
    const t = setLink(state(doc, { anchor: { block: a.id, offset: 4 }, focus: { block: b.id, offset: 5 } }), 'https://x.org/')!;
    const linked = applyOps(doc, t.ops);
    expect(linked.blocks[0].runs).toEqual([{ text: 'one ', marks: [] }, { text: 'two', marks: [], link: 'https://x.org/' }]);
    expect(linked.blocks[1].runs).toEqual([{ text: 'three', marks: [], link: 'https://x.org/' }]);
    expect(currentLink(state(linked, caret({ block: a.id, offset: 5 })))).toBe('https://x.org/');
    const off = setLink(state(linked, caret({ block: a.id, offset: 5 })), null)!;
    expect(applyOps(linked, off.ops).blocks[0].runs).toEqual([{ text: 'one two', marks: [] }]);
  });

  it('keeps typing inside a link linked, but not typing at its end', () => {
    const doc: Doc = { blocks: [{ ...makeBlock('paragraph'), runs: [{ text: 'site', marks: [], link: 'https://x.org/' }] }] };
    const id = doc.blocks[0].id;
    const inside = applyOps(doc, insertText(state(doc, caret({ block: id, offset: 2 })), 'X').ops);
    expect(inside.blocks[0].runs).toEqual([{ text: 'siXte', marks: [], link: 'https://x.org/' }]);
    const after = applyOps(doc, insertText(state(doc, caret({ block: id, offset: 4 })), '!').ops);
    expect(after.blocks[0].runs).toEqual([{ text: 'site', marks: [], link: 'https://x.org/' }, { text: '!', marks: [] }]);
  });

  it('turns a typed web address into a link after the space, leaving trailing punctuation out', () => {
    const doc: Doc = { blocks: [makeBlock('paragraph', 'see www.example.com. ')] };
    const id = doc.blocks[0].id;
    const t = autoLink(state(doc, caret({ block: id, offset: 21 })))!;
    expect(applyOps(doc, t.ops).blocks[0].runs).toEqual([
      { text: 'see ', marks: [] },
      { text: 'www.example.com', marks: [], link: 'https://www.example.com/' },
      { text: '. ', marks: [] },
    ]);
  });

  it('pasting a web address links the selection, or inserts it as a link', () => {
    const doc: Doc = { blocks: [makeBlock('paragraph', 'read this')] };
    const id = doc.blocks[0].id;
    const sel = pasteLink(state(doc, { anchor: { block: id, offset: 5 }, focus: { block: id, offset: 9 } }), 'https://x.org/a')!;
    expect(applyOps(doc, sel.ops).blocks[0].runs).toEqual([{ text: 'read ', marks: [] }, { text: 'this', marks: [], link: 'https://x.org/a' }]);
    const ins = pasteLink(state(doc, caret({ block: id, offset: 9 })), ' https://x.org/a ')!;
    expect(applyOps(doc, ins.ops).blocks[0].runs).toEqual([{ text: 'read this', marks: [] }, { text: 'https://x.org/a', marks: [], link: 'https://x.org/a' }]);
    expect(pasteLink(state(doc, caret({ block: id, offset: 0 })), 'just words')).toBeNull();
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
      const pick = Math.floor(r() * 11);
      const t =
        pick === 0 ? insertText(s, ['x', 'yz', ' ', 'a\nb', '日本'][Math.floor(r() * 5)])
        : pick === 1 ? splitBlock(s)
        : pick === 2 ? deleteChar(s, -1)
        : pick === 3 ? deleteChar(s, 1)
        : pick === 4 ? deleteSelection(s)
        : pick === 5 ? toggleMark(s, marks[Math.floor(r() * marks.length)])
        : pick === 6 ? setBlockType(s, (['paragraph', 'heading1', 'heading2', 'todo', 'bullet', 'numbered', 'quote'] as const)[Math.floor(r() * 7)])
        : pick === 9 ? indent(s, r() < 0.7 ? 1 : -1)
        : pick === 10 ? setLink(s, r() < 0.7 ? 'https://example.com/' + Math.floor(r() * 3) : null)
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

describe('styles and alignment', () => {
  const attrs = (d: Doc) => d.blocks.map((b) => [b.type, b.style, b.align].filter(Boolean).join(' '));

  it('applies a style and alignment to every selected block, and undoes exactly', () => {
    const doc: Doc = { blocks: [makeBlock('paragraph', 'One'), makeBlock('heading1', 'Two'), makeBlock('paragraph', 'Three')] };
    const sel = { anchor: { block: doc.blocks[0].id, offset: 1 }, focus: { block: doc.blocks[1].id, offset: 1 } };
    const t1 = setBlockStyle(state(doc, sel), 'paragraph', 'title');
    const d1 = applyOps(doc, t1.ops);
    expect(attrs(d1)).toEqual(['paragraph title', 'paragraph title', 'paragraph']);
    const t2 = setAlign(state(d1, sel), 'center');
    const d2 = applyOps(d1, t2.ops);
    expect(attrs(d2)).toEqual(['paragraph title center', 'paragraph title center', 'paragraph']);
    // A style for headings drops the paragraph style but keeps the alignment.
    const d3 = applyOps(d2, setBlockStyle(state(d2, sel), 'heading3').ops);
    expect(attrs(d3)).toEqual(['heading3 center', 'heading3 center', 'paragraph']);
    expect(attrs(applyOps(d3, invertOps([...t1.ops, ...t2.ops, ...setBlockStyle(state(d2, sel), 'heading3').ops])))).toEqual(attrs(doc));
  });

  it('Enter after a title or heading starts body text; body text and quotes carry on', () => {
    const enterAtEnd = (b: ReturnType<typeof makeBlock>) => {
      const doc: Doc = { blocks: [b] };
      return applyOps(doc, splitBlock(state(doc, caret({ block: b.id, offset: runsText(b.runs).length }))).ops).blocks[1];
    };
    expect(enterAtEnd(makeBlock('paragraph', 'T', [], { style: 'title', align: 'center' }))).toMatchObject({ type: 'paragraph' });
    expect(enterAtEnd(makeBlock('paragraph', 'T', [], { style: 'title', align: 'center' })).style).toBeUndefined();
    expect(enterAtEnd(makeBlock('heading3', 'H')).type).toBe('paragraph');
    expect(enterAtEnd(makeBlock('paragraph', 'Body', [], { style: 'nospacing', align: 'justify' }))).toMatchObject({ style: 'nospacing', align: 'justify' });
    expect(enterAtEnd(makeBlock('quote', 'Q', [], { style: 'intense' }))).toMatchObject({ type: 'quote', style: 'intense' });
    // Splitting in the middle keeps the style on both halves.
    const doc: Doc = { blocks: [makeBlock('paragraph', 'AB', [], { style: 'epigraph', align: 'right' })] };
    const after = applyOps(doc, splitBlock(state(doc, caret({ block: doc.blocks[0].id, offset: 1 }))).ops);
    expect(attrs(after)).toEqual(['paragraph epigraph right', 'paragraph epigraph right']);
  });

  it('### and #### make the smaller headings', () => {
    for (const [prefix, type] of [['###', 'heading3'], ['####', 'heading4']] as const) {
      const doc: Doc = { blocks: [makeBlock('paragraph', `${prefix} `)] };
      const t = markdownShortcut(state(doc, caret({ block: doc.blocks[0].id, offset: prefix.length + 1 })))!;
      expect(applyOps(doc, t.ops).blocks[0].type).toBe(type);
    }
  });
});

describe('pictures and files', () => {
  const run = (doc: Doc, t: { ops: Parameters<typeof applyOps>[1] } | null) => applyOps(doc, t!.ops);
  const kinds = (doc: Doc) => doc.blocks.map((b) => `${b.type}${b.src ? `:${b.src}` : ''}:${runsText(b.runs)}`);

  it('go in place of an empty line, or split the text at the caret, with somewhere to keep writing', () => {
    const empty: Doc = { blocks: [makeBlock('paragraph')] };
    let t = insertMedia(state(empty), 'image', 'Attachments/a-x.png');
    let after = run(empty, t);
    expect(kinds(after)).toEqual(['image:Attachments/a-x.png:', 'paragraph:']);
    expect(t.selectionAfter.focus.block).toBe(after.blocks[1].id);
    const text: Doc = { blocks: [makeBlock('paragraph', 'Before after')] };
    t = insertMedia(state(text, caret({ block: text.blocks[0].id, offset: 7 })), 'file', 'Attachments/b-y.pdf', 'y.pdf');
    after = run(text, t);
    expect(kinds(after)).toEqual(['paragraph:Before ', 'file:Attachments/b-y.pdf:y.pdf', 'paragraph:after']);
    // Undo puts it back as it was.
    expect(texts(applyOps(after, invertOps(t.ops)))).toEqual(['Before after']);
  });

  it('Enter after a caption starts a paragraph; Backspace at the start of a caption removes the picture but keeps the words', () => {
    const doc: Doc = { blocks: [makeBlock('image', 'Lamp', [], { src: 'Attachments/a-x.png' })] };
    const id = doc.blocks[0].id;
    let t = splitBlock(state(doc, caret({ block: id, offset: 4 })));
    expect(kinds(run(doc, t))).toEqual(['image:Attachments/a-x.png:Lamp', 'paragraph:']);
    t = splitBlock(state(doc, caret({ block: id, offset: 2 })));
    expect(kinds(run(doc, t))).toEqual(['image:Attachments/a-x.png:La', 'paragraph:mp']);
    t = joinBackward(state(doc, caret({ block: id, offset: 0 })))!;
    expect(kinds(run(doc, t))).toEqual(['paragraph:Lamp']);
  });

  it('text next to a picture is never pulled into its caption', () => {
    const doc: Doc = { blocks: [makeBlock('paragraph', 'Above'), makeBlock('image', '', [], { src: 'Attachments/a-x.png' }), makeBlock('paragraph', 'Below')] };
    const [above, pic, below] = doc.blocks.map((b) => b.id);
    let t = joinBackward(state(doc, caret({ block: below, offset: 0 })))!;
    expect(kinds(run(doc, t))).toEqual(kinds(doc));
    expect(t.selectionAfter.focus).toEqual({ block: pic, offset: 0 });
    t = joinForward(state(doc, caret({ block: above, offset: 5 })))!;
    expect(kinds(run(doc, t))).toEqual(kinds(doc));
    // Turning the lines into a list leaves the picture alone.
    t = setBlockType(state(doc, { anchor: { block: above, offset: 0 }, focus: { block: below, offset: 5 } }), 'bullet');
    expect(run(doc, t).blocks.map((b) => b.type)).toEqual(['bullet', 'image', 'bullet']);
  });
});

describe('fold-away sections', () => {
  it('fold a heading’s section up to the next heading of its level, and Enter opens it again', () => {
    const doc: Doc = { blocks: [makeBlock('heading2', 'Plans'), makeBlock('paragraph', 'one'), makeBlock('heading3', 'Sub'), makeBlock('paragraph', 'two'), makeBlock('heading2', 'Next'), makeBlock('paragraph', 'three')] };
    expect(foldedUnder(doc, 0).map((b) => runsText(b.runs))).toEqual(['one', 'Sub', 'two']);
    const [h] = doc.blocks;
    // The caret was inside the section: it moves up to the heading.
    const t = toggleFold(state(doc, caret({ block: doc.blocks[3].id, offset: 1 })), h.id);
    const folded = applyOps(doc, t.ops);
    expect(folded.blocks[0].folded).toBe(true);
    expect(t.selectionAfter.focus).toEqual({ block: h.id, offset: 5 });
    const opened = applyOps(folded, splitBlock(state(folded, caret({ block: h.id, offset: 5 }))).ops);
    expect(opened.blocks[0].folded).toBeUndefined();
    expect(texts(opened)).toEqual(['Plans', '', 'one', 'Sub', 'two', 'Next', 'three']);
  });
});

describe('footnotes', () => {
  it('go after the selection, change, come out, and undo', () => {
    const p = makeBlock('paragraph', 'Hello world');
    const s0 = state({ blocks: [p] }, { anchor: { block: p.id, offset: 0 }, focus: { block: p.id, offset: 5 } });
    const t1 = insertFootnote(s0, 'Greeting');
    const d1 = applyOps(s0.doc, t1.ops);
    expect(footnotes(d1)).toEqual([{ block: p.id, offset: 5, text: 'Greeting' }]);
    expect(t1.selectionAfter.focus.offset).toBe(6);
    const s1 = { ...s0, doc: d1, selection: t1.selectionAfter };
    const d2 = applyOps(d1, setFootnote(s1, { block: p.id, offset: 5 }, 'Hi').ops);
    expect(footnotes(d2)[0].text).toBe('Hi');
    const t3 = setFootnote({ ...s1, doc: d2 }, { block: p.id, offset: 5 }, null);
    const d3 = applyOps(d2, t3.ops);
    expect(footnotes(d3)).toEqual([]);
    expect(runsText(d3.blocks[0].runs)).toBe('Hello world');
    expect(t3.selectionAfter.focus.offset).toBe(5);
    expect(footnotes(applyOps(d3, invertOps(t3.ops)))[0].text).toBe('Hi');
  });

  it('a footnote changed elsewhere arrives as an edit', () => {
    const p = makeBlock('paragraph', 'Hello');
    const s0 = state({ blocks: [p] }, caret({ block: p.id, offset: 5 }));
    const d1 = applyOps(s0.doc, insertFootnote(s0, 'One').ops);
    const d2 = applyOps(d1, setFootnote({ ...s0, doc: d1 }, { block: p.id, offset: 5 }, 'Two').ops);
    expect(footnotes(diffDocs(d1, d2).doc)[0].text).toBe('Two');
  });
});
