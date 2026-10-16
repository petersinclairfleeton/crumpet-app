import { type Locator, type Page, expect, test } from '@playwright/test';

// Every test starts in a fresh browser profile, so Crumpet starts empty: everything is created here.

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Notebooks' });
/** Unfolds the sidebar's Explore (recent notes, writing stats, the graph). */
async function sideMore(page: Page) {
  const more = sidebar(page).getByRole('button', { name: 'Explore', exact: true });
  if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click();
}
const list = (page: Page) => page.getByRole('region', { name: 'Notes', exact: true });

async function open(page: Page) {
  await page.goto('/');
  await expect(list(page)).toBeVisible();
  // These tests reach every formatting button, so they use the full bar (the calm one has its own test).
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbarAll: true }));
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
  await expect(welcome.getByRole('heading', { name: 'A clean page.' })).toBeVisible();
  await expect(welcome.getByRole('button', { name: /Bring in your writing/ })).toBeVisible();
  await welcome.getByRole('button', { name: /Write a note/ }).click();
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

test('drag and drop: notes onto a notebook, Favorites, a tag and the Trash, and back out of the Trash', async ({ page }) => {
  await open(page);
  await newNotebook(page, 'Recipes');
  await sidebar(page).getByRole('button', { name: 'All Notes' }).click();
  await newNote(page, 'Soda bread', 'Buttermilk and flour.');
  await page.getByRole('button', { name: 'Add tag' }).click();
  await page.keyboard.type('baking');
  await page.keyboard.press('Enter');
  await newNote(page, 'Scones', 'Cream first.');
  const card = (title: string) => list(page).locator('.card', { hasText: title });
  const recipes = sidebar(page).locator('.nb-row', { hasText: 'Recipes' });

  // Onto a notebook: filed in it.
  await card('Scones').dragTo(recipes);
  await expect(recipes.locator('.count')).toHaveText('1');
  // Onto Favorites: starred.
  await card('Scones').dragTo(sidebar(page).getByRole('button', { name: /^Favorites/ }));
  await expect(card('Scones').locator('.pin')).toBeVisible();
  // Onto a tag: tagged.
  await sidebar(page).getByRole('button', { name: 'Tags' }).click();
  await card('Scones').dragTo(sidebar(page).getByRole('button', { name: /^#baking/ }));
  await expect(card('Scones')).toContainText('#baking');

  // Two picked notes onto the Trash together.
  await card('Soda bread').click();
  await card('Scones').click({ modifiers: ['Control'] });
  await card('Scones').dragTo(sidebar(page).getByRole('button', { name: /^Trash/ }));
  await expect(list(page).locator('.card')).toHaveCount(0);
  await expect(sidebar(page).getByRole('button', { name: /^Trash/ })).toContainText('2');

  // Out of the Trash onto a notebook: back, and filed there.
  await sidebar(page).getByRole('button', { name: /^Trash/ }).click();
  await card('Soda bread').dragTo(recipes);
  await expect(card('Soda bread')).toHaveCount(0);
  await recipes.getByRole('button', { name: 'Recipes', exact: true }).click();
  await expect(card('Soda bread')).toBeVisible();
});

test('drag and drop in the sidebar: notebooks into and out of stacks, reordering notebooks, stacks and projects, notes into a project', async ({ page }) => {
  await open(page);
  await newNotebook(page, 'Apple');
  await newNotebook(page, 'Zebra');
  await newStack(page, 'Kitchen');
  await newStack(page, 'Attic');
  const side = sidebar(page);
  const nb = (name: string) => side.locator('.nb-row', { hasText: name });
  const stack = (name: string) => side.locator('.stack-row', { hasText: name });
  const order = () => side.locator('.nb-row .row-main, .stack-row .row-main').allInnerTexts();
  // At first, by name.
  expect(await order()).toEqual(['Apple', 'Zebra', 'Attic', 'Kitchen']);

  // A notebook dropped on another goes just above it.
  await nb('Zebra').dragTo(nb('Apple'));
  expect(await order()).toEqual(['Zebra', 'Apple', 'Attic', 'Kitchen']);
  // A stack dropped on another goes above it.
  await stack('Kitchen').dragTo(stack('Attic'));
  expect(await order()).toEqual(['Zebra', 'Apple', 'Kitchen', 'Attic']);
  // A notebook dropped on a stack goes into it.
  await nb('Apple').dragTo(stack('Kitchen'));
  await expect(nb('Apple')).toHaveCSS('padding-left', '26px');
  expect(await order()).toEqual(['Zebra', 'Kitchen', 'Apple', 'Attic']);
  // ... and out again onto the Notebooks heading, to the top.
  await nb('Apple').dragTo(side.locator('.side-heading', { hasText: 'Notebooks' }));
  expect(await order()).toEqual(['Apple', 'Zebra', 'Kitchen', 'Attic']);

  // Projects: dragged into a new order.
  for (const name of ['Novel', 'Essay']) {
    // In a book the sidebar steps back to its strip; bring it back to make another.
    if (await side.getByRole('button', { name: 'Show the sidebar' }).count()) await side.getByRole('button', { name: 'Show the sidebar' }).click();
    await side.getByRole('button', { name: 'New project' }).click();
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');
    await expect(side.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  const projects = () => side.locator('.side-row').filter({ has: page.locator('.ellipsis') }).filter({ hasText: /^(Novel|Essay)/ }).allInnerTexts();
  expect((await projects()).map((t) => t.split('\n')[0])).toEqual(['Novel', 'Essay']);
  await side.getByRole('button', { name: /^Essay/ }).dragTo(side.getByRole('button', { name: /^Novel/ }));
  expect((await projects()).map((t) => t.split('\n')[0])).toEqual(['Essay', 'Novel']);

  // A note dropped on a project becomes its research.
  await side.getByRole('button', { name: 'All Notes' }).click();
  await newNote(page, 'Old letters', 'Found in the attic.');
  await list(page).locator('.card', { hasText: 'Old letters' }).dragTo(side.getByRole('button', { name: /^Novel/ }));
  await expect(list(page).locator('.card', { hasText: 'Old letters' })).toHaveCount(0);
  await side.getByRole('button', { name: /^Novel/ }).click();
  const outline = page.getByRole('region', { name: 'Outline' });
  await expect(outline.locator('.research-item', { hasText: 'Old letters' })).toBeVisible();
  // ... and dragged onto a notebook, it's a note again, filed there.
  await outline.locator('.research-item', { hasText: 'Old letters' }).dragTo(nb('Zebra'));
  await expect(outline.locator('.research-item', { hasText: 'Old letters' })).toHaveCount(0);
  await expect(nb('Zebra').locator('.count')).toHaveText('1');

  // The order is kept.
  await page.reload();
  await expect(list(page)).toBeVisible();
  expect(await order()).toEqual(['Apple', 'Zebra', 'Kitchen', 'Attic']);
  expect((await projects()).map((t) => t.split('\n')[0])).toEqual(['Essay', 'Novel']);
});

test('right click on a note: rename, favourite, move, tag, duplicate, trash, and restore or delete from the Trash', async ({ page }) => {
  await open(page);
  await newNotebook(page, 'Ideas');
  await sidebar(page).getByRole('button', { name: 'All Notes' }).click();
  await newNote(page, 'Plot twist', 'The butler was right.');
  const card = (title: string) => list(page).locator('.card', { hasText: title });
  const menu = page.locator('.context-menu');

  await card('Plot twist').click({ button: 'right' });
  await menu.getByRole('button', { name: 'Rename…' }).click();
  await page.keyboard.type('Big twist');
  await page.keyboard.press('Enter');
  await expect(card('Big twist')).toBeVisible();
  await expect(menu).toHaveCount(0);

  await card('Big twist').click({ button: 'right' });
  await menu.getByRole('button', { name: 'Add to Favorites' }).click();
  await expect(card('Big twist').locator('.pin')).toBeVisible();

  await card('Big twist').click({ button: 'right' });
  await menu.getByRole('button', { name: 'Move to notebook…' }).click();
  await menu.getByRole('button', { name: 'Ideas' }).click();
  await expect(card('Big twist')).toContainText('Ideas');

  await card('Big twist').click({ button: 'right' });
  await menu.getByRole('button', { name: 'Add tag…' }).click();
  await page.keyboard.type('plot');
  await page.keyboard.press('Enter');
  await expect(card('Big twist')).toContainText('#plot');

  await card('Big twist').click({ button: 'right' });
  await menu.getByRole('button', { name: 'Duplicate' }).click();
  await expect(card('Big twist (copy)')).toContainText('The butler was right.');

  await card('Big twist (copy)').click({ button: 'right' });
  await menu.getByRole('button', { name: 'Move to Trash' }).click();
  await expect(card('Big twist (copy)')).toHaveCount(0);

  // In the Trash: restore, or delete for good.
  await sidebar(page).getByRole('button', { name: /^Trash/ }).click();
  await card('Big twist (copy)').click({ button: 'right' });
  await expect(menu.getByRole('button', { name: 'Rename…' })).toHaveCount(0);
  await menu.getByRole('button', { name: 'Delete forever' }).click();
  await expect(list(page)).toContainText('The Trash is empty');

  // Escape closes it; Recent Notes have it too, and notebooks open their own menu.
  await sidebar(page).getByRole('button', { name: 'All Notes' }).click();
  await card('Big twist').click({ button: 'right' });
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await sideMore(page);
  await sidebar(page).getByRole('region', { name: 'Recent notes' }).getByRole('button', { name: 'Big twist' }).click({ button: 'right' });
  await expect(menu.getByRole('button', { name: 'Open to the side' })).toBeVisible();
  await page.keyboard.press('Escape');
  await sidebar(page).locator('.nb-row', { hasText: 'Ideas' }).click({ button: 'right' });
  await expect(page.getByRole('button', { name: 'Delete notebook…' })).toBeVisible();
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
  await page.getByRole('button', { name: 'Crumpet dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Blueberry' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))).toBe('#3E6DB5');
  await page.getByRole('tab', { name: 'Account & sync' }).click();
  // Typed a letter at a time: the box keeps the caret while the app saves each one.
  await page.getByLabel('Your name').click();
  await page.keyboard.type('Peter Sinclair-Fleeton');
  await expect(page.getByLabel('Your name')).toHaveValue('Peter Sinclair-Fleeton');
  await expect(page.getByLabel('Your name')).toBeFocused();
  await expect(sidebar(page).locator('.avatar')).toHaveText('PS');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('paper colour: picked from the formatting bar or Settings, with ink to match, in normal and page view', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Paper', 'Written on sepia.');
  const scroll = page.locator('.note-scroll');
  const bg = () => scroll.evaluate((el) => getComputedStyle(el).backgroundColor);
  await (await toolButton(page, 'Page colour')).click();
  await page.getByRole('group', { name: 'Paper colour' }).getByRole('button', { name: 'Sepia paper' }).click();
  await expect.poll(bg).toBe('rgb(239, 224, 194)');
  await page.reload();
  await expect.poll(bg).toBe('rgb(239, 224, 194)');

  // Dark paper gets light ink; in page view it's the sheets that change.
  await sidebar(page).locator('.account').click();
  await page.getByRole('tab', { name: 'Look' }).click();
  await page.getByRole('group', { name: 'Paper', exact: true }).getByRole('button', { name: 'Night paper' }).click();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.locator('.note-editor').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(232, 230, 225)');
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ pageView: { notes: true } }));
  await expect.poll(() => page.locator('.sheet').first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(27, 28, 32)');

  // Back to the theme's own.
  await (await toolButton(page, 'Page colour')).click();
  await page.getByRole('group', { name: 'Paper colour' }).getByRole('button', { name: 'The theme’s own' }).click();
  await expect.poll(() => page.locator('.sheet').first().evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgb(27, 28, 32)');
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
  await settings.getByRole('button', { name: 'Liquid glass', exact: true }).click();
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

test('a chapter’s first paragraph, and the first after a heading or blank line, aren’t indented; a tick box indents them too', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await page.getByLabel('Chapter title').fill('The Keeper');
  await page.keyboard.press('Enter');
  for (const line of ['The lamp had not been lit for eleven years.', 'Mara climbed anyway.', '', 'Morning came.', 'The gulls returned.']) {
    if (line) await page.keyboard.type(line);
    await page.keyboard.press('Enter');
  }
  const blk = (n: number) => page.locator('.note-editor .blk').nth(n);
  const indent = (n: number) => blk(n).evaluate((el) => getComputedStyle(el).textIndent);
  // Manuscript style: half an inch, but not on the opening paragraphs.
  await expect.poll(() => indent(0)).toBe('0px');
  await expect.poll(() => indent(1)).toBe('48px');
  await expect.poll(() => indent(3)).toBe('0px');
  await expect.poll(() => indent(4)).toBe('48px');

  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await blk(1).click();
  await page.getByRole('button', { name: 'Style', exact: true }).click();
  await page.getByRole('button', { name: 'Modify styles…' }).click();
  await page.getByRole('dialog').getByLabel(/Indent opening paragraphs too/).check();
  await expect.poll(() => indent(0)).toBe('48px');
  await expect.poll(() => indent(3)).toBe('48px');
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

test('the page scrolls to follow the typing, in normal view and page view', async ({ page }) => {
  await open(page);
  await newNote(page, 'Long', '');
  const caretInSight = () =>
    page.evaluate(() => {
      const r = getSelection()!.getRangeAt(0).getBoundingClientRect();
      const box = document.querySelector('.note-scroll')!.getBoundingClientRect();
      return r.bottom <= box.bottom && r.top >= box.top;
    });
  for (let i = 0; i < 40; i++) {
    await page.keyboard.insertText(`Line ${i + 1} of a long note.`);
    await page.keyboard.press('Enter');
  }
  await page.keyboard.type('Still in sight');
  await expect.poll(caretInSight).toBe(true);
  expect(await page.locator('.note-scroll').evaluate((el) => el.scrollTop)).toBeGreaterThan(200);

  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ pageView: { notes: true } }));
  await expect(page.locator('.pg').first()).toBeVisible();
  await page.locator('.note-scroll').evaluate((el) => (el.scrollTop = 0));
  await page.keyboard.press('Control+End');
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Enter');
    await page.keyboard.insertText(`More ${i + 1}`);
  }
  await expect.poll(caretInSight).toBe(true);
});

test('page view: typing inside a paragraph redraws just that paragraph, not every page', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ pageView: { notes: true } }));
  await newNote(page, 'Pages', '');
  for (let i = 0; i < 30; i++) {
    await page.keyboard.insertText(`Paragraph ${i + 1}: the lamp had not been lit for eleven years, and the stairs were slick with salt.`);
    await page.keyboard.press('Enter');
  }
  await expect.poll(() => page.locator('.pg').count()).toBeGreaterThan(1);
  const pages = await page.locator('.pg').count();
  // Mark the pages; a full redraw would replace them.
  await page.evaluate(() => document.querySelectorAll('.pg').forEach((el) => ((el as HTMLElement).dataset.mark = 'kept')));
  await page.locator('.note-editor .blk', { hasText: 'Paragraph 3:' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Quietly');
  await expect(page.locator('.note-editor .blk', { hasText: 'Paragraph 3:' })).toContainText('salt. Quietly');
  await expect(page.locator('.pg[data-mark="kept"]')).toHaveCount(pages);
  // Enough to need another line: the pages are laid out again, and nothing is lost.
  await page.keyboard.type(' the keeper climbed, counting every step as her father had taught her, all the way up to the lamp room');
  await expect(page.locator('.pg[data-mark="kept"]')).toHaveCount(0);
  await expect(page.locator('.note-editor')).toContainText('up to the lamp room');
  await expect(page.locator('.note-editor')).toContainText('Paragraph 30:');
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

test('layout: fold the sidebar, resize the list, and panes of tabs: split, drag in, move and close', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1500, height: 900 });
  await newNote(page, 'First', 'One');
  await newNote(page, 'Second', 'Two');
  const layout = page.getByRole('button', { name: 'Layout', exact: true });
  await layout.click();
  await page.getByRole('button', { name: 'Icons', exact: true }).click();
  await expect(page.locator('.rail')).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCount(0);
  // Split right: the note in a second pane, which is now where notes open.
  await page.getByRole('button', { name: 'Split right' }).click();
  const panes = page.getByRole('region', { name: 'Pane' });
  await expect(panes).toHaveCount(2);
  await list(page).locator('.card', { hasText: 'First' }).click();
  await expect(panes.nth(1).getByLabel('Title')).toHaveValue('First');
  await expect(panes.nth(0).getByLabel('Title')).toHaveValue('Second');
  // Working in the first pane makes the list open notes there.
  await panes.nth(0).locator('.note-editor').click();
  await page.locator('.rail').getByRole('button', { name: 'New note' }).click();
  await expect(panes.nth(0).getByLabel('Title')).toBeFocused();
  await page.keyboard.type('Third');
  await expect(panes.nth(0).getByLabel('Title')).toHaveValue('Third');
  // A middle click opens a note as a new tab.
  await list(page).locator('.card', { hasText: 'Second' }).click({ button: 'middle' });
  await expect(panes.nth(0).getByRole('tab')).toHaveText(['Third', 'Second']);
  // Dragging a note to the bottom of a pane opens it below.
  const right = panes.nth(1).locator('.pane-body');
  const box = (await right.boundingBox())!;
  await list(page).locator('.card', { hasText: 'Third' }).dragTo(right, { targetPosition: { x: box.width / 2, y: box.height - 20 } });
  await expect(panes).toHaveCount(3);
  await expect(page.locator('.pane-split.col')).toHaveCount(1);
  // A tab dragged onto another pane's tabs moves there.
  await panes.nth(0).getByRole('tab', { name: 'Second' }).dragTo(panes.nth(1).locator('.pane-tabs'));
  await expect(panes.nth(0).getByRole('tab')).toHaveText(['Third']);
  await expect(panes.nth(1).getByRole('tab')).toHaveText(['First', 'Second']);
  // Closing a pane's last tab closes the pane.
  await panes.nth(2).getByRole('button', { name: 'Close tab' }).click();
  await expect(panes).toHaveCount(2);
  // Resizing the list with the keyboard.
  const edge = page.getByRole('separator', { name: 'Note list width' });
  await edge.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => (window as unknown as { crumpet: { getState(): { settings: { layout?: { listWidth?: number } } } } }).crumpet.getState().settings.layout?.listWidth)).toBe(376);
  // The panes are remembered.
  await page.reload();
  await expect(page.getByRole('region', { name: 'Pane' })).toHaveCount(2);
  // The sidebar hidden with Ctrl+\.
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
  await page.getByRole('button', { name: 'take a quick tour' }).click();
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

test('the guide: opens by itself on a first visit, chapter by chapter with pictures and workflows, and again from the ? button', async ({ page }) => {
  // (The guide waits for automated browsers like this one to ask; here it behaves as for a person.)
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await page.goto('/');
  // First the sign-in screen (accounts are on in the tests' build); the guide comes after it.
  await page.getByRole('dialog', { name: 'Sign in to Crumpet' }).getByRole('button', { name: 'Continue without an account' }).click();
  const guide = page.getByRole('dialog', { name: /the guide/ });
  await expect(guide.getByRole('heading', { name: 'Welcome to Crumpet' })).toBeVisible();
  // Its pictures are real files that load.
  const loaded = () => guide.locator('.guide-shot img').evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0);
  await expect.poll(loaded).toBe(true);
  await guide.getByRole('button', { name: /^Next/ }).click();
  await expect(guide.getByRole('heading', { name: 'Notes, notebooks and tags' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(guide.getByRole('heading', { name: 'Books and long writing' })).toBeVisible();
  // A second picture, and one shown full size.
  await guide.getByRole('button', { name: /^Picture 2/ }).click();
  await expect(guide.locator('figcaption')).toContainText('Cards');
  await expect.poll(loaded).toBe(true);
  await guide.locator('.guide-shot').click();
  await expect(guide.getByRole('button', { name: 'Close the picture' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(guide.getByRole('button', { name: 'Close the picture' })).toHaveCount(0);
  await expect(guide).toBeVisible();
  // Workflows open one at a time.
  await guide.getByRole('navigation').getByRole('button', { name: /Workflows/ }).click();
  await expect(guide).toContainText('Click + next to Projects in the sidebar');
  await guide.getByRole('button', { name: /Keep a journal/ }).click();
  await expect(guide).toContainText('Click Today in the sidebar');
  await expect(guide).not.toContainText('Click + next to Projects in the sidebar');
  // Ready: a name, then a first note.
  await guide.getByRole('button', { name: /^Next/ }).click();
  await guide.getByLabel('Your name').fill('Alex Rowan');
  await expect(sidebar(page).locator('.avatar')).toHaveText('AR');
  await guide.getByRole('button', { name: /Write a note/ }).click();
  await expect(guide).toHaveCount(0);
  await expect(page.getByLabel('Title')).toBeFocused();
  // Seen: it doesn't open by itself again, but the ? button and the command palette bring it back.
  await page.reload();
  await expect(list(page)).toBeVisible();
  await expect(guide).toHaveCount(0);
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('button', { name: 'Guide to Crumpet' }).click();
  await expect(guide.getByRole('heading', { name: 'Welcome to Crumpet' })).toBeVisible();
  await guide.getByRole('button', { name: 'Close the guide' }).click();
  await page.keyboard.press('Control+p');
  await page.keyboard.type('guide');
  await page.keyboard.press('Enter');
  await expect(guide).toBeVisible();
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

test('Word documents: download a note as .docx, and open one as a new note', async ({ page }, info) => {
  await open(page);
  await newNote(page, 'Letter home', 'Dear all,');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/bullet');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The weather is fine');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download as Word document' }).click()]);
  expect(download.suggestedFilename()).toBe('Letter home.docx');
  const file = info.outputPath('Letter home.docx');
  await download.saveAs(file);
  // Upload it: it opens as a Word document, kept as one.
  await sidebar(page).getByRole('button', { name: 'New from a template' }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Upload files…/ }).click()]);
  await chooser.setFiles(file);
  await expect(list(page).locator('.card')).toHaveCount(2);
  await expect(page.getByLabel('Title')).toHaveValue('Letter home');
  await expect(page.locator('.note-editor .blk').first()).toHaveText('Dear all,');
  await expect(page.locator('.note-editor .blk-bullet')).toHaveText('The weather is fine');
  const banner = page.locator('.word-banner');
  await expect(banner).toContainText('Word document · saved back to Letter-home.docx');
  // Edited here, it's saved back to its own file, which downloads with the change.
  await page.locator('.note-editor .blk-bullet').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' and warm');
  const [again] = await Promise.all([page.waitForEvent('download'), banner.getByRole('button', { name: 'Download' }).click()]);
  expect(again.suggestedFilename()).toBe('Letter-home.docx');
  // Uploaded once more, the change is in it.
  const file2 = info.outputPath('Letter again.docx');
  await again.saveAs(file2);
  const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), sidebar(page).getByRole('button', { name: 'Upload files' }).click()]);
  await chooser2.setFiles(file2);
  await expect(list(page).locator('.card')).toHaveCount(3);
  await expect(page.locator('.note-editor .blk-bullet')).toHaveText('The weather is fine and warm');
  // The file is kept with the note, and comes back after a reload.
  await page.reload();
  await expect(page.locator('.word-banner')).toBeVisible();
});

