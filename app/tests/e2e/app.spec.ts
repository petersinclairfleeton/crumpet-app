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

/** A formatting button in the pinned bar, looking under More when there isn't room for it. */
async function toolButton(page: Page, name: RegExp | string) {
  const inBar = page.locator('.note-toolbar .tools.fit > .tool').getByRole('button', { name });
  if (await inBar.count()) return inBar.first();
  await page.getByRole('button', { name: 'More formatting' }).click();
  return page.locator('.more-menu').getByRole('button', { name }).first();
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
  // A first visit: a welcome with ways to start.
  const welcome = page.getByRole('region', { name: 'Welcome' });
  await expect(welcome.getByRole('heading', { name: 'Welcome to Crumpet' })).toBeVisible();
  await welcome.getByRole('button', { name: /Write your first note/ }).click();
  await expect(page.getByLabel('Title')).toBeFocused();
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
  await page.getByRole('tab', { name: 'Look' }).click();
  await page.getByRole('button', { name: 'Ink', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Blueberry' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))).toBe('#3E6DB5');
  await page.getByRole('tab', { name: 'Account & sync' }).click();
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
    await page.locator('.fab').click();
    await page.keyboard.type('Names for the island');
    // Writing: the formatting bar sits above the keyboard.
    await page.locator('.note-pane [contenteditable]').click();
    await expect(page.locator('.keyboard-bar')).toBeVisible();
    await page.locator('.keyboard-bar').getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.keyboard-bar')).toHaveCount(0);
    await expect(list(page)).toBeHidden();
    await page.getByRole('button', { name: 'Back to notes' }).click();
    await expect(list(page)).toBeVisible();
    await list(page).locator('.card', { hasText: 'Names for the island' }).click();
    await expect(page.getByLabel('Title')).toHaveValue('Names for the island');
    await page.getByRole('button', { name: 'Back to notes' }).click();
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Notebooks' }).click();
    await expect(sidebar(page)).toBeVisible();
    await sidebar(page).getByRole('button', { name: 'Create a notebook' }).click();
    await page.keyboard.type('Journal');
    await page.keyboard.press('Enter');
    await expect(sidebar(page)).toBeHidden();
    await expect(list(page).locator('h1')).toHaveText('Journal');
  });

  test('the view buttons live in the note’s … menu, to keep the top bar short', async ({ page }) => {
    await open(page);
    await page.locator('.fab').click();
    await page.keyboard.type('Short bar');
    await expect(page.getByRole('button', { name: 'Focus mode' })).toHaveCount(0);
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: 'Reading view' }).click();
    await expect(page.locator('.note-pane.reading')).toBeVisible();
    await page.getByRole('button', { name: 'Back to editing' }).click();
    await expect(page.locator('.note-pane.reading')).toHaveCount(0);
  });

  test('a character card fills the screen, with a way back to the book', async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as unknown as { crumpet: { createProject(name: string): unknown } }).crumpet.createProject('The Lighthouse'));
    const outline = page.getByRole('region', { name: 'Outline' });
    await outline.getByRole('button', { name: 'Add a character or place' }).click();
    await page.getByRole('button', { name: 'New character' }).click();
    const card = page.getByRole('region', { name: 'Character card' });
    await expect(outline).toBeHidden();
    expect((await card.boundingBox())!.width).toBeGreaterThan(380);
    await page.keyboard.type('Tam');
    await card.getByRole('button', { name: 'The Lighthouse' }).click();
    await expect(card).toHaveCount(0);
    await expect(outline).toBeVisible();
    await expect(outline.locator('.research-item')).toHaveText(['TTam']);
  });
});

