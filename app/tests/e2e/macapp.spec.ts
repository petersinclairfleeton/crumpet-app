import { type Page, expect, test } from '@playwright/test';

// The Mac app (desktop/) puts its red, yellow and green window buttons at 16,15 (main.cjs's
// trafficLightPosition), about 60 by 14 points. The page is told it's the Mac app by
// preload.cjs's crumpetDesktop; here a stand-in says so, and nothing of the app may sit under
// the buttons.

type Fullscreen = (on: boolean) => void;
const BUTTONS = { left: 16, top: 15, right: 16 + 60, bottom: 15 + 14 };

async function asMacApp(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 800 });
  await page.addInitScript(() => {
    const w = window as unknown as { crumpetDesktop: object; fullscreen?: Fullscreen };
    w.crumpetDesktop = { platform: 'darwin', onFullScreen: (fn: Fullscreen) => { w.fullscreen = fn; } };
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-shell', 'mac');
  await expect(page.locator('.app')).toBeVisible();
}

/** The things drawn at the top left, under the buttons' corner of the window. A sheet's edge
 *  counts too, unless `flush` (the full bar's look runs its sidebar under the buttons, as a Mac
 *  sidebar does, and starts what's in it below them). */
async function underButtons(page: Page, flush = false): Promise<string[]> {
  return page.evaluate(([b, flush]) => {
    const hits: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(flush ? 'button, input, h1, .brand, .rail-mark' : '.sidebar, .rail, .list, .topbar, button, input, h1, .brand, .rail-mark')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
      if (r.left < b.right && r.right > b.left && r.top < b.bottom + 4 && r.bottom > b.top) hits.push(el.className || el.tagName);
    }
    return hits;
  }, [BUTTONS, flush] as const);
}

test('the Mac app: the window buttons have room of their own in every layout', async ({ page }) => {
  await asMacApp(page);
  const set = (p: object) => page.evaluate((x) => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings(x), p);
  await set({ guideSeen: true });
  // The calm look: the sidebar is a sheet on the wash, below the buttons' strip.
  await expect(page.locator('.sidebar.calm')).toBeVisible();
  expect(await underButtons(page)).toEqual([]);
  expect((await page.locator('.sidebar.calm').boundingBox())!.y).toBeGreaterThanOrEqual(BUTTONS.bottom + 8);
  // Folded to its strip (the writing room).
  await set({ layout: { sidebar: 'icons', list: false } });
  await expect(page.locator('.rail')).toBeVisible();
  expect(await underButtons(page)).toEqual([]);
  // The full formatting bar's look, sidebar open.
  await set({ toolbarAll: true, layout: { sidebar: 'full' } });
  await expect(page.locator('.sidebar')).toBeVisible();
  expect(await underButtons(page, true)).toEqual([]);
  // Full screen hides the buttons, and their strip goes.
  await set({ toolbarAll: false });
  await expect(page.locator('.sidebar.calm')).toBeVisible();
  await page.evaluate(() => (window as unknown as { fullscreen: Fullscreen }).fullscreen(true));
  await expect.poll(async () => (await page.locator('.sidebar.calm').boundingBox())!.y).toBeLessThan(20);
  await page.evaluate(() => (window as unknown as { fullscreen: Fullscreen }).fullscreen(false));
  await expect.poll(async () => (await page.locator('.sidebar.calm').boundingBox())!.y).toBeGreaterThan(40);
});

test('the Mac app: a narrow window keeps the buttons clear too', async ({ page }) => {
  await asMacApp(page, 730);
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ guideSeen: true, toolbarAll: true }));
  expect(await underButtons(page)).toEqual([]);
});

test('the Windows app and the website keep no strip for window buttons', async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { crumpetDesktop: object }).crumpetDesktop = { platform: 'win32' }; });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-shell', 'desktop');
  await expect(page.locator('.titlebar-drag')).toHaveCount(0);
  await expect(page.locator('.sidebar.calm')).toBeVisible();
  expect((await page.locator('.sidebar.calm').boundingBox())!.y).toBeLessThan(20);
});

test('the menu bar: File, Format and View items do what their buttons and shortcuts do', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    const w = window as unknown as { crumpetDesktop: object; menu?: (id: string) => void };
    w.crumpetDesktop = { platform: 'darwin', onCommand: (fn: (id: string) => void) => { w.menu = fn; } };
  });
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  const menu = (id: string) => page.evaluate((x) => (window as unknown as { menu(id: string): void }).menu(x), id);
  const st = () => page.evaluate(() => (window as unknown as { crumpet: { getState(): { notes: { title: string; daily?: string }[]; notebooks: { name: string }[]; settings: { layout?: { sidebar?: string } } } } }).crumpet.getState());
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ guideSeen: true, toolbarAll: false }));
  // File → New Note, then Format → Bold on what's typed.
  await menu('new-note');
  await expect.poll(async () => (await st()).notes.length).toBe(1);
  await page.keyboard.type('Title');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Strong words');
  await page.keyboard.press('Shift+Home');
  await menu('bold');
  await expect(page.locator('.editor strong, .editor b').first()).toHaveText('Strong words');
  // File → New Daily Note: under Today, no notebook made.
  await menu('new-daily');
  await expect.poll(async () => (await st()).notes.filter((n) => n.daily).length).toBe(1);
  expect((await st()).notebooks).toEqual([]);
  // File → New Notebook…: named in the sidebar.
  await menu('new-notebook');
  await expect(page.getByLabel('Notebook name', { exact: true })).toBeFocused();
  await page.keyboard.type('Journal');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await st()).notebooks.map((n) => n.name)).toEqual(['Journal']);
  // View → the sidebar.
  await menu('toggle-sidebar');
  await expect.poll(async () => (await st()).settings.layout?.sidebar).toBe('hidden');
});
