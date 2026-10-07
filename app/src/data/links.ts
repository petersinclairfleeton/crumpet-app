// Links between notes: [[Title]] in the text. A link points at a note by its
// title (as Obsidian does), so other apps understand it too; renaming a note
// updates the links to it.

import type { Doc } from '@crumpet/editor/model';
import { NOTE_LINK, noteLink, noteLinkTitle } from '@crumpet/editor/markdown';
import type { Note } from './types';

export function sameTitle(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The note a link's title means: an exact match first, then ignoring capitals. */
export function findByTitle(notes: Note[], title: string): Note | undefined {
  const live = notes.filter((n) => n.trashedAt === null);
  return live.find((n) => n.title === title) ?? live.find((n) => sameTitle(n.title, title));
}

/** Titles of the notes a document links to. */
export function linkedTitles(doc: Doc): string[] {
  const out = new Set<string>();
  for (const b of doc.blocks) for (const r of b.runs) if (r.link?.startsWith(NOTE_LINK)) out.add(noteLinkTitle(r.link));
  return [...out];
}

/** Notes that link to this one, newest first. */
export function backlinks(note: Note, notes: Note[]): Note[] {
  if (!note.title.trim()) return [];
  return notes
    .filter((n) => n.id !== note.id && n.trashedAt === null && linkedTitles(n.doc).some((t) => sameTitle(t, note.title)))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** The same document with links to `from` pointing at `to` (unchanged object if there were none). */
export function relinkDoc(doc: Doc, from: string, to: string): Doc {
  let changed = false;
  const blocks = doc.blocks.map((b) => {
    if (!b.runs.some((r) => r.link?.startsWith(NOTE_LINK) && sameTitle(noteLinkTitle(r.link), from))) return b;
    changed = true;
    return {
      ...b,
      runs: b.runs.map((r) => {
        if (!r.link?.startsWith(NOTE_LINK) || !sameTitle(noteLinkTitle(r.link), from)) return r;
        // Text that just said the old title says the new one.
        return { ...r, link: noteLink(to), text: sameTitle(r.text, from) ? to : r.text };
      }),
    };
  });
  return changed ? { blocks } : doc;
}
