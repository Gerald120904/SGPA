import {
  DataTable
} from '../../components/DataTable.js';

import {
  FormDialog,
  habilitarCierreExterior
} from '../../components/FormDialog.js';

import {
  mostrarError,
  mostrarAdvertencia,
  mostrarExito
} from '../../components/AlertModal.js';

import {
  SelectionCard
} from '../../components/SelectionCard.js';

import {
  StatusBadge
} from '../../components/StatusBadge.js';

import {
  usuarioTienePermiso,
  obtenerRolesUsuario,
  obtenerRolActivo
} from '../../app/session.js';
import { ROLES } from '../../config/permissions.js';
import {
  proponerCrearEstudiante,
  proponerActualizarEstudiante,
  proponerEstadoEstudiante,
  proponerCambioPlanEstudiante,
  proponerResultadoEstudiante,
  proponerImportacionEstudiantes,
} from '../../services/solicitudes-cambio.service.js';
import { obtenerCatalogoEstudiantesJerarquia } from '../../services/jerarquia.service.js';
import { listarOptativas } from '../../services/optativas.service.js';

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
  evaluarGraduacionEstudiante,
  registrarResultadoAcademicoEstudiante,
  contarEstudiantesPorCarrera,
  contarEstudiantesPorPlan,
  listarBandejaRevisionEstudiantes,
  obtenerRegistroRevisionEstudiante,
  aprobarRegistrosRevision,
  rechazarRegistrosRevision,
  devolverRegistrosRevision
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
  escapeHtml,
  calcularLongitudTexto
} from '../../utils/html.js';

import {
  renderizarIconos
} from '../../utils/icons.js';

import {
  ESTADOS_ESTUDIANTE as ESTADOS,
  ORIGENES_ACADEMICOS_ESTUDIANTE as ORIGENES_ACADEMICOS,
  RESULTADOS_ACADEMICOS_ESTUDIANTE as RESULTADOS_ACADEMICOS,
  obtenerTonoEstadoEstudiante,
  obtenerTonoEstadoSolicitud,
  extraerDataResultado as extraerData,
  obtenerNombreCompletoEstudiante as obtenerNombreCompleto,
  formatearEstadoEstudiante as formatearEstado,
  obtenerTextoAsignaturaEstudiante as obtenerTextoAsignatura,
  obtenerTextoPeriodoEstudiante as obtenerTextoPeriodo,
  esPeriodoIgualOPosterior,
  obtenerTextoPlanEstudiante as obtenerTextoPlan,
  obtenerNombreResponsableEstudiante as obtenerNombreResponsable,
  formatearFechaHoraEstudiante as formatearFechaHora,
  formatearTextoEnumEstudiante as formatearTextoEnum,
  obtenerResumenImportacion,
  obtenerDetalleFilaImportacion,
} from './estudiantes.helpers.js';

import {
  renderizarHistorialAcademico as renderizarHistorialAcademicoComponente,
  renderizarHistorialPlanes as renderizarHistorialPlanesComponente,
  renderizarProgresoEstudiante as renderizarProgresoEstudianteComponente,
} from './EstudianteExpedienteView.js';

import {
  renderizarPreviewImportacionEstudiantes as renderizarPreviewImportacionEstudiantesComponente,
  abrirImportacionEstudiantes as abrirImportacionEstudiantesComponente,
} from './EstudianteImportacionDialog.js';

export {
  ESTADOS,
  ORIGENES_ACADEMICOS,
  RESULTADOS_ACADEMICOS,
  obtenerTonoEstadoEstudiante,
  obtenerTonoEstadoSolicitud,
  extraerData,
  obtenerNombreCompleto,
  formatearEstado,
  obtenerTextoAsignatura,
  obtenerTextoPeriodo,
  esPeriodoIgualOPosterior,
  obtenerTextoPlan,
  obtenerNombreResponsable,
  formatearFechaHora,
  formatearTextoEnum,
  obtenerResumenImportacion,
  obtenerDetalleFilaImportacion,
};

let carreraSeleccionada = null;

let planSeleccionado = null;

let vistaActual = 'CARRERAS';

let carrerasDisponibles = [];

let planesDisponibles = [];

let estudiantes = [];

let catalogoEstudiantes = [];

let solicitudesFormularios = [];

let registrosBandejaRevision = [];
let seleccionBandejaRevision = new Set();

let intervaloSolicitudes = null;

function esCuentaJerarquica() {
  const rol = obtenerRolActivo();
  return rol === ROLES.COORDINADOR || rol === ROLES.ASISTENTE_ESTUDIANTIL;
}

function esAsistenteActivo() {
  return obtenerRolActivo() === ROLES.ASISTENTE_ESTUDIANTIL;
}

async function listarCarrerasParaEstudiantes() {
  if (!esCuentaJerarquica()) return listarCarreras();
  const resultado = await obtenerCatalogoEstudiantesJerarquia();
  return resultado.ok ? { ok: true, carreras: resultado.data.carreras } : resultado;
}

async function listarPlanesParaEstudiantes() {
  if (!esCuentaJerarquica()) return listarPlanesEstudio();
  const resultado = await obtenerCatalogoEstudiantesJerarquia();
  return resultado.ok ? { ok: true, planes: resultado.data.planes } : resultado;
}

