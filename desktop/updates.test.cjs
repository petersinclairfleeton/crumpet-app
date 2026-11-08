// Tests for updates.cjs, with a stand-in for GitHub: `npm test` in desktop/ (node --test).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');

/** A .tar.gz as `tar -czf` makes it (POSIX ustar), from { name: text } (a name ending in / is a folder). */
function tarOf(entries) {
  const blocks = [];
  for (const [name, text] of Object.entries(entries)) {
    const body = Buffer.from(name.endsWith('/') ? '' : text);
    const head = Buffer.alloc(512);
    head.write(name, 0, 100);
    head.write('0000644\0', 100);
    head.write('0000000\0', 108);
    head.write('0000000\0', 116);
    head.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124);
    head.write('00000000000\0', 136);
    head.write('        ', 148);
    head.write(name.endsWith('/') ? '5' : '0', 156);
    head.write('ustar\0' + '00', 257);
    let sum = 0;
    for (const b of head) sum += b;
    head.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
    blocks.push(head, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks));
}

const SHELL = 'a'.repeat(64);
const webLabel = (version, shell = SHELL) => JSON.stringify({ version, shell });
const webTar = tarOf({ './': '', './index.html': '<div id="root"></div> new', './assets/': '', './assets/app.js': 'new code', './crumpet-web.json': webLabel('1.1.20') });

const exe = Buffer.from('the new Crumpet for Windows');
const zip = Buffer.from('the new Crumpet for Mac');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
let release = {};
const server = http.createServer((req, res) => {
  if (req.url === '/latest') return res.end(JSON.stringify(release));
  if (req.url === '/Crumpet-Windows.exe') return res.end(exe);
  if (req.url === '/Crumpet-Mac.zip') return res.end(zip);
  if (req.url === '/Crumpet-Web.tar.gz') return res.end(webTar);
  if (req.url === '/crumpet-web.json') return res.end(webLabel('1.1.20'));
  if (req.url === '/other-window.json') return res.end(webLabel('1.1.20', 'b'.repeat(64)));
  res.statusCode = 404;
  res.end();
});
let base = '';
let updates;

test.before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  process.env.CRUMPET_RELEASES_URL = `${base}/latest`;
  updates = require('./updates.cjs');
  release = {
    tag_name: 'v1.1.20',
    html_url: `${base}/page`,
    body: 'Crumpet 1.1.20.\n\n## What’s new lately\n\n### The update message says what’s new (9 November 2026)\n\n- A point.\n\n### Older things (8 November 2026)\n',
    assets: [
      { name: 'Crumpet-Windows.exe', browser_download_url: `${base}/Crumpet-Windows.exe`, size: exe.length, digest: `sha256:${sha(exe)}` },
      { name: 'Crumpet-Mac.zip', browser_download_url: `${base}/Crumpet-Mac.zip`, size: zip.length, digest: `sha256:${sha(zip)}` },
      { name: 'Crumpet-Web.tar.gz', browser_download_url: `${base}/Crumpet-Web.tar.gz`, size: webTar.length, digest: `sha256:${sha(webTar)}` },
      { name: 'crumpet-web.json', browser_download_url: `${base}/crumpet-web.json`, size: 0 },
    ],
  };
});
test.after(() => server.close());

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'crumpet-updates-'));

test('a release’s news is its first What’s new heading, without the date', () => {
  assert.equal(updates.newsOf('Intro\n\n### Keyboard shortcuts for everything (8 November 2026)\n\n- …'), 'Keyboard shortcuts for everything');
  assert.equal(updates.newsOf('### Sizes (and more)'), 'Sizes (and more)');
  assert.equal(updates.newsOf('No headings here'), null);
  assert.equal(updates.newsOf(undefined), null);
});

test('versions compare by number', () => {
  assert.equal(updates.isNewer('v1.1.10', '1.1.9'), true);
  assert.equal(updates.isNewer('1.1.9', '1.1.9'), false);
  assert.equal(updates.isNewer('1.0.200', '1.1.0'), false);
});

