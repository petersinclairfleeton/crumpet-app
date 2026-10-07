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
  await page.getByRole('button', { name: 'Ink', exact: true }).click();
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
  await page.getByRole('button', { name: /^Alignment/ }).click();
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
  const breaks = page.locator('.note-editor .page-break');
  await expect(breaks.first()).toBeAttached();
  // A paragraph broken across two pages: text on both sides of the break.
  const split = await breaks.evaluateAll((els) => els.some((b) => !!b.previousSibling?.textContent && !!b.nextSibling?.textContent));
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
  const brk = page.locator('.note-editor .page-break').first();
  await expect(brk).toBeAttached();
  const doc = () =>
    page.evaluate(() => {
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: { blocks: { runs: { text: string }[] }[] } }[] } } }).crumpet;
      const st = s.getState();
      return st.notes.find((n) => n.id === st.selectedId)!.doc.blocks.map((b) => b.runs.map((r) => r.text).join('')).join('\n');
    });
  const before = await doc();
  // Put the caret just after the break, then type and delete.
  await brk.evaluate((b) => {
    const after = b.nextSibling!;
    const sel = getSelection()!;
    const r = document.createRange();
    if (after.nodeType === Node.TEXT_NODE) r.setStart(after, 0);
    else r.setStartAfter(b);
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
  await page.getByRole('button', { name: 'Page view' }).click();
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
  await expect(page.locator('.note-toolbar').getByRole('button', { name: 'Undo' })).toBeVisible();
  await page.getByRole('button', { name: 'Formatting bar' }).click();
  await expect(page.locator('.note-toolbar').getByRole('button', { name: 'Undo' })).toHaveCount(0);
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