async function listarPeriodosParaEstudiantes() {
  if (!esCuentaJerarquica()) return listarPeriodosAcademicos();
  const resultado = await obtenerCatalogoEstudiantesJerarquia();
  return resultado.ok ? { ok: true, periodos: resultado.data.periodos } : resultado;
}

let instanciaActual = 0;

let timerBusqueda = null;

const PERMISOS = {
  GESTIONAR:
    'ESTUDIANTES_GESTIONAR'
};

function configurarTamanoDialog(
  dialog,
  tamano = 'md'
) {
  if (!dialog) {
    return;
  }

  dialog.classList.remove(
    'sgpa-form-dialog-md',
    'sgpa-form-dialog-lg'
  );

  dialog.classList.add(
    tamano === 'lg'
      ? 'sgpa-form-dialog-lg'
      : 'sgpa-form-dialog-md'
  );
}

export function EstudiantesPage() {
  return `
    <section
      id="estudiantesPage"
      class="module-view estudiantes-page"
    >
      <div class="sgpa-toolbar">
        <div>
          <nav
            class="estudiantes-breadcrumb"
            aria-label="Ruta de navegación"
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

function renderizarEstudiantes() {
  const contenedor =
    document.getElementById(
      'estudiantesContent'
    );

  if (!contenedor) {
    return;
  }

  const esAsistente = esAsistenteActivo();
  const puedeEditar = usuarioTienePermiso(PERMISOS.GESTIONAR);
  const puedeGestionar = !esAsistente && puedeEditar;

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
              ${StatusBadge({
                label: formatearEstado(
                  estudiante.estado
                ),
                tone:
                  obtenerTonoEstadoEstudiante(
                    estudiante.estado
                  )
              })}
            </td>

            <td>
              <div class="sgpa-table-actions">
                <button
                  type="button"
                  class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-icon-button"
                  data-action="ver"
                  data-id="${estudiante.id}"
                  title="Ver estudiante"
                  aria-label="Ver estudiante"
                >
                  <i
                    data-lucide="eye"
                    aria-hidden="true"
                  ></i>
                </button>

                <button
                  type="button"
                  class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-icon-button"
                  data-action="expediente"
                  data-id="${estudiante.id}"
                  title="Ver expediente académico"
                  aria-label="Ver expediente académico"
                >
                  <i
                    data-lucide="folder-open"
                    aria-hidden="true"
                  ></i>
                </button>

                ${
                  puedeEditar
                    ? `
                      <button
                        type="button"
                        class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-icon-button"
                        data-action="editar"
                        data-id="${estudiante.id}"
                        title="Editar estudiante"
                        aria-label="Editar estudiante"
                      >
                        <i
                          data-lucide="pencil"
                          aria-hidden="true"
                        ></i>
                      </button>

                      <button
                        type="button"
                        class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-icon-button"
                        data-action="estado"
                        data-id="${estudiante.id}"
                        title="Cambiar estado"
                        aria-label="Cambiar estado"
                      >
                        <i
                          data-lucide="toggle-left"
                          aria-hidden="true"
                        ></i>
                      </button>

                    `
                    : ''
                }

                ${
                  puedeGestionar
                    ? `

                      <button
                        type="button"
                        class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-icon-button"
                        data-action="plan"
                        data-id="${estudiante.id}"
                        title="Cambiar plan"
                        aria-label="Cambiar plan"
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
  return renderizarHistorialAcademicoComponente(historial);
}

function renderizarHistorialPlanes(
  historial
) {
  return renderizarHistorialPlanesComponente(historial);
}

