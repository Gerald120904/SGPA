import {
  DataTable
} from '../../components/DataTable.js';

import {
  FormDialog,
  habilitarCierreExterior
} from '../../components/FormDialog.js';

import {
  mostrarError,
  mostrarExito
} from '../../components/AlertModal.js';

import {
  usuarioTienePermiso
} from '../../app/session.js';

import {
  listarEstudiantes,
  obtenerEstudiante,
  actualizarEstudiante,
  crearEstudiante,
  cambiarEstadoEstudiante,
  cambiarPlanEstudiante,
  obtenerHistorialAcademicoEstudiante,
  obtenerHistorialPlanesEstudiante,
  obtenerProgresoEstudiante,
  registrarResultadoAcademicoEstudiante,
  contarEstudiantesPorCarrera,
  contarEstudiantesPorPlan
} from '../../services/estudiantes.service.js';

import {
  seleccionarExcelEstudiantes,
  guardarPlantillaExcelEstudiantes,
  validarImportacionEstudiantes,
  ejecutarImportacionEstudiantes
} from '../../services/estudiantes-importacion.service.js';

import {
  listarPlanAsignaturas
} from '../../services/plan-asignaturas.service.js';

import {
  listarCarreras
} from '../../services/carreras.service.js';

import {
  listarPlanesEstudio
} from '../../services/planes-estudio.service.js';

import {
  listarPeriodosAcademicos
} from '../../services/periodos.service.js';

import {
  listarSolicitudesFormularios,
  aceptarSolicitudFormulario,
  rechazarSolicitudFormulario,
  contarSolicitudesPorPlan
} from '../../services/formularios-estudiantes.service.js';

import {
  confirmarAccion
} from '../../utils/confirm.js';

import {
  escapeHtml
} from '../../utils/html.js';

import {
  renderizarIconos
} from '../../utils/icons.js';

let carreraSeleccionada = null;

let planSeleccionado = null;

let vistaActual = 'CARRERAS';

let carrerasDisponibles = [];

let planesDisponibles = [];

let estudiantes = [];

let catalogoEstudiantes = [];

let solicitudesFormularios = [];

let intervaloSolicitudes = null;

let instanciaActual = 0;

let timerBusqueda = null;

const PERMISOS = {
  GESTIONAR:
    'ESTUDIANTES_GESTIONAR'
};

const ESTADOS = [
  {
    value: 'ACTIVO',
    label: 'Activo'
  },
  {
    value: 'INACTIVO',
    label: 'Inactivo'
  },
  {
    value: 'GRADUADO',
    label: 'Graduado'
  },
  {
    value: 'RETIRADO',
    label: 'Retirado'
  }
];

const ORIGENES_ACADEMICOS = [
  {
    value: 'CURSADO',
    label: 'Cursado'
  },
  {
    value: 'RECONOCIMIENTO',
    label: 'Reconocimiento'
  },
  {
    value: 'EQUIVALENCIA',
    label: 'Equivalencia'
  },
  {
    value: 'NO_ESPECIFICADO',
    label: 'No especificado'
  }
];

const RESULTADOS_ACADEMICOS = [
  {
    value: 'APROBADO',
    label: 'Aprobado'
  },
  {
    value: 'REPROBADO',
    label: 'Reprobado'
  }
];

export function EstudiantesPage() {
  return `
    <section
      id="estudiantesPage"
      class="module-view"
    >
      <div class="planes-toolbar" style="margin-bottom: 1.25rem;">
        <div>
          <nav
            aria-label="Ruta de navegación"
            style="font-size: 0.9rem; color: var(--color-muted, #64748b); margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.5rem;"
          >
            <span id="estudiantesBreadcrumb">
              Estudiantes
            </span>
          </nav>

          <h2>
            Estudiantes
          </h2>

          <p>
            Gestión de estudiantes y seguimiento académico.
          </p>
        </div>
      </div>

      <div id="estudiantesNavegacion"></div>

      <dialog
        id="estudianteDialog"
        class="sgpa-form-dialog sgpa-form-dialog-md"
      >
        <div id="estudianteDialogContent"></div>
      </dialog>
    </section>
  `;
}

function extraerData(resultado) {
  if (
    resultado &&
    Object.prototype.hasOwnProperty.call(
      resultado,
      'data'
    )
  ) {
    return resultado.data;
  }

  return resultado;
}

function obtenerNombreCompleto(
  estudiante
) {
  return [
    estudiante.nombres,
    estudiante.apellido1,
    estudiante.apellido2
  ]
    .filter(Boolean)
    .join(' ');
}

function formatearEstado(
  estado
) {
  return (
    ESTADOS.find(
      (item) =>
        item.value === estado
    )?.label ||
    estado ||
    '—'
  );
}

function obtenerTextoAsignatura(item) {
  const asignatura =
    item?.planAsignatura ??
    item?.asignatura ??
    item ??
    {};

  const curso =
    asignatura.curso ?? {};

  const codigo =
    curso.codigo ??
    asignatura.codigo ??
    '';

  const nombre =
    curso.nombre ??
    asignatura.nombre ??
    '';

  if (codigo && nombre) {
    return `${codigo} - ${nombre}`;
  }

  return (
    codigo ||
    nombre ||
    `Asignatura #${
      asignatura.id ??
      asignatura.planAsignaturaId ??
      '—'
    }`
  );
}

function obtenerTextoPeriodo(periodo) {
  if (!periodo) {
    return '—';
  }

  return (
    periodo.codigo ||
    periodo.nombre ||
    `Período #${periodo.id}`
  );
}

function obtenerTextoPlan(plan) {
  if (!plan) {
    return '—';
  }

  const codigo =
    plan.codigo || '';

  const nombre =
    plan.nombre || '';

  if (codigo && nombre) {
    return `${codigo} - ${nombre}`;
  }

  return (
    codigo ||
    nombre ||
    `Plan #${plan.id}`
  );
}

function obtenerNombreResponsable(usuario) {
  if (!usuario) {
    return '—';
  }

  return (
    usuario.nombreCompleto ||
    usuario.nombre ||
    usuario.correo ||
    usuario.email ||
    '—'
  );
}

function formatearFechaHora(valor) {
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
      dateStyle: 'medium',
      timeStyle: 'short'
    }
  ).format(fecha);
}

function formatearTextoEnum(valor) {
  if (!valor) {
    return '—';
  }

  return String(valor)
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(
      /^\w/,
      (letra) =>
        letra.toUpperCase()
    );
}

function renderizarEstudiantes() {
  const contenedor =
    document.getElementById(
      'estudiantesContent'
    );

  if (!contenedor) {
    return;
  }

  const puedeGestionar =
    usuarioTienePermiso(
      PERMISOS.GESTIONAR
    );

  const rows =
    estudiantes
      .map(
        (estudiante) => `
          <tr
            data-estudiante-id="${estudiante.id}"
          >
            <td>
              <strong>
                ${escapeHtml(
                  estudiante.cedula
                )}
              </strong>
            </td>

            <td>
              ${escapeHtml(
                obtenerNombreCompleto(
                  estudiante
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                estudiante.correoInstitucional
              )}
            </td>

            <td>
              ${escapeHtml(
                estudiante.carrera?.codigo ||
                estudiante.carrera?.nombre ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                estudiante.planEstudio?.codigo ||
                estudiante.planEstudio?.nombre ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                estudiante.periodoIngreso?.codigo ||
                estudiante.periodoIngreso?.nombre ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                formatearEstado(
                  estudiante.estado
                )
              )}
            </td>

            <td>
              <div
                class="table-actions"
                style="display: inline-flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;"
              >
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-action="ver"
                  data-id="${estudiante.id}"
                  title="Ver estudiante"
                >
                  <i
                    data-lucide="eye"
                    aria-hidden="true"
                  ></i>
                </button>

                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-action="expediente"
                  data-id="${estudiante.id}"
                  title="Ver expediente académico"
                >
                  <i
                    data-lucide="folder-open"
                    aria-hidden="true"
                  ></i>
                </button>

                ${
                  puedeGestionar
                    ? `
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-action="editar"
                        data-id="${estudiante.id}"
                        title="Editar estudiante"
                      >
                        <i
                          data-lucide="pencil"
                          aria-hidden="true"
                        ></i>
                      </button>

                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-action="estado"
                        data-id="${estudiante.id}"
                        title="Cambiar estado"
                      >
                        <i
                          data-lucide="toggle-left"
                          aria-hidden="true"
                        ></i>
                      </button>

                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-action="plan"
                        data-id="${estudiante.id}"
                        title="Cambiar plan"
                      >
                        <i
                          data-lucide="repeat-2"
                          aria-hidden="true"
                        ></i>
                      </button>
                    `
                    : ''
                }
              </div>
            </td>
          </tr>
        `
      )
      .join('');

  contenedor.innerHTML =
    DataTable({
      columns: [
        'Cédula',
        'Estudiante',
        'Correo institucional',
        'Carrera',
        'Plan',
        'Ingreso',
        'Estado',
        'Acciones'
      ],

      rows,

      emptyMessage:
        'No se encontraron estudiantes.',

      ariaLabel:
        'Listado de estudiantes'
    });

  renderizarIconos();
}

function renderizarHistorialAcademico(
  historial
) {
  const contenedor =
    document.getElementById(
      'expedienteHistorialAcademico'
    );

  if (!contenedor) {
    return;
  }

  const rows =
    historial
      .map(
        (item) => `
          <tr>
            <td>
              ${escapeHtml(
                obtenerTextoAsignatura(
                  item
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                obtenerTextoPeriodo(
                  item.periodo
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                item.resultado ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                formatearTextoEnum(
                  item.origenAcademico
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                formatearTextoEnum(
                  item.fuenteRegistro
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                item.observaciones ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                obtenerNombreResponsable(
                  item.registradoPor
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                formatearFechaHora(
                  item.createdAt
                )
              )}
            </td>
          </tr>
        `
      )
      .join('');

  contenedor.innerHTML =
    DataTable({
      columns: [
        'Asignatura',
        'Período',
        'Resultado',
        'Origen',
        'Fuente',
        'Observaciones',
        'Registrado por',
        'Fecha'
      ],

      rows,

      emptyMessage:
        'El estudiante todavía no posee historial académico.',

      ariaLabel:
        'Historial académico del estudiante'
    });
}

function renderizarHistorialPlanes(
  historial
) {
  const contenedor =
    document.getElementById(
      'expedienteHistorialPlanes'
    );

  if (!contenedor) {
    return;
  }

  const rows =
    historial
      .map(
        (item) => `
          <tr>
            <td>
              ${escapeHtml(
                obtenerTextoPlan(
                  item.planAnterior
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                obtenerTextoPlan(
                  item.planNuevo
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                obtenerTextoPeriodo(
                  item.periodoCambio
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                item.motivo ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                obtenerNombreResponsable(
                  item.cambiadoPor
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                formatearFechaHora(
                  item.createdAt
                )
              )}
            </td>
          </tr>
        `
      )
      .join('');

  contenedor.innerHTML =
    DataTable({
      columns: [
        'Plan anterior',
        'Plan nuevo',
        'Período',
        'Motivo',
        'Responsable',
        'Fecha'
      ],

      rows,

      emptyMessage:
        'El estudiante no registra cambios de plan.',

      ariaLabel:
        'Historial de planes del estudiante'
    });
}

