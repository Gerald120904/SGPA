/**
 * Registers the read-only IPC query handlers for professor profiles and dossiers (perfiles y expedientes).
 */
export function registrarProfesoresPerfilesConsultasIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  ipcMain.handle(
    'profesores:expediente-perfil',
    async (_event, profesorId, perfilId) => {
      return ejecutarPeticionAutenticada(
        `/profesores/${profesorId}/perfiles/${perfilId}/expediente`,
      );
    },
  );

  ipcMain.handle(
    'profesores:mi-expediente-perfil',
    async (_event, perfilId) => {
      return ejecutarPeticionAutenticada(
        `/profesores/mi-perfil/perfiles/${perfilId}/expediente`,
      );
    },
  );

  ipcMain.handle(
    'profesores:mi-perfil',
    async () => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-perfil',
      );
    },
  );
}
