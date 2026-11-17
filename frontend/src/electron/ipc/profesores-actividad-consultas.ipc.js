/**
 * Registers the read-only IPC query handlers for professor attestations and projects.
 */
export function registrarProfesoresActividadConsultasIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  ipcMain.handle(
    'profesores:mis-atestados',
    async () => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-perfil/atestados',
      );
    },
  );

  ipcMain.handle(
    'profesores:mis-proyectos',
    async () => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-perfil/proyectos',
      );
    },
  );
}
