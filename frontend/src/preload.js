const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sgpa', {
  login: (credenciales) => ipcRenderer.invoke('auth:login', credenciales),
  obtenerPerfil: () => ipcRenderer.invoke('auth:perfil'),
  logout: () => ipcRenderer.invoke('auth:logout'),
});
