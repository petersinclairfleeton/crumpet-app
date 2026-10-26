import { describe, expect, it } from 'vitest';
import { byKind, cardDetails, cleanFields, cleanKind, kindInfo, setField } from '../../src/data/world';
import type { CastMember } from '../../src/data/types';

const card = (kind: CastMember['kind'], name: string, fields?: CastMember['fields']): CastMember => ({ id: name, kind, name, aliases: [], description: '', notes: '', ...(fields ? { fields } : {}) });

describe('worldbuilding cards', () => {
  it('asks each kind its own questions, then shows fields of its own', () => {
    const lens = card('item', 'Lens', [{ label: 'What it does', value: 'Turns the beam' }, { label: 'Weight', value: 'Three tons' }]);
    expect(cardDetails(lens).map((d) => [d.label, d.value, d.asked])).toEqual([
      ['What it does', 'Turns the beam', true],
      ['Who has it', '', true],
      ['Where it came from', '', true],
      ['What it costs to use', '', true],
      ['What it can’t do', '', true],
      ['Weight', 'Three tons', false],
    ]);
    // Made a group: its answers about being a thing stay, as fields of its own.
    expect(cardDetails({ ...lens, kind: 'group' }).filter((d) => !d.asked).map((d) => d.label)).toEqual(['What it does', 'Weight']);
  });

  it('keeps answers, drops empty ones, and keeps an empty field of your own until it’s taken off', () => {
    const c = card('creature', 'Kraken');
    const one = setField(c, 'Looks', 'Eight arms');
    expect(one).toEqual([{ label: 'Looks', value: 'Eight arms' }]);
    expect(setField({ ...c, fields: one }, 'Looks', '')).toEqual([]);
    const own = setField(c, 'Diet', '');
    expect(own).toEqual([{ label: 'Diet', value: '' }]);
    expect(setField({ ...c, fields: own }, 'Diet', 'Sailors')).toEqual([{ label: 'Diet', value: 'Sailors' }]);
  });

  it('groups a book’s cards by kind, in order, by name', () => {
    const groups = byKind([card('group', 'Wreckers'), card('character', 'Tam'), card('item', 'Lens'), card('character', 'Mara')]);
    expect(groups.map((g) => [g.info.plural, g.members.map((m) => m.name)])).toEqual([
      ['Characters', ['Mara', 'Tam']],
      ['Things', ['Lens']],
      ['Groups', ['Wreckers']],
    ]);
  });

  it('reads kinds and fields from a file safely', () => {
    expect([cleanKind('magic'), cleanKind('spaceship'), cleanKind(undefined)]).toEqual(['magic', 'character', 'character']);
    expect(cleanFields([{ label: ' Motto ', value: 'Light the way' }, { label: '', value: 'x' }, 'junk', { label: 'Empty' }])).toEqual([
      { label: 'Motto', value: 'Light the way' },
      { label: 'Empty', value: '' },
    ]);
    expect(kindInfo('lore').name).toBe('Event or legend');
  });
});