function renderizarProgresoEstudiante(
  progreso
) {
  const contenedor =
    document.getElementById(
      'expedienteProgreso'
    );

  if (!contenedor) {
    return;
  }

  const resumen =
    progreso?.resumen ?? {};

  const reprobadas =
    Array.isArray(
      progreso?.reprobadas
    )
      ? progreso.reprobadas.length
      : 0;

  const resumenTable =
    DataTable({
      columns: [
        'Total del plan',
        'Aprobadas',
        'Reprobadas',
        'Pendientes',
        'Rezagadas'
      ],

      rows: `
        <tr>
          <td>
            ${resumen.totalPlan ?? 0}
          </td>

          <td>
            ${resumen.aprobadas ?? 0}
          </td>

          <td>
            ${reprobadas}
          </td>

          <td>
            ${resumen.pendientes ?? 0}
          </td>

          <td>
            ${resumen.rezagadas ?? 0}
          </td>
        </tr>
      `,

      emptyMessage:
        'No existe información de progreso.',

      ariaLabel:
        'Resumen de progreso académico'
    });

  const habilitadas =
    Array.isArray(
      progreso?.habilitadas
    )
      ? progreso.habilitadas
      : [];

  const filasHabilitadas =
    habilitadas
      .map(
        (item) => {
          const requisitos =
            Array.isArray(
              item.requisitosFaltantes
            )
              ? item
                  .requisitosFaltantes
                  .map(
                    obtenerTextoAsignatura
                  )
                  .join(', ')
              : '';

          const correquisitos =
            Array.isArray(
              item.correquisitos
            )
              ? item.correquisitos
                  .map(
                    obtenerTextoAsignatura
                  )
                  .join(', ')
              : '';

          return `
            <tr>
              <td>
                ${escapeHtml(
                  obtenerTextoAsignatura(
                    item
                  )
                )}
              </td>

              <td>
                ${
                  item.habilitada
                    ? 'Habilitada'
                    : 'Bloqueada'
                }
              </td>

              <td>
                ${escapeHtml(
                  requisitos || '—'
                )}
              </td>

              <td>
                ${escapeHtml(
                  correquisitos || '—'
                )}
              </td>
            </tr>
          `;
        }
      )
      .join('');

  const habilitadasTable =
    DataTable({
      columns: [
        'Asignatura',
        'Estado',
        'Requisitos faltantes',
        'Correquisitos'
      ],

      rows:
        filasHabilitadas,

      emptyMessage:
        'No hay asignaturas pendientes para evaluar.',

      ariaLabel:
        'Asignaturas habilitadas del estudiante'
    });

  const rezagadas =
    Array.isArray(
      progreso?.rezagadas
    )
      ? progreso.rezagadas
      : [];

  const rezagadasTable =
    DataTable({
      columns: [
        'Asignatura'
      ],

      rows:
        rezagadas
          .map(
            (item) => `
              <tr>
                <td>
                  ${escapeHtml(
                    obtenerTextoAsignatura(
                      item
                    )
                  )}
                </td>
              </tr>
            `
          )
          .join(''),

      emptyMessage:
        'No hay asignaturas rezagadas para este período de referencia.',

      ariaLabel:
        'Asignaturas rezagadas'
    });

  contenedor.innerHTML = `
    <h3>
      Resumen
    </h3>

    ${resumenTable}

    <h3>
      Habilitación de asignaturas
    </h3>

    ${habilitadasTable}

    <h3>
      Rezago académico
    </h3>

    ${rezagadasTable}
  `;

  renderizarIconos();
}

function renderizarRuta() {
  if (!carreraSeleccionada) {
    return 'Estudiantes';
  }

  if (!planSeleccionado) {
    return `
      Estudiantes
      › ${escapeHtml(carreraSeleccionada.nombre)}
    `;
  }

  return `
    Estudiantes
    › ${escapeHtml(carreraSeleccionada.nombre)}
    › ${escapeHtml(planSeleccionado.nombre || planSeleccionado.codigo)}
  `;
}

function detenerPollingSolicitudes() {
  if (!intervaloSolicitudes) {
    return;
  }

  window.clearInterval(
    intervaloSolicitudes
  );

  intervaloSolicitudes = null;
}

function actualizarEncabezadoYRuta() {
  const breadcrumb =
    document.getElementById(
      'estudiantesBreadcrumb'
    );

  if (breadcrumb) {
    breadcrumb.innerHTML =
      renderizarRuta();
  }
}

async function mostrarCarreras() {
  detenerPollingSolicitudes();
  vistaActual = 'CARRERAS';
  carreraSeleccionada = null;
  planSeleccionado = null;
  estudiantes = [];

  const contenedor =
    document.getElementById(
      'estudiantesNavegacion'
    );

  if (!contenedor) {
    return;
  }

  actualizarEncabezadoYRuta();

  contenedor.innerHTML = `
    <div class="planes-toolbar">
      <div>
        <h3>Seleccione una carrera</h3>
        <p>Elija una carrera para ver sus planes de estudio y estudiantes asociados.</p>
      </div>
    </div>
    <div class="carreras-message">Cargando carreras...</div>
  `;

  try {
    const [
      resultadoCarreras,
      resultadoPlanes,
      resultadoConteos
    ] = await Promise.all([
      listarCarreras(),
      listarPlanesEstudio(),
      contarEstudiantesPorCarrera()
    ]);

    if (!resultadoCarreras?.ok) {
      throw new Error(
        resultadoCarreras?.message ||
        'No fue posible consultar las carreras.'
      );
    }

    const lista =
      Array.isArray(
        resultadoCarreras.carreras
      )
        ? resultadoCarreras.carreras
        : (Array.isArray(resultadoCarreras.data) ? resultadoCarreras.data : []);

    const todosPlanes =
      Array.isArray(resultadoPlanes?.planes)
        ? resultadoPlanes.planes
        : (Array.isArray(resultadoPlanes?.data) ? resultadoPlanes.data : []);

    const conteos =
      Array.isArray(resultadoConteos)
        ? resultadoConteos
        : (Array.isArray(resultadoConteos?.data) ? resultadoConteos.data : []);

    const estudiantesPorCarrera = new Map(
      conteos.map((item) => [
        Number(item.carreraId),
        Number(item.total)
      ])
    );

    const planesPorCarrera = new Map();
    for (const plan of todosPlanes) {
      const cId = Number(plan.carreraId || plan.carrera?.id);
      if (cId) {
        planesPorCarrera.set(cId, (planesPorCarrera.get(cId) || 0) + 1);
      }
    }

    carrerasDisponibles = lista;

    if (lista.length === 0) {
      contenedor.innerHTML = `
        <div class="planes-toolbar">
          <div>
            <h3>Seleccione una carrera</h3>
            <p>Elija una carrera para ver sus planes de estudio y estudiantes asociados.</p>
          </div>
        </div>
        <div class="carreras-message" style="text-align: center; padding: 2rem;">
          No tiene carreras asignadas o disponibles.
        </div>
      `;
      renderizarIconos();
      return;
    }

    contenedor.innerHTML = `
      <div class="planes-toolbar">
        <div>
          <h3>Seleccione una carrera</h3>
          <p>Elija una carrera para ver sus planes de estudio y estudiantes asociados.</p>
        </div>
      </div>

      <div class="modules-dashboard-grid">
        ${lista
          .map(
            (carrera) => {
              const numPlanes = planesPorCarrera.get(Number(carrera.id)) ?? 0;
              const numEstudiantes = estudiantesPorCarrera.get(Number(carrera.id)) ?? 0;

              return `
              <button
                type="button"
                class="module-card"
                data-carrera-id="${carrera.id}"
                aria-label="Seleccionar ${escapeHtml(carrera.nombre)}"
              >
                <span
                  class="module-card-decoration"
                  aria-hidden="true"
                ></span>

                <div class="module-card-top">
                  <div class="module-card-icon">
                    <i
                      data-lucide="graduation-cap"
                      aria-hidden="true"
                    ></i>
                  </div>
                </div>

                <div class="module-card-content">
                  <strong>
                    ${escapeHtml(carrera.nombre)}
                  </strong>

                  <p style="font-size: 0.85rem; color: var(--color-muted, #64748b); margin-top: 0.25rem;">
                    ${numPlanes} ${numPlanes === 1 ? 'plan' : 'planes'} &middot; ${numEstudiantes} ${numEstudiantes === 1 ? 'estudiante' : 'estudiantes'}
                  </p>
                  ${
                    carrera.descripcion
                      ? `<p>${escapeHtml(carrera.descripcion)}</p>`
                      : ''
                  }
                </div>

                <div class="module-card-action">
                  <span>Ver planes</span>
                  <i
                    data-lucide="chevron-right"
                    aria-hidden="true"
                  ></i>
                </div>

                <span
                  class="module-card-hover-line"
                  aria-hidden="true"
                ></span>
              </button>
            `;
            }
          )
          .join('')}
      </div>
    `;

    renderizarIconos();
  } catch (error) {
    console.error(
      'Error cargando carreras:',
      error
    );

    contenedor.innerHTML = `
      <div class="planes-toolbar">
        <div>
          <h3>Seleccione una carrera</h3>
        </div>
      </div>
      <div class="carreras-message carreras-error" role="alert">
        <h3>No fue posible cargar las carreras</h3>
        <p>${escapeHtml(error?.message || 'Error de conexión.')}</p>
      </div>
    `;
    renderizarIconos();
  }
}

