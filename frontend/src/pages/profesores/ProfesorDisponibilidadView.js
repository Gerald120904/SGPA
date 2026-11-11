/**
 * SGPA — Módulo de gestión y edición de disponibilidad docente.
 * FRONTEND-REF-DEEP-002
 */

import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  consultarMiDisponibilidadProfesor,
  guardarMiDisponibilidadProfesor,
  copiarMiDisponibilidadProfesor,
  obtenerHistorialMiDisponibilidadProfesor,
} from '../../services/profesores.service.js';
import {
  NOMBRES_DIA,
  nombreEstadoDisponibilidad,
  seleccionarPeriodoInicial,
  obtenerPeriodoAnteriorDisponibilidad,
  validarBloquesDisponibilidad,
} from './profesores.helpers.js';

let periodosMiDisponibilidad = [];
let miDisponibilidadActual = null;

export function setPeriodosDisponibilidad(periodos = []) {
  periodosMiDisponibilidad = Array.isArray(periodos) ? periodos : [];
}

export function getDisponibilidadActual() {
  return miDisponibilidadActual;
}

export function setDisponibilidadActual(disponibilidad) {
  miDisponibilidadActual = disponibilidad;
}

export function configurarMiDisponibilidad(periodos = null) {
  if (periodos) {
    setPeriodosDisponibilidad(periodos);
  }

  const selector = document.getElementById('miDisponibilidadPeriodo');
  if (!selector || !periodosMiDisponibilidad.length) {
    return;
  }

  const inicial = seleccionarPeriodoInicial(periodosMiDisponibilidad);
  if (!inicial) {
    return;
  }

  selector.value = String(inicial.id);

  selector.addEventListener('change', async () => {
    const periodoId = Number(selector.value);
    if (periodoId) {
      await cargarMiDisponibilidad(periodoId);
    }
  });

  cargarMiDisponibilidad(inicial.id);
}

export async function cargarMiDisponibilidad(periodoId) {
  const contenido = document.getElementById('miDisponibilidadContent');
  if (!contenido) {
    return;
  }

  contenido.innerHTML = `
    <div class="profesores-loading-inline">
      Consultando disponibilidad...
    </div>
  `;

  try {
    const resultado = await consultarMiDisponibilidadProfesor(periodoId);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar su disponibilidad.',
      );
    }

    miDisponibilidadActual = resultado.data;
    renderizarMiDisponibilidad();
  } catch (error) {
    contenido.innerHTML = `
      <div class="profesores-loading-inline profesores-error">
        ${escapeHtml(
          error?.message ||
            'No fue posible consultar la disponibilidad.',
        )}
      </div>
    `;
  }
}

