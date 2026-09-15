import {
  listarFormulariosEstudiantes,
  obtenerEstadoGoogleFormularios,
  conectarGoogleFormularios,
  desconectarGoogleFormularios,
  crearFormularioEstudiantes,
  sincronizarFormularioEstudiantes,
  procesarFormularioEstudiantes,
  cerrarFormularioEstudiantes
} from '../../services/formularios-estudiantes.service.js';

import {
  listarCarreras
} from '../../services/carreras.service.js';

import {
  listarPlanesEstudio
} from '../../services/planes-estudio.service.js';

import {
  listarPlanAsignaturas
} from '../../services/plan-asignaturas.service.js';

import {
  mostrarError,
  mostrarExito
} from '../../components/AlertModal.js';

import {
  confirmarAccion
} from '../../utils/confirm.js';

import {
  usuarioTienePermiso
} from '../../app/session.js';

import {
  escapeHtml
} from '../../utils/html.js';

import {
  DataTable
} from '../../components/DataTable.js';

import {
  FormDialog,
  habilitarCierreExterior
} from '../../components/FormDialog.js';

import {
  renderizarIconos
} from '../../utils/icons.js';

const PERMISOS = {
  CREAR:
    'FORMULARIOS_ESTUDIANTES_CREAR',

  GESTIONAR:
    'FORMULARIOS_ESTUDIANTES_GESTIONAR',

  VER_RESPUESTAS:
    'FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS'
};

let formularios = [];
let carrerasDisponibles = [];
let planesDisponibles = [];

let estadoGoogle = {
  conectado: false,
  googleEmail: null
};

let observadorFocusRegistrado = false;

export function FormulariosEstudiantesPage() {
  return `
    <section
      id="formulariosEstudiantesPage"
      class="module-view"
    >
      <div class="planes-toolbar">
        <div>
          <h2>
            Formularios de estudiantes
          </h2>

          <p>
            Gestión de formularios para
            recolección de información académica.
          </p>

          <div id="estadoGoogleFormularios"></div>
        </div>

        <div id="accionesFormularios"></div>
      </div>

      <div
        id="formulariosEstudiantesContent"
        aria-live="polite"
      >
        ${DataTable({
          columns: [
            'Título',
            'Carrera',
            'Plan de estudio',
            'Estado',
            'Respuestas',
            'Acciones'
          ],
          rows: '',
          emptyMessage:
            'No hay formularios registrados.',
          ariaLabel:
            'Formularios de estudiantes'
        })}
      </div>

      <dialog
        id="formularioEstudianteDialog"
        class="sgpa-form-dialog sgpa-form-dialog-md"
      >
        <div
          id="formularioEstudianteDialogContent"
        ></div>
      </dialog>
    </section>
  `;
}

function renderizarEstadoGoogle() {
  const contenedor =
    document.getElementById(
      'estadoGoogleFormularios'
    );

  if (!contenedor) return;

  if (estadoGoogle.conectado) {
    contenedor.innerHTML = `
      <small>
        <strong>
          Google conectado
        </strong>
        ${
          estadoGoogle.googleEmail
            ? ` · ${escapeHtml(
                estadoGoogle.googleEmail
              )}`
            : ''
        }
      </small>
    `;

    return;
  }

  contenedor.innerHTML = `
    <small>
      Google no conectado
    </small>
  `;
}

function renderizarAcciones() {
  const contenedor =
    document.getElementById(
      'accionesFormularios'
    );

  if (!contenedor) return;

  const puedeCrear =
    usuarioTienePermiso(
      PERMISOS.CREAR
    );

  const puedeGestionar =
    usuarioTienePermiso(
      PERMISOS.GESTIONAR
    );

  const acciones = [];

  if (
    !estadoGoogle.conectado &&
    puedeCrear
  ) {
    acciones.push(`
      <button
        id="conectarGoogleButton"
        type="button"
        class="btn btn-secondary"
      >
        <i
          data-lucide="link"
          aria-hidden="true"
        ></i>
        Conectar Google
      </button>
    `);
  }

  if (
    estadoGoogle.conectado &&
    puedeGestionar
  ) {
    acciones.push(`
      <button
        id="desconectarGoogleButton"
        type="button"
        class="btn btn-secondary"
      >
        <i
          data-lucide="unlink"
          aria-hidden="true"
        ></i>
        Desconectar Google
      </button>
    `);
  }

  if (puedeCrear) {
    acciones.push(`
      <button
        id="nuevoFormularioButton"
        type="button"
        class="btn btn-primary"
        ${
          estadoGoogle.conectado
            ? ''
            : 'disabled'
        }
        title="${
          estadoGoogle.conectado
            ? 'Crear formulario'
            : 'Conecta Google primero'
        }"
      >
        <i
          data-lucide="plus"
          aria-hidden="true"
        ></i>
        Nuevo formulario
      </button>
    `);
  }

  contenedor.innerHTML =
    acciones.join('');

  renderizarIconos();
  enlazarEventos();
}

