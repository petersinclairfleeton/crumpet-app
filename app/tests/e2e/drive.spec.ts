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
  await expect(page.getByRole('navigation', { name: 'Notebooks' })).toBeVisible();
  return page;
}

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Notebooks' });
const where = (page: Page) => page.getByRole('group', { name: /Where/ });
/** Settings → Sync and storage, from the sidebar's ⚙ menu (a first visit's sidebar has no status line yet). */
async function openSync(page: Page) {
  await sidebar(page).getByRole('button', { name: 'Settings and more' }).click();
  await page.getByRole('button', { name: 'Settings…' }).click();
  await page.getByRole('tab', { name: 'Sync and storage' }).click();
}

/** Live file paths under the vault folder in the fake Drive. */
function vault(drive: FakeDrive, name: string): string[] {
  const folder = [...drive.files.values()].find((f) => f.name === name && !f.trashed && f.parents.includes('root'));
  return folder ? drive.paths(folder.id) : [];
}

test('connect Google Drive in two clicks, then a second device finds the same notes', async ({ browser }) => {
  const drive = new FakeDrive();
  const mac = await device(browser, drive);
  await openSync(mac);
  await where(mac).getByRole('button', { name: 'Continue with Google' }).click();
  await where(mac).getByRole('button', { name: /A new “Crumpet” folder/ }).click();
  await expect(where(mac)).toContainText('in the folder Crumpet');
  await expect(sidebar(mac).locator('.side-foot')).toContainText('Google Drive · synced');

  await mac.keyboard.press('Escape');
  await sidebar(mac).getByRole('button', { name: 'New note', exact: true }).click();
  await mac.keyboard.type('Hello Drive');
  await mac.keyboard.press('Enter');
  await mac.keyboard.type('Written on the Mac.');
  await expect.poll(() => vault(drive, 'Crumpet'), { timeout: 15_000 }).toContain('Hello Drive.md');

  const phone = await device(browser, drive);
  await openSync(phone);
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

test('a project folder in Drive shows up as a project, even one made without Crumpet', async ({ browser }) => {
  const drive = new FakeDrive();
  const root = drive.add('Crumpet', 'root', 'application/vnd.google-apps.folder');
  const projects = drive.add('Projects', root.id, 'application/vnd.google-apps.folder');
  const book = drive.add('My Book', projects.id, 'application/vnd.google-apps.folder');
  drive.add('01 Opening.md', book.id, 'text/markdown', 'The lamp had not been lit.\n');
  const page = await device(browser, drive);
  await page.goto('/#connect');
  await where(page).getByRole('button', { name: 'Continue with Google' }).click();
  await where(page).getByRole('button', { name: /Your Crumpet folder/ }).click();
  await page.keyboard.press('Escape');
  await sidebar(page).getByRole('button', { name: /^My Book/ }).click({ timeout: 15_000 });
  await expect(page.getByRole('region', { name: 'Outline' })).toContainText('Opening');
  await expect(page.locator('.note-editor')).toContainText('The lamp had not been lit.');
  await expect(sidebar(page).locator('.nb-row, .stack-row')).toHaveCount(0);
  await expect.poll(() => vault(drive, 'Crumpet'), { timeout: 15_000 }).toContain('Projects/My Book/project.json');
});

test('chapters a project lists but Crumpet can’t open are pointed out, with what to do', async ({ browser }) => {
  const drive = new FakeDrive();
  const root = drive.add('Crumpet', 'root', 'application/vnd.google-apps.folder');
  const projects = drive.add('Projects', root.id, 'application/vnd.google-apps.folder');
  const book = drive.add('Test Novel', projects.id, 'application/vnd.google-apps.folder');
  drive.add('project.json', book.id, 'application/json', JSON.stringify({ id: 'p1', name: 'Test Novel', outline: [{ type: 'chapter', id: 'c1' }, { type: 'chapter', id: 'hidden' }] }));
  drive.add('01 Opening.md', book.id, 'text/markdown', '---\nid: c1\ntitle: Opening\n---\n\nThe lamp.\n');
  const page = await device(browser, drive);
  await page.goto('/#connect');
  await where(page).getByRole('button', { name: 'Continue with Google' }).click();
  await where(page).getByRole('button', { name: /Your Crumpet folder/ }).click();
  await expect(where(page).getByRole('note')).toContainText('Test Novel: 1 chapter', { timeout: 15_000 });
  await expect(where(page).getByRole('status')).toContainText('1 chapter can’t be opened');
});

// A folder on this computer: the browser's folder picker is faked with a
// folder in the browser's own private file storage (which works the same way).
const FAKE_FOLDER_PICKER = `window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('My notes', { create: true });`;

test('keep notes in a folder on this computer: files written there, changes made outside come in, and it’s remembered', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(FAKE_FOLDER_PICKER);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Notebooks' })).toBeVisible();
  await sidebar(page).getByRole('button', { name: 'New note', exact: true }).click();
  await page.keyboard.type('Harbour');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The boats come in at dusk.');
  await sidebar(page).getByRole('button', { name: 'Saved on this device' }).click();
  await where(page).getByRole('button', { name: 'Choose a folder…' }).click();
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

test('closing the tab before the changes have synced asks first', async ({ browser }) => {
  const drive = new FakeDrive();
  const page = await device(browser, drive);
  await openSync(page);
  await where(page).getByRole('button', { name: 'Continue with Google' }).click();
  await where(page).getByRole('button', { name: /A new “Crumpet” folder/ }).click();
  await expect(sidebar(page).locator('.side-foot')).toContainText('Google Drive · synced');
  await page.keyboard.press('Escape');
  /** Would the browser ask before closing? */
  const asks = () => page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })));
  expect(await asks()).toBe(false);

  await sidebar(page).getByRole('button', { name: 'New note', exact: true }).click();
  await page.keyboard.type('Not yet synced');
  expect(await asks()).toBe(true);
  // Asking also syncs straight away, so once it's in the folder closing is fine again.
  await expect.poll(() => vault(drive, 'Crumpet'), { timeout: 15_000 }).toContain('Not yet synced.md');
  await expect.poll(asks, { timeout: 15_000 }).toBe(false);
});

