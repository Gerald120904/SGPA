import {
  listarProfesores,
  obtenerProfesor,
  obtenerDisponibilidadProfesor,
  revisarPerfilProfesor,
  inactivarPerfilProfesor,
  revisarAtestadoProfesor,

  obtenerMiPerfilProfesor,
  listarCarrerasDisponiblesProfesor,
  actualizarMisCarrerasProfesor,
  listarPerfilesDisponiblesProfesor,
  solicitarPerfilProfesor,

  listarMisAtestadosProfesor,
  crearAtestadoProfesor,
  actualizarAtestadoProfesor,
  inactivarMiAtestadoProfesor,

  crearProyectoProfesor,
  actualizarProyectoProfesor,
  cambiarEstadoProyectoProfesor,

  listarPeriodosMiDisponibilidadProfesor,
  consultarMiDisponibilidadProfesor,
  guardarMiDisponibilidadProfesor,
  copiarMiDisponibilidadProfesor,
  obtenerHistorialMiDisponibilidadProfesor,
} from '../../services/profesores.service.js';

import {
  listarPeriodosAcademicos,
} from '../../services/periodos.service.js';

import {
  DataTable,
} from '../../components/DataTable.js';

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
  confirmarAccion,
} from '../../utils/confirm.js';

import {
  escapeHtml,
} from '../../utils/html.js';

import {
  renderizarIconos,
} from '../../utils/icons.js';

import {
  obtenerRolesUsuario,
} from '../../app/session.js';

import {
  ROLES,
} from '../../config/permissions.js';


let profesores = [];
let instanciaActual = 0;
let profesorDetalleActual = null;
let periodosAcademicos = [];

let miPerfilDocenteActual = null;
let carrerasDisponiblesProfesor = [];
let perfilesDisponiblesProfesor = [];
let periodosMiDisponibilidad = [];
let miDisponibilidadActual = null;


/* =========================================================
   PÁGINA
   ========================================================= */

export function ProfesoresPage() {
  return `
    <section
      id="profesoresPage"
      class="module-view profesores-page"
    >

      <div
        id="profesoresVista"
      >

        <div class="profesores-toolbar">

          <div>
            <h2>
              Profesores
            </h2>

            <p>
              Gestión docente, perfiles académicos
              y disponibilidad.
            </p>
          </div>

        </div>


        <label
          class="profesores-search"
          for="profesoresBuscar"
        >

          <i
            data-lucide="search"
            aria-hidden="true"
          ></i>

          <input
            id="profesoresBuscar"
            type="search"
            placeholder="Buscar por nombre, cédula, correo o carrera..."
            autocomplete="off"
          >

        </label>


        <div
          id="profesoresContent"
          class="profesores-content"
          aria-live="polite"
        >

          <div class="profesores-message">
            Cargando profesores...
          </div>

        </div>

      </div>


      <dialog
        id="profesorRevisionDialog"
        class="
          sgpa-form-dialog
          sgpa-form-dialog-sm
        "
      >
        <div
          id="profesorRevisionDialogContent"
        ></div>
      </dialog>

    </section>
  `;
}


/* =========================================================
   SELECTOR DE MODO (MULTIRROL)
   ========================================================= */

function renderizarSelectorModo(
  modoActual,
) {
  const roles =
    obtenerRolesUsuario();

  const tieneGestion =
    roles.includes(
      ROLES.ADMIN_GLOBAL,
    ) ||
    roles.includes(
      ROLES.COORDINADOR,
    );

  const esProfesor =
    roles.includes(
      ROLES.PROFESOR,
    );


  if (
    !tieneGestion ||
    !esProfesor
  ) {
    return '';
  }


  return `
    <div
      class="profesores-mode-switch"
    >

      <button
        type="button"
        class="
          profesores-mode-button
          ${
            modoActual === 'gestion'
              ? 'is-active'
              : ''
          }
        "
        data-profesores-mode="gestion"
      >
        <i
          data-lucide="users"
          aria-hidden="true"
        ></i>

        Gestión de profesores
      </button>


      <button
        type="button"
        class="
          profesores-mode-button
          ${
            modoActual === 'mi-perfil'
              ? 'is-active'
              : ''
          }
        "
        data-profesores-mode="mi-perfil"
      >
        <i
          data-lucide="user-round"
          aria-hidden="true"
        ></i>

        Mi perfil docente
      </button>

    </div>
  `;
}


function habilitarSelectorModo() {
  document
    .querySelectorAll(
      '[data-profesores-mode]',
    )
    .forEach(
      (boton) => {

        boton.addEventListener(
          'click',
          () => {

            const modo =
              boton.dataset
                .profesoresMode;


            if (
              modo ===
              'gestion'
            ) {
              iniciarGestionProfesores();

              return;
            }


            if (
              modo ===
              'mi-perfil'
            ) {
              iniciarMiPerfilDocente();
            }

          },
        );

      },
    );
}


/* =========================================================
   UTILIDADES
   ========================================================= */

function obtenerNombreCompleto(
  profesor,
) {
  return [
    profesor?.nombres,
    profesor?.apellido1,
    profesor?.apellido2,
  ]
    .filter(Boolean)
    .join(' ');
}


function obtenerCarreras(
  profesor,
) {
  return Array.isArray(
    profesor?.carreras,
  )
    ? profesor.carreras
    : [];
}


function obtenerPerfiles(
  profesor,
) {
  return Array.isArray(
    profesor?.perfilesAcademicos,
  )
    ? profesor.perfilesAcademicos
    : [];
}


function obtenerCursos(
  profesor,
) {
  return Array.isArray(
    profesor?.cursosHabilitados,
  )
    ? profesor.cursosHabilitados
    : [];
}


const NOMBRES_DIA = {
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SABADO: 'Sábado',
  DOMINGO: 'Domingo',
};


const ORDEN_DIA = {
  LUNES: 1,
  MARTES: 2,
  MIERCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
  SABADO: 6,
  DOMINGO: 7,
};


const NOMBRES_ESTADO_PROFESOR = {
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  INACTIVO: 'Inactivo',
};


const NOMBRES_TIPO_ATESTADO = {
  TITULO_ACADEMICO:
    'Título académico',

  CERTIFICACION:
    'Certificación',

  OTRO:
    'Otro',
};


function nombreEstadoProfesor(
  estado,
) {
  return (
    NOMBRES_ESTADO_PROFESOR[
      estado
    ] ||
    estado ||
    '—'
  );
}


function nombreTipoAtestado(
  tipo,
) {
  return (
    NOMBRES_TIPO_ATESTADO[
      tipo
    ] ||
    tipo ||
    '—'
  );
}


function nombreEstadoDisponibilidad(
  estado,
) {
  const estados = {
    PENDIENTE:
      'Pendiente',

    REGISTRADA:
      'Registrada',

    BLOQUEADA:
      'Bloqueada',
  };

  return estados[estado] || estado || 'Pendiente';
}


function seleccionarPeriodoInicial(
  periodos,
) {
  if (!periodos.length) {
    return null;
  }

  return (
    periodos.find(
      (periodo) =>
        periodo.estado ===
        'EN_PREPARACION',
    ) ||
    periodos.find(
      (periodo) =>
        periodo.estado ===
        'EN_CURSO',
    ) ||
    periodos.find(
      (periodo) =>
        periodo.estado ===
        'BORRADOR',
    ) ||
    periodos[0]
  );
}


/* =========================================================
   TABLA (GESTIÓN)
   ========================================================= */

