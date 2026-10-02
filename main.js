const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

let mainWindow;
let backendProcess;

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
      contextIsolation: true
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
    
    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version of VNI has been downloaded in the background. The app will restart to apply the update.',
        buttons: ['Restart Now', 'Later']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(true, true);
        }
      });
    });

    log.info('App starting up, checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();
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
