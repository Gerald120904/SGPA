/**
 * Registers the IPC handlers for assigning equipment to Aulas.
 */
export function registrarAulasEquipoAulaIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  ipcMain.handle(
    'aulas:equipo-aula:asignar',
    async (_event, aulaId, datos) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/equipamientos`,
        {
          method: 'POST',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'aulas:equipo-aula:actualizar',
    async (
      _event,
      aulaId,
      equipamientoId,
      datos,
    ) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/equipamientos/${equipamientoId}`,
        {
          method: 'PATCH',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'aulas:equipo-aula:desasignar',
    async (
      _event,
      aulaId,
      equipamientoId,
    ) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/equipamientos/${equipamientoId}`,
        {
          method: 'DELETE',
        },
      );
    },
  );

  ipcMain.handle(
    'aulas:equipo-aula:cambiar-estado',
    async (
      _event,
      aulaId,
      equipamientoId,
      activo,
    ) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/equipamientos/${equipamientoId}/estado`,
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
