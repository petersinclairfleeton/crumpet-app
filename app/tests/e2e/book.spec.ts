import { expect, test } from '@playwright/test';

// A print-ready book: Export → Print-ready book lays the book out for a printer (KDP, IngramSpark): its trim
// size, chapters opening in a design on right-hand pages, scene breaks as an ornament, and the text of each page
// moved towards its outside edge, so the margin at the spine is the wider.

test('a print-ready book: trim size, chapter openings, right-hand chapter starts and margins mirrored for the spine', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbarAll: true, name: 'Ann Writer' }));
  const id = await page.evaluate(async () => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    type C = { createProject(n: string): { id: string }; getState(): { chapters: { id: string; projectId: string }[] }; addChapter(p: string): { id: string }; setChapterTitle(id: string, t: string): void; setChapterDoc(id: string, d: unknown): void; openProject(id: string): void };
    const c = (window as unknown as { crumpet: C }).crumpet;
    const p = c.createProject('The Lighthouse');
    const first = c.getState().chapters.find((x) => x.projectId === p.id)!;
    c.setChapterTitle(first.id, 'Arrival');
    const para = 'The boat left her at the foot of the steps, and the keeper came down to meet her with a lamp held high. ';
    c.setChapterDoc(first.id, md.fromMarkdown(`${para.repeat(9)}\n\n${para.repeat(9)}\n\n* * *\n\n${para.repeat(9)}\n\n${para.repeat(9)}`));
    const second = c.addChapter(p.id);
    c.setChapterTitle(second.id, 'Storm');
    c.setChapterDoc(second.id, md.fromMarkdown(para.repeat(4)));
    c.openProject(p.id);
    return p.id;
  });
  await page.evaluate(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => {
      (window as unknown as { printed: number }).printed++;
    };
  });
  const outline = page.getByRole('region', { name: 'Outline' });
  await outline.getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('button', { name: /^Export/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Export The Lighthouse' });
  await dialog.getByRole('radio', { name: /Print-ready book/ }).click();
  const form = dialog.getByRole('group', { name: 'Book design' });
  await form.getByLabel('Trim size').selectOption('6x9');
  await form.getByRole('radio', { name: 'Modern' }).click();
  await expect(dialog.locator('.book-page')).toContainText('Arrival');
  // Kept with the book.
  const design = await page.evaluate((pid) => (window as unknown as { crumpet: { project(id: string): { design?: object } } }).crumpet.project(pid).design, id);
  expect(design).toMatchObject({ trim: '6x9', headings: 'modern', recto: true, dropCaps: true, sceneBreak: 'fleuron' });

  await dialog.getByRole('button', { name: 'Make a print-ready PDF' }).click();
  const printDialog = page.getByRole('dialog', { name: 'Print' });
  await expect.poll(() => printDialog.locator('.print-thumb').count(), { timeout: 20_000 }).toBeGreaterThan(4);
  const pages = page.locator('.print-root .print-pages > .print-page');
  // 6 × 9 inches.
  expect(await pages.first().evaluate((el) => [el.style.width, el.style.height])).toEqual(['576px', '864px']);
  // The title page, a blank left-hand page, then chapter one on a right-hand page (its number, then its title); chapter two on a right-hand page too.
  const kinds = await pages.evaluateAll((els) => els.map((el) => (el.classList.contains('blank') ? 'blank' : (el.querySelector("[data-style='c-chapter-number']")?.textContent ?? '-'))));
  expect(kinds.slice(0, 3)).toEqual(['-', 'blank', '1']);
  expect(kinds.indexOf('2') % 2).toBe(0);
  await expect(pages.nth(2).locator('.blk-heading1')).toHaveText('Arrival');
  // The title page: the title and the author (no word count, as a manuscript's has).
  await expect(pages.nth(0)).toContainText('The Lighthouse');
  await expect(pages.nth(0)).toContainText('Ann Writer');
  await expect(pages.nth(0)).not.toContainText('words');
  // A drop cap opens the chapter; the scene break is a fleuron.
  expect(await pages.nth(2).locator('.blk-heading1 + .blk-paragraph').first().evaluate((el) => getComputedStyle(el, '::first-letter').float)).toBe('left');
  await expect(page.locator(".print-root .print-pages [data-style='scenebreak']").first()).toHaveText('❦');
  // Right-hand pages' text moves right (away from the spine on their left), left-hand pages' left.
  const shift = (i: number) => pages.nth(i).locator('.page-text').evaluate((el) => parseFloat(el.style.translate));
  expect(await shift(2)).toBeGreaterThan(0);
  expect(await shift(3)).toBeLessThan(0);
  // Running heads: the author over a left-hand page, none over a chapter's first page.
  await expect(pages.nth(3).locator('.hf-page')).toContainText('Ann Writer');
  await expect(pages.nth(3).locator('.hf-page')).toContainText('4');
  await expect(pages.nth(2).locator('.hf-page')).not.toContainText('Ann Writer');

  // Printed (or saved as a PDF) at the trim size.
  const count = await printDialog.locator('.print-thumb').count();
  await printDialog.getByRole('button', { name: `Print ${count} pages` }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  const text = pdf.toString('latin1');
  expect(text).toMatch(/MediaBox\s*\[\s*0 0 432 648\s*\]/);
  expect((text.match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(count);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('.print-root')).toHaveCount(0);
});
