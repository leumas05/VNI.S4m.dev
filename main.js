const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');
let autoUpdater; if (app.isPackaged) { autoUpdater = require('electron-updater').autoUpdater; } else { autoUpdater = { on: () => {}, checkForUpdates: () => {}, logger: { transports: { file: {} } } }; }
const log = require('electron-log');



let mainWindow;
let backendProcess;
let updateIsReady = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "S4m's VNI",
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#030712', // gray-950
      symbolColor: '#10b981', // emerald-500
      height: 32
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'frontend', 'public', 'icon.png')
  });

  // Intercept links with target="_blank" and open them in the user's default OS web browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  // Intercept links that try to navigate the current window (e.g. Leaflet attribution)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost:5173')) {
      event.preventDefault();
      require('electron').shell.openExternal(url);
    }
  });

  autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';
    autoUpdater.autoInstallOnAppQuit = false;
    
    if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(() => {
  console.log('Starting VNI Backend engine...');
  const backendPath = path.join(__dirname, 'backend', 'server.js');
  
  backendProcess = fork(backendPath, [], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });

  setTimeout(() => {
      createWindow();
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Automatically check for updates and notify the user
  if (app.isPackaged) {
    const { dialog } = require('electron');
    
    autoUpdater.on('error', (err) => {
      dialog.showErrorBox('Update Error', err == null ? "unknown" : (err.stack || err).toString());
    });

    let updateIsDownloading = false;

    autoUpdater.on('update-available', () => {
      updateIsDownloading = true;
      if (mainWindow) mainWindow.webContents.send('update-downloading');
    });
    
        autoUpdater.on('update-downloaded', () => {
      updateIsDownloading = false;
      updateIsReady = true;
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded');
      }
    });

    ipcMain.handle('get-update-state', () => {
      return { isDownloading: false, isReady: true };
    });

    ipcMain.on('restart-app', () => {
      log.info('Restarting app for update. Killing backend process...');
      if (backendProcess) {
        try { backendProcess.kill('SIGKILL'); } catch (e) {}
        backendProcess = null;
      }
      setTimeout(() => {
        autoUpdater.quitAndInstall(true, true);
      }, 500);
    });

    log.info('App starting up, checking for updates...');
    autoUpdater.checkForUpdates();
  setTimeout(() => {
    console.log('Sending fake update-downloading');
    if (mainWindow) mainWindow.webContents.send('update-downloading');
  }, 5000);

  setTimeout(() => {
    console.log('Sending fake update-downloaded');
    if (mainWindow) mainWindow.webContents.send('update-downloaded');
  }, 10000);

  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
