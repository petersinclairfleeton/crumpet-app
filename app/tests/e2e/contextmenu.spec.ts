import { type Page, expect, test } from '@playwright/test';

// Crumpet's own right-click menu: in the writing (spelling, cut, copy, paste),
// in a text box, and anywhere else, so the browser's never shows.

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Notebooks' });
const text = (page: Page) => page.locator('.note-pane [contenteditable="true"]').first();
const menu = (page: Page) => page.locator('.context-menu');

async function open(page: Page) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbarAll: true }));
  await sidebar(page).getByRole('button', { name: 'New note', exact: true }).click();
  await page.keyboard.type('Letters');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The lighthouse keeper wrote a lettre home.');
}

/** Where a word is on the screen. */
async function wordAt(page: Page, word: string): Promise<{ x: number; y: number }> {
  return text(page).evaluate((root, word) => {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const i = n.textContent!.indexOf(word);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i + 2);
      r.setEnd(n, i + 3);
      const b = r.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
    throw new Error(`${word} not found`);
  }, word);
}

/** True when the page took the right click (so the browser's menu wouldn't show). */
async function rightClick(page: Page, x: number, y: number): Promise<boolean> {
  return page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y)!;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2, pointerType: 'mouse' }));
    return !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }));
  }, [x, y]);
}

