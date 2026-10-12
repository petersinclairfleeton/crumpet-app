// Crumpet accounts: signing in with an email and password, or with Google,
// through Firebase Authentication (Google's account service). Crumpet talks
// to it directly (its REST API), so there's no extra library to load, and it
// works the same in the browser and the Mac app.
//
// An account says who you are: your name and email, on every device you
// sign in on. Your notes still live on the device and sync through your own
// Google Drive or folder; the account service never sees them.
//
// Set up once (docs/accounts-setup.md); without VITE_FIREBASE_API_KEY the
// app doesn't offer accounts at all.

const KEY = (import.meta.env?.VITE_FIREBASE_API_KEY as string | undefined) ?? '';
const AUTH = 'https://identitytoolkit.googleapis.com/v1';
const TOKEN = 'https://securetoken.googleapis.com/v1/token';
const SAVED = 'crumpet.account';
const SKIPPED = 'crumpet.account.skipped';

/** Whether this copy of Crumpet offers accounts. */
export const accountsReady = !!KEY;

export interface Account {
  uid: string;
  email: string;
  name: string;
  /** How you signed in. */
  via: 'password' | 'google';
  /** Lets this device act for the account later (to delete it); never shown. */
  refreshToken: string;
  /** Whether the email address has been confirmed (password accounts). */
  verified?: boolean;
}

/** Something went wrong, in words to show. */
export class AccountError extends Error {}

const MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: 'There’s already an account with that email. Sign in instead?',
  EMAIL_NOT_FOUND: 'No account has that email. Check it, or create an account.',
  INVALID_PASSWORD: 'That password isn’t right.',
  INVALID_LOGIN_CREDENTIALS: 'That email and password don’t match an account.',
  INVALID_EMAIL: 'That doesn’t look like an email address.',
  MISSING_PASSWORD: 'Type a password.',
  MISSING_EMAIL: 'Type your email address.',
  WEAK_PASSWORD: 'Choose a longer password: at least 6 characters.',
  USER_DISABLED: 'This account has been turned off.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many tries. Wait a few minutes and try again.',
  OPERATION_NOT_ALLOWED: 'This way of signing in isn’t switched on for Crumpet yet.',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Sign in again first, then try that.',
  TOKEN_EXPIRED: 'Sign in again first, then try that.',
  USER_NOT_FOUND: 'That account no longer exists.',
  INVALID_IDP_RESPONSE: 'Google didn’t confirm who you are. Try again.',
};

/** A friendly message for the service's error code ("WEAK_PASSWORD : Password should be…"). */
export function accountMessage(code: string): string {
  const key = code.split(/[ :]/)[0];
  return MESSAGES[key] ?? 'Signing in didn’t work. Check you’re online, and try again.';
}

async function call<T>(url: string, body: Record<string, unknown> | URLSearchParams): Promise<T> {
  if (!KEY) throw new AccountError('Accounts aren’t set up in this copy of Crumpet.');
  let res: Response;
  try {
    res = await fetch(`${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: body instanceof URLSearchParams ? body : JSON.stringify(body),
    });
  } catch {
    throw new AccountError('Can’t reach the account service. Are you online?');
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new AccountError(accountMessage(json.error?.message ?? ''));
  return json;
}

interface AuthReply {
  localId: string;
  email?: string;
  displayName?: string;
  fullName?: string;
  idToken: string;
  refreshToken: string;
  emailVerified?: boolean;
}

function account(r: AuthReply, via: Account['via'], name = ''): Account {
  return { uid: r.localId, email: r.email ?? '', name: r.displayName || r.fullName || name, via, refreshToken: r.refreshToken, ...(via === 'password' ? { verified: !!r.emailVerified } : {}) };
}

/** A new account with an email and password; a link to confirm the email is sent. */
export async function createAccount(email: string, password: string, name: string): Promise<Account> {
  const r = await call<AuthReply>(`${AUTH}/accounts:signUp`, { email: email.trim(), password, returnSecureToken: true });
  let idToken = r.idToken;
  if (name.trim()) {
    const u = await call<{ idToken?: string }>(`${AUTH}/accounts:update`, { idToken, displayName: name.trim(), returnSecureToken: true }).catch(() => ({ idToken }));
    idToken = u.idToken ?? idToken;
  }
  await call(`${AUTH}/accounts:sendOobCode`, { requestType: 'VERIFY_EMAIL', idToken }).catch(() => {});
  return account(r, 'password', name.trim());
}

/** Signs in with an email and password. */
export async function signInWithEmail(email: string, password: string): Promise<Account> {
  const r = await call<AuthReply>(`${AUTH}/accounts:signInWithPassword`, { email: email.trim(), password, returnSecureToken: true });
  // The sign-in reply leaves out whether the email is confirmed: ask.
  const look = await call<{ users?: { emailVerified?: boolean; displayName?: string }[] }>(`${AUTH}/accounts:lookup`, { idToken: r.idToken }).catch(() => ({ users: [] as { emailVerified?: boolean; displayName?: string }[] }));
  const u = look.users?.[0];
  return account({ ...r, emailVerified: u?.emailVerified, displayName: r.displayName || u?.displayName }, 'password');
}

/** Sends a link to choose a new password. */
export async function sendPasswordReset(email: string): Promise<void> {
  await call(`${AUTH}/accounts:sendOobCode`, { requestType: 'PASSWORD_RESET', email: email.trim() });
}

/** Signs in with a Google access token (from Google's own sign-in window). */
export async function signInWithGoogle(accessToken: string): Promise<Account> {
  const r = await call<AuthReply>(`${AUTH}/accounts:signInWithIdp`, {
    postBody: `access_token=${encodeURIComponent(accessToken)}&providerId=google.com`,
    requestUri: typeof location !== 'undefined' ? location.origin : 'http://localhost',
    returnSecureToken: true,
    returnIdpCredential: true,
  });
  return account(r, 'google');
}

/** Deletes the account for good (not the notes: they're on your devices and in your folder). */
export async function deleteAccount(a: Account): Promise<void> {
  const t = await call<{ id_token: string }>(TOKEN, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: a.refreshToken }));
  await call(`${AUTH}/accounts:delete`, { idToken: t.id_token });
}

// ---------- kept on this device ----------

export function savedAccount(): Account | null {
  try {
    const a = JSON.parse(localStorage.getItem(SAVED) ?? 'null') as Account | null;
    return a && typeof a.uid === 'string' && typeof a.email === 'string' ? a : null;
  } catch {
    return null;
  }
}

const listeners = new Set<(a: Account | null) => void>();

export function saveAccount(a: Account | null): void {
  try {
    if (a) localStorage.setItem(SAVED, JSON.stringify(a));
    else localStorage.removeItem(SAVED);
  } catch {
    // Private browsing: signed in until the page closes.
  }
  listeners.forEach((f) => f(a));
}

export function onAccount(f: (a: Account | null) => void): () => void {
  listeners.add(f);
  return () => void listeners.delete(f);
}

/** Whether "Continue without an account" was chosen on this device. */
export function skippedSignIn(): boolean {
  try {
    return localStorage.getItem(SKIPPED) === '1';
  } catch {
    return false;
  }
}

export function skipSignIn(): void {
  try {
    localStorage.setItem(SKIPPED, '1');
  } catch {
    // Asked again next time.
  }
}
