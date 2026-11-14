import { dependencias } from './estudiantes.dependencies.js';

export function crearEstudiantesSolicitudes({ estado, acciones }) {
function contextoBandejaVigente(instancia, carreraId, planId) {
  return instancia === estado.instanciaActual &&
    carreraId === estado.carreraSeleccionada?.id &&
    planId === estado.planSeleccionado?.id &&
    estado.vistaActual === 'ESTUDIANTES';
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
  const puedeResolver = dependencias.obtenerRolActivo() !== dependencias.ROLES.ASISTENTE_ESTUDIANTIL &&
    dependencias.usuarioTienePermiso(dependencias.PERMISOS.GESTIONAR);
  const pendientes = new Set(['PENDIENTE', 'REQUIERE_REVISION', 'DEVUELTO_PARA_CORRECCION']);
  const seleccionables = estado.registrosBandejaRevision.filter((registro) => pendientes.has(registro.estado));
  const filas = estado.registrosBandejaRevision.map((registro) => `
    <tr>
      <td>${puedeResolver && pendientes.has(registro.estado)
        ? `<input type="checkbox" data-revision-select="${registro.id}" ${estado.seleccionBandejaRevision.has(registro.id) ? 'checked' : ''} aria-label="Seleccionar registro ${registro.id}">`
        : ''}</td>
      <td><strong>${dependencias.escapeHtml(registro.cedula || '—')}</strong><br>${dependencias.escapeHtml(registro.nombreCompleto || '—')}</td>
      <td>${dependencias.escapeHtml(registro.fuente || '—')}</td>
      <td>${dependencias.escapeHtml(registro.accion || '—')}</td>
      <td>${dependencias.escapeHtml(dependencias.formatearTextoEnum(registro.estado))}</td>
      <td><button type="button" class="sgpa-button sgpa-button-secondary sgpa-button-sm" data-revision-detalle="${registro.id}">Ver detalle</button></td>
    </tr>
  `).join('');
  contenedor.innerHTML = `
    <p class="estudiantes-revision-resumen">${estado.registrosBandejaRevision.length} registro(s) encontrados.</p>
    ${puedeResolver && seleccionables.length ? `
      <div class="sgpa-toolbar-actions estudiantes-revision-acciones">
        <button type="button" class="sgpa-button sgpa-button-secondary sgpa-button-sm" id="revisionSeleccionarTodos">Seleccionar visibles</button>
        <button type="button" class="sgpa-button sgpa-button-primary sgpa-button-sm" id="revisionAprobar" ${estado.seleccionBandejaRevision.size ? '' : 'disabled'}>Aprobar (${estado.seleccionBandejaRevision.size})</button>
        <button type="button" class="sgpa-button sgpa-button-secondary sgpa-button-sm" id="revisionRechazar" ${estado.seleccionBandejaRevision.size ? '' : 'disabled'}>Rechazar</button>
        <button type="button" class="sgpa-button sgpa-button-secondary sgpa-button-sm" id="revisionDevolver" ${estado.seleccionBandejaRevision.size ? '' : 'disabled'}>Devolver para corrección</button>
      </div>` : ''}
    ${dependencias.DataTable({
      columns: ['', 'Estudiante', 'Fuente', 'Acción', 'Estado', 'Detalle'],
      rows: filas,
      emptyMessage: 'No hay registros de revisión para estos filtros.',
      ariaLabel: 'Bandeja de revisión de estudiantes',
    })}
  `;
  dependencias.renderizarIconos();
}

async function cargarBandejaRevision(carreraId, planEstudioId) {
  const instancia = estado.instanciaActual;
  const version = ++estado.versionBandeja;
  const contenedor = document.getElementById('bandejaRevisionContent');
  if (!contenedor || !carreraId || !planEstudioId) return;
  contenedor.innerHTML = '<div class="sgpa-state-message">Cargando revisión...</div>';
  try {
    const respuesta = await dependencias.listarBandejaRevisionEstudiantes(acciones.filtrosBandejaRevision(carreraId, planEstudioId));
    if (
      instancia !== estado.instanciaActual ||
      version !== estado.versionBandeja ||
      estado.carreraSeleccionada?.id !== carreraId ||
      estado.planSeleccionado?.id !== planEstudioId ||
      estado.vistaActual !== 'ESTUDIANTES'
    ) return;
    if (respuesta?.ok === false) throw new Error(respuesta.message || 'No fue posible consultar la bandeja.');
    const datos = dependencias.extraerData(respuesta);
    estado.registrosBandejaRevision = Array.isArray(datos) ? datos : [];
    estado.seleccionBandejaRevision = new Set();
    acciones.renderizarBandejaRevision();
  } catch (error) {
    if (
      instancia !== estado.instanciaActual ||
      version !== estado.versionBandeja ||
      estado.carreraSeleccionada?.id !== carreraId ||
      estado.planSeleccionado?.id !== planEstudioId ||
      estado.vistaActual !== 'ESTUDIANTES'
    ) return;

    contenedor.innerHTML = `<div class="sgpa-state-message sgpa-state-message-error" role="alert">${dependencias.escapeHtml(error?.message || 'No fue posible consultar la bandeja.')}</div>`;
  }
}

function pedirMotivoRevision(titulo) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('estudianteDialog');
    const content = document.getElementById('estudianteDialogContent');
    if (!dialog || !content) return resolve(null);
    content.innerHTML = dependencias.FormDialog({
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
    dependencias.renderizarIconos();
    dialog.showModal();
    dependencias.habilitarCierreExterior(dialog);
  });
}