/** Drops files from "the computer" on an element, as a browser does. */
async function dropFiles(target: Locator, files: { name: string; type: string; text: string }[], at?: { x: number; y: number }) {
  await target.evaluate(
    (el, { files, at }) => {
      const r = el.getBoundingClientRect();
      const dt = new DataTransfer();
      for (const f of files) dt.items.add(new File([f.text], f.name, { type: f.type }));
      const opts = { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + (at ? at.x : r.width / 2), clientY: r.top + (at ? at.y : r.height / 2) };
      el.dispatchEvent(new DragEvent('dragenter', opts));
      el.dispatchEvent(new DragEvent('dragover', opts));
      el.dispatchEvent(new DragEvent('drop', opts));
    },
    { files, at },
  );
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#c33"/></svg>';

test('uploading files: each opens as what it is, from the Upload button or dropped on a notebook, the list or a pane', async ({ page }) => {
  await open(page);
  await newNotebook(page, 'Scans');
  // Upload: a picture, a PDF, a Markdown file and something Crumpet can't show.
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), sidebar(page).getByRole('button', { name: 'Upload files' }).click()]);
  const buf = (s: string) => (globalThis as unknown as { Buffer: { from(s: string): Uint8Array } }).Buffer.from(s) as never;
  await chooser.setFiles([
    { name: 'Map.svg', mimeType: 'image/svg+xml', buffer: buf(SVG) },
    { name: 'Lease.pdf', mimeType: 'application/pdf', buffer: buf('%PDF-1.4\n%%EOF') },
    { name: 'Plan.md', mimeType: 'text/markdown', buffer: buf('# Plan\n\n- Pack\n- Go') },
    { name: 'Budget.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: buf('not really') },
  ]);
  const cards = list(page).locator('.card');
  await expect(cards).toHaveCount(4);
  // Into the notebook being looked at.
  await expect(sidebar(page).locator('.nb-row', { hasText: 'Scans' }).locator('.count')).toHaveText('4');
  // The last one is open: a file Crumpet can't show, kept to download.
  const file = page.getByRole('region', { name: 'File' });
  await expect(file).toContainText('File · Budget.xlsx');
  await expect(file.locator('.file-glyph')).toHaveText('XLSX');
  const [download] = await Promise.all([page.waitForEvent('download'), file.getByRole('button', { name: 'Download' }).click()]);
  expect(download.suggestedFilename()).toBe('Budget.xlsx');
  // The picture and the PDF, shown as themselves.
  await cards.filter({ hasText: 'Map' }).click();
  await expect(page.getByRole('region', { name: 'File' }).locator('img')).toHaveAttribute('src', /^blob:/);
  await cards.filter({ hasText: 'Lease' }).click();
  await expect(page.getByRole('region', { name: 'File' }).locator('iframe[title="PDF"]')).toBeVisible();
  // Markdown is a note.
  await cards.filter({ hasText: 'Plan' }).click();
  await expect(page.locator('.note-editor .blk-bullet')).toHaveText(['Pack', 'Go']);

  // Dropped on a notebook in the sidebar: filed there.
  await newNotebook(page, 'Sounds');
  await sidebar(page).getByRole('button', { name: 'All Notes' }).click();
  await dropFiles(sidebar(page).locator('.nb-row', { hasText: 'Sounds' }), [{ name: 'Birdsong.mp3', type: 'audio/mpeg', text: 'ID3' }]);
  await expect(sidebar(page).locator('.nb-row', { hasText: 'Sounds' }).locator('.count')).toHaveText('1');
  await expect(page.getByRole('region', { name: 'File' }).locator('audio')).toBeVisible();

  // Dropped on the list: a note there.
  await sidebar(page).getByRole('button', { name: 'All Notes' }).click();
  await dropFiles(list(page), [{ name: 'Shopping.txt', type: 'text/plain', text: 'Eggs\nFlour' }]);
  await expect(page.getByLabel('Title')).toHaveValue('Shopping');
  await expect(page.locator('.note-editor .blk')).toHaveText(['Eggs', 'Flour']);

  // Dropped on the right edge of the pane: opened in a new pane beside.
  await dropFiles(page.locator('.pane-body').first(), [{ name: 'Logo.svg', type: 'image/svg+xml', text: SVG }], { x: 790, y: 200 });
  await expect(page.locator('.pane-group')).toHaveCount(2);
  await expect(page.locator('.pane-group').nth(1).getByRole('region', { name: 'File' }).locator('img')).toBeVisible();
  // Dropped on a pane's tabs: a new tab there.
  await dropFiles(page.locator('.pane-group').nth(0).locator('.pane-tabs'), [{ name: 'Notes.md', type: 'text/markdown', text: 'Hello' }]);
  await expect(page.locator('.pane-group').nth(0).getByRole('tab')).toHaveCount(2);
  await expect(page.locator('.pane-group').nth(0).getByRole('tab', { selected: true })).toContainText('Notes');
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
  // Resolve: kept, greyed out (and saved with a tick), until it's reopened.
  await body.locator('mark.cmt').click();
  await page.getByRole('dialog', { name: 'Comment' }).getByRole('button', { name: 'Resolve' }).click();
  await expect(body.locator('mark.cmt')).toHaveAttribute('data-resolved', '');
  await expect(listed).toContainText('resolved');
  await expect.poll(md).toMatch(/The one by the river\.<<\}\{>>✓<<\}\.\n$/);
  await body.locator('mark.cmt').click();
  await expect(page.getByRole('dialog', { name: 'Comment' })).toContainText('Resolved');
  await page.getByRole('dialog', { name: 'Comment' }).getByRole('button', { name: 'Reopen' }).click();
  await expect(body.locator('mark.cmt')).not.toHaveAttribute('data-resolved', '');
  // Delete takes it away.
  await page.getByRole('dialog', { name: 'Comment' }).getByRole('button', { name: 'Delete' }).click();
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
  // A pretend article somewhere else on the web: long, and on a site that cuts the link between windows
  // (Cross-Origin-Opener-Policy, as GitHub and many big sites do), so it has to travel in the address.
  const filler = Array.from({ length: 400 }, (_, i) => `<p class="para" data-id="p${i}">Paragraph ${i + 1} about the lighthouse keeper's day.</p>`).join('');
  await context.route('https://news.example/story', (route) =>
    route.fulfill({ contentType: 'text/html', headers: { 'Cross-Origin-Opener-Policy': 'same-origin' }, body: `<html><head><title>The last lighthouse</title></head><body><nav>Home · News</nav><article><h1>The last lighthouse</h1><p>It stands <b>alone</b> on the rock. <a href="/more">More</a></p><img src="/lamp.png" alt="The lamp">${filler}</article><footer>© News</footer></body></html>` }),
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
  await expect(body).toContainText('Paragraph 400');
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
  await sideMore(page);
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
  // Crumpet's print window first: a preview of each page, then Print.
  const printDialog = page.getByRole('dialog', { name: 'Print' });
  await expect.poll(() => printDialog.locator('.print-thumb').count()).toBeGreaterThan(1);
  const previewed = await printDialog.locator('.print-thumb').count();
  await printDialog.getByRole('button', { name: /^Print \d+ pages$/ }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  const sheets = await page.locator('.print-root .print-page').count();
  expect(sheets).toBe(previewed);
  expect(sheets).toBeGreaterThan(1);
  await expect(page.locator('.print-root .page-notes-zone').first()).toContainText('A note at the foot.');
  const pdf = await page.pdf({ preferCSSPageSize: true });
  const pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pdfPages).toBe(sheets);
  // Closing the print window tidies up.
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('.print-root')).toHaveCount(0);
  // Just page 2, twice.
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Print or save as PDF' }).click();
  await expect.poll(() => printDialog.locator('.print-thumb').count()).toBeGreaterThan(1);
  await printDialog.getByLabel('Pages to print').fill('2');
  await printDialog.getByLabel('Copies').fill('2');
  await expect(printDialog.locator('.print-thumb.left-out')).toHaveCount(previewed - 1);
  await printDialog.getByRole('button', { name: 'Print 2 pages' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(2);
  await expect(page.locator('.print-root .print-pages > .print-page')).toHaveCount(2);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('.print-root')).toHaveCount(0);
  // E-book.
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download as e-book (ePub)' }).click()]);
  expect(download.suggestedFilename()).toBe('Long essay.epub');
  // Other formats: OpenDocument, Rich Text, a web page and plain text.
  for (const [name, ext, has] of [['OpenDocument (LibreOffice)', 'odt', 'mimetypeapplication/vnd.oasis.opendocument.text'], ['Rich Text', 'rtf', '{\\rtf1'], ['Web page', 'html', '<p>Line 1 of the essay'], ['Plain text', 'txt', 'Line 50 of the essay']] as const) {
    await page.getByRole('button', { name: 'More', exact: true }).click();
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: `Download as ${name}` }).click()]);
    expect(file.suggestedFilename()).toBe(`Long essay.${ext}`);
    const body = await new Promise<string>((done) => {
      void file.createReadStream().then((st) => {
        let out = '';
        st.on('data', (c: { toString(enc: string): string }) => (out += c.toString('latin1')));
        st.on('end', () => done(out));
      });
    });
    expect(body).toContain(has);
  }
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

test('multilevel lists from the gallery and of your own, border line styles and colours, and widow control', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Outline', '1. Setting');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Town');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Sea');
  const blks = page.locator('.note-editor .blk');
  await (await toolButton(page, 'Multilevel list')).click();
  await page.getByRole('button', { name: 'Chapter 1, 1.1' }).click();
  await expect(blks.nth(0)).toHaveAttribute('data-label', 'Chapter 1');
  await expect(blks.nth(1)).toHaveAttribute('data-label', '1.1');
  await expect(blks.nth(2)).toHaveAttribute('data-label', '1.2');
  // A list of its own: "Part I", then "I-a".
  await (await toolButton(page, 'Multilevel list')).click();
  await page.getByRole('button', { name: 'Define new multilevel list…' }).click();
  const define = page.getByRole('dialog', { name: 'Define new multilevel list' });
  await define.getByLabel('Level 1 number style').selectOption('upper-roman');
  await define.getByLabel('Level 1 number shown as').fill('Part %1');
  await define.getByLabel('Level 2 number shown as').fill('%1-%2');
  await define.getByRole('button', { name: 'OK' }).click();
  await expect(blks.nth(0)).toHaveAttribute('data-label', 'Part I');
  await expect(blks.nth(2)).toHaveAttribute('data-label', 'I-b');
  // A double blue box round a plain paragraph, which may be left alone at a page's foot.
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Boxed');
  const boxed = blks.nth(3);
  await expect(boxed).not.toHaveClass(/blk-list/);
  await (await toolButton(page, 'Borders')).click();
  await page.getByRole('button', { name: 'Double line' }).click();
  await page.getByRole('button', { name: 'Blue border' }).click();
  await page.keyboard.press('Escape');
  await expect(boxed).toHaveCSS('border-top-style', 'double');
  await (await toolButton(page, /Paragraph settings/)).click();
  const dialog = page.getByRole('dialog', { name: 'Paragraph' });
  await dialog.getByLabel(/Widow\/orphan control/).uncheck();
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(boxed).toHaveAttribute('data-nowidow', '');
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  await expect.poll(md).toContain('numtext="Part %1"');
  await expect.poll(md).toMatch(/Boxed \{[^}]*\.nowidow[^}]*bstyle=double[^}]*\}|Boxed \{[^}]*bstyle=double[^}]*\.nowidow[^}]*\}/);
});

test('tables: sort, a formula, lines in a cell, cell settings, style options, quick and drawn tables, converting to and from text, and the heading row on each page', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Ages', 'People:');
  await page.keyboard.press('Enter');
  // A 2 × 4 table from the grid (the heading row and three more).
  await (await toolButton(page, 'Table')).click();
  await page.getByRole('gridcell', { name: '2 by 4' }).click();
  const table = page.locator('.note-editor .blk-table table').first();
  await expect(table.locator('tr')).toHaveCount(4);
  for (const text of ['Name', 'Age', 'Tom', '9', 'Ann', '31']) {
    await page.keyboard.type(text);
    await page.keyboard.press('Tab');
  }
  const menu = async (name: string) => {
    await page.getByRole('button', { name: 'Table ▾' }).first().click();
    await page.locator('.table-menu button', { hasText: new RegExp(`^${name.replace(/[()*]/g, '\\$&')}$`) }).first().click();
  };
  // The last row: a total, worked out.
  await page.keyboard.type('Total');
  await page.keyboard.press('Tab');
  await menu('=SUM(ABOVE)');
  await expect(table.locator('td').last()).toHaveAttribute('data-value', '40');
  // Sort by age, largest first (the total row stays at the foot once it's marked as one).
  await menu('Total row');
  await expect(table).toHaveClass(/total-row/);
  await table.locator('.cell[data-r="1"][data-c="1"]').click();
  await menu('Sort Z→A');
  await expect(table.locator('tr').nth(1)).toContainText('Ann');
  await expect(table.locator('tr').nth(3)).toContainText('Total');
  // Two lines in a cell, a bullet, and the cell's own settings.
  await table.locator('.cell[data-r="1"][data-c="0"]').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('- teacher');
  await menu('In middle');
  await expect(table.locator('td').filter({ hasText: 'Ann' })).toHaveCSS('vertical-align', 'middle');
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  await expect.poll(md).toContain('| Ann&#10;• teacher | 31 |');
  await expect.poll(md).toContain('cell=1-0:v=middle');
  await expect.poll(md).toContain('=SUM(ABOVE)');
  // Back to plain lines, parted by tabs.
  await menu('Convert to text');
  await expect(page.locator('.note-editor .blk-table')).toHaveCount(0);
  await expect(page.locator('.note-editor .blk').nth(1)).toHaveText('Name\tAge');
  // …and back into a table: select the lines, then Convert text to table.
  await page.locator('.note-editor .blk').nth(1).click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+End');
  await (await toolButton(page, 'Table')).click();
  await page.getByRole('button', { name: 'Convert text to table…' }).click();
  await page.getByRole('dialog', { name: 'Convert text to table' }).getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('.note-editor .blk-table tr')).toHaveCount(3);
  // A quick table, and a drawn one.
  await page.keyboard.press('ControlOrMeta+End');
  await (await toolButton(page, 'Table')).click();
  await page.getByRole('button', { name: 'Matrix' }).click();
  await expect(page.locator('.note-editor .blk-table table.first-col')).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+End');
  await page.locator('.note-editor .blk').last().click();
  await (await toolButton(page, 'Table')).click();
  await page.getByRole('button', { name: 'Draw table…' }).click();
  const draw = page.getByRole('dialog', { name: 'Draw table' });
  const box = (await draw.locator('.draw-box').boundingBox())!;
  // A third line down the box: four columns.
  await page.mouse.move(box.x + box.width * 0.85, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height - 10, { steps: 5 });
  await page.mouse.up();
  await expect(draw).toContainText('3 rows × 4 columns');
  await draw.getByRole('button', { name: 'Insert table' }).click();
  const drawn = page.locator('.note-editor .blk-table table').last();
  await expect(drawn.locator('tr').first().locator('th')).toHaveCount(4);
  await expect(drawn.locator('col')).toHaveCount(4);
  // A long table in page view: its heading row again at the top of the next page.
  await page.evaluate(() => {
    const w = window as unknown as { crumpet: { getState(): { selectedId: string }; setDoc(id: string, doc: unknown): void; updateSettings(p: object): void } };
    const rows = [['Day', 'Note'], ...Array.from({ length: 60 }, (_, i) => [`${i + 1}`, 'Calm sea'])];
    w.crumpet.setDoc(w.crumpet.getState().selectedId, { blocks: [{ id: 'long1', type: 'table', runs: [], rows }, { id: 'after1', type: 'paragraph', runs: [] }] });
    w.crumpet.updateSettings({ pageView: { notes: true } });
  });
  await expect.poll(() => page.locator('.note-editor .pg').count(), { timeout: 10000 }).toBeGreaterThan(1);
  const pages = await page.locator('.note-editor .pg').count();
  await expect(page.locator('.note-editor .blk-table[data-cont] tr.repeat-head')).toHaveCount(pages - 1);
  await expect(page.locator('.note-editor .blk-table[data-cont] tr.repeat-head').first()).toContainText('Day');
  // Typing in a row on a later page is kept.
  const later = page.locator('.note-editor .blk-table[data-cont] .cell[data-c="1"]').last();
  await later.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' and bright');
  await page.keyboard.press('Tab');
  await expect.poll(md).toContain('| 60 | Calm sea and bright |');
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

test('table styles: pick one from the gallery, and take it off again', async ({ page }) => {
  await open(page);
  await newNote(page, 'Cast', 'Who is who:');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/table');
  await page.keyboard.press('Enter');
  for (const text of ['Name', 'Role', 'Age', 'Mara', 'Daughter', '32']) {
    await page.keyboard.type(text);
    await page.keyboard.press('Tab');
  }
  const table = page.locator('.note-editor .blk-table table');
  await page.getByRole('button', { name: 'Table ▾' }).click();
  await page.getByRole('button', { name: 'Table style: Blue' }).click();
  await expect(table).toHaveAttribute('data-style', 'blue');
  await expect(table).toHaveClass(/banded/);
  await expect(table.locator('th').first()).toHaveCSS('background-color', 'rgb(68, 114, 196)');
  await expect(table.locator('th').first()).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Table ▾' }).click();
  await expect(page.getByRole('button', { name: 'Table style: Blue' })).toHaveClass(/on/);
  await page.getByRole('button', { name: 'Table style: none' }).click();
  await expect(table).not.toHaveAttribute('data-style', /.+/);
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
  // In a book, the contents list the chapters, then the headings in them.
  const toc = page.locator('.note-editor .blk-toc');
  await expect(toc.locator('.toc-entry')).toHaveText([/Chapter 1\s*1/]);
  await page.keyboard.type('Arrival');
  await page.keyboard.press('Control+Alt+1');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+Enter');
  await page.keyboard.type('Departure');
  await page.keyboard.press('Control+Alt+2');
  const lines = toc.locator('.toc-entry');
  await expect(lines).toHaveCount(3);
  await expect(lines.nth(1)).toHaveClass(/toc-2/);
  await expect(lines.nth(2)).toHaveClass(/toc-3/);
  await expect(lines.nth(1).locator('.toc-page')).toHaveText('1');
  await expect(lines.nth(2).locator('.toc-page')).toHaveText('2');
  // Clicking a line puts the caret at its heading.
  await page.keyboard.press('Control+Home');
  await toc.locator('.toc-entry', { hasText: 'Departure' }).click();
  await page.keyboard.type('The ');
  await expect(lines.nth(2)).toContainText('The Departure');
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
  // Then the rest of the columns, balanced above the one-column section on the same page.
  const one = page.locator('.note-editor .pg-band', { hasText: 'One column again.' });
  await expect(one.locator('.pg-col')).toHaveCount(1);
  const balanced = one.locator('xpath=preceding-sibling::div[contains(@class, "pg-band")][1]');
  await expect(balanced.locator('.pg-col')).toHaveCount(2);
  // (Measured once the layout has settled: fonts arriving can lay the pages out again.)
  await expect.poll(async () => {
    const heights = await balanced.locator('.pg-col').evaluateAll((cols) => cols.map((c) => c.getBoundingClientRect().height));
    return Math.abs(heights[0] - heights[1]);
  }).toBeLessThan(60);
  // Page 3 is on its side.
  await expect.poll(() => pages.nth(2).evaluate((el) => (el as HTMLElement).offsetWidth > (el as HTMLElement).offsetHeight)).toBe(true);
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

test('layout: columns, a continuous section break, a column break and a landscape section from the bar', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1700, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await expect(page.locator('.page-view')).toBeVisible();
  await page.locator('.note-editor .blk').first().click();
  await page.keyboard.type('Title across the page');
  await page.keyboard.press('Enter');
  // A continuous section break, then two columns for the new section.
  await (await toolButton(page, 'Breaks')).click();
  await page.getByRole('button', { name: 'Continuous' }).click();
  await page.keyboard.type('Left column text.');
  await (await toolButton(page, 'Columns')).click();
  await page.getByRole('menuitemradio', { name: 'Two' }).click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+Shift+Enter');
  await page.keyboard.type('Right column text.');
  const first = page.locator('.note-editor .pg').first();
  await expect(first.locator('.pg-band')).toHaveCount(2);
  await expect(first.locator('.pg-band').nth(1).locator('.pg-col')).toHaveCount(2);
  await expect(first.locator('.pg-band').nth(1).locator('.pg-col').nth(1)).toContainText('Right column text.');
  // A new page, on its side.
  await page.keyboard.press('Enter');
  await (await toolButton(page, 'Breaks')).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.keyboard.type('A wide page.');
  await (await toolButton(page, 'Orientation')).click();
  await page.getByRole('menuitemradio', { name: 'Landscape' }).click();
  const pages = page.locator('.note-editor .pg');
  await expect(pages).toHaveCount(2);
  const size = await pages.nth(1).evaluate((el) => [(el as HTMLElement).offsetWidth, (el as HTMLElement).offsetHeight]);
  expect(size[0]).toBeGreaterThan(size[1]);
  // Saved in the chapter's file.
  const md = await page.evaluate(async () => {
    const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { getState(): { chapters: { doc: unknown }[] } } }).crumpet.getState();
    return toMarkdown(s.chapters[0].doc);
  });
  expect(md).toContain('Left column text. {sect=cont cols=2}');
  expect(md).toContain('Right column text. {.colbreak}');
  expect(md).toContain('A wide page. {sect=page orient=landscape}');
});

test('page setup: margins for one section from the caret on, and for the whole document', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1700, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await page.locator('.note-editor .blk').first().click();
  await page.keyboard.type('First page.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('From here on, wide margins.');
  // This point forward: a new section with its own margins, on its side.
  await (await toolButton(page, 'Page setup')).click();
  const dialog = page.getByRole('dialog', { name: 'Page setup' });
  await dialog.getByLabel('Left margin').fill('2');
  await dialog.getByRole('button', { name: 'Landscape' }).click();
  await dialog.getByLabel('Apply to').selectOption('forward');
  await dialog.getByRole('button', { name: 'OK' }).click();
  const pages = page.locator('.note-editor .pg');
  await expect(pages).toHaveCount(2);
  const pad = (i: number) => pages.nth(i).evaluate((el) => [(el as HTMLElement).style.paddingLeft, (el as HTMLElement).offsetWidth > (el as HTMLElement).offsetHeight]);
  expect(await pad(0)).toEqual(['96px', false]);
  const second = await pad(1);
  expect(Math.abs(parseFloat(second[0] as string) - (/^en-(US|CA)/.test(await page.evaluate(() => navigator.language)) ? 192 : 75.6))).toBeLessThan(1);
  expect(second[1]).toBe(true);
  // Whole document: every page takes the same margins again.
  await (await toolButton(page, 'Page setup')).click();
  await dialog.getByLabel('Apply to').selectOption('all');
  await dialog.getByRole('button', { name: 'Portrait' }).click();
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect.poll(async () => (await pad(1))[1]).toBe(false);
  expect((await pad(0))[0]).toBe((await pad(1))[0]);
});

test('styles pane: apply a style, count its uses, update a style to match the selection, and find the next paragraph in it', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1700, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Styled', 'First paragraph.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('A heading');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second paragraph.');
  await (await toolButton(page, 'Styles pane')).click();
  const pane = page.getByRole('complementary', { name: 'Styles' });
  await expect(pane).toBeVisible();
  const row = (name: string) => pane.getByRole('listitem').filter({ has: page.getByTitle(`Apply ${name}`, { exact: true }) });
  await expect(row('Normal').locator('.styles-pane-count')).toHaveText('3');
  // Apply Heading 2 to the middle line.
  await page.locator('.note-editor .blk').nth(1).click();
  await pane.getByTitle('Apply Heading 2').click();
  await expect(page.locator('.note-editor h2')).toHaveText('A heading');
  await expect(row('Normal').locator('.styles-pane-count')).toHaveText('2');
  // Double line spacing on the last paragraph, then make Normal match it.
  await page.locator('.note-editor .blk').nth(2).click();
  await page.keyboard.press('Control+2');
  await pane.getByRole('button', { name: 'Normal options' }).click();
  await page.getByRole('button', { name: 'Update Normal to match selection' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { crumpet: { getState(): { settings: { noteStyles?: { styles: { normal: { lineSpacing: number } } } } } } }).crumpet.getState().settings.noteStyles?.styles.normal.lineSpacing)).toBe(2.3);
  await expect(page.locator('.note-editor .blk').nth(2)).not.toHaveAttribute('style', /line-height/);
  // Find next: from the last paragraph back round to the first.
  await pane.getByRole('button', { name: 'Normal options' }).click();
  await page.getByRole('button', { name: 'Find next (2)' }).click();
  await page.keyboard.type('X');
  await expect(page.locator('.note-editor .blk').first()).toHaveText('XFirst paragraph.');
});