async function mostrarPlanesCarrera(carrera) {
  detenerPollingSolicitudes();
  vistaActual = 'PLANES';
  carreraSeleccionada = carrera;
  planSeleccionado = null;
  estudiantes = [];

  const contenedor =
    document.getElementById(
      'estudiantesNavegacion'
    );

  if (!contenedor) {
    return;
  }

  actualizarEncabezadoYRuta();

  contenedor.innerHTML = `
    <div class="planes-toolbar">
      <div>
        <button
          type="button"
          id="volverACarrerasBtn"
          class="btn btn-secondary btn-sm"
          style="margin-bottom: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem;"
        >
          <i
            data-lucide="arrow-left"
            aria-hidden="true"
          ></i>
          Volver a carreras
        </button>

        <h3>Seleccione un plan de estudio</h3>
        <p>Planes de estudio de <strong>${escapeHtml(carrera.nombre)}</strong></p>
      </div>
    </div>
    <div class="carreras-message">Cargando planes de estudio...</div>
  `;
  renderizarIconos();

  try {
    const [
      resultadoPlanes,
      resultadoEstudiantes,
      resultadoSolicitudes
    ] = await Promise.all([
      listarPlanesEstudio(),
      contarEstudiantesPorPlan(carrera.id),
      contarSolicitudesPorPlan(carrera.id)
    ]);

    if (!resultadoPlanes?.ok) {
      throw new Error(
        resultadoPlanes?.message ||
        'No fue posible consultar los planes de estudio.'
      );
    }

    const todosPlanes =
      Array.isArray(resultadoPlanes.planes)
        ? resultadoPlanes.planes
        : (Array.isArray(resultadoPlanes.data) ? resultadoPlanes.data : []);

    const planesDeCarrera = todosPlanes.filter(
      (p) => p.carreraId === carrera.id || p.carrera?.id === carrera.id
    );

    const conteosEstudiantes =
      Array.isArray(resultadoEstudiantes)
        ? resultadoEstudiantes
        : (Array.isArray(resultadoEstudiantes?.data) ? resultadoEstudiantes.data : []);

    const conteosSolicitudes =
      Array.isArray(resultadoSolicitudes)
        ? resultadoSolicitudes
        : (Array.isArray(resultadoSolicitudes?.data) ? resultadoSolicitudes.data : []);

    const estudiantesPorPlan = new Map(
      conteosEstudiantes.map((item) => [
        Number(item.planEstudioId),
        Number(item.total)
      ])
    );

    const solicitudesPorPlan = new Map(
      conteosSolicitudes.map((item) => [
        Number(item.planEstudioId),
        Number(item.total)
      ])
    );

    planesDisponibles = planesDeCarrera;

    if (planesDeCarrera.length === 0) {
      contenedor.innerHTML = `
        <div class="planes-toolbar">
          <div>
            <button
              type="button"
              id="volverACarrerasBtn"
              class="btn btn-secondary btn-sm"
              style="margin-bottom: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem;"
            >
              <i
                data-lucide="arrow-left"
                aria-hidden="true"
              ></i>
              Volver a carreras
            </button>

            <h3>Seleccione un plan de estudio</h3>
            <p>Planes de estudio de <strong>${escapeHtml(carrera.nombre)}</strong></p>
          </div>
        </div>
        <div class="carreras-message" style="text-align: center; padding: 2rem;">
          Esta carrera no tiene planes de estudio registrados.
        </div>
      `;
      renderizarIconos();
      return;
    }

    contenedor.innerHTML = `
      <div class="planes-toolbar">
        <div>
          <button
            type="button"
            id="volverACarrerasBtn"
            class="btn btn-secondary btn-sm"
            style="margin-bottom: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem;"
          >
            <i
              data-lucide="arrow-left"
              aria-hidden="true"
            ></i>
            Volver a carreras
          </button>

          <h3>Seleccione un plan de estudio</h3>
          <p>Planes de estudio de <strong>${escapeHtml(carrera.nombre)}</strong></p>
        </div>
      </div>

      <div class="modules-dashboard-grid">
        ${planesDeCarrera
          .map(
            (plan) => {
              const numEst = estudiantesPorPlan.get(Number(plan.id)) ?? 0;
              const numSol = solicitudesPorPlan.get(Number(plan.id)) ?? 0;

              return `
              <button
                type="button"
                class="module-card"
                data-plan-id="${plan.id}"
                aria-label="Seleccionar ${escapeHtml(plan.nombre || plan.codigo)}"
              >
                <span
                  class="module-card-decoration"
                  aria-hidden="true"
                ></span>

                <div class="module-card-top">
                  <div class="module-card-icon">
                    <i
                      data-lucide="book-open"
                      aria-hidden="true"
                    ></i>
                  </div>
                </div>

                <div class="module-card-content">
                  <strong>
                    ${escapeHtml(plan.nombre || plan.codigo)}
                  </strong>

                  <p>
                    ${numEst} ${numEst === 1 ? 'estudiante' : 'estudiantes'} &middot; ${numSol} ${numSol === 1 ? 'solicitud' : 'solicitudes'}${numSol === 1 ? ' pendiente' : ' pendientes'}
                    &middot;
                    ${
                      plan.activo === false
                        ? '<span style="color: var(--color-danger, #ef4444); font-weight: 600;">Inactivo</span>'
                        : '<span style="color: var(--color-success, #10b981); font-weight: 600;">Activo</span>'
                    }
                  </p>
                </div>

                <div class="module-card-action">
                  <span>Ver estudiantes</span>
                  <i
                    data-lucide="chevron-right"
                    aria-hidden="true"
                  ></i>
                </div>

                <span
                  class="module-card-hover-line"
                  aria-hidden="true"
                ></span>
              </button>
            `;
            }
          )
          .join('')}
      </div>
    `;

    renderizarIconos();
  } catch (error) {
    console.error(
      'Error cargando planes de estudio:',
      error
    );

    contenedor.innerHTML = `
      <div class="planes-toolbar">
        <div>
          <button
            type="button"
            id="volverACarrerasBtn"
            class="btn btn-secondary btn-sm"
            style="margin-bottom: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem;"
          >
            <i
              data-lucide="arrow-left"
              aria-hidden="true"
            ></i>
            Volver a carreras
          </button>

          <h3>Seleccione un plan de estudio</h3>
        </div>
      </div>
      <div class="carreras-message carreras-error" role="alert">
        <h3>No fue posible cargar los planes de estudio</h3>
        <p>${escapeHtml(error?.message || 'Error de conexión.')}</p>
      </div>
    `;
    renderizarIconos();
  }
}

async function mostrarEstudiantesPlan() {
  vistaActual = 'ESTUDIANTES';

  const contenedor =
    document.getElementById(
      'estudiantesNavegacion'
    );

  if (!contenedor) {
    return;
  }

  actualizarEncabezadoYRuta();

  const puedeGestionar =
    usuarioTienePermiso(
      PERMISOS.GESTIONAR
    );

  contenedor.innerHTML = `
    <div class="planes-toolbar">
      <div>
        <button
          type="button"
          id="volverAPlanesBtn"
          class="btn btn-secondary btn-sm"
          style="margin-bottom: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem;"
        >
          <i
            data-lucide="arrow-left"
            aria-hidden="true"
          ></i>
          Volver a planes
        </button>

        <h3>Estudiantes de este plan</h3>
        <p>
          <strong>${escapeHtml(carreraSeleccionada.nombre)}</strong> › <strong>${escapeHtml(planSeleccionado.nombre || planSeleccionado.codigo)}</strong>
        </p>
      </div>

      ${
        puedeGestionar
          ? `
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <button
                id="importarEstudiantesExcelButton"
                type="button"
                class="btn btn-secondary"
              >
                <i
                  data-lucide="file-spreadsheet"
                  aria-hidden="true"
                ></i>

                Importar Excel
              </button>

              <button
                id="nuevoEstudianteButton"
                type="button"
                class="btn btn-primary"
              >
                <i
                  data-lucide="user-plus"
                  aria-hidden="true"
                ></i>

                Nuevo estudiante
              </button>
            </div>
          `
          : ''
      }
    </div>

    <div class="planes-filters">
      <label
        class="planes-search"
        for="estudiantesBuscar"
      >
        <i
          data-lucide="search"
          aria-hidden="true"
        ></i>

        <input
          id="estudiantesBuscar"
          type="search"
          placeholder="Buscar por cédula, nombre o correo..."
          autocomplete="off"
        >
      </label>

      <select
        id="estudiantesPeriodo"
        class="planes-select"
        aria-label="Filtrar por período de ingreso"
      >
        <option value="">
          Todos los períodos
        </option>
      </select>

      <select
        id="estudiantesEstado"
        class="planes-select"
        aria-label="Filtrar por estado"
      >
        <option value="">
          Todos los estados
        </option>

        ${ESTADOS.map(
          (estado) => `
            <option
              value="${estado.value}"
            >
              ${estado.label}
            </option>
          `
        ).join('')}
      </select>
    </div>

    <div
      id="estudiantesContent"
      aria-live="polite"
    >
      <div class="carreras-message">Cargando estudiantes...</div>
    </div>

    <div class="planes-toolbar" style="margin-top: 2rem;">
      <div>
        <h2>
          Solicitudes de formularios
        </h2>

        <p>
          Respuestas recibidas que requieren revisión antes de ingresar al padrón de estudiantes.
        </p>
      </div>

      <div>
        <strong id="solicitudesFormulariosContador">
          0 pendientes
        </strong>
      </div>
    </div>

    <div
      id="solicitudesFormulariosContent"
      aria-live="polite"
    ></div>
  `;

  renderizarIconos();

  vincularEventosVistaEstudiantes();

  await cargarEstudiantes(
    instanciaActual,
    true
  );

  await cargarSolicitudesFormularios(
    instanciaActual,
    false
  );

  detenerPollingSolicitudes();

  intervaloSolicitudes =
    window.setInterval(
      () => {
        const pagina =
          document.getElementById(
            'estudiantesPage'
          );

        if (
          !pagina ||
          vistaActual !== 'ESTUDIANTES' ||
          !carreraSeleccionada ||
          !planSeleccionado
        ) {
          detenerPollingSolicitudes();
          return;
        }

        cargarSolicitudesFormularios(
          instanciaActual,
          false
        );
      },
      15_000
    );
}

function vincularEventosVistaEstudiantes() {
  const instancia = instanciaActual;

  const buscar =
    document.getElementById(
      'estudiantesBuscar'
    );

  const periodo =
    document.getElementById(
      'estudiantesPeriodo'
    );

  const estado =
    document.getElementById(
      'estudiantesEstado'
    );

  const nuevoBtn =
    document.getElementById(
      'nuevoEstudianteButton'
    );

  const importarBtn =
    document.getElementById(
      'importarEstudiantesExcelButton'
    );

  buscar?.addEventListener(
    'input',
    () => {
      if (timerBusqueda) {
        window.clearTimeout(
          timerBusqueda
        );
      }

      timerBusqueda =
        window.setTimeout(
          () => {
            cargarEstudiantes(
              instancia
            );
          },
          250
        );
    }
  );

  periodo?.addEventListener(
    'change',
    () => {
      cargarEstudiantes(
        instancia
      );
    }
  );

  estado?.addEventListener(
    'change',
    () => {
      cargarEstudiantes(
        instancia
      );
    }
  );

  nuevoBtn?.addEventListener(
    'click',
    abrirNuevoEstudiante
  );

  importarBtn?.addEventListener(
    'click',
    abrirImportacionEstudiantes
  );
}

function obtenerFiltros() {
  const texto =
    document
      .getElementById(
        'estudiantesBuscar'
      )
      ?.value
      ?.trim() || '';

  const carreraId =
    carreraSeleccionada?.id ||
    Number(
      document.getElementById(
        'estudiantesCarrera'
      )?.value
    ) ||
    undefined;

  const planEstudioId =
    planSeleccionado?.id ||
    Number(
      document.getElementById(
        'estudiantesPlan'
      )?.value
    ) ||
    undefined;

  const periodoIngresoId =
    Number(
      document.getElementById(
        'estudiantesPeriodo'
      )?.value
    ) || undefined;

  const estado =
    document.getElementById(
      'estudiantesEstado'
    )?.value || undefined;

  return {
    texto:
      texto || undefined,

    carreraId,
    planEstudioId,
    periodoIngresoId,
    estado
  };
}

function llenarFiltrosAcademicos() {
  const periodoSelect =
    document.getElementById(
      'estudiantesPeriodo'
    );

  if (!periodoSelect) {
    return;
  }

  const periodos =
    new Map();

  for (
    const estudiante
    of catalogoEstudiantes
  ) {
    if (estudiante.periodoIngreso) {
      periodos.set(
        estudiante.periodoIngreso.id,
        estudiante.periodoIngreso
      );
    }
  }

  periodoSelect.innerHTML = `
    <option value="">
      Todos los períodos
    </option>

    ${[...periodos.values()]
      .map(
        (periodo) => `
          <option value="${periodo.id}">
            ${escapeHtml(
              periodo.codigo || periodo.nombre
            )}
          </option>
        `
      )
      .join('')}
  `;
}

function actualizarPlanesFiltro() {
  // Mantenido por compatibilidad
}

async function cargarEstudiantes(
  instancia,
  actualizarCatalogo = false
) {
  try {
    const filtros =
      obtenerFiltros();

    if (carreraSeleccionada) {
      filtros.carreraId =
        carreraSeleccionada.id;
    }

    if (planSeleccionado) {
      filtros.planEstudioId =
        planSeleccionado.id;
    }

    const resultado =
      await listarEstudiantes(
        filtros
      );

    if (
      instancia !==
      instanciaActual
    ) {
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
        'No fue posible consultar los estudiantes.'
      );
    }

    estudiantes =
      Array.isArray(
        resultado.estudiantes
      )
        ? resultado.estudiantes
        : [];

    if (actualizarCatalogo) {
      catalogoEstudiantes = [
        ...estudiantes
      ];

      llenarFiltrosAcademicos();
    }

    renderizarEstudiantes();
  } catch (error) {
    console.error(
      'Error cargando estudiantes:',
      error
    );

    mostrarError({
      titulo:
        'No fue posible cargar los estudiantes',

      mensaje:
        error?.message ||
        'Ocurrió un error al consultar los estudiantes.'
    });
  }
}

async function manejarAccionEstudiante(
  event
) {
  const button =
    event.target.closest(
      '[data-action][data-id]'
    );

  if (!button) return;

  const id =
    Number(button.dataset.id);

  if (!id) return;

  switch (button.dataset.action) {
    case 'ver':
      await abrirDetalleEstudiante(id);
      break;

    case 'expediente':
      await abrirExpedienteEstudiante(id);
      break;

    case 'editar':
      await abrirEditarEstudiante(id);
      break;

    case 'estado':
      await abrirCambiarEstadoEstudiante(id);
      break;

    case 'plan':
      await abrirCambiarPlanEstudiante(id);
      break;
  }
}

