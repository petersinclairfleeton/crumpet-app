// Signing in to Google from the browser with Google Identity Services: no
// server, no password ever seen by Crumpet. Google returns an access token
// that lasts an hour; a new one is fetched quietly when needed (if the
// browser blocks that, the app asks you to tap "Reconnect").

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_KEY = 'crumpet.google.token';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}

interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type: string; message?: string }) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

let loading: Promise<Gis> | null = null;

function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  loading ??= new Promise<Gis>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (w.google?.accounts?.oauth2 ? resolve(w.google) : reject(new Error('Google sign-in did not load')));
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load Google sign-in. Are you online?"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export class SignInNeeded extends Error {}

export class GoogleAuth {
  private token: { value: string; expires: number } | null = null;
  private pending: Promise<string> | null = null;

  constructor(
    readonly clientId: string,
    private hint?: string,
  ) {
    try {
      const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as { value: string; expires: number; clientId: string } | null;
      if (saved && saved.clientId === clientId && saved.expires > Date.now() + 60_000) this.token = saved;
    } catch {
      // No saved token.
    }
  }

  /** A valid access token. Without `interactive`, fails with SignInNeeded rather than showing anything unexpected. */
  getToken = async (fresh = false, interactive = false): Promise<string> => {
    if (!fresh && this.token && this.token.expires > Date.now() + 60_000) return this.token.value;
    this.pending ??= this.request(interactive).finally(() => {
      this.pending = null;
    });
    return this.pending;
  };

  /** Asks Google for access; call from a click so the sign-in window isn't blocked. */
  signIn(): Promise<string> {
    return this.getToken(true, true);
  }

  signOut(): void {
    const t = this.token?.value;
    this.token = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing saved.
    }
    if (t) loadGis().then((g) => g.accounts.oauth2.revoke(t), () => {});
  }

  private async request(interactive: boolean): Promise<string> {
    const gis = await loadGis();
    return new Promise<string>((resolve, reject) => {
      const client = gis.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: DRIVE_SCOPE,
        callback: (r) => {
          if (!r.access_token) {
            reject(new SignInNeeded(r.error_description ?? r.error ?? 'Google sign-in was cancelled'));
            return;
          }
          this.token = { value: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 };
          try {
            localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...this.token, clientId: this.clientId }));
          } catch {
            // Fine: it just won't survive a reload.
          }
          resolve(r.access_token);
        },
        error_callback: (e) => reject(new SignInNeeded(e.type === 'popup_failed_to_open' ? 'The browser blocked the Google sign-in window.' : (e.message ?? 'Google sign-in was cancelled'))),
      });
      // Quietly when we've been allowed before; the full consent screen the first time.
      client.requestAccessToken({ prompt: interactive && !this.hint ? 'consent' : '', ...(this.hint ? { login_hint: this.hint } : {}) });
    });
  }
}
