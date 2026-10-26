import { expect, test } from '@playwright/test';

// Echoes (a word used again soon after), long sentences, and every place of the word the caret is on, lit in the
// text from the Writing tab.

const lit = (page: import('@playwright/test').Page) => page.evaluate(() => [...((CSS as unknown as { highlights: Map<string, Set<Range>> }).highlights.get('crumpet-focus') ?? [])].map((r) => r.toString()));

test('the Writing tab lights up echoes, long sentences and the word at the caret', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 880 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbarAll: true }));
  await page.getByRole('navigation', { name: 'Notebooks' }).getByRole('button', { name: 'New note', exact: true }).click();
  await page.keyboard.type('Scene');
  await page.keyboard.press('Enter');
  const long = `She walked ${'and walked '.repeat(18)}until the lighthouse rose out of the fog at last.`;
  await page.keyboard.insertText(`The lamp flickered. She trimmed the lamp and the wick, then the wick caught. ${long}`);
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ right: true, rightTab: 'writing' }));
  const tab = page.getByRole('tabpanel', { name: 'Writing' });

  // Echoes: lamp, lamp, wick, wick (and walked, walked… in the long sentence).
  await tab.getByRole('button', { name: 'Echoes' }).click();
  await expect(tab.locator('.focus-found')).toContainText('within 30 words');
  await expect.poll(() => lit(page)).toEqual(expect.arrayContaining(['lamp', 'wick']));
  expect((await lit(page)).filter((w) => w === 'lamp')).toHaveLength(2);

  // Long sentences: the one over 35 words.
  await tab.getByRole('button', { name: 'Long sentences' }).click();
  await expect(tab.locator('.focus-found')).toContainText('1 found');
  await expect.poll(() => lit(page)).toEqual([long]);

  // The word at the caret, everywhere: it follows the caret.
  await tab.getByRole('button', { name: 'Same word as the caret' }).click();
  const editor = page.locator('.note-editor .blk-paragraph').first();
  await editor.click({ position: { x: 1, y: 6 } });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(tab.locator('.focus-found')).toContainText('of “lamp”');
  await expect.poll(() => lit(page)).toEqual(['lamp', 'lamp']);
  await page.keyboard.press('Control+ArrowRight');
  await page.keyboard.press('Control+ArrowRight');
  await expect(tab.locator('.focus-found')).toContainText('of “flickered”');
  await expect.poll(() => lit(page)).toEqual(['flickered']);
  await tab.getByRole('button', { name: 'Stop highlighting' }).click();
  await expect.poll(() => lit(page)).toEqual([]);
});
