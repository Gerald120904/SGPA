import {
  cambiarEstadoCurso,
  listarCursos,
} from "../../services/cursos.service.js";
import { listarCarreras } from "../../services/carreras.service.js";
import { listarPlanesEstudio } from "../../services/planes-estudio.service.js";
import { listarPlanAsignaturas } from "../../services/plan-asignaturas.service.js";
import { listarPlanRequisitos } from "../../services/plan-requisitos.service.js";
import { confirmarAccion } from "../../utils/confirm.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import {
  mostrarExito,
  mostrarError,
} from "../../components/AlertModal.js";
import {
  CarrerasCursosCards,
  CursosCatalogoHeading,
  CursosTabla,
  abrirDetalleRequisito,
  cursoPerteneceACarrera,
  obtenerRequisitosCurso,
} from "./CursosCatalogo.js";
import { abrirFormularioCurso } from "./CursoForm.js";

let cursos = [];
let carrerasDisponibles = [];
let planesDisponibles = [];

let carreraSeleccionadaId = null;
let planCarreraSeleccionado = null;
let asignaturasPlanCarrera = [];
let requisitosPlanCarrera = [];

let instanciaActual = 0;

/* =========================================================
   PAGE
   ========================================================= */

export function CursosPage() {
  return `
    <section
      id="cursosPage"
      class="module-view cursos-page"
    >
      <div class="cursos-toolbar">
        <div>
          <h2>
            Cursos
          </h2>

          <p>
            Catálogo institucional de cursos organizado por carrera.
          </p>
        </div>

        <button
          id="nuevoCursoButton"
          class="cursos-primary-button"
          type="button"
        >
          <i
            data-lucide="plus"
            aria-hidden="true"
          ></i>

          Nuevo curso
        </button>
      </div>

      <div
        id="cursosCarreras"
        class="cursos-careers-content"
        aria-live="polite"
      >
        <div class="cursos-message">
          Cargando carreras...
        </div>
      </div>

      <section
        id="cursosCatalogo"
        class="cursos-catalog-section hidden"
      >
        <div
          id="cursosCatalogoHeading"
        ></div>

        <div class="cursos-filters">
          <label
            class="cursos-search"
            for="cursosBuscar"
          >
            <i
              data-lucide="search"
              aria-hidden="true"
            ></i>

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
            <option value="TODOS">
              Todos
            </option>

            <option value="ACTIVOS">
              Activos
            </option>

            <option value="INACTIVOS">
              Inactivos
            </option>
          </select>

          <button
            id="restablecerCursosFiltros"
            class="cursos-reset-button"
            type="button"
          >
            <i
              data-lucide="rotate-ccw"
              aria-hidden="true"
            ></i>

            Restablecer
          </button>
        </div>

        <div
          id="cursosContent"
          class="cursos-content"
          aria-live="polite"
        ></div>
      </section>

      <dialog
        id="cursoDialog"
        class="
          sgpa-form-dialog
          sgpa-form-dialog-lg
        "
      >
        <div
          id="cursoDialogContent"
        ></div>
      </dialog>

      <dialog
        id="cursoRequisitoDialog"
        class="curso-requirement-dialog"
      >
        <div
          id="cursoRequisitoDialogContent"
        ></div>
      </dialog>
    </section>
  `;
}

/* =========================================================
   HELPERS
   ========================================================= */

function obtenerCarreraSeleccionada() {
  return (
    carrerasDisponibles.find(
      (carrera) =>
        Number(carrera.id) ===
        Number(carreraSeleccionadaId),
    ) || null
  );
}

function obtenerCursosCarrera() {
  if (!carreraSeleccionadaId) {
    return [];
  }

  return cursos.filter((curso) =>
    cursoPerteneceACarrera(
      curso,
      carreraSeleccionadaId,
      asignaturasPlanCarrera,
    ),
  );
}