async function abrirDetalleEstudiante(
  id
) {
  try {
    const resultado =
      await obtenerEstudiante(id);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
        'No fue posible consultar el estudiante.'
      );
    }

    const estudiante =
      resultado.data;

    const dialog =
      document.getElementById(
        'estudianteDialog'
      );

    const content =
      document.getElementById(
        'estudianteDialogContent'
      );

    if (!dialog || !content) return;

    content.innerHTML =
      FormDialog({
        formId:
          'detalleEstudianteForm',

        title:
          'Detalle del estudiante',

        description:
          obtenerNombreCompleto(
            estudiante
          ),

        layout: 'grid',

        body: `
          <label>
            <span>Cédula</span>
            <input
              type="text"
              value="${escapeHtml(
                estudiante.cedula
              )}"
              readonly
            >
          </label>

          <label>
            <span>Correo institucional</span>
            <input
              type="text"
              value="${escapeHtml(
                estudiante.correoInstitucional
              )}"
              readonly
            >
          </label>

          <label>
            <span>Teléfono</span>
            <input
              type="text"
              value="${escapeHtml(
                estudiante.telefono || '—'
              )}"
              readonly
            >
          </label>

          <label>
            <span>Estado</span>
            <input
              type="text"
              value="${escapeHtml(
                formatearEstado(
                  estudiante.estado
                )
              )}"
              readonly
            >
          </label>

          <label>
            <span>Carrera</span>
            <input
              type="text"
              value="${escapeHtml(
                estudiante.carrera
                  ? `${estudiante.carrera.codigo} - ${estudiante.carrera.nombre}`
                  : '—'
              )}"
              readonly
            >
          </label>

          <label>
            <span>Plan de estudio</span>
            <input
              type="text"
              value="${escapeHtml(
                estudiante.planEstudio
                  ? `${estudiante.planEstudio.codigo} - ${estudiante.planEstudio.nombre}`
                  : '—'
              )}"
              readonly
            >
          </label>

          <label class="sgpa-form-wide">
            <span>Período de ingreso</span>
            <input
              type="text"
              value="${escapeHtml(
                estudiante.periodoIngreso?.codigo ||
                estudiante.periodoIngreso?.nombre ||
                '—'
              )}"
              readonly
            >
          </label>
        `,

        cancelButtonId:
          'cerrarDetalleEstudiante',

        cancelText: 'Cerrar',

        showFooter: true
      });

    renderizarIconos();

    dialog.showModal();

    habilitarCierreExterior(
      dialog
    );

    document
      .getElementById(
        'cerrarDetalleEstudiante'
      )
      ?.addEventListener(
        'click',
        () => dialog.close()
      );
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible abrir el estudiante',
      mensaje:
        error?.message ||
        'Ocurrió un error al consultar la información.'
    });
  }
}

async function abrirEditarEstudiante(
  id
) {
  try {
    const resultado =
      await obtenerEstudiante(id);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
        'No fue posible consultar el estudiante.'
      );
    }

    const estudiante =
      resultado.data;

    const dialog =
      document.getElementById(
        'estudianteDialog'
      );

    const content =
      document.getElementById(
        'estudianteDialogContent'
      );

    if (!dialog || !content) return;

    content.innerHTML =
      FormDialog({
        formId:
          'editarEstudianteForm',

        title:
          'Editar estudiante',

        description:
          'Actualice la información personal del estudiante.',

        errorId:
          'editarEstudianteError',

        cancelButtonId:
          'cancelarEditarEstudiante',

        submitButtonId:
          'guardarEstudianteButton',

        submitText:
          'Guardar cambios',

        body: `
          <label>
            <span>Cédula</span>
            <input
              id="editarCedula"
              type="text"
              maxlength="30"
              value="${escapeHtml(
                estudiante.cedula
              )}"
              required
            >
          </label>

          <label>
            <span>Nombres</span>
            <input
              id="editarNombres"
              type="text"
              maxlength="100"
              value="${escapeHtml(
                estudiante.nombres
              )}"
              required
            >
          </label>

          <label>
            <span>Primer apellido</span>
            <input
              id="editarApellido1"
              type="text"
              maxlength="100"
              value="${escapeHtml(
                estudiante.apellido1
              )}"
              required
            >
          </label>

          <label>
            <span>Segundo apellido</span>
            <input
              id="editarApellido2"
              type="text"
              maxlength="100"
              value="${escapeHtml(
                estudiante.apellido2 || ''
              )}"
            >
          </label>

          <label class="sgpa-form-wide">
            <span>Correo institucional</span>
            <input
              id="editarCorreo"
              type="email"
              maxlength="150"
              value="${escapeHtml(
                estudiante.correoInstitucional
              )}"
              required
            >
          </label>

          <label class="sgpa-form-wide">
            <span>Teléfono</span>
            <input
              id="editarTelefono"
              type="text"
              maxlength="30"
              value="${escapeHtml(
                estudiante.telefono || ''
              )}"
            >
          </label>
        `
      });

    renderizarIconos();

    dialog.showModal();

    habilitarCierreExterior(
      dialog
    );

    document
      .getElementById(
        'cancelarEditarEstudiante'
      )
      ?.addEventListener(
        'click',
        () => dialog.close()
      );

    document
      .getElementById(
        'editarEstudianteForm'
      )
      ?.addEventListener(
        'submit',
        async (event) => {
          event.preventDefault();

          const button =
            document.getElementById(
              'guardarEstudianteButton'
            );

          if (button) {
            button.disabled = true;
          }

          try {
            const respuesta =
              await actualizarEstudiante(
                estudiante.id,
                {
                  cedula:
                    document
                      .getElementById(
                        'editarCedula'
                      )
                      .value
                      .trim(),

                  nombres:
                    document
                      .getElementById(
                        'editarNombres'
                      )
                      .value
                      .trim(),

                  apellido1:
                    document
                      .getElementById(
                        'editarApellido1'
                      )
                      .value
                      .trim(),

                  apellido2:
                    document
                      .getElementById(
                        'editarApellido2'
                      )
                      .value
                      .trim() || null,

                  correoInstitucional:
                    document
                      .getElementById(
                        'editarCorreo'
                      )
                      .value
                      .trim(),

                  telefono:
                    document
                      .getElementById(
                        'editarTelefono'
                      )
                      .value
                      .trim() || null
                }
              );

            if (!respuesta?.ok) {
              throw new Error(
                respuesta?.message ||
                'No fue posible actualizar el estudiante.'
              );
            }

            dialog.close();

            mostrarExito({
              titulo:
                'Estudiante actualizado',
              mensaje:
                'La información se actualizó correctamente.'
            });

            await cargarEstudiantes(
              instanciaActual
            );
          } catch (error) {
            mostrarError({
              titulo:
                'No fue posible actualizar',
              mensaje:
                error?.message ||
                'Ocurrió un error al guardar los cambios.'
            });
          } finally {
            if (button) {
              button.disabled = false;
            }
          }
        }
      );
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible editar el estudiante',
      mensaje:
        error?.message ||
        'Ocurrió un error al consultar la información.'
    });
  }
}

async function obtenerCatalogosEstudiante() {
  const [
    resultadoCarreras,
    resultadoPlanes,
    resultadoPeriodos
  ] = await Promise.all([
    listarCarreras(),
    listarPlanesEstudio(),
    listarPeriodosAcademicos()
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
      'No fue posible consultar los planes.'
    );
  }

  if (!resultadoPeriodos?.ok) {
    throw new Error(
      resultadoPeriodos?.message ||
      'No fue posible consultar los períodos.'
    );
  }

  return {
    carreras:
      (resultadoCarreras.carreras ?? [])
        .filter((item) => item.activo),

    planes:
      (resultadoPlanes.planes ?? [])
        .filter((item) => item.activo),

    periodos:
      resultadoPeriodos.periodos ?? []
  };
}

async function abrirNuevoEstudiante() {
  if (!carreraSeleccionada || !planSeleccionado) {
    mostrarError({
      titulo: 'Seleccione un plan',
      mensaje:
        'Debe seleccionar una carrera y un plan de estudio antes de registrar estudiantes.'
    });
    return;
  }

  const dialog =
    document.getElementById(
      'estudianteDialog'
    );

  const content =
    document.getElementById(
      'estudianteDialogContent'
    );

  if (!dialog || !content) return;

  try {
    const resultadoPeriodos =
      await listarPeriodosAcademicos();

    if (!resultadoPeriodos?.ok) {
      throw new Error(
        resultadoPeriodos?.message ||
        'No fue posible consultar los períodos.'
      );
    }

    const periodos =
      resultadoPeriodos.periodos ?? [];

    const opcionesPeriodos =
      periodos
        .map(
          (item) => `
            <option value="${item.id}">
              ${escapeHtml(
                item.codigo ||
                item.nombre
              )}
            </option>
          `
        )
        .join('');

    content.innerHTML =
      FormDialog({
        formId:
          'nuevoEstudianteForm',

        title:
          'Nuevo estudiante',

        description:
          'Registre los datos personales y académicos iniciales.',

        errorId:
          'nuevoEstudianteError',

        cancelButtonId:
          'cancelarNuevoEstudiante',

        submitButtonId:
          'crearEstudianteButton',

        submitText:
          'Crear estudiante',

        body: `
          <label>
            <span>Carrera</span>
            <input
              type="text"
              value="${escapeHtml(carreraSeleccionada.nombre)}"
              readonly
            >
          </label>

          <label>
            <span>Plan de estudio</span>
            <input
              type="text"
              value="${escapeHtml(planSeleccionado.nombre || planSeleccionado.codigo)}"
              readonly
            >
          </label>

          <label>
            <span>Cédula</span>
            <input
              id="nuevoCedula"
              maxlength="30"
              required
            >
          </label>

          <label>
            <span>Nombres</span>
            <input
              id="nuevoNombres"
              maxlength="100"
              required
            >
          </label>

          <label>
            <span>Primer apellido</span>
            <input
              id="nuevoApellido1"
              maxlength="100"
              required
            >
          </label>

          <label>
            <span>Segundo apellido</span>
            <input
              id="nuevoApellido2"
              maxlength="100"
            >
          </label>

          <label class="sgpa-form-wide">
            <span>Correo institucional</span>
            <input
              id="nuevoCorreo"
              type="email"
              maxlength="150"
              required
            >
          </label>

          <label>
            <span>Teléfono</span>
            <input
              id="nuevoTelefono"
              maxlength="30"
            >
          </label>

          <label class="sgpa-form-wide">
            <span>Período de ingreso</span>
            <select
              id="nuevoPeriodo"
              required
            >
              <option
                value=""
                selected
                disabled
              >
                Seleccione...
              </option>

              ${opcionesPeriodos}
            </select>
          </label>
        `
      });

    renderizarIconos();

    dialog.showModal();

    habilitarCierreExterior(dialog);

    document
      .getElementById(
        'cancelarNuevoEstudiante'
      )
      ?.addEventListener(
        'click',
        () => dialog.close()
      );

    document
      .getElementById(
        'nuevoEstudianteForm'
      )
      ?.addEventListener(
        'submit',
        async (event) => {
          event.preventDefault();

          const button =
            document.getElementById(
              'crearEstudianteButton'
            );

          button.disabled = true;

          try {
            const resultado =
              await crearEstudiante({
                cedula:
                  document
                    .getElementById('nuevoCedula')
                    .value.trim(),

                nombres:
                  document
                    .getElementById('nuevoNombres')
                    .value.trim(),

                apellido1:
                  document
                    .getElementById('nuevoApellido1')
                    .value.trim(),

                apellido2:
                  document
                    .getElementById('nuevoApellido2')
                    .value.trim() || null,

                correoInstitucional:
                  document
                    .getElementById('nuevoCorreo')
                    .value.trim(),

                telefono:
                  document
                    .getElementById('nuevoTelefono')
                    .value.trim() || null,

                carreraId:
                  carreraSeleccionada.id,

                planEstudioId:
                  planSeleccionado.id,

                periodoIngresoId:
                  Number(
                    document
                      .getElementById(
                        'nuevoPeriodo'
                      )
                      .value
                  )
              });

            if (!resultado?.ok) {
              throw new Error(
                resultado?.message ||
                'No fue posible crear el estudiante.'
              );
            }

            dialog.close();

            mostrarExito({
              titulo:
                'Estudiante creado',
              mensaje:
                'El estudiante fue registrado correctamente.'
            });

            await cargarEstudiantes(
              instanciaActual,
              true
            );
          } catch (error) {
            mostrarError({
              titulo:
                'No fue posible crear el estudiante',
              mensaje:
                error?.message ||
                'Revise los datos ingresados.'
            });
          } finally {
            button.disabled = false;
          }
        }
      );
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible preparar el formulario',
      mensaje:
        error?.message ||
        'No se pudieron cargar los datos académicos.'
    });
  }
}

