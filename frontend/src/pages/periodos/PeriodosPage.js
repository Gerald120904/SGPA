import {
  listarPeriodosAcademicos,
} from "../../services/periodos.service.js";

import {
  DataTable,
} from "../../components/DataTable.js";

import {
  StatusBadge,
} from "../../components/StatusBadge.js";

import {
  FormDialog,
  habilitarCierreExterior,
} from "../../components/FormDialog.js";

import {
  escapeHtml,
} from "../../utils/html.js";

import {
  usuarioTienePermiso,
  obtenerRolActivo,
} from "../../app/session.js";

import {
  PERMISOS,
} from "../../config/permissions.js";

import {
  renderizarIconos,
} from "../../utils/icons.js";

import {
  ESTADOS_PERIODO as ESTADOS,
  TRANSICIONES_PERIODO as TRANSICIONES,
  obtenerTonoEstadoPeriodo as obtenerTonoEstado,
  obtenerNombreEstadoPeriodo as obtenerNombreEstado,
  obtenerNombreCicloPeriodo as obtenerNombreCiclo,
  formatearFechaPeriodo as formatearFecha,
  esPeriodoEditable as periodoEditable,
  filtrarPeriodosAcademicos,
  calcularFechaMaximaDisponibilidad,
  validarYConstruirDatosPeriodo,
} from "./periodos.helpers.js";
import {
  ejecutarGuardadoPeriodo,
  ejecutarCambioEstadoPeriodo,
} from "./PeriodoAcciones.js";

export {
  ESTADOS,
  TRANSICIONES,
  obtenerTonoEstado,
  obtenerNombreEstado,
  obtenerNombreCiclo,
  formatearFecha,
  periodoEditable,
};

let periodos = [];
let instanciaActual = 0;


function puedeGestionarPeriodos() {
  return usuarioTienePermiso(
    PERMISOS.PERIODOS_GESTIONAR,
  );
}


/* =========================================================
   PÁGINA
   ========================================================= */

export function PeriodosPage() {
  return `
    <section
      id="periodosPage"
      class="module-view periodos-page"
    >

      <div class="periodos-toolbar">

        <div>

          <h2>
            Periodos académicos
          </h2>

          <p>
            Administración de ciclos,
            fechas y estados académicos.
          </p>

        </div>


        ${
          puedeGestionarPeriodos()
            ? `
              <button
                id="nuevoPeriodoButton"
                class="periodos-primary-button"
                type="button"
              >
                <i
                  data-lucide="plus"
                  aria-hidden="true"
                ></i>

                Nuevo periodo
              </button>
            `
            : ''
        }

      </div>


      <div class="periodos-filters">

        <label
          class="periodos-search"
          for="periodosBuscar"
        >

          <i
            data-lucide="search"
            aria-hidden="true"
          ></i>

          <input
            id="periodosBuscar"
            type="search"
            placeholder="Buscar periodo..."
            autocomplete="off"
          >

        </label>


        <select
          id="periodosEstado"
          class="periodos-select"
          aria-label="Filtrar por estado"
        >

          <option value="">
            Todos los estados
          </option>

          <option value="BORRADOR">
            Borrador
          </option>

          <option value="EN_PREPARACION">
            En preparación
          </option>

          <option value="EN_CURSO">
            En curso
          </option>

          <option value="CERRADO">
            Cerrado
          </option>

          <option value="CANCELADO">
            Cancelado
          </option>

        </select>

      </div>


      <div
        id="periodosContent"
        class="periodos-content"
        aria-live="polite"
      >

        <div class="periodos-message">
          Cargando periodos académicos...
        </div>

      </div>


      <dialog
        id="periodoDialog"
        class="
          sgpa-form-dialog
          sgpa-form-dialog-md
        "
      >

        <div
          id="periodoDialogContent"
        ></div>

      </dialog>

    </section>
  `;
}


/* =========================================================
   FILTROS
   ========================================================= */

function obtenerPeriodosFiltrados() {
  const busqueda =
    document.getElementById("periodosBuscar")?.value?.trim() || "";
  const estado =
    document.getElementById("periodosEstado")?.value || "";

  return filtrarPeriodosAcademicos(periodos, busqueda, estado);
}


/* =========================================================
   RENDER TABLA
   ========================================================= */

