import { dependencias } from './estudiantes.dependencies.js';

export function crearEstudiantesCatalogo({ estado, acciones }) {
function esCuentaJerarquica() {
  const rol = dependencias.obtenerRolActivo();
  return rol === dependencias.ROLES.COORDINADOR || rol === dependencias.ROLES.ASISTENTE_ESTUDIANTIL;
}

function esAsistenteActivo() {
  return dependencias.obtenerRolActivo() === dependencias.ROLES.ASISTENTE_ESTUDIANTIL;
}

async function listarCarrerasParaEstudiantes() {
  if (!acciones.esCuentaJerarquica()) return dependencias.listarCarreras();
  const resultado = await dependencias.obtenerCatalogoEstudiantesJerarquia();
  return resultado.ok ? { ok: true, carreras: resultado.data.carreras } : resultado;
}

async function listarPlanesParaEstudiantes() {
  if (!acciones.esCuentaJerarquica()) return dependencias.listarPlanesEstudio();
  const resultado = await dependencias.obtenerCatalogoEstudiantesJerarquia();
  return resultado.ok ? { ok: true, planes: resultado.data.planes } : resultado;
}

async function listarPeriodosParaEstudiantes() {
  if (!acciones.esCuentaJerarquica()) return dependencias.listarPeriodosAcademicos();
  const resultado = await dependencias.obtenerCatalogoEstudiantesJerarquia();
  return resultado.ok ? { ok: true, periodos: resultado.data.periodos } : resultado;
}

function renderizarEstudiantes() {
  const contenedor =
    document.getElementById(
      'estudiantesContent'
    );

  if (!contenedor) {
    return;
  }

  const esAsistente = acciones.esAsistenteActivo();
  const puedeEditar = dependencias.usuarioTienePermiso(dependencias.PERMISOS.GESTIONAR);
  const puedeGestionar = !esAsistente && puedeEditar;

  const rows =
    estado.estudiantes
      .map(
        (estudiante) => `
          <tr
            data-estudiante-id="${estudiante.id}"
          >
            <td>
              <strong>
                ${dependencias.escapeHtml(
                  estudiante.cedula
                )}
              </strong>
            </td>

            <td>
              ${dependencias.escapeHtml(
                dependencias.obtenerNombreCompleto(
                  estudiante
                )
              )}
            </td>

            <td>
              ${dependencias.escapeHtml(
                estudiante.correoInstitucional
              )}
            </td>

            <td>
              ${dependencias.escapeHtml(
                estudiante.carrera?.codigo ||
                estudiante.carrera?.nombre ||
                '—'
              )}
            </td>

            <td>
              ${dependencias.escapeHtml(
                estudiante.planEstudio?.codigo ||
                estudiante.planEstudio?.nombre ||
                '—'
              )}
            </td>

            <td>
              ${dependencias.escapeHtml(
                estudiante.periodoIngreso?.codigo ||
                estudiante.periodoIngreso?.nombre ||
                '—'
              )}
            </td>

            <td>
              ${dependencias.StatusBadge({
                label: dependencias.formatearEstado(
                  estudiante.estado
                ),
                tone:
                  dependencias.obtenerTonoEstadoEstudiante(
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
    dependencias.DataTable({
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

  dependencias.renderizarIconos();
}

function renderizarRuta() {
  if (!estado.carreraSeleccionada) {
    return 'Estudiantes';
  }

  if (!estado.planSeleccionado) {
    return `
      Estudiantes
      › ${dependencias.escapeHtml(estado.carreraSeleccionada.nombre)}
    `;
  }

  return `
    Estudiantes
    › ${dependencias.escapeHtml(estado.carreraSeleccionada.nombre)}
    › ${dependencias.escapeHtml(estado.planSeleccionado.nombre || estado.planSeleccionado.codigo)}
  `;
}

function detenerPollingSolicitudes() {
  if (!estado.intervaloSolicitudes) {
    return;
  }

  window.clearInterval(
    estado.intervaloSolicitudes
  );

  estado.intervaloSolicitudes = null;
}

function actualizarEncabezadoYRuta() {
  const breadcrumb =
    document.getElementById(
      'estudiantesBreadcrumb'
    );

  if (breadcrumb) {
    breadcrumb.innerHTML =
      acciones.renderizarRuta();
  }
}

async function mostrarCarreras() {
  const instancia = estado.instanciaActual;
  const version = ++estado.versionCarreras;
  acciones.detenerPollingSolicitudes();
  estado.vistaActual = 'CARRERAS';
  estado.carreraSeleccionada = null;
  estado.planSeleccionado = null;
  estado.estudiantes = [];

  const contenedor =
    document.getElementById(
      'estudiantesNavegacion'
    );

  if (!contenedor) {
    return;
  }

  acciones.actualizarEncabezadoYRuta();

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
      acciones.listarCarrerasParaEstudiantes(),
      acciones.listarPlanesParaEstudiantes(),
      dependencias.contarEstudiantesPorCarrera()
    ]);

    if (
      instancia !== estado.instanciaActual ||
      version !== estado.versionCarreras ||
      estado.vistaActual !== 'CARRERAS'
    ) return;

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

    estado.carrerasDisponibles = lista;

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
      dependencias.renderizarIconos();
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

              return dependencias.SelectionCard({
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

    dependencias.renderizarIconos();
  } catch (error) {
    if (
      instancia !== estado.instanciaActual ||
      version !== estado.versionCarreras ||
      estado.vistaActual !== 'CARRERAS'
    ) return;

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
        <p>${dependencias.escapeHtml(error?.message || 'Error de conexión.')}</p>
      </div>
    `;
    dependencias.renderizarIconos();
  }
}

async function mostrarPlanesCarrera(carrera) {
  const instancia = estado.instanciaActual;
  const version = ++estado.versionPlanes;
  acciones.detenerPollingSolicitudes();
  estado.vistaActual = 'PLANES';
  estado.carreraSeleccionada = carrera;
  estado.planSeleccionado = null;
  estado.estudiantes = [];

  const contenedor =
    document.getElementById(
      'estudiantesNavegacion'
    );

  if (!contenedor) {
    return;
  }

  acciones.actualizarEncabezadoYRuta();

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
        <p>Planes de estudio de <strong>${dependencias.escapeHtml(carrera.nombre)}</strong></p>
      </div>
    </div>
    <div class="sgpa-state-message">Cargando planes de estudio...</div>
  `;
  dependencias.renderizarIconos();

  try {
    const [
      resultadoPlanes,
      resultadoEstudiantes,
      resultadoSolicitudes
    ] = await Promise.all([
      acciones.listarPlanesParaEstudiantes(),
      dependencias.contarEstudiantesPorPlan(carrera.id),
      dependencias.contarSolicitudesPorPlan(carrera.id)
    ]);

    if (
      instancia !== estado.instanciaActual ||
      version !== estado.versionPlanes ||
      estado.vistaActual !== 'PLANES' ||
      estado.carreraSeleccionada?.id !== carrera.id
    ) return;

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

    estado.planesDisponibles = planesDeCarrera;

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
            <p>Planes de estudio de <strong>${dependencias.escapeHtml(carrera.nombre)}</strong></p>
          </div>
        </div>
        <div class="sgpa-state-message">
          Esta carrera no tiene planes de estudio registrados.
        </div>
      `;
      dependencias.renderizarIconos();
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
          <p>Planes de estudio de <strong>${dependencias.escapeHtml(carrera.nombre)}</strong></p>
        </div>
      </div>

      <div class="modules-dashboard-grid">
        ${planesDeCarrera
          .map(
            (plan) => {
              const numEst = estudiantesPorPlan.get(Number(plan.id)) ?? 0;
              const numSol = solicitudesPorPlan.get(Number(plan.id)) ?? 0;

              return dependencias.SelectionCard({
                dataAttribute: 'data-plan-id',
                dataValue: plan.id,
                icon: 'book-open',
                title: plan.nombre || plan.codigo,
                details: [
                  `${numEst} ${numEst === 1 ? 'estudiante' : 'estudiantes'}`,
                  `${numSol} ${numSol === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}`
                ],
                status: dependencias.StatusBadge({
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

    dependencias.renderizarIconos();
  } catch (error) {
    if (
      instancia !== estado.instanciaActual ||
      version !== estado.versionPlanes ||
      estado.vistaActual !== 'PLANES' ||
      estado.carreraSeleccionada?.id !== carrera.id
    ) return;

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
        <p>${dependencias.escapeHtml(error?.message || 'Error de conexión.')}</p>
      </div>
    `;
    dependencias.renderizarIconos();
  }
}

async function mostrarEstudiantesPlan() {
  const instancia = estado.instanciaActual;
  const version = ++estado.versionPlanes;
  const carreraId = estado.carreraSeleccionada?.id;
  const planId = estado.planSeleccionado?.id;
  estado.vistaActual = 'ESTUDIANTES';

  const contenedor =
    document.getElementById(
      'estudiantesNavegacion'
    );

  if (!contenedor) {
    return;
  }

  acciones.actualizarEncabezadoYRuta();

  const puedeGestionar =
    dependencias.usuarioTienePermiso(
      dependencias.PERMISOS.GESTIONAR
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
          <strong>${dependencias.escapeHtml(estado.carreraSeleccionada.nombre)}</strong> › <strong>${dependencias.escapeHtml(estado.planSeleccionado.nombre || estado.planSeleccionado.codigo)}</strong>
        </p>
      </div>

      ${
        puedeGestionar
          ? `
            <div class="sgpa-toolbar-actions">
              ${acciones.esAsistenteActivo() ? '' : `<button
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

                ${acciones.esAsistenteActivo()
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

        ${dependencias.ESTADOS.map(
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

  dependencias.renderizarIconos();

  acciones.vincularEventosVistaEstudiantes();

  acciones.configurarBandejaRevision();

  await acciones.cargarEstudiantes(
    estado.instanciaActual,
    true
  );

  if (
    instancia !== estado.instanciaActual ||
    version !== estado.versionPlanes ||
    estado.carreraSeleccionada?.id !== carreraId ||
    estado.planSeleccionado?.id !== planId
  ) return;

  await acciones.cargarBandejaRevision(carreraId, planId);

  if (
    instancia !== estado.instanciaActual ||
    version !== estado.versionPlanes ||
    estado.carreraSeleccionada?.id !== carreraId ||
    estado.planSeleccionado?.id !== planId
  ) return;

  await acciones.cargarSolicitudesFormularios(
    estado.instanciaActual,
    false
  );

  if (
    instancia !== estado.instanciaActual ||
    version !== estado.versionPlanes ||
    estado.carreraSeleccionada?.id !== carreraId ||
    estado.planSeleccionado?.id !== planId
  ) return;

  acciones.detenerPollingSolicitudes();

  estado.intervaloSolicitudes =
    window.setInterval(
      () => {
        const pagina =
          document.getElementById(
            'estudiantesPage'
          );

        if (
          !pagina ||
          estado.vistaActual !== 'ESTUDIANTES' ||
          instancia !== estado.instanciaActual ||
          version !== estado.versionPlanes ||
          estado.carreraSeleccionada?.id !== carreraId ||
          estado.planSeleccionado?.id !== planId ||
          !estado.carreraSeleccionada ||
          !estado.planSeleccionado
        ) {
          acciones.detenerPollingSolicitudes();
          return;
        }

        acciones.cargarSolicitudesFormularios(
          estado.instanciaActual,
          false
        );
      },
      15_000
    );
}

function vincularEventosVistaEstudiantes() {
  const instancia = estado.instanciaActual;

  const buscar =
    document.getElementById(
      'estudiantesBuscar'
    );

  const periodo =
    document.getElementById(
      'estudiantesPeriodo'
    );

  const estadoSelect =
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
      if (estado.timerBusqueda) {
        window.clearTimeout(
          estado.timerBusqueda
        );
      }

      estado.timerBusqueda =
        window.setTimeout(
          () => {
            acciones.cargarEstudiantes(
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
      acciones.cargarEstudiantes(
        instancia
      );
    }
  );

  estadoSelect?.addEventListener(
    'change',
    () => {
      acciones.cargarEstudiantes(
        instancia
      );
    }
  );

  nuevoBtn?.addEventListener(
    'click',
    acciones.abrirNuevoEstudiante
  );

  importarBtn?.addEventListener(
    'click',
    acciones.abrirImportacionEstudiantes
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
    estado.carreraSeleccionada?.id ||
    Number(
      document.getElementById(
        'estudiantesCarrera'
      )?.value
    ) ||
    undefined;

  const planEstudioId =
    estado.planSeleccionado?.id ||
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

  const estadoFiltro =
    document.getElementById(
      'estudiantesEstado'
    )?.value || undefined;

  return {
    texto:
      texto || undefined,

    carreraId,
    planEstudioId,
    periodoIngresoId,
    estado: estadoFiltro
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
    of estado.catalogoEstudiantes
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
            ${dependencias.escapeHtml(
              periodo.codigo || periodo.nombre
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
  const version = ++estado.versionEstudiantes;
  const carreraId = estado.carreraSeleccionada?.id;
  const planId = estado.planSeleccionado?.id;
  try {
    const filtros =
      acciones.obtenerFiltros();

    if (estado.carreraSeleccionada) {
      filtros.carreraId =
        estado.carreraSeleccionada.id;
    }

    if (estado.planSeleccionado) {
      filtros.planEstudioId =
        estado.planSeleccionado.id;
    }

    const resultado =
      await dependencias.listarEstudiantes(
        filtros
      );

    if (
      instancia !==
      estado.instanciaActual ||
      version !== estado.versionEstudiantes ||
      carreraId !== estado.carreraSeleccionada?.id ||
      planId !== estado.planSeleccionado?.id
    ) {
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
        'No fue posible consultar los estudiantes.'
      );
    }

    estado.estudiantes =
      Array.isArray(
        resultado.estudiantes
      )
        ? resultado.estudiantes
        : [];

    if (actualizarCatalogo) {
      estado.catalogoEstudiantes = [
        ...estado.estudiantes
      ];

      acciones.llenarFiltrosAcademicos();
    }

    acciones.renderizarEstudiantes();
  } catch (error) {
    if (
      instancia !== estado.instanciaActual ||
      version !== estado.versionEstudiantes ||
      carreraId !== estado.carreraSeleccionada?.id ||
      planId !== estado.planSeleccionado?.id
    ) return;

    console.error(
      'Error cargando estudiantes:',
      error
    );

    dependencias.mostrarError({
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
      await acciones.abrirDetalleEstudiante(id);
      break;

    case 'expediente':
      await acciones.abrirExpedienteEstudiante(id);
      break;

    case 'editar':
      await acciones.abrirEditarEstudiante(id);
      break;

    case 'estado':
      await acciones.abrirCambiarEstadoEstudiante(id);
      break;

    case 'plan':
      await acciones.abrirCambiarPlanEstudiante(id);
      break;
  }
}

function renderizarPreviewImportacionEstudiantes(
  preview,
  contexto
) {
  return dependencias.renderizarPreviewImportacionEstudiantesComponente(
    preview,
    contexto,
    {
      esAsistente: acciones.esAsistenteActivo(),
      onImportado: async (ctx) => {
        const tabBandeja = document.getElementById('tabNavBandejaRevision');
        if (tabBandeja) {
          tabBandeja.click();
        } else {
          await acciones.cargarBandejaRevision(ctx.carreraId, ctx.planEstudioId);
        }
      },
    }
  );
}

async function abrirImportacionEstudiantes() {
  return dependencias.abrirImportacionEstudiantesComponente({
    carrera: estado.carreraSeleccionada,
    plan: estado.planSeleccionado,
    esAsistente: acciones.esAsistenteActivo(),
    configurarTamanoDialog,
    onImportado: async (ctx) => {
      const tabBandeja = document.getElementById('tabNavBandejaRevision');
      if (tabBandeja) {
        tabBandeja.click();
      } else {
        await acciones.cargarBandejaRevision(ctx.carreraId, ctx.planEstudioId);
      }
    },
  });
}

 return {
 esCuentaJerarquica,
 esAsistenteActivo,
 listarCarrerasParaEstudiantes,
 listarPlanesParaEstudiantes,
 listarPeriodosParaEstudiantes,
 renderizarEstudiantes,
 renderizarRuta,
 detenerPollingSolicitudes,
 actualizarEncabezadoYRuta,
 mostrarCarreras,
 mostrarPlanesCarrera,
 mostrarEstudiantesPlan,
 vincularEventosVistaEstudiantes,
 obtenerFiltros,
 llenarFiltrosAcademicos,
 cargarEstudiantes,
 manejarAccionEstudiante,
 renderizarPreviewImportacionEstudiantes,
 abrirImportacionEstudiantes
 };
}
