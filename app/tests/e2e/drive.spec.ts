import { type Browser, type Page, expect, test } from '@playwright/test';
import { FakeDrive } from '../support/fake-drive';

// Google is faked: its sign-in script and folder picker are small stand-ins,
// and Drive's API is answered by an in-memory Drive shared by every "device".

const FAKE_SIGN_IN = `window.google = Object.assign(window.google || {}, { accounts: { oauth2: {
  initTokenClient(cfg) { return { requestAccessToken() { setTimeout(() => cfg.callback({ access_token: 'e2e-token', expires_in: 3600 }), 0); } }; },
  revoke(t, done) { done && done(); },
} } });`;

const FAKE_PICKER = `window.gapi = { load(name, cb) {
  window.google = window.google || {};
  const chain = { get: (t, k) => (k === 'setCallback' ? (fn) => { t.cb = fn; return t.proxy; } : k === 'build' ? () => ({ setVisible() { setTimeout(() => t.cb({ action: 'picked', docs: [window.__pickedFolder] }), 0); } }) : () => t.proxy) };
  window.google.picker = {
    ViewId: { FOLDERS: 'folders' },
    Action: { PICKED: 'picked', CANCEL: 'cancel' },
    DocsView: class { setIncludeFolders() {} setSelectFolderEnabled() {} setMimeTypes() {} setParent() {} },
    PickerBuilder: function () { const t = {}; t.proxy = new Proxy(t, chain); return t.proxy; },
  };
  cb();
} };`;

async function device(browser: Browser, drive: FakeDrive): Promise<Page> {
  const context = await browser.newContext();
  await context.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_SIGN_IN }));
  await context.route('https://apis.google.com/js/api.js', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_PICKER }));
  await context.route('https://www.googleapis.com/**', async (r) => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const h = req.headers();
    const res = await drive.fetch(req.url(), {
      method: req.method(),
      headers: { Authorization: h.authorization, ...(h['content-type'] ? { 'Content-Type': h['content-type'] } : {}) },
      body: req.postData() ?? undefined,
    });
    await r.fulfill({ status: res.status, headers: { ...cors, 'content-type': res.headers.get('content-type') ?? 'text/plain' }, body: await res.text() });
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Notes', exact: true })).toBeVisible();
  return page;
}

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Notebooks' });
const where = (page: Page) => page.getByRole('group', { name: /Where/ });

/** Live file paths under the vault folder in the fake Drive. */
function vault(drive: FakeDrive, name: string): string[] {
  const folder = [...drive.files.values()].find((f) => f.name === name && !f.trashed && f.parents.includes('root'));
  return folder ? drive.paths(folder.id) : [];
}

test('connect Google Drive in two clicks, then a second device finds the same notes', async ({ browser }) => {
  const drive = new FakeDrive();
  const mac = await device(browser, drive);
  await sidebar(mac).getByRole('button', { name: 'Connect Google Drive' }).click();
  await where(mac).getByRole('button', { name: 'Continue with Google' }).click();
  await where(mac).getByRole('button', { name: /A new “Crumpet” folder/ }).click();
  await expect(where(mac)).toContainText('in the folder Crumpet');
  await expect(sidebar(mac).locator('.side-foot')).toContainText('Google Drive · synced');

  await mac.keyboard.press('Escape');
  await sidebar(mac).getByRole('button', { name: 'New Note', exact: true }).click();
  await mac.keyboard.type('Hello Drive');
  await mac.keyboard.press('Enter');
  await mac.keyboard.type('Written on the Mac.');
  await expect.poll(() => vault(drive, 'Crumpet'), { timeout: 15_000 }).toContain('Hello Drive.md');

  const phone = await device(browser, drive);
  await sidebar(phone).getByRole('button', { name: 'Connect Google Drive' }).click();
  await where(phone).getByRole('button', { name: 'Continue with Google' }).click();
  await where(phone).getByRole('button', { name: /Your Crumpet folder/ }).click();
  await phone.keyboard.press('Escape');
  const card = phone.getByRole('region', { name: 'Notes', exact: true }).locator('.card', { hasText: 'Hello Drive' });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(phone.locator('.note-pane [contenteditable]')).toContainText('Written on the Mac.');
});

test('or choose any folder in Drive with Google’s picker', async ({ browser }) => {
  const drive = new FakeDrive();
  const writing = drive.add('Writing', 'root', 'application/vnd.google-apps.folder');
  const page = await device(browser, drive);
  await page.evaluate((f) => Object.assign(window, { __pickedFolder: f }), { id: writing.id, name: 'Writing', mimeType: 'application/vnd.google-apps.folder' });
  await page.goto('/#connect');
  await where(page).getByRole('button', { name: 'Continue with Google' }).click();
  await where(page).getByRole('button', { name: /Choose a folder/ }).click();
  await expect(where(page)).toContainText('in the folder Writing');
  await expect.poll(() => drive.paths(writing.id), { timeout: 15_000 }).toContain('.crumpet/vault.json');
});
