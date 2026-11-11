import {
  listarProfesores,
  obtenerProfesor,
  obtenerDisponibilidadProfesor,
  obtenerExpedientePerfilProfesor,
  revisarRequisitoPerfilProfesor,
  obtenerMiExpedientePerfilProfesor,
  guardarEvidenciasRequisitoProfesor,
  revisarPerfilProfesor,
  inactivarPerfilProfesor,
  revisarAtestadoProfesor,

  obtenerMiPerfilProfesor,
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
  StatusBadge,
} from '../../components/StatusBadge.js';

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
  obtenerRolActivo,
  usuarioTienePermiso,
} from '../../app/session.js';

import {
  ROLES,
  PERMISOS,
} from '../../config/permissions.js';

import {
  NOMBRES_DIA,
  ORDEN_DIA,
  NOMBRES_ESTADO_PROFESOR,
  NOMBRES_TIPO_ATESTADO,
  NOMBRES_TIPO_REQUISITO,
  obtenerNombreCompleto,
  obtenerCarreras,
  obtenerPerfiles,
  obtenerCursos,
  nombreEstadoProfesor,
  nombreTipoAtestado,
  nombreTipoRequisito,
  tonoCumplimiento,
  nombreEstadoDisponibilidad,
  seleccionarPeriodoInicial,
  filtrarListaProfesores,
  obtenerPeriodoAnteriorDisponibilidad,
  validarBloquesDisponibilidad,
} from './profesores.helpers.js';

import {
  setPeriodosDisponibilidad,
  configurarMiDisponibilidad as configurarMiDisponibilidadComponente,
  cargarMiDisponibilidad as cargarMiDisponibilidadComponente,
  renderizarMiDisponibilidad as renderizarMiDisponibilidadComponente,
  abrirFormularioMiDisponibilidad as abrirFormularioMiDisponibilidadComponente,
  copiarDisponibilidadAnterior as copiarDisponibilidadAnteriorComponente,
  abrirHistorialMiDisponibilidad as abrirHistorialMiDisponibilidadComponente,
} from './ProfesorDisponibilidadView.js';

import {
  renderizarExpedientePerfil as renderizarExpedientePerfilComponente,
} from './ProfesorDetalleView.js';

import {
  abrirFormularioAtestado as abrirFormularioAtestadoComponente,
  inactivarMiAtestado as inactivarMiAtestadoComponente,
  abrirFormularioProyecto as abrirFormularioProyectoComponente,
  cambiarEstadoMiProyecto as cambiarEstadoMiProyectoComponente,
} from './ProfesorFormDialog.js';

export {
  NOMBRES_DIA,
  ORDEN_DIA,
  NOMBRES_ESTADO_PROFESOR,
  NOMBRES_TIPO_ATESTADO,
  NOMBRES_TIPO_REQUISITO,
  obtenerNombreCompleto,
  obtenerCarreras,
  obtenerPerfiles,
  obtenerCursos,
  nombreEstadoProfesor,
  nombreTipoAtestado,
  nombreTipoRequisito,
  tonoCumplimiento,
  nombreEstadoDisponibilidad,
  seleccionarPeriodoInicial,
  filtrarListaProfesores,
  obtenerPeriodoAnteriorDisponibilidad,
  validarBloquesDisponibilidad,
};

function puedeGestionarProfesores() {
  return usuarioTienePermiso(
    PERMISOS.PROFESORES_VER,
  );
}

function puedeValidarPerfilesDocentes() {
  return usuarioTienePermiso(
    PERMISOS.PERFILES_DOCENTES_VALIDAR,
  );
}

function puedeValidarAtestados() {
  return usuarioTienePermiso(
    PERMISOS.ATESTADOS_VALIDAR,
  );
}

function esProfesorActual() {
  return obtenerRolActivo() === ROLES.PROFESOR;
}


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

      <dialog
        id="profesorExpedienteDialog"
        class="
          sgpa-form-dialog
          sgpa-form-dialog-lg
        "
      >
        <div
          id="profesorExpedienteDialogContent"
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
  const tieneGestion =
    puedeGestionarProfesores();

  const esProfesor =
    esProfesorActual();


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
   EXPEDIENTE DE REQUISITOS DEL PERFIL
   ========================================================= */

