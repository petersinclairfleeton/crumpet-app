import { describe, expect, it } from 'vitest';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { buildGraph, step } from '../../src/data/graph';
import type { Note } from '../../src/data/types';

const note = (id: string, title: string, body: string) => ({ id, title, doc: fromMarkdown(body), trashedAt: null, projectId: null, notebookId: null }) as unknown as Note;

describe('graph view', () => {
  const notes = [note('a', 'Lamp', 'See [[Keeper]] and [[Sea]].'), note('b', 'Keeper', 'Back to [[Lamp]].'), note('c', 'Sea', 'Waves.'), note('d', 'Alone', 'No links.'), note('e', 'Far', 'Links [[Sea]].')];

  it('has a dot per note and a line per pair of linked notes', () => {
    const g = buildGraph(notes);
    expect(g.nodes.map((n) => n.title)).toEqual(['Lamp', 'Keeper', 'Sea', 'Alone', 'Far']);
    expect(g.edges).toHaveLength(3);
    expect(g.nodes.find((n) => n.title === 'Lamp')!.degree).toBe(2);
    expect(buildGraph(notes, { orphans: false }).nodes.map((n) => n.title)).not.toContain('Alone');
  });

  it('shows the notes near one note (the local graph)', () => {
    expect(buildGraph(notes, { around: 'b', depth: 1 }).nodes.map((n) => n.title)).toEqual(['Lamp', 'Keeper']);
    expect(buildGraph(notes, { around: 'b', depth: 2 }).nodes.map((n) => n.title)).toEqual(['Lamp', 'Keeper', 'Sea']);
  });

  it('settles: linked notes end up nearer each other than unlinked ones', () => {
    const g = buildGraph(notes);
    for (let i = 0; i < 400; i++) step(g);
    expect(step(g)).toBeLessThan(0.5);
    const at = (t: string) => g.nodes.find((n) => n.title === t)!;
    const dist = (a: string, b: string) => Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y);
    expect(dist('Lamp', 'Keeper')).toBeLessThan(dist('Keeper', 'Far'));
  });
});
