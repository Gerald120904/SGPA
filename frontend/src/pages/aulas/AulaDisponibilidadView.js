/**
 * SGPA — Sección y formularios de disponibilidad base por periodo académico de Aulas.
 */

import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  actualizarDisponibilidadAula,
  crearDisponibilidadAula,
  eliminarDisponibilidadAula,
  listarDisponibilidadesAula,
} from '../../services/aulas.service.js';
import {
  DIAS_SEMANA_AULA,
  horaCorta,
  periodoPermiteEditarDisponibilidad,
  seleccionarPeriodoPreferido,
} from './aulas.helpers.js';
import {
  inicializarControlesHorario,
  renderizarControlHoraCompacto,
} from './aulas.horarios.js';
import {
  puedeGestionarAulas,
  puedeVerPeriodos,
  validarGestionAulas,
} from './aulas.context.js';

export function renderizarSeccionDisponibilidadBase(contexto) {
  if (!puedeVerPeriodos()) {
    return `
      <section class="aulas-detail-card">
        <div class="aulas-section-header">
          <div>
            <h3>Disponibilidad base</h3>
            <p class="aulas-muted">
              No posee permiso para consultar los periodos académicos necesarios para visualizar esta disponibilidad.
            </p>
          </div>
        </div>
      </section>
    `;
  }

  const { periodosDisponibilidadAula } = contexto.estado;

  return `
    <section class="aulas-detail-card">
      <div class="aulas-section-header">
        <div>
          <h3>Disponibilidad base</h3>
          <p class="aulas-muted">
            Horarios en los que el aula
            puede utilizarse normalmente
            durante cada periodo académico.
          </p>
        </div>

        <select
          id="aulaPeriodoDisponibilidad"
          class="aulas-select"
        >
          ${
            periodosDisponibilidadAula.length
              ? periodosDisponibilidadAula
                  .map(
                    (periodo) => `
                      <option value="${periodo.id}">
                        ${escapeHtml(periodo.codigo)}
                        —
                        ${escapeHtml(periodo.nombre)}
                      </option>
                    `,
                  )
                  .join('')
              : `
                <option value="">
                  Sin periodos académicos
                </option>
              `
          }
        </select>
      </div>

      <div id="aulaDisponibilidadBaseContent">
        <p class="aulas-muted">
          Seleccione un periodo
          académico.
        </p>
      </div>
    </section>
  `;
}

export function configurarDisponibilidadBaseAula(contexto) {
  if (!puedeVerPeriodos()) {
    return;
  }

  const selector = document.getElementById('aulaPeriodoDisponibilidad');
  const { periodosDisponibilidadAula } = contexto.estado;

  if (!selector || !periodosDisponibilidadAula.length) {
    return;
  }

  const inicial = seleccionarPeriodoPreferido(periodosDisponibilidadAula);

  if (!inicial) {
    return;
  }

  selector.value = String(inicial.id);

  selector.addEventListener('change', async () => {
    const periodoId = Number(selector.value);

    if (periodoId) {
      await cargarDisponibilidadBaseAula(periodoId, contexto);
    }
  });

  cargarDisponibilidadBaseAula(inicial.id, contexto);
}

export async function cargarDisponibilidadBaseAula(periodoId, contexto) {
  const contenido = document.getElementById('aulaDisponibilidadBaseContent');
  const { aulaDetalleActual, periodosDisponibilidadAula } = contexto.estado;

  if (!contenido || !aulaDetalleActual) {
    return;
  }

  const marca = contexto.siguienteTokenDisponibilidad();
  const aulaIdConsultada = aulaDetalleActual.id;

  contenido.innerHTML = `
    <div class="aulas-message-inline">
      Consultando disponibilidad...
    </div>
  `;

  try {
    const resultado = await listarDisponibilidadesAula(
      aulaIdConsultada,
      periodoId,
    );

    if (!contexto.esDisponibilidadVigente(marca)) {
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible consultar la disponibilidad.',
      );
    }

    contexto.estado.periodoDisponibilidadActual =
      periodosDisponibilidadAula.find((periodo) => periodo.id === periodoId) ||
      null;

    contexto.estado.disponibilidadBaseAulaActual = Array.isArray(
      resultado.disponibilidades,
    )
      ? resultado.disponibilidades
      : [];

    renderizarDisponibilidadBaseAula(contexto);
  } catch (error) {
    if (!contexto.esDisponibilidadVigente(marca)) {
      return;
    }

    contenido.innerHTML = `
      <div class="aulas-message-inline aulas-error">
        ${escapeHtml(
          error?.message || 'No fue posible consultar la disponibilidad.',
        )}
      </div>
    `;
  }
}

