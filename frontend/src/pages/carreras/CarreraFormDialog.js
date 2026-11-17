/**
 * SGPA — Formulario y confirmaciones de estado del módulo Carreras.
 * FRONTEND-ORDER-003
 */

import {
  actualizarCarrera,
  cambiarEstadoCarrera,
  crearCarrera,
} from '../../services/carreras.service.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarExito, mostrarError } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';

export function abrirFormularioCarrera({
  carrera = null,
  puedeGestionar = false,
  onSaved,
} = {}) {
  if (!puedeGestionar) {
    mostrarError({
      titulo: 'Acceso restringido',
      mensaje: 'No posee permiso para gestionar carreras.',
    });
    return;
  }

  const dialog = document.getElementById('carreraDialog');
  const content = document.getElementById('carreraDialogContent');

  if (!dialog || !content) {
    return;
  }

  const editando = Boolean(carrera);

  const body = `
    <label>
      <span>Código</span>
      <input
        id="carreraCodigo"
        name="codigo"
        type="text"
        maxlength="20"
        value="${carrera ? escapeHtml(carrera.codigo) : ''}"
        placeholder="Ej. INFO"
        required
      >
    </label>

    <label class="sgpa-form-wide">
      <span>Nombre</span>
      <input
        id="carreraNombre"
        name="nombre"
        type="text"
        maxlength="150"
        value="${carrera ? escapeHtml(carrera.nombre) : ''}"
        placeholder="Nombre de la carrera"
        required
      >
    </label>

    <label class="sgpa-form-wide">
      <span>Descripción</span>
      <textarea
        id="carreraDescripcion"
        name="descripcion"
        maxlength="500"
        rows="4"
        placeholder="Descripción opcional de la carrera"
      >${carrera?.descripcion ? escapeHtml(carrera.descripcion) : ''}</textarea>
    </label>
  `;

  content.innerHTML = FormDialog({
    formId: 'carreraForm',
    title: editando ? 'Editar carrera' : 'Nueva carrera',
    description: editando
      ? 'Actualice la información académica de la carrera.'
      : 'Registre una nueva carrera académica en el SGPA.',
    body,
    errorId: 'carreraFormError',
    cancelButtonId: 'cancelarCarreraButton',
    submitButtonId: 'guardarCarreraButton',
    submitText: editando ? 'Guardar cambios' : 'Crear carrera',
  });

  renderizarIconos();
  dialog.showModal();
  habilitarCierreExterior(dialog);

  const cerrar = () => dialog.close();

  document
    .getElementById('cerrarCarreraDialog')
    ?.addEventListener('click', cerrar);

  document
    .getElementById('cancelarCarreraButton')
    ?.addEventListener('click', cerrar);

  document
    .getElementById('carreraForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const errorBox = document.getElementById('carreraFormError');
      const guardarButton = document.getElementById('guardarCarreraButton');
      const codigoInput = document.getElementById('carreraCodigo');
      const nombreInput = document.getElementById('carreraNombre');
      const descripcionInput = document.getElementById('carreraDescripcion');

      if (
        !guardarButton ||
        !codigoInput ||
        !nombreInput ||
        !descripcionInput
      ) {
        return;
      }

      const datos = {
        codigo: codigoInput.value.trim(),
        nombre: nombreInput.value.trim(),
        descripcion: descripcionInput.value.trim(),
      };

      errorBox?.classList.add('hidden');
      guardarButton.disabled = true;

      try {
        const resultado = editando
          ? await actualizarCarrera(carrera.id, datos)
          : await crearCarrera(datos);

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || 'No fue posible guardar la carrera.',
          );
        }

        cerrar();

        mostrarExito({
          titulo: 'Operación realizada correctamente',
          mensaje: editando
            ? 'Carrera actualizada correctamente.'
            : 'Carrera creada correctamente.',
        });

        await onSaved?.();
      } catch (error) {
        mostrarError({
          titulo: editando
            ? 'No se pudo actualizar la carrera'
            : 'No se pudo crear la carrera',
          mensaje: error?.message || 'No fue posible guardar la carrera.',
        });
      } finally {
        guardarButton.disabled = false;
      }
    });
}

export async function alternarEstadoCarrera({
  carrera,
  puedeGestionar = false,
  onSaved,
} = {}) {
  if (!puedeGestionar) {
    mostrarError({
      titulo: 'Acceso restringido',
      mensaje: 'No posee permiso para cambiar el estado de carreras.',
    });
    return;
  }

  const nuevoEstado = !carrera.activo;
  const accion = nuevoEstado ? 'activar' : 'desactivar';
  const confirmado = await confirmarAccion({
    titulo: nuevoEstado ? 'Activar carrera' : 'Desactivar carrera',
    mensaje: `¿Desea ${accion} la carrera "${carrera.nombre}"?`,
    textoConfirmar: nuevoEstado ? 'Activar' : 'Desactivar',
    peligro: !nuevoEstado,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await cambiarEstadoCarrera(carrera.id, nuevoEstado);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible cambiar el estado.',
      );
    }

    mostrarExito({
      titulo: 'Operación realizada correctamente',
      mensaje: nuevoEstado
        ? 'Carrera activada correctamente.'
        : 'Carrera desactivada correctamente.',
    });

    await onSaved?.();
  } catch (error) {
    mostrarError({
      titulo: 'No se pudo completar la operación',
      mensaje: error?.message || 'No fue posible cambiar el estado.',
    });
  }
}
