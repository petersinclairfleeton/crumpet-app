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

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');

const REPO = 'petersinclairfleeton/crumpet-app';
// Tests point this at a stand-in for GitHub.
const LATEST_URL = process.env.CRUMPET_RELEASES_URL || `https://api.github.com/repos/${REPO}/releases/latest`;
const DAY = 24 * 60 * 60 * 1000;
/** Each computer's file in a release. */
const ASSET = { darwin: 'Crumpet-Mac.zip', win32: 'Crumpet-Windows.exe' };

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

/**
 * Asks GitHub for the newest release. Resolves with { version, url, asset }
 * when it's newer than `current` (`asset`: this computer's file, { name, url,
 * size, sha256 }, if the release has one), else null (also when offline).
 */
async function newerRelease(current, platform = process.platform) {
  try {
    const res = await fetch(LATEST_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const json = await res.json();
    const version = parseVersion(json.tag_name)?.join('.');
    if (!version || json.draft || json.prerelease || !isNewer(version, current)) return null;
    const file = (Array.isArray(json.assets) ? json.assets : []).find((a) => a && a.name === ASSET[platform]);
    const sha = /^sha256:([0-9a-f]{64})$/.exec(String(file?.digest ?? ''))?.[1];
    return {
      version,
      url: typeof json.html_url === 'string' ? json.html_url : `https://github.com/${REPO}/releases/latest`,
      asset: file && typeof file.browser_download_url === 'string' ? { name: file.name, url: file.browser_download_url, size: Number(file.size) || 0, sha256: sha ?? null } : null,
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
 * to install ({ version, file }); `ask(release, why)` (when it can't update
 * itself) resolves with 'download', 'later' or 'skip'. `force` (Help → Check
 * for a Newer Version) ignores the once-a-day limit and skipped versions;
 * `busy()` says it's downloading and `none()` that it's up to date
 * (`platform` and `execPath` are this copy's, unless a test says otherwise).
 * Resolves with the prepared update ({ version, file }) if there is one.
 */
async function checkForUpdates({ app, shell, ask, ready, busy, none, force = false, platform = process.platform, execPath = process.execPath }) {
  const file = path.join(app.getPath('userData'), 'updates.json');
  const dir = path.join(app.getPath('userData'), 'updates');
  const state = readState(file);
  tidy(dir, app.getVersion());
  if (!force && state.checked && Date.now() - state.checked < DAY) return null;
  const release = await newerRelease(app.getVersion(), platform);
  writeState(file, { ...state, checked: Date.now() });
  if (!release) {
    if (force && none) none();
    return null;
  }
  const why = cannotUpdate(platform, execPath);
  if (!why && release.asset) {
    if (force && busy) busy(release);
    const done = await prepare(release, dir, platform);
    if (done) {
      await ready(done);
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

module.exports = { parseVersion, isNewer, newerRelease, download, prepare, unpackMac, install, cannotUpdate, macAppPath, tidy, checkForUpdates, MAC_SWAP, REPO, ASSET };
