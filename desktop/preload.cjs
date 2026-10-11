// Tells the web app it's running as the desktop app, and on which system,
// so it can fit the window (room for the Mac's window buttons, and so on).

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('crumpetDesktop', {
  platform: process.platform,
});
