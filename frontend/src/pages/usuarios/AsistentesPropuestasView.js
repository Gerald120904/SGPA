/**
 * SGPA — Presentación de propuestas, estados de invitación y resúmenes de delegación de Asistentes.
 * FRONTEND-ORDER-003
 */

import { StatusBadge } from '../../components/StatusBadge.js';
import { escapeHtml } from '../../utils/html.js';

export function nombrePermisoDelegable(codigo) {
  if (String(codigo).endsWith('_VER')) return 'Consultar';
  if (String(codigo).endsWith('_GESTIONAR')) return 'Proponer cambios';
  return String(codigo).replaceAll('_', ' ').toLocaleLowerCase('es-CR');
}

const PRESENTACIONES_INVITACION = Object.freeze({
  PENDIENTE: ['Invitación pendiente', 'warning'],
  EN_PROCESO: ['Procesando invitación', 'info'],
  ENVIADA: ['Invitación enviada', 'success'],
  FALLIDA: ['Envío fallido', 'danger'],
  INCIERTA: ['Resultado incierto', 'warning'],
  CADUCADA: ['Invitación vencida', 'neutral'],
  ACEPTADA: ['Invitación aceptada', 'success'],
  SIN_INVITACION: ['Sin invitación', 'neutral'],
});

export function obtenerPresentacionInvitacion(estadoInvitacion) {
  return (
    PRESENTACIONES_INVITACION[estadoInvitacion || 'SIN_INVITACION'] || [
      'Estado desconocido',
      'neutral',
    ]
  );
}

export function renderizarInsigniaInvitacion(asistente) {
  const [label, tone] = obtenerPresentacionInvitacion(asistente?.invitacion?.estado);
  return StatusBadge({ label, tone });
}

export function obtenerTonoEstadoSolicitud(estado) {
  if (estado === 'APROBADA') return 'success';
  if (estado === 'PENDIENTE') return 'warning';
  if (estado === 'RECHAZADA' || estado === 'INVALIDADA') return 'danger';
  return 'neutral';
}

export function construirResumenDelegacionHtml({
  coordinador,
  envioInvitacionHabilitado,
  seleccion = [],
}) {
  const invitacion = envioInvitacionHabilitado
    ? 'Envío habilitado; el resultado se confirmará al crear.'
    : 'Pendiente de envío; el envío automático está deshabilitado.';

  return `
    <h4>Resumen de la delegación</h4>
    <p><strong>Coordinador responsable:</strong> ${escapeHtml(coordinador)}</p>
    <p><strong>Estado de la invitación:</strong> ${escapeHtml(invitacion)}</p>
    ${
      seleccion.length
        ? `<ul>${seleccion
            .map(
              (carrera) =>
                `<li><strong>${escapeHtml(carrera.nombre)}</strong>: ${
                  carrera.permisos.length
                    ? carrera.permisos.map(escapeHtml).join(', ')
                    : 'sin permisos seleccionados'
                }</li>`,
            )
            .join('')}</ul>`
        : '<p>No hay carreras seleccionadas.</p>'
    }`;
}

