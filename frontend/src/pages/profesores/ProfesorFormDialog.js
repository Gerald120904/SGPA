/**
 * SGPA — Diálogos de autogestión de atestados y proyectos docentes.
 * FRONTEND-REF-DEEP-002
 */

import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  crearAtestadoProfesor,
  actualizarAtestadoProfesor,
  inactivarMiAtestadoProfesor,
  crearProyectoProfesor,
  actualizarProyectoProfesor,
  cambiarEstadoProyectoProfesor,
} from '../../services/profesores.service.js';

export function abrirFormularioAtestado({
  atestado = null,
  onGuardado = null,
  vigente = () => true,
} = {}) {
  const dialog = document.getElementById('profesorRevisionDialog');
  const content = document.getElementById('profesorRevisionDialogContent');

  if (!dialog || !content) {
    return;
  }

  const editando = Boolean(atestado);
  const esExpInicial =
    atestado?.tipo === 'EXPERIENCIA_DOCENTE' ||
    atestado?.tipo === 'EXPERIENCIA_PROFESIONAL';

  content.innerHTML = FormDialog({
    formId: 'miAtestadoForm',
    title: editando ? 'Editar atestado' : 'Nuevo atestado',
    description: editando
      ? 'Actualice la información del atestado.'
      : 'Registre un respaldo académico o de experiencia para su perfil docente.',
    body: `
      <label>
        <span>Tipo</span>
        <select id="atestadoTipo" required>
          <option value="" ${!editando ? 'selected' : ''} disabled>Seleccione...</option>
          <option value="TITULO_ACADEMICO" ${atestado?.tipo === 'TITULO_ACADEMICO' ? 'selected' : ''}>
            Título académico
          </option>
          <option value="CERTIFICACION" ${atestado?.tipo === 'CERTIFICACION' ? 'selected' : ''}>
            Certificación
          </option>
          <option value="EXPERIENCIA_DOCENTE" ${atestado?.tipo === 'EXPERIENCIA_DOCENTE' ? 'selected' : ''}>
            Experiencia docente
          </option>
          <option value="EXPERIENCIA_PROFESIONAL" ${atestado?.tipo === 'EXPERIENCIA_PROFESIONAL' ? 'selected' : ''}>
            Experiencia profesional
          </option>
          <option value="CAPACITACION" ${atestado?.tipo === 'CAPACITACION' ? 'selected' : ''}>
            Capacitación
          </option>
          <option value="OTRO" ${atestado?.tipo === 'OTRO' ? 'selected' : ''}>
            Otro
          </option>
        </select>
      </label>

      <label>
        <span>Nombre</span>
        <input
          id="atestadoNombre"
          type="text"
          minlength="2"
          maxlength="180"
          value="${escapeHtml(atestado?.nombre || '')}"
          required
        >
      </label>

      <label>
        <span>Institución / organización</span>
        <input
          id="atestadoInstitucion"
          type="text"
          minlength="2"
          maxlength="180"
          value="${escapeHtml(atestado?.institucion || '')}"
          required
        >
      </label>

      <div id="atestadoFechaObtencionContainer" class="${esExpInicial ? 'hidden' : ''}">
        <label>
          <span>Fecha de obtención</span>
          <input
            id="atestadoFechaObtencion"
            type="date"
            value="${escapeHtml(String(atestado?.fechaObtencion || ''))}"
          >
        </label>
      </div>

      <div id="atestadoPeriodoContainer" class="${esExpInicial ? '' : 'hidden'}">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <label>
            <span>Fecha de inicio *</span>
            <input
              id="atestadoFechaInicio"
              type="date"
              value="${escapeHtml(String(atestado?.fechaInicio || ''))}"
            >
          </label>

          <label>
            <span>Fecha de fin</span>
            <input
              id="atestadoFechaFin"
              type="date"
              value="${escapeHtml(String(atestado?.fechaFin || ''))}"
            >
          </label>
        </div>
        <small style="color: #667085; font-size: 12px; margin-top: 4px; display: block;">
          Deje la fecha de fin vacía si la experiencia continúa actualmente.
        </small>
      </div>

      <label class="sgpa-form-wide">
        <span>Descripción</span>
        <textarea
          id="atestadoDescripcion"
          maxlength="500"
          rows="4"
          placeholder="Descripción opcional"
        >${escapeHtml(atestado?.descripcion || '')}</textarea>
      </label>
    `,
    errorId: 'miAtestadoFormError',
    cancelButtonId: 'cancelarMiAtestado',
    submitButtonId: 'guardarMiAtestado',
    submitText: editando ? 'Guardar cambios' : 'Registrar atestado',
  });

  dialog.showModal();
  habilitarCierreExterior(dialog);

  const selectTipo = document.getElementById('atestadoTipo');
  const containerFechaObtencion = document.getElementById('atestadoFechaObtencionContainer');
  const containerPeriodo = document.getElementById('atestadoPeriodoContainer');

  selectTipo?.addEventListener('change', () => {
    const tipo = selectTipo.value;
    const esExp =
      tipo === 'EXPERIENCIA_DOCENTE' ||
      tipo === 'EXPERIENCIA_PROFESIONAL';

    if (esExp) {
      containerFechaObtencion?.classList.add('hidden');
      containerPeriodo?.classList.remove('hidden');
    } else {
      containerFechaObtencion?.classList.remove('hidden');
      containerPeriodo?.classList.add('hidden');
    }
  });

  document
    .getElementById('cancelarMiAtestado')
    ?.addEventListener('click', () => dialog.close());

  document
    .getElementById('miAtestadoForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const errorBox = document.getElementById('miAtestadoFormError');
      errorBox?.classList.add('hidden');

      const tipo = document.getElementById('atestadoTipo')?.value;
      const nombre = document.getElementById('atestadoNombre')?.value?.trim();
      const institucion = document.getElementById('atestadoInstitucion')?.value?.trim();
      const descripcion =
        document.getElementById('atestadoDescripcion')?.value?.trim() || undefined;

      const esExperiencia =
        tipo === 'EXPERIENCIA_DOCENTE' ||
        tipo === 'EXPERIENCIA_PROFESIONAL';

      let fechaInicio = undefined;
      let fechaFin = undefined;
      let fechaObtencion = undefined;

      if (esExperiencia) {
        fechaInicio =
          document.getElementById('atestadoFechaInicio')?.value || undefined;
        fechaFin =
          document.getElementById('atestadoFechaFin')?.value || undefined;

        if (!fechaInicio) {
          if (errorBox) {
            errorBox.textContent =
              'Las evidencias de experiencia deben indicar una fecha de inicio.';
            errorBox.classList.remove('hidden');
          }
          return;
        }

        if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
          if (errorBox) {
            errorBox.textContent =
              'La fecha de fin no puede ser anterior a la fecha de inicio.';
            errorBox.classList.remove('hidden');
          }
          return;
        }
      } else {
        fechaObtencion =
          document.getElementById('atestadoFechaObtencion')?.value || undefined;
      }

      const datos = {
        tipo,
        nombre,
        institucion,
        fechaObtencion,
        fechaInicio,
        fechaFin,
        descripcion,
      };

      const boton = document.getElementById('guardarMiAtestado');
      if (boton) {
        boton.disabled = true;
      }

      try {
        const resultado = editando
          ? await actualizarAtestadoProfesor(atestado.id, datos)
          : await crearAtestadoProfesor(datos);

        if (!vigente()) return;

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || 'No fue posible guardar el atestado.',
          );
        }

        dialog.close();

        mostrarExito({
          titulo: editando ? 'Atestado actualizado' : 'Atestado registrado',
          mensaje: editando
            ? 'El atestado fue actualizado correctamente.'
            : 'El atestado quedó pendiente de revisión.',
        });

        if (typeof onGuardado === 'function') {
          await onGuardado(resultado);
        }
      } catch (error) {
        if (!vigente()) return;

        mostrarError({
          titulo: 'No se pudo guardar el atestado',
          mensaje: error?.message || 'No fue posible guardar la información.',
        });
      } finally {
        if (boton && vigente()) {
          boton.disabled = false;
        }
      }
    });

  if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    renderizarIconos();
  }
}

