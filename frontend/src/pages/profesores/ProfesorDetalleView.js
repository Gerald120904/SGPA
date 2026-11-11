/**
 * SGPA — Componente de vista detallada y expediente de requisitos docentes.
 * FRONTEND-REF-DEEP-002
 */

import { StatusBadge } from '../../components/StatusBadge.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  nombreTipoRequisito,
  tonoCumplimiento,
  nombreTipoAtestado,
} from './profesores.helpers.js';

export function renderizarExpedientePerfil({
  expediente,
  modo,
  perfilId,
  puedeValidar = false,
  onCerrar = null,
  onGuardarEvidencias = null,
  onRevisarRequisito = null,
  onAprobarPerfil = null,
  onRechazarPerfil = null,
}) {
  const dialog = document.getElementById('profesorExpedienteDialog');
  const content = document.getElementById('profesorExpedienteDialogContent');

  if (!dialog || !content || !expediente) {
    return;
  }

  const requisitos = Array.isArray(expediente.requisitos)
    ? expediente.requisitos
    : [];

  const obligatorios = requisitos.filter((item) => item.obligatorio);
  const obligatoriosCumplidos = obligatorios.filter(
    (item) => item.cumplimiento?.estado === 'CUMPLE',
  );

  const estadoSolicitud = expediente.solicitud?.estado || 'PENDIENTE';
  const tonoSolicitud =
    estadoSolicitud === 'APROBADO'
      ? 'success'
      : estadoSolicitud === 'RECHAZADO'
        ? 'danger'
        : estadoSolicitud === 'INACTIVO'
          ? 'neutral'
          : 'warning';

  const tituloPerfil = expediente.perfil?.codigo
    ? `${expediente.perfil.codigo} — ${expediente.perfil.nombre}`
    : expediente.perfil?.nombre || 'Perfil académico';

  content.innerHTML = `
    <div class="profesores-expediente">
      <div class="profesores-expediente-header">
        <div class="profesores-expediente-title-wrap">
          <h3>${escapeHtml(tituloPerfil)}</h3>
          <p>
            ${expediente.perfil?.numeroPerfil ? `Perfil ${escapeHtml(String(expediente.perfil.numeroPerfil))}` : ''}
            ${modo === 'gestion' && expediente.profesor?.nombre ? ` · Profesor: <strong>${escapeHtml(expediente.profesor.nombre)}</strong>` : ''}
          </p>

          <div class="profesores-expediente-header-meta">
            <span style="font-size: 13px; color: #475467;">Estado de solicitud:</span>
            ${StatusBadge({
              label: estadoSolicitud,
              tone: tonoSolicitud,
            })}

            <div class="profesores-expediente-progress">
              <span>Requisitos obligatorios:</span>
              <strong>${obligatoriosCumplidos.length} de ${obligatorios.length} cumplidos</strong>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="profesores-icon-button"
          data-action="cerrar-expediente"
          title="Cerrar expediente"
          aria-label="Cerrar expediente"
        >
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <div class="profesores-requisitos-list">
        ${
          requisitos.length
            ? requisitos
                .map((item) => {
                  const estadoCumplimiento =
                    item.cumplimiento?.estado || 'PENDIENTE';

                  return `
                    <article class="profesores-requisito-card">
                      <div class="profesores-requisito-header">
                        <strong>${escapeHtml(nombreTipoRequisito(item.tipo))}</strong>

                        <div class="profesores-requisito-header-badges">
                          ${
                            item.obligatorio
                              ? StatusBadge({
                                  label: 'OBLIGATORIO',
                                  tone: 'warning',
                                })
                              : StatusBadge({
                                  label: 'FACULTATIVO',
                                  tone: 'neutral',
                                })
                          }

                          ${StatusBadge({
                            label: estadoCumplimiento,
                            tone: tonoCumplimiento(estadoCumplimiento),
                          })}
                        </div>
                      </div>

                      <p class="profesores-requisito-description">
                        ${escapeHtml(item.descripcion || '')}
                      </p>

                      <div class="profesores-requisito-evidencias">
                        <span>Evidencias</span>

                        ${
                          modo === 'profesor' && estadoSolicitud === 'PENDIENTE'
                            ? `
                              ${
                                !expediente.atestadosDisponibles ||
                                !expediente.atestadosDisponibles.length
                                  ? `
                                    <div class="profesores-empty-evidencias">
                                      <p class="profesores-muted">
                                        No tiene atestados disponibles.<br>
                                        Registre primero un atestado en la sección "Mis atestados" para poder utilizarlo como evidencia.
                                      </p>
                                    </div>
                                  `
                                  : `
                                    <div class="profesores-evidencias-checklist">
                                      ${expediente.atestadosDisponibles
                                        .filter(
                                          (at) => at.estado !== 'INACTIVO',
                                        )
                                        .map((at) => {
                                          const checked = (
                                            item.evidencias || []
                                          ).some((ev) => ev.id === at.id);

                                          return `
                                            <label class="profesores-checkbox-item">
                                              <input
                                                type="checkbox"
                                                name="evidencia-${item.id}"
                                                value="${at.id}"
                                                ${checked ? 'checked' : ''}
                                              >
                                              <span>
                                                <strong>${escapeHtml(at.nombre)}</strong>
                                                <small>
                                                  ${escapeHtml(nombreTipoAtestado(at.tipo))} · ${escapeHtml(at.institucion || '')}
                                                  ${
                                                    at.tipo === 'EXPERIENCIA_DOCENTE' || at.tipo === 'EXPERIENCIA_PROFESIONAL'
                                                      ? ` · ${escapeHtml(at.fechaInicio || '—')} — ${escapeHtml(at.fechaFin || 'Actualidad')}`
                                                      : (at.fechaObtencion ? ` · ${escapeHtml(at.fechaObtencion)}` : '')
                                                  }
                                                </small>
                                              </span>
                                            </label>
                                          `;
                                        })
                                        .join('')}
                                    </div>
                                  `
                              }

                              <label class="profesores-obs-field">
                                <span>Observación del profesor:</span>
                                <textarea
                                  data-observacion-requisito="${item.id}"
                                  rows="2"
                                  maxlength="500"
                                  placeholder="Observación opcional sobre este requisito..."
                                >${escapeHtml(item.cumplimiento?.observacionProfesor || '')}</textarea>
                              </label>

                              <div class="profesores-requisito-actions">
                                <button
                                  type="button"
                                  class="profesores-action-button is-success"
                                  data-action="guardar-evidencias-requisito"
                                  data-requisito-id="${item.id}"
                                  data-perfil-id="${perfilId}"
                                >
                                  <i data-lucide="save" aria-hidden="true"></i>
                                  Guardar evidencias
                                </button>
                              </div>
                            `
                            : `
                              ${
                                item.evidencias && item.evidencias.length
                                  ? item.evidencias
                                      .map(
                                        (ev) => `
                                          <div class="profesores-evidencia-item">
                                            <div class="profesores-evidencia-item-info">
                                              <strong>${escapeHtml(ev.nombre)}</strong>
                                              <small>
                                                ${escapeHtml(nombreTipoAtestado(ev.tipo))}
                                                ${ev.institucion ? ` · ${escapeHtml(ev.institucion)}` : ''}
                                                ${
                                                  ev.tipo === 'EXPERIENCIA_DOCENTE' || ev.tipo === 'EXPERIENCIA_PROFESIONAL'
                                                    ? ` · ${escapeHtml(ev.fechaInicio || '—')} — ${escapeHtml(ev.fechaFin || 'Actualidad')}`
                                                    : (ev.fechaObtencion ? ` · Obtenida: ${escapeHtml(ev.fechaObtencion)}` : '')
                                                }
                                              </small>
                                              ${
                                                ev.descripcion
                                                  ? `<small style="color: #667085;">${escapeHtml(ev.descripcion)}</small>`
                                                  : ''
                                              }
                                            </div>
                                            ${StatusBadge({
                                              label: ev.estado,
                                              tone:
                                                ev.estado === 'APROBADO'
                                                  ? 'success'
                                                  : ev.estado === 'RECHAZADO'
                                                    ? 'danger'
                                                    : 'warning',
                                            })}
                                          </div>
                                        `,
                                      )
                                      .join('')
                                  : `
                                    <p class="profesores-muted" style="margin: 0;">
                                      Sin evidencias adjuntas.
                                    </p>
                                  `
                              }
                            `
                        }
                      </div>

                      ${
                        item.cumplimiento?.observacionProfesor &&
                        (modo === 'gestion' || estadoSolicitud !== 'PENDIENTE')
                          ? `
                            <div class="profesores-requisito-obs">
                              <strong>Observación del profesor:</strong>
                              ${escapeHtml(item.cumplimiento.observacionProfesor)}
                            </div>
                          `
                          : ''
                      }

                      ${
                        item.cumplimiento?.observacionRevision
                          ? `
                            <div class="profesores-requisito-obs">
                              <strong>Observación de revisión:</strong>
                              ${escapeHtml(item.cumplimiento.observacionRevision)}
                            </div>
                          `
                          : ''
                      }

                      ${
                        modo === 'gestion' &&
                        estadoSolicitud === 'PENDIENTE' &&
                        puedeValidar
                          ? `
                            <div class="profesores-requisito-actions">
                              <button
                                type="button"
                                class="profesores-action-button is-success"
                                data-action="revisar-requisito-dialog"
                                data-requisito-id="${item.id}"
                                data-requisito-nombre="${escapeHtml(nombreTipoRequisito(item.tipo))}"
                                data-estado="CUMPLE"
                                data-perfil-id="${perfilId}"
                              >
                                Cumple
                              </button>

                              <button
                                type="button"
                                class="profesores-action-button is-danger"
                                data-action="revisar-requisito-dialog"
                                data-requisito-id="${item.id}"
                                data-requisito-nombre="${escapeHtml(nombreTipoRequisito(item.tipo))}"
                                data-estado="NO_CUMPLE"
                                data-perfil-id="${perfilId}"
                              >
                                No cumple
                              </button>

                              ${
                                !item.obligatorio
                                  ? `
                                    <button
                                      type="button"
                                      class="profesores-action-button"
                                      data-action="revisar-requisito-dialog"
                                      data-requisito-id="${item.id}"
                                      data-requisito-nombre="${escapeHtml(nombreTipoRequisito(item.tipo))}"
                                      data-estado="NO_APLICA"
                                      data-perfil-id="${perfilId}"
                                    >
                                      No aplica
                                    </button>
                                  `
                                  : ''
                              }
                            </div>
                          `
                          : ''
                      }
                    </article>
                  `;
                })
                .join('')
            : `
              <p class="profesores-muted" style="text-align: center; padding: 24px 0;">
                No hay requisitos registrados para este perfil.
              </p>
            `
        }
      </div>

      <div class="profesores-expediente-footer">
        <div class="profesores-expediente-footer-actions">
          ${
            modo === 'gestion' &&
            estadoSolicitud === 'PENDIENTE' &&
            puedeValidar
              ? `
                <button
                  type="button"
                  class="profesores-action-button is-success"
                  data-action="aprobar-perfil-desde-expediente"
                  data-perfil-id="${perfilId}"
                >
                  Aprobar perfil
                </button>

                <button
                  type="button"
                  class="profesores-action-button is-danger"
                  data-action="rechazar-perfil-desde-expediente"
                  data-perfil-id="${perfilId}"
                >
                  Rechazar perfil
                </button>
              `
              : ''
          }

          <button
            type="button"
            class="profesores-action-button"
            data-action="cerrar-expediente"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  `;

  content.onclick = (event) => {
    const boton = event.target.closest('[data-action]');
    if (!boton) return;

    const action = boton.dataset.action;

    if (action === 'cerrar-expediente') {
      if (typeof onCerrar === 'function') {
        onCerrar();
      } else {
        dialog.close();
      }
      return;
    }

    if (action === 'guardar-evidencias-requisito') {
      const reqId = Number(boton.dataset.requisitoId);
      const pId = Number(boton.dataset.perfilId);
      const checkboxes = content.querySelectorAll(
        `input[name="evidencia-${reqId}"]:checked`,
      );
      const evidenciasIds = [...checkboxes].map((cb) => Number(cb.value));
      const textarea = content.querySelector(
        `textarea[data-observacion-requisito="${reqId}"]`,
      );
      const observacion = textarea ? textarea.value.trim() : '';

      if (typeof onGuardarEvidencias === 'function') {
        onGuardarEvidencias({
          perfilId: pId,
          requisitoId: reqId,
          evidenciasIds,
          observacion,
        });
      }
      return;
    }

    if (action === 'revisar-requisito-dialog') {
      const reqId = Number(boton.dataset.requisitoId);
      const pId = Number(boton.dataset.perfilId);
      const estado = boton.dataset.estado;
      const requisitoNombre = boton.dataset.requisitoNombre || '';

      if (typeof onRevisarRequisito === 'function') {
        onRevisarRequisito({
          perfilId: pId,
          requisitoId: reqId,
          estado,
          requisitoNombre,
        });
      }
      return;
    }

    if (action === 'aprobar-perfil-desde-expediente') {
      const pId = Number(boton.dataset.perfilId);
      if (typeof onAprobarPerfil === 'function') {
        onAprobarPerfil(pId);
      }
      return;
    }

    if (action === 'rechazar-perfil-desde-expediente') {
      const pId = Number(boton.dataset.perfilId);
      if (typeof onRechazarPerfil === 'function') {
        onRechazarPerfil(pId);
      }
    }
  };

  if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    renderizarIconos();
  }
}
