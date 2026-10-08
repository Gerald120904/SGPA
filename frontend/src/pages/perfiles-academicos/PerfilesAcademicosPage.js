import {
  actualizarPerfil,
  asociarCursoPerfil,
  cambiarEstadoPerfil,
  crearPerfil,
  desasociarCursoPerfil,
  guardarAreasPerfil,
  guardarRequisitosPerfil,
  listarAreasPerfil,
  listarCursosPerfil,
  listarPerfilesAcademicos,
  listarRequisitosPerfil,
  obtenerPerfil,
} from '../../services/perfiles-academicos.service.js';
import {
  listarCursos,
} from '../../services/cursos.service.js';
import {
  listarCarreras,
} from '../../services/carreras.service.js';
import { usuarioTienePermiso } from '../../app/session.js';
import { PERMISOS } from '../../config/permissions.js';
import { DataTable } from '../../components/DataTable.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';

const TIPOS_REQUISITO = [
  'FORMACION_ACADEMICA',
  'IDIOMA_INSTRUMENTAL',
  'EXPERIENCIA_DOCENTE',
  'GRADO_COMPLEMENTARIO',
  'IDIOMA_GLOBAL',
  'EXPERIENCIA_PROFESIONAL',
  'CAPACITACIONES',
  'OTROS',
  'JORNADA',
  'HORARIO',
  'CAMPUS',
];

const CONDICIONES = new Set(['JORNADA', 'HORARIO', 'CAMPUS']);

let perfiles = [];
let carreras = [];

let perfilActual = null;
let areasActuales = [];
let requisitosActuales = [];

function puedeGestionar() {
  return usuarioTienePermiso(PERMISOS.PERFILES_ACADEMICOS_GESTIONAR);
}

export function PerfilesAcademicosPage() {
  return `
    <section id="perfilesAcademicosPage" class="module-view perfiles-academicos-page">
      <div class="sgpa-toolbar">
        <div>
          <h2>Perfiles docentes</h2>
          <p>
            Definición institucional de perfiles docentes,
            requisitos y cursos habilitados.
          </p>
        </div>

        ${
          puedeGestionar()
            ? `
              <button
                id="nuevoPerfilButton"
                class="sgpa-button sgpa-button-primary"
                type="button"
              >
                <i data-lucide="plus" aria-hidden="true"></i>
                Nuevo perfil
              </button>
            `
            : ''
        }
      </div>

      <div id="perfilesListado">
        <div class="sgpa-filters">
          <label class="sgpa-search" for="perfilesBuscar">
            <i data-lucide="search" aria-hidden="true"></i>
            <input id="perfilesBuscar" type="search" placeholder="Buscar por código, nombre o carrera...">
          </label>
          <select id="perfilesEstado" class="sgpa-select" aria-label="Filtrar por estado">
            <option value="TODOS">Todos los estados</option>
            <option value="ACTIVOS">Activos</option>
            <option value="INACTIVOS">Inactivos</option>
          </select>
        </div>
        <div id="perfilesContent" aria-live="polite">
          <div class="sgpa-state-message">Cargando perfiles académicos...</div>
        </div>
      </div>

      <div id="perfilDetalle" class="hidden" aria-live="polite"></div>

      <dialog id="perfilAcademicoDialog" class="sgpa-form-dialog sgpa-form-dialog-lg">
        <div id="perfilAcademicoDialogContent"></div>
      </dialog>
    </section>
  `;
}

export async function iniciarPerfilesAcademicosPage() {
  document
    .getElementById('nuevoPerfilButton')
    ?.addEventListener(
      'click',
      abrirNuevoPerfil,
    );

  document.getElementById('perfilesBuscar')?.addEventListener('input', renderizarListado);
  document.getElementById('perfilesEstado')?.addEventListener('change', renderizarListado);
  document.getElementById('perfilesContent')?.addEventListener('click', manejarListado);
  document.getElementById('perfilDetalle')?.addEventListener('click', manejarDetalle);

  const dialog = document.getElementById('perfilAcademicoDialog');
  habilitarCierreExterior(dialog);

  const [
    resultadoPerfiles,
    resultadoCarreras,
  ] = await Promise.all([
    listarPerfilesAcademicos(),
    listarCarreras(),
  ]);

  if (!resultadoPerfiles?.ok) {
    mostrarFallo(
      resultadoPerfiles?.message ||
        'No fue posible consultar los perfiles.',
    );
    return;
  }

  if (!resultadoCarreras?.ok) {
    mostrarFallo(
      resultadoCarreras?.message ||
        'No fue posible consultar las carreras.',
    );
    return;
  }

  perfiles =
    Array.isArray(resultadoPerfiles.data)
      ? resultadoPerfiles.data
      : [];

  carreras =
    Array.isArray(resultadoCarreras.carreras)
      ? resultadoCarreras.carreras
      : [];

  renderizarListado();
}

async function recargarPerfiles() {
  const resultado = await listarPerfilesAcademicos();

  if (!resultado?.ok) {
    throw new Error(
      resultado?.message ||
        'No fue posible actualizar el listado de perfiles.',
    );
  }

  perfiles = Array.isArray(resultado.data) ? resultado.data : [];

  renderizarListado();
}