test('finds a newer release and this computer’s file in it, with its fingerprint', async () => {
  const win = await updates.newerRelease('1.1.16', 'win32');
  assert.equal(win.version, '1.1.20');
  assert.deepEqual(win.asset, { name: 'Crumpet-Windows.exe', url: `${base}/Crumpet-Windows.exe`, size: exe.length, sha256: sha(exe) });
  assert.equal((await updates.newerRelease('1.1.16', 'darwin')).asset.name, 'Crumpet-Mac.zip');
  assert.equal((await updates.newerRelease('1.1.16', 'linux')).asset, null);
  assert.equal(await updates.newerRelease('1.1.20', 'win32'), null);
});

test('a download is kept only when it’s whole and its fingerprint matches', async () => {
  const dir = tmp();
  const { asset } = await updates.newerRelease('1.1.16', 'win32');
  assert.equal(await updates.download(asset, path.join(dir, 'good.exe')), true);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'good.exe')), exe);
  assert.equal(await updates.download({ ...asset, sha256: sha(Buffer.from('something else')) }, path.join(dir, 'bad.exe')), false);
  assert.equal(await updates.download({ ...asset, size: 3 }, path.join(dir, 'short.exe')), false);
  assert.deepEqual(fs.readdirSync(dir), ['good.exe']);
});

test('a Windows update is downloaded into its own folder, and old ones are tidied away once installed', async () => {
  const dir = tmp();
  const ready = await updates.prepare(await updates.newerRelease('1.1.16', 'win32'), dir, 'win32');
  assert.deepEqual(ready, { version: '1.1.20', file: path.join(dir, '1.1.20', 'Crumpet-Windows.exe') });
  fs.mkdirSync(path.join(dir, '1.1.12'));
  updates.tidy(dir, '1.1.16');
  assert.deepEqual(fs.readdirSync(dir), ['1.1.20']);
  updates.tidy(dir, '1.1.20');
  assert.deepEqual(fs.readdirSync(dir), []);
});

const notWindows = { skip: process.platform === 'win32' && 'Mac paths and the shell are for Macs (and Linux)' };

test('says when it can’t put a new copy in its own place', () => {
  assert.match(updates.cannotUpdate('linux', '/opt/Crumpet/crumpet'), /by hand/);
  assert.equal(updates.cannotUpdate('win32', 'C:\\Users\\p\\AppData\\Local\\Programs\\crumpet-desktop\\Crumpet.exe'), null);
});

test('a Mac copy in Applications can update itself; one on the disk image can’t', notWindows, () => {
  assert.match(updates.cannotUpdate('darwin', '/Volumes/Crumpet/Crumpet.app/Contents/MacOS/Crumpet'), /disk image/);
  const apps = tmp();
  const app = path.join(apps, 'Crumpet.app');
  fs.mkdirSync(path.join(app, 'Contents', 'MacOS'), { recursive: true });
  assert.equal(updates.cannotUpdate('darwin', path.join(app, 'Contents', 'MacOS', 'Crumpet')), null);
});

test('on a Mac, the new Crumpet.app takes the old one’s place once the app has closed', notWindows, () => {
  const apps = tmp();
  const app = path.join(apps, 'Crumpet.app');
  const fresh = path.join(tmp(), 'Crumpet.app');
  fs.mkdirSync(app);
  fs.writeFileSync(path.join(app, 'version'), 'old');
  fs.mkdirSync(fresh);
  fs.writeFileSync(path.join(fresh, 'version'), 'new');
  // A process id that has already ended: the script doesn't wait.
  execFileSync('/bin/sh', ['-c', updates.MAC_SWAP, 'crumpet-update', '999999', app, fresh, '0']);
  assert.equal(fs.readFileSync(path.join(app, 'version'), 'utf8'), 'new');
  assert.deepEqual(fs.readdirSync(apps), ['Crumpet.app']);
  assert.equal(fs.existsSync(fresh), false);
});

