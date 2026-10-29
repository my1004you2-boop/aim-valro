const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  quit: () => ipcRenderer.invoke('app:quit'),
});
