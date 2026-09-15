import {
  DataTable
} from '../../components/DataTable.js';

import {
  mostrarError
} from '../../components/AlertModal.js';

import {
  listarEstudiantes
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
        'Estado'
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

  renderizarIconos();

  cargarEstudiantes(
    instancia,
    true
  );
}
