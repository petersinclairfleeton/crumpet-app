// Crumpet for Mac: the web app in a window of its own (Electron, so it runs
// on the same engine as Chrome and every feature works the same). The app's
// files ship inside it and are served from app://crumpet/, so notes are kept
// on the Mac like any app's, and it works without the internet.
//
// The window is Mac-native: the sidebar shows the real see-through blur of
// the desktop behind it, and the red, yellow and green buttons sit in it.

const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');
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

  void win.loadURL(`${ORIGIN}/`);
  win.on('closed', () => (win = null));
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
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    // The app's own files; any other path is the app itself (it finds its way from the address).
    protocol.handle('app', (req) => {
      const { pathname } = new URL(req.url);
      let file = path.normalize(path.join(WEB, decodeURIComponent(pathname)));
      if (!file.startsWith(WEB)) return new Response('Not found', { status: 404 });
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB, 'index.html');
      return net.fetch(pathToFileURL(file).toString());
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
