// Settings: installing Crumpet as an app.

import { useEffect, useState } from 'react';
import { canInstall, install, isInstalled, onInstallChange, platform } from '../data/pwa';

export function InstallSettings() {
  const [, setTick] = useState(0);
  useEffect(() => onInstallChange(() => setTick((t) => t + 1)), []);
  if (location.protocol === 'file:') return null;
  const where = platform();
  return (
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
  );
}
