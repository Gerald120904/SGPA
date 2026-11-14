import {
  obtenerProfesor,
  obtenerDisponibilidadProfesor,
  obtenerExpedientePerfilProfesor,
  revisarRequisitoPerfilProfesor,
  obtenerMiExpedientePerfilProfesor,
  guardarEvidenciasRequisitoProfesor,
  revisarPerfilProfesor,
  inactivarPerfilProfesor,
  revisarAtestadoProfesor,
} from '../../services/profesores.service.js';
import {
  listarPeriodosAcademicos,
} from '../../services/periodos.service.js';
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
  usuarioTienePermiso,
} from '../../app/session.js';
import {
  PERMISOS,
} from '../../config/permissions.js';
import {
  puedeGestionarProfesores,
  puedeValidarPerfilesDocentes,
  puedeValidarAtestados,
} from './profesores.permissions.js';
import {
  NOMBRES_DIA,
  ORDEN_DIA,
  obtenerNombreCompleto,
  obtenerCarreras,
  obtenerPerfiles,
  obtenerCursos,
  nombreEstadoProfesor,
  nombreTipoAtestado,
  tonoCumplimiento,
  nombreEstadoDisponibilidad,
  seleccionarPeriodoInicial,
} from './profesores.helpers.js';
import {
  renderizarExpedientePerfil as renderizarExpedientePerfilComponente,
} from './ProfesorDetalleView.js';

