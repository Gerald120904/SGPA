/**
 * SGPA — Funciones auxiliares, validaciones y presentación de estados del módulo Optativas.
 * FRONTEND-ORDER-003
 */

import { ROLES } from '../../config/permissions.js';

export const CATEGORIAS_OPTATIVA = {
  DISCIPLINARIA: 'Disciplinaria',
  ABIERTA: 'Abierta',
  SEDE: 'Sede',
};

export function obtenerEtiquetaCategoria(tipo) {
  return CATEGORIAS_OPTATIVA[tipo] || tipo || '—';
}

export function obtenerPresentacionEstadoOptativa(activo) {
  return {
    label: activo ? 'Activa' : 'Inactiva',
    tone: activo ? 'success' : 'neutral',
  };
}

export function puedeEditarOptativa(optativa, rolActivo) {
  return rolActivo === ROLES.ADMIN_GLOBAL || optativa?.tipo === 'DISCIPLINARIA';
}

export function filtrarOptativas(optativas = [], { busqueda = '', tipo = '', estado = '' } = {}) {
  const query = String(busqueda || '').trim().toLowerCase();

  return optativas.filter((optativa) => {
    const texto = `${optativa.curso?.codigo ?? ''} ${optativa.curso?.nombre ?? ''}`.toLowerCase();
    const coincideBusqueda = !query || texto.includes(query);
    const coincideTipo = !tipo || optativa.tipo === tipo;
    const coincideEstado = !estado || Boolean(optativa.activo) === (estado === 'ACTIVA');

    return coincideBusqueda && coincideTipo && coincideEstado;
  });
}

export function validarYConstruirDatosOptativa({
  id = null,
  codigo = '',
  nombre = '',
  tipo = 'DISCIPLINARIA',
  carreraOrigenId = null,
  descripcion = '',
  rolActivo = null,
} = {}) {
  const carreraId = Number(carreraOrigenId) || null;

  if (tipo === 'DISCIPLINARIA' && !carreraId) {
    return {
      ok: false,
      titulo: 'Dato requerido',
      mensaje: 'Seleccione la carrera de origen.',
    };
  }

  if (rolActivo !== ROLES.ADMIN_GLOBAL && tipo !== 'DISCIPLINARIA') {
    return {
      ok: false,
      titulo: 'Rol no autorizado',
      mensaje: 'Las optativas institucionales requieren el rol de administrador global.',
    };
  }

  const datos = id
    ? {
        tipo,
        carreraOrigenId: carreraId,
        descripcion: String(descripcion || '').trim(),
      }
    : {
        codigo: String(codigo || '').trim().toUpperCase(),
        nombre: String(nombre || '').trim(),
        tipo,
        ...(carreraId ? { carreraOrigenId: carreraId } : {}),
        descripcion: String(descripcion || '').trim(),
      };

  return { ok: true, datos };
}
