const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  onEvent: (callback) => ipcRenderer.on('test-event', callback)
});