test('the check: one that can’t update itself offers the download page, and skipping is remembered', async () => {
  const data = tmp();
  const app = { getPath: () => data, getVersion: () => '1.1.16' };
  const opened = [];
  const asked = [];
  const shell = { openExternal: (u) => opened.push(u) };
  // As on Linux, which updates by hand.
  const linux = { platform: 'linux', execPath: '/opt/Crumpet/crumpet' };
  await updates.checkForUpdates({ app, shell, ...linux, ask: async (r, why) => (asked.push([r.version, why]), 'skip'), ready: async () => assert.fail('not on Linux') });
  assert.deepEqual(asked, [['1.1.20', 'This kind of computer gets new versions by hand.']]);
  // Skipped, and checked today: not asked again, even on another day.
  await updates.checkForUpdates({ app, shell, ...linux, ask: async () => assert.fail('asked twice'), ready: async () => {} });
  const state = path.join(data, 'updates.json');
  fs.writeFileSync(state, JSON.stringify({ ...JSON.parse(fs.readFileSync(state, 'utf8')), checked: 0 }));
  await updates.checkForUpdates({ app, shell, ...linux, ask: async () => assert.fail('asked about a skipped version'), ready: async () => {} });
  // Help → Check for a Newer Version asks anyway.
  await updates.checkForUpdates({ app, shell, ...linux, force: true, ask: async () => 'download', ready: async () => {} });
  assert.deepEqual(opened, [`${base}/page`]);
});

test('the check on Windows: downloads the installer and says it’s ready, without asking to download', async () => {
  const data = tmp();
  const app = { getPath: () => data, getVersion: () => '1.1.16' };
  const ready = [];
  const busy = [];
  const done = await updates.checkForUpdates({ app, shell: { openExternal: () => assert.fail('no download page') }, platform: 'win32', execPath: 'C:\\Crumpet\\Crumpet.exe', force: true, busy: (r) => busy.push(r.version), ask: async () => assert.fail('asked'), ready: async (u) => ready.push(u) });
  const file = path.join(data, 'updates', '1.1.20', 'Crumpet-Windows.exe');
  assert.deepEqual(busy, ['1.1.20']);
  assert.deepEqual(ready, [{ version: '1.1.20', file, news: 'The update message says what’s new' }]);
  assert.deepEqual(done, { version: '1.1.20', file });
  assert.deepEqual(fs.readFileSync(file), exe);
  // Once that version is installed, its download is tidied away.
  await updates.checkForUpdates({ app: { ...app, getVersion: () => '1.1.20' }, shell: {}, platform: 'win32', force: true, none: () => {}, ask: async () => {}, ready: async () => {} });
  assert.deepEqual(fs.readdirSync(path.join(data, 'updates')), []);
});

// Small updates: only Crumpet's own files, when the new Crumpet fits this window.

test('unpacks Crumpet’s own files, and nothing outside the folder', () => {
  const dir = tmp();
  updates.untar(webTar, dir);
  assert.equal(fs.readFileSync(path.join(dir, 'assets', 'app.js'), 'utf8'), 'new code');
  assert.deepEqual(updates.readLabel(dir), { version: '1.1.20', shell: SHELL });
  assert.throws(() => updates.untar(tarOf({ '../escaped.txt': 'no' }), tmp()), /Not unpacked/);
  assert.throws(() => updates.untar(tarOf({ '/etc/escaped.txt': 'no' }), tmp()), /Not unpacked/);
  const damaged = zlib.gunzipSync(webTar);
  damaged[600] ^= 1;
  damaged[0] ^= 1;
  assert.throws(() => updates.untar(zlib.gzipSync(damaged), tmp()), /damaged/);
});

test('unpacks what the computer’s own tar makes, long names too', { skip: process.platform === 'win32' && 'tar differs on Windows' }, () => {
  const src = tmp();
  const deep = path.join('assets', 'a-rather-long-folder-name-for-testing', 'and-another-one-inside-it-to-pass-a-hundred');
  fs.mkdirSync(path.join(src, deep), { recursive: true });
  fs.writeFileSync(path.join(src, deep, 'with-a-long-file-name-at-the-end-of-it.js'), 'deep');
  fs.writeFileSync(path.join(src, 'index.html'), 'page');
  const gz = path.join(tmp(), 'web.tar.gz');
  execFileSync('tar', ['-czf', gz, '-C', src, '.']);
  const dir = tmp();
  updates.untar(fs.readFileSync(gz), dir);
  assert.equal(fs.readFileSync(path.join(dir, deep, 'with-a-long-file-name-at-the-end-of-it.js'), 'utf8'), 'deep');
  assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), 'page');
});

