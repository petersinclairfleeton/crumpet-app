import { type Page, expect, test } from '@playwright/test';

// The home page's pictures, taken from the real app with a made-up book (no one's
// real name or writing). PNG, at device scale 2, so the narrowest is 2,000 pixels
// wide. Run again whenever the app's look changes:
//   CHROMIUM_PATH=… npx playwright test -c playwright.shots.config.ts landing
// They land in docs/marketing/screenshots/.

import { MORE, TYPED, book, crumpet, openChapter, scrollTo, shotWithCaret as caretShot } from './book';

const OUT = '../docs/marketing/screenshots';

test.use({ deviceScaleFactor: 2 });

async function shot(page: Page, name: string) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, type: 'png' });
}

// The chapter the hero shows: long enough that the page opens in its middle.
const shotWithCaret = (page: Page, name: string) => caretShot(page, `${OUT}/${name}.png`);

test('the home page’s pictures', async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 945 });
  await book(page);
  // Reload so this session starts now: what's typed below is the session's words.
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Notebooks' })).toBeVisible();
  await openChapter(page, 'The logbook');
  const editor = page.locator('.note-editor').first();
  await expect(editor).toBeVisible();

  // The hero: the writing room (the sidebar folded to its strip), the middle of a
  // chapter, the writer at the end of what they've written so far.
  await crumpet(page, 'updateLayout', { list: false, right: false });
  await page.waitForTimeout(500);
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type(TYPED, { delay: 2 });
  await crumpet(page, 'updateSettings', { typewriter: { scroll: true } });
  await page.waitForTimeout(300);
  // Typewriter scrolling brings the line up the page; then a paragraph's start is put near the top.
  await crumpet(page, 'updateSettings', { typewriter: { scroll: true } });
  await page.keyboard.press('End');
  await scrollTo(page, '“Your grandmother asked me', 2);
  await shotWithCaret(page, 'hero');
  // The same with the other paragraphs faded back (Typewriter's fade).
  await crumpet(page, 'updateSettings', { typewriter: { scroll: true, fade: true } });
  await page.keyboard.press('End');
  await scrollTo(page, '“Your grandmother asked me', 2);
  await shotWithCaret(page, 'hero-typewriter');
  await crumpet(page, 'updateSettings', { typewriter: {} });

  // Characters and a target for the session: a character's card beside the chapter,
  // and the Writing tab's This session.
  await page.keyboard.press('Enter');
  await page.keyboard.type(MORE, { delay: 2 });
  await crumpet(page, 'updateLayout', { list: true, right: true, rightTab: 'writing' });
  const outline = page.getByRole('region', { name: 'Outline' });
  await outline.getByRole('button', { name: /^Characters & places/ }).click();
  await outline.locator('.research-item', { hasText: 'Mara' }).click();
  await expect(page.getByRole('region', { name: 'Character card' })).toBeVisible();
  await crumpet(page, 'updateLayout', { list: false });
  await scrollTo(page, 'Outside, the light was going', 90);
  await shot(page, 'characters-and-goals');
  await crumpet(page, 'openCast', null);

  // The outline and a chapter open: the two panels working together.
  await page.setViewportSize({ width: 1440, height: 900 });
  await crumpet(page, 'updateLayout', { list: true, right: false });
  await editor.evaluate((el) => (el.closest('.note-scroll') as HTMLElement).scrollTo(0, 0));
  await shot(page, 'outline');

  // The corkboard.
  // A little narrower and taller, so each part's four cards fill a row and all three parts show.
  await page.setViewportSize({ width: 1400, height: 1010 });
  await outline.getByRole('button', { name: 'Cards' }).click();
  await expect(page.getByRole('region', { name: 'Corkboard' })).toBeVisible();
  await shot(page, 'corkboard');
  await outline.getByRole('button', { name: 'Write', exact: true }).click();

  // Nothing but the page: focus mode, in a small window, at the chapter's opening with the caret in its text.
  await page.setViewportSize({ width: 1000, height: 680 });
  await crumpet(page, 'setFocusMode', true);
  await page.waitForTimeout(500);
  await editor.locator('[data-block]', { hasText: 'She read it standing up' }).click();
  await page.keyboard.press('End');
  await editor.evaluate((el) => (el.closest('.note-scroll') as HTMLElement).scrollTo(0, 0));
  await shotWithCaret(page, 'page-only');
});