export function renderizarMiDisponibilidad() {
  const contenido = document.getElementById('miDisponibilidadContent');
  if (!contenido || !miDisponibilidadActual) {
    return;
  }

  const disponibilidad = miDisponibilidadActual;
  const bloques = Array.isArray(disponibilidad.bloques)
    ? disponibilidad.bloques
    : [];

  contenido.innerHTML = `
    <div class="profesores-disponibilidad-summary">
      <div>
        <span>Estado</span>
        <strong
          class="profesores-disponibilidad-status profesores-disponibilidad-${String(
            disponibilidad.estado,
          ).toLowerCase()}"
        >
          ${escapeHtml(
            nombreEstadoDisponibilidad(disponibilidad.estado),
          )}
        </strong>
      </div>

      <div>
        <span>Fecha límite</span>
        <strong>
          ${escapeHtml(
            disponibilidad.periodo?.fechaLimiteDisponibilidad || '—',
          )}
        </strong>
      </div>

      <div>
        <span>Bloques</span>
        <strong>${bloques.length}</strong>
      </div>
    </div>

    ${
      bloques.length
        ? `
          <div class="profesores-schedule-list">
            ${bloques
              .map(
                (bloque) => `
                  <div class="profesores-schedule-row">
                    <strong class="profesores-schedule-day">
                      ${escapeHtml(
                        NOMBRES_DIA[bloque.dia] || bloque.dia,
                      )}
                    </strong>
                    <span class="profesores-schedule-hours">
                      <i data-lucide="clock" aria-hidden="true"></i>
                      ${escapeHtml(bloque.horaInicio)} — ${escapeHtml(bloque.horaFin)}
                    </span>
                  </div>
                `,
              )
              .join('')}
          </div>
        `
        : `
          <div class="profesores-disponibilidad-empty">
            Todavía no hay bloques registrados para este periodo.
          </div>
        `
    }

    ${
      disponibilidad.observaciones
        ? `
          <div class="profesores-disponibilidad-observaciones">
            <span>Observaciones</span>
            <p>${escapeHtml(disponibilidad.observaciones)}</p>
          </div>
        `
        : ''
    }

    <div class="profesores-review-actions">
      ${
        disponibilidad.puedeEditar
          ? `
            <button
              id="editarMiDisponibilidadButton"
              type="button"
              class="profesores-action-button is-success"
            >
              ${
                disponibilidad.registrada
                  ? 'Editar disponibilidad'
                  : 'Registrar disponibilidad'
              }
            </button>
          `
          : ''
      }

      ${
        disponibilidad.puedeEditar &&
        !disponibilidad.registrada &&
        obtenerPeriodoAnteriorDisponibilidad(
          disponibilidad.periodo,
          periodosMiDisponibilidad,
        )
          ? `
            <button
              id="copiarDisponibilidadAnteriorButton"
              type="button"
              class="profesores-action-button"
            >
              Copiar periodo anterior
            </button>
          `
          : ''
      }

      ${
        disponibilidad.registrada
          ? `
            <button
              id="verHistorialDisponibilidadButton"
              type="button"
              class="profesores-action-button"
            >
              Ver historial
            </button>
          `
          : ''
      }
    </div>
  `;

  document
    .getElementById('editarMiDisponibilidadButton')
    ?.addEventListener('click', abrirFormularioMiDisponibilidad);

  document
    .getElementById('copiarDisponibilidadAnteriorButton')
    ?.addEventListener('click', copiarDisponibilidadAnterior);

  document
    .getElementById('verHistorialDisponibilidadButton')
    ?.addEventListener('click', abrirHistorialMiDisponibilidad);

  if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    renderizarIconos();
  }
}

export function abrirFormularioMiDisponibilidad() {
  const dialog = document.getElementById('profesorRevisionDialog');
  const content = document.getElementById('profesorRevisionDialogContent');

  if (!dialog || !content || !miDisponibilidadActual) {
    return;
  }

  const bloques = miDisponibilidadActual.bloques || [];

  content.innerHTML = FormDialog({
    formId: 'miDisponibilidadForm',
    title: miDisponibilidadActual.registrada
      ? 'Editar disponibilidad'
      : 'Registrar disponibilidad',
    description: 'Agregue los bloques horarios en que puede impartir cursos.',
    body: `
      <div class="sgpa-form-wide profesores-bloques-editor">
        <div id="miDisponibilidadBloques"></div>
        <button
          id="agregarBloqueDisponibilidad"
          type="button"
          class="profesores-action-button"
        >
          <i data-lucide="plus" aria-hidden="true"></i>
          Agregar bloque
        </button>
      </div>

      <label class="sgpa-form-wide">
        <span>Observaciones</span>
        <textarea
          id="miDisponibilidadObservaciones"
          rows="4"
          maxlength="500"
          placeholder="Observaciones opcionales"
        >${escapeHtml(miDisponibilidadActual.observaciones || '')}</textarea>
      </label>
    `,
    errorId: 'miDisponibilidadFormError',
    cancelButtonId: 'cancelarMiDisponibilidad',
    submitButtonId: 'guardarMiDisponibilidad',
    submitText: 'Guardar disponibilidad',
  });

  dialog.showModal();
  habilitarCierreExterior(dialog);

  bloques.forEach((bloque) => {
    agregarFilaDisponibilidad(bloque);
  });

  document
    .getElementById('agregarBloqueDisponibilidad')
    ?.addEventListener('click', () => {
      agregarFilaDisponibilidad();
    });

  document
    .getElementById('cancelarMiDisponibilidad')
    ?.addEventListener('click', () => dialog.close());

  document
    .getElementById('miDisponibilidadForm')
    ?.addEventListener('submit', guardarFormularioMiDisponibilidad);

  if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    renderizarIconos();
  }
}

