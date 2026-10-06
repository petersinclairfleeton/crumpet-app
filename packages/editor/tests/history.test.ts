import { describe, expect, it } from 'vitest';
import { type Doc, type Mark, type Selection, caret, makeBlock, runsText } from '../src/model';
import { applyOps } from '../src/ops';
import { type EditorState, type Transaction, deleteChar, deleteSelection, indent, insertText, setBlockType, setLink, splitBlock, toggleMark } from '../src/commands';
import { History } from '../src/history';
import { SyncClient, SyncServer } from '../src/sync/collab';

/** How many random runs per test; raise with SEEDS=500 for a long soak. */
const SEEDS = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SEEDS ?? 30);

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const canon = (d: Doc) => JSON.stringify(d.blocks.map((b) => [b.id, b.type, !!b.checked, b.indent ?? 0, b.runs.map((r) => [r.text, [...r.marks], r.link ?? null])]));

function texts(doc: Doc): string[] {
  return doc.blocks.map((b) => runsText(b.runs));
}

function randomTx(doc: Doc, r: () => number, words: string[]): Transaction | null {
  const pick = () => {
    const b = doc.blocks[Math.floor(r() * doc.blocks.length)];
    return { block: b.id, offset: Math.floor(r() * (runsText(b.runs).length + 1)) };
  };
  const sel: Selection = r() < 0.6 ? caret(pick()) : { anchor: pick(), focus: pick() };
  const s: EditorState = { doc, selection: sel, storedMarks: null };
  const marks: Mark[] = ['bold', 'italic'];
  const k = Math.floor(r() * 8);
  return k === 0 ? insertText(s, words[Math.floor(r() * words.length)])
    : k === 1 ? splitBlock(s)
    : k === 2 ? deleteChar(s, -1)
    : k === 3 ? deleteSelection(s)
    : k === 4 ? toggleMark(s, marks[Math.floor(r() * 2)])
    : k === 6 ? indent(s, r() < 0.7 ? 1 : -1)
    : k === 7 ? setLink(s, r() < 0.7 ? 'https://example.com/' + Math.floor(r() * 3) : null)
    : setBlockType(s, (['paragraph', 'heading1', 'todo', 'bullet', 'numbered'] as const)[Math.floor(r() * 5)]);
}

describe('undo history', () => {
  it('each undo returns exactly to the state before that edit, and redo replays them all', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = rng(seed);
      let doc: Doc = { blocks: [makeBlock('paragraph', 'Some starting text'), makeBlock('todo', 'a task')] };
      const states = [doc];
      const h = new History();
      let now = 0;
      for (let i = 0; i < 60; i++) {
        const t = randomTx(doc, r, ['a', 'word ', '\n']);
        if (!t || !t.ops.length) continue;
        doc = applyOps(doc, t.ops);
        h.record(t, doc, (now += 5000)); // far apart, so every edit is its own undo step
        states.push(doc);
      }
      for (let k = states.length - 2; k >= 0; k--) {
        doc = applyOps(doc, h.undo(doc)!.ops);
        expect(canon(doc)).toBe(canon(states[k]));
      }
      expect(h.canUndo).toBe(false);
      while (h.canRedo) doc = applyOps(doc, h.redo(doc)!.ops);
      expect(canon(doc)).toBe(canon(states[states.length - 1]));
    }
  });

  it('undoing everything returns to the start when quick typing is merged into single steps', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = rng(seed + 1000);
      const start: Doc = { blocks: [makeBlock('paragraph', 'Some starting text'), makeBlock('todo', 'a task')] };
      let doc = start;
      const h = new History();
      let now = 0;
      for (let i = 0; i < 80; i++) {
        const t = randomTx(doc, r, ['a', 'word ', '\n']);
        if (!t || !t.ops.length) continue;
        doc = applyOps(doc, t.ops);
        h.record(t, doc, (now += r() < 0.5 ? 100 : 2000));
      }
      while (h.canUndo) doc = applyOps(doc, h.undo(doc)!.ops);
      expect(canon(doc)).toBe(canon(start));
    }
  });

  it('keeps mixed formatting when undoing bold over partly-bold text', () => {
    const doc0: Doc = { blocks: [{ ...makeBlock('paragraph'), runs: [{ text: 'ab', marks: ['bold'] }, { text: 'cd', marks: [] }] }] };
    const id = doc0.blocks[0].id;
    const h = new History();
    const t = toggleMark({ doc: doc0, selection: { anchor: { block: id, offset: 0 }, focus: { block: id, offset: 4 } }, storedMarks: null }, 'bold');
    const doc1 = applyOps(doc0, t.ops);
    h.record(t, doc1);
    expect(applyOps(doc1, h.undo(doc1)!.ops)).toEqual(doc0);
  });
});

