import { expect, test } from '@playwright/test';

// Screenplays: /screenplay starts one; Enter goes on to the element that usually comes next, Tab changes it, the
// script bar shows which; laid out as a script; downloaded as Fountain; a stage play lays the same out as a play.

type C = { getState(): { selectedId: string; notes: { id: string; doc: unknown }[] }; updateSettings(p: object): void };

test('write a screenplay: Enter and Tab between elements, the script bar, the layout, and Fountain', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: C }).crumpet.updateSettings({ toolbarAll: true }));
  await page.getByRole('navigation', { name: 'Notebooks' }).getByRole('button', { name: 'New note', exact: true }).click();
  await page.keyboard.type('The Light');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/screenplay');
  await page.keyboard.press('Enter');
  const bar = page.getByRole('toolbar', { name: 'Script' });
  await expect(bar.getByRole('button', { name: 'Scene heading' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.type('int. lighthouse - night');
  await page.keyboard.press('Enter');
  await expect(bar.getByRole('button', { name: 'Action' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.type('Wind at the glass.');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(bar.getByRole('button', { name: 'Character' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.type('Mara');
  await page.keyboard.press('Enter');
  await expect(bar.getByRole('button', { name: 'Dialogue' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.type('Eleven years.');
  await page.keyboard.press('Enter');
  // An empty character line: Enter makes it action.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(bar.getByRole('button', { name: 'Action' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.type('She lights the lamp.');
  const md = await page.evaluate(async () => {
    const { toMarkdown } = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const s = (window as unknown as { crumpet: C }).crumpet.getState();
    return toMarkdown(s.notes.find((n) => n.id === s.selectedId)!.doc);
  });
  expect(md).toBe('Int. Lighthouse – night {.sc-scene}\n\nWind at the glass. {.sc-action}\n\nMara {.sc-char}\n\nEleven years. {.sc-dial}\n\nShe lights the lamp. {.sc-action}\n');
  // Laid out as a script: the scene heading in capitals, the character indented 2.2 inches, Courier.
  const scene = page.locator(".note-editor .blk-paragraph[data-style='sc-scene']");
  await expect(scene).toHaveCSS('text-transform', 'uppercase');
  await expect(page.locator(".note-editor .blk-paragraph[data-style='sc-char']")).toHaveCSS('margin-left', '211.2px');
  await expect(scene).toHaveCSS('font-family', /Courier/);
  // Clicking an element in the bar changes the line the caret is on.
  await bar.getByRole('button', { name: 'Transition' }).click();
  await expect(page.locator(".note-editor .blk-paragraph[data-style='sc-trans']")).toHaveText('She lights the lamp.');
  // A stage play: the same elements laid out as a play.
  await bar.getByLabel('Layout').selectOption('stage');
  await expect(page.locator('.note-editor[data-script="stage"]')).toHaveCount(1);
  await expect(page.locator(".note-editor .blk-paragraph[data-style='sc-char']")).toHaveCSS('text-align', 'center');
  await bar.getByLabel('Layout').selectOption('screen');
  // Fountain, from the note's menu.
  await page.getByRole('button', { name: 'More', exact: true }).first().click();
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download as Fountain (screenplay)' }).click()]);
  expect(file.suggestedFilename()).toBe('The Light.fountain');
  const body = await new Promise<string>((done) => {
    void file.createReadStream().then((st) => {
      let out = '';
      st.on('data', (d: { toString(): string }) => (out += d.toString()));
      st.on('end', () => done(out));
    });
  });
  expect(body).toBe('Title: The Light\n\nINT. LIGHTHOUSE – NIGHT\n\nWind at the glass.\n\n@Mara\nEleven years.\n\n> SHE LIGHTS THE LAMP.\n');
});
