/**
 * SGPA — Vista y administración del catálogo institucional de equipamiento de Aulas.
 */

import { DataTable } from '../../components/DataTable.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  actualizarEquipamiento,
  cambiarEstadoEquipamiento,
  crearEquipamiento,
  listarEquipamientos,
} from '../../services/aulas.service.js';
import {
  puedeGestionarAulas,
  validarGestionAulas,
} from './aulas.context.js';

export async function abrirCatalogoEquipamientos(contexto, { onVolver = null } = {}) {
  const vista = document.getElementById('aulasVista');

  if (!vista) {
    return;
  }

  const { instancia, subvistaToken } = contexto.iniciarSubvista();

  vista.innerHTML = `
    <div class="aulas-message">
      Cargando equipamientos...
    </div>
  `;

  try {
    const resultado = await listarEquipamientos();

    if (!contexto.esSubvistaVigente(instancia, subvistaToken)) {
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible consultar el catálogo.',
      );
    }

    contexto.estado.catalogoEquipamientos = Array.isArray(
      resultado.equipamientos,
    )
      ? resultado.equipamientos
      : [];

    renderizarCatalogoEquipamientos(contexto, { onVolver });
  } catch (error) {
    if (!contexto.esSubvistaVigente(instancia, subvistaToken)) {
      return;
    }

    mostrarError({
      titulo: 'No se pudo cargar el catálogo',
      mensaje:
        error?.message || 'No fue posible consultar los equipamientos.',
    });

    if (typeof onVolver === 'function') {
      onVolver();
    }
  }
}

export function renderizarCatalogoEquipamientos(
  contexto,
  { onVolver = null } = {},
) {
  const vista = document.getElementById('aulasVista');

  if (!vista) {
    return;
  }

  contexto.limpiarVista();

  const puedeGestionar = puedeGestionarAulas();

  const filas = contexto.estado.catalogoEquipamientos
    .map(
      (equipo) => `
        <tr>
          <td>
            <strong>${escapeHtml(equipo.nombre)}</strong>
          </td>

          <td>
            ${escapeHtml(equipo.descripcion || 'Sin descripción')}
          </td>

          <td>
            <strong>${Number(equipo.cantidadTotal || 0)}</strong>
          </td>

          <td>
            ${Number(equipo.cantidadAsignada || 0)}
          </td>

          <td>
            <strong>${Number(equipo.cantidadDisponible || 0)}</strong>
          </td>

          <td>
            <span
              class="aulas-status ${equipo.activo ? 'is-active' : 'is-inactive'}"
            >
              ${equipo.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>

          <td>
            ${
              puedeGestionar
                ? `
                  <div class="aulas-actions">
                    <button
                      type="button"
                      class="aulas-icon-button"
                      data-equipamiento-action="editar"
                      data-equipamiento-id="${equipo.id}"
                      title="Editar"
                    >
                      <i data-lucide="pencil"></i>
                    </button>

                    <button
                      type="button"
                      class="aulas-icon-button ${
                        equipo.activo ? 'is-danger' : 'is-success'
                      }"
                      data-equipamiento-action="estado"
                      data-equipamiento-id="${equipo.id}"
                      title="${equipo.activo ? 'Inactivar' : 'Activar'}"
                    >
                      <i
                        data-lucide="${
                          equipo.activo ? 'circle-pause' : 'circle-check'
                        }"
                      ></i>
                    </button>
                  </div>
                `
                : '—'
            }
          </td>
        </tr>
      `,
    )
    .join('');

  vista.innerHTML = `
    <div class="aulas-detail-header">
      <button
        id="volverCatalogoAulas"
        class="aulas-back-button"
        type="button"
      >
        <i data-lucide="arrow-left"></i>
        Volver
      </button>

      <div>
        <h2>Catálogo de equipamiento</h2>
        <p>
          Controle las existencias institucionales y consulte cuántas unidades
          están asignadas o disponibles.
        </p>
      </div>

      ${
        puedeGestionar
          ? `
            <button
              id="nuevoEquipamientoButton"
              class="aulas-primary-button"
              type="button"
            >
              <i data-lucide="plus"></i>
              Nuevo equipamiento
            </button>
          `
          : ''
      }
    </div>

    ${DataTable({
      columns: [
        'Equipamiento',
        'Descripción',
        'Total institucional',
        'Asignados',
        'Disponibles',
        'Estado',
        'Acciones',
      ],
      rows: filas,
      emptyMessage: 'No existen equipamientos registrados.',
      ariaLabel: 'Catálogo de equipamientos',
    })}
  `;

  document
    .getElementById('volverCatalogoAulas')
    ?.addEventListener('click', () => {
      if (typeof onVolver === 'function') {
        onVolver();
      }
    });

  document
    .getElementById('nuevoEquipamientoButton')
    ?.addEventListener('click', () =>
      abrirFormularioEquipamiento(null, contexto, { onVolver }),
    );

  const onVistaClick = (event) =>
    manejarAccionCatalogoEquipamiento(event, contexto, { onVolver });

  vista.addEventListener('click', onVistaClick);
  contexto.registrarLimpiezaVista(() => {
    vista.removeEventListener('click', onVistaClick);
  });

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}

