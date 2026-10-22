import {
  listarFormulariosEstudiantes,
  obtenerEstadoGoogleFormularios,
  conectarGoogleFormularios,
  desconectarGoogleFormularios,
  crearFormularioEstudiantes,
  sincronizarFormularioEstudiantes,
  cerrarFormularioEstudiantes,
  listarRespuestasFormularioEstudiantes,
  abrirEnlaceFormularioEstudiantes,
  publicarFormularioEstudiantes,
  regenerarTokenFormularioEstudiantes,
  obtenerUrlPublicaFormulario,
  aceptarSolicitudFormulario,
  rechazarSolicitudFormulario
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
  StatusBadge
} from '../../components/StatusBadge.js';

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
  requiereReautenticacion: false,
  estado: 'DESCONECTADO',
  googleEmail: null
};

let observadorFocusRegistrado = false;

export function agruparAsignaturasVistaPrevia(asignaturas) {
  const estructura = new Map();
  asignaturas.forEach((asignatura) => {
    const nivel = Number(asignatura.nivel);
    const ciclo = Number(asignatura.ciclo);
    const ciclosNivel = estructura.get(nivel) || new Map();
    const cursosCiclo = ciclosNivel.get(ciclo) || [];
    cursosCiclo.push(asignatura);
    ciclosNivel.set(ciclo, cursosCiclo);
    estructura.set(nivel, ciclosNivel);
  });
  return estructura;
}

export function construirDatosCrearFormulario({
  titulo,
  descripcion,
  carreraId,
  planEstudioId,
  proveedor
}) {
  if (proveedor !== 'INTERNO' && proveedor !== 'GOOGLE_FORMS') {
    throw new Error('Seleccione una modalidad de formulario válida.');
  }

  return { titulo, descripcion, carreraId, planEstudioId, proveedor };
}

export function asignaturasElegiblesParaFormulario(asignaturas, proveedor) {
  return asignaturas.filter((asignatura) =>
    asignatura.activo === true && (
      (asignatura.cursoId != null && asignatura.curso != null) ||
      (proveedor === 'INTERNO' && Boolean(asignatura.codigoReferencia?.trim()))
    )
  );
}