async function mostrarDetalleRevision(id) {
  const instancia = estado.instanciaActual;
  const versionDialog = ++estado.versionDialog;
  try {
    const respuesta = await dependencias.obtenerRegistroRevisionEstudiante(id);
    if (instancia !== estado.instanciaActual || versionDialog !== estado.versionDialog) return;
    if (respuesta?.ok === false) throw new Error(respuesta.message);
    const datos = dependencias.extraerData(respuesta) || {};
    const registro = datos.registro || {};
    const items = (valor) => Array.isArray(valor) && valor.length
      ? valor.map((item) => `<li>${dependencias.escapeHtml(typeof item === 'string' ? item : JSON.stringify(item))}</li>`).join('')
      : '<li>Ninguno</li>';
    const dialog = document.getElementById('estudianteDialog');
    const content = document.getElementById('estudianteDialogContent');
    if (!dialog || !content) return;
    content.innerHTML = dependencias.FormDialog({
      formId: 'revisionDetalleForm', title: `Revisión #${id}`,
      description: `${registro.cedula || ''} · ${registro.estado || ''}`,
      layout: 'custom', cancelButtonId: 'revisionDetalleCerrar', cancelText: 'Cerrar',
      body: `<p><strong>Acción:</strong> ${dependencias.escapeHtml(registro.accion || '—')}</p>
        <p><strong>Estudiante actual:</strong> ${dependencias.escapeHtml(datos.estudianteActual ? dependencias.obtenerNombreCompleto(datos.estudianteActual) : 'Nuevo registro')}</p>
        <h3>Cambios propuestos</h3><ul>${items(datos.cambiosPropuestos)}</ul>
        <h3>Asignaturas aprobadas</h3><ul>${items(datos.aprobacionesPropuestas)}</ul>
        <h3>Errores de validación</h3><ul>${items(datos.erroresValidacion)}</ul>`,
    });
    acciones.configurarTamanoDialog(dialog, 'md');
    content.querySelector('#revisionDetalleCerrar')?.addEventListener('click', () => dialog.close());
    dialog.showModal();
    dependencias.habilitarCierreExterior(dialog);
  } catch (error) {
    if (instancia !== estado.instanciaActual || versionDialog !== estado.versionDialog) return;
    dependencias.mostrarError({ titulo: 'No fue posible abrir el registro', mensaje: error?.message || 'Error de consulta.' });
  }
}

