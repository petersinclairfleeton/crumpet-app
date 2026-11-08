// Crumpet as a desktop app (the Mac and Windows app in `desktop/`): its preload script
// tells the page, which then fits the window (room for the Mac's window
// buttons, a native see-through sidebar) and leaves out what only the web
// has (installing; Google's folder picker). Google Drive sign-in goes through
// the person's browser there (desktop/google.cjs).

export interface DesktopInfo {
  platform: string;
  /** The app's version, like "1.1.5" (older apps lack it). */
  version?: string;
  /** The app's own Help menu → Report a Problem… (older apps lack it). */
  onFeedback?(fn: () => void): void;
  /** The menu bar's items (File → New Note, Format → Bold…), by id (ui/desktopmenu.ts; older apps lack it). */
  onCommand?(fn: (id: string) => void): void;
  /** Zooms the whole window (older apps lack it). */
  setZoom?(factor: number): void;
  /** Opens a mailto: address in the computer's email app (older apps lack it). */
  openMail?(url: string): Promise<void>;
  /** Told when the window goes in or out of full screen (older apps don't offer it). */
  onFullScreen?(fn: (on: boolean) => void): void;
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

/** The newest Mac and Windows apps, built from this code by GitHub (see .github/workflows/desktop.yml). */
export const MAC_DOWNLOAD = 'https://github.com/petersinclairfleeton/crumpet-app/releases/latest/download/Crumpet-Mac.dmg';
export const WINDOWS_DOWNLOAD = 'https://github.com/petersinclairfleeton/crumpet-app/releases/latest/download/Crumpet-Windows.exe';