async function abrirCambiarEstadoEstudiante(
  id
) {
  const resultado =
    await obtenerEstudiante(id);

  if (!resultado?.ok) {
    mostrarError({
      titulo:
        'No fue posible consultar el estudiante',
      mensaje:
        resultado?.message
    });

    return;
  }

  const estudiante =
    resultado.data;

  const dialog =
    document.getElementById(
      'estudianteDialog'
    );

  const content =
    document.getElementById(
      'estudianteDialogContent'
    );

  if (!dialog || !content) return;

  content.innerHTML =
    FormDialog({
      formId:
        'cambiarEstadoEstudianteForm',

      title:
        'Cambiar estado',

      description:
        obtenerNombreCompleto(
          estudiante
        ),

      cancelButtonId:
        'cancelarCambioEstado',

      submitButtonId:
        'guardarEstadoEstudiante',

      submitText:
        'Cambiar estado',

      body: `
        <label class="sgpa-form-wide">
          <span>Nuevo estado</span>

          <select
            id="nuevoEstadoEstudiante"
            required
          >
            ${ESTADOS
              .filter(
                (item) =>
                  item.value !==
                  estudiante.estado
              )
              .map(
                (item) => `
                  <option
                    value="${item.value}"
                  >
                    ${item.label}
                  </option>
                `
              )
              .join('')}
          </select>
        </label>
      `
    });

  renderizarIconos();
  dialog.showModal();
  habilitarCierreExterior(dialog);

  document
    .getElementById(
      'cancelarCambioEstado'
    )
    ?.addEventListener(
      'click',
      () => dialog.close()
    );

  document
    .getElementById(
      'cambiarEstadoEstudianteForm'
    )
    ?.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        const estado =
          document.getElementById(
            'nuevoEstadoEstudiante'
          ).value;

        const confirmado =
          await confirmarAccion({
            titulo:
              'Confirmar cambio de estado',

            mensaje:
              `El estudiante pasará de ${formatearEstado(
                estudiante.estado
              )} a ${formatearEstado(
                estado
              )}.`,

            textoConfirmar:
              'Cambiar estado',

            peligro:
              estado === 'RETIRADO'
          });

        if (!confirmado) return;

        try {
          const respuesta =
            await cambiarEstadoEstudiante(
              id,
              estado
            );

          if (!respuesta?.ok) {
            throw new Error(
              respuesta?.message ||
              'No fue posible cambiar el estado.'
            );
          }

          dialog.close();

          mostrarExito({
            titulo:
              'Estado actualizado',
            mensaje:
              'El estado del estudiante se actualizó correctamente.'
          });

          await cargarEstudiantes(
            instanciaActual
          );
        } catch (error) {
          mostrarError({
            titulo:
              'No fue posible cambiar el estado',
            mensaje:
              error?.message
          });
        }
      }
    );
}

async function abrirCambiarPlanEstudiante(
  id
) {
  try {
    const [
      resultadoEstudiante,
      resultadoPlanes,
      resultadoPeriodos
    ] =
      await Promise.all([
        obtenerEstudiante(id),
        listarPlanesEstudio(),
        listarPeriodosAcademicos()
      ]);

    if (!resultadoEstudiante?.ok) {
      throw new Error(
        resultadoEstudiante?.message
      );
    }

    if (!resultadoPlanes?.ok) {
      throw new Error(
        resultadoPlanes?.message
      );
    }

    if (!resultadoPeriodos?.ok) {
      throw new Error(
        resultadoPeriodos?.message
      );
    }

    const estudiante =
      resultadoEstudiante.data;

    const planes =
      (resultadoPlanes.planes ?? [])
        .filter(
          (plan) =>
            plan.activo &&
            plan.carreraId ===
              estudiante.carreraId &&
            plan.id !==
              estudiante.planEstudioId
        );

    const periodos =
      resultadoPeriodos.periodos ?? [];

    const dialog =
      document.getElementById(
        'estudianteDialog'
      );

    const content =
      document.getElementById(
        'estudianteDialogContent'
      );

    if (!dialog || !content) return;

    content.innerHTML =
      FormDialog({
        formId:
          'cambiarPlanEstudianteForm',

        title:
          'Cambiar plan de estudio',

        description:
          obtenerNombreCompleto(
            estudiante
          ),

        errorId:
          'cambiarPlanError',

        cancelButtonId:
          'cancelarCambioPlan',

        submitButtonId:
          'guardarCambioPlan',

        submitText:
          'Cambiar plan',

        body: `
          <label class="sgpa-form-wide">
            <span>Nuevo plan</span>

            <select
              id="planNuevoEstudiante"
              required
            >
              <option
                value=""
                selected
                disabled
              >
                Seleccione...
              </option>

              ${planes
                .map(
                  (plan) => `
                    <option
                      value="${plan.id}"
                    >
                      ${escapeHtml(
                        plan.codigo
                      )}
                      -
                      ${escapeHtml(
                        plan.nombre
                      )}
                    </option>
                  `
                )
                .join('')}
            </select>
          </label>

          <label class="sgpa-form-wide">
            <span>
              Período del cambio
            </span>

            <select
              id="periodoCambioEstudiante"
              required
            >
              <option
                value=""
                selected
                disabled
              >
                Seleccione...
              </option>

              ${periodos
                .map(
                  (periodo) => `
                    <option
                      value="${periodo.id}"
                    >
                      ${escapeHtml(
                        periodo.codigo ||
                        periodo.nombre
                      )}
                    </option>
                  `
                )
                .join('')}
            </select>
          </label>

          <label class="sgpa-form-wide">
            <span>Motivo</span>

            <textarea
              id="motivoCambioPlan"
              maxlength="500"
              rows="3"
              placeholder="Opcional"
            ></textarea>
          </label>
        `
      });

    renderizarIconos();
    dialog.showModal();
    habilitarCierreExterior(dialog);

    document
      .getElementById(
        'cancelarCambioPlan'
      )
      ?.addEventListener(
        'click',
        () => dialog.close()
      );

    document
      .getElementById(
        'cambiarPlanEstudianteForm'
      )
      ?.addEventListener(
        'submit',
        async (event) => {
          event.preventDefault();

          try {
            const respuesta =
              await cambiarPlanEstudiante(
                id,
                {
                  planNuevoId:
                    Number(
                      document
                        .getElementById(
                          'planNuevoEstudiante'
                        )
                        .value
                    ),

                  periodoCambioId:
                    Number(
                      document
                        .getElementById(
                          'periodoCambioEstudiante'
                        )
                        .value
                    ),

                  motivo:
                    document
                      .getElementById(
                        'motivoCambioPlan'
                      )
                      .value
                      .trim() || null
                }
              );

            if (!respuesta?.ok) {
              throw new Error(
                respuesta?.message ||
                'No fue posible cambiar el plan.'
              );
            }

            dialog.close();

            mostrarExito({
              titulo:
                'Plan actualizado',
              mensaje:
                'El cambio de plan se registró correctamente en el historial del estudiante.'
            });

            await cargarEstudiantes(
              instanciaActual,
              true
            );
          } catch (error) {
            mostrarError({
              titulo:
                'No fue posible cambiar el plan',
              mensaje:
                error?.message
            });
          }
        }
      );
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible preparar el cambio de plan',
      mensaje:
        error?.message
    });
  }
}

async function abrirExpedienteEstudiante(
  id
) {
  const dialog =
    document.getElementById(
      'estudianteDialog'
    );

  const content =
    document.getElementById(
      'estudianteDialogContent'
    );

  if (!dialog || !content) {
    return;
  }

  try {
    const [
      resultadoEstudiante,
      resultadoAcademico,
      resultadoPlanes,
      resultadoPeriodos
    ] =
      await Promise.all([
        obtenerEstudiante(id),

        obtenerHistorialAcademicoEstudiante(
          id
        ),

        obtenerHistorialPlanesEstudiante(
          id
        ),

        listarPeriodosAcademicos()
      ]);

    if (!resultadoEstudiante?.ok) {
      throw new Error(
        resultadoEstudiante?.message ||
        'No fue posible consultar el estudiante.'
      );
    }

    if (!resultadoAcademico?.ok) {
      throw new Error(
        resultadoAcademico?.message ||
        'No fue posible consultar el historial académico.'
      );
    }

    if (!resultadoPlanes?.ok) {
      throw new Error(
        resultadoPlanes?.message ||
        'No fue posible consultar el historial de planes.'
      );
    }

    if (!resultadoPeriodos?.ok) {
      throw new Error(
        resultadoPeriodos?.message ||
        'No fue posible consultar los períodos académicos.'
      );
    }

    const estudiante =
      resultadoEstudiante.data;

    const historialAcademico =
      Array.isArray(
        extraerData(
          resultadoAcademico
        )
      )
        ? extraerData(
            resultadoAcademico
          )
        : [];

    const historialPlanes =
      Array.isArray(
        extraerData(
          resultadoPlanes
        )
      )
        ? extraerData(
            resultadoPlanes
          )
        : [];

    const periodos =
      Array.isArray(
        resultadoPeriodos.periodos
      )
        ? resultadoPeriodos.periodos
        : [];

    content.innerHTML =
      FormDialog({
        formId:
          'expedienteEstudianteForm',

        title:
          'Expediente académico',

        description:
          `${obtenerNombreCompleto(
            estudiante
          )} · ${estudiante.cedula}`,

        layout:
          'custom',

        cancelButtonId:
          'cerrarExpedienteEstudiante',

        cancelText:
          'Cerrar',

        showFooter:
          true,

        body: `
          <div class="sgpa-form-wide">

            <label>
              <span>
                Período de referencia
              </span>

              <select
                id="expedientePeriodoReferencia"
              >
                <option
                  value=""
                  selected
                >
                  Seleccione un período para calcular el progreso...
                </option>

                ${periodos
                  .map(
                    (periodo) => `
                      <option
                        value="${periodo.id}"
                      >
                        ${escapeHtml(
                          obtenerTextoPeriodo(
                            periodo
                          )
                        )}
                      </option>
                    `
                  )
                  .join('')}
              </select>

              <small class="sgpa-field-help">
                El rezago y las asignaturas habilitadas se calculan respecto a este período.
              </small>
            </label>

          </div>


          <div class="sgpa-form-wide">
            <h3>
              Progreso académico
            </h3>

            <div
              id="expedienteProgreso"
            >
              <div
                class="sgpa-table-empty"
              >
                Seleccione un período de referencia para calcular el progreso.
              </div>
            </div>
          </div>


          ${
            usuarioTienePermiso(
              PERMISOS.GESTIONAR
            )
              ? `
                <div class="sgpa-form-wide" style="margin-bottom: 0.5rem;">
                  <button
                    id="registrarResultadoAcademicoButton"
                    type="button"
                    class="btn btn-primary btn-sm"
                  >
                    <i
                      data-lucide="plus"
                      aria-hidden="true"
                    ></i>

                    Registrar resultado
                  </button>
                </div>
              `
              : ''
          }


          <div class="sgpa-form-wide">
            <h3>
              Historial académico
            </h3>

            <div
              id="expedienteHistorialAcademico"
            ></div>
          </div>


          <div class="sgpa-form-wide">
            <h3>
              Historial de planes
            </h3>

            <div
              id="expedienteHistorialPlanes"
            ></div>
          </div>
        `
      });

    renderizarIconos();

    dialog.showModal();

    habilitarCierreExterior(
      dialog
    );

    renderizarHistorialAcademico(
      historialAcademico
    );

    renderizarHistorialPlanes(
      historialPlanes
    );

    document
      .getElementById(
        'cerrarExpedienteEstudiante'
      )
      ?.addEventListener(
        'click',
        () => dialog.close()
      );

    document
      .getElementById(
        'registrarResultadoAcademicoButton'
      )
      ?.addEventListener(
        'click',
        () => {
          abrirRegistrarResultadoAcademico(
            estudiante
          );
        }
      );

    document
      .getElementById(
        'expedientePeriodoReferencia'
      )
      ?.addEventListener(
        'change',
        async (event) => {
          const periodoReferenciaId =
            Number(
              event.target.value
            );

          if (!periodoReferenciaId) {
            return;
          }

          await cargarProgresoExpediente(
            id,
            periodoReferenciaId
          );
        }
      );
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible abrir el expediente',

      mensaje:
        error?.message ||
        'Ocurrió un error al consultar la información académica.'
    });
  }
}

