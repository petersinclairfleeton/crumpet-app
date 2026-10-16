// Crumpet on an iPhone, in the calm look (designs 4, 16, 17 and 18 of the Quiet
// Paper canvas): no bar of tabs. The library comes first, like Apple's Notes:
// grouped rows for Capture, Notebooks and Writing; a row opens its list, a
// note opens from the list, and Back returns a step at a time.

import { useState } from 'react';
import { useAppState, useAppStore, useSync } from './hooks';
import { projectWords, sameView, tagTree } from '../data/selectors';
import type { View } from '../data/types';
import { SettingsDialog } from './Settings';
import { statusText } from './SyncSettings';
import { IconBook, IconChevron, IconGraph, IconInbox, IconNote, IconPlus, IconSettings, IconStar, IconSun, IconTag, IconTrash } from './icons';
import { usePanes } from './panes';

export function PhoneLibrary({ onOpenView, onToday }: { onOpenView(v: View): void; onToday(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const panes = usePanes();
  const { state: sync } = useSync();
  const [settings, setSettings] = useState(false);
  const [more, setMore] = useState(false);
  const live = state.notes.filter((n) => n.trashedAt === null);
  const count = (f: (n: (typeof live)[number]) => boolean) => live.filter(f).length;
  const on = (v: View) => !state.query && sameView(state.view, v);
  const row = (key: string, icon: React.ReactNode, label: string, n: number | string | undefined, go: () => void, active = false) => (
    <li key={key}>
      <button type="button" className={`phone-row${active ? ' on' : ''}`} onClick={go}>
        {icon}
        <span className="grow">{label}</span>
        {n !== undefined && <span className="count">{typeof n === 'number' ? n.toLocaleString() : n}</span>}
        <IconChevron size={16} className="phone-chevron" />
      </button>
    </li>
  );
  const newBook = () => onOpenView({ kind: 'project', id: store.createProject('Untitled book').id });
  const status = state.temporary ? 'Not saving in this browser' : !sync.config ? 'Saved on this device' : statusText(sync.status).replace(/\.$/, '');
  return (
    <nav className="sidebar phone-library" aria-label="Notebooks">
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
      <div className="phone-top">
        <button type="button" className="icon-btn" aria-label="Settings" onClick={() => setSettings(true)}>
          <IconSettings size={22} />
        </button>
      </div>
      <h1 className="phone-big">Crumpet</h1>
      <p className="phone-sub">{status}</p>

      <section aria-label="Capture">
        <h2 className="phone-label">Capture</h2>
        <ul className="phone-group">
          {row('inbox', <IconInbox size={20} />, 'Inbox', count((n) => !n.notebookId && !n.projectId), () => onOpenView({ kind: 'inbox' }), on({ kind: 'inbox' }))}
          {row('all', <IconNote size={20} />, 'All notes', count((n) => !n.projectId), () => onOpenView({ kind: 'all' }), on({ kind: 'all' }))}
          {row('fav', <IconStar size={20} />, 'Favourites', count((n) => n.favorite), () => onOpenView({ kind: 'favorites' }), on({ kind: 'favorites' }))}
        </ul>
      </section>

      {state.notebooks.length > 0 && (
        <section aria-label="Notebooks">
          <h2 className="phone-label">Notebooks</h2>
          <ul className="phone-group">
            {state.notebooks.map((nb) =>
              row(nb.id, <span className="phone-nb" style={{ background: nb.color }} aria-hidden="true" />, nb.name, count((n) => n.notebookId === nb.id), () => onOpenView({ kind: 'notebook', id: nb.id }), on({ kind: 'notebook', id: nb.id })),
            )}
          </ul>
        </section>
      )}

      <section aria-label="Writing">
        <h2 className="phone-label">Writing</h2>
        <ul className="phone-group">
          {state.projects.map((p) => row(p.id, <IconBook size={20} />, p.name, projectWords(p, state.chapters), () => onOpenView({ kind: 'project', id: p.id })))}
          {!state.projects.length && row('newbook', <IconBook size={20} />, 'Start a book', undefined, newBook)}
        </ul>
      </section>

      <section aria-label="More">
        <div className="phone-label phone-more">
          <h2>More</h2>
          <button type="button" className="link-btn" aria-expanded={more} onClick={() => setMore(!more)}>
            {more ? 'Less' : 'Tags, graph, trash'}
          </button>
        </div>
        {more && (
          <ul className="phone-group">
            {state.projects.length > 0 && row('newbook', <IconPlus size={20} />, 'New book', undefined, newBook)}
            {row('today', <IconSun size={20} />, 'Today', undefined, onToday)}
            {tagTree(state.notes).map((t) => row(`tag:${t.path}`, <IconTag size={20} />, `#${t.name}`, t.count, () => onOpenView({ kind: 'tag', tag: t.path })))}
            {row('graph', <IconGraph size={20} />, 'Graph of links', undefined, () => panes.open({ kind: 'graph', id: 'graph' }))}
            {row('trash', <IconTrash size={20} />, 'Trash', state.notes.filter((n) => n.trashedAt !== null).length || undefined, () => onOpenView({ kind: 'trash' }))}
          </ul>
        )}
      </section>
    </nav>
  );
}