test('settings: notes start on this device, with Google Drive one click away', async ({ page }) => {
  await open(page);
  await expect(sidebar(page).locator('.side-foot')).toContainText('saved on this device');
  await sidebar(page).getByRole('button', { name: 'Connect Google Drive' }).click();
  const where = page.getByRole('group', { name: 'Where your notes live' });
  await expect(where).toContainText('On this device only');
  await expect(where.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  await expect(where).not.toContainText('client ID');
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

test('themes: pick one, and accents follow themes that have none of their own', async ({ page }) => {
  await open(page);
  await sidebar(page).locator('.account').click();
  await page.getByRole('tab', { name: 'Look' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('button', { name: 'Vapor', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'vapor');
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))).toBe('#66c0f4');
  await expect(settings).toContainText('This theme has its own colours');
  await settings.getByRole('button', { name: 'Sepia', exact: true }).click();
  await settings.getByRole('button', { name: 'Blueberry' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))).toBe('#3E6DB5');
  await settings.getByRole('button', { name: 'Glass', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'glass');
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'glass');
});

test('writing font: choose any Google font or one on this device, and a text size', async ({ page }) => {
  // Don't fetch real fonts in tests.
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  await open(page);
  await sidebar(page).locator('.account').click();
  await page.getByRole('tab', { name: 'Writing' }).click();
  const font = page.getByRole('group', { name: 'Writing font' });
  await font.getByRole('button', { name: /Change/ }).click();
  await font.getByLabel('Search fonts').fill('litera');
  await font.getByRole('option', { name: /^Literata/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--note-font'))).toContain('"Literata", Georgia, serif');
  await expect(page.locator('link[href*="family=Literata:ital,wght"]:not([href*="text="])')).toHaveCount(1);
  await font.getByRole('tab', { name: 'On this device' }).click();
  await font.getByLabel('Search fonts').fill('');
  await expect(font.getByRole('option').first()).toBeVisible();
  await page.getByLabel(/Text size/).fill('20');
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--note-size'))).toBe('20px');
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--note-font'))).toContain('Literata');
});

test('reading view shows the note as a book page, and Escape goes back to editing', async ({ page }) => {
  await open(page);
  await newNote(page, 'Chapter One', 'It was a bright cold day.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The clocks were striking thirteen.');
  await page.getByRole('button', { name: 'Reading view' }).click();
  const pane = page.locator('.note-pane');
  await expect(pane).toHaveClass(/reading/);
  await expect(page.locator('.tools')).toBeHidden();
  await expect(page.locator('.reading-meta')).toContainText('words');
  await expect(page.locator('.note-pane [contenteditable]')).toHaveAttribute('contenteditable', 'false');
  await page.keyboard.press('Escape');
  await expect(pane).not.toHaveClass(/reading/);
  await expect(page.locator('.note-pane [contenteditable]')).toHaveAttribute('contenteditable', 'true');
});

test('projects: chapters and parts, status, synopsis, goals, reordering and the manuscript', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  const outline = page.getByRole('region', { name: 'Outline' });
  await expect(outline.locator('h1')).toHaveText('The Lighthouse');

  // Write the first chapter.
  await page.getByLabel('Chapter title').fill('The Keeper');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The lamp had not been lit for eleven years.');
  await page.getByLabel('Status').selectOption('draft');
  await page.getByLabel('Synopsis').fill('Mara climbs the lighthouse.');
  await page.getByRole('button', { name: 'Set word goal' }).click();
  await page.getByLabel('Word goal for this chapter').fill('2000');
  await page.keyboard.press('Enter');
  await expect(page.locator('.chapter-words')).toHaveText('9 of 2,000 words');
  const first = outline.locator('.outline-chapter').first();
  await expect(first).toContainText('The Keeper');
  await expect(first).toContainText('Mara climbs the lighthouse.');
  await expect(first.locator('.status-dot')).toHaveClass(/draft/);

  // A second chapter, a part, and moving the part to the top.
  await outline.getByRole('button', { name: 'Add chapter' }).click();
  await page.getByLabel('Chapter title').fill('Salt');
  await outline.getByRole('button', { name: 'Add part' }).click();
  await page.keyboard.type('Part One');
  await page.keyboard.press('Enter');
  await outline.getByRole('button', { name: 'Options for Part One' }).click();
  await page.getByRole('button', { name: 'Move up' }).click();
  await outline.getByRole('button', { name: 'Options for Part One' }).click();
  await page.getByRole('button', { name: 'Move up' }).click();
  await expect(outline.locator('.outline-items > li').first()).toHaveText(/Part One/);
  await outline.getByRole('button', { name: 'Options for Part One' }).click();
  await expect(page.getByRole('button', { name: 'Move up' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await outline.locator('.outline-open', { hasText: 'The Keeper' }).click();
  await expect(page.locator('.chapter-kicker')).toHaveText('Part One · Chapter 1');

  // The whole manuscript: both chapters, editable in place.
  await outline.getByRole('button', { name: 'Manuscript' }).click();
  const ms = page.getByRole('region', { name: 'Manuscript' });
  await expect(ms.locator('.ms-part')).toHaveText('Part One');
  await ms.getByLabel('Text of chapter 2').click();
  await page.keyboard.type('At the top, the glass was furred with salt.');
  await expect(outline.locator('.list-sub')).toContainText('18 words');
  // The formatting bar floats above selected text here too.
  await expect(ms.locator('.note-toolbar').getByRole('button', { name: 'Bold' })).toHaveCount(0);
  await page.keyboard.press('Shift+Home');
  await page.locator('.selection-bar').getByRole('button', { name: 'Bold' }).click();
  await expect(ms.getByLabel('Text of chapter 2').locator('strong')).toHaveText('At the top, the glass was furred with salt.');

  // Everything is still there after a reload.
  await page.reload();
  await sidebar(page).getByRole('button', { name: /The Lighthouse/ }).click();
  await expect(page.getByRole('region', { name: 'Outline' }).locator('.outline-chapter')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Outline' })).toContainText('Salt');
});

test('styles: apply from the menu, align, and modify a style for every paragraph using it', async ({ page }) => {
  await open(page);
  // The formatting bar pinned in place.
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Styled', 'A first paragraph.');
  const body = page.locator('.note-pane [contenteditable]');
  await page.getByRole('button', { name: 'Style', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Title', exact: true }).click();
  await expect(body.locator('.blk').first()).toHaveAttribute('data-style', 'title');
  await expect(page.getByRole('button', { name: 'Style', exact: true })).toHaveText(/Title/);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Body text after the title.');
  await expect(page.getByRole('button', { name: 'Style', exact: true })).toHaveText(/Normal/);
  await (await toolButton(page, /^Alignment/)).click();
  await page.getByRole('menuitemradio', { name: /Justify/ }).click();
  await expect(body.locator('.blk').nth(1)).toHaveAttribute('data-align', 'justify');

  // Change Normal: every Normal paragraph follows.
  await page.getByRole('button', { name: 'Style', exact: true }).click();
  await page.getByRole('button', { name: 'Modify styles…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Styles for notes' });
  await dialog.getByLabel('Size').fill('20');
  await expect.poll(() => body.locator('.blk').nth(1).evaluate((el) => getComputedStyle(el).fontSize)).toBe("26.6667px");
  await page.keyboard.press('Escape');
  await page.reload();
  await expect.poll(() => page.locator('.note-pane [contenteditable] .blk').nth(1).evaluate((el) => getComputedStyle(el).fontSize)).toBe("26.6667px");
});

test('typing is kept even when the page is closed straight away', async ({ page }) => {
  await open(page);
  await newNote(page, 'Last words', 'Typed right before leaving.');
  await page.reload();
  await expect(list(page)).toContainText('Last words');
  await expect(page.locator('.note-pane [contenteditable]')).toContainText('Typed right before leaving.');
});

test('page view: text flows onto pages, splitting paragraphs, and typing across a break keeps the text intact', async ({ page }) => {
  await open(page);
  await newNote(page, 'Long one', 'Intro.');
  await page.keyboard.press('Enter');
  // One paragraph longer than a page, so it has to break across pages wherever the pages end.
  const long = Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1} has quite a few words in it${', and then some more'.repeat(i === 5 ? 60 : 0)} so that it wraps over several lines on the page.`).join('\n');
  await page.keyboard.insertText(long);
  await page.getByRole('button', { name: 'Page view' }).click();
  await expect(page.getByRole('button', { name: 'Page view' })).toHaveAttribute('aria-pressed', 'true');
  // Make it span pages: a big text size.
  await page.evaluate(() => {
    const s = (window as unknown as { crumpet: { getState(): { settings: { noteSize?: number } }; updateSettings(p: object): void } }).crumpet;
    s.updateSettings({ noteSize: 30 });
  });
  await expect.poll(() => page.locator('.sheet').count()).toBeGreaterThan(1);
  // A paragraph broken across two pages: its text goes on in a continuation at the top of the next.
  const breaks = page.locator('.note-editor [data-cont]');
  await expect(breaks.first()).toBeAttached();
  const split = await breaks.evaluateAll((els) => els.some((c) => !!c.textContent && !!c.ownerDocument.querySelector(`[data-block="${(c as HTMLElement).dataset.block}"][data-split]`)?.textContent));
  expect(split).toBe(true);
  // Type at the very end (on the last page), and at the start of the first paragraph.
  const editor = page.locator('.note-pane [contenteditable]');
  await editor.locator('.blk').last().click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' The end.');
  await editor.locator('.blk').first().click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Home');
  await page.keyboard.type('Start: ');
  const text = await page.evaluate(() => {
    const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: { blocks: { runs: { text: string }[] }[] } }[] } } }).crumpet;
    const st = s.getState();
    return st.notes.find((n) => n.id === st.selectedId)!.doc.blocks.map((b) => b.runs.map((r) => r.text).join(''));
  });
  expect(text[0]).toBe('Start: Intro.');
  expect(text[text.length - 1]).toMatch(/several lines on the page\. The end\.$/);
  expect(text).toHaveLength(13);
  // Off again: no breaks left behind.
  await page.getByRole('button', { name: 'Page view' }).click();
  await expect(breaks).toHaveCount(0);
  await expect(page.locator('.sheet')).toHaveCount(0);
});

test('page view: typing and deleting right at a page break', async ({ page }) => {
  await open(page);
  await newNote(page, 'Break', 'Intro.');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText(Array.from({ length: 14 }, (_, i) => `Line ${i + 1} is a paragraph that is long enough to wrap onto a second line of the page here.`).join('\n'));
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ noteSize: 28 }));
  await page.getByRole('button', { name: 'Page view' }).click();
  // The first text on the second page (a paragraph moved there whole, or the rest of one split there).
  const brk = page.locator('.note-editor .pg + .pg [data-block]').first();
  await expect(brk).toBeAttached();
  const doc = () =>
    page.evaluate(() => {
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: { blocks: { runs: { text: string }[] }[] } }[] } } }).crumpet;
      const st = s.getState();
      return st.notes.find((n) => n.id === st.selectedId)!.doc.blocks.map((b) => b.runs.map((r) => r.text).join('')).join('\n');
    });
  const before = await doc();
  // Put the caret at the start of the page (just after the break), then type and delete.
  await brk.evaluate((b) => {
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode()!;
    const sel = getSelection()!;
    const r = document.createRange();
    r.setStart(first, 0);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    (b.closest('[contenteditable=true]') as HTMLElement).focus();
  });
  await page.keyboard.type('XY');
  await expect.poll(doc).not.toBe(before);
  const typed = await doc();
  expect(typed.replace('XY', '')).toBe(before);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await expect.poll(doc).toBe(before);
});

test('headers and footers: page numbers, editing on the page, fields, and different first pages', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ noteSize: 28, name: 'Mara Quinn' }));
  await newNote(page, 'Long one', 'Intro.');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText(Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1} has quite a few words in it so that it wraps over several lines on the page.`).join('\n'));
  await page.getByRole('button', { name: 'Page view' }).click();
  await expect.poll(() => page.locator('.sheet').count()).toBeGreaterThan(1);
  // Page numbers at the bottom, to start with.
  await expect(page.locator('[data-sheet="1"] .hf-footer .hf-slot.center')).toHaveText('2');

  // Double-click the top of page 2, on the left.
  const zone = page.locator('[data-sheet="1"] .hf-zone.header');
  await zone.scrollIntoViewIfNeeded();
  await zone.dblclick({ position: { x: 20, y: 40 } });
  const bar = page.getByRole('toolbar', { name: 'Header and footer' });
  await expect(bar).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Header, left' })).toBeFocused();
  await page.keyboard.type('Draft: ');
  await bar.getByRole('button', { name: 'Insert ▾' }).click();
  await page.getByRole('button', { name: 'Title', exact: true }).click();
  // Tab moves on: to the centre, then the right.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Header, right' })).toBeFocused();
  await bar.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type('Mine');
  await page.keyboard.press('Escape');
  await expect(bar).toBeHidden();
  // Every page shows it.
  await expect(page.locator('.hf-header .hf-slot.left')).toHaveText(['Draft: Long one', 'Draft: Long one']);
  await expect(page.locator('[data-sheet="0"] .hf-header .hf-slot.right b')).toHaveText('Mine');
  const saved = await page.evaluate(() => (window as unknown as { crumpet: { getState(): { settings: { notePage?: { hf?: { sets: { main: { header: object } } } } } } } }).crumpet.getState().settings.notePage?.hf?.sets.main.header);
  expect(saved).toEqual({ left: [{ text: 'Draft: ' }, { field: 'title' }], center: [], right: [{ text: 'Mine', b: true }] });

  // A different first page: blank until written in.
  await page.locator('[data-sheet="0"] .hf-zone.footer').dblclick({ position: { x: 300, y: 40 } });
  await bar.getByRole('button', { name: 'Options ▾' }).click();
  await page.getByLabel('Different first page').check();
  await expect(page.locator('[data-sheet="0"] .hf-header')).toHaveText('');
  await expect(page.locator('[data-sheet="1"] .hf-header .hf-slot.left')).toHaveText('Draft: Long one');
  await expect(bar.locator('.hf-bar-title')).toContainText('First page');
  await page.getByLabel('Number format').selectOption('i');
  await expect(page.locator('[data-sheet="1"] .hf-footer .hf-slot.center')).toHaveText('ii');
  await bar.getByRole('button', { name: 'Close' }).click();
  await expect(bar).toBeHidden();
});

test('headers and footers in a project: manuscript format, and page numbers running through the chapters', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ name: 'Mara Quinn' }));
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  const long = (n: number) => Array.from({ length: n }, (_, i) => `Paragraph ${i + 1} has quite a few words in it so that it wraps over several lines on the page, and then some more.`).join('\n');
  await page.getByLabel('Chapter title').fill('The Keeper');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText(long(20));
  // Chapters open in page view.
  await expect(page.getByRole('button', { name: 'Page view' })).toHaveAttribute('aria-pressed', 'true');
  // Standard manuscript format: nothing on the first page, then “Author / Title / page”.
  await expect(page.locator('.hf-header')).toHaveText(['', 'Mara Quinn / The Lighthouse / 2']);
  await page.evaluate(() => {
    const s = (window as unknown as { crumpet: { getState(): { projects: { id: string }[] }; addChapter(id: string): { id: string }; selectChapter(id: string): void } }).crumpet;
    s.selectChapter(s.addChapter(s.getState().projects[0].id).id);
  });
  await page.getByLabel('Chapter title').fill('Salt');
  await page.getByLabel('Chapter text').click();
  await page.keyboard.insertText(long(4));
  // The second chapter carries on from the first.
  await expect(page.locator('.hf-header')).toHaveText(['Mara Quinn / The Lighthouse / 3']);
  await page.getByRole('button', { name: 'Manuscript', exact: true }).click();
  await expect(page.locator('.hf-header')).toHaveText(['', 'Mara Quinn / The Lighthouse / 2', 'Mara Quinn / The Lighthouse / 3']);
  // Chapter openings without a header, like a printed book.
  const zone = page.locator('.ms-chapter').nth(1).locator('[data-sheet="0"] .hf-zone.footer');
  await zone.scrollIntoViewIfNeeded();
  await zone.dblclick({ position: { x: 300, y: 40 } });
  await page.getByRole('toolbar', { name: 'Header and footer' }).getByRole('button', { name: 'Options ▾' }).click();
  await page.getByLabel('Different first page of each chapter').check();
  await expect(page.locator('.hf-header')).toHaveText(['', 'Mara Quinn / The Lighthouse / 2', '']);
  const hf = await page.evaluate(() => (window as unknown as { crumpet: { getState(): { projects: { page?: { hf?: { differentChapterFirst: boolean } } }[] } } }).crumpet.getState().projects[0].page?.hf?.differentChapterFirst);
  expect(hf).toBe(true);
});

test('layout: hide and fold the sidebar, hide the list, resize, and two notes side by side', async ({ page }) => {
  await open(page);
  await newNote(page, 'First', 'One');
  await newNote(page, 'Second', 'Two');
  const layout = page.getByRole('button', { name: 'Layout', exact: true });
  await layout.click();
  await page.getByRole('button', { name: 'Icons', exact: true }).click();
  await expect(page.locator('.rail')).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Side by side' }).click();
  await page.keyboard.press('Escape');
  // The second side starts empty; working in it makes the list open notes there.
  const second = page.getByRole('region', { name: 'Second note' });
  await expect(second).toContainText('Choose a note in the list');
  await second.click();
  await list(page).locator('.card', { hasText: 'First' }).click();
  await expect(second.getByLabel('Title')).toHaveValue('First');
  await expect(page.getByRole('region', { name: 'Note', exact: true }).getByLabel('Title')).toHaveValue('Second');
  // Resizing the list with the keyboard.
  const edge = page.getByRole('separator', { name: 'Note list width' });
  await edge.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => (window as unknown as { crumpet: { getState(): { settings: { layout?: { listWidth?: number } } } } }).crumpet.getState().settings.layout?.listWidth)).toBe(376);
  // Back to one note, and the sidebar hidden with Ctrl+\.
  await second.getByRole('button', { name: 'Close this side' }).click();
  await expect(second).toHaveCount(0);
  await page.locator('.note-pane').first().click();
  await page.keyboard.press('Control+\\');
  await expect(page.locator('.rail, .sidebar')).toHaveCount(0);
  await page.keyboard.press('Control+\\');
  await expect(page.locator('.sidebar')).toBeVisible();
});

