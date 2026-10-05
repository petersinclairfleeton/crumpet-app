import { type Page, expect, test } from '@playwright/test';

// Every test starts in a fresh browser profile, so Crumpet starts empty: everything is created here.

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Notebooks' });
const list = (page: Page) => page.getByRole('region', { name: 'Notes', exact: true });

async function open(page: Page) {
  await page.goto('/');
  await expect(list(page)).toBeVisible();
}

async function newNote(page: Page, title: string, body = '') {
  await sidebar(page).getByRole('button', { name: 'New Note', exact: true }).click();
  await expect(page.getByLabel('Title')).toBeFocused();
  await page.keyboard.type(title);
  if (body) {
    await page.keyboard.press('Enter');
    await page.keyboard.type(body);
  }
}

async function newNotebook(page: Page, name: string) {
  await sidebar(page).getByRole('button', { name: 'New notebook or stack' }).click();
  await page.getByRole('button', { name: 'New notebook', exact: true }).click();
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
  await expect(list(page).locator('h1')).toHaveText(name);
}

async function newStack(page: Page, name: string) {
  await sidebar(page).getByRole('button', { name: 'New notebook or stack' }).click();
  await page.getByRole('button', { name: 'New stack' }).click();
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
  await expect(sidebar(page).locator('.stack-row', { hasText: name })).toBeVisible();
}

test('starts empty, with no notebooks, stacks or notes', async ({ page }) => {
  await open(page);
  await expect(list(page).locator('.card')).toHaveCount(0);
  await expect(list(page)).toContainText('No notes yet');
  await expect(sidebar(page).locator('.nb-row, .stack-row')).toHaveCount(0);
  await expect(sidebar(page)).toContainText('Notebooks group your notes; stacks group notebooks.');
  await expect(page.getByRole('region', { name: 'Note', exact: true })).toContainText('Choose a note, or start a new one.');
});

