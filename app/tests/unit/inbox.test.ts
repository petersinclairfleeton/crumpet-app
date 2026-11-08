import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import { waitingFolders } from '../../src/data/selectors';
import { visibleIn } from '../../src/data/store';

const names = (store: AppStore) => waitingFolders(store.getState()).map((f) => (f.kind === 'notebook' ? f.notebook.name : f.stack.name));

describe('the Inbox: new things wait there until filed', () => {
  it('keeps new notebooks and stacks made from New until they’re filed, put in a stack or deleted', async () => {
    const store = new AppStore(new MemoryStorage(), () => 1_700_000_000_000);
    await store.load();
    const garden = store.createNotebook('Garden', null, false, true);
    const recipes = store.createNotebook('Recipes', null, false, true);
    const writing = store.createStack('Writing', false, true);
    const old = store.createNotebook('Old one');
    expect(names(store)).toEqual(['Garden', 'Recipes', 'Writing']);
    // Marked Filed.
    store.fileFolder(garden.id);
    expect(names(store)).toEqual(['Recipes', 'Writing']);
    // Put in a stack: the notebook is filed, and so is the stack it went into.
    store.setStack(recipes.id, writing.id);
    expect(names(store)).toEqual([]);
    expect(store.getState().settings.inboxFolders).toBeUndefined();
    // Deleted.
    const another = store.createStack('Another', false, true);
    store.deleteStack(another.id);
    expect(store.getState().settings.inboxFolders).toBeUndefined();
    // Made without asking (sync, the Templates notebook): not in the Inbox.
    expect(names(store)).not.toContain(old.name);
  });

  it('shows the Inbox for a new note unless the list already shows it; templates go there too', async () => {
    const store = new AppStore(new MemoryStorage(), () => 1_700_000_000_000);
    await store.load();
    const nb = store.createNotebook('Garden');
    store.setView({ kind: 'notebook', id: nb.id });
    store.showInbox();
    expect(store.getState().view.kind).toBe('inbox');
    store.setView({ kind: 'all' });
    store.showInbox();
    expect(store.getState().view.kind).toBe('all');
    store.setView({ kind: 'notebook', id: nb.id });
    const n = store.newFromTemplate({ title: 'Meeting', body: 'Notes' });
    expect(n.notebookId).toBeNull();
    expect(store.getState().view.kind).toBe('inbox');
    expect(visibleIn(store.getState(), { kind: 'inbox' }).map((x) => x.id)).toContain(n.id);
  });
});
