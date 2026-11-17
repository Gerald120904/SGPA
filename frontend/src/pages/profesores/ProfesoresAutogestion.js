import {
  obtenerMiPerfilProfesor,
  listarPerfilesDisponiblesProfesor,
  solicitarPerfilProfesor,
  listarPeriodosMiDisponibilidadProfesor,
} from '../../services/profesores.service.js';
import {
  StatCard,
} from '../../components/StatCard.js';
import {
  FormDialog,
  habilitarCierreExterior,
} from '../../components/FormDialog.js';
import {
  mostrarError,
  mostrarExito,
} from '../../components/AlertModal.js';
import {
  escapeHtml,
} from '../../utils/html.js';
import {
  renderizarIconos,
} from '../../utils/icons.js';
import {
  obtenerNombreCompleto,
  nombreEstadoProfesor,
  nombreTipoAtestado,
} from './profesores.helpers.js';
import {
  setPeriodosDisponibilidad,
  getPeriodosDisponibilidad,
  setVigenciaDisponibilidad,
  destruirMiDisponibilidad,
  configurarMiDisponibilidad as configurarMiDisponibilidadComponente,
} from './ProfesorDisponibilidadView.js';
import {
  abrirFormularioAtestado as abrirFormularioAtestadoComponente,
  inactivarMiAtestado as inactivarMiAtestadoComponente,
  abrirFormularioProyecto as abrirFormularioProyectoComponente,
  cambiarEstadoMiProyecto as cambiarEstadoMiProyectoComponente,
} from './ProfesorFormDialog.js';

