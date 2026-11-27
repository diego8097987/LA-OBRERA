'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require('electron');
const { startStaticServer } = require('./static-server.cjs');

const APP_ID = 'com.laobrera.grill.pos';
const DEV_SERVER_URL = process.env.ELECTRON_DEV_URL || 'http://127.0.0.1:3000';

// Hosts allowed to open interactive OAuth popups (Firebase / Google Sign-In)
const AUTH_POPUP_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'poslaobrera.firebaseapp.com',
  'accounts.google.com',
  'apis.google.com',
  'accounts.youtube.com',
  'myaccount.google.com',
]);

let mainWindow = null;
let staticServer = null;
let updater = null;
let isShuttingDown = false;

app.setAppUserModelId(APP_ID);

// Ensure only one instance of LA OBRERA POS runs per Windows user session
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function getCleanChromeUserAgent(rawUa) {
  return String(rawUa || '')
    .replace(/\sElectron\/[\d.]+/g, '')
    .replace(/\sla-obrera-pos\/[\d.]+/gi, '')
    .replace(/\sLA OBRERA POS\/[\d.]+/gi, '');
}

function isAllowedAuthPopupUrl(rawUrl) {
  if (!rawUrl || rawUrl === 'about:blank') return true;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (AUTH_POPUP_HOSTS.has(parsed.hostname)) return true;
    if (parsed.hostname.endsWith('.firebaseapp.com')) return true;
    if (parsed.hostname.endsWith('.google.com')) return true;
    if (parsed.hostname.endsWith('.googleusercontent.com')) return true;
    return false;
  } catch {
    return false;
  }
}

