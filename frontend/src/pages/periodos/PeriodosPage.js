import {
  actualizarPeriodoAcademico,
  cambiarEstadoPeriodoAcademico,
  crearPeriodoAcademico,
  listarPeriodosAcademicos,
} from "../../services/periodos.service.js";

import {
  DataTable,
} from "../../components/DataTable.js";

import {
  FormDialog,
  habilitarCierreExterior,
} from "../../components/FormDialog.js";

import {
  mostrarError,
  mostrarExito,
} from "../../components/AlertModal.js";

import {
  confirmarAccion,
} from "../../utils/confirm.js";

import {
  escapeHtml,
} from "../../utils/html.js";

import {
  renderizarIconos,
} from "../../utils/icons.js";


let periodos = [];
let instanciaActual = 0;


const ESTADOS = {
  BORRADOR: "Borrador",

  EN_PREPARACION:
    "En preparación",

  EN_CURSO:
    "En curso",

  CERRADO:
    "Cerrado",

  CANCELADO:
    "Cancelado",
};


const TRANSICIONES = {
  BORRADOR: [
    {
      estado:
        "EN_PREPARACION",

      texto:
        "Preparar",

      titulo:
        "Pasar periodo a preparación",

      peligro:
        false,
    },

    {
      estado:
        "CANCELADO",

      texto:
        "Cancelar",

      titulo:
        "Cancelar periodo",

      peligro:
        true,
    },
  ],

  EN_PREPARACION: [
    {
      estado:
        "EN_CURSO",

      texto:
        "Iniciar",

      titulo:
        "Iniciar periodo académico",

      peligro:
        false,
    },

    {
      estado:
        "CANCELADO",

      texto:
        "Cancelar",

      titulo:
        "Cancelar periodo",

      peligro:
        true,
    },
  ],

  EN_CURSO: [
    {
      estado:
        "CERRADO",

      texto:
        "Cerrar",

      titulo:
        "Cerrar periodo académico",

      peligro:
        true,
    },
  ],

  CERRADO: [],

  CANCELADO: [],
};


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
   FORMATOS
   ========================================================= */

function obtenerNombreEstado(
  estado,
) {
  return (
    ESTADOS[estado] ||
    estado ||
    "Sin estado"
  );
}


function formatearFecha(
  fecha,
) {
  if (!fecha) {
    return "—";
  }

  const partes =
    String(fecha).split("-");

  if (partes.length !== 3) {
    return fecha;
  }

  const [
    anio,
    mes,
    dia,
  ] = partes;

  return `${dia}/${mes}/${anio}`;
}


function periodoEditable(
  periodo,
) {
  return [
    "BORRADOR",
    "EN_PREPARACION",
  ].includes(
    periodo.estado,
  );
}


/* =========================================================
   FILTROS
   ========================================================= */