export function agregarFilaDisponibilidad(bloque = null) {
  const contenedor = document.getElementById('miDisponibilidadBloques');
  if (!contenedor) {
    return;
  }

  const fila = document.createElement('div');
  fila.className = 'profesores-bloque-editor-row';
  fila.innerHTML = `
    <select data-bloque-dia aria-label="Día" required>
      ${Object.entries(NOMBRES_DIA)
        .map(
          ([valor, nombre]) => `
            <option
              value="${valor}"
              ${bloque?.dia === valor ? 'selected' : ''}
            >
              ${nombre}
            </option>
          `,
        )
        .join('')}
    </select>

    <input
      data-bloque-inicio
      type="time"
      value="${escapeHtml(bloque?.horaInicio || '')}"
      required
    >

    <span>a</span>

    <input
      data-bloque-fin
      type="time"
      value="${escapeHtml(bloque?.horaFin || '')}"
      required
    >

    <button
      type="button"
      class="profesores-icon-button is-danger"
      title="Eliminar bloque"
      aria-label="Eliminar bloque"
    >
      <i data-lucide="trash-2" aria-hidden="true"></i>
    </button>
  `;

  fila.querySelector('button')?.addEventListener('click', () => {
    fila.remove();
  });

  contenedor.appendChild(fila);

  if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    renderizarIconos();
  }
}

export async function guardarFormularioMiDisponibilidad(event) {
  if (event?.preventDefault) {
    event.preventDefault();
  }

  const filas = [...document.querySelectorAll('.profesores-bloque-editor-row')];

  const bloques = filas.map((fila) => ({
    dia: fila.querySelector('[data-bloque-dia]').value,
    horaInicio: fila.querySelector('[data-bloque-inicio]').value,
    horaFin: fila.querySelector('[data-bloque-fin]').value,
  }));

  const error = validarBloquesDisponibilidad(bloques);

  if (error) {
    const errorBox = document.getElementById('miDisponibilidadFormError');
    if (errorBox) {
      errorBox.textContent = error;
      errorBox.classList.remove('hidden');
    }
    return;
  }

  try {
    const resultado = await guardarMiDisponibilidadProfesor({
      periodoAcademicoId:
        miDisponibilidadActual.periodoAcademicoId ||
        miDisponibilidadActual.periodo?.id,
      bloques,
      observaciones:
        document
          .getElementById('miDisponibilidadObservaciones')
          ?.value?.trim() || '',
    });

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible guardar la disponibilidad.',
      );
    }

    document.getElementById('profesorRevisionDialog')?.close();

    mostrarExito({
      titulo: 'Disponibilidad guardada',
      mensaje: 'Su disponibilidad docente fue registrada correctamente.',
    });

    await cargarMiDisponibilidad(
      miDisponibilidadActual.periodoAcademicoId ||
        miDisponibilidadActual.periodo?.id,
    );
  } catch (error) {
    mostrarError({
      titulo: 'No se pudo guardar la disponibilidad',
      mensaje:
        error?.message ||
        'No fue posible guardar la información.',
    });
  }
}

