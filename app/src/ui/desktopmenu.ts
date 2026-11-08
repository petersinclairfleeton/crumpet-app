// The Mac and Windows apps' menu bar (desktop/main.cjs): each item sends an id,
// and here the page does what its own button or shortcut does. Items with a
// shortcut the page already knows are played as that key press, so the menu
// and the keyboard always do exactly the same thing.

import { useEffect, useRef } from 'react';
import { desktop } from '../data/desktop';
import { currentHelped } from './helpers';
import { openGuide } from './guide';
import { openFeedback, openShortcuts, openWhatsNew } from './help';
import { openReader } from './reader';
import { focusSearch, newThing } from './Sidebar';
import type { AppStore } from '../data/store';
import { boardDoc, emptyBoard } from '../data/board';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

export interface MenuActions {
  newNote(): void;
  newDailyNote(): void;
  newProject(): void;
  openToday(): void;
  openSettings(): void;
  openCommands(): void;
  upload(): void;
  openStats(): void;
  store: AppStore;
}

type Key = { code: string; key: string; shift?: boolean; alt?: boolean; plain?: boolean };
const k = (code: string, key: string, more: Omit<Key, 'code' | 'key'> = {}): Key => ({ code, key, ...more });

/** Menu items that are a key press the page already answers. */
export const MENU_KEYS: Record<string, Key> = {
  'find-anything': k('KeyO', 'o'),
  'find-anything-k': k('KeyK', 'k'),
  find: k('KeyF', 'f'),
  goto: k('F5', 'F5', { plain: true }),
  footnote: k('KeyF', 'f', { alt: true }),
  comment: k('KeyM', 'm', { alt: true }),
  thesaurus: k('F7', 'F7', { plain: true, shift: true }),
  snapshot: k('KeyS', 's', { alt: true }),
  bold: k('KeyB', 'b'),
  italic: k('KeyI', 'i'),
  underline: k('KeyU', 'u'),
  strike: k('KeyX', 'x', { shift: true }),
  code: k('KeyE', 'e'),
  paragraph: k('Digit0', '0', { alt: true }),
  heading1: k('Digit1', '1', { alt: true }),
  heading2: k('Digit2', '2', { alt: true }),
  heading3: k('Digit3', '3', { alt: true }),
  quote: k('KeyQ', 'q', { alt: true }),
  bullet: k('KeyL', 'l', { alt: true }),
  numbered: k('KeyN', 'n', { alt: true }),
  todo: k('KeyT', 't', { alt: true }),
  'align-left': k('KeyL', 'l', { shift: true }),
  'align-center': k('KeyE', 'e', { shift: true }),
  'align-right': k('KeyR', 'r', { shift: true }),
  'align-justify': k('KeyJ', 'j', { shift: true }),
  font: k('KeyD', 'd'),
  clear: k('Space', ' '),
  'toggle-sidebar': k('Backslash', '\\'),
  'toggle-list': k('Backslash', '\\', { shift: true }),
  'toggle-right': k('Backslash', '\\', { alt: true }),
  focus: k('KeyF', 'f', { shift: true }),
  graph: k('KeyG', 'g'),
  commands: k('KeyP', 'p'),
};

// A shortcut must act once, whether the menu took the key press (and passed it on
// here) or the page got it as well: whichever comes second within a moment is dropped.
let lastReal = { code: '', at: 0 };
let lastPlayed = { code: '', at: 0 };
const SAME_PRESS_MS = 300;

/** Plays a key press where the person is typing (or on the page), as if it had been pressed. */
export function press(key: Key): void {
  const now = performance.now();
  if (lastReal.code === key.code && now - lastReal.at < SAME_PRESS_MS) return;
  lastPlayed = { code: key.code, at: now };
  const el = (document.activeElement as HTMLElement | null) ?? document.body;
  const mod = !key.plain;
  el.dispatchEvent(new KeyboardEvent('keydown', { key: key.key, code: key.code, metaKey: mod && isMac, ctrlKey: mod && !isMac, shiftKey: !!key.shift, altKey: !!key.alt, bubbles: true, cancelable: true }));
}

/** Asks the open note to print, or to show its download choices. */
export const NOTE_MENU = 'crumpet-note-menu';

/** Runs one menu bar item. */
export function runMenuCommand(id: string, a: MenuActions): void {
  const key = MENU_KEYS[id];
  if (key) return press(key);
  const ed = currentHelped()?.editor;
  switch (id) {
    case 'new-note':
      return a.newNote();
    case 'new-daily':
      return a.newDailyNote();
    case 'new-notebook':
    case 'new-stack':
    case 'new-board':
    case 'new-template':
    case 'new-dnotebook':
    case 'new-dstack': {
      // The sidebar names them in place; with it folded away, it opens first.
      const kind = id.slice(4) as 'notebook' | 'stack' | 'board' | 'template' | 'dnotebook' | 'dstack';
      if (!newThing(kind)) {
        a.store.updateLayout({ sidebar: 'full', list: true, bookSidebar: 'full' });
        // In a book the outline is the sidebar: made straight away there instead.
        setTimeout(() => {
          if (newThing(kind)) return;
          const st = a.store;
          if (kind === 'notebook' || kind === 'dnotebook') st.setView({ kind: 'notebook', id: st.createNotebook('Untitled notebook', null, kind === 'dnotebook').id });
          else if (kind === 'stack' || kind === 'dstack') st.createStack('Untitled stack', kind === 'dstack');
          else if (kind === 'board') st.createNote({ doc: boardDoc(emptyBoard()) });
          else a.newNote();
        }, 100);
      }
      return;
    }
    case 'new-manuscript':
      return a.newProject();
    case 'today':
      return a.openToday();
    case 'upload':
      return a.upload();
    case 'settings':
      return a.openSettings();
    case 'search':
      return focusSearch();
    case 'print':
    case 'export':
      window.dispatchEvent(new CustomEvent(NOTE_MENU, { detail: id }));
      return;
    case 'check':
      return a.store.updateLayout({ right: true, rightTab: 'check' });
    case 'stats':
      return a.openStats();
    case 'track':
      return a.store.updateSettings({ trackChanges: !a.store.getState().settings.trackChanges });
    case 'page-view': {
      const pv = a.store.getState().settings.pageView;
      return a.store.updateSettings({ pageView: { ...pv, notes: !pv?.notes } });
    }
    case 'reader':
      if (ed) openReader(ed);
      return;
    case 'guide':
      openGuide();
      return;
    case 'shortcuts':
      openShortcuts();
      return;
    case 'whats-new':
      openWhatsNew();
      return;
    case 'idea':
      openFeedback('An idea');
      return;
  }
}

/** Listens to the desktop app's menu bar, if there is one. */
export function useDesktopMenu(actions: MenuActions): void {
  const latest = useRef(actions);
  latest.current = actions;
  useEffect(() => {
    if (!desktop?.onCommand) return;
    desktop.onCommand((id) => runMenuCommand(id, latest.current));
    const onKey = (e: KeyboardEvent) => {
      if (!e.isTrusted || !(e.metaKey || e.ctrlKey || e.altKey || /^F\d/.test(e.code))) return;
      const now = performance.now();
      if (lastPlayed.code === e.code && now - lastPlayed.at < SAME_PRESS_MS) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      lastReal = { code: e.code, at: now };
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}
