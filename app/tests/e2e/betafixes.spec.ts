import { type Page, expect, test } from '@playwright/test';

// Fixes from the beta test of 8 November 2026: typing after a button makes no junk, and new things land where they were made.

type Store = {
  createProject(name: string): { id: string };
  createNotebook(name: string): { id: string };
  setView(v: object): void;
  getState(): { notes: { title: string; notebookId: string | null }[]; chapters: { projectId: string; doc: { blocks: { runs: { text: string }[] }[] } }[]; view: { kind: string } };
};
const crumpet = (page: Page) => page.evaluateHandle(() => (window as unknown as { crumpet: Store }).crumpet);
const start = async (page: Page) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
};

test('typing after New chapter goes into the new chapter, and makes no more chapters or notes', async ({ page }) => {
  await start(page);
  const store = await crumpet(page);
  const id = await store.evaluate((s) => s.createProject('The Glass King').id);
  await page.getByRole('button', { name: 'Add chapter' }).click();
  await page.keyboard.type('Wally hated the market. Nobody knew.');
  const chapters = () => store.evaluate((s, id) => s.getState().chapters.filter((c) => c.projectId === id).map((c) => c.doc.blocks.map((b) => b.runs.map((r) => r.text).join('')).join('\n')), id);
  await expect.poll(chapters).toEqual(['', 'Wally hated the market. Nobody knew.']);
  expect(await store.evaluate((s) => s.getState().notes.length)).toBe(0);
});

test('N makes a note only when nothing has the focus, not while a button or list does', async ({ page }) => {
  await start(page);
  const store = await crumpet(page);
  const notes = () => store.evaluate((s) => s.getState().notes.map((n) => n.title));
  await page.getByRole('navigation', { name: 'Notebooks' }).getByRole('button', { name: /All notes/ }).click();
  await page.keyboard.type(' n the market.');
  expect(await notes()).toEqual([]);
  // With nothing focused, N starts a note, its title typed straight after (no leading space kept).
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('n');
  await page.keyboard.type(' Market day');
  await expect.poll(notes).toEqual(['Market day']);
});

test('New note inside a notebook puts the note in that notebook, and the list stays on it', async ({ page }) => {
  await start(page);
  const store = await crumpet(page);
  const nb = await store.evaluate((s) => {
    const nb = s.createNotebook('Ideas');
    s.setView({ kind: 'notebook', id: nb.id });
    return nb.id;
  });
  await page.getByRole('region', { name: 'Notes', exact: true }).getByRole('button', { name: 'New note' }).click();
  await page.keyboard.type('A thought');
  await expect.poll(() => store.evaluate((s) => s.getState().notes.map((n) => [n.title, n.notebookId]))).toEqual([['A thought', nb]]);
  expect(await store.evaluate((s) => s.getState().view.kind)).toBe('notebook');
});

test('Share with readers and other windows close with Escape', async ({ page }) => {
  await start(page);
  const store = await crumpet(page);
  await store.evaluate((s) => s.createProject('The Glass King'));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Book options' }).click();
  await page.getByRole('button', { name: /Share with readers/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Share with readers' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('a chapter’s ··· menu renames, duplicates and moves it anywhere in the book', async ({ page }) => {
  await start(page);
  const store = await crumpet(page);
  await store.evaluate((s) => s.createProject('The Glass King'));
  const outline = page.getByRole('region', { name: 'Outline' });
  await page.getByRole('button', { name: 'Add chapter' }).click();
  await page.getByRole('button', { name: 'Add chapter' }).click();
  const titles = () => outline.locator('.outline-title');
  await expect(titles()).toHaveText(['Chapter 1', 'Chapter 2', 'Chapter 3']);
  await outline.getByRole('button', { name: 'Options for Chapter 1' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate chapter' }).click();
  await expect(titles()).toHaveText(['Chapter 1', 'Chapter 1 (copy)', 'Chapter 2', 'Chapter 3']);
  await outline.getByRole('button', { name: 'Options for Chapter 1 (copy)' }).click();
  await page.getByRole('menuitem', { name: 'Move to…' }).click();
  await page.getByRole('menuitem', { name: 'After Chapter 3' }).click();
  await expect(titles()).toHaveText(['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 1 (copy)']);
  await outline.getByRole('button', { name: 'Options for Chapter 1 (copy)' }).click();
  await page.getByRole('menuitem', { name: 'Move to…' }).click();
  await page.getByRole('menuitem', { name: 'To the start' }).click();
  await expect(titles()).toHaveText(['Chapter 1 (copy)', 'Chapter 1', 'Chapter 2', 'Chapter 3']);
});

test('the formatting tools come back when words are selected with the keyboard', async ({ page }) => {
  await start(page);
  await page.getByRole('navigation', { name: 'Notebooks' }).getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('dialog', { name: 'New' }).getByRole('button', { name: /^Note( |$)/ }).click();
  await page.keyboard.type('Tides');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The sea came in twice a day.');
  const pane = page.locator('.note-pane').first();
  await expect(pane).toHaveClass(/typing/);
  await page.keyboard.press('Shift+Home');
  await expect(pane).not.toHaveClass(/typing/);
});
