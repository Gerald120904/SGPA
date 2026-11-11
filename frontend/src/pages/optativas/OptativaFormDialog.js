/**
 * SGPA — Formulario y diálogos de confirmación del módulo Optativas.
 * FRONTEND-ORDER-003
 */

import { ROLES } from '../../config/permissions.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';

export function renderizarDialogoOptativaHtml() {
  const campos = `
    <label>
      <span>Código *</span>
      <input name="codigo" maxlength="30" required autocomplete="off" placeholder="Ej. OPT-001">
    </label>
    <label>
      <span>Nombre *</span>
      <input name="nombre" maxlength="150" required autocomplete="off" placeholder="Nombre de la asignatura">
    </label>
    <label>
      <span>Categoría *</span>
      <select name="tipo" required>
        <option value="DISCIPLINARIA">Disciplinaria</option>
        <option value="ABIERTA">Abierta</option>
        <option value="SEDE">Sede</option>
      </select>
    </label>
    <label>
      <span>Carrera de origen</span>
      <select name="carreraOrigenId"><option value="">Sin carrera de origen</option></select>
    </label>
    <label class="sgpa-form-wide">
      <span>Descripción</span>
      <textarea name="descripcion" maxlength="500" rows="3" placeholder="Descripción opcional"></textarea>
    </label>
  `;

  return `
    <dialog id="optativaDialog" class="sgpa-form-dialog sgpa-form-dialog-md">
      ${FormDialog({
        formId: 'optativaForm',
        title: 'Nueva optativa',
        description: 'Complete los datos de la asignatura optativa.',
        body: campos,
        errorId: 'optativaFormError',
        cancelButtonId: 'cancelarOptativa',
        submitButtonId: 'guardarOptativa',
        submitText: 'Guardar optativa',
      })}
    </dialog>
  `;
}

export function abrirFormularioOptativa({
  optativa = null,
  carreras = [],
  rolActivo = null,
} = {}) {
  const dialogo = document.getElementById('optativaDialog');
  const formulario = document.getElementById('optativaForm');
  if (!dialogo || !formulario) return;

  formulario.reset();
  formulario.dataset.id = optativa?.id ?? '';
  const titulo = dialogo.querySelector('.sgpa-form-heading h3');
  if (titulo) {
    titulo.textContent = optativa ? 'Editar optativa' : 'Nueva optativa';
  }
  formulario.elements.codigo.value = optativa?.curso?.codigo ?? '';
  formulario.elements.nombre.value = optativa?.curso?.nombre ?? '';
  formulario.elements.tipo.value = optativa?.tipo ?? 'DISCIPLINARIA';
  for (const option of formulario.elements.tipo.options) {
    option.disabled =
      rolActivo !== ROLES.ADMIN_GLOBAL && option.value !== 'DISCIPLINARIA';
  }
  formulario.elements.carreraOrigenId.innerHTML =
    '<option value="">Sin carrera de origen</option>' +
    carreras
      .map(
        (c) => `<option value="${Number(c.id)}">${escapeHtml(c.nombre)}</option>`,
      )
      .join('');
  formulario.elements.carreraOrigenId.value = optativa?.carreraOrigenId ?? '';
  formulario.elements.descripcion.value = optativa?.curso?.descripcion ?? '';
  formulario.elements.codigo.disabled = Boolean(optativa);
  formulario.elements.nombre.disabled = Boolean(optativa);
  dialogo.showModal();
  habilitarCierreExterior(dialogo);
}

export async function confirmarCambioEstadoOptativa(optativa) {
  const accion = optativa.activo ? 'Desactivar' : 'Activar';
  return confirmarAccion({
    titulo: `${accion} optativa`,
    mensaje: `¿Desea ${accion.toLowerCase()} "${optativa.curso?.nombre || 'la optativa'}"?`,
    textoConfirmar: accion,
    peligro: optativa.activo,
  });
}