export function FormulariosEstudiantesPage() {
  return `
    <section
      id="formulariosEstudiantesPage"
      class="module-view formularios-page"
    >
      <div class="formularios-toolbar">
        <div class="formularios-toolbar-heading">
          <h2>
            Formularios de estudiantes
          </h2>

          <p>
            Gestión de formularios para
            recolección de información académica.
          </p>

          <div id="estadoGoogleFormularios"></div>
        </div>

        <div
          id="accionesFormularios"
          class="formularios-toolbar-actions"
        ></div>
      </div>

      <div
        id="formulariosEstudiantesContent"
        aria-live="polite"
      >
        ${DataTable({
          columns: [
            'Título',
            'Carrera',
            'Plan',
            'Estado',
            'Respuestas',
            'Enlace',
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

  if (estadoGoogle.requiereReautenticacion) {
    contenedor.innerHTML = `
      <div class="formularios-google-status formularios-google-disconnected">
        <span class="formularios-google-dot" aria-hidden="true"></span>
        <span>
          <strong>Google requiere reconexión</strong>
          <small>La autorización expiró o fue revocada.</small>
        </span>
      </div>
    `;

    return;
  }

  if (estadoGoogle.conectado) {
    contenedor.innerHTML = `
      <div class="formularios-google-status formularios-google-connected">
        <span class="formularios-google-dot" aria-hidden="true"></span>
        <span>
          <strong>Google conectado</strong>
        ${
          estadoGoogle.googleEmail
            ? `<small>${escapeHtml(estadoGoogle.googleEmail)}</small>`
            : ''
        }
        </span>
      </div>
    `;

    return;
  }

  contenedor.innerHTML = `
    <div class="formularios-google-status formularios-google-disconnected">
      <span class="formularios-google-dot" aria-hidden="true"></span>
      <strong>Google no conectado</strong>
    </div>
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
        class="formularios-secondary-button"
      >
        <i
          data-lucide="link"
          aria-hidden="true"
        ></i>
        ${
          estadoGoogle.requiereReautenticacion
            ? 'Volver a conectar Google'
            : 'Conectar Google'
        }
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
        class="formularios-secondary-button"
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
        class="formularios-primary-button"
        title="Crear formulario de estudiantes en SGPA"
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

  const puedeVerRespuestas =
    usuarioTienePermiso(
      PERMISOS.VER_RESPUESTAS
    );

  const esInterno =
    formulario.proveedor === 'INTERNO';

  const publicado =
    formulario.estado === 'PUBLICADO';

  const cerrado =
    formulario.estado === 'CERRADO';

  const operable =
    publicado || cerrado;

  const tonosEstado = {
    PUBLICADO: 'success',
    CERRADO: 'neutral',
    CREADO: 'info',
    CREANDO: 'info',
    ERROR: 'danger'
  };

  const estadoBadge =
    StatusBadge({
      label: formulario.estado || 'Sin estado',
      tone:
        tonosEstado[formulario.estado] ||
        'neutral'
    });

  const badgeProveedor = `
    <span class="badge-proveedor ${esInterno ? 'badge-interno' : 'badge-google'}">
      ${esInterno ? 'SGPA' : 'Google'}
    </span>
  `;

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
        ${badgeProveedor}
      </td>

      <td>
        ${escapeHtml(carrera)}
      </td>

      <td>
        ${escapeHtml(plan)}
      </td>

      <td>
        ${estadoBadge}
      </td>

      <td>
        <div class="formularios-response-summary">
          <strong>${total} respuestas</strong>
          <small>
            ${pendientes} pendiente${pendientes === 1 ? '' : 's'}
            ·
            ${revision} en revisión
          </small>
        </div>
      </td>

      <td>
        ${
          formulario.responderUri
            ? `
              <button
                type="button"
                class="formularios-secondary-button formularios-copy-button"
                data-action="copiar-enlace"
                data-id="${formulario.id}"
                title="Copiar enlace para responder"
              >
                <i
                  data-lucide="copy"
                  aria-hidden="true"
                ></i>

                Copiar enlace
              </button>
            `
            : '—'
        }
      </td>

      <td>
        <div class="formularios-table-actions">
          ${
            formulario.responderUri
              ? `
                <button
                  type="button"
                  class="formularios-icon-button"
                  data-action="abrir-enlace"
                  data-id="${formulario.id}"
                  title="${
                    esInterno
                      ? 'Abrir formulario web institucional'
                      : 'Abrir formulario en Google Forms'
                  }"
                >
                  <i
                    data-lucide="external-link"
                    aria-hidden="true"
                  ></i>
                </button>
              `
              : ''
          }

          ${
            puedeVerRespuestas
              ? `
                <button
                  type="button"
                  class="formularios-icon-button"
                  data-action="ver-respuestas"
                  data-id="${formulario.id}"
                  title="Ver respuestas"
                >
                  <i
                    data-lucide="inbox"
                    aria-hidden="true"
                  ></i>
                </button>
              `
              : ''
          }

          ${
            puedeGestionar && esInterno && formulario.estado === 'CREADO'
              ? `
                <button
                  type="button"
                  class="formularios-icon-button formularios-icon-button-success"
                  data-action="publicar"
                  data-id="${formulario.id}"
                  title="Publicar formulario para estudiantes"
                >
                  <i
                    data-lucide="globe"
                    aria-hidden="true"
                  ></i>
                </button>
              `
              : ''
          }

          ${
            puedeGestionar && esInterno && publicado
              ? `
                <button
                  type="button"
                  class="formularios-icon-button"
                  data-action="regenerar-token"
                  data-id="${formulario.id}"
                  title="Regenerar enlace público (revoca el anterior)"
                >
                  <i
                    data-lucide="key-round"
                    aria-hidden="true"
                  ></i>
                </button>
              `
              : ''
          }

          ${
            !esInterno && puedeGestionar && operable
              ? `
                <button
                  type="button"
                  class="formularios-icon-button"
                  data-action="sincronizar"
                  data-id="${formulario.id}"
                  title="Sincronizar respuestas de Google Forms"
                >
                  <i
                    data-lucide="refresh-cw"
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
                  class="formularios-icon-button formularios-icon-button-danger"
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
      'Enlace',
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

    case 'abrir-enlace':
      if (formulario.responderUri) {
        await abrirEnlaceFormularioEstudiantes(
          formulario.responderUri
        );
      }
      break;

    case 'ver-respuestas':
      await verRespuestasFormulario(
        formulario
      );
      break;

    case 'publicar':
      await publicarFormulario(
        formulario,
        button
      );
      break;

    case 'regenerar-token':
      await regenerarTokenFormulario(
        formulario,
        button
      );
      break;

    case 'sincronizar':
      await sincronizarFormulario(
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
    const enlaceResuelto =
      await obtenerUrlPublicaFormulario(formulario.responderUri);

    await navigator.clipboard.writeText(
      enlaceResuelto || formulario.responderUri
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

async function verRespuestasFormulario(
  formulario
) {
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

  content.innerHTML =
    FormDialog({
      formId:
        'respuestasFormularioEstudianteForm',

      title:
        'Respuestas del formulario',

      description:
        formulario.titulo,

      body: `
        <div
          id="respuestasFormularioContent"
        >
          <div
            class="sgpa-table-empty"
            role="status"
          >
            <strong>
              Cargando respuestas...
            </strong>
          </div>
        </div>
      `,

      cancelButtonId:
        'cerrarRespuestasFormularioButton',

      cancelText:
        'Cerrar',

      showFooter:
        true,

      layout:
        'custom'
    });

  renderizarIconos();
  dialog.showModal();
  habilitarCierreExterior(dialog);

  document
    .getElementById(
      'cerrarRespuestasFormularioButton'
    )
    ?.addEventListener(
      'click',
      () => dialog.close()
    );

  try {
    const res =
      await listarRespuestasFormularioEstudiantes(
        formulario.id
      );

    if (res && res.ok === false) {
      throw new Error(
        res.message || 'No fue posible cargar las respuestas.'
      );
    }

    const data = res?.data ?? res;

    const respuestas =
      Array.isArray(data)
        ? data
        : [];

    renderizarRespuestasFormulario(
      respuestas,
      formulario
    );
  } catch (error) {
    dialog.close();

    mostrarError({
      titulo:
        'No fue posible cargar las respuestas',
      mensaje:
        error?.message ||
        'Ocurrió un error al consultar la bandeja de respuestas.'
    });
  }
}

function renderizarRespuestasFormulario(
  respuestas,
  formulario
) {
  const contenedor =
    document.getElementById(
      'respuestasFormularioContent'
    );

  if (!contenedor) {
    return;
  }

  const rows =
    respuestas
      .map(
        (r) => renderizarFilaRespuesta(r, formulario)
      )
      .join('');

  contenedor.innerHTML =
    DataTable({
      columns: [
        'Estudiante',
        'Identificación',
        'Correo',
        'Aprobadas',
        'Estado',
        'Procesada',
        'Detalle',
        'Acciones'
      ],

      rows,

      emptyMessage:
        'Este formulario todavía no tiene respuestas registradas.',

      ariaLabel:
        'Respuestas del formulario'
    });

  renderizarIconos();

  contenedor.querySelectorAll('.btn-accion-aprobar-resp').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const respuestaId = Number(btn.getAttribute('data-id'));
      const nombreEstudiante = btn.getAttribute('data-estudiante') || 'el estudiante';

      const confirmado = await confirmarAccion({
        titulo: 'Aprobar respuesta',
        mensaje: `¿Desea aprobar la solicitud de ${nombreEstudiante} e incorporar sus materias aprobadas al expediente?`,
        textoConfirmar: 'Aprobar respuesta',
        peligro: false
      });

      if (!confirmado) return;

      const fila = btn.closest('tr');
      if (fila) fila.querySelectorAll('button').forEach((b) => (b.disabled = true));

      try {
        const resultado = await aceptarSolicitudFormulario(respuestaId);
        if (resultado && resultado.ok === false) {
          throw new Error(resultado.message || 'No fue posible aprobar la solicitud.');
        }

        mostrarExito({
          titulo: 'Solicitud aprobada',
          mensaje: 'La respuesta fue procesada correctamente y registrada en el historial académico.'
        });

        if (formulario?.id) {
          const res = await listarRespuestasFormularioEstudiantes(formulario.id);
          const data = res?.data ?? res;
          renderizarRespuestasFormulario(Array.isArray(data) ? data : [], formulario);
        }
      } catch (error) {
        mostrarError({
          titulo: 'No fue posible aprobar la respuesta',
          mensaje: error?.message || 'La respuesta requiere revisión antes de poder incorporarse.'
        });
        if (formulario?.id) {
          const res = await listarRespuestasFormularioEstudiantes(formulario.id);
          const data = res?.data ?? res;
          renderizarRespuestasFormulario(Array.isArray(data) ? data : [], formulario);
        } else if (fila) {
          fila.querySelectorAll('button').forEach((b) => (b.disabled = false));
        }
      }
    });
  });

  contenedor.querySelectorAll('.btn-accion-rechazar-resp').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const respuestaId = Number(btn.getAttribute('data-id'));
      const nombreEstudiante = btn.getAttribute('data-estudiante') || 'el estudiante';

      const motivo = window.prompt(`Ingrese el motivo del rechazo para la respuesta de ${nombreEstudiante}:`);
      if (motivo === null) return;

      const fila = btn.closest('tr');
      if (fila) fila.querySelectorAll('button').forEach((b) => (b.disabled = true));

      try {
        const resultado = await rechazarSolicitudFormulario(respuestaId, motivo);
        if (resultado && resultado.ok === false) {
          throw new Error(resultado.message || 'No fue posible rechazar la solicitud.');
        }

        mostrarExito({
          titulo: 'Solicitud rechazada',
          mensaje: 'La respuesta fue rechazada.'
        });

        if (formulario?.id) {
          const res = await listarRespuestasFormularioEstudiantes(formulario.id);
          const data = res?.data ?? res;
          renderizarRespuestasFormulario(Array.isArray(data) ? data : [], formulario);
        }
      } catch (error) {
        mostrarError({
          titulo: 'No fue posible rechazar la respuesta',
          mensaje: error?.message || 'Ocurrió un error al rechazar la respuesta.'
        });
        if (fila) fila.querySelectorAll('button').forEach((b) => (b.disabled = false));
      }
    });
  });
}

function renderizarFilaRespuesta(
  respuesta,
  formulario
) {
  const datos =
    respuesta.datosNormalizadosJson;

  const nombre =
    datos
      ? [
          datos.primerNombre,
          datos.segundoNombre,
          datos.primerApellido,
          datos.segundoApellido
        ]
          .filter(Boolean)
          .join(' ')
      : 'Sin normalizar';

  const identificacion =
    datos?.identificacion ??
    '—';

  const correo =
    datos?.correoEstudiantil ??
    '—';

  const aprobadas =
    Array.isArray(
      datos?.asignaturasAprobadas
    )
      ? datos.asignaturasAprobadas.length
      : 0;

  const codigos = Array.isArray(datos?.asignaturasAprobadas)
    ? datos.asignaturasAprobadas.map((a) => a.codigo || `ID #${a.planAsignaturaId}`).join(', ')
    : '';

  const aprobadasHtml = aprobadas > 0
    ? `<span title="${escapeHtml(codigos)}" style="cursor:help;"><strong>${aprobadas}</strong> asignaturas<small style="display:block;color:var(--text-muted);font-size:0.75rem;">${escapeHtml(codigos)}</small></span>`
    : `<span class="text-muted">0 asignaturas</span>`;

  const esPendiente =
    respuesta.estado === 'PENDIENTE' ||
    respuesta.estado === 'REQUIERE_REVISION';

  const accionesHtml = esPendiente
    ? `
      <div class="sgpa-table-actions" style="display:inline-flex;gap:4px;">
        <button
          type="button"
          class="btn btn-sm btn-primary btn-accion-aprobar-resp"
          data-id="${respuesta.id}"
          data-estudiante="${escapeHtml(nombre)}"
          title="Aprobar solicitud e incorporar materias"
        >
          <i data-lucide="check" aria-hidden="true"></i>
          Aprobar
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-danger btn-accion-rechazar-resp"
          data-id="${respuesta.id}"
          data-estudiante="${escapeHtml(nombre)}"
          title="Rechazar solicitud con motivo"
        >
          <i data-lucide="x" aria-hidden="true"></i>
          Rechazar
        </button>
      </div>
    `
    : `
      <span class="text-muted">—</span>
    `;

  return `
    <tr>
      <td>
        ${escapeHtml(nombre)}
      </td>

      <td>
        ${escapeHtml(
          identificacion
        )}
      </td>

      <td>
        ${escapeHtml(correo)}
      </td>

      <td>
        ${aprobadasHtml}
      </td>

      <td>
        ${escapeHtml(
          respuesta.estado ||
          '—'
        )}
      </td>

      <td>
        ${escapeHtml(
          formatearFechaHora(
            respuesta.procesadoAt
          )
        )}
      </td>

      <td>
        ${escapeHtml(
          respuesta.detalleError ||
          datos?.optativasNoDisciplinarias ||
          '—'
        )}
      </td>

      <td>
        ${accionesHtml}
      </td>
    </tr>
  `;
}

function formatearFechaHora(
  valor
) {
  if (!valor) {
    return '—';
  }

  const fecha =
    new Date(valor);

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return String(valor);
  }

  return new Intl.DateTimeFormat(
    'es-CR',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short'
    }
  ).format(fecha);
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