test('styles of your own: a new style from the text, renamed and changed, hidden styles, and Reveal formatting', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Letters', 'Dear Mara,');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The lamp is lit.');
  await page.locator('.note-editor .blk').first().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await page.keyboard.press('Control+i');
  await (await toolButton(page, 'Styles pane')).click();
  const pane = page.getByRole('complementary', { name: 'Styles' });
  await pane.getByRole('button', { name: 'New style…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Styles for notes' });
  await expect(dialog.getByLabel('Style name')).toHaveValue('My style 1');
  await dialog.getByLabel('Style name').fill('Letter');
  await dialog.getByRole('button', { name: 'CAPS' }).click();
  // Epigraph left out of the style menu.
  await dialog.getByRole('listbox', { name: 'Styles' }).getByRole('option', { name: 'Epigraph' }).click();
  await dialog.getByLabel('Show in the style menu').uncheck();
  await dialog.getByRole('button', { name: 'Close styles' }).click();
  const first = page.locator('.note-editor .blk').first();
  await expect(first).toHaveAttribute('data-style', 'c-my-style-1');
  await expect(first).toHaveCSS('text-transform', 'uppercase');
  await expect(pane.getByTitle('Apply Letter')).toBeVisible();
  // The second line takes the style from the menu, which no longer lists Epigraph.
  await page.locator('.note-editor .blk').nth(1).click();
  await page.getByRole('button', { name: 'Style', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitemradio', { name: 'Epigraph' })).toHaveCount(0);
  await menu.getByRole('menuitemradio', { name: 'Letter' }).click();
  await expect(page.locator('.note-editor .blk').nth(1)).toHaveAttribute('data-style', 'c-my-style-1');
  // Reveal formatting: the style, and what's set by hand.
  await pane.getByLabel('Reveal formatting').check();
  const reveal = pane.getByRole('region', { name: 'Reveal formatting' });
  await expect(reveal).toContainText('Letter');
  await page.locator('.note-editor .blk').first().click({ position: { x: 30, y: 8 } });
  await expect(reveal.locator('.own', { hasText: 'Emphasis' })).toContainText('italic');
});

test('advanced find (wildcards, formatting, results), text with similar formatting, and the Selection pane', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Cats', 'The cat sat on a mat with a hat.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Two ');
  await page.keyboard.press('Control+b');
  await page.keyboard.type('bold');
  await page.keyboard.press('Control+b');
  await page.keyboard.type(' and ');
  await page.keyboard.press('Control+b');
  await page.keyboard.type('more');
  await page.keyboard.press('Control+b');
  await page.keyboard.press('Control+f');
  const bar = page.getByRole('search', { name: 'Find and replace' });
  await bar.getByRole('button', { name: 'More options' }).click();
  await bar.getByLabel('Use wildcards').check();
  await bar.getByRole('searchbox', { name: 'Find' }).fill('<?at>');
  await expect(bar.locator('.find-count')).toHaveText('1 of 4');
  await bar.getByLabel('List results').check();
  const results = bar.getByRole('list', { name: 'Results' });
  await expect(results.locator('mark')).toHaveText(['cat', 'sat', 'mat', 'hat']);
  await results.getByRole('button').nth(2).click();
  await expect(bar.locator('.find-count')).toHaveText('3 of 4');
  // Formatting alone: the bold words.
  await bar.getByLabel('Use wildcards').uncheck();
  await bar.getByRole('searchbox', { name: 'Find' }).fill('');
  await bar.getByRole('button', { name: 'Format ▾' }).click();
  await page.getByRole('group', { name: 'Find formatting' }).getByLabel('Bold').check();
  await bar.getByRole('button', { name: 'Format ▾' }).click();
  await expect(results.locator('mark')).toHaveText(['bold', 'more']);
  await bar.getByRole('button', { name: 'Close find' }).click();
  // Select the text formatted like "bold", and make it all italic too.
  await page.locator('.note-editor .blk').nth(1).locator('strong').first().click();
  await (await toolButton(page, 'Select text with similar formatting')).click();
  const similar = page.getByRole('toolbar', { name: 'Selected places' });
  await expect(similar).toContainText('2 places selected');
  await similar.getByRole('button', { name: 'Italic them all' }).click();
  await expect(page.locator('.note-editor .blk').nth(1).locator('em')).toHaveText(['bold', 'more']);
  await similar.getByRole('button', { name: 'Done' }).click();
  await expect(similar).toHaveCount(0);
  // A text box, listed in the Selection pane, hidden and shown.
  await page.locator('.note-editor .blk').nth(1).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/textbox');
  await page.keyboard.press('Enter');
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ right: true, rightTab: 'objects' }));
  const pane = page.getByRole('tabpanel', { name: 'Selection' });
  await expect(pane.getByRole('list', { name: 'Objects' }).locator('li')).toHaveCount(1);
  await expect(pane).toContainText('Text box');
  await pane.getByRole('button', { name: /^Hide text box/ }).click();
  await expect(page.locator('.note-editor .blk-shape')).toBeHidden();
  await pane.getByRole('button', { name: 'Show all' }).click();
  await expect(page.locator('.note-editor .blk-shape')).toBeVisible();
});

test('references: numbered captions, cross-references, bookmarks, a table of figures, an index, fields, and contents options', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Lights', 'The lighthouse stands alone.');
  const refs = async (item: string) => {
    await (await toolButton(page, 'References')).click();
    await page.getByRole('button', { name: item, exact: true }).click();
  };
  // Two captions, numbered by themselves.
  await refs('Insert caption…');
  let dialog = page.getByRole('dialog', { name: 'Insert caption' });
  await dialog.getByLabel('Caption text').fill('The lamp');
  await expect(dialog.getByLabel('Preview')).toHaveText('Figure 1: The lamp');
  await dialog.getByRole('button', { name: 'OK' }).click();
  const blks = page.locator('.note-editor .blk');
  await expect(blks.nth(1)).toHaveAttribute('data-style', 'caption');
  await expect(blks.nth(1).locator('span.fld')).toHaveAttribute('data-v', '1');
  await refs('Insert caption…');
  dialog = page.getByRole('dialog', { name: 'Insert caption' });
  await dialog.getByLabel('Caption text').fill('The stairs');
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(blks.nth(2).locator('span.fld')).toHaveAttribute('data-v', '2');
  // A cross-reference to the second, which renumbers when a figure goes before it.
  await page.keyboard.press('Enter');
  await page.keyboard.type('See ');
  await refs('Cross-reference…');
  dialog = page.getByRole('dialog', { name: 'Cross-reference' });
  await dialog.getByRole('option', { name: 'Figure 2: The stairs' }).click();
  await dialog.getByRole('button', { name: 'Insert' }).click();
  const ref = page.locator('.note-editor span.fld[data-target]');
  await expect(ref).toHaveAttribute('data-v', 'Figure 2');
  // A bookmark, and a field counting the words.
  await page.keyboard.type('. ');
  await refs('Bookmark…');
  dialog = page.getByRole('dialog', { name: 'Bookmark' });
  await dialog.getByLabel('Bookmark name').fill('here');
  await dialog.getByRole('button', { name: 'Add' }).click();
  await refs('Field…');
  dialog = page.getByRole('dialog', { name: 'Field' });
  await dialog.getByRole('option', { name: 'Number of words' }).click();
  await dialog.getByRole('button', { name: 'Insert' }).click();
  await expect(blks.nth(3).locator('span.fld[data-field="words"]')).toHaveAttribute('data-v', /^\d+$/);
  // Index entries and the index; a table of figures.
  await blks.first().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('ControlOrMeta+ArrowRight');
  await page.keyboard.press('ControlOrMeta+Shift+ArrowRight');
  await refs('Mark index entry…');
  dialog = page.getByRole('dialog', { name: 'Mark index entry' });
  await expect(dialog.getByLabel('Main entry')).toHaveValue('lighthouse');
  await dialog.getByRole('button', { name: 'Mark', exact: true }).click();
  await page.locator('.note-editor .blk').last().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await refs('Table of figures');
  const figures = page.locator('.note-editor .blk-toc').first();
  await expect(figures.locator('.toc-entry .toc-text')).toHaveText(['Figure 1: The lamp', 'Figure 2: The stairs']);
  await refs('Insert index');
  const index = page.locator('.note-editor .blk-toc').last();
  await expect(index.locator('.toc-title')).toContainText('Index');
  await expect(index.locator('.toc-entry .toc-text')).toHaveText(['lighthouse']);
  // The figures list's options: no page numbers, a title of its own.
  await figures.hover();
  await figures.getByRole('button', { name: 'Table of figures options' }).click();
  dialog = page.getByRole('dialog', { name: 'Table of figures' });
  await dialog.getByLabel('Title').fill('Pictures');
  await dialog.getByLabel(/Show page numbers/).uncheck();
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(figures.locator('.toc-title')).toContainText('Pictures');
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  await expect.poll(md).toContain('[TOC figures="Figure" .nopages title="Pictures"]');
  await expect.poll(md).toContain('{{xe:lighthouse}}');
  await expect.poll(md).toMatch(/See \{\{ref:_Ref\d+\}\}\. \{\{bm:here\}\}\{\{words\}\}/);
  // A new figure at the top: the cross-reference now says Figure 3.
  await blks.first().click();
  await page.keyboard.press('End');
  await refs('Insert caption…');
  dialog = page.getByRole('dialog', { name: 'Insert caption' });
  await dialog.getByLabel('Caption text').fill('The cliff');
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(ref).toHaveAttribute('data-v', 'Figure 3');
});

test('endnotes, citations and a bibliography, snippets with F3, text from a file, and searching Wikipedia', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Sources', 'The lamp was lit');
  const refs = async (item: string) => {
    await (await toolButton(page, 'References')).click();
    await page.getByRole('button', { name: item, exact: true }).click();
  };
  // An endnote: numbered i, listed at the end.
  await refs('Insert endnote');
  const card = page.getByRole('dialog', { name: 'Endnote i' });
  await card.getByRole('textbox').fill('In 1902.');
  await card.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.note-editor sup.fn.en')).toHaveAttribute('data-n', 'i');
  await expect(page.getByRole('region', { name: 'Endnotes' })).toContainText('In 1902.');
  // A citation of a new source, in APA, then MLA; a bibliography of it.
  await page.keyboard.press('End');
  await page.keyboard.type(' ');
  await refs('Insert citation…');
  let dialog = page.getByRole('dialog', { name: 'Insert citation' });
  await dialog.getByLabel('Authors').fill('Quinn, Mara');
  await dialog.getByLabel('Title', { exact: true }).fill('The Lighthouse Keepers');
  await dialog.getByLabel('Year').fill('2021');
  await dialog.getByLabel('Publisher').fill('Harbour Press');
  await dialog.getByRole('button', { name: 'Add and cite' }).click();
  const cite = page.locator('.note-editor span.fld[data-field="cite:Quinn2021"]');
  await expect(cite).toHaveAttribute('data-v', '(Quinn, 2021)');
  await page.keyboard.press('Enter');
  await refs('Bibliography');
  const bib = page.locator('.note-editor .blk-toc');
  await expect(bib.locator('.toc-entry')).toHaveText(['Quinn, M. (2021). The Lighthouse Keepers. Harbour Press.']);
  await refs('Manage sources…');
  dialog = page.getByRole('dialog', { name: 'Sources' });
  await dialog.getByLabel('Citation style').selectOption('mla');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(cite).toHaveAttribute('data-v', '(Quinn)');
  await expect(bib.locator('.toc-entry')).toHaveText(['Quinn, Mara. The Lighthouse Keepers. Harbour Press, 2021.']);
  // A snippet saved from the text, put back by typing its name and F3.
  await page.locator('.note-editor .blk').first().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await (await toolButton(page, 'Snippets')).click();
  await page.getByRole('button', { name: 'Save selection as a snippet…' }).click();
  await page.getByLabel('Snippet name').fill('lamp');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.locator('.note-editor .blk').last().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('lamp');
  await page.keyboard.press('F3');
  await expect(page.locator('.note-editor .blk').last()).toContainText('The lamp was lit');
  // Text from a Markdown file, poured in at the caret.
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await (await toolButton(page, 'Snippets')).click();
  const Bytes = (globalThis as unknown as { Buffer: { from(s: string, encoding?: string): never } }).Buffer;
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Text from file…' }).click();
  await (await chooser).setFiles({ name: 'more.md', mimeType: 'text/markdown', buffer: Bytes.from('## From the file\n\nA **bold** line.\n') });
  await expect(page.locator('.note-editor h2')).toHaveText('From the file');
  // Searching Wikipedia (answered here), then saving a result as a note and citing it.
  await page.route('https://en.wikipedia.org/w/api.php**', (route) => route.fulfill({ json: { query: { search: [{ title: 'Eddystone Lighthouse', snippet: 'A <span class="searchmatch">lighthouse</span> on the Eddystone Rocks' }] } } }));
  await page.route('https://en.wikipedia.org/api/rest_v1/page/summary/**', (route) => route.fulfill({ json: { extract: 'The Eddystone Lighthouse is on the Eddystone Rocks.' } }));
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ right: true, rightTab: 'search' }));
  const tab = page.getByRole('tabpanel', { name: 'Search' });
  await tab.getByLabel('Search Wikipedia').fill('lighthouse');
  await tab.getByRole('button', { name: 'Search' }).click();
  const hit = tab.getByRole('list', { name: 'Results' }).locator('li');
  await expect(hit).toContainText('Eddystone Lighthouse');
  await expect(hit).toContainText('A lighthouse on the Eddystone Rocks');
  await hit.getByRole('button', { name: 'Save to research' }).click();
  await expect(hit).toContainText('Saved as a note');
  await expect.poll(() => page.evaluate(() => (window as unknown as { crumpet: { getState(): { notes: { title: string }[] } } }).crumpet.getState().notes.some((n) => n.title === 'Eddystone Lighthouse'))).toBe(true);
  // Saving it didn't take you away from what you're writing.
  await expect(page.getByLabel('Title')).toHaveValue('Sources');
});

test('page layout: an odd page section break, paper of your own for a section, line numbers, hyphenation and the text wrapping break', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always', pageView: { notes: true } }));
  await newNote(page, 'Layout', 'The first page.');
  await expect(page.locator('.note-editor .pg')).toHaveCount(1);
  // A section starting on the next odd page: page 2 is left blank, the text goes on page 3.
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Chapter two.');
  await page.keyboard.press('Home');
  await (await toolButton(page, 'Breaks')).click();
  await page.getByRole('button', { name: 'Odd page', exact: true }).click();
  await expect(page.locator('.note-editor .pg')).toHaveCount(3);
  await expect(page.locator('.note-editor .pg').nth(1).locator('[data-block]')).toHaveCount(0);
  await expect(page.locator('.note-editor .pg').nth(2)).toContainText('Chapter two.');
  // That section on paper of its own: 5 × 8 inches.
  await (await toolButton(page, 'Page setup')).click();
  const dialog = page.getByRole('dialog', { name: 'Page setup' });
  await dialog.getByRole('tab', { name: 'Paper' }).click();
  await dialog.getByLabel('Paper size').selectOption('custom');
  await dialog.getByLabel('Paper width').fill(await page.evaluate(() => (/^en-(US|CA)/.test(navigator.language) ? '5' : '12.7')));
  await dialog.getByLabel('Paper height').fill(await page.evaluate(() => (/^en-(US|CA)/.test(navigator.language) ? '8' : '20.32')));
  await dialog.getByLabel('Apply to').selectOption('section');
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('.note-editor .pg').nth(2)).toHaveCSS('width', '480px');
  await expect(page.locator('.note-editor .pg').first()).not.toHaveCSS('width', '480px');
  // Line numbers in the margin, starting again each page.
  await (await toolButton(page, 'Line numbers')).click();
  await page.getByRole('menuitemradio', { name: 'Restart each page' }).click();
  await expect(page.locator('.note-editor .pg').first().locator('.ln')).toHaveText(['1']);
  await expect(page.locator('.note-editor .pg').nth(2).locator('.ln').first()).toHaveText('1');
  // Hyphenation, for the whole document.
  await (await toolButton(page, 'Hyphenation')).click();
  await page.getByRole('menuitemradio', { name: 'Automatic', exact: true }).click();
  await expect(page.locator('.note-editor')).toHaveClass(/hyphenate/);
  await expect(page.locator('.note-editor .blk').first()).toHaveCSS('hyphens', 'auto');
  // A text wrapping break.
  await page.keyboard.press('End');
  await (await toolButton(page, 'Breaks')).click();
  await page.getByRole('button', { name: 'Text wrapping', exact: true }).click();
  await expect(page.locator('.note-editor span.fld[data-field="wrapbreak"]')).toHaveCount(1);
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  await expect.poll(md).toContain('{.hyphenate lnum=1}');
  await expect.poll(md).toMatch(/\{sect=odd [^}]*pw=5 ph=8\}/);
  await expect.poll(md).toContain('{{wrapbreak}}');
});

test('page design: a watermark, page border and colour, a cover page, and a section with a header of its own', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always', pageView: { notes: true } }));
  await newNote(page, 'Design', 'Chapter one begins here.');
  await expect(page.locator('.note-editor .pg')).toHaveCount(1);
  // A watermark, a double border and a page colour, on every page.
  await (await toolButton(page, 'Watermark')).click();
  await page.getByRole('menuitemradio', { name: 'DRAFT' }).click();
  await expect(page.locator('.sheet .watermark').first()).toHaveText('DRAFT');
  await (await toolButton(page, 'Page borders')).click();
  await page.getByRole('menuitemradio', { name: 'Double line' }).click();
  await expect(page.locator('.sheet .page-border.b-double')).toHaveCount(1);
  await (await toolButton(page, 'Page colour')).click();
  await page.getByRole('button', { name: 'Butter pages' }).click();
  await expect(page.locator('.sheet').first()).toHaveCSS('background-color', 'rgb(255, 242, 204)');
  // A cover page: a page of its own in front, with no page number on it.
  await (await toolButton(page, 'Cover page')).click();
  await page.getByRole('radio', { name: 'Banner' }).click();
  await page.getByLabel('Cover title').fill('The Lighthouse');
  await page.getByRole('button', { name: 'Add cover page' }).click();
  await expect(page.locator('.note-editor .pg')).toHaveCount(2);
  await expect(page.locator('.note-editor .pg').first()).toContainText('The Lighthouse');
  await expect(page.locator('.note-editor .pg').nth(1)).toContainText('Chapter one begins here.');
  await expect(page.locator('.sheet .watermark')).toHaveCount(2);
  await expect(page.locator('.hf-page[data-sheet="0"] .hf-zone.footer')).not.toContainText('1');
  await expect(page.locator('.hf-page[data-sheet="1"] .hf-zone.footer')).toContainText('2');
  // The text after the cover: a header of its own, and page numbers starting again at 1.
  await page.locator('.hf-page[data-sheet="1"] .hf-zone.header').dblclick({ position: { x: 20, y: 40 } });
  await page.getByRole('button', { name: 'Section 2 ▾' }).click();
  await page.getByRole('checkbox', { name: 'Header: link to previous' }).uncheck();
  await page.getByRole('checkbox', { name: 'Start page numbers again here' }).check();
  await expect(page.locator('.hf-page[data-sheet="1"] .hf-zone.footer')).toContainText('1');
  await page.getByRole('button', { name: 'Section 2 ▾' }).click();
  const slot = page.locator('.hf-page[data-sheet="1"] .hf-zone.header [data-slot="left"]');
  await slot.click();
  await page.keyboard.type('Chapter one');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  await expect.poll(md).toMatch(/\{\.hfirst \.cover sect=page pgc=#fff2cc pgb=double before=96 wm="DRAFT"\}/);
  await expect.poll(md).toMatch(/Chapter one begins here\. \{sect=page pstart=1 hdr="Chapter one\|\|"\}/);
  // Taking the cover away keeps the rest, and the document's settings go back to its first paragraph.
  await (await toolButton(page, 'Cover page')).click();
  await page.getByRole('button', { name: 'Remove cover page' }).click();
  await expect(page.locator('.note-editor .pg')).toHaveCount(1);
  await expect.poll(md).toMatch(/^Chapter one begins here\. \{sect=page pstart=1 pgc=#fff2cc pgb=double hdr="Chapter one\|\|" wm="DRAFT"\}/);
});

test('document themes: a theme, theme colours and fonts, paragraph spacing and effects', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Themes', 'A heading');
  await page.keyboard.press('Home');
  await page.keyboard.press('Control+Alt+1');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Body text under it.');
  const heading = page.locator('.note-editor .blk-heading1').first();
  const body = page.locator('.note-editor .blk-paragraph').last();
  await (await toolButton(page, 'Themes')).click();
  await page.getByRole('radio', { name: /Harbour/ }).click();
  await expect(page.locator('.note-editor')).toHaveAttribute('data-thc', 'ocean');
  await expect(heading).toHaveCSS('color', 'rgb(31, 95, 139)');
  await expect(heading).toHaveCSS('font-family', /Montserrat/);
  await expect(body).toHaveCSS('font-family', /Open Sans/);
  // Colours and fonts changed one at a time.
  await (await toolButton(page, 'Theme colours')).click();
  await page.getByRole('menuitemradio', { name: 'Garden' }).click();
  await expect(heading).toHaveCSS('color', 'rgb(60, 110, 71)');
  await (await toolButton(page, 'Theme fonts')).click();
  await page.getByRole('menuitemradio', { name: /^Classic/ }).click();
  await expect(heading).toHaveCSS('font-family', /Georgia/);
  // Paragraph spacing for the whole document.
  await (await toolButton(page, /^Paragraph spacing$/)).click();
  await page.getByRole('menuitemradio', { name: /^Double/ }).click();
  await expect(body).toHaveCSS('margin-bottom', /^10\.6/);
  await (await toolButton(page, 'Theme effects')).click();
  await page.getByRole('menuitemradio', { name: 'Soft shadow' }).click();
  await expect(page.locator('.note-editor')).toHaveAttribute('data-thx', 'soft');
  // The theme's colours head the font colour menu.
  await body.click();
  await (await toolButton(page, 'Font colour')).click();
  await expect(page.getByRole('group', { name: 'Theme colours' }).getByRole('button')).toHaveCount(8);
  await page.keyboard.press('Escape');
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  await expect.poll(md).toContain('{thc=garden thf=classic thx=soft psp=double}');
});

test('a book’s table of contents lists every chapter with its page, and the headings in them, and opens one', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { createProject(n: string): { id: string }; getState(): { chapters: { id: string; projectId: string }[] }; addChapter(id: string): void; setChapterTitle(id: string, t: string): void; setChapterDoc(id: string, d: unknown): void; openProject(id: string): void; selectChapter(id: string): void } }).crumpet;
    const p = s.createProject('The Lighthouse');
    s.addChapter(p.id);
    s.addChapter(p.id);
    const ids = s.getState().chapters.filter((c) => c.projectId === p.id).map((c) => c.id);
    s.setChapterTitle(ids[0], 'Front');
    s.setChapterDoc(ids[0], md.fromMarkdown('[TOC]\n\n# In front'));
    s.setChapterTitle(ids[1], 'The Keeper');
    s.setChapterDoc(ids[1], md.fromMarkdown('# The lamp\n\nShe climbs.'));
    s.setChapterTitle(ids[2], 'Salt');
    s.setChapterDoc(ids[2], md.fromMarkdown('A boat comes in.'));
    s.openProject(p.id);
    s.selectChapter(ids[0]);
  });
  const toc = page.locator('.note-editor .blk-toc');
  await expect(toc.locator('.toc-entry')).toHaveText([/Front\s*1/, /In front/, /The Keeper\s*2/, /The lamp/, /Salt\s*3/]);
  await expect(toc.locator('.toc-entry.toc-2').first()).toContainText('In front');
  // Another chapter's line opens that chapter.
  await toc.locator('.toc-entry', { hasText: 'Salt' }).click();
  await expect(page.getByLabel('Chapter title')).toHaveValue('Salt');
});