test('right click in the writing: spelling suggestions, copy and paste', async ({ page }) => {
  await open(page);
  const at = await wordAt(page, 'lettre');
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await expect(menu(page).getByRole('menuitem', { name: 'Copy' })).toBeVisible();
  // The misspelt word's suggestions come first; picking one puts it in place.
  await expect(menu(page).getByRole('menuitem', { name: 'letter', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(menu(page).getByRole('menuitem', { name: 'Add to dictionary' })).toBeVisible();
  await menu(page).getByRole('menuitem', { name: 'letter', exact: true }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect(text(page)).toHaveText('The lighthouse keeper wrote a letter home.');

  // Select a word, copy it from the menu, and paste it at the end.
  const lh = await wordAt(page, 'lighthouse');
  await page.mouse.dblclick(lh.x, lh.y);
  await page.mouse.click(lh.x, lh.y, { button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Copy', exact: true }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' ');
  const end = await wordAt(page, 'home');
  await page.mouse.click(end.x + 40, end.y, { button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Paste', exact: true }).click();
  await expect(text(page)).toContainText('letter home. lighthouse');

  // Escape closes it.
  await text(page).click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
});

test('right click in a text box and elsewhere shows Crumpet’s menu, never the browser’s', async ({ page }) => {
  await open(page);
  // The title box: its own cut, copy and paste.
  await page.getByLabel('Title').click({ button: 'right' });
  await expect(menu(page).getByRole('menuitem', { name: 'Select all' })).toBeVisible();
  await menu(page).getByRole('menuitem', { name: 'Select all' }).click();
  expect(await page.getByLabel('Title').evaluate((el: HTMLInputElement | HTMLTextAreaElement) => el.selectionEnd! - el.selectionStart!)).toBe('Letters'.length);

  // An empty part of the window: new note, find, commands, settings.
  const box = (await sidebar(page).boundingBox())!;
  expect(await rightClick(page, box.x + box.width / 2, box.y + box.height - 10)).toBe(true);
  await expect(menu(page).getByRole('menuitem', { name: 'All commands' })).toBeVisible();
  await menu(page).getByRole('menuitem', { name: 'All commands' }).click();
  await expect(page.getByRole('dialog').getByRole('combobox')).toBeFocused();
  await page.keyboard.press('Escape');

  // Every part of the screen takes the right click.
  const vw = page.viewportSize()!;
  for (const [fx, fy] of [[0.05, 0.05], [0.3, 0.5], [0.6, 0.3], [0.9, 0.9], [0.5, 0.02]]) {
    await page.mouse.click(1, vw.height - 1);
    await page.keyboard.press('Escape');
    expect(await rightClick(page, vw.width * fx, vw.height * fy)).toBe(true);
  }
});

test('right click formats the writing, and works on a table’s rows and columns', async ({ page }) => {
  await open(page);
  // Bold from the menu's row of format buttons, on the selected word.
  const lh = await wordAt(page, 'lighthouse');
  await page.mouse.dblclick(lh.x, lh.y);
  await page.mouse.click(lh.x, lh.y, { button: 'right' });
  await expect(menu(page).getByRole('menuitem', { name: 'Paragraph…' })).toBeVisible();
  await menu(page).getByRole('menuitem', { name: 'Bold' }).click();
  await expect(text(page).locator('strong')).toHaveText('lighthouse');

  // Paragraph… opens Word's Paragraph window.
  await page.mouse.click(lh.x, lh.y, { button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Paragraph…' }).click();
  await expect(page.getByRole('dialog', { name: 'Paragraph' })).toBeVisible();
  await page.keyboard.press('Escape');

  // A table: a row and a column added, then the column taken away again.
  await text(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/table');
  await page.keyboard.press('Enter');
  const table = page.locator('.note-editor .blk-table table');
  await expect(table.locator('tr')).toHaveCount(3);
  const cols = () => table.locator('tr').first().locator('th');
  const n = await cols().count();
  await table.locator('td .cell').first().click({ button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Insert row below' }).click();
  await expect(table.locator('tr')).toHaveCount(4);
  await table.locator('td .cell').first().click({ button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Insert column right' }).click();
  await expect(cols()).toHaveCount(n + 1);
  await table.locator('td .cell').first().click({ button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Delete column' }).click();
  await expect(cols()).toHaveCount(n);
});

test('right click on a chapter in a book’s outline', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await page.getByLabel('Chapter title').fill('The Keeper');
  const outline = page.getByRole('region', { name: 'Outline' });
  const chapter = (name: string) => outline.locator('.outline-chapter', { hasText: name });
  await chapter('The Keeper').click({ button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Rename…' }).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('The Lamp');
  await page.keyboard.press('Enter');
  await expect(chapter('The Lamp')).toBeVisible();

  await chapter('The Lamp').click({ button: 'right' });
  await menu(page).getByRole('menuitemradio', { name: 'Revised' }).click();
  await expect(chapter('The Lamp').locator('.status-dot.revised')).toBeVisible();

  await chapter('The Lamp').click({ button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'New chapter after this' }).click();
  await expect(outline.locator('.outline-chapter')).toHaveCount(2);
  await outline.locator('.outline-chapter').nth(1).click({ button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Move up' }).click();
  await expect(outline.locator('.outline-chapter').nth(1)).toContainText('The Lamp');
});

test('right click on a character, a place and a research note in a book', async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  const cast = page.getByRole('region', { name: 'Characters and places' });
  await cast.getByRole('button', { name: 'Add a character or place' }).click();
  await page.getByRole('button', { name: 'New character' }).click();
  const castItem = cast.locator('.research-item').first();
  await castItem.click({ button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Rename…' }).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Rose');
  await page.keyboard.press('Enter');
  await expect(cast.locator('.research-item .grow')).toHaveText(['Rose']);
  await cast.locator('.research-item', { hasText: 'Rose' }).click({ button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Make it a place' }).click();
  await expect(cast.locator('.research-item .cast-avatar.place')).toHaveCount(1);
  await cast.locator('.research-item', { hasText: 'Rose' }).click({ button: 'right' });
  await expect(menu(page).getByRole('menuitem', { name: 'Open to the side' })).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await menu(page).getByRole('menuitem', { name: 'Delete' }).click();
  await expect(cast.locator('.research-item')).toHaveCount(0);

  const research = page.getByRole('region', { name: 'Research', exact: true });
  await research.getByRole('button', { name: 'Add research' }).click();
  await page.getByRole('button', { name: 'New research note' }).click();
  await page.keyboard.type('Tide tables');
  await research.locator('.research-item', { hasText: 'Tide tables' }).click({ button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Rename…' }).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Tides');
  await page.keyboard.press('Enter');
  await expect(research.locator('.research-item .grow')).toHaveText(['Tides']);
  await research.locator('.research-item', { hasText: 'Tides' }).click({ button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Move to Trash' }).click();
  await expect(research.locator('.research-item')).toHaveCount(0);
});