export async function inactivarMiAtestado({
  atestadoId,
  onInactivado = null,
  vigente = () => true,
} = {}) {
  const confirmado = await confirmarAccion({
    titulo: 'Inactivar atestado',
    mensaje: 'El atestado dejará de formar parte activa de su perfil docente.',
    textoConfirmar: 'Inactivar',
    peligro: true,
  });

  if (!confirmado) {
    return;
  }

  if (!vigente()) return;

  try {
    const resultado = await inactivarMiAtestadoProfesor(atestadoId);

    if (!vigente()) return;

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible inactivar el atestado.',
      );
    }

    mostrarExito({
      titulo: 'Atestado inactivado',
      mensaje: 'El atestado fue inactivado correctamente.',
    });

    if (typeof onInactivado === 'function') {
      await onInactivado();
    }
  } catch (error) {
    if (!vigente()) return;

    mostrarError({
      titulo: 'No se pudo inactivar el atestado',
      mensaje: error?.message || 'No fue posible actualizar el atestado.',
    });
  }
}

export function abrirFormularioProyecto({
  proyecto = null,
  onGuardado = null,
  vigente = () => true,
} = {}) {
  const dialog = document.getElementById('profesorRevisionDialog');
  const content = document.getElementById('profesorRevisionDialogContent');

  if (!dialog || !content) {
    return;
  }

  const editando = Boolean(proyecto);

  content.innerHTML = FormDialog({
    formId: 'miProyectoForm',
    title: editando ? 'Editar proyecto / laboratorio' : 'Nuevo proyecto / laboratorio',
    description: editando
      ? 'Actualice la información registrada.'
      : 'Registre un proyecto, laboratorio o actividad académica.',
    body: `
      <label class="sgpa-form-wide">
        <span>Nombre</span>
        <input
          id="proyectoNombre"
          type="text"
          minlength="2"
          maxlength="180"
          value="${escapeHtml(proyecto?.nombre || '')}"
          required
        >
      </label>

      <label>
        <span>Unidad / laboratorio</span>
        <input
          id="proyectoUnidad"
          type="text"
          maxlength="180"
          value="${escapeHtml(proyecto?.unidad || '')}"
          placeholder="Ej. CENTIC"
        >
      </label>

      <label>
        <span>Rol</span>
        <input
          id="proyectoRol"
          type="text"
          maxlength="120"
          value="${escapeHtml(proyecto?.rol || '')}"
          placeholder="Ej. Investigador"
        >
      </label>

      <label>
        <span>Fecha de inicio</span>
        <input
          id="proyectoFechaInicio"
          type="date"
          value="${escapeHtml(String(proyecto?.fechaInicio || ''))}"
        >
      </label>

      <label>
        <span>Fecha de finalización</span>
        <input
          id="proyectoFechaFin"
          type="date"
          value="${escapeHtml(String(proyecto?.fechaFin || ''))}"
        >
      </label>

      <label class="sgpa-form-wide">
        <span>Descripción</span>
        <textarea
          id="proyectoDescripcion"
          rows="4"
          maxlength="500"
          placeholder="Descripción opcional"
        >${escapeHtml(proyecto?.descripcion || '')}</textarea>
      </label>
    `,
    errorId: 'miProyectoFormError',
    cancelButtonId: 'cancelarMiProyecto',
    submitButtonId: 'guardarMiProyecto',
    submitText: editando ? 'Guardar cambios' : 'Registrar proyecto',
  });

  dialog.showModal();
  habilitarCierreExterior(dialog);

  document
    .getElementById('cancelarMiProyecto')
    ?.addEventListener('click', () => dialog.close());

  document
    .getElementById('miProyectoForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const errorBox = document.getElementById('miProyectoFormError');
      errorBox?.classList.add('hidden');

      const fechaInicio =
        document.getElementById('proyectoFechaInicio')?.value || '';
      const fechaFin =
        document.getElementById('proyectoFechaFin')?.value || '';

      if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
        if (errorBox) {
          errorBox.textContent =
            'La fecha de finalización no puede ser anterior a la fecha de inicio.';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      const datos = {
        nombre: document.getElementById('proyectoNombre')?.value?.trim(),
        unidad: document.getElementById('proyectoUnidad')?.value?.trim() || '',
        rol: document.getElementById('proyectoRol')?.value?.trim() || '',
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
        descripcion: document.getElementById('proyectoDescripcion')?.value?.trim() || '',
      };

      const boton = document.getElementById('guardarMiProyecto');
      if (boton) {
        boton.disabled = true;
      }

      try {
        const resultado = editando
          ? await actualizarProyectoProfesor(proyecto.id, datos)
          : await crearProyectoProfesor(datos);

        if (!vigente()) return;

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || 'No fue posible guardar el proyecto.',
          );
        }

        dialog.close();

        mostrarExito({
          titulo: editando ? 'Proyecto actualizado' : 'Proyecto registrado',
          mensaje: editando
            ? 'El proyecto fue actualizado correctamente.'
            : 'El proyecto fue registrado correctamente.',
        });

        if (typeof onGuardado === 'function') {
          await onGuardado(resultado);
        }
      } catch (error) {
        if (!vigente()) return;

        mostrarError({
          titulo: 'No se pudo guardar el proyecto',
          mensaje: error?.message || 'No fue posible guardar la información.',
        });
      } finally {
        if (boton && vigente()) {
          boton.disabled = false;
        }
      }
    });

  if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    renderizarIconos();
  }
}