function perfilesFiltrados() {
  const texto = document.getElementById('perfilesBuscar')?.value?.trim().toLowerCase() || '';
  const estado = document.getElementById('perfilesEstado')?.value || 'TODOS';

  return perfiles.filter((perfil) => {
    const coincideTexto = !texto || [
      perfil.codigo,
      perfil.nombre,
      perfil.numeroPerfil,
      perfil.carrera?.nombre,
    ].filter(Boolean).some((valor) => String(valor).toLowerCase().includes(texto));
    const coincideEstado = estado === 'TODOS' ||
      (estado === 'ACTIVOS' && perfil.activo) ||
      (estado === 'INACTIVOS' && !perfil.activo);
    return coincideTexto && coincideEstado;
  });
}

function renderizarListado() {
  const contenedor = document.getElementById('perfilesContent');
  if (!contenedor) return;

  const filas = perfilesFiltrados().map((perfil) => `
    <tr>
      <td><strong class="perfil-codigo">${escapeHtml(perfil.codigo)}</strong></td>
      <td>
        <div class="perfil-nombre">
          <strong>${escapeHtml(perfil.nombre)}</strong>
          <small>${escapeHtml(perfil.numeroPerfil || 'Sin número oficial')}</small>
        </div>
      </td>
      <td>${escapeHtml(perfil.carrera?.nombre || '—')}</td>
      <td>${StatusBadge({ label: perfil.activo ? 'ACTIVO' : 'INACTIVO', tone: perfil.activo ? 'success' : 'neutral' })}</td>
      <td class="sgpa-table-actions-cell">
        <button class="sgpa-button sgpa-button-secondary sgpa-button-sm" type="button" data-ver-perfil="${perfil.id}">
          <i data-lucide="eye" aria-hidden="true"></i> Ver detalle
        </button>
      </td>
    </tr>
  `).join('');

  contenedor.innerHTML = DataTable({
    columns: ['Código', 'Perfil', 'Carrera', 'Estado', { label: 'Acciones', className: 'sgpa-table-actions-cell' }],
    rows: filas,
    emptyMessage: 'No hay perfiles que coincidan con los filtros.',
    ariaLabel: 'Perfiles académicos',
  });
  renderizarIconos();
}

async function manejarListado(event) {
  const boton = event.target.closest('[data-ver-perfil]');
  if (boton) await cargarDetalle(Number(boton.dataset.verPerfil));
}

async function cargarDetalle(id) {
  const listado = document.getElementById('perfilesListado');
  const detalle = document.getElementById('perfilDetalle');
  listado?.classList.add('hidden');
  detalle?.classList.remove('hidden');
  if (detalle) detalle.innerHTML = '<div class="sgpa-state-message">Cargando perfil docente...</div>';

  const [perfil, areas, requisitos] = await Promise.all([
    obtenerPerfil(id),
    listarAreasPerfil(id),
    listarRequisitosPerfil(id),
  ]);

  const error = [perfil, areas, requisitos].find((resultado) => !resultado?.ok);
  if (error) {
    if (detalle) detalle.innerHTML = `<div class="sgpa-state-message sgpa-state-message-error">${escapeHtml(error.message || 'No fue posible cargar el perfil.')}</div>`;
    return;
  }

  perfilActual = perfil.data;
  areasActuales = Array.isArray(areas.data) ? areas.data : [];
  requisitosActuales = Array.isArray(requisitos.data) ? requisitos.data : [];
  renderizarDetalle();
}

