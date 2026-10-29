const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (text) => ipcRenderer.invoke('settings:save', text),
  saveSession: (name, text) => ipcRenderer.invoke('session:save', name, text),
  quit: () => ipcRenderer.invoke('app:quit'),
});
