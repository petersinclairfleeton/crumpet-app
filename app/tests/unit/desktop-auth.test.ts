import { describe, expect, it } from 'vitest';
import { DesktopGoogleAuth } from '../../src/sync/desktop-auth';
import { SignInNeeded } from '../../src/sync/google-auth';

describe('Google sign-in in the Mac app', () => {
  it('gets tokens from the sign-in the app keeps, and asks to sign in again when there is none', async () => {
    let kept: { token: string; expires: number } | null = null;
    const asked: string[] = [];
    const auth = new DesktopGoogleAuth('mac-id', {
      signIn: async (id) => (asked.push(`in:${id}`), (kept = { token: 't1', expires: 1 })),
      getToken: async (id, fresh) => (asked.push(`token:${id}:${!!fresh}`), kept),
      signOut: async () => void (kept = null),
    });
    await expect(auth.getToken()).rejects.toBeInstanceOf(SignInNeeded);
    expect(await auth.signIn()).toBe('t1');
    expect(await auth.getToken(true)).toBe('t1');
    auth.signOut();
    await expect(auth.getToken()).rejects.toBeInstanceOf(SignInNeeded);
    expect(asked).toEqual(['token:mac-id:false', 'in:mac-id', 'token:mac-id:true', 'token:mac-id:false']);
  });

  it('a sign-in that fails or is cancelled says why, plainly', async () => {
    const auth = new DesktopGoogleAuth('mac-id', {
      signIn: async () => {
        throw new Error("Error invoking remote method 'google-sign-in': Error: Google sign-in was cancelled.");
      },
      getToken: async () => null,
      signOut: async () => {},
    });
    await expect(auth.signIn()).rejects.toThrow(/^Google sign-in was cancelled\.$/);
  });
});
