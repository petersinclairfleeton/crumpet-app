import { describe, expect, it } from 'vitest';
import { type Doc, type Mark, type Selection, caret, makeBlock, runsText } from '../../src/model';
import { applyOps } from '../../src/ops';
import { History } from '../../src/history';
import {
  type EditorState,
  type Transaction,
  deleteChar,
  deleteSelection,
  indent,
  insertText,
  setLink,
  joinBackward,
  setBlockType,
  splitBlock,
  toggleMark,
} from '../../src/commands';
import { SyncClient, SyncServer } from '../../src/sync/collab';
import { mapSelectionThrough } from '../../src/sync/transform';

function texts(doc: Doc): string[] {
  return doc.blocks.map((b) => runsText(b.runs));
}

function at(c: SyncClient, blockIndex: number, offset: number, focusBlock = blockIndex, focusOffset = offset): Selection {
  return { anchor: { block: c.doc.blocks[blockIndex].id, offset }, focus: { block: c.doc.blocks[focusBlock].id, offset: focusOffset } };
}

function run(c: SyncClient, sel: Selection, make: (s: EditorState) => Transaction | null): void {
  const t = make({ doc: c.doc, selection: sel, storedMarks: null });
  if (t && t.ops.length) c.local(t.ops, applyOps(c.doc, t.ops));
}

function setup(...blocks: Doc['blocks']) {
  const server = new SyncServer({ blocks });
  const a = new SyncClient('mac', server);
  const b = new SyncClient('phone', server);
  return { server, a, b };
}

function settle(server: SyncServer, ...clients: SyncClient[]) {
  for (let round = 0; round < 5; round++) for (const c of clients) c.sync();
  for (const c of clients) {
    expect(c.pending).toEqual([]);
    expect(c.doc).toEqual(server.doc);
  }
}

describe('sync scenarios', () => {
  it('keeps both devices’ typing in the same paragraph', () => {
    const { server, a, b } = setup(makeBlock('paragraph', 'middle'));
    run(a, at(a, 0, 0), (s) => insertText(s, 'start '));
    run(b, at(b, 0, 6), (s) => insertText(s, ' end'));
    settle(server, a, b);
    expect(texts(server.doc)).toEqual(['start middle end']);
  });

  it('orders simultaneous typing at the same spot the same way everywhere', () => {
    const { server, a, b } = setup(makeBlock('paragraph', 'ab'));
    run(a, at(a, 0, 1), (s) => insertText(s, 'X'));
    run(b, at(b, 0, 1), (s) => insertText(s, 'Y'));
    a.sync(); // the Mac reaches the server first
    settle(server, a, b);
    expect(texts(server.doc)).toEqual(['aXYb']);
  });

  it('applies formatting to both halves when the other device split the paragraph', () => {
    const { server, a, b } = setup(makeBlock('paragraph', 'hello world'));
    run(a, at(a, 0, 5), splitBlock);
    run(b, at(b, 0, 0, 0, 11), (s) => toggleMark(s, 'bold'));
    settle(server, a, b);
    expect(server.doc.blocks.map((x) => x.runs)).toEqual([[{ text: 'hello', marks: ['bold'] }], [{ text: ' world', marks: ['bold'] }]]);
  });

  it('keeps text typed into a paragraph the other device merged away', () => {
    const { server, a, b } = setup(makeBlock('paragraph', 'one'), makeBlock('paragraph', 'two'));
    run(a, at(a, 1, 0), joinBackward);
    run(b, at(b, 1, 3), (s) => insertText(s, '!'));
    settle(server, a, b);
    expect(texts(server.doc)).toEqual(['onetwo!']);
  });

  it('keeps bold on text typed offline when the other device inserts before it', () => {
    const { server, a, b } = setup(makeBlock('paragraph', 'note'));
    a.online = false;
    run(a, at(a, 0, 4), (s) => insertText(s, ' draft'));
    run(a, at(a, 0, 5, 0, 10), (s) => toggleMark(s, 'bold'));
    run(b, at(b, 0, 0), (s) => insertText(s, 'My '));
    b.sync();
    a.online = true;
    settle(server, a, b);
    expect(server.doc.blocks[0].runs).toEqual([
      { text: 'My note ', marks: [] },
      { text: 'draft', marks: ['bold'] },
    ]);
  });

  it('does not delete text the other device added inside a deleted range’s edges', () => {
    const { server, a, b } = setup(makeBlock('paragraph', 'keep [cut] keep'));
    run(a, at(a, 0, 5, 0, 10), deleteSelection);
    run(b, at(b, 0, 5), (s) => insertText(s, 'new '));
    settle(server, a, b);
    expect(texts(server.doc)).toEqual(['keep new  keep']);
  });

  it('turns a block into a heading even after the other device edited its text', () => {
    const { server, a, b } = setup(makeBlock('paragraph', 'Title'));
    run(a, at(a, 0, 0), (s) => setBlockType(s, 'heading1'));
    run(b, at(b, 0, 5), (s) => insertText(s, ' draft'));
    settle(server, a, b);
    expect(server.doc.blocks.map((x) => [x.type, runsText(x.runs)])).toEqual([['heading1', 'Title draft']]);
  });
});

