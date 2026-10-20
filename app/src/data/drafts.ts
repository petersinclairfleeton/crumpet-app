// Drafts of a chapter: the big deliberate rewrites ("Draft 2"), each kept and
// editable. A chapter's `doc` is the draft the book uses; its others are in
// `drafts`. The first draft has the chapter's own id, so a chapter that never
// had another needs nothing extra. (Snapshots and automatic versions are the
// safety net within a draft; see snapshots.ts.)

import type { Chapter, ChapterDraft } from './types';

/** One draft of a chapter, whether or not the book is using it. */
export interface DraftView extends ChapterDraft {
  /** The one the book uses (the chapter's `doc`). */
  inUse: boolean;
}

export const FIRST_DRAFT = 'Draft 1';

/** The editor's id for a draft: the chapter's own for the one in use, so the sidebar's tabs work on it as ever. */
export function draftDocId(c: Chapter, draftId: string): string {
  return draftId === draftInUse(c) ? c.id : `${c.id}~${draftId}`;
}

/** The chapter (or note) an editor's id is for. */
export function docOwner(docId: string): string {
  return docId.split('~')[0];
}

/** The id of the draft the book uses. */
export function draftInUse(c: Chapter): string {
  return c.draft?.id ?? c.id;
}

/** Every draft of a chapter, oldest first. */
export function chapterDrafts(c: Chapter): DraftView[] {
  const current: DraftView = {
    id: draftInUse(c),
    name: c.draft?.name || FIRST_DRAFT,
    note: c.draft?.note ?? '',
    createdAt: c.draft?.createdAt ?? c.createdAt,
    doc: c.doc,
    updatedAt: c.updatedAt,
    inUse: true,
  };
  const others: DraftView[] = (c.drafts ?? []).map((d) => ({ ...d, inUse: false }));
  return [...others, current].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
}

/** One draft by id. */
export function chapterDraft(c: Chapter, id: string): DraftView | undefined {
  return chapterDrafts(c).find((d) => d.id === id);
}

/** "Draft 3": one more than the highest-numbered draft so far. */
export function nextDraftName(names: string[]): string {
  let top = names.length;
  for (const n of names) {
    const m = /^draft\s+(\d+)$/i.exec(n.trim());
    if (m) top = Math.max(top, Number(m[1]));
  }
  return `Draft ${top + 1}`;
}

/** The name for a new draft of the whole book: one more than any chapter's highest. */
export function nextBookDraftName(chapters: Chapter[]): string {
  let top = 1;
  for (const c of chapters) top = Math.max(top, Number(/\d+$/.exec(nextDraftName(chapterDrafts(c).map((d) => d.name)))![0]));
  return `Draft ${top}`;
}

/** Short form for a badge: "D2" for "Draft 2", else the name's first letters. */
export function draftBadge(name: string): string {
  const m = /^draft\s+(\d+)$/i.exec(name.trim());
  return m ? `D${m[1]}` : name.trim().slice(0, 3);
}

/** The chapter with another draft put to use: its text and details swap with the one in use. */
export function withDraftInUse(c: Chapter, id: string, now: number): Chapter {
  if (id === draftInUse(c)) return c;
  const next = c.drafts?.find((d) => d.id === id);
  if (!next) return c;
  const was: ChapterDraft = { id: draftInUse(c), name: c.draft?.name || FIRST_DRAFT, note: c.draft?.note ?? '', createdAt: c.draft?.createdAt ?? c.createdAt, doc: c.doc, updatedAt: c.updatedAt };
  const drafts = [...(c.drafts ?? []).filter((d) => d.id !== id), was];
  return { ...c, doc: next.doc, draft: { id: next.id, name: next.name, note: next.note, createdAt: next.createdAt }, drafts, updatedAt: now };
}
