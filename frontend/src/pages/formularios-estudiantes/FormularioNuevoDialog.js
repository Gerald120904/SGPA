/**
 * SGPA — Diálogo modal de configuración y creación de nuevos formularios de estudiantes.
 * FRONTEND-REFACTOR-FORMULARIOS-ESTUDIANTES-INTEGRAL-001
 */

import { listarCarreras } from '../../services/carreras.service.js';
import { listarPlanesEstudio } from '../../services/planes-estudio.service.js';
import { crearFormularioEstudiantes } from '../../services/formularios-estudiantes.service.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { usuarioTienePermiso } from '../../app/session.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  CAMPOS_FORMULARIO,
  validarDatosNuevoFormulario,
  construirDatosCrearFormulario,
} from './formularios-estudiantes.helpers.js';
import { PERMISOS } from './FormularioGoogleStatusView.js';
import { inicializarSelectorAcademico } from './FormularioAsignaturasSelector.js';

export function obtenerDatosFormularioActual(container = document) {
  const valor = (campo) => {
    const id = CAMPOS_FORMULARIO[campo];
    const el = container.querySelector ? (container.querySelector(`#${id}`) || document.getElementById(id)) : document.getElementById(id);
    return el?.value ?? '';
  };

  return {
    proveedor: valor('proveedor'),
    titulo: valor('titulo'),
    descripcion: valor('descripcion'),
    carreraId: valor('carreraId'),
    planEstudioId: valor('planEstudioId'),
  };
}

export function mostrarErroresCamposFormulario(
  errores = {},
  campos = Object.keys(CAMPOS_FORMULARIO),
  container = typeof document !== 'undefined' ? document : null,
) {
  for (const campo of campos) {
    const id = CAMPOS_FORMULARIO[campo];
    const input = container?.querySelector ? (container.querySelector(`#${id}`) || (typeof document !== 'undefined' ? document.getElementById(id) : null)) : (typeof document !== 'undefined' ? document.getElementById(id) : null);
    const mensaje = container?.querySelector ? (container.querySelector(`#${id}Error`) || (typeof document !== 'undefined' ? document.getElementById(`${id}Error`) : null)) : (typeof document !== 'undefined' ? document.getElementById(`${id}Error`) : null);
    if (!input || !mensaje) continue;

    const error = errores[campo] || '';
    if (error) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
    mensaje.textContent = error;
    mensaje.classList.toggle('hidden', !error);
  }
}

export function registrarValidacionesCamposFormulario(dialog = document) {
  const formulario = dialog.querySelector('#nuevoFormularioEstudianteForm') || (typeof document !== 'undefined' ? document.getElementById('nuevoFormularioEstudianteForm') : null);
  if (!formulario) return;

  formulario.noValidate = true;

  for (const [campo, id] of Object.entries(CAMPOS_FORMULARIO)) {
    const input = dialog.querySelector ? (dialog.querySelector(`#${id}`) || (typeof document !== 'undefined' ? document.getElementById(id) : null)) : (typeof document !== 'undefined' ? document.getElementById(id) : null);
    if (!input) continue;

    const validarCampo = () => {
      const { errores } = validarDatosNuevoFormulario(obtenerDatosFormularioActual(dialog));
      mostrarErroresCamposFormulario(errores, [campo], dialog);
    };

    if (input.tagName === 'SELECT') {
      input.addEventListener('change', validarCampo);
    } else {
      input.addEventListener('blur', validarCampo);
      input.addEventListener('input', () => {
        if (input.getAttribute('aria-invalid') === 'true') {
          validarCampo();
        }
      });
    }
  }
}

export async function cargarOpcionesFormulario(contexto) {
  const [resultadoCarreras, resultadoPlanes] = await Promise.all([
    listarCarreras(),
    listarPlanesEstudio(),
  ]);

  if (!resultadoCarreras?.ok) {
    throw new Error(
      resultadoCarreras?.message || 'No fue posible consultar las carreras.',
    );
  }

  if (!resultadoPlanes?.ok) {
    throw new Error(
      resultadoPlanes?.message || 'No fue posible consultar los planes de estudio.',
    );
  }

  const carreras = Array.isArray(resultadoCarreras.carreras)
    ? resultadoCarreras.carreras.filter((carrera) => carrera.activo === true)
    : [];

  const planes = Array.isArray(resultadoPlanes.planes)
    ? resultadoPlanes.planes.filter((plan) => plan.activo === true)
    : [];

  if (contexto?.estado) {
    contexto.estado.carrerasDisponibles = carreras;
    contexto.estado.planesDisponibles = planes;
  }

  return { carreras, planes };
}