test('the formatting bar floats above selected text, can be pinned, and focus mode shows only the page', async ({ page }) => {
  await open(page);
  await newNote(page, 'Calm', 'Some words to format');
  // Nothing selected: no formatting bar, just the page.
  await expect(page.getByRole('button', { name: 'Bold' })).toHaveCount(0);
  await page.keyboard.press('Shift+Home');
  const bar = page.locator('.selection-bar');
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Bold' }).click();
  await expect(page.locator('.note-editor strong')).toHaveText('Some words to format');
  // Pinned: the full bar stays at the top.
  await page.getByRole('button', { name: 'Formatting bar' }).click();
  await expect(page.locator('.note-toolbar').getByRole('button', { name: 'Italic' })).toBeVisible();
  await page.getByRole('button', { name: 'Formatting bar' }).click();
  await expect(page.locator('.note-toolbar').getByRole('button', { name: 'Italic' })).toHaveCount(0);
  // Focus mode.
  await page.getByRole('button', { name: 'Focus mode' }).click();
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.list')).toBeHidden();
  await page.getByRole('button', { name: /Exit focus/ }).click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.locator('.note-editor').click();
  await page.keyboard.press('Control+Shift+F');
  await expect(page.locator('.app.focus-mode')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.app.focus-mode')).toHaveCount(0);
});

test('a first visit can take a short tour, and N starts a note', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Show me around' }).click();
  const tip = page.getByRole('dialog', { name: /^Tip 1 of/ });
  await expect(tip).toContainText('Your first note');
  await tip.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: /^Tip 2 of/ })).toContainText('Find anything');
  await page.keyboard.press('Escape');
  await expect(page.locator('.tour')).toHaveCount(0);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('n');
  await expect(page.getByLabel('Title')).toBeFocused();
});

test('pictures and files: add one from the note menu, with a caption, kept in the note as Markdown', async ({ page }) => {
  await open(page);
  await newNote(page, 'Lighthouse', 'Here it is:');
  await page.keyboard.press('Enter');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Add a picture or file…' }).click();
  // A 1×1 PNG. (Node's Buffer, without needing Node's types here.)
  const Bytes = (globalThis as unknown as { Buffer: { from(s: string, encoding?: string): never } }).Buffer;
  const png = Bytes.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await (await chooser).setFiles([{ name: 'lamp.png', mimeType: 'image/png', buffer: png }, { name: 'timetable.pdf', mimeType: 'application/pdf', buffer: Bytes.from('%PDF-1.4') }]);
  const img = page.locator('.note-editor .blk-image img');
  await expect(img).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1);
  await expect(page.locator('.note-editor .file-chip')).toHaveText('timetable.pdf');
  // A caption under the picture.
  await page.locator('.note-editor .blk-image .text').click();
  await page.keyboard.type('The lamp');
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  await expect.poll(md).toMatch(/^Here it is:\n\n!\[The lamp\]\(Attachments\/[a-z0-9]{7}-lamp\.png\)\n\n\[timetable\.pdf\]\(Attachments\/[a-z0-9]{7}-timetable\.pdf\)\n/);
  // Still there after a reload (kept on this device).
  await page.reload();
  await expect(page.locator('.note-editor .blk-image img')).toHaveAttribute('src', /^blob:/);
});

test('the / menu adds headings, lists and more as you write', async ({ page }) => {
  await open(page);
  await newNote(page, 'Slashes', '');
  await page.keyboard.press('Enter');
  const body = page.locator('.note-pane [contenteditable]');
  await page.keyboard.type('/head');
  const menu = page.getByRole('listbox', { name: 'Add' });
  await expect(menu.getByRole('option').first()).toContainText('Heading 1');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await page.keyboard.type('Plans');
  await expect(body.locator('h2')).toHaveText('Plans');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/check');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Buy lamp oil');
  await expect(body.locator('.blk-todo')).toHaveText('Buy lamp oil');
  // In the middle of a word, or dismissed with Esc, a / is just a /.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('and/or');
  await expect(menu).toHaveCount(0);
  await page.keyboard.type(' /zq');
  await expect(menu).toHaveCount(0);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(body.locator('.blk').last()).toHaveText('and/or /');
  // Clicking an item works too.
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  await menu.getByRole('option', { name: /Today’s date/ }).click();
  await expect(body.locator('.blk').last()).toContainText(String(new Date().getFullYear()));
});

test('today’s note, and new notes from templates', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: /^Today/ }).click();
  const title = page.getByLabel('Title');
  const today = await page.evaluate(() => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  await expect(title).toHaveValue(today);
  await expect(sidebar(page).locator('.nb-row')).toContainText('Daily notes');
  // Again: the same note.
  await sidebar(page).getByRole('button', { name: /^All Notes/ }).click();
  await sidebar(page).getByRole('button', { name: /^Today/ }).click();
  await expect(list(page).locator('.card')).toHaveCount(1);
  // From a template.
  await sidebar(page).getByRole('button', { name: 'New from a template' }).click();
  await page.getByRole('button', { name: /^Meeting notes/ }).click();
  await expect(title).toHaveValue(`Meeting, ${today}`);
  await expect(page.locator('.note-pane [contenteditable] h2').first()).toHaveText('Who');
});

