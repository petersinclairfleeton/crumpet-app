import { type Page, expect, test } from '@playwright/test';

// 8 November: a book beside the sidebar, every tool without the older layout,
// work modes and parts switched off, sizes per document and for the whole app,
// and the typewriter in each document's menu.

type Crumpet = Record<string, (...a: unknown[]) => { id: string }> & { getState(): { settings: Record<string, unknown> } };
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Notebooks' });
const settings = (page: Page) => page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.getState().settings);

async function calm(page: Page) {
  await page.setViewportSize({ width: 1440, height: 860 });
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    c.updateSettings({ guideSeen: true, toolbarAll: false });
    c.createNote({ title: 'First thought', notebookId: null });
  });
  await expect(page.locator('.sidebar.calm')).toBeVisible();
}

test('a book opens beside the sidebar, with New chapter at the top and each chapter’s words beneath its title', async ({ page }) => {
  await calm(page);
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    const p = c.createProject('The Lighthouse Keeper’s Granddaughter');
    const st = c.getState() as unknown as { chapters: { id: string; projectId: string }[] };
    c.setChapterTitle(st.chapters.find((x) => x.projectId === p.id)!.id, 'The boat leaves before the storm comes in');
    c.setView({ kind: 'project', id: p.id });
  });
  const outline = page.getByRole('region', { name: 'Outline' });
  await expect(outline).toBeVisible();
  // The sidebar stays.
  await expect(page.locator('nav.sidebar.calm')).toBeVisible();
  // New chapter comes before the chapters.
  const newBox = (await outline.getByRole('button', { name: 'Add chapter' }).boundingBox())!;
  const first = outline.locator('.outline-chapter').first();
  expect(newBox.y).toBeLessThan((await first.boundingBox())!.y);
  // The whole title, and its words beneath it.
  const title = first.locator('.outline-title');
  await expect(title).toHaveText('The boat leaves before the storm comes in');
  expect(await title.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  const words = first.locator('.outline-words.below');
  await expect(words).toHaveText('0 words');
  expect((await words.boundingBox())!.y).toBeGreaterThan((await title.boundingBox())!.y);
  // Folding the outline away; the chapter brings it back.
  await outline.getByRole('button', { name: 'Hide the outline' }).click();
  await expect(outline).toHaveCount(0);
  await expect(page.locator('nav.sidebar.calm')).toBeVisible();
  await page.getByRole('button', { name: 'Show the outline' }).click();
  await expect(outline).toBeVisible();
});

test('Show every formatting tool puts every tool on the bar and keeps the layout', async ({ page }) => {
  await calm(page);
  await sidebar(page).getByRole('button', { name: 'Settings and more' }).click();
  await page.getByRole('button', { name: /Settings…/ }).click();
  await page.getByRole('tab', { name: 'Formatting bar' }).click();
  await page.getByRole('switch', { name: /Show every formatting tool/ }).check();
  await page.keyboard.press('Escape');
  expect((await settings(page)).toolbarAll).toBeFalsy();
  await expect(page.locator('.app.calm')).toBeVisible();
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.getByRole('toolbar').getByRole('button', { name: 'Underline', exact: true }).first()).toBeVisible();
});

test('work modes and parts: Journal hides books and the graph; a part switched back on returns', async ({ page }) => {
  await calm(page);
  const side = sidebar(page);
  await expect(side.getByRole('region', { name: 'Express' })).toBeVisible();
  await side.getByRole('button', { name: 'Settings and more' }).click();
  await page.getByRole('menuitemradio', { name: 'Journal' }).click();
  await expect(side.getByRole('region', { name: 'Express' })).toHaveCount(0);
  await expect(side.getByRole('button', { name: 'Graph of links' })).toHaveCount(0);
  await expect(side.getByRole('region', { name: 'Distill' })).toHaveCount(0);
  await side.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New' }).getByRole('button', { name: 'Book', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  // One part back on, from Settings → Your workflow.
  await side.getByRole('button', { name: 'Settings and more' }).click();
  await page.getByRole('button', { name: /Settings…/ }).click();
  await page.getByRole('tab', { name: 'Your workflow' }).click();
  await expect(page.getByRole('radio', { name: /Journal/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('switch', { name: /Graph of links/ }).check();
  await expect(page.getByRole('radio', { name: /Journal/ })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('radio', { name: /Everything/ }).click();
  await page.keyboard.press('Escape');
  await expect(side.getByRole('region', { name: 'Express' })).toBeVisible();
  expect((await settings(page)).partsOff).toBeUndefined();
});

test('a document’s own text size and the typewriter are in its ··· menu; Settings sizes the whole app', async ({ page }) => {
  await calm(page);
  await page.getByRole('button', { name: 'More', exact: true }).last().click();
  const menu = page.getByRole('dialog', { name: 'Note options' });
  await menu.getByRole('button', { name: 'Bigger text' }).click();
  await menu.getByRole('button', { name: 'Bigger text' }).click();
  await expect(menu.getByRole('group', { name: 'Text size of this document' })).toContainText('125%');
  expect(await page.locator('.note-pane .note-body').evaluate((e) => getComputedStyle(e).zoom)).toBe('1.25');
  await menu.getByRole('menuitemcheckbox', { name: 'Keep the line in the middle' }).click();
  await expect(menu.getByRole('menuitemcheckbox', { name: 'Keep the line in the middle' })).toHaveAttribute('aria-checked', 'true');
  expect(((await settings(page)).typewriter as { scroll?: boolean }).scroll).toBe(true);
  await page.keyboard.press('Escape');
  // The whole app: a dropdown of named sizes in Settings → Appearance.
  await sidebar(page).getByRole('button', { name: 'Settings and more' }).click();
  await page.getByRole('button', { name: /Settings…/ }).click();
  await page.getByRole('tab', { name: 'Appearance' }).click();
  const size = page.getByRole('combobox', { name: 'Size of everything' });
  await expect(size).toHaveValue('100');
  expect(await size.locator('option').allTextContents()).toEqual(['Smallest (80%)', 'Small (90%)', 'Standard (100%)', 'Large (110%)', 'Larger (125%)', 'Largest (140%)']);
  await size.selectOption({ label: 'Larger (125%)' });
  expect((await settings(page)).uiScale).toBe(125);
  await expect(page.locator('html')).toHaveAttribute('data-ui-scale', '');
  expect(await page.locator('#root').evaluate((e) => getComputedStyle(e).zoom)).toBe('1.25');
  await size.selectOption('100');
  expect((await settings(page)).uiScale).toBeUndefined();
  // A size chosen with the old slider shows as the nearest one offered.
  await page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.updateSettings({ uiScale: 115 }));
  await expect(size).toHaveValue('110');
});
