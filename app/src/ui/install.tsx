// Settings: installing Crumpet as an app.

import { useEffect, useState } from 'react';
import { canInstall, install, isInstalled, onInstallChange, platform } from '../data/pwa';
import { MAC_DOWNLOAD, WINDOWS_DOWNLOAD, desktop } from '../data/desktop';
import { SettingGroup, SettingRow } from './settingrows';

export function InstallSettings() {
  const [, setTick] = useState(0);
  useEffect(() => onInstallChange(() => setTick((t) => t + 1)), []);
  if (desktop)
    return (
      <SettingGroup title="The app">
        <SettingRow title="You’re using the Crumpet app" hint="It keeps itself up to date: a new version downloads by itself and installs when you restart or quit Crumpet (or check on its Help menu: Check for a Newer Version)." />
      </SettingGroup>
    );
  if (location.protocol === 'file:') return null;
  const where = platform();
  const mac = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints <= 1;
  const windows = /Windows/.test(navigator.userAgent);
  return (
    <SettingGroup title="The app">
      {mac && (
        <SettingRow title="Crumpet for Mac" hint="Its own window, in your Dock, and working without the internet. Drag it into Applications; the first time, allow it in System Settings → Privacy & Security (“Open Anyway”).">
          <a className="btn" href={MAC_DOWNLOAD}>
            Download for Mac
          </a>
        </SettingRow>
      )}
      {windows && (
        <SettingRow title="Crumpet for Windows" hint="Its own window, on your Start menu and taskbar, and working without the internet. The first time, Windows may say it protected your PC: click More info, then Run anyway.">
          <a className="btn" href={WINDOWS_DOWNLOAD}>
            Download for Windows
          </a>
        </SettingRow>
      )}
      {isInstalled() ? (
        <SettingRow title="Installed" hint="Crumpet is installed on this device. It opens even without the internet." />
      ) : canInstall() ? (
        <SettingRow title="Install the app" hint="Open Crumpet from your dock, taskbar or home screen like any app. It works without the internet too.">
          <button type="button" className="btn" onClick={() => void install()}>
            Install Crumpet
          </button>
        </SettingRow>
      ) : (
        <SettingRow
          title="Install the app"
          hint={
            where === 'ios'
              ? 'In Safari, tap the Share button, then “Add to Home Screen”.'
              : where === 'mac-safari'
                ? 'In Safari, choose File → “Add to Dock”.'
                : 'Use your browser’s menu: “Install Crumpet” or “Add to Home screen”. Once opened, it works without the internet too.'
          }
        />
      )}
    </SettingGroup>
  );
}
