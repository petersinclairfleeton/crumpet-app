// electron-builder's settings: package.json's "build", plus the address
// Google sends people back to after signing in (the Mac app's Google client
// id, turned around), which macOS must know when the app is installed. The id
// is in app/.env (VITE_GOOGLE_MAC_CLIENT_ID), a public value.

const fs = require('node:fs');
const path = require('node:path');
const { schemeFor } = require('./google-scheme.cjs');

const base = require('./package.json').build;

function macClientId() {
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', 'app', '.env'), 'utf8');
    return /^VITE_GOOGLE_MAC_CLIENT_ID=(.+)$/m.exec(env)?.[1].trim() ?? '';
  } catch {
    return '';
  }
}

const id = process.env.VITE_GOOGLE_MAC_CLIENT_ID || macClientId();
module.exports = {
  ...base,
  protocols: [...(base.protocols ?? []), ...(id ? [{ name: 'Google sign-in', schemes: [schemeFor(id)] }] : [])],
};
