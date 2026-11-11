/**
 * SGPA — Funciones auxiliares y de filtrado del módulo Optativas.
 * FRONTEND-REF-MASTER
 */

export const CATEGORIAS_OPTATIVA = {
  DISCIPLINARIA: 'Disciplinaria',
  ABIERTA: 'Abierta',
  SEDE: 'Sede',
};

export function obtenerEtiquetaCategoria(tipo) {
  return CATEGORIAS_OPTATIVA[tipo] || tipo || '—';
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
