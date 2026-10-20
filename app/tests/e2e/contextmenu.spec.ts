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