function obtenerCursosFiltrados() {
  const busqueda =
    document
      .getElementById("cursosBuscar")
      ?.value
      ?.trim()
      .toLowerCase() ||
    "";

  const estado =
    document.getElementById(
      "cursosEstado",
    )?.value || "TODOS";

  return obtenerCursosCarrera().filter(
    (curso) => {
      const coincideBusqueda =
        !busqueda ||
        [
          curso.codigo,
          curso.nombre,
          curso.descripcion,
        ]
          .filter(Boolean)
          .some((valor) =>
            String(valor)
              .toLowerCase()
              .includes(busqueda),
          );

      let coincideEstado = true;

      if (estado === "ACTIVOS") {
        coincideEstado =
          curso.activo === true;
      }

      if (estado === "INACTIVOS") {
        coincideEstado =
          curso.activo === false;
      }

      return (
        coincideBusqueda &&
        coincideEstado
      );
    },
  );
}

/* =========================================================
   RENDER
   ========================================================= */

function renderizarCarreras() {
  const contenedor =
    document.getElementById(
      "cursosCarreras",
    );

  if (!contenedor) {
    return;
  }

  contenedor.innerHTML =
    CarrerasCursosCards({
      carreras:
        carrerasDisponibles,
      cursos,
      carreraSeleccionadaId,
    });

  renderizarIconos();
}

function renderizarCatalogo() {
  const seccion =
    document.getElementById(
      "cursosCatalogo",
    );

  const heading =
    document.getElementById(
      "cursosCatalogoHeading",
    );

  const contenedor =
    document.getElementById(
      "cursosContent",
    );

  if (
    !seccion ||
    !heading ||
    !contenedor
  ) {
    return;
  }

  const carrera =
    obtenerCarreraSeleccionada();

  if (!carrera) {
    seccion.classList.add("hidden");
    heading.innerHTML = "";
    contenedor.innerHTML = "";
    return;
  }

  seccion.classList.remove("hidden");

  const cursosCarrera =
    obtenerCursosCarrera();

  heading.innerHTML =
    CursosCatalogoHeading({
      carrera,
      plan:
        planCarreraSeleccionado,
      cantidad:
        cursosCarrera.length,
    });

  contenedor.innerHTML =
    CursosTabla({
      cursos:
        obtenerCursosFiltrados(),
      asignaturasPlan:
        asignaturasPlanCarrera,
      requisitosPlan:
        requisitosPlanCarrera,
    });

  renderizarIconos();
}

/* =========================================================
   CARGA INICIAL
   ========================================================= */

