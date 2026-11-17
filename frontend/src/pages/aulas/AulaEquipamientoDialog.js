/**
 * SGPA — Módulo de gestión y asignación de equipamiento para Aulas.
 * FRONTEND-REF-DEEP-002
 */

import { DataTable } from '../../components/DataTable.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarExito, mostrarError } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  listarEquipamientos,
  crearEquipamiento,
  actualizarEquipamiento,
  cambiarEstadoEquipamiento,
  asignarEquipamientoAula,
  actualizarEquipamientoAula,
  desasignarEquipamientoAula,
} from '../../services/aulas.service.js';
import { formatearFechaHora } from './aulas.helpers.js';

export function renderizarEquipamientoDelAula(
  equipamientos = [],
  puedeGestionar = false,
) {
  if (!equipamientos.length) {
    return `
      <p class="aulas-muted">
        Esta aula no tiene equipamiento asignado actualmente.
      </p>
    `;
  }

  return `
    <div class="aulas-equipment-list">
      ${equipamientos
        .map(
          (relacion) => `
            <article class="aulas-equipment-item">
              <div class="aulas-equipment-main">
                <div>
                  <strong>
                    ${escapeHtml(relacion.equipamiento?.nombre || 'Equipamiento')}
                  </strong>
                  <span>
                    ${
                      relacion.equipamiento?.descripcion
                        ? escapeHtml(relacion.equipamiento.descripcion)
                        : 'Sin descripción'
                    }
                  </span>
                </div>

                <span class="aulas-status is-active">Asignado</span>
              </div>

              <div class="aulas-equipment-counts">
                <div>
                  <span>Cantidad asignada</span>
                  <strong>${Number(relacion.cantidadAsignada || 0)}</strong>
                </div>

                <div>
                  <span>Asignado desde</span>
                  <strong>${formatearFechaHora(relacion.asignadoEn)}</strong>
                </div>
              </div>

              ${
                relacion.observaciones
                  ? `<p class="aulas-equipment-note">${escapeHtml(
                      relacion.observaciones,
                    )}</p>`
                  : ''
              }

              ${
                puedeGestionar
                  ? `
                    <div class="aulas-actions" style="margin-top: 12px;">
                      <button
                        type="button"
                        class="aulas-secondary-button"
                        data-aula-equipo-action="editar"
                        data-equipamiento-id="${relacion.equipamientoId}"
                      >
                        Editar asignación
                      </button>

                      <button
                        type="button"
                        class="aulas-secondary-button is-danger"
                        data-aula-equipo-action="desasignar"
                        data-equipamiento-id="${relacion.equipamientoId}"
                      >
                        Quitar del aula
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

export function abrirFormularioEquipamientoAula({
  aula,
  relacion = null,
  equipamientoAulaActual = [],
  catalogoEquipamientos = [],
  onActualizado = null,
  puedeGestionar = true,
} = {}) {
  if (!puedeGestionar || !aula) return;

  const dialog = document.getElementById('aulaDialog');
  const content = document.getElementById('aulaDialogContent');
  if (!dialog || !content) return;

  const editando = Boolean(relacion);
  const idsAsignados = new Set(
    equipamientoAulaActual
      .filter((item) => item.activo !== false)
      .map((item) => item.equipamientoId),
  );

  const disponibles = catalogoEquipamientos.filter(
    (equipo) =>
      equipo.activo &&
      Number(equipo.cantidadDisponible || 0) > 0 &&
      !idsAsignados.has(equipo.id),
  );

  if (!editando && !disponibles.length) {
    mostrarError({
      titulo: 'Sin equipamiento disponible',
      mensaje:
        'No existen equipos con unidades disponibles pendientes de asignar a esta aula.',
    });
    return;
  }

  const equipoActual = editando
    ? catalogoEquipamientos.find((equipo) => equipo.id === relacion.equipamientoId)
    : null;

  const maximoInicial = editando
    ? Number(equipoActual?.cantidadDisponible || 0) +
      Number(relacion?.cantidadAsignada || 0)
    : 1;

  content.innerHTML = FormDialog({
    formId: 'equipamientoAulaForm',
    title: editando ? 'Editar asignación de equipamiento' : 'Asignar equipamiento',
    description:
      'La cantidad asignada se descuenta automáticamente de las existencias disponibles del catálogo.',
    body: `
      ${
        editando
          ? `
            <div class="sgpa-form-wide aulas-equipment-assignment-title">
              <strong>${escapeHtml(relacion.equipamiento?.nombre || '')}</strong>
              <small>
                Máximo utilizable en esta aula: ${maximoInicial} unidad${
                  maximoInicial === 1 ? '' : 'es'
                }.
              </small>
            </div>
          `
          : `
            <label class="sgpa-form-wide">
              <span>Equipamiento</span>
              <select id="equipoAulaId" required>
                <option value="" selected disabled>Seleccione...</option>
                ${disponibles
                  .map(
                    (equipo) => `
                      <option
                        value="${equipo.id}"
                        data-disponibles="${Number(equipo.cantidadDisponible || 0)}"
                      >
                        ${escapeHtml(equipo.nombre)} · ${Number(
                          equipo.cantidadDisponible || 0,
                        )} disponible${
                          Number(equipo.cantidadDisponible || 0) === 1 ? '' : 's'
                        }
                      </option>
                    `,
                  )
                  .join('')}
              </select>
            </label>
          `
      }

      <label>
        <span>Cantidad asignada</span>
        <input
          id="equipoCantidadAsignada"
          type="number"
          min="1"
          max="${maximoInicial}"
          step="1"
          value="${Number(relacion?.cantidadAsignada || 1)}"
          required
        >
        <small id="equipoCantidadAyuda" class="sgpa-field-help">
          ${
            editando
              ? `Puede asignar hasta ${maximoInicial} unidades considerando la asignación actual.`
              : 'Seleccione un equipamiento para consultar las unidades disponibles.'
          }
        </small>
      </label>

      <label class="sgpa-form-wide">
        <span>Observaciones</span>
        <textarea
          id="equipoAulaObservaciones"
          maxlength="500"
          rows="3"
        >${escapeHtml(relacion?.observaciones || '')}</textarea>
      </label>
    `,
    errorId: 'equipamientoAulaError',
    cancelButtonId: 'cancelarEquipamientoAula',
    submitButtonId: 'guardarEquipamientoAula',
    submitText: editando ? 'Guardar cambios' : 'Asignar',
  });

  dialog.showModal();
  habilitarCierreExterior(dialog);

  const selectEquipo = document.getElementById('equipoAulaId');
  const cantidadInput = document.getElementById('equipoCantidadAsignada');
  const ayuda = document.getElementById('equipoCantidadAyuda');

  selectEquipo?.addEventListener('change', () => {
    const opcion = selectEquipo.selectedOptions?.[0];
    const disponiblesEquipo = Number(opcion?.dataset?.disponibles || 0);

    if (cantidadInput) {
      cantidadInput.max = String(disponiblesEquipo);
      cantidadInput.value = disponiblesEquipo > 0 ? '1' : '0';
    }

    if (ayuda) {
      ayuda.textContent = `Disponibles actualmente: ${disponiblesEquipo} unidad${
        disponiblesEquipo === 1 ? '' : 'es'
      }.`;
    }
  });

  document
    .getElementById('cancelarEquipamientoAula')
    ?.addEventListener('click', () => dialog.close());

  document
    .getElementById('equipamientoAulaForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const cantidadAsignada = Number(cantidadInput?.value);
      const maximo = Number(cantidadInput?.max || 0);

      if (
        !Number.isInteger(cantidadAsignada) ||
        cantidadAsignada < 1 ||
        cantidadAsignada > maximo
      ) {
        mostrarError({
          titulo: 'Cantidad inválida',
          mensaje: `La cantidad asignada debe estar entre 1 y ${maximo}.`,
        });
        return;
      }

      const datos = {
        cantidadAsignada,
        observaciones:
          document.getElementById('equipoAulaObservaciones')?.value?.trim() || '',
      };

      try {
        const resultado = editando
          ? await actualizarEquipamientoAula(
              aula.id,
              relacion.equipamientoId,
              datos,
            )
          : await asignarEquipamientoAula(aula.id, {
              equipamientoId: Number(selectEquipo?.value),
              ...datos,
            });

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || 'No fue posible guardar el equipamiento.',
          );
        }

        dialog.close();

        mostrarExito({
          titulo: editando ? 'Asignación actualizada' : 'Equipamiento asignado',
          mensaje:
            'Las existencias institucionales se actualizaron automáticamente.',
        });

        if (typeof onActualizado === 'function') {
          await onActualizado();
        }
      } catch (error) {
        mostrarError({
          titulo: 'No se pudo guardar',
          mensaje: error?.message || 'No fue posible actualizar el equipamiento.',
        });
      }
    });

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}

export async function desasignarEquipamientoDelAula({
  aula,
  relacion,
  onActualizado = null,
  puedeGestionar = true,
} = {}) {
  if (!puedeGestionar || !aula || !relacion) return;

  const nombre = relacion.equipamiento?.nombre || 'este equipamiento';
  const cantidad = Number(relacion.cantidadAsignada || 0);

  const confirmado = await confirmarAccion({
    titulo: 'Quitar equipamiento del aula',
    mensaje:
      `¿Desea retirar "${nombre}" de esta aula? ` +
      `Las ${cantidad} unidad${cantidad === 1 ? '' : 'es'} asignada${
        cantidad === 1 ? '' : 's'
      } volverán al inventario disponible.`,
    textoConfirmar: 'Quitar del aula',
    peligro: true,
  });

  if (!confirmado) return;

  try {
    const resultado = await desasignarEquipamientoAula(
      aula.id,
      relacion.equipamientoId,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible retirar el equipamiento.',
      );
    }

    mostrarExito({
      titulo: 'Equipamiento retirado',
      mensaje:
        'La asignación fue cerrada y las unidades volvieron a estar disponibles.',
    });

    if (typeof onActualizado === 'function') {
      await onActualizado();
    }
  } catch (error) {
    mostrarError({
      titulo: 'No se pudo retirar',
      mensaje: error?.message || 'No fue posible retirar el equipamiento.',
    });
  }
}
