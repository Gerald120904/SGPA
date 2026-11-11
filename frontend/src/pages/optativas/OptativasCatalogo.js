/**
 * SGPA — Catálogo, barra de filtros y tabla de Optativas.
 * FRONTEND-ORDER-003
 */

import { DataTable } from '../../components/DataTable.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { escapeHtml } from '../../utils/html.js';
import {
  filtrarOptativas,
  obtenerEtiquetaCategoria,
  obtenerPresentacionEstadoOptativa,
  puedeEditarOptativa,
} from './optativas.helpers.js';

export function renderizarFiltrosOptativas() {
  return `
    <div class="optativas-filters">
      <label class="sgpa-search" for="buscarOptativa">
        <i data-lucide="search" aria-hidden="true"></i>
        <input id="buscarOptativa" type="search" placeholder="Buscar por código o nombre..." autocomplete="off" aria-label="Buscar optativas">
      </label>
      <select id="tipoOptativaFiltro" class="sgpa-select" aria-label="Filtrar por categoría">
        <option value="">Todas las categorías</option>
        <option value="DISCIPLINARIA">Disciplinaria</option>
        <option value="ABIERTA">Abierta</option>
        <option value="SEDE">Sede</option>
      </select>
      <select id="estadoOptativaFiltro" class="sgpa-select" aria-label="Filtrar por estado">
        <option value="">Todos los estados</option>
        <option value="ACTIVA">Activas</option>
        <option value="INACTIVA">Inactivas</option>
      </select>
    </div>
  `;
}

export function renderizarFilaOptativa(optativa, { gestionar = false, rolActivo = null } = {}) {
  const presentacion = obtenerPresentacionEstadoOptativa(optativa.activo);
  const editable = puedeEditarOptativa(optativa, rolActivo);

  return `
    <tr>
      <td><strong class="optativas-codigo">${escapeHtml(optativa.curso?.codigo ?? '—')}</strong></td>
      <td><strong>${escapeHtml(optativa.curso?.nombre ?? '—')}</strong></td>
      <td>${escapeHtml(obtenerEtiquetaCategoria(optativa.tipo))}</td>
      <td>${escapeHtml(optativa.carreraOrigen?.nombre ?? 'Institucional')}</td>
      <td>${StatusBadge({ label: presentacion.label, tone: presentacion.tone })}</td>
      ${
        gestionar
          ? `
        <td class="sgpa-table-actions-cell">
          <div class="sgpa-table-actions">
            ${
              editable
                ? `
              <button type="button"
                class="cursos-icon-button optativas-icon-button"
                data-editar-optativa="${Number(optativa.id)}"
                title="Editar optativa"
                aria-label="Editar ${escapeHtml(optativa.curso?.nombre ?? 'optativa')}">
                <i data-lucide="pencil" aria-hidden="true"></i>
              </button>
              <button type="button"
                class="cursos-icon-button optativas-icon-button ${optativa.activo ? 'optativas-icon-button--danger' : ''}"
                data-estado-optativa="${Number(optativa.id)}"
                title="${optativa.activo ? 'Desactivar' : 'Activar'} optativa"
                aria-label="${optativa.activo ? 'Desactivar' : 'Activar'} ${escapeHtml(optativa.curso?.nombre ?? 'optativa')}">
                <i data-lucide="${optativa.activo ? 'circle-pause' : 'circle-check'}" aria-hidden="true"></i>
              </button>`
                : ''
            }
          </div>
        </td>`
          : ''
      }
    </tr>
  `;
}

export function renderizarTablaOptativas({
  optativas = [],
  filtros = {},
  gestionar = false,
  rolActivo = null,
} = {}) {
  const visibles = filtrarOptativas(optativas, filtros);
  const filas = visibles
    .map((o) => renderizarFilaOptativa(o, { gestionar, rolActivo }))
    .join('');

  return DataTable({
    columns: [
      'Código',
      'Nombre',
      'Categoría',
      'Carrera de origen',
      'Estado',
      ...(gestionar ? [{ label: 'Acciones', className: 'sgpa-table-actions-cell' }] : []),
    ],
    rows: filas,
    emptyMessage: 'No hay optativas que coincidan con los filtros.',
    ariaLabel: 'Catálogo de optativas',
  });
}
