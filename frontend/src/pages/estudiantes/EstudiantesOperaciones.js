import { dependencias } from './estudiantes.dependencies.js';

export function crearEstudiantesOperaciones({ estado, acciones }) {
function esContextoVigente(instancia, versionDialog) {
  return instancia === estado.instanciaActual && versionDialog === estado.versionDialog;
}

function renderizarHistorialAcademico(
  historial
) {
  return dependencias.renderizarHistorialAcademicoComponente(historial);
}

function renderizarHistorialPlanes(
  historial
) {
  return dependencias.renderizarHistorialPlanesComponente(historial);
}

function renderizarProgresoEstudiante(
  progreso
) {
  return dependencias.renderizarProgresoEstudianteComponente(progreso);
}

async function abrirDetalleEstudiante(
  id
) {
  const instanciaOperacion = estado.instanciaActual;
  const versionOperacion = ++estado.versionDialog;
  try {
    const resultado =
      await dependencias.obtenerEstudiante(id);
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

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
      dependencias.FormDialog({
        formId:
          'detalleEstudianteForm',

        title:
          'Detalle del estudiante',

        description:
          dependencias.obtenerNombreCompleto(
            estudiante
          ),

        layout: 'grid',

        body: `
          <label>
            <span>Cédula</span>
            <input
              type="text"
              value="${dependencias.escapeHtml(
                estudiante.cedula
              )}"
              readonly
            >
          </label>

          <label>
            <span>Correo institucional</span>
            <input
              type="text"
              value="${dependencias.escapeHtml(
                estudiante.correoInstitucional
              )}"
              readonly
            >
          </label>

          <label>
            <span>Teléfono</span>
            <input
              type="text"
              value="${dependencias.escapeHtml(
                estudiante.telefono || '—'
              )}"
              readonly
            >
          </label>

          <label>
            <span>Estado</span>
            <input
              type="text"
              value="${dependencias.escapeHtml(
                dependencias.formatearEstado(
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
              value="${dependencias.escapeHtml(
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
              value="${dependencias.escapeHtml(
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
              value="${dependencias.escapeHtml(
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

    dependencias.renderizarIconos();

    configurarTamanoDialog(dialog, 'md');

    dialog.showModal();

    dependencias.habilitarCierreExterior(
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
      if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
    dependencias.mostrarError({
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
  const instanciaOperacion = estado.instanciaActual;
  const versionOperacion = ++estado.versionDialog;
  try {
    const resultado =
      await dependencias.obtenerEstudiante(id);
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

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
      dependencias.FormDialog({
        formId:
          'editarEstudianteForm',

        title:
          acciones.esAsistenteActivo()
            ? 'Proponer actualización de estudiante'
            : 'Editar estudiante',

        description:
          acciones.esAsistenteActivo()
            ? 'El coordinador debe aprobar esta propuesta antes de aplicar los cambios.'
            : 'Actualice la información personal del estudiante.',

        errorId:
          'editarEstudianteError',

        cancelButtonId:
          'cancelarEditarEstudiante',

        submitButtonId:
          'guardarEstudianteButton',

        submitText:
          acciones.esAsistenteActivo()
            ? 'Enviar propuesta'
            : 'Guardar cambios',

        body: `
          <label>
            <span>Cédula</span>
            <input
              id="editarCedula"
              type="text"
              maxlength="30"
              value="${dependencias.escapeHtml(
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
              value="${dependencias.escapeHtml(
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
              value="${dependencias.escapeHtml(
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
              value="${dependencias.escapeHtml(
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
              value="${dependencias.escapeHtml(
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
              value="${dependencias.escapeHtml(
                estudiante.telefono || ''
              )}"
            >
          </label>
        `
      });

    dependencias.renderizarIconos();

    configurarTamanoDialog(dialog, 'md');

    dialog.showModal();

    dependencias.habilitarCierreExterior(
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
              await (acciones.esAsistenteActivo()
                ? dependencias.proponerActualizarEstudiante
                : dependencias.actualizarEstudiante)(
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
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

            if (!respuesta?.ok) {
              throw new Error(
                respuesta?.message ||
                'No fue posible actualizar el estudiante.'
              );
            }

            dialog.close();

            dependencias.mostrarExito({
              titulo:
                acciones.esAsistenteActivo()
                  ? 'Propuesta enviada'
                  : 'Estudiante actualizado',
              mensaje:
                acciones.esAsistenteActivo()
                  ? 'La actualización quedó pendiente de aprobación.'
                  : 'La información se actualizó correctamente.'
            });

            await acciones.cargarEstudiantes(
              estado.instanciaActual
            );
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
          } catch (error) {
      if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
            dependencias.mostrarError({
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
      if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
    dependencias.mostrarError({
      titulo:
        'No fue posible editar el estudiante',
      mensaje:
        error?.message ||
        'Ocurrió un error al consultar la información.'
    });
  }
}



async function abrirNuevoEstudiante() {
  const instanciaOperacion = estado.instanciaActual;
  const versionOperacion = ++estado.versionDialog;
  if (!estado.carreraSeleccionada || !estado.planSeleccionado) {
    dependencias.mostrarError({
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
      await acciones.listarPeriodosParaEstudiantes();
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

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
              ${dependencias.escapeHtml(
                item.codigo ||
                item.nombre
              )}
            </option>
          `
        )
        .join('');

    content.innerHTML =
      dependencias.FormDialog({
        formId:
          'nuevoEstudianteForm',

        title:
          'Nuevo estudiante',

        description:
          acciones.esAsistenteActivo()
            ? 'La propuesta quedará pendiente hasta que la apruebe su coordinador.'
            : 'Registre los datos personales y académicos iniciales.',

        errorId:
          'nuevoEstudianteError',

        cancelButtonId:
          'cancelarNuevoEstudiante',

        submitButtonId:
          'crearEstudianteButton',

        submitText:
          acciones.esAsistenteActivo()
            ? 'Enviar solicitud de creación'
            : 'Crear estudiante',

        body: `
          <label>
            <span>Carrera</span>
            <input
              type="text"
              value="${dependencias.escapeHtml(estado.carreraSeleccionada.nombre)}"
              readonly
            >
          </label>

          <label>
            <span>Plan de estudio</span>
            <input
              type="text"
              value="${dependencias.escapeHtml(estado.planSeleccionado.nombre || estado.planSeleccionado.codigo)}"
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

    dependencias.renderizarIconos();

    configurarTamanoDialog(dialog, 'md');

    dialog.showModal();

    dependencias.habilitarCierreExterior(dialog);

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
            const esAsistente = acciones.esAsistenteActivo();
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
                  estado.carreraSeleccionada.id,

                planEstudioId:
                  estado.planSeleccionado.id,

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
              ? await dependencias.proponerCrearEstudiante(datosEstudiante)
              : await dependencias.crearEstudiante(datosEstudiante);
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

            if (!resultado?.ok) {
              throw new Error(
                resultado?.message ||
                'No fue posible crear el estudiante.'
              );
            }

            dialog.close();

            dependencias.mostrarExito({
              titulo:
                esAsistente ? 'Solicitud enviada' : 'Estudiante creado',
              mensaje:
                esAsistente
                  ? 'La propuesta está pendiente de aprobación. Los datos oficiales aún no cambiaron.'
                  : 'El estudiante fue registrado correctamente.'
            });

            if (!esAsistente) await acciones.cargarEstudiantes(estado.instanciaActual, true);
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
          } catch (error) {
      if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
            dependencias.mostrarError({
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
      if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
    dependencias.mostrarError({
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
  const instanciaOperacion = estado.instanciaActual;
  const versionOperacion = ++estado.versionDialog;
  const resultado =
    await dependencias.obtenerEstudiante(id);
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

  if (!resultado?.ok) {
    dependencias.mostrarError({
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
    dependencias.FormDialog({
      formId:
        'cambiarEstadoEstudianteForm',

      title:
        acciones.esAsistenteActivo()
          ? 'Proponer cambio de estado'
          : 'Cambiar estado',

      description:
        dependencias.obtenerNombreCompleto(
          estudiante
        ),

      cancelButtonId:
        'cancelarCambioEstado',

      submitButtonId:
        'guardarEstadoEstudiante',

      submitText:
        acciones.esAsistenteActivo()
          ? 'Enviar propuesta'
          : 'Cambiar estado',

      body: `
        <label class="sgpa-form-wide">
          <span>Nuevo estado</span>

          <select
            id="nuevoEstadoEstudiante"
            required
          >
            ${dependencias.ESTADOS
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

  dependencias.renderizarIconos();
  configurarTamanoDialog(dialog, 'md');
  dialog.showModal();
  dependencias.habilitarCierreExterior(dialog);

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
          await dependencias.confirmarAccion({
            titulo:
              'Confirmar cambio de estado',

            mensaje:
              `${acciones.esAsistenteActivo() ? 'Se solicitará cambiar el estado' : 'El estudiante pasará'} de ${dependencias.formatearEstado(
                estudiante.estado
              )} a ${dependencias.formatearEstado(
                estado
              )}.`,

            textoConfirmar:
              'Cambiar estado',

            peligro:
              estado === 'RETIRADO'
          });
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

        if (!confirmado) return;

        try {
          const respuesta =
            await (acciones.esAsistenteActivo()
              ? dependencias.proponerEstadoEstudiante
              : dependencias.cambiarEstadoEstudiante)(
              id,
              estado
            );
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

          if (!respuesta?.ok) {
            throw new Error(
              respuesta?.message ||
              'No fue posible cambiar el estado.'
            );
          }

          dialog.close();

          dependencias.mostrarExito({
            titulo:
              acciones.esAsistenteActivo()
                ? 'Propuesta enviada'
                : 'Estado actualizado',
            mensaje:
              acciones.esAsistenteActivo()
                ? 'El cambio de estado quedó pendiente de aprobación.'
                : 'El estado del estudiante se actualizó correctamente.'
          });

          await acciones.cargarEstudiantes(
            estado.instanciaActual
          );
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
        } catch (error) {
      if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
          dependencias.mostrarError({
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
  const instanciaOperacion = estado.instanciaActual;
  const versionOperacion = ++estado.versionDialog;
  try {
    const [
      resultadoEstudiante,
      resultadoPlanes,
      resultadoPeriodos
    ] =
      await Promise.all([
        dependencias.obtenerEstudiante(id),
        acciones.listarPlanesParaEstudiantes(),
        acciones.listarPeriodosParaEstudiantes()
      ]);
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

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
      dependencias.esPeriodoIgualOPosterior(periodo, estudiante.periodoIngreso)
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
      dependencias.FormDialog({
        formId:
          'cambiarPlanEstudianteForm',

        title:
          'Cambiar plan de estudio',

        description:
          dependencias.obtenerNombreCompleto(
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
                      ${dependencias.escapeHtml(
                        plan.codigo
                      )}
                      -
                      ${dependencias.escapeHtml(
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
                      ${dependencias.escapeHtml(
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

    dependencias.renderizarIconos();
    configurarTamanoDialog(dialog, 'md');
    dialog.showModal();
    dependencias.habilitarCierreExterior(dialog);

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
              acciones.esAsistenteActivo();
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
              ? await dependencias.proponerCambioPlanEstudiante(id, datosPlan)
              : await dependencias.cambiarPlanEstudiante(id, datosPlan);
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

            if (!respuesta?.ok) {
              throw new Error(
                respuesta?.message ||
                'No fue posible cambiar el plan.'
              );
            }

            dialog.close();

            dependencias.mostrarExito({
              titulo:
                esAsistente ? 'Solicitud enviada' : 'Plan actualizado',
              mensaje:
                esAsistente
                  ? 'La propuesta de cambio de plan fue enviada a su coordinador para revisión.'
                  : 'El cambio de plan se registró correctamente en el historial del estudiante.'
            });

            await acciones.cargarEstudiantes(
              estado.instanciaActual,
              true
            );
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
          } catch (error) {
      if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
            dependencias.mostrarError({
              titulo:
                'No fue posible cambiar el plan',
              mensaje:
                error?.message
            });
          }
        }
      );
  } catch (error) {
      if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
    dependencias.mostrarError({
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
  const instanciaOperacion = estado.instanciaActual;
  const versionOperacion = ++estado.versionDialog;
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
        dependencias.obtenerEstudiante(id),

        dependencias.obtenerHistorialAcademicoEstudiante(
          id
        ),

        dependencias.obtenerHistorialPlanesEstudiante(
          id
        ),

        acciones.listarPeriodosParaEstudiantes()
      ]);
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

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
        dependencias.extraerData(
          resultadoAcademico
        )
      )
        ? dependencias.extraerData(
            resultadoAcademico
          )
        : [];

    const historialPlanes =
      Array.isArray(
        dependencias.extraerData(
          resultadoPlanes
        )
      )
        ? dependencias.extraerData(
            resultadoPlanes
          )
        : [];

    const periodos = (
      Array.isArray(resultadoPeriodos.periodos)
        ? resultadoPeriodos.periodos
        : []
    ).filter((periodo) =>
      dependencias.esPeriodoIgualOPosterior(periodo, estudiante.periodoIngreso)
    );

    content.innerHTML =
      dependencias.FormDialog({
        formId:
          'expedienteEstudianteForm',

        title:
          'Expediente académico',

        description:
          `${dependencias.obtenerNombreCompleto(
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
                        ${dependencias.escapeHtml(
                          dependencias.obtenerTextoPeriodo(
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
            dependencias.usuarioTienePermiso(
              dependencias.PERMISOS.GESTIONAR
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

    dependencias.renderizarIconos();

    configurarTamanoDialog(dialog, 'lg');

    dialog.showModal();

    dependencias.habilitarCierreExterior(
      dialog
    );

    acciones.renderizarHistorialAcademico(
      historialAcademico
    );

    acciones.renderizarHistorialPlanes(
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
          acciones.abrirRegistrarResultadoAcademico(
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
          const respuesta = await dependencias.evaluarGraduacionEstudiante(estudiante.id);
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
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
            <p><strong>Dictamen:</strong> ${dependencias.escapeHtml(evaluacion.dictamen)}</p>
            <p><strong>Créditos aprobados:</strong> ${Number(evaluacion.creditos.aprobadosTotal || 0)} de ${Number(evaluacion.creditos.requeridosTotal || 0)}</p>
            <p><strong>Optativas reconocidas:</strong> ${categorias.map(([nombre, datos]) =>
              `${nombre} ${Number(datos?.aprobadas || 0)}/${Number(datos?.requeridas || 0)}`
            ).join(' · ')}</p>
            ${(evaluacion.motivosBloqueo || []).length
              ? `<ul>${evaluacion.motivosBloqueo.map((motivo) => `<li>${dependencias.escapeHtml(motivo)}</li>`).join('')}</ul>`
              : '<p>Sin requisitos pendientes en la evaluación.</p>'}
          `;
        } catch (error) {
      if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
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

          await acciones.cargarProgresoExpediente(
            id,
            periodoReferenciaId
          );
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
        }
      );
  } catch (error) {
      if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
    dependencias.mostrarError({
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
  const instanciaOperacion = estado.instanciaActual;
  const versionOperacion = ++estado.versionDialog;
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
        dependencias.listarPlanAsignaturas(
          estudiante.planEstudioId
        ),

        acciones.listarPeriodosParaEstudiantes(),
        dependencias.listarOptativas()
      ]);
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

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
      dependencias.esPeriodoIgualOPosterior(periodo, estudiante.periodoIngreso)
    );

    const optativasDisponibles = (resultadoOptativas?.optativas || []).filter((item) =>
      item.activo && item.curso?.activo &&
      (item.tipo !== 'DISCIPLINARIA' || item.carreraOrigenId === estudiante.carreraId)
    );

    content.innerHTML =
      dependencias.FormDialog({
        formId:
          'registrarResultadoAcademicoForm',

        title:
          'Registrar resultado académico',

        description:
          `${dependencias.obtenerNombreCompleto(
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
                      ${dependencias.escapeHtml(
                        dependencias.obtenerTextoAsignatura(
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
                <option value="${item.id}">${dependencias.escapeHtml(item.curso.codigo)} · ${dependencias.escapeHtml(item.curso.nombre)} (${dependencias.escapeHtml(item.tipo)})</option>
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
                      ${dependencias.escapeHtml(
                        dependencias.obtenerTextoPeriodo(
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

              ${dependencias.RESULTADOS_ACADEMICOS
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

              ${dependencias.ORIGENES_ACADEMICOS
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

    dependencias.renderizarIconos();

    configurarTamanoDialog(dialog, 'md');

    document
      .getElementById(
        'cancelarResultadoAcademico'
      )
      ?.addEventListener(
        'click',
        async () => {
          dialog.close();

          await acciones.abrirExpedienteEstudiante(
            estudiante.id
          );
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
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
              acciones.esAsistenteActivo();
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
              ? await dependencias.proponerResultadoEstudiante(estudiante.id, datosResultado)
              : await dependencias.registrarResultadoAcademicoEstudiante(
                  estudiante.id,
                  datosResultado,
                );
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
        if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;

            if (!respuesta?.ok) {
              throw new Error(
                respuesta?.message ||
                'No fue posible registrar el resultado.'
              );
            }

            dialog.close();

            dependencias.mostrarExito({
              titulo:
                esAsistente ? 'Solicitud enviada' : 'Resultado registrado',
              mensaje:
                esAsistente
                  ? 'La propuesta de resultado académico fue enviada a su coordinador para revisión.'
                  : 'El resultado académico fue registrado correctamente en el expediente.'
            });

            await acciones.abrirExpedienteEstudiante(
              estudiante.id
            );
          } catch (error) {
      if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
            dependencias.mostrarError({
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
      if (!esContextoVigente(instanciaOperacion, versionOperacion)) return;
    dependencias.mostrarError({
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
  const instanciaOperacion = estado.instanciaActual;
  const versionOperacion = ++estado.versionDialog;
  const versionProgreso = ++estado.versionProgreso;
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
      await dependencias.obtenerProgresoEstudiante(
        estudianteId,
        periodoReferenciaId
      );
        if (
          !esContextoVigente(instanciaOperacion, versionOperacion) ||
          versionProgreso !== estado.versionProgreso
        ) return;

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
        'No fue posible calcular el progreso.'
      );
    }

    acciones.renderizarProgresoEstudiante(
      dependencias.extraerData(resultado)
    );
  } catch (error) {
      if (
        !esContextoVigente(instanciaOperacion, versionOperacion) ||
        versionProgreso !== estado.versionProgreso
      ) return;
    contenedor.innerHTML = `
      <div class="sgpa-table-empty">
        ${dependencias.escapeHtml(
          error?.message ||
          'No fue posible calcular el progreso para este período.'
        )}
      </div>
    `;

    dependencias.mostrarError({
      titulo:
        'No fue posible calcular el progreso',

      mensaje:
        error?.message ||
        'Revise el período de referencia seleccionado.'
    });
  }
}

 return {
 renderizarHistorialAcademico,
 renderizarHistorialPlanes,
 renderizarProgresoEstudiante,
 abrirDetalleEstudiante,
 abrirEditarEstudiante,

 abrirNuevoEstudiante,
 abrirCambiarEstadoEstudiante,
 abrirCambiarPlanEstudiante,
 abrirExpedienteEstudiante,
 abrirRegistrarResultadoAcademico,
 cargarProgresoExpediente
 };
}