test('a text box: typing in it, its fill and wrapping, resizing, and saving it', async ({ page }) => {
  await open(page);
  await newNote(page, 'Boxed', 'Above the box.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/textbox');
  await page.keyboard.press('Enter');
  const shape = page.locator('.note-editor .blk-shape');
  await expect(shape).toHaveCount(1);
  const text = shape.locator('.shape-text');
  await text.click();
  await page.keyboard.type('Key fact');
  await page.keyboard.press('Shift+Control+ArrowLeft');
  await page.keyboard.press('Control+b');
  await expect(text.locator('strong')).toHaveText('fact');
  // Fill and wrapping from its menu.
  await shape.hover();
  await shape.getByRole('button', { name: 'Shape ▾' }).click();
  await shape.getByRole('button', { name: 'Fill light blue' }).click();
  await shape.hover();
  await shape.getByRole('button', { name: 'Shape ▾' }).click();
  await shape.getByRole('button', { name: 'Square, on the right' }).click();
  await expect(shape).toHaveAttribute('data-wrap', 'right');
  // Drag its corner to make it wider.
  const box = shape.locator('.shape-box');
  const before = (await box.boundingBox())!.width;
  await shape.hover();
  const grip = (await shape.locator('.shape-grip').boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + 100, grip.y + 20, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await box.boundingBox())!.width).toBeGreaterThan(before + 60);
  const md = await page.evaluate(async () => {
    const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
    return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
  });
  expect(md).toMatch(/\{shape rect w=[\d.]+ h=[\d.]+ fill=#[0-9a-f]{6} line=#333333 wrap=right\} Key \*\*fact\*\*/);
});

test('shapes: turned with the handle or the menu, and moved anywhere in front of the text', async ({ page }) => {
  await open(page);
  await newNote(page, 'Placed', 'A line of text under the shape.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/textbox');
  await page.keyboard.press('Enter');
  const shape = page.locator('.note-editor .blk-shape');
  const box = shape.locator('.shape-box');
  const look = () =>
    page.evaluate(() => {
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: { blocks: { shape?: { rot?: number; wrap: string; x?: number; y?: number } }[] } }[] } } }).crumpet.getState();
      return s.notes.find((n) => n.id === s.selectedId)!.doc.blocks.find((b) => b.shape)?.shape;
    });
  // The menu turns it a quarter.
  await shape.hover();
  await shape.getByRole('button', { name: 'Shape ▾' }).click();
  await shape.getByRole('button', { name: 'Right 90°' }).click();
  await expect.poll(async () => (await look())?.rot).toBe(90);
  await shape.hover();
  await shape.getByRole('button', { name: 'Shape ▾' }).click();
  await shape.getByRole('button', { name: 'Straight' }).click();
  await expect.poll(async () => (await look())?.rot).toBeUndefined();
  // The handle above it turns it to any angle (Shift: steps of 15°): dragging to the right of the middle is 90°.
  await shape.hover();
  const handle = (await shape.locator('.shape-rot').boundingBox())!;
  const b = (await box.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.keyboard.down('Shift');
  await page.mouse.move(b.x + b.width / 2 + 200, b.y + b.height / 2 + 8, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect.poll(async () => (await look())?.rot).toBe(90);
  await expect(box).toHaveCSS('transform', /matrix/);
  // In front of the text, it takes no room and can be dragged anywhere.
  await shape.hover();
  await shape.getByRole('button', { name: 'Shape ▾' }).click();
  await shape.getByRole('button', { name: 'In front of text' }).click();
  await expect(shape).toHaveAttribute('data-wrap', 'free');
  const start = (await box.boundingBox())!;
  await shape.locator('.shape-wrap').hover();
  const mover = (await shape.locator('.shape-move').boundingBox())!;
  await page.mouse.move(mover.x + mover.width / 2, mover.y + mover.height / 2);
  await page.mouse.down();
  await page.mouse.move(mover.x + mover.width / 2 + 96, mover.y + mover.height / 2 - 48, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await look())?.x).toBeCloseTo(1, 1);
  expect((await look())?.y).toBeCloseTo(-0.5, 1);
  const end = (await box.boundingBox())!;
  expect(end.x - start.x).toBeGreaterThan(80);
});

test('arranging shapes: behind the text, tight and top-and-bottom wrapping, placed from the page, in order, lined up, grouped, on a grid', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await newNote(page, 'Arrange', 'Words.');
  await page.evaluate(async () => {
    const { fromMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const w = window as unknown as { crumpet: { getState(): { selectedId: string }; setDoc(id: string, doc: unknown): void } };
    const md = ['Some text to sit over the shapes. '.repeat(8), '{shape rect w=1 h=1 fill=#cfe2f3 line=#333333 wrap=free x=0.5 y=1.6} A', '{shape ellipse w=1 h=1 fill=#fff2cc line=#333333 wrap=free x=2.5 y=1.8} B', '{shape rounded w=1.5 h=1 fill=#d9ead3 line=#333333} C', 'More words after the shapes. '.repeat(10)].join('\n\n');
    w.crumpet.setDoc(w.crumpet.getState().selectedId, fromMarkdown(md));
  });
  const shapes = page.locator('.note-editor .blk-shape');
  await expect(shapes).toHaveCount(3);
  const [a, b, c] = [shapes.nth(0), shapes.nth(1), shapes.nth(2)];
  const looks = () =>
    page.evaluate(() => {
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: { blocks: { shape?: Record<string, unknown> }[] } }[] } } }).crumpet.getState();
      return s.notes.find((n) => n.id === s.selectedId)!.doc.blocks.filter((x) => x.shape).map((x) => x.shape!);
    });
  const menu = async (shape: typeof a, item: string) => {
    await shape.locator('.shape-box').hover();
    await shape.getByRole('button', { name: 'Shape ▾' }).click();
    await shape.getByRole('button', { name: item, exact: true }).click();
  };
  // Tight and top-and-bottom wrapping for the shape in the text.
  await menu(c, 'Tight, on the left');
  await expect(c).toHaveAttribute('data-tight', '');
  await expect(c).toHaveCSS('float', 'left');
  await menu(c, 'Top and bottom');
  await expect(c).toHaveAttribute('data-wrap', 'topbottom');
  // Bring to front: A goes above B.
  await menu(a, 'Bring to front');
  await expect.poll(async () => (await looks())[0].z).toBe(1);
  await expect(a).toHaveCSS('z-index', '11');
  // Behind the text: drawn under it.
  await menu(b, 'Behind text');
  await expect(b).toHaveAttribute('data-wrap', 'behind');
  await expect(b).toHaveCSS('z-index', '-50');
  // Placed from the page: it stays where it was.
  const before = (await a.locator('.shape-box').boundingBox())!;
  await menu(a, 'The page');
  await expect.poll(async () => (await looks())[0].rel).toBe('page');
  const after = (await a.locator('.shape-box').boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  // Lined up against the left margin.
  await menu(a, 'Left');
  const text = (await page.locator('.note-editor .blk-paragraph').first().boundingBox())!;
  await expect.poll(async () => Math.round((await a.locator('.shape-box').boundingBox())!.x - text.x)).toBe(0);
  // Behind the text, it's picked from the Selection pane, and comes up to be changed.
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ right: true, rightTab: 'objects' }));
  await page.getByRole('tabpanel', { name: 'Selection' }).locator('.sel-go').nth(1).click();
  await expect(b).toHaveClass(/obj-picked/);
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ right: false }));
  // Shift+click picks shapes; grouped, they move together.
  await menu(b, 'In front of text');
  await a.locator('.shape-box').click({ modifiers: ['Shift'], position: { x: 30, y: 60 } });
  await expect(a).toHaveClass(/shape-picked/);
  await menu(b, 'Group');
  await expect.poll(async () => { const l = await looks(); return !!l[0].grp && l[0].grp === l[1].grp; }).toBe(true);
  const start = await looks();
  await b.locator('.shape-box').hover();
  const mover = (await b.locator('.shape-move').boundingBox())!;
  await page.mouse.move(mover.x + mover.width / 2, mover.y + mover.height / 2);
  await page.mouse.down();
  await page.mouse.move(mover.x + mover.width / 2 + 48, mover.y + mover.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Number((await looks())[1].x) - Number(start[1].x)).toBeCloseTo(0.5, 1);
  expect(Number((await looks())[0].x) - Number(start[0].x)).toBeCloseTo(0.5, 1);
  // Gridlines: shown behind the text, and moving snaps to them.
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await page.locator('.note-editor .blk-paragraph').first().click();
  await (await toolButton(page, 'Gridlines')).click();
  await expect(page.locator('.note-editor')).toHaveClass(/show-grid/);
  await menu(b, 'Ungroup');
  await expect.poll(async () => (await looks())[1].grp).toBeUndefined();
  const x0 = Number((await looks())[1].x);
  await b.locator('.shape-box').hover();
  const m2 = (await b.locator('.shape-move').boundingBox())!;
  await page.mouse.move(m2.x + m2.width / 2, m2.y + m2.height / 2);
  await page.mouse.down();
  await page.mouse.move(m2.x + m2.width / 2 + 40, m2.y + m2.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (Number((await looks())[1].x) * 4) % 1).toBeCloseTo(0, 5);
  expect(Number((await looks())[1].x)).not.toBe(x0);
});

test('more shapes from the gallery, shape styles, gradient fill, line thickness, dashes and arrowheads, and effects', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Shapes', 'Text.');
  await page.keyboard.press('End');
  await (await toolButton(page, 'Shapes')).click();
  await page.getByRole('group', { name: 'Stars and banners' }).getByRole('button', { name: '5-point star' }).click();
  const star = page.locator('.note-editor .blk-shape').first();
  await expect(star.locator('.shape-box')).toHaveAttribute('data-kind', 'star5');
  await expect(star.locator('.shape-art path').first()).toHaveAttribute('d', /^M/);
  const look = () =>
    page.evaluate(() => {
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: { blocks: { shape?: Record<string, unknown> }[] } }[] } } }).crumpet.getState();
      return s.notes.find((n) => n.id === s.selectedId)!.doc.blocks.filter((b) => b.shape).map((b) => b.shape!);
    });
  const menu = async (shape: typeof star, item: string | RegExp) => {
    await shape.locator('.shape-box').hover();
    await shape.getByRole('button', { name: 'Shape ▾' }).click();
    await shape.getByRole('button', { name: item, exact: typeof item === 'string' }).first().click();
  };
  // A style from the gallery: a fill fading to a darker blue, white text.
  await menu(star, 'Style: Blue gradient');
  await expect.poll(async () => (await look())[0]).toMatchObject({ fill: '#8faadc', grad: '#2f5597', tc: '#ffffff' });
  await expect(star.locator('.shape-art linearGradient')).toHaveCount(1);
  await menu(star, 'Shadow');
  await expect.poll(async () => (await look())[0].fx).toBe('shadow');
  await expect(star.locator('.shape-art')).toHaveCSS('filter', /drop-shadow/);
  await menu(star, '4.5 pt');
  await menu(star, 'Dashed');
  await expect.poll(async () => (await look())[0]).toMatchObject({ lw: 4.5, dash: 'dash' });
  // A line, with an open arrowhead at its end and a dot at its start.
  await page.locator('.note-editor .blk-paragraph').first().click();
  await page.keyboard.press('End');
  await (await toolButton(page, 'Shapes')).click();
  await page.getByRole('group', { name: 'Lines' }).getByRole('button', { name: 'Line' }).click();
  const line = page.locator('.note-editor .blk-shape').filter({ has: page.locator('[data-kind="line"]') });
  await expect(line).toHaveCount(1);
  await line.locator('.shape-box').hover();
  await line.getByRole('button', { name: 'Shape ▾' }).click();
  await line.locator('[data-shape-action="head"][data-value="open"]').click();
  await line.locator('.shape-box').hover();
  await line.getByRole('button', { name: 'Shape ▾' }).click();
  await line.locator('[data-shape-action="tail"][data-value="dot"]').click();
  await expect.poll(async () => (await look()).find((x) => x.kind === 'line')).toMatchObject({ head: 'open', tail: 'dot' });
  await expect(line.locator('.shape-art marker')).toHaveCount(2);
});

test('text in shapes (lines, bullets, direction), icons, edit points, linked text boxes, and an SVG picture made a shape', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Boxes', 'Text.');
  const looks = () =>
    page.evaluate(() => {
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: { blocks: { type: string; shape?: Record<string, unknown> }[] } }[] } } }).crumpet.getState();
      return s.notes.find((n) => n.id === s.selectedId)!.doc.blocks.filter((b) => b.shape).map((b) => b.shape!);
    });
  const menu = async (shape: ReturnType<typeof page.locator>, item: string) => {
    await shape.locator('.shape-box').hover();
    await shape.getByRole('button', { name: 'Shape ▾' }).click();
    await shape.getByRole('button', { name: item, exact: true }).first().click();
  };
  // A text box with two lines, the second a bullet.
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/textbox');
  await page.keyboard.press('Enter');
  await page.keyboard.type('First line');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- second');
  await expect.poll(async () => (await looks())[0]?.text).toBe('First line&#10;• second');
  const box = page.locator('.note-editor .blk-shape').first();
  // Turned to read downwards.
  await menu(box, 'Down');
  await expect(box.locator('.shape-box')).toHaveAttribute('data-dir', 'down');
  await expect(box.locator('.shape-text')).toHaveCSS('writing-mode', 'vertical-rl');
  await menu(box, 'Across');
  // An icon from the library: a drawing shape.
  await page.locator('.note-editor .blk-paragraph').first().click();
  await page.keyboard.press('End');
  await (await toolButton(page, 'Icons')).click();
  await page.getByRole('group', { name: 'Signs icons' }).getByRole('button', { name: 'Tick' }).click();
  await expect.poll(async () => (await looks()).some((l) => l.kind === 'path')).toBe(true);
  // Edit points: a rectangle becomes a freeform; dragging a corner moves it.
  await page.locator('.note-editor .blk-paragraph').first().click();
  await page.keyboard.press('End');
  await (await toolButton(page, 'Shapes')).click();
  await page.getByRole('group', { name: 'Basic shapes' }).getByRole('button', { name: 'Rectangle', exact: true }).click();
  const rect = page.locator('.note-editor .blk-shape').filter({ has: page.locator('[data-kind="rect"]') }).filter({ hasNotText: 'First line' });
  await menu(rect, 'Edit points');
  const free = page.locator('.note-editor .blk-shape.editing-points');
  await expect(free.locator('.pt-handle')).toHaveCount(4);
  const corner = (await free.locator('.pt-handle').nth(1).boundingBox())!;
  await page.mouse.move(corner.x + 5, corner.y + 5);
  await page.mouse.down();
  await page.mouse.move(corner.x - 30, corner.y + 20, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => { const f = (await looks()).find((l) => l.kind === 'freeform'); return (f?.pts as number[][] | undefined)?.[1]?.[0] ?? 1; }).toBeLessThan(0.9);
  // Linked text boxes: the first box's text runs on into the second.
  await page.evaluate(async () => {
    const { fromMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const w = window as unknown as { crumpet: { getState(): { selectedId: string }; setDoc(id: string, doc: unknown): void } };
    const long = 'A story that is far too long for one small box and carries on. '.repeat(6);
    const md = [`{shape rect w=2 h=0.8 fill=#ffffff line=#333333} ${long}`, 'Between.', '{shape rect w=2 h=0.8 fill=#ffffff line=#333333}', '![drawing](data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 10 10"><polygon points="5,0 10,10 0,10" fill="#336699"/></svg>') + ')'].join('\n\n');
    w.crumpet.setDoc(w.crumpet.getState().selectedId, fromMarkdown(md));
  });
  const first = page.locator('.note-editor .blk-shape').first();
  await menu(first, 'Link to next box');
  await expect.poll(async () => (await looks()).map((l) => l.chain).filter(Boolean).length).toBe(2);
  const second = page.locator('.note-editor .blk-shape').nth(1);
  await expect(second.locator('.chain-flow')).toContainText('A story');
  const offset = await second.locator('.chain-flow').evaluate((el) => parseFloat((el as HTMLElement).style.marginTop));
  expect(offset).toBeLessThan(-10);
  // An SVG picture made a shape: its outline, in its colour, ready to recolour.
  const pic = page.locator('.note-editor .blk-image');
  await pic.locator('img').hover();
  await pic.getByRole('button', { name: 'Picture ▾' }).click();
  await pic.getByRole('button', { name: 'Convert to shape' }).click();
  await expect.poll(async () => (await looks()).find((l) => l.kind === 'path')).toMatchObject({ fill: '#336699', vb: [10, 10] });
});

test('outline view (promote, demote, move, show level, drag), pages side by side, one page, like a book, and page thumbnails', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Outline', 'Words.');
  await page.evaluate(async () => {
    const { fromMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const w = window as unknown as { crumpet: { getState(): { selectedId: string }; setDoc(id: string, doc: unknown): void } };
    w.crumpet.setDoc(w.crumpet.getState().selectedId, fromMarkdown('# One\n\nAbout one.\n\n## Sub\n\nAbout sub.\n\n# Two\n\nAbout two.\n'));
  });
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  const ed = page.locator('.note-editor');
  await page.locator('.note-editor .blk-heading1').last().click();
  await (await toolButton(page, 'Outline view')).click();
  await expect(ed).toHaveClass(/outline-view/);
  const bar = page.getByRole('toolbar', { name: 'Outlining' });
  await expect(bar).toBeVisible();
  await expect(page.locator('.note-editor .blk-heading1').first()).toHaveAttribute('data-ol', '1');
  await expect(page.locator('.note-editor .blk-paragraph').first()).toHaveAttribute('data-ol', 'b');
  // Show only level 1: the body text and Heading 2 out of sight.
  await bar.getByLabel('Show level').selectOption('1');
  await expect(page.locator('.note-editor .blk-heading2')).toBeHidden();
  await expect(page.locator('.note-editor .blk-paragraph').first()).toBeHidden();
  await bar.getByLabel('Show level').selectOption('');
  // Collapsed, "Two" moves up with its text (open, it would move on its own, as in Word).
  await page.locator('.note-editor .blk-heading1').last().click();
  await bar.getByRole('button', { name: 'Collapse' }).click();
  await bar.getByRole('button', { name: 'Move up' }).click();
  await expect.poll(md).toMatch(/## Sub\n\n# Two \{\.folded\}\n\nAbout two\.\n\nAbout sub\./);
  await bar.getByRole('button', { name: 'Expand' }).click();
  await expect.poll(md).not.toContain('.folded');
  // Promote and demote.
  await page.locator('.note-editor .blk-heading2').click();
  await bar.getByRole('button', { name: 'Promote', exact: true }).click();
  await expect.poll(md).toContain('# Sub');
  await bar.getByRole('button', { name: 'Demote', exact: true }).click();
  await expect.poll(md).toContain('## Sub');
  // Dragging a heading's marker takes its section with it: "One" to the very end.
  const one = page.locator('.note-editor .blk-heading1').first();
  const r = (await one.boundingBox())!;
  const last = (await page.locator('.note-editor .blk').last().boundingBox())!;
  await page.mouse.move(r.x + 8, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + 8, last.y + last.height - 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(md).toMatch(/^# Two/);
  await expect.poll(md).toMatch(/# One\n\nAbout one\.\n\n## Sub\n$/);
  await bar.getByRole('button', { name: 'Close outline view' }).click();
  await expect(ed).not.toHaveClass(/outline-view/);
  // Page view with several pages: two in a row, one page, like a book.
  await page.evaluate(async () => {
    const { fromMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const w = window as unknown as { crumpet: { getState(): { selectedId: string }; setDoc(id: string, doc: unknown): void; updateSettings(p: object): void } };
    w.crumpet.setDoc(w.crumpet.getState().selectedId, fromMarkdown(Array.from({ length: 90 }, (_, i) => `Paragraph ${i + 1}, long enough to fill some of the page with words and more words.`).join('\n\n')));
    w.crumpet.updateSettings({ pageView: { notes: true } });
  });
  await expect.poll(() => page.locator('.note-editor .pg').count()).toBeGreaterThan(2);
  await (await toolButton(page, 'Page layout on screen')).click();
  await page.getByRole('menuitemradio', { name: '2 pages in a row' }).click();
  const pgs = page.locator('.note-editor .pg');
  await expect.poll(async () => { const [a, b] = [(await pgs.nth(0).boundingBox())!, (await pgs.nth(1).boundingBox())!]; return Math.abs(a.y - b.y) < 2 && b.x > a.x + a.width; }).toBe(true);
  await expect.poll(async () => (await page.locator('.sheet').nth(1).boundingBox())!.x > (await page.locator('.sheet').nth(0).boundingBox())!.x + 100).toBe(true);
  await (await toolButton(page, 'Page layout on screen')).click();
  await page.getByRole('menuitemradio', { name: 'Side to side, like a book' }).click();
  // Like a book: the first page alone, on the right.
  await expect.poll(async () => { const [a, b] = [(await pgs.nth(0).boundingBox())!, (await pgs.nth(1).boundingBox())!]; return b.y > a.y + 10 && a.x > b.x + 10; }).toBe(true);
  await (await toolButton(page, 'Page layout on screen')).click();
  await page.getByRole('menuitemradio', { name: 'One page' }).click();
  await expect.poll(async () => (await pgs.nth(0).boundingBox())!.height).toBeLessThan(800);
  // Thumbnails of the pages in the right sidebar; a click goes to that page.
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ right: true, rightTab: 'pages' }));
  const thumbs = page.getByRole('tabpanel', { name: 'Pages' }).locator('.thumb');
  await expect.poll(() => thumbs.count()).toBe(await pgs.count());
  await thumbs.nth(2).click();
});

test('immersive reader (spacing, syllables, parts of speech, line focus, picture dictionary), a new window on the same note, and scrolling together', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.route('**/api/rest_v1/page/summary/**', (r) => r.fulfill({ json: { title: 'Lighthouse', type: 'standard', thumbnail: { source: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#c33"/></svg>') } } }));
  await page.route('**/api.dictionaryapi.dev/**', (r) => r.fulfill({ json: [{ meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A tower with a light that guides ships.' }] }] }] }));
  await page.route('**/api.datamuse.com/**', (r) => r.fulfill({ json: [] }));
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Reading', 'The old keeper slowly climbed the dark stairs of the lighthouse.');
  await (await toolButton(page, 'Immersive reader')).click();
  const reader = page.getByRole('dialog', { name: 'Immersive reader' });
  await expect(reader).toContainText('The old keeper slowly climbed');
  const text = reader.locator('.reader-text');
  // Wider letter spacing.
  await reader.getByRole('button', { name: 'Text preferences' }).click();
  await reader.getByLabel('Letter spacing').fill('10');
  await expect(text).toHaveCSS('letter-spacing', /px/);
  await reader.getByRole('button', { name: 'Wide', exact: true }).click();
  // Syllables, and nouns coloured.
  await reader.getByRole('button', { name: 'Grammar options' }).click();
  await reader.getByLabel('Syllables').check();
  await expect(text).toContainText('keep·er slow·ly');
  await reader.getByLabel('Nouns').check();
  await expect(reader.locator('.rw.pos-noun').first()).toBeVisible();
  // Line focus: only a few lines lit.
  await reader.getByRole('button', { name: 'Reading preferences' }).click();
  await reader.getByRole('button', { name: '3 lines' }).click();
  await expect(page.locator('.reader-focus')).toHaveCount(1);
  await reader.getByRole('button', { name: 'Off', exact: true }).click();
  // The picture dictionary: a word's picture and meaning.
  await reader.locator('.rw', { hasText: 'keep·er' }).click();
  const card = page.getByRole('dialog', { name: /Picture dictionary/ });
  await expect(card.locator('img')).toBeVisible();
  await expect(card).toContainText('A tower with a light');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(reader).toHaveCount(0);
  // A new window: the same note again beside it, kept in step.
  await (await toolButton(page, 'New window')).click();
  await expect(page.locator('.pane-group')).toHaveCount(2);
  const editors = page.locator('.pane-group .note-editor');
  await expect(editors).toHaveCount(2);
  await editors.nth(0).locator('.blk').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' The end.');
  await expect(editors.nth(1)).toContainText('The end.');
  // Scrolling together: a long note, scrolled in one pane, scrolls in the other.
  await page.evaluate(async () => {
    const { fromMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const w = window as unknown as { crumpet: { getState(): { selectedId: string }; setDoc(id: string, doc: unknown): void; updateSettings(p: object): void } };
    w.crumpet.setDoc(w.crumpet.getState().selectedId, fromMarkdown(Array.from({ length: 120 }, (_, i) => `Line ${i + 1} of a long note.`).join('\n\n')));
    w.crumpet.updateSettings({ syncScroll: true });
  });
  const scrolls = page.locator('.pane-group .note-scroll');
  await expect.poll(() => scrolls.nth(1).evaluate((el) => el.scrollHeight > el.clientHeight + 200)).toBe(true);
  await scrolls.nth(0).evaluate((el) => el.scrollTo({ top: 600 }));
  await expect.poll(() => scrolls.nth(1).evaluate((el) => el.scrollTop)).toBeGreaterThan(300);
});

test('the Check tab: accessibility, Word compatibility, inspect, a spelling pass with suggestions, clarity and inclusive language', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await newNote(page, 'Check', 'Words.');
  await page.evaluate(async () => {
    const { fromMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const w = window as unknown as { crumpet: { getState(): { selectedId: string }; setDoc(id: string, doc: unknown): void; updateLayout(p: object): void } };
    w.crumpet.setDoc(w.crumpet.getState().selectedId, fromMarkdown('# Report\n\n### Details\n\nIn order to begin, the chairman read the {==notes==}{>>Ann (2026-01-01 09:30Z): Check<<} about the lighthuose. See [[Other]].\n'));
    w.crumpet.updateLayout({ right: true, rightTab: 'check' });
  });
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
    });
  const tab = page.getByRole('tabpanel', { name: 'Check' });
  await expect(page.locator('.note-editor .blk-heading3')).toHaveCount(1);
  await page.locator('.note-editor .blk-paragraph').first().click();
  await expect(tab).toContainText('Heading 3 after Heading 1');
  await tab.getByRole('tab', { name: 'Word' }).click();
  await expect(tab).toContainText('Link to a note');
  // Clarity and inclusive language: plainer and fairer words, in one click.
  await tab.getByRole('tab', { name: 'Clarity' }).click();
  await tab.getByRole('button', { name: 'Use “To”' }).click();
  await expect.poll(md).toContain('To begin');
  await tab.getByRole('tab', { name: 'Inclusive' }).click();
  await tab.getByRole('button', { name: 'Use “chair”' }).click();
  await expect.poll(md).toContain('the chair read');
  // A spelling pass, with suggestions.
  await tab.getByRole('tab', { name: 'Spelling' }).click();
  await tab.getByRole('button', { name: 'Check spelling' }).click();
  await expect(tab.locator('.spelling-issue strong')).toHaveText(['lighthuose'], { timeout: 15000 });
  await tab.getByRole('button', { name: 'lighthouse', exact: true }).click();
  await expect.poll(md).toContain('about the lighthouse');
  // Inspect: the comment and who wrote it, and taking comments out.
  await tab.getByRole('tab', { name: 'Inspect' }).click();
  await expect(tab).toContainText('Ann');
  await tab.getByRole('button', { name: 'Remove all comments' }).click();
  await expect.poll(md).not.toContain('{>>');
});

test('the sidebar and note list fold away with «, peek out at the edge, and come back', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1400, height: 860 });
  await page.locator('.sidebar').hover();
  await page.getByRole('button', { name: 'Hide the sidebar' }).click();
  await expect(page.locator('.frame > .sidebar')).toHaveCount(0);
  // Resting the mouse on the window's left edge slides it out over the page.
  await page.mouse.move(3, 400);
  await expect(page.locator('.peek-panel .sidebar')).toBeVisible();
  await page.mouse.move(1000, 400);
  await expect(page.locator('.peek-panel')).toHaveCount(0);
  // Ctrl+Shift+\ folds the note list; its button in the top bar brings it back.
  await page.keyboard.press('Control+Shift+Backslash');
  await expect(page.locator('.panes > .list')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show the note list' }).click();
  await expect(page.locator('.panes > .list')).toBeVisible();
  await page.getByRole('button', { name: 'Show the sidebar' }).click();
  await expect(page.locator('.frame > .sidebar')).toBeVisible();
});

test('the right sidebar: the outline of headings, styles, and links to and from the note', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1500, height: 880 });
  await page.evaluate(async () => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    (window as unknown as { crumpet: { createNote(n: object): void } }).crumpet.createNote({ title: 'Harbour', doc: md.fromMarkdown('See [[Lamp room]] for more.') });
  });
  await newNote(page, 'Lamp room', 'Intro');
  await page.keyboard.press('Enter');
  await page.keyboard.type('## Upstairs');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The lens.');
  await page.getByRole('button', { name: 'Show the right sidebar' }).click();
  const right = page.getByRole('complementary', { name: 'Right sidebar' });
  await expect(right.getByRole('tab', { name: 'Outline' })).toHaveAttribute('aria-selected', 'true');
  await expect(right.locator('.right-outline button:not(.outline-mark)')).toHaveText(['Upstairs']);
  await right.getByRole('tab', { name: 'Links' }).click();
  await expect(right.locator('.right-links')).toContainText('Harbour');
  await right.getByRole('button', { name: 'Harbour' }).click();
  await expect(page.getByRole('region', { name: 'Pane' }).getByLabel('Title')).toHaveValue('Harbour');
  await expect(right.locator('.right-links li')).toHaveText(['Lamp room']);
  // The Styles pane button opens its tab; Ctrl+Alt+\ folds the sidebar away.
  await right.getByRole('tab', { name: 'Styles' }).click();
  await expect(right.getByRole('complementary', { name: 'Styles' })).toBeVisible();
  await page.keyboard.press('Control+Alt+Backslash');
  await expect(right).toHaveCount(0);
});

test('quick switcher, command palette and bookmarks', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1400, height: 860 });
  await newNote(page, 'Harbour walk', 'Gulls');
  await newNote(page, 'Lamp room', 'The lens');
  // Ctrl+O: a few letters, Enter opens it where you're working.
  await page.keyboard.press('Control+o');
  const finder = page.getByRole('dialog', { name: 'Quick switcher' });
  await page.keyboard.type('hbw');
  await expect(finder.getByRole('option').first()).toContainText('Harbour walk');
  await page.keyboard.press('Enter');
  await expect(finder).toHaveCount(0);
  const pane = page.getByRole('region', { name: 'Pane' });
  await expect(pane.getByLabel('Title')).toHaveValue('Harbour walk');
  // Ctrl+Enter: a new tab.
  await page.keyboard.press('Control+o');
  await page.keyboard.type('lamp');
  await page.keyboard.press('Control+Enter');
  await expect(pane.getByRole('tab')).toHaveText(['Harbour walk', 'Lamp room']);
  // No match: make a note with that title.
  await page.keyboard.press('Control+o');
  await page.keyboard.type('Brand new idea');
  await page.getByRole('option', { name: /Create note/ }).click();
  await expect(pane.getByLabel('Title')).toHaveValue('Brand new idea');
  // Ctrl+P: commands, run on the text you're in.
  await pane.locator('.note-editor').click();
  await page.keyboard.type('bold words');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.press('Control+p');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
  await page.keyboard.type('bold');
  await page.keyboard.press('Enter');
  await expect(pane.locator('.note-editor strong')).toHaveText('Bold words');
  // Bookmark it, and it's in the sidebar to open again.
  await page.keyboard.press('Control+p');
  await page.keyboard.type('bookmark this note');
  await page.keyboard.press('Enter');
  const marks = page.getByRole('region', { name: 'Bookmarks' });
  await expect(marks).toContainText('Brand new idea');
  await list(page).locator('.card', { hasText: 'Harbour walk' }).click();
  await marks.getByRole('button', { name: 'Brand new idea', exact: true }).click();
  await expect(pane.getByLabel('Title')).toHaveValue('Brand new idea');
});