function abrirRevisionRequisitoDialog({
  perfilId,
  requisitoId,
  estado,
  requisitoNombre = '',
}) {
  const dialog = document.getElementById('profesorRevisionDialog');
  const content = document.getElementById('profesorRevisionDialogContent');

  if (!dialog || !content || !profesorDetalleActual) {
    return;
  }

  content.innerHTML = FormDialog({
    formId: 'profesorRevisionRequisitoForm',
    title: 'Revisar requisito',
    description: `Requisito: ${escapeHtml(requisitoNombre)}`,
    body: `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
        <span style="font-size: 13px; color: #475467; font-weight: 500;">Estado a asignar:</span>
        ${StatusBadge({
          label: estado,
          tone: tonoCumplimiento(estado),
        })}
      </div>

      <label class="sgpa-form-wide">
        <span>Observación de revisión (opcional):</span>
        <textarea
          id="profesorRevisionRequisitoObservacion"
          rows="3"
          maxlength="500"
          placeholder="Observación de la revisión..."
        ></textarea>
      </label>
    `,
    errorId: 'profesorRevisionRequisitoError',
    cancelButtonId: 'cancelarProfesorRevisionRequisito',
    submitButtonId: 'guardarProfesorRevisionRequisito',
    submitText: 'Guardar revisión',
  });

  dialog.showModal();
  habilitarCierreExterior(dialog);

  document
    .getElementById('cancelarProfesorRevisionRequisito')
    ?.addEventListener('click', () => {
      dialog.close();
    });

  document
    .getElementById('profesorRevisionRequisitoForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const observacion =
        document
          .getElementById('profesorRevisionRequisitoObservacion')
          ?.value?.trim() || '';

      const boton = document.getElementById(
        'guardarProfesorRevisionRequisito',
      );
      if (boton) {
        boton.disabled = true;
      }

      try {
        const resultado = await revisarRequisitoPerfilProfesor(
          profesorDetalleActual.id,
          perfilId,
          requisitoId,
          {
            estado,
            observacion,
          },
        );

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || 'No fue posible realizar la revisión del requisito.',
          );
        }

        dialog.close();

        mostrarExito({
          titulo: 'Requisito actualizado',
          mensaje: 'El estado del requisito fue guardado correctamente.',
        });

        // Recargar el expediente sin cerrar el modal de expediente
        const resExp = await obtenerExpedientePerfilProfesor(
          profesorDetalleActual.id,
          perfilId,
        );

        if (resExp?.ok) {
          renderizarExpedientePerfil({
            expediente: resExp.data,
            modo: 'gestion',
            perfilId,
          });
        }
      } catch (error) {
        mostrarError({
          titulo: 'No se pudo revisar el requisito',
          mensaje: error?.message || 'Error al guardar la revisión del requisito.',
        });
      } finally {
        if (boton) {
          boton.disabled = false;
        }
      }
    });

  renderizarIconos();
}

async function abrirExpedientePerfilGestion(perfilId) {
  if (!puedeValidarPerfilesDocentes()) {
    mostrarError({
      titulo: 'Acceso restringido',
      mensaje: 'No posee permiso para consultar el expediente del perfil docente.',
    });
    return;
  }

  if (!profesorDetalleActual) {
    return;
  }

  const dialog = document.getElementById('profesorExpedienteDialog');
  const content = document.getElementById('profesorExpedienteDialogContent');

  if (!dialog || !content) {
    return;
  }

  content.innerHTML = `
    <div class="profesores-loading-inline">
      Cargando expediente de requisitos...
    </div>
  `;

  dialog.showModal();
  habilitarCierreExterior(dialog);

  try {
    const resultado = await obtenerExpedientePerfilProfesor(
      profesorDetalleActual.id,
      perfilId,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible consultar el expediente de requisitos.',
      );
    }

    renderizarExpedientePerfil({
      expediente: resultado.data,
      modo: 'gestion',
      perfilId,
    });
  } catch (error) {
    content.innerHTML = `
      <div class="profesores-expediente">
        <div class="profesores-expediente-header">
          <div class="profesores-expediente-title-wrap">
            <h3>Error al cargar expediente</h3>
            <p>${escapeHtml(error?.message || 'No fue posible cargar el expediente de requisitos.')}</p>
          </div>
          <button type="button" class="profesores-action-button" id="cerrarExpedienteErrorBtn">
            Cerrar
          </button>
        </div>
      </div>
    `;

    document
      .getElementById('cerrarExpedienteErrorBtn')
      ?.addEventListener('click', () => dialog.close());

    renderizarIconos();
  }
}

