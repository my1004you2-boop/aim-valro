import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 165Hz 이상에서 프레임 제한과 수직동기를 끈다.
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('disable-gpu-vsync');

const userFile = (...p) => path.join(app.getPath('userData'), ...p);

async function writeAtomic(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, text, 'utf8');
  await fs.rename(tmp, file);
}

ipcMain.handle('settings:load', async () => {
  try {
    return await fs.readFile(userFile('settings.json'), 'utf8');
  } catch {
    return null;
  }
});
ipcMain.handle('settings:save', (_e, text) => writeAtomic(userFile('settings.json'), String(text)));
ipcMain.handle('session:save', (_e, name, text) => {
  const safe = String(name).replace(/[^\w.-]/g, '_');
  return writeAtomic(userFile('sessions', safe), String(text));
});
ipcMain.handle('app:quit', () => app.quit());

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

// 기본 메뉴 단축키(Ctrl+W, Ctrl+R 등)가 앉기(Ctrl)+이동과 겹치지 않게 메뉴를 없앤다.
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});
app.on('window-all-closed', () => app.quit());
