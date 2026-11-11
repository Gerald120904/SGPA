/**
 * SGPA — Catálogo y tabla del módulo Perfiles Académicos.
 * FRONTEND-ORDER-003
 */

import { DataTable } from '../../components/DataTable.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { escapeHtml } from '../../utils/html.js';
import { filtrarPerfilesAcademicos } from './perfiles-academicos.helpers.js';

export function renderizarTablaPerfiles({
  perfiles = [],
  texto = '',
  estado = 'TODOS',
} = {}) {
  const filtrados = filtrarPerfilesAcademicos(perfiles, texto, estado);

  const filas = filtrados
    .map(
      (perfil) => `
    <tr>
      <td><strong class="perfil-codigo">${escapeHtml(perfil.codigo)}</strong></td>
      <td>
        <div class="perfil-nombre">
          <strong>${escapeHtml(perfil.nombre)}</strong>
          <small>${escapeHtml(perfil.numeroPerfil || 'Sin número oficial')}</small>
        </div>
      </td>
      <td>${escapeHtml(perfil.carrera?.nombre || '—')}</td>
      <td>${StatusBadge({
        label: perfil.activo ? 'ACTIVO' : 'INACTIVO',
        tone: perfil.activo ? 'success' : 'neutral',
      })}</td>
      <td class="sgpa-table-actions-cell">
        <button class="sgpa-button sgpa-button-secondary sgpa-button-sm" type="button" data-ver-perfil="${perfil.id}">
          <i data-lucide="eye" aria-hidden="true"></i> Ver detalle
        </button>
      </td>
    </tr>
  `,
    )
    .join('');

  return DataTable({
    columns: [
      'Código',
      'Perfil',
      'Carrera',
      'Estado',
      { label: 'Acciones', className: 'sgpa-table-actions-cell' },
    ],
    rows: filas,
    emptyMessage: 'No hay perfiles que coincidan con los filtros.',
    ariaLabel: 'Perfiles académicos',
  });
}