test('snapshots: take one, compare with the text now, and go back to it', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1440, height: 880 });
  await newNote(page, 'Draft', 'The lamp was dark.');
  await page.keyboard.press('Control+Alt+s');
  const right = page.getByRole('complementary', { name: 'Right sidebar' });
  await expect(right.getByRole('tab', { name: 'Snapshots' })).toHaveAttribute('aria-selected', 'true');
  // (Versions kept automatically while typing are listed too.)
  const taken = right.locator('.snapshot-list li:not(.auto)');
  await expect(taken).toHaveCount(1);
  // Change the text, then compare.
  await page.keyboard.type(' It lit itself.');
  await taken.getByRole('button', { name: 'Compare' }).click();
  const compare = page.getByRole('dialog', { name: 'Compare with snapshot' });
  await expect(compare.locator('ins')).toHaveText([' It lit itself.']);
  await compare.getByRole('button', { name: 'Close' }).click();
  // Go back: the text as it was, and the rewrite kept as a snapshot.
  await taken.getByRole('button', { name: 'Go back to this' }).click();
  await taken.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.locator('.note-editor')).toHaveText('The lamp was dark.');
  await expect(taken).toHaveCount(2);
  await expect(taken.locator('.snapshot-name').first()).toHaveText('Before going back to the snapshot');
});

test('version history: versions kept while writing, compared and gone back to', async ({ page }) => {
  await page.clock.install();
  await open(page);
  await page.setViewportSize({ width: 1440, height: 880 });
  await newNote(page, 'Draft', 'The lamp was dark.');
  await page.clock.runFor(2000);
  await page.keyboard.press('Control+Alt+s');
  const right = page.getByRole('complementary', { name: 'Right sidebar' });
  const versions = right.locator('.snapshot-list li.auto');
  const count = await versions.count();
  // Eleven minutes later, more writing: the text as it was is kept.
  await page.clock.runFor(11 * 60_000);
  await page.keyboard.type(' It lit itself.');
  await page.clock.runFor(2000);
  await expect(versions).toHaveCount(count + 1);
  await expect(versions.first().locator('.snapshot-name')).toContainText('Version');
  await expect(right.locator('.snapshot-day').first()).toHaveText('Today');
  await versions.first().getByRole('button', { name: 'Compare' }).click();
  const compare = page.getByRole('dialog', { name: 'Compare with snapshot' });
  await expect(compare.locator('ins')).toHaveText([' It lit itself.']);
  await compare.getByRole('button', { name: 'Close' }).click();
  await versions.first().getByRole('button', { name: 'Go back to this' }).click();
  await versions.first().getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.locator('.note-editor')).toHaveText('The lamp was dark.');
  // Hiding versions, and turning them off.
  await right.getByLabel(/Show \d+ automatic version/).uncheck();
  await expect(versions).toHaveCount(0);
  await right.getByLabel('Keep versions while I write').uncheck();
  await expect.poll(() => page.evaluate(() => (window as unknown as { crumpet: { getState(): { settings: { autoVersions?: boolean } } } }).crumpet.getState().settings.autoVersions)).toBe(false);
});

test('chapter keywords: add them, see them in the outline and cards, and show only the chapters with one', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('Book');
  await page.keyboard.press('Enter');
  const outline = page.getByRole('region', { name: 'Outline' });
  await page.getByLabel('Chapter title').fill('Arrival');
  const addKeyword = async (word: string) => {
    await page.getByRole('button', { name: '+ Keyword' }).click();
    await page.getByLabel('New keyword').fill(word);
    await page.keyboard.press('Enter');
  };
  await addKeyword('Mara');
  await outline.getByRole('button', { name: 'Add chapter' }).click();
  await page.getByLabel('Chapter title').fill('Storm');
  await addKeyword('Tom');
  await expect(outline.locator('.keyword-chip')).toHaveText(['Mara', 'Tom']);
  // Show only Mara's chapters, in the outline and on the cards.
  await outline.getByLabel('Show chapters with keyword').selectOption('Mara');
  await expect(outline.locator('.outline-title')).toHaveText(['Arrival']);
  await outline.getByRole('button', { name: 'Cards' }).click();
  await expect(page.locator('.cork-title')).toHaveText(['Arrival']);
  await outline.getByLabel('Show chapters with keyword').selectOption('');
  await expect(page.locator('.cork-title')).toHaveText(['Arrival', 'Storm']);
});

test('the Writing tab: session words and target, text statistics, highlighting and words used most', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1440, height: 880 });
  await newNote(page, 'Scene', '“Is it lit?” she asked. It was just really dark. The lamp, the lamp.');
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ right: true, rightTab: 'writing' }));
  const tab = page.getByRole('tabpanel', { name: 'Writing' });
  await expect(tab.locator('.target-line b')).toHaveText('14');
  await expect(tab.locator('.text-stats dd').first()).toHaveText('14');
  await tab.getByLabel('Session target in words').fill('20');
  await expect(tab.getByRole('progressbar', { name: 'Session target' })).toHaveAttribute('aria-valuenow', '14');
  await tab.getByRole('button', { name: 'Filler words' }).click();
  await expect(tab.locator('.focus-found')).toContainText('2 found');
  await expect(page.locator('.note-editor.ling-dim')).toHaveCount(1);
  await tab.getByRole('button', { name: 'Stop highlighting' }).click();
  await expect(page.locator('.note-editor.ling-dim')).toHaveCount(0);
  await expect(tab.locator('.word-freq li').first()).toContainText('lamp');
});

test('revision mode: typing in the round’s colour, and taking the colours off', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1440, height: 880 });
  await newNote(page, 'Revise me', 'First draft.');
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ right: true, rightTab: 'writing' }));
  const tab = page.getByRole('tabpanel', { name: 'Writing' });
  await tab.getByRole('button', { name: 'Second' }).click();
  await expect(page.getByRole('button', { name: 'Second revision' })).toBeVisible();
  await page.locator('.note-editor').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Now better.');
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc) as string;
    });
  await expect.poll(md).toContain('First draft.[ Now better.]{color=#c0392b}');
  // Stop revising, then take the colours off.
  await page.getByRole('button', { name: 'Second revision' }).click();
  await expect(page.getByRole('button', { name: 'Second revision' })).toHaveCount(0);
  await tab.getByRole('button', { name: 'Remove revision colours from this note' }).click();
  await expect.poll(md).toBe('First draft. Now better.\n');
});

test('read aloud lights up each word, and dictation types what is said', async ({ page }) => {
  // The browser's speech, stood in for: speaking reports each word then ends; listening "hears" a sentence.
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const spoken: string[] = [];
    w.__spoken = spoken;
    const synth = {
      speaking: false,
      getVoices: () => [],
      addEventListener() {},
      removeEventListener() {},
      cancel() {},
      pause() {},
      resume() {},
      speak(u: { text: string; onboundary?: (e: object) => void; onend?: () => void }) {
        spoken.push(u.text);
        let i = 0;
        const words = [...u.text.matchAll(/\S+/g)];
        const tick = () => {
          if (i < words.length) {
            u.onboundary?.({ name: 'word', charIndex: words[i].index, charLength: words[i][0].length });
            i++;
            setTimeout(tick, 120);
          } else u.onend?.();
        };
        setTimeout(tick, 50);
      },
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth });
    w.SpeechSynthesisUtterance = class {
      text: string;
      constructor(t: string) {
        this.text = t;
      }
    };
    const Fake = class {
      onresult: ((e: object) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'the bell rang full stop' } }] }), 100);
      }
      stop() {
        this.onend?.();
      }
    };
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) Object.defineProperty(window, name, { value: Fake, configurable: true });
  });
  await open(page);
  await page.setViewportSize({ width: 1500, height: 880 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Aloud', 'The lamp was dark.');
  await page.keyboard.press('Home');
  await (await toolButton(page, 'Read aloud')).click();
  await expect(page.getByRole('status', { name: 'Reading aloud' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual(['The lamp was dark.']);
  await expect.poll(() => page.evaluate(() => CSS.highlights.has('crumpet-speak'))).toBe(true);
  await expect(page.getByRole('status', { name: 'Reading aloud' })).toHaveCount(0);
  // Dictation at the end of the text.
  await page.locator('.note-editor').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await (await toolButton(page, 'Dictate')).click();
  await expect(page.locator('.note-editor .blk').nth(1)).toHaveText('The bell rang.');
  await page.getByRole('status', { name: 'Dictation' }).getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('status', { name: 'Dictation' })).toHaveCount(0);
});

test('format painter copies formatting to the next selection; the thesaurus swaps in a synonym', async ({ page }) => {
  await page.route('https://api.datamuse.com/**', (r) => r.fulfill({ json: new URL(r.request().url()).searchParams.get('rel_syn') ? [{ word: 'dim' }, { word: 'gloomy' }] : [] }));
  await page.route('https://api.dictionaryapi.dev/**', (r) => r.fulfill({ json: [{ meanings: [{ partOfSpeech: 'adjective', definitions: [{ definition: 'Having very little light.' }] }] }] }));
  await open(page);
  await page.setViewportSize({ width: 1500, height: 880 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Paint', 'Bold plain words');
  // Make "Bold" bold, then paint its formatting onto "words".
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+Control+ArrowRight');
  await page.keyboard.press('Control+b');
  await page.locator('.note-editor').getByText('Bold').click();
  await (await toolButton(page, 'Format painter')).click();
  await page.locator('.note-editor').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Control+ArrowLeft');
  await expect(page.locator('.note-editor strong')).toHaveText(['Bold', 'words']);
  await expect(page.locator('.note-editor.painting')).toHaveCount(0);
  // The thesaurus follows the caret.
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ right: true, rightTab: 'thesaurus' }));
  await page.locator('.note-editor').click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
  const tab = page.getByRole('tabpanel', { name: 'Thesaurus' });
  await expect(tab.getByLabel('Look up a word')).toHaveValue('plain');
  await expect(tab.locator('.senses')).toContainText('Having very little light.');
  await tab.getByRole('button', { name: 'gloomy' }).click();
  await expect(page.locator('.note-editor')).toHaveText('Bold gloomy words');
});

test('compare two notes, and make a copy with the differences as tracked changes', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1400, height: 860 });
  await newNote(page, 'Draft one', 'The lamp was dark.');
  await newNote(page, 'Draft two', 'The lamp was bright.');
  await page.keyboard.press('Control+p');
  await page.keyboard.type('compare with');
  await page.keyboard.press('Enter');
  const pick = page.getByRole('dialog', { name: 'Compare with' });
  await expect(pick).toBeVisible();
  await page.keyboard.type('draft one');
  await page.keyboard.press('Enter');
  const compare = page.getByRole('dialog', { name: 'Compare documents' });
  await expect(compare).toContainText('From “Draft two” to “Draft one”');
  await expect(compare.locator('ins')).toContainText('dark');
  await expect(compare.locator('del')).toContainText('bright');
  await compare.getByRole('button', { name: 'Swap' }).click();
  await expect(compare.locator('ins')).toContainText('bright');
  await compare.getByRole('button', { name: 'Make a copy with tracked changes' }).click();
  await expect(page.getByRole('region', { name: 'Pane' }).getByLabel('Title')).toHaveValue('Draft one → Draft two (compared)');
  const md = await page.evaluate(async () => {
    const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { getState(): { notes: { title: string; doc: unknown }[] } } }).crumpet.getState();
    return toMarkdown(s.notes.find((n) => n.title.endsWith('(compared)'))!.doc) as string;
  });
  expect(md).toContain('{--dark--}');
  expect(md).toContain('{++bright++}');
});

test('toggles fold their lines away, and callouts are coloured boxes', async ({ page }) => {
  await open(page);
  await newNote(page, 'Folds', '');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/toggle');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Spoilers');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The keeper did it.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Twice.');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('After the toggle.');
  const editor = page.locator('.note-editor');
  await expect(editor.locator('[data-in-toggle]')).toHaveCount(2);
  await editor.locator('[data-style="toggle"] .fold').click();
  await expect(editor.getByText('The keeper did it.')).toBeHidden();
  await expect(editor.getByText('After the toggle.')).toBeVisible();
  await editor.locator('[data-style="toggle"] .fold').click();
  await expect(editor.getByText('The keeper did it.')).toBeVisible();
  // A callout.
  await editor.getByText('After the toggle.').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/warning');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Mind the stairs.');
  await expect(editor.locator('.blk-quote[data-style="warning"]')).toHaveText('Mind the stairs.');
});

test('maths and diagrams: typed as text, drawn on the page, and saved as fenced blocks', async ({ page }) => {
  await open(page);
  await newNote(page, 'Formulas', '');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/math');
  await page.keyboard.press('Enter');
  const src = page.getByLabel('Maths source (LaTeX)');
  await expect(src).toBeFocused();
  await page.keyboard.type('E = mc^2');
  await page.keyboard.press('Escape');
  const editor = page.locator('.note-editor');
  await expect(editor.locator('.code-preview .katex')).toBeVisible();
  await expect(src).toBeHidden();
  // Clicking the drawing opens its source again.
  await editor.locator('.code-preview').first().click();
  await expect(src).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.type('/diagram');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(editor.locator('.code-wrap[data-lang="mermaid"] .code-preview svg')).toBeVisible({ timeout: 15000 });
  const md = await page.evaluate(async () => {
    const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
    return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc) as string;
  });
  expect(md).toContain('```math\nE = mc^2\n```');
  expect(md).toContain('```mermaid\ngraph LR\n  A[Start] --> B[End]\n```');
});

test('search finds words inside attached PDFs and pictures', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  await page.setViewportSize({ width: 1400, height: 860 });
  // A small PDF saying "Fresnel lens timetable".
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const stream = 'BT /F1 18 Tf 40 100 Td (Fresnel lens timetable) Tj ET';
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // A picture of the words "LANTERN ROOM", drawn here.
  const pngBase64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 220;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#000';
    g.font = 'bold 96px Arial, sans-serif';
    g.fillText('LANTERN ROOM', 30, 140);
    return c.toDataURL('image/png').split(',')[1];
  });
  const Bytes = (globalThis as unknown as { Buffer: { from(s: string, encoding?: string): never } }).Buffer;
  await newNote(page, 'Attachments', 'See the files:');
  await page.keyboard.press('Enter');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Add a picture or file…' }).click();
  await (await chooser).setFiles([
    { name: 'sign.png', mimeType: 'image/png', buffer: Bytes.from(pngBase64, 'base64') },
    { name: 'timetable.pdf', mimeType: 'application/pdf', buffer: Bytes.from(pdf) },
  ]);
  await newNote(page, 'Other', 'Nothing here.');
  // Once read (in the background), a search finds the note by words only in its files.
  const read = () => page.evaluate(() => Object.values((window as unknown as { crumpet: { getState(): { fileText: Record<string, string> } } }).crumpet.getState().fileText).join(' | '));
  await expect.poll(read, { timeout: 60_000 }).toContain('Fresnel lens timetable');
  await expect.poll(read, { timeout: 60_000 }).toMatch(/LANTERN/i);
  const search = page.locator('#search');
  await search.fill('fresnel');
  await expect(list(page).locator('.card')).toHaveText([/Attachments/]);
  await expect(list(page).locator('.card mark')).toHaveText(['Fresnel']);
  await search.fill('lantern');
  await expect(list(page).locator('.card')).toHaveText([/Attachments/]);
});

test('graph view: notes and their links, all of them or just near the open note', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1400, height: 860 });
  await page.evaluate(async () => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { createNote(p: object): { id: string }; select(id: string): void } }).crumpet;
    s.createNote({ title: 'Lamp', doc: md.fromMarkdown('See [[Keeper]].') });
    s.createNote({ title: 'Keeper', doc: md.fromMarkdown('Father of [[Mara]].') });
    s.createNote({ title: 'Mara', doc: md.fromMarkdown('Daughter.') });
    const lone = s.createNote({ title: 'Lone', doc: md.fromMarkdown('Nothing linked.') });
    s.createNote({ title: 'Far', doc: md.fromMarkdown('Nothing.') });
    s.select(lone.id);
  });
  await page.keyboard.press('Control+g');
  const graph = page.getByRole('region', { name: 'Graph' });
  await expect(graph).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Graph' })).toHaveAttribute('aria-selected', 'true');
  await expect(graph.locator('.graph-count')).toHaveText('5 notes · 2 links');
  await graph.getByLabel('Notes without links').uncheck();
  await expect(graph.locator('.graph-count')).toHaveText('3 notes · 2 links');
  // Near the open note: open Keeper, then show what's linked to it.
  await list(page).locator('.card').filter({ has: page.locator('.card-title', { hasText: /^Keeper$/ }) }).click({ button: 'middle' });
  await page.getByRole('tab', { name: 'Keeper' }).click();
  await page.getByRole('tab', { name: 'Graph' }).click();
  await graph.getByLabel('Which notes').selectOption('1');
  await expect(graph.locator('.graph-count')).toHaveText('3 notes · 2 links');
  await graph.getByLabel('Which notes').selectOption('0');
  await graph.getByLabel('Notes without links').check();
  await expect(graph.locator('.graph-count')).toHaveText('5 notes · 2 links');
  // Zoom buttons in the corner.
  const zoom = graph.getByRole('group', { name: 'Zoom' });
  await zoom.getByRole('button', { name: 'Zoom in' }).click();
  await zoom.getByRole('button', { name: 'Zoom out' }).click();
  await zoom.getByRole('button', { name: 'Fit' }).click();
});