test('links between notes: [[ to link, click to open, linked-from at the bottom', async ({ page }) => {
  await open(page);
  await newNote(page, 'The lighthouse', 'A tall white tower.');
  await newNote(page, 'Mara', 'She keeps ');
  await page.keyboard.type('[[light');
  const picker = page.getByRole('listbox', { name: 'Link to a note' });
  await expect(picker.getByRole('option').first()).toContainText('The lighthouse');
  await page.keyboard.press('Enter');
  await page.keyboard.type(' at night, and [[Ferry');
  await expect(picker.getByRole('option')).toContainText(['New note “Ferry”']);
  await page.keyboard.press('Enter');
  const body = page.locator('.note-pane [contenteditable]');
  await expect(body.locator('a[href^="note:"]').first()).toHaveText('The lighthouse');
  await expect(body.locator('a.missing-note')).toHaveText('Ferry');
  // A click opens the note, which lists Mara as linking to it.
  await body.locator('a', { hasText: 'The lighthouse' }).click();
  await expect(page.getByLabel('Title')).toHaveValue('The lighthouse');
  const from = page.getByRole('region', { name: 'Linked from' });
  await expect(from).toContainText('Mara');
  await from.getByRole('button', { name: 'Mara' }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Mara');
  // A link to a note that doesn't exist yet makes it.
  await page.locator('.note-pane [contenteditable] a', { hasText: 'Ferry' }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Ferry');
});

test('search: filters, saving a search, sorting, and working on several notes at once', async ({ page }) => {
  await open(page);
  await newNotebook(page, 'Journal');
  await newNote(page, 'Banana', 'yellow');
  await newNote(page, 'apple', 'red');
  await newNote(page, 'Cherry', 'red too');
  // Sort by title.
  await list(page).getByLabel('Sort by').selectOption('title');
  await expect(list(page).locator('.card-title')).toHaveText(['apple', 'Banana', 'Cherry']);
  await list(page).getByLabel('Sort by').selectOption('edited');
  // Search with a filter, from the menu.
  await page.getByPlaceholder('Search notes').fill('red');
  await expect(list(page).locator('.card')).toHaveCount(2);
  await list(page).getByRole('button', { name: '+ Filter' }).click();
  await page.getByRole('dialog', { name: 'Add a filter' }).getByRole('button', { name: 'Journal', exact: true }).click();
  await expect(page.getByPlaceholder('Search notes')).toHaveValue('red in:Journal');
  await expect(list(page).locator('.card')).toHaveCount(2);
  await list(page).getByRole('button', { name: 'Save this search' }).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Red things');
  await page.keyboard.press('Enter');
  await expect(sidebar(page).getByRole('button', { name: 'Red things', exact: true })).toBeVisible();
  await list(page).getByRole('button', { name: 'Remove filter: In Journal' }).click();
  await expect(page.getByPlaceholder('Search notes')).toHaveValue('red');
  await page.getByPlaceholder('Search notes').fill('');
  await sidebar(page).getByRole('button', { name: 'Red things', exact: true }).click();
  await expect(page.getByPlaceholder('Search notes')).toHaveValue('red in:Journal');
  await page.getByPlaceholder('Search notes').fill('');
  // Several at once: Ctrl/Cmd-click adds to the open note (like Finder), then star them.
  await list(page).locator('.card', { hasText: 'apple' }).click({ modifiers: ['ControlOrMeta'] });
  const bar = page.getByRole('toolbar', { name: /notes selected/ });
  await expect(bar).toContainText('2 selected');
  await list(page).locator('.card', { hasText: 'Cherry' }).click({ modifiers: ['ControlOrMeta'] });
  await expect(bar).toContainText('1 selected');
  await list(page).locator('.card', { hasText: 'Banana' }).click({ modifiers: ['ControlOrMeta'] });
  await expect(bar).toContainText('2 selected');
  await bar.getByRole('button', { name: 'Add to Favorites' }).click();
  await bar.getByRole('button', { name: 'Clear selection' }).click();
  await sidebar(page).getByRole('button', { name: /^Favorites/ }).click();
  await expect(list(page).locator('.card')).toHaveCount(2);
  await expect(list(page)).toContainText('apple');
  await expect(list(page)).toContainText('Banana');
});

test('tables: add one from the / menu, type in cells, Tab along, and it saves as a Markdown table', async ({ page }) => {
  await open(page);
  await newNote(page, 'Packing', 'What to take:');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/table');
  await page.keyboard.press('Enter');
  const table = page.locator('.note-editor .blk-table table');
  await expect(table.locator('tr')).toHaveCount(3);
  await expect(table.locator('th .cell').first()).toBeFocused();
  await page.keyboard.type('Thing');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Count');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Where');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Lamp');
  await page.keyboard.press('Tab');
  await page.keyboard.type('2');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Rope');
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  await expect.poll(md).toBe('What to take:\n\n| Thing | Count | Where |\n| --- | --- | --- |\n| Lamp | 2 | |\n| Rope | | |\n\n&nbsp;\n');
  // Tab from the last cell adds a row.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(table.locator('tr')).toHaveCount(4);
  // Escape leaves the table for the line below; typing goes there.
  await page.keyboard.press('Escape');
  await page.keyboard.type('Done.');
  await expect(page.locator('.note-editor .blk').last()).toHaveText('Done.');
  // Tools: add a column, then delete the table.
  await table.locator('td .cell').first().click();
  await page.locator('.table-tools').getByRole('button', { name: '+ Column' }).click();
  await expect(table.locator('tr').first().locator('th')).toHaveCount(4);
  // Undo takes the column away again.
  await page.keyboard.press('Control+z');
  await expect(table.locator('tr').first().locator('th')).toHaveCount(3);
  await page.reload();
  await expect(table.locator('td .cell').first()).toHaveText('Lamp');
  await table.locator('td .cell').first().click();
  await page.locator('.table-tools').getByRole('button', { name: 'Table ▾' }).click();
  await page.locator('.table-tools').getByRole('button', { name: 'Delete table' }).click();
  await expect(page.locator('.note-editor .blk-table')).toHaveCount(0);
});

test('fold-away sections: the arrow by a heading hides what’s under it until the next heading', async ({ page }) => {
  await open(page);
  await newNote(page, 'Trip', '');
  await page.keyboard.press('Enter');
  for (const line of ['/h2', 'Monday', 'Walk to the lake', 'Swim', '/h2', 'Tuesday', 'Rest']) {
    if (line.startsWith('/')) {
      await page.keyboard.type(line);
      await page.keyboard.press('Enter');
    } else {
      await page.keyboard.type(line);
      await page.keyboard.press('Enter');
    }
  }
  const body = page.locator('.note-editor');
  await expect(body.locator('h2')).toHaveCount(2);
  await body.locator('h2').first().hover();
  await body.locator('h2').first().locator('.fold').click();
  await expect(body.getByText('Walk to the lake')).toBeHidden();
  await expect(body.getByText('Swim')).toBeHidden();
  await expect(body.getByText('Rest')).toBeVisible();
  await page.reload();
  await expect(body.getByText('Swim')).toBeHidden();
  await body.locator('h2').first().locator('.fold').click();
  await expect(body.getByText('Swim')).toBeVisible();
});

test('footnotes: add from the / menu or Ctrl+Alt+F, numbered in order, edited in a card and listed under the note', async ({ page }) => {
  await open(page);
  await newNote(page, 'Essay', 'The sea is warm');
  await page.keyboard.type(' /foot');
  await page.keyboard.press('Enter');
  const card = page.getByRole('dialog', { name: 'Footnote 1' });
  await expect(card.getByRole('textbox')).toBeFocused();
  await page.keyboard.type('In August, anyway.');
  await page.keyboard.press('Enter');
  await expect(card).toHaveCount(0);
  // Typing carries on after the number.
  await page.keyboard.type(' in summer.');
  const body = page.locator('.note-editor');
  await expect(body.locator('sup.fn')).toHaveAttribute('data-n', '1');
  await expect(page.getByRole('region', { name: 'Footnotes' })).toContainText('In August, anyway.');
  // A second one earlier in the text becomes number 1.
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Control+Alt+f');
  await page.getByRole('dialog', { name: 'Footnote 1' }).getByRole('textbox').fill('Or so they say.');
  await page.getByRole('dialog', { name: 'Footnote 1' }).getByRole('button', { name: 'Done' }).click();
  await expect(body.locator('sup.fn')).toHaveCount(2);
  await expect(body.locator('sup.fn').nth(1)).toHaveAttribute('data-n', '2');
  await expect(page.getByRole('region', { name: 'Footnotes' }).locator('li')).toHaveText(['Or so they say.', 'In August, anyway.']);
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  await expect.poll(md).toBe('The^[Or so they say.] sea is warm^[In August, anyway.] in summer.\n');
  // Clicking a number opens it; Remove takes it out.
  await body.locator('sup.fn').nth(1).click();
  await page.getByRole('dialog', { name: 'Footnote 2' }).getByRole('button', { name: 'Remove' }).click();
  await expect(body.locator('sup.fn')).toHaveCount(1);
  await expect.poll(md).toBe('The^[Or so they say.] sea is warm in summer.\n');
  // Undo brings it back; footnotes are found by search.
  await page.keyboard.press('Control+z');
  await expect(body.locator('sup.fn')).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Footnotes' }).locator('li')).toHaveCount(2);
});

test('Word documents: download a note as .docx, and open one as a new note', async ({ page }) => {
  await open(page);
  await newNote(page, 'Letter home', 'Dear all,');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/bullet');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The weather is fine');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download as Word document' }).click()]);
  expect(download.suggestedFilename()).toBe('Letter home.docx');
  const file = await download.path();
  // Open it again as a new note.
  await sidebar(page).getByRole('button', { name: 'New from a template' }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open a Word document…' }).click()]);
  await chooser.setFiles(file);
  await expect(list(page).locator('.card')).toHaveCount(2);
  await expect(page.getByLabel('Title')).toHaveValue('Letter home');
  await expect(page.locator('.note-editor .blk').first()).toHaveText('Dear all,');
  await expect(page.locator('.note-editor .blk-bullet')).toHaveText('The weather is fine');
});

test('comments: select text, comment, reply, see them listed, and resolve', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(s: object): void } }).crumpet.updateSettings({ name: 'Robin' }));
  await newNote(page, 'Draft', 'The castle stood on the hill.');
  // Select "stood on the hill".
  await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 'stood on the hill'.length; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Control+Alt+m');
  const card = page.getByRole('dialog', { name: 'New comment' });
  await expect(card.getByRole('textbox', { name: 'Comment' })).toBeFocused();
  await page.keyboard.type('Which hill?');
  await page.keyboard.press('Enter');
  await expect(card).toHaveCount(0);
  const body = page.locator('.note-editor');
  await expect(body.locator('mark.cmt')).toHaveText('stood on the hill');
  const listed = page.getByRole('region', { name: 'Comments' });
  await expect(listed).toContainText('“stood on the hill”');
  await expect(listed).toContainText('Robin: Which hill?');
  // Click the highlighted text to reply.
  await body.locator('mark.cmt').click();
  const thread = page.getByRole('dialog', { name: 'Comment' });
  await expect(thread).toContainText('Which hill?');
  await thread.getByRole('textbox', { name: 'Reply' }).fill('The one by the river.');
  await thread.getByRole('button', { name: 'Reply' }).click();
  await expect(thread.locator('.comment-msg')).toHaveCount(2);
  await expect(listed).toContainText('1 reply');
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  await expect.poll(md).toMatch(/^The castle \{==stood on the hill==\}\{>>Robin \(\d{4}-\d\d-\d\d \d\d:\d\dZ\): Which hill\?<<\}\{>>Robin \(.*?\): The one by the river\.<<\}\.\n$/);
  // Still there after a reload; the toolbar button works too.
  await page.reload();
  await expect(body.locator('mark.cmt')).toHaveText('stood on the hill');
  await body.locator('mark.cmt').click();
  await page.getByRole('dialog', { name: 'Comment' }).getByRole('button', { name: 'Resolve' }).click();
  await expect(body.locator('mark.cmt')).toHaveCount(0);
  await expect(listed).toHaveCount(0);
  await expect.poll(md).toBe('The castle stood on the hill.\n');
});

test('track changes: typing is marked added, deleting strikes through, and changes are accepted or rejected', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(s: object): void } }).crumpet.updateSettings({ name: 'Robin' }));
  await newNote(page, 'Edit me', 'The big sea.');
  await page.getByRole('button', { name: 'Track changes' }).click();
  await expect(page.getByRole('button', { name: 'Tracking changes' })).toHaveAttribute('aria-pressed', 'true');
  // Select "big" and type over it.
  await page.locator('.note-editor .blk').first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.type('huge');
  const body = page.locator('.note-editor');
  await expect(body.locator('del.trk')).toHaveText('big');
  await expect(body.locator('ins.trk')).toHaveText('huge');
  await expect(body.locator('del.trk')).toHaveAttribute('title', /Deleted by Robin/);
  // Backspace at the end deletes the full stop, struck through.
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await expect(body.locator('del.trk')).toHaveCount(2);
  const bar = page.getByRole('region', { name: 'Tracked changes' });
  await expect(bar).toContainText('3 tracked changes');
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  await expect.poll(md).toMatch(/^The \{--big--\}\{>>Robin \(.*?\)<<\}\{\+\+huge\+\+\}\{>>Robin \(.*?\)<<\} sea\{--\.--\}\{>>Robin \(.*?\)<<\}\n$/);
  // Reject the deleted full stop from its card, then accept the rest.
  await body.locator('del.trk').nth(1).click();
  await page.getByRole('dialog', { name: 'Deleted text' }).getByRole('button', { name: 'Reject' }).click();
  await expect(bar).toContainText('2 tracked changes');
  await bar.getByRole('button', { name: 'Accept all' }).click();
  await expect(bar).toHaveCount(0);
  await expect.poll(md).toBe('The huge sea.\n');
  // Turned off, typing is plain again.
  await page.getByRole('button', { name: 'Tracking changes' }).click();
  await page.locator('.note-editor .blk').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Yes.');
  await expect(body.locator('ins.trk')).toHaveCount(0);
});