export async function copiarDisponibilidadAnterior() {
  if (!miDisponibilidadActual) {
    return;
  }

  const destino = miDisponibilidadActual.periodo;
  const origen = obtenerPeriodoAnteriorDisponibilidad(
    destino,
    periodosMiDisponibilidad,
  );

  if (!origen) {
    return;
  }

  const confirmado = await confirmarAccion({
    titulo: 'Copiar disponibilidad',
    mensaje: `Se copiarán los bloques de ${origen.codigo} hacia ${destino.codigo}.`,
    textoConfirmar: 'Copiar',
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await copiarMiDisponibilidadProfesor({
      periodoOrigenId: origen.id,
      periodoDestinoId: destino.id,
    });

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible copiar la disponibilidad.',
      );
    }

    mostrarExito({
      titulo: 'Disponibilidad copiada',
      mensaje: 'Los bloques del periodo anterior fueron copiados correctamente.',
    });

    await cargarMiDisponibilidad(destino.id);
  } catch (error) {
    mostrarError({
      titulo: 'No se pudo copiar la disponibilidad',
      mensaje:
        error?.message ||
        'No fue posible copiar los bloques.',
    });
  }
}

export async function abrirHistorialMiDisponibilidad() {
  if (!miDisponibilidadActual) {
    return;
  }

  const dialog = document.getElementById('profesorRevisionDialog');
  const content = document.getElementById('profesorRevisionDialogContent');

  if (!dialog || !content) {
    return;
  }

  content.innerHTML = `
    <div class="sgpa-dialog-header">
      <div>
        <h3>Historial de disponibilidad</h3>
        <p>Registro de cambios en su disponibilidad docente.</p>
      </div>
    </div>
    <div class="profesores-loading-inline">
      Cargando historial...
    </div>
  `;

  dialog.showModal();
  habilitarCierreExterior(dialog);

  try {
    const periodoId =
      miDisponibilidadActual.periodoAcademicoId ||
      miDisponibilidadActual.periodo?.id;

    const resultado = await obtenerHistorialMiDisponibilidadProfesor(periodoId);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar el historial.',
      );
    }

    const historial = Array.isArray(resultado.data) ? resultado.data : [];

    content.innerHTML = `
      <div class="sgpa-dialog-header">
        <div>
          <h3>Historial de disponibilidad</h3>
          <p>${escapeHtml(miDisponibilidadActual.periodo?.codigo || '')} — ${escapeHtml(miDisponibilidadActual.periodo?.nombre || '')}</p>
        </div>
      </div>

      <div class="profesores-historial-list" style="margin-top: 14px;">
        ${
          historial.length
            ? historial
                .map(
                  (item) => `
                    <div class="profesores-historial-item">
                      <div class="profesores-historial-header">
                        <strong>${escapeHtml(item.accion || 'Modificación')}</strong>
                        <span>${escapeHtml(item.createdAt ? new Date(item.createdAt).toLocaleString() : '—')}</span>
                      </div>
                      ${
                        item.observaciones || item.observacion
                          ? `<p>${escapeHtml(item.observaciones || item.observacion)}</p>`
                          : ''
                      }
                    </div>
                  `,
                )
                .join('')
            : `
              <p class="profesores-muted" style="text-align: center; padding: 20px 0;">
                No hay registros en el historial para este periodo.
              </p>
            `
        }
      </div>

      <div style="margin-top: 18px; display: flex; justify-content: flex-end;">
        <button id="cerrarHistorialDisponibilidad" type="button" class="profesores-action-button">
          Cerrar
        </button>
      </div>
    `;

    document
      .getElementById('cerrarHistorialDisponibilidad')
      ?.addEventListener('click', () => dialog.close());

    if (typeof document !== 'undefined') {
      renderizarIconos();
    }
  } catch (error) {
    content.innerHTML = `
      <div class="sgpa-dialog-header">
        <div>
          <h3>Error</h3>
          <p>No fue posible cargar el historial.</p>
        </div>
      </div>
      <div class="profesores-message profesores-error">
        ${escapeHtml(error?.message || 'Error al consultar el historial.')}
      </div>
      <div style="margin-top: 18px; display: flex; justify-content: flex-end;">
        <button id="cerrarHistorialDisponibilidad" type="button" class="profesores-action-button">
          Cerrar
        </button>
      </div>
    `;

    document
      .getElementById('cerrarHistorialDisponibilidad')
      ?.addEventListener('click', () => dialog.close());

    if (typeof document !== 'undefined') {
      renderizarIconos();
    }
  }
}
