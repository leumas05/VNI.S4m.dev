const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const oldEffect = `      if (window.electronAPI.isUpdateReady) {
        window.electronAPI.isUpdateReady().then(ready => {
          if (ready) setUpdateAvailable(true);
        });
      }`;

const newEffect = `      if (window.electronAPI.getUpdateState) {
        window.electronAPI.getUpdateState().then(state => {
          if (state.isReady) setUpdateAvailable(true);
          else if (state.isDownloading) setIsDownloading(true);
        });
      }`;

code = code.replace(oldEffect, newEffect);
fs.writeFileSync('frontend/src/App.jsx', code);
