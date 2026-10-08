// Bookmarks: shortcuts in the sidebar to a note, chapter, project, or a
// heading inside one, like Obsidian's. Kept on this device.

import type { AppState } from './store';
import { displayTitle } from './selectors';

export interface Bookmark {
  kind: 'note' | 'chapter' | 'project' | 'heading';
  /** The note, chapter or project (for a heading: the note or chapter it's in). */
  id: string;
  /** A heading's block. */
  block?: string;
}

export function sameBookmark(a: Bookmark, b: Bookmark): boolean {
  return a.kind === b.kind && a.id === b.id && (a.block ?? '') === (b.block ?? '');
}

/** Adds the bookmark, or takes it away if it's there. */
export function toggleBookmark(list: Bookmark[], b: Bookmark): Bookmark[] {
  return list.some((x) => sameBookmark(x, b)) ? list.filter((x) => !sameBookmark(x, b)) : [...list, b];
}

const headingText = (blocks: { id: string; runs: { text: string }[] }[], block?: string) =>
  blocks
    .find((x) => x.id === block)
    ?.runs.map((r) => r.text)
    .join('')
    .trim();

/** What a bookmark is called now, and what it's in; null when it's gone. */
export function bookmarkLabel(state: AppState, b: Bookmark): { title: string; where?: string } | null {
  const note = state.notes.find((n) => n.id === b.id && n.trashedAt === null);
  const chapter = state.chapters.find((c) => c.id === b.id);
  switch (b.kind) {
    case 'note':
      return note ? { title: displayTitle(note) } : null;
    case 'chapter': {
      if (!chapter) return null;
      return { title: chapter.title.trim() || 'Untitled chapter', where: state.projects.find((p) => p.id === chapter.projectId)?.name };
    }
    case 'project': {
      const p = state.projects.find((x) => x.id === b.id);
      return p ? { title: p.name || 'Untitled project' } : null;
    }
    case 'heading': {
      const doc = note?.doc ?? chapter?.doc;
      const text = doc && headingText(doc.blocks, b.block);
      if (!text) return null;
      return { title: text, where: note ? displayTitle(note) : chapter!.title.trim() || 'Untitled chapter' };
    }
  }
}
