import { obtenerResumenPlan } from "../../services/plan-resumen.service.js";
import { renderizarIconos } from "../../utils/icons.js";
import { crearContextoPlanesEstudio } from "./planes-estudio.context.js";
import {
  obtenerContextoItemRevision,
  ordenarAsignaturasMalla,
  puedeGestionarPlanes,
  renderizarDatoResumen as renderizarDatoResumenHelper,
  renderizarItemRevision,
  separarAsignaturasPlan,
} from "./planes.helpers.js";
import {
  alternarEstado as alternarEstadoSubmodulo,
  cargarDatos as cargarDatosSubmodulo,
  crearVersionDesdePlan as crearVersionDesdePlanSubmodulo,
  activarVersionDesdePlan as activarVersionDesdePlanSubmodulo,
  mostrarFeedback,
  renderizarPlanes,
} from "./PlanesListadoView.js";
import { abrirFormularioPlan } from "./PlanFormDialog.js";
import {
  abrirCargaRapida,
  abrirFormularioAsignatura,
  crearFilaCargaRapidaAsignatura as crearFilaCargaRapidaAsignaturaSubmodulo,
  ejecutarAccionAsignatura,
  recargarAsignaturasPlan as recargarAsignaturasPlanSubmodulo,
} from "./PlanAsignaturaDialog.js";
import {
  abrirFormularioRequisitos as abrirFormularioRequisitosSubmodulo,
  abrirRequisitosRapidos,
  recargarRequisitosPlan as recargarRequisitosPlanSubmodulo,
} from "./PlanRequisitosDialog.js";
import {
  abrirReglaOptativasPlan,
  recargarReglaOptativasPlan as recargarReglaOptativasPlanSubmodulo,
} from "./PlanReglaOptativasDialog.js";
import { abrirAdministradorSalidas } from "./PlanSalidasDialog.js";
import {
  descargarPlantillaPlan,
  seleccionarExcelParaPlan,
} from "./PlanImportacionDialog.js";
import {
  abrirDetalleResumenPlan,
  abrirRevisionPlan,
  mostrarErrorRevision,
} from "./PlanRevisionDialog.js";
import {
  abrirBandejaConvalidacionesExternas,
  abrirComparadorPlanes as abrirComparadorPlanesSubmodulo,
  abrirTransicionCurricular as abrirTransicionCurricularSubmodulo,
} from "./PlanTransicionesDialog.js";
import {
  abrirDetallePlan as abrirDetallePlanSubmodulo,
  mostrarFeedbackDetalle,
  renderizarDetallePlan as renderizarDetallePlanSubmodulo,
} from "./PlanDetalleView.js";

// Instancia única del contexto para el módulo
const contextoPlanes = crearContextoPlanesEstudio();

// Reexportaciones públicas obligatorias requeridas por pruebas existentes
export {
  separarAsignaturasPlan,
  ordenarAsignaturasMalla,
  obtenerContextoItemRevision,
  renderizarItemRevision,
};

/* =========================================================
   PÁGINA PRINCIPAL
   ========================================================= */

