// Crumpet as an installed app: the service worker that keeps it working
// without the internet, and the browser's offer to install it.

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let offer: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

/** Starts the service worker (in the built app on the web only) and listens for the install offer. */
export function startPwa(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    // Shown from Settings rather than the browser's own banner.
    e.preventDefault();
    offer = e as InstallPrompt;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    changed();
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => console.warn('[crumpet] Offline copy unavailable', err));
    });
  }
}

/** Running as an installed app. */
export function isInstalled(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
}

/** The browser offers to install it (Chrome, Edge, Android). */
export function canInstall(): boolean {
  return !!offer;
}

/** Asks the browser to install it; true if it was. */
export async function install(): Promise<boolean> {
  if (!offer) return false;
  const o = offer;
  offer = null;
  await o.prompt();
  const { outcome } = await o.userChoice;
  changed();
  return outcome === 'accepted';
}

export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Which device this is, for how to install by hand. */
export function platform(): 'ios' | 'mac-safari' | 'other' {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return 'mac-safari';
  return 'other';
}
