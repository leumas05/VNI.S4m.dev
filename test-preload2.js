const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  onEvent: (callback) => ipcRenderer.on('test-event', (_event, ...args) => callback(...args))
});