export function crearAutogestionProfesores({
  crearNuevaInstancia,
  esInstanciaActual,
  renderizarSelectorModo,
  habilitarSelectorModo,
  abrirMiExpedientePerfil,
}) {
  let instanciaPerfilActual = 0;
  let miPerfilDocenteActual = null;
  let perfilesDisponiblesProfesor = [];
  let accionesPerfilActuales = { atestados: [], proyectos: [] };
  let vistaConEventosDelegados = null;
  let manejadorEventosDelegados = null;

async function iniciarMiPerfilDocente() {
  const instancia = crearNuevaInstancia();
  instanciaPerfilActual = instancia;
  setVigenciaDisponibilidad(() => esInstanciaActual(instancia));

  const vista =
    document.getElementById(
      'profesoresVista',
    );


  if (!vista) {
    return;
  }


  vista.innerHTML = `

    ${renderizarSelectorModo(
      'mi-perfil',
    )}

    <div
      class="profesores-message"
    >
      Cargando perfil docente...
    </div>
  `;


  habilitarSelectorModo();

  renderizarIconos();


  try {

    const [
      resultadoPerfil,
      resultadoPerfilesDisponibles,
      resultadoPeriodosDisponibilidad,
    ] = await Promise.all([
      obtenerMiPerfilProfesor(),
      listarPerfilesDisponiblesProfesor(),
      listarPeriodosMiDisponibilidadProfesor(),
    ]);

    if (!esInstanciaActual(instancia)) {
      return;
    }

    if (!resultadoPerfil?.ok) {
      throw new Error(
        resultadoPerfil?.message ||
          'No fue posible consultar su perfil docente.',
      );
    }

    if (!resultadoPerfilesDisponibles?.ok) {
      throw new Error(
        resultadoPerfilesDisponibles?.message ||
          'No fue posible consultar los perfiles académicos disponibles.',
      );
    }

    if (!resultadoPeriodosDisponibilidad?.ok) {
      throw new Error(
        resultadoPeriodosDisponibilidad?.message ||
          'No fue posible consultar los periodos de disponibilidad.',
      );
    }

    miPerfilDocenteActual = resultadoPerfil.data;

    perfilesDisponiblesProfesor = Array.isArray(
      resultadoPerfilesDisponibles.data,
    )
      ? resultadoPerfilesDisponibles.data
      : [];

    setPeriodosDisponibilidad(
      Array.isArray(resultadoPeriodosDisponibilidad.data)
        ? resultadoPeriodosDisponibilidad.data
        : [],
    );



    renderizarMiPerfilDocente();

  } catch (error) {

    if (!esInstanciaActual(instancia)) {
      return;
    }

    vista.innerHTML = `

      ${renderizarSelectorModo(
        'mi-perfil',
      )}

      <div
        class="
          profesores-message
          profesores-error
        "
      >
        ${escapeHtml(
          error?.message ||
            'No fue posible cargar su perfil docente.',
        )}
      </div>
    `;


    habilitarSelectorModo();

    renderizarIconos();

  }
}


function habilitarEventosDelegados(vista, atestados, proyectos) {
  accionesPerfilActuales = { atestados, proyectos };
  if (vistaConEventosDelegados === vista) return;

  vistaConEventosDelegados?.removeEventListener?.(
    'click',
    manejadorEventosDelegados,
  );
  vistaConEventosDelegados = vista;
  manejadorEventosDelegados = async (event) => {
    if (!esInstanciaActual(instanciaPerfilActual)) return;
    const { atestados } = accionesPerfilActuales;

    const boton = event.target.closest('[data-action]');
    if (!boton) return;

    const action = boton.dataset.action;

    if (action === 'editar-mi-atestado') {
      const id = Number(boton.dataset.atestadoId);
      const atestado = atestados.find((item) => item.id === id);
      if (atestado) abrirFormularioAtestado(atestado);
      return;
    }

    if (action === 'inactivar-mi-atestado') {
      await inactivarMiAtestado(Number(boton.dataset.atestadoId));
      return;
    }

    if (action === 'ver-mi-expediente-perfil') {
      await abrirMiExpedientePerfil(Number(boton.dataset.perfilId));
    }
  };

  vista.addEventListener('click', manejadorEventosDelegados);
}

function renderizarMiPerfilDocente() {
  const vista =
    document.getElementById(
      'profesoresVista',
    );


  if (
    !vista ||
    !miPerfilDocenteActual
  ) {
    return;
  }


  const profesor =
    miPerfilDocenteActual;


  const carreras =
    Array.isArray(
      profesor.carreras,
    )
      ? profesor.carreras
      : [];


  const perfiles =
    Array.isArray(
      profesor.perfilesAcademicos,
    )
      ? profesor.perfilesAcademicos
      : [];


  const cursos =
    Array.isArray(
      profesor.cursosHabilitados,
    )
      ? profesor.cursosHabilitados
      : [];


  const atestados =
    Array.isArray(
      profesor.atestados,
    )
      ? profesor.atestados
      : [];


  const proyectos =
    Array.isArray(
      profesor.proyectos,
    )
      ? profesor.proyectos
      : [];

  const periodosMiDisponibilidad = getPeriodosDisponibilidad();


  const perfilesAprobados =
    perfiles.filter(
      (perfil) =>
        perfil.estado ===
        'APROBADO',
    ).length;


  vista.innerHTML = `

    ${renderizarSelectorModo(
      'mi-perfil',
    )}


    <div
      class="profesores-self-header"
    >

      <div>

        <span
          class="profesores-self-eyebrow"
        >
          Mi perfil docente
        </span>

        <h2>
          ${escapeHtml(
            obtenerNombreCompleto(
              profesor,
            ),
          )}
        </h2>

        <p>
          ${escapeHtml(
            profesor.correo,
          )}
        </p>

      </div>


      <span
        class="
          profesores-status
          ${
            profesor.activo
              ? 'is-active'
              : 'is-inactive'
          }
        "
      >
        ${
          profesor.activo
            ? 'Activo'
            : 'Inactivo'
        }
      </span>

    </div>


    <div
      class="profesores-stat-grid"
    >

      ${StatCard({
        icon:
          'graduation-cap',

        title:
          'Carreras',

        value:
          carreras.length,

        description:
          'Carreras asociadas',
      })}


      ${StatCard({
        icon:
          'badge-check',

        title:
          'Perfiles aprobados',

        value:
          perfilesAprobados,

        description:
          'Perfiles habilitados',
      })}


      ${StatCard({
        icon:
          'book-open',

        title:
          'Cursos',

        value:
          cursos.length,

        description:
          'Cursos habilitados',
      })}


      ${StatCard({
        icon:
          'file-check',

        title:
          'Atestados',

        value:
          atestados.length,

        description:
          'Documentos registrados',
      })}

    </div>


    <section
      class="profesores-detail-card"
    >

      <div
        class="profesores-section-header"
      >

        <div>
          <h3>
            Carreras asociadas
          </h3>
          <p>
            Carreras en las que participa como docente.
          </p>
        </div>
      </div>



      ${
        carreras.length
          ? `
            <div
              class="profesores-badges"
            >

              ${carreras
                .map(
                  (carrera) => `
                    <span
                      class="profesores-badge"
                    >
                      ${escapeHtml(
                        carrera.codigo,
                      )}
                      —
                      ${escapeHtml(
                        carrera.nombre,
                      )}
                    </span>
                  `,
                )
                .join('')}

            </div>
          `
          : `
            <p
              class="profesores-muted"
            >
              No tiene carreras asociadas.
            </p>
          `
      }

    </section>


    <section
      class="profesores-detail-card"
    >

      <div
        class="profesores-section-header"
      >

        <div>

          <h3>
            Mis perfiles académicos
          </h3>

          <p>
            Perfiles solicitados y
            autorizados para impartir cursos.
          </p>

        </div>


        <button
          id="solicitarPerfilButton"
          type="button"
          class="
            profesores-action-button
            is-success
          "
        >

          <i
            data-lucide="plus"
            aria-hidden="true"
          ></i>

          Solicitar perfil

        </button>

      </div>


      ${renderizarMisPerfiles(
        perfiles,
      )}

    </section>


    <section
      class="profesores-detail-card"
    >

      <h3>
        Mis cursos habilitados
      </h3>


      ${
        cursos.length
          ? `
            <div
              class="profesores-course-list"
            >

              ${cursos
                .map(
                  (curso) => `
                    <div
                      class="profesores-course-item"
                    >

                      <strong>
                        ${escapeHtml(
                          curso.codigo,
                        )}
                      </strong>

                      <span>
                        ${escapeHtml(
                          curso.nombre,
                        )}
                      </span>

                    </div>
                  `,
                )
                .join('')}

            </div>
          `
          : `
            <p
              class="profesores-muted"
            >
              Aún no tiene cursos habilitados.
            </p>
          `
      }

    </section>


    <section
      class="profesores-detail-card"
    >

      <div
        class="profesores-section-header"
      >

        <div>

          <h3>
            Mis atestados
          </h3>

          <p>
            Títulos, certificaciones
            y otros respaldos académicos.
          </p>

        </div>


        <button
          id="nuevoAtestadoButton"
          type="button"
          class="
            profesores-action-button
            is-success
          "
        >

          <i
            data-lucide="plus"
            aria-hidden="true"
          ></i>

          Nuevo atestado

        </button>

      </div>


      ${renderizarMisAtestados(
        atestados,
      )}

    </section>


    <section
      class="profesores-detail-card"
    >

      <div
        class="profesores-section-header"
      >

        <div>

          <h3>
            Mis proyectos / laboratorios
          </h3>

          <p>
            Proyectos, laboratorios y
            actividades académicas asociadas
            a su perfil docente.
          </p>

        </div>


        <button
          id="nuevoProyectoProfesorButton"
          type="button"
          class="
            profesores-action-button
            is-success
          "
        >

          <i
            data-lucide="plus"
            aria-hidden="true"
          ></i>

          Nuevo proyecto

        </button>

      </div>


      ${renderizarMisProyectos(
        proyectos,
      )}

    </section>


    <section
      class="profesores-detail-card"
    >

      <div
        class="profesores-section-header"
      >

        <div>

          <h3>
            Mi disponibilidad docente
          </h3>

          <p>
            Registre los días y horas
            en que puede impartir cursos.
          </p>

        </div>


        <select
          id="miDisponibilidadPeriodo"
          class="profesores-period-select"
        >

          ${
            periodosMiDisponibilidad.length
              ? periodosMiDisponibilidad
                  .map(
                    (periodo) => `
                      <option
                        value="${periodo.id}"
                      >
                        ${escapeHtml(
                          periodo.codigo,
                        )}
                        —
                        ${escapeHtml(
                          periodo.nombre,
                        )}
                      </option>
                    `,
                  )
                  .join('')
              : `
                <option value="">
                  Sin periodos
                </option>
              `
          }

        </select>

      </div>


      <div
        id="miDisponibilidadContent"
        class="profesores-disponibilidad-content"
      >

        <div
          class="profesores-loading-inline"
        >
          Cargando disponibilidad...
        </div>

      </div>

    </section>

  `;


  habilitarSelectorModo();


document
    .getElementById(
      'solicitarPerfilButton',
    )
    ?.addEventListener(
      'click',
      abrirFormularioSolicitarPerfil,
    );


  document
    .getElementById(
      'nuevoAtestadoButton',
    )
    ?.addEventListener(
      'click',
      () => {
        abrirFormularioAtestado();
      },
    );


  document
    .getElementById(
      'nuevoProyectoProfesorButton',
    )
    ?.addEventListener(
      'click',
      () => {
        abrirFormularioProyecto();
      },
    );


  configurarMiDisponibilidad();


  habilitarEventosDelegados(vista, atestados, proyectos);

  vista
    .querySelectorAll(
      '[data-action="editar-mi-proyecto"]',
    )
    .forEach(
      (boton) => {

        boton.addEventListener(
          'click',
          () => {

            const proyectoId =
              Number(
                boton.dataset
                  .proyectoId,
              );


            const proyecto =
              proyectos.find(
                (item) =>
                  item.id ===
                  proyectoId,
              );


            if (proyecto) {
              abrirFormularioProyecto(
                proyecto,
              );
            }

          },
        );

      },
    );


  vista
    .querySelectorAll(
      '[data-action="estado-mi-proyecto"]',
    )
    .forEach(
      (boton) => {

        boton.addEventListener(
          'click',
          async () => {

            const proyectoId =
              Number(
                boton.dataset
                  .proyectoId,
              );


            const proyecto =
              proyectos.find(
                (item) =>
                  item.id ===
                  proyectoId,
              );


            if (!proyecto) {
              return;
            }


            const activo =
              boton.dataset.activo ===
              'true';


            await cambiarEstadoMiProyecto(
              proyecto,
              activo,
            );

          },
        );

      },
    );


  renderizarIconos();
}


function renderizarMisPerfiles(
  perfiles,
) {
  if (!perfiles.length) {
    return `
      <p
        class="profesores-muted"
      >
        No ha solicitado perfiles
        académicos todavía.
      </p>
    `;
  }


  return `
    <div
      class="profesores-review-list"
    >

      ${perfiles
        .map(
          (perfil) => `
            <article
              class="profesores-review-item"
            >

              <div
                class="profesores-review-main"
              >

                <div>

                  <strong>
                    ${escapeHtml(
                      perfil.codigo ||
                        '',
                    )}
                    —
                    ${escapeHtml(
                      perfil.nombre ||
                        '',
                    )}
                  </strong>


                  <span>
                    ${
                      perfil.carrera
                        ? `${escapeHtml(
                            perfil
                              .carrera
                              .codigo,
                          )} · ${escapeHtml(
                            perfil
                              .carrera
                              .nombre,
                          )}`
                        : 'Sin carrera'
                    }
                  </span>

                </div>


                <span
                  class="
                    profesores-review-status
                    profesores-review-${String(
                      perfil.estado,
                    ).toLowerCase()}
                  "
                >
                  ${escapeHtml(
                    nombreEstadoProfesor(
                      perfil.estado,
                    ),
                  )}
                </span>

              </div>


              ${
                perfil.observacionRevision
                  ? `
                    <div
                      class="profesores-review-note"
                    >

                      <strong>
                        Observación:
                      </strong>

                      ${escapeHtml(
                        perfil
                          .observacionRevision,
                      )}

                    </div>
                  `
                  : ''
              }


              <div class="profesores-review-actions">
                <button
                  type="button"
                  class="profesores-action-button"
                  data-action="ver-mi-expediente-perfil"
                  data-perfil-id="${perfil.perfilAcademicoId}"
                >
                  <i
                    data-lucide="clipboard-list"
                    aria-hidden="true"
                  ></i>

                  ${
                    perfil.estado === 'PENDIENTE'
                      ? 'Gestionar evidencias'
                      : 'Ver expediente'
                  }
                </button>
              </div>

            </article>
          `,
        )
        .join('')}

    </div>
  `;
}


function renderizarMisAtestados(
  atestados,
) {
  if (!atestados.length) {
    return `
      <p class="profesores-muted">
        No ha registrado atestados todavía.
      </p>
    `;
  }


  return `
    <div class="profesores-review-list">

      ${atestados
        .map(
          (atestado) => `
            <article
              class="profesores-review-item"
            >

              <div
                class="profesores-review-main"
              >

                <div>

                  <strong>
                    ${escapeHtml(
                      atestado.nombre,
                    )}
                  </strong>

                  <span>
                    ${escapeHtml(
                      nombreTipoAtestado(
                        atestado.tipo,
                      ),
                    )}
                    ·
                    ${escapeHtml(
                      atestado.institucion,
                    )}
                  </span>

                </div>


                <span
                  class="
                    profesores-review-status
                    profesores-review-${String(
                      atestado.estado,
                    ).toLowerCase()}
                  "
                >
                  ${escapeHtml(
                    nombreEstadoProfesor(
                      atestado.estado,
                    ),
                  )}
                </span>

              </div>


              ${
                atestado.tipo === 'EXPERIENCIA_DOCENTE' ||
                atestado.tipo === 'EXPERIENCIA_PROFESIONAL'
                  ? (atestado.fechaInicio || atestado.fechaFin
                      ? `
                        <div
                          class="profesores-review-meta"
                        >
                          Periodo:
                          ${escapeHtml(
                            atestado.fechaInicio || '—',
                          )}
                          —
                          ${escapeHtml(
                            atestado.fechaFin || 'Actualidad',
                          )}
                        </div>
                      `
                      : '')
                  : (atestado.fechaObtencion
                      ? `
                        <div
                          class="profesores-review-meta"
                        >
                          Fecha de obtención:
                          ${escapeHtml(
                            atestado.fechaObtencion,
                          )}
                        </div>
                      `
                      : '')
              }


              ${
                atestado.descripcion
                  ? `
                    <p
                      class="profesores-review-description"
                    >
                      ${escapeHtml(
                        atestado.descripcion,
                      )}
                    </p>
                  `
                  : ''
              }


              ${
                atestado.observacionRevision
                  ? `
                    <div
                      class="profesores-review-note"
                    >
                      <strong>
                        Observación de revisión:
                      </strong>

                      ${escapeHtml(
                        atestado.observacionRevision,
                      )}
                    </div>
                  `
                  : ''
              }


              ${
                atestado.estado !==
                'INACTIVO'
                  ? `
                    <div
                      class="profesores-review-actions"
                    >

                      <button
                        type="button"
                        class="profesores-action-button"
                        data-action="editar-mi-atestado"
                        data-atestado-id="${
                          atestado.id
                        }"
                      >
                        Editar
                      </button>


                      <button
                        type="button"
                        class="
                          profesores-action-button
                          is-danger
                        "
                        data-action="inactivar-mi-atestado"
                        data-atestado-id="${
                          atestado.id
                        }"
                      >
                        Inactivar
                      </button>

                    </div>
                  `
                  : ''
              }

            </article>
          `,
        )
        .join('')}

    </div>
  `;
}


function renderizarMisProyectos(
  proyectos,
) {
  if (!proyectos.length) {
    return `
      <p
        class="profesores-muted"
      >
        No ha registrado proyectos
        o laboratorios todavía.
      </p>
    `;
  }


  return `
    <div
      class="profesores-review-list"
    >

      ${proyectos
        .map(
          (proyecto) => `
            <article
              class="profesores-review-item"
            >

              <div
                class="profesores-review-main"
              >

                <div>

                  <strong>
                    ${escapeHtml(
                      proyecto.nombre,
                    )}
                  </strong>

                  <span>
                    ${
                      proyecto.unidad
                        ? escapeHtml(
                            proyecto.unidad,
                          )
                        : 'Sin unidad especificada'
                    }

                    ${
                      proyecto.rol
                        ? ` · ${escapeHtml(
                            proyecto.rol,
                          )}`
                        : ''
                    }
                  </span>

                </div>


                <span
                  class="
                    profesores-status
                    ${
                      proyecto.activo
                        ? 'is-active'
                        : 'is-inactive'
                    }
                  "
                >
                  ${
                    proyecto.activo
                      ? 'Activo'
                      : 'Inactivo'
                  }
                </span>

              </div>


              ${
                proyecto.fechaInicio ||
                proyecto.fechaFin
                  ? `
                    <div
                      class="profesores-review-meta"
                    >

                      ${
                        proyecto.fechaInicio
                          ? `Inicio: ${escapeHtml(
                              proyecto.fechaInicio,
                            )}`
                          : ''
                      }

                      ${
                        proyecto.fechaInicio &&
                        proyecto.fechaFin
                          ? ' · '
                          : ''
                      }

                      ${
                        proyecto.fechaFin
                          ? `Fin: ${escapeHtml(
                              proyecto.fechaFin,
                            )}`
                          : ''
                      }

                    </div>
                  `
                  : ''
              }


              ${
                proyecto.descripcion
                  ? `
                    <p
                      class="profesores-review-description"
                    >
                      ${escapeHtml(
                        proyecto.descripcion,
                      )}
                    </p>
                  `
                  : ''
              }


              <div
                class="profesores-review-actions"
              >

                <button
                  type="button"
                  class="profesores-action-button"
                  data-action="editar-mi-proyecto"
                  data-proyecto-id="${
                    proyecto.id
                  }"
                >
                  Editar
                </button>


                <button
                  type="button"
                  class="
                    profesores-action-button
                    ${
                      proyecto.activo
                        ? 'is-danger'
                        : 'is-success'
                    }
                  "
                  data-action="estado-mi-proyecto"
                  data-proyecto-id="${
                    proyecto.id
                  }"
                  data-activo="${
                    proyecto.activo
                      ? 'false'
                      : 'true'
                  }"
                >

                  ${
                    proyecto.activo
                      ? 'Inactivar'
                      : 'Reactivar'
                  }

                </button>

              </div>

            </article>
          `,
        )
        .join('')}

    </div>
  `;
}