test('boards: cards and arrows, saved as JSON Canvas in the note', async ({ page }) => {
  await open(page);
  await newNote(page, 'Mara', 'She keeps the lamp.');
  await sidebar(page).getByRole('button', { name: 'New from a template' }).click();
  await page.getByRole('button', { name: /New board/ }).click();
  const surface = page.getByLabel('Board surface');
  await expect(surface).toBeVisible();
  await expect(surface).toContainText('Double-click anywhere');
  // Double-click an empty spot: a text card, ready to type in.
  const box = (await surface.boundingBox())!;
  await surface.dblclick({ position: { x: box.width / 3, y: box.height / 2 } });
  await page.getByLabel('Card text').fill('# Opening\nThe lamp goes **dark**.');
  await page.keyboard.press('Escape');
  const text = page.locator('.board-card.text');
  await expect(text).toContainText('Opening');
  await expect(text.locator('strong')).toHaveText('dark');
  // A note from the picker.
  await page.getByRole('button', { name: '+ Note' }).click();
  await page.getByLabel('Find a note').fill('Mar');
  await page.keyboard.press('Enter');
  await expect(page.locator('.board-card.file')).toContainText('She keeps the lamp.');
  // Draw an arrow from the text card to the note card.
  await text.click();
  const port = text.locator('.card-port.right');
  const target = (await page.locator('.board-card.file').boundingBox())!;
  const p = (await port.boundingBox())!;
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.board path.arrow-line:not(.drawing)')).toHaveCount(1);
  // Saved in the note as a ```canvas block.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: { blocks: { code?: { lang: string; text: string } }[] } }[] } } }).crumpet.getState();
        const code = s.notes.find((n) => n.id === s.selectedId)?.doc.blocks[0].code;
        if (code?.lang !== 'canvas') return null;
        const b = JSON.parse(code.text) as { nodes: { type: string }[]; edges: unknown[] };
        return `${b.nodes.map((n) => n.type).join(',')} ${b.edges.length}`;
      }),
    )
    .toBe('text,file 1');
  await expect(list(page).locator('.card').first()).toContainText('Board · 2 cards');
});

test('footnotes in a book: numbers run on from chapter to chapter', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('Book');
  await page.keyboard.press('Enter');
  await page.getByLabel('Chapter title').fill('One');
  await page.keyboard.press('Enter');
  await page.keyboard.type('First');
  await page.keyboard.press('Control+Alt+f');
  await page.keyboard.type('A note.');
  await page.keyboard.press('Enter');
  await page.keyboard.type(' and second');
  await page.keyboard.press('Control+Alt+f');
  await page.keyboard.type('Another.');
  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    const s = (window as unknown as { crumpet: { getState(): { projects: { id: string }[] }; addChapter(id: string): { id: string }; selectChapter(id: string): void } }).crumpet;
    s.selectChapter(s.addChapter(s.getState().projects[0].id).id);
  });
  await page.getByLabel('Chapter title').fill('Two');
  await page.getByLabel('Chapter text').click();
  await page.keyboard.type('Third');
  await page.keyboard.press('Control+Alt+f');
  // The card, the number in the text and the page's footnotes all say 3.
  await expect(page.getByRole('dialog', { name: 'Footnote 3' })).toBeVisible();
  await page.keyboard.type('The last.');
  await page.keyboard.press('Enter');
  await expect(page.locator('.note-editor sup.fn')).toHaveAttribute('data-n', '3');
  await expect(page.locator('.page-note sup')).toHaveText(['3']);
  // In the manuscript, each chapter carries on.
  await page.getByRole('button', { name: 'Manuscript', exact: true }).click();
  await expect(page.locator('.ms-chapter sup.fn')).toHaveCount(3);
  const numbers = await page.locator('.ms-chapter sup.fn').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.n));
  expect(numbers).toEqual(['1', '2', '3']);
  await expect(page.locator('.page-note sup')).toHaveText(['1', '2', '3']);
});

test('reminders: set from the bell, listed under Reminders, and a message when one comes due', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 9, 10, 0) });
  await open(page);
  await newNote(page, 'Call Ann', 'About the boat.');
  const bell = page.getByRole('button', { name: 'Add a reminder' });
  await bell.click();
  await page.getByRole('dialog', { name: 'Reminder' }).getByRole('button', { name: /^Later today/ }).click();
  await expect(page.getByRole('button', { name: /^Reminder: Today, 1:00/ })).toBeVisible();
  // The sidebar's Reminders, grouped by when.
  await sidebar(page).getByRole('button', { name: /^Reminders/ }).click();
  await expect(list(page)).toContainText('Today');
  await expect(list(page).locator('.card-reminder')).toContainText('Today, 1:00');
  // Three hours on, it comes due: a message, with Done.
  await page.clock.runFor(3 * 60 * 60_000 + 20_000);
  const alerts = page.getByRole('region', { name: 'Reminders due' });
  await expect(alerts).toContainText('Call Ann');
  await alerts.getByRole('button', { name: 'Done' }).click();
  await expect(alerts).toHaveCount(0);
  await expect(list(page)).toContainText('Done');
  await expect(list(page).locator('.card-reminder')).toHaveClass(/done/);
  // A date and time of your own, then off again.
  await page.getByRole('button', { name: /^Reminder: / }).click();
  await page.getByLabel('Reminder date and time').fill('2026-12-24T18:30');
  await page.getByRole('dialog', { name: 'Reminder' }).getByRole('button', { name: 'Set' }).click();
  await expect(page.getByRole('button', { name: /^Reminder: Thu,? 24 Dec|^Reminder: Thu,? Dec 24/ })).toBeVisible();
  await page.getByRole('button', { name: /^Reminder: / }).click();
  await page.getByRole('button', { name: 'Remove reminder' }).click();
  await expect(page.getByRole('button', { name: 'Add a reminder' })).toBeVisible();
});

test('on an iPhone: the Home Screen guide, no zooming into boxes, and swiping in from the edge to go back', async ({ browser }) => {
  const { devices } = await import('@playwright/test');
  const { defaultBrowserType: _, ...iphone } = devices['iPhone 14'];
  const context = await browser.newContext(iphone);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Notes', exact: true })).toBeVisible();
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /maximum-scale=1/);
  const guide = page.getByRole('dialog', { name: 'Add Crumpet to your Home Screen' });
  await expect(guide).toContainText('Add to Home Screen');
  await guide.getByRole('button', { name: 'Got it' }).click();
  await expect(guide).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { crumpet: { createNote(n: object): unknown } }).crumpet.createNote({ title: 'Harbour' }));
  await page.locator('.card', { hasText: 'Harbour' }).click();
  await expect(page.locator('.app')).toHaveAttribute('data-pane', 'note');
  const cdp = await context.newCDPSession(page);
  const touch = (type: string, x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type: type as 'touchStart', touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', 8, 400);
  for (let x = 30; x <= 270; x += 30) await touch('touchMove', x, 404);
  await touch('touchEnd', 270, 404);
  await expect(page.locator('.app')).toHaveAttribute('data-pane', 'list');
  // Put away, it stays away.
  await page.reload();
  await expect(page.getByRole('region', { name: 'Notes', exact: true })).toBeVisible();
  await expect(guide).toHaveCount(0);
  await context.close();
});

test('AutoCorrect: curly quotes, dashes, typos and capitals as you type; Ctrl+Z takes one back; each can be turned off', async ({ page }) => {
  await open(page);
  await newNote(page, 'Corrected', 'she said "teh end"--then... (c) i agree.');
  const editor = page.locator('.note-editor');
  await expect(editor).toContainText('She said “the end”—then… © I agree.');
  // Ctrl+Z straight after a correction takes back just that.
  await page.keyboard.type(' ok "');
  await expect(editor).toContainText('I agree. Ok “');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(editor).toContainText('I agree. Ok "');
  // Turned off in Settings → Writing, with a replacement of your own.
  await sidebar(page).locator('.account').click();
  await page.getByRole('tab', { name: 'Writing' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByLabel('“Curly” quotes and apostrophes').uncheck();
  await settings.getByLabel('Replace', { exact: true }).fill('lizzy');
  await settings.getByLabel('With', { exact: true }).fill('Elizabeth');
  await settings.getByRole('button', { name: 'Add replacement' }).click();
  await expect(settings).toContainText('Elizabeth');
  await page.keyboard.press('Escape');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' lizzy\'s "x" ');
  await expect(editor).toContainText('Elizabeth\'s "x"');
});

test('show/hide ¶: dots for spaces and a ¶ at each paragraph end, from the bar or Ctrl+Shift+8', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Marks', 'One two');
  const editor = page.locator('.note-editor');
  await expect(editor.locator('.mk-sp')).toHaveCount(0);
  await (await toolButton(page, /Show\/hide ¶|Show formatting marks/)).click();
  await expect(editor).toHaveClass(/show-marks/);
  await expect(editor.locator('.mk-sp')).toHaveCount(1);
  const pilcrow = await editor.locator('.blk .text').first().evaluate((el) => getComputedStyle(el, '::after').content);
  expect(pilcrow).toBe('"¶"');
  // The text itself is unchanged, and typing still works.
  await editor.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' three');
  await expect(editor.locator('.mk-sp')).toHaveCount(2);
  await expect(editor).toContainText('One two three');
  await page.keyboard.press('ControlOrMeta+Shift+8');
  await expect(editor).not.toHaveClass(/show-marks/);
  await expect(editor.locator('.mk-sp')).toHaveCount(0);
});

test('drop cap, a blank page, and a date that updates itself', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Opening', 'Once upon a time there was a lighthouse on a rock, and a keeper who kept its lamp lit every night of the year.');
  const editor = page.locator('.note-editor');
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc) as string;
    });
  // Drop cap: the first letter three lines tall.
  await (await toolButton(page, 'Drop cap')).click();
  await page.getByRole('menuitemradio', { name: 'Dropped, 3 lines tall' }).click();
  await expect(editor.locator('.blk').first()).toHaveAttribute('data-drop', '3');
  await expect.poll(md).toContain('{drop=3}');
  // A date that updates: a field, saved as {{date}}, showing today.
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Written on ');
  await (await toolButton(page, 'Insert date and time')).click();
  await page.getByLabel('Update automatically').check();
  const today = await page.evaluate(() => new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }));
  await page.locator('.menu-item', { hasText: today }).first().click();
  await expect(editor.locator('span.fld')).toHaveAttribute('data-v', today);
  await expect.poll(md).toContain('Written on {{date}}');
  // A blank page: the text after the caret moves on past an empty page.
  await editor.locator('.blk').first().click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('End');
  await (await toolButton(page, /Blank page/)).click();
  await expect.poll(md).toMatch(/lit every night of the year\. \{drop=3\}\n\n&nbsp; \{\.pagebreak\}\n\n&nbsp; \{\.pagebreak\}\n\nWritten on \{\{date\}\}/);
});

test('tab stops: Tab types a tab, set stops in the Tabs window or on the ruler, right tabs with dot leaders', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Contents', 'Chapter one');
  await page.keyboard.press('Tab');
  await page.keyboard.type('7');
  const blk = page.locator('.note-editor .blk').first();
  // Where the text after the tab starts and ends, in px from the paragraph's left edge.
  const after = () =>
    blk.evaluate((el) => {
      const tab = el.querySelector('span.tb')!;
      const r = document.createRange();
      r.setStartAfter(tab);
      r.setEnd(el.querySelector('.text')!, el.querySelector('.text')!.childNodes.length);
      const box = r.getBoundingClientRect();
      const left = el.getBoundingClientRect().left;
      return { start: Math.round(box.left - left), end: Math.round(box.right - left) };
    });
  // No stops of its own: the next half inch.
  await expect.poll(async () => (await after()).start % 48).toBe(0);
  // A right tab stop at 3 inches with dots, from Paragraph settings → Tabs….
  await (await toolButton(page, /Paragraph settings/)).click();
  await page.getByRole('dialog', { name: 'Paragraph' }).getByRole('button', { name: 'Tabs…' }).click();
  const tabs = page.getByRole('dialog', { name: 'Tabs' });
  await tabs.getByLabel('Tab stop position').fill('3');
  await tabs.getByLabel('Right').check();
  await tabs.getByLabel('Leader dots').check();
  await tabs.getByRole('button', { name: 'Set' }).click();
  await expect(tabs.getByRole('list', { name: 'Tab stops' })).toContainText('3″');
  await tabs.getByRole('button', { name: 'OK' }).click();
  await expect.poll(async () => Math.abs((await after()).end - 288)).toBeLessThan(2);
  await expect(blk.locator('span.tb')).toHaveAttribute('data-leader', 'dot');
  // On the ruler (page view): a click sets a left tab stop there.
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ pageView: { notes: true }, ruler: true }));
  await blk.click();
  const ruler = page.locator('.ruler');
  await expect(ruler.getByRole('button', { name: 'Right tab stop at 3 inches' })).toBeVisible();
  const geo = await ruler.evaluate((el) => {
    const inch = el.querySelectorAll<HTMLElement>('.tick.inch');
    const r = el.getBoundingClientRect();
    // The 0 mark is the left margin; find it among the inch ticks (the one with no number).
    const zero = Array.from(inch).find((t) => !t.textContent)!;
    return { zero: zero.getBoundingClientRect().left, ppi: inch[2].getBoundingClientRect().left - inch[1].getBoundingClientRect().left, y: r.top + r.height / 2 };
  });
  await page.mouse.click(geo.zero + geo.ppi * 1.5 + 1, geo.y);
  await expect(ruler.getByRole('button', { name: 'Left tab stop at 1.5 inches' })).toBeVisible();
  const md = await page.evaluate(async () => {
    const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
    return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc) as string;
  });
  expect(md).toContain('Chapter one&#9;7 {tabs=1.5,r3dot}');
});

test('Go To (F5): pages, headings, footnotes and comments by number or one by one; next and previous footnote', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.evaluate(async () => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { createNote(p: object): { id: string }; select(id: string): void } }).crumpet;
    const doc = `# One\n\nFirst^[Note A] words.\n\n# Two\n\nSecond^[Note B] and {==this==}{>>Ann: a comment<<}.\n\n# Three\n\nThird^[Note C]. {.pagebreak}\n\nLast page.`;
    s.select(s.createNote({ title: 'Places', doc: md.fromMarkdown(doc) }).id);
  });
  const editor = page.locator('.note-editor');
  await editor.locator('.blk').first().click();
  const caretBlock = () => page.evaluate(() => (window.getSelection()?.anchorNode?.parentElement?.closest('[data-block]') as HTMLElement | null)?.textContent ?? '');
  await page.keyboard.press('F5');
  const go = page.getByRole('dialog', { name: 'Go to' });
  // Not in page view: no page numbers, so it starts on headings.
  await expect(go.getByRole('radio', { name: 'Page' })).toBeDisabled();
  await expect(go.getByRole('radio', { name: 'Heading' })).toHaveAttribute('aria-checked', 'true');
  await go.getByLabel('Heading number').fill('3');
  await go.getByRole('button', { name: 'Go to', exact: true }).click();
  await expect(go).toHaveCount(0);
  await expect.poll(caretBlock).toBe('Three');
  // Footnotes one by one, from the palette and the list under the note.
  await page.keyboard.press('Control+p');
  await page.keyboard.type('previous footnote');
  await page.keyboard.press('Enter');
  await expect.poll(caretBlock).toContain('Second');
  await page.getByRole('region', { name: 'Footnotes' }).getByRole('button', { name: 'Previous footnote' }).click();
  await expect.poll(caretBlock).toContain('First');
  await page.getByRole('region', { name: 'Footnotes' }).getByRole('button', { name: 'Next footnote' }).click();
  await expect.poll(caretBlock).toContain('Second');
  // Comments, and a number too big.
  await page.keyboard.press('F5');
  await go.getByRole('radio', { name: 'Comment' }).click();
  await go.getByLabel('Comment number').fill('4');
  await go.getByRole('button', { name: 'Go to', exact: true }).click();
  await expect(go.getByRole('status')).toHaveText('There is 1 comment.');
  await page.keyboard.press('Escape');
  // Pages, in page view: from the page number in the status bar.
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ pageView: { notes: true } }));
  await expect(editor.locator('.pg')).toHaveCount(2);
  await page.getByRole('group', { name: 'Page details' }).getByRole('button', { name: 'Page' }).click();
  await go.getByLabel('Page number').fill('2');
  await go.getByRole('button', { name: 'Go to', exact: true }).click();
  await expect.poll(caretBlock).toContain('Third');
});

test('spelling: your dictionary and characters’ names are never marked, a language, and the check turned off', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: { getState(): { projects: { id: string }[] }; addCastMember(p: string, k: string, n: string): { id: string }; updateCastMember(p: string, id: string, patch: object): void } }).crumpet;
    const p = c.getState().projects[0];
    const m = c.addCastMember(p.id, 'character', 'Maraweth Quill');
    c.updateCastMember(p.id, m.id, { aliases: ['Mazz'] });
  });
  const editor = page.locator('.note-editor');
  await editor.locator('.blk').first().click();
  await page.keyboard.type('Maraweth met Mazz by the zorbleck.');
  await expect(editor.locator('.nosp')).toHaveText(['Maraweth', 'Mazz']);
  await expect(editor.locator('.nosp').first()).toHaveAttribute('spellcheck', 'false');
  // A word of your own, from the command palette with the caret on it.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Control+p');
  await page.keyboard.type('add zorbleck');
  await page.keyboard.press('Enter');
  await expect(editor.locator('.nosp')).toHaveText(['Maraweth', 'Mazz', 'zorbleck']);
  // Settings: the word is listed; a language; then the check off.
  await sidebar(page).getByRole('button', { name: 'Show the sidebar' }).click();
  await sidebar(page).locator('.account').click();
  await page.getByRole('tab', { name: 'Writing' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings.getByRole('group', { name: 'Your dictionary' })).toContainText('zorbleck');
  await settings.getByLabel('Language').selectOption('en-GB');
  await expect(editor).toHaveAttribute('lang', 'en-GB');
  await settings.getByLabel('Check spelling as you type').uncheck();
  await expect(editor).toHaveAttribute('spellcheck', 'false');
});

/** A plain 400×200 picture, served at https://pics.example/… in the tests that need one. */
const PICTURE = 'iVBORw0KGgoAAAANSUhEUgAAAZAAAADICAIAAABJdyC1AAACBUlEQVR42u3UMQ0AAAgEsVeHMDQhEBUMJE2q4IZL9QC8EAkAwwIwLMCwAAwLwLAAwwIwLADDAgwLwLAADAswLADDAjAswLAADAvAsADDAjAsAMMCDAvAsAAMCzAsAMMCMCzAsAAMCzAsFQDDAjAswLAADAvAsADDAjAsAMMCDAvAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwAwwIMC8CwAAwLMCwAwwIwLMCwAAwLMCwVAMMCMCzAsAAMC8CwAMMCMCwAwwIMC8CwAAwLMCwAwwIwLMCwAAwLwLAAwwIwLADDAgwLwLAADAswLADDAjAswLAADAswLADDAjAswLAADAvAsADDAjAsAMMCDAvAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwAwwIMC8CwAAwLMCwAwwIwLMCwAAwLMCwAwwIwLMCwAAwLwLAAwwIwLADDAgwLwLAADAswLADDAjAswLAADAvAsADDAjAsAMMCDAvAsAAMCzAsAMMCMCzAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwAwwIMC8CwAAwLMCwAwwIwLMCwAAwLwLAAwwIwLADDAgwLwLAADAswLADDAjAswLAADAswLADDAjAswLAADAvAsADDAjAsAMMCDAvAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwAwwIMC8CwAAwLMCyAOwubCPkie7TR8wAAAABJRU5ErkJggg==';

async function notePicture(page: Page, md: string) {
  await page.route('https://pics.example/**', (r) => r.fulfill({ contentType: 'image/png', body: (globalThis as unknown as { Buffer: { from(s: string, e: string): Uint8Array } }).Buffer.from(PICTURE, 'base64') as never }));
  await page.evaluate(async (text) => {
    const m = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { createNote(p: object): { id: string }; select(id: string): void } }).crumpet;
    s.select(s.createNote({ title: 'Pictures', doc: m.fromMarkdown(text) }).id);
  }, md);
}

async function noteMarkdown(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
    return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc) as string;
  });
}

test('pictures: resize from the corner, wrap text round, move in front, turn, alt text and reset', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1500, height: 950 });
  await notePicture(page, '![A gull](https://pics.example/gull.png)\n\nThe harbour was quiet that morning, and the gulls stood on every post along the wall, looking out to sea as if they were waiting for someone to come home.');
  const blk = page.locator('.note-editor .blk-image');
  const img = blk.locator('img');
  await expect(img).toHaveJSProperty('complete', true);
  // Drag the corner: 1.5 inches narrower.
  await img.hover();
  const grip = blk.locator('.pic-grip');
  const box = (await grip.boundingBox())!;
  const before = (await img.boundingBox())!.width;
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + 5 - 144, box.y + 5, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => noteMarkdown(page)).toMatch(/\{pic w=2\.67\}/);
  expect(Math.round((await img.boundingBox())!.width)).toBe(Math.round(before - 144));
  // The menu: text wraps round it on the right.
  await img.hover();
  await blk.getByRole('button', { name: 'Picture ▾' }).click();
  await blk.getByRole('button', { name: 'Square, on the right' }).click();
  await expect(blk).toHaveAttribute('data-wrap', 'right');
  await expect(blk).toHaveCSS('float', 'right');
  // Turn it, and give it alt text of its own.
  await img.hover();
  await blk.getByRole('button', { name: 'Picture ▾' }).click();
  await blk.getByRole('button', { name: 'Right 90°' }).click();
  await img.hover();
  await blk.getByRole('button', { name: 'Picture ▾' }).click();
  await blk.getByRole('button', { name: 'Alt text…' }).click();
  const alt = page.getByRole('dialog', { name: 'Alt text' });
  await alt.getByLabel('Describe the picture').fill('A gull on a post');
  await alt.getByRole('button', { name: 'OK' }).click();
  await expect(img).toHaveAttribute('alt', 'A gull on a post');
  await expect.poll(() => noteMarkdown(page)).toContain('{pic w=2.67 wrap=right rot=90 alt="A gull on a post"}');
  // In front of the text, dragged by ✥.
  await img.hover();
  await blk.getByRole('button', { name: 'Picture ▾' }).click();
  await blk.getByRole('button', { name: 'In front of text' }).click();
  await img.hover();
  const mv = (await blk.locator('.pic-move').boundingBox())!;
  await page.mouse.move(mv.x + 10, mv.y + 10);
  await page.mouse.down();
  await page.mouse.move(mv.x + 10 + 96, mv.y + 10 + 48, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => noteMarkdown(page)).toMatch(/wrap=free x=(0.99|1|1.01) y=0.(49|5|51) rot=90/);
  // Reset: back to how it was put in, keeping the alt text.
  await img.hover();
  await blk.getByRole('button', { name: 'Picture ▾' }).click();
  await blk.getByRole('button', { name: 'Reset picture' }).click();
  await expect.poll(() => noteMarkdown(page)).toContain('![A gull](https://pics.example/gull.png) {pic alt="A gull on a post"}');
});

test('pictures: crop by dragging an edge, to a ratio and a shape; styles; corrections and effects', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1500, height: 950 });
  await notePicture(page, '![A gull](https://pics.example/gull.png)\n\nAfter the picture.');
  const blk = page.locator('.note-editor .blk-image');
  const img = blk.locator('img');
  await expect(img).toHaveJSProperty('complete', true);
  const menu = async (name: string) => {
    await img.hover();
    await blk.getByRole('button', { name: 'Picture ▾' }).click();
    await blk.getByRole('button', { name, exact: true }).click();
  };
  // Crop: drag the left edge an inch in. The picture keeps its scale; its window is an inch narrower.
  await menu('Crop');
  await expect(blk).toHaveClass(/cropping/);
  const edge = (await blk.locator('.pic-crop-h.l').boundingBox())!;
  await page.mouse.move(edge.x + 3, edge.y + 10);
  await page.mouse.down();
  await page.mouse.move(edge.x + 3 + 96, edge.y + 10, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => noteMarkdown(page)).toMatch(/\{pic w=3\.1[67] crop=0,0,0,0\.24\d?\}/);
  await expect.poll(async () => Math.abs((await blk.locator('.pic-crop').boundingBox())!.width - 304)).toBeLessThan(2);
  // Clicking elsewhere ends cropping.
  await page.locator('.note-editor').getByText('After the picture.', { exact: true }).click();
  await expect(blk).not.toHaveClass(/cropping/);
  // Square, then oval, then a shadow.
  await menu('Square');
  await expect.poll(() => noteMarkdown(page)).toMatch(/crop=0,0\.25,0,0\.25/);
  await expect.poll(async () => { const b = (await blk.locator('.pic-crop').boundingBox())!; return Math.abs(b.width - b.height) < 2; }).toBe(true);
  await menu('Oval');
  await expect(blk.locator('.pic-crop')).toHaveCSS('clip-path', /ellipse/);
  await menu('Shadow');
  await expect(blk.locator('.pic-box')).toHaveAttribute('data-style', 'shadow');
  // Corrections and effects: brighter, black and white, a red border.
  await menu('Corrections and effects…');
  const fmt = page.getByRole('dialog', { name: 'Corrections and effects' });
  await fmt.getByLabel(/Brightness/).fill('30');
  await fmt.getByRole('button', { name: 'Black and white' }).click();
  await fmt.getByRole('button', { name: 'Red' }).click();
  await fmt.getByRole('button', { name: 'OK' }).click();
  await expect(img).toHaveCSS('filter', 'brightness(1.3) grayscale(1)');
  await expect.poll(() => noteMarkdown(page)).toMatch(/mask=oval style=shadow border=#c0392b bright=30 effect=grey/);
  await menu('Remove crop');
  await expect.poll(() => noteMarkdown(page)).not.toContain('crop=');
});