export async function cambiarEstadoMiProyecto({
  proyecto,
  activo,
  onActualizado = null,
  vigente = () => true,
} = {}) {
  const confirmado = await confirmarAccion({
    titulo: activo ? 'Reactivar proyecto' : 'Inactivar proyecto',
    mensaje: activo
      ? `¿Desea reactivar "${proyecto.nombre}"?`
      : `¿Desea inactivar "${proyecto.nombre}"?`,
    textoConfirmar: activo ? 'Reactivar' : 'Inactivar',
    peligro: !activo,
  });

  if (!confirmado) {
    return;
  }

  if (!vigente()) return;

  try {
    const resultado = await cambiarEstadoProyectoProfesor(proyecto.id, activo);

    if (!vigente()) return;

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible cambiar el estado.',
      );
    }

    mostrarExito({
      titulo: activo ? 'Proyecto reactivado' : 'Proyecto inactivado',
      mensaje: `El proyecto fue ${activo ? 'reactivado' : 'inactivado'} correctamente.`,
    });

    if (typeof onActualizado === 'function') {
      await onActualizado();
    }
  } catch (error) {
    if (!vigente()) return;

    mostrarError({
      titulo: 'No se pudo cambiar el estado',
      mensaje: error?.message || 'No fue posible actualizar el proyecto.',
    });
  }
}