function obtenerPerfilesSolicitables() {
  const actuales =
    new Map(
      (
        miPerfilDocenteActual
          ?.perfilesAcademicos ||
        []
      ).map(
        (perfil) => [
          perfil.perfilAcademicoId,
          perfil.estado,
        ],
      ),
    );


  return perfilesDisponiblesProfesor
    .filter(
      (perfil) => {

        const estado =
          actuales.get(
            perfil.id,
          );


        return ![
          'PENDIENTE',
          'APROBADO',
        ].includes(
          estado,
        );

      },
    );
}


function abrirFormularioSolicitarPerfil() {
  const instancia = instanciaPerfilActual;
  const dialog =
    document.getElementById(
      'profesorRevisionDialog',
    );

  const content =
    document.getElementById(
      'profesorRevisionDialogContent',
    );


  if (
    !dialog ||
    !content
  ) {
    return;
  }


  const disponibles =
    obtenerPerfilesSolicitables();


  if (!disponibles.length) {

    mostrarError({

      titulo:
        'Sin perfiles disponibles',

      mensaje:
        'No existen perfiles académicos disponibles para solicitar en este momento.',

    });

    return;
  }


  content.innerHTML =
    FormDialog({

      formId:
        'solicitarPerfilForm',

      title:
        'Solicitar perfil académico',

      description:
        'La solicitud quedará pendiente hasta ser revisada.',

      body: `
        <label
          class="sgpa-form-wide"
        >

          <span>
            Perfil académico
          </span>

          <select
            id="perfilAcademicoSolicitado"
            required
          >

            <option
              value=""
              selected
              disabled
            >
              Seleccione...
            </option>

            ${disponibles
              .map(
                (perfil) => `
                  <option
                    value="${perfil.id}"
                  >
                    ${escapeHtml(
                      perfil.codigo,
                    )}
                    —
                    ${escapeHtml(
                      perfil.nombre,
                    )}
                    ${
                      perfil.carrera
                        ? ` · ${escapeHtml(
                            perfil
                              .carrera
                              .codigo,
                          )}`
                        : ''
                    }
                  </option>
                `,
              )
              .join('')}

          </select>

        </label>
      `,

      errorId:
        'solicitarPerfilError',

      cancelButtonId:
        'cancelarSolicitudPerfil',

      submitButtonId:
        'guardarSolicitudPerfil',

      submitText:
        'Enviar solicitud',

    });


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );


  document
    .getElementById(
      'cancelarSolicitudPerfil',
    )
    ?.addEventListener(
      'click',
      () => dialog.close(),
    );


  document
    .getElementById(
      'solicitarPerfilForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();


        const perfilAcademicoId =
          Number(
            document
              .getElementById(
                'perfilAcademicoSolicitado',
              )
              ?.value,
          );


        if (!perfilAcademicoId) {
          return;
        }


        try {

          const resultado =
            await solicitarPerfilProfesor(
              perfilAcademicoId,
            );

          if (!esInstanciaActual(instancia)) return;


          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                'No fue posible enviar la solicitud.',
            );
          }


          dialog.close();


          mostrarExito({

            titulo:
              'Solicitud enviada',

            mensaje:
              'El perfil académico quedó pendiente de revisión.',

          });


          await iniciarMiPerfilDocente();

        } catch (error) {

          if (!esInstanciaActual(instancia)) return;

          mostrarError({

            titulo:
              'No se pudo solicitar el perfil',

            mensaje:
              error?.message ||
              'No fue posible enviar la solicitud.',

          });

        }

      },
    );


  renderizarIconos();
}


