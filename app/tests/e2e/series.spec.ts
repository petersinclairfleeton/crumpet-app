import { expect, test } from '@playwright/test';

// A series: books with the same series name share their characters, places and research.

type Crumpet = Record<string, (...a: unknown[]) => unknown>;

test('books in a series share their characters, places and research', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  const ids = await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    c.updateSettings({ toolbarAll: false });
    const one = c.createProject('The Lighthouse') as { id: string };
    c.addCastMember(one.id, 'character', 'Mara');
    c.addCastMember(one.id, 'place', 'Gull Rock');
    c.openCast(null);
    c.addResearchNote(one.id);
    const st = c.getState() as { notes: { id: string; projectId: string | null }[] };
    const note = st.notes.find((n) => n.projectId === one.id)!;
    c.setTitle(note.id, 'Tide tables');
    c.openResearch(null);
    const two = c.createProject('The Keeper’s Daughter') as { id: string };
    const st2 = c.getState() as { chapters: { id: string; projectId: string }[] };
    const chapter = st2.chapters.find((x) => x.projectId === two.id)!;
    c.openProject(one.id);
    return { one: one.id, two: two.id, chapter: chapter.id };
  });
  // Book one joins a series, from its menu.
  const outline = page.getByRole('region', { name: 'Outline' });
  await outline.getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('button', { name: 'Part of a series…' }).click();
  await page.getByLabel('Series').fill('The Gull Rock Books');
  await page.keyboard.press('Enter');
  await expect(outline.locator('.book-name')).toContainText('In The Gull Rock Books');
  // Book two joins the same series (the name offered from the first).
  await page.evaluate((id) => (window as unknown as { crumpet: Crumpet }).crumpet.openProject(id), ids.two);
  await outline.getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('button', { name: 'Part of a series…' }).click();
  await page.getByLabel('Series').fill('The Gull Rock Books');
  await page.keyboard.press('Enter');
  await expect(outline.locator('.book-name')).toContainText('Book 2 of 2 in The Gull Rock Books');
  // Book two's lists show book one's characters, places and research.
  await outline.getByRole('button', { name: /^Characters & places/ }).click();
  const cast = page.getByRole('region', { name: 'Characters and places' });
  await expect(cast.locator('.research-from')).toHaveText('From the series');
  await expect(cast.locator('.research-item', { hasText: 'Mara' })).toContainText('The Lighthouse');
  await outline.getByRole('button', { name: /^Research/ }).last().click();
  const research = page.getByRole('region', { name: 'Research', exact: true });
  await expect(research.locator('.research-item', { hasText: 'Tide tables' })).toContainText('The Lighthouse');
  // Mara's name is spotted in book two's chapter, and her card opens here, editing book one's.
  await page.evaluate((id) => (window as unknown as { crumpet: Crumpet }).crumpet.selectChapter(id), ids.chapter);
  await page.locator('section[aria-label="Chapter"] .note-editor[contenteditable="true"]').click();
  await page.keyboard.type('Mara rowed out past Gull Rock.');
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ right: true }));
  const right = page.getByRole('complementary', { name: 'Right sidebar' });
  await right.getByRole('button', { name: /^Mara/ }).click();
  const card = page.getByRole('region', { name: 'Character card' });
  // Where she appears, across the series.
  await expect(card).toContainText('The Keeper’s Daughter: 1. Chapter 1');
  await card.getByLabel('Description').fill('Back for the summer.');
  const desc = await page.evaluate((id) => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    return (c.project(id) as { cast: { name: string; description: string }[] }).cast.find((m) => m.name === 'Mara')?.description;
  }, ids.one);
  expect(desc).toBe('Back for the summer.');
});
