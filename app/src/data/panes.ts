// The panes the writing area is split into, like Obsidian's: groups of tabs,
// side by side or one above the other, as deep as you like. Every change makes
// a new workspace (nothing is changed in place), so it can be saved as it is.

/** What a tab shows. */
export type Tab =
  | { kind: 'note'; id: string }
  | { kind: 'project'; id: string }
  | { kind: 'chapter'; id: string }
  | { kind: 'research'; id: string }
  | { kind: 'cast'; project: string; id: string }
  /** The graph of notes and links (one, so its id is always 'graph'). */
  | { kind: 'graph'; id: 'graph' };

export interface Group {
  id: string;
  tabs: Tab[];
  /** The tab showing (an index into `tabs`). */
  active: number;
}

export type PaneNode = { kind: 'group'; group: Group } | { kind: 'split'; dir: 'row' | 'col'; children: PaneNode[]; sizes: number[] };

export interface Workspace {
  root: PaneNode;
  /** The group last worked in: where things open. */
  active: string;
}

/** Where a dragged tab lands on a group: beside it, or among its tabs. */
export type Side = 'left' | 'right' | 'top' | 'bottom' | 'center';

let counter = 0;
export function groupId(): string {
  counter += 1;
  return `g${Date.now().toString(36)}${counter}`;
}

export function emptyWorkspace(tab?: Tab): Workspace {
  const g: Group = { id: groupId(), tabs: tab ? [tab] : [], active: 0 };
  return { root: { kind: 'group', group: g }, active: g.id };
}

export function sameTab(a: Tab | undefined, b: Tab | undefined): boolean {
  if (!a || !b || a.kind !== b.kind || a.id !== b.id) return false;
  return a.kind !== 'cast' || (b.kind === 'cast' && a.project === b.project);
}

/** Every group, left to right and top to bottom. */
export function groups(ws: Workspace): Group[] {
  const out: Group[] = [];
  const walk = (n: PaneNode) => (n.kind === 'group' ? out.push(n.group) : n.children.forEach(walk));
  walk(ws.root);
  return out;
}

export function findGroup(ws: Workspace, id: string): Group | undefined {
  return groups(ws).find((g) => g.id === id);
}

export function activeGroup(ws: Workspace): Group {
  return findGroup(ws, ws.active) ?? groups(ws)[0];
}

export function activeTab(ws: Workspace): Tab | undefined {
  const g = activeGroup(ws);
  return g.tabs[g.active];
}

/** The tabs showing in each group (the ones you can see). */
export function shownTabs(ws: Workspace): Tab[] {
  return groups(ws)
    .map((g) => g.tabs[g.active])
    .filter((t): t is Tab => !!t);
}

/** A copy of the tree with one group changed (or removed, when `fn` gives null). */
function mapGroup(node: PaneNode, id: string, fn: (g: Group) => Group | null): PaneNode | null {
  if (node.kind === 'group') {
    if (node.group.id !== id) return node;
    const g = fn(node.group);
    return g ? { kind: 'group', group: g } : null;
  }
  const children: PaneNode[] = [];
  const sizes: number[] = [];
  node.children.forEach((c, i) => {
    const next = mapGroup(c, id, fn);
    if (next) {
      children.push(next);
      sizes.push(node.sizes[i] ?? 1);
    }
  });
  if (!children.length) return null;
  if (children.length === 1) return children[0];
  return { ...node, children, sizes };
}

function withGroup(ws: Workspace, id: string, fn: (g: Group) => Group): Workspace {
  const root = mapGroup(ws.root, id, fn);
  return root ? { ...ws, root } : ws;
}

/** Shows this group's tab `index`, and makes the group the active one. */
export function focusTab(ws: Workspace, id: string, index: number): Workspace {
  const g = findGroup(ws, id);
  if (!g) return ws;
  if (g.active === index && ws.active === id) return ws;
  return { ...withGroup(ws, id, (x) => ({ ...x, active: Math.max(0, Math.min(index, x.tabs.length - 1)) })), active: id };
}

export function focusGroup(ws: Workspace, id: string): Workspace {
  return ws.active === id || !findGroup(ws, id) ? ws : { ...ws, active: id };
}

/**
 * Opens `tab` in the active group: shown again if it's already one of its
 * tabs, otherwise in place of the tab showing (`how: 'replace'`) or as a new
 * tab after it (`how: 'tab'`).
 */
