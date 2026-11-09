const ETIQUETAS_ESTADO_PLAN = Object.freeze({
  BORRADOR: 'Borrador',
  VIGENTE: 'Vigente',
  EN_TRANSICION: 'Cerrado a nuevos ingresos',
  CERRADO: 'Cerrado definitivamente',
});

export function obtenerPresentacionEstadoPlan(plan) {
  const estado = plan?.estado || (plan?.activo ? 'VIGENTE' : 'CERRADO');

  return {
    estado,
    etiqueta: ETIQUETAS_ESTADO_PLAN[estado] || 'Estado desconocido',
    clase: estado === 'VIGENTE' ? 'is-active' : 'is-inactive',
  };
}
