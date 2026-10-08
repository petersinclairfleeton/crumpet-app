// Folding the sidebar and the note list away, and bringing them back: a «
// button on each, a button in the top bar to show it again, and a peek (it
// slides out over the page while the mouse rests on the window's edge).

import { createContext, useContext } from 'react';
import { useAppState, useAppStore } from './hooks';
import { IconFoldLeft, IconFoldRight, IconListPanel, IconRightPanel, IconSidebar } from './icons';

/** Which folded-away panel is peeking out (shown over the page while the mouse is on it). */
export type Peek = 'sidebar' | 'list' | 'right' | null;
export const PeekContext = createContext<{ peek: Peek; open(p: Peek): void; leave(): void; stay(): void; close(): void }>({ peek: null, open() {}, leave() {}, stay() {}, close() {} });

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
type Panel = 'sidebar' | 'list' | 'right';
const panelName = (what: Panel, project: boolean) => (what === 'sidebar' ? 'sidebar' : what === 'right' ? 'right sidebar' : project ? 'outline' : 'note list');
const shortcut = (what: Panel) => (what === 'sidebar' ? `${isMac ? '⌘' : 'Ctrl+'}\\` : what === 'right' ? `${isMac ? '⌘⌥' : 'Ctrl+Alt+'}\\` : `${isMac ? '⌘⇧' : 'Ctrl+Shift+'}\\`);

/** «: folds the sidebar or the list away. While it's peeking out, » keeps it open instead. */
export function FoldButton({ what }: { what: Panel }) {
  const state = useAppState();
  const store = useAppStore();
  const { peek, close } = useContext(PeekContext);
  const name = panelName(what, state.view.kind === 'project');
  const peeking = peek === what;
  const label = peeking ? `Keep the ${name} open` : `Hide the ${name}`;
  return (
    <button
      type="button"
      className="icon-btn fold-btn"
      aria-label={label}
      title={`${label} (${shortcut(what)})`}
      onClick={() => {
        close();
        store.updateLayout(what === 'sidebar' ? { sidebar: peeking ? 'full' : 'hidden' } : what === 'right' ? { right: peeking } : { list: peeking });
      }}
    >
      {/* The right sidebar folds the other way. */}
      {peeking === (what === 'right') ? <IconFoldLeft size={16} /> : <IconFoldRight size={16} />}
    </button>
  );
}

/** Brings a folded-away sidebar or list back; resting the mouse on it lets it peek out. */
export function ShowButton({ what }: { what: Panel }) {
  const state = useAppState();
  const store = useAppStore();
  const { open, leave, close } = useContext(PeekContext);
  const label = `Show the ${panelName(what, state.view.kind === 'project')}`;
  return (
    <button
      type="button"
      className="icon-btn show-btn"
      aria-label={label}
      title={`${label} (${shortcut(what)})`}
      onMouseEnter={() => open(what)}
      onMouseLeave={leave}
      onClick={() => {
        close();
        store.updateLayout(what === 'sidebar' ? { sidebar: 'full' } : what === 'right' ? { right: true } : { list: true });
      }}
    >
      {what === 'sidebar' ? <IconSidebar size={17} /> : what === 'right' ? <IconRightPanel size={17} /> : <IconListPanel size={17} />}
    </button>
  );
}