function renderizarDetalle() {
  const contenedor = document.getElementById('perfilDetalle');
  if (!contenedor || !perfilActual) return;

  const disciplinares = areasActuales.filter((area) => area.tipo === 'DISCIPLINAR');
  const estrategicas = areasActuales.filter((area) => area.tipo === 'ESTRATEGICA');
  const obligatorios = requisitosActuales.filter((item) => item.obligatorio && !CONDICIONES.has(item.tipo));
  const facultativos = requisitosActuales.filter((item) => !item.obligatorio && !CONDICIONES.has(item.tipo));
  const condiciones = requisitosActuales.filter((item) => CONDICIONES.has(item.tipo));
  const cursos = Array.isArray(perfilActual.cursos)
    ? perfilActual.cursos.filter((relacion) => relacion.activo !== false)
    : [];

  contenedor.innerHTML = `
    <button class="sgpa-button sgpa-button-secondary sgpa-back-button" type="button" data-volver-perfiles>
      <i data-lucide="arrow-left" aria-hidden="true"></i> Volver a perfiles
    </button>

    <article class="perfil-hero">
      <div>
        <div class="perfil-hero-badges">
          <span class="perfil-code-pill">${escapeHtml(perfilActual.codigo)}</span>
          ${StatusBadge({ label: perfilActual.activo ? 'ACTIVO' : 'INACTIVO', tone: perfilActual.activo ? 'success' : 'neutral' })}
        </div>
        <h2>${escapeHtml(perfilActual.nombre)}</h2>
        <p>${escapeHtml(perfilActual.numeroPerfil || 'Perfil oficial sin numeración registrada')}</p>
      </div>
      ${puedeGestionar() ? `
        <div class="perfil-hero-actions">
          <button
            class="sgpa-button sgpa-button-secondary"
            type="button"
            data-editar-perfil
          >
            <i data-lucide="pencil" aria-hidden="true"></i>
            Editar información
          </button>

          <button
            class="sgpa-button ${
              perfilActual.activo
                ? 'sgpa-button-danger'
                : 'sgpa-button-primary'
            }"
            type="button"
            data-cambiar-estado-perfil
          >
            <i
              data-lucide="${
                perfilActual.activo
                  ? 'circle-pause'
                  : 'circle-play'
              }"
              aria-hidden="true"
            ></i>

            ${
              perfilActual.activo
                ? 'Inactivar'
                : 'Activar'
            }
          </button>
        </div>
      ` : ''}
    </article>

    ${
      perfilActual.utilizado
        ? `
          <div
            class="perfil-structure-lock"
            role="status"
          >
            <div class="perfil-structure-lock-icon">
              <i data-lucide="lock" aria-hidden="true"></i>
            </div>

            <div>
              <strong>Configuración bloqueada</strong>

              <p>
                Este perfil ya fue utilizado por uno o más profesores.
                Sus áreas, requisitos y cursos se conservan para proteger
                el historial. Para definir una estructura diferente,
                cree un nuevo perfil docente.
              </p>
            </div>
          </div>
        `
        : ''
    }

    <section class="perfil-section">
      <header><div><span>Información</span><h3>Datos del perfil</h3></div></header>
      <dl class="perfil-official-grid">
        ${datoOficial('Número de perfil', perfilActual.numeroPerfil)}
        ${datoOficial('Consecutivo', perfilActual.consecutivo)}
        ${datoOficial('Acuerdo de aprobación', perfilActual.acuerdoAprobacion)}
        ${datoOficial('Fecha de aprobación', formatearFecha(perfilActual.fechaAprobacion))}
        ${datoOficial('Tipo de registro', etiquetaTipo(perfilActual.tipoRegistro))}
        ${datoOficial('Carrera', perfilActual.carrera?.nombre)}
      </dl>
    </section>

    <div class="perfil-two-columns">
      ${seccionLista('Áreas disciplinares', 'book-open', disciplinares, 'No hay áreas disciplinares registradas.')}
      ${seccionLista('Áreas estratégicas', 'target', estrategicas, 'No hay áreas estratégicas registradas.')}
    </div>
    ${
      puedeGestionar() && perfilActual.estructuraEditable
        ? botonEditarSeccion('data-editar-areas', 'Editar áreas')
        : ''
    }

    <section class="perfil-section">
      <header>
        <div>
          <span>Asignación</span>
          <h3>Cursos habilitados</h3>
        </div>

        ${
          puedeGestionar()
            ? `
              <button
                class="sgpa-button sgpa-button-secondary sgpa-button-sm"
                type="button"
                data-gestionar-cursos
                ${
                  perfilActual.activo && perfilActual.estructuraEditable
                    ? ''
                    : 'disabled'
                }
                title="${
                  !perfilActual.activo
                    ? 'Active el perfil para modificar sus cursos'
                    : !perfilActual.estructuraEditable
                      ? 'La estructura está bloqueada porque el perfil ya fue utilizado'
                      : 'Administrar cursos habilitados'
                }"
              >
                <i data-lucide="book-plus" aria-hidden="true"></i>
                Gestionar cursos
              </button>
            `
            : ''
        }
      </header>

      <div class="perfil-chips">
        ${
          cursos.length
            ? cursos
                .map(
                  (relacion) => `
                    <span>
                      ${escapeHtml(
                        relacion.curso?.codigo || String(relacion.cursoId),
                      )}
                    </span>
                  `,
                )
                .join('')
            : `
                <p class="perfil-empty">
                  No hay cursos habilitados por este perfil.
                </p>
              `
        }
      </div>
    </section>

    <div class="perfil-two-columns">
      ${seccionRequisitos('Requisitos obligatorios', obligatorios, true)}
      ${seccionRequisitos('Requisitos facultativos', facultativos, false)}
    </div>
    ${seccionRequisitos('Condiciones', condiciones, null)}
    ${
      puedeGestionar() && perfilActual.estructuraEditable
        ? botonEditarSeccion(
            'data-editar-requisitos',
            'Editar requisitos y condiciones',
          )
        : ''
    }
  `;
  renderizarIconos();
}

function datoOficial(etiqueta, valor) {
  return `<div><dt>${escapeHtml(etiqueta)}</dt><dd>${escapeHtml(valor || 'No registrado')}</dd></div>`;
}