export function renderizarDisponibilidadBaseAula(contexto) {
  const contenido = document.getElementById('aulaDisponibilidadBaseContent');

  if (!contenido) {
    return;
  }

  const {
    aulaDetalleActual,
    periodoDisponibilidadActual,
    disponibilidadBaseAulaActual,
  } = contexto.estado;

  const puedeEditar =
    puedeGestionarAulas() &&
    aulaDetalleActual?.activo &&
    periodoPermiteEditarDisponibilidad(periodoDisponibilidadActual);

  contenido.innerHTML = `
    <div class="aulas-base-availability-header">
      <div>
        <span
          class="aulas-status ${
            periodoPermiteEditarDisponibilidad(periodoDisponibilidadActual)
              ? 'is-active'
              : 'is-inactive'
          }"
        >
          ${
            periodoPermiteEditarDisponibilidad(periodoDisponibilidadActual)
              ? 'Periodo editable'
              : 'Solo lectura'
          }
        </span>
      </div>

      ${
        puedeEditar
          ? `
            <button
              id="nuevoBloqueAulaButton"
              type="button"
              class="aulas-primary-button"
            >
              <i
                data-lucide="plus"
                aria-hidden="true"
              ></i>
              Agregar bloque
            </button>
          `
          : ''
      }
    </div>

    ${
      disponibilidadBaseAulaActual.length
        ? `
          <div class="aulas-base-availability-list">
            ${disponibilidadBaseAulaActual
              .map(
                (bloque) => `
                  <div class="aulas-base-availability-row">
                    <div>
                      <strong>
                        ${escapeHtml(DIAS_SEMANA_AULA[bloque.diaSemana])}
                      </strong>

                      <span>
                        ${escapeHtml(horaCorta(bloque.horaInicio))}
                        —
                        ${escapeHtml(horaCorta(bloque.horaFin))}
                      </span>
                    </div>

                    ${
                      puedeEditar
                        ? `
                          <div class="aulas-actions">
                            <button
                              type="button"
                              class="aulas-icon-button"
                              data-disponibilidad-action="editar"
                              data-disponibilidad-id="${bloque.id}"
                              title="Editar bloque"
                            >
                              <i
                                data-lucide="pencil"
                                aria-hidden="true"
                              ></i>
                            </button>

                            <button
                              type="button"
                              class="aulas-icon-button is-danger"
                              data-disponibilidad-action="eliminar"
                              data-disponibilidad-id="${bloque.id}"
                              title="Eliminar bloque"
                            >
                              <i
                                data-lucide="trash-2"
                                aria-hidden="true"
                              ></i>
                            </button>
                          </div>
                        `
                        : ''
                    }
                  </div>
                `,
              )
              .join('')}
          </div>
        `
        : `
          <div class="aulas-occupancy-free">
            <i
              data-lucide="calendar"
              aria-hidden="true"
            ></i>

            <div>
              <strong>Sin disponibilidad configurada</strong>
              <p>
                No existen bloques base
                registrados para este periodo.
              </p>
            </div>
          </div>
        `
    }
  `;

  document
    .getElementById('nuevoBloqueAulaButton')
    ?.addEventListener('click', () => {
      abrirFormularioBloqueAula(null, contexto);
    });

  contenido
    .querySelectorAll('[data-disponibilidad-action]')
    .forEach((boton) => {
      boton.addEventListener('click', async () => {
        const id = Number(boton.dataset.disponibilidadId);
        const bloque = contexto.estado.disponibilidadBaseAulaActual.find(
          (item) => item.id === id,
        );

        if (!bloque) {
          return;
        }

        if (boton.dataset.disponibilidadAction === 'editar') {
          abrirFormularioBloqueAula(bloque, contexto);
          return;
        }

        await confirmarEliminarBloqueAula(bloque, contexto);
      });
    });

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}

