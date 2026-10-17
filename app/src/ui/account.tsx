// The sign-in screen (email and password, or Google), shown on a device's
// first visit when accounts are set up, and the Account part of Settings.
// Signing in is optional: "Continue without an account" keeps everything
// working as before.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Account, AccountError, accountsReady, createAccount, deleteAccount, onAccount, saveAccount, savedAccount, sendPasswordReset, signInWithEmail, signInWithGoogle, skipSignIn, skippedSignIn } from '../data/account';
import { googleIdentity } from '../sync/google-auth';
import { desktop } from '../data/desktop';
import { useAppState, useAppStore } from './hooks';
import { Logo } from './icons';
import { SettingRow } from './settingrows';

const WEB_CLIENT_ID = (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';
/** Google sign-in for accounts: in the browser (the Mac app offers email). */
const googleReady = !!WEB_CLIENT_ID && !desktop;

const OPEN = 'crumpet:sign-in';

/** Opens the sign-in screen. */
export function openSignIn(): void {
  window.dispatchEvent(new Event(OPEN));
}

export function onOpenSignIn(fn: () => void): () => void {
  window.addEventListener(OPEN, fn);
  return () => window.removeEventListener(OPEN, fn);
}

/** Opens by itself on a device's first visit, until you sign in or choose to go without (not in the browsers that test Crumpet). */
export function shouldOpenSignIn(): boolean {
  if (!accountsReady || savedAccount() || skippedSignIn()) return false;
  return !(typeof navigator !== 'undefined' && navigator.webdriver);
}

/** The account this device is signed in to, kept up to date. */
export function useAccount(): Account | null {
  const [a, setA] = useState<Account | null>(() => savedAccount());
  useEffect(() => onAccount(setA), []);
  return a;
}

type Mode = 'sign-in' | 'create' | 'reset';

export function SignInScreen({ onClose }: { onClose(): void }) {
  const store = useAppStore();
  const state = useAppState();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<null | 'email' | 'google'>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), [mode]);

  const done = (a: Account) => {
    saveAccount(a);
    // Your name, for the sidebar and manuscripts, unless you've given one already.
    if (a.name && !state.settings.name.trim()) store.updateSettings({ name: a.name });
    onClose();
  };
  const run = async (kind: 'email' | 'google', fn: () => Promise<void>) => {
    setBusy(kind);
    setError('');
    setNote('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof AccountError ? err.message : err instanceof Error ? err.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(null);
    }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'reset')
      void run('email', async () => {
        await sendPasswordReset(email);
        setMode('sign-in');
        setNote(`If there’s an account for ${email.trim()}, a link to choose a new password is on its way.`);
      });
    else void run('email', async () => done(mode === 'create' ? await createAccount(email, password, name) : await signInWithEmail(email, password)));
  };
  const google = () => void run('google', async () => done(await signInWithGoogle(await googleIdentity(WEB_CLIENT_ID))));
  const later = () => {
    skipSignIn();
    onClose();
  };

  const title = mode === 'create' ? 'Create your account' : mode === 'reset' ? 'Choose a new password' : 'Sign in to Crumpet';
  return createPortal(
    <div className="dialog-backdrop signin-backdrop">
      <div className="signin" role="dialog" aria-modal="true" aria-label={title}>
        <div className="signin-brand">
          <Logo size={40} />
          <h1>{title}</h1>
          <p>{mode === 'reset' ? 'Type your email and we’ll send you a link.' : 'Your name and email on every device. Your notes stay yours, on your devices and in your own Drive or folder.'}</p>
        </div>

        {mode !== 'reset' && googleReady && (
          <>
            <button type="button" className="btn signin-google" onClick={google} disabled={!!busy}>
              <GoogleG /> {busy === 'google' ? 'Waiting for Google…' : 'Continue with Google'}
            </button>
            <p className="signin-or" aria-hidden="true">
              <span>or with email</span>
            </p>
          </>
        )}

        <form className="signin-form" onSubmit={submit}>
          {mode === 'create' && (
            <label className="field">
              <span>Your name</span>
              <input ref={first} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown on your manuscripts" />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input ref={mode === 'create' ? undefined : first} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {mode !== 'reset' && (
            <label className="field">
              <span>Password</span>
              <input type="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} required minLength={mode === 'create' ? 6 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
              {mode === 'create' && <small className="sync-hint">At least 6 characters.</small>}
            </label>
          )}
          {error && (
            <p className="signin-error" role="alert">
              {error}
            </p>
          )}
          {note && (
            <p className="signin-note" role="status">
              {note}
            </p>
          )}
          <button type="submit" className="btn primary signin-submit" disabled={!!busy}>
            {busy === 'email' ? 'One moment…' : mode === 'create' ? 'Create account' : mode === 'reset' ? 'Send the link' : 'Sign in'}
          </button>
        </form>

        <p className="signin-switch">
          {mode === 'sign-in' && (
            <>
              <button type="button" className="link-btn" onClick={() => setMode('create')}>
                Create an account
              </button>
              <button type="button" className="link-btn" onClick={() => setMode('reset')}>
                Forgot your password?
              </button>
            </>
          )}
          {mode !== 'sign-in' && (
            <button type="button" className="link-btn" onClick={() => setMode('sign-in')}>
              I have an account: sign in
            </button>
          )}
        </p>
        <button type="button" className="link-btn signin-later" onClick={later}>
          Continue without an account
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Settings → Account & sync: who you're signed in as. */
export function AccountSettings() {
  const a = useAccount();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  if (!accountsReady) return null;
  if (!a)
    return (
      <SettingRow title="Not signed in" hint="Sign in to have your name and email on every device. Optional: Crumpet works the same without.">
        <button type="button" className="btn" onClick={openSignIn}>
          Sign in or create an account
        </button>
      </SettingRow>
    );
  return (
    <>
      <SettingRow
        title={a.name || a.email}
        hint={
          <span className="account-who">
            {a.name && a.email ? `${a.email}, signed` : 'Signed'} in with {a.via === 'google' ? 'Google' : 'email'}.
            {a.via === 'password' && a.verified === false && ' Check your inbox for the link to confirm your email.'}
          </span>
        }
      >
        <button type="button" className="btn" onClick={() => saveAccount(null)}>
          Sign out
        </button>
      </SettingRow>
      <SettingRow title="Delete account" hint={confirm ? 'Delete it for good? Your notes stay on this device and in your folder.' : 'Your notes stay on this device and in your folder.'}>
        {!confirm ? (
          <button type="button" className="btn quiet danger" onClick={() => setConfirm(true)}>
            Delete account…
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                try {
                  await deleteAccount(a);
                  saveAccount(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'That didn’t work.');
                }
              }}
            >
              Delete account
            </button>
          </>
        )}
      </SettingRow>
      {error && (
        <p className="signin-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/** Google's "G", in its own colours (as Google asks sign-in buttons to show it). */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
