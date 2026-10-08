// Revision mode, like Scrivener's: each round of revisions has a colour, and
// text typed while revising is in that round's colour (an ordinary text
// colour, so it shows in Word too) until the colours are removed.

import type { Doc } from '@crumpet/editor/model';

export const REVISIONS = [
  { name: 'First', color: '#1f5fbf' },
  { name: 'Second', color: '#c0392b' },
  { name: 'Third', color: '#2e7d32' },
  { name: 'Fourth', color: '#7b3fa0' },
  { name: 'Fifth', color: '#d35400' },
];

export function revisionColor(round: number | undefined): string | null {
  return round && REVISIONS[round - 1] ? REVISIONS[round - 1].color : null;
}

/** The text with revision colours taken off (all rounds, or just one); the same doc if there were none. */
export function removeRevisionColors(doc: Doc, round?: number): Doc {
  const colors = new Set((round ? [REVISIONS[round - 1]] : REVISIONS).map((r) => r.color));
  let changed = false;
  const blocks = doc.blocks.map((b) => {
    if (!b.runs.some((r) => r.look?.color && colors.has(r.look.color.toLowerCase()))) return b;
    changed = true;
    return {
      ...b,
      runs: b.runs.map((r) => {
        if (!r.look?.color || !colors.has(r.look.color.toLowerCase())) return r;
        const { color: _, ...rest } = r.look;
        const out = { ...r };
        if (Object.keys(rest).length) out.look = rest;
        else delete out.look;
        return out;
      }),
    };
  });
  return changed ? { ...doc, blocks } : doc;
}

/** Whether a doc has text in any revision colour. */
export function hasRevisions(doc: Doc): boolean {
  const colors = new Set(REVISIONS.map((r) => r.color));
  return doc.blocks.some((b) => b.runs.some((r) => r.look?.color && colors.has(r.look.color.toLowerCase())));
}
