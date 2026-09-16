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
  obtenerProgresoEstudiante
} from '../../services/estudiantes.service.js';

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
  confirmarAccion
} from '../../utils/confirm.js';

import {
  escapeHtml
} from '../../utils/html.js';

import {
  renderizarIconos
} from '../../utils/icons.js';

let estudiantes = [];

let catalogoEstudiantes = [];

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

export function EstudiantesPage() {
  return `
    <section
      id="estudiantesPage"
      class="module-view"
    >
      <div class="planes-toolbar">
        <div>
          <h2>
            Estudiantes
          </h2>

          <p>
            Gestión de estudiantes
            y seguimiento académico.
          </p>
        </div>

        ${
          usuarioTienePermiso(
            PERMISOS.GESTIONAR
          )
            ? `
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
          id="estudiantesCarrera"
          class="planes-select"
          aria-label="Filtrar por carrera"
        >
          <option value="">
            Todas las carreras
          </option>
        </select>

        <select
          id="estudiantesPlan"
          class="planes-select"
          aria-label="Filtrar por plan"
        >
          <option value="">
            Todos los planes
          </option>
        </select>

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
      ></div>

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

function obtenerFiltros() {
  const texto =
    document
      .getElementById(
        'estudiantesBuscar'
      )
      ?.value
      ?.trim() || '';

  const carreraId =
    Number(
      document.getElementById(
        'estudiantesCarrera'
      )?.value
    ) || undefined;

  const planEstudioId =
    Number(
      document.getElementById(
        'estudiantesPlan'
      )?.value
    ) || undefined;

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
  const carreraSelect =
    document.getElementById(
      'estudiantesCarrera'
    );

  const periodoSelect =
    document.getElementById(
      'estudiantesPeriodo'
    );

  if (
    !carreraSelect ||
    !periodoSelect
  ) {
    return;
  }

  const carreras =
    new Map();

  const periodos =
    new Map();

  for (
    const estudiante
    of catalogoEstudiantes
  ) {
    if (estudiante.carrera) {
      carreras.set(
        estudiante.carrera.id,
        estudiante.carrera
      );
    }

    if (estudiante.periodoIngreso) {
      periodos.set(
        estudiante.periodoIngreso.id,
        estudiante.periodoIngreso
      );
    }
  }

  carreraSelect.innerHTML = `
    <option value="">
      Todas las carreras
    </option>

    ${[...carreras.values()]
      .map(
        (carrera) => `
          <option value="${carrera.id}">
            ${escapeHtml(
              carrera.codigo
            )}
            -
            ${escapeHtml(
              carrera.nombre
            )}
          </option>
        `
      )
      .join('')}
  `;

  periodoSelect.innerHTML = `
    <option value="">
      Todos los períodos
    </option>

    ${[...periodos.values()]
      .map(
        (periodo) => `
          <option value="${periodo.id}">
            ${escapeHtml(
              periodo.codigo
            )}
          </option>
        `
      )
      .join('')}
  `;

  actualizarPlanesFiltro();
}

function actualizarPlanesFiltro() {
  const carreraSelect =
    document.getElementById(
      'estudiantesCarrera'
    );

  const planSelect =
    document.getElementById(
      'estudiantesPlan'
    );

  if (
    !carreraSelect ||
    !planSelect
  ) {
    return;
  }

  const carreraId =
    Number(
      carreraSelect.value
    ) || null;

  const planes =
    new Map();

  for (
    const estudiante
    of catalogoEstudiantes
  ) {
    if (
      carreraId &&
      estudiante.carreraId !==
        carreraId
    ) {
      continue;
    }

    if (estudiante.planEstudio) {
      planes.set(
        estudiante.planEstudio.id,
        estudiante.planEstudio
      );
    }
  }

  planSelect.innerHTML = `
    <option value="">
      Todos los planes
    </option>

    ${[...planes.values()]
      .map(
        (plan) => `
          <option value="${plan.id}">
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
  `;
}

async function cargarEstudiantes(
  instancia,
  actualizarCatalogo = false
) {
  try {
    const resultado =
      await listarEstudiantes(
        obtenerFiltros()
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
    const {
      carreras,
      planes,
      periodos
    } =
      await obtenerCatalogosEstudiante();

    const opcionesCarreras =
      carreras
        .map(
          (item) => `
            <option value="${item.id}">
              ${escapeHtml(item.codigo)}
              -
              ${escapeHtml(item.nombre)}
            </option>
          `
        )
        .join('');

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

          <label>
            <span>Carrera</span>
            <select
              id="nuevoCarrera"
              required
            >
              <option
                value=""
                selected
                disabled
              >
                Seleccione...
              </option>

              ${opcionesCarreras}
            </select>
          </label>

          <label>
            <span>Plan de estudio</span>
            <select
              id="nuevoPlan"
              disabled
              required
            >
              <option value="">
                Seleccione primero una carrera...
              </option>
            </select>
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

    const carreraInput =
      document.getElementById(
        'nuevoCarrera'
      );

    const planInput =
      document.getElementById(
        'nuevoPlan'
      );

    carreraInput?.addEventListener(
      'change',
      () => {
        const carreraId =
          Number(carreraInput.value);

        const disponibles =
          planes.filter(
            (plan) =>
              plan.carreraId === carreraId
          );

        planInput.innerHTML = `
          <option
            value=""
            selected
            disabled
          >
            Seleccione...
          </option>

          ${disponibles
            .map(
              (plan) => `
                <option value="${plan.id}">
                  ${escapeHtml(plan.codigo)}
                  -
                  ${escapeHtml(plan.nombre)}
                </option>
              `
            )
            .join('')}
        `;

        planInput.disabled =
          disponibles.length === 0;
      }
    );

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
                  Number(
                    carreraInput.value
                  ),

                planEstudioId:
                  Number(
                    planInput.value
                  ),

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

export function iniciarEstudiantesPage() {
  instanciaActual += 1;

  const instancia =
    instanciaActual;

  estudiantes = [];

  catalogoEstudiantes = [];

  const buscar =
    document.getElementById(
      'estudiantesBuscar'
    );

  const carrera =
    document.getElementById(
      'estudiantesCarrera'
    );

  const plan =
    document.getElementById(
      'estudiantesPlan'
    );

  const periodo =
    document.getElementById(
      'estudiantesPeriodo'
    );

  const estado =
    document.getElementById(
      'estudiantesEstado'
    );

  const contenedor =
    document.getElementById(
      'estudiantesContent'
    );

  const nuevoBtn =
    document.getElementById(
      'nuevoEstudianteButton'
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

  carrera?.addEventListener(
    'change',
    () => {
      actualizarPlanesFiltro();

      cargarEstudiantes(
        instancia
      );
    }
  );

  plan?.addEventListener(
    'change',
    () => {
      cargarEstudiantes(
        instancia
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

  contenedor?.addEventListener(
    'click',
    manejarAccionEstudiante
  );

  nuevoBtn?.addEventListener(
    'click',
    abrirNuevoEstudiante
  );

  renderizarIconos();

  cargarEstudiantes(
    instancia,
    true
  );
}
