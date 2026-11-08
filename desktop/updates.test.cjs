// Tests for updates.cjs, with a stand-in for GitHub: `npm test` in desktop/ (node --test).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const exe = Buffer.from('the new Crumpet for Windows');
const zip = Buffer.from('the new Crumpet for Mac');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
let release = {};
const server = http.createServer((req, res) => {
  if (req.url === '/latest') return res.end(JSON.stringify(release));
  if (req.url === '/Crumpet-Windows.exe') return res.end(exe);
  if (req.url === '/Crumpet-Mac.zip') return res.end(zip);
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
    assets: [
      { name: 'Crumpet-Windows.exe', browser_download_url: `${base}/Crumpet-Windows.exe`, size: exe.length, digest: `sha256:${sha(exe)}` },
      { name: 'Crumpet-Mac.zip', browser_download_url: `${base}/Crumpet-Mac.zip`, size: zip.length, digest: `sha256:${sha(zip)}` },
    ],
  };
});
test.after(() => server.close());

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'crumpet-updates-'));

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

test('says when it can’t put a new copy in its own place', () => {
  assert.match(updates.cannotUpdate('linux', '/opt/Crumpet/crumpet'), /by hand/);
  assert.match(updates.cannotUpdate('darwin', '/Volumes/Crumpet/Crumpet.app/Contents/MacOS/Crumpet'), /disk image/);
  const apps = tmp();
  const app = path.join(apps, 'Crumpet.app');
  fs.mkdirSync(path.join(app, 'Contents', 'MacOS'), { recursive: true });
  assert.equal(updates.cannotUpdate('darwin', path.join(app, 'Contents', 'MacOS', 'Crumpet')), null);
  assert.equal(updates.cannotUpdate('win32', 'C:\\Users\\p\\AppData\\Local\\Programs\\crumpet-desktop\\Crumpet.exe'), null);
});

test('on a Mac, the new Crumpet.app takes the old one’s place once the app has closed', () => {
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
  // This test runs on Linux, which updates by hand.
  await updates.checkForUpdates({ app, shell, ask: async (r, why) => (asked.push([r.version, why]), 'skip'), ready: async () => assert.fail('not on Linux') });
  assert.deepEqual(asked, [['1.1.20', 'This kind of computer gets new versions by hand.']]);
  // Skipped, and checked today: not asked again, even on another day.
  await updates.checkForUpdates({ app, shell, ask: async () => assert.fail('asked twice'), ready: async () => {} });
  const state = path.join(data, 'updates.json');
  fs.writeFileSync(state, JSON.stringify({ ...JSON.parse(fs.readFileSync(state, 'utf8')), checked: 0 }));
  await updates.checkForUpdates({ app, shell, ask: async () => assert.fail('asked about a skipped version'), ready: async () => {} });
  // Help → Check for a Newer Version asks anyway.
  await updates.checkForUpdates({ app, shell, force: true, ask: async () => 'download', ready: async () => {} });
  assert.deepEqual(opened, [`${base}/page`]);
});