export function PlanesEstudioPage() {
  return `
    <section
      id="planesEstudioPage"
      class="module-view planes-estudio-page"
    >
      <div class="planes-toolbar">
        <div class="planes-toolbar-heading">
          <h2>Planes de estudio</h2>
          <p>Administración de los planes académicos asociados a cada carrera.</p>
        </div>

        <div class="planes-toolbar-tools">
          <button
            id="comparadorPlanesButton"
            class="planes-secondary-button"
            type="button"
            title="Comparador Visual de Planes"
          >
            <i data-lucide="split" aria-hidden="true"></i>
            Comparador de planes
          </button>

          <button
            id="transicionCurricularButton"
            class="planes-secondary-button"
            type="button"
            title="Transición Curricular Institucional"
          >
            <i data-lucide="git-branch" aria-hidden="true"></i>
            Transición curricular
          </button>

          ${
            puedeGestionarPlanes()
              ? `
            <button id="convalidacionesExternasButton" class="planes-secondary-button" type="button"
              title="Revisar evidencia y solicitudes de convalidación externa"
              >
              <i data-lucide="file-check" aria-hidden="true"></i> Convalidaciones externas
            </button>
          `
              : ""
          }
        </div>

        ${
          puedeGestionarPlanes()
            ? `
          <button
            id="nuevoPlanButton"
            class="planes-primary-button planes-toolbar-create"
            type="button"
          >
            <i data-lucide="plus" aria-hidden="true"></i>
            Nuevo plan
          </button>
        `
            : ""
        }
      </div>

      <div
        id="planesFeedback"
        class="planes-feedback hidden"
        role="status"
      ></div>

      <div class="planes-filters">
        <label class="planes-search" for="planesBuscar">
          <i data-lucide="search" aria-hidden="true"></i>
          <input
            id="planesBuscar"
            type="search"
            placeholder="Buscar por código, nombre o carrera..."
            autocomplete="off"
          >
        </label>

        <select
          id="planesCarrera"
          class="planes-select"
          aria-label="Filtrar por carrera"
        >
          <option value="">Todas las carreras</option>
        </select>

        <select
          id="planesEstado"
          class="planes-select"
          aria-label="Filtrar por estado"
        >
          <option value="TODOS">Todos</option>
          <option value="ACTIVOS">Activos</option>
          <option value="INACTIVOS">Inactivos</option>
        </select>
      </div>

      <div id="planesContent" class="planes-content" aria-live="polite">
        <div class="planes-message">Cargando planes de estudio...</div>
      </div>

      <dialog
        id="planDialog"
        class="sgpa-form-dialog sgpa-form-dialog-lg"
      >
        <div id="planDialogContent"></div>
      </dialog>

      <dialog
        id="estadoPlanDialog"
        class="sgpa-form-dialog sgpa-form-dialog-md"
      >
        <div id="estadoPlanDialogContent"></div>
      </dialog>

      <dialog
        id="comparadorPlanesDialog"
        class="sgpa-form-dialog sgpa-form-dialog-xl"
        style="max-width: 1150px; width: 95vw;"
      >
        <div id="comparadorPlanesDialogContent"></div>
      </dialog>

      <dialog
        id="transicionCurricularDialog"
        class="sgpa-form-dialog sgpa-form-dialog-xl"
        style="max-width: 1080px; width: 95vw;"
      >
        <div id="transicionCurricularDialogContent"></div>
      </dialog>

      <dialog id="convalidacionesExternasDialog" class="sgpa-form-dialog planes-convalidaciones-dialog">
        <div id="convalidacionesExternasDialogContent"></div>
      </dialog>
    </section>
  `;
}

/* =========================================================
   WRAPPERS DE COORDINACIÓN
   ========================================================= */

function abrirFormulario(plan = null) {
  return abrirFormularioPlan({
    plan,
    carrerasDisponibles: contextoPlanes.estado.carrerasDisponibles,
    puedeGestionar: puedeGestionarPlanes(),
    onGuardado: async () => {
      await cargarDatos(contextoPlanes.estado.instanciaActual);
    },
    onFeedback: mostrarFeedback,
  });
}

async function alternarEstado(plan) {
  return alternarEstadoSubmodulo(plan, contextoPlanes, async () => {
    await cargarDatos(contextoPlanes.estado.instanciaActual);
  });
}

async function crearVersionDesdePlan(plan) {
  return crearVersionDesdePlanSubmodulo(plan, contextoPlanes, async () => {
    await cargarDatos(contextoPlanes.estado.instanciaActual);
  });
}

async function activarVersionDesdePlan(version, origenId) {
  return activarVersionDesdePlanSubmodulo(version, origenId, contextoPlanes, async () => {
    await cargarDatos(contextoPlanes.estado.instanciaActual);
  });
}

