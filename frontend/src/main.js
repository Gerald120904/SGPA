import { app, BrowserWindow, ipcMain, net } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

const API_URL = 'http://127.0.0.1:3000';
let accessToken = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

ipcMain.handle('auth:login', async (_event, credenciales) => {
  try {
    const response = await net.fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        correo: credenciales.correo,
        password: credenciales.password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: data.message || 'No fue posible iniciar sesión',
      };
    }

    accessToken = data.accessToken;

    return {
      ok: true,
      usuario: data.usuario,
    };
  } catch (error) {
    console.error('Error al conectar con el backend:', error);
    return {
      ok: false,
      status: 0,
      message: 'No se pudo conectar con el servidor del SGPA.',
    };
  }
});

ipcMain.handle('auth:recuperar-password', async (_event, datos) => {
  try {
    const response = await net.fetch(`${API_URL}/auth/recuperar-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        correo: datos.correo,
      }),
    });

    const data = await response.json();
    const message = Array.isArray(data.message)
      ? data.message.join('. ')
      : data.message;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: message || 'No fue posible solicitar la recuperación.',
      };
    }

    return {
      ok: true,
      message:
        message ||
        'Se generó un código de recuperación válido durante 15 minutos.',
      codigoDesarrollo: data.codigoDesarrollo,
    };
  } catch (error) {
    console.error('Error al solicitar recuperación de contraseña:', error);
    return {
      ok: false,
      status: 0,
      message: 'No se pudo conectar con el servidor del SGPA.',
    };
  }
});

ipcMain.handle('auth:restablecer-password', async (_event, datos) => {
  try {
    const response = await net.fetch(`${API_URL}/auth/restablecer-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        correo: datos.correo,
        codigo: datos.codigo,
        password: datos.password,
      }),
    });

    const data = await response.json();
    const message = Array.isArray(data.message)
      ? data.message.join('. ')
      : data.message;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: message || 'No fue posible restablecer la contraseña.',
      };
    }

    return {
      ok: true,
      message: message || 'La contraseña se actualizó correctamente.',
    };
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    return {
      ok: false,
      status: 0,
      message: 'No se pudo conectar con el servidor del SGPA.',
    };
  }
});

ipcMain.handle('auth:perfil', async () => {
  if (!accessToken) {
    return {
      ok: false,
      message: 'No existe una sesión activa.',
    };
  }

  try {
    const response = await net.fetch(`${API_URL}/auth/perfil`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      accessToken = null;
      return {
        ok: false,
        status: response.status,
        message: data.message || 'La sesión no es válida.',
      };
    }

    return {
      ok: true,
      usuario: data,
    };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      message: 'No se pudo conectar con el servidor.',
    };
  }
});

ipcMain.handle('auth:logout', async () => {
  accessToken = null;
  return { ok: true };
});

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#f5f6f8',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
