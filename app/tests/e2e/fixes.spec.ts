import { type Page, expect, test } from '@playwright/test';

// A long title shows all its lines, and a picture in a note shows whole in the note list.

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Notebooks' });
const list = (page: Page) => page.getByRole('region', { name: 'Notes', exact: true });

/** True when a text area shows all of its text (none hidden below its bottom edge). */
const whole = (page: Page, label: string) => page.getByLabel(label).evaluate((el: HTMLTextAreaElement) => el.scrollHeight <= el.clientHeight + 1);

test('a title of several lines shows them all, even after the window narrows', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await sidebar(page).getByRole('button', { name: 'New note', exact: true }).click();
  await page.keyboard.type('The keeper of the lighthouse on the far rock writes to his sister about the winter storms');
  expect(await whole(page, 'Title')).toBe(true);
  await page.setViewportSize({ width: 900, height: 720 });
  await expect.poll(() => whole(page, 'Title')).toBe(true);
  await page.setViewportSize({ width: 1400, height: 720 });
  await page.setViewportSize({ width: 800, height: 720 });
  await expect.poll(() => whole(page, 'Title')).toBe(true);
});

test('a note’s picture shows whole in the list, beside its text', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  const pic = await page.evaluate(() => {
    const k = document.createElement('canvas');
    k.width = 300;
    k.height = 800;
    k.getContext('2d')!.fillRect(0, 0, 300, 800);
    return k.toDataURL();
  });
  await page.evaluate((src) => {
    const s = (window as unknown as { crumpet: { createNote(n: object): void } }).crumpet;
    s.createNote({ title: 'A tall picture with a long title that runs on and on', doc: { blocks: [{ id: 'p', type: 'image', src, runs: [] }] } });
  }, pic);
  for (const all of [false, true]) {
    await page.evaluate((all) => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbarAll: all }), all);
    const card = list(page).locator('.card').first();
    const thumb = card.locator('.card-thumb');
    await expect(thumb).toHaveCSS('background-size', 'contain');
    const t = (await thumb.boundingBox())!;
    const title = (await card.locator('.card-title').boundingBox())!;
    expect(title.x + title.width).toBeLessThanOrEqual(t.x);
  }
});