function resolveWindowIcon() {
  const candidates = [
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(process.resourcesPath || '', 'icon.png'),
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.png'),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function broadcastToWindows(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

/**
 * Lazy-loads electron-updater only after the main window has painted (or on first IPC request)
 * so cold startup never blocks parsing updater dependencies from app.asar.
 */
function ensureUpdater() {
  if (!updater) {
    const { DesktopUpdater } = require('./updater.cjs');
    updater = new DesktopUpdater({
      onBeforeQuitForInstall: cleanupResources,
      broadcast: broadcastToWindows,
    });
  }
  return updater;
}

function buildAppMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Imprimir pantalla / ticket',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.print({ silent: false, printBackground: true });
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Buscar actualizaciones',
          click: () => {
            void ensureUpdater().checkForUpdates({ silent: false });
          },
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: 'Alt+F4',
          role: 'quit',
        },
      ],
    },
    {
      label: 'Edición',
      submenu: [
        { label: 'Deshacer', role: 'undo' },
        { label: 'Rehacer', role: 'redo' },
        { type: 'separator' },
        { label: 'Cortar', role: 'cut' },
        { label: 'Copiar', role: 'copy' },
        { label: 'Pegar', role: 'paste' },
        { label: 'Seleccionar todo', role: 'selectAll' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Recargar', role: 'reload' },
        { label: 'Forzar recarga', role: 'forceReload' },
        { type: 'separator' },
        { label: 'Restablecer zoom', role: 'resetZoom' },
        { label: 'Acercar', role: 'zoomIn' },
        { label: 'Alejar', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Pantalla completa', role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Buscar actualizaciones...',
          click: () => {
            void ensureUpdater().checkForUpdates({ silent: false });
          },
        },
        { type: 'separator' },
        {
          label: 'Acerca de LA OBRERA POS',
          click: () => {
            void dialog.showMessageBox(mainWindow || undefined, {
              type: 'info',
              title: 'Acerca de LA OBRERA POS',
              message: 'LA OBRERA Grill Asadero — Sistema POS, Cocina y Caja',
              detail: `Versión instalada: v${app.getVersion()}\nSistema operativo: Windows (${process.arch})\nSincronización en tiempo real con Firebase y actualizaciones automáticas sin desinstalar.`,
              buttons: ['Aceptar'],
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function configureDownloads() {
  session.defaultSession.on('will-download', (_event, item) => {
    const filename = item.getFilename() || 'documento-la-obrera.pdf';
    const downloadsDir = app.getPath('downloads');
    item.setSaveDialogOptions({
      title: 'Guardar archivo — LA OBRERA POS',
      defaultPath: path.join(downloadsDir, filename),
    });
  });
}

function getLightweightUpdaterState() {
  if (updater) return updater.getState();
  let effectiveUrl = '';
  try {
    const userSettingsPath = path.join(app.getPath('userData'), 'updater-settings.json');
    if (fs.existsSync(userSettingsPath)) {
      const parsed = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
      if (typeof parsed.updateUrl === 'string') effectiveUrl = parsed.updateUrl.trim();
    }
  } catch {
    // Fallback to bundled config
  }
  if (!effectiveUrl) {
    try {
      const bundledPath = path.join(__dirname, 'update-config.json');
      if (fs.existsSync(bundledPath)) {
        const parsed = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
        if (typeof parsed.updateUrl === 'string') effectiveUrl = parsed.updateUrl.trim();
      }
    } catch {
      // Ignore config read failure
    }
  }
  return {
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged || process.env.OBRERA_FORCE_DEV_UPDATER === '1',
    updateUrl: effectiveUrl,
    status: effectiveUrl ? 'idle' : 'not-configured',
    availableVersion: null,
    releaseDate: null,
    releaseNotes: '',
    progress: null,
    errorMessage: null,
    lastCheckedAt: null,
  };
}

function getCashCutsDirectory() {
  const docsDir = app.getPath('documents');
  const cutsDir = path.join(docsDir, 'LA OBRERA POS', 'Cortes de Caja');
  fs.mkdirSync(cutsDir, { recursive: true });
  return cutsDir;
}

function registerIpcHandlers() {
  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.handle('app:open-external', async (_event, rawUrl) => {
    try {
      const parsed = new URL(String(rawUrl || ''));
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        await shell.openExternal(parsed.toString());
      }
    } catch {
      // Ignore invalid external URLs
    }
  });

  ipcMain.handle('files:save-cash-cut-pdf', async (_event, payload) => {
    try {
      const rawName = String(payload?.filename || 'corte-caja-la-obrera.pdf');
      const safeName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_') || 'corte-caja.pdf';
      const base64Data = String(payload?.base64Data || '');
      if (!base64Data) {
        return { ok: false, error: 'El PDF está vacío.' };
      }

      const cutsDir = getCashCutsDirectory();
      const parsed = path.parse(safeName);
      let targetPath = path.join(cutsDir, safeName);
      if (fs.existsSync(targetPath)) {
        const stamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(11, 19);
        targetPath = path.join(cutsDir, `${parsed.name}-${stamp}${parsed.ext || '.pdf'}`);
      }

      const pdfBuffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(targetPath, pdfBuffer);
      return { ok: true, savedPath: targetPath, folderPath: cutsDir };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'No se pudo guardar el archivo PDF.',
      };
    }
  });

  ipcMain.handle('files:open-cash-cuts-folder', async () => {
    try {
      const cutsDir = getCashCutsDirectory();
      await shell.openPath(cutsDir);
      return { ok: true, folderPath: cutsDir };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'No se pudo abrir la carpeta de cortes.',
      };
    }
  });

  ipcMain.handle('updater:get-state', () => {
    return getLightweightUpdaterState();
  });

  ipcMain.handle('updater:check', async () => {
    return ensureUpdater().checkForUpdates({ silent: false });
  });

  ipcMain.handle('updater:download', async () => {
    return ensureUpdater().downloadUpdate();
  });

  ipcMain.handle('updater:install', async () => {
    return ensureUpdater().installUpdate();
  });

  ipcMain.handle('updater:set-url', (_event, rawUrl) => {
    return ensureUpdater().setUpdateUrl(rawUrl);
  });
}

async function createMainWindow() {
  let startUrl = DEV_SERVER_URL;

  if (app.isPackaged || process.env.OBRERA_SERVE_DIST === '1') {
    const distDir = path.join(__dirname, '..', 'dist');
    staticServer = await startStaticServer(distDir);
    startUrl = staticServer.url;
  }

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#0e0c0b',
    title: `LA OBRERA Grill Asadero — POS v${app.getVersion()}`,
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  const cleanUa = getCleanChromeUserAgent(mainWindow.webContents.getUserAgent());
  mainWindow.webContents.setUserAgent(cleanUa);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAuthPopupUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 680,
          parent: mainWindow,
          modal: false,
          autoHideMenuBar: true,
          backgroundColor: '#ffffff',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }

    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-create-window', (childWin) => {
    childWin.webContents.setUserAgent(cleanUa);
  });

  let windowRevealed = false;
  const revealWindow = () => {
    if (windowRevealed || !mainWindow || mainWindow.isDestroyed()) return;
    windowRevealed = true;
    mainWindow.maximize();
    mainWindow.show();

    // Defer non-critical background updater initialization until after first paint
    setTimeout(() => {
      if (!isShuttingDown) {
        ensureUpdater().startBackgroundPolling();
      }
    }, 1500);
  };

  mainWindow.once('ready-to-show', revealWindow);
  mainWindow.webContents.once('dom-ready', () => {
    setTimeout(revealWindow, 120);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(startUrl);
}

async function cleanupResources() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (updater) {
    updater.stopBackgroundPolling();
  }
  if (staticServer) {
    try {
      await staticServer.close();
    } catch {
      // Ignore close error on exit
    }
    staticServer = null;
  }
}

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  void cleanupResources();
});

if (gotSingleInstanceLock) {
  app
    .whenReady()
    .then(async () => {
      registerIpcHandlers();
      // Open window immediately; configure menu & downloads right after launch begins
      const winPromise = createMainWindow();
      configureDownloads();
      buildAppMenu();
      await winPromise;
    })
    .catch((err) => {
      console.error('Error fatal al iniciar LA OBRERA POS:', err);
      dialog.showErrorBox(
        'Error al iniciar LA OBRERA POS',
        err instanceof Error ? err.message : String(err)
      );
      app.quit();
    });
}
