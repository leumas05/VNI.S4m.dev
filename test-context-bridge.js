const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'test-preload.js')
    }
  });

  win.loadURL(`data:text/html,<html><body><h1>Test</h1><script>
    window.api.onEvent(() => {
      console.log('EVENT RECEIVED!');
      document.body.innerHTML += '<h2>SUCCESS</h2>';
    });
  </script></body></html>`);

  setTimeout(() => {
    console.log("SENDING EVENT");
    win.webContents.send('test-event');
  }, 2000);
  
  setTimeout(() => {
    app.quit();
  }, 4000);
});