/* =========================================================
   AUTOGESTIÓN: FORMULARIO ATESTADO
   ========================================================= */

function abrirFormularioAtestado(
  atestado = null,
) {
  const instancia = instanciaPerfilActual;
  return abrirFormularioAtestadoComponente({
    atestado,
    vigente: () => esInstanciaActual(instancia),
    onGuardado: async () => {
      if (esInstanciaActual(instancia)) await iniciarMiPerfilDocente();
    },
  });
}

async function inactivarMiAtestado(
  atestadoId,
) {
  const instancia = instanciaPerfilActual;
  return inactivarMiAtestadoComponente({
    atestadoId,
    vigente: () => esInstanciaActual(instancia),
    onInactivado: async () => {
      if (esInstanciaActual(instancia)) await iniciarMiPerfilDocente();
    },
  });
}

function abrirFormularioProyecto(
  proyecto = null,
) {
  const instancia = instanciaPerfilActual;
  return abrirFormularioProyectoComponente({
    proyecto,
    vigente: () => esInstanciaActual(instancia),
    onGuardado: async () => {
      if (esInstanciaActual(instancia)) await iniciarMiPerfilDocente();
    },
  });
}

async function cambiarEstadoMiProyecto(
  proyecto,
  activo,
) {
  const instancia = instanciaPerfilActual;
  return cambiarEstadoMiProyectoComponente({
    proyecto,
    activo,
    vigente: () => esInstanciaActual(instancia),
    onActualizado: async () => {
      if (esInstanciaActual(instancia)) await iniciarMiPerfilDocente();
    },
  });
}


/* =========================================================
   AUTOGESTIÓN: MI DISPONIBILIDAD DOCENTE
   ========================================================= */

function configurarMiDisponibilidad() {
  return configurarMiDisponibilidadComponente();
}

/* =========================================================
   INICIALIZADOR PRINCIPAL CON DETECCIÓN DE ROLES
   ========================================================= */

  return {
    iniciarMiPerfilDocente,
    destruir() {
      instanciaPerfilActual = 0;
      miPerfilDocenteActual = null;
      perfilesDisponiblesProfesor = [];
      accionesPerfilActuales = { atestados: [], proyectos: [] };
      vistaConEventosDelegados?.removeEventListener?.(
        'click',
        manejadorEventosDelegados,
      );
      vistaConEventosDelegados = null;
      manejadorEventosDelegados = null;
      destruirMiDisponibilidad();
    },
  };
}
