/**
 * Registers the read-only IPC query handlers for professor personal availability.
 */
export function registrarProfesoresDisponibilidadConsultasIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  ipcMain.handle(
    'profesores:periodos-mi-disponibilidad',
    async () => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-disponibilidad/periodos',
      );
    },
  );

  ipcMain.handle(
    'profesores:consultar-mi-disponibilidad',
    async (_event, periodoId) => {
      return ejecutarPeticionAutenticada(
        `/profesores/mi-disponibilidad/${periodoId}`,
      );
    },
  );

  ipcMain.handle(
    'profesores:historial-mi-disponibilidad',
    async (_event, periodoId) => {
      return ejecutarPeticionAutenticada(
        `/profesores/mi-disponibilidad/${periodoId}/historial`,
      );
    },
  );
}
