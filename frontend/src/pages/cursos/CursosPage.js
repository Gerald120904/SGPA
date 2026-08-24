import {
  actualizarCurso,
  cambiarEstadoCurso,
  crearCurso,
  listarCursos,
} from '../../services/cursos.service.js';
import { listarCarreras } from '../../services/carreras.service.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';

let cursos = [];
let carrerasDisponibles = [];
let instanciaActual = 0;

export function CursosPage() {
  return `
    <section id="cursosPage" class="module-view cursos-page">
      <div class="cursos-toolbar">
        <div>
          <h2>Cursos</h2>
          <p>Catálogo institucional de cursos del SGPA.</p>
        </div>

        <button
          id="nuevoCursoButton"
          class="cursos-primary-button"
          type="button"
        >
          <i data-lucide="plus" aria-hidden="true"></i>
          Nuevo curso
        </button>
      </div>

      <div
        id="cursosFeedback"
        class="cursos-feedback hidden"
        role="status"
      ></div>

      <div class="cursos-filters">
        <label class="cursos-search" for="cursosBuscar">
          <i data-lucide="search" aria-hidden="true"></i>
          <input
            id="cursosBuscar"
            type="search"
            placeholder="Buscar por código o nombre..."
            autocomplete="off"
          >
        </label>

        <select
          id="cursosEstado"
          class="cursos-select"
          aria-label="Filtrar por estado"
        >
          <option value="TODOS">Todos</option>
          <option value="ACTIVOS">Activos</option>
          <option value="INACTIVOS">Inactivos</option>
        </select>
      </div>

      <div id="cursosContent" class="cursos-content" aria-live="polite">
        <div class="cursos-message">Cargando cursos...</div>
      </div>

      <dialog id="cursoDialog" class="curso-dialog">
        <div id="cursoDialogContent"></div>
      </dialog>
    </section>
  `;
}

function mostrarFeedback(mensaje, tipo = 'success') {
  const feedback = document.getElementById('cursosFeedback');

  if (!feedback) {
    return;
  }

  feedback.textContent = mensaje;
  feedback.className = `cursos-feedback cursos-feedback-${tipo}`;

  window.setTimeout(() => {
    feedback.classList.add('hidden');
  }, 3500);
}

function obtenerCursosFiltrados() {
  const busqueda =
    document.getElementById('cursosBuscar')?.value?.trim().toLowerCase() || '';
  const estado = document.getElementById('cursosEstado')?.value || 'TODOS';

  return cursos.filter((curso) => {
    const coincideBusqueda =
      !busqueda ||
      [curso.codigo, curso.nombre, curso.descripcion]
        .filter(Boolean)
        .some((valor) =>
          String(valor).toLowerCase().includes(busqueda),
        );

    let coincideEstado = true;

    if (estado === 'ACTIVOS') {
      coincideEstado = curso.activo === true;
    }

    if (estado === 'INACTIVOS') {
      coincideEstado = curso.activo === false;
    }

    return coincideBusqueda && coincideEstado;
  });
}

