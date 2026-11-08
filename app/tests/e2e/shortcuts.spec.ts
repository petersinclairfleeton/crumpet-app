import { type Page, expect, test } from '@playwright/test';

// Keyboard shortcuts: every command in Settings → Shortcuts, the everyday ones
// with a standard shortcut, each changeable; the command palette shows them.

type Crumpet = Record<string, (...a: unknown[]) => { id: string }> & { getState(): { view: { kind: string }; settings: Record<string, unknown>; notes: { id: string; title: string }[] } };
const state = (page: Page) => page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.getState());

async function calm(page: Page) {
  await page.setViewportSize({ width: 1300, height: 820 });
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    c.updateSettings({ guideSeen: true, toolbarAll: false });
    c.createNote({ title: 'First thought', notebookId: null });
  });
  await expect(page.locator('.sidebar.calm')).toBeVisible();
}

test('Settings → Shortcuts lists every command; one is changed, taken from another, cleared and put back', async ({ page }) => {
  await calm(page);
  // Its own shortcut opens it.
  await page.keyboard.press('Control+/');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.getByRole('heading', { name: 'Shortcuts' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Make something new' })).toContainText('Ctrl+Alt+Shift+N');
  await expect(dialog.getByRole('group', { name: 'Themes' })).toBeVisible();
  // Find one.
  await dialog.getByRole('searchbox', { name: 'Find a command or a shortcut' }).fill('trash');
  await expect(dialog.locator('.shortcut-row')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Go to Trash: no shortcut. Change' }).click();
  await page.keyboard.press('Control+G');
  await expect(dialog.getByRole('status')).toContainText('Now for “Open the graph of links”');
  await dialog.getByRole('button', { name: 'Use it' }).click();
  expect((await state(page)).settings.shortcuts).toEqual({ 'go.trash': 'Mod+G', 'go.graph': null });
  // A key the browser keeps can't be used.
  await dialog.getByRole('button', { name: 'Go to Trash: Ctrl+G. Change' }).click();
  await page.keyboard.press('Control+C');
  await expect(dialog.getByRole('alert')).toContainText('Crumpet needs this one for copy');
  await expect(dialog.getByRole('button', { name: 'Use it' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  // The new shortcut works; the graph has none now.
  await page.keyboard.press('Control+G');
  expect((await state(page)).view.kind).toBe('trash');
  await page.keyboard.press('Control+Alt+Shift+I');
  expect((await state(page)).view.kind).toBe('inbox');
  // Put back.
  await page.keyboard.press('Control+/');
  await dialog.getByRole('button', { name: 'Put every shortcut back' }).click();
  expect((await state(page)).settings.shortcuts).toBeUndefined();
});

test('the command palette shows each command’s shortcut, and the text’s own keys can be changed', async ({ page }) => {
  await calm(page);
  await page.keyboard.press('Control+P');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await page.keyboard.type('new notebook stack');
  await expect(palette.getByRole('option').first()).toContainText('New notebook stack');
  await expect(palette.getByRole('option').first()).toContainText('Ctrl+Alt+Shift+K');
  await page.keyboard.press('Escape');
  // Bold on Ctrl+Alt+B instead of Ctrl+B.
  await page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.updateSettings({ shortcuts: { 'fmt.bold': 'Mod+Alt+B' } }));
  const text = page.locator('.note-pane .editor').first();
  await text.click();
  await page.keyboard.type('plain ');
  await page.keyboard.press('Control+B');
  await page.keyboard.type('still');
  await page.keyboard.press('Control+Alt+B');
  await page.keyboard.type(' bold');
  await expect(text.locator('strong')).toHaveText(' bold');
  // Ctrl+B did nothing (no other command has it).
  await expect(text).toContainText('lain still bold');
  await expect(text.locator('strong')).toHaveCount(1);
});
