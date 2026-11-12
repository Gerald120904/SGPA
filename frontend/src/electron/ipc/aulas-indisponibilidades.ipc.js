/**
 * Registers the write IPC handlers for Aulas unavailabilities (indisponibilidades).
 */
export function registrarAulasIndisponibilidadesIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new TypeError(
      'Se requiere una instancia válida de ipcMain para registrar indisponibilidades de Aulas.',
    );
  }
  if (typeof ejecutarPeticionAutenticada !== 'function') {
    throw new TypeError(
      'Se requiere ejecutarPeticionAutenticada para registrar indisponibilidades de Aulas.',
    );
  }

  ipcMain.handle(
    'aulas:indisponibilidades:crear',
    async (_event, aulaId, datos) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/indisponibilidades`,
        {
          method: 'POST',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'aulas:indisponibilidades:actualizar',
    async (_event, aulaId, id, datos) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/indisponibilidades/${id}`,
        {
          method: 'PATCH',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'aulas:indisponibilidades:cambiar-estado',
    async (_event, aulaId, id, activo) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/indisponibilidades/${id}/estado`,
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