function renderizarProgresoEstudiante(
  progreso
) {
  return renderizarProgresoEstudianteComponente(progreso);
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
    <div class="sgpa-toolbar">
      <div>
        <h3>Seleccione una carrera</h3>
        <p>Elija una carrera para ver sus planes de estudio y estudiantes asociados.</p>
      </div>
    </div>
    <div class="sgpa-state-message">Cargando carreras...</div>
  `;

  try {
    const [
      resultadoCarreras,
      resultadoPlanes,
      resultadoConteos
    ] = await Promise.all([
      listarCarrerasParaEstudiantes(),
      listarPlanesParaEstudiantes(),
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
        <div class="sgpa-toolbar">
          <div>
            <h3>Seleccione una carrera</h3>
            <p>Elija una carrera para ver sus planes de estudio y estudiantes asociados.</p>
          </div>
        </div>
        <div class="sgpa-state-message">
          No tiene carreras asignadas o disponibles.
        </div>
      `;
      renderizarIconos();
      return;
    }

    contenedor.innerHTML = `
      <div class="sgpa-toolbar">
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

              return SelectionCard({
                dataAttribute: 'data-carrera-id',
                dataValue: carrera.id,
                icon: 'graduation-cap',
                title: carrera.nombre,
                description: carrera.descripcion || '',
                details: [
                  `${numPlanes} ${numPlanes === 1 ? 'plan' : 'planes'}`,
                  `${numEstudiantes} ${numEstudiantes === 1 ? 'estudiante' : 'estudiantes'}`
                ],
                actionText: 'Ver planes'
              });
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
      <div class="sgpa-toolbar">
        <div>
          <h3>Seleccione una carrera</h3>
        </div>
      </div>
      <div class="sgpa-state-message sgpa-state-message-error" role="alert">
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
    <div class="sgpa-toolbar">
      <div>
        <button
          type="button"
          id="volverACarrerasBtn"
          class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-back-button"
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
    <div class="sgpa-state-message">Cargando planes de estudio...</div>
  `;
  renderizarIconos();

  try {
    const [
      resultadoPlanes,
      resultadoEstudiantes,
      resultadoSolicitudes
    ] = await Promise.all([
      listarPlanesParaEstudiantes(),
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
        <div class="sgpa-toolbar">
          <div>
            <button
              type="button"
              id="volverACarrerasBtn"
              class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-back-button"
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
        <div class="sgpa-state-message">
          Esta carrera no tiene planes de estudio registrados.
        </div>
      `;
      renderizarIconos();
      return;
    }

    contenedor.innerHTML = `
      <div class="sgpa-toolbar">
        <div>
          <button
            type="button"
            id="volverACarrerasBtn"
            class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-back-button"
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

              return SelectionCard({
                dataAttribute: 'data-plan-id',
                dataValue: plan.id,
                icon: 'book-open',
                title: plan.nombre || plan.codigo,
                details: [
                  `${numEst} ${numEst === 1 ? 'estudiante' : 'estudiantes'}`,
                  `${numSol} ${numSol === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}`
                ],
                status: StatusBadge({
                  label: plan.activo === false ? 'Inactivo' : 'Activo',
                  tone: plan.activo === false ? 'neutral' : 'success'
                }),
                actionText: 'Ver estudiantes'
              });
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
      <div class="sgpa-toolbar">
        <div>
          <button
            type="button"
            id="volverACarrerasBtn"
            class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-back-button"
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
      <div class="sgpa-state-message sgpa-state-message-error" role="alert">
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
    <div class="sgpa-toolbar">
      <div>
        <button
          type="button"
          id="volverAPlanesBtn"
          class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-back-button"
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
            <div class="sgpa-toolbar-actions">
              ${esAsistenteActivo() ? '' : `<button
                id="importarEstudiantesExcelButton"
                type="button"
                class="sgpa-button sgpa-button-secondary"
              >
                <i
                  data-lucide="file-spreadsheet"
                  aria-hidden="true"
                ></i>

                Importar Excel
              </button>`}

              <button
                id="nuevoEstudianteButton"
                type="button"
                class="sgpa-button sgpa-button-primary"
              >
                <i
                  data-lucide="user-plus"
                  aria-hidden="true"
                ></i>

                ${esAsistenteActivo()
                  ? 'Solicitar nuevo estudiante' : 'Nuevo estudiante'}
              </button>
            </div>
          `
          : ''
      }
    </div>

    <div class="sgpa-filters">
      <label
        class="sgpa-search"
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
        class="sgpa-select"
        aria-label="Filtrar por período de ingreso"
      >
        <option value="">
          Todos los períodos
        </option>
      </select>

      <select
        id="estudiantesEstado"
        class="sgpa-select"
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
      <div class="sgpa-state-message">Cargando estudiantes...</div>
    </div>

    <section class="estudiantes-revision sgpa-section-spaced" aria-labelledby="bandejaRevisionTitulo">
      <div class="sgpa-toolbar">
        <div>
          <h2 id="bandejaRevisionTitulo">Bandeja de revisión</h2>
          <p>Importaciones y respuestas pendientes de aprobación para este plan.</p>
        </div>
        <button id="tabNavBandejaRevision" type="button" class="sgpa-button sgpa-button-secondary sgpa-button-sm">
          <i data-lucide="refresh-cw" aria-hidden="true"></i> Actualizar
        </button>
      </div>
      <div class="sgpa-filters">
        <label>Fuente
          <select id="bandejaRevisionFuente" class="sgpa-select">
            <option value="">Todas</option><option value="EXCEL">Excel</option>
            <option value="FORMULARIO_INTERNO">Formulario interno</option>
            <option value="GOOGLE_FORMS">Google Forms</option>
          </select>
        </label>
        <label>Estado
          <select id="bandejaRevisionEstado" class="sgpa-select">
            <option value="">Pendientes</option><option value="PENDIENTE">Pendiente</option>
            <option value="REQUIERE_REVISION">Requiere revisión</option>
            <option value="DEVUELTO_PARA_CORRECCION">Devuelto</option>
            <option value="APROBADO">Aprobado</option><option value="RECHAZADO">Rechazado</option>
          </select>
        </label>
        <label>Buscar
          <input id="bandejaRevisionTexto" type="search" class="sgpa-input" placeholder="Cédula, nombre o correo" maxlength="100">
        </label>
      </div>
      <div id="bandejaRevisionContent" aria-live="polite"><div class="sgpa-state-message">Cargando revisión...</div></div>
    </section>

    <div class="sgpa-toolbar sgpa-section-spaced">
      <div>
        <h2>
          Solicitudes de formularios
        </h2>

        <p>
          Respuestas recibidas que requieren revisión antes de ingresar al padrón de estudiantes.
        </p>
      </div>

      <div>
        <strong id="solicitudesFormulariosContador" class="estudiantes-request-count">
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

  configurarBandejaRevision();

  await cargarEstudiantes(
    instanciaActual,
    true
  );

  await cargarBandejaRevision(carreraSeleccionada.id, planSeleccionado.id);

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

    configurarTamanoDialog(dialog, 'md');

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
          esAsistenteActivo()
            ? 'Proponer actualización de estudiante'
            : 'Editar estudiante',

        description:
          esAsistenteActivo()
            ? 'El coordinador debe aprobar esta propuesta antes de aplicar los cambios.'
            : 'Actualice la información personal del estudiante.',

        errorId:
          'editarEstudianteError',

        cancelButtonId:
          'cancelarEditarEstudiante',

        submitButtonId:
          'guardarEstudianteButton',

        submitText:
          esAsistenteActivo()
            ? 'Enviar propuesta'
            : 'Guardar cambios',

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

    configurarTamanoDialog(dialog, 'md');

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
              await (esAsistenteActivo()
                ? proponerActualizarEstudiante
                : actualizarEstudiante)(
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
                esAsistenteActivo()
                  ? 'Propuesta enviada'
                  : 'Estudiante actualizado',
              mensaje:
                esAsistenteActivo()
                  ? 'La actualización quedó pendiente de aprobación.'
                  : 'La información se actualizó correctamente.'
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
    listarCarrerasParaEstudiantes(),
    listarPlanesParaEstudiantes(),
    listarPeriodosParaEstudiantes()
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
      await listarPeriodosParaEstudiantes();

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
          esAsistenteActivo()
            ? 'La propuesta quedará pendiente hasta que la apruebe su coordinador.'
            : 'Registre los datos personales y académicos iniciales.',

        errorId:
          'nuevoEstudianteError',

        cancelButtonId:
          'cancelarNuevoEstudiante',

        submitButtonId:
          'crearEstudianteButton',

        submitText:
          esAsistenteActivo()
            ? 'Enviar solicitud de creación'
            : 'Crear estudiante',

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

    configurarTamanoDialog(dialog, 'md');

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
            const esAsistente = esAsistenteActivo();
            const datosEstudiante = {
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
              };
            const resultado = esAsistente
              ? await proponerCrearEstudiante(datosEstudiante)
              : await crearEstudiante(datosEstudiante);

            if (!resultado?.ok) {
              throw new Error(
                resultado?.message ||
                'No fue posible crear el estudiante.'
              );
            }

            dialog.close();

            mostrarExito({
              titulo:
                esAsistente ? 'Solicitud enviada' : 'Estudiante creado',
              mensaje:
                esAsistente
                  ? 'La propuesta está pendiente de aprobación. Los datos oficiales aún no cambiaron.'
                  : 'El estudiante fue registrado correctamente.'
            });

            if (!esAsistente) await cargarEstudiantes(instanciaActual, true);
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
        esAsistenteActivo()
          ? 'Proponer cambio de estado'
          : 'Cambiar estado',

      description:
        obtenerNombreCompleto(
          estudiante
        ),

      cancelButtonId:
        'cancelarCambioEstado',

      submitButtonId:
        'guardarEstadoEstudiante',

      submitText:
        esAsistenteActivo()
          ? 'Enviar propuesta'
          : 'Cambiar estado',

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
  configurarTamanoDialog(dialog, 'md');
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
              `${esAsistenteActivo() ? 'Se solicitará cambiar el estado' : 'El estudiante pasará'} de ${formatearEstado(
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
            await (esAsistenteActivo()
              ? proponerEstadoEstudiante
              : cambiarEstadoEstudiante)(
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
              esAsistenteActivo()
                ? 'Propuesta enviada'
                : 'Estado actualizado',
            mensaje:
              esAsistenteActivo()
                ? 'El cambio de estado quedó pendiente de aprobación.'
                : 'El estado del estudiante se actualizó correctamente.'
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
        listarPlanesParaEstudiantes(),
        listarPeriodosParaEstudiantes()
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

    const periodos = (resultadoPeriodos.periodos ?? []).filter((periodo) =>
      esPeriodoIgualOPosterior(periodo, estudiante.periodoIngreso)
    );

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
              placeholder="Ingrese la justificación del rechazo (obligatorio, máximo 500 caracteres)" required
            ></textarea>
          </label>
        `
      });

    renderizarIconos();
    configurarTamanoDialog(dialog, 'md');
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
            const esAsistente =
              esAsistenteActivo();
            const datosPlan = {
              planNuevoId: Number(
                document.getElementById('planNuevoEstudiante').value,
              ),
              periodoCambioId: Number(
                document.getElementById('periodoCambioEstudiante').value,
              ),
              motivo:
                document.getElementById('motivoCambioPlan').value.trim() ||
                null,
            };
            const respuesta = esAsistente
              ? await proponerCambioPlanEstudiante(id, datosPlan)
              : await cambiarPlanEstudiante(id, datosPlan);

            if (!respuesta?.ok) {
              throw new Error(
                respuesta?.message ||
                'No fue posible cambiar el plan.'
              );
            }

            dialog.close();

            mostrarExito({
              titulo:
                esAsistente ? 'Solicitud enviada' : 'Plan actualizado',
              mensaje:
                esAsistente
                  ? 'La propuesta de cambio de plan fue enviada a su coordinador para revisión.'
                  : 'El cambio de plan se registró correctamente en el historial del estudiante.'
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

        listarPeriodosParaEstudiantes()
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

    const periodos = (
      Array.isArray(resultadoPeriodos.periodos)
        ? resultadoPeriodos.periodos
        : []
    ).filter((periodo) =>
      esPeriodoIgualOPosterior(periodo, estudiante.periodoIngreso)
    );

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
            <h3>Evaluación de graduación</h3>
            <button id="evaluarGraduacionEstudianteButton" type="button" class="sgpa-form-primary">
              Evaluar cumplimiento
            </button>
            <div id="expedienteEvaluacionGraduacion" role="status" aria-live="polite"></div>
          </div>


          ${
            usuarioTienePermiso(
              PERMISOS.GESTIONAR
            )
              ? `
                <div class="sgpa-form-wide">
                  <button
                    id="registrarResultadoAcademicoButton"
                    type="button"
                    class="sgpa-form-primary"
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

    configurarTamanoDialog(dialog, 'lg');

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

    document.getElementById('evaluarGraduacionEstudianteButton')
      ?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        const contenedor = document.getElementById('expedienteEvaluacionGraduacion');
        button.disabled = true;
        contenedor.textContent = 'Evaluando cumplimiento...';
        try {
          const respuesta = await evaluarGraduacionEstudiante(estudiante.id);
          if (!respuesta?.ok) throw new Error(respuesta?.message || 'No fue posible evaluar la graduación.');
          const evaluacion = respuesta.data ?? respuesta.evaluacion;
          if (!evaluacion?.dictamen || !evaluacion.creditos || !evaluacion.optativas) {
            throw new Error('La evaluación devolvió una respuesta incompleta.');
          }
          const categorias = [
            ['Disciplinarias', evaluacion.optativas.disciplinarias],
            ['Abiertas', evaluacion.optativas.abiertas],
            ['De sede', evaluacion.optativas.sede],
          ];
          contenedor.innerHTML = `
            <p><strong>Dictamen:</strong> ${escapeHtml(evaluacion.dictamen)}</p>
            <p><strong>Créditos aprobados:</strong> ${Number(evaluacion.creditos.aprobadosTotal || 0)} de ${Number(evaluacion.creditos.requeridosTotal || 0)}</p>
            <p><strong>Optativas reconocidas:</strong> ${categorias.map(([nombre, datos]) =>
              `${nombre} ${Number(datos?.aprobadas || 0)}/${Number(datos?.requeridas || 0)}`
            ).join(' · ')}</p>
            ${(evaluacion.motivosBloqueo || []).length
              ? `<ul>${evaluacion.motivosBloqueo.map((motivo) => `<li>${escapeHtml(motivo)}</li>`).join('')}</ul>`
              : '<p>Sin requisitos pendientes en la evaluación.</p>'}
          `;
        } catch (error) {
          contenedor.textContent = error?.message || 'No fue posible evaluar la graduación.';
        } finally {
          button.disabled = false;
        }
      });

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
      resultadoPeriodos,
      resultadoOptativas
    ] =
      await Promise.all([
        listarPlanAsignaturas(
          estudiante.planEstudioId
        ),

        listarPeriodosParaEstudiantes(),
        listarOptativas()
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
                (item.tipo === 'OPTATIVA' ||
                  item.cursoId != null ||
                  item.curso?.id != null
                )
            )
        : [];

    const periodos = (
      Array.isArray(resultadoPeriodos.periodos)
        ? resultadoPeriodos.periodos
        : []
    ).filter((periodo) =>
      esPeriodoIgualOPosterior(periodo, estudiante.periodoIngreso)
    );

    const optativasDisponibles = (resultadoOptativas?.optativas || []).filter((item) =>
      item.activo && item.curso?.activo &&
      (item.tipo !== 'DISCIPLINARIA' || item.carreraOrigenId === estudiante.carreraId)
    );

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

          <label class="sgpa-form-wide" id="resultadoOptativaRealLabel" hidden>
            <span>Asignatura optativa cursada</span>
            <select id="resultadoOptativaReal">
              <option value="">Seleccione una optativa del catálogo...</option>
              ${optativasDisponibles.map((item) => `
                <option value="${item.id}">${escapeHtml(item.curso.codigo)} · ${escapeHtml(item.curso.nombre)} (${escapeHtml(item.tipo)})</option>
              `).join('')}
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
              maxlength="1000"
              placeholder="Opcional"
            ></textarea>
          </label>
        `
      });

    const selectorEspacio = document.getElementById('resultadoPlanAsignatura');
    const selectorOptativa = document.getElementById('resultadoOptativaReal');
    const etiquetaOptativa = document.getElementById('resultadoOptativaRealLabel');
    const actualizarOptativa = () => {
      const esOptativa = asignaturas.find((item) => item.id === Number(selectorEspacio?.value))?.tipo === 'OPTATIVA';
      if (etiquetaOptativa) etiquetaOptativa.hidden = !esOptativa;
      if (selectorOptativa) {
        selectorOptativa.required = esOptativa;
        if (!esOptativa) selectorOptativa.value = '';
      }
    };
    selectorEspacio?.addEventListener('change', actualizarOptativa);
    actualizarOptativa();

    renderizarIconos();

    configurarTamanoDialog(dialog, 'md');

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

            const esAsistente =
              esAsistenteActivo();
            const datosResultado = {
              planAsignaturaId,
              ...(document.getElementById('resultadoOptativaReal')?.value
                ? { cursoOptativoId: Number(document.getElementById('resultadoOptativaReal').value) }
                : {}),
              periodoId,
              resultado,
              origenAcademico,
              observaciones: observaciones || null,
            };
            const respuesta = esAsistente
              ? await proponerResultadoEstudiante(estudiante.id, datosResultado)
              : await registrarResultadoAcademicoEstudiante(
                  estudiante.id,
                  datosResultado,
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
                esAsistente ? 'Solicitud enviada' : 'Resultado registrado',
              mensaje:
                esAsistente
                  ? 'La propuesta de resultado académico fue enviada a su coordinador para revisión.'
                  : 'El resultado académico fue registrado correctamente en el expediente.'
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

function renderizarPreviewImportacionEstudiantes(
  preview,
  contexto
) {
  return renderizarPreviewImportacionEstudiantesComponente(
    preview,
    contexto,
    {
      esAsistente: esAsistenteActivo(),
      onImportado: async (ctx) => {
        const tabBandeja = document.getElementById('tabNavBandejaRevision');
        if (tabBandeja) {
          tabBandeja.click();
        } else {
          await cargarBandejaRevision(ctx.carreraId, ctx.planEstudioId);
        }
      },
    }
  );
}

async function abrirImportacionEstudiantes() {
  return abrirImportacionEstudiantesComponente({
    carrera: carreraSeleccionada,
    plan: planSeleccionado,
    esAsistente: esAsistenteActivo(),
    configurarTamanoDialog,
    onImportado: async (ctx) => {
      const tabBandeja = document.getElementById('tabNavBandejaRevision');
      if (tabBandeja) {
        tabBandeja.click();
      } else {
        await cargarBandejaRevision(ctx.carreraId, ctx.planEstudioId);
      }
    },
  });
}


function filtrosBandejaRevision(carreraId, planEstudioId) {
  return {
    carreraId,
    planEstudioId,
    fuente: document.getElementById('bandejaRevisionFuente')?.value || undefined,
    estado: document.getElementById('bandejaRevisionEstado')?.value || undefined,
    texto: document.getElementById('bandejaRevisionTexto')?.value?.trim() || undefined,
  };
}

function renderizarBandejaRevision() {
  const contenedor = document.getElementById('bandejaRevisionContent');
  if (!contenedor) return;
  const puedeResolver = obtenerRolActivo() !== ROLES.ASISTENTE_ESTUDIANTIL &&
    usuarioTienePermiso(PERMISOS.GESTIONAR);
  const pendientes = new Set(['PENDIENTE', 'REQUIERE_REVISION', 'DEVUELTO_PARA_CORRECCION']);
  const seleccionables = registrosBandejaRevision.filter((registro) => pendientes.has(registro.estado));
  const filas = registrosBandejaRevision.map((registro) => `
    <tr>
      <td>${puedeResolver && pendientes.has(registro.estado)
        ? `<input type="checkbox" data-revision-select="${registro.id}" ${seleccionBandejaRevision.has(registro.id) ? 'checked' : ''} aria-label="Seleccionar registro ${registro.id}">`
        : ''}</td>
      <td><strong>${escapeHtml(registro.cedula || '—')}</strong><br>${escapeHtml(registro.nombreCompleto || '—')}</td>
      <td>${escapeHtml(registro.fuente || '—')}</td>
      <td>${escapeHtml(registro.accion || '—')}</td>
      <td>${escapeHtml(formatearTextoEnum(registro.estado))}</td>
      <td><button type="button" class="sgpa-button sgpa-button-secondary sgpa-button-sm" data-revision-detalle="${registro.id}">Ver detalle</button></td>
    </tr>
  `).join('');
  contenedor.innerHTML = `
    <p class="estudiantes-revision-resumen">${registrosBandejaRevision.length} registro(s) encontrados.</p>
    ${puedeResolver && seleccionables.length ? `
      <div class="sgpa-toolbar-actions estudiantes-revision-acciones">
        <button type="button" class="sgpa-button sgpa-button-secondary sgpa-button-sm" id="revisionSeleccionarTodos">Seleccionar visibles</button>
        <button type="button" class="sgpa-button sgpa-button-primary sgpa-button-sm" id="revisionAprobar" ${seleccionBandejaRevision.size ? '' : 'disabled'}>Aprobar (${seleccionBandejaRevision.size})</button>
        <button type="button" class="sgpa-button sgpa-button-secondary sgpa-button-sm" id="revisionRechazar" ${seleccionBandejaRevision.size ? '' : 'disabled'}>Rechazar</button>
        <button type="button" class="sgpa-button sgpa-button-secondary sgpa-button-sm" id="revisionDevolver" ${seleccionBandejaRevision.size ? '' : 'disabled'}>Devolver para corrección</button>
      </div>` : ''}
    ${DataTable({
      columns: ['', 'Estudiante', 'Fuente', 'Acción', 'Estado', 'Detalle'],
      rows: filas,
      emptyMessage: 'No hay registros de revisión para estos filtros.',
      ariaLabel: 'Bandeja de revisión de estudiantes',
    })}
  `;
  renderizarIconos();
}

async function cargarBandejaRevision(carreraId, planEstudioId) {
  const contenedor = document.getElementById('bandejaRevisionContent');
  if (!contenedor || !carreraId || !planEstudioId) return;
  contenedor.innerHTML = '<div class="sgpa-state-message">Cargando revisión...</div>';
  try {
    const respuesta = await listarBandejaRevisionEstudiantes(filtrosBandejaRevision(carreraId, planEstudioId));
    if (respuesta?.ok === false) throw new Error(respuesta.message || 'No fue posible consultar la bandeja.');
    const datos = extraerData(respuesta);
    registrosBandejaRevision = Array.isArray(datos) ? datos : [];
    seleccionBandejaRevision = new Set();
    renderizarBandejaRevision();
  } catch (error) {
    contenedor.innerHTML = `<div class="sgpa-state-message sgpa-state-message-error" role="alert">${escapeHtml(error?.message || 'No fue posible consultar la bandeja.')}</div>`;
  }
}

function pedirMotivoRevision(titulo) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('estudianteDialog');
    const content = document.getElementById('estudianteDialogContent');
    if (!dialog || !content) return resolve(null);
    content.innerHTML = FormDialog({
      formId: 'revisionMotivoForm', title: titulo,
      description: 'Indique el motivo que quedará registrado en la revisión.',
      body: '<label><span>Motivo (mínimo 3 caracteres)</span><textarea id="revisionMotivo" class="sgpa-textarea" rows="4" maxlength="500" required minlength="3"></textarea></label>',
      cancelButtonId: 'revisionMotivoCancelar', cancelText: 'Cancelar',
      submitButtonId: 'revisionMotivoConfirmar', submitText: 'Continuar',
    });
    const terminar = (valor) => { dialog.close(); resolve(valor); };
    dialog.addEventListener('close', () => resolve(null), { once: true });
    content.querySelector('#revisionMotivoCancelar')?.addEventListener('click', () => terminar(null));
    content.querySelector('#revisionMotivoForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const motivo = content.querySelector('#revisionMotivo')?.value?.trim() || '';
      if (motivo.length >= 3) terminar(motivo);
    });
    renderizarIconos();
    dialog.showModal();
    habilitarCierreExterior(dialog);
  });
}

async function mostrarDetalleRevision(id) {
  try {
    const respuesta = await obtenerRegistroRevisionEstudiante(id);
    if (respuesta?.ok === false) throw new Error(respuesta.message);
    const datos = extraerData(respuesta) || {};
    const registro = datos.registro || {};
    const items = (valor) => Array.isArray(valor) && valor.length
      ? valor.map((item) => `<li>${escapeHtml(typeof item === 'string' ? item : JSON.stringify(item))}</li>`).join('')
      : '<li>Ninguno</li>';
    const dialog = document.getElementById('estudianteDialog');
    const content = document.getElementById('estudianteDialogContent');
    if (!dialog || !content) return;
    content.innerHTML = FormDialog({
      formId: 'revisionDetalleForm', title: `Revisión #${id}`,
      description: `${registro.cedula || ''} · ${registro.estado || ''}`,
      layout: 'custom', cancelButtonId: 'revisionDetalleCerrar', cancelText: 'Cerrar',
      body: `<p><strong>Acción:</strong> ${escapeHtml(registro.accion || '—')}</p>
        <p><strong>Estudiante actual:</strong> ${escapeHtml(datos.estudianteActual ? obtenerNombreCompleto(datos.estudianteActual) : 'Nuevo registro')}</p>
        <h3>Cambios propuestos</h3><ul>${items(datos.cambiosPropuestos)}</ul>
        <h3>Asignaturas aprobadas</h3><ul>${items(datos.aprobacionesPropuestas)}</ul>
        <h3>Errores de validación</h3><ul>${items(datos.erroresValidacion)}</ul>`,
    });
    content.querySelector('#revisionDetalleCerrar')?.addEventListener('click', () => dialog.close());
    dialog.showModal();
    habilitarCierreExterior(dialog);
  } catch (error) {
    mostrarError({ titulo: 'No fue posible abrir el registro', mensaje: error?.message || 'Error de consulta.' });
  }
}

