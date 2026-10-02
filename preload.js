const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, ...args) => callback(...args)),
  onUpdateDownloading: (callback) => ipcRenderer.on('update-downloading', (_event, ...args) => callback(...args)),
  restartApp: () => ipcRenderer.send('restart-app'),
  isUpdateReady: () => ipcRenderer.invoke('is-update-ready'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state')
});