async function abrirRegistrarResultadoAcademico(
  estudiante
) {
  const dialog =
    document.getElementById(
      'estudianteDialog'
    );

  const content =
    document.getElementById(
      'estudianteDialogContent'
    );

  if (!dialog || !content) {
    return;
  }

  try {
    const [
      resultadoAsignaturas,
      resultadoPeriodos
    ] =
      await Promise.all([
        listarPlanAsignaturas(
          estudiante.planEstudioId
        ),

        listarPeriodosAcademicos()
      ]);

    if (!resultadoAsignaturas?.ok) {
      throw new Error(
        resultadoAsignaturas?.message ||
        'No fue posible consultar las asignaturas del plan.'
      );
    }

    if (!resultadoPeriodos?.ok) {
      throw new Error(
        resultadoPeriodos?.message ||
        'No fue posible consultar los períodos académicos.'
      );
    }

    const asignaturas =
      Array.isArray(
        resultadoAsignaturas.asignaturas
      )
        ? resultadoAsignaturas.asignaturas
            .filter(
              (item) =>
                item.activo !== false &&
                (
                  item.cursoId != null ||
                  item.curso?.id != null
                )
            )
        : [];

    const periodos =
      Array.isArray(
        resultadoPeriodos.periodos
      )
        ? resultadoPeriodos.periodos
        : [];

    content.innerHTML =
      FormDialog({
        formId:
          'registrarResultadoAcademicoForm',

        title:
          'Registrar resultado académico',

        description:
          `${obtenerNombreCompleto(
            estudiante
          )} · ${estudiante.cedula}`,

        errorId:
          'registrarResultadoAcademicoError',

        cancelButtonId:
          'cancelarResultadoAcademico',

        submitButtonId:
          'guardarResultadoAcademico',

        submitText:
          'Registrar resultado',

        submitIcon:
          'save',

        body: `
          <label class="sgpa-form-wide">
            <span>
              Asignatura
            </span>

            <select
              id="resultadoPlanAsignatura"
              required
            >
              <option
                value=""
                selected
                disabled
              >
                Seleccione una asignatura...
              </option>

              ${asignaturas
                .map(
                  (item) => `
                    <option
                      value="${item.id}"
                    >
                      ${escapeHtml(
                        obtenerTextoAsignatura(
                          item
                        )
                      )}
                    </option>
                  `
                )
                .join('')}
            </select>
          </label>


          <label>
            <span>
              Período
            </span>

            <select
              id="resultadoPeriodo"
              required
            >
              <option
                value=""
                selected
                disabled
              >
                Seleccione...
              </option>

              ${periodos
                .map(
                  (periodo) => `
                    <option
                      value="${periodo.id}"
                    >
                      ${escapeHtml(
                        obtenerTextoPeriodo(
                          periodo
                        )
                      )}
                    </option>
                  `
                )
                .join('')}
            </select>
          </label>


          <label>
            <span>
              Resultado
            </span>

            <select
              id="resultadoAcademico"
              required
            >
              <option
                value=""
                selected
                disabled
              >
                Seleccione...
              </option>

              ${RESULTADOS_ACADEMICOS
                .map(
                  (item) => `
                    <option
                      value="${item.value}"
                    >
                      ${item.label}
                    </option>
                  `
                )
                .join('')}
            </select>
          </label>


          <label class="sgpa-form-wide">
            <span>
              Origen académico
            </span>

            <select
              id="resultadoOrigenAcademico"
              required
            >
              <option
                value=""
                selected
                disabled
              >
                Seleccione...
              </option>

              ${ORIGENES_ACADEMICOS
                .map(
                  (item) => `
                    <option
                      value="${item.value}"
                    >
                      ${item.label}
                    </option>
                  `
                )
                .join('')}
            </select>
          </label>


          <label class="sgpa-form-wide">
            <span>
              Observaciones
            </span>

            <textarea
              id="resultadoObservaciones"
              rows="3"
              maxlength="500"
              placeholder="Opcional"
            ></textarea>
          </label>
        `
      });

    renderizarIconos();

    document
      .getElementById(
        'cancelarResultadoAcademico'
      )
      ?.addEventListener(
        'click',
        async () => {
          dialog.close();

          await abrirExpedienteEstudiante(
            estudiante.id
          );
        }
      );

    document
      .getElementById(
        'registrarResultadoAcademicoForm'
      )
      ?.addEventListener(
        'submit',
        async (event) => {
          event.preventDefault();

          const button =
            document.getElementById(
              'guardarResultadoAcademico'
            );

          if (button) {
            button.disabled = true;
          }

          try {
            const planAsignaturaId =
              Number(
                document
                  .getElementById(
                    'resultadoPlanAsignatura'
                  )
                  .value
              );

            const periodoId =
              Number(
                document
                  .getElementById(
                    'resultadoPeriodo'
                  )
                  .value
              );

            const resultado =
              document
                .getElementById(
                  'resultadoAcademico'
                )
                .value;

            const origenAcademico =
              document
                .getElementById(
                  'resultadoOrigenAcademico'
                )
                .value;

            const observaciones =
              document
                .getElementById(
                  'resultadoObservaciones'
                )
                .value
                .trim();

            const respuesta =
              await registrarResultadoAcademicoEstudiante(
                estudiante.id,
                {
                  planAsignaturaId,
                  periodoId,
                  resultado,
                  origenAcademico,
                  observaciones:
                    observaciones ||
                    null
                }
              );

            if (!respuesta?.ok) {
              throw new Error(
                respuesta?.message ||
                'No fue posible registrar el resultado.'
              );
            }

            dialog.close();

            mostrarExito({
              titulo:
                'Resultado registrado',

              mensaje:
                'El resultado académico fue registrado correctamente en el expediente.'
            });

            await abrirExpedienteEstudiante(
              estudiante.id
            );
          } catch (error) {
            mostrarError({
              titulo:
                'No fue posible registrar el resultado',

              mensaje:
                error?.message ||
                'Revise los datos seleccionados.'
            });
          } finally {
            if (button) {
              button.disabled = false;
            }
          }
        }
      );
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible preparar el registro',

      mensaje:
        error?.message ||
        'No se pudieron consultar las asignaturas o períodos.'
    });
  }
}

async function cargarProgresoExpediente(
  estudianteId,
  periodoReferenciaId
) {
  const contenedor =
    document.getElementById(
      'expedienteProgreso'
    );

  if (!contenedor) {
    return;
  }

  contenedor.innerHTML = `
    <div
      class="sgpa-table-empty"
      role="status"
    >
      Calculando progreso académico...
    </div>
  `;

  try {
    const resultado =
      await obtenerProgresoEstudiante(
        estudianteId,
        periodoReferenciaId
      );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
        'No fue posible calcular el progreso.'
      );
    }

    renderizarProgresoEstudiante(
      extraerData(resultado)
    );
  } catch (error) {
    contenedor.innerHTML = `
      <div class="sgpa-table-empty">
        ${escapeHtml(
          error?.message ||
          'No fue posible calcular el progreso para este período.'
        )}
      </div>
    `;

    mostrarError({
      titulo:
        'No fue posible calcular el progreso',

      mensaje:
        error?.message ||
        'Revise el período de referencia seleccionado.'
    });
  }
}

function obtenerResumenImportacion(
  preview
) {
  const resumen =
    preview?.resumen ??
    preview ??
    {};

  return {
    total:
      Number(
        resumen.total ?? 0
      ),

    creados:
      Number(
        resumen.creados ??
        resumen.crear ??
        0
      ),

    actualizados:
      Number(
        resumen.actualizados ??
        resumen.actualizar ??
        0
      ),

    sinCambios:
      Number(
        resumen.sinCambios ?? 0
      ),

    errores:
      Number(
        resumen.errores ??
        resumen.error ??
        0
      )
  };
}

function obtenerDetalleFilaImportacion(
  fila
) {
  if (fila.mensaje) {
    return fila.mensaje;
  }

  if (fila.error) {
    return fila.error;
  }

  if (fila.detalle) {
    return fila.detalle;
  }

  if (
    Array.isArray(
      fila.errores
    ) &&
    fila.errores.length > 0
  ) {
    return fila.errores.join(', ');
  }

  if (
    Array.isArray(
      fila.cambios
    )
  ) {
    return fila.cambios.join(', ');
  }

  if (
    fila.cambios &&
    typeof fila.cambios === 'object'
  ) {
    return Object.keys(
      fila.cambios
    ).join(', ');
  }

  return '—';
}

function renderizarPreviewImportacionEstudiantes(
  preview,
  contexto
) {
  const contenedor =
    document.getElementById(
      'previewImportacionEstudiantes'
    );

  if (!contenedor) {
    return;
  }

  const resumen =
    obtenerResumenImportacion(
      preview
    );

  const filas =
    Array.isArray(
      preview?.filas
    )
      ? preview.filas
      : [];

  const tablaResumen =
    DataTable({
      columns: [
        'Total',
        'Crear',
        'Actualizar',
        'Sin cambios',
        'Errores'
      ],

      rows: `
        <tr>
          <td>${resumen.total}</td>
          <td>${resumen.creados}</td>
          <td>${resumen.actualizados}</td>
          <td>${resumen.sinCambios}</td>
          <td>${resumen.errores}</td>
        </tr>
      `,

      emptyMessage:
        'No existe información de previsualización.',

      ariaLabel:
        'Resumen de importación de estudiantes'
    });

  const filasTabla =
    filas
      .map(
        (fila, index) => {
          const estudiante =
            fila.estudiante ??
            fila.datos ??
            fila;

          const nombre =
            [
              estudiante.nombres,
              estudiante.apellido1,
              estudiante.apellido2
            ]
              .filter(Boolean)
              .join(' ');

          return `
            <tr>
              <td>
                ${escapeHtml(
                  String(
                    fila.fila ??
                    index + 1
                  )
                )}
              </td>

              <td>
                ${escapeHtml(
                  estudiante.cedula ||
                  '—'
                )}
              </td>

              <td>
                ${escapeHtml(
                  nombre || '—'
                )}
              </td>

              <td>
                ${escapeHtml(
                  estudiante.correoInstitucional ||
                  '—'
                )}
              </td>

              <td>
                ${escapeHtml(
                  fila.accion ||
                  '—'
                )}
              </td>

              <td>
                ${escapeHtml(
                  obtenerDetalleFilaImportacion(
                    fila
                  )
                )}
              </td>
            </tr>
          `;
        }
      )
      .join('');

  const tablaFilas =
    DataTable({
      columns: [
        'Fila',
        'Cédula',
        'Estudiante',
        'Correo',
        'Acción',
        'Detalle'
      ],

      rows:
        filasTabla,

      emptyMessage:
        'El archivo no contiene filas para importar.',

      ariaLabel:
        'Previsualización de estudiantes'
    });

  const tieneErrores =
    resumen.errores > 0;

  const tieneCambios =
    resumen.creados > 0 ||
    resumen.actualizados > 0;

  contenedor.innerHTML = `
    <h3>
      Resumen de importación
    </h3>

    ${tablaResumen}

    <h3>
      Detalle
    </h3>

    ${tablaFilas}

    <div style="margin-top: 1rem;">
      <button
        id="ejecutarImportacionEstudiantesButton"
        type="button"
        class="btn btn-primary"
        ${
          tieneErrores ||
          !tieneCambios
            ? 'disabled'
            : ''
        }
      >
        <i
          data-lucide="database"
          aria-hidden="true"
        ></i>

        Ejecutar importación
      </button>
    </div>
  `;

  renderizarIconos();

  document
    .getElementById(
      'ejecutarImportacionEstudiantesButton'
    )
    ?.addEventListener(
      'click',
      async () => {
        const confirmado =
          await confirmarAccion({
            titulo:
              'Confirmar importación',

            mensaje:
              `Se crearán ${resumen.creados} estudiantes y se actualizarán ${resumen.actualizados}. Los registros sin cambios se conservarán.`,

            textoConfirmar:
              'Importar estudiantes',

            peligro:
              false
          });

        if (!confirmado) {
          return;
        }

        const button =
          document.getElementById(
            'ejecutarImportacionEstudiantesButton'
          );

        if (button) {
          button.disabled = true;
        }

        try {
          const resultado =
            await ejecutarImportacionEstudiantes(
              {
                carreraId:
                  contexto.carreraId,

                planEstudioId:
                  contexto.planEstudioId
              },

              contexto.datosExcel
            );

          if (
            resultado?.ok === false
          ) {
            throw new Error(
              resultado?.message ||
              'No fue posible completar la importación.'
            );
          }

          const importacion =
            extraerData(resultado);

          const resumenFinal =
            obtenerResumenImportacion(
              importacion
            );

          const dialog =
            document.getElementById(
              'estudianteDialog'
            );

          dialog?.close();

          mostrarExito({
            titulo:
              'Importación completada',

            mensaje:
              `${resumenFinal.creados} estudiantes creados, ` +
              `${resumenFinal.actualizados} actualizados y ` +
              `${resumenFinal.sinCambios} sin cambios.`
          });

          await cargarEstudiantes(
            instanciaActual,
            true
          );
        } catch (error) {
          mostrarError({
            titulo:
              'No fue posible importar los estudiantes',

            mensaje:
              error?.message ||
              'La importación no pudo completarse.'
          });

          if (button) {
            button.disabled = false;
          }
        }
      }
    );
}

