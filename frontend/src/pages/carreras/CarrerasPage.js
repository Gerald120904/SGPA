import {
  actualizarCarrera,
  cambiarEstadoCarrera,
  crearCarrera,
  listarCarreras,
} from '../../services/carreras.service.js';
import {
  usuarioTienePermiso,
} from '../../app/session.js';
import {
  PERMISOS,
} from '../../config/permissions.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { DataTable } from '../../components/DataTable.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarExito, mostrarError } from '../../components/AlertModal.js';

let carreras = [];
let instanciaActual = 0;

function puedeGestionarCarreras() {
  return usuarioTienePermiso(
    PERMISOS.CARRERAS_GESTIONAR,
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

        ${
          puedeGestionarCarreras()
            ? `
              <button
                id="nuevaCarreraButton"
                class="carreras-primary-button"
                type="button"
              >
                <i data-lucide="plus" aria-hidden="true"></i>
                Nueva carrera
              </button>
            `
            : ''
        }
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
            placeholder="Buscar por código, nombre o descripción..."
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

      <dialog
        id="carreraDialog"
        class="sgpa-form-dialog sgpa-form-dialog-md"
      >
        <div id="carreraDialogContent"></div>
      </dialog>
    </section>
  `;
}

function mostrarFeedback(
  mensaje,
  tipo = 'success'
) {

  if (
    tipo === 'error'
  ) {

    mostrarError({

      titulo:
        'No se pudo completar la operación',

      mensaje

    });


    return;

  }


  mostrarExito({

    titulo:
      'Operación realizada correctamente',

    mensaje

  });

}

function obtenerCarrerasFiltradas() {
  const busqueda =
    document.getElementById('carrerasBuscar')?.value?.trim().toLowerCase() ||
    '';
  const estado = document.getElementById('carrerasEstado')?.value || 'TODAS';

  return carreras.filter((carrera) => {
    const coincideBusqueda =
      !busqueda ||
      [carrera.codigo, carrera.nombre, carrera.descripcion]
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

  const contenedor =
    document.getElementById(
      'carrerasContent'
    );


  if (!contenedor) {
    return;
  }


  const filtradas =
    obtenerCarrerasFiltradas();

  const puedeGestionar =
    puedeGestionarCarreras();


  const filas =
    filtradas
      .map(
        (carrera) => `
          <tr>

            <td>

              <strong class="carrera-code">
                ${escapeHtml(carrera.codigo)}
              </strong>

            </td>


            <td>

              <div class="carrera-name">

                <strong>
                  ${escapeHtml(carrera.nombre)}
                </strong>

                ${
                  carrera.descripcion
                    ? `
                        <small>
                          ${escapeHtml(carrera.descripcion)}
                        </small>
                      `
                    : ''
                }

              </div>

            </td>


            <td>

              <span
                class="
                  carrera-status
                  ${
                    carrera.activo
                      ? 'carrera-status-active'
                      : 'carrera-status-inactive'
                  }
                "
              >

                ${
                  carrera.activo
                    ? 'Activa'
                    : 'Inactiva'
                }

              </span>

            </td>


            ${
              puedeGestionar
                ? `
                  <td class="carreras-actions">

                    <button
                      class="carreras-icon-button"
                      data-action="editar"
                      data-id="${carrera.id}"
                      type="button"
                      title="Editar carrera"
                    >

                      <i
                        data-lucide="pencil"
                        aria-hidden="true"
                      ></i>

                    </button>


                    <button
                      class="
                        carreras-icon-button
                        ${
                          carrera.activo
                            ? 'carreras-danger-button'
                            : 'carreras-success-button'
                        }
                      "
                      data-action="estado"
                      data-id="${carrera.id}"
                      type="button"
                      title="${
                        carrera.activo
                          ? 'Desactivar carrera'
                          : 'Activar carrera'
                      }"
                    >

                      <i
                        data-lucide="${
                          carrera.activo
                            ? 'circle-pause'
                            : 'circle-check'
                        }"
                        aria-hidden="true"
                      ></i>

                    </button>

                  </td>
                `
                : ''
            }

          </tr>
        `
      )
      .join('');


  contenedor.innerHTML =
    DataTable({

      columns:
        puedeGestionar
          ? [
              'Código',
              'Carrera',
              'Estado',
              'Acciones',
            ]
          : [
              'Código',
              'Carrera',
              'Estado',
            ],

      rows:
        filas,

      emptyMessage:
        'No se encontraron carreras con los filtros seleccionados.',

      ariaLabel:
        'Listado de carreras'

    });


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

  if (!puedeGestionarCarreras()) {
    mostrarError({
      titulo: 'Acceso restringido',
      mensaje: 'No posee permiso para gestionar carreras.',
    });
    return;
  }

  const dialog =
    document.getElementById(
      'carreraDialog'
    );


  const content =
    document.getElementById(
      'carreraDialogContent'
    );


  if (
    !dialog ||
    !content
  ) {
    return;
  }


  const editando =
    Boolean(carrera);


  const body = `

    <label>

      <span>
        Código
      </span>

      <input
        id="carreraCodigo"
        name="codigo"
        type="text"
        maxlength="20"
        value="${
          carrera
            ? escapeHtml(carrera.codigo)
            : ''
        }"
        placeholder="Ej. INFO"
        required
      >

    </label>


    <label class="sgpa-form-wide">

      <span>
        Nombre
      </span>

      <input
        id="carreraNombre"
        name="nombre"
        type="text"
        maxlength="150"
        value="${
          carrera
            ? escapeHtml(carrera.nombre)
            : ''
        }"
        placeholder="Nombre de la carrera"
        required
      >

    </label>


    <label class="sgpa-form-wide">

      <span>
        Descripción
      </span>

      <textarea
        id="carreraDescripcion"
        name="descripcion"
        maxlength="500"
        rows="4"
        placeholder="Descripción opcional de la carrera"
      >${
        carrera?.descripcion
          ? escapeHtml(carrera.descripcion)
          : ''
      }</textarea>

    </label>

  `;


  content.innerHTML =
    FormDialog({

      formId:
        'carreraForm',

      title:
        editando
          ? 'Editar carrera'
          : 'Nueva carrera',

      description:
        editando
          ? 'Actualice la información académica de la carrera.'
          : 'Registre una nueva carrera académica en el SGPA.',

      body,

      errorId:
        'carreraFormError',

      cancelButtonId:
        'cancelarCarreraButton',

      submitButtonId:
        'guardarCarreraButton',

      submitText:
        editando
          ? 'Guardar cambios'
          : 'Crear carrera'

    });


  renderizarIconos();


  dialog.showModal();


  habilitarCierreExterior(
    dialog
  );


  const cerrar =
    () => dialog.close();


  document
    .getElementById(
      'cerrarCarreraDialog'
    )
    ?.addEventListener(
      'click',
      cerrar
    );


  document
    .getElementById(
      'cancelarCarreraButton'
    )
    ?.addEventListener(
      'click',
      cerrar
    );


  document
    .getElementById(
      'carreraForm'
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();


        const errorBox =
          document.getElementById(
            'carreraFormError'
          );


        const guardarButton =
          document.getElementById(
            'guardarCarreraButton'
          );


        const codigoInput =
          document.getElementById(
            'carreraCodigo'
          );


        const nombreInput =
          document.getElementById(
            'carreraNombre'
          );


        const descripcionInput =
          document.getElementById(
            'carreraDescripcion'
          );


        if (
          !guardarButton ||
          !codigoInput ||
          !nombreInput ||
          !descripcionInput
        ) {
          return;
        }


        const datos = {

          codigo:
            codigoInput
              .value
              .trim(),

          nombre:
            nombreInput
              .value
              .trim(),

          descripcion:
            descripcionInput
              .value
              .trim()

        };


        errorBox
          ?.classList
          .add(
            'hidden'
          );


        guardarButton.disabled =
          true;


        try {

          const resultado =
            editando
              ? await actualizarCarrera(
                  carrera.id,
                  datos
                )
              : await crearCarrera(
                  datos
                );


          if (!resultado?.ok) {

            throw new Error(
              resultado?.message ||
              'No fue posible guardar la carrera.'
            );

          }


          cerrar();


          mostrarFeedback(
            editando
              ? 'Carrera actualizada correctamente.'
              : 'Carrera creada correctamente.'
          );


          await cargarCarreras(
            instanciaActual
          );


        } catch (error) {

          mostrarError({

            titulo:
              editando
                ? 'No se pudo actualizar la carrera'
                : 'No se pudo crear la carrera',

            mensaje:
              error?.message ||
              'No fue posible guardar la carrera.'

          });

        } finally {

          guardarButton.disabled =
            false;

        }

      }
    );

}

async function alternarEstado(carrera) {
  if (!puedeGestionarCarreras()) {
    mostrarError({
      titulo: 'Acceso restringido',
      mensaje: 'No posee permiso para cambiar el estado de carreras.',
    });
    return;
  }

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