test('pictures: remove a plain background, compress, and reset back to the original file', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1500, height: 950 });
  // A red square on a pale background, 300×200.
  const square = 'iVBORw0KGgoAAAANSUhEUgAAASwAAADICAIAAADdvUsCAAACbElEQVR42u3TMQ0AMAhEUZTgX0rlsLDXQsNCh5d8BZd70V2SFgsTSBBKEEqCUIJQEoQShJIglCCUBKEEoSQIJQglQShBKAlCCUJJEEoQSoJQglAShBKEkiCUIJQEoQShJAglCCVBKEEoCUIJQkkQShBKglCCUBKEEoSSIJQglAShBKEkCCUIJUEoQSgJQglCSRBKEEqCUIJQEoQShJIglCCUBKEEoSQIR51MPeYtEEIIIYQQQigIIYQQQgghFIQQQgghhBAKQgghhBBCCAUhhBBCCCGEghBCCCGEEEJBCCGEEEIIoSCEEEIIIYRQEEIIIYQQQigIIYQQQgghFIQQQgghhBBCaAUIIYQQQgghFIQQQgghhBAKQgghhBBCCAUhhBBCCCGEghBCCCGEEEJBCCGEEEIIoSCEEEIIIYRQEEIIIYQQQigIIYQQQgghFIQQQgghhBAKQgghhBBCCCEUhBBCCCGEEApCCCGEEEIIBSGEEEIIIYSCEEIIIYQQQkEIIYQQQgihIIQQQgghhFAQQgghhBBCKAghhBBCCCEUhBBCCCGEEApCCCGEEEIIIXQYCCGEEEIIIRSEEEIIIYQQCkIIIYQQQggFIYQQQgghhIIQQgghhBBCQQghhBBCCKEghBBCCCGEUBBKEEqCUIJQEoQShJIglCCUILSCBKEEoSQIJQglQShBKAlCCUJJEEoQSoJQglAShBKEkiCUIJQEoQShJAglCCVBKEEoCUIJQkkQShBKglCCUBKEEoSSIJQglAShBKEkCCUIJUEoQSgJQglCSRBKEEqCUIJQEoQShJIglCCUBKEEoSQIpU+7Ol4aDrYiqsYAAAAASUVORK5CYII=';
  await page.route('https://pics.example/**', (r) => r.fulfill({ contentType: 'image/png', body: (globalThis as unknown as { Buffer: { from(s: string, e: string): Uint8Array } }).Buffer.from(square, 'base64') as never }));
  await page.evaluate(async () => {
    const m = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { createNote(p: object): { id: string }; select(id: string): void } }).crumpet;
    s.select(s.createNote({ title: 'Square', doc: m.fromMarkdown('![Square](https://pics.example/square.png) {pic w=1}') }).id);
  });
  const blk = page.locator('.note-editor .blk-image');
  const img = blk.locator('img');
  await expect(img).toHaveJSProperty('complete', true);
  const menu = async (name: string) => {
    await img.hover();
    await blk.getByRole('button', { name: 'Picture ▾' }).click();
    await blk.getByRole('button', { name, exact: true }).click();
  };
  /** The see-through-ness (alpha) of the picture's pixel at x, y, as it's drawn from its file. */
  const alphaAt = (x: number, y: number) =>
    img.evaluate(async (el: HTMLImageElement, [px, py]) => {
      const i = new Image();
      i.src = el.src;
      await i.decode();
      const c = document.createElement('canvas');
      c.width = i.naturalWidth;
      c.height = i.naturalHeight;
      const g = c.getContext('2d')!;
      g.drawImage(i, 0, 0);
      return g.getImageData(Math.round(px * i.naturalWidth), Math.round(py * i.naturalHeight), 1, 1).data[3];
    }, [x, y]);
  await menu('Remove background…');
  const dlg = page.getByRole('dialog', { name: 'Remove background' });
  await expect(dlg.getByLabel('Preview')).toBeVisible();
  await dlg.getByRole('button', { name: 'Remove background' }).click();
  await expect(dlg).toHaveCount(0);
  await expect.poll(() => noteMarkdown(page)).toMatch(/!\[Square\]\(Attachments\/[a-z0-9]{7}-square-cut-out\.png\) \{pic w=1 orig="https:\/\/pics\.example\/square\.png"\}/);
  await expect(img).toHaveJSProperty('complete', true);
  expect(await alphaAt(0.05, 0.05)).toBe(0);
  expect(await alphaAt(0.5, 0.5)).toBe(255);
  // Compress for email: one inch wide at 96 pixels an inch.
  await menu('Compress…');
  const cmp = page.getByRole('dialog', { name: 'Compress picture' });
  await cmp.getByLabel(/Email/).check();
  await cmp.getByRole('button', { name: 'Compress' }).click();
  await expect(cmp).toHaveCount(0);
  await expect.poll(() => noteMarkdown(page)).toMatch(/-square-cut-out-small\.png\) \{pic w=1 orig="https:\/\/pics\.example\/square\.png"\}/);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(96);
  // Reset: the original file again.
  await menu('Reset picture');
  await expect.poll(() => noteMarkdown(page)).toBe('![Square](https://pics.example/square.png)\n');
});

test('reviewing pane: every change and comment with who and when, previous and next, markup views', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.evaluate(async () => {
    const m = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { createNote(p: object): { id: string }; select(id: string): void; updateLayout(p: object): void } }).crumpet;
    const md = 'The {--big--}{>>Ann (2026-10-01 09:00Z)<<}{++wide++}{>>Ann (2026-10-01 09:01Z)<<} sea.\n\nThe {==lighthouse==}{>>Ben (2026-10-02 10:00Z): Which one?<<} stood.\n\nAnd {++then night came++}{>>Ben (2026-10-02 10:05Z)<<}.';
    s.select(s.createNote({ title: 'Review', doc: m.fromMarkdown(md) }).id);
    s.updateLayout({ right: true, rightTab: 'comments' });
  });
  const pane = page.getByRole('tabpanel', { name: 'Review' });
  const items = pane.getByRole('list', { name: 'Changes and comments' }).locator('.review-item');
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText('Ann deleted');
  await expect(items.nth(0)).toContainText('big');
  await expect(items.nth(1)).toContainText('Ann added');
  await expect(items.nth(2)).toContainText('Ben commented');
  await expect(items.nth(2)).toContainText('Which one?');
  await expect(items.nth(3)).toContainText('then night came');
  await expect(pane).toContainText('3 changes');
  await expect(pane).toContainText('1 comment');
  // Next change, from the top.
  const editor = page.locator('.note-editor');
  await editor.locator('.blk').first().click();
  await page.keyboard.press('ControlOrMeta+Home');
  const caretText = () => page.evaluate(() => (window.getSelection()?.anchorNode?.parentElement?.closest('[data-block]') as HTMLElement | null)?.textContent ?? '');
  await pane.getByRole('button', { name: 'Next change' }).click();
  await pane.getByRole('button', { name: 'Next change' }).click();
  await pane.getByRole('button', { name: 'Next change' }).click();
  await expect.poll(caretText).toContain('then night came');
  // Markup views.
  await pane.getByLabel('Markup view').selectOption('none');
  await expect(editor).toHaveAttribute('data-markup', 'none');
  await expect(editor.locator('del.trk').first()).toBeHidden();
  await pane.getByLabel('Markup view').selectOption('original');
  await expect(editor.locator('ins.trk').first()).toBeHidden();
  await expect(editor.locator('del.trk').first()).toBeVisible();
  await pane.getByLabel('Markup view').selectOption('simple');
  await expect(editor.locator('.blk').first()).toHaveCSS('box-shadow', /192, 57, 43/);
  await pane.getByLabel('Markup view').selectOption('all');
  await expect(editor).not.toHaveAttribute('data-markup');
  // Accept one from the pane, reject the rest.
  await items.nth(3).getByRole('button', { name: 'Accept' }).click();
  await expect(items).toHaveCount(3);
  await pane.getByRole('button', { name: 'Reject all' }).click();
  await expect(items).toHaveCount(1);
  await expect(editor.locator('.blk').first()).toHaveText('The big sea.');
});

test('track changes for everyone, locked with a password; show markup by person; @ names in comments', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(s: object): void } }).crumpet.updateSettings({ name: 'Robin' }));
  await page.evaluate(async () => {
    const m = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { createNote(p: object): { id: string }; select(id: string): void } }).crumpet;
    const md = 'The {++wide++}{>>Ann (2026-10-01 09:00Z)<<} sea and the {++grey++}{>>Ben (2026-10-01 09:00Z)<<} sky.\n\nThe {==lamp==}{>>Ann (2026-10-02 10:00Z): Lit?<<} burned.';
    s.select(s.createNote({ title: 'Locked', doc: m.fromMarkdown(md) }).id);
  });
  const editor = page.locator('.note-editor');
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc) as string;
    });
  // Everyone's changes, saved in the note; then locked.
  await page.getByRole('button', { name: 'Tracking options' }).click();
  await page.getByRole('menuitemradio', { name: /Everyone/ }).click();
  await expect(page.getByRole('button', { name: 'Tracking for everyone' })).toBeVisible();
  await expect.poll(md).toMatch(/sky\. \{track=all\}\n/);
  await page.getByRole('button', { name: 'Tracking for everyone' }).click();
  await page.getByRole('button', { name: 'Lock tracking…' }).click();
  await page.getByLabel('Password', { exact: true }).fill('gull');
  await page.getByLabel('Password again').fill('gull');
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await expect(page.getByRole('button', { name: /🔒 Tracking for everyone/ })).toBeVisible();
  await expect.poll(md).toMatch(/\{track=all lock=[0-9a-f]{80}\}/);
  // Typing is tracked; accepting isn't allowed while it's locked.
  await editor.locator('.blk').nth(1).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Late.');
  await expect(editor.locator('ins.trk[data-author="Robin"]')).toHaveText(' Late.');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('region', { name: 'Tracked changes' }).getByRole('button', { name: 'Accept all' }).click();
  await expect(editor.locator('ins.trk')).toHaveCount(3);
  // The wrong password doesn't unlock it; the right one does.
  await page.getByRole('button', { name: /Tracking for everyone/ }).click();
  await page.getByRole('button', { name: 'Unlock tracking…' }).click();
  await page.getByLabel('Password', { exact: true }).fill('tern');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText('That isn’t the password.')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('gull');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('button', { name: 'Tracking for everyone' })).toBeVisible();
  await expect.poll(md).toMatch(/\{track=all\}/);
  // Show markup: hide Ben's.
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ right: true, rightTab: 'comments' }));
  const pane = page.getByRole('tabpanel', { name: 'Review' });
  await pane.getByRole('button', { name: /Show markup/ }).click();
  await pane.getByRole('group', { name: 'Show markup' }).getByLabel('Ben').uncheck();
  await expect(editor.locator('ins.trk[data-author="Ben"]')).toHaveCSS('text-decoration-line', 'none');
  await expect(editor.locator('ins.trk[data-author="Ann"]')).toHaveCSS('text-decoration-line', 'underline');
  await expect(pane.locator('.review-item')).toHaveCount(3);
  // @ names: suggested, and picked out.
  await editor.locator('mark.cmt').click();
  const thread = page.getByRole('dialog', { name: 'Comment' });
  await thread.getByRole('textbox', { name: 'Reply' }).fill('');
  await thread.getByRole('textbox', { name: 'Reply' }).type('Yes, @A');
  await expect(thread.getByRole('listbox', { name: 'People' })).toContainText('@Ann');
  await page.keyboard.press('Enter');
  await page.keyboard.type('it was.');
  await thread.getByRole('button', { name: 'Reply' }).click();
  await expect(thread.locator('.mention')).toHaveText('@Ann');
  await expect.poll(md).toContain('Robin (');
  await expect.poll(md).toContain('Yes, @Ann it was.');
});

test('combine reviewers’ copies: each reviewer’s changes tracked in their name', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.evaluate(async () => {
    const m = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: { createNote(p: object): { id: string }; select(id: string): void } }).crumpet;
    s.createNote({ title: 'Draft (Ann)', doc: m.fromMarkdown('The wide sea was grey.') });
    s.createNote({ title: 'Draft (Ben)', doc: m.fromMarkdown('The big sea was grey and cold.') });
    s.select(s.createNote({ title: 'Draft', doc: m.fromMarkdown('The big sea was grey.') }).id);
  });
  await page.locator('.note-editor').click();
  await page.keyboard.press('Control+p');
  await page.keyboard.type('combine');
  await page.keyboard.press('Enter');
  const dlg = page.getByRole('dialog', { name: 'Combine reviewers’ copies' });
  await dlg.getByLabel('Draft (Ann)').check();
  await dlg.getByLabel('Reviewer of Draft (Ann)').fill('Ann');
  await dlg.getByLabel('Draft (Ben)').check();
  await dlg.getByLabel('Reviewer of Draft (Ben)').fill('Ben');
  await dlg.getByRole('button', { name: 'Combine' }).click();
  const pane = page.getByRole('region', { name: 'Pane' });
  await expect(pane.getByLabel('Title')).toHaveValue('Draft (combined)');
  const ed = pane.locator('.note-editor');
  await expect(ed.locator('del.trk[data-author="Ann"]')).toHaveText('big');
  await expect(ed.locator('ins.trk[data-author="Ann"]')).toHaveText('wide');
  await expect(ed.locator('ins.trk[data-author="Ben"]')).toHaveText(' and cold');
});

test('Font window: small caps, a wavy coloured underline, spacing and hidden text; text effects', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Fonts', 'The lighthouse keeper');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.press('Control+d');
  const dlg = page.getByRole('dialog', { name: 'Font' });
  await dlg.getByLabel('Small caps').check();
  await dlg.getByLabel('Underline style').selectOption('wavy');
  await dlg.getByLabel('Underline colour').fill('#c0392b');
  await dlg.getByRole('tab', { name: 'Advanced' }).click();
  await dlg.getByLabel('Spacing', { exact: true }).selectOption('expanded');
  await dlg.getByLabel('Spacing by').fill('2');
  await dlg.getByLabel('Number forms').selectOption('oldstyle');
  await dlg.getByRole('button', { name: 'OK' }).click();
  const span = page.locator('.note-editor .lk').first();
  await expect(span).toHaveCSS('font-variant-caps', 'small-caps');
  await expect(span).toHaveCSS('text-decoration-style', 'wavy');
  await expect(span).toHaveCSS('letter-spacing', /2\.6|2\.66/);
  const md = () =>
    page.evaluate(async () => {
      const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
      const s = (window as unknown as { crumpet: { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] } } }).crumpet.getState();
      return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc) as string;
    });
  await expect.poll(md).toBe('[The lighthouse keeper]{caps=small ul=wavy ulc=#c0392b sp=2 num=oldstyle}\n');
  // Text effects from the bar: a glow.
  await page.locator('.note-editor').click();
  await page.keyboard.press('Shift+Home');
  await (await toolButton(page, 'Text effects')).click();
  await page.getByRole('menuitemradio', { name: /Glow/ }).click();
  await expect.poll(md).toContain('fx=glow');
  // Hidden text: gone until Show/hide ¶.
  await page.locator('.note-editor').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('A secret note');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.press('Control+d');
  await dlg.getByLabel('Hidden (shown with ¶)').check();
  await dlg.getByRole('button', { name: 'OK' }).click();
  const hidden = page.locator('.note-editor .lk[data-hidden]');
  await expect(hidden).toBeHidden();
  await page.keyboard.press('ControlOrMeta+Shift+8');
  await expect(hidden).toBeVisible();
});

test('paste options after pasting, the clipboard history, and sorting paragraphs', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Pasted', 'Start ');
  const body = page.locator('.note-editor');
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/html', '<b><span style="font-family:Lora;color:#cc0000">bold red</span></b>');
    dt.setData('text/plain', 'bold red');
    document.querySelector('.note-editor')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(body.locator('.lk')).toHaveText('bold red');
  // Merge formatting: still bold, but the look of the text where it went.
  await page.getByRole('button', { name: 'Paste options' }).click();
  await page.getByRole('menuitem', { name: 'Merge formatting' }).click();
  await expect(body.locator('.lk')).toHaveCount(0);
  await expect(body.locator('strong')).toHaveText('bold red');
  // Text only.
  await page.getByRole('button', { name: 'Paste options' }).click();
  await page.getByRole('menuitem', { name: 'Text only' }).click();
  await expect(body.locator('strong')).toHaveCount(0);
  await expect(body).toHaveText('Start bold red');
  // The chip goes once you type on.
  await page.keyboard.type('!');
  await expect(page.getByRole('button', { name: 'Paste options' })).toHaveCount(0);
  // Copy keeps Crumpet's own formatting, and is kept in the Clipboard tab.
  await page.keyboard.press('Enter');
  await page.keyboard.type('pear');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Apple');
  await page.keyboard.press('Enter');
  await page.keyboard.type('banana');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.press('ControlOrMeta+b');
  await page.evaluate(() => {
    const dt = new DataTransfer();
    document.querySelector('.note-editor')!.dispatchEvent(new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true }));
    (window as unknown as { copied: string }).copied = dt.getData('application/x-crumpet-markdown');
  });
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe('**banana**\n');
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ right: true, rightTab: 'clipboard' }));
  const clip = page.getByRole('tabpanel', { name: 'Clipboard' });
  await expect(clip.getByRole('list', { name: 'Copied' }).locator('li')).toHaveText([/banana/]);
  // Paste it again from the Clipboard tab, at the end, with its bold.
  await body.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  await clip.getByRole('button', { name: /banana/ }).click();
  await expect(body.locator('strong')).toHaveCount(2);
  // Sort the last four paragraphs, A to Z.
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('Shift+Home');
  await (await toolButton(page, 'Sort paragraphs…')).click();
  await page.getByRole('dialog', { name: 'Sort paragraphs' }).getByRole('button', { name: 'Sort' }).click();
  await expect(body.locator('.blk')).toHaveText(['Start bold red!', 'Apple', 'banana', 'banana', 'pear']);
});

test('protect: a note with a password, mark as final, restrict editing, and a signature line', async ({ page }) => {
  await open(page);
  await newNote(page, 'Secret', 'Hidden words');
  const editor = page.locator('.note-editor');
  // A password on the note: its text scrambled, opened again with the password.
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /Protect with a password/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Protect with a password' });
  await dialog.getByLabel('New password').fill('swordfish');
  await dialog.getByLabel('Password again').fill('swordfish');
  await dialog.getByRole('button', { name: 'Protect' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(editor).toContainText('Hidden words');
  await editor.getByText('Hidden words').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' and more');
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /Lock now/ }).click();
  const locked = page.getByRole('form', { name: 'Locked note' });
  await expect(locked).toBeVisible();
  await expect(list(page)).toContainText('Protected with a password');
  await expect(list(page)).not.toContainText('Hidden words');
  await locked.getByLabel('Password').fill('nope');
  await locked.getByRole('button', { name: 'Open' }).click();
  await expect(locked).toContainText('That isn’t the password.');
  await locked.getByLabel('Password').fill('swordfish');
  await locked.getByRole('button', { name: 'Open' }).click();
  await expect(editor).toContainText('Hidden words and more');
  // Still locked after a reload.
  await page.reload();
  await list(page).locator('.card', { hasText: 'Secret' }).click();
  await expect(locked).toBeVisible();
  await locked.getByLabel('Password').fill('swordfish');
  await locked.getByRole('button', { name: 'Open' }).click();
  await expect(editor).toContainText('Hidden words and more');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Remove the password' }).click();
  await expect(list(page)).toContainText('Hidden words and more');

  // Mark as final: read only until Edit anyway.
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await editor.getByText('Hidden words').click();
  await (await toolButton(page, 'Protect document')).click();
  await page.getByRole('button', { name: /Mark as final/ }).click();
  const bar = page.getByRole('region', { name: 'Protected document' });
  await expect(bar).toContainText('Marked as final');
  await expect(editor).toHaveAttribute('contenteditable', 'false');
  await bar.getByRole('button', { name: 'Edit anyway' }).click();
  await expect(bar).toHaveCount(0);
  await expect(editor).toHaveAttribute('contenteditable', 'true');

  // Comments only, with a password to stop it.
  await editor.getByText('Hidden words').click();
  await (await toolButton(page, 'Protect document')).click();
  await page.getByRole('button', { name: 'Comments only' }).click();
  await page.getByLabel('Restriction password').fill('pw');
  await page.getByRole('button', { name: 'Start protection' }).click();
  await expect(bar).toContainText('you can add comments');
  await expect(editor).toHaveAttribute('contenteditable', 'false');
  await bar.getByRole('button', { name: 'Stop protection' }).click();
  await bar.getByLabel('Password to stop protection').fill('wrong');
  await bar.getByRole('button', { name: 'Stop protection' }).click();
  await expect(bar).toContainText('That isn’t the password.');
  await bar.getByLabel('Password to stop protection').fill('pw');
  await bar.getByRole('button', { name: 'Stop protection' }).click();
  await expect(bar).toHaveCount(0);

  // A signature line: says when the document has changed since it was signed.
  await editor.getByText('Hidden words').click();
  await page.keyboard.press('End');
  await (await toolButton(page, 'Signature line')).click();
  await page.getByLabel('Signer’s name').fill('Jo Bloggs');
  await page.getByRole('button', { name: 'Sign here' }).click();
  const sig = editor.locator('.blk[data-sig-ok]');
  await expect(sig).toContainText('Jo Bloggs');
  await expect(sig).toHaveAttribute('data-sig-ok', 'yes');
  await editor.getByText('Hidden words').click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect(sig).toHaveAttribute('data-sig-ok', 'no');
});

test('equations: within a line (Alt+=, LaTeX or UnicodeMath), structures over a maths block, and to Word', async ({ page }) => {
  await open(page);
  await newNote(page, 'Maths', 'The area is ');
  const editor = page.locator('.note-editor');
  await page.keyboard.press('Alt+Equal');
  const card = page.getByRole('dialog', { name: 'Equation' });
  await expect(card).toBeVisible();
  await page.keyboard.type('\\pi r^2');
  await expect(card.locator('.math-card-preview .katex')).toBeVisible();
  await card.getByRole('button', { name: 'Done' }).click();
  await expect(editor.locator('span.fld.math-ready')).toHaveCount(1);
  await page.keyboard.type(' and ');
  await page.keyboard.press('Alt+Equal');
  await card.getByRole('button', { name: 'UnicodeMath' }).click();
  await page.keyboard.type('(a+b)/2');
  await page.keyboard.press('Enter');
  await expect(editor.locator('span.fld.math-ready')).toHaveCount(2);
  await expect(editor.locator('span.fld[data-field="math:\\\\frac{a+b}{2}"]')).toHaveCount(1);
  // Click one to change it; then put it on a line of its own.
  await editor.locator('span.fld.math-ready').first().click();
  await expect(card.getByLabel('Equation (LaTeX)')).toHaveValue('\\pi r^2');
  await card.getByLabel('Equation (LaTeX)').fill('\\pi r^{2}');
  await card.getByRole('button', { name: 'Symbols' }).click();
  await card.getByRole('combobox', { name: 'Kind of symbol' }).selectOption({ label: 'Greek letters' });
  await card.getByRole('button', { name: 'theta', exact: true }).click();
  await expect(card.getByLabel('Equation (LaTeX)')).toHaveValue('\\pi r^{2}\\theta');
  await card.getByLabel('Equation (LaTeX)').fill('\\pi r^{2}');
  await card.getByRole('button', { name: 'Done' }).click();
  await expect(editor.locator('span.fld[data-field="math:\\\\pi r^{2}"]')).toHaveCount(1);
  await editor.locator('span.fld[data-field="math:\\\\pi r^{2}"]').click();
  await card.getByRole('button', { name: 'On its own line' }).click();
  await expect(editor.locator('.code-wrap[data-lang="math"]')).toHaveCount(1);
  await expect(editor.locator('span.fld.math-ready')).toHaveCount(1);
  // The structures over a maths block put LaTeX in at the caret.
  const src = editor.locator('.code-src');
  await editor.locator('[data-code-preview]').click();
  await expect(src).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type(' + ');
  const bar = page.getByRole('toolbar', { name: 'Equation' });
  await bar.getByRole('combobox', { name: 'Kind of structure' }).selectOption({ label: 'Radicals' });
  await bar.getByRole('button', { name: 'Square root', exact: true }).click();
  await page.keyboard.type('x');
  await expect(src).toHaveValue('\\pi r^{2} + \\sqrt{x}');
  await bar.getByLabel('UnicodeMath').fill('a/b');
  await bar.getByLabel('UnicodeMath').press('Enter');
  await expect(src).toHaveValue('\\pi r^{2} + \\sqrt{x\\frac{a}{b}}');
  // Word gets real equations.
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download as Word document' }).click()]);
  expect(download.suggestedFilename()).toBe('Maths.docx');
});

