// Characters' ties to each other (parent, partner, sibling, friend, rival...)
// and a family tree laid out from them: generations from the parent ties,
// partners side by side, children under their parents.

/** A tie from one character to another, kept on the first (and read from either side). */
export interface Tie {
  to: string;
  kind: TieKind;
  /** In your own words, for "other" (or to say more: "estranged", "since school"). */
  note?: string;
}

export type TieKind = 'parent' | 'partner' | 'sibling' | 'friend' | 'rival' | 'mentor' | 'colleague' | 'other';

/** Each kind as it reads from the character it's kept on, and from the other side. */
export const TIE_KINDS: { kind: TieKind; from: string; back: string }[] = [
  { kind: 'parent', from: 'Parent of', back: 'Child of' },
  { kind: 'partner', from: 'Partner of', back: 'Partner of' },
  { kind: 'sibling', from: 'Sibling of', back: 'Sibling of' },
  { kind: 'friend', from: 'Friend of', back: 'Friend of' },
  { kind: 'rival', from: 'Rival of', back: 'Rival of' },
  { kind: 'mentor', from: 'Mentor of', back: 'Student of' },
  { kind: 'colleague', from: 'Works with', back: 'Works with' },
  { kind: 'other', from: 'Linked to', back: 'Linked to' },
];

/** The kinds that make a family (and so the tree). */
export const FAMILY: TieKind[] = ['parent', 'partner', 'sibling'];

interface Person {
  id: string;
  name: string;
  ties?: Tie[];
}

/** Every tie a character has, either way round: who, and how it reads from this character ("Child of"). */
export function tiesOf(id: string, people: Person[]): { other: string; label: string; kind: TieKind; note?: string; owner: string; index: number }[] {
  const out: { other: string; label: string; kind: TieKind; note?: string; owner: string; index: number }[] = [];
  for (const p of people) {
    (p.ties ?? []).forEach((t, index) => {
      const k = TIE_KINDS.find((x) => x.kind === t.kind) ?? TIE_KINDS[TIE_KINDS.length - 1];
      if (p.id === id) out.push({ other: t.to, label: t.kind === 'other' && t.note ? t.note : k.from, kind: t.kind, note: t.note, owner: p.id, index });
      else if (t.to === id) out.push({ other: p.id, label: t.kind === 'other' && t.note ? t.note : k.back, kind: t.kind, note: t.note, owner: p.id, index });
    });
  }
  return out;
}

/** Parents of each character, and partners (both ways), from the ties; siblings share their parents' place. */
function familyLinks(people: Person[]) {
  const ids = new Set(people.map((p) => p.id));
  const parents = new Map<string, Set<string>>();
  const partners = new Map<string, Set<string>>();
  const siblings = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, a: string, b: string) => (m.get(a) ?? m.set(a, new Set()).get(a)!).add(b);
  for (const p of people) {
    for (const t of p.ties ?? []) {
      if (!ids.has(t.to) || t.to === p.id) continue;
      if (t.kind === 'parent') add(parents, t.to, p.id);
      else if (t.kind === 'partner') (add(partners, p.id, t.to), add(partners, t.to, p.id));
      else if (t.kind === 'sibling') (add(siblings, p.id, t.to), add(siblings, t.to, p.id));
    }
  }
  return { parents, partners, siblings };
}

export interface TreeNode {
  id: string;
  name: string;
  gen: number;
  x: number;
}

export interface FamilyTree {
  nodes: TreeNode[];
  /** Partners (side by side). */
  couples: [string, string][];
  /** A child and its parents (one or two). */
  births: { child: string; parents: string[] }[];
  /** Siblings with no parents in the book: a bracket over them. */
  siblings: [string, string][];
  /** Rows, from the oldest generation down. */
  gens: number;
}

/**
 * The family tree of the characters with family ties (the others are left out): each a generation (a row)
 * below its parents, partners in the same row, siblings too; placed left to right so children sit under
 * their parents and partners next to each other.
 */
export function familyTree(people: Person[]): FamilyTree {
  const { parents, partners, siblings } = familyLinks(people);
  const inFamily = people.filter((p) => parents.has(p.id) || partners.has(p.id) || siblings.has(p.id) || [...parents.values()].some((s) => s.has(p.id)));
  const ids = inFamily.map((p) => p.id);
  // Generations: below every parent; level with partners and siblings (repeated until settled).
  const gen = new Map(ids.map((id) => [id, 0]));
  for (let round = 0; round < ids.length * 2 + 2; round++) {
    let moved = false;
    for (const id of ids) {
      let g = gen.get(id)!;
      for (const p of parents.get(id) ?? []) g = Math.max(g, gen.get(p)! + 1);
      for (const q of [...(partners.get(id) ?? []), ...(siblings.get(id) ?? [])]) g = Math.max(g, gen.get(q)!);
      if (g !== gen.get(id)) {
        gen.set(id, g);
        moved = true;
      }
    }
    if (!moved) break;
  }
  const gens = ids.length ? Math.max(...gen.values()) + 1 : 0;
  // Left to right, a row at a time: children in their parents' order; partners next to each other.
  const x = new Map<string, number>();
  const order = new Map(ids.map((id, i) => [id, i]));
  for (let g = 0; g < gens; g++) {
    const row = ids.filter((id) => gen.get(id) === g);
    const want = (id: string) => {
      const ps = [...(parents.get(id) ?? [])].filter((p) => x.has(p));
      return ps.length ? ps.reduce((n, p) => n + x.get(p)!, 0) / ps.length : (order.get(id)! + 0.5) * 1e-3;
    };
    row.sort((a, b) => want(a) - want(b) || order.get(a)! - order.get(b)!);
    // Pull partners together (the one with parents in the book keeps its place).
    const placed: string[] = [];
    for (const id of row) {
      if (placed.includes(id)) continue;
      placed.push(id);
      for (const q of partners.get(id) ?? []) if (row.includes(q) && !placed.includes(q)) placed.push(q);
    }
    // Each where it wants to be, at least one apart from the one before.
    let last = -Infinity;
    for (const id of placed) {
      const ps = [...(parents.get(id) ?? [])].filter((p) => x.has(p));
      const next = Number.isFinite(last) ? last + 1 : 0;
      const target = ps.length ? ps.reduce((n, p) => n + x.get(p)!, 0) / ps.length : next;
      const at = Math.max(next, target);
      x.set(id, at);
      last = at;
    }
  }
  // Start at 0.
  const min = Math.min(0, ...x.values());
  const nodes = inFamily.map((p) => ({ id: p.id, name: p.name, gen: gen.get(p.id)!, x: x.get(p.id)! - min }));
  const couples: [string, string][] = [];
  for (const [a, set] of partners) for (const b of set) if (a < b) couples.push([a, b]);
  const births = [...parents].map(([child, ps]) => ({ child, parents: [...ps] }));
  const sibs: [string, string][] = [];
  for (const [a, set] of siblings) for (const b of set) if (a < b && !parents.has(a) && !parents.has(b)) sibs.push([a, b]);
  return { nodes, couples, births, siblings: sibs, gens };
}

/** Ties from a project.json: only well-formed ones. */
export function cleanTies(raw: unknown): Tie[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((t) => {
    const x = t as Partial<Tie> | null;
    if (!x || typeof x.to !== 'string' || !TIE_KINDS.some((k) => k.kind === x.kind)) return [];
    return [{ to: x.to, kind: x.kind as TieKind, ...(typeof x.note === 'string' && x.note ? { note: x.note } : {}) }];
  });
}