test('“Syncing…” shows while changes are on their way, then “Synced”, when the sidebar is folded away', async ({ browser }) => {
  const drive = new FakeDrive();
  const page = await device(browser, drive);
  await openSync(page);
  await where(page).getByRole('button', { name: 'Continue with Google' }).click();
  await where(page).getByRole('button', { name: /A new “Crumpet” folder/ }).click();
  await expect(sidebar(page).locator('.side-foot')).toContainText('Google Drive · synced');
  await page.keyboard.press('Escape');
  const note = page.locator('.sync-note');
  // With the sidebar showing, its foot says it, so the note keeps out of the way.
  await sidebar(page).getByRole('button', { name: 'New note', exact: true }).click();
  await page.keyboard.type('On its way');
  await expect(sidebar(page).locator('.side-foot')).toContainText('Syncing…');
  await expect(note).toHaveCount(0);
  await expect.poll(() => vault(drive, 'Crumpet'), { timeout: 15_000 }).toContain('On its way.md');
  // Folded away: the note says it instead.
  await page.evaluate(() => (window as unknown as { crumpet: { updateLayout(p: object): void } }).crumpet.updateLayout({ sidebar: 'hidden' }));
  await page.getByLabel('Title').click();
  await page.keyboard.type(' again');
  await expect(note).toHaveText('Syncing…');
  await expect(note).toHaveText('✓ Synced', { timeout: 15_000 });
  await expect(note).toHaveCount(0);
  expect(vault(drive, 'Crumpet')).toContain('On its way again.md');
});

