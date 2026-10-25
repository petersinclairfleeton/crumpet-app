import { type Page, expect, test } from '@playwright/test';

// A book's Plan: the story's timeline, its plotlines and a structure's beats.

type Crumpet = Record<string, (...a: unknown[]) => unknown>;

async function book(page: Page) {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.updateSettings({ toolbarAll: false }));
  return page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    const p = c.createProject('The Lighthouse') as { id: string };
    const first = (c.getState() as { chapters: { id: string; projectId: string }[] }).chapters.find((x) => x.projectId === p.id)!;
    c.setChapterTitle(first.id, 'The Keeper');
    const second = c.addChapter(p.id, first.id) as { id: string };
    c.setChapterTitle(second.id, 'The Storm');
    const third = c.addChapter(p.id, second.id) as { id: string };
    c.setChapterTitle(third.id, 'The Wreck');
    c.addCastMember(p.id, 'character', 'Rose');
    c.addCastMember(p.id, 'place', 'The harbour');
    c.addCastMember(p.id, 'place', 'The church');
    c.openProject(p.id, first.id);
    return { project: p.id };
  });
}

test('the timeline: events at story times, a clash, and lanes by plotline or character', async ({ page }) => {
  const { project } = await book(page);
  await page.getByRole('group', { name: 'Writing view' }).getByRole('button', { name: 'Plan' }).click();
  const plan = page.getByRole('region', { name: 'Plan' });
  await expect(plan.getByRole('tab', { name: 'Timeline' })).toHaveAttribute('aria-selected', 'true');
  // Start from the chapters: an event for each.
  await plan.getByRole('button', { name: 'Add the chapters' }).click();
  await expect(plan.locator('.event-card')).toHaveCount(3);
  // Place two at Day 3 14:00, with Rose in two places at once.
  const event = page.getByRole('dialog', { name: 'Event' });
  await plan.locator('.event-card', { hasText: 'The Keeper' }).click();
  await event.getByLabel('When, in the story').fill('Day 3 14:00');
  await event.getByRole('button', { name: 'Rose' }).click();
  await event.getByRole('button', { name: 'The harbour' }).click();
  await event.getByRole('button', { name: 'Done' }).click();
  await plan.locator('.event-card', { hasText: 'The Storm' }).click();
  await event.getByLabel('When, in the story').fill('Day 3 14:00');
  await event.getByRole('button', { name: 'Rose' }).click();
  await event.getByRole('button', { name: 'The church' }).click();
  await event.getByRole('button', { name: 'Done' }).click();
  await expect(plan.getByRole('list', { name: 'Clashes' })).toContainText('Rose is in two places at once (Day 3 14:00): The harbour in “The Keeper” and The church in “The Storm”.');
  // Day 1 comes first; the unplaced one at the end.
  await plan.getByRole('button', { name: 'Event', exact: true }).click();
  await event.getByLabel('What happens').fill('The letter arrives');
  await event.getByLabel('When, in the story').fill('Day 1');
  await event.getByRole('button', { name: 'Done' }).click();
  await expect(plan.locator('.timeline-row.head [role=columnheader]')).toHaveText(['', 'Day 1', 'Day 3 14:00', 'Not placed yet']);
  // By character: Rose's lane has the two.
  await plan.getByRole('button', { name: 'By character' }).click();
  const rose = plan.locator('.timeline-row', { has: page.getByRole('rowheader', { name: 'Rose' }) });
  await expect(rose.locator('.event-card')).toHaveCount(2);
  // Kept with the book.
  await page.reload();
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate((id) => (window as unknown as { crumpet: Crumpet }).crumpet.openProject(id), project);
  await page.getByRole('group', { name: 'Writing view' }).getByRole('button', { name: 'Plan' }).click();
  await expect(page.getByRole('region', { name: 'Plan' }).locator('.event-card')).toHaveCount(4);
});

test('plotlines: what each thread does in each chapter, and where it goes quiet', async ({ page }) => {
  await book(page);
  await page.getByRole('group', { name: 'Writing view' }).getByRole('button', { name: 'Plan' }).click();
  const plan = page.getByRole('region', { name: 'Plan' });
  await plan.getByRole('tab', { name: 'Plotlines' }).click();
  await plan.getByRole('button', { name: 'Plotline' }).click();
  await plan.getByLabel('Plotline 1 name').fill('The mystery');
  await plan.getByLabel('The mystery in 1. The Keeper').fill('A body on the rocks');
  await plan.getByLabel('The mystery in 3. The Wreck').fill('The keeper confesses');
  await expect(plan.locator('.plot-reach')).toContainText('67% of the chapters');
  // A plotline to use on the timeline.
  await plan.getByRole('tab', { name: 'Timeline' }).click();
  await plan.getByRole('button', { name: 'Event', exact: true }).click();
  const event = page.getByRole('dialog', { name: 'Event' });
  await event.getByLabel('What happens').fill('The body is found');
  await event.getByLabel('Plotline').selectOption({ label: 'The mystery' });
  await event.getByRole('button', { name: 'Done' }).click();
  await expect(plan.getByRole('rowheader', { name: 'The mystery' })).toBeVisible();
});

test('structure: pick one, each beat in its chapter, and a chapter for each beat in a new book', async ({ page }) => {
  await book(page);
  await page.getByRole('group', { name: 'Writing view' }).getByRole('button', { name: 'Plan' }).click();
  const plan = page.getByRole('region', { name: 'Plan' });
  await plan.getByRole('tab', { name: 'Structure' }).click();
  const card = plan.locator('.structure-card', { hasText: 'Three acts' });
  // An empty book can have a chapter for each beat; this one already has three chapters, so it's used as it is.
  await card.getByRole('button', { name: 'Use this' }).click();
  await expect(plan.locator('.beat')).toHaveCount(7);
  await expect(plan.getByLabel('Chapter for Midpoint')).toHaveValue(await plan.getByLabel('Chapter for Midpoint').locator('option', { hasText: '2. The Storm' }).getAttribute('value') ?? '');
  // Change it, and keep it.
  await plan.getByRole('button', { name: 'Change…' }).click();
  await plan.locator('.structure-card', { hasText: 'Save the Cat' }).getByRole('button', { name: 'Use this' }).click();
  await expect(plan.locator('.beat')).toHaveCount(15);
  await expect(plan.locator('.plan-tools h2')).toHaveText('Save the Cat');

  // A new book, nothing written yet: a chapter for each beat, named after it, with what it's for as its synopsis.
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    const p = c.createProject('Second Book') as { id: string };
    c.openProject(p.id);
  });
  await plan.getByRole('tab', { name: 'Structure' }).click();
  await plan.locator('.structure-card', { hasText: 'Story circle' }).getByRole('button', { name: 'A chapter for each beat' }).click();
  await expect(plan.locator('.beat')).toHaveCount(8);
  await expect(plan.getByLabel('Chapter for Find')).toHaveValue(await plan.getByLabel('Chapter for Find').locator('option', { hasText: '5. Find' }).getAttribute('value') ?? 'x');
  const chapters = await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    const st = c.getState() as { projects: { id: string; name: string }[]; chapters: { projectId: string; title: string; synopsis: string }[] };
    const p = st.projects.find((x) => x.name === 'Second Book')!;
    return st.chapters.filter((x) => x.projectId === p.id).map((x) => `${x.title}: ${x.synopsis}`);
  });
  expect(chapters).toHaveLength(8);
  expect(chapters).toContain('Need: But they want something.');
});
