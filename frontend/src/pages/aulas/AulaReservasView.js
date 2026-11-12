/**
 * SGPA — Operaciones y presentación de reservas extraordinarias del aula.
 */

import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  actualizarReservaAula,
  cambiarEstadoReservaAula,
  crearReservaAula,
} from '../../services/aulas.service.js';
import {
  TIPOS_RESERVA,
  fechaParaInput,
  formatearFechaHora,
  nombreTipoReserva,
  normalizarFechaHoraInput,
} from './aulas.helpers.js';
import {
  inicializarControlesHorario,
  renderizarControlFechaHoraCompacto,
} from './aulas.horarios.js';
import { puedeGestionarAulas, validarGestionAulas } from './aulas.context.js';

export function renderizarReservasAula(reservas = []) {
  if (!reservas.length) {
    return `
      <p class="aulas-muted">
        Esta aula no tiene reservas
        extraordinarias registradas.
      </p>
    `;
  }

  return `
    <div class="aulas-reservation-list">
      ${reservas
        .map(
          (reserva) => `
            <article class="aulas-reservation-item">
              <div class="aulas-equipment-main">
                <div>
                  <strong>
                    ${escapeHtml(reserva.titulo)}
                  </strong>

                  <span>
                    ${escapeHtml(nombreTipoReserva(reserva.tipo))}
                  </span>
                </div>

                <span
                  class="aulas-status ${
                    reserva.activo ? 'is-active' : 'is-inactive'
                  }"
                >
                  ${reserva.activo ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              <div class="aulas-reservation-dates">
                <div>
                  <span>Desde</span>
                  <strong>
                    ${escapeHtml(formatearFechaHora(reserva.fechaHoraInicio))}
                  </strong>
                </div>

                <i
                  data-lucide="arrow-right"
                  aria-hidden="true"
                ></i>

                <div>
                  <span>Hasta</span>
                  <strong>
                    ${escapeHtml(formatearFechaHora(reserva.fechaHoraFin))}
                  </strong>
                </div>
              </div>

              ${
                reserva.descripcion
                  ? `
                    <p class="aulas-equipment-note">
                      ${escapeHtml(reserva.descripcion)}
                    </p>
                  `
                  : ''
              }

              ${
                puedeGestionarAulas()
                  ? `
                    <div class="aulas-actions">
                      <button
                        type="button"
                        class="aulas-secondary-button"
                        data-reserva-action="editar"
                        data-reserva-id="${reserva.id}"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        class="aulas-secondary-button ${
                          reserva.activo ? 'is-danger' : 'is-success'
                        }"
                        data-reserva-action="estado"
                        data-reserva-id="${reserva.id}"
                      >
                        ${reserva.activo ? 'Inactivar' : 'Reactivar'}
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

export function abrirFormularioReserva(
  reserva = null,
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

  const editando = Boolean(reserva);

  content.innerHTML = FormDialog({
    formId: 'reservaAulaForm',
    title: editando ? 'Editar reserva' : 'Nueva reserva extraordinaria',
    description: 'Registre una ocupación temporal del aula.',
    body: `
      <label>
        <span>Tipo</span>

        <select
          id="reservaTipo"
          required
        >
          ${Object.entries(TIPOS_RESERVA)
            .map(
              ([valor, nombre]) => `
                <option
                  value="${valor}"
                  ${(reserva?.tipo || 'EXAMEN') === valor ? 'selected' : ''}
                >
                  ${nombre}
                </option>
              `,
            )
            .join('')}
        </select>
      </label>

      <label class="sgpa-form-wide">
        <span>Título</span>

        <input
          id="reservaTitulo"
          type="text"
          maxlength="150"
          value="${escapeHtml(reserva?.titulo || '')}"
          required
        >
      </label>

      <label>
        <span>Inicio</span>

        ${renderizarControlFechaHoraCompacto(
          'reservaInicio',
          fechaParaInput(reserva?.fechaHoraInicio),
        )}
      </label>

      <label>
        <span>Finalización</span>

        ${renderizarControlFechaHoraCompacto(
          'reservaFin',
          fechaParaInput(reserva?.fechaHoraFin),
        )}
      </label>

      <label class="sgpa-form-wide">
        <span>Descripción</span>

        <textarea
          id="reservaDescripcion"
          rows="4"
          maxlength="500"
          placeholder="Descripción opcional"
        >${escapeHtml(reserva?.descripcion || '')}</textarea>
      </label>
    `,
    errorId: 'reservaAulaError',
    cancelButtonId: 'cancelarReservaAula',
    submitButtonId: 'guardarReservaAula',
    submitText: editando ? 'Guardar cambios' : 'Crear reserva',
  });

  inicializarControlesHorario(content);
  dialog.showModal();
  habilitarCierreExterior(dialog);

  document
    .getElementById('cancelarReservaAula')
    ?.addEventListener('click', () => dialog.close());

  document
    .getElementById('reservaAulaForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const inicio = document.getElementById('reservaInicio')?.value;
      const fin = document.getElementById('reservaFin')?.value;
      const titulo = document.getElementById('reservaTitulo')?.value?.trim();
      const errorBox = document.getElementById('reservaAulaError');

      if (!titulo) {
        if (errorBox) {
          errorBox.textContent = 'El título es obligatorio.';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      if (!inicio || !fin || fin <= inicio) {
        if (errorBox) {
          errorBox.textContent = 'La finalización debe ser posterior al inicio.';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      const datos = {
        tipo: document.getElementById('reservaTipo')?.value,
        titulo,
        descripcion:
          document.getElementById('reservaDescripcion')?.value?.trim() || '',
        fechaHoraInicio: normalizarFechaHoraInput(inicio),
        fechaHoraFin: normalizarFechaHoraInput(fin),
      };

      const boton = document.getElementById('guardarReservaAula');

      if (boton) {
        boton.disabled = true;
      }

      try {
        const resultado = editando
          ? await actualizarReservaAula(aulaDetalleActual.id, reserva.id, datos)
          : await crearReservaAula(aulaDetalleActual.id, datos);

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || 'No fue posible guardar la reserva.',
          );
        }

        dialog.close();

        mostrarExito({
          titulo: editando ? 'Reserva actualizada' : 'Reserva creada',
          mensaje: editando
            ? 'La reserva fue actualizada correctamente.'
            : 'El aula quedó reservada en el horario indicado.',
        });

        if (typeof onActualizado === 'function') {
          await onActualizado(aulaDetalleActual.id);
        }
      } catch (error) {
        mostrarError({
          titulo: 'No se pudo guardar la reserva',
          mensaje: error?.message || 'No fue posible registrar la reserva.',
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

export async function cambiarEstadoReserva(
  reserva,
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

  const activo = !reserva.activo;

  const confirmado = await confirmarAccion({
    titulo: activo ? 'Reactivar reserva' : 'Inactivar reserva',
    mensaje: activo
      ? `¿Desea reactivar "${reserva.titulo}"?`
      : `¿Desea inactivar "${reserva.titulo}"?`,
    textoConfirmar: activo ? 'Reactivar' : 'Inactivar',
    peligro: !activo,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await cambiarEstadoReservaAula(
      aulaDetalleActual.id,
      reserva.id,
      activo,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible cambiar el estado.',
      );
    }

    mostrarExito({
      titulo: activo ? 'Reserva reactivada' : 'Reserva inactivada',
      mensaje: 'El estado fue actualizado correctamente.',
    });

    if (typeof onActualizado === 'function') {
      await onActualizado(aulaDetalleActual.id);
    }
  } catch (error) {
    mostrarError({
      titulo: 'No se pudo cambiar el estado',
      mensaje: error?.message || 'No fue posible actualizar la reserva.',
    });
  }
}
