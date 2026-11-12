/**
 * SGPA — Renderizado y gestión de indisponibilidades del aula.
 */

import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  actualizarIndisponibilidadAula,
  cambiarEstadoIndisponibilidadAula,
  crearIndisponibilidadAula,
} from '../../services/aulas.service.js';
import {
  TIPOS_INDISPONIBILIDAD,
  fechaParaInput,
  formatearFechaHora,
  nombreTipoIndisponibilidad,
  normalizarFechaHoraInput,
} from './aulas.helpers.js';
import {
  inicializarControlesHorario,
  renderizarControlFechaHoraCompacto,
} from './aulas.horarios.js';
import { puedeGestionarAulas, validarGestionAulas } from './aulas.context.js';

export function renderizarIndisponibilidades(indisponibilidades = []) {
  if (!indisponibilidades.length) {
    return `
      <p class="aulas-muted">
        Esta aula no tiene
        indisponibilidades registradas.
      </p>
    `;
  }

  return `
    <div class="aulas-unavailability-list">
      ${indisponibilidades
        .map(
          (item) => `
            <article class="aulas-unavailability-item">
              <div class="aulas-equipment-main">
                <div>
                  <strong>
                    ${escapeHtml(nombreTipoIndisponibilidad(item.tipo))}
                  </strong>

                  <span>
                    ${escapeHtml(item.motivo)}
                  </span>
                </div>

                <span
                  class="aulas-status ${
                    item.activo ? 'is-active' : 'is-inactive'
                  }"
                >
                  ${item.activo ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              <div class="aulas-unavailability-dates">
                <div>
                  <span>Desde</span>
                  <strong>
                    ${escapeHtml(formatearFechaHora(item.fechaHoraInicio))}
                  </strong>
                </div>

                <i
                  data-lucide="arrow-right"
                  aria-hidden="true"
                ></i>

                <div>
                  <span>Hasta</span>
                  <strong>
                    ${escapeHtml(formatearFechaHora(item.fechaHoraFin))}
                  </strong>
                </div>
              </div>

              ${
                puedeGestionarAulas()
                  ? `
                    <div class="aulas-actions">
                      <button
                        type="button"
                        class="aulas-secondary-button"
                        data-indisponibilidad-action="editar"
                        data-indisponibilidad-id="${item.id}"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        class="aulas-secondary-button ${
                          item.activo ? 'is-danger' : 'is-success'
                        }"
                        data-indisponibilidad-action="estado"
                        data-indisponibilidad-id="${item.id}"
                      >
                        ${item.activo ? 'Inactivar' : 'Reactivar'}
                      </button>
                    </div>
                  `
                  : ''
              }
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

export function abrirFormularioIndisponibilidad(
  indisponibilidad = null,
  contexto,
  { onActualizado = null } = {},
) {
  if (!validarGestionAulas()) {
    return;
  }

  const { aulaDetalleActual } = contexto.estado;

  if (!aulaDetalleActual) {
    return;
  }

  const dialog = document.getElementById('aulaDialog');
  const content = document.getElementById('aulaDialogContent');

  if (!dialog || !content) {
    return;
  }

  const editando = Boolean(indisponibilidad);

  content.innerHTML = FormDialog({
    formId: 'indisponibilidadAulaForm',
    title: editando ? 'Editar indisponibilidad' : 'Nueva indisponibilidad',
    description: editando
      ? 'Actualice el periodo en que el aula no estará disponible.'
      : 'Registre un periodo durante el cual el aula no podrá utilizarse.',
    body: `
      <label>
        <span>Tipo</span>

        <select
          id="indisponibilidadTipo"
          required
        >
          ${Object.entries(TIPOS_INDISPONIBILIDAD)
            .map(
              ([valor, nombre]) => `
                <option
                  value="${valor}"
                  ${
                    (indisponibilidad?.tipo || 'MANTENIMIENTO') === valor
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
        <span>Inicio</span>

        ${renderizarControlFechaHoraCompacto(
          'indisponibilidadInicio',
          fechaParaInput(indisponibilidad?.fechaHoraInicio),
        )}
      </label>

      <label>
        <span>Finalización</span>

        ${renderizarControlFechaHoraCompacto(
          'indisponibilidadFin',
          fechaParaInput(indisponibilidad?.fechaHoraFin),
        )}
      </label>

      <label class="sgpa-form-wide">
        <span>Motivo</span>

        <textarea
          id="indisponibilidadMotivo"
          rows="4"
          maxlength="500"
          required
          placeholder="Indique por qué el aula no estará disponible"
        >${escapeHtml(indisponibilidad?.motivo || '')}</textarea>
      </label>
    `,
    errorId: 'indisponibilidadAulaError',
    cancelButtonId: 'cancelarIndisponibilidad',
    submitButtonId: 'guardarIndisponibilidad',
    submitText: editando ? 'Guardar cambios' : 'Registrar indisponibilidad',
  });

  inicializarControlesHorario(content);
  dialog.showModal();
  habilitarCierreExterior(dialog);

  document
    .getElementById('cancelarIndisponibilidad')
    ?.addEventListener('click', () => dialog.close());

  document
    .getElementById('indisponibilidadAulaForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const inicio = document.getElementById('indisponibilidadInicio')?.value;
      const fin = document.getElementById('indisponibilidadFin')?.value;
      const motivo = document
        .getElementById('indisponibilidadMotivo')
        ?.value?.trim();
      const errorBox = document.getElementById('indisponibilidadAulaError');

      if (!inicio || !fin || fin <= inicio) {
        if (errorBox) {
          errorBox.textContent =
            'La fecha y hora de finalización debe ser posterior al inicio.';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      if (!motivo) {
        if (errorBox) {
          errorBox.textContent =
            'Debe indicar el motivo de la indisponibilidad.';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      const datos = {
        tipo: document.getElementById('indisponibilidadTipo')?.value,
        fechaHoraInicio: normalizarFechaHoraInput(inicio),
        fechaHoraFin: normalizarFechaHoraInput(fin),
        motivo,
      };

      const boton = document.getElementById('guardarIndisponibilidad');

      if (boton) {
        boton.disabled = true;
      }

      try {
        const resultado = editando
          ? await actualizarIndisponibilidadAula(
              aulaDetalleActual.id,
              indisponibilidad.id,
              datos,
            )
          : await crearIndisponibilidadAula(aulaDetalleActual.id, datos);

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message ||
              'No fue posible guardar la indisponibilidad.',
          );
        }

        dialog.close();

        mostrarExito({
          titulo: editando
            ? 'Indisponibilidad actualizada'
            : 'Indisponibilidad registrada',
          mensaje: editando
            ? 'La indisponibilidad fue actualizada correctamente.'
            : 'El aula quedó bloqueada durante el periodo indicado.',
        });

        if (typeof onActualizado === 'function') {
          await onActualizado(aulaDetalleActual.id);
        }
      } catch (error) {
        mostrarError({
          titulo: 'No se pudo guardar',
          mensaje:
            error?.message || 'No fue posible guardar la indisponibilidad.',
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

export async function cambiarEstadoIndisponibilidad(
  indisponibilidad,
  contexto,
  { onActualizado = null } = {},
) {
  if (!validarGestionAulas()) {
    return;
  }

  const { aulaDetalleActual } = contexto.estado;

  if (!aulaDetalleActual) {
    return;
  }

  const activo = !indisponibilidad.activo;

  const confirmado = await confirmarAccion({
    titulo: activo
      ? 'Reactivar indisponibilidad'
      : 'Inactivar indisponibilidad',
    mensaje: activo
      ? 'El aula volverá a considerarse no disponible durante este periodo.'
      : 'Esta restricción dejará de bloquear el uso del aula.',
    textoConfirmar: activo ? 'Reactivar' : 'Inactivar',
    peligro: !activo,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await cambiarEstadoIndisponibilidadAula(
      aulaDetalleActual.id,
      indisponibilidad.id,
      activo,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible cambiar el estado.',
      );
    }

    mostrarExito({
      titulo: activo
        ? 'Indisponibilidad reactivada'
        : 'Indisponibilidad inactivada',
      mensaje: 'El estado fue actualizado correctamente.',
    });

    if (typeof onActualizado === 'function') {
      await onActualizado(aulaDetalleActual.id);
    }
  } catch (error) {
    mostrarError({
      titulo: 'No se pudo cambiar el estado',
      mensaje:
        error?.message || 'No fue posible actualizar la indisponibilidad.',
    });
  }
}
