// Telling people when a newer Crumpet is out. The app doesn't update itself
// (that needs a paid signing certificate on both Mac and Windows): once a day,
// a few seconds after it opens, it asks GitHub for the latest release, and if
// that's newer than this copy it offers to open the download page. "Skip this
// version" is remembered, so nobody is asked twice about the same one.

const fs = require('node:fs');
const path = require('node:path');

const REPO = 'petersinclairfleeton/crumpet-app';
// Tests point this at a stand-in for GitHub.
const LATEST_URL = process.env.CRUMPET_RELEASES_URL || `https://api.github.com/repos/${REPO}/releases/latest`;
const DAY = 24 * 60 * 60 * 1000;

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
 * Asks GitHub for the newest release. Resolves with { version, url } when
 * it's newer than `current`, else null (also when offline or GitHub says no).
 */
async function newerRelease(current) {
  try {
    const res = await fetch(LATEST_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const json = await res.json();
    const version = parseVersion(json.tag_name)?.join('.');
    if (!version || json.draft || json.prerelease || !isNewer(version, current)) return null;
    return { version, url: typeof json.html_url === 'string' ? json.html_url : `https://github.com/${REPO}/releases/latest` };
  } catch {
    return null;
  }
}

/**
 * The check: `ask(release)` shows the person and resolves with 'download',
 * 'later' or 'skip'. `force` (Help → Check for a newer version) ignores the
 * once-a-day limit and skipped versions, and `none()` says when it's up to date.
 */
async function checkForUpdates({ app, shell, ask, none, force = false }) {
  const file = path.join(app.getPath('userData'), 'updates.json');
  const state = readState(file);
  if (!force && state.checked && Date.now() - state.checked < DAY) return;
  const release = await newerRelease(app.getVersion());
  writeState(file, { ...state, checked: Date.now() });
  if (!release) {
    if (force && none) none();
    return;
  }
  if (!force && state.skipped === release.version) return;
  const choice = await ask(release);
  if (choice === 'download') void shell.openExternal(release.url);
  else if (choice === 'skip') writeState(file, { ...readState(file), skipped: release.version });
}

module.exports = { parseVersion, isNewer, newerRelease, checkForUpdates, REPO };
