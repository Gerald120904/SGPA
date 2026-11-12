/**
 * Registers the write IPC handlers for the Aulas equipment catalog.
 */
export function registrarAulasEquipamientosIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new TypeError(
      'Se requiere una instancia válida de ipcMain para registrar equipamientos de Aulas.',
    );
  }
  if (typeof ejecutarPeticionAutenticada !== 'function') {
    throw new TypeError(
      'Se requiere ejecutarPeticionAutenticada para registrar equipamientos de Aulas.',
    );
  }

  ipcMain.handle(
    'aulas:equipamientos:crear',
    async (_event, datos) => {
      return ejecutarPeticionAutenticada(
        '/aulas/equipamientos',
        {
          method: 'POST',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'aulas:equipamientos:actualizar',
    async (_event, id, datos) => {
      return ejecutarPeticionAutenticada(
        `/aulas/equipamientos/${id}`,
        {
          method: 'PATCH',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'aulas:equipamientos:cambiar-estado',
    async (_event, id, activo) => {
      return ejecutarPeticionAutenticada(
        `/aulas/equipamientos/${id}/estado`,
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
