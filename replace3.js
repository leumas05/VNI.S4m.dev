const fs = require('fs');

let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const oldEffect = `  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onUpdateDownloaded) {
      window.electronAPI.onUpdateDownloaded(() => {
        setUpdateAvailable(true);
      });
    }
  }, []);`;

const newEffect = `  useEffect(() => {
    if (window.electronAPI) {
      if (window.electronAPI.isUpdateReady) {
        window.electronAPI.isUpdateReady().then(ready => {
          if (ready) setUpdateAvailable(true);
        });
      }
      if (window.electronAPI.onUpdateDownloaded) {
        window.electronAPI.onUpdateDownloaded(() => {
          setUpdateAvailable(true);
        });
      }
    }
  }, []);`;

code = code.replace(oldEffect, newEffect);
fs.writeFileSync('frontend/src/App.jsx', code);
