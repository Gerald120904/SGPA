/**
 * Registers the read-only IPC query handlers for professor self-service careers and profiles.
 */
export function registrarProfesoresAutogestionConsultasIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  ipcMain.handle(
    'profesores:mis-carreras-disponibles',
    async () => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-perfil/carreras-disponibles',
      );
    },
  );

  ipcMain.handle(
    'profesores:mis-perfiles',
    async () => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-perfil/perfiles',
      );
    },
  );

  ipcMain.handle(
    'profesores:perfiles-disponibles',
    async () => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-perfil/perfiles-disponibles',
      );
    },
  );
}