export async function abrirNuevoFormulario(contexto, { onRecargar } = {}) {
  if (!usuarioTienePermiso(PERMISOS.CREAR)) {
    mostrarError({
      titulo: 'Acceso restringido',
      mensaje: 'No posee permiso para crear formularios de estudiantes.',
    });
    return;
  }

  const dialog = document.getElementById('formularioEstudianteDialog');
  const content = document.getElementById('formularioEstudianteDialogContent');

  if (!dialog || !content) {
    return;
  }

  try {
    await cargarOpcionesFormulario(contexto);
  } catch (error) {
    mostrarError({
      titulo: 'No fue posible preparar el formulario',
      mensaje: error?.message || 'No se pudieron cargar las carreras y planes.',
    });
    return;
  }

  const carrerasDisponibles = contexto?.estado?.carrerasDisponibles || [];
  if (carrerasDisponibles.length === 0) {
    mostrarError({
      titulo: 'No hay carreras activas',
      mensaje: 'Registre o habilite una carrera antes de crear un formulario.',
    });
    return;
  }

  const opcionesCarreras = carrerasDisponibles
    .map(
      (carrera) => `
        <option value="${carrera.id}">
          ${escapeHtml(carrera.codigo)} - ${escapeHtml(carrera.nombre)}
        </option>
      `,
    )
    .join('');

  const body = `
    <label class="sgpa-form-wide">
      <span>Modalidad del formulario <span class="formularios-required" aria-hidden="true">*</span></span>
      <select id="formularioProveedor" name="proveedor" aria-describedby="formularioProveedorAyuda formularioProveedorError" required>
        <option value="" selected disabled>Seleccione una modalidad...</option>
        <option value="INTERNO">Formulario institucional SGPA (sin Google)</option>
        <option value="GOOGLE_FORMS">Google Forms (requiere conexión Google)</option>
      </select>
      <small id="formularioProveedorAyuda" class="sgpa-field-help">
        Seleccione si el formulario se publicará en SGPA o mediante Google Forms.
      </small>
      <small id="formularioProveedorError" class="formularios-field-error hidden" role="alert"></small>
    </label>

    <label class="sgpa-form-wide">
      <span>
        Título del formulario <span class="formularios-required" aria-hidden="true">*</span>
      </span>
      <input
        id="formularioTitulo"
        name="titulo"
        type="text"
        maxlength="255"
        aria-describedby="formularioTituloAyuda formularioTituloError"
        placeholder="Ej. Registro de estudiantes I Ciclo 2027"
        required
      >
      <small id="formularioTituloAyuda" class="sgpa-field-help">
        Título visible para los estudiantes. Máximo 255 caracteres.
      </small>
      <small id="formularioTituloError" class="formularios-field-error hidden" role="alert"></small>
    </label>

    <label class="sgpa-form-wide">
      <span>
        Descripción <span class="formularios-required" aria-hidden="true">*</span>
      </span>
      <textarea
        id="formularioDescripcion"
        name="descripcion"
        rows="3"
        maxlength="1000"
        aria-describedby="formularioDescripcionAyuda formularioDescripcionError"
        placeholder="Ej. Complete este formulario con sus datos personales y las asignaturas aprobadas hasta el período actual."
        required
      ></textarea>
      <small id="formularioDescripcionAyuda" class="sgpa-field-help">
        Aparecerá en el encabezado del formulario institucional. Máximo 1000 caracteres.
      </small>
      <small id="formularioDescripcionError" class="formularios-field-error hidden" role="alert"></small>
    </label>

    <label class="sgpa-form-wide">
      <span>
        Carrera <span class="formularios-required" aria-hidden="true">*</span>
      </span>
      <select
        id="formularioCarrera"
        name="carreraId"
        aria-describedby="formularioCarreraError"
        required
      >
        <option value="" selected disabled>
          Seleccione una carrera...
        </option>
        ${opcionesCarreras}
      </select>
      <small id="formularioCarreraError" class="formularios-field-error hidden" role="alert"></small>
    </label>

    <label class="sgpa-form-wide">
      <span>
        Plan de estudio <span class="formularios-required" aria-hidden="true">*</span>
      </span>
      <select
        id="formularioPlan"
        name="planEstudioId"
        aria-describedby="formularioPlanError"
        disabled
        required
      >
        <option value="" selected>
          Seleccione primero una carrera...
        </option>
      </select>
      <small id="formularioPlanError" class="formularios-field-error hidden" role="alert"></small>
    </label>

    <div
      id="formularioPlanResumen"
      class="sgpa-form-wide"
    ></div>
  `;

  content.innerHTML = FormDialog({
    formId: 'nuevoFormularioEstudianteForm',
    title: 'Nuevo formulario de estudiantes',
    description: 'Seleccione la modalidad, la carrera y el plan de estudio.',
    body,
    errorId: 'nuevoFormularioEstudianteError',
    cancelButtonId: 'cancelarNuevoFormularioButton',
    submitButtonId: 'crearFormularioButton',
    submitText: 'Crear formulario',
    submitIcon: 'file-plus',
  });

  renderizarIconos();
  dialog.showModal();
  habilitarCierreExterior(dialog);
  registrarValidacionesCamposFormulario(dialog);

  let planValido = false;
  inicializarSelectorAcademico(dialog, contexto, {
    onEstadoPlanCambiado: (valido) => {
      planValido = valido;
    },
    onLimpiarErrorPlan: () => {
      mostrarErroresCamposFormulario({}, ['planEstudioId'], dialog);
    },
  });

  document
    .getElementById('cancelarNuevoFormularioButton')
    ?.addEventListener('click', () => dialog.close());

  let estaCreando = false;

  document
    .getElementById('nuevoFormularioEstudianteForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (estaCreando) {
        return;
      }

      const tituloInput = document.getElementById('formularioTitulo');
      const descripcionInput = document.getElementById('formularioDescripcion');
      const carreraInput = document.getElementById('formularioCarrera');
      const planInput = document.getElementById('formularioPlan');
      const proveedorInput = document.getElementById('formularioProveedor');
      const errorBox = document.getElementById('nuevoFormularioEstudianteError');
      const crearButton = document.getElementById('crearFormularioButton');
      const cancelarButton = document.getElementById('cancelarNuevoFormularioButton');

      if (!tituloInput || !descripcionInput || !carreraInput || !planInput || !crearButton) {
        return;
      }

      const datosFormulario = obtenerDatosFormularioActual(dialog);
      const validacion = validarDatosNuevoFormulario(datosFormulario);
      mostrarErroresCamposFormulario(validacion.errores);

      const titulo = tituloInput.value.trim();
      const descripcion = descripcionInput.value.trim();
      const carreraId = Number(carreraInput.value);
      const planEstudioId = Number(planInput.value);
      const esInterno = proveedorInput?.value === 'INTERNO';

      if (!validacion.valido || !planValido) {
        if (errorBox) {
          errorBox.textContent =
            validacion.valido && !planValido
              ? 'El plan seleccionado debe incluir asignaturas compatibles con la modalidad elegida.'
              : 'Revise los campos marcados en rojo antes de continuar.';
          errorBox.classList.remove('hidden');
        }

        if (!validacion.valido) {
          const primerCampo = Object.keys(CAMPOS_FORMULARIO).find(
            (campo) => validacion.errores[campo],
          );
          document.getElementById(CAMPOS_FORMULARIO[primerCampo])?.focus();
        }
        return;
      }

      errorBox?.classList.add('hidden');

      estaCreando = true;
      crearButton.disabled = true;
      if (cancelarButton) cancelarButton.disabled = true;
      tituloInput.disabled = true;
      descripcionInput.disabled = true;
      carreraInput.disabled = true;
      planInput.disabled = true;

      crearButton.innerHTML = `
        <span class="formularios-btn-spinner" aria-hidden="true"></span>
        <span>Creando formulario...</span>
      `;

      const scrollContainer =
        dialog.querySelector('.sgpa-form-scroll') ||
        dialog.querySelector('.sgpa-form');

      let avisoCarga = document.getElementById('formulariosCreandoNotice');
      if (!avisoCarga && scrollContainer) {
        avisoCarga = document.createElement('div');
        avisoCarga.id = 'formulariosCreandoNotice';
        avisoCarga.className = 'formularios-creando-notice';
        avisoCarga.innerHTML = `
          <span class="formularios-pulse-dot" aria-hidden="true"></span>
          <span>${
            esInterno
              ? 'Generando el formulario institucional...'
              : 'Generando el formulario en Google Forms...'
          } Por favor espere.</span>
        `;
        scrollContainer.appendChild(avisoCarga);
      }

      try {
        const res = await crearFormularioEstudiantes(construirDatosCrearFormulario({
          titulo,
          descripcion,
          carreraId,
          planEstudioId,
          proveedor: proveedorInput?.value,
        }));

        if (res && res.ok === false) {
          throw new Error(res.message || 'No fue posible crear el formulario.');
        }

        dialog.close();

        const formulario = res?.data ?? res;
        const estaPublicado =
          formulario?.estado === 'PUBLICADO' || Boolean(formulario?.responderUri);

        mostrarExito({
          titulo: estaPublicado ? 'Formulario publicado' : 'Formulario creado',
          mensaje: estaPublicado
            ? esInterno
              ? 'El formulario fue creado y publicado correctamente en el SGPA.'
              : 'El formulario fue creado y publicado correctamente en Google Forms.'
            : `El formulario fue registrado. Estado: ${formulario?.estado || 'CREADO'}.`,
        });

        await onRecargar?.();
      } catch (error) {
        mostrarError({
          titulo: 'No se pudo crear el formulario',
          mensaje: error?.message || 'Ocurrió un error durante la creación.',
        });
      } finally {
        estaCreando = false;
        crearButton.disabled = false;
        if (cancelarButton) cancelarButton.disabled = false;
        tituloInput.disabled = false;
        descripcionInput.disabled = false;
        carreraInput.disabled = false;
        planInput.disabled = false;

        document.getElementById('formulariosCreandoNotice')?.remove();

        crearButton.innerHTML = `
          <i data-lucide="file-plus" aria-hidden="true"></i>
          <span>Crear formulario</span>
        `;
        renderizarIconos();
      }
    });
}
