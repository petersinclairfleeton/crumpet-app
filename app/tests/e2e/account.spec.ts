import { type Page, expect, test } from '@playwright/test';

// Accounts: Firebase's sign-in service and Google's sign-in window are faked,
// with a small in-memory list of accounts.

const FAKE_SIGN_IN = `window.google = Object.assign(window.google || {}, { accounts: { oauth2: {
  initTokenClient(cfg) { return { requestAccessToken() { setTimeout(() => cfg.callback({ access_token: 'google-token-for-' + cfg.scope, expires_in: 3600 }), 0); } }; },
  revoke(t, done) { done && done(); },
} } });`;

interface FakeUser {
  localId: string;
  email: string;
  password?: string;
  displayName?: string;
  emailVerified: boolean;
}

async function fakeAccounts(page: Page) {
  const users: FakeUser[] = [];
  const sent: { requestType: string; email?: string }[] = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const reply = (status: number, body: unknown) => ({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const tokens = (u: FakeUser) => ({ localId: u.localId, email: u.email, displayName: u.displayName ?? '', idToken: `id-${u.localId}`, refreshToken: `refresh-${u.localId}` });
  const byToken = (t: string) => users.find((u) => `id-${u.localId}` === t);
  await page.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_SIGN_IN }));
  await page.route('https://securetoken.googleapis.com/**', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const refresh = new URLSearchParams(r.request().postData() ?? '').get('refresh_token') ?? '';
    return r.fulfill(reply(200, { id_token: `id-${refresh.replace(/^refresh-/, '')}` }));
  });
  await page.route('https://identitytoolkit.googleapis.com/**', (r) => {
    const req = r.request();
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    expect(new URL(req.url()).searchParams.get('key')).toBe('e2e-firebase');
    const action = /accounts:(\w+)/.exec(req.url())?.[1];
    const b = JSON.parse(req.postData() ?? '{}');
    switch (action) {
      case 'signUp': {
        if (users.some((u) => u.email === b.email)) return r.fulfill(reply(400, { error: { message: 'EMAIL_EXISTS' } }));
        if (b.password.length < 6) return r.fulfill(reply(400, { error: { message: 'WEAK_PASSWORD : Password should be at least 6 characters' } }));
        const u = { localId: `u${users.length + 1}`, email: b.email, password: b.password, emailVerified: false };
        users.push(u);
        return r.fulfill(reply(200, tokens(u)));
      }
      case 'update': {
        const u = byToken(b.idToken)!;
        u.displayName = b.displayName;
        return r.fulfill(reply(200, tokens(u)));
      }
      case 'signInWithPassword': {
        const u = users.find((x) => x.email === b.email && x.password === b.password);
        return r.fulfill(u ? reply(200, tokens(u)) : reply(400, { error: { message: 'INVALID_LOGIN_CREDENTIALS' } }));
      }
      case 'lookup': {
        const u = byToken(b.idToken);
        return r.fulfill(reply(200, { users: u ? [{ localId: u.localId, email: u.email, displayName: u.displayName, emailVerified: u.emailVerified }] : [] }));
      }
      case 'sendOobCode':
        sent.push({ requestType: b.requestType, email: b.email ?? byToken(b.idToken)?.email });
        return r.fulfill(reply(200, {}));
      case 'signInWithIdp': {
        // Only a token that asked Google for who you are will do.
        expect(b.postBody).toContain('access_token=google-token-for-openid%20email%20profile');
        expect(b.postBody).toContain('providerId=google.com');
        let u = users.find((x) => x.email === 'robin@gmail.com');
        if (!u) users.push((u = { localId: 'g1', email: 'robin@gmail.com', displayName: 'Robin Hart', emailVerified: true }));
        return r.fulfill(reply(200, { ...tokens(u), fullName: 'Robin Hart' }));
      }
      case 'delete': {
        const u = byToken(b.idToken);
        if (u) users.splice(users.indexOf(u), 1);
        return r.fulfill(reply(200, {}));
      }
    }
    return r.fulfill(reply(400, { error: { message: 'UNKNOWN' } }));
  });
  return { users, sent };
}

async function openSignIn(page: Page) {
  await page.getByRole('button', { name: /Your notes|Robin|Sam/ }).first().click();
  await page.getByRole('button', { name: 'Sign in or create an account' }).click();
  return page.getByRole('dialog', { name: 'Sign in to Crumpet' });
}

