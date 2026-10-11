// Crumpet as a desktop app (the Mac app in `desktop/`): its preload script
// tells the page, which then fits the window (room for the Mac's window
// buttons, a native see-through sidebar) and leaves out what only the web
// has (Google sign-in, which needs the website's address; installing).

export interface DesktopInfo {
  platform: string;
}

export const desktop: DesktopInfo | null = typeof window !== 'undefined' ? ((window as unknown as { crumpetDesktop?: DesktopInfo }).crumpetDesktop ?? null) : null;

/** Running as the Mac app. */
export const isMacApp = desktop?.platform === 'darwin';

/** The newest Mac app, built from this code by GitHub (see .github/workflows/mac.yml). */
export const MAC_DOWNLOAD = 'https://github.com/petersinclairfleeton/crumpet-app/releases/latest/download/Crumpet-Mac.dmg';
