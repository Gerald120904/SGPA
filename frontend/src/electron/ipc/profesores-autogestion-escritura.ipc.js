/**
 * Registers the write IPC handlers for professor self-service careers, profiles, and attestations.
 */
export function registrarProfesoresAutogestionEscrituraIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  ipcMain.handle(
    'profesores:actualizar-mis-carreras',
    async (_event, carreraIds) => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-perfil/carreras',
        {
          method: 'PUT',
          body: {
            carreraIds,
          },
        },
      );
    },
  );

  ipcMain.handle(
    'profesores:solicitar-perfil',
    async (_event, perfilAcademicoId) => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-perfil/perfiles',
        {
          method: 'POST',
          body: {
            perfilAcademicoId,
          },
        },
      );
    },
  );

  ipcMain.handle(
    'profesores:crear-atestado',
    async (_event, datos) => {
      return ejecutarPeticionAutenticada(
        '/profesores/mi-perfil/atestados',
        {
          method: 'POST',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'profesores:actualizar-atestado',
    async (_event, atestadoId, datos) => {
      return ejecutarPeticionAutenticada(
        `/profesores/mi-perfil/atestados/${atestadoId}`,
        {
          method: 'PATCH',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'profesores:inactivar-mi-atestado',
    async (_event, atestadoId) => {
      return ejecutarPeticionAutenticada(
        `/profesores/mi-perfil/atestados/${atestadoId}/inactivar`,
        {
          method: 'PATCH',
        },
      );
    },
  );
}