function renderizarPeriodos() {
  const contenedor =
    document.getElementById(
      "periodosContent",
    );


  if (!contenedor) {
    return;
  }


  const filtrados =
    obtenerPeriodosFiltrados();

  const puedeGestionar =
    puedeGestionarPeriodos();


  const filas =
    filtrados
      .map(
        (periodo) => {

          const transiciones =
            TRANSICIONES[
              periodo.estado
            ] || [];


          const informacionBackend =
            Array.isArray(
              periodo.transicionesEstado,
            )
              ? periodo.transicionesEstado
              : [];


          const accionesEstado =
            puedeGestionar
              ? transiciones
                  .map(
                    (transicion) => {
                      const informacion =
                        informacionBackend.find(
                          (item) =>
                            item.estado ===
                            transicion.estado,
                        );

                      const disponible =
                        informacion
                          ?.disponible !==
                        false;

                      const motivo =
                        informacion?.motivo ||
                        "";

                      return `
                        <div
                          class="periodos-transition-wrapper"
                        >
                          <button
                            class="
                              periodos-transition-button
                              ${
                                transicion.peligro
                                  ? "periodos-danger-button"
                                  : ""
                              }
                            "
                            type="button"
                            data-action="estado"
                            data-id="${periodo.id}"
                            data-estado="${transicion.estado}"
                            aria-disabled="${disponible ? "false" : "true"}"
                            title="${escapeHtml(
                              motivo ||
                                transicion.titulo,
                            )}"
                          >
                            ${escapeHtml(
                              transicion.texto,
                            )}
                          </button>

                        </div>
                      `;
                    },
                  )
                  .join("")
              : "";


          return `
            <tr>

              <td data-label="Código">
                <strong
                  class="periodos-code"
                >
                  ${escapeHtml(
                    periodo.codigo,
                  )}
                </strong>
              </td>


              <td data-label="Periodo">

                <div
                  class="periodos-name"
                >

                  <strong>
                    ${escapeHtml(
                      periodo.nombre,
                    )}
                  </strong>

                  <small>
                    Año
                    ${escapeHtml(
                      periodo.anio,
                    )}
                    ·
                    ${escapeHtml(
                      obtenerNombreCiclo(
                        periodo.ciclo,
                      ),
                    )}
                  </small>

                </div>

              </td>


              <td data-label="Fechas">

                <div
                  class="periodos-dates"
                >

                  <strong>
                    ${formatearFecha(
                      periodo.fechaInicio,
                    )}
                    —
                    ${formatearFecha(
                      periodo.fechaFin,
                    )}
                  </strong>

                  <small>
                    Límite disponibilidad:
                    ${formatearFecha(
                      periodo.fechaLimiteDisponibilidad,
                    )}
                  </small>

                </div>

              </td>


              <td data-label="Estado">

                ${StatusBadge({
                  label:
                    obtenerNombreEstado(
                      periodo.estado,
                    ),
                  tone:
                    obtenerTonoEstado(
                      periodo.estado,
                    ),
                })}

              </td>


              <td data-label="Acciones">

                <div
                  class="periodos-actions"
                >

                  ${
                    puedeGestionar &&
                    periodoEditable(
                      periodo,
                    )
                      ? `
                        <button
                          class="periodos-icon-button"
                          type="button"
                          data-action="editar"
                          data-id="${periodo.id}"
                          title="Editar periodo"
                        >

                          <i
                            data-lucide="pencil"
                            aria-hidden="true"
                          ></i>

                        </button>
                      `
                      : ""
                  }


                  ${accionesEstado}
                  ${puedeGestionar && periodo.estado === 'CERRADO' && obtenerRolActivo() === 'ADMIN_GLOBAL'
                    ? `<button class="periodos-icon-button" type="button" data-action="corregir-cerrado"
                        data-id="${periodo.id}" title="Corrección excepcional auditada">
                        <i data-lucide="pencil" aria-hidden="true"></i>
                      </button>` : ''}

                </div>

              </td>

            </tr>
          `;

        },
      )
      .join("");


  contenedor.innerHTML =
    DataTable({

      columns: [
        "Código",
        "Periodo",
        "Fechas",
        "Estado",
        "Acciones",
      ],

      rows:
        filas,

      emptyMessage:
        "No se encontraron periodos académicos.",

      ariaLabel:
        "Listado de periodos académicos",

    });


  renderizarIconos();
}


/* =========================================================
   CARGAR
   ========================================================= */