export function propuestaVisible(solicitud) {
  const datos = solicitud?.datosPropuestos || {};
  const campos = [
    [
      'Curso',
      datos.cursoReferencia
        ? `${datos.cursoReferencia.codigo} · ${datos.cursoReferencia.nombre}`
        : undefined,
    ],
    [
      'Plan de estudio',
      datos.planReferencia
        ? `${datos.planReferencia.codigo} · ${datos.planReferencia.nombre}`
        : undefined,
    ],
    ['Código anterior', datos.datosAnteriores?.codigo],
    ['Código propuesto', datos.codigo],
    ['Nombre anterior', datos.datosAnteriores?.nombre],
    ['Nombre propuesto', datos.nombre],
    ['Descripción anterior', datos.datosAnteriores?.descripcion],
    ['Descripción propuesta', datos.descripcion],
    [
      'Estado anterior',
      typeof datos.datosAnteriores?.activo === 'boolean'
        ? datos.datosAnteriores.activo
          ? 'Activo'
          : 'Inactivo'
        : undefined,
    ],
    [
      'Estado propuesto',
      typeof datos.activo === 'boolean'
        ? datos.activo
          ? 'Activo'
          : 'Inactivo'
        : undefined,
    ],
    [
      solicitud?.modulo === 'CURSOS'
        ? 'Curso ID'
        : solicitud?.modulo === 'PLANES_ESTUDIO'
          ? 'Plan ID'
          : solicitud?.modulo === 'OPTATIVAS'
            ? 'Optativa ID'
            : 'Estudiante ID',
      solicitud?.objetivoId,
    ],
    ['Código de optativa', datos.codigo || datos.optativaReferencia?.codigo],
    ['Nombre de optativa', datos.nombre || datos.optativaReferencia?.nombre],
    ['Tipo de optativa', datos.tipo || datos.datosAnteriores?.tipo],
    ['Nuevo estado', datos.estado],
    ['Cédula', datos.cedula],
    ['Nombres', datos.nombres],
    ['Primer apellido', datos.apellido1],
    ['Segundo apellido', datos.apellido2],
    ['Correo', datos.correoInstitucional],
    ['Teléfono', datos.telefono],
    ['Plan', datos.planEstudioId],
    ['Período de ingreso', datos.periodoIngresoId],
    [
      'Asignatura',
      datos.nombreReferencia
        ? datos.nombreReferencia
        : datos.cursoId
          ? `Curso #${datos.cursoId}`
          : undefined,
    ],
    ['Nivel', datos.nivel],
    ['Ciclo / Período', datos.periodo],
    ['Créditos', datos.creditos],
    ['Tipo', datos.tipo],
    ['Orden', datos.orden],
    ['Asignatura ID', datos.planAsignaturaId],
    ['Requisito ID', datos.asignaturaRequisitoId],
    [
      'Salida académica',
      datos.nombre || (datos.salidaId ? `Salida #${datos.salidaId}` : undefined),
    ],
    ['Título otorgado', datos.tituloOtorgado],
    [
      'Asignaturas asociadas',
      Array.isArray(datos.asignaturaIds)
        ? `${datos.asignaturaIds.length} asignaturas`
        : undefined,
    ],
    ['Cantidad de optativas', datos.cantidadOptativas],
    ['Créditos mínimos', datos.creditosMinimos],
    [
      'Carga masiva',
      Array.isArray(datos.asignaturas)
        ? `${datos.asignaturas.length} asignaturas`
        : Array.isArray(datos.requisitos)
          ? `${datos.requisitos.length} requisitos`
          : undefined,
    ],
    [
      'Importación',
      Array.isArray(datos.filas)
        ? `${datos.filas.length} filas`
        : datos.nombreArchivo ||
          (datos.resumenValidacion
            ? `${datos.resumenValidacion.total ?? ''} filas`
            : undefined),
    ],
    [
      'Plan de destino',
      datos.planNuevoReferencia?.nombre
        ? `${datos.planNuevoReferencia.codigo} - ${datos.planNuevoReferencia.nombre}`
        : datos.planNuevoId
          ? `Plan #${datos.planNuevoId}`
          : undefined,
    ],
    ['Motivo de cambio', datos.motivo],
    ['Período de cambio', datos.periodoCambioId ? `Período #${datos.periodoCambioId}` : undefined],
    [
      'Estudiante afectado',
      datos.estudianteReferencia?.cedula
        ? `${datos.estudianteReferencia.cedula} - ${datos.estudianteReferencia.nombres}`
        : undefined,
    ],
    ['Resultado propuesto', datos.resultado],
    ['Origen académico', datos.origenAcademico],
    ['Observaciones', datos.observaciones],
    [
      'Bandeja - Aprobaciones propuestas',
      Array.isArray(datos.aprobarRegistroIds)
        ? `${datos.aprobarRegistroIds.length} registro(s)`
        : undefined,
    ],
    [
      'Bandeja - Rechazos propuestos',
      Array.isArray(datos.rechazarRegistros)
        ? `${datos.rechazarRegistros.length} registro(s)`
        : undefined,
    ],
    [
      'Detalle motivos rechazo',
      Array.isArray(datos.rechazarRegistros) && datos.rechazarRegistros.length > 0
        ? datos.rechazarRegistros.map((r) => `ID #${r.id}: ${r.motivo}`).join('; ')
        : undefined,
    ],
    ['Observación del asistente', datos.observacion],
  ];

  return `<dl class="mis-asistentes-propuesta">${campos
    .filter(([, valor]) => valor !== undefined && valor !== null)
    .map(
      ([etiqueta, valor]) =>
        `<div><dt>${escapeHtml(etiqueta)}</dt><dd>${escapeHtml(String(valor))}</dd></div>`,
    )
    .join('')}</dl>`;
}
