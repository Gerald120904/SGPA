/**
 * Registers the IPC handlers for Aulas availability search and assignment evaluation.
 */
export function registrarAulasAsignacionIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new TypeError(
      'Se requiere una instancia válida de ipcMain para registrar búsqueda y evaluación de Aulas.',
    );
  }
  if (typeof ejecutarPeticionAutenticada !== 'function') {
    throw new TypeError(
      'Se requiere ejecutarPeticionAutenticada para registrar búsqueda y evaluación de Aulas.',
    );
  }

  ipcMain.handle(
    'aulas:buscar-disponibles',
    async (_event, criterios) => {
      const resultado =
        await ejecutarPeticionAutenticada(
          '/aulas/buscar-disponibles',
          {
            method: 'POST',
            body: criterios,
          },
        );

      if (!resultado.ok) {
        return resultado;
      }

      return {
        ok: true,
        aulas: resultado.data,
      };
    },
  );

  ipcMain.handle(
    'aulas:evaluar-asignacion',
    async (
      _event,
      aulaId,
      criterios,
    ) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/evaluar-asignacion`,
        {
          method: 'POST',
          body: criterios,
        },
      );
    },
  );
}
