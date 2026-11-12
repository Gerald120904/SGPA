/**
 * Registers the write IPC handlers for Aulas base availability (disponibilidad base).
 */
export function registrarAulasDisponibilidadesIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new TypeError(
      'Se requiere una instancia válida de ipcMain para registrar disponibilidades de Aulas.',
    );
  }
  if (typeof ejecutarPeticionAutenticada !== 'function') {
    throw new TypeError(
      'Se requiere ejecutarPeticionAutenticada para registrar disponibilidades de Aulas.',
    );
  }

  ipcMain.handle(
    'aulas:disponibilidades:crear',
    async (
      _event,
      aulaId,
      datos,
    ) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/disponibilidades`,
        {
          method: 'POST',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'aulas:disponibilidades:actualizar',
    async (
      _event,
      aulaId,
      id,
      datos,
    ) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/disponibilidades/${id}`,
        {
          method: 'PATCH',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'aulas:disponibilidades:eliminar',
    async (
      _event,
      aulaId,
      id,
    ) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/disponibilidades/${id}`,
        {
          method: 'DELETE',
        },
      );
    },
  );
}