async function abrirImportacionEstudiantes() {
  if (!carreraSeleccionada || !planSeleccionado) {
    mostrarError({
      titulo: 'Seleccione un plan',
      mensaje:
        'Debe seleccionar una carrera y un plan de estudio antes de importar estudiantes.'
    });
    return;
  }

  const dialog =
    document.getElementById(
      'estudianteDialog'
    );

  const content =
    document.getElementById(
      'estudianteDialogContent'
    );

  if (!dialog || !content) {
    return;
  }

  try {
    let datosExcel = null;
    let nombreArchivo = null;
    let previewActual = null;

    content.innerHTML =
      FormDialog({
        formId:
          'importarEstudiantesExcelForm',

        title:
          'Importar estudiantes desde Excel',

        description:
          'Cargue el archivo Excel con los estudiantes del plan y revise la previsualización antes de importar.',

        layout:
          'custom',

        cancelButtonId:
          'cancelarImportacionEstudiantes',

        cancelText:
          'Cerrar',

        showFooter:
          true,

        body: `
          <div class="sgpa-form-wide" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.5rem;">
            <label>
              <span>Carrera</span>
              <input
                type="text"
                value="${escapeHtml(carreraSeleccionada.nombre)}"
                readonly
              >
            </label>

            <label>
              <span>Plan de estudio</span>
              <input
                type="text"
                value="${escapeHtml(planSeleccionado.nombre || planSeleccionado.codigo)}"
                readonly
              >
            </label>
          </div>

          <div class="sgpa-form-wide" style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <button
              id="descargarPlantillaEstudiantesButton"
              type="button"
              class="btn btn-secondary"
            >
              <i
                data-lucide="download"
                aria-hidden="true"
              ></i>

              Descargar plantilla
            </button>

            <button
              id="seleccionarExcelEstudiantesButton"
              type="button"
              class="btn btn-secondary"
            >
              <i
                data-lucide="file-up"
                aria-hidden="true"
              ></i>

              Seleccionar archivo Excel
            </button>

            <span
              id="archivoEstudiantesSeleccionado"
              class="sgpa-field-help"
            >
              Ningún archivo seleccionado.
            </span>
          </div>

          <div class="sgpa-form-wide">
            <button
              id="previsualizarImportacionEstudiantesButton"
              type="button"
              class="btn btn-primary"
              disabled
            >
              <i
                data-lucide="scan-search"
                aria-hidden="true"
              ></i>

              Previsualizar importación
            </button>
          </div>

          <div
            id="previewImportacionEstudiantes"
            class="sgpa-form-wide"
          ></div>
        `
      });

    renderizarIconos();

    dialog.showModal();

    habilitarCierreExterior(
      dialog
    );

    const previewButton =
      document.getElementById(
        'previsualizarImportacionEstudiantesButton'
      );

    const previewContainer =
      document.getElementById(
        'previewImportacionEstudiantes'
      );

    const archivoLabel =
      document.getElementById(
        'archivoEstudiantesSeleccionado'
      );

    const actualizarEstadoPreview = () => {
      if (!previewButton) {
        return;
      }

      previewButton.disabled = !datosExcel;
    };

    const limpiarPreview = () => {
      previewActual = null;

      if (previewContainer) {
        previewContainer.innerHTML = '';
      }
    };

    document
      .getElementById(
        'descargarPlantillaEstudiantesButton'
      )
      ?.addEventListener(
        'click',
        async () => {
          try {
            const resultado =
              await guardarPlantillaExcelEstudiantes();

            if (
              resultado?.cancelado === true
            ) {
              return;
            }

            if (
              resultado?.ok === false
            ) {
              throw new Error(
                resultado?.message ||
                'No fue posible guardar la plantilla.'
              );
            }

            mostrarExito({
              titulo:
                'Plantilla guardada',

              mensaje:
                'La plantilla de estudiantes fue generada correctamente.'
            });
          } catch (error) {
            mostrarError({
              titulo:
                'No fue posible guardar la plantilla',

              mensaje:
                error?.message ||
                'Ocurrió un error al generar el archivo Excel.'
            });
          }
        }
      );

    document
      .getElementById(
        'seleccionarExcelEstudiantesButton'
      )
      ?.addEventListener(
        'click',
        async () => {
          try {
            const resultado =
              await seleccionarExcelEstudiantes();

            if (
              !resultado ||
              resultado.cancelado === true
            ) {
              return;
            }

            if (
              resultado.ok === false
            ) {
              throw new Error(
                resultado.message ||
                'No fue posible leer el archivo Excel.'
              );
            }

            datosExcel =
              resultado.datos;

            nombreArchivo =
              resultado.nombreArchivo ||
              resultado.nombre ||
              resultado.archivo ||
              'Archivo Excel';

            if (!datosExcel) {
              throw new Error(
                'El archivo seleccionado no produjo datos válidos.'
              );
            }

            if (archivoLabel) {
              archivoLabel.textContent =
                nombreArchivo;
            }

            limpiarPreview();
            actualizarEstadoPreview();
          } catch (error) {
            datosExcel = null;
            nombreArchivo = null;

            actualizarEstadoPreview();

            mostrarError({
              titulo:
                'No fue posible cargar el Excel',

              mensaje:
                error?.message ||
                'Revise el archivo seleccionado.'
            });
          }
        }
      );

    previewButton?.addEventListener(
      'click',
      async () => {
        const contexto = {
          carreraId:
            carreraSeleccionada.id,
          planEstudioId:
            planSeleccionado.id
        };

        if (!datosExcel) {
          return;
        }

        previewButton.disabled = true;

        try {
          const resultado =
            await validarImportacionEstudiantes(
              contexto,
              datosExcel
            );

          if (
            resultado?.ok === false
          ) {
            throw new Error(
              resultado?.message ||
              'La importación no pudo validarse.'
            );
          }

          previewActual =
            extraerData(resultado);

          renderizarPreviewImportacionEstudiantes(
            previewActual,
            {
              carreraId:
                contexto.carreraId,
              planEstudioId:
                contexto.planEstudioId,
              datosExcel
            }
          );
        } catch (error) {
          previewActual = null;

          if (previewContainer) {
            previewContainer.innerHTML = '';
          }

          mostrarError({
            titulo:
              'No fue posible previsualizar la importación',

            mensaje:
              error?.message ||
              'Revise el archivo y los datos seleccionados.'
          });
        } finally {
          actualizarEstadoPreview();
        }
      }
    );

    document
      .getElementById(
        'cancelarImportacionEstudiantes'
      )
      ?.addEventListener(
        'click',
        () => dialog.close()
      );
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible preparar la importación',

      mensaje:
        error?.message ||
        'Ocurrió un error al preparar la importación.'
    });
  }
}

export function iniciarEstudiantesPage() {
  instanciaActual += 1;

  const instancia =
    instanciaActual;

  estudiantes = [];
  catalogoEstudiantes = [];
  carreraSeleccionada = null;
  planSeleccionado = null;
  vistaActual = 'CARRERAS';

  const contenedorNavegacion =
    document.getElementById(
      'estudiantesNavegacion'
    );

  contenedorNavegacion?.addEventListener(
    'click',
    async (event) => {
      const volverCarreras =
        event.target.closest(
          '#volverACarrerasBtn'
        );
      if (volverCarreras) {
        await mostrarCarreras();
        return;
      }

      const volverPlanes =
        event.target.closest(
          '#volverAPlanesBtn'
        );
      if (volverPlanes) {
        if (carreraSeleccionada) {
          await mostrarPlanesCarrera(
            carreraSeleccionada
          );
        } else {
          await mostrarCarreras();
        }
        return;
      }

      const carreraBtn =
        event.target.closest(
          '[data-carrera-id]'
        );
      if (carreraBtn) {
        const carreraId =
          Number(
            carreraBtn.dataset.carreraId
          );
        const carrera =
          carrerasDisponibles.find(
            (c) => c.id === carreraId
          );
        if (carrera) {
          carreraSeleccionada = carrera;
          await mostrarPlanesCarrera(
            carrera
          );
        }
        return;
      }

      const planBtn =
        event.target.closest(
          '[data-plan-id]'
        );
      if (planBtn) {
        const planId =
          Number(
            planBtn.dataset.planId
          );
        const plan =
          planesDisponibles.find(
            (p) => p.id === planId
          );
        if (plan) {
          planSeleccionado = plan;
          await mostrarEstudiantesPlan();
        }
        return;
      }

      const accionEstudiante =
        event.target.closest(
          '[data-action][data-id]'
        );
      if (accionEstudiante) {
        manejarAccionEstudiante(event);
        return;
      }

      const accionSolicitud =
        event.target.closest(
          '[data-solicitud-action][data-id]'
        );
      if (accionSolicitud) {
        manejarAccionSolicitud(event);
        return;
      }
    }
  );

  renderizarIconos();

  // Entrar a Estudiantes -> NO cargar estudiantes -> cargar carreras
  mostrarCarreras();
}

function obtenerDatosSolicitud(
  solicitud
) {
  return (
    solicitud.datosNormalizadosJson ??
    {}
  );
}

function obtenerNombreSolicitud(
  solicitud
) {
  const datos =
    obtenerDatosSolicitud(
      solicitud
    );

  return (
    [
      datos.primerNombre,
      datos.segundoNombre,
      datos.primerApellido,
      datos.segundoApellido
    ]
      .filter(Boolean)
      .join(' ') ||
    'Sin nombre'
  );
}