export function abrirFormularioEquipamiento(
  equipamiento = null,
  contexto,
  { onVolver = null } = {},
) {
  if (!validarGestionAulas()) {
    return;
  }

  const dialog = document.getElementById('aulaDialog');
  const content = document.getElementById('aulaDialogContent');

  if (!dialog || !content) {
    return;
  }

  const editando = Boolean(equipamiento);

  content.innerHTML = FormDialog({
    formId: 'equipamientoForm',
    title: editando ? 'Editar equipamiento' : 'Nuevo equipamiento',
    description:
      'El catálogo define las existencias institucionales. Las aulas únicamente consumen unidades de este inventario.',
    body: `
      <label class="sgpa-form-wide">
        <span>Nombre</span>
        <input
          id="equipamientoNombre"
          type="text"
          maxlength="80"
          value="${escapeHtml(equipamiento?.nombre || '')}"
          required
        >
        <small class="sgpa-field-help">
          Máximo 80 caracteres.
        </small>
      </label>

      <label>
        <span>Cantidad total institucional</span>
        <input
          id="equipamientoCantidadTotal"
          type="text"
          inputmode="numeric"
          maxlength="4"
          pattern="[0-9]{1,4}"
          value="${Number(equipamiento?.cantidadTotal ?? 0)}"
          autocomplete="off"
          required
        >
        <small class="sgpa-field-help">
          Unidades que posee actualmente la Universidad. Máximo 4 dígitos.
        </small>
      </label>

      ${
        editando
          ? `
            <div class="aulas-equipment-stock-summary">
              <span>
                Asignadas actualmente:
                <strong>${Number(equipamiento?.cantidadAsignada || 0)}</strong>
              </span>
              <span>
                Disponibles:
                <strong>${Number(equipamiento?.cantidadDisponible || 0)}</strong>
              </span>
            </div>
          `
          : ''
      }

      <label class="sgpa-form-wide">
        <span>Descripción</span>
        <textarea
          id="equipamientoDescripcion"
          rows="4"
          maxlength="300"
        >${escapeHtml(equipamiento?.descripcion || '')}</textarea>
        <small class="sgpa-field-help">
          Máximo 300 caracteres.
        </small>
      </label>
    `,
    errorId: 'equipamientoFormError',
    cancelButtonId: 'cancelarEquipamiento',
    submitButtonId: 'guardarEquipamiento',
    submitText: editando ? 'Guardar cambios' : 'Crear equipamiento',
  });

  dialog.showModal();
  habilitarCierreExterior(dialog);

  document
    .getElementById('cancelarEquipamiento')
    ?.addEventListener('click', () => dialog.close());

  document
    .getElementById('equipamientoCantidadTotal')
    ?.addEventListener('input', (event) => {
      event.currentTarget.value = String(event.currentTarget.value || '')
        .replace(/\D/g, '')
        .slice(0, 4);
    });

  document
    .getElementById('equipamientoForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const cantidadTotal = Number(
        document.getElementById('equipamientoCantidadTotal')?.value,
      );

      if (
        !Number.isInteger(cantidadTotal) ||
        cantidadTotal < 0 ||
        cantidadTotal > 9999
      ) {
        mostrarError({
          titulo: 'Cantidad inválida',
          mensaje:
            'La cantidad total debe ser un número entero entre 0 y 9999.',
        });
        return;
      }

      if (
        editando &&
        cantidadTotal < Number(equipamiento?.cantidadAsignada || 0)
      ) {
        mostrarError({
          titulo: 'Cantidad insuficiente',
          mensaje:
            `Actualmente hay ${Number(equipamiento?.cantidadAsignada || 0)} unidades asignadas a aulas. ` +
            'Primero debe retirar o reducir esas asignaciones.',
        });
        return;
      }

      const datos = {
        nombre: document.getElementById('equipamientoNombre')?.value?.trim(),
        descripcion:
          document.getElementById('equipamientoDescripcion')?.value?.trim() || '',
        cantidadTotal,
      };

      try {
        const resultado = editando
          ? await actualizarEquipamiento(equipamiento.id, datos)
          : await crearEquipamiento(datos);

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || 'No fue posible guardar el equipamiento.',
          );
        }

        dialog.close();

        mostrarExito({
          titulo: editando ? 'Equipamiento actualizado' : 'Equipamiento creado',
          mensaje: 'La información fue guardada correctamente.',
        });

        await abrirCatalogoEquipamientos(contexto, { onVolver });
      } catch (error) {
        mostrarError({
          titulo: 'No se pudo guardar',
          mensaje: error?.message || 'No fue posible guardar el equipamiento.',
        });
      }
    });

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}

