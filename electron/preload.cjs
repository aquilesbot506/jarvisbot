'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('aquilesStorage', Object.freeze({
  load: () => ipcRenderer.invoke('aquiles:load'),
  save: (data) => ipcRenderer.invoke('aquiles:save', data),
  platform: process.platform
}));
