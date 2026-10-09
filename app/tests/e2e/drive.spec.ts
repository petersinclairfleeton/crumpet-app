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

// A folder on this computer: the browser's folder picker is faked with a
// folder in the browser's own private file storage (which works the same way).
const FAKE_FOLDER_PICKER = `window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('My notes', { create: true });`;

test('keep notes in a folder on this computer: files written there, changes made outside come in, and it’s remembered', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(FAKE_FOLDER_PICKER);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Notes', exact: true })).toBeVisible();
  await sidebar(page).getByRole('button', { name: 'New Note', exact: true }).click();
  await page.keyboard.type('Harbour');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The boats come in at dusk.');
  await sidebar(page).getByRole('button', { name: 'Connect Google Drive' }).click();
  await where(page).getByRole('button', { name: 'Use a folder on this computer…' }).click();
  await expect(where(page)).toContainText('In the folder My notes on this computer');
  await expect(where(page).getByRole('status')).toHaveText(/Synced/);
  const files = () =>
    page.evaluate(async () => {
      const out: Record<string, string> = {};
      const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
        for await (const h of (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
          if (h.kind === 'directory') await walk(h as FileSystemDirectoryHandle, `${prefix}${h.name}/`);
          else out[prefix + h.name] = await (await (h as FileSystemFileHandle).getFile()).text();
        }
      };
      await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle('My notes'), '');
      return out;
    });
  await expect.poll(async () => Object.entries(await files()).find(([k]) => k.endsWith('Harbour.md'))?.[1] ?? '').toContain('The boats come in at dusk.');
  // A note written in the folder by another app comes in at the next sync.
  await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('My notes');
    const out = await (await dir.getFileHandle('Lighthouse.md', { create: true })).createWritable();
    await out.write('The lamp is lit at dusk.\n');
    await out.close();
  });
  await where(page).getByRole('button', { name: 'Sync now' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Notes', exact: true }).locator('.card', { hasText: 'Lighthouse' })).toBeVisible();
  // After a reload the folder is still the place.
  await page.reload();
  await expect(page.locator('.side-foot')).toContainText('Folder · synced');
  // When the browser wants to ask again before Crumpet uses the folder, one click allows it.
  await page.evaluate(() => {
    const proto = FileSystemHandle.prototype as unknown as { queryPermission(): Promise<string>; requestPermission(): Promise<string> };
    let allowed = false;
    proto.queryPermission = async () => (allowed ? 'granted' : 'prompt');
    proto.requestPermission = async () => ((allowed = true), 'granted');
  });
  await page.evaluate(() => (window as unknown as { crumpet: { createNote(n: object): unknown } }).crumpet.createNote({ title: 'Later' }));
  await expect(page.locator('.side-foot')).toContainText('Sync needs attention');
  await sidebar(page).getByRole('button', { name: 'Fix…' }).click();
  await where(page).getByRole('button', { name: 'Allow access to the folder' }).click();
  await expect(where(page).getByRole('status')).toHaveText(/Synced/);
  await context.close();
});
