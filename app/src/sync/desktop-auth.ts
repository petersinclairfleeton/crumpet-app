// Google sign-in in the Mac app: Google's page opens in the browser and sends
// the person back to the app, which keeps the sign-in (desktop/google.cjs).
// Here it looks just like the website's GoogleAuth to the rest of Crumpet.

import type { DesktopInfo } from '../data/desktop';
import { SignInNeeded } from './google-auth';

type Google = NonNullable<DesktopInfo['google']>;

export class DesktopGoogleAuth {
  constructor(
    readonly clientId: string,
    private google: Google,
  ) {}

  /** Opens Google's sign-in in the browser (call from a click) and waits for the person to come back. */
  signIn(): Promise<string> {
    return this.google.signIn(this.clientId).then(
      (t) => t.token,
      (e) => {
        throw new SignInNeeded(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e));
      },
    );
  }

  /** A valid access token, from the sign-in the app keeps. Never opens anything: fails with SignInNeeded instead. */
  getToken = async (fresh = false): Promise<string> => {
    const t = await this.google.getToken(this.clientId, fresh);
    if (!t) throw new SignInNeeded('Google Drive needs you to sign in again.');
    return t.token;
  };

  signOut(): void {
    void this.google.signOut();
  }
}
