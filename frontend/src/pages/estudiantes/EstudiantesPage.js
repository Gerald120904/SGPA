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
  actualizarEstudiante
} from '../../services/estudiantes.service.js';

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

    case 'editar':
      await abrirEditarEstudiante(id);
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

  renderizarIconos();

  cargarEstudiantes(
    instancia,
    true
  );
}