export function crearGestionDetalleProfesores({ volverAListado }) {
  let profesorDetalleActual = null;
  let periodosAcademicos = [];
  let instanciaDetalleActual = 0;
  let solicitudDisponibilidadActual = 0;
  let solicitudExpedienteActual = 0;
  let vistaConEventosDelegados = null;
  let manejadorEventosDelegados = null;

  function invalidarDetalle() {
    instanciaDetalleActual += 1;
    solicitudDisponibilidadActual += 1;
    solicitudExpedienteActual += 1;
    profesorDetalleActual = null;
    periodosAcademicos = [];
  }

  function habilitarEventosDelegados(vista) {
    if (vistaConEventosDelegados === vista) return;
    vistaConEventosDelegados?.removeEventListener?.(
      'click',
      manejadorEventosDelegados,
    );
    vistaConEventosDelegados = vista;
    manejadorEventosDelegados = async (event) => {
      const boton = event.target.closest('[data-action]');
      if (!boton) return;

      const action = boton.dataset.action;
      if (action === 'revisar-expediente-perfil') {
        await abrirExpedientePerfilGestion(
          Number(boton.dataset.perfilId),
        );
        return;
      }

      if (action === 'inactivar-perfil') {
        await confirmarInactivacionPerfil(
          Number(boton.dataset.perfilId),
        );
        return;
      }

      if (action === 'aprobar-atestado' || action === 'rechazar-atestado') {
        abrirRevisionProfesor({
          tipo: 'atestado',
          id: Number(boton.dataset.atestadoId),
          estado: action === 'aprobar-atestado' ? 'APROBADO' : 'RECHAZADO',
        });
      }
    };
    vista.addEventListener('click', manejadorEventosDelegados);
  }

  function destruir() {
    invalidarDetalle();
    profesorDetalleActual = null;
    periodosAcademicos = [];
    vistaConEventosDelegados?.removeEventListener?.(
      'click',
      manejadorEventosDelegados,
    );
    vistaConEventosDelegados = null;
    manejadorEventosDelegados = null;
  }

async function cargarDisponibilidadProfesor(
  profesorId,
  periodoId,
) {
  const instanciaDetalle = instanciaDetalleActual;
  const solicitudDisponibilidad = ++solicitudDisponibilidadActual;
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


    if (
      instanciaDetalle !== instanciaDetalleActual ||
      solicitudDisponibilidad !== solicitudDisponibilidadActual ||
      profesorDetalleActual?.id !== profesorId
    ) {
      return;
    }

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
    if (
      instanciaDetalle !== instanciaDetalleActual ||
      solicitudDisponibilidad !== solicitudDisponibilidadActual ||
      profesorDetalleActual?.id !== profesorId
    ) {
      return;
    }


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

      const instancia = instanciaDetalleActual;
      const profesorId = profesorDetalleActual?.id;
      if (!profesorId) return;

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
          profesorId,
          perfilId,
          requisitoId,
          {
            estado,
            observacion,
          },
        );

        if (
          instancia !== instanciaDetalleActual ||
          profesorDetalleActual?.id !== profesorId
        ) {
          return;
        }

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
          profesorId,
          perfilId,
        );

        if (
          instancia !== instanciaDetalleActual ||
          profesorDetalleActual?.id !== profesorId
        ) {
          return;
        }

        if (resExp?.ok) {
          renderizarExpedientePerfil({
            expediente: resExp.data,
            modo: 'gestion',
            perfilId,
          });
        }
      } catch (error) {
        if (
          instancia !== instanciaDetalleActual ||
          profesorDetalleActual?.id !== profesorId
        ) {
          return;
        }

        mostrarError({
          titulo: 'No se pudo revisar el requisito',
          mensaje: error?.message || 'Error al guardar la revisión del requisito.',
        });
      } finally {
        if (
          boton &&
          instancia === instanciaDetalleActual &&
          profesorDetalleActual?.id === profesorId
        ) {
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

  const instancia = instanciaDetalleActual;
  const solicitud = ++solicitudExpedienteActual;
  const profesorId = profesorDetalleActual?.id;
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
      profesorId,
      perfilId,
    );

    if (
      instancia !== instanciaDetalleActual ||
      solicitud !== solicitudExpedienteActual ||
      profesorDetalleActual?.id !== profesorId
    ) {
      return;
    }

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
    if (
      instancia !== instanciaDetalleActual ||
      solicitud !== solicitudExpedienteActual ||
      profesorDetalleActual?.id !== profesorId
    ) {
      return;
    }

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
  const instancia = instanciaDetalleActual;
  const solicitud = ++solicitudExpedienteActual;
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

    if (
      instancia !== instanciaDetalleActual ||
      solicitud !== solicitudExpedienteActual
    ) {
      return;
    }

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
    if (
      instancia !== instanciaDetalleActual ||
      solicitud !== solicitudExpedienteActual
    ) {
      return;
    }

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
  const instancia = instanciaDetalleActual;
  const profesorId = profesorDetalleActual?.id;
  const vigente = () =>
    instancia === instanciaDetalleActual &&
    (!profesorId || profesorDetalleActual?.id === profesorId);

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
        if (!vigente()) return;
        if (!resultado?.ok) {
          throw new Error(resultado?.message || 'No fue posible guardar las evidencias.');
        }
        mostrarExito({
          titulo: 'Evidencias guardadas',
          mensaje: 'Las evidencias y observaciones fueron actualizadas correctamente.',
        });
        const resExp = await obtenerMiExpedientePerfilProfesor(pId);
        if (!vigente()) return;
        if (resExp?.ok) {
          renderizarExpedientePerfil({
            expediente: resExp.data,
            modo: 'profesor',
            perfilId: pId,
          });
        }
      } catch (error) {
        if (!vigente()) return;
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

        const instancia = instanciaDetalleActual;
        const profesorId = profesorDetalleActual?.id;
        if (!profesorId) return;


        if (boton) {
          boton.disabled = true;
        }


        try {

          const resultado =
            esPerfil
              ? await revisarPerfilProfesor(
                  profesorId,
                  id,
                  {
                    estado,
                    observacion,
                  },
                )
              : await revisarAtestadoProfesor(
                  profesorId,
                  id,
                  {
                    estado,
                    observacion,
                  },
                );


          if (
            instancia !== instanciaDetalleActual ||
            profesorDetalleActual?.id !== profesorId
          ) {
            return;
          }

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
            profesorId,
          );

        } catch (error) {

          if (
            instancia !== instanciaDetalleActual ||
            profesorDetalleActual?.id !== profesorId
          ) {
            return;
          }

          mostrarError({

            titulo:
              'No se pudo completar la revisión',

            mensaje:
              error?.message ||
              'No fue posible actualizar la información.',

          });

        } finally {

          if (
            boton &&
            instancia === instanciaDetalleActual &&
            profesorDetalleActual?.id === profesorId
          ) {
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


  const profesorId = profesorDetalleActual.id;
  const instancia = instanciaDetalleActual;

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


  if (!confirmado || instancia !== instanciaDetalleActual) {
    return;
  }


  try {

    const resultado =
      await inactivarPerfilProfesor(
        profesorId,
        perfilId,
        '',
      );


    if (instancia !== instanciaDetalleActual) return;

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
      profesorId,
    );

  } catch (error) {
    if (instancia !== instanciaDetalleActual) return;

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
  const instanciaDetalle = ++instanciaDetalleActual;
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


    if (instanciaDetalle !== instanciaDetalleActual) {
      return;
    }

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
          volverAListado();
        },
      );


    habilitarEventosDelegados(vista);


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

    if (instanciaDetalle !== instanciaDetalleActual) {
      return;
    }

    mostrarError({

      titulo:
        'No se pudo cargar el profesor',

      mensaje:
        error?.message ||
        'No fue posible consultar el perfil docente.',

    });


    volverAListado();

  }
}


/* =========================================================
   CARGAR (GESTIÓN)
   ========================================================= */

  return {
    abrirProfesor,
    abrirMiExpedientePerfil,
    invalidarDetalle,
    destruir,
  };
}
