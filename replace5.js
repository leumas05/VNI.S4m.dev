const fs = require('fs');

// 1. main.js
let mainCode = fs.readFileSync('main.js', 'utf8');
mainCode = mainCode.replace(
  /autoUpdater\.on\('error', \(err\) => \{\n      dialog\.showErrorBox\('Update Error', err == null \? "unknown" : \(err\.stack \|\| err\)\.toString\(\)\);\n    \}\);/,
  `autoUpdater.on('error', (err) => {
      dialog.showErrorBox('Update Error', err == null ? "unknown" : (err.stack || err).toString());
    });

    autoUpdater.on('update-available', () => {
      if (mainWindow) {
        mainWindow.webContents.send('update-downloading');
      }
    });`
);
fs.writeFileSync('main.js', mainCode);

// 2. preload.js
let preloadCode = fs.readFileSync('preload.js', 'utf8');
preloadCode = preloadCode.replace(
  "onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),",
  "onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),\n  onUpdateDownloading: (callback) => ipcRenderer.on('update-downloading', callback),"
);
fs.writeFileSync('preload.js', preloadCode);
