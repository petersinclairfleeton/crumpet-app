import { type Page, expect, test } from '@playwright/test';

// A glossary of the book's invented words: a card of the kind Word or term, its pronunciation shown when hovered
// in the text, a misspelling offered the right spelling first, and the glossary at the end of an exported book.

type C = {
  createProject(n: string): { id: string };
  getState(): { chapters: { id: string; projectId: string }[] };
  setChapterDoc(id: string, d: unknown): void;
  addCastMember(p: string, k: string, n: string): { id: string };
  updateCastMember(p: string, id: string, patch: object): void;
  openCast(id: string | null): void;
  openProject(id: string, chapter?: string): void;
  setProjectMode(m: string): void;
  updateSettings(p: object): void;
};

const chapterText = (page: Page) => page.locator('section[aria-label="Chapter"] .note-editor[contenteditable="true"]');

/** Where a word is on the screen (its middle letters). */
async function wordAt(page: Page, word: string): Promise<{ x: number; y: number }> {
  return chapterText(page).evaluate((root, word) => {
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

test('a glossary of invented words: a card, a hover, the right spelling, and the end of the book', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(async () => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const c = (window as unknown as { crumpet: C }).crumpet;
    c.updateSettings({ toolbarAll: true });
    const p = c.createProject('The Lighthouse');
    const first = c.getState().chapters.find((x) => x.projectId === p.id)!;
    c.setChapterDoc(first.id, md.fromMarkdown('She spoke Elvaryn to the gulls, and they answered in Elvarin.'));
    c.openCast(null);
    c.openProject(p.id, first.id);
    c.setProjectMode('chapter');
  });

  // A new word for the glossary, from the cards' + menu.
  await page.getByRole('button', { name: 'Add a character or place' }).click();
  await page.getByRole('button', { name: 'New word or term' }).click();
  const card = page.getByRole('region', { name: 'Word or term card' });
  await card.getByLabel('Name', { exact: true }).fill('Elvarin');
  await card.getByLabel('Description').fill('The old tongue of the coast.');
  await card.getByLabel('Pronunciation').fill('el-VAR-in');
  await card.getByLabel('Kind of word').fill('noun');
  await page.evaluate(() => (window as unknown as { crumpet: C }).crumpet.openCast(null));

  // Right-clicking the misspelling offers the glossary's spelling first.
  const wrong = await wordAt(page, 'Elvaryn');
  await page.mouse.click(wrong.x, wrong.y, { button: 'right' });
  const menu = page.locator('.context-menu');
  await expect(menu.getByRole('menuitem', { name: 'Elvarin', exact: true })).toBeVisible({ timeout: 15000 });
  // First of the suggestions (after the bold, italic… buttons).
  expect((await menu.getByRole('menuitem').allTextContents()).filter((t) => t.length > 1)[0]).toBe('Elvarin');
  await menu.getByRole('menuitem', { name: 'Elvarin', exact: true }).click();
  await expect(chapterText(page)).toContainText('She spoke Elvarin to the gulls');

  // Hovering over the word shows what it means and how it's said.
  const right = await wordAt(page, 'Elvarin');
  await page.mouse.move(right.x, right.y);
  const tip = page.getByRole('tooltip');
  await expect(tip).toContainText('(el-VAR-in) · Word or term');
  await expect(tip).toContainText('The old tongue of the coast.');
  await page.mouse.move(5, 5);

  // Export with the glossary at the end.
  await page.getByRole('region', { name: 'Outline' }).getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('button', { name: /^Export/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Export The Lighthouse' });
  await dialog.getByLabel(/Glossary at the end/).check();
  await expect(dialog.getByLabel(/Glossary at the end/)).toHaveAccessibleName('Glossary at the end (1 word)');
  await dialog.getByLabel('Another format').selectOption('txt');
  const [txt] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download as Plain text' }).click()]);
  const body = await new Promise<string>((done) => {
    void txt.createReadStream().then((st) => {
      let out = '';
      st.on('data', (d: { toString(): string }) => (out += d.toString()));
      st.on('end', () => done(out));
    });
  });
  expect(body).toContain('She spoke Elvarin to the gulls');
  expect(body.trimEnd().endsWith('GLOSSARY\n\nElvarin (el-VAR-in) noun. The old tongue of the coast.')).toBe(true);
});
