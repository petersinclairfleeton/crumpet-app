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

test('a note’s picture shows whole in the list, in its own shape, beside its text', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  const pic = (w: number, h: number) =>
    page.evaluate(([w, h]) => {
      const k = document.createElement('canvas');
      k.width = w;
      k.height = h;
      k.getContext('2d')!.fillRect(0, 0, w, h);
      return k.toDataURL();
    }, [w, h]);
  const tall = await pic(300, 800);
  const wide = await pic(800, 450);
  await page.evaluate(([tall, wide]) => {
    const s = (window as unknown as { crumpet: { createNote(n: object): void } }).crumpet;
    s.createNote({ title: 'A tall picture with a long title that runs on and on', doc: { blocks: [{ id: 'p', type: 'image', src: tall, runs: [] }] } });
    s.createNote({ title: 'A wide picture with a long title that runs on and on', doc: { blocks: [{ id: 'q', type: 'image', src: wide, runs: [] }] } });
  }, [tall, wide]);
  const card = (name: string) => list(page).locator('.card', { hasText: name });
  for (const all of [false, true]) {
    await page.evaluate((all) => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbarAll: all }), all);
    // A tall picture's box is narrow, a wide one's wider (16:9 → 100px by 56), and the text stops short of either.
    await expect.poll(async () => Math.round((await card('A tall').locator('.card-thumb').boundingBox())!.width)).toBe(40);
    await expect.poll(async () => Math.round((await card('A wide').locator('.card-thumb').boundingBox())!.width)).toBe(100);
    for (const name of ['A tall', 'A wide']) {
      const thumb = card(name).locator('.card-thumb');
      await expect(thumb).toHaveCSS('background-size', 'contain');
      const t = (await thumb.boundingBox())!;
      const title = (await card(name).locator('.card-title').boundingBox())!;
      expect(title.x + title.width).toBeLessThanOrEqual(t.x);
    }
  }
});