function renderizarSolicitudesFormularios() {
  const contenedor =
    document.getElementById(
      'solicitudesFormulariosContent'
    );

  const contador =
    document.getElementById(
      'solicitudesFormulariosContador'
    );

  if (!contenedor) {
    return;
  }

  if (contador) {
    contador.textContent =
      `${solicitudesFormularios.length} pendiente${
        solicitudesFormularios.length === 1
          ? ''
          : 's'
      }`;
  }

  const puedeGestionar =
    usuarioTienePermiso(
      PERMISOS.GESTIONAR
    );

  const rows =
    solicitudesFormularios
      .map((solicitud) => {
        const datos =
          obtenerDatosSolicitud(
            solicitud
          );

        const formulario =
          solicitud.formulario ?? {};

        return `
          <tr>
            <td>
              ${escapeHtml(
                obtenerNombreSolicitud(
                  solicitud
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                datos.identificacion ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                datos.correoEstudiantil ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                formulario.titulo ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                formulario.carrera?.codigo ||
                formulario.carrera?.nombre ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                formulario.planEstudio?.codigo ||
                formulario.planEstudio?.nombre ||
                '—'
              )}
            </td>

            <td>
              ${
                Array.isArray(
                  datos.asignaturasAprobadas
                )
                  ? datos.asignaturasAprobadas.length
                  : 0
              }
            </td>

            <td>
              ${escapeHtml(
                solicitud.estado ||
                '—'
              )}
            </td>

            <td>
              <div
                class="table-actions"
                style="display: inline-flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;"
              >
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-solicitud-action="ver"
                  data-id="${solicitud.id}"
                  title="Ver solicitud"
                >
                  <i
                    data-lucide="eye"
                    aria-hidden="true"
                  ></i>
                </button>

                ${
                  puedeGestionar
                    ? `
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-solicitud-action="aceptar"
                        data-id="${solicitud.id}"
                        title="Aceptar solicitud"
                      >
                        <i
                          data-lucide="check"
                          aria-hidden="true"
                        ></i>
                      </button>

                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-solicitud-action="rechazar"
                        data-id="${solicitud.id}"
                        title="Rechazar solicitud"
                      >
                        <i
                          data-lucide="x"
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
      })
      .join('');

  contenedor.innerHTML =
    DataTable({
      columns: [
        'Estudiante',
        'Cédula',
        'Correo',
        'Formulario',
        'Carrera',
        'Plan',
        'Aprobadas',
        'Estado',
        'Acciones'
      ],

      rows,

      emptyMessage:
        'No existen solicitudes pendientes de formularios.',

      ariaLabel:
        'Solicitudes de estudiantes provenientes de formularios'
    });

  renderizarIconos();
}

async function cargarSolicitudesFormularios(
  instancia,
  mostrarErrores = true
) {
  if (
    vistaActual !== 'ESTUDIANTES' ||
    !carreraSeleccionada ||
    !planSeleccionado
  ) {
    solicitudesFormularios = [];
    renderizarSolicitudesFormularios();
    return;
  }

  try {
    const resultado =
      await listarSolicitudesFormularios({
        carreraId:
          carreraSeleccionada.id,
        planEstudioId:
          planSeleccionado.id
      });

    if (
      instancia !==
      instanciaActual
    ) {
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
        'No fue posible consultar las solicitudes.'
      );
    }

    const datos =
      extraerData(resultado);

    solicitudesFormularios =
      Array.isArray(datos)
        ? datos
        : [];

    renderizarSolicitudesFormularios();
  } catch (error) {
    if (mostrarErrores) {
      mostrarError({
        titulo:
          'No fue posible cargar las solicitudes',
        mensaje:
          error?.message ||
          'Ocurrió un error al consultar las respuestas de formularios.'
      });
    } else {
      console.error(
        'Error actualizando solicitudes:',
        error
      );
    }
  }
}

async function manejarAccionSolicitud(
  event
) {
  const button =
    event.target.closest(
      '[data-solicitud-action][data-id]'
    );

  if (!button) {
    return;
  }

  const id =
    Number(button.dataset.id);

  if (!id) {
    return;
  }

  const solicitud =
    solicitudesFormularios.find(
      (item) =>
        item.id === id
    );

  if (!solicitud) {
    return;
  }

  switch (
    button.dataset.solicitudAction
  ) {
    case 'ver':
      abrirDetalleSolicitud(
        solicitud
      );
      break;

    case 'aceptar':
      await aceptarSolicitud(
        solicitud
      );
      break;

    case 'rechazar':
      abrirRechazarSolicitud(
        solicitud
      );
      break;
  }
}

async function aceptarSolicitud(
  solicitud
) {
  const confirmado =
    await confirmarAccion({
      titulo:
        'Aceptar solicitud',

      mensaje:
        `Se incorporará a ${obtenerNombreSolicitud(
          solicitud
        )} al padrón de estudiantes utilizando la carrera y el plan asociados al formulario.`,

      textoConfirmar:
        'Aceptar solicitud',

      peligro:
        false
    });

  if (!confirmado) {
    return;
  }

  try {
    const resultado =
      await aceptarSolicitudFormulario(
        solicitud.id
      );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
        'No fue posible aceptar la solicitud.'
      );
    }

    mostrarExito({
      titulo:
        'Solicitud aceptada',

      mensaje:
        'La información fue incorporada correctamente al módulo de estudiantes.'
    });

    await Promise.all([
      cargarSolicitudesFormularios(
        instanciaActual,
        false
      ),

      cargarEstudiantes(
        instanciaActual,
        true
      )
    ]);
  } catch (error) {
    mostrarError({
      titulo:
        'No fue posible aceptar la solicitud',

      mensaje:
        error?.message ||
        'La solicitud requiere revisión antes de poder incorporarse.'
    });

    await cargarSolicitudesFormularios(
      instanciaActual,
      false
    );
  }
}

function abrirRechazarSolicitud(
  solicitud
) {
  const dialog =
    document.getElementById(
      'estudianteDialog'
    );

  const content =
    document.getElementById(
      'estudianteDialogContent'
    );

  if (!dialog || !content) {
    return;
  }

  content.innerHTML =
    FormDialog({
      formId:
        'rechazarSolicitudFormularioForm',

      title:
        'Rechazar solicitud',

      description:
        obtenerNombreSolicitud(
          solicitud
        ),

      cancelButtonId:
        'cancelarRechazoSolicitud',

      submitButtonId:
        'confirmarRechazoSolicitud',

      submitText:
        'Rechazar',

      body: `
        <label class="sgpa-form-wide">
          <span>
            Motivo
          </span>

          <textarea
            id="motivoRechazoSolicitud"
            maxlength="500"
            rows="3"
            placeholder="Opcional"
          ></textarea>
        </label>
      `
    });

  renderizarIconos();

  dialog.showModal();

  habilitarCierreExterior(
    dialog
  );

  document
    .getElementById(
      'cancelarRechazoSolicitud'
    )
    ?.addEventListener(
      'click',
      () => dialog.close()
    );

  document
    .getElementById(
      'rechazarSolicitudFormularioForm'
    )
    ?.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        const motivo =
          document
            .getElementById(
              'motivoRechazoSolicitud'
            )
            .value
            .trim();

        try {
          const resultado =
            await rechazarSolicitudFormulario(
              solicitud.id,
              motivo
            );

          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
              'No fue posible rechazar la solicitud.'
            );
          }

          dialog.close();

          mostrarExito({
            titulo:
              'Solicitud rechazada',

            mensaje:
              'La respuesta fue descartada del proceso de ingreso.'
          });

          await cargarSolicitudesFormularios(
            instanciaActual,
            false
          );
        } catch (error) {
          mostrarError({
            titulo:
              'No fue posible rechazar la solicitud',

            mensaje:
              error?.message ||
              'Ocurrió un error durante la revisión.'
          });
        }
      }
    );
}

function abrirDetalleSolicitud(
  solicitud
) {
  const dialog =
    document.getElementById(
      'estudianteDialog'
    );

  const content =
    document.getElementById(
      'estudianteDialogContent'
    );

  if (!dialog || !content) {
    return;
  }

  const datos =
    obtenerDatosSolicitud(
      solicitud
    );

  const formulario =
    solicitud.formulario ?? {};

  const carreraTexto =
    formulario.carrera
      ? `${formulario.carrera.codigo || ''} - ${formulario.carrera.nombre || ''}`
      : '—';

  const planTexto =
    formulario.planEstudio
      ? `${formulario.planEstudio.codigo || ''} - ${formulario.planEstudio.nombre || ''}`
      : '—';

  const asignaturasTexto =
    Array.isArray(
      datos.asignaturasAprobadas
    ) &&
    datos.asignaturasAprobadas.length > 0
      ? datos.asignaturasAprobadas
          .map(
            (a) =>
              a.codigo ||
              a.planAsignaturaId
          )
          .join(', ')
      : 'Ninguna reportada';

  content.innerHTML =
    FormDialog({
      formId:
        'detalleSolicitudForm',

      title:
        'Detalle de la solicitud',

      description:
        obtenerNombreSolicitud(
          solicitud
        ),

      cancelButtonId:
        'cerrarDetalleSolicitud',

      cancelText:
        'Cerrar',

      layout: 'grid',

      body: `
        <label>
          <span>Nombre completo</span>
          <input
            type="text"
            value="${escapeHtml(
              obtenerNombreSolicitud(
                solicitud
              )
            )}"
            readonly
          >
        </label>

        <label>
          <span>Cédula</span>
          <input
            type="text"
            value="${escapeHtml(
              datos.identificacion ||
              '—'
            )}"
            readonly
          >
        </label>

        <label>
          <span>Correo estudiantil</span>
          <input
            type="text"
            value="${escapeHtml(
              datos.correoEstudiantil ||
              '—'
            )}"
            readonly
          >
        </label>

        <label>
          <span>Teléfono / Contacto</span>
          <input
            type="text"
            value="${escapeHtml(
              datos.contacto ||
              '—'
            )}"
            readonly
          >
        </label>

        <label>
          <span>Formulario de origen</span>
          <input
            type="text"
            value="${escapeHtml(
              formulario.titulo ||
              '—'
            )}"
            readonly
          >
        </label>

        <label>
          <span>Carrera (del formulario)</span>
          <input
            type="text"
            value="${escapeHtml(
              carreraTexto
            )}"
            readonly
          >
        </label>

        <label>
          <span>Plan de estudio (del formulario)</span>
          <input
            type="text"
            value="${escapeHtml(
              planTexto
            )}"
            readonly
          >
        </label>

        <label>
          <span>Estado de la solicitud</span>
          <input
            type="text"
            value="${escapeHtml(
              solicitud.estado ||
              '—'
            )}"
            readonly
          >
        </label>

        <label class="sgpa-form-wide">
          <span>Asignaturas aprobadas reportadas (${
            Array.isArray(
              datos.asignaturasAprobadas
            )
              ? datos.asignaturasAprobadas.length
              : 0
          })</span>
          <input
            type="text"
            value="${escapeHtml(
              asignaturasTexto
            )}"
            readonly
          >
        </label>

        ${
          datos.optativasNoDisciplinarias ||
          solicitud.optativasNoDisciplinarias
            ? `
              <label class="sgpa-form-wide">
                <span>Optativas no disciplinarias</span>
                <input
                  type="text"
                  value="${escapeHtml(
                    datos.optativasNoDisciplinarias ||
                    solicitud.optativasNoDisciplinarias
                  )}"
                  readonly
                >
              </label>
            `
            : ''
        }

        ${
          solicitud.detalleError
            ? `
              <label class="sgpa-form-wide">
                <span>Detalle de revisión / error</span>
                <textarea
                  rows="2"
                  readonly
                  style="color: var(--color-danger, #dc2626);"
                >${escapeHtml(
                  solicitud.detalleError
                )}</textarea>
              </label>
            `
            : ''
        }
      `
    });

  renderizarIconos();

  dialog.showModal();

  habilitarCierreExterior(
    dialog
  );

  document
    .getElementById(
      'cerrarDetalleSolicitud'
    )
    ?.addEventListener(
      'click',
      () => dialog.close()
    );
}