async function cargarDatos(instancia) {
  const carrerasContainer =
    document.getElementById(
      "cursosCarreras",
    );

  if (!carrerasContainer) {
    return;
  }

  try {
    const [
      resultadoCursos,
      resultadoCarreras,
      resultadoPlanes,
    ] = await Promise.all([
      listarCursos(),
      listarCarreras(),
      listarPlanesEstudio(),
    ]);

    if (instancia !== instanciaActual) {
      return;
    }

    if (!resultadoCursos?.ok) {
      throw new Error(
        resultadoCursos?.message ||
          "No fue posible consultar los cursos.",
      );
    }

    if (!resultadoCarreras?.ok) {
      throw new Error(
        resultadoCarreras?.message ||
          "No fue posible consultar las carreras.",
      );
    }

    if (!resultadoPlanes?.ok) {
      throw new Error(
        resultadoPlanes?.message ||
          "No fue posible consultar los planes de estudio.",
      );
    }

    cursos =
      Array.isArray(
        resultadoCursos.cursos,
      )
        ? resultadoCursos.cursos
        : [];

    carrerasDisponibles =
      Array.isArray(
        resultadoCarreras.carreras,
      )
        ? resultadoCarreras.carreras
        : [];

    planesDisponibles =
      Array.isArray(
        resultadoPlanes.planes,
      )
        ? resultadoPlanes.planes
        : [];

    renderizarCarreras();
    renderizarCatalogo();
  } catch (error) {
    console.error(
      "Error cargando Cursos:",
      error,
    );

    carrerasContainer.innerHTML = `
      <div
        class="
          cursos-message
          cursos-error
        "
        role="alert"
      >
        <h3>
          No fue posible cargar Cursos
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
   SELECCIONAR CARRERA
   ========================================================= */

async function seleccionarCarrera(
  carreraId,
) {
  const id = Number(carreraId);

  if (
    !Number.isInteger(id) ||
    id < 1
  ) {
    return;
  }

  carreraSeleccionadaId = id;
  planCarreraSeleccionado = null;
  asignaturasPlanCarrera = [];
  requisitosPlanCarrera = [];

  renderizarCarreras();

  const seccion =
    document.getElementById(
      "cursosCatalogo",
    );

  const contenido =
    document.getElementById(
      "cursosContent",
    );

  seccion?.classList.remove("hidden");

  if (contenido) {
    contenido.innerHTML = `
      <div class="cursos-message">
        Cargando catálogo de la carrera...
      </div>
    `;
  }

  const planes =
    planesDisponibles
      .filter(
        (plan) =>
          plan.activo === true &&
          Number(plan.carreraId) === id,
      )
      .slice()
      .sort(
        (a, b) =>
          Number(b.id) -
          Number(a.id),
      );

  planCarreraSeleccionado =
    planes[0] || null;

  try {
    if (planCarreraSeleccionado) {
      const [
        resultadoAsignaturas,
        resultadoRequisitos,
      ] = await Promise.all([
        listarPlanAsignaturas(
          planCarreraSeleccionado.id,
        ),
        listarPlanRequisitos(
          planCarreraSeleccionado.id,
        ),
      ]);

      if (!resultadoAsignaturas?.ok) {
        throw new Error(
          resultadoAsignaturas?.message ||
            "No fue posible consultar las asignaturas del plan.",
        );
      }

      if (!resultadoRequisitos?.ok) {
        throw new Error(
          resultadoRequisitos?.message ||
            "No fue posible consultar los requisitos del plan.",
        );
      }

      asignaturasPlanCarrera =
        Array.isArray(
          resultadoAsignaturas.asignaturas,
        )
          ? resultadoAsignaturas.asignaturas
          : [];

      requisitosPlanCarrera =
        Array.isArray(
          resultadoRequisitos.requisitos,
        )
          ? resultadoRequisitos.requisitos
          : [];
    }

    renderizarCatalogo();

    window.requestAnimationFrame(() => {
      document
        .getElementById(
          "cursosCatalogo",
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  } catch (error) {
    mostrarError({
      titulo:
        "No se pudo cargar el catálogo",
      mensaje:
        error?.message ||
        "No fue posible consultar la información académica de la carrera.",
    });

    renderizarCatalogo();
  }
}

/* =========================================================
   RECARGAR DESPUÉS DE CAMBIOS
   ========================================================= */

async function recargarCursos() {
  const resultado =
    await listarCursos();

  if (!resultado?.ok) {
    throw new Error(
      resultado?.message ||
        "No fue posible actualizar el catálogo de cursos.",
    );
  }

  cursos =
    Array.isArray(resultado.cursos)
      ? resultado.cursos
      : [];

  renderizarCarreras();

  if (carreraSeleccionadaId) {
    await seleccionarCarrera(
      carreraSeleccionadaId,
    );
  } else {
    renderizarCatalogo();
  }
}

/* =========================================================
   ESTADO
   ========================================================= */

async function alternarEstado(curso) {
  const nuevoEstado =
    !curso.activo;

  const confirmado =
    await confirmarAccion({
      titulo:
        nuevoEstado
          ? "Activar curso"
          : "Desactivar curso",
      mensaje:
        `¿Desea ${
          nuevoEstado
            ? "activar"
            : "desactivar"
        } el curso "${curso.nombre}"?`,
      textoConfirmar:
        nuevoEstado
          ? "Activar"
          : "Desactivar",
      peligro:
        !nuevoEstado,
    });

  if (!confirmado) {
    return;
  }

  try {
    const resultado =
      await cambiarEstadoCurso(
        curso.id,
        nuevoEstado,
      );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          "No fue posible cambiar el estado.",
      );
    }

    mostrarExito({
      titulo:
        nuevoEstado
          ? "Curso activado"
          : "Curso desactivado",
      mensaje:
        `"${curso.nombre}" se ${
          nuevoEstado
            ? "activó"
            : "desactivó"
        } correctamente.`,
    });

    await recargarCursos();
  } catch (error) {
    mostrarError({
      titulo:
        "No se pudo cambiar el estado",
      mensaje:
        error?.message ||
        "No fue posible cambiar el estado del curso.",
    });
  }
}

/* =========================================================
   EVENTOS
   ========================================================= */

export function iniciarCursosPage() {
  instanciaActual += 1;
  const instancia = instanciaActual;

  cursos = [];
  carrerasDisponibles = [];
  planesDisponibles = [];

  carreraSeleccionadaId = null;
  planCarreraSeleccionado = null;
  asignaturasPlanCarrera = [];
  requisitosPlanCarrera = [];

  document
    .getElementById("nuevoCursoButton")
    ?.addEventListener(
      "click",
      () => {
        void abrirFormularioCurso({
          carreraInicialId:
            carreraSeleccionadaId,
          carrerasDisponibles,
          planesDisponibles,
          onGuardado:
            recargarCursos,
        });
      },
    );

  document
    .getElementById("cursosCarreras")
    ?.addEventListener(
      "click",
      (event) => {
        const card =
          event.target.closest(
            "[data-curso-carrera]",
          );

        if (!card) {
          return;
        }

        void seleccionarCarrera(
          card.dataset.cursoCarrera,
        );
      },
    );

  document
    .getElementById("cursosBuscar")
    ?.addEventListener(
      "input",
      renderizarCatalogo,
    );

  document
    .getElementById("cursosEstado")
    ?.addEventListener(
      "change",
      renderizarCatalogo,
    );

  document
    .getElementById(
      "restablecerCursosFiltros",
    )
    ?.addEventListener(
      "click",
      () => {
        const buscar =
          document.getElementById(
            "cursosBuscar",
          );

        const estado =
          document.getElementById(
            "cursosEstado",
          );

        if (buscar) {
          buscar.value = "";
        }

        if (estado) {
          estado.value = "TODOS";
        }

        renderizarCatalogo();
      },
    );

  document
    .getElementById("cursosContent")
    ?.addEventListener(
      "click",
      async (event) => {
        const requisitoButton =
          event.target.closest(
            "[data-requisito-curso]",
          );

        if (requisitoButton) {
          const curso =
            cursos.find(
              (item) =>
                Number(item.id) ===
                Number(
                  requisitoButton.dataset
                    .requisitoCurso,
                ),
            );

          if (!curso) {
            return;
          }

          const requisitos =
            obtenerRequisitosCurso(
              curso,
              asignaturasPlanCarrera,
              requisitosPlanCarrera,
            );

          const requisito =
            requisitos[
              Number(
                requisitoButton.dataset
                  .requisitoIndice,
              )
            ];

          if (requisito) {
            abrirDetalleRequisito({
              requisito,
              curso,
            });

            renderizarIconos();
          }

          return;
        }

        const button =
          event.target.closest(
            "[data-action]",
          );

        if (!button) {
          return;
        }

        const id =
          Number(button.dataset.id);

        const curso =
          cursos.find(
            (item) =>
              Number(item.id) === id,
          );

        if (!curso) {
          return;
        }

        if (
          button.dataset.action ===
          "editar"
        ) {
          void abrirFormularioCurso({
            curso,
            carreraInicialId:
              carreraSeleccionadaId,
            carrerasDisponibles,
            planesDisponibles,
            onGuardado:
              recargarCursos,
          });

          return;
        }

        if (
          button.dataset.action ===
          "estado"
        ) {
          await alternarEstado(curso);
        }
      },
    );

  void cargarDatos(instancia);
}