// Share with readers: a copy as a Google Doc in a folder of its own, open to comments by its link; readers'
// comments come back onto the words they're on.
const GOOGLE_DOC = 'application/vnd.google-apps.document';

test('share a note with readers as a Google Doc, then bring their comments back onto the text', async ({ browser }) => {
  const drive = new FakeDrive();
  const page = await device(browser, drive);
  await sidebar(page).getByRole('button', { name: 'New note', exact: true }).click();
  await page.keyboard.type('The Lighthouse');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The lamp had not been lit. The keeper waited by the stove.');
  await page.locator('.note-pane').getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Share with readers…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share with readers' });
  await expect(dialog).toContainText('Crumpet – shared copies');
  await dialog.getByRole('button', { name: 'Make a link' }).click();
  await expect(dialog.getByRole('status')).toContainText('Copied the link', { timeout: 15_000 });

  // In Drive: a Google Doc in its own folder, anyone with the link can comment; the notes' own folder isn't touched.
  const doc = [...drive.files.values()].find((f) => f.mimeType === GOOGLE_DOC)!;
  expect(doc.name).toBe('The Lighthouse');
  expect(drive.files.get(doc.parents[0])?.name).toBe('Crumpet – shared copies');
  expect(doc.permissions).toEqual([{ role: 'commenter', type: 'anyone', allowFileDiscovery: false }]);
  await expect(dialog.getByRole('link', { name: 'The Lighthouse' })).toHaveAttribute('href', `https://docs.google.com/document/d/${doc.id}/edit`);
  await expect(dialog.getByRole('list', { name: 'Shared copies' })).toContainText('readers can comment');

  // Nothing yet; then a reader comments on some words, and one more on words since cut.
  await dialog.getByRole('button', { name: 'Bring back comments' }).click();
  await expect(dialog.getByRole('status')).toHaveText('No comments yet.');
  doc.comments = [
    { id: 'k1', content: 'Why not? Say more.', quotedFileContent: { value: 'not been lit' }, author: { displayName: 'Ann Reader' }, createdTime: '2026-10-20T10:30:00Z', resolved: false, replies: [{ content: 'Agreed!', author: { displayName: 'Bo' }, createdTime: '2026-10-20T11:00:00Z' }] },
    { id: 'k2', content: 'Lovely.', quotedFileContent: { value: 'a line since cut' }, author: { displayName: 'Bo' }, createdTime: '2026-10-21T09:00:00Z', resolved: false, replies: [] },
  ];
  await dialog.getByRole('button', { name: 'Bring back comments' }).click();
  await expect(dialog.getByRole('status')).toContainText('2 comments brought back (1 on words that have since changed');
  await expect(dialog.getByRole('list', { name: 'Shared copies' })).toContainText('2 comments brought back');
  // Once only.
  await dialog.getByRole('button', { name: 'Bring back comments' }).click();
  await expect(dialog.getByRole('status')).toHaveText('No new comments since you last looked.');
  await dialog.getByRole('button', { name: 'Close' }).click();

  const marked = page.locator('.note-pane [contenteditable] [data-comment]');
  await expect(marked.filter({ hasText: 'not been lit' })).toHaveAttribute('data-author', 'Ann Reader');
  const note = await page.evaluate(() => {
    const store = (window as unknown as { crumpet: { getState(): { notes: { title: string; doc: { blocks: { runs: { text: string; comment?: { text: string; replies?: { text: string }[] } }[] }[] } }[] } } }).crumpet;
    const n = store.getState().notes.find((x) => x.title === 'The Lighthouse')!;
    return n.doc.blocks.flatMap((b) => b.runs.filter((r) => r.comment).map((r) => [r.text, r.comment!.text, r.comment!.replies?.map((x) => x.text) ?? []]));
  });
  expect(note).toEqual([
    ['The', 'On “a line since cut”: Lovely.', []],
    ['not been lit', 'Why not? Say more.', ['Agreed!']],
  ]);
});
