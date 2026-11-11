/**
 * SGPA — Diálogo modal para creación y edición de Aulas.
 * FRONTEND-REF-DEEP-002
 */

import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarExito, mostrarError } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { crearAula, actualizarAula } from '../../services/aulas.service.js';
import {
  TIPOS_AULA,
  TIPOS_MOBILIARIO,
  ORIGENES_AULA,
  obtenerLimiteOrigen,
  obtenerMaximoNumeroOrigen,
  origenTieneCupo,
  obtenerNumeroAula,
  obtenerNombreEspecialAula,
  nombreOrigen,
  construirNombreAula,
  construirCodigoEspacio,
  nombreVisibleAula,
} from './aulas.helpers.js';

export function buscarEspacioDuplicado(
  numero,
  tipo,
  origen,
  excluirId = null,
  codigoSugerido = '',
  listaAulas = [],
) {
  const codigoBuscado = construirCodigoEspacio(numero, tipo, codigoSugerido);

  return (
    listaAulas.find((aula) => {
      if (excluirId && aula.id === excluirId) {
        return false;
      }
      if (aula.origen !== origen) {
        return false;
      }
      return (
        aula.codigo === codigoBuscado ||
        obtenerNumeroAula(aula) === numero
      );
    }) || null
  );
}

export function abrirFormularioAula({
  aula = null,
  sugerencia = null,
  aulas = [],
  onGuardado = null,
  puedeGestionar = true,
} = {}) {
  if (!puedeGestionar) {
    return;
  }

  const dialog = document.getElementById('aulaDialog');
  const content = document.getElementById('aulaDialogContent');

  if (!dialog || !content) {
    return;
  }

  const editando = Boolean(aula);

  if (!editando && sugerencia?.origen && !origenTieneCupo(sugerencia.origen, aulas)) {
    const limite = obtenerLimiteOrigen(sugerencia.origen);
    mostrarError({
      titulo: 'Límite de espacios alcanzado',
      mensaje: `${nombreOrigen(sugerencia.origen)} ya alcanzó el límite de ${limite} espacios registrados. No es posible registrar otro espacio con ese origen.`,
    });
    return;
  }

  const numeroActual = aula
    ? obtenerNumeroAula(aula) ?? ''
    : sugerencia?.numero || '';

  const nombreEspecialActual = aula
    ? obtenerNombreEspecialAula(aula)
    : sugerencia?.nombreEspecial || '';

  const origenPreferido =
    aula?.origen ||
    sugerencia?.origen ||
    ['UNA', 'UNED', 'OTRO'].find((origen) => origenTieneCupo(origen, aulas)) ||
    'UNA';

  content.innerHTML = FormDialog({
    formId: 'aulaForm',
    title: editando
      ? 'Editar aula'
      : sugerencia
        ? 'Registrar aula desde el plano'
        : 'Nueva aula',
    description: editando
      ? 'Actualice la información del espacio académico.'
      : sugerencia
        ? 'Complete los datos del espacio seleccionado en el croquis institucional.'
        : 'Registre un nuevo espacio académico del campus.',
    body: `
      <label>
        <span>Número del espacio</span>
        <input
          id="aulaNumero"
          type="text"
          inputmode="numeric"
          maxlength="${String(obtenerMaximoNumeroOrigen(origenPreferido)).length}"
          data-max-value="${obtenerMaximoNumeroOrigen(origenPreferido)}"
          value="${escapeHtml(numeroActual)}"
          placeholder="Ej. 17"
          autocomplete="off"
          required
        >
        <small id="aulaNumeroHelp" class="aulas-form-help">
          Para ${nombreOrigen(origenPreferido)}, el número permitido es del 1 al ${obtenerMaximoNumeroOrigen(origenPreferido)}.
        </small>
        <small id="aulaNumeroValidation" class="aulas-field-validation" aria-live="polite"></small>
      </label>

      <label>
        <span>Nombre especial <small>(opcional)</small></span>
        <input
          id="aulaNombreEspecial"
          type="text"
          maxlength="50"
          value="${escapeHtml(nombreEspecialActual)}"
          placeholder="Ej. Auditorio Tempisque"
        >
        <small class="aulas-form-help">
          Úselo solo cuando el espacio tenga una denominación particular. Máximo 50 caracteres.
        </small>
      </label>

      <div id="aulaNombrePreview" class="aulas-name-preview sgpa-form-wide" aria-live="polite"></div>

      <label class="sgpa-form-wide">
        <span>Ubicación</span>
        <input
          id="aulaUbicacion"
          type="text"
          maxlength="150"
          value="${escapeHtml(aula?.ubicacion || sugerencia?.ubicacion || '')}"
          placeholder="Ej. Edificio académico, segundo piso"
        >
        <small class="aulas-form-help">Máximo 150 caracteres.</small>
      </label>

      <label>
        <span>Capacidad</span>
        <input
          id="aulaCapacidad"
          type="text"
          inputmode="numeric"
          maxlength="2"
          data-max-value="70"
          value="${escapeHtml(aula?.capacidad || sugerencia?.capacidad || '')}"
          autocomplete="off"
          required
        >
        <small class="aulas-form-help">Capacidad permitida: de 1 a 70 estudiantes.</small>
        <small id="aulaCapacidadValidation" class="aulas-field-validation" aria-live="polite"></small>
      </label>

      <label>
        <span>Tipo</span>
        <select id="aulaTipo" required>
          ${Object.entries(TIPOS_AULA)
            .map(
              ([valor, nombre]) => `
                <option
                  value="${valor}"
                  ${(aula?.tipo || sugerencia?.tipo || 'AULA') === valor ? 'selected' : ''}
                >
                  ${nombre}
                </option>
              `,
            )
            .join('')}
        </select>
      </label>

      <label>
        <span>Mobiliario</span>
        <select id="aulaMobiliario" required>
          ${Object.entries(TIPOS_MOBILIARIO)
            .map(
              ([valor, nombre]) => `
                <option
                  value="${valor}"
                  ${(aula?.tipoMobiliario || sugerencia?.tipoMobiliario || 'SIN_ESPECIFICAR') === valor ? 'selected' : ''}
                >
                  ${nombre}
                </option>
              `,
            )
            .join('')}
        </select>
      </label>

      <label>
        <span>Origen</span>
        <select id="aulaOrigen" required>
          ${Object.entries(ORIGENES_AULA)
            .map(([valor, nombre]) => {
              const bloqueado = !origenTieneCupo(valor, aulas, aula);
              return `
                <option
                  value="${valor}"
                  ${origenPreferido === valor ? 'selected' : ''}
                  ${bloqueado ? 'disabled' : ''}
                >
                  ${nombre}${bloqueado ? ' · límite alcanzado' : ''}
                </option>
              `;
            })
            .join('')}
        </select>
        <small id="aulaOrigenDisponibilidad" class="aulas-origin-availability" aria-live="polite"></small>
      </label>
    `,
    errorId: 'aulaFormError',
    cancelButtonId: 'cancelarAula',
    submitButtonId: 'guardarAula',
    submitText: editando ? 'Guardar cambios' : 'Crear aula',
  });

  dialog.showModal();
  habilitarCierreExterior(dialog);

  const limpiarEntradaNumerica = (input, maximoCaracteres) => {
    if (!input) return;
    input.value = String(input.value || '')
      .replace(/\D/g, '')
      .slice(0, maximoCaracteres);
  };

  const validarFormularioEnLinea = () => {
    const numeroInput = document.getElementById('aulaNumero');
    const capacidadInput = document.getElementById('aulaCapacidad');
    const tipoInput = document.getElementById('aulaTipo');
    const origenInput = document.getElementById('aulaOrigen');
    const numeroHelp = document.getElementById('aulaNumeroHelp');
    const numeroMensaje = document.getElementById('aulaNumeroValidation');
    const capacidadMensaje = document.getElementById('aulaCapacidadValidation');
    const origenMensaje = document.getElementById('aulaOrigenDisponibilidad');

    const origen = origenInput?.value || 'UNA';
    const maximoNumero = obtenerMaximoNumeroOrigen(origen);
    const numeroTieneValor = String(numeroInput?.value ?? '').trim() !== '';
    const numero = Number(numeroInput?.value);

    const numeroFueraRango =
      numeroTieneValor &&
      (!Number.isInteger(numero) || numero < 1 || numero > maximoNumero);

    if (numeroInput) {
      numeroInput.maxLength = String(maximoNumero).length;
      numeroInput.dataset.maxValue = String(maximoNumero);
      numeroInput.classList.toggle('is-invalid', numeroFueraRango);
    }

    if (numeroHelp) {
      numeroHelp.textContent = `Para ${nombreOrigen(origen)}, el número permitido es del 1 al ${maximoNumero}.`;
    }

    const tipo = tipoInput?.value || 'AULA';
    const duplicada =
      numeroTieneValor && !numeroFueraRango
        ? buscarEspacioDuplicado(
            numero,
            tipo,
            origen,
            aula?.id ?? null,
            sugerencia?.codigo || '',
            aulas,
          )
        : null;

    if (numeroInput && duplicada) {
      numeroInput.classList.add('is-invalid');
    }

    if (numeroMensaje) {
      if (numeroFueraRango) {
        numeroMensaje.textContent = `Para ${nombreOrigen(origen)}, el número del espacio debe estar entre 1 y ${maximoNumero}.`;
        numeroMensaje.classList.add('is-error');
      } else if (duplicada) {
        numeroMensaje.textContent = `Este espacio ya está asignado en ${nombreOrigen(origen)} como ${nombreVisibleAula(duplicada)}.`;
        numeroMensaje.classList.add('is-error');
      } else {
        numeroMensaje.textContent = '';
        numeroMensaje.classList.remove('is-error');
      }
    }

    const capacidadTieneValor = String(capacidadInput?.value ?? '').trim() !== '';
    const capacidad = Number(capacidadInput?.value);

    const capacidadFueraRango =
      capacidadTieneValor &&
      (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 70);

    if (capacidadInput) {
      capacidadInput.classList.toggle('is-invalid', capacidadFueraRango);
    }

    if (capacidadMensaje) {
      if (capacidadFueraRango) {
        capacidadMensaje.textContent =
          'La capacidad debe ser un número entero entre 1 y 70 estudiantes.';
        capacidadMensaje.classList.add('is-error');
      } else {
        capacidadMensaje.textContent = '';
        capacidadMensaje.classList.remove('is-error');
      }
    }

    const limite = obtenerLimiteOrigen(origen);
    const cantidad = aulas.filter((a) => a.origen === origen).length;
    const mismoOrigen = editando && aula?.origen === origen;
    const limiteAlcanzado =
      limite !== null && cantidad >= limite && !mismoOrigen;

    if (origenInput) {
      origenInput.classList.toggle('is-invalid', limiteAlcanzado);
    }

    if (origenMensaje) {
      if (limite !== null) {
        const disponibles = Math.max(limite - cantidad, 0);
        origenMensaje.textContent = limiteAlcanzado
          ? `${nombreOrigen(origen)} alcanzó el límite de ${limite} espacios registrados.`
          : `${nombreOrigen(origen)}: ${cantidad}/${limite} espacios registrados - ${disponibles} disponibles.`;
        origenMensaje.classList.toggle('is-error', limiteAlcanzado);
      } else {
        origenMensaje.textContent = '';
        origenMensaje.classList.remove('is-error');
      }
    }

    return {
      duplicada,
      limiteAlcanzado,
      numeroFueraRango,
      capacidadFueraRango,
    };
  };

  const actualizarPreview = () => {
    const numero = Number(document.getElementById('aulaNumero')?.value);
    const especial = document.getElementById('aulaNombreEspecial')?.value?.trim() || '';
    const tipo = document.getElementById('aulaTipo')?.value || 'AULA';
    const preview = document.getElementById('aulaNombrePreview');

    if (!preview) return;

    if (!Number.isInteger(numero) || numero < 1) {
      preview.innerHTML = `
        <span>Vista previa</span>
        <strong>Ingrese el número del espacio</strong>
      `;
      validarFormularioEnLinea();
      return;
    }

    preview.innerHTML = `
      <span>Se mostrará como</span>
      <strong>${escapeHtml(construirNombreAula(numero, especial, tipo))}</strong>
    `;

    validarFormularioEnLinea();
  };

  document.getElementById('aulaNumero')?.addEventListener('input', (event) => {
    const origen = document.getElementById('aulaOrigen')?.value || 'UNA';
    const maximoNumero = obtenerMaximoNumeroOrigen(origen);
    limpiarEntradaNumerica(event.currentTarget, String(maximoNumero).length);
    actualizarPreview();
  });

  document.getElementById('aulaNombreEspecial')?.addEventListener('input', actualizarPreview);
  document.getElementById('aulaTipo')?.addEventListener('change', actualizarPreview);

  document.getElementById('aulaOrigen')?.addEventListener('change', () => {
    const numeroInput = document.getElementById('aulaNumero');
    const origen = document.getElementById('aulaOrigen')?.value || 'UNA';
    const maximoNumero = obtenerMaximoNumeroOrigen(origen);
    limpiarEntradaNumerica(numeroInput, String(maximoNumero).length);
    actualizarPreview();
  });

  document.getElementById('aulaCapacidad')?.addEventListener('input', (event) => {
    limpiarEntradaNumerica(event.currentTarget, 2);
    validarFormularioEnLinea();
  });

  actualizarPreview();
  validarFormularioEnLinea();

  document.getElementById('cancelarAula')?.addEventListener('click', () => dialog.close());

  document.getElementById('aulaForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const numero = Number(document.getElementById('aulaNumero')?.value);
    const nombreEspecial = document.getElementById('aulaNombreEspecial')?.value?.trim() || '';
    const tipo = document.getElementById('aulaTipo')?.value || 'AULA';

    const validacionEnLinea = validarFormularioEnLinea();

    if (validacionEnLinea.numeroFueraRango) {
      const origenSeleccionado = document.getElementById('aulaOrigen')?.value || 'UNA';
      const maximoNumero = obtenerMaximoNumeroOrigen(origenSeleccionado);
      mostrarError({
        titulo: 'Número de espacio inválido',
        mensaje: `Para ${nombreOrigen(origenSeleccionado)}, el número debe estar entre 1 y ${maximoNumero}.`,
      });
      return;
    }

    if (validacionEnLinea.capacidadFueraRango) {
      mostrarError({
        titulo: 'Capacidad inválida',
        mensaje: 'La capacidad debe ser un número entero entre 1 y 70 estudiantes.',
      });
      return;
    }

    if (validacionEnLinea.duplicada) {
      mostrarError({
        titulo: 'Aula ya asignada',
        mensaje: `El número indicado ya corresponde a ${nombreVisibleAula(validacionEnLinea.duplicada)} dentro de ${nombreOrigen(document.getElementById('aulaOrigen')?.value)}. Puede utilizar el mismo número en otro origen, pero no repetirlo dentro del mismo.`,
      });
      return;
    }

    if (validacionEnLinea.limiteAlcanzado) {
      mostrarError({
        titulo: 'Límite de espacios alcanzado',
        mensaje: 'El origen seleccionado ya alcanzó la cantidad máxima de espacios configurados.',
      });
      return;
    }

    const datos = {
      codigo: construirCodigoEspacio(
        numero,
        tipo,
        !editando ? sugerencia?.codigo || '' : '',
      ),
      nombre: construirNombreAula(numero, nombreEspecial, tipo),
      ubicacion: document.getElementById('aulaUbicacion')?.value?.trim() || '',
      capacidad: Number(document.getElementById('aulaCapacidad')?.value),
      tipo,
      tipoMobiliario: document.getElementById('aulaMobiliario')?.value,
      origen: document.getElementById('aulaOrigen')?.value,
    };

    if (!Number.isInteger(datos.capacidad) || datos.capacidad < 1 || datos.capacidad > 70) {
      mostrarError({
        titulo: 'Capacidad inválida',
        mensaje: 'La capacidad debe ser un número entero entre 1 y 70 estudiantes.',
      });
      return;
    }

    if (editando && datos.capacidad < aula.capacidad) {
      const confirmado = await confirmarAccion({
        titulo: 'Reducir capacidad del aula',
        mensaje: `La capacidad cambiará de ${aula.capacidad} a ${datos.capacidad}. ¿Desea continuar?`,
        textoConfirmar: 'Reducir capacidad',
        peligro: true,
      });

      if (!confirmado) {
        return;
      }

      datos.confirmarReduccionCapacidad = true;
    }

    const boton = document.getElementById('guardarAula');
    if (boton) {
      boton.disabled = true;
    }

    try {
      const resultado = editando
        ? await actualizarAula(aula.id, datos)
        : await crearAula(datos);

      if (!resultado?.ok) {
        throw new Error(resultado?.message || 'No fue posible guardar el aula.');
      }

      dialog.close();

      mostrarExito({
        titulo: editando ? 'Aula actualizada' : 'Aula creada',
        mensaje: editando
          ? 'La información del aula fue actualizada correctamente.'
          : 'El aula fue registrada correctamente.',
      });

      if (typeof onGuardado === 'function') {
        await onGuardado(resultado.aula || datos);
      }
    } catch (error) {
      mostrarError({
        titulo: 'No se pudo guardar el aula',
        mensaje: error?.message || 'No fue posible guardar la información.',
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
