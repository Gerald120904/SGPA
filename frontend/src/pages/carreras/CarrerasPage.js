import {
  actualizarCarrera,
  cambiarEstadoCarrera,
  crearCarrera,
  listarCarreras,
} from '../../services/carreras.service.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { confirmarAccion } from '../../utils/confirm.js';

let carreras = [];
let instanciaActual = 0;

const GRADOS = [
  { value: 'DIPLOMADO', label: 'Diplomado' },
  { value: 'BACHILLERATO', label: 'Bachillerato' },
  { value: 'LICENCIATURA', label: 'Licenciatura' },
  { value: 'MAESTRIA', label: 'Maestría' },
  { value: 'OTRO', label: 'Otro' },
];

function formatearGrado(grado) {
  return (
    GRADOS.find((item) => item.value === grado)?.label ||
    grado ||
    'Sin especificar'
  );
}

export function CarrerasPage() {
  return `
    <section id="carrerasPage" class="module-view carreras-page">
      <div class="carreras-toolbar">
        <div>
          <h2>Carreras</h2>
          <p>Administración de las carreras académicas del SGPA.</p>
        </div>

        <button
          id="nuevaCarreraButton"
          class="carreras-primary-button"
          type="button"
        >
          <i data-lucide="plus" aria-hidden="true"></i>
          Nueva carrera
        </button>
      </div>

      <div
        id="carrerasFeedback"
        class="carreras-feedback hidden"
        role="status"
      ></div>

      <div class="carreras-filters">
        <label class="carreras-search" for="carrerasBuscar">
          <i data-lucide="search" aria-hidden="true"></i>
          <input
            id="carrerasBuscar"
            type="search"
            placeholder="Buscar por código, nombre o grado..."
            autocomplete="off"
          >
        </label>

        <select
          id="carrerasEstado"
          class="carreras-select"
          aria-label="Filtrar por estado"
        >
          <option value="TODAS">Todas</option>
          <option value="ACTIVAS">Activas</option>
          <option value="INACTIVAS">Inactivas</option>
        </select>
      </div>

      <div
        id="carrerasContent"
        class="carreras-content"
        aria-live="polite"
      >
        <div class="carreras-message">Cargando carreras...</div>
      </div>

      <dialog id="carreraDialog" class="carrera-dialog">
        <div id="carreraDialogContent"></div>
      </dialog>
    </section>
  `;
}

function mostrarFeedback(mensaje, tipo = 'success') {
  const feedback = document.getElementById('carrerasFeedback');

  if (!feedback) {
    return;
  }

  feedback.textContent = mensaje;
  feedback.className = `carreras-feedback carreras-feedback-${tipo}`;

  window.setTimeout(() => {
    feedback.classList.add('hidden');
  }, 3500);
}

function obtenerCarrerasFiltradas() {
  const busqueda =
    document.getElementById('carrerasBuscar')?.value?.trim().toLowerCase() ||
    '';
  const estado = document.getElementById('carrerasEstado')?.value || 'TODAS';

  return carreras.filter((carrera) => {
    const coincideBusqueda =
      !busqueda ||
      [carrera.codigo, carrera.nombre, formatearGrado(carrera.grado)]
        .filter(Boolean)
        .some((valor) =>
          String(valor).toLowerCase().includes(busqueda),
        );

    let coincideEstado = true;

    if (estado === 'ACTIVAS') {
      coincideEstado = carrera.activo === true;
    }

    if (estado === 'INACTIVAS') {
      coincideEstado = carrera.activo === false;
    }

    return coincideBusqueda && coincideEstado;
  });
}

