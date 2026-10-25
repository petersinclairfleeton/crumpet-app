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

test('on a phone the text size is a pinch away, or in the ··· menu', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.createNote({ title: 'Morning pages' }));
  const library = page.getByRole('navigation', { name: 'Notebooks' });
  await library.getByRole('button', { name: /^All notes/ }).click();
  await page.getByRole('region', { name: 'Notes', exact: true }).locator('.card', { hasText: 'Morning pages' }).click();
  const text = page.locator('.note-pane .note-editor[contenteditable="true"]');
  await text.click();
  await page.keyboard.type('The tide came in early.');
  const size = () => text.evaluate((el) => getComputedStyle(el).fontSize);
  await expect.poll(size).toBe('19px');

  // The menu: A+ twice, A− once.
  await page.locator('.note-pane').getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Bigger text' }).click();
  await page.getByRole('button', { name: 'Bigger text' }).click();
  await page.getByRole('button', { name: 'Smaller text' }).click();
  await expect(page.getByRole('group', { name: 'Text size' })).toContainText('20');
  await expect.poll(size).toBe('20px');
  await page.keyboard.press('Escape');

  // Two fingers spread apart: bigger, and kept.
  await page.locator('.note-scroll').evaluate((el) => {
    const box = el.getBoundingClientRect();
    const y = box.top + 200;
    const at = (id: number, x: number) => new Touch({ identifier: id, target: el, clientX: x, clientY: y });
    const send = (type: string, a: number, b: number) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [at(1, a), at(2, b)], changedTouches: [at(1, a), at(2, b)] }));
    send('touchstart', 150, 230);
    send('touchmove', 130, 250);
    send('touchmove', 110, 270);
    send('touchend', 110, 270);
  });
  // 80px apart to 160: twice the size, up to the largest there is (28px).
  await expect.poll(size).toBe('28px');
  expect(await page.evaluate(() => (window as unknown as { crumpet: { getState(): { settings: { noteSize?: number } } } }).crumpet.getState().settings.noteSize)).toBe(28);
});

test('on a phone, Preview pages shows how a note and a chapter fall on pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    c.createProject('The Lighthouse');
    c.createNote({ title: 'Morning pages' });
  });
  const library = page.getByRole('navigation', { name: 'Notebooks' });
  await library.getByRole('button', { name: /^All notes/ }).click();
  await page.getByRole('region', { name: 'Notes', exact: true }).locator('.card', { hasText: 'Morning pages' }).click();
  await page.locator('.note-pane .note-editor[contenteditable="true"]').click();
  await page.keyboard.type('The tide came in early.');

  await page.locator('.note-pane').getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Preview pages' }).click();
  const preview = page.getByRole('dialog', { name: 'Preview pages' });
  await expect(preview).toContainText('1 page');
  const sheet = preview.locator('.preview-page');
  await expect(sheet).toHaveCount(1);
  await expect(sheet).toContainText('The tide came in early.');
  // Fitted to the screen, or as big as on paper (a Letter page, 8.5 inches across).
  expect(Math.round((await sheet.boundingBox())!.width)).toBe(390 - 32);
  await preview.getByRole('button', { name: 'Actual size' }).click();
  await expect.poll(async () => Math.round((await sheet.boundingBox())!.width)).toBe(816);
  // Print… goes on to the print window.
  await preview.getByRole('button', { name: 'Print…' }).click();
  await expect(page.getByRole('dialog', { name: 'Print' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Print' }).getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.page-preview')).toHaveCount(0);

  // A chapter too.
  await page.getByRole('button', { name: 'Back to notes' }).click();
  await page.getByRole('button', { name: 'Back to the library' }).click();
  await library.getByRole('button', { name: /^The Lighthouse/ }).click();
  await page.getByRole('region', { name: 'Outline' }).locator('.outline-chapter').first().click();
  await page.locator('section[aria-label="Chapter"] .note-editor[contenteditable="true"]').click();
  await page.keyboard.type('The lamp had not been lit.');
  await page.getByRole('button', { name: 'Chapter options' }).click();
  await page.getByRole('button', { name: 'Preview pages' }).click();
  await expect(preview.locator('.preview-page')).toHaveCount(1);
  await expect(preview.locator('.preview-page')).toContainText('The lamp had not been lit.');
  await preview.getByRole('button', { name: 'Done' }).click();
  await expect(preview).toHaveCount(0);
});