async function abrirComparadorPlanes(carreraIdInicial = null, planOrigenIdInicial = null) {
  return abrirComparadorPlanesSubmodulo(contextoPlanes, {
    carreraIdInicial,
    planOrigenIdInicial,
    onFeedback: mostrarFeedback,
  });
}

async function abrirTransicionCurricular(planOrigenIdInicial = null) {
  return abrirTransicionCurricularSubmodulo(contextoPlanes, {
    planOrigenIdInicial,
    onFeedback: mostrarFeedback,
  });
}

async function cargarDatos(instancia) {
  await cargarDatosSubmodulo(instancia, contextoPlanes);
}

async function abrirDetallePlan(plan) {
  await abrirDetallePlanSubmodulo(plan, contextoPlanes, {
    onVolver: volverListadoPlanes,
    handlers: construirHandlersDetalle(),
  });
}

function volverListadoPlanes() {
  contextoPlanes.resetearDetalle();

  const contentArea = document.getElementById("contentArea");
  if (!contentArea) return;

  contentArea.innerHTML = PlanesEstudioPage();
  renderizarIconos();
  iniciarPlanesEstudioPage();
}

function construirHandlersDetalle() {
  return {
    onVolver: volverListadoPlanes,
    onVerDetalleResumen: () => abrirDetalleResumenPlan(contextoPlanes),
    onSalidasAcademicas: () =>
      abrirAdministradorSalidas(contextoPlanes, {
        onRecargar: async () => {
          renderizarDetallePlan();
        },
        onFeedback: mostrarFeedbackDetalle,
      }),
    onReglaOptativas: () =>
      abrirReglaOptativasPlan(contextoPlanes, {
        onRecargar: async () => {
          await recargarReglaOptativasPlan();
          renderizarDetallePlan();
        },
        onFeedback: mostrarFeedbackDetalle,
      }),
    onCargaRapida: () =>
      abrirCargaRapida(contextoPlanes, {
        onRecargar: async () => {
          await recargarAsignaturasPlan();
        },
        onFeedback: mostrarFeedbackDetalle,
      }),
    onRequisitosRapidos: () =>
      abrirRequisitosRapidos(contextoPlanes, {
        onRecargar: async () => {
          await recargarRequisitosPlan();
        },
        onFeedback: mostrarFeedbackDetalle,
      }),
    onRevisarPlan: () => abrirRevisionPlan(contextoPlanes),
    onImportarExcel: () =>
      seleccionarExcelParaPlan(contextoPlanes, {
        onError: mostrarErrorRevision,
        onDetalle: abrirDetallePlan,
      }),
    onPlantillaExcel: descargarPlantillaPlan,
    onAbrirFormularioAsignatura: (asig, valores) =>
      abrirFormularioAsignatura(asig, valores, contextoPlanes, {
        onRecargar: async () => {
          await recargarAsignaturasPlan();
        },
        onFeedback: mostrarFeedbackDetalle,
      }),
    onAbrirRequisitos: (asig) =>
      abrirFormularioRequisitos(asig),
    onEjecutarAccionAsignatura: async (accion, id) => {
      await ejecutarAccionAsignatura(accion, id, contextoPlanes, {
        onAbrirRequisitos: abrirFormularioRequisitos,
        onAbrirFormulario: (asig) =>
          abrirFormularioAsignatura(asig, {}, contextoPlanes, {
            onRecargar: async () => {
              await recargarAsignaturasPlan();
            },
            onFeedback: mostrarFeedbackDetalle,
          }),
        onRecargar: async () => {
          await recargarAsignaturasPlan();
        },
        onFeedback: mostrarFeedbackDetalle,
      });
    },
  };
}

function obtenerAsignaturaPorId(id) {
  return contextoPlanes.obtenerAsignaturaPorId(id) || null;
}

function renderizarDetallePlan() {
  return renderizarDetallePlanSubmodulo(contextoPlanes, construirHandlersDetalle());
}
function crearFilaCargaRapidaAsignatura(indice) {
  return crearFilaCargaRapidaAsignaturaSubmodulo(indice);
}