export async function manejarAccionCatalogoEquipamiento(
  event,
  contexto,
  { onVolver = null } = {},
) {
  const boton = event.target.closest('[data-equipamiento-action]');

  if (!boton) {
    return;
  }

  const id = Number(boton.dataset.equipamientoId);

  const equipamiento = contexto.estado.catalogoEquipamientos.find(
    (item) => item.id === id,
  );

  if (!equipamiento) {
    return;
  }

  if (boton.dataset.equipamientoAction === 'editar') {
    abrirFormularioEquipamiento(equipamiento, contexto, { onVolver });
    return;
  }

  if (boton.dataset.equipamientoAction === 'estado') {
    await cambiarEstadoCatalogoEquipamiento(equipamiento, contexto, {
      onVolver,
    });
  }
}

export async function cambiarEstadoCatalogoEquipamiento(
  equipamiento,
  contexto,
  { onVolver = null } = {},
) {
  if (!validarGestionAulas()) {
    return;
  }

  const activo = !equipamiento.activo;

  const confirmado = await confirmarAccion({
    titulo: activo ? 'Activar equipamiento' : 'Inactivar equipamiento',
    mensaje: `¿Desea ${activo ? 'activar' : 'inactivar'} "${equipamiento.nombre}"?`,
    textoConfirmar: activo ? 'Activar' : 'Inactivar',
    peligro: !activo,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await cambiarEstadoEquipamiento(equipamiento.id, activo);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible cambiar el estado.',
      );
    }

    mostrarExito({
      titulo: activo ? 'Equipamiento activado' : 'Equipamiento inactivado',
      mensaje: 'El estado fue actualizado correctamente.',
    });

    await abrirCatalogoEquipamientos(contexto, { onVolver });
  } catch (error) {
    mostrarError({
      titulo: 'No se pudo cambiar el estado',
      mensaje:
        error?.message || 'No fue posible actualizar el equipamiento.',
    });
  }
}
