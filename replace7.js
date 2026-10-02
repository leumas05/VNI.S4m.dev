const fs = require('fs');

let mainCode = fs.readFileSync('main.js', 'utf8');

// Disable autoInstallOnAppQuit
mainCode = mainCode.replace(
  "autoUpdater.logger.transports.file.level = 'info';",
  "autoUpdater.logger.transports.file.level = 'info';\nautoUpdater.autoInstallOnAppQuit = false;"
);

// Add robust state tracking
const stateTracking = `let updateIsDownloading = false;

    autoUpdater.on('update-available', () => {
      updateIsDownloading = true;
      if (mainWindow) mainWindow.webContents.send('update-downloading');
    });`;

mainCode = mainCode.replace(
  /autoUpdater\.on\('update-available', \(\) => \{\n      if \(mainWindow\) \{\n        mainWindow\.webContents\.send\('update-downloading'\);\n      \}\n    \}\);/g,
  stateTracking
);

const stateTracking2 = `autoUpdater.on('update-downloaded', () => {
      updateIsDownloading = false;
      updateIsReady = true;
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded');
      }
    });

    ipcMain.handle('get-update-state', () => {
      return { isDownloading: updateIsDownloading, isReady: updateIsReady };
    });`;

mainCode = mainCode.replace(
  /autoUpdater\.on\('update-downloaded', \(\) => \{\n      updateIsReady = true;\n      if \(mainWindow\) \{\n        mainWindow\.webContents\.send\('update-downloaded'\);\n      \}\n    \}\);\n\n    ipcMain\.handle\('is-update-ready', \(\) => updateIsReady\);/g,
  stateTracking2
);

fs.writeFileSync('main.js', mainCode);

let preloadCode = fs.readFileSync('preload.js', 'utf8');
preloadCode = preloadCode.replace(
  "isUpdateReady: () => ipcRenderer.invoke('is-update-ready')",
  "isUpdateReady: () => ipcRenderer.invoke('is-update-ready'),\n  getUpdateState: () => ipcRenderer.invoke('get-update-state')"
);
fs.writeFileSync('preload.js', preloadCode);