export function open(ws: Workspace, tab: Tab, how: 'replace' | 'tab' = 'replace', into = ws.active): Workspace {
  const g = findGroup(ws, into) ?? activeGroup(ws);
  const at = g.tabs.findIndex((t) => sameTab(t, tab));
  if (at >= 0) return focusTab(ws, g.id, at);
  const next = withGroup(ws, g.id, (x) => {
    if (how === 'replace' && x.tabs.length) {
      const tabs = x.tabs.slice();
      tabs[x.active] = tab;
      return { ...x, tabs };
    }
    const where = x.tabs.length ? x.active + 1 : 0;
    return { ...x, tabs: [...x.tabs.slice(0, where), tab, ...x.tabs.slice(where)], active: where };
  });
  return { ...next, active: g.id };
}

/** Makes the group showing `tab` (if any) the active one; the first match wins. */
export function reveal(ws: Workspace, tab: Tab): Workspace | null {
  for (const g of groups(ws)) {
    const at = g.tabs.findIndex((t) => sameTab(t, tab));
    if (at >= 0) return focusTab(ws, g.id, at);
  }
  return null;
}

/** Closes a group's tab; a group left with no tabs goes (unless it's the last one). */
export function closeTab(ws: Workspace, id: string, index: number): Workspace {
  const g = findGroup(ws, id);
  if (!g || !g.tabs[index]) return ws;
  if (g.tabs.length === 1 && groups(ws).length > 1) return removeGroup(ws, id);
  return withGroup(ws, id, (x) => {
    const tabs = x.tabs.filter((_, i) => i !== index);
    const active = index < x.active || (index === x.active && x.active === tabs.length) ? Math.max(0, x.active - 1) : x.active;
    return { ...x, tabs, active };
  });
}

/** Closes every tab showing something that's gone (a deleted note, say). */
export function closeWhere(ws: Workspace, gone: (t: Tab) => boolean): Workspace {
  let next = ws;
  for (const g of groups(ws)) {
    for (let i = g.tabs.length - 1; i >= 0; i--) if (gone(g.tabs[i])) next = closeTab(next, g.id, i);
  }
  return next;
}

export function closeOthers(ws: Workspace, id: string, index: number): Workspace {
  return withGroup(ws, id, (x) => ({ ...x, tabs: [x.tabs[index]], active: 0 }));
}

function removeGroup(ws: Workspace, id: string): Workspace {
  const root = mapGroup(ws.root, id, () => null);
  if (!root) return ws;
  const next = { ...ws, root };
  return ws.active === id ? { ...next, active: groups(next)[0].id } : next;
}

/** Puts a new group holding `tab` beside group `id` (on `side`), and makes it active. */
export function split(ws: Workspace, id: string, side: Exclude<Side, 'center'>, tab: Tab): Workspace {
  const fresh: Group = { id: groupId(), tabs: [tab], active: 0 };
  const dir = side === 'left' || side === 'right' ? 'row' : 'col';
  const before = side === 'left' || side === 'top';
  const place = (node: PaneNode): PaneNode => {
    if (node.kind === 'group') {
      if (node.group.id !== id) return node;
      const pair: PaneNode[] = before ? [{ kind: 'group', group: fresh }, node] : [node, { kind: 'group', group: fresh }];
      return { kind: 'split', dir, children: pair, sizes: [1, 1] };
    }
    // Splitting a pane the same way its row or column already goes: a new member of that row or column.
    const at = node.children.findIndex((c) => c.kind === 'group' && c.group.id === id);
    if (at >= 0 && node.dir === dir) {
      const children = node.children.slice();
      const sizes = node.sizes.slice();
      const half = (sizes[at] ?? 1) / 2;
      sizes[at] = half;
      children.splice(before ? at : at + 1, 0, { kind: 'group', group: fresh });
      sizes.splice(before ? at : at + 1, 0, half);
      return { ...node, children, sizes };
    }
    return { ...node, children: node.children.map(place) };
  };
  return { root: place(ws.root), active: fresh.id };
}

/**
 * Drops `tab` on group `to`: among its tabs (at `index`, or after the one
 * showing), or beside it. When it was dragged from a tab (`from`), that tab
 * moves rather than being copied.
 */
