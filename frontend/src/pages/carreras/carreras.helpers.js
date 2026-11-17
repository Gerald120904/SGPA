/**
 * SGPA — Funciones auxiliares y de filtrado del módulo Carreras.
 * FRONTEND-REF-MASTER
 */

export function filtrarCarreras(carreras = [], busqueda = '', estado = 'TODAS') {
  const query = String(busqueda || '').trim().toLowerCase();
  const filtroEstado = String(estado || 'TODAS').toUpperCase();

  return carreras.filter((carrera) => {
    const coincideBusqueda =
      !query ||
      [carrera.codigo, carrera.nombre, carrera.descripcion]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(query));

    let coincideEstado = true;
    if (filtroEstado === 'ACTIVAS') {
      coincideEstado = carrera.activo === true;
    } else if (filtroEstado === 'INACTIVAS') {
      coincideEstado = carrera.activo === false;
    }

    return coincideBusqueda && coincideEstado;
  });
}

export function validarDatosCarrera({ codigo = '', nombre = '', descripcion = '' } = {}) {
  const errores = {};
  const codigoTrim = String(codigo || '').trim();
  const nombreTrim = String(nombre || '').trim();

  if (!codigoTrim) {
    errores.codigo = 'El código de carrera es obligatorio.';
  } else if (codigoTrim.length > 20) {
    errores.codigo = 'El código de carrera no puede exceder 20 caracteres.';
  }

  if (!nombreTrim) {
    errores.nombre = 'El nombre de la carrera es obligatorio.';
  } else if (nombreTrim.length > 150) {
    errores.nombre = 'El nombre de la carrera no puede exceder 150 caracteres.';
  }

  if (descripcion && String(descripcion).length > 500) {
    errores.descripcion = 'La descripción no puede exceder 500 caracteres.';
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
    datos: {
      codigo: codigoTrim.toUpperCase(),
      nombre: nombreTrim,
      descripcion: String(descripcion || '').trim(),
    },
  };
}
