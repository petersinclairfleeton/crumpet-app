// Merging this device's changes with the cloud's, using the version both last
// agreed on (the base) to tell who changed what.
//
// - A change on one side wins over no change on the other.
// - Both changed: details merge one by one (tags as sets, the newer edit for
//   the rest) and the text merges where the edits don't touch. When the text
//   can't be merged, nothing is lost: this device's version stays in the note
//   and the other becomes a "conflicted copy" next to it.
// - Deleted on one side and edited on the other: the edit wins and the note
//   comes back.

import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { mergeText } from './textmerge';
import { type TNote, type Tree, emptyTree, sameNote, sameNotebook, sameStack, sameTags } from './tree';

export interface MergeOptions {
  newId(): string;
  now: number;
}

export interface MergeResult {
  tree: Tree;
  /** Ids of conflicted copies created. */
  copies: string[];
}

export function mergeTrees(base: Tree, local: Tree, remote: Tree, opts: MergeOptions): MergeResult {
  const tree = emptyTree();
  const copies: string[] = [];

  for (const id of keys(base.stacks, local.stacks, remote.stacks)) {
    const s = pick(base.stacks[id], local.stacks[id], remote.stacks[id], sameStack, (b, l, r) => ({
      ...l,
      name: field(b?.name, l.name, r.name),
      created: Math.min(l.created, r.created),
    }));
    if (s) tree.stacks[id] = s;
  }

  for (const id of keys(base.notebooks, local.notebooks, remote.notebooks)) {
    const nb = pick(base.notebooks[id], local.notebooks[id], remote.notebooks[id], sameNotebook, (b, l, r) => ({
      ...l,
      name: field(b?.name, l.name, r.name),
      color: field(b?.color, l.color, r.color),
      stackId: field(b?.stackId, l.stackId, r.stackId),
      created: Math.min(l.created, r.created),
    }));
    if (nb) tree.notebooks[id] = nb;
  }

  for (const id of keys(base.notes, local.notes, remote.notes)) {
    const b = base.notes[id];
    const l = local.notes[id];
    const r = remote.notes[id];
    const conflict: { copy?: TNote } = {};
    const note = pick(b, l, r, sameNote, (b, l, r) => {
      const newer = r.updated > l.updated ? r : l;
      const text = mergeText(b?.body ?? '', l.body, r.body);
      if (text === null) conflict.copy = conflictCopy(r, opts);
      return {
        id,
        title: field(b?.title, l.title, r.title, newer.title),
        notebookId: field(b?.notebookId, l.notebookId, r.notebookId, newer.notebookId),
        tags: mergeTags(b?.tags ?? [], l.tags, r.tags),
        favorite: field(b?.favorite, l.favorite, r.favorite, newer.favorite),
        created: Math.min(l.created, r.created),
        updated: Math.max(l.updated, r.updated),
        trashed: field(b?.trashed, l.trashed, r.trashed, newer.trashed),
        body: text === null ? l.body : tidy(text),
        extra: field(b?.extra, l.extra, r.extra, newer.extra),
      };
    });
    if (note) tree.notes[id] = note;
    if (conflict.copy) {
      tree.notes[conflict.copy.id] = conflict.copy;
      copies.push(conflict.copy.id);
    }
  }

  // A note can't be in a notebook that's gone: if one side deleted the notebook
  // while the other added to it, the notebook comes back (and its stack with it).
  for (const n of Object.values(tree.notes)) {
    if (!n.notebookId || tree.notebooks[n.notebookId]) continue;
    const nb = local.notebooks[n.notebookId] ?? remote.notebooks[n.notebookId];
    if (nb && n.trashed === null) tree.notebooks[nb.id] = nb;
    else tree.notes[n.id] = { ...n, notebookId: null };
  }
  for (const nb of Object.values(tree.notebooks)) {
    if (!nb.stackId || tree.stacks[nb.stackId]) continue;
    const s = local.stacks[nb.stackId] ?? remote.stacks[nb.stackId];
    if (s) tree.stacks[s.id] = s;
    else tree.notebooks[nb.id] = { ...nb, stackId: null };
  }
  return { tree, copies };
}

function keys(...maps: Record<string, unknown>[]): string[] {
  return [...new Set(maps.flatMap((m) => Object.keys(m)))].sort();
}

/**
 * The merged value of one item. `both` combines two edited versions; it gets
 * the base too, which is missing when both sides created the same id.
 */
function pick<T>(b: T | undefined, l: T | undefined, r: T | undefined, same: (x: T | undefined, y: T | undefined) => boolean, both: (b: T | undefined, l: T, r: T) => T): T | undefined {
  if (l && r) {
    if (same(l, r)) return l;
    if (b && same(b, l)) return r;
    if (b && same(b, r)) return l;
    return both(b, l, r);
  }
  if (!b) return l ?? r; // new on one side
  if (l) return same(b, l) ? undefined : l; // deleted there: gone, unless edited here
  if (r) return same(b, r) ? undefined : r; // deleted here: gone, unless edited there
  return undefined;
}

/** One value merged three ways. When both sides changed it, `tie` decides (this device by default). */
function field<V>(b: V | undefined, l: V, r: V, tie: V = l): V {
  if (equal(l, r)) return l;
  if (b !== undefined && equal(b, l)) return r;
  if (b !== undefined && equal(b, r)) return l;
  return tie;
}

function equal<V>(a: V, b: V): boolean {
  return Array.isArray(a) && Array.isArray(b) ? sameTags(a, b) : a === b;
}

/** Tags added on either side are added; tags removed on either side are removed. */
function mergeTags(b: string[], l: string[], r: string[]): string[] {
  if (sameTags(l, r)) return l;
  const out = l.filter((t) => r.includes(t) || !b.includes(t));
  for (const t of r) if (!b.includes(t) && !out.includes(t)) out.push(t);
  return out;
}

function conflictCopy(r: TNote, opts: MergeOptions): TNote {
  const when = new Date(opts.now).toISOString().slice(0, 10);
  return { ...r, id: opts.newId(), title: `${r.title || 'Untitled'} (conflicted copy ${when})`, created: opts.now };
}

/** Merged Markdown in the form Crumpet writes it, so reading it back is no change. */
function tidy(md: string): string {
  return toMarkdown(fromMarkdown(md));
}
