// Keeping Crumpet up to date by itself. Once a day (a few seconds after it
// opens, and every few hours while it stays open) the app asks GitHub for the
// latest release. If that's newer, it downloads this computer's copy in the
// background (Crumpet-Mac.zip or Crumpet-Windows.exe), checks it against the
// fingerprint GitHub gives (SHA-256), and says it's ready: Restart Now, or it
// installs itself when Crumpet next quits.
//
// No signing certificate is needed: on a Mac the new Crumpet.app takes the old
// one's place once the app has closed (a file the app downloads itself isn't
// marked as "from the internet", so macOS doesn't ask again); on Windows the
// installer runs silently over the old copy, as it does for a person.
//
// When it can't update itself (the Mac app opened from the disk image, a
// folder it may not change, a release without this computer's file), it says
// a newer Crumpet is out and offers the download page, as it always did.
//
// Small updates: the app is two parts, the window around Crumpet (Electron,
// the big part, which hardly ever changes) and Crumpet's own files (the web
// app, which changes with nearly every release). Each release also carries
// those files on their own (Crumpet-Web.tar.gz) and their label
// (crumpet-web.json: version, and the fingerprint of the window they were
// built with, made by web-manifest.mjs). When the window's fingerprint is this
// copy's own, only those files are downloaded, checked, and unpacked into the
// app's own storage (userData/web/<version>); the next time Crumpet opens it
// uses them instead of the ones inside it (`activeWeb`). Nothing in the app
// itself is replaced, so this works from the disk image and in folders the
// app may not change, too. If the new files don't start, the app marks them
// and goes back to the ones it came with.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { spawn, execFile } = require('node:child_process');

const REPO = 'petersinclairfleeton/crumpet-app';
// Tests point this at a stand-in for GitHub.
const LATEST_URL = process.env.CRUMPET_RELEASES_URL || `https://api.github.com/repos/${REPO}/releases/latest`;
const DAY = 24 * 60 * 60 * 1000;
/** Each computer's file in a release. */
const ASSET = { darwin: 'Crumpet-Mac.zip', win32: 'Crumpet-Windows.exe' };
/** Crumpet's own files in a release, and their label. */
const WEB_ASSET = 'Crumpet-Web.tar.gz';
const WEB_LABEL = 'crumpet-web.json';

