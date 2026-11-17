/* =========================================================
   SGPA — MÓDULO CURSOS: VISTA PRINCIPAL Y ORQUESTADOR
   frontend/src/pages/cursos/CursosPage.js
   ========================================================= */

import {
  cambiarEstadoCurso,
  listarCursos,
} from "../../services/cursos.service.js";
import { listarCarreras } from "../../services/carreras.service.js";
import { listarPlanesEstudio } from "../../services/planes-estudio.service.js";
import { listarPlanAsignaturas } from "../../services/plan-asignaturas.service.js";
import { listarPlanRequisitos } from "../../services/plan-requisitos.service.js";
import { obtenerCatalogoCursosJerarquia } from "../../services/jerarquia.service.js";
import { proponerEstadoCurso } from "../../services/solicitudes-cambio.service.js";
import { usuarioTienePermiso, obtenerRolActivo } from "../../app/session.js";
import { PERMISOS, ROLES } from "../../config/permissions.js";
import { confirmarAccion } from "../../utils/confirm.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import {
  mostrarExito,
  mostrarError,
} from "../../components/AlertModal.js";
import {
  CURSOS_POR_PAGINA,
  compararCursosPorEstadoYCodigo,
  calcularPaginacionCursos,
  filtrarCursos,
  cursoPerteneceACarrera,
} from "./cursos.helpers.js";
import {
  CarrerasCursosCards,
  CursosCatalogoHeading,
  CursosTabla,
  renderizarPaginacionCursos,
  abrirDetalleRequisito,
  obtenerRequisitosCurso,
} from "./CursosCatalogo.js";
import { abrirFormularioCurso } from "./CursoForm.js";
import { abrirRequisitosCurso } from "./CursoRequisitosDialog.js";
import { estadoCursos, reiniciarEstadoCursos } from "./cursos.context.js";

/* Re-exportar contratos públicos para compatibilidad total con tests */
export {
  compararCursosPorEstadoYCodigo,
  calcularPaginacionCursos,
  CURSOS_POR_PAGINA,
};

/* =========================================================
   ESTADO EN MEMORIA DEL MÓDULO
   ========================================================= */

function puedeGestionarCursos() {
  return usuarioTienePermiso(PERMISOS.CURSOS_GESTIONAR);
}

const esAsistente = () => obtenerRolActivo() === ROLES.ASISTENTE_ESTUDIANTIL;
const esCuentaJerarquica = () =>
  esAsistente() || obtenerRolActivo() === ROLES.COORDINADOR;

/* =========================================================
   PLANTILLA HTML PRINCIPAL
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

        ${
          puedeGestionarCursos()
            ? `
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
            `
            : ""
        }
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
   HELPERS DE CONSULTA DE ESTADO LOCAL
   ========================================================= */

function obtenerCarreraSeleccionada() {
  return (
    estadoCursos.carrerasDisponibles.find(
      (carrera) =>
        Number(carrera.id) === Number(estadoCursos.carreraSeleccionadaId),
    ) || null
  );
}

function obtenerCursosCarrera() {
  if (!estadoCursos.carreraSeleccionadaId) {
    return [];
  }

  return estadoCursos.cursos.filter((curso) =>
    cursoPerteneceACarrera(
      curso,
      estadoCursos.carreraSeleccionadaId,
      estadoCursos.asignaturasPlanCarrera,
    ),
  );
}

function obtenerCursosFiltrados() {
  const busqueda =
    document.getElementById("cursosBuscar")?.value || "";

  const estado =
    document.getElementById("cursosEstado")?.value || "TODOS";

  return filtrarCursos(obtenerCursosCarrera(), { busqueda, estado });
}

/* =========================================================
   RENDERIZADO DE SECCIONES
   ========================================================= */

function renderizarCarreras() {
  const contenedor = document.getElementById("cursosCarreras");

  if (!contenedor) {
    return;
  }

  contenedor.innerHTML = CarrerasCursosCards({
    carreras: estadoCursos.carrerasDisponibles,
    cursos: estadoCursos.cursos,
    carreraSeleccionadaId: estadoCursos.carreraSeleccionadaId,
  });

  renderizarIconos();
}

