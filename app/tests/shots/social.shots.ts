import { type Browser, type Page, devices, expect, test } from '@playwright/test';
import { book, crumpet, inBook, openChapter, outline, scrollTo, shotWithCaret, start } from './book';

// Pictures for social posts, taken from the real app with the made-up book the
// home page uses (The Lighthouse: no one's real name or writing). PNG at device
// scale 2, 16:9 (X's shape for one picture), the phone's at the phone's own size.
// Run again whenever the app's look changes:
//   CHROMIUM_PATH=… npx playwright test -c playwright.shots.config.ts social
// They land in docs/marketing/social/.

const OUT = '../docs/marketing/social';

test.use({ deviceScaleFactor: 2, viewport: { width: 1600, height: 900 } });

async function shot(page: Page, name: string) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, type: 'png' });
}

test('1 · the writing room, nothing writing for you', async ({ page }) => {
  await start(page);
  const editor = page.locator('.note-editor').first();
  await crumpet(page, 'updateLayout', { list: false, right: false });
  await page.waitForTimeout(500);
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('She turned back to the gap where the page had been and ran her thumb along the cut edge. Whatever had happened on the fifteenth of October, Tam had written it down first.', { delay: 2 });
  await crumpet(page, 'updateSettings', { typewriter: { scroll: true, fade: true } });
  await page.keyboard.press('End');
  await scrollTo(page, '“Your grandmother asked me', 2);
  await shotWithCaret(page, `${OUT}/01-writing-room.png`);
});

test('2 · your files, in your own Drive or folder', async ({ page }) => {
  await start(page);
  await page.evaluate(() => (window as unknown as { crumpet: { setView(v: object): void } }).crumpet.setView({ kind: 'all' }));
  await page.getByRole('navigation', { name: 'Notebooks' }).getByRole('button', { name: 'Settings and more' }).click();
  await page.getByRole('button', { name: 'Settings…' }).click();
  await page.getByRole('tab', { name: 'Sync and storage' }).click();
  await expect(page.getByRole('group', { name: /Where/ })).toBeVisible();
  await shot(page, '02-your-own-folder');
});

test('3 · the corkboard', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await start(page);
  await outline(page).getByRole('button', { name: 'Cards' }).click();
  await expect(page.getByRole('region', { name: 'Corkboard' })).toBeVisible();
  await shot(page, '03-corkboard');
});

test('5 · drafts of a chapter', async ({ page }) => {
  await start(page, 'The boat leaves');
  await inBook(
    page,
    `const id = ids['The boat leaves'];
     c.newDraft(id, { note: 'Start on the boat, not the steps' });
     return import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts').then((md) => {
       c.setChapterDoc(id, md.fromMarkdown(arg));
     });`,
    'The boat came in on the last of the tide, and the skipper would not take it closer than the steps.\n\n“You’ll not want to be here after dark,” he said, as if she had asked.\n\nMara stood on the wet stone with her one bag and looked up. The tower was smaller than she remembered, the white paint gone grey, but the lamp room still caught the last of the light as if it were waiting for something.',
  );
  await openChapter(page, 'The boat leaves');
  await crumpet(page, 'updateLayout', { right: false });
  await shot(page, '05-drafts');
});

test('6 · in this chapter: who’s in it', async ({ page }) => {
  await start(page);
  await crumpet(page, 'updateLayout', { list: true, right: true, rightTab: 'chapter' });
  await expect(page.getByRole('complementary', { name: 'Right sidebar' })).toBeVisible();
  await shot(page, '06-in-this-chapter');
});

test('7 · echoes and adverbs, highlighted', async ({ page }) => {
  await start(page);
  await crumpet(page, 'updateLayout', { list: false, right: true, rightTab: 'writing' });
  const side = page.getByRole('complementary', { name: 'Right sidebar' });
  await side.getByRole('group', { name: 'Highlight in the text' }).getByRole('button', { name: /echo/i }).click();
  await side.getByRole('region', { name: 'Linguistic focus' }).scrollIntoViewIfNeeded();
  await shot(page, '07-echoes');
});

test('8 · grammar, checked on the device', async ({ page }) => {
  await start(page, 'Paraffin and salt');
  await inBook(
    page,
    `return import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts').then((md) => {
       c.setChapterDoc(ids['Paraffin and salt'], md.fromMarkdown(arg));
     });`,
    '“Before the electric,” Tam said, “you lit it by hand. Every night. You didn’t miss.”\n\nHe showed her the the burner, its brass gone dark with years of hands, and the little pump that fed it. Their was a smell of paraffin still, under the salt.\n\n“Your grandmother could of done it with her eyes shut,” he said. “She done it the night of the storm, when I couldn’t.”\n\nMara put her hand on the cold glass and said nothing.',
  );
  await openChapter(page, 'Paraffin and salt');
  await crumpet(page, 'updateLayout', { list: false, right: true, rightTab: 'check' });
  const side = page.getByRole('complementary', { name: 'Right sidebar' });
  await side.getByRole('tab', { name: 'Grammar' }).click();
  await side.getByRole('button', { name: 'Check grammar' }).click();
  await expect(side.getByRole('region', { name: 'Grammar' }).locator('.btn.small').first()).toBeVisible({ timeout: 60_000 });
  await shot(page, '08-grammar');
});

test('9 · a print-ready paperback', async ({ page }) => {
  await start(page);
  await outline(page).getByRole('button', { name: 'Book options' }).click();
  await page.getByRole('button', { name: /^Export/ }).click();
  const dialog = page.getByRole('dialog', { name: /^Export/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: /Print-ready book/ }).click();
  await expect(dialog.getByRole('group', { name: 'Book design' })).toBeVisible();
  await page.waitForTimeout(1500);
  await shot(page, '09-print-ready');
});

test('10 · where the book has been sent', async ({ page }) => {
  await start(page);
  await inBook(
    page,
    `const of = { kind: 'project', id: p.id };
     const s = (id, to, sent, status, extra) => ({ id, title: 'The Lighthouse', of, to, kind: 'agent', sent, status, ...extra });
     c.updateSettings({ submissions: [
       s('s1', 'Harbour Lane Literary (made up)', '2026-09-02', 'full', { replied: '2026-10-14', wait: 60, notes: 'Asked for the full manuscript' }),
       s('s2', 'North Light Agency (made up)', '2026-09-02', 'partial', { replied: '2026-09-29', wait: 45 }),
       s('s3', 'Saltmarsh & Reed (made up)', '2026-09-09', 'sent', { wait: 56 }),
       s('s4', 'The Tidewater Agency (made up)', '2026-08-19', 'declined', { replied: '2026-09-21', notes: 'Kind note: loved the voice' }),
       s('s5', 'Fathom Books (made up)', '2026-08-19', 'sent', { wait: 42 }),
       { id: 's6', title: 'The fifteenth of October (story)', to: 'The Quay Review (made up)', kind: 'magazine', sent: '2026-07-30', status: 'noreply', wait: 90 },
     ] });`,
  );
  await page.keyboard.press('Control+p');
  await page.keyboard.type('Submissions');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  await shot(page, '10-submissions');
});

async function phone(browser: Browser) {
  const context = await browser.newContext({ ...devices['iPhone 15'], baseURL: test.info().project.use.baseURL });
  return { context, page: await context.newPage() };
}

test('4 · the book on an iPhone', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await book(page);
  await page.waitForTimeout(1000);
  await page.reload();
  await page.waitForFunction(() => 'crumpet' in window);
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: /The Lighthouse/ }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/04-iphone.png`, type: 'png' });
  await context.close();
});