function renderizarFilaFormulario(
  formulario
) {
  const carrera =
    formulario.carrera?.nombre ||
    'Sin carrera';

  const plan =
    formulario.planEstudio?.nombre ||
    'Sin plan';

  const total =
    formulario.totalRespuestas ?? 0;

  const pendientes =
    formulario.pendientes ?? 0;

  const revision =
    formulario.requierenRevision ?? 0;

  const puedeGestionar =
    usuarioTienePermiso(
      PERMISOS.GESTIONAR
    );

  const publicado =
    formulario.estado === 'PUBLICADO';

  const cerrado =
    formulario.estado === 'CERRADO';

  const operable =
    publicado || cerrado;

  return `
    <tr
      data-formulario-id="${formulario.id}"
    >
      <td>
        <strong>
          ${escapeHtml(
            formulario.titulo
          )}
        </strong>
      </td>

      <td>
        ${escapeHtml(carrera)}
      </td>

      <td>
        ${escapeHtml(plan)}
      </td>

      <td>
        ${escapeHtml(
          formulario.estado
        )}
      </td>

      <td>
        <div>
          <strong>${total}</strong>
          total
        </div>

        <small>
          ${pendientes} pendientes
          ·
          ${revision} revisión
        </small>
      </td>

      <td>
        <div class="table-actions" style="display: inline-flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
          ${
            formulario.responderUri
              ? `
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-action="copiar-enlace"
                  data-id="${formulario.id}"
                  title="Copiar enlace del formulario"
                >
                  <i
                    data-lucide="copy"
                    aria-hidden="true"
                  ></i>
                </button>
              `
              : ''
          }

          ${
            puedeGestionar && operable
              ? `
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-action="sincronizar"
                  data-id="${formulario.id}"
                  title="Sincronizar respuestas"
                >
                  <i
                    data-lucide="refresh-cw"
                    aria-hidden="true"
                  ></i>
                </button>

                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-action="procesar"
                  data-id="${formulario.id}"
                  title="Procesar respuestas pendientes"
                >
                  <i
                    data-lucide="play"
                    aria-hidden="true"
                  ></i>
                </button>
              `
              : ''
          }

          ${
            puedeGestionar && publicado
              ? `
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-action="cerrar"
                  data-id="${formulario.id}"
                  title="Cerrar formulario"
                >
                  <i
                    data-lucide="lock"
                    aria-hidden="true"
                  ></i>
                </button>
              `
              : ''
          }
        </div>
      </td>
    </tr>
  `;
}

function renderizarTabla() {
  const contenedor =
    document.getElementById(
      'formulariosEstudiantesContent'
    );

  if (!contenedor) return;

  const rows = formularios
    .map(renderizarFilaFormulario)
    .join('');

  contenedor.innerHTML = DataTable({
    columns: [
      'Título',
      'Carrera',
      'Plan de estudio',
      'Estado',
      'Respuestas',
      'Acciones'
    ],
    rows,
    emptyMessage:
      'No hay formularios registrados.',
    ariaLabel:
      'Formularios de estudiantes'
  });

  renderizarIconos();
}

