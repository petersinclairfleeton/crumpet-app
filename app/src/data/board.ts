// Boards, like Obsidian's Canvas: cards (text, notes, groups) laid out on an
// open surface, with arrows between them. A board is a note whose text is one
// ```canvas block in the JSON Canvas format (jsoncanvas.org), so it syncs
// like any note and other apps can read it.

import { type Doc, makeBlock } from '@crumpet/editor/model';
import type { Note } from './types';

export type CardColor = '1' | '2' | '3' | '4' | '5' | '6';

export interface Card {
  id: string;
  type: 'text' | 'file' | 'group';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: CardColor;
  /** Text cards: Markdown. */
  text?: string;
  /** Note cards: the note's title (as JSON Canvas names a file), and its id here. */
  file?: string;
  note?: string;
  /** Groups: the label. */
  label?: string;
}

export interface Arrow {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: 'top' | 'right' | 'bottom' | 'left';
  toSide?: 'top' | 'right' | 'bottom' | 'left';
  label?: string;
  color?: CardColor;
}

export interface Board {
  nodes: Card[];
  edges: Arrow[];
}

/** JSON Canvas's six preset colours. */
export const CARD_COLORS: Record<CardColor, string> = { '1': '#e05a4f', '2': '#e8913a', '3': '#d8b23a', '4': '#4caf6a', '5': '#3fa7c8', '6': '#8e6bd1' };

export function emptyBoard(): Board {
  return { nodes: [], edges: [] };
}

export function isBoard(note: Pick<Note, 'doc'>): boolean {
  const b = note.doc.blocks;
  return b.length === 1 && b[0].type === 'code' && b[0].code?.lang === 'canvas';
}

/** A board read from its JSON, made safe (unknown cards and arrows to missing cards dropped). */
export function readBoard(json: string): Board {
  let raw: unknown;
  try {
    raw = JSON.parse(json || '{}');
  } catch {
    return emptyBoard();
  }
  const r = raw as { nodes?: unknown[]; edges?: unknown[] };
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const color = (v: unknown) => (typeof v === 'string' && /^[1-6]$/.test(v) ? (v as CardColor) : undefined);
  const nodes: Card[] = [];
  for (const n of Array.isArray(r?.nodes) ? r.nodes : []) {
    const x = n as Record<string, unknown>;
    if (!x || typeof x.id !== 'string' || !['text', 'file', 'group'].includes(x.type as string)) continue;
    const card: Card = { id: x.id, type: x.type as Card['type'], x: num(x.x, 0), y: num(x.y, 0), width: Math.max(60, num(x.width, 250)), height: Math.max(40, num(x.height, 120)) };
    const c = color(x.color);
    if (c) card.color = c;
    if (card.type === 'text') card.text = str(x.text) ?? '';
    if (card.type === 'file') {
      card.file = str(x.file) ?? '';
      if (str(x.note)) card.note = str(x.note);
    }
    if (card.type === 'group' && str(x.label)) card.label = str(x.label);
    nodes.push(card);
  }
  const ids = new Set(nodes.map((n) => n.id));
  const side = (v: unknown) => (v === 'top' || v === 'right' || v === 'bottom' || v === 'left' ? v : undefined);
  const edges: Arrow[] = [];
  for (const e of Array.isArray(r?.edges) ? r.edges : []) {
    const x = e as Record<string, unknown>;
    if (!x || typeof x.id !== 'string' || !ids.has(x.fromNode as string) || !ids.has(x.toNode as string)) continue;
    const a: Arrow = { id: x.id, fromNode: x.fromNode as string, toNode: x.toNode as string };
    if (side(x.fromSide)) a.fromSide = side(x.fromSide);
    if (side(x.toSide)) a.toSide = side(x.toSide);
    if (str(x.label)) a.label = str(x.label);
    if (color(x.color)) a.color = color(x.color);
    edges.push(a);
  }
  return { nodes, edges };
}

export function writeBoard(b: Board): string {
  return JSON.stringify({ nodes: b.nodes.map((n) => ({ ...n, x: Math.round(n.x), y: Math.round(n.y), width: Math.round(n.width), height: Math.round(n.height) })), edges: b.edges }, null, 1);
}

export function boardDoc(b: Board): Doc {
  return { blocks: [makeBlock('code', '', [], { code: { lang: 'canvas', text: writeBoard(b) } })] };
}

export function boardOf(note: Pick<Note, 'doc'>): Board {
  return readBoard(note.doc.blocks[0]?.code?.text ?? '');
}

/** The words on a board (its cards' text, groups' labels and notes' titles), for search and previews. */
export function boardText(b: Board): string {
  return b.nodes.map((n) => n.text ?? n.label ?? n.file ?? '').filter(Boolean).join('\n');
}

/** "Board · 3 cards", and the first words on it. */
export function boardPreview(b: Board): string {
  const cards = b.nodes.filter((n) => n.type !== 'group').length;
  const words = boardText(b).replace(/\s+/g, ' ').trim();
  return `Board · ${cards} card${cards === 1 ? '' : 's'}${words ? ` · ${words}` : ''}`;
}