async function cargarPeriodos(
  instancia,
) {
  const contenedor =
    document.getElementById(
      "periodosContent",
    );


  if (!contenedor) {
    return;
  }


  try {

    const resultado =
      await listarPeriodosAcademicos();


    if (
      instancia !==
      instanciaActual
    ) {
      return;
    }


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          "No fue posible consultar los periodos académicos.",
      );
    }


    periodos =
      Array.isArray(
        resultado.periodos,
      )
        ? resultado.periodos
        : [];


    renderizarPeriodos();

  } catch (error) {

    console.error(
      "Error cargando periodos:",
      error,
    );


    if (
      instancia !==
      instanciaActual
    ) {
      return;
    }


    contenedor.innerHTML = `
      <div
        class="
          periodos-message
          periodos-error
        "
        role="alert"
      >

        <h3>
          No fue posible cargar
          los periodos
        </h3>

        <p>
          ${escapeHtml(
            error?.message ||
              "Error de conexión.",
          )}
        </p>

      </div>
    `;

  }
}


/* =========================================================
   FORMULARIO
   ========================================================= */

function abrirFormulario(
  periodo = null,
  excepcional = false,
) {
  const dialog =
    document.getElementById(
      "periodoDialog",
    );

  const content =
    document.getElementById(
      "periodoDialogContent",
    );


  if (
    !dialog ||
    !content
  ) {
    return;
  }


  const editando =
    Boolean(periodo);


  const estructuraBloqueada =
    periodo?.estado ===
    "EN_PREPARACION";


  const notaFormulario =
    estructuraBloqueada
      ? `
        El periodo ya está en preparación.
        El calendario quedó bloqueado para
        proteger la disponibilidad docente.
        Únicamente puede modificar las
        observaciones.
      `
      : `
        El código y nombre del periodo
        son generados automáticamente
        por el sistema.
      `;


  const body = `

    <div
      class="
        sgpa-form-wide
        periodos-form-note
      "
    >
      ${notaFormulario}
    </div>


    <label>

      <span>
        Año
      </span>

      <input
        id="periodoAnio"
        type="number"
        min="2000"
        max="2100"
        value="${
          periodo?.anio ?? ""
        }"
        required
        ${estructuraBloqueada ? "disabled" : ""}
      >

    </label>


    <label>

      <span>
        Ciclo
      </span>

      <select
        id="periodoCiclo"
        required
        ${estructuraBloqueada ? "disabled" : ""}
      >

        ${
          !editando
            ? `
              <option
                value=""
                disabled
                selected
              >
                Seleccione...
              </option>
            `
            : ""
        }

        <option
          value="1"
          ${
            periodo?.ciclo === 1
              ? "selected"
              : ""
          }
        >
          I Ciclo
        </option>

        <option
          value="2"
          ${
            periodo?.ciclo === 2
              ? "selected"
              : ""
          }
        >
          II Ciclo
        </option>

        <option
          value="3"
          ${
            periodo?.ciclo === 3
              ? "selected"
              : ""
          }
        >
          Verano
        </option>

      </select>

    </label>


    <label>

      <span>
        Fecha de inicio
      </span>

      <input
        id="periodoFechaInicio"
        type="date"
        value="${periodo?.fechaInicio ?? ""}"
        required
        ${estructuraBloqueada ? "disabled" : ""}
      >

    </label>


    <label>

      <span>
        Fecha de finalización
      </span>

      <input
        id="periodoFechaFin"
        type="date"
        value="${periodo?.fechaFin ?? ""}"
        required
        ${estructuraBloqueada ? "disabled" : ""}
      >

    </label>


    <label
      class="sgpa-form-wide"
    >

      <span>
        Fecha límite para
        disponibilidad docente
      </span>

      <input
        id="periodoFechaLimite"
        type="date"
        value="${
          periodo
            ?.fechaLimiteDisponibilidad ??
          ""
        }"
        required
        ${estructuraBloqueada ? "disabled" : ""}
      >

    </label>


    <label
      class="sgpa-form-wide"
    >

      <span>
        Observaciones
      </span>

      <textarea
        id="periodoObservaciones"
        maxlength="500"
        rows="4"
        placeholder="Observaciones opcionales"
      >${
        periodo?.observaciones
          ? escapeHtml(
              periodo.observaciones,
            )
          : ""
      }</textarea>

    </label>

    ${excepcional ? `<label class="sgpa-form-wide"><span>Motivo institucional obligatorio</span>
      <textarea id="periodoMotivoExcepcional" minlength="10" maxlength="500" rows="3" required
        placeholder="Explique la corrección del período cerrado"></textarea></label>` : ''}

  `;


  content.innerHTML =
    FormDialog({

      formId:
        "periodoForm",

      title:
        excepcional ? "Corrección excepcional de período cerrado" : editando
          ? "Editar periodo académico"
          : "Nuevo periodo académico",

      description:
        excepcional ? "Solo administrador global. El motivo y los cambios quedarán auditados." : editando
          ? "Actualice las fechas y datos del periodo."
          : "Registre un nuevo ciclo académico en el SGPA.",

      body,

      errorId:
        "periodoFormError",

      cancelButtonId:
        "cancelarPeriodoButton",

      submitButtonId:
        "guardarPeriodoButton",

      submitText:
        excepcional ? "Guardar corrección auditada" : editando
          ? "Guardar cambios"
          : "Crear periodo",

    });


  renderizarIconos();


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );

  const inputFechaInicio = document.getElementById("periodoFechaInicio");
  const inputFechaLimite = document.getElementById("periodoFechaLimite");
  const actualizarLimiteDisponibilidad = () => {
    const fechaMaxima = calcularFechaMaximaDisponibilidad(inputFechaInicio?.value);
    if (fechaMaxima) {
      inputFechaLimite.max = fechaMaxima;
    } else {
      inputFechaLimite?.removeAttribute("max");
    }
  };
  if (inputFechaInicio && inputFechaLimite) {
    actualizarLimiteDisponibilidad();
    inputFechaInicio.addEventListener("change", actualizarLimiteDisponibilidad);
  }

  const cerrar = () => dialog.close();

  document
    .getElementById("cancelarPeriodoButton")
    ?.addEventListener("click", cerrar);

  document
    .getElementById("periodoForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const errorBox = document.getElementById("periodoFormError");
      const guardarButton = document.getElementById("guardarPeriodoButton");
      const mostrarErrorFormulario = (mensaje) => {
        if (!errorBox) return;
        errorBox.textContent = mensaje;
        errorBox.classList.remove("hidden");
      };

      errorBox?.classList.add("hidden");

      const validacion = validarYConstruirDatosPeriodo({
        anio: Number(document.getElementById("periodoAnio")?.value),
        ciclo: Number(document.getElementById("periodoCiclo")?.value),
        fechaInicio: document.getElementById("periodoFechaInicio")?.value || "",
        fechaFin: document.getElementById("periodoFechaFin")?.value || "",
        fechaLimiteDisponibilidad:
          document.getElementById("periodoFechaLimite")?.value || "",
        observaciones:
          document.getElementById("periodoObservaciones")?.value?.trim() || "",
        motivo: document.getElementById("periodoMotivoExcepcional")?.value || "",
        editando,
        estructuraBloqueada,
        excepcional,
      });

      if (!validacion.ok) {
        mostrarErrorFormulario(validacion.error);
        return;
      }

      await ejecutarGuardadoPeriodo({
        periodo,
        editando,
        excepcional,
        datos: validacion.datos,
        guardarButton,
        cerrarDialogo: cerrar,
        recargarPeriodos: () => cargarPeriodos(instanciaActual),
      });
    });
}

