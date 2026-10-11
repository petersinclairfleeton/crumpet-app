// Settings: installing Crumpet as an app.

import { useEffect, useState } from 'react';
import { canInstall, install, isInstalled, onInstallChange, platform } from '../data/pwa';
import { MAC_DOWNLOAD, desktop } from '../data/desktop';

export function InstallSettings() {
  const [, setTick] = useState(0);
  useEffect(() => onInstallChange(() => setTick((t) => t + 1)), []);
  if (desktop) return <p className="sync-hint">You’re using the Crumpet app. Newer versions are on its Help menu.</p>;
  if (location.protocol === 'file:') return null;
  const where = platform();
  const mac = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints <= 1;
  return (
    <>
    {mac && (
      <div className="field" role="group" aria-label="Crumpet for Mac">
        <span>Crumpet for Mac</span>
        <p className="sync-hint">A real Mac app: its own window with the Mac’s see-through sidebar, in your Dock and Launchpad, working without the internet. Open the download, drag Crumpet into Applications, then open it. The first time, macOS asks you to allow it: in System Settings → Privacy &amp; Security, click “Open Anyway”.</p>
        <a className="btn primary install-btn" href={MAC_DOWNLOAD}>
          Download for Mac
        </a>
      </div>
    )}
    <div className="field" role="group" aria-label="Install the app">
      <span>Install the app</span>
      {isInstalled() ? (
        <p className="sync-hint">Crumpet is installed on this device. It opens even without the internet.</p>
      ) : canInstall() ? (
        <>
          <p className="sync-hint">Open Crumpet from your dock, taskbar or home screen like any app. It works without the internet too.</p>
          <button type="button" className="btn primary install-btn" onClick={() => void install()}>
            Install Crumpet
          </button>
        </>
      ) : (
        <p className="sync-hint">
          {where === 'ios'
            ? 'In Safari, tap the Share button, then “Add to Home Screen”.'
            : where === 'mac-safari'
              ? 'In Safari, choose File → “Add to Dock”.'
              : 'Use your browser’s menu: “Install Crumpet” or “Add to Home screen”. Once opened, it works without the internet too.'}
        </p>
      )}
    </div>
    </>
  );
}
