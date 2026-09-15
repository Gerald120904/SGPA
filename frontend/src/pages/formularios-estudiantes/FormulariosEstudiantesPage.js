import {
  listarFormulariosEstudiantes,
  obtenerEstadoGoogleFormularios,
  conectarGoogleFormularios,
  desconectarGoogleFormularios
} from '../../services/formularios-estudiantes.service.js';

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
  renderizarIconos
} from '../../utils/icons.js';

const PERMISOS = {
  CREAR:
    'FORMULARIOS_ESTUDIANTES_CREAR',

  GESTIONAR:
    'FORMULARIOS_ESTUDIANTES_GESTIONAR'
};

let formularios = [];

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
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          data-action="ver-formulario"
          data-id="${formulario.id}"
          disabled
          title="Disponible en el siguiente bloque"
        >
          <i
            data-lucide="eye"
            aria-hidden="true"
          ></i>

          Ver
        </button>
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

function enlazarEventosGoogle() {
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
    enlazarEventosGoogle();

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
        enlazarEventosGoogle();
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
    enlazarEventosGoogle();
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