describe('undo with another device editing', () => {
  it('removes only your own words, leaving the other device’s edits', () => {
    const server = new SyncServer({ blocks: [makeBlock('paragraph', 'Shared note.')] });
    const a = new SyncClient('mac', server);
    const b = new SyncClient('phone', server);
    const ha = new History();
    const edit = (c: SyncClient, h: History | null, sel: Selection, make: (s: EditorState) => Transaction) => {
      const t = make({ doc: c.doc, selection: sel, storedMarks: null });
      const after = applyOps(c.doc, t.ops);
      c.local(t.ops, after);
      h?.record(t, after, 0);
    };
    const id = a.doc.blocks[0].id;
    edit(a, ha, caret({ block: id, offset: 12 }), (s) => insertText(s, ' Mac was here.'));
    edit(b, null, caret({ block: id, offset: 0 }), (s) => insertText(s, 'Phone first. '));
    a.sync();
    b.sync();
    const steps = a.sync();
    if (steps) ha.external(steps);
    expect(texts(a.doc)).toEqual(['Phone first. Shared note. Mac was here.']);

    const u = ha.undo(a.doc)!;
    const undone = applyOps(a.doc, u.ops);
    expect(texts(undone)).toEqual(['Phone first. Shared note.']);
    a.local(u.ops, undone);
    a.sync();
    b.sync();
    expect(texts(b.doc)).toEqual(['Phone first. Shared note.']);
  });

  it('undoes all your edits after random concurrent editing, keeping the other device’s words', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = rng(seed * 7);
      const server = new SyncServer({ blocks: [makeBlock('paragraph', 'Start'), makeBlock('paragraph', 'Middle'), makeBlock('paragraph', 'End')] });
      const a = new SyncClient('mac', server);
      const b = new SyncClient('phone', server);
      const ha = new History();
      for (let i = 0; i < 40; i++) {
        const mine = r() < 0.5;
        const c = mine ? a : b;
        // Only inserts, so it's clear afterwards whose words should remain.
        const doc = c.doc;
        const blk = doc.blocks[Math.floor(r() * doc.blocks.length)];
        const sel = caret({ block: blk.id, offset: Math.floor(r() * (runsText(blk.runs).length + 1)) });
        const t = insertText({ doc, selection: sel, storedMarks: null }, mine ? 'A' : 'b');
        const after = applyOps(doc, t.ops);
        c.local(t.ops, after);
        if (mine) ha.record(t, after, i * 1000);
        if (r() < 0.3) {
          const steps = a.sync();
          if (steps) ha.external(steps);
        }
        if (r() < 0.3) b.sync();
      }
      // b's words, as b sees them, before a's undos reach it.
      for (let i = 0; i < 3; i++) {
        const steps = a.sync();
        if (steps) ha.external(steps);
        b.sync();
      }
      while (ha.canUndo) {
        const u = ha.undo(a.doc)!;
        a.local(u.ops, applyOps(a.doc, u.ops));
      }
      const all = texts(a.doc).join('|');
      expect(all.includes('A')).toBe(false);
      expect((all.match(/b/g) ?? []).length).toBe((texts(b.doc).join('|').match(/b/g) ?? []).length);
    }
  });
});