function configurarBandejaRevision() {
  const seccion = document.querySelector('#estudiantesNavegacion .estudiantes-revision');
  if (!seccion) return;
  const instancia = estado.instanciaActual;
  const carreraId = estado.carreraSeleccionada?.id;
  const planId = estado.planSeleccionado?.id;
  const actualizar = () => acciones.cargarBandejaRevision(estado.carreraSeleccionada?.id, estado.planSeleccionado?.id);
  seccion.querySelector('#tabNavBandejaRevision')?.addEventListener('click', () => {
    seccion.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    actualizar();
  });
  for (const id of ['bandejaRevisionFuente', 'bandejaRevisionEstado']) {
    seccion.querySelector(`#${id}`)?.addEventListener('change', actualizar);
  }
  seccion.querySelector('#bandejaRevisionTexto')?.addEventListener('input', () => {
    if (estado.timerBandeja !== null) clearTimeout(estado.timerBandeja);
    estado.timerBandeja = setTimeout(() => {
      estado.timerBandeja = null;
      if (contextoBandejaVigente(instancia, carreraId, planId)) actualizar();
    }, 300);
  });
  seccion.addEventListener('change', (event) => {
    const id = Number(event.target?.dataset?.revisionSelect);
    if (!id) return;
    if (event.target.checked) estado.seleccionBandejaRevision.add(id);
    else estado.seleccionBandejaRevision.delete(id);
    acciones.renderizarBandejaRevision();
  });
  seccion.addEventListener('click', async (event) => {
    if (!contextoBandejaVigente(instancia, carreraId, planId)) return;
    const detalleId = Number(event.target.closest('[data-revision-detalle]')?.dataset.revisionDetalle);
    if (detalleId) return acciones.mostrarDetalleRevision(detalleId);
    if (event.target.closest('#revisionSeleccionarTodos')) {
      estado.seleccionBandejaRevision = new Set(estado.registrosBandejaRevision
        .filter((r) => ['PENDIENTE', 'REQUIERE_REVISION', 'DEVUELTO_PARA_CORRECCION'].includes(r.estado))
        .map((r) => r.id));
      acciones.renderizarBandejaRevision();
      return;
    }
    const accion = event.target.closest('#revisionAprobar, #revisionRechazar, #revisionDevolver')?.id;
    if (!accion || !estado.seleccionBandejaRevision.size) return;
    const ids = [...estado.seleccionBandejaRevision];
    const confirmado = await dependencias.confirmarAccion({
      titulo: 'Confirmar revisión', mensaje: `Se procesarán ${ids.length} registro(s).`,
      textoConfirmar: 'Continuar', peligro: accion === 'revisionRechazar',
    });
    if (!confirmado) return;
    try {
      let respuesta;
      if (accion === 'revisionAprobar') respuesta = await dependencias.aprobarRegistrosRevision(ids);
      else {
        const motivo = await acciones.pedirMotivoRevision(accion === 'revisionRechazar' ? 'Motivo de rechazo' : 'Motivo de devolución');
        if (!motivo) return;
        respuesta = accion === 'revisionRechazar'
          ? await dependencias.rechazarRegistrosRevision(ids.map((id) => ({ id, motivo })))
          : await dependencias.devolverRegistrosRevision(ids, motivo);
      }
      if (!contextoBandejaVigente(instancia, carreraId, planId)) return;
      if (respuesta?.ok === false) throw new Error(respuesta.message);
      const datos = dependencias.extraerData(respuesta) || {};
      const fallidos = datos.fallidos || [];
      if (fallidos.length) dependencias.mostrarAdvertencia({
        titulo: 'Revisión parcial', mensaje: `${fallidos.length} registro(s) no se procesaron: ${fallidos.map((f) => `#${f.id}: ${f.error}`).join('; ')}`,
      });
      else dependencias.mostrarExito({ titulo: 'Revisión guardada', mensaje: 'Los registros seleccionados se procesaron correctamente.' });
      await actualizar();
      await acciones.cargarEstudiantes(estado.instanciaActual, true);
    } catch (error) {
      dependencias.mostrarError({ titulo: 'No fue posible completar la revisión', mensaje: error?.message || 'Error de conexión.' });
    }
  });
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
    acciones.obtenerDatosSolicitud(
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
      `${estado.solicitudesFormularios.length} pendiente${
        estado.solicitudesFormularios.length === 1
          ? ''
          : 's'
      }`;
  }

  const puedeGestionar =
    !acciones.esAsistenteActivo() && dependencias.usuarioTienePermiso(
      dependencias.PERMISOS.GESTIONAR
    );

  const rows =
    estado.solicitudesFormularios
      .map((solicitud) => {
        const datos =
          acciones.obtenerDatosSolicitud(
            solicitud
          );

        const formulario =
          solicitud.formulario ?? {};

        return `
          <tr>
            <td>
              ${dependencias.escapeHtml(
                acciones.obtenerNombreSolicitud(
                  solicitud
                )
              )}
            </td>

            <td>
              ${dependencias.escapeHtml(
                datos.identificacion ||
                '—'
              )}
            </td>

            <td>
              ${dependencias.escapeHtml(
                datos.correoEstudiantil ||
                '—'
              )}
            </td>

            <td>
              ${dependencias.escapeHtml(
                formulario.titulo ||
                '—'
              )}
            </td>

            <td>
              ${dependencias.escapeHtml(
                formulario.carrera?.codigo ||
                formulario.carrera?.nombre ||
                '—'
              )}
            </td>

            <td>
              ${dependencias.escapeHtml(
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
              ${dependencias.StatusBadge({
                label: solicitud.estado || '—',
                tone: dependencias.obtenerTonoEstadoSolicitud(
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
    dependencias.DataTable({
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

  dependencias.renderizarIconos();
}

async function cargarSolicitudesFormularios(
  instancia,
  mostrarErrores = true
) {
  const version = ++estado.versionSolicitudes;
  const carreraId = estado.carreraSeleccionada?.id;
  const planId = estado.planSeleccionado?.id;
  if (
    estado.vistaActual !== 'ESTUDIANTES' ||
    !estado.carreraSeleccionada ||
    !estado.planSeleccionado
  ) {
    estado.solicitudesFormularios = [];
    acciones.renderizarSolicitudesFormularios();
    return;
  }

  try {
    const resultado =
      await dependencias.listarSolicitudesFormularios({
        carreraId:
          estado.carreraSeleccionada.id,
        planEstudioId:
          estado.planSeleccionado.id
      });

    if (
      instancia !== estado.instanciaActual ||
      version !== estado.versionSolicitudes ||
      carreraId !== estado.carreraSeleccionada?.id ||
      planId !== estado.planSeleccionado?.id ||
      estado.vistaActual !== 'ESTUDIANTES'
    ) return;

    if (
      instancia !==
      estado.instanciaActual
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
      dependencias.extraerData(resultado);

    estado.solicitudesFormularios =
      Array.isArray(datos)
        ? datos
        : [];

    acciones.renderizarSolicitudesFormularios();
  } catch (error) {
    if (
      instancia !== estado.instanciaActual ||
      version !== estado.versionSolicitudes ||
      carreraId !== estado.carreraSeleccionada?.id ||
      planId !== estado.planSeleccionado?.id ||
      estado.vistaActual !== 'ESTUDIANTES'
    ) return;

    if (mostrarErrores) {
      dependencias.mostrarError({
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
    estado.solicitudesFormularios.find(
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
      acciones.abrirDetalleSolicitud(
        solicitud
      );
      break;

    case 'aceptar':
      await acciones.aceptarSolicitud(
        solicitud
      );
      break;

    case 'rechazar':
      acciones.abrirRechazarSolicitud(
        solicitud
      );
      break;
  }
}

async function aceptarSolicitud(
  solicitud
) {
  const instancia = estado.instanciaActual;
  const carreraId = estado.carreraSeleccionada?.id;
  const planId = estado.planSeleccionado?.id;
  const confirmado =
    await dependencias.confirmarAccion({
      titulo:
        'Aceptar solicitud',

      mensaje:
        `Se incorporará a ${acciones.obtenerNombreSolicitud(
          solicitud
        )} al padrón de estudiantes utilizando la carrera y el plan asociados al formulario.`,

      textoConfirmar:
        'Aceptar solicitud',

      peligro:
        false
    });

  if (!contextoBandejaVigente(instancia, carreraId, planId)) return;

  if (!confirmado) {
    return;
  }

  try {
    const resultado =
      await dependencias.aceptarSolicitudFormulario(
        solicitud.id
      );

    if (!contextoBandejaVigente(instancia, carreraId, planId)) return;

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
        'No fue posible aceptar la solicitud.'
      );
    }

    dependencias.mostrarExito({
      titulo:
        'Solicitud aceptada',

      mensaje:
        'La información fue incorporada correctamente al módulo de estudiantes.'
    });

    await Promise.all([
      acciones.cargarSolicitudesFormularios(
        estado.instanciaActual,
        false
      ),

      acciones.cargarEstudiantes(
        estado.instanciaActual,
        true
      )
    ]);
  } catch (error) {
    if (!contextoBandejaVigente(instancia, carreraId, planId)) return;
    dependencias.mostrarError({
      titulo:
        'No fue posible aceptar la solicitud',

      mensaje:
        error?.message ||
        'La solicitud requiere revisión antes de poder incorporarse.'
    });

    await acciones.cargarSolicitudesFormularios(
      estado.instanciaActual,
      false
    );
  }
}

function abrirRechazarSolicitud(
  solicitud
) {
  const instancia = estado.instanciaActual;
  const versionDialog = ++estado.versionDialog;
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
    dependencias.FormDialog({
      formId:
        'rechazarSolicitudFormularioForm',

      title:
        'Rechazar solicitud',

      description:
        acciones.obtenerNombreSolicitud(
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

  dependencias.renderizarIconos();

  configurarTamanoDialog(dialog, 'md');

  dialog.showModal();

  dependencias.habilitarCierreExterior(
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
          dependencias.mostrarAdvertencia({
            titulo: 'Motivo obligatorio',
            mensaje: 'El motivo de rechazo es obligatorio y no puede consistir únicamente en espacios en blanco.'
          });
          return;
        }

        const longitudMotivo = dependencias.calcularLongitudTexto(motivo);
        if (longitudMotivo > 500) {
          dependencias.mostrarAdvertencia({
            titulo: 'Límite de caracteres excedido',
            mensaje: `El motivo de rechazo no puede superar los 500 caracteres (longitud ingresada: ${longitudMotivo}).`
          });
          return;
        }

        try {
          const resultado =
            await dependencias.rechazarSolicitudFormulario(
              solicitud.id,
              motivo
            );

          if (instancia !== estado.instanciaActual || versionDialog !== estado.versionDialog) return;

          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
              'No fue posible rechazar la solicitud.'
            );
          }

          dialog.close();

          dependencias.mostrarExito({
            titulo:
              'Solicitud rechazada',

            mensaje:
              'La respuesta fue descartada del proceso de ingreso.'
          });

          await acciones.cargarSolicitudesFormularios(
            estado.instanciaActual,
            false
          );
        } catch (error) {
          if (instancia !== estado.instanciaActual || versionDialog !== estado.versionDialog) return;
          dependencias.mostrarError({
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
    acciones.obtenerDatosSolicitud(
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
    dependencias.FormDialog({
      formId:
        'detalleSolicitudForm',

      title:
        'Detalle de la solicitud',

      description:
        acciones.obtenerNombreSolicitud(
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
            value="${dependencias.escapeHtml(
              acciones.obtenerNombreSolicitud(
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
            value="${dependencias.escapeHtml(
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
            value="${dependencias.escapeHtml(
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
            value="${dependencias.escapeHtml(
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
            value="${dependencias.escapeHtml(
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
            value="${dependencias.escapeHtml(
              carreraTexto
            )}"
            readonly
          >
        </label>

        <label>
          <span>Plan de estudio (del formulario)</span>
          <input
            type="text"
            value="${dependencias.escapeHtml(
              planTexto
            )}"
            readonly
          >
        </label>

        <label>
          <span>Estado de la solicitud</span>
          <input
            type="text"
            value="${dependencias.escapeHtml(
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
            value="${dependencias.escapeHtml(
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
                  value="${dependencias.escapeHtml(
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
                >${dependencias.escapeHtml(solicitud.motivoRechazo)}</textarea>
              </label>
              ${
                solicitud.revisadoPor || solicitud.revisadoAt
                  ? `
                    <label class="sgpa-form-wide">
                      <span>Revisión</span>
                      <input
                        type="text"
                        value="${dependencias.escapeHtml(
                          [
                            solicitud.revisadoPor?.nombreCompleto || solicitud.revisadoPor?.email || '',
                            solicitud.revisadoAt ? dependencias.formatearFechaHora(solicitud.revisadoAt) : ''
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
                >${dependencias.escapeHtml(
                  solicitud.detalleError
                )}</textarea>
              </label>
            `
            : ''
        }
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
      'cerrarDetalleSolicitud'
    )
    ?.addEventListener(
      'click',
      () => dialog.close()
    );
}

 return {
 filtrosBandejaRevision,
 renderizarBandejaRevision,
 cargarBandejaRevision,
 pedirMotivoRevision,
 mostrarDetalleRevision,
 configurarBandejaRevision,
 obtenerDatosSolicitud,
 obtenerNombreSolicitud,
 renderizarSolicitudesFormularios,
 cargarSolicitudesFormularios,
 manejarAccionSolicitud,
 aceptarSolicitud,
 abrirRechazarSolicitud,
 abrirDetalleSolicitud
 };
}