test('a first note needs no notebook and survives a reload', async ({ page }) => {
  await open(page);
  await newNote(page, 'Shopping list', 'Milk and eggs');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- bread');
  await expect(list(page).locator('.card.selected')).toContainText('Milk and eggs · bread');
  await expect(page.locator('.nb-picker select')).toHaveValue('');
  await page.waitForTimeout(700); // typing pause, then it saves
  await page.reload();
  await list(page).locator('.card', { hasText: 'Shopping list' }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Shopping list');
  await expect(page.locator('.note-editor .blk-bullet')).toHaveText('bread');
});

test('create notebooks and stacks, file notes, and see a stack’s notes together', async ({ page }) => {
  await open(page);
  await newStack(page, 'Projects');
  // An empty stack offers to add a notebook.
  await sidebar(page).getByRole('button', { name: 'Add a notebook' }).click();
  await page.keyboard.type('Novel');
  await page.keyboard.press('Enter');
  await expect(list(page).locator('h1')).toHaveText('Novel');
  await newNote(page, 'Opening scene', 'She counted the steps.');

  await newNotebook(page, 'Recipes');
  await newNote(page, 'Soda bread', 'Buttermilk and flour.');
  // Put Recipes in the stack through its menu.
  await sidebar(page).getByRole('button', { name: 'Recipes options' }).click();
  await page.getByRole('button', { name: 'Put in a stack…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Projects' }).click();

  await sidebar(page).locator('.stack-row').getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(list(page).locator('h1')).toHaveText('Projects');
  await expect(list(page).locator('.card')).toHaveCount(2);

  // Move a note out of any notebook.
  await list(page).locator('.card', { hasText: 'Soda bread' }).click();
  await page.locator('.nb-picker select').selectOption({ label: 'No notebook' });
  await expect(list(page).locator('.card')).toHaveCount(1);
  await sidebar(page).getByRole('button', { name: 'All Notes' }).click();
  await expect(list(page).locator('.card')).toHaveCount(2);
});

test('rename and delete stacks and notebooks', async ({ page }) => {
  await open(page);
  await newStack(page, 'Areas');
  await sidebar(page).getByRole('button', { name: 'Areas options' }).click();
  await page.getByRole('button', { name: 'New notebook in this stack…' }).click();
  await page.keyboard.type('Journal');
  await page.keyboard.press('Enter');
  await newNote(page, 'Monday', 'Rain all day.');

  await sidebar(page).getByRole('button', { name: 'Areas options' }).click();
  await page.getByRole('button', { name: 'Rename stack…' }).click();
  await page.getByLabel('New stack name').fill('2 Areas');
  await page.keyboard.press('Enter');
  await expect(sidebar(page).locator('.stack-row')).toContainText('2 Areas');

  // Deleting the stack keeps its notebook and notes.
  await sidebar(page).getByRole('button', { name: '2 Areas options' }).click();
  await page.getByRole('button', { name: 'Delete stack…' }).click();
  await expect(page.getByRole('dialog')).toContainText('Its 1 notebook and their notes stay');
  await page.getByRole('button', { name: 'Delete stack', exact: true }).click();
  await expect(sidebar(page).locator('.stack-row')).toHaveCount(0);
  await expect(sidebar(page).locator('.nb-row', { hasText: 'Journal' })).toBeVisible();

  // Deleting the notebook (even the only one) moves its notes to the Trash.
  await sidebar(page).getByRole('button', { name: 'Journal options' }).click();
  await page.getByRole('button', { name: 'Rename…' }).click();
  await page.getByLabel('New name').fill('Diary');
  await page.keyboard.press('Enter');
  await sidebar(page).getByRole('button', { name: 'Diary options' }).click();
  await page.getByRole('button', { name: 'Delete notebook…' }).click();
  await expect(page.getByRole('dialog')).toContainText('Its 1 note will move to the Trash');
  await page.getByRole('button', { name: 'Delete notebook', exact: true }).click();
  await expect(sidebar(page).locator('.nb-row')).toHaveCount(0);
  await sidebar(page).getByRole('button', { name: /^Trash/ }).click();
  await expect(list(page)).toContainText('Monday');
});

test('tags: add one, find it in the sidebar, remove it', async ({ page }) => {
  await open(page);
  await newNote(page, 'Plot idea', 'A visitor on the stairs.');
  await page.getByRole('button', { name: 'Add tag' }).click();
  await page.keyboard.type('Big Idea');
  await page.keyboard.press('Enter');
  await expect(page.locator('.tag-chip')).toHaveText(/#big-idea/);
  await sidebar(page).getByRole('button', { name: 'Tags' }).click();
  await sidebar(page).getByRole('button', { name: /#big-idea/ }).click();
  await expect(list(page).locator('h1')).toHaveText('#big-idea');
  await expect(list(page).locator('.card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove tag big-idea' }).click();
  await expect(list(page).locator('.card')).toHaveCount(0);
});

test('search finds notes across notebooks and offers notebooks to jump to', async ({ page }) => {
  await open(page);
  await newNotebook(page, 'Lighthouse');
  await newNote(page, 'Opening', 'She counted the steps every night.');
  await newNote(page, 'Tides', 'The causeway floods twice.');
  await sidebar(page).getByRole('button', { name: 'All Notes' }).click();
  await newNote(page, 'Groceries', 'Milk.');
  await page.locator('.note-editor').click();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#search')).toBeFocused();
  await page.keyboard.type('lighthouse');
  await expect(list(page).locator('h1')).toHaveText('Search results');
  await expect(list(page).locator('.card')).toHaveCount(2);
  await list(page).locator('.jumps').getByRole('button', { name: 'Lighthouse' }).click();
  await expect(list(page).locator('h1')).toHaveText('Lighthouse');
  await page.locator('#search').fill('causeway floods');
  await expect(list(page).locator('.card')).toHaveCount(1);
  await page.locator('#search').fill('nothing matches this');
  await expect(list(page)).toContainText('No notes match');
});

test('Trash: move a note there, restore it, then delete it forever', async ({ page }) => {
  await open(page);
  await newNote(page, 'Villain who is right', 'His plan would work.');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Move to Trash' }).click();
  await expect(list(page)).not.toContainText('Villain who is right');
  await sidebar(page).getByRole('button', { name: /^Trash/ }).click();
  await list(page).locator('.card', { hasText: 'Villain' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Trash' })).toContainText('This note is in the Trash');
  await expect(page.locator('.note-editor')).toHaveAttribute('contenteditable', 'false');
  await page.getByRole('button', { name: 'Restore' }).click();
  await sidebar(page).getByRole('button', { name: 'All Notes' }).click();
  await expect(list(page)).toContainText('Villain who is right');

  await list(page).locator('.card', { hasText: 'Villain who is right' }).click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Move to Trash' }).click();
  await sidebar(page).getByRole('button', { name: /^Trash/ }).click();
  await list(page).locator('.card', { hasText: 'Villain' }).click();
  await page.getByRole('button', { name: 'Delete forever' }).click();
  await expect(list(page)).toContainText('The Trash is empty');
});

test('Favorites: starring a note keeps it there', async ({ page }) => {
  await open(page);
  await newNote(page, 'Weekly review', 'Empty the inbox.');
  await page.getByRole('button', { name: 'Add to Favorites' }).click();
  await sidebar(page).getByRole('button', { name: /^Favorites/ }).click();
  await expect(list(page).locator('h1')).toHaveText('Favorites');
  await expect(list(page)).toContainText('Weekly review');
  await page.getByRole('button', { name: 'Remove from Favorites' }).click();
  await expect(list(page)).not.toContainText('Weekly review');
  await expect(list(page)).toContainText('Star a note to keep it in Favorites');
});

test('settings: dark appearance and a different accent', async ({ page }) => {
  await open(page);
  await sidebar(page).locator('.account').click();
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Blueberry' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))).toBe('#3E6DB5');
  await page.getByLabel('Your name').fill('Peter Sinclair-Fleeton');
  await expect(sidebar(page).locator('.avatar')).toHaveText('PS');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('example notes from the first version are cleared on upgrade, but your own stay', async ({ page }) => {
  // Put version-1 data in the browser's database from a page that doesn't run the app, then open the app.
  await page.goto('/src/ui/theme.ts'); // any same-site page that isn't the app
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const del = indexedDB.deleteDatabase('crumpet');
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
      del.onblocked = () => resolve();
    });
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('crumpet', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('notes', { keyPath: 'id' });
        req.result.createObjectStore('notebooks', { keyPath: 'id' });
        req.result.createObjectStore('settings');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction(['notes', 'notebooks'], 'readwrite');
    const t = Date.now() - 3_600_000;
    const doc = { blocks: [{ id: 'b1', type: 'paragraph', runs: [{ text: 'text', marks: [] }] }] };
    tx.objectStore('notebooks').put({ id: 'inbox', name: 'Inbox', color: '#C98A4B', stack: null, createdAt: t });
    tx.objectStore('notebooks').put({ id: 'mine', name: 'Poems', color: '#6F93BF', stack: '2 Areas', createdAt: t });
    tx.objectStore('notes').put({ id: 'w', notebookId: 'inbox', title: 'Welcome to Crumpet', doc, tags: [], pinned: false, createdAt: t, updatedAt: t, trashedAt: null });
    tx.objectStore('notes').put({ id: 'p', notebookId: 'mine', title: 'Sonnet', doc, tags: [], pinned: true, createdAt: t, updatedAt: t, trashedAt: null });
    await new Promise((r) => (tx.oncomplete = r));
    db.close();
  });
  await page.goto('/');
  await expect(list(page).locator('.card')).toHaveCount(1);
  await expect(list(page)).toContainText('Sonnet');
  await expect(sidebar(page).locator('.stack-row')).toContainText('2 Areas');
  await expect(sidebar(page).locator('.nb-row')).toHaveText(/Poems/);
  await sidebar(page).getByRole('button', { name: /^Favorites/ }).click();
  await expect(list(page)).toContainText('Sonnet');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('list, then note, then back; the menu opens the notebooks', async ({ page }) => {
    await open(page);
    await page.locator('.topbar').getByRole('button', { name: 'New note' }).click();
    await page.keyboard.type('Names for the island');
    await expect(list(page)).toBeHidden();
    await page.getByRole('button', { name: 'Back to notes' }).click();
    await expect(list(page)).toBeVisible();
    await list(page).locator('.card', { hasText: 'Names for the island' }).click();
    await expect(page.getByLabel('Title')).toHaveValue('Names for the island');
    await page.getByRole('button', { name: 'Back to notes' }).click();
    await page.getByRole('button', { name: 'Notebooks and tags' }).click();
    await expect(sidebar(page)).toBeVisible();
    await sidebar(page).getByRole('button', { name: 'Create a notebook' }).click();
    await page.keyboard.type('Journal');
    await page.keyboard.press('Enter');
    await expect(sidebar(page)).toBeHidden();
    await expect(list(page).locator('h1')).toHaveText('Journal');
  });
});

test('settings: notes start in this browser, and Google Drive can be connected', async ({ page }) => {
  await open(page);
  await sidebar(page).locator('.account').click();
  const where = page.getByRole('group', { name: 'Where your notes live' });
  await expect(where).toContainText('In this browser only');
  await expect(sidebar(page).locator('.side-foot')).toContainText('saved on this device');
  await where.getByRole('button', { name: 'Connect Google Drive' }).click();
  await expect(where.getByLabel('Folder in your Drive')).toHaveValue('Crumpet');
  await expect(where.getByLabel('Google client ID')).toBeVisible();
  await where.getByRole('button', { name: 'Cancel' }).click();
  await expect(where.getByRole('button', { name: 'Connect Google Drive' })).toBeVisible();
});

test('a synced change to the open note arrives without moving the caret', async ({ page }) => {
  await open(page);
  await newNote(page, 'Live', 'I am typing here');
  // Another device adds a paragraph above and changes a word (as a sync would).
  await page.evaluate(() => {
    const store = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: { blocks: { id: string; type: string; runs: { text: string; marks: string[] }[] }[] } }[] }; setDoc(id: string, doc: unknown): void } }).crumpet;
    const s = store.getState();
    const note = s.notes.find((n) => n.id === s.selectedId)!;
    const [first, ...rest] = note.doc.blocks;
    store.setDoc(note.id, { blocks: [{ id: 'from-phone', type: 'paragraph', runs: [{ text: 'Added on the phone.', marks: [] }] }, { ...first, runs: [{ text: 'I am typing right here', marks: [] }] }, ...rest] });
  });
  const body = page.locator('.note-pane [contenteditable]');
  await expect(body).toContainText('Added on the phone.');
  await page.keyboard.type(', still');
  await expect(body).toContainText('I am typing right here, still');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(body).toContainText('I am typing right here');
  await expect(body).not.toContainText(', still');
  await expect(body).toContainText('Added on the phone.');
});