/* =========================================================
   CAMBIAR ESTADO
   ========================================================= */

async function cambiarEstado(periodo, nuevoEstado) {
  await ejecutarCambioEstadoPeriodo({
    periodo,
    nuevoEstado,
    recargarPeriodos: () => cargarPeriodos(instanciaActual),
  });
}


/* =========================================================
   INICIAR PÁGINA
   ========================================================= */

export function iniciarPeriodosPage() {
  instanciaActual += 1;

  const instancia =
    instanciaActual;


  periodos = [];


  document
    .getElementById(
      "nuevoPeriodoButton",
    )
    ?.addEventListener(
      "click",
      () => {
        abrirFormulario();
      },
    );


  document
    .getElementById(
      "periodosBuscar",
    )
    ?.addEventListener(
      "input",
      renderizarPeriodos,
    );


  document
    .getElementById(
      "periodosEstado",
    )
    ?.addEventListener(
      "change",
      renderizarPeriodos,
    );


  document
    .getElementById(
      "periodosContent",
    )
    ?.addEventListener(
      "click",
      async (event) => {

        const button =
          event.target.closest(
            "[data-action]",
          );


        if (!button) {
          return;
        }


        const id =
          Number(
            button.dataset.id,
          );


        const periodo =
          periodos.find(
            (item) =>
              item.id === id,
          );


        if (!periodo) {
          return;
        }


        if (
          button.dataset.action ===
          "corregir-cerrado"
        ) {
          abrirFormulario(periodo, true);
          return;
        }

        if (
          button.dataset.action ===
          "editar"
        ) {

          abrirFormulario(
            periodo,
          );

          return;
        }


        if (
          button.dataset.action ===
          "estado"
        ) {
          await cambiarEstado(
            periodo,
            button.dataset.estado,
          );
        }

      },
    );


  cargarPeriodos(
    instancia,
  );
}

/* =========================================================
   SELECTOR INTELIGENTE DE FECHA LÍMITE (SGPA)
   ========================================================= */