export function drop(ws: Workspace, tab: Tab, to: string, side: Side, from?: { group: string; index: number }, index?: number): Workspace {
  let next = ws;
  const target = findGroup(ws, to);
  if (!target) return ws;
  // A group's only tab dropped beside itself, or back where it was: nothing to do.
  if (from && from.group === to && side !== 'center' && target.tabs.length === 1) return ws;
  if (from && from.group === to && side === 'center') {
    if (index === undefined || index === from.index || index === from.index + 1) return focusTab(ws, to, from.index);
    return withGroup(ws, to, (x) => {
      const tabs = x.tabs.slice();
      const [moved] = tabs.splice(from.index, 1);
      const at = index > from.index ? index - 1 : index;
      tabs.splice(at, 0, moved);
      return { ...x, tabs, active: at };
    });
  }
  if (from) {
    const source = findGroup(ws, from.group);
    // Leave the source first (it may vanish if this was its last tab), keeping the target if it's a different group.
    if (source) next = source.tabs.length === 1 && groups(ws).length > 1 && from.group !== to ? removeGroup(next, from.group) : closeTab(next, from.group, from.index);
  }
  if (!findGroup(next, to)) return next;
  if (side !== 'center') return split(next, to, side, tab);
  const g = findGroup(next, to)!;
  const existing = g.tabs.findIndex((t) => sameTab(t, tab));
  if (existing >= 0) return focusTab(next, to, existing);
  const at = index ?? (g.tabs.length ? g.active + 1 : 0);
  next = withGroup(next, to, (x) => ({ ...x, tabs: [...x.tabs.slice(0, at), tab, ...x.tabs.slice(at)], active: at }));
  return { ...next, active: to };
}

/** New sizes for the split at `path` (child indexes from the root). */
export function resize(ws: Workspace, path: number[], sizes: number[]): Workspace {
  const at = (node: PaneNode, rest: number[]): PaneNode => {
    if (node.kind === 'group') return node;
    if (!rest.length) return { ...node, sizes };
    return { ...node, children: node.children.map((c, i) => (i === rest[0] ? at(c, rest.slice(1)) : c)) };
  };
  return { ...ws, root: at(ws.root, path) };
}

/** A saved workspace made safe to use: unknown shapes dropped, at least one group. */
export function tidyWorkspace(raw: unknown): Workspace | null {
  const tab = (t: unknown): Tab | null => {
    const x = t as Partial<Tab> & { project?: unknown };
    if (!x || typeof x !== 'object' || typeof x.id !== 'string') return null;
    if (x.kind === 'cast') return typeof x.project === 'string' ? { kind: 'cast', project: x.project, id: x.id } : null;
    if (x.kind === 'graph') return { kind: 'graph', id: 'graph' };
    return x.kind === 'note' || x.kind === 'project' || x.kind === 'chapter' || x.kind === 'research' ? ({ kind: x.kind, id: x.id } as Tab) : null;
  };
  const node = (n: unknown): PaneNode | null => {
    const x = n as Partial<PaneNode> & { group?: Partial<Group>; children?: unknown[]; sizes?: unknown[] };
    if (!x || typeof x !== 'object') return null;
    if (x.kind === 'group' && x.group && typeof x.group.id === 'string') {
      const tabs = Array.isArray(x.group.tabs) ? x.group.tabs.map(tab).filter((t): t is Tab => !!t) : [];
      const active = typeof x.group.active === 'number' ? Math.max(0, Math.min(x.group.active, tabs.length - 1)) : 0;
      return { kind: 'group', group: { id: x.group.id, tabs, active } };
    }
    if (x.kind === 'split' && (x.dir === 'row' || x.dir === 'col') && Array.isArray(x.children)) {
      const kids: PaneNode[] = [];
      const sizes: number[] = [];
      x.children.forEach((c, i) => {
        const k = node(c);
        if (!k) return;
        kids.push(k);
        const s = Number(x.sizes?.[i]);
        sizes.push(Number.isFinite(s) && s > 0 ? s : 1);
      });
      if (!kids.length) return null;
      return kids.length === 1 ? kids[0] : { kind: 'split', dir: x.dir, children: kids, sizes };
    }
    return null;
  };
  const w = raw as Partial<Workspace>;
  if (!w || typeof w !== 'object') return null;
  const root = node(w.root);
  if (!root) return null;
  const ws: Workspace = { root, active: typeof w.active === 'string' ? w.active : '' };
  return findGroup(ws, ws.active) ? ws : { ...ws, active: groups(ws)[0].id };
}
