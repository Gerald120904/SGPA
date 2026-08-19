const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sgpa', {
  login: (credenciales) => ipcRenderer.invoke('auth:login', credenciales),
  solicitarRecuperacion: (datos) =>
    ipcRenderer.invoke('auth:recuperar-password', datos),
  restablecerPassword: (datos) =>
    ipcRenderer.invoke('auth:restablecer-password', datos),
  obtenerPerfil: () => ipcRenderer.invoke('auth:perfil'),
  logout: () => ipcRenderer.invoke('auth:logout'),
});
