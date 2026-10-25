import { expect, test } from '@playwright/test';

// Characters' relationships, on their cards, and the family tree drawn from them.

type Crumpet = Record<string, (...a: unknown[]) => unknown>;

test('relationships on a character’s card, read from both sides, and the family tree', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    c.updateSettings({ toolbarAll: false });
    const p = c.createProject('The Lighthouse') as { id: string };
    for (const n of ['Mara', 'Ewan', 'Rose', 'Tam']) c.addCastMember(p.id, 'character', n);
    c.openCast(null);
  });
  const outline = page.getByRole('region', { name: 'Outline' });
  await outline.getByRole('button', { name: /^Characters & places/ }).click();
  const cast = page.getByRole('region', { name: 'Characters and places' });
  const card = page.getByRole('region', { name: 'Character card' });
  const add = async (kind: string, who: string) => {
    await card.getByLabel('Relationship').selectOption({ label: kind });
    await card.getByLabel('Who').selectOption({ label: who });
    await card.getByRole('button', { name: 'Add', exact: true }).click();
  };
  // Mara: Ewan's partner, Rose's and Tam's parent.
  await cast.locator('.research-item', { hasText: 'Mara' }).click();
  await add('Partner of', 'Ewan');
  await add('Parent of', 'Rose');
  await add('Parent of', 'Tam');
  await expect(card.locator('.ties li')).toHaveText([/Partner of\s*Ewan/, /Parent of\s*Rose/, /Parent of\s*Tam/]);
  // Rose's card reads it from her side; she adds a tie of her own.
  await card.getByRole('button', { name: 'Rose', exact: true }).click();
  await expect(card.getByLabel('Name')).toHaveValue('Rose');
  await expect(card.locator('.ties li')).toHaveText([/Child of\s*Mara/]);
  await add('Child of', 'Ewan');
  await add('Rival of', 'Tam');
  await expect(card.locator('.ties li')).toHaveText([/Child of\s*Mara/, /Child of\s*Ewan/, /Rival of\s*Tam/]);
  // The tree: Mara and Ewan above, Rose and Tam below.
  await cast.getByRole('button', { name: 'Family tree' }).click();
  const tree = page.getByRole('dialog', { name: 'Family tree' });
  await expect(tree.getByRole('img', { name: 'The family tree: 4 people' })).toBeVisible();
  const y = async (name: string) => Number(await tree.getByRole('button', { name: `${name}: open the card` }).locator('rect').getAttribute('y'));
  expect(await y('Mara')).toBe(await y('Ewan'));
  expect(await y('Rose')).toBeGreaterThan(await y('Mara'));
  expect(await y('Tam')).toBe(await y('Rose'));
  await expect(tree).toContainText('Friends, rivals and the rest are on each character’s card.');
  // A click opens the card.
  await tree.getByRole('button', { name: 'Tam: open the card' }).click();
  await expect(card.getByLabel('Name')).toHaveValue('Tam');
  await expect(card.locator('.ties li')).toHaveText([/Child of\s*Mara/, /Rival of\s*Rose/]);
  // Deleting Mara takes her ties with her.
  await card.locator('.ties li', { hasText: 'Rose' }).getByRole('button', { name: /Remove/ }).click();
  await expect(card.locator('.ties li')).toHaveText([/Child of\s*Mara/]);
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    const st = c.getState() as { projects: { id: string; cast: { id: string; name: string }[] }[] };
    const p = st.projects[0];
    c.deleteCastMember(p.id, p.cast.find((m) => m.name === 'Mara')!.id);
  });
  await expect(card.locator('.ties li')).toHaveCount(0);
});
