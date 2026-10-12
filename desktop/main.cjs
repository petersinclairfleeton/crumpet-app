// Crumpet for Mac: the web app in a window of its own (Electron, so it runs
// on the same engine as Chrome and every feature works the same). The app's
// files ship inside it and are served from app://crumpet/, so notes are kept
// on the Mac like any app's, and it works without the internet.
//
// The window is Mac-native: the sidebar shows the real see-through blur of
// the desktop behind it, and the red, yellow and green buttons sit in it.

const { app, BrowserWindow, Menu, clipboard, ipcMain, net, protocol, session, shell } = require('electron');
const google = require('./google.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ORIGIN = 'app://crumpet';
// The built web app: inside the app when packaged, else the app folder's build.
const WEB = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'app', 'dist');
const isMac = process.platform === 'darwin';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
]);

/** The window's size and place, kept between runs. */
const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function savedBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    return b && b.width > 400 && b.height > 300 ? b : null;
  } catch {
    return null;
  }
}

let win = null;
let loaded = false;

// The web clipper's bookmark opens crumpet://clip#clip=… (the page, in the
// address); macOS hands that to the app, which shows it, ready to save.
const SCHEME = 'crumpet';
let pendingClip = null;
function openClip(url) {
  if (typeof url !== 'string' || !url.startsWith(`${SCHEME}:`)) return;
  const at = url.indexOf('#clip=');
  if (at < 0) return;
  const data = url.slice(at + '#clip='.length);
  if (win && loaded) {
    win.webContents.send('crumpet-clip', data);
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  } else pendingClip = data;
}
/** An address handed to the app: Google sending someone back after signing in, or a clip. */
function openUrl(url) {
  if (google.handleRedirect(url)) {
    // Back from the browser: the app comes to the front.
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
    return;
  }
  openClip(url);
}
// (Before the app is ready: a click on the bookmark may be what started it.)
app.on('open-url', (e, url) => {
  e.preventDefault();
  openUrl(url);
});
// Windows and Linux pass the address on the command line.
process.argv.forEach(openUrl);

// Google Drive, for the page: signing in and access tokens (see google.cjs).
ipcMain.handle('google-sign-in', (_e, clientId) => google.signIn(String(clientId)));
ipcMain.handle('google-token', (_e, clientId, fresh) => google.getToken(String(clientId), !!fresh));
ipcMain.handle('google-sign-out', () => google.signOut());

function createWindow() {
  const bounds = savedBounds();
  win = new BrowserWindow({
    width: bounds?.width ?? 1360,
    height: bounds?.height ?? 860,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 720,
    minHeight: 480,
    title: 'Crumpet',
    show: false,
    // Mac: no title bar; the window buttons sit over the sidebar, which lets the desktop's blur through.
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 20 },
    vibrancy: isMac ? 'sidebar' : undefined,
    visualEffectState: 'followWindow',
    backgroundColor: isMac ? '#00000000' : '#e7eaf0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  });
  if (bounds?.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());

  const remember = () => {
    if (!win || win.isDestroyed()) return;
    try {
      fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
    } catch {
      // Not kept: it opens at the usual size next time.
    }
  };
  win.on('close', remember);

  // Links to other sites open in the person's browser; the app stays the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith(ORIGIN)) return;
    e.preventDefault();
    if (/^https?:/.test(url)) void shell.openExternal(url);
  });

  win.webContents.on('context-menu', (_e, params) => contextMenu(params));

  win.webContents.on('did-finish-load', () => (loaded = true));
  win.webContents.on('did-start-loading', () => (loaded = false));
  // Started by a clip: the app opens with it.
  void win.loadURL(`${ORIGIN}/${pendingClip ? `#clip=${pendingClip}` : ''}`);
  pendingClip = null;
  win.on('closed', () => {
    win = null;
    loaded = false;
  });
}

/**
 * A right click: spelling suggestions for a word underlined in red (as in
 * Word or TextEdit), then cut, copy and paste, and a link's choices. (Notes,
 * notebooks and tabs have menus of their own, made by the app.)
 */
function contextMenu(params) {
  if (!win) return;
  const wc = win.webContents;
  const items = [];
  if (params.misspelledWord) {
    for (const word of params.dictionarySuggestions.slice(0, 6)) items.push({ label: word, click: () => wc.replaceMisspelling(word) });
    if (!params.dictionarySuggestions.length) items.push({ label: 'No guesses found', enabled: false });
    items.push({ type: 'separator' }, { label: 'Learn Spelling', click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord) }, { type: 'separator' });
  }
  if (/^https?:/.test(params.linkURL)) {
    items.push({ label: 'Open Link in Browser', click: () => void shell.openExternal(params.linkURL) }, { label: 'Copy Link', click: () => clipboard.writeText(params.linkURL) }, { type: 'separator' });
  }
  const f = params.editFlags;
  if (params.isEditable) {
    items.push({ role: 'cut', enabled: f.canCut }, { role: 'copy', enabled: f.canCopy }, { role: 'paste', enabled: f.canPaste }, { type: 'separator' }, { role: 'selectAll', enabled: f.canSelectAll });
  } else if (params.selectionText.trim()) {
    items.push({ role: 'copy', enabled: f.canCopy });
    if (isMac) items.push({ label: `Look Up “${params.selectionText.trim().slice(0, 24)}”`, click: () => wc.showDefinitionForSelection() });
  }
  while (items.length && items[items.length - 1].type === 'separator') items.pop();
  if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
}

function menu() {
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Crumpet on the web', click: () => void shell.openExternal('https://petersinclairfleeton.github.io/crumpet-app/') },
        { label: 'Newer versions', click: () => void shell.openExternal('https://github.com/petersinclairfleeton/crumpet-app/releases/latest') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_e, argv) => {
    argv.forEach(openUrl);
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.setAsDefaultProtocolClient(SCHEME);
  app.whenReady().then(() => {
    // The app's own files; any other path is the app itself (it finds its way from the address).
    protocol.handle('app', (req) => {
      const { pathname } = new URL(req.url);
      let file = path.normalize(path.join(WEB, decodeURIComponent(pathname)));
      if (!file.startsWith(WEB)) return new Response('Not found', { status: 404 });
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB, 'index.html');
      return net.fetch(pathToFileURL(file).toString());
    });
    // Drive's API answers the website's address; the app's own (app://crumpet) is let through too.
    session.defaultSession.webRequest.onHeadersReceived({ urls: ['https://www.googleapis.com/*'] }, (details, done) => {
      const headers = { ...details.responseHeaders };
      const has = (name) => Object.keys(headers).some((k) => k.toLowerCase() === name);
      if (!has('access-control-allow-origin')) headers['Access-Control-Allow-Origin'] = [ORIGIN];
      if (!has('access-control-allow-headers')) headers['Access-Control-Allow-Headers'] = ['Authorization, Content-Type'];
      if (!has('access-control-allow-methods')) headers['Access-Control-Allow-Methods'] = ['GET, POST, PATCH, DELETE, OPTIONS'];
      done({ responseHeaders: headers });
    });
    menu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