async function abrirMiExpedientePerfil(perfilId) {
  const dialog = document.getElementById('profesorExpedienteDialog');
  const content = document.getElementById('profesorExpedienteDialogContent');

  if (!dialog || !content) {
    return;
  }

  content.innerHTML = `
    <div class="profesores-loading-inline">
      Cargando expediente de requisitos...
    </div>
  `;

  dialog.showModal();
  habilitarCierreExterior(dialog);

  try {
    const resultado = await obtenerMiExpedientePerfilProfesor(perfilId);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible consultar su expediente de requisitos.',
      );
    }

    renderizarExpedientePerfil({
      expediente: resultado.data,
      modo: 'profesor',
      perfilId,
    });
  } catch (error) {
    content.innerHTML = `
      <div class="profesores-expediente">
        <div class="profesores-expediente-header">
          <div class="profesores-expediente-title-wrap">
            <h3>Error al cargar expediente</h3>
            <p>${escapeHtml(error?.message || 'No fue posible cargar el expediente de requisitos.')}</p>
          </div>
          <button type="button" class="profesores-action-button" id="cerrarExpedienteErrorBtn">
            Cerrar
          </button>
        </div>
      </div>
    `;

    document
      .getElementById('cerrarExpedienteErrorBtn')
      ?.addEventListener('click', () => dialog.close());

    renderizarIconos();
  }
}

function renderizarExpedientePerfil({
  expediente,
  modo,
  perfilId,
}) {
  return renderizarExpedientePerfilComponente({
    expediente,
    modo,
    perfilId,
    puedeValidar: puedeValidarPerfilesDocentes(),
    onCerrar: () => {
      document.getElementById('profesorExpedienteDialog')?.close();
    },
    onGuardarEvidencias: async ({ perfilId: pId, requisitoId: reqId, evidenciasIds, observacion }) => {
      try {
        const resultado = await guardarEvidenciasRequisitoProfesor(
          pId,
          reqId,
          {
            requisitoId: reqId,
            atestadoIds: evidenciasIds,
            observacion,
          },
        );
        if (!resultado?.ok) {
          throw new Error(resultado?.message || 'No fue posible guardar las evidencias.');
        }
        mostrarExito({
          titulo: 'Evidencias guardadas',
          mensaje: 'Las evidencias y observaciones fueron actualizadas correctamente.',
        });
        const resExp = await obtenerMiExpedientePerfilProfesor(pId);
        if (resExp?.ok) {
          renderizarExpedientePerfil({
            expediente: resExp.data,
            modo: 'profesor',
            perfilId: pId,
          });
        }
      } catch (error) {
        mostrarError({
          titulo: 'Error al guardar evidencias',
          mensaje: error?.message || 'No fue posible guardar las evidencias.',
        });
      }
    },
    onRevisarRequisito: ({ perfilId: pId, requisitoId: reqId, estado, requisitoNombre }) => {
      abrirRevisionRequisitoDialog({
        perfilId: pId,
        requisitoId: reqId,
        estado,
        requisitoNombre,
      });
    },
    onAprobarPerfil: (pId) => {
      abrirRevisionProfesor({
        tipo: 'perfil',
        id: pId,
        estado: 'APROBADO',
      });
    },
    onRechazarPerfil: (pId) => {
      abrirRevisionProfesor({
        tipo: 'perfil',
        id: pId,
        estado: 'RECHAZADO',
      });
    },
  });
}


/* =========================================================
   REVISIÓN (MODAL REUTILIZABLE - GESTIÓN)
   ========================================================= */

