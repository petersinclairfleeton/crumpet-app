import { expect, test } from '@playwright/test';

// Each chapter's point of view, goal and tension (the Plan's Point of view tab), the tension chart, each point of
// view's share of the book, and Cards coloured by point of view.

type C = { createProject(n: string): { id: string }; getState(): { chapters: { id: string; projectId: string }[] }; addChapter(p: string): { id: string }; setChapterTitle(id: string, t: string): void; setChapterDoc(id: string, d: unknown): void; addCastMember(p: string, k: string, n: string): { id: string }; openCast(id: string | null): void; openProject(id: string): void; setProjectMode(m: string): void; updateSettings(p: object): void };

test('point of view, goal and tension for each chapter, with a tension chart, shares and coloured cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(async () => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const c = (window as unknown as { crumpet: C }).crumpet;
    c.updateSettings({ toolbarAll: true });
    const p = c.createProject('The Lighthouse');
    const first = c.getState().chapters.find((x) => x.projectId === p.id)!;
    c.setChapterTitle(first.id, 'Arrival');
    c.setChapterDoc(first.id, md.fromMarkdown('word '.repeat(300)));
    for (const [title, words] of [['Storm', 100], ['Wreck', 100], ['Calm', 100], ['Dawn', 400]] as const) {
      const ch = c.addChapter(p.id);
      c.setChapterTitle(ch.id, title);
      c.setChapterDoc(ch.id, md.fromMarkdown('word '.repeat(words)));
    }
    c.addCastMember(p.id, 'character', 'Mara');
    c.addCastMember(p.id, 'character', 'Tam');
    c.openCast(null);
    c.openProject(p.id);
    c.setProjectMode('plan');
  });
  const plan = page.getByRole('region', { name: 'Plan' });
  await plan.getByRole('tab', { name: 'Point of view' }).click();
  const grid = plan.getByRole('grid', { name: 'Chapters’ point of view and tension' });
  for (const [n, who] of [[1, 'Mara'], [2, 'Tam'], [3, 'Tam'], [4, 'Tam'], [5, 'Mara']] as const) await grid.getByLabel(`Point of view of chapter ${n}`).selectOption({ label: who });
  await grid.getByLabel('What they want in chapter 1').fill('Reach the lighthouse before dark');
  for (const [n, t] of [[1, 4], [2, 2], [3, 1], [4, 2], [5, 5]] as const) await grid.getByLabel(`Tension of chapter ${n}`).getByRole('button', { name: new RegExp(`^${t}:`) }).click();
  // The tension chart, and the calm stretch (chapters 2 to 4).
  await expect(plan.getByRole('img', { name: /Tension by chapter/ })).toHaveAttribute('aria-label', 'Tension by chapter: 1: 4, 2: 2, 3: 1, 4: 2, 5: 5');
  await expect(plan).toContainText('Chapters 2–4 stay calm');
  // Each point of view's share: Mara 700 of 1,000 words (two chapters), Tam 300.
  const share = plan.locator('.pov-share li');
  await expect(share).toHaveText([/Mara.*2 chapters · 70%/, /Tam.*3 chapters · 30%/]);
  await expect(plan).toContainText('No goal yet: chapters 2, 3, 4 and 5');
  // Kept in the book's plan.
  const story = await page.evaluate(() => (window as unknown as { crumpet: { getState(): { projects: { plan?: { chapters?: unknown[] } }[] } } }).crumpet.getState().projects[0].plan?.chapters?.length);
  expect(story).toBe(5);
  // Cards show each chapter's point of view.
  await page.evaluate(() => (window as unknown as { crumpet: C }).crumpet.setProjectMode('corkboard'));
  await expect(page.locator('.cork-card .cork-pov')).toHaveText(['Mara', 'Tam', 'Tam', 'Tam', 'Mara']);
  const colours = await page.locator('.cork-card.has-pov').evaluateAll((els) => els.map((e) => (e as HTMLElement).style.getPropertyValue('--pov')));
  expect(colours[0]).toBe(colours[4]);
  expect(colours[0]).not.toBe(colours[1]);
});
