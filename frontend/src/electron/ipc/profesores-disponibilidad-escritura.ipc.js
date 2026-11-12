/**
 * Registers the write IPC handlers for professor personal availability.
 */
export function registrarProfesoresDisponibilidadEscrituraIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  ipcMain.handle(
    'profesores:guardar-mi-disponibilidad',
    async (_event, datos) => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-disponibilidad',
        {
          method: 'PUT',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'profesores:copiar-mi-disponibilidad',
    async (_event, datos) => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-disponibilidad/copiar',
        {
          method: 'POST',
          body: datos,
        },
      );
    },
  );
}