function obtenerPeriodosFiltrados() {
  const busqueda =
    document
      .getElementById(
        "periodosBuscar",
      )
      ?.value
      ?.trim()
      .toLowerCase() || "";

  const estado =
    document
      .getElementById(
        "periodosEstado",
      )
      ?.value || "";


  return periodos.filter(
    (periodo) => {

      const coincideBusqueda =
        !busqueda ||
        [
          periodo.codigo,
          periodo.nombre,
          periodo.anio,
          periodo.ciclo,
        ]
          .filter(
            (valor) =>
              valor !== undefined &&
              valor !== null,
          )
          .some(
            (valor) =>
              String(valor)
                .toLowerCase()
                .includes(busqueda),
          );


      const coincideEstado =
        !estado ||
        periodo.estado === estado;


      return (
        coincideBusqueda &&
        coincideEstado
      );

    },
  );
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


  const filas =
    filtrados
      .map(
        (periodo) => {

          const transiciones =
            TRANSICIONES[
              periodo.estado
            ] || [];


          const accionesEstado =
            transiciones
              .map(
                (
                  transicion,
                ) => `
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
                  >
                    ${escapeHtml(
                      transicion.texto,
                    )}
                  </button>
                `,
              )
              .join("");


          return `
            <tr>

              <td>
                <strong
                  class="periodos-code"
                >
                  ${escapeHtml(
                    periodo.codigo,
                  )}
                </strong>
              </td>


              <td>

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
                    · Ciclo
                    ${escapeHtml(
                      periodo.ciclo,
                    )}
                  </small>

                </div>

              </td>


              <td>

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


              <td>

                <span
                  class="
                    periodos-status
                    periodos-status-${String(
                      periodo.estado,
                    )
                      .toLowerCase()
                      .replaceAll(
                        "_",
                        "-",
                      )}
                  "
                >
                  ${escapeHtml(
                    obtenerNombreEstado(
                      periodo.estado,
                    ),
                  )}
                </span>

              </td>


              <td>

                <div
                  class="periodos-actions"
                >

                  ${
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


  const body = `

    <div
      class="
        sgpa-form-wide
        periodos-form-note
      "
    >
      El código y nombre del periodo
      son generados automáticamente
      por el sistema.
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
      >

    </label>


    <label>

      <span>
        Ciclo
      </span>

      <select
        id="periodoCiclo"
        required
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

      </select>

    </label>


    <label>

      <span>
        Fecha de inicio
      </span>

      <input
        id="periodoFechaInicio"
        type="date"
        value="${
          periodo?.fechaInicio ??
          ""
        }"
        required
      >

    </label>


    <label>

      <span>
        Fecha de finalización
      </span>

      <input
        id="periodoFechaFin"
        type="date"
        value="${
          periodo?.fechaFin ??
          ""
        }"
        required
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

  `;


  content.innerHTML =
    FormDialog({

      formId:
        "periodoForm",

      title:
        editando
          ? "Editar periodo académico"
          : "Nuevo periodo académico",

      description:
        editando
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
        editando
          ? "Guardar cambios"
          : "Crear periodo",

    });


  renderizarIconos();


  dialog.showModal();


  habilitarCierreExterior(
    dialog,
  );


  const cerrar =
    () => dialog.close();


  document
    .getElementById(
      "cancelarPeriodoButton",
    )
    ?.addEventListener(
      "click",
      cerrar,
    );


  document
    .getElementById(
      "periodoForm",
    )
    ?.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();


        const anio =
          Number(
            document
              .getElementById(
                "periodoAnio",
              )
              ?.value,
          );


        const ciclo =
          Number(
            document
              .getElementById(
                "periodoCiclo",
              )
              ?.value,
          );


        const fechaInicio =
          document
            .getElementById(
              "periodoFechaInicio",
            )
            ?.value || "";


        const fechaFin =
          document
            .getElementById(
              "periodoFechaFin",
            )
            ?.value || "";


        const fechaLimiteDisponibilidad =
          document
            .getElementById(
              "periodoFechaLimite",
            )
            ?.value || "";


        const observaciones =
          document
            .getElementById(
              "periodoObservaciones",
            )
            ?.value
            ?.trim() || "";


        const errorBox =
          document.getElementById(
            "periodoFormError",
          );


        const guardarButton =
          document.getElementById(
            "guardarPeriodoButton",
          );


        const mostrarErrorFormulario =
          (mensaje) => {

            if (!errorBox) {
              return;
            }

            errorBox.textContent =
              mensaje;

            errorBox.classList.remove(
              "hidden",
            );

          };


        errorBox?.classList.add(
          "hidden",
        );


        if (
          fechaFin <=
          fechaInicio
        ) {

          mostrarErrorFormulario(
            "La fecha de finalización debe ser posterior a la fecha de inicio.",
          );

          return;
        }


        if (
          fechaLimiteDisponibilidad >=
          fechaInicio
        ) {

          mostrarErrorFormulario(
            "La fecha límite de disponibilidad debe ser anterior al inicio del periodo.",
          );

          return;
        }


        const datos = {
          anio,
          ciclo,
          fechaInicio,
          fechaFin,
          fechaLimiteDisponibilidad,
          observaciones,
        };


        if (guardarButton) {
          guardarButton.disabled =
            true;
        }


        try {

          const resultado =
            editando
              ? await actualizarPeriodoAcademico(
                  periodo.id,
                  datos,
                )
              : await crearPeriodoAcademico(
                  datos,
                );


          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                "No fue posible guardar el periodo.",
            );
          }


          cerrar();


          mostrarExito({

            titulo:
              editando
                ? "Periodo actualizado"
                : "Periodo creado",

            mensaje:
              editando
                ? "El periodo académico fue actualizado correctamente."
                : "El nuevo periodo académico fue creado en estado borrador.",

          });


          await cargarPeriodos(
            instanciaActual,
          );

        } catch (error) {

          mostrarError({

            titulo:
              editando
                ? "No se pudo actualizar el periodo"
                : "No se pudo crear el periodo",

            mensaje:
              error?.message ||
              "No fue posible guardar el periodo académico.",

          });

        } finally {

          if (guardarButton) {
            guardarButton.disabled =
              false;
          }

        }

      },
    );
}


/* =========================================================
   CAMBIAR ESTADO
   ========================================================= */

async function cambiarEstado(
  periodo,
  nuevoEstado,
) {
  const transicion =
    (
      TRANSICIONES[
        periodo.estado
      ] || []
    ).find(
      (item) =>
        item.estado ===
        nuevoEstado,
    );


  if (!transicion) {
    return;
  }


  const confirmado =
    await confirmarAccion({

      titulo:
        transicion.titulo,

      mensaje:
        `¿Desea cambiar "${periodo.nombre}" de ${obtenerNombreEstado(
          periodo.estado,
        )} a ${obtenerNombreEstado(
          nuevoEstado,
        )}?`,

      textoConfirmar:
        transicion.texto,

      peligro:
        transicion.peligro,

    });


  if (!confirmado) {
    return;
  }


  try {

    const resultado =
      await cambiarEstadoPeriodoAcademico(
        periodo.id,
        nuevoEstado,
      );


    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          "No fue posible cambiar el estado del periodo.",
      );
    }


    mostrarExito({

      titulo:
        "Estado actualizado",

      mensaje:
        `El periodo quedó en estado "${obtenerNombreEstado(
          nuevoEstado,
        )}".`,

    });


    await cargarPeriodos(
      instanciaActual,
    );

  } catch (error) {

    mostrarError({

      titulo:
        "No se pudo cambiar el estado",

      mensaje:
        error?.message ||
        "No fue posible actualizar el periodo académico.",

    });

  }
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
