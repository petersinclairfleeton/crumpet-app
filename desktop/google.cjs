// Signing in to Google from the Mac app, the way Google asks Mac and iPhone
// apps to: Google's sign-in page opens in the person's own browser (never
// inside the app), and Google sends them back to the app through its own
// address, com.googleusercontent.apps.<id>:/oauth2redirect, with a one-time
// code. The app trades the code for access (PKCE: no client secret exists for
// this kind of client). Google's "stay signed in" token is kept encrypted with
// the Mac's keychain (safeStorage), so the app stays connected.
//
// The page asks for access tokens through the preload (getToken), and uses
// them with Drive exactly as the website does, so the files it makes belong
// to Crumpet and every device sees them.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { app, safeStorage, shell } = require('electron');

// Tests point these at a stand-in for Google.
const AUTH_URL = process.env.CRUMPET_GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = process.env.CRUMPET_GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const REVOKE_URL = process.env.CRUMPET_GOOGLE_REVOKE_URL || 'https://oauth2.googleapis.com/revoke';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
/** Google's sign-in can take a while (two-step codes and the like). */
const WAIT_MS = 10 * 60 * 1000;

const { schemeFor } = require('./google-scheme.cjs');

const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const savedFile = () => path.join(app.getPath('userData'), 'google.bin');

/** The kept sign-in: { clientId, refresh }, or null. */
function loadSaved() {
  try {
    const data = fs.readFileSync(savedFile());
    const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(data) : data.toString('utf8');
    const saved = JSON.parse(text);
    return saved && typeof saved.refresh === 'string' ? saved : null;
  } catch {
    return null;
  }
}

function save(saved) {
  const text = JSON.stringify(saved);
  fs.writeFileSync(savedFile(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8'), { mode: 0o600 });
}

function forget() {
  try {
    fs.unlinkSync(savedFile());
  } catch {
    // Nothing kept.
  }
}

let access = null; // { clientId, token, expires }
let pending = null; // { scheme, state, resolve, reject, timer }

async function tokenRequest(fields) {
  let res;
  try {
    res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });
  } catch {
    throw new Error("Couldn't reach Google. Are you online?");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    const err = new Error(json.error_description || json.error || `Google said no (${res.status}).`);
    err.code = json.error;
    throw err;
  }
  return json;
}

function keep(clientId, json) {
  access = { clientId, token: json.access_token, expires: Date.now() + (json.expires_in || 3600) * 1000 };
  return { token: access.token, expires: access.expires };
}

/**
 * Signs in: opens Google's page in the browser and waits for Google to send
 * the person back. Resolves with an access token.
 */
async function signIn(clientId) {
  if (!clientId) throw new Error('Google sign-in isn’t set up in this copy of Crumpet.');
  if (pending) pending.reject(new Error('Sign-in started again.'));
  const scheme = schemeFor(clientId);
  // Lets macOS hand Google's reply to this app (the app declares the address too, for when it's installed).
  app.setAsDefaultProtocolClient(scheme);
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const state = base64url(crypto.randomBytes(16));
  const redirect = `${scheme}:/oauth2redirect`;
  const url = `${AUTH_URL}?${new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: SCOPE, code_challenge: challenge, code_challenge_method: 'S256', state, prompt: 'consent' })}`;
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending = null;
      reject(new Error('Google sign-in took too long. Try again.'));
    }, WAIT_MS);
    pending = { scheme, state, resolve, reject, timer };
    shell.openExternal(url).catch(() => {
      clearTimeout(timer);
      pending = null;
      reject(new Error("Couldn't open your browser to sign in to Google."));
    });
  });
  const json = await tokenRequest({ client_id: clientId, code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: redirect });
  if (json.refresh_token) save({ clientId, refresh: json.refresh_token });
  return keep(clientId, json);
}

/**
 * Google's reply, arriving at the app's address. Returns true when it was
 * one (so the caller doesn't treat it as anything else).
 */
function handleRedirect(url) {
  if (!pending || typeof url !== 'string' || !url.startsWith(`${pending.scheme}:`)) return false;
  const params = new URL(url).searchParams;
  const { state, resolve, reject, timer } = pending;
  if (params.get('state') !== state) return true;
  clearTimeout(timer);
  pending = null;
  const code = params.get('code');
  if (code) resolve(code);
  else reject(new Error(params.get('error') === 'access_denied' ? 'Google sign-in was cancelled.' : `Google sign-in didn't finish (${params.get('error') || 'no code'}).`));
  return true;
}

/** A fresh access token from the kept sign-in, or null when there isn't one (or Google no longer accepts it). */
async function getToken(clientId, fresh) {
  if (!fresh && access && access.clientId === clientId && access.expires > Date.now() + 60_000) return { token: access.token, expires: access.expires };
  const saved = loadSaved();
  if (!saved || saved.clientId !== clientId) return null;
  try {
    return keep(clientId, await tokenRequest({ client_id: clientId, refresh_token: saved.refresh, grant_type: 'refresh_token' }));
  } catch (err) {
    // Taken back in the Google account, or expired: sign in again.
    if (err.code === 'invalid_grant') forget();
    if (err.code) return null;
    throw err;
  }
}

async function signOut() {
  const saved = loadSaved();
  access = null;
  forget();
  if (saved) await fetch(`${REVOKE_URL}?${new URLSearchParams({ token: saved.refresh })}`, { method: 'POST' }).catch(() => {});
}

module.exports = { signIn, handleRedirect, getToken, signOut, schemeFor };
