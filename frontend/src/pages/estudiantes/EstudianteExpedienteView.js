/**
 * SGPA — Componente de vista de expediente académico, historial y progreso del estudiante.
 * FRONTEND-REF-DEEP-002
 */

import { DataTable } from '../../components/DataTable.js';
import { escapeHtml } from '../../utils/html.js';
import {
  obtenerTextoAsignaturaEstudiante,
  obtenerTextoPeriodoEstudiante,
  obtenerTextoPlanEstudiante,
  obtenerNombreResponsableEstudiante,
  formatearFechaHoraEstudiante,
  formatearTextoEnumEstudiante,
} from './estudiantes.helpers.js';

export function renderizarHistorialAcademico(historial = []) {
  const contenedor = document.getElementById('expedienteHistorialAcademico');
  if (!contenedor) {
    return;
  }

  const rows = (Array.isArray(historial) ? historial : [])
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(obtenerTextoAsignaturaEstudiante(item))}</td>
          <td>${escapeHtml(obtenerTextoPeriodoEstudiante(item.periodo))}</td>
          <td>${escapeHtml(item.resultado || '—')}</td>
          <td>${escapeHtml(formatearTextoEnumEstudiante(item.origenAcademico))}</td>
          <td>${escapeHtml(formatearTextoEnumEstudiante(item.fuenteRegistro))}</td>
          <td>${escapeHtml(item.observaciones || '—')}</td>
          <td>${escapeHtml(obtenerNombreResponsableEstudiante(item.registradoPor))}</td>
          <td>${escapeHtml(formatearFechaHoraEstudiante(item.createdAt))}</td>
        </tr>
      `,
    )
    .join('');

  contenedor.innerHTML = DataTable({
    columns: [
      'Asignatura',
      'Período',
      'Resultado',
      'Origen',
      'Fuente',
      'Observaciones',
      'Registrado por',
      'Fecha',
    ],
    rows,
    emptyMessage: 'El estudiante todavía no posee historial académico.',
    ariaLabel: 'Historial académico del estudiante',
  });
}

export function renderizarHistorialPlanes(historial = []) {
  const contenedor = document.getElementById('expedienteHistorialPlanes');
  if (!contenedor) {
    return;
  }

  const rows = (Array.isArray(historial) ? historial : [])
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(obtenerTextoPlanEstudiante(item.planAnterior))}</td>
          <td>${escapeHtml(obtenerTextoPlanEstudiante(item.planNuevo))}</td>
          <td>${escapeHtml(obtenerTextoPeriodoEstudiante(item.periodoCambio))}</td>
          <td>${escapeHtml(item.motivo || '—')}</td>
          <td>${escapeHtml(obtenerNombreResponsableEstudiante(item.cambiadoPor))}</td>
          <td>${escapeHtml(formatearFechaHoraEstudiante(item.createdAt))}</td>
        </tr>
      `,
    )
    .join('');

  contenedor.innerHTML = DataTable({
    columns: [
      'Plan anterior',
      'Plan nuevo',
      'Período',
      'Motivo',
      'Responsable',
      'Fecha',
    ],
    rows,
    emptyMessage: 'El estudiante no registra cambios de plan.',
    ariaLabel: 'Historial de planes del estudiante',
  });
}

export function renderizarProgresoEstudiante(progreso = {}) {
  const contenedor = document.getElementById('expedienteProgreso');
  if (!contenedor) {
    return;
  }

  const resumen = progreso?.resumen ?? {};
  const reprobadas = Number.isFinite(Number(resumen.reprobadas))
    ? Number(resumen.reprobadas)
    : Array.isArray(progreso?.reprobadas)
      ? progreso.reprobadas.length
      : 0;

  const resumenTable = DataTable({
    columns: [
      'Total del plan',
      'Aprobadas',
      'Reprobadas',
      'Pendientes',
      'Rezagadas',
    ],
    rows: `
      <tr>
        <td>${resumen.totalPlan ?? 0}</td>
        <td>${resumen.aprobadas ?? 0}</td>
        <td>${reprobadas}</td>
        <td>${resumen.pendientes ?? 0}</td>
        <td>${resumen.rezagadas ?? 0}</td>
      </tr>
    `,
    emptyMessage: 'No existe información de progreso.',
    ariaLabel: 'Resumen de progreso académico',
  });

  const habilitadas = Array.isArray(progreso?.habilitadas)
    ? progreso.habilitadas
    : [];

  const filasHabilitadas = habilitadas
    .map((item) => {
      const requisitos = Array.isArray(item.requisitosFaltantes)
        ? item.requisitosFaltantes.map(obtenerTextoAsignaturaEstudiante).join(', ')
        : '';

      const correquisitos = Array.isArray(item.correquisitos)
        ? item.correquisitos.map(obtenerTextoAsignaturaEstudiante).join(', ')
        : '';

      return `
        <tr>
          <td>${escapeHtml(obtenerTextoAsignaturaEstudiante(item))}</td>
          <td>${item.habilitada ? 'Habilitada' : 'Bloqueada'}</td>
          <td>${escapeHtml(requisitos || '—')}</td>
          <td>${escapeHtml(correquisitos || '—')}</td>
        </tr>
      `;
    })
    .join('');

  const habilitadasTable = DataTable({
    columns: [
      'Asignatura',
      'Estado',
      'Requisitos faltantes',
      'Correquisitos',
    ],
    rows: filasHabilitadas,
    emptyMessage: 'No hay asignaturas pendientes para evaluar.',
    ariaLabel: 'Asignaturas habilitadas del estudiante',
  });

  const rezagadas = Array.isArray(progreso?.rezagadas)
    ? progreso.rezagadas
    : [];

  const rezagadasTable = DataTable({
    columns: ['Asignatura'],
    rows: rezagadas
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(obtenerTextoAsignaturaEstudiante(item))}</td>
          </tr>
        `,
      )
      .join(''),
    emptyMessage:
      'No hay asignaturas rezagadas para este período de referencia.',
    ariaLabel: 'Asignaturas rezagadas',
  });

  contenedor.innerHTML = `
    <h3>Resumen</h3>
    ${resumenTable}

    <h3>Habilitación de asignaturas</h3>
    ${habilitadasTable}

    <h3>Rezago académico</h3>
    ${rezagadasTable}
  `;
}
