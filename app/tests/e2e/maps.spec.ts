import { expect, test } from '@playwright/test';

// A book's maps: a picture of its world with pins on its places, a scale, and a ruler with travel times.

type C = { createProject(n: string): { id: string }; addCastMember(p: string, k: string, n: string): { id: string }; updateCastMember(p: string, id: string, patch: object): void; openCast(id: string | null): void; openProject(id: string): void; setProjectMode(m: string): void; updateSettings(p: object): void; getState(): { projects: { plan?: { maps?: { name: string; pins: { castId?: string; label?: string }[]; scale?: object }[] } }[] } };

/** A 400 × 200 picture, as a PNG file (made in the page, so no file is needed). */
async function mapPicture(page: import('@playwright/test').Page): Promise<number[]> {
  return page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 200;
    const g = c.getContext('2d')!;
    g.fillStyle = '#8fb8d8';
    g.fillRect(0, 0, 400, 200);
    g.fillStyle = '#c8b98a';
    g.fillRect(40, 30, 300, 140);
    const blob = await new Promise<Blob>((done) => c.toBlob((b) => done(b!), 'image/png'));
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
}

test('a map of the world: pins on its places, a scale, and how far and how long a journey is', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: C }).crumpet;
    c.updateSettings({ toolbarAll: true });
    const p = c.createProject('The Lighthouse');
    const rock = c.addCastMember(p.id, 'place', 'Gull Rock');
    c.updateCastMember(p.id, rock.id, { description: 'A rock with a lighthouse on it.' });
    c.addCastMember(p.id, 'place', 'Port Avery');
    c.openCast(null);
    c.openProject(p.id);
    c.setProjectMode('plan');
  });
  const plan = page.getByRole('region', { name: 'Plan' });
  await plan.getByRole('tab', { name: 'Map' }).click();
  const bytes = await mapPicture(page);
  const chooser = page.waitForEvent('filechooser');
  await plan.getByRole('button', { name: 'Add a map…' }).click();
  await (await chooser).setFiles({ name: 'The Coast.png', mimeType: 'image/png', buffer: (globalThis as unknown as { Buffer: { from(b: number[]): unknown } }).Buffer.from(bytes) } as never);
  const canvas = plan.locator('.map-canvas');
  await expect(canvas.locator('img')).toBeVisible();
  await expect(plan.getByLabel('Map’s name')).toHaveValue('The Coast');
  const box = (await canvas.boundingBox())!;
  const at = (x: number, y: number) => ({ x: box.x + box.width * x, y: box.y + box.height * y });

  // A pin on Gull Rock.
  await plan.getByRole('button', { name: 'Add a pin' }).click();
  await page.mouse.click(at(0.2, 0.5).x, at(0.2, 0.5).y);
  const card = plan.getByRole('dialog', { name: /^Pin/ });
  await card.getByLabel('Place').selectOption({ label: 'Gull Rock (place)' });
  await expect(card).toContainText('A rock with a lighthouse on it.');
  await expect(plan.getByRole('button', { name: 'Pin: Gull Rock' })).toBeVisible();
  // And one with a label of its own.
  await plan.getByRole('button', { name: 'Add a pin' }).click();
  await page.mouse.click(at(0.7, 0.5).x, at(0.7, 0.5).y);
  await plan.getByRole('dialog', { name: /^Pin/ }).getByLabel('Label').fill('The wreck');
  await expect(plan.getByRole('button', { name: 'Pin: The wreck' })).toBeVisible();

  // The scale: from one side of the island to the other is 30 miles (300 of 400 pixels).
  await plan.getByRole('button', { name: 'Set the scale' }).click();
  await page.mouse.click(at(0.1, 0.9).x, at(0.1, 0.9).y);
  await page.mouse.click(at(0.85, 0.9).x, at(0.85, 0.9).y);
  await plan.getByLabel('How far that is').fill('30');
  await plan.getByRole('button', { name: 'Set the scale' }).last().click();
  // Measuring: the two pins are half the map apart: 20 miles.
  await expect(plan.getByRole('button', { name: 'Measure' })).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.click(at(0.2, 0.3).x, at(0.2, 0.3).y);
  await page.mouse.click(at(0.7, 0.3).x, at(0.7, 0.3).y);
  await expect(plan.getByRole('status', { name: 'Measured' })).toContainText('20 miles');
  await expect(plan.getByRole('status', { name: 'Measured' })).toContainText('about 6.5 hours on foot');

  // Kept with the book.
  const maps = await page.evaluate(() => (window as unknown as { crumpet: C }).crumpet.getState().projects[0].plan?.maps);
  expect(maps?.[0]).toMatchObject({ name: 'The Coast', scale: { unit: 'miles' } });
  expect(maps?.[0].pins.map((p) => p.label ?? 'card')).toEqual(['card', 'The wreck']);
  // A pin opens its place's card.
  await plan.getByRole('button', { name: 'Measure' }).click();
  await plan.getByRole('button', { name: 'Pin: Gull Rock' }).click();
  await plan.getByRole('button', { name: 'Open the card' }).click();
  await expect(page.getByRole('region', { name: 'Place card' }).getByLabel('Name')).toHaveValue('Gull Rock');
});