function renderizarCatalogo() {
  const seccion = document.getElementById("cursosCatalogo");
  const heading = document.getElementById("cursosCatalogoHeading");
  const contenedor = document.getElementById("cursosContent");

  if (!seccion || !heading || !contenedor) {
    return;
  }

  const carrera = obtenerCarreraSeleccionada();

  if (!carrera) {
    seccion.classList.add("hidden");
    heading.innerHTML = "";
    contenedor.innerHTML = "";
    estadoCursos.paginaCursos = 1;
    return;
  }

  seccion.classList.remove("hidden");

  const cursosCarrera = obtenerCursosCarrera();

  heading.innerHTML = CursosCatalogoHeading({
    carrera,
    plan: estadoCursos.planCarreraSeleccionado,
    cantidad: cursosCarrera.length,
  });

  const cursosFiltrados = obtenerCursosFiltrados();
  const paginacion = calcularPaginacionCursos(
    cursosFiltrados.length,
    estadoCursos.paginaCursos,
  );
  estadoCursos.paginaCursos = paginacion.pagina;

  contenedor.innerHTML =
    CursosTabla({
      cursos: cursosFiltrados.slice(paginacion.inicio, paginacion.fin),
      asignaturasPlan: estadoCursos.asignaturasPlanCarrera,
      requisitosPlan: estadoCursos.requisitosPlanCarrera,
      puedeGestionar: puedeGestionarCursos(),
    }) + renderizarPaginacionCursos(paginacion);

  renderizarIconos();
}

/* =========================================================
   CARGA INICIAL DE DATOS
   ========================================================= */

