import { type Page, expect, test } from '@playwright/test';

// Drafts of a chapter: a new draft (copy or blank page), the tabs above the
// chapter, writing in an older draft, and choosing which one the book uses.

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Notebooks' });

async function book(page: Page, calm: boolean) {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbarAll: true }));
  await sidebar(page).getByRole('button', { name: 'New project' }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await page.getByLabel('Chapter title').fill('The Keeper');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The lamp had not been lit.');
  if (calm) await page.evaluate(() => (window as unknown as { crumpet: { updateSettings(p: object): void } }).crumpet.updateSettings({ toolbarAll: false }));
  return page.getByRole('region', { name: 'Outline' });
}

const text = (page: Page) => page.locator('.note-pane [contenteditable], section[aria-label="Chapter"] [contenteditable]').first();

test('drafts in the calm look: a new draft, the tabs, an older draft, and which one the book uses', async ({ page }) => {
  const outline = await book(page, true);
  await outline.locator('.outline-chapter').first().click();
  const tabs = page.getByRole('tablist', { name: 'Drafts of this chapter' });
  await expect(tabs).toHaveCount(0);

  // A new draft, copied from the first.
  await page.getByRole('button', { name: 'Chapter options' }).click();
  await page.getByRole('button', { name: 'New draft…' }).click();
  await page.getByRole('button', { name: /Copy of Draft 1/ }).click();
  await expect(tabs.getByRole('tab')).toHaveText(['Draft 1', 'Draft 2']);
  await expect(tabs.getByRole('tab', { name: /Draft 2/ })).toHaveAttribute('aria-selected', 'true');
  await expect(text(page)).toContainText('The lamp had not been lit.');
  await text(page).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Not since the wreck.');
  await expect(outline.locator('.draft-badge')).toHaveText('D2');
  // How it compares with the draft before.
  await expect(page.locator('.draft-progress')).toHaveText('10 words · 4 more than Draft 1 · 40% rewritten');
  await page.getByRole('button', { name: 'Draft 2 options' }).click();
  await page.getByRole('button', { name: 'Compare with Draft 1' }).click();
  const compare = page.getByRole('dialog', { name: 'Compare Draft 2 with Draft 1' });
  await expect(compare).toContainText('Not since the wreck.');
  await compare.getByRole('button', { name: 'Close' }).click();

  // The first draft is still there, and can be written in.
  await tabs.getByRole('tab', { name: /Draft 1/ }).click();
  await expect(text(page)).toHaveText('The lamp had not been lit.');
  await expect(page.locator('.draft-aside')).toContainText('Your book uses Draft 2.');
  await text(page).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Ever.');

  // A note on what the second is for.
  await tabs.getByRole('tab', { name: /Draft 2/ }).click();
  await page.getByRole('button', { name: 'Draft 2 options' }).click();
  await page.getByRole('button', { name: /Add a note/ }).click();
  await page.keyboard.type('Bring the wreck in early');
  await page.keyboard.press('Enter');
  await expect(page.locator('.draft-note')).toHaveText('Bring the wreck in early');
  await expect(text(page)).toHaveText('The lamp had not been lit. Not since the wreck.');

  // Back to the first for the book.
  await tabs.getByRole('tab', { name: /Draft 1/ }).click();
  await page.getByRole('button', { name: 'Use Draft 1 instead' }).click();
  await expect(page.locator('.draft-aside')).toHaveCount(0);
  await expect(outline.locator('.draft-badge')).toHaveText('D1');

  // Everything is still there after a reload.
  await page.reload();
  await sidebar(page).getByRole('button', { name: 'The Lighthouse' }).click();
  await page.getByRole('region', { name: 'Outline' }).locator('.outline-chapter').first().click();
  await expect(text(page)).toHaveText('The lamp had not been lit. Ever.');
  await tabs.getByRole('tab', { name: /Draft 2/ }).click();
  await expect(text(page)).toHaveText('The lamp had not been lit. Not since the wreck.');
  await expect(page.locator('.draft-note')).toHaveText('Bring the wreck in early');
});

test('drafts with the full bar: a blank page, and deleting a draft', async ({ page }) => {
  await book(page, false);
  await page.getByRole('button', { name: 'New draft', exact: true }).click();
  await page.getByRole('button', { name: /Blank page/ }).click();
  const tabs = page.getByRole('tablist', { name: 'Drafts of this chapter' });
  await expect(tabs.getByRole('tab', { name: /Draft 2/ })).toHaveAttribute('aria-selected', 'true');
  await expect(text(page)).toHaveText('');
  // The full bar's New draft button gives way to the tabs' +.
  await expect(page.getByRole('button', { name: 'New draft', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Draft 2 options' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete this draft…' }).click();
  await expect(tabs).toHaveCount(0);
  await expect(text(page)).toHaveText('The lamp had not been lit.');
});

test('a new draft of the whole book, and the old draft open beside the new one', async ({ page }) => {
  const outline = await book(page, true);
  await outline.getByRole('button', { name: 'Add chapter' }).click();
  await page.getByLabel('Chapter title').fill('Salt');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The glass was furred with salt.');

  await outline.getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('button', { name: 'New draft of the book…' }).click();
  const form = page.getByRole('group', { name: 'New draft of the book' });
  await expect(form.getByLabel('Name')).toHaveValue('Draft 2');
  await form.getByLabel('What it’s for').fill('Bring the wreck in early');
  await form.getByRole('button', { name: /Copy every chapter/ }).click();
  await expect(outline.locator('.book-draft')).toContainText('Draft 2 · Bring the wreck in early');
  await expect(outline.locator('.draft-badge')).toHaveText(['D2', 'D2']);
  await expect(outline.locator('.book-draft-progress')).toHaveText('+0 words since the drafts before · 0% rewritten');

  // The first draft beside the second, scrolling together.
  await outline.locator('.outline-chapter').first().click();
  const tabs = page.getByRole('tablist', { name: 'Drafts of this chapter' });
  await tabs.getByRole('tab', { name: /Draft 1/ }).click({ button: 'right' });
  await page.getByRole('button', { name: 'Open beside' }).click();
  const panes = page.locator('section[aria-label="Chapter"]');
  await expect(panes).toHaveCount(2);
  await expect(panes.nth(1).getByRole('tab', { name: /Draft 1/ })).toHaveAttribute('aria-selected', 'true');
  await expect(panes.nth(0).getByRole('tab', { name: /Draft 2/ })).toHaveAttribute('aria-selected', 'true');
});