function renderizarCursos() {
  const contenedor = document.getElementById('cursosContent');

  if (!contenedor) {
    return;
  }

  const filtrados = obtenerCursosFiltrados();

  if (filtrados.length === 0) {
    contenedor.innerHTML = `
      <div class="cursos-message">No se encontraron cursos.</div>
    `;
    return;
  }

  const filas = filtrados
    .map(
      (curso) => `
        <tr>
          <td>
            <strong class="curso-code">${escapeHtml(curso.codigo)}</strong>
          </td>
          <td>
            <div class="curso-name">
              <strong>${escapeHtml(curso.nombre)}</strong>
              ${
                curso.descripcion
                  ? `<small>${escapeHtml(curso.descripcion)}</small>`
                  : ''
              }
            </div>
          </td>
          <td>
            <div class="curso-careers">
              ${
                Array.isArray(curso.carreras) && curso.carreras.length > 0
                  ? curso.carreras
                      .map(
                        (carrera) => `
                          <span class="curso-career-badge">
                            ${escapeHtml(carrera.nombre)}
                          </span>
                        `,
                      )
                      .join('')
                  : `
                      <span class="curso-no-career">
                        Sin carrera
                      </span>
                    `
              }
            </div>
          </td>
          <td>
            <span class="curso-status ${
              curso.activo ? 'curso-status-active' : 'curso-status-inactive'
            }">
              ${curso.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td class="cursos-actions">
            <button
              class="cursos-icon-button"
              data-action="editar"
              data-id="${curso.id}"
              type="button"
              title="Editar curso"
            >
              <i data-lucide="pencil" aria-hidden="true"></i>
            </button>

            <button
              class="cursos-icon-button ${
                curso.activo
                  ? 'cursos-danger-button'
                  : 'cursos-success-button'
              }"
              data-action="estado"
              data-id="${curso.id}"
              type="button"
              title="${curso.activo ? 'Desactivar curso' : 'Activar curso'}"
            >
              <i
                data-lucide="${
                  curso.activo ? 'circle-pause' : 'circle-check'
                }"
                aria-hidden="true"
              ></i>
            </button>
          </td>
        </tr>
      `,
    )
    .join('');

  contenedor.innerHTML = `
    <div class="cursos-table-wrap">
      <table class="cursos-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Curso</th>
            <th>Carreras</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;

  renderizarIconos();
}

async function cargarCursos(instancia) {
  const contenedor = document.getElementById('cursosContent');

  if (!contenedor) {
    return;
  }

  try {
    const resultado = await listarCursos();

    if (instancia !== instanciaActual) {
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible consultar los cursos.',
      );
    }

    cursos = Array.isArray(resultado.cursos) ? resultado.cursos : [];
    renderizarCursos();
  } catch (error) {
    console.error('Error cargando cursos:', error);

    if (instancia !== instanciaActual) {
      return;
    }

    contenedor.innerHTML = `
      <div class="cursos-message cursos-error" role="alert">
        <h3>No fue posible cargar los cursos</h3>
        <p>${escapeHtml(error?.message || 'Error de conexión.')}</p>
      </div>
    `;
  }
}

async function cargarCarrerasDisponibles() {
  const resultado = await listarCarreras();

  if (!resultado?.ok) {
    throw new Error(
      resultado?.message || 'No fue posible consultar las carreras.',
    );
  }

  carrerasDisponibles = Array.isArray(resultado.carreras)
    ? resultado.carreras
    : [];

  return carrerasDisponibles;
}

async function abrirFormulario(curso = null) {
  const dialog = document.getElementById('cursoDialog');
  const content = document.getElementById('cursoDialogContent');

  if (!dialog || !content) {
    return;
  }

  const editando = Boolean(curso);

  try {
    if (carrerasDisponibles.length === 0) {
      await cargarCarrerasDisponibles();
    }
  } catch (error) {
    mostrarFeedback(
      error?.message || 'No fue posible cargar las carreras.',
      'error',
    );
    return;
  }

  const carreraIdsSeleccionadas = new Set(
    Array.isArray(curso?.carreras)
      ? curso.carreras.map((carrera) => Number(carrera.id))
      : [],
  );

  const carrerasParaMostrar = carrerasDisponibles.filter(
    (carrera) =>
      carrera.activo === true ||
      carreraIdsSeleccionadas.has(Number(carrera.id)),
  );

  const opcionesCarreras =
    carrerasParaMostrar.length > 0
      ? carrerasParaMostrar
          .map(
            (carrera) => `
              <label class="curso-carrera-option">
                <input
                  type="checkbox"
                  name="carreraIds"
                  value="${carrera.id}"
                  ${
                    carreraIdsSeleccionadas.has(Number(carrera.id))
                      ? 'checked'
                      : ''
                  }
                >

                <span class="curso-carrera-check"></span>

                <span class="curso-carrera-info">
                  <strong>${escapeHtml(carrera.nombre)}</strong>
                  <small>
                    ${escapeHtml(carrera.codigo)}${
                      carrera.activo ? '' : ' · Inactiva'
                    }
                  </small>
                </span>
              </label>
            `,
          )
          .join('')
      : `
          <div class="curso-carreras-empty">
            No hay carreras disponibles.
            Primero debe registrar una carrera.
          </div>
        `;

  content.innerHTML = `
    <form id="cursoForm" class="curso-form">
      <header class="curso-dialog-header">
        <div>
          <h3>${editando ? 'Editar curso' : 'Nuevo curso'}</h3>
          <p>
            ${
              editando
                ? 'Actualice la información y las carreras asociadas.'
                : 'Registre un curso y seleccione las carreras a las que pertenece.'
            }
          </p>
        </div>

        <button
          id="cerrarCursoDialog"
          class="cursos-icon-button"
          type="button"
          aria-label="Cerrar"
        >
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </header>

      <div
        id="cursoFormError"
        class="curso-form-error hidden"
        role="alert"
      ></div>

      <div class="curso-form-grid">
        <label>
          <span>Código</span>
          <input
            id="cursoCodigo"
            name="codigo"
            type="text"
            maxlength="30"
            value="${curso ? escapeHtml(curso.codigo) : ''}"
            placeholder="Ej. EIF201"
            required
          >
        </label>

        <label class="curso-form-wide">
          <span>Nombre</span>
          <input
            id="cursoNombre"
            name="nombre"
            type="text"
            maxlength="150"
            value="${curso ? escapeHtml(curso.nombre) : ''}"
            placeholder="Ej. Programación I"
            required
          >
        </label>

        <label class="curso-form-wide">
          <span>Descripción</span>
          <textarea
            id="cursoDescripcion"
            name="descripcion"
            maxlength="500"
            rows="4"
            placeholder="Descripción opcional del curso"
          >${curso?.descripcion ? escapeHtml(curso.descripcion) : ''}</textarea>
        </label>

        <div class="curso-form-wide">
          <div class="curso-carreras-header">
            <div>
              <span class="curso-carreras-title">Carreras asociadas</span>
              <small>Seleccione una o varias carreras.</small>
            </div>

            <span
              id="cursoCarrerasContador"
              class="curso-carreras-count"
            >
              ${carreraIdsSeleccionadas.size} seleccionada${
                carreraIdsSeleccionadas.size === 1 ? '' : 's'
              }
            </span>
          </div>

          <div id="cursoCarrerasLista" class="curso-carreras-list">
            ${opcionesCarreras}
          </div>
        </div>
      </div>

      <footer class="curso-dialog-footer">
        <button
          id="cancelarCursoButton"
          class="cursos-secondary-button"
          type="button"
        >
          Cancelar
        </button>

        <button
          id="guardarCursoButton"
          class="cursos-primary-button"
          type="submit"
        >
          <i data-lucide="save" aria-hidden="true"></i>
          <span>${editando ? 'Guardar cambios' : 'Crear curso'}</span>
        </button>
      </footer>
    </form>
  `;

  renderizarIconos();
  dialog.showModal();

  const actualizarContador = () => {
    const seleccionadas = document.querySelectorAll(
      'input[name="carreraIds"]:checked',
    ).length;
    const contador = document.getElementById('cursoCarrerasContador');

    if (contador) {
      contador.textContent = `${seleccionadas} seleccionada${
        seleccionadas === 1 ? '' : 's'
      }`;
    }
  };

  document
    .getElementById('cursoCarrerasLista')
    ?.addEventListener('change', actualizarContador);

  const cerrar = () => dialog.close();

  document
    .getElementById('cerrarCursoDialog')
    ?.addEventListener('click', cerrar);
  document
    .getElementById('cancelarCursoButton')
    ?.addEventListener('click', cerrar);

  document
    .getElementById('cursoForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const errorBox = document.getElementById('cursoFormError');
      const guardarButton = document.getElementById('guardarCursoButton');
      const codigoInput = document.getElementById('cursoCodigo');
      const nombreInput = document.getElementById('cursoNombre');
      const descripcionInput = document.getElementById('cursoDescripcion');

      if (!guardarButton || !codigoInput || !nombreInput || !descripcionInput) {
        return;
      }

      const carreraIds = Array.from(
        document.querySelectorAll('input[name="carreraIds"]:checked'),
      ).map((input) => Number(input.value));

      if (carreraIds.length === 0) {
        if (errorBox) {
          errorBox.textContent = 'Debe seleccionar al menos una carrera.';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      const datos = {
        codigo: codigoInput.value.trim(),
        nombre: nombreInput.value.trim(),
        descripcion: descripcionInput.value.trim(),
        carreraIds,
      };

      errorBox?.classList.add('hidden');
      guardarButton.disabled = true;

      try {
        const resultado = editando
          ? await actualizarCurso(curso.id, datos)
          : await crearCurso(datos);

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || 'No fue posible guardar el curso.',
          );
        }

        cerrar();
        mostrarFeedback(
          editando
            ? 'Curso actualizado correctamente.'
            : 'Curso creado correctamente.',
        );
        await cargarCursos(instanciaActual);
      } catch (error) {
        if (errorBox) {
          errorBox.textContent =
            error?.message || 'No fue posible guardar el curso.';
          errorBox.classList.remove('hidden');
        }
      } finally {
        guardarButton.disabled = false;
      }
    });
}

async function alternarEstado(curso) {
  const nuevoEstado = !curso.activo;
  const confirmado = await confirmarAccion({
    titulo: nuevoEstado ? 'Activar curso' : 'Desactivar curso',
    mensaje: nuevoEstado
      ? `¿Desea activar el curso "${curso.nombre}"?`
      : `¿Desea desactivar el curso "${curso.nombre}"?`,
    textoConfirmar: nuevoEstado ? 'Activar' : 'Desactivar',
    peligro: !nuevoEstado,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await cambiarEstadoCurso(curso.id, nuevoEstado);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible cambiar el estado.',
      );
    }

    mostrarFeedback(
      nuevoEstado
        ? 'Curso activado correctamente.'
        : 'Curso desactivado correctamente.',
    );
    await cargarCursos(instanciaActual);
  } catch (error) {
    mostrarFeedback(
      error?.message || 'No fue posible cambiar el estado.',
      'error',
    );
  }
}

export function iniciarCursosPage() {
  instanciaActual += 1;
  const instancia = instanciaActual;
  cursos = [];

  const nuevoCursoButton = document.getElementById('nuevoCursoButton');
  const buscar = document.getElementById('cursosBuscar');
  const estado = document.getElementById('cursosEstado');
  const content = document.getElementById('cursosContent');

  nuevoCursoButton?.addEventListener('click', () => {
    void abrirFormulario();
  });
  buscar?.addEventListener('input', renderizarCursos);
  estado?.addEventListener('change', renderizarCursos);

  content?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');

    if (!button) {
      return;
    }

    const id = Number(button.dataset.id);
    const curso = cursos.find((item) => item.id === id);

    if (!curso) {
      return;
    }

    if (button.dataset.action === 'editar') {
      void abrirFormulario(curso);
      return;
    }

    if (button.dataset.action === 'estado') {
      await alternarEstado(curso);
    }
  });

  void cargarCursos(instancia);
}
