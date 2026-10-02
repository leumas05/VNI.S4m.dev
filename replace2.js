const fs = require('fs');

// 1. main.js
let mainCode = fs.readFileSync('main.js', 'utf8');
mainCode = mainCode.replace('let backendProcess;', 'let backendProcess;\nlet updateIsReady = false;');
mainCode = mainCode.replace(
  /autoUpdater\.on\('update-downloaded', \(\) => \{\n      if \(mainWindow\) \{\n        mainWindow\.webContents\.send\('update-downloaded'\);\n      \}\n    \}\);/,
  `autoUpdater.on('update-downloaded', () => {
      updateIsReady = true;
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded');
      }
    });

    ipcMain.handle('is-update-ready', () => updateIsReady);`
);
fs.writeFileSync('main.js', mainCode);

// 2. preload.js
let preloadCode = fs.readFileSync('preload.js', 'utf8');
preloadCode = preloadCode.replace(
  "restartApp: () => ipcRenderer.send('restart-app')",
  "restartApp: () => ipcRenderer.send('restart-app'),\n  isUpdateReady: () => ipcRenderer.invoke('is-update-ready')"
);
fs.writeFileSync('preload.js', preloadCode);
