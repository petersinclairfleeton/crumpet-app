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
// - Projects and chapters merge the same way. When both sides changed a
//   project's outline, both sets of changes are kept: chapters and parts
//   added on either side are added, removed on either side are removed, and
//   the order follows this device.

import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { mergeText } from './textmerge';
import type { CastMember, OutlineItem } from '../data/types';
import { type TChapter, type TNote, type Tree, emptyTree, sameChapter, sameNote, sameNotebook, sameJson, sameOutline, sameProject, sameStack, sameTags } from './tree';

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

  // Shared settings, each on its own: a change on one side wins; both changed, the newer one.
  {
    const [b, l, r] = [base.settings, local.settings, remote.settings];
    const newer = (r?.updated ?? 0) > (l?.updated ?? 0) ? r : l;
    const noteStyles = jsonField(b?.noteStyles, l?.noteStyles, r?.noteStyles, newer?.noteStyles);
    const notePage = jsonField(b?.notePage, l?.notePage, r?.notePage, newer?.notePage);
    if (noteStyles || notePage) tree.settings = { ...withValue('noteStyles', noteStyles), ...withValue('notePage', notePage), updated: Math.max(l?.updated ?? 0, r?.updated ?? 0) };
  }

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
        ...withValue('projectId', field(b ? (b.projectId ?? null) : undefined, l.projectId ?? null, r.projectId ?? null, newer.projectId ?? null) ?? undefined),
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

  // ---- projects and chapters
  for (const id of keys(base.projects, local.projects, remote.projects)) {
    const p = pick(base.projects[id], local.projects[id], remote.projects[id], sameProject, (b, l, r) => ({
      id,
      name: field(b?.name, l.name, r.name),
      goal: field(b?.goal, l.goal, r.goal),
      outline: mergeOutline(b?.outline ?? [], l.outline, r.outline),
      created: Math.min(l.created, r.created),
      updated: Math.max(l.updated, r.updated),
      ...withValue('styles', jsonField(b?.styles, l.styles, r.styles, r.updated > l.updated ? r.styles : l.styles)),
      ...withValue('page', jsonField(b?.page, l.page, r.page, r.updated > l.updated ? r.page : l.page)),
      ...withValue('cast', mergeCast(b?.cast ?? [], l.cast ?? [], r.cast ?? [])),
      ...withValue('deadline', jsonField(b?.deadline, l.deadline, r.deadline, r.updated > l.updated ? r.deadline : l.deadline)),
    }));
    if (p) tree.projects[id] = p;
  }
  const copyOf = new Map<string, string>();
  for (const id of keys(base.chapters, local.chapters, remote.chapters)) {
    const conflict: { copy?: TChapter } = {};
    const c = pick(base.chapters[id], local.chapters[id], remote.chapters[id], sameChapter, (b, l, r) => {
      const newer = r.updated > l.updated ? r : l;
      const text = mergeText(b?.body ?? '', l.body, r.body);
      if (text === null) conflict.copy = { ...r, id: opts.newId(), title: `${r.title || 'Untitled'} (conflicted copy ${new Date(opts.now).toISOString().slice(0, 10)})`, created: opts.now };
      return {
        id,
        projectId: field(b?.projectId, l.projectId, r.projectId, newer.projectId),
        title: field(b?.title, l.title, r.title, newer.title),
        status: field(b?.status, l.status, r.status, newer.status),
        synopsis: field(b?.synopsis, l.synopsis, r.synopsis, newer.synopsis),
        goal: field(b?.goal, l.goal, r.goal, newer.goal),
        ...keywords(mergeTags(b?.keywords ?? [], l.keywords ?? [], r.keywords ?? [])),
        created: Math.min(l.created, r.created),
        updated: Math.max(l.updated, r.updated),
        body: text === null ? l.body : tidy(text),
      };
    });
    if (c) tree.chapters[id] = c;
    if (conflict.copy) {
      tree.chapters[conflict.copy.id] = conflict.copy;
      copyOf.set(conflict.copy.id, id);
      copies.push(conflict.copy.id);
    }
  }
  // A chapter needs its project: one deleted on one side while written in on the other comes back.
  for (const c of Object.values(tree.chapters)) {
    if (tree.projects[c.projectId]) continue;
    const p = local.projects[c.projectId] ?? remote.projects[c.projectId];
    if (p) tree.projects[p.id] = p;
    else delete tree.chapters[c.id];
  }
  // Each outline lists exactly its project's chapters: none missing (new ones, conflicted
  // copies next to their original), none that have gone.
  for (const p of Object.values(tree.projects)) {
    const mine = new Set(Object.values(tree.chapters).filter((c) => c.projectId === p.id).map((c) => c.id));
    const seen = new Set<string>();
    const outline = p.outline.filter((x) => {
      if (seen.has(x.id) || (x.type === 'chapter' && !mine.has(x.id))) return false;
      seen.add(x.id);
      return true;
    });
    for (const id of [...mine].sort()) {
      if (seen.has(id)) continue;
      const after = copyOf.get(id);
      const at = after ? outline.findIndex((x) => x.id === after) : -1;
      outline.splice(at >= 0 ? at + 1 : outline.length, 0, { type: 'chapter', id });
      seen.add(id);
    }
    if (!sameOutline(outline, p.outline)) tree.projects[p.id] = { ...p, outline };
  }
  // Research for a project that's gone becomes an ordinary note.
  for (const n of Object.values(tree.notes)) if (n.projectId && !tree.projects[n.projectId]) tree.notes[n.id] = { ...n, projectId: undefined };

  return { tree, copies };
}