function renderizarProfesores() {
  const contenido =
    document.getElementById(
      'profesoresContent',
    );

  if (!contenido) {
    return;
  }


  const termino =
    document
      .getElementById(
        'profesoresBuscar',
      )
      ?.value
      ?.trim()
      .toLowerCase() || '';


  const filtrados =
    profesores.filter(
      (profesor) => {

        const carreras =
          obtenerCarreras(
            profesor,
          );

        const texto = [
          profesor.cedula,
          obtenerNombreCompleto(
            profesor,
          ),
          profesor.correo,
          ...carreras.map(
            (carrera) =>
              `${carrera.codigo} ${carrera.nombre}`,
          ),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();


        return texto.includes(
          termino,
        );

      },
    );


  const filas =
    filtrados
      .map(
        (profesor) => {

          const carreras =
            obtenerCarreras(
              profesor,
            );

          const perfiles =
            obtenerPerfiles(
              profesor,
            );

          const cursos =
            obtenerCursos(
              profesor,
            );


          const perfilesAprobados =
            perfiles.filter(
              (perfil) =>
                perfil.estado ===
                'APROBADO',
            ).length;


          return `
            <tr>

              <td>
                ${escapeHtml(
                  profesor.cedula,
                )}
              </td>


              <td>

                <div
                  class="profesores-person"
                >

                  <strong>
                    ${escapeHtml(
                      obtenerNombreCompleto(
                        profesor,
                      ),
                    )}
                  </strong>

                  <small>
                    ${escapeHtml(
                      profesor.correo,
                    )}
                  </small>

                </div>

              </td>


              <td>

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
                                title="${escapeHtml(
                                  carrera.nombre,
                                )}"
                              >
                                ${escapeHtml(
                                  carrera.codigo,
                                )}
                              </span>
                            `,
                          )
                          .join('')}
                      </div>
                    `
                    : `
                      <span
                        class="profesores-muted"
                      >
                        Sin carreras
                      </span>
                    `
                }

              </td>


              <td>
                ${perfilesAprobados}
              </td>


              <td>
                ${cursos.length}
              </td>


              <td>

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

              </td>


              <td>

                <button
                  class="profesores-icon-button"
                  type="button"
                  data-action="ver"
                  data-profesor-id="${profesor.id}"
                  title="Ver profesor"
                  aria-label="Ver profesor"
                >

                  <i
                    data-lucide="eye"
                    aria-hidden="true"
                  ></i>

                </button>

              </td>

            </tr>
          `;

        },
      )
      .join('');


  contenido.innerHTML =
    DataTable({

      columns: [
        'Cédula',
        'Profesor',
        'Carreras',
        'Perfiles',
        'Cursos',
        'Estado',
        'Acciones',
      ],

      rows:
        filas,

      emptyMessage:
        termino
          ? 'No hay profesores que coincidan con la búsqueda.'
          : 'No hay profesores registrados.',

      ariaLabel:
        'Listado de profesores',

    });


  renderizarIconos();
}


/* =========================================================
   DISPONIBILIDAD DOCENTE (CONSULTA GESTIÓN)
   ========================================================= */

async function cargarDisponibilidadProfesor(
  profesorId,
  periodoId,
) {
  const contenido =
    document.getElementById(
      'profesorDisponibilidadContent',
    );


  if (!contenido) {
    return;
  }


  contenido.innerHTML = `
    <div
      class="profesores-loading-inline"
    >
      Consultando disponibilidad...
    </div>
  `;


  try {

    const resultado =
      await obtenerDisponibilidadProfesor(
        profesorId,
        periodoId,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar la disponibilidad.',
      );
    }


    const disponibilidad =
      resultado.data;


    const bloques =
      Array.isArray(
        disponibilidad.bloques,
      )
        ? [...disponibilidad.bloques]
        : [];


    bloques.sort(
      (a, b) => {

        const diferenciaDia =
          (ORDEN_DIA[a.dia] || 99) -
          (ORDEN_DIA[b.dia] || 99);


        if (diferenciaDia !== 0) {
          return diferenciaDia;
        }


        return String(
          a.horaInicio,
        ).localeCompare(
          String(
            b.horaInicio,
          ),
        );

      },
    );


    contenido.innerHTML = `

      <div
        class="profesores-disponibilidad-summary"
      >

        <div>

          <span>
            Estado
          </span>

          <strong
            class="
              profesores-disponibilidad-status
              profesores-disponibilidad-${String(
                disponibilidad.estado,
              ).toLowerCase()}
            "
          >
            ${escapeHtml(
              nombreEstadoDisponibilidad(
                disponibilidad.estado,
              ),
            )}
          </strong>

        </div>


        <div>

          <span>
            Periodo
          </span>

          <strong>
            ${
              disponibilidad.periodo
                ? escapeHtml(
                    disponibilidad
                      .periodo
                      .codigo,
                  )
                : '—'
            }
          </strong>

        </div>


        <div>

          <span>
            Bloques registrados
          </span>

          <strong>
            ${bloques.length}
          </strong>

        </div>

      </div>


      ${
        !disponibilidad.registrada
          ? `
            <div
              class="profesores-disponibilidad-empty"
            >

              <i
                data-lucide="calendar-x"
                aria-hidden="true"
              ></i>

              <div>

                <strong>
                  Disponibilidad pendiente
                </strong>

                <p>
                  El profesor todavía no ha
                  registrado disponibilidad
                  para este periodo académico.
                </p>

              </div>

            </div>
          `
          : bloques.length
            ? `
              <div
                class="profesores-schedule-list"
              >

                ${bloques
                  .map(
                    (bloque) => `
                      <div
                        class="profesores-schedule-row"
                      >

                        <div
                          class="profesores-schedule-day"
                        >
                          ${escapeHtml(
                            NOMBRES_DIA[
                              bloque.dia
                            ] ||
                              bloque.dia,
                          )}
                        </div>


                        <div
                          class="profesores-schedule-hours"
                        >

                          <i
                            data-lucide="clock"
                            aria-hidden="true"
                          ></i>

                          ${escapeHtml(
                            bloque.horaInicio,
                          )}
                          —
                          ${escapeHtml(
                            bloque.horaFin,
                          )}

                        </div>

                      </div>
                    `,
                  )
                  .join('')}

              </div>
            `
            : `
              <div
                class="profesores-disponibilidad-empty"
              >

                No existen bloques
                registrados para este periodo.

              </div>
            `
      }


      ${
        disponibilidad.observaciones
          ? `
            <div
              class="profesores-disponibilidad-observaciones"
            >

              <span>
                Observaciones
              </span>

              <p>
                ${escapeHtml(
                  disponibilidad
                    .observaciones,
                )}
              </p>

            </div>
          `
          : ''
      }

    `;


    renderizarIconos();

  } catch (error) {

    contenido.innerHTML = `
      <div
        class="
          profesores-loading-inline
          profesores-error
        "
      >
        ${escapeHtml(
          error?.message ||
            'No fue posible consultar la disponibilidad.',
        )}
      </div>
    `;

  }
}


/* =========================================================
   REVISIÓN (MODAL REUTILIZABLE - GESTIÓN)
   ========================================================= */

function abrirRevisionProfesor({
  tipo,
  id,
  estado,
}) {
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
    !content ||
    !profesorDetalleActual
  ) {
    return;
  }


  const aprobando =
    estado === 'APROBADO';


  const esPerfil =
    tipo === 'perfil';


  content.innerHTML =
    FormDialog({

      formId:
        'profesorRevisionForm',

      title:
        aprobando
          ? `Aprobar ${
              esPerfil
                ? 'perfil académico'
                : 'atestado'
            }`
          : `Rechazar ${
              esPerfil
                ? 'perfil académico'
                : 'atestado'
            }`,

      description:
        'Puede agregar una observación a la revisión.',

      body: `
        <label
          class="sgpa-form-wide"
        >

          <span>
            Observación
          </span>

          <textarea
            id="profesorRevisionObservacion"
            rows="4"
            maxlength="500"
            placeholder="Observación opcional"
          ></textarea>

        </label>
      `,

      errorId:
        'profesorRevisionError',

      cancelButtonId:
        'cancelarProfesorRevision',

      submitButtonId:
        'guardarProfesorRevision',

      submitText:
        aprobando
          ? 'Aprobar'
          : 'Rechazar',

    });


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );


  document
    .getElementById(
      'cancelarProfesorRevision',
    )
    ?.addEventListener(
      'click',
      () => {
        dialog.close();
      },
    );


  document
    .getElementById(
      'profesorRevisionForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();


        const observacion =
          document
            .getElementById(
              'profesorRevisionObservacion',
            )
            ?.value
            ?.trim() || '';


        const boton =
          document.getElementById(
            'guardarProfesorRevision',
          );


        if (boton) {
          boton.disabled = true;
        }


        try {

          const resultado =
            esPerfil
              ? await revisarPerfilProfesor(
                  profesorDetalleActual.id,
                  id,
                  {
                    estado,
                    observacion,
                  },
                )
              : await revisarAtestadoProfesor(
                  profesorDetalleActual.id,
                  id,
                  {
                    estado,
                    observacion,
                  },
                );


          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                'No fue posible realizar la revisión.',
            );
          }


          dialog.close();


          mostrarExito({

            titulo:
              aprobando
                ? 'Revisión aprobada'
                : 'Revisión rechazada',

            mensaje:
              esPerfil
                ? 'El perfil académico fue actualizado correctamente.'
                : 'El atestado fue actualizado correctamente.',

          });


          await abrirProfesor(
            profesorDetalleActual.id,
          );

        } catch (error) {

          mostrarError({

            titulo:
              'No se pudo completar la revisión',

            mensaje:
              error?.message ||
              'No fue posible actualizar la información.',

          });

        } finally {

          if (boton) {
            boton.disabled =
              false;
          }

        }

      },
    );
}