function seccionLista(titulo, icono, elementos, vacio) {
  return `
    <section class="perfil-section">
      <header>
        <div>
          <span>Áreas del perfil</span>

          <h3>
            <i data-lucide="${icono}" aria-hidden="true"></i>
            ${escapeHtml(titulo)}
          </h3>
        </div>

        ${StatusBadge({
          label: `${elementos.length}`,
          tone: 'neutral',
        })}
      </header>

      ${
        elementos.length
          ? `
            <ul>
              ${elementos
                .map(
                  (item) => `
                    <li>${escapeHtml(item.descripcion)}</li>
                  `,
                )
                .join('')}
            </ul>
          `
          : `
            <p class="perfil-empty">${escapeHtml(vacio)}</p>
          `
      }
    </section>
  `;
}

function seccionRequisitos(titulo, elementos, obligatorio = null) {
  return `
    <section class="perfil-section">
      <header>
        <div>
          <span>Requisitos del perfil</span>
          <h3>${escapeHtml(titulo)}</h3>
        </div>

        ${
          typeof obligatorio === 'boolean'
            ? StatusBadge({
                label: obligatorio ? 'OBLIGATORIO' : 'FACULTATIVO',
                tone: obligatorio ? 'warning' : 'info',
              })
            : StatusBadge({
                label: `${elementos.length}`,
                tone: 'neutral',
              })
        }
      </header>

      ${
        elementos.length
          ? `
            <div class="perfil-requirements">
              ${elementos
                .map(
                  (item) => `
                    <article>
                      <div class="perfil-requirement-heading">
                        <strong>${escapeHtml(etiquetaTipo(item.tipo))}</strong>

                        ${
                          obligatorio === null
                            ? StatusBadge({
                                label: item.obligatorio
                                  ? 'OBLIGATORIO'
                                  : 'FACULTATIVO',
                                tone: item.obligatorio
                                  ? 'warning'
                                  : 'info',
                              })
                            : ''
                        }
                      </div>

                      <p>${escapeHtml(item.descripcion)}</p>
                    </article>
                  `,
                )
                .join('')}
            </div>
          `
          : `
            <p class="perfil-empty">No hay elementos registrados.</p>
          `
      }
    </section>
  `;
}

function botonEditarSeccion(atributo, texto) {
  return `<div class="perfil-section-action"><button class="sgpa-button sgpa-button-secondary sgpa-button-sm" type="button" ${atributo}><i data-lucide="pencil" aria-hidden="true"></i>${escapeHtml(texto)}</button></div>`;
}

async function manejarDetalle(event) {
  if (event.target.closest('[data-volver-perfiles]')) {
    document.getElementById('perfilDetalle')?.classList.add('hidden');
    document.getElementById('perfilesListado')?.classList.remove('hidden');
    perfilActual = null;
    return;
  }
  if (event.target.closest('[data-editar-perfil]')) {
    abrirEditorPerfil();
    return;
  }
  if (event.target.closest('[data-cambiar-estado-perfil]')) {
    await cambiarEstadoActual();
    return;
  }
  if (event.target.closest('[data-gestionar-cursos]')) {
    await abrirGestorCursos();
    return;
  }
  if (event.target.closest('[data-editar-areas]')) abrirEditorAreas();
  if (event.target.closest('[data-editar-requisitos]')) abrirEditorRequisitos();
}

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

async function abrirGestorCursos() {
  if (!perfilActual) {
    return;
  }

  if (perfilActual.estructuraEditable === false) {
    mostrarError({
      titulo: 'Configuración bloqueada',
      mensaje:
        'Este perfil ya fue utilizado por profesores y sus cursos habilitados no pueden modificarse.',
    });
    return;
  }

  const [resultadoCatalogo, resultadoAsociados] = await Promise.all([
    listarCursos(),
    listarCursosPerfil(perfilActual.id),
  ]);

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

  const cursosCarrera = catalogo
    .filter(
      (curso) =>
        curso.activo !== false &&
        (curso.carreras ?? []).some(
          (carrera) => carrera.id === perfilActual.carreraId,
        ),
    )
    .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));

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

    <div
      id="cursosPerfilContent"
      class="sgpa-form-field-full"
    ></div>
  `;

  abrirDialogo(
    FormDialog({
      formId: 'gestionarCursosPerfilForm',
      title: 'Cursos habilitados',
      description: `${perfilActual.codigo} · ${
        perfilActual.carrera?.nombre || 'Carrera'
      }`,
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
        .map((relacion) =>
          Number(relacion.cursoId ?? relacion.curso?.id),
        ),
    );

  const renderizarCursos = () => {
    const host = document.getElementById('cursosPerfilContent');

    if (!host) {
      return;
    }

    const busqueda =
      document
        .getElementById('buscarCursoPerfil')
        ?.value?.trim()
        .toLowerCase() || '';

    const asociados = obtenerIdsAsociados();

    const filtrados = cursosCarrera.filter(
      (curso) =>
        !busqueda ||
        [curso.codigo, curso.nombre]
          .filter(Boolean)
          .some((valor) =>
            String(valor).toLowerCase().includes(busqueda),
          ),
    );

    const filas = filtrados
      .map((curso) => {
        const asociado = asociados.has(Number(curso.id));

        return `
          <tr>
            <td>
              <strong>${escapeHtml(curso.codigo)}</strong>
            </td>

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
                  asociado
                    ? 'sgpa-button-secondary'
                    : 'sgpa-button-primary'
                } sgpa-button-sm"
                type="button"
                data-curso-perfil-id="${curso.id}"
                data-curso-perfil-accion="${
                  asociado ? 'quitar' : 'agregar'
                }"
              >
                <i
                  data-lucide="${asociado ? 'minus' : 'plus'}"
                  aria-hidden="true"
                ></i>

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
        {
          label: 'Acción',
          className: 'sgpa-table-actions-cell',
        },
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

      if (!boton) {
        return;
      }

      const cursoId = Number(boton.dataset.cursoPerfilId);
      const accion = boton.dataset.cursoPerfilAccion;

      if (!cursoId) {
        return;
      }

      boton.disabled = true;

      try {
        const resultado =
          accion === 'agregar'
            ? await asociarCursoPerfil(perfilActual.id, cursoId)
            : await desasociarCursoPerfil(perfilActual.id, cursoId);

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message ||
              'No fue posible modificar los cursos del perfil.',
          );
        }

        const actualizado = await listarCursosPerfil(perfilActual.id);

        if (!actualizado?.ok) {
          throw new Error(
            actualizado?.message ||
              'El cambio fue realizado, pero no fue posible actualizar la lista.',
          );
        }

        relaciones = Array.isArray(actualizado.data)
          ? actualizado.data
          : [];

        renderizarCursos();
        await cargarDetalle(perfilActual.id);
      } catch (error) {
        mostrarError({
          titulo: 'No se pudo modificar el curso',
          mensaje:
            error?.message ||
            'No fue posible modificar los cursos habilitados.',
        });
      } finally {
        boton.disabled = false;
      }
    });

  renderizarCursos();
}