function renderizarCarga() {
  const contenedor =
    document.getElementById(
      'formulariosEstudiantesContent'
    );

  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="empty-state">
      <i
        data-lucide="loader-circle"
        aria-hidden="true"
      ></i>

      <p>
        Cargando formularios...
      </p>
    </div>
  `;

  renderizarIconos();
}

function enlazarEventos() {
  document
    .getElementById(
      'conectarGoogleButton'
    )
    ?.addEventListener(
      'click',
      conectarGoogle
    );

  document
    .getElementById(
      'desconectarGoogleButton'
    )
    ?.addEventListener(
      'click',
      desconectarGoogle
    );

  document
    .getElementById(
      'nuevoFormularioButton'
    )
    ?.addEventListener(
      'click',
      abrirNuevoFormulario
    );
}

async function manejarAccionFormulario(event) {
  const button =
    event.target.closest(
      '[data-action][data-id]'
    );

  if (!button) {
    return;
  }

  const id =
    Number(button.dataset.id);

  if (!id) {
    return;
  }

  const formulario =
    formularios.find(
      (item) =>
        item.id === id
    );

  if (!formulario) {
    return;
  }

  const accion =
    button.dataset.action;

  switch (accion) {
    case 'copiar-enlace':
      await copiarEnlaceFormulario(
        formulario
      );
      break;

    case 'sincronizar':
      await sincronizarFormulario(
        formulario,
        button
      );
      break;

    case 'procesar':
      await procesarFormulario(
        formulario,
        button
      );
      break;

    case 'cerrar':
      await cerrarFormulario(
        formulario,
        button
      );
      break;
  }
}

async function copiarEnlaceFormulario(
  formulario
) {
  if (!formulario.responderUri) {
    mostrarError({
      titulo:
        'Enlace no disponible',
      mensaje:
        'Este formulario no posee un enlace de respuesta disponible.'
    });

    return;
  }

  try {
    await navigator.clipboard.writeText(
      formulario.responderUri
    );

    mostrarExito({
      titulo:
        'Enlace copiado',
      mensaje:
        'El enlace del formulario fue copiado al portapapeles.'
    });
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible copiar el enlace',
      mensaje:
        error?.message ||
        'No se pudo acceder al portapapeles.'
    });
  }
}

async function sincronizarFormulario(
  formulario,
  button
) {
  button.disabled = true;

  try {
    const res =
      await sincronizarFormularioEstudiantes(
        formulario.id
      );

    if (res && res.ok === false) {
      throw new Error(
        res.message || 'No fue posible sincronizar las respuestas.'
      );
    }

    const resultado = res?.data ?? res;

    mostrarExito({
      titulo:
        'Respuestas sincronizadas',

      mensaje:
        `Google reportó ${resultado.recibidasGoogle ?? 0} respuestas. ` +
        `${resultado.nuevas ?? 0} nuevas, ` +
        `${resultado.ignoradasExistentes ?? 0} ya existentes, ` +
        `${resultado.errores ?? 0} con error.`
    });

    await cargarFormularios();
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible sincronizar',
      mensaje:
        error?.message ||
        'Ocurrió un error al consultar Google Forms.'
    });
  } finally {
    button.disabled = false;
  }
}

async function procesarFormulario(
  formulario,
  button
) {
  button.disabled = true;

  try {
    const res =
      await procesarFormularioEstudiantes(
        formulario.id
      );

    if (res && res.ok === false) {
      throw new Error(
        res.message || 'No fue posible procesar las respuestas.'
      );
    }

    const resultado = res?.data ?? res;

    mostrarExito({
      titulo:
        'Respuestas procesadas',

      mensaje:
        `${resultado.procesadas ?? 0} procesadas. ` +
        `${resultado.estudiantesCreados ?? 0} estudiantes creados, ` +
        `${resultado.estudiantesActualizados ?? 0} actualizados y ` +
        `${resultado.aprobacionesNuevas ?? 0} aprobaciones nuevas.`
    });

    await cargarFormularios();
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible procesar las respuestas',
      mensaje:
        error?.message ||
        'Ocurrió un error durante el procesamiento.'
    });
  } finally {
    button.disabled = false;
  }
}

async function cerrarFormulario(
  formulario,
  button
) {
  const aceptado =
    await confirmarAccion({
      titulo:
        'Cerrar formulario',

      mensaje:
        `El formulario "${formulario.titulo}" dejará de aceptar nuevas respuestas. Las respuestas existentes se conservarán.`,

      textoConfirmar:
        'Cerrar formulario',

      peligro: true
    });

  if (!aceptado) {
    return;
  }

  button.disabled = true;

  try {
    const res = await cerrarFormularioEstudiantes(
      formulario.id
    );

    if (res && res.ok === false) {
      throw new Error(
        res.message || 'No fue posible cerrar el formulario.'
      );
    }

    mostrarExito({
      titulo:
        'Formulario cerrado',
      mensaje:
        'Google Forms dejó de aceptar nuevas respuestas. La información existente permanece disponible.'
    });

    await cargarFormularios();
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible cerrar el formulario',
      mensaje:
        error?.message ||
        'Ocurrió un error al cerrar el formulario.'
    });
  } finally {
    button.disabled = false;
  }
}

async function conectarGoogle() {
  try {
    await conectarGoogleFormularios();

    mostrarExito({
      titulo:
        'Autorización de Google abierta',
      mensaje:
        'Completa la autorización en el navegador. Al volver al SGPA se actualizará el estado.'
    });
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible conectar Google',
      mensaje:
        error?.message ||
        'Inténtalo nuevamente.'
    });
  }
}

async function desconectarGoogle() {
  const aceptado =
    await confirmarAccion({
      titulo:
        'Desconectar Google',
      mensaje:
        'La cuenta dejará de estar disponible para nuevas operaciones con Google.',
      textoConfirmar:
        'Desconectar',
      peligro: true
    });

  if (!aceptado) return;

  try {
    const resultado = await desconectarGoogleFormularios();

    if (resultado && resultado.ok === false) {
      throw new Error(
        resultado.message || 'No fue posible desconectar Google.'
      );
    }

    estadoGoogle = {
      conectado: false,
      googleEmail: null
    };

    renderizarEstadoGoogle();
    renderizarAcciones();

    mostrarExito({
      titulo:
        'Google desconectado',
      mensaje:
        'La cuenta se desvinculó correctamente.'
    });
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible desconectar Google',
      mensaje:
        error?.message ||
        'Inténtalo nuevamente.'
    });
  }
}

async function cargarOpcionesFormulario() {
  const [
    resultadoCarreras,
    resultadoPlanes
  ] = await Promise.all([
    listarCarreras(),
    listarPlanesEstudio()
  ]);

  if (!resultadoCarreras?.ok) {
    throw new Error(
      resultadoCarreras?.message ||
      'No fue posible consultar las carreras.'
    );
  }

  if (!resultadoPlanes?.ok) {
    throw new Error(
      resultadoPlanes?.message ||
      'No fue posible consultar los planes de estudio.'
    );
  }

  carrerasDisponibles =
    Array.isArray(
      resultadoCarreras.carreras
    )
      ? resultadoCarreras.carreras.filter(
          (carrera) =>
            carrera.activo === true
        )
      : [];

  planesDisponibles =
    Array.isArray(
      resultadoPlanes.planes
    )
      ? resultadoPlanes.planes.filter(
          (plan) =>
            plan.activo === true
        )
      : [];
}

async function abrirNuevoFormulario() {
  if (
    !usuarioTienePermiso(
      PERMISOS.CREAR
    )
  ) {
    mostrarError({
      titulo: 'Acceso restringido',
      mensaje:
        'No posee permiso para crear formularios de estudiantes.'
    });

    return;
  }

  if (!estadoGoogle.conectado) {
    mostrarError({
      titulo: 'Google no conectado',
      mensaje:
        'Debe conectar una cuenta de Google antes de crear un formulario.'
    });

    return;
  }

  const dialog =
    document.getElementById(
      'formularioEstudianteDialog'
    );

  const content =
    document.getElementById(
      'formularioEstudianteDialogContent'
    );

  if (!dialog || !content) {
    return;
  }

  try {
    await cargarOpcionesFormulario();
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible preparar el formulario',
      mensaje:
        error?.message ||
        'No se pudieron cargar las carreras y planes.'
    });

    return;
  }

  const opcionesCarreras =
    carrerasDisponibles
      .map(
        (carrera) => `
          <option
            value="${carrera.id}"
          >
            ${escapeHtml(carrera.codigo)}
            -
            ${escapeHtml(carrera.nombre)}
          </option>
        `
      )
      .join('');

  const body = `
    <label class="sgpa-form-wide">
      <span>
        Título del formulario
      </span>

      <input
        id="formularioTitulo"
        name="titulo"
        type="text"
        maxlength="255"
        placeholder="Ej. Registro de estudiantes I Ciclo 2027"
        required
      >

      <small class="sgpa-field-help">
        Este será el título visible en Google Forms.
      </small>
    </label>

    <label class="sgpa-form-wide">
      <span>
        Carrera
      </span>

      <select
        id="formularioCarrera"
        name="carreraId"
        required
      >
        <option
          value=""
          selected
          disabled
        >
          Seleccione una carrera...
        </option>

        ${opcionesCarreras}
      </select>
    </label>

    <label class="sgpa-form-wide">
      <span>
        Plan de estudio
      </span>

      <select
        id="formularioPlan"
        name="planEstudioId"
        disabled
        required
      >
        <option
          value=""
          selected
        >
          Seleccione primero una carrera...
        </option>
      </select>
    </label>

    <div
      id="formularioPlanResumen"
      class="sgpa-form-wide"
    ></div>
  `;

  content.innerHTML =
    FormDialog({
      formId:
        'nuevoFormularioEstudianteForm',

      title:
        'Nuevo formulario de estudiantes',

      description:
        'Seleccione la carrera y el plan. El SGPA creará y publicará automáticamente el formulario en Google.',

      body,

      errorId:
        'nuevoFormularioEstudianteError',

      cancelButtonId:
        'cancelarNuevoFormularioButton',

      submitButtonId:
        'crearFormularioButton',

      submitText:
        'Crear y publicar',

      submitIcon:
        'file-plus'
    });

  renderizarIconos();
  dialog.showModal();
  habilitarCierreExterior(dialog);

  const carreraInput =
    document.getElementById(
      'formularioCarrera'
    );

  const planInput =
    document.getElementById(
      'formularioPlan'
    );

  carreraInput?.addEventListener(
    'change',
    () => {
      const carreraId =
        Number(
          carreraInput.value
        );

      const planesCarrera =
        planesDisponibles.filter(
          (plan) =>
            plan.carreraId ===
            carreraId
        );

      planInput.innerHTML = `
        <option
          value=""
          selected
          disabled
        >
          Seleccione un plan...
        </option>

        ${planesCarrera
          .map(
            (plan) => `
              <option
                value="${plan.id}"
              >
                ${escapeHtml(plan.codigo)}
                -
                ${escapeHtml(plan.nombre)}
              </option>
            `
          )
          .join('')}
      `;

      planInput.disabled =
        planesCarrera.length === 0;

      const resumen =
        document.getElementById(
          'formularioPlanResumen'
        );

      if (resumen) {
        resumen.innerHTML =
          planesCarrera.length
            ? ''
            : `
                <small class="sgpa-field-help">
                  Esta carrera no posee planes activos disponibles.
                </small>
              `;
      }
    }
  );

  planInput?.addEventListener(
    'change',
    async () => {
      const resumen =
        document.getElementById(
          'formularioPlanResumen'
        );

      const planId =
        Number(planInput.value);

      if (!resumen || !planId) {
        return;
      }

      resumen.innerHTML = `
        <small class="sgpa-field-help">
          Consultando asignaturas del plan...
        </small>
      `;

      try {
        const resultado =
          await listarPlanAsignaturas(
            planId
          );

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message ||
            'No fue posible consultar las asignaturas.'
          );
        }

        const asignaturas =
          Array.isArray(
            resultado.asignaturas
          )
            ? resultado.asignaturas
            : [];

        const reales =
          asignaturas.filter(
            (asignatura) =>
              asignatura.activo === true &&
              asignatura.cursoId !== null
          );

        resumen.innerHTML = `
          <small class="sgpa-field-help">
            El formulario incluirá
            <strong>${reales.length}</strong>
            asignaturas del plan como opciones de materias aprobadas.
          </small>
        `;
      } catch (error) {
        resumen.innerHTML = `
          <small class="sgpa-field-help">
            No fue posible obtener la vista previa de asignaturas.
          </small>
        `;
      }
    }
  );

  document
    .getElementById(
      'cancelarNuevoFormularioButton'
    )
    ?.addEventListener(
      'click',
      () => dialog.close()
    );

  document
    .getElementById(
      'nuevoFormularioEstudianteForm'
    )
    ?.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        const tituloInput =
          document.getElementById(
            'formularioTitulo'
          );

        const errorBox =
          document.getElementById(
            'nuevoFormularioEstudianteError'
          );

        const crearButton =
          document.getElementById(
            'crearFormularioButton'
          );

        if (
          !tituloInput ||
          !carreraInput ||
          !planInput ||
          !crearButton
        ) {
          return;
        }

        const titulo =
          tituloInput.value.trim();

        const carreraId =
          Number(
            carreraInput.value
          );

        const planEstudioId =
          Number(
            planInput.value
          );

        if (
          !titulo ||
          !carreraId ||
          !planEstudioId
        ) {
          if (errorBox) {
            errorBox.textContent =
              'Complete el título, la carrera y el plan de estudio.';

            errorBox.classList.remove(
              'hidden'
            );
          }

          return;
        }

        errorBox?.classList.add(
          'hidden'
        );

        crearButton.disabled = true;

        const textoBoton =
          crearButton.querySelector(
            'span'
          );

        if (textoBoton) {
          textoBoton.textContent =
            'Creando formulario...';
        }

        try {
          const res =
            await crearFormularioEstudiantes({
              titulo,
              carreraId,
              planEstudioId
            });

          if (res && res.ok === false) {
            throw new Error(
              res.message ||
              'No fue posible crear el formulario.'
            );
          }

          dialog.close();

          mostrarExito({
            titulo:
              'Formulario creado',
            mensaje:
              'El formulario fue creado y publicado correctamente en Google Forms.'
          });

          await cargarFormularios();
        } catch (error) {
          mostrarError({
            titulo:
              'No se pudo crear el formulario',
            mensaje:
              error?.message ||
              'Ocurrió un error durante la creación.'
          });
        } finally {
          crearButton.disabled = false;

          if (textoBoton) {
            textoBoton.textContent =
              'Crear y publicar';
          }
        }
      }
    );
}

async function cargarFormularios() {
  const resultado =
    await listarFormulariosEstudiantes();

  if (resultado && resultado.ok === false) {
    throw new Error(
      resultado.message ||
      'No fue posible consultar los formularios.'
    );
  }

  const data = resultado?.data ?? resultado;

  formularios =
    Array.isArray(data)
      ? data
      : [];

  renderizarTabla();
}

function registrarActualizacionAlVolver() {
  if (
    observadorFocusRegistrado
  ) {
    return;
  }

  window.addEventListener(
    'focus',
    async () => {
      const pagina =
        document.getElementById(
          'formulariosEstudiantesPage'
        );

      if (!pagina) return;

      try {
        const google =
          await obtenerEstadoGoogleFormularios();

        const googleData = google?.data ?? google;

        estadoGoogle = {
          conectado:
            Boolean(
              googleData?.conectado
            ),

          googleEmail:
            googleData?.googleEmail ??
            null
        };

        renderizarEstadoGoogle();
        renderizarAcciones();
      } catch (error) {
        console.error(
          'No se pudo actualizar el estado de Google:',
          error
        );
      }
    }
  );

  observadorFocusRegistrado = true;
}

export async function iniciarFormulariosEstudiantesPage() {
  renderizarCarga();

  const contenido =
    document.getElementById(
      'formulariosEstudiantesContent'
    );

  contenido?.removeEventListener(
    'click',
    manejarAccionFormulario
  );
  contenido?.addEventListener(
    'click',
    manejarAccionFormulario
  );

  try {
    const [
      google,
      resultadoFormularios
    ] = await Promise.all([
      obtenerEstadoGoogleFormularios(),
      listarFormulariosEstudiantes()
    ]);

    const googleData = google?.data ?? google;

    estadoGoogle = {
      conectado:
        Boolean(googleData?.conectado),

      googleEmail:
        googleData?.googleEmail ?? null
    };

    if (resultadoFormularios && resultadoFormularios.ok === false) {
      throw new Error(
        resultadoFormularios.message || 'No fue posible consultar los formularios.'
      );
    }

    const data = resultadoFormularios?.data ?? resultadoFormularios;

    formularios =
      Array.isArray(data)
        ? data
        : [];

    renderizarEstadoGoogle();
    renderizarAcciones();
    renderizarTabla();
    registrarActualizacionAlVolver();
  } catch (error) {
    console.error(
      'Error al cargar Formularios:',
      error
    );

    formularios = [];
    renderizarTabla();

    mostrarError({
      titulo:
        'No fue posible cargar Formularios',
      mensaje:
        error?.message ||
        'Ocurrió un error al cargar la información.'
    });
  }
}
