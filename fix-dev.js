const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');

code = code.replace(
  "const { autoUpdater } = require('electron-updater');",
  "let autoUpdater; if (app.isPackaged) { autoUpdater = require('electron-updater').autoUpdater; } else { autoUpdater = { on: () => {}, checkForUpdates: () => {}, logger: { transports: { file: {} } } }; }"
);

fs.writeFileSync('main.js', code);