function abrirRevisionProfesor({
  tipo,
  id,
  estado,
}) {
  if (
    tipo === 'perfil' &&
    !puedeValidarPerfilesDocentes()
  ) {
    mostrarError({
      titulo: 'Acceso restringido',
      mensaje: 'No posee permiso para validar perfiles docentes.',
    });
    return;
  }

  if (
    tipo === 'atestado' &&
    !puedeValidarAtestados()
  ) {
    mostrarError({
      titulo: 'Acceso restringido',
      mensaje: 'No posee permiso para validar atestados.',
    });
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

          const expDialog = document.getElementById(
            'profesorExpedienteDialog',
          );
          if (expDialog && expDialog.open) {
            expDialog.close();
          }


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
  if (
    !puedeValidarPerfilesDocentes()
  ) {
    mostrarError({
      titulo:
        'Acceso restringido',
      mensaje:
        'No posee permiso para modificar perfiles docentes.',
    });
    return;
  }

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
  if (
    !puedeGestionarProfesores()
  ) {
    mostrarError({
      titulo:
        'Acceso restringido',
      mensaje:
        'No posee permiso para consultar profesores.',
    });
    return;
  }

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

    const puedeVerPeriodos =
      usuarioTienePermiso(
        PERMISOS.PERIODOS_VER,
      );

    const [
      resultado,
      resultadoPeriodos,
    ] = await Promise.all([
      obtenerProfesor(
        profesorId,
      ),

      puedeVerPeriodos
        ? listarPeriodosAcademicos()
        : Promise.resolve({
            ok: true,
            periodos: [],
          }),
    ]);


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          'No fue posible consultar el profesor.',
      );
    }

    periodosAcademicos =
      Array.isArray(
        resultadoPeriodos?.periodos,
      )
        ? resultadoPeriodos.periodos
        : [];


    const profesor =
      resultado.data;


    profesorDetalleActual =
      profesor;


    const puedeRevisarPerfiles =
      puedeValidarPerfilesDocentes();

    const puedeRevisarAtestados =
      puedeValidarAtestados();

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


                        ${
                          puedeRevisarPerfiles
                            ? `
                              <div
                                class="profesores-review-actions"
                              >
                                <button
                                  type="button"
                                  class="profesores-action-button"
                                  data-action="revisar-expediente-perfil"
                                  data-perfil-id="${
                                    perfil
                                      .perfilAcademicoId
                                  }"
                                >
                                  <i
                                    data-lucide="clipboard-list"
                                    aria-hidden="true"
                                  ></i>

                                  ${
                                    perfil.estado === 'PENDIENTE'
                                      ? 'Revisar requisitos'
                                      : 'Ver expediente'
                                  }
                                </button>

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
                                    Obtenido:
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
                          puedeRevisarAtestados &&
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


      ${
        puedeVerPeriodos
          ? `
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
          `
          : `
            <section
              class="profesores-detail-card"
            >
              <h3>
                Disponibilidad docente
              </h3>

              <p
                class="profesores-muted"
              >
                No posee permiso para consultar
                los periodos académicos necesarios
                para visualizar la disponibilidad.
              </p>
            </section>
          `
      }

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
          'revisar-expediente-perfil'
        ) {
          await abrirExpedientePerfilGestion(
            Number(
              boton.dataset
                .perfilId,
            ),
          );

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
  if (
    !puedeGestionarProfesores()
  ) {
    return;
  }

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
      resultadoPerfilesDisponibles,
      resultadoPeriodosDisponibilidad,
    ] = await Promise.all([
      obtenerMiPerfilProfesor(),
      listarPerfilesDisponiblesProfesor(),
      listarPeriodosMiDisponibilidadProfesor(),
    ]);

    if (instancia !== instanciaActual) {
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

    periodosMiDisponibilidad = Array.isArray(
      resultadoPeriodosDisponibilidad.data,
    )
      ? resultadoPeriodosDisponibilidad.data
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

        return;
      }


      if (
        action ===
        'ver-mi-expediente-perfil'
      ) {
        await abrirMiExpedientePerfil(
          Number(
            boton.dataset
              .perfilId,
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
  return abrirFormularioAtestadoComponente({
    atestado,
    onGuardado: async () => {
      await iniciarMiPerfilDocente();
    },
  });
}

async function inactivarMiAtestado(
  atestadoId,
) {
  return inactivarMiAtestadoComponente({
    atestadoId,
    onInactivado: async () => {
      await iniciarMiPerfilDocente();
    },
  });
}

function abrirFormularioProyecto(
  proyecto = null,
) {
  return abrirFormularioProyectoComponente({
    proyecto,
    onGuardado: async () => {
      await iniciarMiPerfilDocente();
    },
  });
}

async function cambiarEstadoMiProyecto(
  proyecto,
  activo,
) {
  return cambiarEstadoMiProyectoComponente({
    proyecto,
    activo,
    onActualizado: async () => {
      await iniciarMiPerfilDocente();
    },
  });
}


/* =========================================================
   AUTOGESTIÓN: MI DISPONIBILIDAD DOCENTE
   ========================================================= */

function configurarMiDisponibilidad() {
  setPeriodosDisponibilidad(periodosMiDisponibilidad);
  return configurarMiDisponibilidadComponente(periodosMiDisponibilidad);
}

async function cargarMiDisponibilidad(periodoId) {
  return cargarMiDisponibilidadComponente(periodoId);
}

function renderizarMiDisponibilidad() {
  return renderizarMiDisponibilidadComponente();
}

function abrirFormularioMiDisponibilidad() {
  return abrirFormularioMiDisponibilidadComponente();
}

async function copiarDisponibilidadAnterior() {
  return copiarDisponibilidadAnteriorComponente();
}

async function abrirHistorialMiDisponibilidad() {
  return abrirHistorialMiDisponibilidadComponente();
}


/* =========================================================
   INICIALIZADOR PRINCIPAL CON DETECCIÓN DE ROLES
   ========================================================= */

export function iniciarProfesoresPage() {
  const esProfesor =
    esProfesorActual();

  const tieneGestion =
    puedeGestionarProfesores();


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
