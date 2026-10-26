// Worldbuilding: a book's cards are characters and places, and the rest of
// its world: things, groups, cultures, magic and technology, creatures and
// history. Each kind has questions to answer (like Campfire's and World
// Anvil's templates), and any card can have fields of your own.

import type { CastField, CastKind, CastMember } from './types';

export interface KindInfo {
  kind: CastKind;
  /** "Item", and "Items" for a list's heading. */
  name: string;
  plural: string;
  /** Shown on a card with no picture or name yet. */
  glyph: string;
  /** What to ask about one (the card's Details). */
  questions: string[];
  /** The description's placeholder. */
  hint: string;
}

export const KINDS: KindInfo[] = [
  { kind: 'character', name: 'Character', plural: 'Characters', glyph: '?', questions: ['Age', 'Looks', 'Wants', 'Fears', 'Secret', 'How they speak', 'How they change'], hint: 'Who they are, in a line or two' },
  { kind: 'place', name: 'Place', plural: 'Places', glyph: '⌖', questions: ['Where it is', 'Who lives there', 'Sights, sounds and smells', 'History', 'Dangers'], hint: 'What it’s like, in a line or two' },
  { kind: 'item', name: 'Thing', plural: 'Things', glyph: '◆', questions: ['What it does', 'Who has it', 'Where it came from', 'What it costs to use', 'What it can’t do'], hint: 'An object, a weapon, a heirloom, a ship…' },
  { kind: 'group', name: 'Group', plural: 'Groups', glyph: '⚑', questions: ['What they want', 'Who leads them', 'Members', 'Allies', 'Enemies', 'Symbol or colours'], hint: 'A family, a guild, a crew, an army, a company…' },
  { kind: 'culture', name: 'Culture', plural: 'Cultures', glyph: '❖', questions: ['Beliefs', 'Customs', 'Food and drink', 'Clothes', 'Language', 'Taboos'], hint: 'A people, a religion, a way of life…' },
  { kind: 'magic', name: 'Magic or technology', plural: 'Magic and technology', glyph: '✦', questions: ['How it works', 'Who can use it', 'What it costs', 'Its limits', 'What happens when it goes wrong'], hint: 'A magic system, a technology, a power…' },
  { kind: 'creature', name: 'Creature', plural: 'Creatures', glyph: '♞', questions: ['Looks', 'Where it lives', 'How it behaves', 'How dangerous it is'], hint: 'An animal, a monster, a species…' },
  { kind: 'lore', name: 'Event or legend', plural: 'History and legends', glyph: '⌛', questions: ['When', 'What happened', 'Who was there', 'What it changed', 'What people believe now'], hint: 'An event, a war, a legend, a prophecy…' },
];

export const KIND_IDS = KINDS.map((k) => k.kind);

export function kindInfo(kind: CastKind): KindInfo {
  return KINDS.find((k) => k.kind === kind) ?? KINDS[0];
}

/** A kind read from a file: one Crumpet knows, or a character. */
export function cleanKind(k: unknown): CastKind {
  return KIND_IDS.includes(k as CastKind) ? (k as CastKind) : 'character';
}

/** A card's fields from a file: labels and answers, as text. */
export function cleanFields(v: unknown): CastField[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((f) => {
    const x = f as Partial<CastField>;
    return x && typeof x.label === 'string' && x.label.trim() ? [{ label: x.label.trim(), value: typeof x.value === 'string' ? x.value : '' }] : [];
  });
}

/**
 * A card's details: its kind's questions (answered or not) and then its own fields. Questions answered on a card
 * of another kind (before it changed kind) stay, as its own fields.
 */
export function cardDetails(member: CastMember): { label: string; value: string; asked: boolean }[] {
  const fields = member.fields ?? [];
  const questions = kindInfo(member.kind).questions;
  return [
    ...questions.map((q) => ({ label: q, value: fields.find((f) => f.label === q)?.value ?? '', asked: true })),
    ...fields.filter((f) => !questions.includes(f.label)).map((f) => ({ ...f, asked: false })),
  ];
}

/** A card's fields with one changed: an empty answer to a question is dropped; a field of your own stays until removed. */
export function setField(member: CastMember, label: string, value: string): CastField[] {
  const fields = member.fields ?? [];
  const asked = kindInfo(member.kind).questions.includes(label);
  const at = fields.findIndex((f) => f.label === label);
  if (!value.trim() && asked) return fields.filter((_, i) => i !== at);
  if (at < 0) return [...fields, { label, value }];
  return fields.map((f, i) => (i === at ? { label, value } : f));
}

/** The cards grouped by kind, in the kinds' order, each sorted by name. */
export function byKind(cast: CastMember[]): { info: KindInfo; members: CastMember[] }[] {
  return KINDS.map((info) => ({ info, members: cast.filter((m) => m.kind === info.kind).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.members.length);
}
