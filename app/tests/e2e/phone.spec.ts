import { expect, test } from '@playwright/test';

// Writing on a phone: flowing text at a comfortable size (never a whole page shrunk to the
// screen, even with page view on), chapters like notes, and a tap below the text carries on there.

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

type Crumpet = Record<string, (...a: unknown[]) => { id: string }>;

test('a note and a chapter are flowing text on a phone, even with page view on', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    c.updateSettings({ pageView: { notes: true, projects: true } });
    c.createProject('The Lighthouse');
    c.createNote({ title: 'Morning pages' });
  });
  const library = page.getByRole('navigation', { name: 'Notebooks' });

  // The note: no page, no page view in its menu.
  await library.getByRole('button', { name: /^All notes/ }).click();
  await page.getByRole('region', { name: 'Notes', exact: true }).locator('.card', { hasText: 'Morning pages' }).click();
  const text = page.locator('.note-pane .note-editor[contenteditable="true"]');
  await expect(text).toBeVisible();
  await expect(page.locator('.note-body.paged')).toHaveCount(0);
  await page.locator('.note-pane').getByRole('button', { name: 'More', exact: true }).click();
  await expect(page.getByRole('button', { name: /Page view/ })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // A tap in the empty space below the text carries on at its end.
  await text.click();
  await page.keyboard.type('The tide came in early.');
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.touchscreen.tap(200, 760);
  await expect(text).toBeFocused();
  await page.keyboard.type(' Grey and quiet.');
  await expect(text).toHaveText('The tide came in early. Grey and quiet.');

  // A chapter: flowing, in the writing font and size rather than the manuscript's 12pt.
  await page.getByRole('button', { name: 'Back to notes' }).click();
  await page.getByRole('button', { name: 'Back to the library' }).click();
  await library.getByRole('button', { name: /^The Lighthouse/ }).click();
  await page.getByRole('region', { name: 'Outline' }).locator('.outline-chapter').first().click();
  const chapter = page.locator('section[aria-label="Chapter"] .note-editor[contenteditable="true"]');
  await chapter.click();
  await page.keyboard.type('The lamp had not been lit.');
  await expect(page.locator('section[aria-label="Chapter"] .note-body.paged')).toHaveCount(0);
  await expect(chapter.locator('.blk-paragraph').first()).toHaveCSS('font-size', '19px');
  await page.getByRole('button', { name: 'Chapter options' }).click();
  await expect(page.getByRole('button', { name: /Page view/ })).toHaveCount(0);
});
