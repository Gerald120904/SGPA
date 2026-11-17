import { construirRutaConFiltros } from '../ipc-helpers.js';

async function consultarListadoConClave(ejecutarPeticionAutenticada, ruta, clave) {
  const resultado = await ejecutarPeticionAutenticada(ruta);

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    [clave]: resultado.data,
  };
}

/**
 * Registers the read-only IPC query and listing handlers for the Aulas domain.
 */
export function registrarAulasConsultasIpc({
  ipcMain,
  ejecutarPeticionAutenticada,
}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new TypeError('Se requiere una instancia válida de ipcMain para registrar consultas de Aulas.');
  }
  if (typeof ejecutarPeticionAutenticada !== 'function') {
    throw new TypeError('Se requiere ejecutarPeticionAutenticada para registrar consultas de Aulas.');
  }

  ipcMain.handle(
    'aulas:listar',
    async (_event, filtros = {}) => {
      return consultarListadoConClave(
        ejecutarPeticionAutenticada,
        construirRutaConFiltros('/aulas', filtros),
        'aulas',
      );
    },
  );

  ipcMain.handle(
    'aulas:obtener',
    async (_event, id) => {
      return ejecutarPeticionAutenticada(`/aulas/${id}`);
    },
  );

  ipcMain.handle(
    'aulas:equipamientos:listar',
    async () => {
      return consultarListadoConClave(
        ejecutarPeticionAutenticada,
        '/aulas/equipamientos',
        'equipamientos',
      );
    },
  );

  ipcMain.handle(
    'aulas:equipo-aula:listar',
    async (_event, aulaId) => {
      return consultarListadoConClave(
        ejecutarPeticionAutenticada,
        `/aulas/${aulaId}/equipamientos`,
        'equipamientos',
      );
    },
  );

  ipcMain.handle(
    'aulas:indisponibilidades:listar',
    async (_event, aulaId) => {
      return consultarListadoConClave(
        ejecutarPeticionAutenticada,
        `/aulas/${aulaId}/indisponibilidades`,
        'indisponibilidades',
      );
    },
  );

  ipcMain.handle(
    'aulas:indisponibilidades:obtener',
    async (_event, aulaId, id) => {
      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/indisponibilidades/${id}`,
      );
    },
  );

  ipcMain.handle(
    'aulas:reservas:listar',
    async (_event, aulaId) => {
      return consultarListadoConClave(
        ejecutarPeticionAutenticada,
        `/aulas/${aulaId}/reservas`,
        'reservas',
      );
    },
  );

  ipcMain.handle(
    'aulas:reservas:obtener',
    async (_event, aulaId, id) => {
      return ejecutarPeticionAutenticada(`/aulas/${aulaId}/reservas/${id}`);
    },
  );

  ipcMain.handle(
    'aulas:ocupacion',
    async (_event, aulaId, filtros) => {
      const params = new URLSearchParams({
        fechaHoraInicio: filtros.fechaHoraInicio,
        fechaHoraFin: filtros.fechaHoraFin,
      });

      return ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/ocupacion?${params.toString()}`,
      );
    },
  );

  ipcMain.handle(
    'aulas:disponibilidades:listar',
    async (_event, aulaId, periodoId) => {
      const params = new URLSearchParams({
        periodoId: String(periodoId),
      });

      return consultarListadoConClave(
        ejecutarPeticionAutenticada,
        `/aulas/${aulaId}/disponibilidades?${params.toString()}`,
        'disponibilidades',
      );
    },
  );

  ipcMain.handle(
    'aulas:auditoria:listar',
    async (_event, aulaId) => {
      return consultarListadoConClave(
        ejecutarPeticionAutenticada,
        `/aulas/${aulaId}/auditoria`,
        'auditoria',
      );
    },
  );
}
