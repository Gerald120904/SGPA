/**
 * Registers the write IPC handlers for Aulas extraordinary reservations (reservas extraordinarias).
 */
export function registrarAulasReservasIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new TypeError(
      'Se requiere una instancia válida de ipcMain para registrar reservas de Aulas.',
    );
  }
  if (typeof ejecutarPeticionAutenticada !== 'function') {
    throw new TypeError(
      'Se requiere ejecutarPeticionAutenticada para registrar reservas de Aulas.',
    );
  }

  ipcMain.handle(
    'aulas:reservas:crear',
    async (_event, aulaId, datos) =>
      ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/reservas`,
        {
          method: 'POST',
          body: datos,
        },
      ),
  );

  ipcMain.handle(
    'aulas:reservas:actualizar',
    async (_event, aulaId, id, datos) =>
      ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/reservas/${id}`,
        {
          method: 'PATCH',
          body: datos,
        },
      ),
  );

  ipcMain.handle(
    'aulas:reservas:cambiar-estado',
    async (
      _event,
      aulaId,
      id,
      activo,
    ) =>
      ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/reservas/${id}/estado`,
        {
          method: 'PATCH',
          body: { activo },
        },
      ),
  );
}
