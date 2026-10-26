import { type Page, expect, test } from '@playwright/test';

// Grammar checking with Harper, on this device: the Check tab's Grammar pass, its fixes, and lines under the
// words as you write (Settings → Writing).

type Crumpet = { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] }; setDoc(id: string, doc: unknown): void; updateLayout(p: object): void; updateSettings(p: object): void };

async function noteWith(page: Page, md: string) {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.updateSettings({ toolbarAll: true, spelling: { lang: 'en-US' } }));
  await page.getByRole('navigation', { name: 'Notebooks' }).getByRole('button', { name: 'New note', exact: true }).click();
  await page.keyboard.type('Grammar');
  await page.evaluate(async (text) => {
    const { fromMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    c.setDoc(c.getState().selectedId, fromMarkdown(text));
  }, md);
}

const md = (page: Page) =>
  page.evaluate(async () => {
    const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: Crumpet }).crumpet.getState();
    return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
  });

/** The words under the grammar lines. */
const lined = (page: Page) => page.evaluate(() => [...((CSS as unknown as { highlights: Map<string, Set<Range>> }).highlights.get('crumpet-grammar') ?? [])].map((r) => r.toString()));

test('the Check tab’s Grammar pass: findings with fixes, lines under the words, ignoring and turning a rule off', async ({ page }) => {
  test.setTimeout(90_000);
  await noteWith(page, 'She walked to the the shop. This is an test.\n\nThe keeper waited by the stove.');
  await page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.updateLayout({ right: true, rightTab: 'check' }));
  const tab = page.getByRole('tabpanel', { name: 'Check' });
  await tab.getByRole('tab', { name: 'Grammar' }).click();
  await tab.getByRole('button', { name: 'Check grammar' }).click();
  const issues = tab.locator('.grammar-issue');
  await expect(issues.first()).toBeVisible({ timeout: 60_000 });
  // The repeated word and the wrong article, each with a fix; lines under them in the text.
  await expect(tab).toContainText('the the');
  await expect(tab).toContainText('indefinite article');
  await expect.poll(() => lined(page)).toEqual(expect.arrayContaining(['the the', 'an']));
  // Fix the article: the text changes, and the finding goes.
  const article = issues.filter({ hasText: 'indefinite article' });
  await article.getByRole('button', { name: 'a', exact: true }).click();
  await expect.poll(() => md(page)).toContain('This is a test.');
  await expect(tab).not.toContainText('indefinite article');
  // Ignore the repeated word: gone from the list and the text's lines.
  await issues.filter({ hasText: 'the the' }).getByRole('button', { name: 'Ignore' }).click();
  await expect(tab).not.toContainText('the the');
  await expect.poll(() => lined(page)).toEqual([]);
  await expect(tab.locator('.check-clear')).toBeVisible();
});

test('grammar as you write: lines appear after typing, right-click for the fix, and rules turned off stay off', async ({ page }) => {
  test.setTimeout(90_000);
  await noteWith(page, 'The lamp was lit.');
  await page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.updateSettings({ grammar: { live: true } }));
  const para = page.locator('.note-editor .blk-paragraph').first();
  await para.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' He go to the the harbour.');
  await expect.poll(() => lined(page), { timeout: 60_000 }).toEqual(expect.arrayContaining(['the the']));
  // Right-click inside the repeated words: the fix is at the top of the menu.
  const box = await page.evaluate(() => {
    const r = [...((CSS as unknown as { highlights: Map<string, Set<Range>> }).highlights.get('crumpet-grammar') ?? [])].find((x) => x.toString() === 'the the')!;
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  await page.mouse.click(box.x, box.y);
  await page.mouse.click(box.x, box.y, { button: 'right' });
  const menu = page.getByRole('menu');
  await expect(menu.locator('.menu-grammar')).toBeVisible();
  await menu.getByRole('menuitem').first().click();
  await expect.poll(() => md(page)).toMatch(/to the harbour/);
  await expect.poll(() => md(page)).not.toMatch(/the the/);
  // Turning the rule off from the Check tab keeps it off in Settings.
  await page.keyboard.press('End');
  await page.keyboard.type(' A a dog barked.');
  await page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.updateLayout({ right: true, rightTab: 'check' }));
  const tab = page.getByRole('tabpanel', { name: 'Check' });
  await tab.getByRole('tab', { name: 'Grammar' }).click();
  const repeat = tab.locator('.grammar-issue').filter({ hasText: 'A a' });
  await expect(repeat).toBeVisible({ timeout: 30_000 });
  await repeat.getByRole('button', { name: 'Turn off this rule' }).click();
  await expect(tab.locator('.grammar-issue').filter({ hasText: 'A a' })).toHaveCount(0, { timeout: 30_000 });
  const off = await page.evaluate(() => (window as unknown as { crumpet: { getState(): { settings: { grammar?: { off?: string[] } } } } }).crumpet.getState().settings.grammar?.off);
  expect(off?.length).toBe(1);
});