/* =========================================================
   INACTIVAR PERFIL (GESTIÓN)
   ========================================================= */

async function confirmarInactivacionPerfil(
  perfilId,
) {
  if (!profesorDetalleActual) {
    return;
  }


  const confirmado =
    await confirmarAccion({

      titulo:
        'Inactivar perfil académico',

      mensaje:
        'El perfil dejará de habilitar cursos para este profesor.',

      textoConfirmar:
        'Inactivar',

      peligro:
        true,

    });


  if (!confirmado) {
    return;
  }


  try {

    const resultado =
      await inactivarPerfilProfesor(
        profesorDetalleActual.id,
        perfilId,
        '',
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible inactivar el perfil.',
      );
    }


    mostrarExito({

      titulo:
        'Perfil inactivado',

      mensaje:
        'El perfil académico fue inactivado correctamente.',

    });


    await abrirProfesor(
      profesorDetalleActual.id,
    );

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo inactivar el perfil',

      mensaje:
        error?.message ||
        'No fue posible actualizar el perfil académico.',

    });

  }
}


/* =========================================================
   DETALLE (GESTIÓN)
   ========================================================= */

async function abrirProfesor(
  profesorId,
) {
  const vista =
    document.getElementById(
      'profesoresVista',
    );

  if (!vista) {
    return;
  }


  vista.innerHTML = `
    <div class="profesores-message">
      Cargando perfil docente...
    </div>
  `;


  try {

    const [
      resultado,
      resultadoPeriodos,
    ] = await Promise.all([
      obtenerProfesor(
        profesorId,
      ),

      listarPeriodosAcademicos(),
    ]);


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar el profesor.',
      );
    }

    if (!resultadoPeriodos?.ok) {
      throw new Error(
        resultadoPeriodos?.message ||
          'No fue posible consultar los periodos académicos.',
      );
    }


    periodosAcademicos =
      Array.isArray(
        resultadoPeriodos.periodos,
      )
        ? resultadoPeriodos.periodos
        : [];


    const profesor =
      resultado.data;


    profesorDetalleActual =
      profesor;


    const carreras =
      obtenerCarreras(
        profesor,
      );

    const perfiles =
      obtenerPerfiles(
        profesor,
      );

    const cursos =
      obtenerCursos(
        profesor,
      );

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


    const perfilesAprobados =
      perfiles.filter(
        (perfil) =>
          perfil.estado ===
          'APROBADO',
      ).length;


    vista.innerHTML = `

      <div
        class="profesores-detail-header"
      >

        <button
          id="volverProfesoresButton"
          class="profesores-back-button"
          type="button"
        >
          <i
            data-lucide="arrow-left"
            aria-hidden="true"
          ></i>

          Volver
        </button>


        <div>

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
            'Perfiles académicos habilitados',
        })}


        ${StatCard({
          icon:
            'book-open',

          title:
            'Cursos habilitados',

          value:
            cursos.length,

          description:
            'Cursos que puede impartir',
        })}


        ${StatCard({
          icon:
            'file-check',

          title:
            'Atestados',

          value:
            atestados.length,

          description:
            'Atestados registrados',
        })}

      </div>


      <section
        class="profesores-detail-card"
      >

        <h3>
          Información general
        </h3>


        <div
          class="profesores-info-grid"
        >

          <div>
            <span>
              Cédula
            </span>

            <strong>
              ${escapeHtml(
                profesor.cedula,
              )}
            </strong>
          </div>


          <div>
            <span>
              Estado
            </span>

            <strong>
              ${
                profesor.activo
                  ? 'Activo'
                  : 'Inactivo'
              }
            </strong>
          </div>


          <div>
            <span>
              Roles
            </span>

            <strong>
              ${escapeHtml(
                (
                  profesor.roles || []
                ).join(', '),
              )}
            </strong>
          </div>


          <div>
            <span>
              Proyectos / laboratorios
            </span>

            <strong>
              ${proyectos.length}
            </strong>
          </div>

        </div>

      </section>


      <section
        class="profesores-detail-card"
      >

        <h3>
          Carreras
        </h3>


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
                El profesor no tiene
                carreras asociadas.
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
              Perfiles académicos
            </h3>

            <p>
              Perfiles docentes solicitados
              y habilitados.
            </p>

          </div>

        </div>


        ${
          perfiles.length
            ? `
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


                        <div
                          class="profesores-review-actions"
                        >

                          ${
                            perfil.estado ===
                            'PENDIENTE'
                              ? `
                                <button
                                  type="button"
                                  class="
                                    profesores-action-button
                                    is-success
                                  "
                                  data-action="aprobar-perfil"
                                  data-perfil-id="${
                                    perfil
                                      .perfilAcademicoId
                                  }"
                                >
                                  Aprobar
                                </button>

                                <button
                                  type="button"
                                  class="
                                    profesores-action-button
                                    is-danger
                                  "
                                  data-action="rechazar-perfil"
                                  data-perfil-id="${
                                    perfil
                                      .perfilAcademicoId
                                  }"
                                >
                                  Rechazar
                                </button>
                              `
                              : ''
                          }


                          ${
                            perfil.estado !==
                            'INACTIVO'
                              ? `
                                <button
                                  type="button"
                                  class="
                                    profesores-action-button
                                  "
                                  data-action="inactivar-perfil"
                                  data-perfil-id="${
                                    perfil
                                      .perfilAcademicoId
                                  }"
                                >
                                  Inactivar
                                </button>
                              `
                              : ''
                          }

                        </div>

                      </article>
                    `,
                  )
                  .join('')}

              </div>
            `
            : `
              <p
                class="profesores-muted"
              >
                El profesor no tiene
                perfiles académicos registrados.
              </p>
            `
        }

      </section>


      <section
        class="profesores-detail-card"
      >

        <h3>
          Cursos habilitados
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
                No existen cursos habilitados.
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
              Atestados
            </h3>

            <p>
              Títulos, certificaciones
              y otros documentos académicos.
            </p>

          </div>

        </div>


        ${
          atestados.length
            ? `
              <div
                class="profesores-review-list"
              >

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
                          atestado.fechaObtencion
                            ? `
                              <div
                                class="profesores-review-meta"
                              >
                                Obtenido:
                                ${escapeHtml(
                                  atestado
                                    .fechaObtencion,
                                )}
                              </div>
                            `
                            : ''
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
                                  Observación:
                                </strong>

                                ${escapeHtml(
                                  atestado
                                    .observacionRevision,
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

                                ${
                                  atestado.estado !==
                                  'APROBADO'
                                    ? `
                                      <button
                                        type="button"
                                        class="
                                          profesores-action-button
                                          is-success
                                        "
                                        data-action="aprobar-atestado"
                                        data-atestado-id="${
                                          atestado.id
                                        }"
                                      >
                                        Aprobar
                                      </button>
                                    `
                                    : ''
                                }


                                ${
                                  atestado.estado !==
                                  'RECHAZADO'
                                    ? `
                                      <button
                                        type="button"
                                        class="
                                          profesores-action-button
                                          is-danger
                                        "
                                        data-action="rechazar-atestado"
                                        data-atestado-id="${
                                          atestado.id
                                        }"
                                      >
                                        Rechazar
                                      </button>
                                    `
                                    : ''
                                }

                              </div>
                            `
                            : ''
                        }

                      </article>
                    `,
                  )
                  .join('')}

              </div>
            `
            : `
              <p
                class="profesores-muted"
              >
                El profesor no tiene
                atestados registrados.
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
              Disponibilidad docente
            </h3>

            <p>
              Consulte la disponibilidad
              registrada para cada periodo
              académico.
            </p>

          </div>


          <select
            id="profesorPeriodoDisponibilidad"
            class="profesores-period-select"
          >

            ${
              periodosAcademicos.length
                ? periodosAcademicos
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
                    No existen periodos
                  </option>
                `
            }

          </select>

        </div>


        <div
          id="profesorDisponibilidadContent"
          class="profesores-disponibilidad-content"
        >

          <div
            class="profesores-loading-inline"
          >
            Seleccione un periodo.
          </div>

        </div>

      </section>

    `;


    document
      .getElementById(
        'volverProfesoresButton',
      )
      ?.addEventListener(
        'click',
        () => {
          iniciarGestionProfesores();
        },
      );


    vista.addEventListener(
      'click',
      async (event) => {

        const boton =
          event.target.closest(
            '[data-action]',
          );


        if (!boton) {
          return;
        }


        const action =
          boton.dataset.action;


        if (
          action ===
          'aprobar-perfil' ||
          action ===
          'rechazar-perfil'
        ) {
          abrirRevisionProfesor({

            tipo:
              'perfil',

            id:
              Number(
                boton.dataset
                  .perfilId,
              ),

            estado:
              action ===
              'aprobar-perfil'
                ? 'APROBADO'
                : 'RECHAZADO',

          });

          return;
        }


        if (
          action ===
          'inactivar-perfil'
        ) {
          await confirmarInactivacionPerfil(
            Number(
              boton.dataset
                .perfilId,
            ),
          );

          return;
        }


        if (
          action ===
          'aprobar-atestado' ||
          action ===
          'rechazar-atestado'
        ) {
          abrirRevisionProfesor({

            tipo:
              'atestado',

            id:
              Number(
                boton.dataset
                  .atestadoId,
              ),

            estado:
              action ===
              'aprobar-atestado'
                ? 'APROBADO'
                : 'RECHAZADO',

          });
        }

      },
    );


    const selectorPeriodo =
      document.getElementById(
        'profesorPeriodoDisponibilidad',
      );


    const periodoInicial =
      seleccionarPeriodoInicial(
        periodosAcademicos,
      );


    if (
      selectorPeriodo &&
      periodoInicial
    ) {
      selectorPeriodo.value =
        String(
          periodoInicial.id,
        );


      selectorPeriodo.addEventListener(
        'change',
        async () => {

          const periodoId =
            Number(
              selectorPeriodo.value,
            );


          if (!periodoId) {
            return;
          }


          await cargarDisponibilidadProfesor(
            profesor.id,
            periodoId,
          );

        },
      );


      await cargarDisponibilidadProfesor(
        profesor.id,
        periodoInicial.id,
      );
    }


    renderizarIconos();

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo cargar el profesor',

      mensaje:
        error?.message ||
        'No fue posible consultar el perfil docente.',

    });


    iniciarGestionProfesores();

  }
}


/* =========================================================
   CARGAR (GESTIÓN)
   ========================================================= */

async function cargarProfesores(
  instancia,
) {
  const contenido =
    document.getElementById(
      'profesoresContent',
    );


  if (!contenido) {
    return;
  }


  try {

    const resultado =
      await listarProfesores();


    if (
      instancia !==
      instanciaActual
    ) {
      return;
    }


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar los profesores.',
      );
    }


    profesores =
      Array.isArray(
        resultado.profesores,
      )
        ? resultado.profesores
        : [];


    renderizarProfesores();

  } catch (error) {

    contenido.innerHTML = `
      <div
        class="
          profesores-message
          profesores-error
        "
      >
        ${escapeHtml(
          error?.message ||
            'No fue posible cargar los profesores.',
        )}
      </div>
    `;

  }
}


/* =========================================================
   GESTIÓN ADMINISTRATIVA
   ========================================================= */

function iniciarGestionProfesores() {
  const pagina =
    document.getElementById(
      'profesoresPage',
    );


  if (!pagina) {
    return;
  }


  instanciaActual += 1;

  const instancia =
    instanciaActual;


  const vista =
    document.getElementById(
      'profesoresVista',
    );


  if (!vista) {
    return;
  }


  vista.innerHTML = `

    ${renderizarSelectorModo(
      'gestion',
    )}

    <div
      class="profesores-toolbar"
    >

      <div>

        <h2>
          Profesores
        </h2>

        <p>
          Gestión docente, perfiles académicos
          y disponibilidad.
        </p>

      </div>

    </div>


    <label
      class="profesores-search"
      for="profesoresBuscar"
    >

      <i
        data-lucide="search"
        aria-hidden="true"
      ></i>

      <input
        id="profesoresBuscar"
        type="search"
        placeholder="Buscar por nombre, cédula, correo o carrera..."
        autocomplete="off"
      >

    </label>


    <div
      id="profesoresContent"
      class="profesores-content"
      aria-live="polite"
    >

      <div
        class="profesores-message"
      >
        Cargando profesores...
      </div>

    </div>

  `;


  habilitarSelectorModo();


  document
    .getElementById(
      'profesoresBuscar',
    )
    ?.addEventListener(
      'input',
      renderizarProfesores,
    );


  document
    .getElementById(
      'profesoresContent',
    )
    ?.addEventListener(
      'click',
      async (event) => {

        const boton =
          event.target.closest(
            '[data-action="ver"]',
          );


        if (!boton) {
          return;
        }


        const profesorId =
          Number(
            boton.dataset
              .profesorId,
          );


        if (!profesorId) {
          return;
        }


        await abrirProfesor(
          profesorId,
        );

      },
    );


  renderizarIconos();


  cargarProfesores(
    instancia,
  );
}


/* =========================================================
   AUTOGESTIÓN: MI PERFIL DOCENTE
   ========================================================= */

async function iniciarMiPerfilDocente() {
  instanciaActual += 1;

  const instancia =
    instanciaActual;

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
      resultadoCarreras,
      resultadoPerfilesDisponibles,
      resultadoPeriodosDisponibilidad,
    ] = await Promise.all([

      obtenerMiPerfilProfesor(),

      listarCarrerasDisponiblesProfesor(),

      listarPerfilesDisponiblesProfesor(),

      listarPeriodosMiDisponibilidadProfesor(),

    ]);


    if (
      instancia !==
      instanciaActual
    ) {
      return;
    }


    if (!resultadoPerfil?.ok) {
      throw new Error(
        resultadoPerfil?.message ||
          'No fue posible consultar su perfil docente.',
      );
    }


    if (!resultadoCarreras?.ok) {
      throw new Error(
        resultadoCarreras?.message ||
          'No fue posible consultar las carreras disponibles.',
      );
    }


    if (
      !resultadoPerfilesDisponibles
        ?.ok
    ) {
      throw new Error(
        resultadoPerfilesDisponibles
          ?.message ||
          'No fue posible consultar los perfiles académicos disponibles.',
      );
    }


    if (
      !resultadoPeriodosDisponibilidad
        ?.ok
    ) {
      throw new Error(
        resultadoPeriodosDisponibilidad
          ?.message ||
          'No fue posible consultar los periodos de disponibilidad.',
      );
    }


    miPerfilDocenteActual =
      resultadoPerfil.data;


    carrerasDisponiblesProfesor =
      Array.isArray(
        resultadoCarreras.data,
      )
        ? resultadoCarreras.data
        : [];


    perfilesDisponiblesProfesor =
      Array.isArray(
        resultadoPerfilesDisponibles
          .data,
      )
        ? resultadoPerfilesDisponibles
            .data
        : [];


    periodosMiDisponibilidad =
      Array.isArray(
        resultadoPeriodosDisponibilidad
          .data,
      )
        ? resultadoPeriodosDisponibilidad
            .data
        : [];


    renderizarMiPerfilDocente();

  } catch (error) {

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
            Mis carreras
          </h3>

          <p>
            Carreras en las que
            participa como docente.
          </p>

        </div>


        <button
          id="editarMisCarrerasButton"
          type="button"
          class="profesores-action-button"
        >

          <i
            data-lucide="pencil"
            aria-hidden="true"
          ></i>

          Editar carreras

        </button>

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
      'editarMisCarrerasButton',
    )
    ?.addEventListener(
      'click',
      abrirFormularioMisCarreras,
    );


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


  vista.addEventListener(
    'click',
    async (event) => {

      const boton =
        event.target.closest(
          '[data-action]',
        );


      if (!boton) {
        return;
      }


      const action =
        boton.dataset.action;


      if (
        action ===
        'editar-mi-atestado'
      ) {
        const id =
          Number(
            boton.dataset
              .atestadoId,
          );


        const atestado =
          atestados.find(
            (item) =>
              item.id === id,
          );


        if (atestado) {
          abrirFormularioAtestado(
            atestado,
          );
        }

        return;
      }


      if (
        action ===
        'inactivar-mi-atestado'
      ) {
        await inactivarMiAtestado(
          Number(
            boton.dataset
              .atestadoId,
          ),
        );
      }

    },
  );


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
                atestado.fechaObtencion
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
                  : ''
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


function abrirFormularioMisCarreras() {
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
    !content ||
    !miPerfilDocenteActual
  ) {
    return;
  }


  const actuales =
    new Set(
      (
        miPerfilDocenteActual
          .carreras || []
      ).map(
        (carrera) =>
          carrera.id,
      ),
    );


  content.innerHTML =
    FormDialog({

      formId:
        'misCarrerasForm',

      title:
        'Mis carreras',

      description:
        'Seleccione las carreras con las que mantiene relación docente.',

      body: `
        <div
          class="
            sgpa-form-wide
            profesores-checkbox-list
          "
        >

          ${carrerasDisponiblesProfesor
            .map(
              (carrera) => `
                <label
                  class="profesores-checkbox-item"
                >

                  <input
                    type="checkbox"
                    name="carreraProfesor"
                    value="${carrera.id}"
                    ${
                      actuales.has(
                        carrera.id,
                      )
                        ? 'checked'
                        : ''
                    }
                  >

                  <span>

                    <strong>
                      ${escapeHtml(
                        carrera.codigo,
                      )}
                    </strong>

                    ${escapeHtml(
                      carrera.nombre,
                    )}

                  </span>

                </label>
              `,
            )
            .join('')}

        </div>
      `,

      errorId:
        'misCarrerasError',

      cancelButtonId:
        'cancelarMisCarreras',

      submitButtonId:
        'guardarMisCarreras',

      submitText:
        'Guardar carreras',

    });


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );


  document
    .getElementById(
      'cancelarMisCarreras',
    )
    ?.addEventListener(
      'click',
      () => dialog.close(),
    );


  document
    .getElementById(
      'misCarrerasForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();


        const carreraIds =
          [
            ...document
              .querySelectorAll(
                'input[name="carreraProfesor"]:checked',
              ),
          ].map(
            (input) =>
              Number(
                input.value,
              ),
          );


        try {

          const resultado =
            await actualizarMisCarrerasProfesor(
              carreraIds,
            );


          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                'No fue posible actualizar sus carreras.',
            );
          }


          dialog.close();


          mostrarExito({

            titulo:
              'Carreras actualizadas',

            mensaje:
              'Sus carreras fueron actualizadas correctamente.',

          });


          await iniciarMiPerfilDocente();

        } catch (error) {

          mostrarError({

            titulo:
              'No se pudieron actualizar las carreras',

            mensaje:
              error?.message ||
              'No fue posible guardar los cambios.',

          });

        }

      },
    );


  renderizarIconos();
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


  const editando =
    Boolean(atestado);


  content.innerHTML =
    FormDialog({

      formId:
        'miAtestadoForm',

      title:
        editando
          ? 'Editar atestado'
          : 'Nuevo atestado',

      description:
        editando
          ? 'Actualice la información del atestado.'
          : 'Registre un respaldo académico para su perfil docente.',

      body: `

        <label>

          <span>
            Tipo
          </span>

          <select
            id="atestadoTipo"
            required
          >

            <option
              value=""
              ${
                !editando
                  ? 'selected'
                  : ''
              }
              disabled
            >
              Seleccione...
            </option>

            <option
              value="TITULO_ACADEMICO"
              ${
                atestado?.tipo ===
                'TITULO_ACADEMICO'
                  ? 'selected'
                  : ''
              }
            >
              Título académico
            </option>

            <option
              value="CERTIFICACION"
              ${
                atestado?.tipo ===
                'CERTIFICACION'
                  ? 'selected'
                  : ''
              }
            >
              Certificación
            </option>

            <option
              value="OTRO"
              ${
                atestado?.tipo ===
                'OTRO'
                  ? 'selected'
                  : ''
              }
            >
              Otro
            </option>

          </select>

        </label>


        <label>

          <span>
            Nombre
          </span>

          <input
            id="atestadoNombre"
            type="text"
            minlength="2"
            maxlength="180"
            value="${escapeHtml(
              atestado?.nombre || '',
            )}"
            required
          >

        </label>


        <label>

          <span>
            Institución
          </span>

          <input
            id="atestadoInstitucion"
            type="text"
            minlength="2"
            maxlength="180"
            value="${escapeHtml(
              atestado?.institucion ||
                '',
            )}"
            required
          >

        </label>


        <label>

          <span>
            Fecha de obtención
          </span>

          <input
            id="atestadoFechaObtencion"
            type="date"
            value="${
              atestado?.fechaObtencion ||
              ''
            }"
          >

        </label>


        <label
          class="sgpa-form-wide"
        >

          <span>
            Descripción
          </span>

          <textarea
            id="atestadoDescripcion"
            maxlength="500"
            rows="4"
            placeholder="Descripción opcional"
          >${escapeHtml(
            atestado?.descripcion ||
              '',
          )}</textarea>

        </label>

      `,

      errorId:
        'miAtestadoFormError',

      cancelButtonId:
        'cancelarMiAtestado',

      submitButtonId:
        'guardarMiAtestado',

      submitText:
        editando
          ? 'Guardar cambios'
          : 'Registrar atestado',

    });


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );


  document
    .getElementById(
      'cancelarMiAtestado',
    )
    ?.addEventListener(
      'click',
      () => dialog.close(),
    );


  document
    .getElementById(
      'miAtestadoForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();


        const datos = {

          tipo:
            document
              .getElementById(
                'atestadoTipo',
              )
              ?.value,

          nombre:
            document
              .getElementById(
                'atestadoNombre',
              )
              ?.value
              ?.trim(),

          institucion:
            document
              .getElementById(
                'atestadoInstitucion',
              )
              ?.value
              ?.trim(),

          fechaObtencion:
            document
              .getElementById(
                'atestadoFechaObtencion',
              )
              ?.value ||
            undefined,

          descripcion:
            document
              .getElementById(
                'atestadoDescripcion',
              )
              ?.value
              ?.trim() ||
            undefined,

        };


        const boton =
          document.getElementById(
            'guardarMiAtestado',
          );


        if (boton) {
          boton.disabled = true;
        }


        try {

          const resultado =
            editando
              ? await actualizarAtestadoProfesor(
                  atestado.id,
                  datos,
                )
              : await crearAtestadoProfesor(
                  datos,
                );


          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                'No fue posible guardar el atestado.',
            );
          }


          dialog.close();


          mostrarExito({

            titulo:
              editando
                ? 'Atestado actualizado'
                : 'Atestado registrado',

            mensaje:
              editando
                ? 'El atestado fue actualizado correctamente.'
                : 'El atestado quedó pendiente de revisión.',

          });


          await iniciarMiPerfilDocente();

        } catch (error) {

          mostrarError({

            titulo:
              'No se pudo guardar el atestado',

            mensaje:
              error?.message ||
              'No fue posible guardar la información.',

          });

        } finally {

          if (boton) {
            boton.disabled =
              false;
          }

        }

      },
    );


  renderizarIconos();
}


/* =========================================================
   AUTOGESTIÓN: INACTIVAR ATESTADO
   ========================================================= */

async function inactivarMiAtestado(
  atestadoId,
) {
  const confirmado =
    await confirmarAccion({

      titulo:
        'Inactivar atestado',

      mensaje:
        'El atestado dejará de formar parte activa de su perfil docente.',

      textoConfirmar:
        'Inactivar',

      peligro:
        true,

    });


  if (!confirmado) {
    return;
  }


  try {

    const resultado =
      await inactivarMiAtestadoProfesor(
        atestadoId,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible inactivar el atestado.',
      );
    }


    mostrarExito({

      titulo:
        'Atestado inactivado',

      mensaje:
        'El atestado fue inactivado correctamente.',

    });


    await iniciarMiPerfilDocente();

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo inactivar el atestado',

      mensaje:
        error?.message ||
        'No fue posible actualizar el atestado.',

    });

  }
}


/* =========================================================
   AUTOGESTIÓN: PROYECTOS / LABORATORIOS
   ========================================================= */

function abrirFormularioProyecto(
  proyecto = null,
) {
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


  const editando =
    Boolean(proyecto);


  content.innerHTML =
    FormDialog({

      formId:
        'miProyectoForm',

      title:
        editando
          ? 'Editar proyecto / laboratorio'
          : 'Nuevo proyecto / laboratorio',

      description:
        editando
          ? 'Actualice la información registrada.'
          : 'Registre un proyecto, laboratorio o actividad académica.',

      body: `

        <label
          class="sgpa-form-wide"
        >

          <span>
            Nombre
          </span>

          <input
            id="proyectoNombre"
            type="text"
            minlength="2"
            maxlength="180"
            value="${escapeHtml(
              proyecto?.nombre ||
                '',
            )}"
            required
          >

        </label>


        <label>

          <span>
            Unidad / laboratorio
          </span>

          <input
            id="proyectoUnidad"
            type="text"
            maxlength="180"
            value="${escapeHtml(
              proyecto?.unidad ||
                '',
            )}"
            placeholder="Ej. CENTIC"
          >

        </label>


        <label>

          <span>
            Rol
          </span>

          <input
            id="proyectoRol"
            type="text"
            maxlength="120"
            value="${escapeHtml(
              proyecto?.rol ||
                '',
            )}"
            placeholder="Ej. Investigador"
          >

        </label>


        <label>

          <span>
            Fecha de inicio
          </span>

          <input
            id="proyectoFechaInicio"
            type="date"
            value="${
              proyecto?.fechaInicio ||
              ''
            }"
          >

        </label>


        <label>

          <span>
            Fecha de finalización
          </span>

          <input
            id="proyectoFechaFin"
            type="date"
            value="${
              proyecto?.fechaFin ||
              ''
            }"
          >

        </label>


        <label
          class="sgpa-form-wide"
        >

          <span>
            Descripción
          </span>

          <textarea
            id="proyectoDescripcion"
            rows="4"
            maxlength="500"
            placeholder="Descripción opcional"
          >${escapeHtml(
            proyecto?.descripcion ||
              '',
          )}</textarea>

        </label>

      `,

      errorId:
        'miProyectoFormError',

      cancelButtonId:
        'cancelarMiProyecto',

      submitButtonId:
        'guardarMiProyecto',

      submitText:
        editando
          ? 'Guardar cambios'
          : 'Registrar proyecto',

    });


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );


  document
    .getElementById(
      'cancelarMiProyecto',
    )
    ?.addEventListener(
      'click',
      () => dialog.close(),
    );


  document
    .getElementById(
      'miProyectoForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();


        const errorBox =
          document.getElementById(
            'miProyectoFormError',
          );


        errorBox?.classList.add(
          'hidden',
        );


        const fechaInicio =
          document
            .getElementById(
              'proyectoFechaInicio',
            )
            ?.value || '';


        const fechaFin =
          document
            .getElementById(
              'proyectoFechaFin',
            )
            ?.value || '';


        if (
          fechaInicio &&
          fechaFin &&
          fechaFin < fechaInicio
        ) {
          if (errorBox) {
            errorBox.textContent =
              'La fecha de finalización no puede ser anterior a la fecha de inicio.';

            errorBox.classList.remove(
              'hidden',
            );
          }

          return;
        }


        const datos = {

          nombre:
            document
              .getElementById(
                'proyectoNombre',
              )
              ?.value
              ?.trim(),

          unidad:
            document
              .getElementById(
                'proyectoUnidad',
              )
              ?.value
              ?.trim() || '',

          rol:
            document
              .getElementById(
                'proyectoRol',
              )
              ?.value
              ?.trim() || '',

          fechaInicio:
            fechaInicio ||
            undefined,

          fechaFin:
            fechaFin ||
            undefined,

          descripcion:
            document
              .getElementById(
                'proyectoDescripcion',
              )
              ?.value
              ?.trim() || '',

        };


        const boton =
          document.getElementById(
            'guardarMiProyecto',
          );


        if (boton) {
          boton.disabled =
            true;
        }


        try {

          const resultado =
            editando
              ? await actualizarProyectoProfesor(
                  proyecto.id,
                  datos,
                )
              : await crearProyectoProfesor(
                  datos,
                );


          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                'No fue posible guardar el proyecto.',
            );
          }


          dialog.close();


          mostrarExito({

            titulo:
              editando
                ? 'Proyecto actualizado'
                : 'Proyecto registrado',

            mensaje:
              editando
                ? 'El proyecto fue actualizado correctamente.'
                : 'El proyecto fue registrado correctamente.',

          });


          await iniciarMiPerfilDocente();

        } catch (error) {

          mostrarError({

            titulo:
              'No se pudo guardar el proyecto',

            mensaje:
              error?.message ||
              'No fue posible guardar la información.',

          });

        } finally {

          if (boton) {
            boton.disabled =
              false;
          }

        }

      },
    );


  renderizarIconos();
}


async function cambiarEstadoMiProyecto(
  proyecto,
  activo,
) {
  const confirmado =
    await confirmarAccion({

      titulo:
        activo
          ? 'Reactivar proyecto'
          : 'Inactivar proyecto',

      mensaje:
        activo
          ? `¿Desea reactivar "${proyecto.nombre}"?`
          : `¿Desea inactivar "${proyecto.nombre}"?`,

      textoConfirmar:
        activo
          ? 'Reactivar'
          : 'Inactivar',

      peligro:
        !activo,

    });


  if (!confirmado) {
    return;
  }


  try {

    const resultado =
      await cambiarEstadoProyectoProfesor(
        proyecto.id,
        activo,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible cambiar el estado.',
      );
    }


    mostrarExito({

      titulo:
        activo
          ? 'Proyecto reactivado'
          : 'Proyecto inactivado',

      mensaje:
        `El proyecto fue ${
          activo
            ? 'reactivado'
            : 'inactivado'
        } correctamente.`,

    });


    await iniciarMiPerfilDocente();

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo cambiar el estado',

      mensaje:
        error?.message ||
        'No fue posible actualizar el proyecto.',

    });

  }
}


/* =========================================================
   AUTOGESTIÓN: MI DISPONIBILIDAD DOCENTE
   ========================================================= */

function configurarMiDisponibilidad() {
  const selector =
    document.getElementById(
      'miDisponibilidadPeriodo',
    );


  if (
    !selector ||
    !periodosMiDisponibilidad.length
  ) {
    return;
  }


  const inicial =
    seleccionarPeriodoInicial(
      periodosMiDisponibilidad,
    );


  if (!inicial) {
    return;
  }


  selector.value =
    String(inicial.id);


  selector.addEventListener(
    'change',
    async () => {

      const periodoId =
        Number(
          selector.value,
        );


      if (periodoId) {
        await cargarMiDisponibilidad(
          periodoId,
        );
      }

    },
  );


  cargarMiDisponibilidad(
    inicial.id,
  );
}


async function cargarMiDisponibilidad(
  periodoId,
) {
  const contenido =
    document.getElementById(
      'miDisponibilidadContent',
    );


  if (!contenido) {
    return;
  }


  contenido.innerHTML = `
    <div
      class="profesores-loading-inline"
    >
      Consultando disponibilidad...
    </div>
  `;


  try {

    const resultado =
      await consultarMiDisponibilidadProfesor(
        periodoId,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar su disponibilidad.',
      );
    }


    miDisponibilidadActual =
      resultado.data;


    renderizarMiDisponibilidad();

  } catch (error) {

    contenido.innerHTML = `
      <div
        class="
          profesores-loading-inline
          profesores-error
        "
      >
        ${escapeHtml(
          error?.message ||
            'No fue posible consultar la disponibilidad.',
        )}
      </div>
    `;

  }
}


function renderizarMiDisponibilidad() {
  const contenido =
    document.getElementById(
      'miDisponibilidadContent',
    );


  if (
    !contenido ||
    !miDisponibilidadActual
  ) {
    return;
  }


  const disponibilidad =
    miDisponibilidadActual;


  const bloques =
    Array.isArray(
      disponibilidad.bloques,
    )
      ? disponibilidad.bloques
      : [];


  contenido.innerHTML = `

    <div
      class="profesores-disponibilidad-summary"
    >

      <div>
        <span>
          Estado
        </span>

        <strong
          class="
            profesores-disponibilidad-status
            profesores-disponibilidad-${String(
              disponibilidad.estado,
            ).toLowerCase()}
          "
        >
          ${escapeHtml(
            nombreEstadoDisponibilidad(
              disponibilidad.estado,
            ),
          )}
        </strong>
      </div>


      <div>
        <span>
          Fecha límite
        </span>

        <strong>
          ${escapeHtml(
            disponibilidad.periodo
              ?.fechaLimiteDisponibilidad ||
              '—',
          )}
        </strong>
      </div>


      <div>
        <span>
          Bloques
        </span>

        <strong>
          ${bloques.length}
        </strong>
      </div>

    </div>


    ${
      bloques.length
        ? `
          <div
            class="profesores-schedule-list"
          >

            ${bloques
              .map(
                (bloque) => `
                  <div
                    class="profesores-schedule-row"
                  >

                    <strong
                      class="profesores-schedule-day"
                    >
                      ${escapeHtml(
                        NOMBRES_DIA[
                          bloque.dia
                        ] ||
                          bloque.dia,
                      )}
                    </strong>


                    <span
                      class="profesores-schedule-hours"
                    >
                      <i
                        data-lucide="clock"
                        aria-hidden="true"
                      ></i>

                      ${escapeHtml(
                        bloque.horaInicio,
                      )}
                      —
                      ${escapeHtml(
                        bloque.horaFin,
                      )}
                    </span>

                  </div>
                `,
              )
              .join('')}

          </div>
        `
        : `
          <div
            class="profesores-disponibilidad-empty"
          >
            Todavía no hay bloques
            registrados para este periodo.
          </div>
        `
    }


    ${
      disponibilidad.observaciones
        ? `
          <div
            class="profesores-disponibilidad-observaciones"
          >
            <span>
              Observaciones
            </span>

            <p>
              ${escapeHtml(
                disponibilidad
                  .observaciones,
              )}
            </p>
          </div>
        `
        : ''
    }


    <div
      class="profesores-review-actions"
    >

      ${
        disponibilidad.puedeEditar
          ? `
            <button
              id="editarMiDisponibilidadButton"
              type="button"
              class="
                profesores-action-button
                is-success
              "
            >
              ${
                disponibilidad.registrada
                  ? 'Editar disponibilidad'
                  : 'Registrar disponibilidad'
              }
            </button>
          `
          : ''
      }


      ${
        disponibilidad.puedeEditar &&
        !disponibilidad.registrada &&
        obtenerPeriodoAnteriorDisponibilidad(
          disponibilidad.periodo,
        )
          ? `
            <button
              id="copiarDisponibilidadAnteriorButton"
              type="button"
              class="profesores-action-button"
            >
              Copiar periodo anterior
            </button>
          `
          : ''
      }


      ${
        disponibilidad.registrada
          ? `
            <button
              id="verHistorialDisponibilidadButton"
              type="button"
              class="profesores-action-button"
            >
              Ver historial
            </button>
          `
          : ''
      }

    </div>

  `;


  document
    .getElementById(
      'editarMiDisponibilidadButton',
    )
    ?.addEventListener(
      'click',
      abrirFormularioMiDisponibilidad,
    );


  document
    .getElementById(
      'copiarDisponibilidadAnteriorButton',
    )
    ?.addEventListener(
      'click',
      copiarDisponibilidadAnterior,
    );


  document
    .getElementById(
      'verHistorialDisponibilidadButton',
    )
    ?.addEventListener(
      'click',
      abrirHistorialMiDisponibilidad,
    );


  renderizarIconos();
}


function obtenerPeriodoAnteriorDisponibilidad(
  destino,
) {
  if (!destino) {
    return null;
  }


  const anioOrigen =
    destino.ciclo === 2
      ? destino.anio
      : destino.anio - 1;


  const cicloOrigen =
    destino.ciclo === 2
      ? 1
      : 2;


  return (
    periodosMiDisponibilidad.find(
      (periodo) =>
        periodo.anio ===
          anioOrigen &&
        periodo.ciclo ===
          cicloOrigen,
    ) || null
  );
}


function abrirFormularioMiDisponibilidad() {
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
    !content ||
    !miDisponibilidadActual
  ) {
    return;
  }


  const bloques =
    miDisponibilidadActual
      .bloques || [];


  content.innerHTML =
    FormDialog({

      formId:
        'miDisponibilidadForm',

      title:
        miDisponibilidadActual
          .registrada
          ? 'Editar disponibilidad'
          : 'Registrar disponibilidad',

      description:
        'Agregue los bloques horarios en que puede impartir cursos.',

      body: `

        <div
          class="
            sgpa-form-wide
            profesores-bloques-editor
          "
        >

          <div
            id="miDisponibilidadBloques"
          ></div>


          <button
            id="agregarBloqueDisponibilidad"
            type="button"
            class="profesores-action-button"
          >
            <i
              data-lucide="plus"
              aria-hidden="true"
            ></i>

            Agregar bloque
          </button>

        </div>


        <label
          class="sgpa-form-wide"
        >

          <span>
            Observaciones
          </span>

          <textarea
            id="miDisponibilidadObservaciones"
            rows="4"
            maxlength="500"
            placeholder="Observaciones opcionales"
          >${escapeHtml(
            miDisponibilidadActual
              .observaciones || '',
          )}</textarea>

        </label>

      `,

      errorId:
        'miDisponibilidadFormError',

      cancelButtonId:
        'cancelarMiDisponibilidad',

      submitButtonId:
        'guardarMiDisponibilidad',

      submitText:
        'Guardar disponibilidad',

    });


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );


  bloques.forEach(
    (bloque) => {
      agregarFilaDisponibilidad(
        bloque,
      );
    },
  );


  document
    .getElementById(
      'agregarBloqueDisponibilidad',
    )
    ?.addEventListener(
      'click',
      () => {
        agregarFilaDisponibilidad();
      },
    );


  document
    .getElementById(
      'cancelarMiDisponibilidad',
    )
    ?.addEventListener(
      'click',
      () => dialog.close(),
    );


  document
    .getElementById(
      'miDisponibilidadForm',
    )
    ?.addEventListener(
      'submit',
      guardarFormularioMiDisponibilidad,
    );


  renderizarIconos();
}


function agregarFilaDisponibilidad(
  bloque = null,
) {
  const contenedor =
    document.getElementById(
      'miDisponibilidadBloques',
    );


  if (!contenedor) {
    return;
  }


  const fila =
    document.createElement(
      'div',
    );


  fila.className =
    'profesores-bloque-editor-row';


  fila.innerHTML = `

    <select
      data-bloque-dia
      aria-label="Día"
      required
    >

      ${Object.entries(
        NOMBRES_DIA,
      )
        .map(
          ([valor, nombre]) => `
            <option
              value="${valor}"
              ${
                bloque?.dia ===
                valor
                  ? 'selected'
                  : ''
              }
            >
              ${nombre}
            </option>
          `,
        )
        .join('')}

    </select>


    <input
      data-bloque-inicio
      type="time"
      value="${escapeHtml(
        bloque?.horaInicio ||
          '',
      )}"
      required
    >


    <span>
      a
    </span>


    <input
      data-bloque-fin
      type="time"
      value="${escapeHtml(
        bloque?.horaFin ||
          '',
      )}"
      required
    >


    <button
      type="button"
      class="
        profesores-icon-button
        is-danger
      "
      title="Eliminar bloque"
      aria-label="Eliminar bloque"
    >
      <i
        data-lucide="trash-2"
        aria-hidden="true"
      ></i>
    </button>

  `;


  fila
    .querySelector(
      'button',
    )
    ?.addEventListener(
      'click',
      () => {
        fila.remove();
      },
    );


  contenedor.appendChild(
    fila,
  );


  renderizarIconos();
}


function validarBloquesDisponibilidad(
  bloques,
) {
  for (
    const bloque of bloques
  ) {
    if (
      bloque.horaFin <=
      bloque.horaInicio
    ) {
      return `El bloque del ${
        NOMBRES_DIA[
          bloque.dia
        ]
      } debe terminar después de la hora de inicio.`;
    }
  }


  const porDia =
    new Map();


  bloques.forEach(
    (bloque) => {

      const actuales =
        porDia.get(
          bloque.dia,
        ) || [];


      actuales.push(
        bloque,
      );


      porDia.set(
        bloque.dia,
        actuales,
      );

    },
  );


  for (
    const [
      dia,
      bloquesDia,
    ] of porDia
  ) {

    const ordenados =
      [...bloquesDia].sort(
        (a, b) =>
          a.horaInicio
            .localeCompare(
              b.horaInicio,
            ),
      );


    for (
      let i = 1;
      i < ordenados.length;
      i += 1
    ) {

      if (
        ordenados[i]
          .horaInicio <
        ordenados[i - 1]
          .horaFin
      ) {
        return `Existen bloques superpuestos el ${
          NOMBRES_DIA[dia]
        }.`;
      }

    }

  }


  return null;
}


async function guardarFormularioMiDisponibilidad(
  event,
) {
  event.preventDefault();


  const filas =
    [
      ...document
        .querySelectorAll(
          '.profesores-bloque-editor-row',
        ),
    ];


  const bloques =
    filas.map(
      (fila) => ({

        dia:
          fila.querySelector(
            '[data-bloque-dia]',
          ).value,

        horaInicio:
          fila.querySelector(
            '[data-bloque-inicio]',
          ).value,

        horaFin:
          fila.querySelector(
            '[data-bloque-fin]',
          ).value,

      }),
    );


  const error =
    validarBloquesDisponibilidad(
      bloques,
    );


  if (error) {

    const errorBox =
      document.getElementById(
        'miDisponibilidadFormError',
      );


    if (errorBox) {
      errorBox.textContent =
        error;

      errorBox.classList.remove(
        'hidden',
      );
    }

    return;
  }


  try {

    const resultado =
      await guardarMiDisponibilidadProfesor({

        periodoAcademicoId:
          miDisponibilidadActual
            .periodoAcademicoId ||
          miDisponibilidadActual
            .periodo?.id,

        bloques,

        observaciones:
          document
            .getElementById(
              'miDisponibilidadObservaciones',
            )
            ?.value
            ?.trim() || '',

      });


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible guardar la disponibilidad.',
      );
    }


    document
      .getElementById(
        'profesorRevisionDialog',
      )
      ?.close();


    mostrarExito({

      titulo:
        'Disponibilidad guardada',

      mensaje:
        'Su disponibilidad docente fue registrada correctamente.',

    });


    await cargarMiDisponibilidad(
      miDisponibilidadActual
        .periodoAcademicoId ||
      miDisponibilidadActual
        .periodo?.id,
    );

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo guardar la disponibilidad',

      mensaje:
        error?.message ||
          'No fue posible guardar la información.',

    });

  }
}


async function copiarDisponibilidadAnterior() {
  if (
    !miDisponibilidadActual
  ) {
    return;
  }


  const destino =
    miDisponibilidadActual
      .periodo;


  const origen =
    obtenerPeriodoAnteriorDisponibilidad(
      destino,
    );


  if (!origen) {
    return;
  }


  const confirmado =
    await confirmarAccion({

      titulo:
        'Copiar disponibilidad',

      mensaje:
        `Se copiarán los bloques de ${origen.codigo} hacia ${destino.codigo}.`,

      textoConfirmar:
        'Copiar',

    });


  if (!confirmado) {
    return;
  }


  try {

    const resultado =
      await copiarMiDisponibilidadProfesor({

        periodoOrigenId:
          origen.id,

        periodoDestinoId:
          destino.id,

      });


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible copiar la disponibilidad.',
      );
    }


    mostrarExito({

      titulo:
        'Disponibilidad copiada',

      mensaje:
        'Los bloques del periodo anterior fueron copiados correctamente.',

    });


    await cargarMiDisponibilidad(
      destino.id,
    );

  } catch (error) {

    mostrarError({

      titulo:
        'No se pudo copiar la disponibilidad',

      mensaje:
        error?.message ||
          'No fue posible copiar los bloques.',

    });

  }
}


async function abrirHistorialMiDisponibilidad() {
  if (!miDisponibilidadActual) {
    return;
  }

  const dialog =
    document.getElementById(
      'profesorRevisionDialog',
    );

  const content =
    document.getElementById(
      'profesorRevisionDialogContent',
    );

  if (!dialog || !content) {
    return;
  }

  content.innerHTML = `
    <div class="sgpa-dialog-header">
      <div>
        <h3>Historial de disponibilidad</h3>
        <p>Registro de cambios en su disponibilidad docente.</p>
      </div>
    </div>
    <div class="profesores-loading-inline">
      Cargando historial...
    </div>
  `;

  dialog.showModal();
  habilitarCierreExterior(dialog);

  try {
    const periodoId =
      miDisponibilidadActual.periodoAcademicoId ||
      miDisponibilidadActual.periodo?.id;

    const resultado =
      await obtenerHistorialMiDisponibilidadProfesor(
        periodoId,
      );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar el historial.',
      );
    }

    const historial = Array.isArray(resultado.data)
      ? resultado.data
      : [];

    content.innerHTML = `
      <div class="sgpa-dialog-header">
        <div>
          <h3>Historial de disponibilidad</h3>
          <p>${escapeHtml(miDisponibilidadActual.periodo?.codigo || '')} — ${escapeHtml(miDisponibilidadActual.periodo?.nombre || '')}</p>
        </div>
      </div>

      <div class="profesores-historial-list" style="margin-top: 14px;">
        ${
          historial.length
            ? historial
                .map(
                  (item) => `
                    <div class="profesores-historial-item">
                      <div class="profesores-historial-header">
                        <strong>${escapeHtml(item.accion || 'Modificación')}</strong>
                        <span>${escapeHtml(item.createdAt ? new Date(item.createdAt).toLocaleString() : '—')}</span>
                      </div>
                      ${
                        item.observaciones || item.observacion
                          ? `<p>${escapeHtml(item.observaciones || item.observacion)}</p>`
                          : ''
                      }
                    </div>
                  `,
                )
                .join('')
            : `
              <p class="profesores-muted" style="text-align: center; padding: 20px 0;">
                No hay registros en el historial para este periodo.
              </p>
            `
        }
      </div>

      <div style="margin-top: 18px; display: flex; justify-content: flex-end;">
        <button id="cerrarHistorialDisponibilidad" type="button" class="profesores-action-button">
          Cerrar
        </button>
      </div>
    `;

    document
      .getElementById('cerrarHistorialDisponibilidad')
      ?.addEventListener('click', () => dialog.close());

    renderizarIconos();
  } catch (error) {
    content.innerHTML = `
      <div class="sgpa-dialog-header">
        <div>
          <h3>Error</h3>
          <p>No fue posible cargar el historial.</p>
        </div>
      </div>
      <div class="profesores-message profesores-error">
        ${escapeHtml(error?.message || 'Error al consultar el historial.')}
      </div>
      <div style="margin-top: 18px; display: flex; justify-content: flex-end;">
        <button id="cerrarHistorialDisponibilidad" type="button" class="profesores-action-button">
          Cerrar
        </button>
      </div>
    `;

    document
      .getElementById('cerrarHistorialDisponibilidad')
      ?.addEventListener('click', () => dialog.close());

    renderizarIconos();
  }
}


/* =========================================================
   INICIALIZADOR PRINCIPAL CON DETECCIÓN DE ROLES
   ========================================================= */

export function iniciarProfesoresPage() {
  const roles =
    obtenerRolesUsuario();

  const esAdministrador =
    roles.includes(
      ROLES.ADMIN_GLOBAL,
    );

  const esCoordinador =
    roles.includes(
      ROLES.COORDINADOR,
    );

  const esProfesor =
    roles.includes(
      ROLES.PROFESOR,
    );

  const tieneGestion =
    esAdministrador ||
    esCoordinador;


  if (
    esProfesor &&
    !tieneGestion
  ) {
    iniciarMiPerfilDocente();

    return;
  }


  if (tieneGestion) {
    iniciarGestionProfesores();

    return;
  }


  const vista =
    document.getElementById(
      'profesoresVista',
    );

  if (vista) {
    vista.innerHTML = `
      <div
        class="profesores-message"
      >
        No tiene acceso al módulo
        de profesores.
      </div>
    `;
  }
}