test('web clipper: the bookmark on another site opens Crumpet with the page, to save as a note', async ({ page, context }) => {
  await open(page);
  await sidebar(page).locator('.account').click();
  await page.getByRole('tab', { name: 'Clipper & app' }).click();
  const href = await page.locator('.clip-bookmark').getAttribute('href');
  expect(href).toMatch(/^javascript:/);
  const code = decodeURIComponent(href!.slice('javascript:'.length));
  // A pretend article somewhere else on the web; long, so it travels by message rather than in the address.
  const filler = Array.from({ length: 80 }, (_, i) => `<p>Paragraph ${i + 1} about the lighthouse keeper's day.</p>`).join('');
  await context.route('https://news.example/story', (route) =>
    route.fulfill({ contentType: 'text/html', body: `<html><head><title>The last lighthouse</title></head><body><nav>Home · News</nav><article><h1>The last lighthouse</h1><p>It stands <b>alone</b> on the rock. <a href="/more">More</a></p><img src="/lamp.png" alt="The lamp">${filler}</article><footer>© News</footer></body></html>` }),
  );
  const site = await context.newPage();
  await site.goto('https://news.example/story');
  const [clipper] = await Promise.all([context.waitForEvent('page'), site.evaluate(code)]);
  const dialog = clipper.getByRole('dialog', { name: 'Save clip' });
  await expect(dialog).toContainText('From news.example');
  await expect(dialog.getByLabel('Title')).toHaveValue('The last lighthouse');
  await dialog.getByLabel('Title').fill('Lighthouse story');
  await dialog.getByRole('button', { name: 'Save note' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(clipper.getByLabel('Title')).toHaveValue('Lighthouse story');
  const body = clipper.locator('.note-editor');
  await expect(body.locator('.blk').first()).toContainText('Clipped from news.example');
  await expect(body.locator('h1')).toHaveText('The last lighthouse');
  await expect(body.locator('strong')).toHaveText('alone');
  await expect(body.locator('a[href="https://news.example/more"]')).toHaveText('More');
  await expect(body.locator('.blk-image img')).toHaveAttribute('src', 'https://news.example/lamp.png');
  await expect(body).not.toContainText('Home · News');
  await expect(body).toContainText('Paragraph 80');
  // The address no longer says #clip.
  expect(clipper.url()).not.toContain('#clip');

  // Selecting part of a page clips only that part (short: it travels in the address).
  await site.evaluate(() => {
    const p = document.querySelector('article p')!;
    const r = document.createRange();
    r.selectNodeContents(p);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
  });
  const [second] = await Promise.all([context.waitForEvent('page'), site.evaluate(code)]);
  const d2 = second.getByRole('dialog', { name: 'Save clip' });
  await expect(d2).toContainText('Save the selected part');
  await expect(d2.locator('.clip-preview')).toContainText('It stands alone on the rock.');
  await expect(d2.locator('.clip-preview')).not.toContainText('Paragraph 1');
});

test('pasting from a web page or Word keeps headings, lists and formatting', async ({ page }) => {
  await open(page);
  await newNote(page, 'Pasted', 'Start ');
  const paste = (html: string, text: string) =>
    page.evaluate(
      ([h, t]) => {
        const dt = new DataTransfer();
        dt.setData('text/html', h);
        dt.setData('text/plain', t);
        document.querySelector('.note-editor')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      },
      [html, text],
    );
  await paste('<meta charset="utf-8"><h2>Recipe</h2><ul><li>Flour</li><li><b>Butter</b></li></ul><p>Mix <a href="https://example.com/">well</a>.</p>', 'Recipe Flour Butter Mix well.');
  const body = page.locator('.note-editor');
  await expect(body.locator('.blk')).toHaveCount(5);
  await expect(body.locator('.blk').first()).toHaveText('Start');
  await expect(body.locator('h2')).toHaveText('Recipe');
  await expect(body.locator('.blk-bullet')).toHaveText(['Flour', 'Butter']);
  await expect(body.locator('.blk-bullet strong')).toHaveText('Butter');
  await expect(body.locator('a[href="https://example.com/"]')).toHaveText('well');
  // The caret is after the pasted text.
  await page.keyboard.type(' Done.');
  await expect(body.locator('.blk').last()).toHaveText('Mix well. Done.');
  // Plain text still pastes as text; with track changes on, pasted text is marked as added.
  await page.getByRole('button', { name: 'Track changes' }).click();
  await body.locator('.blk').last().click();
  await page.keyboard.press('End');
  await paste('<span style="font-weight:700">Bold bit</span>', 'Bold bit');
  await expect(body.locator('ins.trk strong')).toHaveText('Bold bit');
});

test('track changes: new and removed paragraph breaks are tracked too', async ({ page }) => {
  await open(page);
  await newNote(page, 'Breaks', 'First line. Second line.');
  await page.getByRole('button', { name: 'Track changes' }).click();
  const body = page.locator('.note-editor');
  await body.locator('.blk').first().click();
  await page.keyboard.press('End');
  for (let i = 0; i < 'Second line.'.length; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(body.locator('.blk')).toHaveCount(2);
  await expect(body.locator('.brk.ins')).toHaveCount(1);
  const bar = page.getByRole('region', { name: 'Tracked changes' });
  await expect(bar).toContainText('1 tracked change');
  // Typing goes on in the new paragraph; Backspace at its start takes the new break away again.
  await page.keyboard.press('Backspace');
  await expect(body.locator('.blk')).toHaveCount(1);
  await expect(bar).toHaveCount(0);
  // Now a break that was there before: Backspace marks it deleted.
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Tracking changes' }).click();
  await body.locator('.blk').last().click();
  await page.keyboard.type('Third.');
  await bar.getByRole('button', { name: 'Accept all' }).click();
  await page.getByRole('button', { name: 'Track changes' }).click();
  await body.locator('.blk').last().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  await expect(body.locator('.brk.del')).toHaveCount(1);
  await expect(body.locator('.blk')).toHaveCount(2);
  await body.locator('.brk.del').click();
  await page.getByRole('dialog', { name: 'Deleted paragraph break' }).getByRole('button', { name: 'Accept' }).click();
  await expect(body.locator('.blk')).toHaveCount(1);
  await expect(body.locator('.blk')).toHaveText('First line. Second line.Third.');
});

test('page view: footnotes sit at the foot of the page their number is on', async ({ page }) => {
  await open(page);
  await newNote(page, 'Footed', 'Opening line');
  await page.keyboard.press('Control+Alt+f');
  await page.getByRole('dialog', { name: 'Footnote 1' }).getByRole('textbox').fill('A note on page one.');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  // A lot of text, then a second footnote, far down.
  await page.keyboard.insertText(Array.from({ length: 40 }, (_, i) => `Line ${i + 1} of filler text that goes on for a while to fill the page.`).join('\n'));
  await page.keyboard.type(' End');
  await page.keyboard.press('Control+Alt+f');
  await page.getByRole('dialog', { name: 'Footnote 2' }).getByRole('textbox').fill('A note much later.');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Footnotes' })).toBeVisible();
  await page.getByRole('button', { name: 'Page view' }).click();
  // In page view, no list under the note: each footnote is on its page.
  await expect(page.getByRole('region', { name: 'Footnotes' })).toHaveCount(0);
  const first = page.getByRole('list', { name: 'Footnotes on page 1' });
  await expect(first).toContainText('A note on page one.');
  await expect(first).not.toContainText('A note much later.');
  const lastSup = page.locator('.note-editor sup.fn').nth(1);
  const sheets = page.locator('.sheet');
  expect(await sheets.count()).toBeGreaterThan(1);
  // The second is on the same page as its number, below all the text there.
  const pageOf = async (y: number) => {
    const tops = await sheets.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
    return tops.filter((t) => t <= y).length;
  };
  const supY = (await lastSup.boundingBox())!.y;
  const n = await pageOf(supY);
  const later = page.getByRole('list', { name: `Footnotes on page ${n}` });
  await expect(later).toContainText('A note much later.');
  const noteBox = (await later.boundingBox())!;
  expect(noteBox.y).toBeGreaterThan(supY);
  // No text runs under the footnotes.
  // (Every line of text on that page ends above the footnotes.)
  const textBottom = await page.locator('.note-editor').evaluate((root, [top, bottom]) => {
    const r = document.createRange();
    r.selectNodeContents(root);
    const lines = Array.from(r.getClientRects()).filter((x) => x.height > 0 && x.height < 60 && x.top < bottom && x.bottom > top - 1200);
    return Math.max(...lines.filter((x) => x.top < bottom && x.bottom > top - 1100 && x.top < top + 1).map((x) => x.bottom));
  }, [noteBox.y, noteBox.y + noteBox.height]);
  expect(textBottom).toBeLessThanOrEqual(noteBox.y + 1);
  // Clicking a footnote opens it.
  await later.getByText('A note much later.').click();
  await expect(page.getByRole('dialog', { name: 'Footnote 2' })).toBeVisible();
});

test('nested tags: a tree in the sidebar, the parent shows everything inside it, and renaming moves them all', async ({ page }) => {
  await open(page);
  const tag = async (title: string, t: string) => {
    await newNote(page, title, 'Text.');
    await page.getByRole('button', { name: 'Add tag' }).click();
    await page.keyboard.type(t);
    await page.keyboard.press('Enter');
  };
  await tag('Hero', 'book/characters');
  await tag('Harbour', 'book/places');
  await tag('Shopping', 'home');
  await sidebar(page).getByRole('button', { name: 'Tags' }).click();
  const side = sidebar(page);
  await expect(side.getByRole('button', { name: /^#book/ })).toContainText('2');
  await expect(side.getByRole('button', { name: /^#characters/ })).toHaveCount(0);
  await side.getByRole('button', { name: 'Show tags in #book' }).click();
  await expect(side.getByRole('button', { name: /^#characters/ })).toBeVisible();
  await side.getByRole('button', { name: /^#book/ }).click();
  await expect(list(page).locator('h1')).toHaveText('#book');
  await expect(list(page).locator('.card')).toHaveCount(2);
  await side.getByRole('button', { name: /^#places/ }).click();
  await expect(list(page).locator('.card')).toHaveCount(1);
  // Rename the parent: the nested tags move with it.
  await side.getByRole('button', { name: /^#book/ }).click();
  await list(page).getByRole('button', { name: 'Rename tag' }).click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('novel');
  await page.keyboard.press('Enter');
  await expect(list(page).locator('h1')).toHaveText('#novel');
  await expect(list(page).locator('.card')).toHaveCount(2);
  await expect(side.getByRole('button', { name: /^#book/ })).toHaveCount(0);
  await side.getByRole('button', { name: 'Show tags in #novel' }).click();
  await expect(side.getByRole('button', { name: /^#characters/ })).toBeVisible();
});

test('writing stats: words today, a daily goal, streaks and a calendar', async ({ page }) => {
  await open(page);
  // Some history: the last few days (kept on this device).
  await page.evaluate(() => {
    const day = (n: number) => {
      const d = new Date(Date.now() - n * 86400000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const history: Record<string, number> = {};
    for (const [n, w] of [[1, 420], [2, 650], [3, 300], [10, 800], [11, 120]]) history[day(n)] = w;
    (window as unknown as { crumpet: { updateSettings(s: object): void } }).crumpet.updateSettings({ stats: { day: day(1), base: {}, now: {}, history } });
  });
  await newNote(page, 'Draft', 'One two three four five six seven eight nine ten.');
  const row = sidebar(page).getByRole('button', { name: /Writing stats/ });
  await expect(row).toContainText('10');
  await row.click();
  const dialog = page.getByRole('dialog', { name: 'Writing stats' });
  await expect(dialog.locator('.stat-tile').first()).toContainText('10');
  await expect(dialog.locator('.stat-tile').nth(1)).toContainText('4');
  await dialog.getByLabel('Daily goal in words').fill('400');
  await expect(dialog.locator('.stat-tile').first()).toContainText('390 to go');
  // With a goal of 400, only yesterday counts toward the streak (the day before had 300... no, 650): 2 days.
  await expect(dialog.locator('.stat-tile').nth(1)).toContainText('2');
  await expect(dialog.locator('.goal-line')).toContainText('Goal 400');
  await expect(dialog.locator('.bar')).toHaveCount(30);
  await expect(dialog.getByRole('gridcell').last()).toHaveAttribute('aria-label', /10 words/);
  await dialog.locator('.bar-slot').nth(28).hover();
  await expect(page.getByRole('tooltip')).toContainText('420 words · goal met');
  await dialog.getByRole('button', { name: 'Show as table' }).click();
  await expect(dialog.getByRole('table')).toContainText('650');
});

test('print or save as PDF: the pages as page view shows them, and e-books download', async ({ page }) => {
  await open(page);
  await newNote(page, 'Long essay', 'Opening line');
  await page.keyboard.press('Control+Alt+f');
  await page.getByRole('dialog', { name: 'Footnote 1' }).getByRole('textbox').fill('A note at the foot.');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText(Array.from({ length: 50 }, (_, i) => `Line ${i + 1} of the essay, long enough to fill some of the page.`).join('\n'));
  await page.evaluate(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => {
      (window as unknown as { printed: number }).printed++;
    };
  });
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Print or save as PDF' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  const sheets = await page.locator('.print-root .print-page').count();
  expect(sheets).toBeGreaterThan(1);
  await expect(page.locator('.print-root .page-notes-zone').first()).toContainText('A note at the foot.');
  const pdf = await page.pdf({ preferCSSPageSize: true });
  const pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pdfPages).toBe(sheets);
  // Closing the print window tidies up.
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('.print-root')).toHaveCount(0);
  // E-book.
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download as e-book (ePub)' }).click()]);
  expect(download.suggestedFilename()).toBe('Long essay.epub');
});

test('corkboard and research: chapters as cards to edit and reorder, research notes and files beside the writing', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  const outline = page.getByRole('region', { name: 'Outline' });
  await page.getByLabel('Chapter title').fill('Arrival');
  await outline.getByRole('button', { name: 'Add chapter' }).click();
  await page.getByLabel('Chapter title').fill('Storm');
  await outline.getByRole('button', { name: 'Add chapter' }).click();
  await page.getByLabel('Chapter title').fill('Rescue');

  // The corkboard.
  await outline.getByRole('button', { name: 'Cards' }).click();
  const board = page.getByRole('region', { name: 'Corkboard' });
  await expect(board.locator('.cork-card')).toHaveCount(3);
  await board.getByLabel('Synopsis of chapter 2').fill('The lamp fails in the gale.');
  await board.getByLabel('Status of chapter 2').selectOption('draft');
  await expect(outline.locator('.outline-chapter').nth(1)).toContainText('The lamp fails in the gale.');
  await expect(board.locator('.cork-card').nth(1)).toHaveClass(/status-draft/);
  // Drag "Rescue" before "Arrival".
  await board.locator('.cork-card').nth(2).dragTo(board.locator('.cork-card').nth(0), { targetPosition: { x: 10, y: 60 } });
  await expect(board.locator('.cork-title')).toHaveText(['Rescue', 'Arrival', 'Storm']);
  await expect(outline.locator('.outline-title')).toHaveText(['Rescue', 'Arrival', 'Storm']);
  // Clicking a title opens the chapter to write.
  await board.getByRole('button', { name: 'Storm' }).click();
  await expect(page.getByLabel('Chapter title')).toHaveValue('Storm');

  // Research: a note, opened beside the chapter.
  await outline.getByRole('button', { name: 'Add research' }).click();
  await page.getByRole('button', { name: 'New research note' }).click();
  const research = page.getByRole('region', { name: 'Research note' });
  await expect(research.getByLabel('Title')).toBeFocused();
  await page.keyboard.type('Lighthouse lamps');
  await research.locator('.note-editor').click();
  await page.keyboard.type('Fresnel lenses, paraffin, clockwork.');
  await expect(page.getByLabel('Chapter title')).toHaveValue('Storm');
  await expect(outline.locator('.research-item')).toHaveText(['¶Lighthouse lamps']);
  // Research isn't in the note list, but search finds it.
  await research.getByRole('button', { name: 'Close research' }).click();
  await expect(research).toHaveCount(0);
  await sidebar(page).getByRole('button', { name: /^All Notes/ }).click();
  await expect(list(page).locator('.card')).toHaveCount(0);
  await page.getByPlaceholder('Search notes').fill('paraffin');
  await expect(list(page).locator('.card')).toHaveCount(1);
  await page.getByPlaceholder('Search notes').fill('');

  // A picture and a PDF.
  await sidebar(page).getByRole('button', { name: /The Lighthouse/ }).click();
  await outline.getByRole('button', { name: 'Add research' }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Pictures or PDFs…' }).click()]);
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await chooser.setFiles([
    { name: 'Coastline.png', mimeType: 'image/png', buffer: (globalThis as unknown as { Buffer: { from(s: string, e: string): Uint8Array } }).Buffer.from(PNG, 'base64') as never },
    { name: 'Lamp manual.pdf', mimeType: 'application/pdf', buffer: (globalThis as unknown as { Buffer: { from(s: string): Uint8Array } }).Buffer.from('%PDF-1.4\n%%EOF') as never },
  ]);
  await expect(outline.locator('.research-item')).toHaveCount(3);
  await expect(page.getByRole('region', { name: 'Research note' }).locator('iframe[title="PDF"]')).toBeVisible();
  await outline.locator('.research-item', { hasText: 'Coastline' }).click();
  await expect(page.getByRole('region', { name: 'Research note' }).locator('.blk-image img')).toHaveAttribute('src', /^blob:/);
});

test('characters and places: a card for each, names spotted in the chapters, and a card on hover', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  const outline = page.getByRole('region', { name: 'Outline' });
  await page.getByLabel('Chapter title').fill('Arrival');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Mara stepped onto Gull Rock. Old Tam was waiting.');

  // A character.
  await outline.getByRole('button', { name: 'Add a character or place' }).click();
  await page.getByRole('button', { name: 'New character' }).click();
  const card = page.getByRole('region', { name: 'Character card' });
  await expect(card.getByLabel('Name')).toBeFocused();
  await page.keyboard.type('Tam');
  await card.getByLabel('Also called').fill('Old Tam, the keeper');
  await card.getByLabel('Description').fill('Keeper of the light for forty years.');
  await expect(card.locator('.cast-seen')).toContainText('1. Arrival');
  await expect(card.locator('.cast-seen')).toContainText('1 mention');
  // A place.
  await outline.getByRole('button', { name: 'Add a character or place' }).click();
  await page.getByRole('button', { name: 'New place' }).click();
  const place = page.getByRole('region', { name: 'Place card' });
  await page.keyboard.type('Gull Rock');
  await expect(outline.locator('.research-item')).toHaveText(['TTam', 'GGull Rock']);
  await place.getByRole('button', { name: 'Close card' }).click();

  // Their names are underlined in the chapter (as highlights, the text is untouched).
  await expect.poll(() => page.evaluate(() => CSS.highlights.get('crumpet-cast')?.size ?? 0)).toBe(2);
  await expect(page.locator('.note-editor .blk').last()).toHaveText('Mara stepped onto Gull Rock. Old Tam was waiting.');
  // Hovering over a name shows its card.
  const box = await page.evaluate(() => {
    const r = [...(CSS.highlights.get('crumpet-cast') as Highlight)].map((x) => (x as Range).getBoundingClientRect()).sort((a, b) => b.left - a.left)[0];
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(box.x, box.y);
  const hover = page.getByRole('tooltip');
  await expect(hover).toContainText('Tam');
  await expect(hover).toContainText('Keeper of the light for forty years.');
  await hover.getByRole('button', { name: 'Open card' }).click();
  await expect(page.getByRole('region', { name: 'Character card' }).getByLabel('Name')).toHaveValue('Tam');
  // Still there after a reload.
  await page.reload();
  await sidebar(page).getByRole('button', { name: /The Lighthouse/ }).click();
  await expect(page.getByRole('region', { name: 'Outline' }).locator('.research-item')).toHaveText(['TTam', 'GGull Rock']);
});

test('search finds words in chapters too, highlighted, and opens the chapter', async ({ page }) => {
  await open(page);
  await newNote(page, 'Mara notes', 'Ideas for her voice.');
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await page.getByLabel('Chapter title').fill('The Keeper');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The lamp had not been lit. Mara climbed the stairs anyway.');
  await page.getByPlaceholder('Search notes').first().fill('mara');
  await expect(list(page).locator('.list-sub')).toContainText('1 note · 1 chapter');
  const hits = list(page).getByRole('group', { name: 'In your projects' });
  await expect(hits.locator('mark')).toHaveText(['Mara']);
  await hits.getByRole('button', { name: /The Keeper/ }).click();
  await expect(page.getByLabel('Chapter title')).toHaveValue('The Keeper');
});

test('find and replace: in a note with Ctrl+F, and across a whole book', async ({ page }) => {
  await open(page);
  await newNote(page, 'Lamps', 'The lamp and the Lamp and the lampshade.');
  await page.keyboard.press('Control+f');
  const bar = page.getByRole('search', { name: 'Find and replace' });
  await expect(bar.getByRole('searchbox', { name: 'Find' })).toBeFocused();
  await page.keyboard.type('lamp');
  await expect(bar.locator('.find-count')).toHaveText('1 of 3');
  await bar.getByLabel('Whole words').check();
  await expect(bar.locator('.find-count')).toHaveText('1 of 2');
  await bar.getByLabel('Replace with').fill('light');
  await bar.getByRole('button', { name: 'Replace all' }).click();
  await expect(page.locator('.note-editor')).toContainText('The light and the light and the lampshade.');
  await expect(bar.locator('.find-count')).toHaveText('None');
  // One undo brings both back.
  await page.locator('.note-editor').first().click();
  await page.keyboard.press('Control+z');
  await expect(page.locator('.note-editor')).toContainText('The lamp and the Lamp and the lampshade.');

  // A book: look in every chapter, and replace in all of them.
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await page.getByLabel('Chapter title').fill('One');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The sea was slate.');
  const outline = page.getByRole('region', { name: 'Outline' });
  await outline.getByRole('button', { name: 'Add chapter' }).click();
  await page.getByLabel('Chapter title').fill('Two');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Slate skies, slate roofs.');
  await page.getByRole('button', { name: 'Find and replace' }).click();
  await page.keyboard.type('slate');
  await expect(bar.locator('.find-count')).toHaveText('1 of 2');
  await bar.getByRole('button', { name: 'Whole book' }).click();
  await expect(bar.locator('.find-count')).toHaveText('1 of 3');
  await expect(page.getByLabel('Chapter title')).toHaveValue('One');
  await bar.getByLabel('Replace with').fill('grey');
  await bar.getByRole('button', { name: 'Replace all' }).click();
  await expect(bar.locator('.find-count')).toHaveText('None');
  await expect(page.locator('.note-editor')).toContainText('The sea was grey.');
  await outline.locator('.outline-open', { hasText: 'Two' }).click();
  await expect(page.locator('.note-editor')).toContainText('grey skies, grey roofs.');
});

test('a deadline: words a day to finish on time, and whether the writing keeps pace', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  const outline = page.getByRole('region', { name: 'Outline' });
  await outline.getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('button', { name: 'Word goal…' }).click();
  await page.getByLabel('Word goal for the project').fill('1000');
  await page.keyboard.press('Enter');
  await outline.getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('button', { name: 'Deadline…' }).click();
  // Ten days, today included: 100 words a day.
  const due = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 9);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.getByLabel('Finish by').fill(due);
  await page.getByRole('button', { name: 'Set', exact: true }).click();
  const line = outline.getByLabel('Deadline');
  await expect(line).toContainText('10 days left');
  await expect(line).toContainText('Today: 0 of 100 words');
  await expect(line).toContainText('On track');
  await page.getByLabel('Chapter text').click();
  await page.keyboard.insertText(Array.from({ length: 120 }, () => 'word').join(' '));
  await expect(line).toContainText('Today’s target met');
  await expect(line).toContainText('Today: 120 of 100 words');
});

test('suggest a name: pick a region and era, click a name to add it to the book', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  const outline = page.getByRole('region', { name: 'Outline' });
  await outline.getByRole('button', { name: 'Add a character or place' }).click();
  await page.getByRole('button', { name: 'Suggest a name…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Suggest a name' });
  await dialog.getByLabel('Region').selectOption('german');
  await dialog.getByLabel('Era').selectOption('medieval');
  await expect(dialog.locator('.names-item').first()).toContainText(' von ');
  const name = (await dialog.locator('.names-item').first().textContent())!;
  await dialog.locator('.names-item').first().click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Character card' }).getByLabel('Name')).toHaveValue(name);
  await expect(outline.locator('.research-item')).toContainText([name]);
  // Places too.
  await outline.getByRole('button', { name: 'Add a character or place' }).click();
  await page.getByRole('button', { name: 'Suggest a name…' }).click();
  await dialog.getByRole('button', { name: 'Place' }).click();
  await expect(dialog.getByLabel('Era')).toHaveCount(0);
  await dialog.locator('.names-item').first().click();
  await expect(page.getByRole('region', { name: 'Place card' })).toBeVisible();
});

test('typewriter mode: the typing line stays mid-screen, other paragraphs fade, and keys can click', async ({ page }) => {
  await open(page);
  await newNote(page, 'Tide', 'First line.');
  await sidebar(page).locator('.account').click();
  await page.getByRole('tab', { name: 'Writing' }).click();
  const tw = page.getByRole('group', { name: 'Typewriter' });
  await tw.getByLabel('Keep the line you’re typing in the middle of the screen').check();
  await tw.getByLabel('Fade the other paragraphs').check();
  await tw.getByLabel('Typing sounds').check();
  await page.keyboard.press('Escape');
  await page.locator('.note-editor').first().click();
  await page.keyboard.press('Control+End');
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Enter');
    await page.keyboard.type(`Line ${i + 1} of the tide.`);
  }
  const where = await page.evaluate(() => {
    const caret = getSelection()!.getRangeAt(0).getClientRects()[0];
    const view = document.querySelector('.note-scroll')!.getBoundingClientRect();
    return (caret.top - view.top) / view.height;
  });
  expect(where).toBeGreaterThan(0.3);
  expect(where).toBeLessThan(0.6);
  await expect(page.locator('.note-editor .blk.tw-current')).toHaveText('Line 30 of the tide.');
  expect(await page.locator('.note-editor .blk').first().evaluate((el) => getComputedStyle(el).opacity)).toBe('0.3');
});

test('chapters open as pages, with no “Start writing” on the page, and the pinned bar keeps to one row', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await expect(page.locator('.page-view')).toBeVisible();
  const label = await page.locator('.note-editor .blk .text').first().evaluate((el) => getComputedStyle(el, '::before').content);
  expect(label).toBe('none');
  // One row, however narrow: the rest is under More.
  await page.setViewportSize({ width: 1000, height: 800 });
  const bar = page.locator('.note-toolbar').first();
  await expect.poll(() => bar.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(64);
  await page.getByRole('button', { name: 'More formatting' }).click();
  await expect(page.locator('.more-menu')).toBeVisible();
});

test('font, size, colour, highlight, superscript and change case on selected text, kept in the file', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Fonts', 'The sea was slate grey');
  await page.keyboard.press('Shift+Home');
  await page.getByRole('button', { name: 'Font', exact: true }).click();
  await page.getByLabel('Search fonts').fill('Lora');
  await page.locator('.font-menu .font-option', { hasText: /^Lora/ }).first().click();
  await page.keyboard.press('Shift+Home');
  await page.getByLabel('Font size', { exact: true }).fill('20');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Home');
  await page.getByRole('button', { name: 'Font colour' }).click();
  await page.getByRole('button', { name: 'Red', exact: true }).click();
  const span = page.locator('.note-editor .lk').first();
  await expect(span).toHaveText('The sea was slate grey');
  await expect(span).toHaveCSS('font-size', /^26\.6/);
  await expect(span).toHaveCSS('color', 'rgb(204, 0, 0)');
  // Change case and superscript (Word's keys).
  await page.keyboard.press('Shift+Home');
  await (await toolButton(page, 'Change case')).click();
  await page.getByRole('button', { name: 'UPPERCASE' }).click();
  await expect(span).toHaveText('THE SEA WAS SLATE GREY');
  await page.keyboard.press('End');
  await page.keyboard.press('Control+Shift+Equal');
  await page.keyboard.type('2');
  await expect(page.locator('.note-editor .lk[style*="super"]')).toHaveText('2');
  // Saved as Markdown that keeps it all.
  await page.waitForTimeout(800);
  const md = await page.evaluate(async () => {
    const m = await import('/@fs/' + 'home/user/crumpet-app/packages/editor/src/markdown.ts').catch(() => null);
    const s = (window as unknown as { crumpet: { flush(): void; getState(): { notes: { title: string; doc: unknown }[] } } }).crumpet;
    s.flush();
    const doc = s.getState().notes.find((n) => n.title === 'Fonts')!.doc;
    return m ? (m as { toMarkdown(d: unknown): string }).toMarkdown(doc) : JSON.stringify(doc);
  });
  expect(md).toContain('font="Lora"');
  expect(md).toContain('size=20');
  expect(md).toContain('color=#cc0000');
  expect(md).toContain('va=super');
});

test('paragraph settings: line spacing, indent, the Paragraph window, and a page break with Ctrl+Enter', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Spacing', 'First paragraph.');
  await page.keyboard.press('Control+2');
  const first = page.locator('.note-editor .blk').first();
  await expect(first).toHaveCSS('line-height', /px/);
  await page.keyboard.press('Control+m');
  await expect(first).toHaveCSS('margin-left', '48px');
  await (await toolButton(page, /Paragraph settings/)).click();
  const dialog = page.getByRole('dialog', { name: 'Paragraph' });
  await dialog.getByLabel('Before', { exact: true }).fill('18');
  await dialog.getByLabel('Special').selectOption('first');
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(first).toHaveCSS('margin-top', '24px');
  await expect(first).toHaveCSS('text-indent', '48px');
  // Ctrl+Enter: what follows starts on a new page.
  await page.keyboard.press('End');
  await page.keyboard.press('Control+Enter');
  await page.keyboard.type('On a new page.');
  await expect(page.locator('.note-editor .blk').nth(1)).toHaveAttribute('data-page-before', '');
});

test('page view status bar: page and word count, zoom, ruler indents, headings to jump to, and symbols and dates', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await expect(page.locator('.page-view')).toBeVisible();
  await page.locator('.note-editor .blk').first().click();
  await page.keyboard.type('Mara climbs the stairs');
  const bar = page.getByRole('group', { name: 'Page details' });
  await expect(bar.getByLabel('Page')).toHaveText('Page 1 of 1');
  await expect(bar.getByLabel('Word count')).toHaveText('4 words');
  await page.keyboard.press('Shift+Home');
  await expect(bar.getByLabel('Word count')).toHaveText('4 of 4 words');
  await page.keyboard.press('End');
  // Zoom: in from Fit, then back to Fit.
  await bar.getByRole('button', { name: 'Zoom in' }).click();
  await expect(bar.getByRole('button', { name: '110%' })).toBeVisible();
  await bar.getByRole('button', { name: '110%' }).click();
  await expect(bar.getByRole('button', { name: 'Fit' })).toHaveAttribute('aria-pressed', 'true');
  // The ruler: drag the left indent half an inch in.
  await bar.getByRole('button', { name: 'Ruler' }).click();
  const left = page.getByRole('button', { name: 'Left indent' });
  await expect(left).toBeVisible();
  const box = (await left.boundingBox())!;
  const ppi = await page.locator('.ruler').evaluate((el) => {
    const inch = el.querySelectorAll<HTMLElement>('.tick.inch');
    return inch[2].getBoundingClientRect().left - inch[1].getBoundingClientRect().left;
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + ppi / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.note-editor .blk').first()).toHaveCSS('margin-left', '48px');
  // A heading to jump to.
  await page.keyboard.press('Enter');
  await page.keyboard.type('The lamp');
  await page.keyboard.press('Control+Alt+1');
  await bar.getByRole('button', { name: 'Headings' }).click();
  await expect(page.locator('.headings-list').getByRole('button', { name: 'The lamp' })).toBeVisible();
  await page.locator('.headings-list').getByRole('button', { name: 'The lamp' }).click();
  // Insert a symbol and the date.
  await page.keyboard.press('End');
  await (await toolButton(page, 'Insert symbol')).click();
  await page.getByRole('button', { name: 'Em dash' }).click();
  await expect(page.locator('.note-editor .blk').nth(1)).toContainText('The lamp—');
  await (await toolButton(page, 'Insert date and time')).click();
  const iso = new Date().toISOString().slice(0, 10);
  await page.getByRole('button', { name: iso }).click();
  await expect(page.locator('.note-editor .blk').nth(1)).toContainText(iso);
});

test('list styles from the libraries, a numbering value, and paragraph borders and shading', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Lists', 'Overview');
  await (await toolButton(page, 'Numbering styles')).click();
  await page.getByRole('button', { name: 'Capital Roman numerals' }).click();
  const first = page.locator('.note-editor .blk').first();
  await expect(first).toHaveAttribute('data-num', 'upper-roman');
  await expect(first).toHaveAttribute('data-label', 'I.');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Method');
  const second = page.locator('.note-editor .blk').nth(1);
  await expect(second).toHaveAttribute('data-num', 'upper-roman');
  await (await toolButton(page, 'Numbering styles')).click();
  await page.getByLabel('Numbering value').fill('7');
  await page.getByRole('button', { name: 'Set', exact: true }).click();
  await expect(second).toHaveAttribute('data-label', 'VII.');
  // A boxed, shaded paragraph after the list.
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Boxed');
  const boxed = page.locator('.note-editor .blk').nth(2);
  await expect(boxed).not.toHaveClass(/blk-list/);
  await (await toolButton(page, 'Borders')).click();
  await page.getByRole('button', { name: 'Box (all sides)' }).click();
  await expect(boxed).toHaveCSS('border-top-style', 'solid');
  await (await toolButton(page, 'Shading')).click();
  await page.getByRole('button', { name: 'Light gold' }).click();
  await expect(boxed).toHaveCSS('background-color', 'rgb(255, 242, 204)');
});

test('table layout and design: merge and split cells, shade a cell, align a column, banding, lines and the heading row', async ({ page }) => {
  await open(page);
  await newNote(page, 'Cast', 'Who is who:');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/table');
  await page.keyboard.press('Enter');
  const table = page.locator('.note-editor .blk-table table');
  for (const text of ['Name', 'Role', 'Age', 'Mara', 'Daughter', '32']) {
    await page.keyboard.type(text);
    await page.keyboard.press('Tab');
  }
  const menu = async (name: string) => {
    await page.getByRole('button', { name: 'Table ▾' }).click();
    await page.locator('.table-menu button', { hasText: new RegExp(`^${name}$`) }).click();
  };
  // Merge Mara with Daughter.
  await table.locator('.cell[data-r="1"][data-c="0"]').click();
  await menu('Merge with cell to the right');
  await expect(table.locator('td[colspan="2"]')).toHaveText('Mara Daughter');
  await expect(table.locator('tr').nth(1).locator('td')).toHaveCount(2);
  await menu('Split cell');
  await expect(table.locator('tr').nth(1).locator('td')).toHaveCount(3);
  // Shade a cell and right-align the Age column.
  await table.locator('.cell[data-r="1"][data-c="2"]').click();
  await page.getByRole('button', { name: 'Table ▾' }).click();
  await page.getByRole('button', { name: 'Shade cell light gold' }).click();
  await expect(table.locator('td').filter({ hasText: '32' })).toHaveCSS('background-color', 'rgb(255, 242, 204)');
  await menu('Right');
  await expect(table.locator('td').filter({ hasText: '32' })).toHaveCSS('text-align', 'right');
  await menu('Banded rows');
  await expect(table).toHaveClass(/banded/);
  await menu('Outside only');
  await expect(table).toHaveAttribute('data-borders', 'outside');
  await menu('Heading row');
  await expect(table.locator('th')).toHaveCount(0);
  const md = await page.evaluate(async () => {
    const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
    return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
  });
  expect(md).toContain('| --- | --- | ---: |');
  expect(md).toContain('{table .noheader .banded borders=outside shade=1-2-#fff2cc}');
});

test('table of contents: from the / menu, lists the headings with their pages, and goes to one; landscape pages', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await expect(page.locator('.page-view')).toBeVisible();
  await page.locator('.note-editor .blk').first().click();
  await page.keyboard.type('/contents');
  await page.keyboard.press('Enter');
  const toc = page.locator('.note-editor .blk-toc');
  await expect(toc).toContainText('Headings you add');
  await page.keyboard.type('Arrival');
  await page.keyboard.press('Control+Alt+1');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+Enter');
  await page.keyboard.type('Departure');
  await page.keyboard.press('Control+Alt+2');
  await expect(toc.locator('.toc-entry')).toHaveCount(2);
  await expect(toc.locator('.toc-entry').nth(1)).toHaveClass(/toc-2/);
  await expect(toc.locator('.toc-entry').nth(0).locator('.toc-page')).toHaveText('1');
  await expect(toc.locator('.toc-entry').nth(1).locator('.toc-page')).toHaveText('2');
  // Clicking a line puts the caret at its heading.
  await page.keyboard.press('Control+Home');
  await toc.locator('.toc-entry', { hasText: 'Departure' }).click();
  await page.keyboard.type('The ');
  await expect(toc.locator('.toc-entry').nth(1)).toContainText('The Departure');
  // Landscape pages are wider than they are tall.
  await page.evaluate(() => {
    const s = (window as unknown as { crumpet: { getState(): { projects: { id: string; page?: object }[] }; setProjectPage(id: string, p: object): void } }).crumpet;
    const p = s.getState().projects[0];
    s.setProjectPage(p.id, { size: 'letter', margins: { top: 1, right: 1, bottom: 1, left: 1 }, pageNumbers: false, ...p.page, landscape: true });
  });
  await expect.poll(() => page.locator('.sheet').first().evaluate((el) => (el as HTMLElement).offsetWidth > (el as HTMLElement).offsetHeight)).toBe(true);
});

test('formatting inside table cells, from the bar and with Ctrl+B, and dragging a column wider', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Cast', 'Who:');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/table');
  await page.keyboard.press('Enter');
  for (const text of ['Name', 'Notes', 'Age', 'Mara', 'Keeps the lamp']) {
    await page.keyboard.type(text);
    await page.keyboard.press('Tab');
  }
  const table = page.locator('.note-editor .blk-table table');
  // Ctrl+B on the word at the caret.
  await table.locator('.cell[data-r="1"][data-c="0"]').click();
  await page.keyboard.press('Control+b');
  await expect(table.locator('.cell[data-r="1"][data-c="0"] strong')).toHaveText('Mara');
  // A size from the bar, on the selected word.
  const notes = table.locator('.cell[data-r="1"][data-c="1"]');
  await notes.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Control+ArrowLeft');
  await page.getByLabel('Font size', { exact: true }).fill('18');
  await page.keyboard.press('Enter');
  await expect(notes.locator('.lk')).toHaveText('lamp');
  await expect(notes.locator('.lk')).toHaveCSS('font-size', '24px');
  // Drag the first column's edge to the right.
  const before = await table.locator('th').first().evaluate((el) => el.getBoundingClientRect().width);
  const grip = table.locator('.col-grip').first();
  const box = (await grip.boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 104, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => table.locator('th').first().evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(before + 60);
  const md = await page.evaluate(async () => {
    const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
    return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
  });
  expect(md).toContain('| **Mara** | Keeps the [lamp]{size=18} |');
  expect(md).toMatch(/\{table widths=[\d.]+-[\d.]+-[\d.]+\}/);
});

test('pasting keeps fonts and colours; Ctrl+Shift+V pastes just the text', async ({ page }) => {
  await open(page);
  await newNote(page, 'Pasted', 'Start ');
  const paste = (html: string, text: string) =>
    page.evaluate(
      ([h, t]) => {
        const dt = new DataTransfer();
        dt.setData('text/html', h);
        dt.setData('text/plain', t);
        document.querySelector('.note-editor')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      },
      [html, text],
    );
  await paste('<span style="font-family:Lora;font-size:18pt;color:#cc0000">red Lora</span>', 'red Lora');
  const body = page.locator('.note-editor');
  await expect(body.locator('.lk')).toHaveText('red Lora');
  await expect(body.locator('.lk')).toHaveCSS('color', 'rgb(204, 0, 0)');
  await expect(body.locator('.lk')).toHaveCSS('font-size', '24px');
  // Ctrl+Shift+V: the same, without the look.
  await page.keyboard.press('End');
  await page.keyboard.type(' ');
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await body.dispatchEvent('keydown', { key: 'V', code: 'KeyV', ctrlKey: true, shiftKey: true, bubbles: true });
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
  await paste('<span style="color:#1155cc">plain blue</span>', 'plain blue');
  await expect(body).toContainText('red Lora plain blue');
  await expect(body.locator('.lk')).toHaveCount(1);
});

test('page view lays out sections: two columns that flow and balance, a landscape page, and typing across a column break', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(async () => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { createNote(p: object): { id: string }; select(id: string): void; updateSettings(p: object): void; getState(): { settings: { pageView?: object } } } }).crumpet;
    const para = (i: number) => `Paragraph ${i}. The lamp had not been lit for eleven years, and still the boats steered by it. Mara climbed the hundred and twelve steps.`;
    const doc = `Intro.\n\nTwo columns. {sect=cont cols=2}\n\n${Array.from({ length: 16 }, (_, i) => para(i + 1)).join('\n\n')}\n\nOne column again. {sect=cont cols=1}\n\nWide. {sect=page orient=landscape}\n\nPortrait. {sect=page orient=portrait}`;
    const n = s.createNote({ title: 'Sections', doc: md.fromMarkdown(doc) });
    s.select(n.id);
    s.updateSettings({ pageView: { ...(s.getState().settings.pageView ?? {}), notes: true } });
  });
  const pages = page.locator('.note-editor .pg');
  await expect(pages).toHaveCount(4);
  // Page 1: the intro across the page, then two columns.
  await expect(pages.nth(0).locator('.pg-band')).toHaveCount(2);
  await expect(pages.nth(0).locator('.pg-band').nth(1).locator('.pg-col')).toHaveCount(2);
  // Page 2: the rest of the columns, balanced, then one column again.
  const bands = pages.nth(1).locator('.pg-band');
  await expect(bands).toHaveCount(2);
  const heights = await bands.nth(0).locator('.pg-col').evaluateAll((cols) => cols.map((c) => c.getBoundingClientRect().height));
  expect(Math.abs(heights[0] - heights[1])).toBeLessThan(60);
  await expect(bands.nth(1)).toContainText('One column again.');
  // Page 3 is on its side.
  const size = await pages.nth(2).evaluate((el) => [(el as HTMLElement).offsetWidth, (el as HTMLElement).offsetHeight]);
  expect(size[0]).toBeGreaterThan(size[1]);
  await expect(page.locator('.sheet').nth(2)).toHaveClass(/landscape/);
  // A paragraph split between columns: typing at the start of the second part goes in the right place.
  const cont = page.locator('.note-editor [data-cont]').first();
  await expect(cont).toBeAttached();
  const id = await cont.getAttribute('data-block');
  const from = Number(await cont.getAttribute('data-from'));
  await cont.evaluate((c) => {
    const first = document.createTreeWalker(c, NodeFilter.SHOW_TEXT).nextNode()!;
    const r = document.createRange();
    r.setStart(first, 0);
    r.collapse(true);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
    (c.closest('[contenteditable=true]') as HTMLElement).focus();
  });
  await page.keyboard.type('XY');
  const text = await page.evaluate((id) => {
    const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: { blocks: { id: string; runs: { text: string }[] }[] } }[] } } }).crumpet.getState();
    return s.notes.find((n) => n.id === s.selectedId)!.doc.blocks.find((b) => b.id === id)!.runs.map((r) => r.text).join('');
  }, id);
  expect(text.slice(from, from + 2)).toBe('XY');
});
