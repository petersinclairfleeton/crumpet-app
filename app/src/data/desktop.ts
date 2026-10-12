// Crumpet as a desktop app (the Mac app in `desktop/`): its preload script
// tells the page, which then fits the window (room for the Mac's window
// buttons, a native see-through sidebar) and leaves out what only the web
// has (installing; Google's folder picker). Google Drive sign-in goes through
// the person's browser there (desktop/google.cjs).

export interface DesktopInfo {
  platform: string;
  /** Google Drive: signing in through the browser, and access tokens (desktop/google.cjs). */
  google?: {
    signIn(clientId: string): Promise<{ token: string; expires: number }>;
    /** Null when there's no sign-in kept (or Google no longer accepts it). */
    getToken(clientId: string, fresh?: boolean): Promise<{ token: string; expires: number } | null>;
    signOut(): Promise<void>;
  };
}

export const desktop: DesktopInfo | null = typeof window !== 'undefined' ? ((window as unknown as { crumpetDesktop?: DesktopInfo }).crumpetDesktop ?? null) : null;

/** Running as the Mac app. */
export const isMacApp = desktop?.platform === 'darwin';

/** The newest Mac app, built from this code by GitHub (see .github/workflows/mac.yml). */
export const MAC_DOWNLOAD = 'https://github.com/petersinclairfleeton/crumpet-app/releases/latest/download/Crumpet-Mac.dmg';