test('accounts: create one with email, sign out, sign in again, reset a password, and delete it', async ({ page }) => {
  const fake = await fakeAccounts(page);
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Notebooks' })).toBeVisible();
  let dialog = await openSignIn(page);
  await dialog.getByRole('button', { name: 'Create an account' }).click();
  dialog = page.getByRole('dialog', { name: 'Create your account' });
  await dialog.getByLabel('Your name').fill('Sam Reed');
  await dialog.getByLabel('Email').fill('sam@example.com');
  await dialog.getByLabel('Password').fill('abc');
  // Too short: the box says so itself; the service would too.
  await dialog.getByRole('button', { name: 'Create account' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Password').fill('lighthouse');
  await dialog.getByRole('button', { name: 'Create account' }).click();
  await expect(dialog).toHaveCount(0);
  expect(fake.users.map((u) => [u.email, u.displayName])).toEqual([['sam@example.com', 'Sam Reed']]);
  expect(fake.sent).toEqual([{ requestType: 'VERIFY_EMAIL', email: 'sam@example.com' }]);
  // The name fills in, and Settings says who's signed in.
  await expect(page.locator('.account-name')).toHaveText('Sam Reed');
  const settings = page.locator('.settings');
  await expect(settings).toContainText('Signed in as Sam Reed (sam@example.com) with email.');
  await expect(settings).toContainText('Check your inbox for the link to confirm your email.');
  // Still signed in after a reload.
  await page.reload();
  await page.getByRole('button', { name: /Sam Reed/ }).click();
  await expect(settings).toContainText('Signed in as Sam Reed');

  // Sign out, and a wrong password says so.
  await settings.getByRole('button', { name: 'Sign out' }).click();
  await settings.getByRole('button', { name: 'Sign in or create an account' }).click();
  dialog = page.getByRole('dialog', { name: 'Sign in to Crumpet' });
  await dialog.getByLabel('Email').fill('sam@example.com');
  await dialog.getByLabel('Password').fill('wrong');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('That email and password don’t match an account.');
  // Forgot it: a link is sent.
  await dialog.getByRole('button', { name: 'Forgot your password?' }).click();
  const reset = page.getByRole('dialog', { name: 'Choose a new password' });
  await expect(reset.getByLabel('Email')).toHaveValue('sam@example.com');
  await reset.getByRole('button', { name: 'Send the link' }).click();
  await expect(dialog.getByRole('status')).toContainText('a link to choose a new password is on its way');
  expect(fake.sent[1]).toEqual({ requestType: 'PASSWORD_RESET', email: 'sam@example.com' });
  // The right password signs in.
  await dialog.getByLabel('Password').fill('lighthouse');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(settings).toContainText('Signed in as Sam Reed');

  // Delete the account: gone from the service, and signed out here; the notes stay.
  await settings.getByRole('button', { name: 'Delete account…' }).click();
  await settings.getByRole('button', { name: 'Delete account', exact: true }).click();
  await expect(settings.getByRole('button', { name: 'Sign in or create an account' })).toBeVisible();
  expect(fake.users).toEqual([]);
});

test('accounts: continue with Google, and the screen on a first visit (or carry on without)', async ({ page }) => {
  await fakeAccounts(page);
  // A first visit as a person would make it (the tests' browser is otherwise left alone).
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Sign in to Crumpet' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(dialog).toHaveCount(0);
  // Then the welcome guide.
  await expect(page.getByRole('dialog', { name: /Welcome to Crumpet/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.account-name')).toHaveText('Robin Hart');
  await page.reload();
  // Signed in: not asked again.
  await expect(page.getByRole('navigation', { name: 'Notebooks' })).toBeVisible();
  await expect(dialog).toHaveCount(0);

  // Another device, never signed in: "Continue without an account" isn't asked again.
  const other = await page.context().browser()!.newPage();
  await fakeAccounts(other);
  await other.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await other.goto('/');
  const there = other.getByRole('dialog', { name: 'Sign in to Crumpet' });
  await there.getByRole('button', { name: 'Continue without an account' }).click();
  await expect(there).toHaveCount(0);
  await other.reload();
  await expect(other.getByRole('navigation', { name: 'Notebooks' })).toBeVisible();
  await expect(there).toHaveCount(0);
  await other.close();
});