export function abrirFormularioBloqueAula(bloque = null, contexto) {
  if (!validarGestionAulas()) {
    return;
  }

  const { aulaDetalleActual, periodoDisponibilidadActual } = contexto.estado;

  if (!aulaDetalleActual || !periodoDisponibilidadActual) {
    return;
  }

  const dialog = document.getElementById('aulaDialog');
  const content = document.getElementById('aulaDialogContent');

  if (!dialog || !content) {
    return;
  }

  const editando = Boolean(bloque);

  content.innerHTML = FormDialog({
    formId: 'disponibilidadAulaForm',
    title: editando ? 'Editar bloque' : 'Agregar bloque de disponibilidad',
    description: `${periodoDisponibilidadActual.codigo} — ${periodoDisponibilidadActual.nombre}`,
    body: `
      <label class="sgpa-form-wide">
        <span>Día</span>

        <select
          id="disponibilidadAulaDia"
          required
        >
          ${Object.entries(DIAS_SEMANA_AULA)
            .map(
              ([valor, nombre]) => `
                <option
                  value="${valor}"
                  ${
                    Number(bloque?.diaSemana || 1) === Number(valor)
                      ? 'selected'
                      : ''
                  }
                >
                  ${nombre}
                </option>
              `,
            )
            .join('')}
        </select>
      </label>

      <label>
        <span>Hora inicio</span>

        ${renderizarControlHoraCompacto(
          'disponibilidadAulaInicio',
          bloque?.horaInicio || '',
        )}
      </label>

      <label>
        <span>Hora fin</span>

        ${renderizarControlHoraCompacto(
          'disponibilidadAulaFin',
          bloque?.horaFin || '',
        )}
      </label>
    `,
    errorId: 'disponibilidadAulaError',
    cancelButtonId: 'cancelarDisponibilidadAula',
    submitButtonId: 'guardarDisponibilidadAula',
    submitText: editando ? 'Guardar cambios' : 'Agregar bloque',
  });

  inicializarControlesHorario(content);
  dialog.showModal();
  habilitarCierreExterior(dialog);

  document
    .getElementById('cancelarDisponibilidadAula')
    ?.addEventListener('click', () => dialog.close());

  document
    .getElementById('disponibilidadAulaForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const diaSemana = Number(
        document.getElementById('disponibilidadAulaDia')?.value,
      );
      const horaInicio = document.getElementById(
        'disponibilidadAulaInicio',
      )?.value;
      const horaFin = document.getElementById('disponibilidadAulaFin')?.value;
      const errorBox = document.getElementById('disponibilidadAulaError');

      if (!horaInicio || !horaFin || horaFin <= horaInicio) {
        if (errorBox) {
          errorBox.textContent =
            'La hora de finalización debe ser posterior a la hora de inicio.';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      const datos = {
        diaSemana,
        horaInicio,
        horaFin,
      };

      const boton = document.getElementById('guardarDisponibilidadAula');

      if (boton) {
        boton.disabled = true;
      }

      try {
        const resultado = editando
          ? await actualizarDisponibilidadAula(
              aulaDetalleActual.id,
              bloque.id,
              datos,
            )
          : await crearDisponibilidadAula(aulaDetalleActual.id, {
              periodoId: periodoDisponibilidadActual.id,
              ...datos,
            });

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || 'No fue posible guardar el bloque.',
          );
        }

        dialog.close();

        mostrarExito({
          titulo: editando ? 'Bloque actualizado' : 'Bloque agregado',
          mensaje:
            'La disponibilidad base del aula fue actualizada correctamente.',
        });

        await cargarDisponibilidadBaseAula(
          periodoDisponibilidadActual.id,
          contexto,
        );
      } catch (error) {
        mostrarError({
          titulo: 'No se pudo guardar el bloque',
          mensaje:
            error?.message || 'No fue posible actualizar la disponibilidad.',
        });
      } finally {
        if (boton) {
          boton.disabled = false;
        }
      }
    });

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}

export async function confirmarEliminarBloqueAula(bloque, contexto) {
  if (!validarGestionAulas()) {
    return;
  }

  const { aulaDetalleActual, periodoDisponibilidadActual } = contexto.estado;

  const confirmado = await confirmarAccion({
    titulo: 'Eliminar bloque',
    mensaje: `Se eliminará la disponibilidad del ${
      DIAS_SEMANA_AULA[bloque.diaSemana]
    } de ${horaCorta(bloque.horaInicio)} a ${horaCorta(bloque.horaFin)}.`,
    textoConfirmar: 'Eliminar',
    peligro: true,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await eliminarDisponibilidadAula(
      aulaDetalleActual.id,
      bloque.id,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible eliminar el bloque.',
      );
    }

    mostrarExito({
      titulo: 'Bloque eliminado',
      mensaje: 'La disponibilidad fue eliminada correctamente.',
    });

    await cargarDisponibilidadBaseAula(
      periodoDisponibilidadActual.id,
      contexto,
    );
  } catch (error) {
    mostrarError({
      titulo: 'No se pudo eliminar',
      mensaje: error?.message || 'No fue posible eliminar el bloque.',
    });
  }
}
