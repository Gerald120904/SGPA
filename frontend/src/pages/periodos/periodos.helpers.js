/**
 * SGPA — Funciones auxiliares y constantes puras del módulo Períodos Académicos.
 * FRONTEND-REF-MASTER
 */

export const ESTADOS_PERIODO = {
  BORRADOR: 'Borrador',
  EN_PREPARACION: 'En preparación',
  EN_CURSO: 'En curso',
  CERRADO: 'Cerrado',
  CANCELADO: 'Cancelado',
};

export const TRANSICIONES_PERIODO = {
  BORRADOR: [
    { estado: 'EN_PREPARACION', texto: 'Preparar', titulo: 'Pasar periodo a preparación', peligro: false },
    { estado: 'CANCELADO', texto: 'Cancelar', titulo: 'Cancelar periodo', peligro: true },
  ],
  EN_PREPARACION: [
    { estado: 'EN_CURSO', texto: 'Iniciar', titulo: 'Iniciar periodo académico', peligro: false },
    { estado: 'CANCELADO', texto: 'Cancelar', titulo: 'Cancelar periodo', peligro: true },
  ],
  EN_CURSO: [
    { estado: 'CERRADO', texto: 'Cerrar', titulo: 'Cerrar periodo académico', peligro: true },
  ],
  CERRADO: [],
  CANCELADO: [],
};

export function obtenerTonoEstadoPeriodo(estado) {
  const tonos = {
    BORRADOR: 'neutral',
    EN_PREPARACION: 'info',
    EN_CURSO: 'success',
    CERRADO: 'neutral',
    CANCELADO: 'danger',
  };
  return tonos[estado] || 'neutral';
}

export function obtenerNombreEstadoPeriodo(estado) {
  return ESTADOS_PERIODO[estado] || estado || 'Sin estado';
}

export function obtenerNombreCicloPeriodo(ciclo) {
  const ciclos = {
    1: 'I Ciclo',
    2: 'II Ciclo',
    3: 'Verano',
  };
  return ciclos[ciclo] || `Ciclo ${ciclo}`;
}

export function formatearFechaPeriodo(fecha) {
  if (!fecha) {
    return '—';
  }
  const partes = String(fecha).split('-');
  if (partes.length !== 3) {
    return fecha;
  }
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

export function esPeriodoEditable(periodo) {
  if (!periodo) return false;
  return ['BORRADOR', 'EN_PREPARACION'].includes(periodo.estado);
}

export function filtrarPeriodosAcademicos(periodos = [], busqueda = '', estado = '') {
  const query = String(busqueda || '').trim().toLowerCase();
  const estadoFiltro = String(estado || '').trim();

  return periodos.filter((periodo) => {
    const coincideBusqueda =
      !query ||
      [periodo.codigo, periodo.nombre, periodo.anio, periodo.ciclo]
        .filter((valor) => valor !== undefined && valor !== null)
        .some((valor) => String(valor).toLowerCase().includes(query));

    const coincideEstado = !estadoFiltro || periodo.estado === estadoFiltro;

    return coincideBusqueda && coincideEstado;
  });
}