function abrirFormularioRequisitos(asignatura) {
  abrirFormularioRequisitosSubmodulo(asignatura, contextoPlanes, {
    onRecargar: async () => {
      await recargarRequisitosPlan();
    },
    onFeedback: mostrarFeedbackDetalle,
  });
}

async function recargarRequisitosPlan({ preservarDialogo = false } = {}) {
  await recargarRequisitosPlanSubmodulo(contextoPlanes, {
    preservarDialogo,
    onRecargarResumen: recargarResumenPlan,
    onRenderizar: renderizarDetallePlan,
  });
}
async function recargarResumenPlan() {
  const planSeleccionado = contextoPlanes.estado.planSeleccionado;
  if (!planSeleccionado) return;
  const resultado = await obtenerResumenPlan(planSeleccionado.id);
  if (!resultado?.ok) {
    throw new Error(
      resultado?.message || "No fue posible actualizar el resumen del plan.",
    );
  }
  contextoPlanes.estado.resumenPlan = resultado.resumen || null;
}

function renderizarDatoResumen(nombre, valor) {
  return renderizarDatoResumenHelper(nombre, valor);
}

async function recargarReglaOptativasPlan() {
  await recargarReglaOptativasPlanSubmodulo(contextoPlanes);
}

async function recargarAsignaturasPlan() {
  await recargarAsignaturasPlanSubmodulo(contextoPlanes, {
    onRecargarResumen: recargarResumenPlan,
    onRecargarRegla: recargarReglaOptativasPlan,
    onRenderizar: renderizarDetallePlan,
  });
}

/* =========================================================
   INICIALIZADOR PRINCIPAL
   ========================================================= */

export function iniciarPlanesEstudioPage() {
  const { instancia, signal } = contextoPlanes.iniciarInstancia();

  const pagina = document.getElementById("planesEstudioPage");
  if (!pagina) {
    return;
  }

  document.getElementById("nuevoPlanButton")?.addEventListener("click", () => {
    abrirFormulario();
  }, { signal });

  document.getElementById("comparadorPlanesButton")?.addEventListener("click", () => {
    void abrirComparadorPlanes();
  }, { signal });

  document.getElementById("transicionCurricularButton")?.addEventListener("click", () => {
    void abrirTransicionCurricular();
  }, { signal });

  document.getElementById("convalidacionesExternasButton")?.addEventListener("click", () => {
    void abrirBandejaConvalidacionesExternas(contextoPlanes, { onFeedback: mostrarFeedback });
  }, { signal });

  document
    .getElementById("planesBuscar")
    ?.addEventListener("input", () => renderizarPlanes(contextoPlanes), { signal });
  document
    .getElementById("planesEstado")
    ?.addEventListener("change", () => renderizarPlanes(contextoPlanes), { signal });
  document
    .getElementById("planesCarrera")
    ?.addEventListener("change", () => renderizarPlanes(contextoPlanes), { signal });

  document
    .getElementById("planesContent")
    ?.addEventListener("click", async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest("[data-action]");

      if (!button) {
        return;
      }

      const id = Number(button.dataset.id);
      const plan = contextoPlanes.estado.planes.find((item) => Number(item.id) === id);

      if (!plan) {
        return;
      }

      if (button.dataset.action === "ver-plan") {
        await abrirDetallePlan(plan);
        return;
      }

      if (button.dataset.action === "editar") {
        abrirFormulario(plan);
        return;
      }

      if (button.dataset.action === "estado") {
        await alternarEstado(plan);
        return;
      }
      if (button.dataset.action === "crear-version") {
        await crearVersionDesdePlan(plan);
        return;
      }
      if (button.dataset.action === "activar-version") {
        await activarVersionDesdePlan(plan, Number(button.dataset.parentId));
      }
    }, { signal });

  void cargarDatos(instancia);
}

/* =========================================================
   DESTRUCTOR PRINCIPAL
   ========================================================= */

export function destruirPlanesEstudioPage() {
  contextoPlanes.destruir();
}
