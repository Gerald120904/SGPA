/**
 * SGPA — Consulta y visualización de auditoría del aula.
 */

import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { listarAuditoriaAula } from '../../services/aulas.service.js';
import {
  detalleAuditoriaTexto,
  formatearFechaHora,
  nombreAccionAuditoria,
  nombreEntidadAuditoria,
} from './aulas.helpers.js';
import { puedeConsultarAuditoriaAula } from './aulas.context.js';

export function renderizarSeccionAuditoriaAula() {
  return `
    <section class="aulas-detail-card">
      <div class="aulas-section-header">
        <div>
          <h3>Auditoría</h3>
          <p class="aulas-muted">
            Historial de cambios y
            operaciones realizadas
            sobre esta aula.
          </p>
        </div>

        <button
          id="cargarAuditoriaAulaButton"
          type="button"
          class="aulas-secondary-button"
        >
          <i
            data-lucide="history"
            aria-hidden="true"
          ></i>
          Ver auditoría
        </button>
      </div>

      <div id="auditoriaAulaContent">
        <p class="aulas-muted">
          Presione "Ver auditoría"
          para consultar el historial.
        </p>
      </div>
    </section>
  `;
}

export async function cargarAuditoriaAula(contexto) {
  const { aulaDetalleActual } = contexto.estado;

  if (!aulaDetalleActual || !puedeConsultarAuditoriaAula()) {
    return;
  }

  const contenido = document.getElementById('auditoriaAulaContent');

  if (!contenido) {
    return;
  }

  const marca = contexto.siguienteTokenAuditoria();
  const aulaIdConsultada = aulaDetalleActual.id;

  contenido.innerHTML = `
    <div class="aulas-message-inline">
      Consultando auditoría...
    </div>
  `;

  try {
    const resultado = await listarAuditoriaAula(aulaIdConsultada);

    if (!contexto.esAuditoriaVigente(marca)) {
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible consultar la auditoría.',
      );
    }

    contexto.estado.auditoriaAulaActual = Array.isArray(resultado.auditoria)
      ? resultado.auditoria
      : [];

    renderizarAuditoriaAula(contexto);
  } catch (error) {
    if (!contexto.esAuditoriaVigente(marca)) {
      return;
    }

    contenido.innerHTML = `
      <div class="aulas-message-inline aulas-error">
        ${escapeHtml(
          error?.message || 'No fue posible consultar la auditoría.',
        )}
      </div>
    `;
  }
}

export function renderizarAuditoriaAula(contexto) {
  const contenido = document.getElementById('auditoriaAulaContent');

  if (!contenido) {
    return;
  }

  const { auditoriaAulaActual } = contexto.estado;

  if (!auditoriaAulaActual.length) {
    contenido.innerHTML = `
      <div class="aulas-occupancy-free">
        <i
          data-lucide="history"
          aria-hidden="true"
        ></i>

        <div>
          <strong>Sin registros</strong>
          <p>
            No existen movimientos
            registrados para esta aula.
          </p>
        </div>
      </div>
    `;

    if (typeof document !== 'undefined') {
      renderizarIconos();
    }

    return;
  }

  contenido.innerHTML = `
    <div class="aulas-audit-list">
      ${auditoriaAulaActual
        .map((registro) => {
          const detalle = detalleAuditoriaTexto(registro.detalle);

          return `
            <article class="aulas-audit-item">
              <div class="aulas-audit-header">
                <div>
                  <strong>
                    ${escapeHtml(nombreAccionAuditoria(registro.accion))}
                  </strong>

                  <span>
                    ${escapeHtml(nombreEntidadAuditoria(registro.entidad))}
                    ${registro.entidadId ? ` #${registro.entidadId}` : ''}
                  </span>
                </div>

                <time>
                  ${escapeHtml(formatearFechaHora(registro.createdAt))}
                </time>
              </div>

              <div class="aulas-audit-meta">
                <i
                  data-lucide="user"
                  aria-hidden="true"
                ></i>

                ${
                  registro.usuarioId
                    ? `Usuario #${escapeHtml(registro.usuarioId)}`
                    : 'Sistema'
                }
              </div>

              ${
                detalle
                  ? `
                    <details class="aulas-audit-details">
                      <summary>
                        Ver detalle del cambio
                      </summary>

                      <pre>${escapeHtml(detalle)}</pre>
                    </details>
                  `
                  : ''
              }
            </article>
          `;
        })
        .join('')}
    </div>
  `;

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}