/**
 * Both sides changed the outline: start from this device's, take out what the
 * other side removed, put in what it added (after the item it follows there),
 * and take its part renames.
 */
function mergeOutline(base: OutlineItem[], local: OutlineItem[], remote: OutlineItem[]): OutlineItem[] {
  if (sameOutline(local, remote)) return local;
  if (sameOutline(base, local)) return remote;
  if (sameOutline(base, remote)) return local;
  const inBase = new Map(base.map((x) => [x.id, x]));
  const inRemote = new Map(remote.map((x) => [x.id, x]));
  const out = local.filter((x) => !(inBase.has(x.id) && !inRemote.has(x.id)));
  const has = new Set(out.map((x) => x.id));
  remote.forEach((x, i) => {
    if (has.has(x.id) || inBase.has(x.id)) return;
    const prev = remote[i - 1];
    const at = prev ? out.findIndex((y) => y.id === prev.id) : -1;
    out.splice(at + 1, 0, x);
    has.add(x.id);
  });
  return out.map((x) => {
    if (x.type !== 'part') return x;
    const b = inBase.get(x.id);
    const r = inRemote.get(x.id);
    const title = field(b?.type === 'part' ? b.title : undefined, x.title, r?.type === 'part' ? r.title : x.title);
    return title === x.title ? x : { ...x, title };
  });
}

/** A three-way merge of one value compared by content (style sheets, page setup). */
/**
 * Characters and places: each one merges on its own (a change on one side
 * wins; both changed, this device's), added on either side are kept, and
 * deleted on either side go unless the other side changed them.
 */
function mergeCast(b: CastMember[], l: CastMember[], r: CastMember[]): CastMember[] | undefined {
  const byId = (list: CastMember[]) => new Map(list.map((m) => [m.id, m]));
  const [B, L, R] = [byId(b), byId(l), byId(r)];
  const out: CastMember[] = [];
  for (const id of new Set([...L.keys(), ...R.keys()])) {
    const m = jsonField(B.get(id), L.get(id), R.get(id), L.get(id) ?? R.get(id));
    if (m) out.push(m);
  }
  // This device's order, then any added elsewhere.
  const order = [...l.map((m) => m.id), ...r.map((m) => m.id)];
  out.sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));
  return out.length ? out : undefined;
}

function jsonField<V>(b: V | undefined, l: V | undefined, r: V | undefined, tie: V | undefined): V | undefined {
  if (sameJson(l, r)) return l;
  if (sameJson(b, l)) return r;
  if (sameJson(b, r)) return l;
  return tie;
}

function withValue<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
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
const keywords = (k: string[]) => (k.length ? { keywords: k } : {});

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