/** "v1.1.4", "mac-v1.0.119" or "1.1.4" → [1, 1, 4], or null. */
function parseVersion(text) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(text ?? ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** True when `latest` is a newer version than `current`. */
function isNewer(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

function readState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeState(file, state) {
  try {
    fs.writeFileSync(file, JSON.stringify(state));
  } catch {
    // Not kept: it asks again next time.
  }
}

/** What a release brings, in a few words: the first What's new heading in its notes (without its date), or null. */
function newsOf(body) {
  const m = /^###\s+(.+?)(?:\s+\([^)]*\d{4}\))?\s*$/m.exec(String(body ?? ''));
  return m ? m[1].trim() : null;
}

/** A release's file by name, as { name, url, size, sha256 }, or null. */
function assetOf(json, name) {
  const file = (Array.isArray(json.assets) ? json.assets : []).find((a) => a && a.name === name);
  if (!file || typeof file.browser_download_url !== 'string') return null;
  const sha = /^sha256:([0-9a-f]{64})$/.exec(String(file.digest ?? ''))?.[1];
  return { name: file.name, url: file.browser_download_url, size: Number(file.size) || 0, sha256: sha ?? null };
}

/**
 * Asks GitHub for the newest release. Resolves with { version, url, asset }
 * when it's newer than `current` (`asset`: this computer's file, { name, url,
 * size, sha256 }, if the release has one; `web`: Crumpet's own files and
 * their label, { asset, label }, if it has them; `news`: what it brings),
 * else null (also when offline).
 */
async function newerRelease(current, platform = process.platform) {
  try {
    const res = await fetch(LATEST_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const json = await res.json();
    const version = parseVersion(json.tag_name)?.join('.');
    if (!version || json.draft || json.prerelease || !isNewer(version, current)) return null;
    const webAsset = assetOf(json, WEB_ASSET);
    const label = assetOf(json, WEB_LABEL);
    return {
      version,
      url: typeof json.html_url === 'string' ? json.html_url : `https://github.com/${REPO}/releases/latest`,
      asset: ASSET[platform] ? assetOf(json, ASSET[platform]) : null,
      web: webAsset?.sha256 && label ? { asset: webAsset, label } : null,
      news: newsOf(json.body),
    };
  } catch {
    return null;
  }
}

/** Downloads `asset` to `to`, checking its size and fingerprint. Resolves true when it's whole and right. */
async function download(asset, to) {
  const part = `${to}.part`;
  try {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const res = await fetch(asset.url, { redirect: 'follow' });
    if (!res.ok || !res.body) return false;
    const hash = crypto.createHash('sha256');
    const out = fs.createWriteStream(part);
    let size = 0;
    for await (const chunk of res.body) {
      hash.update(chunk);
      size += chunk.length;
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
    if ((asset.size && size !== asset.size) || (asset.sha256 && hash.digest('hex') !== asset.sha256)) {
      fs.rmSync(part, { force: true });
      return false;
    }
    fs.renameSync(part, to);
    return true;
  } catch {
    fs.rmSync(part, { force: true });
    return false;
  }
}

/** The Crumpet.app this copy runs from (a Mac), or null. */
function macAppPath(execPath = process.execPath) {
  const app = path.resolve(execPath, '..', '..', '..');
  return app.endsWith('.app') ? app : null;
}

/**
 * Whether this copy can put a new one in its own place: why not, or null if it can.
 * (A Mac app opened from the disk image, or in a folder it may not change, can't.)
 */
function cannotUpdate(platform = process.platform, execPath = process.execPath) {
  if (!ASSET[platform]) return 'This kind of computer gets new versions by hand.';
  if (platform === 'darwin') {
    const app = macAppPath(execPath);
    if (!app) return 'Crumpet isn’t in an app bundle.';
    if (app.startsWith('/Volumes/')) return 'Crumpet is running from its disk image: drag it into Applications first.';
    try {
      fs.accessSync(path.dirname(app), fs.constants.W_OK);
      fs.accessSync(app, fs.constants.W_OK);
    } catch {
      return 'Crumpet may not change the folder it’s in.';
    }
  }
  return null;
}

/** Unpacks a downloaded Mac zip next to it; resolves with the new Crumpet.app, or null. */
function unpackMac(zip) {
  const dir = path.join(path.dirname(zip), 'unpacked');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return new Promise((resolve) => {
    execFile('/usr/bin/ditto', ['-x', '-k', zip, dir], (err) => {
      const app = path.join(dir, 'Crumpet.app');
      resolve(!err && fs.existsSync(path.join(app, 'Contents', 'MacOS')) ? app : null);
    });
  });
}

/**
 * Gets a release ready to install: downloaded, checked (and on a Mac unpacked).
 * Resolves with { version, file } (file: the new Crumpet.app or the installer), or null.
 */
async function prepare(release, dir, platform = process.platform) {
  if (!release.asset) return null;
  const folder = path.join(dir, release.version);
  const file = path.join(folder, release.asset.name);
  if (!fs.existsSync(file) && !(await download(release.asset, file))) return null;
  if (platform === 'darwin') {
    const app = await unpackMac(file);
    return app ? { version: release.version, file: app } : null;
  }
  return { version: release.version, file };
}

/** Takes away downloads of this version or older (once it's installed). */
function tidy(dir, current) {
  try {
    for (const name of fs.readdirSync(dir)) if (!isNewer(name, current)) fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  } catch {
    // Nothing downloaded yet.
  }
}

/** The label in a folder of Crumpet's own files ({ version, shell }), or null. */
function readLabel(folder) {
  try {
    const label = JSON.parse(fs.readFileSync(path.join(folder, WEB_LABEL), 'utf8'));
    return label && parseVersion(label.version) && typeof label.shell === 'string' ? { version: label.version, shell: label.shell } : null;
  } catch {
    return null;
  }
}

/**
 * Unpacks a .tar.gz (as `tar -czf` makes it) into `dest`: folders and files
 * only, and nothing outside `dest`. Throws if it's damaged.
 */
function untar(gz, dest) {
  const data = zlib.gunzipSync(gz);
  const text = (b) => b.toString('utf8').replace(/\0[\s\S]*$/, '');
  let longName = null;
  for (let at = 0; at + 512 <= data.length; ) {
    const head = data.subarray(at, at + 512);
    if (head.every((b) => b === 0)) break;
    const sum = parseInt(text(head.subarray(148, 156)).trim(), 8);
    let check = 0;
    for (let i = 0; i < 512; i++) check += i >= 148 && i < 156 ? 32 : head[i];
    if (sum !== check) throw new Error('The download is damaged');
    let name = text(head.subarray(0, 100));
    const prefix = text(head.subarray(345, 500));
    if (head.subarray(257, 263).toString('latin1') === 'ustar\0' && prefix) name = `${prefix}/${name}`;
    const size = parseInt(text(head.subarray(124, 136)).trim() || '0', 8);
    const type = String.fromCharCode(head[156] || 48);
    const body = data.subarray(at + 512, at + 512 + size);
    if (body.length !== size) throw new Error('The download is cut short');
    at += 512 + Math.ceil(size / 512) * 512;
    // Names too long for the header: GNU's (L) and POSIX's (x, path=…).
    if (type === 'L') {
      longName = text(body);
      continue;
    }
    if (type === 'x') {
      const m = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(body.toString('utf8'));
      if (m) longName = m[1];
      continue;
    }
    if (longName) [name, longName] = [longName, null];
    const rel = path.normalize(name.replace(/^(\.\/)+/, ''));
    if (rel === '.' || rel === `.${path.sep}`) continue;
    if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error(`Not unpacked: ${name}`);
    const to = path.join(dest, rel);
    if (type === '5') fs.mkdirSync(to, { recursive: true });
    else if (type === '0') {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.writeFileSync(to, body);
    }
    // Anything else (links and the like) isn't part of Crumpet's files.
  }
}

/**
 * Gets a release's own files ready (a small update): their label fetched, the
 * files downloaded, checked and unpacked into `webDir`/<version>. Only when
 * they were built with this copy's window (`shell`). Resolves with
 * { version, file, web: true } (file: the folder), or null.
 */
async function prepareWeb(release, dir, webDir, shell) {
  if (!release.web || !shell) return null;
  try {
    const res = await fetch(release.web.label.url, { redirect: 'follow' });
    if (!res.ok) return null;
    const label = await res.json();
    if (!label || label.shell !== shell || label.version !== release.version) return null;
    const folder = path.join(webDir, release.version);
    if (!fs.existsSync(path.join(folder, 'index.html'))) {
      const file = path.join(dir, release.version, WEB_ASSET);
      if (!fs.existsSync(file) && !(await download(release.web.asset, file))) return null;
      const part = `${folder}.part`;
      fs.rmSync(part, { recursive: true, force: true });
      fs.mkdirSync(part, { recursive: true });
      try {
        untar(fs.readFileSync(file), part);
      } finally {
        fs.rmSync(file, { force: true });
      }
      const inside = readLabel(part);
      if (!inside || inside.shell !== shell || inside.version !== release.version || !fs.existsSync(path.join(part, 'index.html'))) {
        fs.rmSync(part, { recursive: true, force: true });
        return null;
      }
      fs.rmSync(folder, { recursive: true, force: true });
      fs.renameSync(part, folder);
    }
    return { version: release.version, file: folder, web: true };
  } catch {
    return null;
  }
}

/**
 * Which of Crumpet's own files to use as it opens: the newest downloaded ones
 * in `webDir` built for this window (`shipped.shell`), newer than those it came
 * with and not marked as not starting; else the ones inside the app
 * (`shipped.folder`). Takes away the others. Resolves to { folder, version }.
 */
function activeWeb(webDir, shipped) {
  let best = null;
  let names = [];
  try {
    names = fs.readdirSync(webDir);
  } catch {
    // Nothing downloaded yet.
  }
  for (const name of names) {
    const folder = path.join(webDir, name);
    const label = readLabel(folder);
    const good = shipped.shell && label && label.shell === shipped.shell && label.version === name && isNewer(name, shipped.version) && !fs.existsSync(path.join(folder, 'did-not-start')) && fs.existsSync(path.join(folder, 'index.html'));
    if (good && (!best || isNewer(name, best.version))) best = { folder, version: name };
  }
  for (const name of names) if (!best || path.join(webDir, name) !== best.folder) fs.rmSync(path.join(webDir, name), { recursive: true, force: true });
  return best ?? { folder: shipped.folder, version: shipped.version };
}

/** Marks downloaded files that didn't start, so they're not used again. */
function markDidNotStart(folder) {
  try {
    fs.writeFileSync(path.join(folder, 'did-not-start'), new Date().toISOString());
  } catch {
    // Taken away next time anyway, if it can't be marked.
  }
}

/** The shell script that puts a new Crumpet.app in place once the old one has closed (`open` 1: then opens it). */
const MAC_SWAP = [
  'pid="$1"; app="$2"; new="$3"; reopen="$4"; old="$app.old-version"',
  'while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done',
  'rm -rf "$old"',
  'if mv "$app" "$old"; then',
  '  if mv "$new" "$app"; then rm -rf "$old"; else mv "$old" "$app"; fi',
  'fi',
  'xattr -dr com.apple.quarantine "$app" 2>/dev/null',
  'if [ "$reopen" = 1 ]; then open "$app"; fi',
].join('\n');

/**
 * Installs a prepared update once this copy has quit: a Mac swaps the app
 * bundle; Windows runs the installer silently. `reopen` opens the new one after.
 */
function install(ready, { reopen, platform = process.platform, execPath = process.execPath, pid = process.pid }) {
  const opts = { detached: true, stdio: 'ignore' };
  if (platform === 'darwin') {
    const app = macAppPath(execPath);
    if (!app) return false;
    spawn('/bin/sh', ['-c', MAC_SWAP, 'crumpet-update', String(pid), app, ready.file, reopen ? '1' : '0'], opts).unref();
    return true;
  }
  if (platform === 'win32') {
    // electron-builder's installer: /S silent, --updated keeps the shortcuts as they are, --force-run opens it after.
    spawn(ready.file, ['/S', '--updated', ...(reopen ? ['--force-run'] : [])], opts).unref();
    return true;
  }
  return false;
}

/**
 * The check. `ready(update)` is told when an update is downloaded and ready
 * to install ({ version, file }, and `web: true` for a small update, used the
 * next time Crumpet opens); `web` ({ dir, shell, version }) is where small
 * updates go, this copy's window's fingerprint, and the version of Crumpet's
 * files in use (newer than the app's own after a small update); `ask(release, why)` (when it can't update
 * itself) resolves with 'download', 'later' or 'skip'. `force` (Help → Check
 * for a Newer Version) ignores the once-a-day limit and skipped versions;
 * `busy()` says it's downloading and `none()` that it's up to date
 * (`platform` and `execPath` are this copy's, unless a test says otherwise).
 * Resolves with the prepared update ({ version, file }) if there is one.
 */
async function checkForUpdates({ app, shell, ask, ready, busy, none, web, force = false, platform = process.platform, execPath = process.execPath }) {
  const file = path.join(app.getPath('userData'), 'updates.json');
  const dir = path.join(app.getPath('userData'), 'updates');
  const state = readState(file);
  const current = web?.version ?? app.getVersion();
  tidy(dir, current);
  if (!force && state.checked && Date.now() - state.checked < DAY) return null;
  const release = await newerRelease(current, platform);
  writeState(file, { ...state, checked: Date.now() });
  if (!release) {
    if (force && none) none();
    return null;
  }
  let told = false;
  // A small update when the new Crumpet fits this window: only its own files.
  if (web?.shell && release.web) {
    if (force && busy) (busy(release), (told = true));
    const done = await prepareWeb(release, dir, web.dir, web.shell);
    if (done) {
      await ready({ ...done, news: release.news });
      return done;
    }
  }
  const why = cannotUpdate(platform, execPath);
  if (!why && release.asset) {
    if (force && busy && !told) busy(release);
    const done = await prepare(release, dir, platform);
    if (done) {
      await ready({ ...done, news: release.news });
      return done;
    }
  }
  // It can't update itself: it says so, as it always did.
  if (!force && state.skipped === release.version) return null;
  const choice = await ask(release, why);
  if (choice === 'download') void shell.openExternal(release.url);
  else if (choice === 'skip') writeState(file, { ...readState(file), skipped: release.version });
  return null;
}

module.exports = { parseVersion, isNewer, newsOf, newerRelease, download, prepare, unpackMac, install, cannotUpdate, macAppPath, tidy, checkForUpdates, readLabel, untar, prepareWeb, activeWeb, markDidNotStart, MAC_SWAP, REPO, ASSET, WEB_ASSET, WEB_LABEL };
