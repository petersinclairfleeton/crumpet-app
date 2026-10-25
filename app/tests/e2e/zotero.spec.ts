import { expect, test } from '@playwright/test';

// Sources from a reference manager: a BibTeX file exported from Zotero, into References → Manage sources.

const BIB = `@book{austen1813,
  author = {Austen, Jane},
  title = {Pride and Prejudice},
  publisher = {T. Egerton},
  address = {London},
  year = {1813}
}
@article{woolf1925,
  author = {Woolf, Virginia},
  title = {Modern Fiction},
  journal = {The Times Literary Supplement},
  year = {1925},
  pages = {10--15}
}`;

/** The file's bytes (Node's Buffer, which the test runs with). */
const bytes = (text: string) => (globalThis as unknown as { Buffer: { from(s: string): unknown } }).Buffer.from(text);

test('import sources from a Zotero BibTeX file', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbarAll: true, toolbar: 'always' }));
  await page.getByRole('navigation', { name: 'Notebooks' }).getByRole('button', { name: 'New note', exact: true }).click();
  await page.keyboard.type('Essay');
  await page.keyboard.press('Enter');
  await page.keyboard.type('As Woolf wrote');
  // References → Manage sources… → Import (References is in the bar, or under More when there isn't room).
  const inBar = page.locator('.note-toolbar .tools.fit > .tool').getByRole('button', { name: 'References' });
  if (await inBar.count()) await inBar.first().click();
  else {
    await page.getByRole('button', { name: 'More formatting' }).click();
    await page.locator('.more-menu').getByRole('button', { name: 'References' }).first().click();
  }
  await page.getByRole('button', { name: 'Manage sources…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sources' });
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Import from Zotero, Mendeley or EndNote…' }).click();
  await (await chooser).setFiles({ name: 'My Library.bib', mimeType: 'text/plain', buffer: bytes(BIB) } as never);
  await expect(dialog.getByRole('status')).toHaveText('Added 2 sources.');
  await expect(dialog.getByRole('list', { name: 'Sources' })).toContainText('Pride and Prejudice');
  await expect(dialog.getByRole('list', { name: 'Sources' })).toContainText('Modern Fiction');
  // Again: nothing new.
  const again = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Import from Zotero, Mendeley or EndNote…' }).click();
  await (await again).setFiles({ name: 'My Library.bib', mimeType: 'text/plain', buffer: bytes(BIB) } as never);
  await expect(dialog.getByRole('status')).toHaveText('All 2 were in your sources already.');
  // Kept with their keys from Zotero.
  const keys = await page.evaluate(() => (window as unknown as { crumpet: { getState(): { settings: { sources?: { key: string }[] } } } }).crumpet.getState().settings.sources?.map((s) => s.key));
  expect(keys).toEqual(['austen1813', 'woolf1925']);
});
