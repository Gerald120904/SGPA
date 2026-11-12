/**
 * Registers the write IPC handlers for professor profile, requirement, and attestation reviews.
 */
export function registrarProfesoresRevisionesIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  ipcMain.handle(
    'profesores:revisar-requisito-perfil',
    async (
      _event,
      profesorId,
      perfilId,
      requisitoId,
      datos,
    ) => {
      return ejecutarPeticionAutenticada(
        `/profesores/${profesorId}/perfiles/${perfilId}/requisitos/${requisitoId}/revision`,
        {
          method: 'PATCH',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'profesores:guardar-evidencias-requisito',
    async (_event, perfilId, requisitoId, datos) => {
      return ejecutarPeticionAutenticada(
        `/profesores/mi-perfil/perfiles/${perfilId}/requisitos/${requisitoId}/evidencias`,
        {
          method: 'PUT',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'profesores:revisar-perfil',
    async (
      _event,
      profesorId,
      perfilId,
      datos,
    ) => {
      return ejecutarPeticionAutenticada(
        `/profesores/${profesorId}/perfiles/${perfilId}/revision`,
        {
          method: 'PATCH',
          body: datos,
        },
      );
    },
  );

  ipcMain.handle(
    'profesores:inactivar-perfil',
    async (
      _event,
      profesorId,
      perfilId,
      observacion,
    ) => {
      return ejecutarPeticionAutenticada(
        `/profesores/${profesorId}/perfiles/${perfilId}/inactivar`,
        {
          method: 'PATCH',
          body: {
            observacion,
          },
        },
      );
    },
  );

  ipcMain.handle(
    'profesores:revisar-atestado',
    async (
      _event,
      profesorId,
      atestadoId,
      datos,
    ) => {
      return ejecutarPeticionAutenticada(
        `/profesores/${profesorId}/atestados/${atestadoId}/revision`,
        {
          method: 'PATCH',
          body: datos,
        },
      );
    },
  );
}
