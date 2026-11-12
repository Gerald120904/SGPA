import { construirRutaConFiltros } from '../ipc-helpers.js';

/**
 * Registers the read-only query IPC handlers for Profesores.
 */
export function registrarProfesoresConsultasIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  ipcMain.handle(
    'profesores:listar',
    async (_event, filtros = {}) => {
      const resultado = await ejecutarPeticionAutenticada(
        construirRutaConFiltros('/profesores', filtros),
      );

      if (!resultado.ok) {
        return resultado;
      }

      return {
        ok: true,
        profesores: resultado.data,
      };
    },
  );

  ipcMain.handle(
    'profesores:obtener',
    async (_event, id) => {
      return ejecutarPeticionAutenticada(
        `/profesores/${id}`,
      );
    },
  );

  ipcMain.handle(
    'profesores:disponibilidad',
    async (
      _event,
      profesorId,
      periodoId,
    ) => {
      return ejecutarPeticionAutenticada(
        `/profesores/${profesorId}/disponibilidad/${periodoId}`,
      );
    },
  );
}
