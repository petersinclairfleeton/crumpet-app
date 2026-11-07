// Tells the web app it's running as the desktop app, and on which system,
// so it can fit the window (room for the Mac's window buttons, and so on).

const { contextBridge, ipcRenderer } = require('electron');

// The app's version, passed by main.cjs (a sandboxed preload can't ask the app itself).
const version = process.argv.find((a) => a.startsWith('--crumpet-version='))?.slice('--crumpet-version='.length);

contextBridge.exposeInMainWorld('crumpetDesktop', {
  platform: process.platform,
  version,
  /** The app's Help menu → Report a Problem…: the page opens its report window. */
  onFeedback: (fn) => ipcRenderer.on('crumpet-feedback', () => fn()),
  /** A bug report or feedback: opens the computer's email app with it written in. */
  openMail: (url) => ipcRenderer.invoke('open-mail', String(url)),
  /** A web page clipped with the bookmark while the app is open (as it travels in the address). */
  onClip: (fn) => ipcRenderer.on('crumpet-clip', (_e, data) => fn(String(data))),
  /** The window going in or out of full screen (the Mac's window buttons hide there). */
  onFullScreen: (fn) => ipcRenderer.on('crumpet-fullscreen', (_e, on) => fn(!!on)),
  /** Google Drive: sign in through the browser, and access tokens from the kept sign-in (see google.cjs). */
  google: {
    signIn: (clientId) => ipcRenderer.invoke('google-sign-in', clientId),
    getToken: (clientId, fresh) => ipcRenderer.invoke('google-token', clientId, fresh),
    signOut: () => ipcRenderer.invoke('google-sign-out'),
  },
});
