/**
 * SGPA — Catálogo y renderizado tabular del módulo Carreras.
 * FRONTEND-ORDER-003
 */

import { DataTable } from '../../components/DataTable.js';
import { escapeHtml } from '../../utils/html.js';
import { filtrarCarreras } from './carreras.helpers.js';

export function renderizarFilaCarrera(carrera, { puedeGestionar = false } = {}) {
  return `
    <tr>
      <td>
        <strong class="carrera-code">
          ${escapeHtml(carrera.codigo)}
        </strong>
      </td>

      <td>
        <div class="carrera-name">
          <strong>${escapeHtml(carrera.nombre)}</strong>
          ${
            carrera.descripcion
              ? `<small>${escapeHtml(carrera.descripcion)}</small>`
              : ''
          }
        </div>
      </td>

      <td>
        <span
          class="
            carrera-status
            ${
              carrera.activo
                ? 'carrera-status-active'
                : 'carrera-status-inactive'
            }
          "
        >
          ${carrera.activo ? 'Activa' : 'Inactiva'}
        </span>
      </td>

      ${
        puedeGestionar
          ? `
            <td class="carreras-actions">
              <button
                class="carreras-icon-button"
                data-action="editar"
                data-id="${carrera.id}"
                type="button"
                title="Editar carrera"
              >
                <i data-lucide="pencil" aria-hidden="true"></i>
              </button>

              <button
                class="
                  carreras-icon-button
                  ${
                    carrera.activo
                      ? 'carreras-danger-button'
                      : 'carreras-success-button'
                  }
                "
                data-action="estado"
                data-id="${carrera.id}"
                type="button"
                title="${carrera.activo ? 'Desactivar carrera' : 'Activar carrera'}"
              >
                <i
                  data-lucide="${carrera.activo ? 'circle-pause' : 'circle-check'}"
                  aria-hidden="true"
                ></i>
              </button>
            </td>
          `
          : ''
      }
    </tr>
  `;
}

export function renderizarTablaCarreras({
  carreras = [],
  busqueda = '',
  estado = 'TODAS',
  puedeGestionar = false,
} = {}) {
  const filtradas = filtrarCarreras(carreras, busqueda, estado);
  const filas = filtradas
    .map((carrera) => renderizarFilaCarrera(carrera, { puedeGestionar }))
    .join('');

  return DataTable({
    columns: puedeGestionar
      ? ['Código', 'Carrera', 'Estado', 'Acciones']
      : ['Código', 'Carrera', 'Estado'],
    rows: filas,
    emptyMessage: 'No se encontraron carreras con los filtros seleccionados.',
    ariaLabel: 'Listado de carreras',
  });
}