async function publicarFormulario(
  formulario,
  button
) {
  const aceptado = await confirmarAccion({
    titulo: 'Publicar formulario',
    mensaje: `¿Desea publicar el formulario "${formulario.titulo}"? Quedará disponible inmediatamente para recibir respuestas de los estudiantes mediante su enlace público institucional.`,
    textoConfirmar: 'Publicar formulario',
    peligro: false
  });

  if (!aceptado) return;

  button.disabled = true;

  try {
    const res = await publicarFormularioEstudiantes(formulario.id);
    if (res && res.ok === false) {
      throw new Error(res.message || 'No fue posible publicar el formulario.');
    }

    mostrarExito({
      titulo: 'Formulario publicado',
      mensaje: `El formulario "${formulario.titulo}" ahora está disponible públicamente.`
    });

    await cargarFormularios();
  } catch (error) {
    mostrarError({
      titulo: 'No fue posible publicar el formulario',
      mensaje: error?.message || 'Ocurrió un error al publicar el formulario.'
    });
  } finally {
    button.disabled = false;
  }
}

async function regenerarTokenFormulario(
  formulario,
  button
) {
  const aceptado = await confirmarAccion({
    titulo: 'Regenerar enlace público',
    mensaje: `Al regenerar el enlace del formulario "${formulario.titulo}", el enlace anterior quedará INVALIDADO de inmediato y los estudiantes requerirán el nuevo enlace para responder. ¿Desea continuar?`,
    textoConfirmar: 'Regenerar enlace',
    peligro: true
  });

  if (!aceptado) return;

  button.disabled = true;

  try {
    const res = await regenerarTokenFormularioEstudiantes(formulario.id);
    if (res && res.ok === false) {
      throw new Error(res.message || 'No fue posible regenerar el enlace público.');
    }

    mostrarExito({
      titulo: 'Enlace regenerado',
      mensaje: 'Se generó un nuevo enlace público. El enlace anterior ya no aceptará respuestas.'
    });

    await cargarFormularios();
  } catch (error) {
    mostrarError({
      titulo: 'No fue posible regenerar el enlace',
      mensaje: error?.message || 'Ocurrió un error al regenerar el enlace público.'
    });
  } finally {
    button.disabled = false;
  }
}