test('charts (from the bar or a table), online video and a screenshot', async ({ page }) => {
  // A stand-in for the browser's screen picker: a red canvas.
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
      value: async () => {
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 200;
        const g = c.getContext('2d')!;
        g.fillStyle = '#c00';
        g.fillRect(0, 0, 320, 200);
        const stream = c.captureStream(10);
        setInterval(() => g.fillRect(0, 0, 320, 200), 50);
        return stream;
      },
    });
  });
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Report', 'Numbers:');
  await page.keyboard.press('Enter');
  const editor = page.locator('.note-editor');
  // A chart from the bar: its numbers to change, and its kind.
  await (await toolButton(page, 'Chart')).click();
  const chart = editor.locator('.code-wrap[data-lang="chart"]').first();
  await expect(chart.locator('.code-preview svg rect').first()).toBeVisible();
  await chart.locator('select[data-chart-type]').selectOption('pie');
  await expect(chart.locator('.code-preview svg path').first()).toBeVisible();
  await expect(chart.locator('.code-src')).toHaveValue(/^type: pie/);
  // A table's menu → Make a chart.
  await editor.locator('p').last().click();
  await (await toolButton(page, 'Table')).click();
  await page.getByRole('gridcell', { name: '3 by 3' }).click();
  for (const text of ['', 'Q1', 'Q2', 'North', '10', '12', 'South', '7', '9']) {
    if (text) await page.keyboard.type(text);
    await page.keyboard.press('Tab');
  }
  await page.getByRole('button', { name: 'Table ▾' }).first().click();
  await page.locator('.table-menu button', { hasText: /^Make a chart$/ }).first().click();
  await expect(editor.locator('.code-wrap[data-lang="chart"]')).toHaveCount(2);
  await expect(editor.locator('.code-wrap[data-lang="chart"]').nth(1).locator('.code-src')).toHaveValue('type: column\n, Q1, Q2\nNorth, 10, 12\nSouth, 7, 9');
  // Online video.
  await editor.locator('p').last().click();
  await (await toolButton(page, 'Online video')).click();
  await page.getByLabel('Video link').fill('https://example.com/x');
  await expect(page.getByText('That isn’t a YouTube or Vimeo video link.')).toBeVisible();
  await page.getByLabel('Video link').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.getByLabel('Video title').fill('A talk');
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(editor.locator('.video-frame iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  await expect(editor.locator('.video-link')).toHaveText('A talk');
  // A screenshot comes in as a picture.
  await editor.locator('p').last().click();
  await (await toolButton(page, 'Screenshot')).click();
  await expect(editor.locator('.blk-image img')).toHaveCount(1);
  // Word gets the charts as Word charts.
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download as Word document' }).click()]);
  expect(download.suggestedFilename()).toBe('Report.docx');
});

test('form controls (tick box, drop-down, date, fill-in), filling in forms only, and a spreadsheet', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Order form', 'Agree ');
  const editor = page.locator('.note-editor');
  const put = async (name: string) => {
    await (await toolButton(page, 'Form control')).click();
    await page.getByRole('button', { name: new RegExp(`${name}$`) }).click();
  };
  await put('Tick box');
  await page.keyboard.type(' Colour ');
  await put('Drop-down list');
  await page.keyboard.type(' Date ');
  await put('Date picker');
  await page.keyboard.type(' Name ');
  await put('Fill-in box');
  const box = editor.locator('span.fld[data-form="chk"]');
  await expect(box).toHaveAttribute('data-v', '☐');
  await box.click();
  await expect(box).toHaveAttribute('data-v', '☑');
  // The drop-down's choices changed, then one chosen.
  await editor.locator('span.fld[data-form="drop"]').click();
  const card = page.locator('.form-card');
  await card.getByText('Change the choices').click();
  await card.getByLabel('Choices, one a line').fill('Red\nGreen\nBlue');
  await card.getByRole('button', { name: 'Save choices' }).click();
  await editor.locator('span.fld[data-form="drop"]').click();
  await card.getByRole('option', { name: 'Green' }).click();
  await expect(editor.locator('span.fld[data-form="drop"]')).toHaveAttribute('data-v', 'Green');
  await editor.locator('span.fld[data-form="pick"]').click();
  await card.getByLabel('Date').fill('2026-10-13');
  await card.getByRole('button', { name: 'Done' }).click();
  await expect(editor.locator('span.fld[data-form="pick"]')).toHaveAttribute('data-field', 'pick:2026-10-13');
  await editor.locator('span.fld[data-form="fill"]').click();
  await card.getByLabel('Prompt').fill('Your name');
  await card.getByRole('button', { name: 'Done' }).click();
  await expect(editor.locator('span.fld[data-form="fill"]')).toHaveAttribute('data-v', 'Your name');
  await expect(editor.locator('span.fld[data-form="fill"]')).toHaveClass(/form-prompt/);
  // Only filling in forms: the text is read only, the controls still work.
  await editor.getByText('Agree').click();
  await (await toolButton(page, 'Protect document')).click();
  await page.getByRole('button', { name: 'Filling in forms' }).click();
  await page.getByRole('button', { name: 'Start protection' }).click();
  await expect(page.getByRole('region', { name: 'Protected document' })).toContainText('fill in the form');
  await expect(editor).toHaveAttribute('contenteditable', 'false');
  await editor.locator('span.fld[data-form="fill"]').click();
  await card.getByLabel('Fill in').fill('Jo Bloggs');
  await expect(card.getByLabel('Prompt')).toHaveCount(0);
  await card.getByRole('button', { name: 'Done' }).click();
  await expect(editor.locator('span.fld[data-form="fill"]')).toHaveAttribute('data-v', 'Jo Bloggs');
  await box.click();
  await expect(box).toHaveAttribute('data-v', '☐');
  await page.getByRole('region', { name: 'Protected document' }).getByRole('button', { name: 'Stop protection' }).click();
  // A spreadsheet: letters and numbers round it, and its sums.
  await editor.locator('p').last().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await (await toolButton(page, 'Table')).click();
  await page.getByRole('button', { name: /^Spreadsheet/ }).click();
  const sheet = editor.locator('table.sheet');
  await expect(sheet).toHaveCount(1);
  await expect(sheet.locator('[data-col="D"]')).toHaveCount(1);
  await expect(sheet.locator('[data-row="5"]')).toHaveCount(1);
  const cell = (r: number, c: number) => sheet.locator(`.cell[data-r="${r}"][data-c="${c}"]`);
  await cell(1, 1).click();
  await page.keyboard.type('2');
  await cell(1, 2).click();
  await page.keyboard.type('3.5');
  await cell(2, 0).click();
  await expect(sheet.locator('tr').nth(1).locator('td').nth(3)).toHaveAttribute('data-value', '7');
  await expect(sheet.locator('tr').nth(4).locator('td').nth(3)).toHaveAttribute('data-value', '7');
});

test('draw: pen, ink to shape, eraser, lasso and recolour, replay, and the drawing in the text', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Sketch', 'A sketch:');
  await page.keyboard.press('Enter');
  await (await toolButton(page, 'Draw')).click();
  const win = page.getByRole('dialog', { name: 'Drawing' });
  await expect(win).toBeVisible();
  const area = win.getByRole('img', { name: 'Drawing area' });
  const box = (await area.boundingBox())!;
  const stroke = async (pts: [number, number][]) => {
    await page.mouse.move(box.x + pts[0][0], box.y + pts[0][1]);
    await page.mouse.down();
    for (const [x, y] of pts.slice(1)) await page.mouse.move(box.x + x, box.y + y, { steps: 4 });
    await page.mouse.up();
  };
  // A pen stroke (a wavy line).
  await stroke([[40, 40], [80, 70], [120, 40], [160, 70], [200, 40]]);
  await expect(area.locator('path')).toHaveCount(1);
  // Ink to shape: a rough box becomes a neat one.
  await win.getByLabel('Ink to shape').check();
  await stroke([[300, 40], [450, 44], [452, 150], [302, 148], [301, 45]]);
  await expect(area.locator('path')).toHaveCount(2);
  await expect(area.locator('path').nth(1)).toHaveAttribute('d', /Z$/);
  // The eraser takes the wavy line away; Undo brings it back.
  await win.getByRole('button', { name: 'Eraser' }).click();
  await stroke([[78, 68], [82, 72]]);
  await expect(area.locator('path')).toHaveCount(1);
  await win.getByRole('button', { name: 'Undo' }).click();
  await expect(area.locator('path')).toHaveCount(2);
  // The lasso picks the box; it's recoloured red.
  await win.getByRole('button', { name: 'Lasso select' }).click();
  await stroke([[280, 20], [480, 20], [480, 170], [280, 170], [280, 22]]);
  await expect(area.locator('.ink-picked')).toHaveCount(1);
  await win.getByRole('button', { name: 'Colour #d0312d' }).click();
  await win.getByRole('button', { name: 'Recolour' }).click();
  await expect(area.locator('path[stroke="#d0312d"]')).toHaveCount(1);
  // Replay draws them again, one by one.
  await win.getByRole('button', { name: '▶ Replay' }).click();
  await expect(area.locator('path')).toHaveCount(0);
  await expect(area.locator('path')).toHaveCount(2, { timeout: 5000 });
  await win.getByRole('button', { name: 'Done' }).click();
  await expect(win).toHaveCount(0);
  const drawing = page.locator('.note-editor .code-wrap[data-lang="ink"] svg.ink-svg');
  await expect(drawing.locator('path')).toHaveCount(2);
  // Clicking it opens it again.
  await drawing.click();
  await expect(win).toBeVisible();
  await expect(area.locator('path')).toHaveCount(2);
  await win.getByRole('button', { name: 'Cancel' }).click();
});

test('macros (record, play back, a shortcut), customising the formatting bar, and what’s new', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Letters', 'Dear Sam,');
  const editor = page.locator('.note-editor');
  // Record: a new line, a bold sign-off.
  await (await toolButton(page, 'Macros')).click();
  await page.getByLabel('Macro name').fill('Sign off');
  await page.getByRole('button', { name: '● Record' }).click();
  const bar = page.getByRole('status', { name: 'Recording a macro' });
  await expect(bar).toContainText('Recording “Sign off”');
  await editor.getByText('Dear Sam,').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+b');
  await page.keyboard.type('Best wishes');
  await page.keyboard.press('Control+b');
  await bar.getByRole('button', { name: 'Stop recording' }).click();
  await expect(bar).toHaveCount(0);
  await expect(editor.locator('strong', { hasText: 'Best wishes' })).toHaveCount(1);
  // Played back at the end of the text: the same again.
  await page.keyboard.press('Control+End');
  await (await toolButton(page, 'Macros')).click();
  await page.getByRole('button', { name: /▶ Sign off/ }).click();
  await expect(editor.locator('strong', { hasText: 'Best wishes' })).toHaveCount(2);
  // A shortcut: Alt+Shift+1.
  await (await toolButton(page, 'Macros')).click();
  await page.getByLabel('Shortcut for Sign off').selectOption('1');
  await page.keyboard.press('Escape');
  await editor.locator('p').last().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Alt+Shift+Digit1');
  await expect(editor.locator('strong', { hasText: 'Best wishes' })).toHaveCount(3);
  // Customise the bar: hide Bold, keep Draw on the bar.
  await expect(page.locator('.note-toolbar .tools.fit').getByRole('button', { name: 'Bold', exact: true })).toHaveCount(1);
  await (await toolButton(page, 'Customise the bar…')).click();
  const dialog = page.getByRole('dialog', { name: 'Customise the formatting bar' });
  await dialog.getByLabel('Show Bold', { exact: true }).uncheck();
  await dialog.getByLabel('Keep Draw on the bar').check();
  await dialog.getByRole('button', { name: 'Done' }).first().click();
  await expect(page.locator('.note-toolbar .tools.fit').getByRole('button', { name: 'Bold', exact: true })).toHaveCount(0);
  await expect(page.locator('.note-toolbar .tools.fit > .tool').getByRole('button', { name: 'Draw', exact: true })).toHaveCount(1);
  // What's new, from Help: the dot goes once it's been seen.
  const help = page.getByRole('button', { name: 'Help', exact: true });
  await expect(help.locator('.news-dot')).toHaveCount(1);
  await help.click();
  await page.getByRole('button', { name: /What’s new/ }).click();
  const news = page.getByRole('dialog', { name: 'What’s new' });
  await expect(news).toContainText('Macros');
  await news.getByRole('button', { name: 'Close' }).click();
  await expect(help.locator('.news-dot')).toHaveCount(0);
});

test('objects: a PDF shown inside the page or as an icon, and a 3D model to turn', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbar: 'always' }));
  await newNote(page, 'Papers', 'The report:');
  await page.keyboard.press('Enter');
  const editor = page.locator('.note-editor');
  const Bytes = (globalThis as unknown as { Buffer: { from(s: string | number[]): never } }).Buffer;
  const pdf = '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), (await toolButton(page, 'Object')).click()]);
  await chooser.setFiles({ name: 'report.pdf', mimeType: 'application/pdf', buffer: Bytes.from(pdf) });
  await expect(editor.locator('iframe.embed-frame')).toHaveCount(1);
  await editor.getByRole('button', { name: 'Show as an icon' }).click();
  await expect(editor.locator('iframe.embed-frame')).toHaveCount(0);
  await expect(editor.locator('.file-chip')).toHaveText('report.pdf');
  await editor.getByRole('button', { name: 'Show inside' }).click();
  await expect(editor.locator('iframe.embed-frame')).toHaveCount(1);
  // A 3D model: the viewer, loaded when first needed.
  await editor.locator('p').last().click();
  const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), (await toolButton(page, '3D model')).click()]);
  await chooser2.setFiles({ name: 'teapot.glb', mimeType: 'model/gltf-binary', buffer: Bytes.from([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0]) });
  await expect(editor.locator('model-viewer')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => !!customElements.get('model-viewer')), { timeout: 15000 }).toBe(true);
  await expect(editor.locator('.media-model')).toContainText('teapot.glb');
});

test('the bar above a note fades while typing and comes back when the mouse moves', async ({ page }) => {
  await open(page);
  await newNote(page, 'Quiet', 'One');
  const pane = page.locator('.note-pane').first();
  await page.keyboard.type(' two');
  await expect(pane).toHaveClass(/\btyping\b/);
  await expect(pane.locator('> .note-toolbar')).toHaveCSS('opacity', '0');
  await page.mouse.move(400, 300);
  await expect(pane).not.toHaveClass(/\btyping\b/);
  await expect(pane.locator('> .note-toolbar')).toHaveCSS('opacity', '1');
});

test('in a book the sidebar steps back to its strip, and In this chapter lists who the chapter names', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await page.evaluate(async () => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    type C = { getState(): { projects: { id: string }[]; chapters: { id: string; projectId: string }[] }; addCastMember(p: string, k: string, n: string): { id: string }; updateCastMember(p: string, id: string, patch: object): void; setChapterDoc(id: string, doc: unknown): void; updateLayout(p: object): void };
    const c = (window as unknown as { crumpet: C }).crumpet;
    const p = c.getState().projects[0];
    const mara = c.addCastMember(p.id, 'character', 'Mara');
    c.updateCastMember(p.id, mara.id, { description: 'Came back to close the light.' });
    c.addCastMember(p.id, 'place', 'Gull Rock');
    c.addCastMember(p.id, 'character', 'Nobody');
    const ch = c.getState().chapters.find((x) => x.projectId === p.id)!;
    c.setChapterDoc(ch.id, md.fromMarkdown('Mara looked up at Gull Rock. Mara sighed.'));
    c.updateLayout({ right: true });
  });
  // The notes sidebar is a strip of icons; the outline is beside it.
  await expect(page.locator('nav.rail')).toBeVisible();
  await expect(page.locator('nav.sidebar')).toHaveCount(0);
  const right = page.getByRole('complementary', { name: 'Right sidebar' });
  await expect(right.getByRole('tab', { name: 'In this chapter' })).toHaveAttribute('aria-selected', 'true');
  const cards = right.locator('.cast-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('Mara');
  await expect(cards.first()).toContainText('Named 2 times');
  await expect(right).not.toContainText('Nobody');
  await cards.first().click();
  await expect(page.getByRole('region', { name: 'Character card' })).toBeVisible();
  // Showing the sidebar keeps it in books from then on; folding it puts it back to the strip.
  await sidebar(page).getByRole('button', { name: 'Show the sidebar' }).click();
  await expect(page.locator('nav.sidebar')).toBeVisible();
  await sidebar(page).getByRole('button', { name: 'Hide the sidebar' }).click();
  await expect(page.locator('nav.rail')).toBeVisible();
  // Back in the notes, the sidebar is whole again.
  await sidebar(page).getByRole('button', { name: 'All Notes' }).click();
  await expect(page.locator('nav.sidebar')).toBeVisible();
});

test('the calm bar: five buttons, the rest under More in groups, and page view’s menus', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbarAll: false, toolbar: 'always' }));
  await newNote(page, 'Calm', 'Some words');
  const bar = page.locator('.note-toolbar .tools.fit');
  await expect(bar.getByRole('button', { name: 'Bold' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Italic' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Link' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Underline' })).toHaveCount(0);
  await bar.getByRole('button', { name: 'More formatting' }).click();
  const more = page.getByRole('dialog', { name: 'More formatting' });
  // More opens on a few everyday tools; All writing tools… shows the rest, in groups.
  await expect(more.getByRole('button', { name: /Highlight/ })).toBeVisible();
  await expect(more.getByRole('button', { name: /Track changes/ })).toBeVisible();
  await expect(more.getByRole('button', { name: /Underline/ })).toHaveCount(0);
  await more.getByRole('button', { name: 'All writing tools…' }).click();
  for (const g of ['Text', 'Paragraph', 'Insert', 'Layout']) await expect(more.getByRole('group', { name: g })).toBeVisible();
  await expect(more.getByRole('group', { name: 'Text' }).getByRole('button', { name: /Underline/ })).toBeVisible();
  await page.keyboard.press('Escape');
  // The note's corner keeps to the star and its menu; the views are in the menu.
  await expect(page.getByRole('button', { name: 'Focus mode' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Track changes' })).toHaveCount(0);
  await page.locator('.note-actions').getByRole('button', { name: 'More', exact: true }).click();
  const opts = page.getByRole('dialog', { name: 'Note options' });
  await expect(opts.getByRole('button', { name: 'Focus mode' })).toBeVisible();
  await opts.getByRole('button', { name: /Add a reminder/ }).click();
  await expect(page.getByRole('dialog', { name: 'Reminder' })).toBeVisible();
  await page.keyboard.press('Escape');
  // Settings → Look → Show every formatting tool puts them all back on the bar.
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbarAll: true }));
  await expect(bar.getByRole('button', { name: 'Underline' })).toBeVisible();
  // In page view, the groups are menus of their own, as Word's tabs are.
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: { updateSettings(p: object): void; updateLayout(p: object): void } }).crumpet;
    c.updateSettings({ toolbarAll: false });
    c.updateLayout({ list: false });
  });
  await page.locator('.note-actions').getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('dialog', { name: 'Note options' }).getByRole('button', { name: 'Page view' }).click();
  for (const m of ['Format ▾', 'Insert ▾', 'References ▾', 'Review ▾']) await expect(bar.getByRole('button', { name: m })).toBeVisible();
  await bar.getByRole('button', { name: 'Layout ▾' }).click();
  await expect(page.getByRole('dialog', { name: 'Layout tools' })).toBeVisible();
});

test('exporting a book: Word, e-book, PDF or another format, with or without the chapters still to do', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await page.evaluate(async () => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    type C = { getState(): { projects: { id: string }[]; chapters: { id: string; projectId: string }[] }; addChapter(p: string): { id: string }; setChapterTitle(id: string, t: string): void; setChapterDoc(id: string, d: unknown): void; setChapterStatus(id: string, s: string): void };
    const c = (window as unknown as { crumpet: C }).crumpet;
    const p = c.getState().projects[0];
    const first = c.getState().chapters.find((x) => x.projectId === p.id)!;
    c.setChapterTitle(first.id, 'Arrival');
    c.setChapterDoc(first.id, md.fromMarkdown('The boat left her at the foot of the steps.'));
    c.setChapterStatus(first.id, 'draft');
    const second = c.addChapter(p.id);
    c.setChapterTitle(second.id, 'Storm');
    c.setChapterDoc(second.id, md.fromMarkdown('Not written yet, only a placeholder.'));
    c.setChapterStatus(second.id, 'todo');
  });
  const outline = page.getByRole('region', { name: 'Outline' });
  await outline.getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('button', { name: /^Export/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Export The Lighthouse' });
  await expect(dialog).toContainText('2 chapters');
  await expect(dialog.getByLabel('Preview of page 1')).toContainText('Chapter One');
  await expect(dialog.getByLabel('Preview of page 1')).toContainText('The boat left her');
  // Word, the first choice.
  const [docx] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download as Word document' }).click()]);
  expect(docx.suggestedFilename()).toBe('The Lighthouse.docx');
  // Plain text, leaving out the chapter still to do.
  await outline.getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('button', { name: /^Export/ }).click();
  await dialog.getByLabel(/Chapters marked To do/).uncheck();
  await expect(dialog).toContainText('1 chapter ·');
  await dialog.getByLabel('Another format').selectOption('txt');
  const [txt] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download as Plain text' }).click()]);
  expect(txt.suggestedFilename()).toBe('The Lighthouse.txt');
  const body = await new Promise<string>((done) => {
    void txt.createReadStream().then((st) => {
      let out = '';
      st.on('data', (d: { toString(): string }) => (out += d.toString()));
      st.on('end', () => done(out));
    });
  });
  expect(body).toContain('The boat left her');
  expect(body).not.toContain('placeholder');
  // The e-book.
  await outline.getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('button', { name: /^Export/ }).click();
  await dialog.getByRole('radio', { name: /E-book/ }).click();
  const [epub] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download as e-book (ePub)' }).click()]);
  expect(epub.suggestedFilename()).toBe('The Lighthouse.epub');
});

test('a book’s cards: Show picks what each card shows', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  const outline = page.getByRole('region', { name: 'Outline' });
  await outline.getByRole('button', { name: 'Cards' }).click();
  const board = page.getByRole('region', { name: 'Corkboard' });
  await expect(board.getByLabel('Synopsis of chapter 1')).toBeVisible();
  await expect(board.getByLabel('Status of chapter 1')).toBeVisible();
  await board.getByRole('button', { name: 'Show ▾' }).click();
  const menu = page.getByRole('dialog', { name: 'Show on the cards' });
  await menu.getByLabel('Synopsis').uncheck();
  await menu.getByLabel('Status').uncheck();
  await expect(board.getByLabel('Synopsis of chapter 1')).toHaveCount(0);
  await expect(board.getByLabel('Status of chapter 1')).toHaveCount(0);
  await menu.getByLabel('Synopsis').check();
  await expect(board.getByLabel('Synopsis of chapter 1')).toBeVisible();
});