function renderizarCarreras() {
  const contenedor = document.getElementById('carrerasContent');

  if (!contenedor) {
    return;
  }

  const filtradas = obtenerCarrerasFiltradas();

  if (filtradas.length === 0) {
    contenedor.innerHTML = `
      <div class="carreras-message">No se encontraron carreras.</div>
    `;
    return;
  }

  const filas = filtradas
    .map(
      (carrera) => `
        <tr>
          <td>
            <strong class="carrera-code">${escapeHtml(carrera.codigo)}</strong>
          </td>
          <td>
            <div class="carrera-name">
              <strong>${escapeHtml(carrera.nombre)}</strong>
              ${
                carrera.descripcion
                  ? `<small>${escapeHtml(carrera.descripcion)}</small>`
                  : ''
              }
            </div>
          </td>
          <td>${escapeHtml(formatearGrado(carrera.grado))}</td>
          <td>
            <span class="carrera-status ${
              carrera.activo
                ? 'carrera-status-active'
                : 'carrera-status-inactive'
            }">
              ${carrera.activo ? 'Activa' : 'Inactiva'}
            </span>
          </td>
          <td class="carreras-actions">
            <button
              class="carreras-icon-button"
              data-action="editar"
              data-id="${carrera.id}"
              type="button"
              title="Editar carrera"
            >
              <i data-lucide="pencil" aria-hidden="true"></i>
            </button>

            <button
              class="carreras-icon-button ${
                carrera.activo
                  ? 'carreras-danger-button'
                  : 'carreras-success-button'
              }"
              data-action="estado"
              data-id="${carrera.id}"
              type="button"
              title="${
                carrera.activo ? 'Desactivar carrera' : 'Activar carrera'
              }"
            >
              <i
                data-lucide="${
                  carrera.activo ? 'circle-pause' : 'circle-check'
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
    <div class="carreras-table-wrap">
      <table class="carreras-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Carrera</th>
            <th>Grado académico</th>
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

async function cargarCarreras(instancia) {
  const contenedor = document.getElementById('carrerasContent');

  if (!contenedor) {
    return;
  }

  try {
    const resultado = await listarCarreras();

    if (instancia !== instanciaActual) {
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible consultar las carreras.',
      );
    }

    carreras = Array.isArray(resultado.carreras) ? resultado.carreras : [];
    renderizarCarreras();
  } catch (error) {
    console.error('Error cargando carreras:', error);

    if (instancia !== instanciaActual) {
      return;
    }

    contenedor.innerHTML = `
      <div class="carreras-message carreras-error" role="alert">
        <h3>No fue posible cargar las carreras</h3>
        <p>${escapeHtml(error?.message || 'Error de conexión.')}</p>
      </div>
    `;
  }
}

function abrirFormulario(carrera = null) {
  const dialog = document.getElementById('carreraDialog');
  const content = document.getElementById('carreraDialogContent');

  if (!dialog || !content) {
    return;
  }

  const editando = Boolean(carrera);
  const opcionesGrado = GRADOS.map(
    (grado) => `
      <option
        value="${grado.value}"
        ${carrera?.grado === grado.value ? 'selected' : ''}
      >
        ${escapeHtml(grado.label)}
      </option>
    `,
  ).join('');

  content.innerHTML = `
    <form id="carreraForm" class="carrera-form">
      <header class="carrera-dialog-header">
        <div>
          <h3>${editando ? 'Editar carrera' : 'Nueva carrera'}</h3>
          <p>
            ${
              editando
                ? 'Actualice la información académica.'
                : 'Registre una nueva carrera en el SGPA.'
            }
          </p>
        </div>

        <button
          id="cerrarCarreraDialog"
          class="carreras-icon-button"
          type="button"
          aria-label="Cerrar"
        >
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </header>

      <div
        id="carreraFormError"
        class="carrera-form-error hidden"
        role="alert"
      ></div>

      <div class="carrera-form-grid">
        <label>
          <span>Código</span>
          <input
            id="carreraCodigo"
            name="codigo"
            type="text"
            maxlength="20"
            value="${carrera ? escapeHtml(carrera.codigo) : ''}"
            required
          >
        </label>

        <label>
          <span>Grado académico</span>
          <select id="carreraGrado" name="grado" required>
            ${
              !editando
                ? '<option value="" disabled selected>Seleccione...</option>'
                : ''
            }
            ${opcionesGrado}
          </select>
        </label>

        <label class="carrera-form-wide">
          <span>Nombre</span>
          <input
            id="carreraNombre"
            name="nombre"
            type="text"
            maxlength="150"
            value="${carrera ? escapeHtml(carrera.nombre) : ''}"
            required
          >
        </label>

        <label class="carrera-form-wide">
          <span>Descripción</span>
          <textarea
            id="carreraDescripcion"
            name="descripcion"
            maxlength="500"
            rows="4"
            placeholder="Descripción opcional de la carrera"
          >${
            carrera?.descripcion ? escapeHtml(carrera.descripcion) : ''
          }</textarea>
        </label>
      </div>

      <footer class="carrera-dialog-footer">
        <button
          id="cancelarCarreraButton"
          class="carreras-secondary-button"
          type="button"
        >
          Cancelar
        </button>

        <button
          id="guardarCarreraButton"
          class="carreras-primary-button"
          type="submit"
        >
          <i data-lucide="save" aria-hidden="true"></i>
          <span>${editando ? 'Guardar cambios' : 'Crear carrera'}</span>
        </button>
      </footer>
    </form>
  `;

  renderizarIconos();
  dialog.showModal();

  const cerrar = () => dialog.close();

  document
    .getElementById('cerrarCarreraDialog')
    ?.addEventListener('click', cerrar);
  document
    .getElementById('cancelarCarreraButton')
    ?.addEventListener('click', cerrar);

  document
    .getElementById('carreraForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const errorBox = document.getElementById('carreraFormError');
      const guardarButton = document.getElementById('guardarCarreraButton');
      const codigoInput = document.getElementById('carreraCodigo');
      const nombreInput = document.getElementById('carreraNombre');
      const gradoInput = document.getElementById('carreraGrado');
      const descripcionInput = document.getElementById('carreraDescripcion');

      if (
        !guardarButton ||
        !codigoInput ||
        !nombreInput ||
        !gradoInput ||
        !descripcionInput
      ) {
        return;
      }

      const datos = {
        codigo: codigoInput.value.trim(),
        nombre: nombreInput.value.trim(),
        grado: gradoInput.value,
        descripcion: descripcionInput.value.trim(),
      };

      errorBox?.classList.add('hidden');
      guardarButton.disabled = true;

      try {
        const resultado = editando
          ? await actualizarCarrera(carrera.id, datos)
          : await crearCarrera(datos);

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || 'No fue posible guardar la carrera.',
          );
        }

        cerrar();
        mostrarFeedback(
          editando
            ? 'Carrera actualizada correctamente.'
            : 'Carrera creada correctamente.',
        );
        await cargarCarreras(instanciaActual);
      } catch (error) {
        if (errorBox) {
          errorBox.textContent =
            error?.message || 'No fue posible guardar la carrera.';
          errorBox.classList.remove('hidden');
        }
      } finally {
        guardarButton.disabled = false;
      }
    });
}

async function alternarEstado(carrera) {
  const nuevoEstado = !carrera.activo;
  const accion = nuevoEstado ? 'activar' : 'desactivar';
  const confirmado = await confirmarAccion({
    titulo: nuevoEstado ? 'Activar carrera' : 'Desactivar carrera',
    mensaje: `¿Desea ${accion} la carrera "${carrera.nombre}"?`,
    textoConfirmar: nuevoEstado ? 'Activar' : 'Desactivar',
    peligro: !nuevoEstado,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await cambiarEstadoCarrera(carrera.id, nuevoEstado);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible cambiar el estado.',
      );
    }

    mostrarFeedback(
      nuevoEstado
        ? 'Carrera activada correctamente.'
        : 'Carrera desactivada correctamente.',
    );
    await cargarCarreras(instanciaActual);
  } catch (error) {
    mostrarFeedback(
      error?.message || 'No fue posible cambiar el estado.',
      'error',
    );
  }
}

export function iniciarCarrerasPage() {
  instanciaActual += 1;
  const instancia = instanciaActual;
  carreras = [];

  const nuevaCarreraButton = document.getElementById('nuevaCarreraButton');
  const buscar = document.getElementById('carrerasBuscar');
  const estado = document.getElementById('carrerasEstado');
  const content = document.getElementById('carrerasContent');

  nuevaCarreraButton?.addEventListener('click', () => {
    abrirFormulario();
  });
  buscar?.addEventListener('input', renderizarCarreras);
  estado?.addEventListener('change', renderizarCarreras);

  content?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');

    if (!button) {
      return;
    }

    const id = Number(button.dataset.id);
    const carrera = carreras.find((item) => item.id === id);

    if (!carrera) {
      return;
    }

    if (button.dataset.action === 'editar') {
      abrirFormulario(carrera);
      return;
    }

    if (button.dataset.action === 'estado') {
      await alternarEstado(carrera);
    }
  });

  cargarCarreras(instancia);
}
