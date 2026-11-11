/**
 * SGPA — Funciones puras de validación, transformación, estado y vista previa de Formularios de Estudiantes.
 * FRONTEND-ORDER-003
 */

export const LIMITES_FORMULARIO = Object.freeze({ titulo: 255, descripcion: 1000 });
export const MODALIDADES_FORMULARIO = new Set(['INTERNO', 'GOOGLE_FORMS']);

export const CAMPOS_FORMULARIO = Object.freeze({
  proveedor: 'formularioProveedor',
  titulo: 'formularioTitulo',
  descripcion: 'formularioDescripcion',
  carreraId: 'formularioCarrera',
  planEstudioId: 'formularioPlan',
});

export function validarDatosNuevoFormulario(datos = {}) {
  const errores = {};
  const proveedor = String(datos.proveedor ?? '').trim();
  const titulo = String(datos.titulo ?? '').trim();
  const descripcion = String(datos.descripcion ?? '').trim();
  const carreraId = Number(datos.carreraId);
  const planEstudioId = Number(datos.planEstudioId);

  if (!proveedor) errores.proveedor = 'Seleccione una modalidad del formulario.';
  else if (!MODALIDADES_FORMULARIO.has(proveedor)) {
    errores.proveedor = 'Seleccione una modalidad válida.';
  }

  if (!titulo) errores.titulo = 'El título del formulario es obligatorio.';
  else if (titulo.length > LIMITES_FORMULARIO.titulo) {
    errores.titulo = 'El título no puede superar 255 caracteres.';
  }

  if (!descripcion) errores.descripcion = 'La descripción es obligatoria.';
  else if (descripcion.length > LIMITES_FORMULARIO.descripcion) {
    errores.descripcion = 'La descripción no puede superar 1000 caracteres.';
  }

  if (!Number.isSafeInteger(carreraId) || carreraId <= 0) {
    errores.carreraId = 'Seleccione una carrera.';
  }
  if (!Number.isSafeInteger(planEstudioId) || planEstudioId <= 0) {
    errores.planEstudioId = 'Seleccione un plan de estudio.';
  }

  return { valido: Object.keys(errores).length === 0, errores };
}

export function construirDatosCrearFormulario({
  titulo,
  descripcion,
  carreraId,
  planEstudioId,
  proveedor,
}) {
  if (proveedor !== 'INTERNO' && proveedor !== 'GOOGLE_FORMS') {
    throw new Error('Seleccione una modalidad de formulario válida.');
  }

  return { titulo, descripcion, carreraId, planEstudioId, proveedor };
}

export function asignaturasElegiblesParaFormulario(asignaturas = [], proveedor) {
  return asignaturas.filter(
    (asignatura) =>
      asignatura.activo === true &&
      ((asignatura.cursoId != null && asignatura.curso != null) ||
        (proveedor === 'INTERNO' && Boolean(asignatura.codigoReferencia?.trim()))),
  );
}

export function agruparAsignaturasVistaPrevia(asignaturas = []) {
  const estructura = new Map();
  asignaturas.forEach((asignatura) => {
    const nivel = Number(asignatura.nivel);
    const ciclo = Number(asignatura.ciclo);
    const ciclosNivel = estructura.get(nivel) || new Map();
    const cursosCiclo = ciclosNivel.get(ciclo) || [];
    cursosCiclo.push(asignatura);
    ciclosNivel.set(ciclo, cursosCiclo);
    estructura.set(nivel, ciclosNivel);
  });
  return estructura;
}

export function extraerResultadoFormularioServicio(res, mensajePorDefecto) {
  if (res && res.ok === false) {
    throw new Error(res.message || mensajePorDefecto);
  }
  return res?.data ?? res;
}

export function normalizarEstadoGoogle(google) {
  const googleData = google?.data ?? google;
  return {
    conectado: Boolean(googleData?.conectado),
    requiereReautenticacion: Boolean(
      googleData?.requiereReautenticacion ||
        googleData?.estado === 'REQUIERE_REAUTENTICACION',
    ),
    estado: googleData?.estado ?? 'DESCONECTADO',
    googleEmail: googleData?.googleEmail ?? null,
  };
}

const TONOS_ESTADO_FORMULARIO = Object.freeze({
  PUBLICADO: 'success',
  CERRADO: 'neutral',
  CREADO: 'info',
  CREANDO: 'info',
  ERROR: 'danger',
});

const ETIQUETAS_ESTADO_FORMULARIO = Object.freeze({
  PUBLICADO: 'PUBLICADO',
  CERRADO: 'CERRADO',
  CREANDO: 'BORRADOR',
  CREADO: 'BORRADOR',
  ERROR: 'ERROR',
});

export function obtenerPresentacionEstadoFormulario(estado) {
  return {
    label: ETIQUETAS_ESTADO_FORMULARIO[estado] || estado || 'Sin estado',
    tone: TONOS_ESTADO_FORMULARIO[estado] || 'neutral',
  };
}

export function formatearFechaHoraFormulario(valor) {
  if (!valor) {
    return '—';
  }

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    return String(valor);
  }

  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fecha);
}

export function obtenerResumenRespuestaEstudiante(respuesta = {}) {
  const datos = respuesta.datosNormalizadosJson;
  const nombre = datos
    ? [
        datos.primerNombre,
        datos.segundoNombre,
        datos.primerApellido,
        datos.segundoApellido,
      ]
        .filter(Boolean)
        .join(' ')
    : 'Sin normalizar';

  const listaAprobadas = Array.isArray(datos?.asignaturasAprobadas)
    ? datos.asignaturasAprobadas
    : [];
  const codigos = listaAprobadas
    .map((a) => {
      const cod = a.codigo || (a.planAsignaturaId ? `ID #${a.planAsignaturaId}` : '');
      return a.nombre ? `${cod} — ${a.nombre}` : cod;
    })
    .filter(Boolean)
    .join(', ');

  return {
    nombre,
    identificacion: datos?.identificacion ?? '—',
    correo: datos?.correoEstudiantil ?? '—',
    aprobadas: listaAprobadas.length,
    codigos,
    esPendiente:
      respuesta.estado === 'PENDIENTE' ||
      respuesta.estado === 'REQUIERE_REVISION',
    fechaProcesado: formatearFechaHoraFormulario(
      respuesta.procesadoAt || respuesta.revisadoAt,
    ),
    detalle:
      respuesta.detalleError || datos?.optativasNoDisciplinarias || '—',
  };
}

export function resolverUrlVistaPreviaFormulario(formulario, ticketRes) {
  const ticketUrl = ticketRes?.data?.url || ticketRes?.url || null;
  return ticketUrl;
}
