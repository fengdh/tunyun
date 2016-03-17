'use strict';

(function() {

  const electron = require('electron');
  const app = electron.app;  // Module to control application life.
  const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.

  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  var win = null;

  // Quit when all windows are closed.
  app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform != 'darwin') {
      app.quit();
    }
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  app.on('ready', function() {
    // Create the browser window.
    win = new BrowserWindow({
               title: 'VDisk Exploiter',
     autoHideMenuBar: true,
               width: 1200, 
              height: 800,
      webPreferences: {
                        webSecurity: false,
                      }
    });

    // and load the index.html of the app.
    win.loadURL('file://' + __dirname + '/index.html');

    // Open the DevTools.
     win.webContents.openDevTools();

    win.webContents.on("dom-ready", function() {
    });
    
    // Emitted when the window is closed.
    win.on('closed', function() {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      win = null;
      app.quit();
    });
  });

})();
