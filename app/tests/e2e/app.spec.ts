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
