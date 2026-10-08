import { useAppState, useAppStore } from './hooks';
import { viewTitle } from '../data/selectors';
import { IconMenu, IconPlus, IconSearch } from './icons';
import { LayoutMenu } from './layout';
import { ShowButton } from './fold';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar({ onMenu, onNewNote }: { onMenu(): void; onNewNote(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const nb = state.view.kind === 'notebook' ? store.notebook(state.view.id) : undefined;
  const stack = store.stack(nb?.stackId ?? null);
  const listHidden = state.settings.layout?.list === false;
  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu-btn" aria-label="Notebooks and tags" onClick={onMenu}>
        <IconMenu size={18} />
      </button>
      {state.settings.layout?.sidebar === 'hidden' && <ShowButton what="sidebar" />}
      {listHidden && <ShowButton what="list" />}
      {/* Where you are: a notebook's stack, or the view's name when the list (which has it as its heading) is hidden. */}
      <p className="crumbs">
        {(stack || listHidden) && (
          <>
            {stack && (
              <>
                <span>{stack.name}</span>
                <span aria-hidden="true">›</span>
              </>
            )}
            <span className="here">{state.query ? 'Search' : viewTitle(state.view, state)}</span>
          </>
        )}
      </p>
      <label className="search">
        <IconSearch size={14} />
        <span className="visually-hidden">Search notes</span>
        <input
          id="search"
          type="search"
          autoComplete="off"
          placeholder="Search notes"
          value={state.query}
          onChange={(e) => store.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              store.setQuery('');
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </label>
      <LayoutMenu />
      <button type="button" className="icon-btn new-btn" aria-label="New note" onClick={onNewNote}>
        <IconPlus size={18} />
      </button>
    </header>
  );
}
