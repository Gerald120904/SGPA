import {
  actualizarCurso,
  cambiarEstadoCurso,
  crearCurso,
  listarAsignaturasDisponiblesCurso,
  listarCursos,
} from '../../services/cursos.service.js';
import { listarCarreras } from '../../services/carreras.service.js';
import { listarPlanesEstudio } from '../../services/planes-estudio.service.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { DataTable } from '../../components/DataTable.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarExito, mostrarError } from '../../components/AlertModal.js';

let cursos = [];
let carrerasDisponibles = [];
let planesDisponibles = [];
let asignaturasDisponibles = [];
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

  <dialog
    id="cursoDialog"
    class="sgpa-form-dialog sgpa-form-dialog-lg"
  >
    <div id="cursoDialogContent"></div>
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

  const contenedor =
    document.getElementById(
      'cursosContent'
    );


  if (!contenedor) {
    return;
  }


  const filtrados =
    obtenerCursosFiltrados();


  const filas =
    filtrados
      .map(
        (curso) => `
          <tr>

            <td>

              <strong class="curso-code">
                ${escapeHtml(curso.codigo)}
              </strong>

            </td>


            <td>

              <div class="curso-name">

                <strong>
                  ${escapeHtml(curso.nombre)}
                </strong>

                ${
                  curso.descripcion
                    ? `
                        <small>
                          ${escapeHtml(curso.descripcion)}
                        </small>
                      `
                    : ''
                }

              </div>

            </td>


            <td>

              <div class="curso-careers">

                ${
                  Array.isArray(curso.carreras) &&
                  curso.carreras.length > 0
                    ? curso.carreras
                        .map(
                          (carrera) => `
                            <span class="curso-career-badge">
                              ${escapeHtml(carrera.nombre)}
                            </span>
                          `
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

              <span
                class="
                  curso-status
                  ${
                    curso.activo
                      ? 'curso-status-active'
                      : 'curso-status-inactive'
                  }
                "
              >

                ${
                  curso.activo
                    ? 'Activo'
                    : 'Inactivo'
                }

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

                <i
                  data-lucide="pencil"
                  aria-hidden="true"
                ></i>

              </button>


              <button
                class="
                  cursos-icon-button
                  ${
                    curso.activo
                      ? 'cursos-danger-button'
                      : 'cursos-success-button'
                  }
                "
                data-action="estado"
                data-id="${curso.id}"
                type="button"
                title="${
                  curso.activo
                    ? 'Desactivar curso'
                    : 'Activar curso'
                }"
              >

                <i
                  data-lucide="${
                    curso.activo
                      ? 'circle-pause'
                      : 'circle-check'
                  }"
                  aria-hidden="true"
                ></i>

              </button>

            </td>

          </tr>
        `
      )
      .join('');


  contenedor.innerHTML =
    DataTable({

      columns: [
        'Código',
        'Curso',
        'Carreras',
        'Estado',
        'Acciones'
      ],

      rows:
        filas,

      emptyMessage:
        'No se encontraron cursos con los filtros seleccionados.',

      ariaLabel:
        'Listado de cursos'

    });


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

async function cargarPlanesDisponibles() {
  const resultado = await listarPlanesEstudio();

  if (!resultado?.ok) {
    throw new Error(
      resultado?.message ||
        'No fue posible consultar los planes de estudio.',
    );
  }

  planesDisponibles = Array.isArray(resultado.planes)
    ? resultado.planes
    : [];

  return planesDisponibles;
}