function abrirNuevoPerfil() {
  const carrerasActivas =
    carreras.filter(
      (carrera) =>
        carrera.activo !== false,
    );

  if (!carrerasActivas.length) {
    mostrarError({
      titulo: 'No hay carreras disponibles',
      mensaje:
        'Debe existir al menos una carrera activa antes de crear un perfil docente.',
    });

    return;
  }

  const opcionesCarreras =
    carrerasActivas
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

      <select
        id="nuevoPerfilCarrera"
        required
      >
        <option
          value=""
          disabled
          selected
        >
          Seleccione una carrera...
        </option>

        ${opcionesCarreras}
      </select>
    </label>

    <label class="sgpa-form-field">
      <span>Código</span>

      <input
        id="nuevoPerfilCodigo"
        type="text"
        maxlength="30"
        placeholder="Ej. PD-SW"
        required
      >
    </label>

    <label class="sgpa-form-field sgpa-form-field-full">
      <span>Nombre del perfil</span>

      <input
        id="nuevoPerfilNombre"
        type="text"
        maxlength="150"
        placeholder="Ej. Desarrollo de Software"
        required
      >
    </label>

    <label class="sgpa-form-field sgpa-form-field-full">
      <span>Descripción</span>

      <textarea
        id="nuevoPerfilDescripcion"
        maxlength="500"
        rows="4"
        placeholder="Descripción general del perfil docente"
      ></textarea>
    </label>
  `;

  const dialog =
    abrirDialogo(
      FormDialog({
        formId: 'nuevoPerfilForm',
        title: 'Nuevo perfil docente',
        description:
          'Defina el perfil institucional para una carrera.',
        body,
        errorId: 'perfilFormError',
        cancelButtonId:
          'cancelarPerfilForm',
        submitButtonId:
          'guardarPerfilForm',
        submitText:
          'Crear perfil',
      }),
    );

  document
    .getElementById(
      'cancelarPerfilForm',
    )
    ?.addEventListener(
      'click',
      cerrarDialogo,
    );

  document
    .getElementById(
      'nuevoPerfilForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        const carreraId =
          Number(
            document
              .getElementById(
                'nuevoPerfilCarrera',
              )
              ?.value,
          );

        const codigo =
          document
            .getElementById(
              'nuevoPerfilCodigo',
            )
            ?.value
            ?.trim()
            .toUpperCase() || '';

        const nombre =
          document
            .getElementById(
              'nuevoPerfilNombre',
            )
            ?.value
            ?.trim() || '';

        const descripcion =
          document
            .getElementById(
              'nuevoPerfilDescripcion',
            )
            ?.value
            ?.trim() || '';

        if (
          !carreraId ||
          !codigo ||
          !nombre
        ) {
          mostrarError({
            titulo:
              'Datos incompletos',
            mensaje:
              'Seleccione una carrera e indique el código y nombre del perfil.',
          });

          return;
        }

        const boton =
          document.getElementById(
            'guardarPerfilForm',
          );

        if (boton) {
          boton.disabled = true;
        }

        try {
          const resultado =
            await crearPerfil({
              carreraId,
              codigo,
              nombre,
              descripcion:
                descripcion || undefined,
            });

          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                'No fue posible crear el perfil.',
            );
          }

          dialog?.close();

          mostrarExito({
            titulo:
              'Perfil creado',
            mensaje:
              'El perfil docente fue creado correctamente.',
          });

          await recargarPerfiles();

          if (resultado.data?.id) {
            await cargarDetalle(
              resultado.data.id,
            );
          }
        } catch (error) {
          mostrarError({
            titulo:
              'No se pudo crear el perfil',
            mensaje:
              error?.message ||
              'No fue posible crear el perfil docente.',
          });
        } finally {
          if (boton) {
            boton.disabled = false;
          }
        }
      },
    );
}

function abrirEditorPerfil() {
  if (!perfilActual) {
    return;
  }

  const body = `
    <label class="sgpa-form-field">
      <span>Código</span>
      <input
        type="text"
        value="${escapeHtml(
          perfilActual.codigo || '',
        )}"
        disabled
      >
      <small>
        El código se define al crear el perfil.
      </small>
    </label>

    <label class="sgpa-form-field">
      <span>Carrera</span>
      <input
        type="text"
        value="${escapeHtml(
          perfilActual.carrera?.nombre || '',
        )}"
        disabled
      >
      <small>
        La carrera no puede cambiarse después de crear el perfil.
      </small>
    </label>

    <label class="sgpa-form-field sgpa-form-field-full">
      <span>Nombre</span>
      <input
        id="perfilNombre"
        type="text"
        maxlength="150"
        value="${escapeHtml(
          perfilActual.nombre || '',
        )}"
        required
      >
    </label>

    <label class="sgpa-form-field sgpa-form-field-full">
      <span>Descripción</span>
      <textarea
        id="perfilDescripcion"
        maxlength="500"
        rows="4"
      >${escapeHtml(
        perfilActual.descripcion || '',
      )}</textarea>
    </label>

    ${campo(
      'Número de perfil',
      'numeroPerfil',
      perfilActual.numeroPerfil,
      'Opcional',
    )}

    ${campo(
      'Consecutivo',
      'consecutivo',
      perfilActual.consecutivo,
      'Opcional',
    )}

    ${campo(
      'Acuerdo de aprobación',
      'acuerdoAprobacion',
      perfilActual.acuerdoAprobacion,
      'Opcional',
    )}

    ${campo(
      'Fecha de aprobación',
      'fechaAprobacion',
      perfilActual.fechaAprobacion,
      '',
      'date',
    )}

    <label class="sgpa-form-field">
      <span>Tipo de registro</span>

      <select id="tipoRegistro">
        <option value="">
          Sin registrar
        </option>

        <option
          value="PERFIL_NUEVO"
          ${
            perfilActual.tipoRegistro ===
            'PERFIL_NUEVO'
              ? 'selected'
              : ''
          }
        >
          Perfil nuevo
        </option>

        <option
          value="ACTUALIZACION"
          ${
            perfilActual.tipoRegistro ===
            'ACTUALIZACION'
              ? 'selected'
              : ''
          }
        >
          Actualización
        </option>
      </select>
    </label>
  `;

  const dialog =
    abrirDialogo(
      FormDialog({
        formId: 'editarPerfilForm',
        title: 'Editar perfil docente',
        description:
          perfilActual.codigo,
        body,
        errorId: 'perfilFormError',
        cancelButtonId:
          'cancelarPerfilForm',
        submitButtonId:
          'guardarPerfilForm',
        submitText:
          'Guardar cambios',
      }),
    );

  document
    .getElementById(
      'cancelarPerfilForm',
    )
    ?.addEventListener(
      'click',
      cerrarDialogo,
    );

  document
    .getElementById(
      'editarPerfilForm',
    )
    ?.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        const nombre =
          document
            .getElementById(
              'perfilNombre',
            )
            ?.value
            ?.trim() || '';

        if (!nombre) {
          mostrarError({
            titulo:
              'Nombre requerido',
            mensaje:
              'El perfil debe tener un nombre.',
          });

          return;
        }

        const datos = {
          nombre,

          descripcion:
            document
              .getElementById(
                'perfilDescripcion',
              )
              ?.value
              ?.trim() || null,

          numeroPerfil:
            document
              .getElementById(
                'numeroPerfil',
              )
              ?.value
              ?.trim() || null,

          consecutivo:
            document
              .getElementById(
                'consecutivo',
              )
              ?.value
              ?.trim() || null,

          acuerdoAprobacion:
            document
              .getElementById(
                'acuerdoAprobacion',
              )
              ?.value
              ?.trim() || null,

          fechaAprobacion:
            document
              .getElementById(
                'fechaAprobacion',
              )
              ?.value || null,

          tipoRegistro:
            document
              .getElementById(
                'tipoRegistro',
              )
              ?.value || null,
        };

        const resultado =
          await actualizarPerfil(
            perfilActual.id,
            datos,
          );

        if (!resultado?.ok) {
          mostrarError({
            titulo:
              'No se pudo actualizar',
            mensaje:
              resultado?.message ||
              'No fue posible actualizar el perfil.',
          });

          return;
        }

        dialog?.close();

        mostrarExito({
          titulo:
            'Perfil actualizado',
          mensaje:
            'La información del perfil docente fue actualizada correctamente.',
        });

        await recargarPerfiles();
        await cargarDetalle(
          perfilActual.id,
        );
      },
    );
}

async function cambiarEstadoActual() {
  if (!perfilActual) {
    return;
  }

  const nuevoEstado =
    !perfilActual.activo;

  const accion =
    nuevoEstado
      ? 'activar'
      : 'inactivar';

  const confirmado =
    await confirmarAccion({
      titulo:
        nuevoEstado
          ? 'Activar perfil'
          : 'Inactivar perfil',

      mensaje:
        nuevoEstado
          ? `¿Desea activar el perfil "${perfilActual.nombre}"?`
          : `¿Desea inactivar el perfil "${perfilActual.nombre}"? Los antecedentes existentes se conservarán, pero el perfil dejará de estar disponible para nuevas solicitudes y no habilitará cursos.`,

      textoConfirmar:
        nuevoEstado
          ? 'Activar'
          : 'Inactivar',

      peligro:
        !nuevoEstado,
    });

  if (!confirmado) {
    return;
  }

  const resultado =
    await cambiarEstadoPerfil(
      perfilActual.id,
      nuevoEstado,
    );

  if (!resultado?.ok) {
    mostrarError({
      titulo:
        `No se pudo ${accion} el perfil`,
      mensaje:
        resultado?.message ||
        `No fue posible ${accion} el perfil docente.`,
    });

    return;
  }

  mostrarExito({
    titulo:
      nuevoEstado
        ? 'Perfil activado'
        : 'Perfil inactivado',

    mensaje:
      nuevoEstado
        ? 'El perfil vuelve a estar disponible.'
        : 'El perfil quedó inactivo y su historial fue conservado.',
  });

  await recargarPerfiles();

  await cargarDetalle(
    perfilActual.id,
  );
}

function abrirEditorAreas() {
  if (perfilActual?.estructuraEditable === false) {
    mostrarError({
      titulo: 'Configuración bloqueada',
      mensaje:
        'Este perfil ya fue utilizado por profesores y su estructura no puede modificarse.',
    });
    return;
  }

  const disciplinares = areasActuales.filter((area) => area.tipo === 'DISCIPLINAR').map((area) => area.descripcion).join('\n');
  const estrategicas = areasActuales.filter((area) => area.tipo === 'ESTRATEGICA').map((area) => area.descripcion).join('\n');
  const body = `
    <label class="sgpa-form-field sgpa-form-field-full"><span>Áreas disciplinares</span><textarea id="areasDisciplinares" rows="8" placeholder="Una área por línea">${escapeHtml(disciplinares)}</textarea><small>Escriba una descripción por línea.</small></label>
    <label class="sgpa-form-field sgpa-form-field-full"><span>Áreas estratégicas</span><textarea id="areasEstrategicas" rows="8" placeholder="Una área por línea">${escapeHtml(estrategicas)}</textarea><small>Escriba una descripción por línea.</small></label>
  `;
  const dialog = abrirDialogo(FormDialog({ formId: 'perfilAreasForm', title: 'Áreas del perfil', description: 'La lista guardada reemplazará la configuración actual.', body, errorId: 'perfilFormError', cancelButtonId: 'cancelarPerfilForm', submitButtonId: 'guardarPerfilForm' }));
  document.getElementById('cancelarPerfilForm')?.addEventListener('click', cerrarDialogo);
  document.getElementById('perfilAreasForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const disciplinares = lineas('areasDisciplinares');
    const estrategicas = lineas('areasEstrategicas');

    if (
      !validarLineasUnicas(disciplinares, 'Área disciplinar') ||
      !validarLineasUnicas(estrategicas, 'Área estratégica')
    ) {
      return;
    }

    const areas = [
      ...disciplinares.map((descripcion, indice) => ({ tipo: 'DISCIPLINAR', descripcion, orden: indice + 1 })),
      ...estrategicas.map((descripcion, indice) => ({ tipo: 'ESTRATEGICA', descripcion, orden: indice + 1 })),
    ];
    if (!(await confirmarAccion({ titulo: 'Reemplazar áreas', mensaje: 'Se sustituirá la lista completa de áreas del perfil.', textoConfirmar: 'Guardar áreas' }))) return;
    await guardarCambio(() => guardarAreasPerfil(perfilActual.id, areas), 'Las áreas fueron actualizadas.', dialog);
  });
}

function abrirEditorRequisitos() {
  if (perfilActual?.estructuraEditable === false) {
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
  const dialog = abrirDialogo(FormDialog({ formId: 'perfilRequisitosForm', title: 'Requisitos y condiciones', description: 'Configure los requisitos y condiciones que debe cumplir el profesor.', body, errorId: 'perfilFormError', cancelButtonId: 'cancelarPerfilForm', submitButtonId: 'guardarPerfilForm', layout: 'custom' }));
  renderizarFilasRequisitos(requisitosActuales.map((item) => ({ ...item })));
  document.getElementById('cancelarPerfilForm')?.addEventListener('click', cerrarDialogo);
  document.getElementById('agregarRequisito')?.addEventListener('click', () => {
    const actuales = leerRequisitosEditor(false);
    actuales.push({ tipo: 'OTROS', obligatorio: false, descripcion: '' });
    renderizarFilasRequisitos(actuales);
  });
  document.getElementById('requisitosEditorRows')?.addEventListener('click', (event) => {
    const boton = event.target.closest('[data-quitar-requisito]');
    if (!boton) return;
    const actuales = leerRequisitosEditor(false);
    actuales.splice(Number(boton.dataset.quitarRequisito), 1);
    renderizarFilasRequisitos(actuales);
  });
  document.getElementById('perfilRequisitosForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const requisitos = leerRequisitosEditor(true);
    if (!requisitos) return;
    if (!(await confirmarAccion({ titulo: 'Guardar requisitos', mensaje: 'Se actualizará la configuración completa de requisitos y condiciones.', textoConfirmar: 'Guardar requisitos' }))) return;
    await guardarCambio(() => guardarRequisitosPerfil(perfilActual.id, requisitos), 'Los requisitos fueron actualizados.', dialog);
  });
}

function renderizarFilasRequisitos(requisitos) {
  const host = document.getElementById('requisitosEditorRows');
  if (!host) return;
  host.innerHTML = requisitos.length ? requisitos.map((item, indice) => `
    <article class="perfil-requisito-editor-row" data-requisito-row>
      <select data-campo="tipo" aria-label="Tipo de requisito">${TIPOS_REQUISITO.map((tipo) => `<option value="${tipo}" ${item.tipo === tipo ? 'selected' : ''}>${escapeHtml(etiquetaTipo(tipo))}</option>`).join('')}</select>
      <label class="perfil-required-check"><input data-campo="obligatorio" type="checkbox" ${item.obligatorio ? 'checked' : ''}> Obligatorio</label>
      <button class="sgpa-button sgpa-button-secondary sgpa-icon-button" data-quitar-requisito="${indice}" type="button" aria-label="Eliminar"><i data-lucide="trash-2"></i></button>
      <textarea data-campo="descripcion" rows="3" placeholder="Descripción del requisito">${escapeHtml(item.descripcion || '')}</textarea>
    </article>
  `).join('') : '<p class="perfil-empty">No hay requisitos. Puede agregar el primero.</p>';
  renderizarIconos();
}

function leerRequisitosEditor(validar) {
  const filas = [...document.querySelectorAll('[data-requisito-row]')];
  const requisitos = filas.map((fila, indice) => ({
    tipo: fila.querySelector('[data-campo="tipo"]')?.value,
    obligatorio: Boolean(fila.querySelector('[data-campo="obligatorio"]')?.checked),
    orden: indice + 1,
    descripcion: fila.querySelector('[data-campo="descripcion"]')?.value?.trim() || '',
  }));
  if (validar && requisitos.some((item) => !item.descripcion)) {
    mostrarError({ titulo: 'Descripción requerida', mensaje: 'Todos los requisitos deben incluir una descripción.' });
    return null;
  }
  return requisitos;
}

async function guardarCambio(operacion, mensaje, dialog) {
  const resultado = await operacion();
  if (!resultado?.ok) {
    mostrarError({ titulo: 'No se pudo guardar', mensaje: resultado?.message || 'No fue posible actualizar el perfil.' });
    return;
  }
  dialog?.close();
  mostrarExito({ titulo: 'Perfil actualizado', mensaje });
  await recargarPerfiles();
  await cargarDetalle(perfilActual.id);
}

function campo(etiqueta, id, valor, placeholder = '', tipo = 'text') {
  return `<label class="sgpa-form-field"><span>${escapeHtml(etiqueta)}</span><input id="${id}" type="${tipo}" value="${escapeHtml(valor || '')}" placeholder="${escapeHtml(placeholder)}"></label>`;
}

function lineas(id) {
  return (document.getElementById(id)?.value || '').split('\n').map((linea) => linea.trim()).filter(Boolean);
}

function validarLineasUnicas(elementos, nombre) {
  const vistos = new Set();

  for (const elemento of elementos) {
    const clave = elemento.trim().toLocaleLowerCase('es');

    if (vistos.has(clave)) {
      mostrarError({
        titulo: `${nombre} duplicada`,
        mensaje: `La entrada "${elemento}" está repetida.`,
      });
      return false;
    }

    vistos.add(clave);
  }

  return true;
}

function etiquetaTipo(valor) {
  if (!valor) return 'No registrado';
  return String(valor).toLowerCase().split('_').map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1)).join(' ');
}

function formatearFecha(fecha) {
  if (!fecha) return null;
  const [anio, mes, dia] = String(fecha).slice(0, 10).split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
}

function mostrarFallo(mensaje) {
  const contenedor = document.getElementById('perfilesContent');
  if (contenedor) contenedor.innerHTML = `<div class="sgpa-state-message sgpa-state-message-error">${escapeHtml(mensaje)}</div>`;
}