// ---- Randomised: three devices, random edits, random connectivity ----

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe('sync convergence (randomised)', () => {
  for (const seed of Array.from({ length: 40 }, (_, i) => i + 1)) {
    it(`all devices end up identical, with undo mixed in (seed ${seed})`, () => {
      const r = rng(seed);
      const server = new SyncServer({ blocks: [makeBlock('paragraph', 'The quick brown fox'), makeBlock('todo', 'jumps over'), makeBlock('heading1', 'the lazy dog')] });
      const clients = ['mac', 'ipad', 'phone'].map((id) => new SyncClient(id, server));
      const histories = new Map(clients.map((c) => [c, new History()]));
      const marks: Mark[] = ['bold', 'italic', 'code'];
      const syncOne = (c: SyncClient) => {
        const steps = c.sync();
        if (steps) histories.get(c)!.external(steps);
      };
      for (let step = 0; step < 600; step++) {
        const c = clients[Math.floor(r() * clients.length)];
        const h = histories.get(c)!;
        const roll = r();
        if (roll < 0.1) {
          c.online = !c.online;
        } else if (roll < 0.3) {
          syncOne(c);
        } else if (roll < 0.38) {
          // Undo this device's own last edit, rebased over whatever arrived since.
          if (h.canUndo) {
            const u = h.undo(c.doc)!;
            c.local(u.ops, applyOps(c.doc, u.ops));
          }
        } else {
          const doc = c.doc;
          const pick = () => {
            const b = doc.blocks[Math.floor(r() * doc.blocks.length)];
            return { block: b.id, offset: Math.floor(r() * (runsText(b.runs).length + 1)) };
          };
          const sel: Selection = r() < 0.6 ? caret(pick()) : { anchor: pick(), focus: pick() };
          const s: EditorState = { doc, selection: sel, storedMarks: null };
          const kind = Math.floor(r() * 9);
          const t =
            kind === 8 ? setLink(s, r() < 0.7 ? 'https://example.com/' + Math.floor(r() * 3) : null) :
            kind === 7 ? indent(s, r() < 0.7 ? 1 : -1) :
            kind === 0 ? insertText(s, ['x', 'hello ', '日本', ' '][Math.floor(r() * 4)])
            : kind === 1 ? splitBlock(s)
            : kind === 2 ? deleteChar(s, -1)
            : kind === 3 ? deleteChar(s, 1)
            : kind === 4 ? deleteSelection(s)
            : kind === 5 ? toggleMark(s, marks[Math.floor(r() * marks.length)])
            : setBlockType(s, (['paragraph', 'heading2', 'todo', 'bullet', 'numbered', 'quote'] as const)[Math.floor(r() * 6)]);
          if (t && t.ops.length) {
            const after = applyOps(doc, t.ops);
            c.local(t.ops, after);
            h.record(t, after, step * 1000);
          }
        }
        if (server.doc.blocks.length > 40) break;
      }
      for (const c of clients) c.online = true;
      settle(server, ...clients);
      expect(clients.every((c) => c.dropped === 0)).toBe(true);
    });
  }
});

describe('caret after a sync', () => {
  it('stays right after text typed offline when the other device inserts earlier in the line', () => {
    const { server, a, b } = setup(makeBlock('paragraph', 'note'));
    a.online = false;
    run(a, at(a, 0, 4), (s) => insertText(s, ' one'));
    run(a, at(a, 0, 8), (s) => insertText(s, ' two'));
    const caretBefore = at(a, 0, 12); // after "note one two"
    run(b, at(b, 0, 0), (s) => insertText(s, 'My '));
    b.sync();
    a.online = true;
    const caret = mapSelectionThrough(caretBefore, a.sync()!, a.doc);
    expect(texts(a.doc)).toEqual(['My note one two']);
    expect(caret.focus.offset).toBe('My note one two'.length);
    settle(server, a, b);
  });

  it('stays before text the other device inserts exactly at the caret', () => {
    const { server, a, b } = setup(makeBlock('paragraph', 'ab'));
    const caretBefore = at(a, 0, 1);
    run(b, at(b, 0, 1), (s) => insertText(s, 'XYZ'));
    b.sync();
    const caret = mapSelectionThrough(caretBefore, a.sync()!, a.doc);
    expect(texts(a.doc)).toEqual(['aXYZb']);
    expect(caret.focus.offset).toBe(1);
    settle(server, a, b);
  });
});
