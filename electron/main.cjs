'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { join } = require('node:path');
const { readFile, writeFile, mkdir, rename } = require('node:fs/promises');
let windowRef;
const appFile = () => join(app.getPath('userData'), 'aquiles-state.json');

function createWindow() {
  windowRef = new BrowserWindow({
    width: 1500, height: 950, minWidth: 980, minHeight: 680,
    title: 'Aquiles AI — CENA Produções', backgroundColor: '#090c12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });
  windowRef.loadFile(join(__dirname, '..', 'src', 'index.html'));
  windowRef.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  windowRef.webContents.on('will-navigate', (event) => event.preventDefault());
  windowRef.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
}

app.whenReady().then(() => {
  ipcMain.handle('aquiles:load', async () => {
    try { const data = await readFile(appFile(), 'utf8'); return JSON.parse(data); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  });
  ipcMain.handle('aquiles:save', async (_e, data) => {
    if (!data || typeof data !== 'object' || data.version !== 1 ||
        !Array.isArray(data.channels) || data.channels.length !== 24 ||
        !Array.isArray(data.scenes) || data.scenes.length > 200 ||
        JSON.stringify(data).length > 3_000_000) {
      throw new Error('Dados inválidos ou excessivamente grandes');
    }
    const file = appFile();
    await mkdir(app.getPath('userData'), { recursive: true });
    const tmp = file + '.tmp';
    await writeFile(tmp, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
    await rename(tmp, file);
    return true;
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
