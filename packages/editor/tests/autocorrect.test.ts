import { describe, expect, it } from 'vitest';
import { type Doc, caret, makeBlock, runsText } from '../src/model';
import { applyOps } from '../src/ops';
import { type EditorState, insertText, trackedInsertText } from '../src/commands';
import { type AutoCorrectOptions, autoCorrect } from '../src/autocorrect';

/** Types `text` a character at a time into an empty paragraph, correcting as Crumpet does. */
function type(text: string, opts: AutoCorrectOptions = {}, start = ''): string {
  const b = makeBlock('paragraph', start);
  let s: EditorState = { doc: { blocks: [b] }, selection: caret({ block: b.id, offset: start.length }), storedMarks: null };
  const apply = (t: { ops: never[] | import('../src/ops').Op[]; selectionAfter: EditorState['selection'] }) => {
    s = { ...s, doc: applyOps(s.doc, t.ops), selection: t.selectionAfter };
  };
  for (const ch of text) {
    apply(insertText(s, ch));
    const fix = autoCorrect(s, ch, opts);
    if (fix) apply(fix);
  }
  return runsText(s.doc.blocks[0].runs);
}

describe('autocorrect', () => {
  it('curls quotes', () => {
    expect(type('She said "hello" and it\'s fine')).toBe('She said “hello” and it’s fine');
    expect(type("'Yes,' he said")).toBe('‘Yes,’ he said');
    expect(type('("quoted")')).toBe('(“quoted”)');
  });

  it('makes dashes', () => {
    expect(type('Wait--no')).toBe('Wait—no');
    expect(type('pages 1 - 5')).toBe('Pages 1 – 5');
    expect(type('this -- that')).toBe('This – that');
    expect(type('--- ', {}, '')).toBe('--- ');
  });

  it('turns symbols', () => {
    expect(type('Wait... then')).toBe('Wait… then');
    expect(type('Acme (c) 2026 (tm)')).toBe('Acme © 2026 ™');
    expect(type('A -> B => C <- D')).toBe('A → B ⇒ C ← D');
  });

  it('puts typos right, keeping capitals', () => {
    expect(type('I saw teh dog adn cat.')).toBe('I saw the dog and cat.');
    expect(type('Teh end')).toBe('The end');
    expect(type('one. teh next')).toBe('One. The next');
    expect(type('I dont know')).toBe('I don’t know');
    expect(type('my frend.', { words: { frend: 'friend' } })).toBe('My friend.');
  });

  it('capitalises sentences and I', () => {
    expect(type('hello there. how are you? fine! i think so')).toBe('Hello there. How are you? Fine! I think so');
    expect(type('it was e.g. this and J. smith')).toBe('It was e.g. this and J. smith');
    expect(type('said i.e. that')).toBe('Said i.e. that');
    expect(type('"hello," she said')).toBe('“Hello,” she said');
  });

  it('each correction can be turned off', () => {
    const off = { quotes: false, dashes: false, symbols: false, typos: false, capitals: false };
    expect(type('teh "x"--y... (c) i', off)).toBe('teh "x"--y... (c) i');
  });

  it('only corrects text just added while tracking changes', () => {
    const b = makeBlock('paragraph', 'teh');
    let s: EditorState = { doc: { blocks: [b] } as Doc, selection: caret({ block: b.id, offset: 3 }), storedMarks: null };
    const t = trackedInsertText(s, ' ', 'Ann');
    s = { ...s, doc: applyOps(s.doc, t.ops), selection: t.selectionAfter };
    expect(autoCorrect(s, ' ', {}, true)).toBeNull();
  });
});