async function cargarDatos(instancia) {
  const carrerasContainer = document.getElementById("cursosCarreras");

  if (!carrerasContainer) {
    return;
  }

  try {
    const [resultadoCursos, resultadoCatalogo] = await Promise.all([
      listarCursos(),
      esCuentaJerarquica()
        ? obtenerCatalogoCursosJerarquia()
        : Promise.all([listarCarreras(), listarPlanesEstudio()]),
    ]);

    const resultadoCarreras = esCuentaJerarquica()
      ? {
          ok: resultadoCatalogo?.ok,
          carreras: resultadoCatalogo?.data?.carreras,
          message: resultadoCatalogo?.message,
        }
      : resultadoCatalogo[0];

    const resultadoPlanes = esCuentaJerarquica()
      ? {
          ok: resultadoCatalogo?.ok,
          planes: resultadoCatalogo?.data?.planes,
          message: resultadoCatalogo?.message,
        }
      : resultadoCatalogo[1];

    if (instancia !== estadoCursos.instanciaActual) {
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

    estadoCursos.cursos = Array.isArray(resultadoCursos.cursos)
      ? resultadoCursos.cursos
      : [];

    estadoCursos.carrerasDisponibles = Array.isArray(resultadoCarreras.carreras)
      ? resultadoCarreras.carreras
      : [];

    estadoCursos.planesDisponibles = Array.isArray(resultadoPlanes.planes)
      ? resultadoPlanes.planes
      : [];

    renderizarCarreras();
    renderizarCatalogo();
  } catch (error) {
    console.error("Error cargando Cursos:", error);

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
            error?.message || "Error de conexión.",
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
  { conservarPagina = false, desplazar = true } = {},
) {
  const id = Number(carreraId);

  if (!Number.isInteger(id) || id < 1) {
    return;
  }

  const instancia = estadoCursos.instanciaActual;
  estadoCursos.seleccionCarreraActual += 1;
  const tokenSeleccion = estadoCursos.seleccionCarreraActual;

  estadoCursos.carreraSeleccionadaId = id;
  if (!conservarPagina) estadoCursos.paginaCursos = 1;
  estadoCursos.planCarreraSeleccionado = null;
  estadoCursos.asignaturasPlanCarrera = [];
  estadoCursos.requisitosPlanCarrera = [];

  renderizarCarreras();

  const seccion = document.getElementById("cursosCatalogo");
  const contenido = document.getElementById("cursosContent");

  seccion?.classList.remove("hidden");

  if (contenido) {
    contenido.innerHTML = `
      <div class="cursos-message">
        Cargando catálogo de la carrera...
      </div>
    `;
  }

  const planes = estadoCursos.planesDisponibles
    .filter(
      (plan) =>
        plan.activo === true && Number(plan.carreraId) === id,
    )
    .slice()
    .sort((a, b) => Number(b.id) - Number(a.id));

  const planSeleccionado = planes[0] || null;
  estadoCursos.planCarreraSeleccionado = planSeleccionado;

  try {
    let asignaturas = [];
    let requisitos = [];

    if (planSeleccionado && !esCuentaJerarquica()) {
      const [resultadoAsignaturas, resultadoRequisitos] =
        await Promise.all([
          listarPlanAsignaturas(planSeleccionado.id),
          listarPlanRequisitos(planSeleccionado.id),
        ]);

      if (
        instancia !== estadoCursos.instanciaActual ||
        tokenSeleccion !== estadoCursos.seleccionCarreraActual
      ) {
        return;
      }

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

      asignaturas = Array.isArray(
        resultadoAsignaturas.asignaturas,
      )
        ? resultadoAsignaturas.asignaturas
        : [];

      requisitos = Array.isArray(
        resultadoRequisitos.requisitos,
      )
        ? resultadoRequisitos.requisitos
        : [];
    }

    if (
      instancia !== estadoCursos.instanciaActual ||
      tokenSeleccion !== estadoCursos.seleccionCarreraActual
    ) {
      return;
    }

    estadoCursos.asignaturasPlanCarrera = asignaturas;
    estadoCursos.requisitosPlanCarrera = requisitos;

    renderizarCatalogo();

    if (desplazar) {
      window.requestAnimationFrame(() => {
        if (
          instancia !== estadoCursos.instanciaActual ||
          tokenSeleccion !== estadoCursos.seleccionCarreraActual
        ) {
          return;
        }
        document
          .getElementById("cursosCatalogo")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  } catch (error) {
    if (
      instancia !== estadoCursos.instanciaActual ||
      tokenSeleccion !== estadoCursos.seleccionCarreraActual
    ) {
      return;
    }

    mostrarError({
      titulo: "No se pudo cargar el catálogo",
      mensaje:
        error?.message ||
        "No fue posible consultar la información académica de la carrera.",
    });

    renderizarCatalogo();
  }
}

/* =========================================================
   RECARGAR DESPUÉS DE OPERACIONES
   ========================================================= */

async function recargarCursos(instancia = estadoCursos.instanciaActual) {
  const resultado = await listarCursos();

  if (instancia !== estadoCursos.instanciaActual) return;

  if (!resultado?.ok) {
    throw new Error(
      resultado?.message ||
        "No fue posible actualizar el catálogo de cursos.",
    );
  }

  estadoCursos.cursos = Array.isArray(resultado.cursos) ? resultado.cursos : [];

  renderizarCarreras();

  if (estadoCursos.carreraSeleccionadaId) {
    await seleccionarCarrera(estadoCursos.carreraSeleccionadaId, {
      conservarPagina: true,
      desplazar: false,
    });
  } else {
    renderizarCatalogo();
  }
}

/* =========================================================
   CAMBIAR ESTADO ACTIVO / INACTIVO
   ========================================================= */

async function alternarEstado(curso) {
  if (!puedeGestionarCursos()) {
    mostrarError({
      titulo: "Acceso denegado",
      mensaje: "No posee permiso para gestionar cursos.",
    });
    return;
  }

  const nuevoEstado = !curso.activo;
  const instancia = estadoCursos.instanciaActual;

  const confirmado = await confirmarAccion({
    titulo: nuevoEstado ? "Activar curso" : "Desactivar curso",
    mensaje: `¿Desea ${
      nuevoEstado ? "activar" : "desactivar"
    } el curso "${curso.nombre}"?`,
    textoConfirmar: nuevoEstado ? "Activar" : "Desactivar",
    peligro: !nuevoEstado,
  });

  if (!confirmado) {
    return;
  }

  if (instancia !== estadoCursos.instanciaActual || !puedeGestionarCursos()) return;

  try {
    const resultado = await (esAsistente()
      ? proponerEstadoCurso
      : cambiarEstadoCurso)(curso.id, nuevoEstado);

    if (instancia !== estadoCursos.instanciaActual) return;

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible cambiar el estado.",
      );
    }

    mostrarExito({
      titulo: esAsistente()
        ? "Solicitud enviada"
        : nuevoEstado
        ? "Curso activado"
        : "Curso desactivado",
      mensaje: esAsistente()
        ? `El cambio de estado de "${curso.nombre}" quedó pendiente de aprobación.`
        : `"${curso.nombre}" se ${
            nuevoEstado ? "activó" : "desactivó"
          } correctamente.`,
    });

    await recargarCursos(instancia);
  } catch (error) {
    if (instancia !== estadoCursos.instanciaActual) return;
    mostrarError({
      titulo: "No se pudo cambiar el estado",
      mensaje:
        error?.message || "No fue posible cambiar el estado del curso.",
    });
  }
}

/* =========================================================
   INICIALIZACIÓN Y DELEGACIÓN DE EVENTOS
   ========================================================= */

export function iniciarCursosPage() {
  estadoCursos.instanciaActual += 1;
  estadoCursos.seleccionCarreraActual += 1;
  const instancia = estadoCursos.instanciaActual;

  reiniciarEstadoCursos();

  document
    .getElementById("nuevoCursoButton")
    ?.addEventListener("click", () => {
      if (!puedeGestionarCursos()) {
        mostrarError({
          titulo: "Acceso denegado",
          mensaje: "No posee permiso para gestionar cursos.",
        });
        return;
      }

      void abrirFormularioCurso({
        carreraInicialId: estadoCursos.carreraSeleccionadaId,
        carrerasDisponibles: estadoCursos.carrerasDisponibles,
        planesDisponibles: estadoCursos.planesDisponibles,
        onGuardado: () => recargarCursos(instancia),
      });
    });

  document
    .getElementById("cursosCarreras")
    ?.addEventListener("click", (event) => {
      const card = event.target.closest("[data-curso-carrera]");

      if (!card) {
        return;
      }

      void seleccionarCarrera(card.dataset.cursoCarrera);
    });

  document
    .getElementById("cursosBuscar")
    ?.addEventListener("input", () => {
      estadoCursos.paginaCursos = 1;
      renderizarCatalogo();
    });

  document
    .getElementById("cursosEstado")
    ?.addEventListener("change", () => {
      estadoCursos.paginaCursos = 1;
      renderizarCatalogo();
    });

  document
    .getElementById("restablecerCursosFiltros")
    ?.addEventListener("click", () => {
      const buscar = document.getElementById("cursosBuscar");
      const estado = document.getElementById("cursosEstado");

      if (buscar) {
        buscar.value = "";
      }

      if (estado) {
        estado.value = "TODOS";
      }

      estadoCursos.paginaCursos = 1;
      renderizarCatalogo();
    });

  document
    .getElementById("cursosContent")
    ?.addEventListener("click", async (event) => {
      const botonPagina = event.target.closest("[data-cursos-pagina]");
      if (botonPagina) {
        if (botonPagina.disabled) return;
        const solicitada = Number(botonPagina.dataset.cursosPagina);
        const { totalPaginas } = calcularPaginacionCursos(
          obtenerCursosFiltrados().length,
        );
        if (
          !Number.isInteger(solicitada) ||
          solicitada < 1 ||
          solicitada > totalPaginas
        ) {
          return;
        }
        estadoCursos.paginaCursos = solicitada;
        renderizarCatalogo();
        return;
      }

      const requisitoButton = event.target.closest(
        "[data-requisito-curso]",
      );

      if (requisitoButton) {
        const curso = estadoCursos.cursos.find(
          (item) =>
            Number(item.id) ===
            Number(requisitoButton.dataset.requisitoCurso),
        );

        if (!curso) {
          return;
        }

        const requisitos = obtenerRequisitosCurso(
          curso,
          estadoCursos.asignaturasPlanCarrera,
          estadoCursos.requisitosPlanCarrera,
        );

        const requisito =
          requisitos[Number(requisitoButton.dataset.requisitoIndice)];

        if (requisito) {
          abrirDetalleRequisito({
            requisito,
            curso,
          });

          renderizarIconos();
        }

        return;
      }

      const button = event.target.closest("[data-action]");

      if (!button) {
        return;
      }

      const id = Number(button.dataset.id);

      const curso = estadoCursos.cursos.find((item) => Number(item.id) === id);

      if (!curso) {
        return;
      }

      if (button.dataset.action === "requisitos") {
        void abrirRequisitosCurso({
          curso,
          cursos: estadoCursos.cursos,
          puedeGestionar:
            curso.puedeGestionarGlobal ?? puedeGestionarCursos(),
          onActualizado: () => recargarCursos(instancia),
        });
        return;
      }

      if (button.dataset.action === "editar") {
        void abrirFormularioCurso({
          curso,
          carreraInicialId: estadoCursos.carreraSeleccionadaId,
          carrerasDisponibles: estadoCursos.carrerasDisponibles,
          planesDisponibles: estadoCursos.planesDisponibles,
          onGuardado: () => recargarCursos(instancia),
        });

        return;
      }

      if (button.dataset.action === "estado") {
        await alternarEstado(curso);
      }
    });

  void cargarDatos(instancia);
}

/** Invalida consultas de la vista antes de que el router reemplace su DOM. */
export function destruirCursosPage() {
  estadoCursos.instanciaActual += 1;
  estadoCursos.seleccionCarreraActual += 1;
}