test('a small update is downloaded, checked and unpacked only when it fits this window', async () => {
  const dir = tmp();
  const webDir = tmp();
  const rel = await updates.newerRelease('1.1.16', 'linux');
  assert.equal(rel.web.asset.name, 'Crumpet-Web.tar.gz');
  assert.equal(await updates.prepareWeb(rel, dir, webDir, 'b'.repeat(64)), null);
  assert.deepEqual(fs.readdirSync(webDir), []);
  const done = await updates.prepareWeb(rel, dir, webDir, SHELL);
  assert.deepEqual(done, { version: '1.1.20', file: path.join(webDir, '1.1.20'), web: true });
  assert.equal(fs.readFileSync(path.join(webDir, '1.1.20', 'assets', 'app.js'), 'utf8'), 'new code');
  // The download itself is taken away once unpacked.
  assert.deepEqual(fs.readdirSync(path.join(dir, '1.1.20')), []);
  // A damaged download isn't used.
  const bad = { ...rel, web: { ...rel.web, asset: { ...rel.web.asset, sha256: sha(Buffer.from('else')) } } };
  assert.equal(await updates.prepareWeb(bad, tmp(), tmp(), SHELL), null);
  // Nor files whose label inside says otherwise.
  const other = { ...rel, web: { ...rel.web, label: { ...rel.web.label, url: `${base}/other-window.json` } } };
  assert.equal(await updates.prepareWeb(other, tmp(), tmp(), SHELL), null);
});

test('as it opens, Crumpet uses the newest downloaded files that fit, and takes away the rest', () => {
  const webDir = tmp();
  const make = (version, shell = SHELL) => {
    fs.mkdirSync(path.join(webDir, version));
    fs.writeFileSync(path.join(webDir, version, 'index.html'), version);
    fs.writeFileSync(path.join(webDir, version, 'crumpet-web.json'), webLabel(version, shell));
  };
  const shipped = { folder: '/inside/the/app', version: '1.1.18', shell: SHELL };
  make('1.1.17');
  make('1.1.19');
  make('1.1.21');
  make('1.1.22', 'b'.repeat(64));
  fs.mkdirSync(path.join(webDir, '1.1.23.part'));
  assert.deepEqual(updates.activeWeb(webDir, shipped), { folder: path.join(webDir, '1.1.21'), version: '1.1.21' });
  assert.deepEqual(fs.readdirSync(webDir), ['1.1.21']);
  // Files that didn't start aren't used again.
  updates.markDidNotStart(path.join(webDir, '1.1.21'));
  assert.deepEqual(updates.activeWeb(webDir, shipped), { folder: '/inside/the/app', version: '1.1.18' });
  assert.deepEqual(fs.readdirSync(webDir), []);
  // An app without a label (run from the code) never uses downloaded files.
  make('1.1.30');
  assert.deepEqual(updates.activeWeb(webDir, { ...shipped, shell: null }), { folder: '/inside/the/app', version: '1.1.18' });
});

test('the check: a small update even where the app can’t replace itself, and the whole app when the window has changed', async () => {
  const data = tmp();
  const app = { getPath: () => data, getVersion: () => '1.1.16' };
  const shell = { openExternal: () => {} };
  const linux = { platform: 'linux', execPath: '/opt/Crumpet/crumpet' };
  const ready = [];
  const web = { dir: path.join(data, 'web'), shell: SHELL, version: '1.1.16' };
  const done = await updates.checkForUpdates({ app, shell, ...linux, web, force: true, busy: () => {}, ask: async () => assert.fail('asked'), ready: async (u) => ready.push(u) });
  assert.deepEqual(done, { version: '1.1.20', file: path.join(data, 'web', '1.1.20'), web: true });
  assert.equal(ready[0].news, 'The update message says what’s new');
  // Already on that version through a small update: up to date.
  let none = 0;
  await updates.checkForUpdates({ app, shell, ...linux, web: { ...web, version: '1.1.20' }, force: true, none: () => none++, ask: async () => assert.fail('asked'), ready: async () => assert.fail('ready') });
  assert.equal(none, 1);
  // Another window: the whole app, as before (on Linux, by hand).
  const asked = [];
  await updates.checkForUpdates({ app, shell, ...linux, web: { ...web, dir: path.join(tmp(), 'web'), shell: 'b'.repeat(64) }, force: true, ask: async (r) => (asked.push(r.version), 'later'), ready: async () => assert.fail('ready') });
  assert.deepEqual(asked, ['1.1.20']);
});
