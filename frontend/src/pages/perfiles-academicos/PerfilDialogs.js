/**
 * SGPA — Diálogos de edición, áreas, requisitos, cursos habilitados y cambio de estado de Perfiles Académicos.
 * FRONTEND-ORDER-003
 */

import {
  actualizarPerfil,
  asociarCursoPerfil,
  cambiarEstadoPerfil,
  crearPerfil,
  desasociarCursoPerfil,
  guardarAreasPerfil,
  guardarRequisitosPerfil,
  listarCursosPerfil,
} from '../../services/perfiles-academicos.service.js';
import { listarCursos } from '../../services/cursos.service.js';
import { DataTable } from '../../components/DataTable.js';
import { FormDialog } from '../../components/FormDialog.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  TIPOS_REQUISITO_PERFIL,
  encontrarDuplicadoEnLineas,
  extraerLineasTexto,
  filtrarCursosPerfilPorBusqueda,
  formatearEtiquetaTipo,
  obtenerCursosCarreraOrdenados,
} from './perfiles-academicos.helpers.js';

function abrirDialogo(contenido) {
  const dialog = document.getElementById('perfilAcademicoDialog');
  const host = document.getElementById('perfilAcademicoDialogContent');
  if (!dialog || !host) return null;
  host.innerHTML = contenido;
  dialog.showModal();
  renderizarIconos();
  return dialog;
}

function cerrarDialogo() {
  document.getElementById('perfilAcademicoDialog')?.close();
}

function campo(etiqueta, id, valor, placeholder = '', tipo = 'text') {
  return `<label class="sgpa-form-field"><span>${escapeHtml(etiqueta)}</span><input id="${id}" type="${tipo}" value="${escapeHtml(valor || '')}" placeholder="${escapeHtml(placeholder)}"></label>`;
}

function validarLineasUnicas(elementos, nombre) {
  const duplicado = encontrarDuplicadoEnLineas(elementos);
  if (duplicado) {
    mostrarError({
      titulo: `${nombre} duplicada`,
      mensaje: `La entrada "${duplicado}" está repetida.`,
    });
    return false;
  }
  return true;
}

function operacionVigente(controlOperacion) {
  return controlOperacion?.esVigente?.() === true;
}

function reservar(controlOperacion, clave) {
  if (!operacionVigente(controlOperacion)) return null;
  return controlOperacion.reservar?.(clave) || null;
}

function liberar(controlOperacion, clave, token) {
  controlOperacion?.liberar?.(clave, token);
}

function marcarEnviada(controlOperacion, clave, token) {
  return controlOperacion?.marcarEnviada?.(clave, token) === true;
}

async function guardarCambio(
  operacion,
  mensaje,
  dialog,
  onUpdated,
  controlOperacion,
) {
  try {
    const resultado = await operacion();
    if (!operacionVigente(controlOperacion)) return false;
    if (!resultado?.ok) {
      mostrarError({
        titulo: 'No se pudo guardar',
        mensaje: resultado?.message || 'No fue posible actualizar el perfil.',
      });
      return false;
    }
    dialog?.close();
    mostrarExito({ titulo: 'Perfil actualizado', mensaje });
    await onUpdated?.();
    return true;
  } catch (error) {
    if (operacionVigente(controlOperacion)) {
      mostrarError({
        titulo: 'No se pudo guardar',
        mensaje: error?.message || 'No fue posible actualizar el perfil.',
      });
    }
    return false;
  }
}

