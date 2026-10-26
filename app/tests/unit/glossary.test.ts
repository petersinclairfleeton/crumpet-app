import { describe, expect, it } from 'vitest';
import { runsText } from '@crumpet/editor/model';
import { castMatcher, findMentions } from '../../src/data/cast';
import { editDistance, glossaryBlock, glossaryDoc, glossaryTerms, nearNames } from '../../src/data/glossary';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import type { CastMember } from '../../src/data/types';
import { bookParts } from '../../src/data/wordfiles';

const card = (name: string, kind: CastMember['kind'], description = '', fields: { label: string; value: string }[] = [], aliases: string[] = []): CastMember => ({ id: name, name, kind, description, aliases, fields }) as CastMember;

describe('glossary', () => {
  const cast = [
    card('Mara Ashford', 'character'),
    card('wyrdlight', 'term', 'The glow over the reef before a storm.', [{ label: 'Pronunciation', value: 'WEIRD-light' }]),
    card('Elvarin', 'term', 'The old tongue of the coast.', [
      { label: 'Pronunciation', value: 'el-VAR-in' },
      { label: 'Kind of word', value: 'noun' },
    ]),
    card('Keeper', 'term'),
  ];

  it('lists the words and terms alphabetically, each with how it’s said, what kind of word, and what it means', () => {
    expect(glossaryTerms(cast).map((m) => m.name)).toEqual(['Elvarin', 'Keeper', 'wyrdlight']);
    const [elvarin, keeper, wyrd] = glossaryDoc(cast).blocks;
    expect(runsText(elvarin.runs)).toBe('Elvarin (el-VAR-in) noun. The old tongue of the coast.');
    expect(elvarin.runs[0]).toMatchObject({ text: 'Elvarin', marks: ['bold'] });
    expect(elvarin.runs.find((r) => r.text === ' noun')?.marks).toEqual(['italic']);
    expect(runsText(keeper.runs)).toBe('Keeper');
    expect(runsText(wyrd.runs)).toBe('wyrdlight (WEIRD-light). The glow over the reef before a storm.');
    expect(runsText(glossaryBlock(card('Tide-reader', 'term', 'One who reads the tides.')).runs)).toBe('Tide-reader: One who reads the tides.');
  });

  it('finds the name or term a misspelt word is close to, closest first, written as the word was', () => {
    expect(nearNames('Elvaryn', cast)).toEqual(['Elvarin']);
    expect(nearNames('Ashfrod', cast)).toEqual(['Ashford']);
    expect(nearNames('wyrdligt', cast)).toEqual(['wyrdlight']);
    expect(nearNames('Wyrdlihgt', cast)).toEqual(['Wyrdlight']);
    // Too far, too short, or already right.
    expect(nearNames('Elephant', cast)).toEqual([]);
    expect(nearNames('Mra', cast)).toEqual([]);
    expect(nearNames('Elvarin', cast)).toEqual([]);
    expect(editDistance('abcd', 'abdc')).toBe(1);
    expect(editDistance('kitten', 'sitting', 2)).toBe(3);
  });

  it('spots a word written in small letters on its card, as written, but still not a Rose in every rose', () => {
    const matcher = castMatcher([card('wyrdlight', 'term'), card('Rose', 'character')]);
    const text = 'The wyrdlight rose. Wyrdlight! Rose saw it.';
    expect(findMentions(text, matcher).map((m) => text.slice(m.from, m.to))).toEqual(['wyrdlight', 'Wyrdlight', 'Rose']);
  });

  it('ends an exported book with the glossary when asked', async () => {
    let t = 1_700_000_000_000;
    const store = new AppStore(new MemoryStorage(), () => (t += 1000));
    await store.load();
    const p = store.createProject('The Lighthouse');
    const term = store.addCastMember(p.id, 'term', 'Elvarin')!;
    store.updateCastMember(p.id, term.id, { description: 'The old tongue of the coast.' });
    const state = store.getState();
    const project = state.projects.find((x) => x.id === p.id)!;
    expect(bookParts(state, project, {}).map((x) => x.heading)).not.toContain('Glossary');
    const parts = bookParts(state, project, { glossary: true });
    expect(parts[parts.length - 1].heading).toBe('Glossary');
    expect(runsText(parts[parts.length - 1].doc.blocks[0].runs)).toBe('Elvarin: The old tongue of the coast.');
  });
});
