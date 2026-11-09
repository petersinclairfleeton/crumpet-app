// Crumpet on an iPhone, in the calm look (designs 4, 16, 17 and 18 of the Quiet
// Paper canvas): no bar of tabs. The library comes first, like Apple's Notes:
// grouped rows for Favourites, then Capture, Organise, Distill and Express (the
// computer's sidebar, in its order), tags as chips, then the graph and Trash; a row opens
// its list, a note opens from the list, and Back returns a step at a time.

import { useState } from 'react';
import { useAppState, useAppStore, useSync } from './hooks';
import { type TagNode, projectWords, sameView, tagTree, waitingFolders } from '../data/selectors';
import type { View } from '../data/types';
import { SettingsDialog } from './Settings';
import { statusText } from './SyncSettings';
import { IconBook, IconChevron, IconGraph, IconHelp, IconInbox, IconNote, IconPlus, IconSettings, IconStar, IconSun, IconTrash } from './icons';
import { openGuide } from './guide';
import { canSendFeedback, openFeedback } from './help';
import { usePanes } from './panes';

export function PhoneLibrary({ onOpenView, onToday }: { onOpenView(v: View): void; onToday(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const panes = usePanes();
  const { state: sync } = useSync();
  const [settings, setSettings] = useState(false);
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
  const tags = flatTags(tagTree(state.notes));
  // Distill's notebooks are those marked so, or in a stack marked so (as on the computer).
  const isDistill = (nb: (typeof state.notebooks)[number]) => !!nb.distill || !!state.stacks.find((x) => x.id === nb.stackId)?.distill;
  const shown = state.notebooks;
  const organise = shown.filter((nb) => !isDistill(nb));
  const distill = shown.filter(isDistill);
  const notebookRow = (nb: (typeof state.notebooks)[number]) =>
    row(nb.id, <span className="phone-nb" style={{ background: nb.color }} aria-hidden="true" />, nb.name, count((n) => n.notebookId === nb.id), () => onOpenView({ kind: 'notebook', id: nb.id }), on({ kind: 'notebook', id: nb.id }));
  const newBook = () => onOpenView({ kind: 'project', id: store.createProject('Untitled book').id });
  const status = state.temporary ? 'Not saving in this browser' : !sync.config ? 'Saved here' : statusText(sync.status).replace(/\.$/, '');
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

      {/* The same groups as the computer's sidebar (CODE), in the same order: Favourites at the top, then Capture, Organise, Distill and Express. */}
      <section aria-label="Favourites">
        <ul className="phone-group">{row('fav', <IconStar size={20} />, 'Favourites', count((n) => n.favorite), () => onOpenView({ kind: 'favorites' }), on({ kind: 'favorites' }))}</ul>
      </section>

      <section aria-label="Capture">
        <h2 className="phone-label">Capture</h2>
        <ul className="phone-group">
          {row('inbox', <IconInbox size={20} />, 'Inbox', count((n) => !n.notebookId && !n.projectId) + waitingFolders(state).length, () => onOpenView({ kind: 'inbox' }), on({ kind: 'inbox' }))}
          {row('today', <IconSun size={20} />, 'Today', undefined, onToday)}
        </ul>
      </section>

      <section aria-label="Organise">
        <h2 className="phone-label">Organise</h2>
        <ul className="phone-group">
          {row('all', <IconNote size={20} />, 'All notes', count((n) => !n.projectId), () => onOpenView({ kind: 'all' }), on({ kind: 'all' }))}
          {organise.map(notebookRow)}
        </ul>
      </section>

      {distill.length > 0 && (
        <section aria-label="Distill">
          <h2 className="phone-label">Distill</h2>
          <ul className="phone-group">{distill.map(notebookRow)}</ul>
        </section>
      )}

      <section aria-label="Express">
        <div className="phone-label phone-head">
          <h2>Express</h2>
          {state.projects.length > 0 && (
            <button type="button" className="icon-btn" aria-label="New book" onClick={newBook}>
              <IconPlus size={20} />
            </button>
          )}
        </div>
        <ul className="phone-group">
          {/* A book's number is its words, said as words (beside a notebook the number is its notes). */}
          {state.projects.map((p) => row(p.id, <IconBook size={20} />, p.name, wordsLabel(projectWords(p, state.chapters)), () => onOpenView({ kind: 'project', id: p.id })))}
          {!state.projects.length && row('newbook', <IconBook size={20} />, 'Start a book', undefined, newBook)}
        </ul>
      </section>

      {/* Tags as a cloud of chips, as Apple's Notes shows them. */}
      {tags.length > 0 && (
        <section aria-label="Tags">
          <h2 className="phone-label">Tags</h2>
          <div className="phone-tags">
            {tags.map((t) => (
              <button key={t.path} type="button" className={`phone-tag${on({ kind: 'tag', tag: t.path }) ? ' on' : ''}`} onClick={() => onOpenView({ kind: 'tag', tag: t.path })}>
                #{t.path}
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-label="More">
        <ul className="phone-group">
          {row('graph', <IconGraph size={20} />, 'Graph of links', undefined, () => panes.open({ kind: 'graph', id: 'graph' }))}
          {row('trash', <IconTrash size={20} />, 'Trash', state.notes.filter((n) => n.trashedAt !== null).length || undefined, () => onOpenView({ kind: 'trash' }))}
        </ul>
      </section>

      <section aria-label="Help">
        <h2 className="phone-label">Help</h2>
        <ul className="phone-group">
          {row('guide', <IconHelp size={20} />, 'Guide to Crumpet', undefined, openGuide)}
          {canSendFeedback && row('report', <IconHelp size={20} />, 'Report a problem', undefined, () => openFeedback())}
        </ul>
      </section>
    </nav>
  );
}

/** Every tag, nested ones after the tag they're in. */
function flatTags(nodes: TagNode[]): TagNode[] {
  return nodes.flatMap((t) => [t, ...flatTags(t.children)]);
}

/** 12345 → "12,345 words". */
function wordsLabel(n: number): string {
  return `${n.toLocaleString()} word${n === 1 ? '' : 's'}`;
}
