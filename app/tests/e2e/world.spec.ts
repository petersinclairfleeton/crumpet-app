import { expect, test } from '@playwright/test';

// Worldbuilding: beside characters and places, things, groups, cultures, magic, creatures and history, each with
// its kind's questions to answer and fields of your own; their names are spotted in the chapters like characters'.

test('worldbuilding cards: kinds of your world, questions to answer, fields of your own, spotted in the chapters', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbarAll: true }));
  await page.getByRole('navigation', { name: 'Notebooks' }).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  const outline = page.getByRole('region', { name: 'Outline' });
  await page.getByLabel('Chapter title').fill('Arrival');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The keeper wound the Clockwork Lens before the Wreckers came.');

  // A thing: its questions to answer.
  await outline.getByRole('button', { name: 'Add a character or place' }).click();
  await expect(page.getByRole('button', { name: 'New magic or technology' })).toBeVisible();
  await page.getByRole('button', { name: 'New thing' }).click();
  const thing = page.getByRole('region', { name: 'Thing card' });
  await page.keyboard.type('Clockwork Lens');
  await thing.getByLabel('Description').fill('The great lens of the light, wound by hand each dusk.');
  const details = thing.getByRole('group', { name: 'Details' });
  await details.getByLabel('What it does').fill('Turns the beam across the bay.');
  await details.getByLabel('Where it came from').fill('Brass from Paris, 1871.');
  // A field of its own.
  await details.getByLabel('New field').fill('Weight');
  await details.getByRole('button', { name: 'Add the field' }).click();
  await details.getByLabel('Weight', { exact: true }).fill('Three tons');
  await expect(thing.locator('.cast-seen')).toContainText('1. Arrival');

  // A group, from the same menu.
  await outline.getByRole('button', { name: 'Add a character or place' }).click();
  await page.getByRole('button', { name: 'New group' }).click();
  const group = page.getByRole('region', { name: 'Group card' });
  await page.keyboard.type('Wreckers');
  await group.getByRole('group', { name: 'Details' }).getByLabel('What they want').fill('Ships on the rocks.');

  // Each kind under its name in the list.
  await expect(outline.locator('.cast-kind')).toHaveText(['Things', 'Groups']);
  // Kept with the book, answers and all.
  const cast = await page.evaluate(() => {
    const s = (window as unknown as { crumpet: { getState(): { projects: { cast?: { kind: string; name: string; fields?: { label: string; value: string }[] }[] }[] } } }).crumpet.getState();
    return s.projects[0].cast?.map((m) => [m.kind, m.name, m.fields]);
  });
  expect(cast).toEqual([
    ['item', 'Clockwork Lens', [{ label: 'What it does', value: 'Turns the beam across the bay.' }, { label: 'Where it came from', value: 'Brass from Paris, 1871.' }, { label: 'Weight', value: 'Three tons' }]],
    ['group', 'Wreckers', [{ label: 'What they want', value: 'Ships on the rocks.' }]],
  ]);
  // Spotted in the chapter like characters.
  await group.getByRole('button', { name: 'Close card' }).click();
  await expect.poll(() => page.evaluate(() => CSS.highlights.get('crumpet-cast')?.size ?? 0)).toBe(2);

  // A card can change kind; its answers stay as fields of its own, which can be taken off.
  await outline.locator('.research-item', { hasText: 'Wreckers' }).click();
  await page.getByRole('region', { name: 'Group card' }).getByLabel('Kind').selectOption('culture');
  const culture = page.getByRole('region', { name: 'Culture card' });
  await expect(culture.getByRole('group', { name: 'Details' }).getByLabel('Beliefs')).toBeVisible();
  await expect(culture.getByRole('group', { name: 'Details' }).getByLabel('What they want', { exact: true })).toHaveValue('Ships on the rocks.');
  await culture.getByRole('button', { name: 'Remove the field What they want' }).click();
  await expect(culture.getByRole('group', { name: 'Details' }).getByLabel('What they want', { exact: true })).toHaveCount(0);
});
