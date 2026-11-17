/**
 * Registers the primary write CRUD IPC handlers for the Aulas domain.
 */
export function registrarAulasCrudIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new TypeError('Se requiere una instancia válida de ipcMain para registrar CRUD de Aulas.');
  }
  if (typeof ejecutarPeticionAutenticada !== 'function') {
    throw new TypeError('Se requiere ejecutarPeticionAutenticada para registrar CRUD de Aulas.');
  }

  ipcMain.handle(
    'aulas:crear',
    async (_event, datos) => {
      return ejecutarPeticionAutenticada(
        '/aulas',
        {
          method: 'POST',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'aulas:actualizar',
    async (_event, id, datos) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${id}`,
        {
          method: 'PATCH',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'aulas:cambiar-estado',
    async (_event, id, activo) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${id}/estado`,
        {
          method: 'PATCH',
          body: {
            activo,
          },
        },
      );
    },
  );
}