async function cerrarFormulario(
  formulario,
  button
) {
  const esInterno = formulario.proveedor === 'INTERNO';
  const aceptado =
    await confirmarAccion({
      titulo:
        'Cerrar formulario',

      mensaje: esInterno
        ? `El formulario institucional "${formulario.titulo}" dejará de aceptar respuestas de estudiantes de inmediato. Las respuestas registradas se conservarán.`
        : `El formulario "${formulario.titulo}" dejará de aceptar nuevas respuestas. Las respuestas existentes se conservarán.`,

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

    let sincronizacionFinal = null;
    if (!esInterno) {
      try {
        const resultadoSync = await sincronizarFormularioEstudiantes(
          formulario.id,
        );
        if (resultadoSync && resultadoSync.ok !== false) {
          sincronizacionFinal = resultadoSync.data ?? resultadoSync;
        }
      } catch (error) {
        console.error(
          'El formulario se cerró, pero falló la sincronización final:',
          error,
        );
      }
    }

    mostrarExito({
      titulo: 'Formulario cerrado',
      mensaje: esInterno
        ? `El formulario institucional "${formulario.titulo}" fue cerrado y ya no acepta respuestas.`
        : (sincronizacionFinal
            ? (
                'Google Forms dejó de aceptar nuevas respuestas. ' +
                `La sincronización final detectó ${
                  sincronizacionFinal.nuevas ?? 0
                } respuesta(s) nueva(s).`
              )
            : (
                'Google Forms dejó de aceptar nuevas respuestas. ' +
                'La información existente permanece disponible.'
              )),
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
    const resultado = await conectarGoogleFormularios();

    if (resultado?.ok !== true || resultado?.abierto !== true) {
      throw new Error(
        resultado?.message ||
        'No fue posible abrir la autorización de Google en el navegador.'
      );
    }

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
      requiereReautenticacion: false,
      estado: 'DESCONECTADO',
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

  if (carrerasDisponibles.length === 0) {
    mostrarError({
      titulo: 'No hay carreras activas',
      mensaje: 'Registre o habilite una carrera antes de crear un formulario.'
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
      <span>Modalidad del formulario</span>
      <select id="formularioProveedor" name="proveedor" required>
        <option value="INTERNO" selected>Formulario institucional SGPA (sin Google)</option>
        <option value="GOOGLE_FORMS">Google Forms (requiere conexión Google)</option>
      </select>
      <small id="formularioProveedorAyuda" class="sgpa-field-help">
        El formulario institucional usa el plan de estudios del SGPA y se publica en este servidor.
      </small>
    </label>

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
        Este será el título visible para los estudiantes en el formulario web.
      </small>
    </label>

    <label class="sgpa-form-wide">
      <span>
        Descripción
      </span>

      <textarea
        id="formularioDescripcion"
        name="descripcion"
        rows="3"
        maxlength="1000"
        placeholder="Ej. Complete este formulario con sus datos personales y las asignaturas aprobadas hasta el período actual."
        required
      ></textarea>

      <small class="sgpa-field-help">
        Esta descripción aparecerá en el encabezado del formulario institucional.
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
        'Seleccione la modalidad, la carrera y el plan de estudio.',

      body,

      errorId:
        'nuevoFormularioEstudianteError',

      cancelButtonId:
        'cancelarNuevoFormularioButton',

      submitButtonId:
        'crearFormularioButton',

      submitText:
        'Crear formulario',

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

  const proveedorInput =
    document.getElementById(
      'formularioProveedor'
    );

  let planSeleccionadoValido = false;
  let versionConsultaPlan = 0;

  carreraInput?.addEventListener(
    'change',
    () => {
      versionConsultaPlan += 1;
      planSeleccionadoValido = false;
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

      const versionActual = ++versionConsultaPlan;

      planSeleccionadoValido = false;

      if (!resumen || !planId) {
        return;
      }

      const consultaSigueVigente = () =>
        versionActual === versionConsultaPlan &&
        planInput.isConnected &&
        document.getElementById('formularioPlan') === planInput &&
        Number(planInput.value) === planId;

      resumen.innerHTML = `
        <div class="formularios-plan-preview formularios-plan-preview-loading">
          Consultando estructura del plan...
        </div>
      `;

      try {
        const resultado =
          await listarPlanAsignaturas(
            planId
          );

        if (!consultaSigueVigente()) return;

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

        const proveedor = proveedorInput?.value;
        const reales = asignaturasElegiblesParaFormulario(asignaturas, proveedor);

        planSeleccionadoValido =
          reales.length > 0;

        const estructura = agruparAsignaturasVistaPrevia(reales);

        const planSeleccionado =
          planesDisponibles.find(
            (plan) => plan.id === planId
          );

        const tarjetas =
          [...estructura.entries()]
            .sort(([nivelA], [nivelB]) =>
              nivelA - nivelB
            )
            .map(([nivel, ciclosNivel]) => `
              <article class="formularios-plan-preview-card">
                <h5>Año ${nivel}</h5>
                ${[...ciclosNivel.entries()]
                  .sort(([cicloA], [cicloB]) =>
                    cicloA - cicloB
                  )
                  .map(([ciclo, cursos]) => `
                    <div class="formularios-plan-preview-cycle">
                      <strong>Ciclo ${ciclo}</strong>
                      <ul>
                        ${cursos
                          .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
                          .map((asignatura) => `
                            <li>
                              ${escapeHtml(asignatura.curso?.nombre || asignatura.nombreReferencia || '')}
                              <small>${escapeHtml(asignatura.curso?.codigo || asignatura.codigoReferencia || '')}</small>
                            </li>
                          `).join('')}
                      </ul>
                    </div>
                  `)
                  .join('')}
              </article>
            `)
            .join('');

        resumen.innerHTML = `
          <section class="formularios-plan-preview ${
            reales.length
              ? ''
              : 'formularios-plan-preview-warning'
          }">
            <div class="formularios-plan-preview-heading">
              <div>
                <small>Plan seleccionado</small>
                <strong>${escapeHtml(
                  planSeleccionado?.nombre ||
                  'Plan de estudio'
                )}</strong>
              </div>
              <span>
                ${reales.length} asignatura${reales.length === 1 ? '' : 's'}
              </span>
            </div>
            ${
              reales.length
                ? `<div class="formularios-plan-preview-grid">${tarjetas}</div>`
                : `
                    <p>
                      Este plan no tiene asignaturas compatibles con la modalidad seleccionada
                      y no puede utilizarse para generar el formulario.
                    </p>
                  `
            }
          </section>
        `;
      } catch (error) {
        if (!consultaSigueVigente()) return;
        planSeleccionadoValido = false;
        resumen.innerHTML = `
          <div class="formularios-plan-preview formularios-plan-preview-warning">
            No fue posible consultar las asignaturas de este plan.
            Cambie el plan o intente seleccionarlo nuevamente.
          </div>
        `;
      }
    }
  );

  proveedorInput?.addEventListener('change', () => {
    const ayuda = document.getElementById('formularioProveedorAyuda');
    if (ayuda) {
      ayuda.textContent = proveedorInput.value === 'INTERNO'
        ? 'El formulario institucional usa el plan de estudios del SGPA y se publica en este servidor.'
        : 'Google Forms requiere una cuenta Google conectada y solo admite asignaturas vinculadas a Curso.';
    }
    if (planInput?.value) planInput.dispatchEvent(new Event('change'));
  });

  document
    .getElementById(
      'cancelarNuevoFormularioButton'
    )
    ?.addEventListener(
      'click',
      () => dialog.close()
    );

  let estaCreando = false;

  document
    .getElementById(
      'nuevoFormularioEstudianteForm'
    )
    ?.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        if (estaCreando) {
          return;
        }

        const tituloInput =
          document.getElementById(
            'formularioTitulo'
          );

        const descripcionInput =
          document.getElementById(
            'formularioDescripcion'
          );

        const errorBox =
          document.getElementById(
            'nuevoFormularioEstudianteError'
          );

        const crearButton =
          document.getElementById(
            'crearFormularioButton'
          );

        const cancelarButton =
          document.getElementById(
            'cancelarNuevoFormularioButton'
          );

        if (
          !tituloInput ||
          !descripcionInput ||
          !carreraInput ||
          !planInput ||
          !crearButton
        ) {
          return;
        }

        const titulo =
          tituloInput.value.trim();

        const descripcion =
          descripcionInput.value.trim();

        const carreraId =
          Number(
            carreraInput.value
          );

        const planEstudioId =
          Number(
            planInput.value
          );

        const esInterno = proveedorInput?.value === 'INTERNO';

        if (
          !titulo ||
          !descripcion ||
          !carreraId ||
          !planEstudioId ||
          !planSeleccionadoValido
        ) {
          if (errorBox) {
            errorBox.textContent =
              planEstudioId && !planSeleccionadoValido
                ? 'El plan seleccionado debe incluir asignaturas compatibles con la modalidad elegida.'
                : 'Complete el título, la descripción, la carrera y el plan de estudio.';

            errorBox.classList.remove(
              'hidden'
            );
          }

          return;
        }

        errorBox?.classList.add(
          'hidden'
        );

        estaCreando = true;
        crearButton.disabled = true;
        if (cancelarButton) {
          cancelarButton.disabled = true;
        }
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

        let avisoCarga =
          document.getElementById(
            'formulariosCreandoNotice'
          );

        if (!avisoCarga && scrollContainer) {
          avisoCarga =
            document.createElement('div');
          avisoCarga.id =
            'formulariosCreandoNotice';
          avisoCarga.className =
            'formularios-creando-notice';
          avisoCarga.innerHTML = `
            <span class="formularios-pulse-dot" aria-hidden="true"></span>
            <span>${esInterno
              ? 'Generando el formulario institucional...'
              : 'Generando el formulario en Google Forms...'} Por favor espere.</span>
          `;
          scrollContainer.appendChild(avisoCarga);
        }

        try {
          const res =
            await crearFormularioEstudiantes(construirDatosCrearFormulario({
              titulo,
              descripcion,
              carreraId,
              planEstudioId,
              proveedor: proveedorInput?.value
            }));

          if (res && res.ok === false) {
            throw new Error(
              res.message ||
              'No fue posible crear el formulario.'
            );
          }

          dialog.close();

          const formulario =
            res?.data ?? res;

          const estaPublicado =
            formulario?.estado === 'PUBLICADO' ||
            Boolean(formulario?.responderUri);

          mostrarExito({
            titulo:
              estaPublicado
                ? 'Formulario publicado'
                : 'Formulario creado',
            mensaje:
              estaPublicado
                ? esInterno
                  ? 'El formulario fue creado y publicado correctamente en el SGPA.'
                  : 'El formulario fue creado y publicado correctamente en Google Forms.'
                : `El formulario fue registrado. Estado: ${formulario?.estado || 'CREADO'}.`
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
          estaCreando = false;
          crearButton.disabled = false;
          if (cancelarButton) {
            cancelarButton.disabled = false;
          }
          tituloInput.disabled = false;
          descripcionInput.disabled = false;
          carreraInput.disabled = false;
          planInput.disabled = false;

          document
            .getElementById(
              'formulariosCreandoNotice'
            )
            ?.remove();

          crearButton.innerHTML = `
            <i data-lucide="file-plus" aria-hidden="true"></i>
            <span>Crear formulario</span>
          `;

          renderizarIconos();
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

          requiereReautenticacion:
            Boolean(
              googleData?.requiereReautenticacion ||
              googleData?.estado === 'REQUIERE_REAUTENTICACION'
            ),

          estado:
            googleData?.estado ??
            'DESCONECTADO',

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

      requiereReautenticacion:
        Boolean(
          googleData?.requiereReautenticacion ||
          googleData?.estado === 'REQUIERE_REAUTENTICACION'
        ),

      estado:
        googleData?.estado ??
        'DESCONECTADO',

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