async function abrirFormulario(curso = null) {

  const dialog =
    document.getElementById(
      'cursoDialog'
    );


  const content =
    document.getElementById(
      'cursoDialogContent'
    );


  if (
    !dialog ||
    !content
  ) {
    return;
  }


  const editando =
    Boolean(curso);


  /* =======================================================
     EDITAR
     ======================================================= */

  if (editando) {

    const body = `

      <label>

        <span>
          Código
        </span>

        <input
          type="text"
          value="${escapeHtml(curso.codigo)}"
          disabled
        >

      </label>


      <label class="sgpa-form-wide">

        <span>
          Nombre
        </span>

        <input
          type="text"
          value="${escapeHtml(curso.nombre)}"
          disabled
        >

      </label>


      <label class="sgpa-form-wide">

        <span>
          Descripción
        </span>

        <textarea
          id="cursoDescripcion"
          maxlength="500"
          rows="4"
          placeholder="Descripción opcional del curso"
        >${
          curso.descripcion
            ? escapeHtml(curso.descripcion)
            : ''
        }</textarea>

      </label>

    `;


content.innerHTML = FormDialog({
  formId: 'cursoForm',
  title: 'Nuevo curso',
  description:
    'Seleccione una asignatura existente dentro de un plan de estudio.',
  body,
  errorId: 'cursoFormError',
  cancelButtonId: 'cancelarCursoButton',
  submitButtonId: 'guardarCursoButton',
  submitText: 'Crear curso',
});


    renderizarIconos();
    dialog.showModal();
    habilitarCierreExterior(dialog);


    const cerrar = () => dialog.close();

    document
  .getElementById('cancelarCursoButton')
  ?.addEventListener('click', cerrar);

    document
      .getElementById(
        'cursoForm'
      )
      ?.addEventListener(
        'submit',
        async (event) => {

          event.preventDefault();


          const descripcionInput =
            document.getElementById(
              'cursoDescripcion'
            );


          const guardarButton =
            document.getElementById(
              'guardarCursoButton'
            );


          const errorBox =
            document.getElementById(
              'cursoFormError'
            );


          if (
            !descripcionInput ||
            !guardarButton
          ) {
            return;
          }


          guardarButton.disabled =
            true;


          errorBox
            ?.classList
            .add(
              'hidden'
            );


          try {

            const resultado =
              await actualizarCurso(
                curso.id,
                {
                  descripcion:
                    descripcionInput
                      .value
                      .trim()
                }
              );


            if (!resultado?.ok) {

              throw new Error(
                resultado?.message ||
                'No fue posible actualizar el curso.'
              );

            }


            cerrar();


            mostrarFeedback(
              'Curso actualizado correctamente.'
            );


            await cargarCursos(
              instanciaActual
            );


          } catch (error) {

mostrarError({

  titulo:
    editando
      ? 'No se pudo actualizar el curso'
      : 'No se pudo crear el curso',

  mensaje:
    error?.message ||
    'No fue posible guardar el curso.'

});


          } finally {

            guardarButton.disabled =
              false;

          }

        }
      );


    return;

  }


  /* =======================================================
     CARGAR INFORMACIÓN PARA NUEVO CURSO
     ======================================================= */

  try {

    if (
      carrerasDisponibles.length === 0
    ) {

      await cargarCarrerasDisponibles();

    }


    if (
      planesDisponibles.length === 0
    ) {

      await cargarPlanesDisponibles();

    }


  } catch (error) {

    mostrarFeedback(
      error?.message ||
      'No fue posible cargar la información académica.',
      'error'
    );


    return;

  }


  const carrerasActivas =
    carrerasDisponibles.filter(
      (carrera) =>
        carrera.activo === true
    );


  const opcionesCarrera =
    carrerasActivas
      .map(
        (carrera) => `
          <option value="${carrera.id}">
            ${escapeHtml(carrera.codigo)}
            -
            ${escapeHtml(carrera.nombre)}
          </option>
        `
      )
      .join('');


  const body = `

    <label class="sgpa-form-wide">

      <span>
        Carrera
      </span>

      <select
        id="cursoCarrera"
        required
      >

        <option value="">
          Seleccione una carrera
        </option>

        ${opcionesCarrera}

      </select>

    </label>


    <label class="sgpa-form-wide">

      <span>
        Plan de estudio
      </span>

      <select
        id="cursoPlan"
        required
        disabled
      >

        <option value="">
          Primero seleccione una carrera
        </option>

      </select>

    </label>


    <label>

      <span>
        Nivel / Año
      </span>

      <select
        id="cursoNivel"
        required
        disabled
      >

        <option value="">
          Seleccione un plan
        </option>

      </select>

    </label>


    <label>

      <span>
        Ciclo / Semestre
      </span>

      <select
        id="cursoCiclo"
        required
        disabled
      >

        <option value="">
          Seleccione un nivel
        </option>

      </select>

    </label>


    <label class="sgpa-form-wide">

      <span>
        Asignatura del plan
      </span>

      <select
        id="cursoAsignatura"
        required
        disabled
      >

        <option value="">
          Seleccione un ciclo
        </option>

      </select>

    </label>


    <div
      id="cursoAsignaturaDetalle"
      class="
        sgpa-form-wide
        curso-asignatura-detalle
      "
    ></div>


    <label class="sgpa-form-wide">

      <span>
        Descripción
      </span>

      <textarea
        id="cursoDescripcion"
        maxlength="500"
        rows="4"
        placeholder="Descripción opcional del curso"
      ></textarea>

    </label>

  `;


  content.innerHTML =
    FormDialog({

      formId:
        'cursoForm',

      title:
        'Nuevo curso',

      description:
        'Seleccione una asignatura existente dentro de un plan de estudio.',

      body,

      errorId:
        'cursoFormError',

      closeButtonId:
        'cerrarCursoDialog',

      cancelButtonId:
        'cancelarCursoButton',

      submitButtonId:
        'guardarCursoButton',

      submitText:
        'Crear curso'

    });


  renderizarIconos();


  dialog.showModal();


  const carreraSelect =
    document.getElementById(
      'cursoCarrera'
    );


  const planSelect =
    document.getElementById(
      'cursoPlan'
    );


  const nivelSelect =
    document.getElementById(
      'cursoNivel'
    );


  const cicloSelect =
    document.getElementById(
      'cursoCiclo'
    );


  const asignaturaSelect =
    document.getElementById(
      'cursoAsignatura'
    );


  const detalle =
    document.getElementById(
      'cursoAsignaturaDetalle'
    );


  const descripcionInput =
    document.getElementById(
      'cursoDescripcion'
    );


  const errorBox =
    document.getElementById(
      'cursoFormError'
    );


  const guardarButton =
    document.getElementById(
      'guardarCursoButton'
    );


  const cerrar =
    () => dialog.close();


  document
    .getElementById(
      'cerrarCursoDialog'
    )
    ?.addEventListener(
      'click',
      cerrar
    );


  document
    .getElementById(
      'cancelarCursoButton'
    )
    ?.addEventListener(
      'click',
      cerrar
    );


  /* =======================================================
     CARRERA
     ======================================================= */

  carreraSelect
    ?.addEventListener(
      'change',
      () => {

        const carreraId =
          Number(
            carreraSelect.value
          );


        asignaturasDisponibles =
          [];


        nivelSelect.innerHTML =
          '<option value="">Seleccione un plan</option>';


        nivelSelect.disabled =
          true;


        cicloSelect.innerHTML =
          '<option value="">Seleccione un nivel</option>';


        cicloSelect.disabled =
          true;


        asignaturaSelect.innerHTML =
          '<option value="">Seleccione un ciclo</option>';


        asignaturaSelect.disabled =
          true;


        detalle.innerHTML =
          '';


        errorBox
          ?.classList
          .add(
            'hidden'
          );


        if (!carreraId) {

          planSelect.innerHTML =
            '<option value="">Primero seleccione una carrera</option>';


          planSelect.disabled =
            true;


          return;

        }


        const planesCarrera =
          planesDisponibles.filter(
            (plan) =>
              plan.activo === true &&
              Number(plan.carreraId) ===
                carreraId
          );


        if (
          planesCarrera.length === 0
        ) {

          planSelect.innerHTML = `
            <option value="">
              No existen planes activos para esta carrera
            </option>
          `;


          planSelect.disabled =
            true;


          return;

        }


        planSelect.innerHTML = `
          <option value="">
            Seleccione un plan
          </option>

          ${
            planesCarrera
              .map(
                (plan) => `
                  <option value="${plan.id}">
                    ${escapeHtml(plan.codigo)}
                    -
                    ${escapeHtml(plan.nombre)}
                  </option>
                `
              )
              .join('')
          }
        `;


        planSelect.disabled =
          false;

      }
    );


  /* =======================================================
     PLAN
     ======================================================= */

  planSelect
    ?.addEventListener(
      'change',
      async () => {

        const carreraId =
          Number(
            carreraSelect.value
          );


        const planId =
          Number(
            planSelect.value
          );


        asignaturasDisponibles =
          [];


        nivelSelect.disabled =
          true;


        cicloSelect.innerHTML =
          '<option value="">Seleccione un nivel</option>';


        cicloSelect.disabled =
          true;


        asignaturaSelect.innerHTML =
          '<option value="">Seleccione un ciclo</option>';


        asignaturaSelect.disabled =
          true;


        detalle.innerHTML =
          '';


        errorBox
          ?.classList
          .add(
            'hidden'
          );


        if (!planId) {

          nivelSelect.innerHTML =
            '<option value="">Seleccione un plan</option>';


          return;

        }


        nivelSelect.innerHTML =
          '<option value="">Cargando...</option>';


        try {

          const resultado =
            await listarAsignaturasDisponiblesCurso({
              carreraId,
              planId
            });


          if (
            Number(planSelect.value) !==
            planId
          ) {
            return;
          }


          if (!resultado?.ok) {

            throw new Error(
              resultado?.message ||
              'No fue posible consultar las asignaturas.'
            );

          }


          asignaturasDisponibles =
            Array.isArray(
              resultado.asignaturas
            )
              ? resultado.asignaturas
              : [];


          if (
            asignaturasDisponibles.length === 0
          ) {

            nivelSelect.innerHTML = `
              <option value="">
                Este plan no tiene asignaturas disponibles
              </option>
            `;


            return;

          }


          const niveles = [
            ...new Set(
              asignaturasDisponibles.map(
                (item) =>
                  Number(item.nivel)
              )
            )
          ]
            .sort(
              (a, b) =>
                a - b
            );


          nivelSelect.innerHTML = `
            <option value="">
              Seleccione un nivel
            </option>

            ${
              niveles
                .map(
                  (nivel) => `
                    <option value="${nivel}">
                      Nivel ${nivel}
                    </option>
                  `
                )
                .join('')
            }
          `;


          nivelSelect.disabled =
            false;


        } catch (error) {

          if (
            Number(planSelect.value) !==
            planId
          ) {
            return;
          }


          nivelSelect.innerHTML =
            '<option value="">Error cargando asignaturas</option>';


          if (errorBox) {

            errorBox.textContent =
              error?.message ||
              'No fue posible consultar las asignaturas.';


            errorBox.classList.remove(
              'hidden'
            );

          }

        }

      }
    );


  /* =======================================================
     NIVEL
     ======================================================= */

  nivelSelect
    ?.addEventListener(
      'change',
      () => {

        const nivel =
          Number(
            nivelSelect.value
          );


        detalle.innerHTML =
          '';


        asignaturaSelect.innerHTML =
          '<option value="">Seleccione un ciclo</option>';


        asignaturaSelect.disabled =
          true;


        if (!nivel) {

          cicloSelect.innerHTML =
            '<option value="">Seleccione un nivel</option>';


          cicloSelect.disabled =
            true;


          return;

        }


        const ciclos = [
          ...new Set(
            asignaturasDisponibles
              .filter(
                (item) =>
                  Number(item.nivel) ===
                  nivel
              )
              .map(
                (item) =>
                  Number(item.ciclo)
              )
          )
        ]
          .sort(
            (a, b) =>
              a - b
          );


        cicloSelect.innerHTML = `
          <option value="">
            Seleccione un ciclo
          </option>

          ${
            ciclos
              .map(
                (ciclo) => `
                  <option value="${ciclo}">
                    Ciclo ${ciclo}
                  </option>
                `
              )
              .join('')
          }
        `;


        cicloSelect.disabled =
          false;

      }
    );


  /* =======================================================
     CICLO
     ======================================================= */

  cicloSelect
    ?.addEventListener(
      'change',
      () => {

        const nivel =
          Number(
            nivelSelect.value
          );


        const ciclo =
          Number(
            cicloSelect.value
          );


        detalle.innerHTML =
          '';


        if (!ciclo) {

          asignaturaSelect.innerHTML =
            '<option value="">Seleccione un ciclo</option>';


          asignaturaSelect.disabled =
            true;


          return;

        }


        const asignaturas =
          asignaturasDisponibles.filter(
            (item) =>
              Number(item.nivel) ===
                nivel &&
              Number(item.ciclo) ===
                ciclo
          );


        asignaturaSelect.innerHTML = `
          <option value="">
            Seleccione una asignatura
          </option>

          ${
            asignaturas
              .map(
                (item) => `
                  <option value="${item.id}">
                    ${escapeHtml(item.codigoReferencia)}
                    -
                    ${escapeHtml(item.nombreReferencia)}
                  </option>
                `
              )
              .join('')
          }
        `;


        asignaturaSelect.disabled =
          asignaturas.length === 0;

      }
    );


  /* =======================================================
     ASIGNATURA
     ======================================================= */

  asignaturaSelect
    ?.addEventListener(
      'change',
      () => {

        const asignaturaId =
          Number(
            asignaturaSelect.value
          );


        const asignatura =
          asignaturasDisponibles.find(
            (item) =>
              Number(item.id) ===
              asignaturaId
          );


        if (!asignatura) {

          detalle.innerHTML =
            '';


          return;

        }


        detalle.innerHTML = `
          <div class="curso-selected-subject">

            <strong>
              ${escapeHtml(asignatura.codigoReferencia)}
              -
              ${escapeHtml(asignatura.nombreReferencia)}
            </strong>

            <small>
              Nivel ${asignatura.nivel}
              ·
              Ciclo ${asignatura.ciclo}
              ·
              ${asignatura.creditos} créditos
            </small>

          </div>
        `;

      }
    );


  /* =======================================================
     GUARDAR
     ======================================================= */

  document
    .getElementById(
      'cursoForm'
    )
    ?.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();


        const planAsignaturaId =
          Number(
            asignaturaSelect.value
          );


        if (!planAsignaturaId) {

          if (errorBox) {

            errorBox.textContent =
              'Debe seleccionar una asignatura del plan.';


            errorBox.classList.remove(
              'hidden'
            );

          }


          return;

        }


        if (!guardarButton) {
          return;
        }


        errorBox
          ?.classList
          .add(
            'hidden'
          );


        guardarButton.disabled =
          true;


        try {

          const resultado =
            await crearCurso({

              planAsignaturaId,

              descripcion:
                descripcionInput
                  ?.value
                  ?.trim() ||
                ''

            });


          if (!resultado?.ok) {

            throw new Error(
              resultado?.message ||
              'No fue posible crear el curso.'
            );

          }


          cerrar();


          mostrarFeedback(
            'Curso creado correctamente.'
          );


          await cargarCursos(
            instanciaActual
          );


        } catch (error) {

          if (errorBox) {

            errorBox.textContent =
              error?.message ||
              'No fue posible crear el curso.';


            errorBox.classList.remove(
              'hidden'
            );

          }


        } finally {

          guardarButton.disabled =
            false;

        }

      }
    );

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
