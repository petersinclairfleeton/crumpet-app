import { describe, expect, it } from 'vitest';
import { familyTree, tiesOf } from '../../src/data/family';

// Three generations: Mara and Ewan, their children Rose and Tam (Tam with a partner, Ida), and Tam and Ida's son Finn.
const people = [
  { id: 'mara', name: 'Mara', ties: [{ to: 'ewan', kind: 'partner' as const }, { to: 'rose', kind: 'parent' as const }, { to: 'tam', kind: 'parent' as const }] },
  { id: 'ewan', name: 'Ewan', ties: [{ to: 'rose', kind: 'parent' as const }, { to: 'tam', kind: 'parent' as const }] },
  { id: 'rose', name: 'Rose', ties: [{ to: 'keeper', kind: 'mentor' as const }] },
  { id: 'tam', name: 'Tam', ties: [{ to: 'ida', kind: 'partner' as const }] },
  { id: 'ida', name: 'Ida', ties: [{ to: 'finn', kind: 'parent' as const }, { to: 'rose', kind: 'other' as const, note: 'Old rival of' }] },
  { id: 'finn', name: 'Finn', ties: [] },
  { id: 'keeper', name: 'The keeper', ties: [] },
];

describe('ties and family trees', () => {
  it('read a tie from either side', () => {
    expect(tiesOf('rose', people).map((t) => `${t.label} ${t.other}`)).toEqual(['Child of mara', 'Child of ewan', 'Mentor of keeper', 'Old rival of ida']);
    expect(tiesOf('keeper', people).map((t) => `${t.label} ${t.other}`)).toEqual(['Student of rose']);
    expect(tiesOf('tam', people).map((t) => `${t.label} ${t.other}`)).toEqual(['Child of mara', 'Child of ewan', 'Partner of ida']);
  });

  it('lays out generations: partners side by side, children under their parents; the keeper (no family) left out', () => {
    const tree = familyTree(people);
    const at = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
    expect(tree.gens).toBe(3);
    expect(Object.keys(at).sort()).toEqual(['ewan', 'finn', 'ida', 'mara', 'rose', 'tam']);
    expect([at.mara.gen, at.ewan.gen, at.rose.gen, at.tam.gen, at.ida.gen, at.finn.gen]).toEqual([0, 0, 1, 1, 1, 2]);
    expect(Math.abs(at.mara.x - at.ewan.x)).toBe(1);
    // Ida next to Tam; Finn under Ida (his one parent in the book).
    expect(Math.abs(at.tam.x - at.ida.x)).toBe(1);
    expect(at.finn.x).toBe(at.ida.x);
    // Nobody shares a place in a row.
    for (let g = 0; g < tree.gens; g++) {
      const xs = tree.nodes.filter((n) => n.gen === g).map((n) => n.x);
      expect(new Set(xs).size).toBe(xs.length);
    }
    expect(tree.couples).toEqual([['ewan', 'mara'], ['ida', 'tam']]);
    expect(tree.births).toContainEqual({ child: 'finn', parents: ['ida'] });
  });

  it('a pair of siblings with no parents in the book', () => {
    const tree = familyTree([
      { id: 'a', name: 'A', ties: [{ to: 'b', kind: 'sibling' }] },
      { id: 'b', name: 'B' },
    ]);
    expect(tree.nodes.map((n) => [n.id, n.gen, n.x])).toEqual([
      ['a', 0, 0],
      ['b', 0, 1],
    ]);
    expect(tree.siblings).toEqual([['a', 'b']]);
  });
});