export async function abrirGestorCursosPerfil({
  perfil,
  controlOperacion,
  onReloadDetail,
}) {
  if (!perfil || !operacionVigente(controlOperacion)) return;

  if (perfil.estructuraEditable === false) {
    mostrarError({
      titulo: 'Configuración bloqueada',
      mensaje:
        'Este perfil ya fue utilizado por profesores y sus cursos habilitados no pueden modificarse.',
    });
    return;
  }

  const [resultadoCatalogo, resultadoAsociados] = await Promise.all([
    listarCursos(),
    listarCursosPerfil(perfil.id),
  ]);

  if (!operacionVigente(controlOperacion)) return;

  if (!resultadoCatalogo?.ok) {
    mostrarError({
      titulo: 'No se pudieron cargar los cursos',
      mensaje:
        resultadoCatalogo?.message ||
        'No fue posible consultar el catálogo de cursos.',
    });
    return;
  }

  if (!resultadoAsociados?.ok) {
    mostrarError({
      titulo: 'No se pudieron cargar los cursos',
      mensaje:
        resultadoAsociados?.message ||
        'No fue posible consultar los cursos del perfil.',
    });
    return;
  }

  const catalogo = Array.isArray(resultadoCatalogo.cursos)
    ? resultadoCatalogo.cursos
    : [];
  let relaciones = Array.isArray(resultadoAsociados.data)
    ? resultadoAsociados.data
    : [];
  const cursosCarrera = obtenerCursosCarreraOrdenados(catalogo, perfil.carreraId);

  const body = `
    <div class="sgpa-form-field sgpa-form-field-full">
      <label class="sgpa-search" for="buscarCursoPerfil">
        <i data-lucide="search" aria-hidden="true"></i>
        <input
          id="buscarCursoPerfil"
          type="search"
          placeholder="Buscar por código o nombre..."
          autocomplete="off"
        >
      </label>
    </div>
    <div id="cursosPerfilContent" class="sgpa-form-field-full"></div>
  `;

  abrirDialogo(
    FormDialog({
      formId: 'gestionarCursosPerfilForm',
      title: 'Cursos habilitados',
      description: `${perfil.codigo} · ${perfil.carrera?.nombre || 'Carrera'}`,
      body,
      cancelButtonId: 'cerrarCursosPerfil',
      cancelText: 'Cerrar',
      layout: 'custom',
    }),
  );

  const obtenerIdsAsociados = () =>
    new Set(
      relaciones
        .filter((relacion) => relacion.activo !== false)
        .map((relacion) => Number(relacion.cursoId ?? relacion.curso?.id)),
    );

  const renderizarCursos = () => {
    const host = document.getElementById('cursosPerfilContent');
    if (!host) return;

    const busqueda = document.getElementById('buscarCursoPerfil')?.value || '';
    const asociados = obtenerIdsAsociados();
    const filtrados = filtrarCursosPerfilPorBusqueda(cursosCarrera, busqueda);

    const filas = filtrados
      .map((curso) => {
        const asociado = asociados.has(Number(curso.id));
        return `
          <tr>
            <td><strong>${escapeHtml(curso.codigo)}</strong></td>
            <td>${escapeHtml(curso.nombre)}</td>
            <td>
              ${StatusBadge({
                label: asociado ? 'HABILITADO' : 'DISPONIBLE',
                tone: asociado ? 'success' : 'neutral',
              })}
            </td>
            <td class="sgpa-table-actions-cell">
              <button
                class="sgpa-button ${
                  asociado ? 'sgpa-button-secondary' : 'sgpa-button-primary'
                } sgpa-button-sm"
                type="button"
                data-curso-perfil-id="${curso.id}"
                data-curso-perfil-accion="${asociado ? 'quitar' : 'agregar'}"
              >
                <i data-lucide="${asociado ? 'minus' : 'plus'}" aria-hidden="true"></i>
                ${asociado ? 'Quitar' : 'Agregar'}
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    host.innerHTML = DataTable({
      columns: [
        'Código',
        'Curso',
        'Estado',
        { label: 'Acción', className: 'sgpa-table-actions-cell' },
      ],
      rows: filas,
      emptyMessage: cursosCarrera.length
        ? 'No hay cursos que coincidan con la búsqueda.'
        : 'No hay cursos activos registrados para la carrera de este perfil.',
      ariaLabel: 'Cursos habilitados por el perfil docente',
    });

    renderizarIconos();
  };

  document
    .getElementById('cerrarCursosPerfil')
    ?.addEventListener('click', cerrarDialogo);
  document
    .getElementById('buscarCursoPerfil')
    ?.addEventListener('input', renderizarCursos);

  document
    .getElementById('cursosPerfilContent')
    ?.addEventListener('click', async (event) => {
      const boton = event.target.closest('[data-curso-perfil-id]');
      if (!boton || !operacionVigente(controlOperacion)) return;

      const cursoId = Number(boton.dataset.cursoPerfilId);
      const accion = boton.dataset.cursoPerfilAccion;
      if (!cursoId) return;

      const clave = `curso:${perfil.id}:${cursoId}`;
      const token = reservar(controlOperacion, clave);
      if (!token) return;
      boton.disabled = true;

      try {
        if (!operacionVigente(controlOperacion)) return;
        if (!marcarEnviada(controlOperacion, clave, token)) return;
        const resultado =
          accion === 'agregar'
            ? await asociarCursoPerfil(perfil.id, cursoId)
            : await desasociarCursoPerfil(perfil.id, cursoId);

        if (!operacionVigente(controlOperacion)) return;

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message ||
              'No fue posible modificar los cursos del perfil.',
          );
        }

        const actualizado = await listarCursosPerfil(perfil.id);
        if (!operacionVigente(controlOperacion)) return;
        if (!actualizado?.ok) {
          throw new Error(
            actualizado?.message ||
              'El cambio fue realizado, pero no fue posible actualizar la lista.',
          );
        }

        relaciones = Array.isArray(actualizado.data) ? actualizado.data : [];
        renderizarCursos();
        await onReloadDetail?.(perfil.id);
      } catch (error) {
        if (operacionVigente(controlOperacion)) {
          mostrarError({
            titulo: 'No se pudo modificar el curso',
            mensaje:
              error?.message ||
              'No fue posible modificar los cursos habilitados.',
          });
        }
      } finally {
        liberar(controlOperacion, clave, token);
        boton.disabled = false;
      }
    });

  renderizarCursos();
}

export function abrirNuevoPerfilDialog({
  carreras = [],
  controlOperacion,
  onCreated,
}) {
  if (!operacionVigente(controlOperacion)) return;
  const carrerasActivas = carreras.filter((carrera) => carrera.activo !== false);

  if (!carrerasActivas.length) {
    mostrarError({
      titulo: 'No hay carreras disponibles',
      mensaje:
        'Debe existir al menos una carrera activa antes de crear un perfil docente.',
    });
    return;
  }

  const opcionesCarreras = carrerasActivas
    .map(
      (carrera) => `
        <option value="${carrera.id}">
          ${escapeHtml(
            carrera.codigo
              ? `${carrera.codigo} - ${carrera.nombre}`
              : carrera.nombre,
          )}
        </option>
      `,
    )
    .join('');

  const body = `
    <label class="sgpa-form-field">
      <span>Carrera</span>
      <select id="nuevoPerfilCarrera" required>
        <option value="" disabled selected>Seleccione una carrera...</option>
        ${opcionesCarreras}
      </select>
    </label>

    <label class="sgpa-form-field">
      <span>Código</span>
      <input id="nuevoPerfilCodigo" type="text" maxlength="30" placeholder="Ej. PD-SW" required>
    </label>

    <label class="sgpa-form-field sgpa-form-field-full">
      <span>Nombre del perfil</span>
      <input id="nuevoPerfilNombre" type="text" maxlength="150" placeholder="Ej. Desarrollo de Software" required>
    </label>

    <label class="sgpa-form-field sgpa-form-field-full">
      <span>Descripción</span>
      <textarea id="nuevoPerfilDescripcion" maxlength="500" rows="4" placeholder="Descripción general del perfil docente"></textarea>
    </label>
  `;

  const dialog = abrirDialogo(
    FormDialog({
      formId: 'nuevoPerfilForm',
      title: 'Nuevo perfil docente',
      description: 'Defina el perfil institucional para una carrera.',
      body,
      errorId: 'perfilFormError',
      cancelButtonId: 'cancelarPerfilForm',
      submitButtonId: 'guardarPerfilForm',
      submitText: 'Crear perfil',
    }),
  );

  document
    .getElementById('cancelarPerfilForm')
    ?.addEventListener('click', cerrarDialogo);

  document
    .getElementById('nuevoPerfilForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!operacionVigente(controlOperacion)) return;

      const carreraId = Number(
        document.getElementById('nuevoPerfilCarrera')?.value,
      );
      const codigo =
        document
          .getElementById('nuevoPerfilCodigo')
          ?.value?.trim()
          .toUpperCase() || '';
      const nombre =
        document.getElementById('nuevoPerfilNombre')?.value?.trim() || '';
      const descripcion =
        document.getElementById('nuevoPerfilDescripcion')?.value?.trim() || '';

      if (!carreraId || !codigo || !nombre) {
        mostrarError({
          titulo: 'Datos incompletos',
          mensaje:
            'Seleccione una carrera e indique el código y nombre del perfil.',
        });
        return;
      }

      const boton = document.getElementById('guardarPerfilForm');
      const clave = `crear:${carreraId}:${codigo}`;
      const token = reservar(controlOperacion, clave);
      if (!token) return;
      if (boton) boton.disabled = true;

      try {
        if (!operacionVigente(controlOperacion)) return;
        if (!marcarEnviada(controlOperacion, clave, token)) return;
        const resultado = await crearPerfil({
          carreraId,
          codigo,
          nombre,
          descripcion: descripcion || undefined,
        });

        if (!operacionVigente(controlOperacion)) return;

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || 'No fue posible crear el perfil.',
          );
        }

        dialog?.close();
        mostrarExito({
          titulo: 'Perfil creado',
          mensaje: 'El perfil docente fue creado correctamente.',
        });

        if (operacionVigente(controlOperacion)) {
          await onCreated?.(resultado.data?.id);
        }
      } catch (error) {
        if (operacionVigente(controlOperacion)) {
          mostrarError({
            titulo: 'No se pudo crear el perfil',
            mensaje:
              error?.message || 'No fue posible crear el perfil docente.',
          });
        }
      } finally {
        liberar(controlOperacion, clave, token);
        if (boton) boton.disabled = false;
      }
    });
}

export function abrirEditorPerfilDialog({
  perfil,
  controlOperacion,
  onUpdated,
}) {
  if (!perfil || !operacionVigente(controlOperacion)) return;

  const body = `
    <label class="sgpa-form-field">
      <span>Código</span>
      <input type="text" value="${escapeHtml(perfil.codigo || '')}" disabled>
      <small>El código se define al crear el perfil.</small>
    </label>

    <label class="sgpa-form-field">
      <span>Carrera</span>
      <input type="text" value="${escapeHtml(perfil.carrera?.nombre || '')}" disabled>
      <small>La carrera no puede cambiarse después de crear el perfil.</small>
    </label>

    <label class="sgpa-form-field sgpa-form-field-full">
      <span>Nombre</span>
      <input id="perfilNombre" type="text" maxlength="150" value="${escapeHtml(perfil.nombre || '')}" required>
    </label>

    <label class="sgpa-form-field sgpa-form-field-full">
      <span>Descripción</span>
      <textarea id="perfilDescripcion" maxlength="500" rows="4">${escapeHtml(perfil.descripcion || '')}</textarea>
    </label>

    ${campo('Número de perfil', 'numeroPerfil', perfil.numeroPerfil, 'Opcional')}
    ${campo('Consecutivo', 'consecutivo', perfil.consecutivo, 'Opcional')}
    ${campo('Acuerdo de aprobación', 'acuerdoAprobacion', perfil.acuerdoAprobacion, 'Opcional')}
    ${campo('Fecha de aprobación', 'fechaAprobacion', perfil.fechaAprobacion, '', 'date')}

    <label class="sgpa-form-field">
      <span>Tipo de registro</span>
      <select id="tipoRegistro">
        <option value="">Sin registrar</option>
        <option value="PERFIL_NUEVO" ${perfil.tipoRegistro === 'PERFIL_NUEVO' ? 'selected' : ''}>Perfil nuevo</option>
        <option value="ACTUALIZACION" ${perfil.tipoRegistro === 'ACTUALIZACION' ? 'selected' : ''}>Actualización</option>
      </select>
    </label>
  `;

  const dialog = abrirDialogo(
    FormDialog({
      formId: 'editarPerfilForm',
      title: 'Editar perfil docente',
      description: perfil.codigo,
      body,
      errorId: 'perfilFormError',
      cancelButtonId: 'cancelarPerfilForm',
      submitButtonId: 'guardarPerfilForm',
      submitText: 'Guardar cambios',
    }),
  );

  document
    .getElementById('cancelarPerfilForm')
    ?.addEventListener('click', cerrarDialogo);

  document
    .getElementById('editarPerfilForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!operacionVigente(controlOperacion)) return;

      const nombre =
        document.getElementById('perfilNombre')?.value?.trim() || '';
      if (!nombre) {
        mostrarError({
          titulo: 'Nombre requerido',
          mensaje: 'El perfil debe tener un nombre.',
        });
        return;
      }

      const datos = {
        nombre,
        descripcion:
          document.getElementById('perfilDescripcion')?.value?.trim() || null,
        numeroPerfil:
          document.getElementById('numeroPerfil')?.value?.trim() || null,
        consecutivo:
          document.getElementById('consecutivo')?.value?.trim() || null,
        acuerdoAprobacion:
          document.getElementById('acuerdoAprobacion')?.value?.trim() || null,
        fechaAprobacion:
          document.getElementById('fechaAprobacion')?.value || null,
        tipoRegistro: document.getElementById('tipoRegistro')?.value || null,
      };

      const boton = document.getElementById('guardarPerfilForm');
      const clave = `editar:${perfil.id}`;
      const token = reservar(controlOperacion, clave);
      if (!token) return;
      if (boton) boton.disabled = true;

      try {
        if (!operacionVigente(controlOperacion)) return;
        if (!marcarEnviada(controlOperacion, clave, token)) return;
        const resultado = await actualizarPerfil(perfil.id, datos);
        if (!operacionVigente(controlOperacion)) return;
        if (!resultado?.ok) {
          mostrarError({
            titulo: 'No se pudo actualizar',
            mensaje: resultado?.message || 'No fue posible actualizar el perfil.',
          });
          return;
        }

        dialog?.close();
        mostrarExito({
          titulo: 'Perfil actualizado',
          mensaje:
            'La información del perfil docente fue actualizada correctamente.',
        });

        if (operacionVigente(controlOperacion)) await onUpdated?.();
      } catch (error) {
        if (operacionVigente(controlOperacion)) {
          mostrarError({
            titulo: 'No se pudo actualizar',
            mensaje: error?.message || 'No fue posible actualizar el perfil.',
          });
        }
      } finally {
        liberar(controlOperacion, clave, token);
        if (boton) boton.disabled = false;
      }
    });
}

export async function cambiarEstadoPerfilActual({
  perfil,
  controlOperacion,
  onUpdated,
}) {
  if (!perfil || !operacionVigente(controlOperacion)) return;
  const clave = `estado:${perfil.id}`;
  const token = reservar(controlOperacion, clave);
  if (!token) return;

  try {
    const nuevoEstado = !perfil.activo;
    const accion = nuevoEstado ? 'activar' : 'inactivar';

    const confirmado = await confirmarAccion({
      titulo: nuevoEstado ? 'Activar perfil' : 'Inactivar perfil',
      mensaje: nuevoEstado
        ? `¿Desea activar el perfil "${perfil.nombre}"?`
        : `¿Desea inactivar el perfil "${perfil.nombre}"? Los antecedentes existentes se conservarán, pero el perfil dejará de estar disponible para nuevas solicitudes y no habilitará cursos.`,
      textoConfirmar: nuevoEstado ? 'Activar' : 'Inactivar',
      peligro: !nuevoEstado,
    });

    if (!confirmado || !operacionVigente(controlOperacion)) return;
    if (!marcarEnviada(controlOperacion, clave, token)) return;

    const resultado = await cambiarEstadoPerfil(perfil.id, nuevoEstado);
    if (!operacionVigente(controlOperacion)) return;
    if (!resultado?.ok) {
      mostrarError({
        titulo: `No se pudo ${accion} el perfil`,
        mensaje:
          resultado?.message || `No fue posible ${accion} el perfil docente.`,
      });
      return;
    }

    mostrarExito({
      titulo: nuevoEstado ? 'Perfil activado' : 'Perfil inactivado',
      mensaje: nuevoEstado
        ? 'El perfil vuelve a estar disponible.'
        : 'El perfil quedó inactivo y su historial fue conservado.',
    });

    if (operacionVigente(controlOperacion)) await onUpdated?.();
  } catch (error) {
    if (operacionVigente(controlOperacion)) {
      mostrarError({
        titulo: 'No se pudo cambiar el estado',
        mensaje:
          error?.message || 'No fue posible cambiar el estado del perfil.',
      });
    }
  } finally {
    liberar(controlOperacion, clave, token);
  }
}

export function abrirEditorAreasDialog({
  perfil,
  areasActuales = [],
  controlOperacion,
  onUpdated,
}) {
  if (!operacionVigente(controlOperacion)) return;
  if (perfil?.estructuraEditable === false) {
    mostrarError({
      titulo: 'Configuración bloqueada',
      mensaje:
        'Este perfil ya fue utilizado por profesores y su estructura no puede modificarse.',
    });
    return;
  }

  const disciplinares = areasActuales
    .filter((area) => area.tipo === 'DISCIPLINAR')
    .map((area) => area.descripcion)
    .join('\n');
  const estrategicas = areasActuales
    .filter((area) => area.tipo === 'ESTRATEGICA')
    .map((area) => area.descripcion)
    .join('\n');

  const body = `
    <label class="sgpa-form-field sgpa-form-field-full"><span>Áreas disciplinares</span><textarea id="areasDisciplinares" rows="8" placeholder="Una área por línea">${escapeHtml(disciplinares)}</textarea><small>Escriba una descripción por línea.</small></label>
    <label class="sgpa-form-field sgpa-form-field-full"><span>Áreas estratégicas</span><textarea id="areasEstrategicas" rows="8" placeholder="Una área por línea">${escapeHtml(estrategicas)}</textarea><small>Escriba una descripción por línea.</small></label>
  `;

  const dialog = abrirDialogo(
    FormDialog({
      formId: 'perfilAreasForm',
      title: 'Áreas del perfil',
      description: 'La lista guardada reemplazará la configuración actual.',
      body,
      errorId: 'perfilFormError',
      cancelButtonId: 'cancelarPerfilForm',
      submitButtonId: 'guardarPerfilForm',
    }),
  );

  document
    .getElementById('cancelarPerfilForm')
    ?.addEventListener('click', cerrarDialogo);

  document
    .getElementById('perfilAreasForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!operacionVigente(controlOperacion) || perfil.estructuraEditable === false) return;

      const listaDisciplinares = extraerLineasTexto(
        document.getElementById('areasDisciplinares')?.value,
      );
      const listaEstrategicas = extraerLineasTexto(
        document.getElementById('areasEstrategicas')?.value,
      );

      if (
        !validarLineasUnicas(listaDisciplinares, 'Área disciplinar') ||
        !validarLineasUnicas(listaEstrategicas, 'Área estratégica')
      ) {
        return;
      }

      const areas = [
        ...listaDisciplinares.map((descripcion, indice) => ({
          tipo: 'DISCIPLINAR',
          descripcion,
          orden: indice + 1,
        })),
        ...listaEstrategicas.map((descripcion, indice) => ({
          tipo: 'ESTRATEGICA',
          descripcion,
          orden: indice + 1,
        })),
      ];

      const boton = document.getElementById('guardarPerfilForm');
      const clave = `areas:${perfil.id}`;
      const token = reservar(controlOperacion, clave);
      if (!token) return;
      if (boton) boton.disabled = true;

      try {
        if (
          !(await confirmarAccion({
            titulo: 'Reemplazar áreas',
            mensaje: 'Se sustituirá la lista completa de áreas del perfil.',
            textoConfirmar: 'Guardar áreas',
          }))
        ) {
          return;
        }
        if (
          !operacionVigente(controlOperacion) ||
          perfil.estructuraEditable === false
        ) {
          return;
        }
        if (!marcarEnviada(controlOperacion, clave, token)) return;

        await guardarCambio(
          () => guardarAreasPerfil(perfil.id, areas),
          'Las áreas fueron actualizadas.',
          dialog,
          onUpdated,
          controlOperacion,
        );
      } finally {
        liberar(controlOperacion, clave, token);
        if (boton) boton.disabled = false;
      }
    });
}

function renderizarFilasRequisitos(requisitos) {
  const host = document.getElementById('requisitosEditorRows');
  if (!host) return;
  host.innerHTML = requisitos.length
    ? requisitos
        .map(
          (item, indice) => `
    <article class="perfil-requisito-editor-row" data-requisito-row>
      <select data-campo="tipo" aria-label="Tipo de requisito">${TIPOS_REQUISITO_PERFIL.map(
        (tipo) =>
          `<option value="${tipo}" ${item.tipo === tipo ? 'selected' : ''}>${escapeHtml(formatearEtiquetaTipo(tipo))}</option>`,
      ).join('')}</select>
      <label class="perfil-required-check"><input data-campo="obligatorio" type="checkbox" ${item.obligatorio ? 'checked' : ''}> Obligatorio</label>
      <button class="sgpa-button sgpa-button-secondary sgpa-icon-button" data-quitar-requisito="${indice}" type="button" aria-label="Eliminar"><i data-lucide="trash-2"></i></button>
      <textarea data-campo="descripcion" rows="3" placeholder="Descripción del requisito">${escapeHtml(item.descripcion || '')}</textarea>
    </article>
  `,
        )
        .join('')
    : '<p class="perfil-empty">No hay requisitos. Puede agregar el primero.</p>';
  renderizarIconos();
}

function leerRequisitosEditor(validar) {
  const filas = [...document.querySelectorAll('[data-requisito-row]')];
  const requisitos = filas.map((fila, indice) => ({
    tipo: fila.querySelector('[data-campo="tipo"]')?.value,
    obligatorio: Boolean(
      fila.querySelector('[data-campo="obligatorio"]')?.checked,
    ),
    orden: indice + 1,
    descripcion:
      fila.querySelector('[data-campo="descripcion"]')?.value?.trim() || '',
  }));
  if (validar && requisitos.some((item) => !item.descripcion)) {
    mostrarError({
      titulo: 'Descripción requerida',
      mensaje: 'Todos los requisitos deben incluir una descripción.',
    });
    return null;
  }
  return requisitos;
}

export function abrirEditorRequisitosDialog({
  perfil,
  requisitosActuales = [],
  controlOperacion,
  onUpdated,
}) {
  if (!perfil || !operacionVigente(controlOperacion)) return;
  if (perfil?.estructuraEditable === false) {
    mostrarError({
      titulo: 'Configuración bloqueada',
      mensaje:
        'Este perfil ya fue utilizado por profesores y su estructura no puede modificarse.',
    });
    return;
  }

  const body = `
    <div class="perfil-requisitos-editor sgpa-form-field-full">
      <div id="requisitosEditorRows"></div>
      <button id="agregarRequisito" class="sgpa-button sgpa-button-secondary sgpa-button-sm" type="button"><i data-lucide="plus"></i>Agregar requisito</button>
    </div>
  `;

  const dialog = abrirDialogo(
    FormDialog({
      formId: 'perfilRequisitosForm',
      title: 'Requisitos y condiciones',
      description:
        'Configure los requisitos y condiciones que debe cumplir el profesor.',
      body,
      errorId: 'perfilFormError',
      cancelButtonId: 'cancelarPerfilForm',
      submitButtonId: 'guardarPerfilForm',
      layout: 'custom',
    }),
  );

  renderizarFilasRequisitos(requisitosActuales.map((item) => ({ ...item })));

  document
    .getElementById('cancelarPerfilForm')
    ?.addEventListener('click', cerrarDialogo);

  document
    .getElementById('agregarRequisito')
    ?.addEventListener('click', () => {
      const actuales = leerRequisitosEditor(false);
      actuales.push({ tipo: 'OTROS', obligatorio: false, descripcion: '' });
      renderizarFilasRequisitos(actuales);
    });

  document
    .getElementById('requisitosEditorRows')
    ?.addEventListener('click', (event) => {
      const boton = event.target.closest('[data-quitar-requisito]');
      if (!boton) return;
      const actuales = leerRequisitosEditor(false);
      actuales.splice(Number(boton.dataset.quitarRequisito), 1);
      renderizarFilasRequisitos(actuales);
    });

  document
    .getElementById('perfilRequisitosForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!operacionVigente(controlOperacion) || perfil.estructuraEditable === false) return;
      const requisitos = leerRequisitosEditor(true);
      if (!requisitos) return;

      const boton = document.getElementById('guardarPerfilForm');
      const clave = `requisitos:${perfil.id}`;
      const token = reservar(controlOperacion, clave);
      if (!token) return;
      if (boton) boton.disabled = true;

      try {
        if (
          !(await confirmarAccion({
            titulo: 'Guardar requisitos',
            mensaje:
              'Se actualizará la configuración completa de requisitos y condiciones.',
            textoConfirmar: 'Guardar requisitos',
          }))
        ) {
          return;
        }
        if (
          !operacionVigente(controlOperacion) ||
          perfil.estructuraEditable === false
        ) {
          return;
        }
        if (!marcarEnviada(controlOperacion, clave, token)) return;

        await guardarCambio(
          () => guardarRequisitosPerfil(perfil.id, requisitos),
          'Los requisitos fueron actualizados.',
          dialog,
          onUpdated,
          controlOperacion,
        );
      } finally {
        liberar(controlOperacion, clave, token);
        if (boton) boton.disabled = false;
      }
    });
}