function configurarBandejaRevision() {
  const seccion = document.querySelector('#estudiantesNavegacion .estudiantes-revision');
  if (!seccion) return;
  const actualizar = () => cargarBandejaRevision(carreraSeleccionada?.id, planSeleccionado?.id);
  seccion.querySelector('#tabNavBandejaRevision')?.addEventListener('click', () => {
    seccion.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    actualizar();
  });
  for (const id of ['bandejaRevisionFuente', 'bandejaRevisionEstado']) {
    seccion.querySelector(`#${id}`)?.addEventListener('change', actualizar);
  }
  let temporizador;
  seccion.querySelector('#bandejaRevisionTexto')?.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(actualizar, 300);
  });
  seccion.addEventListener('change', (event) => {
    const id = Number(event.target?.dataset?.revisionSelect);
    if (!id) return;
    if (event.target.checked) seleccionBandejaRevision.add(id);
    else seleccionBandejaRevision.delete(id);
    renderizarBandejaRevision();
  });
  seccion.addEventListener('click', async (event) => {
    const detalleId = Number(event.target.closest('[data-revision-detalle]')?.dataset.revisionDetalle);
    if (detalleId) return mostrarDetalleRevision(detalleId);
    if (event.target.closest('#revisionSeleccionarTodos')) {
      seleccionBandejaRevision = new Set(registrosBandejaRevision
        .filter((r) => ['PENDIENTE', 'REQUIERE_REVISION', 'DEVUELTO_PARA_CORRECCION'].includes(r.estado))
        .map((r) => r.id));
      renderizarBandejaRevision();
      return;
    }
    const accion = event.target.closest('#revisionAprobar, #revisionRechazar, #revisionDevolver')?.id;
    if (!accion || !seleccionBandejaRevision.size) return;
    const ids = [...seleccionBandejaRevision];
    const confirmado = await confirmarAccion({
      titulo: 'Confirmar revisión', mensaje: `Se procesarán ${ids.length} registro(s).`,
      textoConfirmar: 'Continuar', peligro: accion === 'revisionRechazar',
    });
    if (!confirmado) return;
    try {
      let respuesta;
      if (accion === 'revisionAprobar') respuesta = await aprobarRegistrosRevision(ids);
      else {
        const motivo = await pedirMotivoRevision(accion === 'revisionRechazar' ? 'Motivo de rechazo' : 'Motivo de devolución');
        if (!motivo) return;
        respuesta = accion === 'revisionRechazar'
          ? await rechazarRegistrosRevision(ids.map((id) => ({ id, motivo })))
          : await devolverRegistrosRevision(ids, motivo);
      }
      if (respuesta?.ok === false) throw new Error(respuesta.message);
      const datos = extraerData(respuesta) || {};
      const fallidos = datos.fallidos || [];
      if (fallidos.length) mostrarAdvertencia({
        titulo: 'Revisión parcial', mensaje: `${fallidos.length} registro(s) no se procesaron: ${fallidos.map((f) => `#${f.id}: ${f.error}`).join('; ')}`,
      });
      else mostrarExito({ titulo: 'Revisión guardada', mensaje: 'Los registros seleccionados se procesaron correctamente.' });
      await actualizar();
      await cargarEstudiantes(instanciaActual, true);
    } catch (error) {
      mostrarError({ titulo: 'No fue posible completar la revisión', mensaje: error?.message || 'Error de conexión.' });
    }
  });
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
    !esAsistenteActivo() && usuarioTienePermiso(
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
              ${StatusBadge({
                label: solicitud.estado || '—',
                tone: obtenerTonoEstadoSolicitud(
                  solicitud.estado
                )
              })}
            </td>

            <td>
              <div class="sgpa-table-actions">
                <button
                  type="button"
                  class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-icon-button"
                  data-solicitud-action="ver"
                  data-id="${solicitud.id}"
                  title="Ver solicitud"
                  aria-label="Ver solicitud"
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
                        class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-icon-button"
                        data-solicitud-action="aceptar"
                        data-id="${solicitud.id}"
                        title="Aceptar solicitud"
                        aria-label="Aceptar solicitud"
                      >
                        <i
                          data-lucide="check"
                          aria-hidden="true"
                        ></i>
                      </button>

                      <button
                        type="button"
                        class="sgpa-button sgpa-button-secondary sgpa-button-sm sgpa-icon-button"
                        data-solicitud-action="rechazar"
                        data-id="${solicitud.id}"
                        title="Rechazar solicitud"
                        aria-label="Rechazar solicitud"
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
            Motivo del rechazo <span class="text-danger">*</span>
          </span>

          <textarea
            id="motivoRechazoSolicitud"
            rows="3"
            placeholder="Ingrese la justificación del rechazo (obligatorio, máximo 500 caracteres)"
            required
          ></textarea>
        </label>
      `
    });

  renderizarIconos();

  configurarTamanoDialog(dialog, 'md');

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

        if (!motivo) {
          mostrarAdvertencia({
            titulo: 'Motivo obligatorio',
            mensaje: 'El motivo de rechazo es obligatorio y no puede consistir únicamente en espacios en blanco.'
          });
          return;
        }

        const longitudMotivo = calcularLongitudTexto(motivo);
        if (longitudMotivo > 500) {
          mostrarAdvertencia({
            titulo: 'Límite de caracteres excedido',
            mensaje: `El motivo de rechazo no puede superar los 500 caracteres (longitud ingresada: ${longitudMotivo}).`
          });
          return;
        }

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
            (a) => {
              const cod = a.codigo || (a.planAsignaturaId ? `ID #${a.planAsignaturaId}` : '');
              return a.nombre ? `${cod} — ${a.nombre}` : cod;
            }
          )
          .filter(Boolean)
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
          solicitud.motivoRechazo
            ? `
              <label class="sgpa-form-wide">
                <span>Motivo de rechazo</span>
                <textarea
                  class="estudiantes-error-textarea"
                  style="border-color:var(--danger, #ef4444);background:#fef2f2;color:#991b1b;"
                  rows="2"
                  readonly
                >${escapeHtml(solicitud.motivoRechazo)}</textarea>
              </label>
              ${
                solicitud.revisadoPor || solicitud.revisadoAt
                  ? `
                    <label class="sgpa-form-wide">
                      <span>Revisión</span>
                      <input
                        type="text"
                        value="${escapeHtml(
                          [
                            solicitud.revisadoPor?.nombreCompleto || solicitud.revisadoPor?.email || '',
                            solicitud.revisadoAt ? formatearFechaHora(solicitud.revisadoAt) : ''
                          ].filter(Boolean).join(' — ')
                        )}"
                        readonly
                      >
                    </label>
                  `
                  : ''
              }
            `
            : ''
        }

        ${
          solicitud.detalleError
            ? `
              <label class="sgpa-form-wide">
                <span>Detalle de error técnico</span>
                <textarea
                  class="estudiantes-error-textarea"
                  rows="2"
                  readonly
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

  configurarTamanoDialog(dialog, 'md');

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
