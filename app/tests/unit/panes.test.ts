import { describe, expect, it } from 'vitest';
import { type Tab, type Workspace, activeTab, closeTab, closeWhere, drop, emptyWorkspace, groups, open, reveal, shownTabs, split, tidyWorkspace } from '../../src/data/panes';

const note = (id: string): Tab => ({ kind: 'note', id });
const ids = (ws: Workspace) => groups(ws).map((g) => g.tabs.map((t) => t.id));

describe('panes', () => {
  it('opens in place, or as a new tab, and shows a tab again rather than opening it twice', () => {
    let ws = emptyWorkspace(note('a'));
    ws = open(ws, note('b'));
    expect(ids(ws)).toEqual([['b']]);
    ws = open(ws, note('c'), 'tab');
    expect(ids(ws)).toEqual([['b', 'c']]);
    ws = open(ws, note('b'));
    expect(ids(ws)).toEqual([['b', 'c']]);
    expect(activeTab(ws)).toEqual(note('b'));
  });

  it('splits beside a pane, in rows and columns, and the new pane is where things open', () => {
    let ws = emptyWorkspace(note('a'));
    const first = groups(ws)[0].id;
    ws = split(ws, first, 'right', note('b'));
    ws = split(ws, ws.active, 'right', note('c'));
    expect(ws.root.kind === 'split' && ws.root.dir).toBe('row');
    expect(ids(ws)).toEqual([['a'], ['b'], ['c']]);
    ws = split(ws, first, 'bottom', note('d'));
    expect(ids(ws)).toEqual([['a'], ['d'], ['b'], ['c']]);
    expect(activeTab(ws)).toEqual(note('d'));
    expect(shownTabs(ws).map((t) => t.id)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('drags a tab to another pane, beside one, or along its own tab bar', () => {
    let ws = emptyWorkspace(note('a'));
    ws = open(ws, note('b'), 'tab');
    ws = open(ws, note('c'), 'tab');
    const g = groups(ws)[0].id;
    // Along the tab bar: c to the front.
    ws = drop(ws, note('c'), g, 'center', { group: g, index: 2 }, 0);
    expect(ids(ws)).toEqual([['c', 'a', 'b']]);
    // Out to the right: a new pane, and the tab leaves the old one.
    ws = drop(ws, note('a'), g, 'right', { group: g, index: 1 });
    expect(ids(ws)).toEqual([['c', 'b'], ['a']]);
    // The new pane's only tab dragged into the first: that pane goes.
    const right = groups(ws)[1].id;
    ws = drop(ws, note('a'), g, 'center', { group: right, index: 0 });
    expect(ids(ws)).toEqual([['c', 'a', 'b']]);
    expect(ws.root.kind).toBe('group');
    // Something dragged in from the list is copied, not moved.
    ws = drop(ws, note('x'), g, 'bottom');
    expect(ids(ws)).toEqual([['c', 'a', 'b'], ['x']]);
  });

  it('closes tabs and empty panes, keeps one pane, and forgets things that are gone', () => {
    let ws = emptyWorkspace(note('a'));
    ws = split(ws, ws.active, 'right', note('b'));
    ws = closeTab(ws, ws.active, 0);
    expect(ids(ws)).toEqual([['a']]);
    ws = closeTab(ws, ws.active, 0);
    expect(ids(ws)).toEqual([[]]);
    ws = open(ws, note('a'));
    ws = split(ws, ws.active, 'bottom', note('gone'));
    ws = closeWhere(ws, (t) => t.id === 'gone');
    expect(ids(ws)).toEqual([['a']]);
    expect(reveal(ws, note('a'))).not.toBeNull();
    expect(reveal(ws, note('zzz'))).toBeNull();
  });

  it('reads back a saved workspace, dropping anything it doesn’t understand', () => {
    let ws = emptyWorkspace(note('a'));
    ws = split(ws, ws.active, 'right', { kind: 'cast', project: 'p', id: 'm' });
    expect(tidyWorkspace(JSON.parse(JSON.stringify(ws)))).toEqual(ws);
    expect(tidyWorkspace({ root: { kind: 'split', dir: 'row', children: [{ kind: 'group', group: { id: 'g', tabs: [{ kind: 'weird', id: 1 }, note('a')], active: 5 } }, 7], sizes: [] }, active: 'nope' })).toEqual({ root: { kind: 'group', group: { id: 'g', tabs: [note('a')], active: 0 } }, active: 'g' });
    expect(tidyWorkspace(null)).toBeNull();
  });
});
