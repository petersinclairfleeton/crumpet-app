import { type Page, expect, test } from '@playwright/test';

// Every test starts in a fresh browser profile, so storage begins empty (first run).

async function open(page: Page) {
  await page.goto('/');
  await expect(page.locator('.card').first()).toBeVisible();
}

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Notebooks' });
const list = (page: Page) => page.getByRole('region', { name: 'Notes', exact: true });

async function newNote(page: Page, title: string, body: string) {
  await sidebar(page).getByRole('button', { name: 'New Note', exact: true }).click();
  await expect(page.getByLabel('Title')).toBeFocused();
  await page.keyboard.type(title);
  await page.keyboard.press('Enter');
  await page.keyboard.type(body);
}

test('first run shows a welcome note and example notebooks', async ({ page }) => {
  await open(page);
  await expect(list(page).locator('.card').first()).toContainText('Welcome to Crumpet');
  await expect(sidebar(page)).toContainText('1 Projects');
  await expect(sidebar(page)).toContainText('Novel: The Lighthouse');
  await expect(page.getByLabel('Title')).toHaveValue('Welcome to Crumpet');
});

test('a new note is saved on the device and survives a reload', async ({ page }) => {
  await open(page);
  await newNote(page, 'Shopping list', 'Milk and eggs');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- bread');
  await expect(list(page).locator('.card.selected')).toContainText('Shopping list');
  await expect(list(page).locator('.card.selected')).toContainText('Milk and eggs · bread');
  await page.waitForTimeout(700); // typing pause, then it saves
  await page.reload();
  await list(page).locator('.card', { hasText: 'Shopping list' }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Shopping list');
  await expect(page.locator('.note-editor')).toContainText('Milk and eggs');
  await expect(page.locator('.note-editor .blk-bullet')).toHaveText('bread');
  // It went into the Inbox.
  await expect(page.locator('.nb-picker select')).toHaveValue(await page.locator('.nb-picker option', { hasText: 'Inbox' }).getAttribute('value') as string);
});

test('notebooks: create one, write in it, move a note out of it', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New notebook' }).click();
  await page.keyboard.type('Recipes');
  await page.keyboard.press('Enter');
  await expect(list(page).locator('h1')).toHaveText('Recipes');
  await newNote(page, 'Soda bread', 'Buttermilk, flour, salt, soda.');
  await expect(list(page).locator('.card')).toHaveCount(1);
  await page.locator('.nb-picker select').selectOption({ label: 'Journal' });
  await expect(list(page).locator('.card')).toHaveCount(0);
  await sidebar(page).getByRole('button', { name: 'Journal', exact: true }).click();
  await expect(list(page)).toContainText('Soda bread');
});

test('notebooks: put one in a stack, rename it, delete it to the Trash', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'Inbox options' }).click();
  await page.getByRole('button', { name: 'Put in a stack…' }).click();
  await page.getByLabel('Stack name').fill('0 Start');
  await page.keyboard.press('Enter');
  await expect(sidebar(page).locator('.stack-row', { hasText: '0 Start' })).toBeVisible();

  await sidebar(page).getByRole('button', { name: 'Journal options' }).click();
  await page.getByRole('button', { name: 'Rename…' }).click();
  await page.getByLabel('New name').fill('Diary');
  await page.keyboard.press('Enter');
  await expect(sidebar(page)).toContainText('Diary');

  await sidebar(page).getByRole('button', { name: 'Diary options' }).click();
  await page.getByRole('button', { name: 'Delete notebook…' }).click();
  await expect(page.getByRole('dialog')).toContainText('Its 1 note will move to the Trash');
  await page.getByRole('button', { name: 'Delete notebook', exact: true }).click();
  await expect(sidebar(page)).not.toContainText('Diary');
  await sidebar(page).getByRole('button', { name: /^Trash/ }).click();
  await expect(list(page)).toContainText('Weekly review');
});

test('tags: add one, find it in the sidebar, remove it', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add tag' }).click();
  await page.keyboard.type('Start Here');
  await page.keyboard.press('Enter');
  await expect(page.locator('.tag-chip')).toHaveText(/#start-here/);
  await sidebar(page).getByRole('button', { name: 'Tags' }).click();
  await sidebar(page).getByRole('button', { name: /#start-here/ }).click();
  await expect(list(page).locator('h1')).toHaveText('#start-here');
  await expect(list(page).locator('.card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove tag start-here' }).click();
  await expect(list(page).locator('.card')).toHaveCount(0);
});

test('search finds notes across notebooks and offers notebooks to jump to', async ({ page }) => {
  await open(page);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#search')).toBeFocused();
  await page.keyboard.type('lighthouse');
  await expect(list(page).locator('h1')).toHaveText('Search results');
  await expect(list(page).locator('.card')).toHaveCount(3); // every note in that notebook
  await list(page).locator('.jumps').getByRole('button', { name: 'Novel: The Lighthouse' }).click();
  await expect(list(page).locator('h1')).toHaveText('Novel: The Lighthouse');
  await page.locator('#search').fill('causeway floods');
  await expect(list(page).locator('.card')).toHaveCount(1);
  await expect(list(page).locator('.card')).toContainText('Tide tables');
  await page.locator('#search').fill('nothing matches this');
  await expect(list(page)).toContainText('No notes match');
});

test('Trash: move a note there, restore it, then delete it forever', async ({ page }) => {
  await open(page);
  await list(page).locator('.card', { hasText: 'Villain who is right' }).click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Move to Trash' }).click();
  await expect(list(page)).not.toContainText('Villain who is right');
  await sidebar(page).getByRole('button', { name: /^Trash/ }).click();
  await list(page).locator('.card', { hasText: 'Villain' }).click();
  await expect(page.getByRole('status')).toContainText('This note is in the Trash');
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

test('Shortcuts: starring a note keeps it there', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add to Shortcuts' }).click();
  await sidebar(page).getByRole('button', { name: /^Shortcuts/ }).click();
  await expect(list(page)).toContainText('Welcome to Crumpet');
  await page.getByRole('button', { name: 'Remove from Shortcuts' }).click();
  await expect(list(page)).not.toContainText('Welcome to Crumpet');
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

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('list, then note, then back; the menu opens the notebooks', async ({ page }) => {
    await open(page);
    await expect(page.locator('.pane')).toBeHidden();
    await list(page).locator('.card', { hasText: 'Names for the island' }).click();
    await expect(page.getByLabel('Title')).toHaveValue('Names for the island');
    await expect(list(page)).toBeHidden();
    await page.getByRole('button', { name: 'Back to notes' }).click();
    await expect(list(page)).toBeVisible();
    await page.getByRole('button', { name: 'Notebooks and tags' }).click();
    await expect(sidebar(page)).toBeVisible();
    await sidebar(page).getByRole('button', { name: 'Journal', exact: true }).click();
    await expect(sidebar(page)).toBeHidden();
    await expect(list(page).locator('h1')).toHaveText('Journal');
  });
});
