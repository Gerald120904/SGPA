/**
 * Registers the write IPC handlers for professor projects and laboratories.
 */
export function registrarProfesoresProyectosIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  ipcMain.handle(
    'profesores:crear-proyecto',
    async (_event, datos) => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-perfil/proyectos',
        {
          method: 'POST',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'profesores:actualizar-proyecto',
    async (_event, proyectoId, datos) => {
      return ejecutarPeticionAutenticada(
        `/profesores/mi-perfil/proyectos/${proyectoId}`,
        {
          method: 'PATCH',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'profesores:cambiar-estado-proyecto',
    async (_event, proyectoId, activo) => {
      return ejecutarPeticionAutenticada(
        `/profesores/mi-perfil/proyectos/${proyectoId}/estado`,
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
