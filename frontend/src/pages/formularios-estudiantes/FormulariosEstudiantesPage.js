import {
  listarFormulariosEstudiantes
} from '../../services/formularios-estudiantes.service.js';

import {
  mostrarError
} from '../../components/AlertModal.js';

import {
  escapeHtml
} from '../../utils/html.js';

import {
  DataTable
} from '../../components/DataTable.js';

import {
  renderizarIconos
} from '../../utils/icons.js';

let formularios = [];

export function FormulariosEstudiantesPage() {
  return `
    <section
      id="formulariosEstudiantesPage"
      class="module-view"
    >
      <div class="planes-toolbar">
        <div>
          <h2>
            Formularios de estudiantes
          </h2>

          <p>
            Gestión de formularios para
            recolección de información académica.
          </p>
        </div>
      </div>

      <div
        id="formulariosEstudiantesContent"
        aria-live="polite"
      >
        ${DataTable({
          columns: [
            'Título',
            'Carrera',
            'Plan de estudio',
            'Estado',
            'Respuestas',
            'Acciones'
          ],
          rows: '',
          emptyMessage:
            'No hay formularios registrados.',
          ariaLabel:
            'Formularios de estudiantes'
        })}
      </div>
    </section>
  `;
}

function renderizarFilaFormulario(
  formulario
) {
  const carrera =
    formulario.carrera?.nombre ||
    'Sin carrera';

  const plan =
    formulario.planEstudio?.nombre ||
    'Sin plan';

  const total =
    formulario.totalRespuestas ?? 0;

  const pendientes =
    formulario.pendientes ?? 0;

  const revision =
    formulario.requierenRevision ?? 0;

  return `
    <tr
      data-formulario-id="${formulario.id}"
    >
      <td>
        <strong>
          ${escapeHtml(
            formulario.titulo
          )}
        </strong>
      </td>

      <td>
        ${escapeHtml(carrera)}
      </td>

      <td>
        ${escapeHtml(plan)}
      </td>

      <td>
        ${escapeHtml(
          formulario.estado
        )}
      </td>

      <td>
        <div>
          <strong>${total}</strong>
          total
        </div>

        <small>
          ${pendientes} pendientes
          ·
          ${revision} revisión
        </small>
      </td>

      <td>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          data-action="ver-formulario"
          data-id="${formulario.id}"
          disabled
          title="Disponible en el siguiente bloque"
        >
          <i
            data-lucide="eye"
            aria-hidden="true"
          ></i>

          Ver
        </button>
      </td>
    </tr>
  `;
}

function renderizarTabla() {
  const contenedor =
    document.getElementById(
      'formulariosEstudiantesContent'
    );

  if (!contenedor) return;

  const rows = formularios
    .map(renderizarFilaFormulario)
    .join('');

  contenedor.innerHTML = DataTable({
    columns: [
      'Título',
      'Carrera',
      'Plan de estudio',
      'Estado',
      'Respuestas',
      'Acciones'
    ],
    rows,
    emptyMessage:
      'No hay formularios registrados.',
    ariaLabel:
      'Formularios de estudiantes'
  });

  renderizarIconos();
}

function renderizarCarga() {
  const contenedor =
    document.getElementById(
      'formulariosEstudiantesContent'
    );

  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="empty-state">
      <i
        data-lucide="loader-circle"
        aria-hidden="true"
      ></i>

      <p>
        Cargando formularios...
      </p>
    </div>
  `;

  renderizarIconos();
}

export async function iniciarFormulariosEstudiantesPage() {
  renderizarCarga();

  try {
    const resultado =
      await listarFormulariosEstudiantes();

    if (resultado && resultado.ok === false) {
      throw new Error(
        resultado.message || 'No fue posible consultar los formularios.'
      );
    }

    const data = resultado?.data ?? resultado;

    formularios =
      Array.isArray(data)
        ? data
        : [];

    renderizarTabla();
  } catch (error) {
    console.error(
      'Error al listar formularios:',
      error
    );

    formularios = [];
    renderizarTabla();

    mostrarError({
      titulo:
        'No fue posible cargar los formularios',
      mensaje:
        error?.message ||
        'Ocurrió un error al consultar los formularios.'
    });
  }
}
