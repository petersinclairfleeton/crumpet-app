// Tells the web app it's running as the desktop app, and on which system,
// so it can fit the window (room for the Mac's window buttons, and so on).

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crumpetDesktop', {
  platform: process.platform,
  /** A web page clipped with the bookmark while the app is open (as it travels in the address). */
  onClip: (fn) => ipcRenderer.on('crumpet-clip', (_e, data) => fn(String(data))),
  /** Google Drive: sign in through the browser, and access tokens from the kept sign-in (see google.cjs). */
  google: {
    signIn: (clientId) => ipcRenderer.invoke('google-sign-in', clientId),
    getToken: (clientId, fresh) => ipcRenderer.invoke('google-token', clientId, fresh),
    signOut: () => ipcRenderer.invoke('google-sign-out'),
  },
});
