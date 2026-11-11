/**
 * SGPA — Constantes, formateadores y funciones puras del módulo Estudiantes.
 * FRONTEND-REF-MASTER
 */

export const ESTADOS_ESTUDIANTE = Object.freeze([
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'INACTIVO', label: 'Inactivo' },
  { value: 'GRADUADO', label: 'Graduado' },
  { value: 'RETIRADO', label: 'Retirado' },
]);

export const ORIGENES_ACADEMICOS_ESTUDIANTE = Object.freeze([
  { value: 'CURSADO', label: 'Cursado' },
  { value: 'RECONOCIMIENTO', label: 'Reconocimiento' },
  { value: 'EQUIVALENCIA', label: 'Equivalencia' },
  { value: 'NO_ESPECIFICADO', label: 'No especificado' },
]);

export const RESULTADOS_ACADEMICOS_ESTUDIANTE = Object.freeze([
  { value: 'APROBADO', label: 'Aprobado' },
  { value: 'REPROBADO', label: 'Reprobado' },
]);

export function obtenerTonoEstadoEstudiante(estado) {
  switch (estado) {
    case 'ACTIVO':
      return 'success';
    case 'INACTIVO':
      return 'neutral';
    case 'GRADUADO':
      return 'info';
    case 'RETIRADO':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function obtenerTonoEstadoSolicitud(estado) {
  switch (estado) {
    case 'PROCESADO':
      return 'success';
    case 'RECHAZADO':
    case 'ERROR':
      return 'danger';
    case 'PENDIENTE':
    case 'REQUIERE_REVISION':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function extraerDataResultado(resultado) {
  if (resultado && Object.prototype.hasOwnProperty.call(resultado, 'data')) {
    return resultado.data;
  }
  return resultado;
}

export function obtenerNombreCompletoEstudiante(estudiante) {
  if (!estudiante) return '';
  return [estudiante.nombres, estudiante.apellido1, estudiante.apellido2]
    .filter(Boolean)
    .join(' ');
}

export function formatearEstadoEstudiante(estado) {
  return (
    ESTADOS_ESTUDIANTE.find((item) => item.value === estado)?.label ||
    estado ||
    '—'
  );
}

export function obtenerTextoAsignaturaEstudiante(item) {
  if (item?.codigoOptativaReal && item?.nombreOptativaReal) {
    const espacio =
      item.planAsignatura?.nombreReferencia ||
      item.planAsignatura?.codigoReferencia ||
      `Espacio #${item.planAsignaturaId}`;
    return `${item.codigoOptativaReal} - ${item.nombreOptativaReal} (${espacio})`;
  }
  const asignatura = item?.planAsignatura ?? item?.asignatura ?? item ?? {};
  const curso = asignatura.curso ?? {};
  const codigo = curso.codigo ?? asignatura.codigo ?? asignatura.codigoReferencia ?? '';
  const nombre = curso.nombre ?? asignatura.nombre ?? asignatura.nombreReferencia ?? '';

  if (codigo && nombre) {
    return `${codigo} - ${nombre}`;
  }
  return codigo || nombre || `Asignatura #${asignatura.id ?? asignatura.planAsignaturaId ?? '—'}`;
}

export function obtenerTextoPeriodoEstudiante(periodo) {
  if (!periodo) return '—';
  return periodo.codigo || periodo.nombre || `Período #${periodo.id}`;
}

export function esPeriodoIgualOPosterior(periodo, periodoIngreso) {
  if (
    !periodo ||
    !periodoIngreso ||
    periodo.anio == null ||
    periodo.ciclo == null ||
    periodoIngreso.anio == null ||
    periodoIngreso.ciclo == null
  ) {
    return true;
  }
  return (
    periodo.anio > periodoIngreso.anio ||
    (periodo.anio === periodoIngreso.anio && periodo.ciclo >= periodoIngreso.ciclo)
  );
}

export function obtenerTextoPlanEstudiante(plan) {
  if (!plan) return '—';
  const codigo = plan.codigo || '';
  const nombre = plan.nombre || '';
  if (codigo && nombre) return `${codigo} - ${nombre}`;
  return codigo || nombre || `Plan #${plan.id}`;
}

export function obtenerNombreResponsableEstudiante(usuario) {
  if (!usuario) return '—';
  const nombreDesdePartes = [usuario.nombres, usuario.apellido1, usuario.apellido2]
    .filter(Boolean)
    .join(' ')
    .trim();
  return (
    usuario.nombreCompleto ||
    usuario.nombre ||
    nombreDesdePartes ||
    usuario.correo ||
    usuario.email ||
    '—'
  );
}

export function formatearFechaHoraEstudiante(valor) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fecha);
}

export function formatearTextoEnumEstudiante(valor) {
  if (!valor) return '—';
  return String(valor)
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^\w/, (letra) => letra.toUpperCase());
}

export function obtenerResumenImportacion(preview) {
  const resumen = preview?.resumen ?? preview ?? {};

  return {
    total: Number(resumen.total ?? 0),
    creados: Number(resumen.creados ?? resumen.crear ?? 0),
    actualizados: Number(resumen.actualizados ?? resumen.actualizar ?? 0),
    sinCambios: Number(resumen.sinCambios ?? 0),
    errores: Number(resumen.errores ?? resumen.error ?? 0),
  };
}

export function obtenerDetalleFilaImportacion(fila = {}) {
  if (Array.isArray(fila.errores) && fila.errores.length > 0) {
    return fila.errores.join(' · ');
  }

  const detalles = [];

  if (Array.isArray(fila.cambiosDatos) && fila.cambiosDatos.length > 0) {
    detalles.push(
      ...fila.cambiosDatos.map((cambio) => {
        const actual = cambio.actual ?? '—';
        const nuevo = cambio.nuevo ?? '—';
        return `${cambio.campo}: ${actual} → ${nuevo}`;
      }),
    );
  }

  if (
    Array.isArray(fila.aprobacionesNuevas) &&
    fila.aprobacionesNuevas.length > 0
  ) {
    detalles.push(
      `Aprobaciones nuevas: ${fila.aprobacionesNuevas
        .map((item) => item.codigo || `Asignatura #${item.planAsignaturaId}`)
        .join(', ')}`,
    );
  }

  if (detalles.length > 0) {
    return detalles.join(' · ');
  }

  return 'Sin cambios adicionales';
}
