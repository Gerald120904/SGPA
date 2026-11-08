import {
  actualizarPlanEstudio,
  cambiarEstadoPlanEstudio,
  crearPlanEstudio,
  crearVersionPlanEstudio,
  activarVersionPlanEstudio,
  listarPlanesEstudio,
} from "../../services/planes-estudio.service.js";
import {
  crearEquivalenciaPlan,
  listarEquivalenciasPlanes,
  eliminarEquivalenciaPlan,
} from "../../services/equivalencias.service.js";
import {
  consultarPoblacionTransicion,
  simularTransicionCurricular,
  ejecutarTransicionCurricular,
  listarConvalidacionesExternas,
  verificarEvidenciaConvalidacionExterna,
  decidirConvalidacionExterna,
  abrirReferenciaEvidenciaConvalidacion,
} from "../../services/transiciones-curriculares.service.js";
import {
  actualizarPlanAsignatura,
  cambiarEstadoPlanAsignatura,
  cargarAsignaturasMasivamente,
  crearPlanAsignatura,
  listarPlanAsignaturas,
} from "../../services/plan-asignaturas.service.js";
import {
  cargarRequisitosMasivamente,
  crearPlanRequisito,
  eliminarPlanRequisito,
  listarPlanRequisitos,
} from "../../services/plan-requisitos.service.js";
import {
  actualizarSalidaAcademica,
  cambiarEstadoSalidaAcademica,
  crearSalidaAcademica,
  listarSalidasAcademicas,
  reemplazarAsignaturasSalida,
} from "../../services/salidas-academicas.service.js";
import { listarCarreras } from "../../services/carreras.service.js";
import { obtenerCatalogoPlanesJerarquia } from '../../services/jerarquia.service.js';
import {
  proponerCrearPlan,
  proponerActualizarPlan,
  proponerEstadoPlan,
  proponerAsignaturaPlan,
  proponerActualizarAsignaturaPlan,
  proponerEstadoAsignaturaPlan,
  proponerRequisitoPlan,
  proponerEliminarRequisitoPlan,
  proponerSalidaPlan,
  proponerActualizarSalidaPlan,
  proponerEstadoSalidaPlan,
  proponerAsignarAsignaturasSalidaPlan,
  proponerGuardarReglaOptativaPlan,
  proponerEliminarReglaOptativaPlan,
  proponerImportarPlan,
} from '../../services/solicitudes-cambio.service.js';
import { obtenerResumenPlan } from "../../services/plan-resumen.service.js";
import { validarPlanEstudio } from "../../services/plan-validaciones.service.js";
import {
  eliminarReglaOptativasPlan,
  guardarReglaOptativasPlan,
  obtenerReglaOptativasPlan,
} from "../../services/plan-reglas-optativas.service.js";
import {
  ejecutarImportacionPlanCompleta,
  guardarPlantillaExcelPlan,
  seleccionarExcelPlan,
  validarImportacionPlan,
} from "../../services/plan-importacion.service.js";
import { usuarioTienePermiso, obtenerRolesUsuario, obtenerRolActivo } from "../../app/session.js";
import { PERMISOS, ROLES } from "../../config/permissions.js";
import { confirmarAccion } from "../../utils/confirm.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import { DataTable } from "../../components/DataTable.js";
import {
  FormDialog,
  habilitarCierreExterior,
} from "../../components/FormDialog.js";
import { mostrarExito, mostrarError } from "../../components/AlertModal.js";
import { VerPlanPage } from "./VerPlanPage.js";
import {
  calcularRutasTroncales,
  construirPathRedondeado as construirPathTroncal,
  expandirRectangulo,
} from "./malla-routing.mjs";

const GRADOS_PLAN = {
  DIPLOMADO: "Diplomado",
  BACHILLERATO: "Bachillerato",
  LICENCIATURA: "Licenciatura",
  MAESTRIA: "Maestría",
  OTRO: "Otro",
};

const MIN_CREDITOS_ASIGNATURA = 1;
const MAX_CREDITOS_ASIGNATURA = 6;
const MAX_ORDEN_ASIGNATURA = 200;
const MAX_NOMBRE_ASIGNATURA = 120;
const MAX_ESPACIOS_OPTATIVOS_REGLA = 200;

const TIPOS_OPTATIVA_PLAN = {
  DISCIPLINARIA: {
    etiqueta: "Disciplinaria / de carrera",
    detalle: "Espacio optativo propio de la carrera, limitado por la regla del plan.",
    clase: "disciplinaria",
  },
  ABIERTA: {
    etiqueta: "Abierta / otra área",
    detalle: "Espacio optativo abierto, limitado de forma independiente por la regla del plan.",
    clase: "abierta",
  },
  SEDE: {
    etiqueta: "De sede / otra área",
    detalle: "Espacio optativo de sede, limitado de forma independiente por la regla del plan.",
    clase: "sede",
  },
};

function obtenerPresentacionTipoOptativa(tipoOptativa) {
  const codigo = String(tipoOptativa || "").toUpperCase();

  return (
    TIPOS_OPTATIVA_PLAN[codigo] || {
      etiqueta: "Genérica",
      detalle: "La categoría se determina por la optativa real reconocida al estudiante.",
      clase: "sin-clasificar",
    }
  );
}

function obtenerConteoOptativasPlan() {
  const optativas = asignaturasPlan.filter(
    (asignatura) =>
      asignatura.activo !== false &&
      String(asignatura.tipo || "").toUpperCase() === "OPTATIVA",
  );

  const disciplinarias = optativas.filter(
    (asignatura) =>
      String(asignatura.tipoOptativa || "").toUpperCase() === "DISCIPLINARIA",
  ).length;

  const abiertas = optativas.filter(
    (asignatura) =>
      String(asignatura.tipoOptativa || "").toUpperCase() === "ABIERTA",
  ).length;

  const sede = optativas.filter(
    (asignatura) =>
      String(asignatura.tipoOptativa || "").toUpperCase() === "SEDE",
  ).length;

  const sinClasificar = optativas.filter(
    (asignatura) => !String(asignatura.tipoOptativa || "").trim(),
  ).length;

  return {
    total: optativas.length,
    disciplinarias,
    abiertas,
    sede,
    otrasAreas: abiertas + sede,
    sinClasificar,
  };
}


function obtenerReglaOptativasActual() {
  return reglaOptativasPlan?.regla || null;
}

function obtenerLimiteReglaOptativa(tipoOptativa) {
  const regla = obtenerReglaOptativasActual();

  if (!regla) {
    return null;
  }

  const tipo = String(tipoOptativa || "").toUpperCase();

  if (tipo === "DISCIPLINARIA") {
    return Number(regla.cantidadDisciplinarias || 0);
  }

  if (tipo === "ABIERTA") {
    return Number(regla.cantidadAbiertas || 0);
  }

  if (tipo === "SEDE") {
    return Number(regla.cantidadSede || 0);
  }

  return null;
}

function obtenerConteoTipoOptativaSinAsignatura(tipoOptativa, excluirId = null) {
  const tipo = String(tipoOptativa || "").toUpperCase();

  return asignaturasPlan.filter(
    (asignatura) =>
      asignatura.activo !== false &&
      Number(asignatura.id) !== Number(excluirId) &&
      String(asignatura.tipo || "").toUpperCase() === "OPTATIVA" &&
      String(asignatura.tipoOptativa || "").toUpperCase() === tipo,
  ).length;
}

function obtenerEstadoCupoOptativa(tipoOptativa, excluirId = null) {
  const tipo = String(tipoOptativa || "").toUpperCase();
  const presentacion = obtenerPresentacionTipoOptativa(tipo);
  const regla = obtenerReglaOptativasActual();

  if (!regla) {
    return {
      configurada: false,
      limite: 0,
      actuales: obtenerConteoTipoOptativaSinAsignatura(tipo, excluirId),
      disponibles: 0,
      bloqueada: true,
      etiqueta: presentacion.etiqueta,
    };
  }

  const limite = Number(obtenerLimiteReglaOptativa(tipo) || 0);
  const actuales = obtenerConteoTipoOptativaSinAsignatura(tipo, excluirId);

  return {
    configurada: true,
    limite,
    actuales,
    disponibles: Math.max(0, limite - actuales),
    bloqueada: actuales >= limite,
    etiqueta: presentacion.etiqueta,
  };
}

function validarCupoOptativaFrontend(tipo, tipoOptativa, asignaturaActual = null) {
  if (String(tipo || "").toUpperCase() !== "OPTATIVA") {
    return null;
  }

  if (asignaturaActual?.activo === false) {
    return null;
  }

  const regla = obtenerReglaOptativasActual();

  if (!regla) {
    return (
      "Antes de agregar asignaturas optativas debe configurar la Regla de optativas del plan. " +
      "Defina cuántas optativas disciplinarias, abiertas y de sede tendrá el plan."
    );
  }

  const limite = Number(regla.cantidadDisciplinarias || 0) + Number(regla.cantidadAbiertas || 0) + Number(regla.cantidadSede || 0);
  const actuales = asignaturasPlan.filter((item) => item.activo !== false && item.tipo === "OPTATIVA" && Number(item.id) !== Number(asignaturaActual?.id ?? -1)).length;
  if (actuales >= limite) return `El plan ya alcanzó los ${limite} espacios optativos.`;
  return null;
}

function validarCargaRapidaOptativas(asignaturas) {
  const optativas = asignaturas.filter(
    (asignatura) => String(asignatura.tipo || "").toUpperCase() === "OPTATIVA",
  );

  if (!optativas.length) {
    return;
  }

  const regla = obtenerReglaOptativasActual();

  if (!regla) {
    throw new Error(
      "Antes de cargar asignaturas optativas debe configurar la Regla de optativas del plan.",
    );
  }

  const limite = Number(regla.cantidadDisciplinarias || 0) + Number(regla.cantidadAbiertas || 0) + Number(regla.cantidadSede || 0);
  if (obtenerConteoOptativasPlan().total + optativas.length > limite) {
    throw new Error(`La carga supera los ${limite} espacios optativos del plan.`);
  }
}

function formatearGradoPlan(grado) {
  return GRADOS_PLAN[grado] || grado || "—";
}

function puedeGestionarPlanes(_detalle = false) {
  return usuarioTienePermiso(PERMISOS.PLANES_ESTUDIO_GESTIONAR);
}

const esAsistente = () => obtenerRolActivo() === ROLES.ASISTENTE_ESTUDIANTIL;
const esCuentaJerarquica = () => {
  const rol = obtenerRolActivo();
  return rol === ROLES.COORDINADOR || rol === ROLES.ASISTENTE_ESTUDIANTIL;
};

let planes = [];
let carrerasDisponibles = [];
let asignaturasPlan = [];
let filasRequisitosRapidos = [];
let requisitosPlan = [];
let salidasAcademicas = [];
let resumenPlan = null;
let reglaOptativasPlan = {
  regla: null,
  cantidadEspaciosOptativos: 0,
  cantidadEspaciosConfigurados: 0,
  conteoActual: null,
};
let planSeleccionado = null;
let instanciaActual = 0;
let vistaDetallePlan = "LISTA";
let vistaPapeleraPlan = false;
let observerMalla = null;
let frameDibujoMalla = null;
let mallaAsignaturaSeleccionadaId = null;
let nivelPaginaPlan = 1;
let detalleEventosController = null;
let paginaEventosController = null;

function mostrarDialogHerramienta() {
  const dialog = document.getElementById("asignaturaDialog");

  if (!dialog) {
    return null;
  }

  if (!dialog.open) {
    if (!dialog.open) dialog.showModal();
  }

  habilitarCierreExterior(dialog);
  return dialog;
}

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

          ${puedeGestionarPlanes() ? `
            <button id="convalidacionesExternasButton" class="planes-secondary-button" type="button"
              title="Revisar evidencia y solicitudes de convalidaciÃ³n externa"
              >
              <i data-lucide="file-check" aria-hidden="true"></i> Convalidaciones externas
            </button>
          ` : ''}

        </div>

        ${puedeGestionarPlanes() ? `
          <button
            id="nuevoPlanButton"
            class="planes-primary-button planes-toolbar-create"
            type="button"
          >
            <i data-lucide="plus" aria-hidden="true"></i>
            Nuevo plan
          </button>
        ` : ""}
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

function mostrarFeedback(mensaje, tipo = "success") {
  if (tipo === "error") {
    mostrarError({
      titulo: "No se pudo completar la operación",
      mensaje,
    });
    return;
  }

  mostrarExito({
    titulo: "Operación realizada correctamente",
    mensaje,
  });
}

function obtenerPlanesFiltrados() {
  const busqueda =
    document.getElementById("planesBuscar")?.value?.trim().toLowerCase() || "";
  const carreraId = document.getElementById("planesCarrera")?.value || "";
  const estado = document.getElementById("planesEstado")?.value || "TODOS";

  return planes.filter((plan) => {
    const coincideBusqueda =
      !busqueda ||
      [
        plan.codigo,
        plan.nombre,
        plan.descripcion,
        plan.carrera?.codigo,
        plan.carrera?.nombre,
      ]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(busqueda));
    const coincideCarrera =
      !carreraId || Number(plan.carreraId) === Number(carreraId);
    let coincideEstado = true;

    if (estado === "ACTIVOS") {
      coincideEstado = (plan.estado || (plan.activo ? "VIGENTE" : "CERRADO")) === "VIGENTE";
    }

    if (estado === "INACTIVOS") {
      coincideEstado = (plan.estado || (plan.activo ? "VIGENTE" : "CERRADO")) !== "VIGENTE";
    }

    return coincideBusqueda && coincideCarrera && coincideEstado;
  });
}

function renderizarPlanes() {
  const contenedor = document.getElementById("planesContent");

  if (!contenedor) {
    return;
  }

  const filtrados = obtenerPlanesFiltrados();
  const filas = filtrados
    .map(
      (plan) => `
        <tr>
          <td>
            <strong class="plan-code">${escapeHtml(plan.codigo)}</strong>
          </td>

          <td>
            <div class="plan-name">
              <strong>${escapeHtml(plan.nombre)}</strong>
              ${
                plan.descripcion
                  ? `<small>${escapeHtml(plan.descripcion)}</small>`
                  : ""
              }
            </div>
          </td>

          <td>
            <div class="plan-career">
              <strong>
                ${escapeHtml(plan.carrera?.nombre || "Carrera no disponible")}
              </strong>
              ${
                plan.carrera?.codigo
                  ? `<small>${escapeHtml(plan.carrera.codigo)}</small>`
                  : ""
              }
            </div>
          </td>

          <td>
            ${escapeHtml(formatearGradoPlan(plan.grado))}
          </td>

          <td>
            <span class="plan-status ${
              (plan.estado || (plan.activo ? "VIGENTE" : "CERRADO")) === "VIGENTE" ? "plan-status-active" : "plan-status-inactive"
            }">
              ${plan.estado === "BORRADOR" ? `Borrador · v${Number(plan.numeroVersion || 1)}` : plan.estado === "EN_TRANSICION" ? `Histórico · v${Number(plan.numeroVersion || 1)}` : (plan.estado === "CERRADO" || !plan.activo) ? `Cerrado · v${Number(plan.numeroVersion || 1)}` : `Vigente · v${Number(plan.numeroVersion || 1)}`}
            </span>
          </td>

          <td class="planes-actions">
            <button
              class="planes-icon-button"
              data-action="ver-plan"
              data-id="${plan.id}"
              type="button"
              title="Ver plan"
              aria-label="Ver plan"
            >
              <i data-lucide="eye" aria-hidden="true"></i>
            </button>

            ${
              puedeGestionarPlanes()
                ? `
                  ${!esAsistente() && plan.estado === "VIGENTE" ? `<button class="planes-icon-button" data-action="crear-version" data-id="${plan.id}" type="button" title="Crear nueva versión curricular" aria-label="Crear nueva versión curricular"><i data-lucide="git-branch-plus" aria-hidden="true"></i></button>` : ""}
                  ${!esAsistente() && plan.estado === "BORRADOR" && plan.versionAnteriorId ? `<button class="planes-icon-button planes-success-button" data-action="activar-version" data-id="${plan.id}" data-parent-id="${plan.versionAnteriorId}" type="button" title="Activar esta versión" aria-label="Activar esta versión"><i data-lucide="circle-check" aria-hidden="true"></i></button>` : ""}
                  <button
                    class="planes-icon-button"
                    data-action="editar"
                    data-id="${plan.id}"
                    type="button"
                    title="Editar plan"
                  >
                    <i data-lucide="pencil" aria-hidden="true"></i>
                  </button>

                  <button
                    class="planes-icon-button ${
                      (plan.estado || (plan.activo ? "VIGENTE" : "CERRADO")) === "VIGENTE"
                        ? "planes-danger-button"
                        : "planes-success-button"
                    }"
                    data-action="estado"
                    data-id="${plan.id}"
                    type="button"
                    title="${(plan.estado || (plan.activo ? "VIGENTE" : "CERRADO")) === "VIGENTE" ? "Cerrar a nuevos ingresos" : "Reabrir plan"}"
                  >
                    <i
                      data-lucide="${
                        (plan.estado || (plan.activo ? "VIGENTE" : "CERRADO")) === "VIGENTE" ? "circle-pause" : "circle-check"
                      }"
                      aria-hidden="true"
                    ></i>
                  </button>
                `
                : ""
            }
          </td>
        </tr>
      `,
    )
    .join("");

  contenedor.innerHTML = DataTable({
    columns: ["Código", "Plan de estudio", "Carrera", "Grado", "Estado", "Acciones"],
    rows: filas,
    emptyMessage:
      "No se encontraron planes de estudio con los filtros seleccionados.",
    ariaLabel: "Listado de planes de estudio",
  });

  renderizarIconos();
}

function renderizarFiltroCarreras() {
  const select = document.getElementById("planesCarrera");

  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="">Todas las carreras</option>
    ${carrerasDisponibles
      .map(
        (carrera) => `
          <option value="${carrera.id}">
            ${escapeHtml(carrera.codigo)} - ${escapeHtml(carrera.nombre)}
          </option>
        `,
      )
      .join("")}
  `;
}

async function cargarDatos(instancia) {
  const contenedor = document.getElementById("planesContent");

  if (!contenedor) {
    return;
  }

  try {
    const [resultadoPlanes, resultadoCarreras] = await Promise.all([
      listarPlanesEstudio(),
      esCuentaJerarquica() ? obtenerCatalogoPlanesJerarquia() : listarCarreras(),
    ]);

    if (instancia !== instanciaActual) {
      return;
    }

    if (!resultadoPlanes?.ok) {
      throw new Error(
        resultadoPlanes?.message ||
          "No fue posible consultar los planes de estudio.",
      );
    }

    if (!resultadoCarreras?.ok) {
      throw new Error(
        resultadoCarreras?.message || "No fue posible consultar las carreras.",
      );
    }

    planes = Array.isArray(resultadoPlanes.planes)
      ? resultadoPlanes.planes
      : [];
    const datosCarreras = resultadoCarreras.data ?? resultadoCarreras;
    carrerasDisponibles = Array.isArray(datosCarreras.carreras)
      ? datosCarreras.carreras.filter((carrera) => !esAsistente() || carrera.puedeGestionarPlanes)
      : [];

    renderizarFiltroCarreras();
    renderizarPlanes();
  } catch (error) {
    console.error("Error cargando planes de estudio:", error);

    if (instancia !== instanciaActual) {
      return;
    }

    contenedor.innerHTML = `
      <div class="planes-message planes-error" role="alert">
        <h3>No fue posible cargar los planes de estudio</h3>
        <p>${escapeHtml(error?.message || "Error de conexión.")}</p>
      </div>
    `;
  }
}

function abrirFormulario(plan = null) {
  if (!puedeGestionarPlanes()) {
    mostrarFeedback("No posee permiso para gestionar planes de estudio.", "error");
    return;
  }

  const dialog =
    document.getElementById(
      "planDialog"
    );

  const content =
    document.getElementById(
      "planDialogContent"
    );

  if (!dialog || !content) {
    return;
  }

  const editando =
    Boolean(plan);

  const opcionesCarreras =
    carrerasDisponibles
      .filter(
        (carrera) =>
          carrera.activo === true
      )
      .map(
        (carrera) => `
          <option
            value="${carrera.id}"
          >
            ${escapeHtml(carrera.codigo)}
            -
            ${escapeHtml(carrera.nombre)}
          </option>
        `
      )
      .join("");

  const carreraField =
    editando
      ? `
          <label class="sgpa-form-wide">

            <span>
              Carrera
            </span>

            <input
              type="text"
              value="${escapeHtml(
                `${
                  plan.carrera?.codigo || ""
                } - ${
                  plan.carrera?.nombre || ""
                }`
              )}"
              disabled
            >

            <small class="sgpa-field-help">
              La carrera de un plan no se puede
              cambiar después de crearlo.
            </small>

          </label>
        `
      : `
          <label class="sgpa-form-wide">

            <span>
              Carrera
            </span>

            <select
              id="planCarrera"
              name="carreraId"
              required
            >

              <option
                value=""
                selected
                disabled
              >
                Seleccione una carrera...
              </option>

              ${opcionesCarreras}

            </select>

          </label>
        `;

  const body = `
    ${carreraField}

    <label>

      <span>
        Grado académico
      </span>

      <select
        id="planGrado"
        name="grado"
        required
      >
        ${Object.entries(GRADOS_PLAN)
          .map(
            ([valor, nombre]) => `
              <option
                value="${valor}"
                ${
                  (plan?.grado || "BACHILLERATO") === valor
                    ? "selected"
                    : ""
                }
              >
                ${nombre}
              </option>
            `,
          )
          .join("")}
      </select>

    </label>


    <label>

      <span>
        Código
      </span>

      <input
        id="planCodigo"
        name="codigo"
        type="text"
        maxlength="40"
        value="${
          plan
            ? escapeHtml(plan.codigo)
            : ""
        }"
        placeholder="Ej. BA-INFORM 2026"
        required
      >

    </label>


    <label class="sgpa-form-wide">

      <span>
        Nombre
      </span>

      <input
        id="planNombre"
        name="nombre"
        type="text"
        maxlength="180"
        value="${
          plan
            ? escapeHtml(plan.nombre)
            : ""
        }"
        placeholder="Ej. Plan de Bachillerato 2026"
        required
      >

    </label>


    <label class="sgpa-form-wide">

      <span>
        Descripción
      </span>

      <textarea
        id="planDescripcion"
        name="descripcion"
        maxlength="500"
        rows="4"
        placeholder="Descripción opcional del plan"
      >${
        plan?.descripcion
          ? escapeHtml(plan.descripcion)
          : ""
      }</textarea>

    </label>
  `;

  content.innerHTML =
    FormDialog({
      formId:
        "planForm",

      title:
        editando
          ? "Editar plan de estudio"
          : "Nuevo plan de estudio",

      description:
        editando
          ? "Actualice la información general del plan de estudio."
          : "Registre un nuevo plan asociado a una carrera existente.",

      body,

      errorId:
        "planFormError",

      cancelButtonId:
        "cancelarPlanButton",

      submitButtonId:
        "guardarPlanButton",

      submitText:
        esAsistente()
          ? "Enviar solicitud"
          : editando
          ? "Guardar cambios"
          : "Crear plan"
    });

  renderizarIconos();

  dialog.showModal();

  habilitarCierreExterior(
    dialog
  );

  const cerrar = () => {
    dialog.close();
  };

  document
    .getElementById(
      "cancelarPlanButton"
    )
    ?.addEventListener(
      "click",
      cerrar
    );

  document
    .getElementById(
      "planForm"
    )
    ?.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        const errorBox =
          document.getElementById(
            "planFormError"
          );

        const guardarButton =
          document.getElementById(
            "guardarPlanButton"
          );

        const gradoInput =
          document.getElementById(
            "planGrado"
          );

        const codigoInput =
          document.getElementById(
            "planCodigo"
          );

        const nombreInput =
          document.getElementById(
            "planNombre"
          );

        const descripcionInput =
          document.getElementById(
            "planDescripcion"
          );

        if (
          !guardarButton ||
          !gradoInput ||
          !codigoInput ||
          !nombreInput ||
          !descripcionInput
        ) {
          return;
        }

        if (!gradoInput.value) {

          if (errorBox) {

            errorBox.textContent =
              "Debe seleccionar el grado académico del plan.";

            errorBox.classList.remove(
              "hidden"
            );

          }

          return;
        }

        const datos = {

          grado:
            gradoInput.value,

          codigo:
            codigoInput.value.trim(),

          nombre:
            nombreInput.value.trim(),

          descripcion:
            descripcionInput.value.trim()

        };

        if (!editando) {

          const carreraInput =
            document.getElementById(
              "planCarrera"
            );

          if (!carreraInput?.value) {

            if (errorBox) {

              errorBox.textContent =
                "Debe seleccionar una carrera.";

              errorBox.classList.remove(
                "hidden"
              );

            }

            return;
          }

          datos.carreraId =
            Number(
              carreraInput.value
            );
        }

        errorBox?.classList.add(
          "hidden"
        );

        guardarButton.disabled =
          true;

        try {

          const resultado =
            editando
              ? await (esAsistente() ? proponerActualizarPlan : actualizarPlanEstudio)(
                  plan.id,
                  datos
                )
              : await (esAsistente() ? proponerCrearPlan : crearPlanEstudio)(
                  datos
                );

          if (!resultado?.ok) {

            throw new Error(
              resultado?.message ||
                "No fue posible guardar el plan de estudio."
            );

          }

          cerrar();

          mostrarFeedback(
            esAsistente()
              ? "La solicitud quedÃ³ pendiente de aprobaciÃ³n."
              : editando
              ? "Plan actualizado correctamente."
              : "Plan creado correctamente."
          );

          await cargarDatos(
            instanciaActual
          );

        } catch (error) {

          if (errorBox) {

            errorBox.textContent =
              error?.message ||
              "No fue posible guardar el plan de estudio.";

            errorBox.classList.remove(
              "hidden"
            );

          }

        } finally {

          guardarButton.disabled =
            false;

        }
      }
    );
}

async function alternarEstado(plan) {
  if (!puedeGestionarPlanes()) {
    mostrarFeedback("No posee permiso para gestionar planes de estudio.", "error");
    return;
  }

  const dialog = document.getElementById("estadoPlanDialog");
  const content = document.getElementById("estadoPlanDialogContent");
  if (!dialog || !content) {
    return;
  }

  const cerrando = (plan.estado || (plan.activo ? "VIGENTE" : "CERRADO")) === "VIGENTE";
  const titulo = cerrando ? "Cerrar plan a nuevos ingresos" : "Reabrir plan de estudio";
  const descripcion = cerrando
    ? `El plan "${plan.nombre}" dejará de aceptar nuevos estudiantes. Los estudiantes actuales podrán continuar y graduarse con su plan.`
    : `La reapertura del plan "${plan.nombre}" permitirá nuevos ingresos autorizados y quedará registrada en auditoría.`;

  const body = `
    <div class="sgpa-form-grid">
      <div class="sgpa-form-wide">
        <div class="planes-message ${cerrando ? 'planes-warning' : 'planes-info'}" style="margin-bottom: 12px; padding: 12px; background: ${cerrando ? '#fffbeb' : '#f0fdf4'}; border-radius: 8px; border: 1px solid ${cerrando ? '#fde68a' : '#bbf7d0'};">
          <p><strong>Plan:</strong> ${escapeHtml(plan.codigo)} — ${escapeHtml(plan.nombre)}</p>
          <p style="margin-top: 4px; font-size: 13px; color: #475569;">${escapeHtml(descripcion)}</p>
        </div>
      </div>
      <label class="sgpa-form-wide">
        <span class="required">Motivo o resolución del ${cerrando ? 'cierre' : 'reapertura'}</span>
        <textarea
          id="motivoEstadoPlan"
          name="motivo"
          class="sgpa-textarea"
          rows="3"
          minlength="5"
          maxlength="500"
          placeholder="Especifique la resolución institucional o justificación académica (mínimo 5 caracteres)..."
          required
          style="width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px;"
        ></textarea>
      </label>
      <div id="estadoPlanError" class="sgpa-form-error hidden sgpa-form-wide"></div>
    </div>
  `;

  content.innerHTML = FormDialog({
    formId: "estadoPlanForm",
    title: titulo,
    description: plan.nombre,
    body,
    errorId: "estadoPlanError",
    cancelButtonId: "cancelarEstadoPlan",
    cancelText: "Cancelar",
    submitButtonId: "confirmarEstadoPlan",
    submitText: cerrando ? "Confirmar Cierre" : "Confirmar Reapertura",
    submitIcon: cerrando ? "circle-pause" : "circle-check",
  });

  renderizarIconos();
  if (!dialog.open) dialog.showModal();
  habilitarCierreExterior(dialog);

  document.getElementById("cancelarEstadoPlan")?.addEventListener("click", () => dialog.close());

  const form = document.getElementById("estadoPlanForm");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const motivoInput = document.getElementById("motivoEstadoPlan");
    const motivo = motivoInput?.value?.trim() || "";
    const errorCont = document.getElementById("estadoPlanError");

    if (motivo.length < 5) {
      if (errorCont) {
        errorCont.textContent = "El motivo debe tener al menos 5 caracteres.";
        errorCont.classList.remove("hidden");
      }
      return;
    }

    try {
      const nuevoEstado = !cerrando;
      const resultado = await (esAsistente()
        ? proponerEstadoPlan
        : cambiarEstadoPlanEstudio)(plan.id, nuevoEstado, motivo);

      if (!resultado?.ok) {
        throw new Error(resultado?.message || "No fue posible cambiar el estado del plan.");
      }

      dialog.close();
      mostrarFeedback(
        esAsistente()
          ? "La solicitud de cambio de estado quedó pendiente de aprobación."
          : cerrando
          ? "Plan cerrado a nuevos ingresos. Los estudiantes actuales pueden continuar. Cambio auditado."
          : "Plan reabierto correctamente y registrado en auditoría.",
      );
      await cargarDatos(instanciaActual);
    } catch (error) {
      const msg = error?.message || "No fue posible cambiar el estado del plan.";
      if (errorCont) {
        errorCont.textContent = msg;
        errorCont.classList.remove("hidden");
      }

    }
  });
}

async function crearVersionDesdePlan(plan) {
  if (!puedeGestionarPlanes() || esAsistente()) return;
  const dialog = document.getElementById("estadoPlanDialog");
  const content = document.getElementById("estadoPlanDialogContent");
  if (!dialog || !content) return;
  content.innerHTML = FormDialog({
    formId: "crearVersionPlanForm", title: "Crear versión curricular",
    description: `Se conservará el plan ${plan.codigo} y sus estudiantes. La nueva versión comenzará como borrador.`,
    body: `<div class="sgpa-form-grid">
      <label><span class="required">Código de la nueva versión</span><input id="codigoNuevaVersion" maxlength="40" required></label>
      <label><span class="required">Nombre</span><input id="nombreNuevaVersion" maxlength="180" required></label>
      <label class="sgpa-form-wide"><span class="required">Motivo</span><textarea id="motivoNuevaVersion" minlength="5" maxlength="500" required></textarea></label>
      <div id="versionPlanError" class="sgpa-form-error hidden sgpa-form-wide"></div>
    </div>`,
    errorId: "versionPlanError", cancelButtonId: "cancelarVersionPlan",
    submitButtonId: "confirmarVersionPlan", submitText: "Crear borrador", submitIcon: "git-branch-plus",
  });
  renderizarIconos();
  if (!dialog.open) dialog.showModal();
  habilitarCierreExterior(dialog);
  document.getElementById("cancelarVersionPlan")?.addEventListener("click", () => dialog.close());
  document.getElementById("crearVersionPlanForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const codigo = document.getElementById("codigoNuevaVersion")?.value?.trim();
    const nombre = document.getElementById("nombreNuevaVersion")?.value?.trim();
    const motivo = document.getElementById("motivoNuevaVersion")?.value?.trim();
    const error = document.getElementById("versionPlanError");
    try {
      const resultado = await crearVersionPlanEstudio(plan.id, { codigo, nombre, motivo });
      if (!resultado?.ok) throw new Error(resultado?.message || "No fue posible crear la versión.");
      dialog.close();
      mostrarExito({ mensaje: "Se creó el borrador curricular con una copia de la malla y sus relaciones." });
      await cargarDatos(instanciaActual);
    } catch (err) {
      if (error) { error.textContent = err?.message || "No fue posible crear la versión."; error.classList.remove("hidden"); }
    }
  });
}

async function activarVersionDesdePlan(version, origenId) {
  if (!puedeGestionarPlanes() || esAsistente()) return;
  const origen = planes.find((item) => Number(item.id) === Number(origenId));
  if (!origen) { mostrarError({ mensaje: "No se encontró el plan anterior de esta versión." }); return; }
  const dialog = document.getElementById("estadoPlanDialog");
  const content = document.getElementById("estadoPlanDialogContent");
  if (!dialog || !content) return;
  content.innerHTML = FormDialog({
    formId: "activarVersionPlanForm", title: "Activar versión curricular",
    description: `La versión ${version.codigo} recibirá nuevos ingresos. ${origen.codigo} pasará a EN TRANSICIÓN; sus estudiantes continuarán con su historial.`,
    body: `<div class="sgpa-form-grid"><label class="sgpa-form-wide"><span class="required">Motivo de activación</span><textarea id="motivoActivarVersion" minlength="5" maxlength="500" required></textarea></label><div id="activarVersionError" class="sgpa-form-error hidden sgpa-form-wide"></div></div>`,
    errorId: "activarVersionError", cancelButtonId: "cancelarActivarVersion",
    submitButtonId: "confirmarActivarVersion", submitText: "Activar versión", submitIcon: "circle-check",
  });
  renderizarIconos();
  if (!dialog.open) dialog.showModal();
  habilitarCierreExterior(dialog);
  document.getElementById("cancelarActivarVersion")?.addEventListener("click", () => dialog.close());
  document.getElementById("activarVersionPlanForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const motivo = document.getElementById("motivoActivarVersion")?.value?.trim();
    const error = document.getElementById("activarVersionError");
    try {
      const resultado = await activarVersionPlanEstudio(origenId, version.id, motivo);
      if (!resultado?.ok) throw new Error(resultado?.message || "No fue posible activar la versión.");
      dialog.close();
      mostrarExito({ mensaje: "Versión activada; el cambio quedó registrado en auditoría." });
      await cargarDatos(instanciaActual);
    } catch (err) {
      if (error) { error.textContent = err?.message || "No fue posible activar la versión."; error.classList.remove("hidden"); }
    }
  });
}

async function abrirDetallePlan(plan) {
  vistaDetallePlan = "LISTA";
  vistaPapeleraPlan = false;
  mallaAsignaturaSeleccionadaId = null;
  nivelPaginaPlan = 1;
  planSeleccionado = plan;

  const contenedor = document.getElementById("planesEstudioPage");

  if (!contenedor) {
    return;
  }

  contenedor.innerHTML = `
    <div class="plan-detail-loading">
      Cargando plan de estudio...
    </div>
  `;

  try {
    const [
      resultadoAsignaturas,
      resultadoRequisitos,
      resultadoSalidas,
      resultadoResumen,
      resultadoReglaOptativas,
    ] = await Promise.all([
      listarPlanAsignaturas(plan.id),
      listarPlanRequisitos(plan.id),
      listarSalidasAcademicas(plan.id),
      obtenerResumenPlan(plan.id),
      obtenerReglaOptativasPlan(plan.id),
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


    if (!resultadoSalidas?.ok) {
      throw new Error(
        resultadoSalidas?.message ||
          "No fue posible consultar las salidas académicas.",
      );
    }

    if (!resultadoResumen?.ok) {
      throw new Error(
        resultadoResumen?.message ||
          "No fue posible consultar el resumen del plan.",
      );
    }

    if (!resultadoReglaOptativas?.ok) {
      throw new Error(
        resultadoReglaOptativas?.message ||
          "No fue posible consultar la regla de optativas del plan.",
      );
    }

    asignaturasPlan = Array.isArray(resultadoAsignaturas.asignaturas)
      ? resultadoAsignaturas.asignaturas
      : [];
    requisitosPlan = Array.isArray(resultadoRequisitos.requisitos)
      ? resultadoRequisitos.requisitos
      : [];
    salidasAcademicas = Array.isArray(resultadoSalidas.salidas)
      ? resultadoSalidas.salidas
      : [];
    resumenPlan = resultadoResumen.resumen || null;
    reglaOptativasPlan = {
      regla: resultadoReglaOptativas.regla || null,
      cantidadEspaciosOptativos: Number(
        resultadoReglaOptativas.cantidadEspaciosOptativos || 0,
      ),
    };

    renderizarDetallePlan();
  } catch (error) {
    contenedor.innerHTML = `
      <div class="planes-message planes-error" role="alert">
        <h3>No fue posible abrir el plan</h3>
        <p>${escapeHtml(error?.message || "Error de conexión.")}</p>
        <button
          id="volverPlanesError"
          class="planes-secondary-button"
          type="button"
        >
          Volver
        </button>
      </div>
    `;

    document
      .getElementById("volverPlanesError")
      ?.addEventListener("click", volverListadoPlanes);
  }
}

function volverListadoPlanes() {
  detalleEventosController?.abort();
  detalleEventosController = null;
  observerMalla?.disconnect();
  observerMalla = null;
  vistaDetallePlan = "LISTA";
  vistaPapeleraPlan = false;
  mallaAsignaturaSeleccionadaId = null;
  nivelPaginaPlan = 1;
  planSeleccionado = null;
  asignaturasPlan = [];
  filasRequisitosRapidos = [];
  requisitosPlan = [];
  salidasAcademicas = [];
  resumenPlan = null;
  reglaOptativasPlan = {
    regla: null,
    cantidadEspaciosOptativos: 0,
    cantidadEspaciosConfigurados: 0,
    conteoActual: null,
  };

  const contentArea = document.getElementById("contentArea");

  if (!contentArea) {
    return;
  }

  contentArea.innerHTML = PlanesEstudioPage();
  renderizarIconos();
  iniciarPlanesEstudioPage();
}

function obtenerDatosAsignatura(asignatura) {
  return {
    codigo: asignatura.codigoReferencia || asignatura.curso?.codigo || "",
    nombre:
      asignatura.nombreReferencia || asignatura.curso?.nombre || "Sin nombre",
  };
}

function obtenerEtiquetaAsignatura(asignatura) {
  const datos = obtenerDatosAsignatura(asignatura);
  const codigo = datos.codigo || asignatura.codigoReferencia || "SIN CÓDIGO";
  const nombre = datos.nombre || asignatura.nombreReferencia || "Sin nombre";

  return `${codigo} - ${nombre}`;
}

function obtenerPresentacionTipoAsignatura(asignatura) {
  const tipo = String(asignatura?.tipo || "OBLIGATORIA").toUpperCase();

  if (tipo === "OPTATIVA") {
    const optativa = obtenerPresentacionTipoOptativa(asignatura?.tipoOptativa);

    return {
      etiqueta: `Optativa · ${optativa.etiqueta}`,
      detalle: optativa.detalle,
      clase: "optativa",
    };
  }

  const presentaciones = {
    OBLIGATORIA: {
      etiqueta: "Obligatoria",
      detalle: "Materia concreta del plan",
      clase: "obligatoria",
    },
    GENERAL: {
      etiqueta: "Estudios generales",
      detalle: "Espacio de Estudios Generales",
      clase: "general",
    },
    OTRA: {
      etiqueta: "Otra",
      detalle: "Espacio curricular especial",
      clase: "otra",
    },
  };

  return presentaciones[tipo] || {
    etiqueta: tipo,
    detalle: "Tipo curricular",
    clase: "otra",
  };
}

function obtenerAyudaTipoAsignatura(tipo) {
  const ayudas = {
    OBLIGATORIA:
      "Materia concreta del plan. Después puede incorporarse o vincularse al catálogo institucional de Cursos.",
    GENERAL:
      "Espacio curricular de Estudios Generales. No se convierte directamente en un Curso institucional desde el flujo normal de Cursos.",
    OPTATIVA:
      "Espacio optativo genérico. La categoría se determina por la asignatura real reconocida al estudiante y se valida contra la regla del plan.",
    OTRA:
      "Utilice este tipo para un espacio curricular especial que no corresponda a obligatoria, general u optativa.",
  };

  return ayudas[String(tipo || "OBLIGATORIA").toUpperCase()] || ayudas.OTRA;
}

function obtenerAsignaturasParaRequisitos() {
  return asignaturasPlan
    .filter((asignatura) => asignatura.activo)
    .slice()
    .sort(
      (a, b) =>
        Number(a.nivel) - Number(b.nivel) ||
        Number(a.ciclo) - Number(b.ciclo) ||
        Number(a.orden) - Number(b.orden),
    );
}

function leerNumeroOpcional(id) {
  const input = document.getElementById(id);

  if (!input) {
    return undefined;
  }

  const valor = input.value.trim();

  if (valor === "") {
    return null;
  }

  const numero = Number(valor);
  return Number.isNaN(numero) ? null : numero;
}

function obtenerResumenHoras(asignatura) {
  const partes = [];
  const agregar = (etiqueta, valor) => {
    if (valor !== null && valor !== undefined) {
      partes.push(`${etiqueta} ${valor}`);
    }
  };

  agregar("T", asignatura.horasTeoria);
  agregar("P", asignatura.horasPractica);
  agregar("L", asignatura.horasLaboratorio);
  agregar("G", asignatura.horasGira);
  agregar("EI", asignatura.horasEstudioIndependiente);
  agregar("HT", asignatura.horasTotales);
  agregar("HD", asignatura.horasDocente);

  return partes.join(" · ");
}

function obtenerRequisitosDeAsignatura(asignaturaId) {
  return requisitosPlan.filter(
    (relacion) => Number(relacion.asignaturaId) === Number(asignaturaId),
  );
}

function obtenerAsignaturasVisibles() {
  return asignaturasPlan;
}

export function separarAsignaturasPlan(asignaturas) {
  return {
    activas: asignaturas.filter((asignatura) => asignatura.activo !== false),
    papelera: asignaturas.filter((asignatura) => asignatura.activo === false),
  };
}

export function ordenarAsignaturasMalla(asignaturas) {
  return asignaturas.slice().sort(
    (a, b) =>
      Number(b.activo !== false) - Number(a.activo !== false) ||
      Number(a.orden) - Number(b.orden),
  );
}

function agruparAsignaturas(asignaturas = obtenerAsignaturasVisibles()) {
  const grupos = new Map();

  for (const asignatura of asignaturas) {
    const clave = `${asignatura.nivel}-${asignatura.ciclo}`;

    if (!grupos.has(clave)) {
      grupos.set(clave, {
        nivel: asignatura.nivel,
        ciclo: asignatura.ciclo,
        asignaturas: [],
      });
    }

    grupos.get(clave).asignaturas.push(asignatura);
  }

  return Array.from(grupos.values())
    .map((grupo) => ({
      ...grupo,
      asignaturas: ordenarAsignaturasMalla(grupo.asignaturas),
    }))
    .sort((a, b) => a.nivel - b.nivel || a.ciclo - b.ciclo);
}

function obtenerNombreAnioNivel(nivel) {
  const nombres = {
    1: "Primer año",
    2: "Segundo año",
    3: "Tercer año",
    4: "Cuarto año",
  };

  return nombres[Number(nivel)] || `Nivel ${nivel}`;
}

function obtenerNombreCiclo(ciclo) {
  const nombres = {
    1: "Ciclo I",
    2: "Ciclo II",
  };

  return nombres[Number(ciclo)] || `Ciclo ${ciclo}`;
}

function calcularCreditosAsignaturas(asignaturas = []) {
  return asignaturas.reduce(
    (total, asignatura) => total + Number(asignatura.creditos || 0),
    0,
  );
}

function renderizarAsignaturaLista(asignatura) {
  const datos = obtenerDatosAsignatura(asignatura);
  const creditos = Number(asignatura.creditos || 0);
  const requisitos = obtenerRequisitosDeAsignatura(asignatura.id);
  const resumenHoras = obtenerResumenHoras(asignatura);
  const presentacionTipo = obtenerPresentacionTipoAsignatura(asignatura);

  return `
    <article
      class="plan-subject-card plan-subject-type-${presentacionTipo.clase} ${
        asignatura.activo ? "" : "plan-subject-inactive"
      }"
    >
      <div class="plan-subject-main">
        <div class="plan-subject-code">
          ${escapeHtml(datos.codigo || asignatura.tipo)}
        </div>

        <div class="plan-subject-description">
          <strong>${escapeHtml(datos.nombre)}</strong>

          <span
            class="plan-subject-type-badge is-${presentacionTipo.clase}"
            title="${escapeHtml(presentacionTipo.detalle)}"
          >
            ${escapeHtml(presentacionTipo.etiqueta)}
          </span>

          ${
            resumenHoras
              ? `
                  <small class="plan-subject-hours">
                    ${escapeHtml(resumenHoras)}
                  </small>
                `
              : ""
          }
        </div>

        <span class="plan-subject-credits">
          ${creditos} crédito${creditos === 1 ? "" : "s"}
        </span>
      </div>

      <div class="plan-subject-actions">
        <button
          class="plan-requirements-button"
          data-asignatura-action="requisitos"
          data-id="${asignatura.id}"
          type="button"
          title="Administrar requisitos y correquisitos"
        >
          Requisitos
          ${requisitos.length > 0 ? `<span>${requisitos.length}</span>` : ""}
        </button>

        ${
          puedeGestionarPlanes(true)
            ? `
              <button
                class="planes-icon-button"
                data-asignatura-action="editar"
                data-id="${asignatura.id}"
                type="button"
                title="Editar"
                aria-label="Editar ${escapeHtml(datos.nombre)}"
              >
                <i data-lucide="pencil" aria-hidden="true"></i>
              </button>

              <button
                class="planes-icon-button"
                data-asignatura-action="estado"
                data-id="${asignatura.id}"
                type="button"
                title="${asignatura.activo ? "Desactivar" : "Activar"}"
                aria-label="${asignatura.activo ? "Desactivar" : "Activar"} ${escapeHtml(
                  datos.nombre,
                )}"
              >
                <i
                  data-lucide="${asignatura.activo ? "circle-pause" : "circle-check"}"
                  aria-hidden="true"
                ></i>
              </button>
            `
            : ""
        }
      </div>
    </article>
  `;
}


/* =========================================================
   SALIDAS ACADÉMICAS COMO HITOS DEL PLAN
   ========================================================= */

function obtenerAsignaturasSalida(salida) {
  if (!salida || !Array.isArray(salida.asignaturas)) {
    return [];
  }

  return salida.asignaturas
    .map((asignatura) => {
      const id = Number(asignatura?.id);
      if (!Number.isFinite(id)) {
        return asignatura;
      }

      return (
        asignaturasPlan.find((item) => Number(item.id) === id) || asignatura
      );
    })
    .filter(Boolean);
}

function obtenerCreditosAsociadosSalida(salida) {
  return obtenerAsignaturasSalida(salida)
    .filter((asignatura) => asignatura.activo !== false)
    .reduce(
      (total, asignatura) => total + Number(asignatura.creditos || 0),
      0,
    );
}

function obtenerPuntoCorteSalida(salida) {
  const asignaturas = obtenerAsignaturasSalida(salida)
    .filter(
      (asignatura) =>
        Number.isFinite(Number(asignatura.nivel)) &&
        Number.isFinite(Number(asignatura.ciclo)),
    )
    .slice()
    .sort(
      (a, b) =>
        Number(a.nivel) - Number(b.nivel) ||
        Number(a.ciclo) - Number(b.ciclo) ||
        Number(a.orden || 0) - Number(b.orden || 0),
    );

  const ultima = asignaturas.at(-1);

  if (!ultima) {
    return null;
  }

  return {
    nivel: Number(ultima.nivel),
    ciclo: Number(ultima.ciclo),
  };
}

function obtenerSalidasEnPuntoCorte(nivel, ciclo) {
  return salidasAcademicas
    .filter((salida) => salida.activo !== false)
    .filter((salida) => {
      const corte = obtenerPuntoCorteSalida(salida);
      return (
        corte &&
        corte.nivel === Number(nivel) &&
        corte.ciclo === Number(ciclo)
      );
    })
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
}

function renderizarEstadoCreditosSalida(salida) {
  const asociados = obtenerCreditosAsociadosSalida(salida);
  const requeridos = Number(salida.creditosRequeridos || 0);
  const completa = requeridos > 0 && asociados >= requeridos;

  return {
    asociados,
    requeridos,
    completa,
    porcentaje:
      requeridos > 0 ? Math.min(100, (asociados / requeridos) * 100) : 0,
  };
}

function renderizarHitosSalidaLista(nivel, ciclo) {
  const salidas = obtenerSalidasEnPuntoCorte(nivel, ciclo);

  if (!salidas.length) {
    return "";
  }

  return `
    <div class="plan-cycle-outcomes">
      ${salidas
        .map((salida) => {
          const estado = renderizarEstadoCreditosSalida(salida);
          return `
            <article class="plan-outcome-milestone">
              <div class="plan-outcome-milestone-icon" aria-hidden="true">
                <i data-lucide="graduation-cap"></i>
              </div>

              <div class="plan-outcome-milestone-content">
                <span class="plan-outcome-milestone-kicker">
                  Salida académica · ${escapeHtml(formatearTipoSalida(salida.tipo))}
                </span>
                <strong>${escapeHtml(salida.nombre)}</strong>
                <small>
                  Se alcanza al completar el Nivel ${nivel}, ${obtenerNombreCiclo(ciclo)}.
                </small>
              </div>

              <div class="plan-outcome-milestone-credits">
                <strong>${estado.requeridos} créditos</strong>
                <span>
                  ${estado.asociados} asociados
                </span>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderizarSalidasMalla() {
  const salidas = salidasAcademicas
    .filter((salida) => salida.activo !== false)
    .slice()
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));

  if (!salidas.length) {
    return "";
  }

  return `
    <section class="malla-outcomes">
      <header class="malla-outcomes-header">
        <div>
          <span>SALIDAS ACADÉMICAS</span>
          <strong>Hitos del plan de estudios</strong>
        </div>
        <small>
          El punto de corte se obtiene de las asignaturas asociadas a cada salida.
        </small>
      </header>

      <div class="malla-outcomes-grid">
        ${salidas
          .map((salida) => {
            const corte = obtenerPuntoCorteSalida(salida);
            const estado = renderizarEstadoCreditosSalida(salida);

            return `
              <article class="malla-outcome-card">
                <div class="malla-outcome-card-icon" aria-hidden="true">
                  <i data-lucide="graduation-cap"></i>
                </div>

                <div class="malla-outcome-card-content">
                  <span>${escapeHtml(formatearTipoSalida(salida.tipo))}</span>
                  <strong>${escapeHtml(salida.nombre)}</strong>
                  <small>
                    ${
                      corte
                        ? `Nivel ${corte.nivel} · ${obtenerNombreCiclo(corte.ciclo)}`
                        : "Asigne las materias para definir el punto de corte"
                    }
                  </small>
                </div>

                <div class="malla-outcome-card-credits">
                  <strong>${estado.requeridos}</strong>
                  <span>créditos</span>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderizarCicloAcademico(nivel, ciclo, asignaturas = []) {
  const asignaturasOrdenadas = asignaturas
    .slice()
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
  const cantidad = asignaturasOrdenadas.length;
  const creditos = calcularCreditosAsignaturas(asignaturasOrdenadas);

  return `
    <section class="plan-cycle" data-nivel="${nivel}" data-ciclo="${ciclo}">
      <header class="plan-cycle-header">
        <div class="plan-cycle-heading">
          <span class="plan-cycle-label">CICLO</span>
          <h4>${obtenerNombreCiclo(ciclo)}</h4>
        </div>

        <div class="plan-cycle-summary">
          <span>${cantidad} asignatura${cantidad === 1 ? "" : "s"}</span>
          <span class="plan-cycle-summary-separator" aria-hidden="true">·</span>
          <strong>${creditos} crédito${creditos === 1 ? "" : "s"}</strong>
        </div>
      </header>

      <div class="plan-cycle-body">
        ${
          cantidad > 0
            ? asignaturasOrdenadas.map(renderizarAsignaturaLista).join("")
            : `
                <div class="plan-cycle-empty">
                  <div class="plan-cycle-empty-content">
                    <div class="plan-cycle-empty-icon" aria-hidden="true">
                      <i data-lucide="book-open"></i>
                    </div>
                    <div>
                      <strong>Ciclo sin asignaturas</strong>
                      <p>Todavía no hay asignaturas registradas en este ciclo.</p>
                    </div>
                  </div>

                  ${
                    puedeGestionarPlanes(true)
                      ? `
                        <button
                          class="plan-cycle-add-button"
                          data-agregar-ciclo
                          data-nivel="${nivel}"
                          data-ciclo="${ciclo}"
                          type="button"
                        >
                          <i data-lucide="plus" aria-hidden="true"></i>
                          Agregar asignatura
                        </button>
                      `
                      : ""
                  }
                </div>
              `
        }
      </div>

      ${renderizarHitosSalidaLista(nivel, ciclo)}
    </section>
  `;
}


function renderizarNivelAcademico(nivel, asignaturas = []) {
  const asignaturasNivel = asignaturas.filter(
    (asignatura) => Number(asignatura.nivel) === Number(nivel),
  );
  const cicloUno = asignaturasNivel.filter(
    (asignatura) => Number(asignatura.ciclo) === 1,
  );
  const cicloDos = asignaturasNivel.filter(
    (asignatura) => Number(asignatura.ciclo) === 2,
  );
  const cantidad = asignaturasNivel.length;
  const creditos = calcularCreditosAsignaturas(asignaturasNivel);

  return `
    <section class="plan-level">
      <header class="plan-level-header">
        <div>
          <span class="plan-level-eyebrow">NIVEL ${nivel}</span>
          <div class="plan-level-title-row">
            <h3>${obtenerNombreAnioNivel(nivel)}</h3>
          </div>
        </div>

        <div class="plan-level-summary">
          <span>${cantidad} asignatura${cantidad === 1 ? "" : "s"}</span>
          <span class="plan-level-summary-divider" aria-hidden="true"></span>
          <strong>${creditos} crédito${creditos === 1 ? "" : "s"}</strong>
        </div>
      </header>

      <div class="plan-level-cycles">
        ${renderizarCicloAcademico(nivel, 1, cicloUno)}
        ${renderizarCicloAcademico(nivel, 2, cicloDos)}
      </div>
    </section>
  `;
}

function normalizarNivelPaginaPlan(valor) {
  const nivel = Number(valor);
  if (!Number.isInteger(nivel)) {
    return 1;
  }
  return Math.min(4, Math.max(1, nivel));
}

function renderizarPaginacionNiveles() {
  const niveles = [1, 2, 3, 4];
  const anterior = nivelPaginaPlan - 1;
  const siguiente = nivelPaginaPlan + 1;

  return `
    <nav class="plan-level-pagination" aria-label="Navegación por año académico">
      <div class="plan-level-pagination-info">
        <span>Año académico</span>
        <strong>${obtenerNombreAnioNivel(nivelPaginaPlan)}</strong>
      </div>

      <div class="plan-level-pagination-controls">
        <button
          class="plan-level-nav-button"
          data-plan-level-page="${anterior}"
          type="button"
          ${nivelPaginaPlan === 1 ? "disabled" : ""}
          aria-label="Año anterior"
        >
          <i data-lucide="chevron-left" aria-hidden="true"></i>
          <span>Anterior</span>
        </button>

        <div class="plan-level-pagination-pages" aria-label="Años disponibles">
          ${niveles
            .map(
              (nivel) => `
                <button
                  class="plan-level-page-button ${
                    nivel === nivelPaginaPlan ? "is-active" : ""
                  }"
                  data-plan-level-page="${nivel}"
                  type="button"
                  aria-label="${obtenerNombreAnioNivel(nivel)}"
                  aria-current="${nivel === nivelPaginaPlan ? "page" : "false"}"
                >
                  ${nivel}
                </button>
              `,
            )
            .join("")}
        </div>

        <button
          class="plan-level-nav-button"
          data-plan-level-page="${siguiente}"
          type="button"
          ${nivelPaginaPlan === 4 ? "disabled" : ""}
          aria-label="Año siguiente"
        >
          <span>Siguiente</span>
          <i data-lucide="chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    </nav>
  `;
}

function renderizarListaAsignaturas() {
  const { activas, papelera } = separarAsignaturasPlan(obtenerAsignaturasVisibles());
  nivelPaginaPlan = normalizarNivelPaginaPlan(nivelPaginaPlan);

  return `
    <div class="plan-level-list-page">
      <button id="togglePapeleraPlanButton" class="sgpa-form-secondary" type="button"
        aria-pressed="${vistaPapeleraPlan}">
        ${vistaPapeleraPlan ? "Volver a asignaturas activas" : `Papelera (${papelera.length})`}
      </button>
      ${vistaPapeleraPlan
        ? `<div class="plan-levels">
            ${papelera.length
              ? papelera
                  .slice()
                  .sort((a, b) =>
                    Number(a.nivel) - Number(b.nivel) ||
                    Number(a.ciclo) - Number(b.ciclo) ||
                    Number(a.orden) - Number(b.orden))
                  .map((asignatura) => `
                    <section class="plan-cycle">
                      <header class="plan-cycle-header">
                        <h4>${escapeHtml(obtenerNombreAnioNivel(asignatura.nivel))} ·
                          ${escapeHtml(obtenerNombreCiclo(asignatura.ciclo))}</h4>
                      </header>
                      ${renderizarAsignaturaLista(asignatura)}
                    </section>`)
                  .join("")
              : '<div class="planes-message">La papelera está vacía.</div>'}
          </div>`
        : `<div class="plan-levels">
            ${renderizarNivelAcademico(nivelPaginaPlan, activas)}
          </div>
          ${renderizarPaginacionNiveles()}`}
    </div>
  `;
}

function obtenerRelacionesRutaSeleccionada() {
  const seleccionadaId = Number(mallaAsignaturaSeleccionadaId);

  if (!seleccionadaId) {
    return [];
  }

  /*
   * La malla muestra únicamente los requisitos y correquisitos DIRECTOS
   * de la asignatura seleccionada. No se recorren requisitos de requisitos.
   *
   * Ejemplo:
   * A -> B -> C
   * Si se selecciona C, se muestra solamente B -> C.
   * Al seleccionar B, entonces se muestra A -> B.
   *
   * Esto conserva el trazado actual de flechas, pero evita que una cadena
   * académica larga sature visualmente la malla.
   */
  return requisitosPlan.filter(
    (relacion) =>
      Number(relacion.asignaturaId) === seleccionadaId &&
      Number(relacion.requisitoAsignaturaId),
  );
}

function obtenerRelacionesMallaVisibles() {
  return obtenerRelacionesRutaSeleccionada();
}

function obtenerIdsRutaMalla() {
  const ids = new Set();

  if (mallaAsignaturaSeleccionadaId) {
    ids.add(Number(mallaAsignaturaSeleccionadaId));
  }

  /*
   * El resaltado visual pertenece únicamente a la asignatura seleccionada
   * y a sus requisitos/correquisitos directos.
   */
  for (const relacion of obtenerRelacionesRutaSeleccionada()) {
    ids.add(Number(relacion.requisitoAsignaturaId));
    ids.add(Number(relacion.asignaturaId));
  }

  return ids;
}

function obtenerTiposRutaMalla() {
  const tiposPorAsignatura = new Map();

  for (const relacion of obtenerRelacionesRutaSeleccionada()) {
    const id = Number(relacion.requisitoAsignaturaId);
    if (!tiposPorAsignatura.has(id)) {
      tiposPorAsignatura.set(id, new Set());
    }
    tiposPorAsignatura.get(id).add(
      relacion.tipo === "CORREQUISITO" ? "CORREQUISITO" : "REQUISITO",
    );
  }

  return tiposPorAsignatura;
}

function renderizarTarjetaMalla(asignatura) {
  const datos = obtenerDatosAsignatura(asignatura);
  const requisitos = obtenerRequisitosDeAsignatura(asignatura.id);
  const cantidadRequisitos = requisitos.filter(
    (item) => item.tipo === "REQUISITO",
  ).length;
  const cantidadCorrequisitos = requisitos.filter(
    (item) => item.tipo === "CORREQUISITO",
  ).length;
  const creditos = Number(asignatura.creditos || 0);
  const presentacionTipo = obtenerPresentacionTipoAsignatura(asignatura);
  const seleccionada =
    Number(asignatura.id) === Number(mallaAsignaturaSeleccionadaId);
  const perteneceRuta = obtenerIdsRutaMalla().has(Number(asignatura.id));
  const tiposRuta = obtenerTiposRutaMalla().get(Number(asignatura.id));

  return `
    <article
      class="malla-card malla-card-type-${presentacionTipo.clase} ${
        asignatura.activo ? "" : "malla-card-inactive"
      } ${seleccionada ? "is-selected" : ""} ${
        !seleccionada && perteneceRuta ? "is-route" : ""
      } ${mallaAsignaturaSeleccionadaId && !perteneceRuta ? "is-muted" : ""
      } ${tiposRuta?.has("REQUISITO") ? "is-requirement" : ""} ${
        tiposRuta?.has("CORREQUISITO") ? "is-corequisite" : ""
      }"
      data-malla-asignatura="${asignatura.id}"
      tabindex="0"
      role="button"
      title="Mostrar requisitos directos de esta asignatura"
      aria-label="Mostrar requisitos directos de ${escapeHtml(datos.nombre)}"
      aria-pressed="${seleccionada}"
    >
      <span class="malla-card-decoration" aria-hidden="true"></span>

      <div class="malla-card-top">
        <strong>${escapeHtml(datos.codigo || asignatura.tipo)}</strong>
        <span class="malla-card-credits">${creditos} cr.</span>
      </div>

      <div class="malla-card-name">${escapeHtml(datos.nombre)}</div>

      <span
        class="malla-card-type-badge is-${presentacionTipo.clase}"
        title="${escapeHtml(presentacionTipo.detalle)}"
      >
        ${escapeHtml(presentacionTipo.etiqueta)}
      </span>

      <div class="malla-card-footer">
        <div class="malla-card-relations">
          ${
            cantidadRequisitos > 0
              ? `<span class="malla-requirement-badge">${cantidadRequisitos} req.</span>`
              : ""
          }
          ${
            cantidadCorrequisitos > 0
              ? `<span class="malla-coreq-badge">${cantidadCorrequisitos} correq.</span>`
              : ""
          }
          ${
            cantidadRequisitos === 0 && cantidadCorrequisitos === 0
              ? `<span class="malla-card-no-relations">Sin requisitos</span>`
              : ""
          }
        </div>

        <button
          class="malla-card-eye"
          data-malla-eye="${asignatura.id}"
          type="button"
          title="Ver requisitos"
          aria-label="Ver requisitos de ${escapeHtml(datos.nombre)}"
        >
          <i data-lucide="eye" aria-hidden="true"></i>
        </button>
      </div>

      <span class="malla-card-hover-line" aria-hidden="true"></span>
    </article>
  `;
}

function agruparMallaPorNivel(asignaturas) {
  const grupos = agruparAsignaturas(asignaturas);
  const niveles = new Map();

  for (const grupo of grupos) {
    const nivel = Number(grupo.nivel);

    if (!niveles.has(nivel)) {
      niveles.set(nivel, {
        nivel,
        ciclos: new Map(),
      });
    }

    niveles.get(nivel).ciclos.set(Number(grupo.ciclo), grupo.asignaturas);
  }

  return Array.from(niveles.values()).sort((a, b) => a.nivel - b.nivel);
}

function renderizarColumnasMalla(asignaturas) {
  return agruparMallaPorNivel(asignaturas)
    .map((grupoNivel) => {
      const renderizarCiclo = (ciclo) => {
        const asignaturasCiclo = grupoNivel.ciclos.get(ciclo) || [];

        return `
          <section
            class="malla-cycle-column"
            data-malla-nivel="${grupoNivel.nivel}"
            data-malla-ciclo="${ciclo}"
          >
            <header class="malla-cycle-header">
              Ciclo ${ciclo}
            </header>

            <div class="malla-column-body">
              ${
                asignaturasCiclo.length
                  ? asignaturasCiclo.map(renderizarTarjetaMalla).join("")
                  : `<div class="malla-cycle-empty">Sin asignaturas</div>`
              }
            </div>
          </section>
        `;
      };

      return `
        <section class="malla-level-group" data-malla-level="${grupoNivel.nivel}">
          <header class="malla-level-header">
            NIVEL ${grupoNivel.nivel}
          </header>

          <div class="malla-level-cycles">
            ${renderizarCiclo(1)}
            ${renderizarCiclo(2)}
          </div>
        </section>
      `;
    })
    .join("");
}

function obtenerAsignaturaMallaSeleccionada() {
  return asignaturasPlan.find(
    (asignatura) =>
      Number(asignatura.id) === Number(mallaAsignaturaSeleccionadaId),
  );
}

function renderizarResumenSeleccionMalla() {
  const asignatura = obtenerAsignaturaMallaSeleccionada();

  if (!asignatura) {
    return `
      <span class="malla-selection-empty">
        Seleccione una asignatura para visualizar únicamente sus requisitos y correquisitos directos.
      </span>
    `;
  }

  const datos = obtenerDatosAsignatura(asignatura);

  return `
    <span class="malla-selection-label">Asignatura seleccionada:</span>
    <strong class="malla-selection-chip">
      ${escapeHtml(datos.codigo || "")}
      <span>${escapeHtml(datos.nombre)}</span>
    </strong>
  `;
}

function renderizarMallaCurricular() {
  const asignaturas = obtenerAsignaturasVisibles();

  if (asignaturas.length === 0) {
    return `
      <div class="planes-message">
        No hay asignaturas para mostrar en esta malla.
      </div>
    `;
  }

  return `
    ${renderizarSalidasMalla()}

    <section class="malla-workspace">
      <header class="malla-workspace-heading">
        <div class="malla-workspace-title">
          <span class="malla-workspace-icon">
            <i data-lucide="book-open" aria-hidden="true"></i>
          </span>
          <strong>Malla curricular</strong>
        </div>
      </header>

      <div class="malla-toolbar">
        <div class="malla-legend" aria-label="Tipos de conexión">
          <span>
            <i class="malla-legend-line" aria-hidden="true"></i>
            Requisito
          </span>
          <span>
            <i
              class="malla-legend-line malla-legend-dashed"
              aria-hidden="true"
            ></i>
            Correquisito
          </span>
        </div>

        <div id="mallaSeleccionResumen" class="malla-selection-summary">
          ${renderizarResumenSeleccionMalla()}
        </div>
      </div>

      <div id="mallaScroll" class="malla-scroll">
        <div id="mallaCanvas" class="malla-canvas">
          <svg
            id="mallaConnections"
            class="malla-connections"
            aria-hidden="true"
          ></svg>
          <div class="malla-plan-grid">
            ${renderizarColumnasMalla(asignaturas)}
          </div>
        </div>
      </div>
    </section>
  `;
}

function rectanguloRelativoMalla(elemento, canvasRect, margen = 0) {
  const rect = elemento.getBoundingClientRect();

  return {
    left: rect.left - canvasRect.left - margen,
    right: rect.right - canvasRect.left + margen,
    top: rect.top - canvasRect.top - margen,
    bottom: rect.bottom - canvasRect.top + margen,
    width: rect.width + margen * 2,
    height: rect.height + margen * 2,
  };
}

function dibujarConexionesMalla() {
  const canvas = document.getElementById("mallaCanvas");
  const svg = document.getElementById("mallaConnections");

  if (!canvas || !svg) {
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const ancho = Math.max(1, Math.ceil(canvas.clientWidth));
  const alto = Math.max(1, Math.ceil(canvas.clientHeight));
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);
  svg.setAttribute("preserveAspectRatio", "none");

  let contenido = `
    <defs>
      <marker id="mallaArrowRequirement" markerWidth="8" markerHeight="8"
        refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"
        viewBox="0 0 8 8">
        <path d="M 0.8 0.8 L 7 4 L 0.8 7.2 Z"
          class="malla-arrow-head is-requirement"></path>
      </marker>
      <marker id="mallaArrowCorequisite" markerWidth="8" markerHeight="8"
        refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"
        viewBox="0 0 8 8">
        <path d="M 0.8 0.8 L 7 4 L 0.8 7.2 Z"
          class="malla-arrow-head is-corequisite"></path>
      </marker>
    </defs>
  `;
  const rectangulos = new Map();
  const obstaculos = [];

  canvas.querySelectorAll("[data-malla-asignatura]").forEach((card) => {
    const rect = rectanguloRelativoMalla(card, canvasRect);
    const id = String(card.dataset.mallaAsignatura);
    rectangulos.set(id, rect);
    obstaculos.push({ id, ...expandirRectangulo(rect, 5) });
  });

  canvas
    .querySelectorAll(".malla-level-header, .malla-cycle-header")
    .forEach((heading, indice) => {
      obstaculos.push({
        id: `heading-${indice}`,
        ...expandirRectangulo(rectanguloRelativoMalla(heading, canvasRect), 5),
      });
    });

  const relaciones = obtenerRelacionesMallaVisibles().map((relacion) => ({
    origenId: String(relacion.requisitoAsignaturaId),
    destinoId: String(relacion.asignaturaId),
    tipo: relacion.tipo === "CORREQUISITO" ? "CORREQUISITO" : "REQUISITO",
  }));
  const rutas = calcularRutasTroncales({
    relaciones,
    rectangulos,
    obstaculos,
    ancho,
    alto,
  }).filter((ruta) => ruta.puntos.length >= 2);
  const paths = rutas.map((ruta) => ({
    ...ruta,
    d: construirPathTroncal(ruta.puntos, 7),
    claseTipo:
      ruta.tipo === "CORREQUISITO" ? "is-corequisite" : "is-requirement",
  }));

  contenido += paths
    .map(({ d }) => `<path d="${d}" class="malla-connection-halo"></path>`)
    .join("");
  contenido += paths
    .map(({ d, clase, claseTipo, flecha }) => `
      <path d="${d}" class="malla-connection ${claseTipo} is-${clase}"
        ${flecha ? `marker-end="url(#${claseTipo === "is-corequisite" ? "mallaArrowCorequisite" : "mallaArrowRequirement"})"` : ""}>
      </path>
    `)
    .join("");

  svg.innerHTML = contenido;
}

function programarDibujoMalla() {
  if (frameDibujoMalla !== null) {
    window.cancelAnimationFrame(frameDibujoMalla);
  }

  frameDibujoMalla = window.requestAnimationFrame(() => {
    frameDibujoMalla = null;
    dibujarConexionesMalla();
  });
}

function mostrarTarjetaMallaCompleta(card) {
  const scroll = document.getElementById("mallaScroll");
  if (!scroll) return;
  const tarjeta = card.getBoundingClientRect();
  const visible = scroll.getBoundingClientRect();
  const margen = 8;
  const ajuste = tarjeta.left < visible.left + margen
    ? tarjeta.left - visible.left - margen
    : tarjeta.right > visible.right - margen
      ? tarjeta.right - visible.right + margen
      : 0;
  if (ajuste) {
    scroll.scrollBy({ left: ajuste, behavior: "smooth" });
  }
}

function actualizarEstadoVisualMalla() {
  const canvas = document.getElementById("mallaCanvas");

  if (!canvas) {
    return;
  }

  const idsRuta = obtenerIdsRutaMalla();
  const tiposRuta = obtenerTiposRutaMalla();

  canvas.querySelectorAll("[data-malla-asignatura]").forEach((card) => {
    const id = Number(card.dataset.mallaAsignatura);
    const seleccionada = id === Number(mallaAsignaturaSeleccionadaId);

    card.classList.toggle("is-selected", seleccionada);
    card.classList.toggle("is-route", !seleccionada && idsRuta.has(id));
    card.classList.toggle(
      "is-muted",
      Boolean(mallaAsignaturaSeleccionadaId) && !idsRuta.has(id),
    );
    card.classList.toggle(
      "is-requirement",
      !seleccionada && Boolean(tiposRuta.get(id)?.has("REQUISITO")),
    );
    card.classList.toggle(
      "is-corequisite",
      !seleccionada && Boolean(tiposRuta.get(id)?.has("CORREQUISITO")),
    );
    card.setAttribute("aria-pressed", String(seleccionada));
  });

  const resumen = document.getElementById("mallaSeleccionResumen");
  if (resumen) {
    resumen.innerHTML = renderizarResumenSeleccionMalla();
  }

  programarDibujoMalla();
}

async function descargarPlantillaPlan() {
  const button = document.getElementById("plantillaExcelPlanButton");
  const htmlOriginal = button?.innerHTML || "";

  const cambiarContenido = (icono, texto) => {
    if (!button) {
      return;
    }

    button.innerHTML = `
      <span class="ver-plan-tool-icon">
        <i data-lucide="${icono}" aria-hidden="true"></i>
      </span>
      <span class="ver-plan-tool-label">${texto}</span>
    `;
    renderizarIconos();
  };

  if (button) {
    button.disabled = true;
    button.classList.add("is-loading");
    cambiarContenido("loader-circle", "Generando...");
  }

  try {
    const resultado = await guardarPlantillaExcelPlan();

    if (resultado?.cancelado) {
      if (button) {
        button.innerHTML = htmlOriginal;
        renderizarIconos();
      }
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible crear la plantilla.",
      );
    }

    if (button) {
      button.classList.remove("is-loading");
      cambiarContenido("check", "Guardada");
      window.setTimeout(() => {
        if (button.isConnected) {
          button.innerHTML = htmlOriginal;
          renderizarIconos();
        }
      }, 1800);
    }
  } catch (error) {
    console.error("Error generando plantilla:", error);

    if (button) {
      button.classList.remove("is-loading");
      cambiarContenido("circle-x", "Error");
      window.setTimeout(() => {
        if (button.isConnected) {
          button.innerHTML = htmlOriginal;
          renderizarIconos();
        }
      }, 1800);
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }
}

async function seleccionarExcelParaPlan() {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const button = document.getElementById("importarExcelPlanButton");
  if (button) button.disabled = true;

  try {
    const resultado = await seleccionarExcelPlan();
    if (resultado?.cancelado) return;
    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible leer el archivo Excel.",
      );
    }
    mostrarPrevisualizacionExcel(resultado.archivo, resultado.datos);
  } catch (error) {
    console.error("Error importando Excel:", error);
    mostrarErrorRevision(
      error?.message || "No fue posible leer el archivo Excel.",
    );
  } finally {
    if (button) button.disabled = false;
  }
}

function renderizarContadorImportacion(icono, cantidad, nombre) {
  return `<article class="plan-import-counter"><i data-lucide="${icono}"></i><div><strong>${cantidad}</strong><span>${escapeHtml(nombre)}</span></div></article>`;
}

function renderizarVistaPreviaAsignaturasExcel(asignaturas) {
  if (!asignaturas.length) {
    return '<div class="plan-requirements-empty">El archivo no contiene asignaturas.</div>';
  }

  const primeras = asignaturas.slice(0, 10);
  return `
    <section class="plan-import-preview-section">
      <header><strong>Vista previa de asignaturas</strong><small>Mostrando ${primeras.length} de ${asignaturas.length}</small></header>
      <div class="plan-import-table-wrapper"><table class="plan-import-table"><thead><tr><th>Clave</th><th>Código</th><th>Asignatura</th><th>Tipo</th><th>Tipo optativa</th><th>Nivel</th><th>Ciclo</th><th>Cr.</th></tr></thead><tbody>
        ${primeras
          .map(
            (fila) => `
              <tr>
                <td>${escapeHtml(fila.CLAVE || "")}</td>
                <td>${escapeHtml(fila.CODIGO || "—")}</td>
                <td>${escapeHtml(fila.NOMBRE || "—")}</td>
                <td>${escapeHtml(fila.TIPO || "—")}</td>
                <td>${escapeHtml(fila.TIPO_OPTATIVA || "—")}</td>
                <td>${escapeHtml(fila.NIVEL || "")}</td>
                <td>${escapeHtml(fila.CICLO || "")}</td>
                <td>${escapeHtml(fila.CREDITOS || "")}</td>
              </tr>`,
          )
          .join("")}
      </tbody></table></div>
    </section>`;
}

async function prepararValidacionImportacion(datos) {
  if (!planSeleccionado) return;
  const button = document.getElementById("validarImportacionExcel");
  if (button) {
    button.disabled = true;
    button.textContent = "Validando...";
  }

  try {
    const resultado = await validarImportacionPlan(planSeleccionado.id, datos);
    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible validar el archivo.",
      );
    }
    mostrarResultadoValidacionExcel(datos, resultado.validacion);
  } catch (error) {
    console.error("Error validando importación:", error);
    mostrarErrorRevision(
      error?.message || "No fue posible validar el archivo.",
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Validar archivo";
    }
  }
}

function renderizarProblemasImportacion(titulo, items, esError) {
  return `
    <section class="plan-review-group">
      <header><div><strong>${escapeHtml(titulo)}</strong><small>${esError ? "Debe corregirlos antes de importar." : "Revise estos puntos antes de continuar."}</small></div><span>${items.length}</span></header>
      <div class="plan-review-list">
        ${items
          .map(
            (item) => `
              <article class="plan-review-item ${esError ? "is-error" : "is-warning"}">
                <div class="plan-review-item-icon"><i data-lucide="${esError ? "circle-x" : "triangle-alert"}"></i></div>
                <div class="plan-review-item-content"><strong>${escapeHtml(item.hoja || "Archivo")}${item.fila ? ` · Fila ${escapeHtml(item.fila)}` : ""}</strong><p>${escapeHtml(item.mensaje || "Inconsistencia detectada.")}</p></div>
              </article>`,
          )
          .join("")}
      </div>
    </section>`;
}

async function ejecutarImportacionPlan(datos) {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  if (!planSeleccionado) return;
  const confirmado = await confirmarAccion({
    titulo: "Importar plan de estudio",
    mensaje:
      "Se crearán las asignaturas, requisitos y salidas académicas del archivo. La operación se guardará completa o se revertirá por completo.",
    textoConfirmar: "Importar plan",
    peligro: false,
  });
  if (!confirmado) return;

  const button = document.getElementById("confirmarImportacionPlan");
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader-circle"></i> Importando...';
    renderizarIconos();
  }

  try {
    const resultado = await (esAsistente()
      ? proponerImportarPlan
      : ejecutarImportacionPlanCompleta)(
      planSeleccionado.id,
      datos,
    );
    if (!resultado?.ok) {
      throw new Error(resultado?.message || "No fue posible importar el plan.");
    }
    if (esAsistente()) {
      document.getElementById("asignaturaDialog")?.close();
      mostrarExito({
        titulo: "Propuesta enviada",
        mensaje: "La propuesta de importación del plan quedó pendiente de aprobación.",
      });
    } else {
      mostrarImportacionCompletada(resultado.importacion);
    }
  } catch (error) {
    console.error("Error ejecutando importación:", error);
    mostrarErrorImportacion(
      error?.message || "No fue posible completar la importación.",
    );
  } finally {
    if (button) button.disabled = false;
  }
}

function mostrarImportacionCompletada(resultado) {
  const content = document.getElementById("asignaturaDialogContent");
  if (!content || !planSeleccionado) return;
  const resumen = resultado?.resumen || {};
  const advertencias = Array.isArray(resultado?.advertencias)
    ? resultado.advertencias
    : [];
  content.innerHTML = `
    <div class="plan-form plan-import-preview">
      <header class="plan-dialog-header"><div><h3>Importación completada</h3><p>${escapeHtml(planSeleccionado.nombre)}</p></div></header>
      <div class="plan-import-content">
        <div class="plan-review-status plan-review-status-ok"><i data-lucide="circle-check-big"></i><div><strong>Plan importado correctamente</strong><p>Todos los datos fueron guardados dentro de una única transacción.</p></div></div>
        <div class="plan-import-counters">
          ${renderizarContadorImportacion("book-open", resumen.asignaturas ?? 0, "Asignaturas")}
          ${renderizarContadorImportacion("git-branch", resumen.requisitos ?? 0, "Requisitos")}
          ${renderizarContadorImportacion("graduation-cap", resumen.salidas ?? 0, "Salidas")}
          ${renderizarContadorImportacion("list-checks", resumen.asignacionesSalidas ?? 0, "Asignaciones")}
        </div>
        ${advertencias.length ? renderizarProblemasImportacion("Advertencias", advertencias, false) : ""}
      </div>
      <footer class="plan-dialog-footer"><button id="finalizarImportacionPlan" class="planes-primary-button" type="button">Ver plan importado</button></footer>
    </div>`;
  renderizarIconos();
  document
    .getElementById("finalizarImportacionPlan")
    ?.addEventListener("click", async () => {
      document.getElementById("asignaturaDialog")?.close();
      if (planSeleccionado) await abrirDetallePlan(planSeleccionado);
    });
}

function mostrarErrorImportacion(mensaje) {
  const content = document.getElementById("asignaturaDialogContent");
  const dialog = document.getElementById("asignaturaDialog");
  if (!content || !dialog) return;
  content.innerHTML = `
    <div class="plan-form plan-import-preview">
      <header class="plan-dialog-header"><div><h3>Importación no completada</h3><p>No se modificó el plan.</p></div></header>
      <div class="plan-import-content"><div class="plan-review-status plan-review-status-error"><i data-lucide="circle-x"></i><div><strong>La importación fue cancelada</strong><p>${escapeHtml(mensaje)}</p></div></div><div class="plan-import-rollback-info"><i data-lucide="database-backup"></i><div><strong>Rollback aplicado</strong><p>Si la operación inició una transacción, todos sus cambios fueron revertidos.</p></div></div></div>
      <footer class="plan-dialog-footer"><button id="cerrarErrorImportacion" class="planes-primary-button" type="button">Cerrar</button></footer>
    </div>`;
  renderizarIconos();
  document
    .getElementById("cerrarErrorImportacion")
    ?.addEventListener("click", () => dialog.close());
}

function mostrarResultadoValidacionExcel(datos, validacion) {
  const content = document.getElementById("asignaturaDialogContent");
  if (!content || !planSeleccionado) return;
  const errores = Array.isArray(validacion?.errores) ? validacion.errores : [];
  const advertencias = Array.isArray(validacion?.advertencias)
    ? validacion.advertencias
    : [];
  const puedeImportar = validacion?.puedeImportar === true;
  const estado = puedeImportar
    ? advertencias.length
      ? "plan-review-status-warning"
      : "plan-review-status-ok"
    : "plan-review-status-error";
  const icono = puedeImportar
    ? advertencias.length
      ? "triangle-alert"
      : "circle-check-big"
    : "circle-x";

  content.innerHTML = `
    <div class="plan-form plan-import-preview">
      <header class="plan-dialog-header"><div><h3>Validación de importación</h3><p>${escapeHtml(planSeleccionado.nombre)}</p></div></header>
      <div class="plan-import-content">
        <div class="plan-review-status ${estado}"><i data-lucide="${icono}"></i><div><strong>${puedeImportar ? "Archivo listo para importar" : "El archivo contiene errores"}</strong><p>${errores.length} errores · ${advertencias.length} advertencias</p></div></div>
        ${errores.length ? renderizarProblemasImportacion("Errores", errores, true) : ""}
        ${advertencias.length ? renderizarProblemasImportacion("Advertencias", advertencias, false) : ""}
      </div>
      <footer class="plan-dialog-footer"><button id="volverImportPreview" class="planes-secondary-button" type="button">Volver</button>${puedeImportar ? '<button id="confirmarImportacionPlan" class="planes-primary-button" type="button"><i data-lucide="database"></i> Confirmar importación</button>' : ""}</footer>
    </div>`;
  renderizarIconos();
  document
    .getElementById("volverImportPreview")
    ?.addEventListener("click", () => {
      mostrarPrevisualizacionExcel("Archivo seleccionado", datos);
    });
  document
    .getElementById("confirmarImportacionPlan")
    ?.addEventListener("click", () => {
      ejecutarImportacionPlan(datos);
    });
}

function mostrarPrevisualizacionExcel(archivo, datos) {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");
  if (!dialog || !content) return;

  const asignaturas = Array.isArray(datos?.asignaturas)
    ? datos.asignaturas
    : [];
  const requisitos = Array.isArray(datos?.requisitos) ? datos.requisitos : [];
  const salidas = Array.isArray(datos?.salidas) ? datos.salidas : [];
  const salidaAsignaturas = Array.isArray(datos?.salidaAsignaturas)
    ? datos.salidaAsignaturas
    : [];

  content.innerHTML = `
    <div class="plan-form plan-import-preview">
      <header class="plan-dialog-header"><div><h3>Importar plan desde Excel</h3><p>${escapeHtml(archivo)}</p></div><button id="cerrarImportPreview" class="planes-icon-button" type="button"><i data-lucide="x"></i></button></header>
      <div class="plan-import-content">
        <div class="plan-import-notice"><i data-lucide="info"></i><div><strong>Previsualización</strong><p>Todavía no se ha guardado ningún dato en el plan.</p></div></div>
        <div class="plan-import-counters">
          ${renderizarContadorImportacion("book-open", asignaturas.length, "Asignaturas")}
          ${renderizarContadorImportacion("git-branch", requisitos.length, "Requisitos")}
          ${renderizarContadorImportacion("graduation-cap", salidas.length, "Salidas")}
          ${renderizarContadorImportacion("list-checks", salidaAsignaturas.length, "Asignaciones a salidas")}
        </div>
        ${renderizarVistaPreviaAsignaturasExcel(asignaturas)}
      </div>
      <footer class="plan-dialog-footer"><button id="cancelarImportacionExcel" class="planes-secondary-button" type="button">Cancelar</button><button id="validarImportacionExcel" class="planes-primary-button" type="button"><i data-lucide="shield-check"></i> Validar archivo</button></footer>
    </div>`;

  renderizarIconos();
  if (!dialog.open) dialog.showModal();
  const cerrar = () => dialog.close();
  document
    .getElementById("cerrarImportPreview")
    ?.addEventListener("click", cerrar);
  document
    .getElementById("cancelarImportacionExcel")
    ?.addEventListener("click", cerrar);
  document
    .getElementById("validarImportacionExcel")
    ?.addEventListener("click", () => prepararValidacionImportacion(datos));
}

async function abrirRevisionPlan() {
  if (!planSeleccionado) {
    return;
  }

  const button = document.getElementById("revisarPlanButton");
  const htmlOriginal = button?.innerHTML || "";

  if (button) {
    button.disabled = true;
    button.classList.add("is-loading");
    button.innerHTML = `
      <span class="ver-plan-tool-icon">
        <i data-lucide="loader-circle" aria-hidden="true"></i>
      </span>
      <span class="ver-plan-tool-label">Revisando...</span>
    `;
    renderizarIconos();
  }

  try {
    const resultado = await validarPlanEstudio(planSeleccionado.id);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible revisar el plan.",
      );
    }

    mostrarResultadoRevision(resultado.validacion);
  } catch (error) {
    console.error("Error revisando plan:", error);
    mostrarErrorRevision(
      error?.message || "No fue posible revisar el plan.",
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
      button.innerHTML = htmlOriginal;
      renderizarIconos();
    }
  }
}

function renderizarEstadoGeneralRevision(validacion) {
  const valido = validacion?.valido === true;
  const advertencias = Number(validacion?.totalAdvertencias || 0);

  if (!valido) {
    return `<div class="plan-review-status plan-review-status-error"><i data-lucide="circle-x"></i><div><strong>El plan presenta errores</strong><p>Hay inconsistencias que deben corregirse antes de considerar completa la configuración.</p></div></div>`;
  }

  if (advertencias > 0) {
    return `<div class="plan-review-status plan-review-status-warning"><i data-lucide="triangle-alert"></i><div><strong>El plan no presenta errores críticos</strong><p>Se encontraron ${advertencias} advertencia${advertencias === 1 ? "" : "s"} para revisar.</p></div></div>`;
  }

  return '<div class="plan-review-status plan-review-status-ok"><i data-lucide="circle-check-big"></i><div><strong>Revisión completada</strong><p>No se detectaron errores ni advertencias automáticas.</p></div></div>';
}

function formatearCodigoValidacion(codigo) {
  const nombres = {
    ASIGNATURA_SIN_NOMBRE: "Asignatura sin nombre curricular",
    ASIGNATURA_SIN_CODIGO: "Asignatura sin código curricular",
    CODIGO_ASIGNATURA_DUPLICADO: "Código curricular duplicado",
    HORAS_NO_COINCIDEN: "Horas inconsistentes",
    OPTATIVA_SIN_CLASIFICAR: "Optativa sin clasificar",
    REGLA_OPTATIVAS_NO_CONFIGURADA: "Regla de optativas no configurada",
    CANTIDAD_OPTATIVAS_DISCIPLINARIAS_NO_CUMPLIDA: "Cantidad de optativas disciplinarias",
    CANTIDAD_OPTATIVAS_ABIERTAS_NO_CUMPLIDA: "Cantidad de optativas abiertas",
    CANTIDAD_OPTATIVAS_SEDE_NO_CUMPLIDA: "Cantidad de optativas de sede",
    CURSO_DUPLICADO: "Curso duplicado",
    REQUISITO_POSTERIOR: "Requisito posterior",
    REQUISITO_INACTIVO: "Requisito inactivo",
    CICLO_REQUISITOS: "Ciclo de requisitos",
    SALIDA_SIN_ASIGNATURAS: "Salida académica vacía",
    CREDITOS_SALIDA_NO_COINCIDEN: "Créditos de salida",
  };

  return nombres[codigo] || codigo?.replaceAll("_", " ") || "Validación";
}

function obtenerSugerenciaRevision(codigo) {
  const sugerencias = {
    ASIGNATURA_SIN_NOMBRE: "Revise el nombre curricular registrado para esta asignatura.",
    ASIGNATURA_SIN_CODIGO: "Revise el código curricular registrado para esta asignatura.",
    CODIGO_ASIGNATURA_DUPLICADO: "Revise los códigos de las asignaturas activas del plan y corrija el duplicado.",
    HORAS_NO_COINCIDEN: "Compare las horas totales con la suma de teoría, práctica, laboratorio, gira y estudio independiente.",
    OPTATIVA_SIN_CLASIFICAR: "Clasifique la optativa como disciplinaria, abierta o de sede.",
    REGLA_OPTATIVAS_NO_CONFIGURADA: "Revise la cantidad y clasificación de optativas activas y configure la regla del plan.",
    CANTIDAD_OPTATIVAS_DISCIPLINARIAS_NO_CUMPLIDA: "Compare la cantidad disciplinaria configurada con las asignaturas optativas activas de esa clasificación.",
    CANTIDAD_OPTATIVAS_ABIERTAS_NO_CUMPLIDA: "Compare la cantidad abierta configurada con las asignaturas optativas activas de esa clasificación.",
    CANTIDAD_OPTATIVAS_SEDE_NO_CUMPLIDA: "Compare la cantidad de sede configurada con las asignaturas optativas activas de esa clasificación.",
    REQUISITO_INACTIVO: "Revise el estado de la asignatura y de la relación de requisito asociada.",
    REQUISITO_POSTERIOR: "Revise la ubicación por nivel y ciclo del requisito y la relación registrada.",
    CICLO_REQUISITOS: "Revise las relaciones de requisitos del plan y elimine la dependencia circular.",
    SALIDA_SIN_ASIGNATURAS: "Revise las materias activas asociadas a esta salida académica.",
    CREDITOS_SALIDA_NO_COINCIDEN: "Compare los créditos requeridos con los créditos de las materias activas asociadas.",
  };

  return sugerencias[codigo] || "Revise la regla académica indicada y los datos relacionados en el plan.";
}

export function obtenerContextoItemRevision(
  item,
  asignaturas = asignaturasPlan,
  salidas = salidasAcademicas,
) {
  const asignatura = item.asignaturaId
    ? asignaturas.find((registro) => Number(registro.id) === Number(item.asignaturaId))
    : null;
  const salida = item.salidaId
    ? salidas.find((registro) => Number(registro.id) === Number(item.salidaId))
    : null;
  return asignatura
    ? obtenerDatosAsignatura(asignatura).nombre
    : salida?.nombre || null;
}

export function renderizarItemRevision(item, tipo, contexto = obtenerContextoItemRevision(item)) {
  const esError = tipo === "ERROR";
  return `
    <article class="plan-review-item ${esError ? "is-error" : "is-warning"}">
      <div class="plan-review-item-icon"><i data-lucide="${esError ? "circle-x" : "triangle-alert"}"></i></div>
      <div class="plan-review-item-content">
        <strong>${escapeHtml(formatearCodigoValidacion(item.codigo))}</strong>
        ${contexto ? `<small>Elemento relacionado: ${escapeHtml(contexto)}</small>` : ""}
        <p>${escapeHtml(item.mensaje || "Inconsistencia detectada.")}</p>
        <p class="plan-review-item-guidance"><strong>Qué revisar:</strong> ${escapeHtml(obtenerSugerenciaRevision(item.codigo))}</p>
      </div>
    </article>`;
}

function renderizarGrupoRevision(titulo, descripcion, items, tipo) {
  return `
    <section class="plan-review-group">
      <header><div><strong>${escapeHtml(titulo)}</strong><small>${escapeHtml(descripcion)}</small></div><span>${items.length}</span></header>
      <div class="plan-review-list">${items.map((item) => renderizarItemRevision(item, tipo)).join("")}</div>
    </section>`;
}

function mostrarResultadoRevision(validacion) {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");

  if (!dialog || !content || !planSeleccionado) {
    return;
  }

  const errores = Array.isArray(validacion?.errores) ? validacion.errores : [];
  const advertencias = Array.isArray(validacion?.advertencias)
    ? validacion.advertencias
    : [];

  const body = `
    <div class="plan-review-content">
      ${renderizarEstadoGeneralRevision(validacion)}

      <div class="plan-review-counters">
        <article>
          <strong>${errores.length}</strong>
          <span>Errores</span>
        </article>
        <article>
          <strong>${advertencias.length}</strong>
          <span>Advertencias</span>
        </article>
      </div>

      ${
        errores.length
          ? renderizarGrupoRevision(
              "Errores",
              "Estos problemas deben corregirse.",
              errores,
              "ERROR",
            )
          : ""
      }

      ${
        advertencias.length
          ? renderizarGrupoRevision(
              "Advertencias",
              "Revise estos puntos contra el documento oficial.",
              advertencias,
              "ADVERTENCIA",
            )
          : ""
      }

      ${
        errores.length === 0 && advertencias.length === 0
          ? `
              <div class="plan-review-empty">
                <i data-lucide="circle-check-big" aria-hidden="true"></i>
                <div>
                  <strong>No se detectaron inconsistencias</strong>
                  <p>
                    Las validaciones automáticas del plan no encontraron problemas.
                  </p>
                </div>
              </div>
            `
          : ""
      }
    </div>
  `;

  const footerHtml = `
    <button
      id="volverEjecutarRevision"
      class="sgpa-form-secondary sgpa-form-footer-left"
      type="button"
    >
      <i data-lucide="refresh-cw" aria-hidden="true"></i>
      Revisar nuevamente
    </button>

    <button
      id="cerrarRevisionPlanFooter"
      class="sgpa-form-primary"
      type="button"
    >
      <span>Cerrar</span>
    </button>
  `;

  content.innerHTML = FormDialog({
    formId: "revisionPlanForm",
    title: "Revisión del plan",
    description: planSeleccionado.nombre,
    body,
    layout: "custom",
    formClass: "plan-review-dialog",
    footerHtml,
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  document
    .getElementById("cerrarRevisionPlanFooter")
    ?.addEventListener("click", () => dialog.close());

  document
    .getElementById("volverEjecutarRevision")
    ?.addEventListener("click", () => {
      dialog.close();
      abrirRevisionPlan();
    });
}

function mostrarErrorRevision(mensaje) {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");

  if (!dialog || !content) {
    return;
  }

  const body = `
    <div class="plan-review-request-error">
      <i data-lucide="circle-alert" aria-hidden="true"></i>
      <p>${escapeHtml(mensaje)}</p>
    </div>
  `;

  content.innerHTML = FormDialog({
    formId: "revisionPlanErrorForm",
    title: "Revisión del plan",
    description: "No fue posible completar la revisión.",
    body,
    cancelButtonId: "cerrarErrorRevision",
    cancelText: "Cerrar",
    layout: "custom",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  document
    .getElementById("cerrarErrorRevision")
    ?.addEventListener("click", () => dialog.close());
}

function renderizarDetallePlan() {
  const contenedor = document.getElementById("planesEstudioPage");

  if (!contenedor || !planSeleccionado) {
    return;
  }

  const creditosTotales = asignaturasPlan
    .filter((item) => item.activo)
    .reduce((total, item) => total + Number(item.creditos || 0), 0);

  const contenidoVista =
    vistaDetallePlan === "MALLA"
      ? renderizarMallaCurricular()
      : renderizarListaAsignaturas();

  contenedor.innerHTML = VerPlanPage({
    plan: planSeleccionado,
    resumenPlan,
    reglaOptativasPlan,
    creditosTotales,
    vista: vistaDetallePlan,
    contenidoVista,
    puedeGestionar: puedeGestionarPlanes(true),
  });


  /*
   * Conectamos los eventos ANTES de renderizar los iconos.
   * Así, aunque Lucide tenga un icono faltante o falle al pintar uno,
   * los botones de Lista y los cards de Malla siguen funcionando.
   */
  conectarEventosDetallePlan(contenedor);

  try {
    renderizarIconos();
  } catch (error) {
    console.error("No fue posible renderizar todos los iconos del plan:", error);
  }

  observerMalla?.disconnect();
  observerMalla = null;
  if (frameDibujoMalla !== null) {
    window.cancelAnimationFrame(frameDibujoMalla);
    frameDibujoMalla = null;
  }

  if (vistaDetallePlan === "MALLA") {
    window.requestAnimationFrame(() => {
      dibujarConexionesMalla();

      const canvas = document.getElementById("mallaCanvas");

      if (canvas && typeof ResizeObserver !== "undefined") {
        observerMalla = new ResizeObserver(() => {
          programarDibujoMalla();
        });

        observerMalla.observe(canvas);
        canvas
          .querySelectorAll("[data-malla-asignatura]")
          .forEach((card) => observerMalla.observe(card));
      }
    });
  }
}

function crearFilaCargaRapidaAsignatura(indice) {
  return `
    <div class="plan-bulk-row" data-asignatura-carga>
      <label>
        <span>Código</span>
        <input
          type="text"
          class="carga-asignatura-codigo"
          maxlength="30"
          placeholder="EIF101"
          required
        >
      </label>

      <label>
        <span>Nombre</span>
        <input
          type="text"
          class="carga-asignatura-nombre"
          maxlength="${MAX_NOMBRE_ASIGNATURA}"
          placeholder="Programación I"
          required
        >
      </label>

      <label>
        <span>Créditos</span>
        <input
          type="number"
          class="carga-asignatura-creditos"
          min="${MIN_CREDITOS_ASIGNATURA}"
          max="${MAX_CREDITOS_ASIGNATURA}"
          value="3"
          required
        >
      </label>

      <label>
        <span>Orden</span>
        <input
          type="number"
          class="carga-asignatura-orden"
          min="1"
          max="${MAX_ORDEN_ASIGNATURA}"
          value="${indice + 1}"
          required
        >
      </label>

      <label>
        <span>Tipo</span>
        <select class="carga-asignatura-tipo" required>
          <option value="OBLIGATORIA">Obligatoria</option>
          <option value="GENERAL">General</option>
          <option value="OPTATIVA">Optativa</option>
          <option value="OTRA">Otra</option>
        </select>
      </label>

      <label class="carga-asignatura-tipo-optativa-field hidden">
        <span>Tipo de optativa</span>
        <select class="carga-asignatura-tipo-optativa" disabled>
          <option value="" selected disabled>Seleccione...</option>
          <option value="DISCIPLINARIA">Disciplinaria / de carrera</option>
          <option value="ABIERTA">Abierta / otra área</option>
          <option value="SEDE">De sede / otra área</option>
        </select>
      </label>

      <button
        type="button"
        class="planes-icon-button carga-eliminar-fila"
        title="Eliminar fila"
        aria-label="Eliminar fila"
      >
        <i data-lucide="trash-2" aria-hidden="true"></i>
      </button>
    </div>
  `;
}

function actualizarTipoOptativaFilaCarga(fila) {
  if (!fila) {
    return;
  }

  const tipoSelect = fila.querySelector(".carga-asignatura-tipo");
  const campo = fila.querySelector(".carga-asignatura-tipo-optativa-field");
  const tipoOptativaSelect = fila.querySelector(
    ".carga-asignatura-tipo-optativa",
  );

  const esOptativa = tipoSelect?.value === "OPTATIVA";

  campo?.classList.add("hidden");

  if (tipoOptativaSelect) {
    tipoOptativaSelect.disabled = true;
    tipoOptativaSelect.required = false;
  }
}

function abrirCargaRapida() {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  if (!planSeleccionado) {
    return;
  }

  renderizarCargaRapida();
}

function renderizarCargaRapida() {
  const content = document.getElementById("asignaturaDialogContent");

  if (!content || !planSeleccionado) {
    return;
  }

  const body = `
    <div class="sgpa-form-grid carga-rapida-config">
      <label>
        <span>Nivel / Año</span>
        <input
          id="cargaAsignaturaNivel"
          type="number"
          min="1"
          max="20"
          value="1"
          required
        >
      </label>

      <label>
        <span>Ciclo / Semestre</span>
        <input
          id="cargaAsignaturaCiclo"
          type="number"
          min="1"
          max="20"
          value="1"
          required
        >
      </label>

    </div>

    <div class="plan-bulk-header">
      <div>
        <h4>Asignaturas</h4>
        <p>Agregue las asignaturas que pertenecen a este nivel y ciclo.</p>
      </div>

      <button
        id="agregarFilaCargaAsignatura"
        class="sgpa-form-secondary"
        type="button"
      >
        <i data-lucide="plus" aria-hidden="true"></i>
        Agregar fila
      </button>
    </div>

    <div id="cargaAsignaturasFilas" class="plan-bulk-rows">
      ${crearFilaCargaRapidaAsignatura(0)}
    </div>
  `;

  content.innerHTML = FormDialog({
    formId: "cargaRapidaForm",
    title: "Carga rápida",
    description: planSeleccionado.nombre,
    body,
    errorId: "cargaRapidaError",
    cancelButtonId: "cancelarCargaRapida",
    cancelText: "Cancelar",
    submitButtonId: "guardarCargaRapida",
    submitText: "Cargar asignaturas",
    submitButtonType: "button",
    submitIcon: "save",
    layout: "custom",
    formClass: "carga-rapida",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  document
    .querySelectorAll("[data-asignatura-carga]")
    .forEach(actualizarTipoOptativaFilaCarga);

  const cerrar = () => document.getElementById("asignaturaDialog")?.close();

  document
    .getElementById("cancelarCargaRapida")
    ?.addEventListener("click", cerrar);

  document
    .getElementById("agregarFilaCargaAsignatura")
    ?.addEventListener("click", () => {
      const filasContainer = document.getElementById("cargaAsignaturasFilas");

      if (!filasContainer) {
        return;
      }

      const total = filasContainer.querySelectorAll(
        "[data-asignatura-carga]",
      ).length;

      if (total >= 200) {
        const errorBox = document.getElementById("cargaRapidaError");
        if (errorBox) {
          errorBox.textContent = "La carga rápida admite hasta 200 asignaturas.";
          errorBox.classList.remove("hidden");
        }
        return;
      }

      filasContainer.insertAdjacentHTML(
        "beforeend",
        crearFilaCargaRapidaAsignatura(total),
      );

      actualizarTipoOptativaFilaCarga(
        filasContainer.lastElementChild,
      );

      renderizarIconos();
    });

  document
    .getElementById("cargaAsignaturasFilas")
    ?.addEventListener("change", (event) => {
      const select = event.target.closest(".carga-asignatura-tipo");

      if (!select) {
        return;
      }

      actualizarTipoOptativaFilaCarga(
        select.closest("[data-asignatura-carga]"),
      );
    });

  document
    .getElementById("cargaAsignaturasFilas")
    ?.addEventListener("click", (event) => {
      const button = event.target.closest(".carga-eliminar-fila");
      if (!button) {
        return;
      }

      const filasContainer = document.getElementById("cargaAsignaturasFilas");
      const filas = filasContainer?.querySelectorAll("[data-asignatura-carga]");

      if (!filasContainer || !filas || filas.length <= 1) {
        return;
      }

      button.closest("[data-asignatura-carga]")?.remove();
    });

  document
    .getElementById("guardarCargaRapida")
    ?.addEventListener("click", guardarCargaRapida);
}

function construirCargaRapida() {
  const nivel = Number(document.getElementById("cargaAsignaturaNivel")?.value);
  const ciclo = Number(document.getElementById("cargaAsignaturaCiclo")?.value);
  const filas = [
    ...document.querySelectorAll("[data-asignatura-carga]"),
  ];

  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 20) {
    throw new Error("Debe indicar un nivel válido entre 1 y 20.");
  }

  if (!Number.isInteger(ciclo) || ciclo < 1 || ciclo > 20) {
    throw new Error("Debe indicar un ciclo válido entre 1 y 20.");
  }

  if (filas.length === 0 || filas.length > 200) {
    throw new Error("Debe cargar entre 1 y 200 asignaturas.");
  }

  const codigosUtilizados = new Set();

  const asignaturas = filas.map((fila, index) => {
    const codigoReferencia =
      fila
        .querySelector(".carga-asignatura-codigo")
        ?.value?.trim()
        .toUpperCase() || "";
    const nombreReferencia =
      fila.querySelector(".carga-asignatura-nombre")?.value?.trim() || "";
    const creditos = Number(
      fila.querySelector(".carga-asignatura-creditos")?.value,
    );
    const orden = Number(
      fila.querySelector(".carga-asignatura-orden")?.value,
    );
    const tipo =
      fila.querySelector(".carga-asignatura-tipo")?.value || "OBLIGATORIA";
    const tipoOptativa =
      fila.querySelector(".carga-asignatura-tipo-optativa")?.value || "";

    if (!codigoReferencia) {
      throw new Error(`Fila ${index + 1}: debe indicar el código.`);
    }

    if (!nombreReferencia) {
      throw new Error(`Fila ${index + 1}: debe indicar el nombre.`);
    }

    if (nombreReferencia.length > MAX_NOMBRE_ASIGNATURA) {
      throw new Error(
        `Fila ${index + 1}: el nombre no puede superar ${MAX_NOMBRE_ASIGNATURA} caracteres.`,
      );
    }

    if (codigosUtilizados.has(codigoReferencia)) {
      throw new Error(
        `Fila ${index + 1}: el código ${codigoReferencia} está repetido dentro de esta carga.`,
      );
    }

    codigosUtilizados.add(codigoReferencia);

    if (
      !Number.isInteger(creditos) ||
      creditos < MIN_CREDITOS_ASIGNATURA ||
      creditos > MAX_CREDITOS_ASIGNATURA
    ) {
      throw new Error(
        `Fila ${index + 1}: los créditos deben estar entre ${MIN_CREDITOS_ASIGNATURA} y ${MAX_CREDITOS_ASIGNATURA}.`,
      );
    }

    if (
      !Number.isInteger(orden) ||
      orden < 1 ||
      orden > MAX_ORDEN_ASIGNATURA
    ) {
      throw new Error(
        `Fila ${index + 1}: el orden debe estar entre 1 y ${MAX_ORDEN_ASIGNATURA}.`,
      );
    }

    return {
      codigoReferencia,
      nombreReferencia,
      nivel,
      ciclo,
      orden,
      creditos,
      tipo,
      tipoOptativa: null,
    };
  });

  validarCargaRapidaOptativas(asignaturas);
  return asignaturas;
}

async function guardarCargaRapida() {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("cargaRapidaError");
  const button = document.getElementById("guardarCargaRapida");

  if (!errorBox || !button || !planSeleccionado) {
    return;
  }

  errorBox.classList.add("hidden");
  errorBox.textContent = "";

  try {
    const asignaturas = construirCargaRapida();
    button.disabled = true;
    button.textContent = "Cargando...";

    const resultado = await cargarAsignaturasMasivamente(
      planSeleccionado.id,
      asignaturas,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible realizar la carga rápida.",
      );
    }

    document.getElementById("asignaturaDialog")?.close();
    await recargarAsignaturasPlan();
  } catch (error) {
    errorBox.textContent =
      error?.message || "No fue posible realizar la carga rápida.";
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false;
    button.textContent = "Cargar asignaturas";
  }
}

function abrirFormularioAsignatura(asignatura = null, valoresIniciales = {}) {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");

  if (!dialog || !content || !planSeleccionado) {
    return;
  }

  const editando = Boolean(asignatura);
  const vinculadaACurso = Boolean(asignatura?.cursoId);
  const nivelInicial = editando
    ? Number(asignatura.nivel || 1)
    : Number(valoresIniciales.nivel || 1);
  const cicloInicial = editando
    ? Number(asignatura.ciclo || 1)
    : Number(valoresIniciales.ciclo || 1);
  const ordenInicial = editando ? Number(asignatura.orden || 1) : null;

  const reglaOptativas = obtenerReglaOptativasActual();
  const excluirIdCupo = editando && asignatura?.activo !== false
    ? asignatura.id
    : null;
  const cupoDisciplinaria = obtenerEstadoCupoOptativa(
    "DISCIPLINARIA",
    excluirIdCupo,
  );
  const cupoAbierta = obtenerEstadoCupoOptativa("ABIERTA", excluirIdCupo);
  const cupoSede = obtenerEstadoCupoOptativa("SEDE", excluirIdCupo);

  const body = `
    <div class="sgpa-form-grid">
      <div class="plan-reference-fields sgpa-form-wide">
        <label>
          <span>Código de la asignatura</span>
          <input
            id="asignaturaCodigoReferencia"
            maxlength="30"
            value="${escapeHtml(
              asignatura?.codigoReferencia || asignatura?.curso?.codigo || "",
            )}"
            placeholder="Ej. EIF201"
            ${vinculadaACurso ? "disabled" : ""}
            required
          >
        </label>

        <label>
          <span>Nombre de la asignatura</span>
          <input
            id="asignaturaNombreReferencia"
            maxlength="${MAX_NOMBRE_ASIGNATURA}"
            value="${escapeHtml(
              asignatura?.nombreReferencia || asignatura?.curso?.nombre || "",
            )}"
            placeholder="Ej. Programación I"
            ${vinculadaACurso ? "disabled" : ""}
            required
          >
        </label>
      </div>

      <label>
        <span>Nivel</span>
        <input
          id="asignaturaNivel"
          type="number"
          min="1"
          max="4"
          value="${nivelInicial}"
          required
        >
      </label>

      <label>
        <span>Ciclo</span>
        <input
          id="asignaturaCiclo"
          type="number"
          min="1"
          max="2"
          value="${cicloInicial}"
          required
        >
      </label>

      <label>
        <span>Créditos</span>
        <input
          id="asignaturaCreditos"
          type="number"
          min="${MIN_CREDITOS_ASIGNATURA}"
          max="${MAX_CREDITOS_ASIGNATURA}"
          value="${asignatura?.creditos ?? 0}"
          required
        >
      </label>

      ${editando ? `<label>
        <span>Orden</span>
        <input
          id="asignaturaOrden"
          type="number"
          min="1"
          max="${MAX_ORDEN_ASIGNATURA}"
          value="${ordenInicial}"
          required
        >
      </label>` : ""}

      <label class="sgpa-form-wide">
        <span>Tipo</span>
        <select
          id="asignaturaTipo"
          ${vinculadaACurso ? "disabled" : ""}
          required
        >
          <option
            value="OBLIGATORIA"
            ${
              (asignatura?.tipo || "OBLIGATORIA") === "OBLIGATORIA"
                ? "selected"
                : ""
            }
          >
            Obligatoria
          </option>
          <option
            value="GENERAL"
            ${asignatura?.tipo === "GENERAL" ? "selected" : ""}
          >
            General
          </option>
          <option
            value="OPTATIVA"
            ${asignatura?.tipo === "OPTATIVA" ? "selected" : ""}
          >
            Optativa
          </option>
          <option
            value="OTRA"
            ${asignatura?.tipo === "OTRA" ? "selected" : ""}
          >
            Otra
          </option>
        </select>
        <small
          id="asignaturaTipoHelp"
          class="sgpa-field-help plan-type-help"
        ></small>
        ${
          vinculadaACurso
            ? `
                <small class="sgpa-field-help plan-type-locked">
                  El tipo no puede modificarse desde esta pantalla porque la
                  asignatura ya está vinculada al catálogo de Cursos.
                </small>
              `
            : ""
        }
      </label>

      <label
        id="asignaturaTipoOptativaField"
        class="sgpa-form-wide ${
          "hidden"
        }"
      >
        <span>Tipo de optativa</span>
        <select
          id="asignaturaTipoOptativa"
          disabled
        >
          <option
            value=""
            ${!asignatura?.tipoOptativa ? "selected" : ""}
            disabled
          >
            Seleccione el tipo de optativa...
          </option>
          <option
            value="DISCIPLINARIA"
            ${
              asignatura?.tipoOptativa === "DISCIPLINARIA"
                ? "selected"
                : ""
            }
            ${cupoDisciplinaria.bloqueada ? "disabled" : ""}
          >
            Disciplinaria / de carrera
          </option>
          <option
            value="ABIERTA"
            ${asignatura?.tipoOptativa === "ABIERTA" ? "selected" : ""}
            ${cupoAbierta.bloqueada ? "disabled" : ""}
          >
            Abierta
          </option>
          <option
            value="SEDE"
            ${asignatura?.tipoOptativa === "SEDE" ? "selected" : ""}
            ${cupoSede.bloqueada ? "disabled" : ""}
          >
            De sede / otra sede
          </option>
        </select>
        <small id="asignaturaTipoOptativaHelp" class="sgpa-field-help">
          ${
            reglaOptativas
              ? `Disponibles según la regla: ${cupoDisciplinaria.disponibles} disciplinaria(s), ${cupoAbierta.disponibles} abierta(s) y ${cupoSede.disponibles} de sede.`
              : "Configure primero la Regla de optativas del plan. Sin una regla no se pueden registrar asignaturas OPTATIVA."
          }
        </small>
      </label>

      <details
        class="plan-hours-section sgpa-form-wide"
        ${
          asignatura &&
          [
            asignatura.horasTeoria,
            asignatura.horasPractica,
            asignatura.horasLaboratorio,
            asignatura.horasGira,
            asignatura.horasEstudioIndependiente,
            asignatura.horasTotales,
            asignatura.horasDocente,
          ].some((valor) => valor !== null && valor !== undefined)
            ? "open"
            : ""
        }
      >
        <summary>
          <div>
            <strong>Información de horas</strong>
            <small>
              Datos académicos específicos de esta asignatura dentro del plan.
            </small>
          </div>
          <i data-lucide="chevron-down" aria-hidden="true"></i>
        </summary>

        <div class="plan-hours-content">
          <div class="plan-hours-grid">
            <label>
              <span>T · Teoría</span>
              <input
                id="asignaturaHorasTeoria"
                type="number"
                min="0"
                max="999"
                step="0.01"
                value="${asignatura?.horasTeoria ?? ""}"
                placeholder="-"
              >
            </label>
            <label>
              <span>P · Práctica</span>
              <input
                id="asignaturaHorasPractica"
                type="number"
                min="0"
                max="999"
                step="0.01"
                value="${asignatura?.horasPractica ?? ""}"
                placeholder="-"
              >
            </label>
            <label>
              <span>L · Laboratorio</span>
              <input
                id="asignaturaHorasLaboratorio"
                type="number"
                min="0"
                max="999"
                step="0.01"
                value="${asignatura?.horasLaboratorio ?? ""}"
                placeholder="-"
              >
            </label>
            <label>
              <span>G · Gira</span>
              <input
                id="asignaturaHorasGira"
                type="number"
                min="0"
                max="999"
                step="0.01"
                value="${asignatura?.horasGira ?? ""}"
                placeholder="-"
              >
            </label>
            <label>
              <span>EI · Estudio independiente</span>
              <input
                id="asignaturaHorasEI"
                type="number"
                min="0"
                max="999"
                step="0.01"
                value="${asignatura?.horasEstudioIndependiente ?? ""}"
                placeholder="-"
              >
            </label>
            <label>
              <span>HT · Horas totales</span>
              <input
                id="asignaturaHorasTotales"
                type="number"
                min="0"
                max="999"
                step="0.01"
                value="${asignatura?.horasTotales ?? ""}"
                placeholder="-"
              >
            </label>
            <label>
              <span>HD · Horas docente</span>
              <input
                id="asignaturaHorasDocente"
                type="number"
                min="0"
                max="999"
                step="0.01"
                value="${asignatura?.horasDocente ?? ""}"
                placeholder="-"
              >
            </label>
          </div>

          <div id="horasReferencia" class="plan-hours-reference hidden"></div>

          <label class="plan-hours-observation">
            <span>Observación</span>
            <textarea
              id="asignaturaObservacionHoras"
              maxlength="250"
              rows="2"
              placeholder="Ej. Incluye gira, laboratorio especial o información indicada en el plan..."
            >${escapeHtml(asignatura?.observacionHoras || "")}</textarea>
          </label>
        </div>
      </details>
    </div>
  `;

  content.innerHTML = FormDialog({
    formId: "asignaturaForm",
    title: editando ? "Editar asignatura" : "Agregar asignatura",
    description: editando
      ? planSeleccionado.nombre
      : `${planSeleccionado.nombre} · ${obtenerNombreAnioNivel(
          nivelInicial,
        )} · ${obtenerNombreCiclo(cicloInicial)}`,
    body,
    errorId: "asignaturaFormError",
    cancelButtonId: "cancelarAsignaturaButton",
    cancelText: "Cancelar",
    submitButtonId: "guardarAsignaturaButton",
    submitText: esAsistente() ? "Enviar propuesta" : (editando ? "Guardar cambios" : "Agregar asignatura"),
    submitIcon: "save",
    layout: "custom",
    formClass: "asignatura-plan-form",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  const tipoSelect = document.getElementById("asignaturaTipo");
  const tipoHelp = document.getElementById("asignaturaTipoHelp");
  const tipoOptativaField = document.getElementById(
    "asignaturaTipoOptativaField",
  );
  const tipoOptativaSelect = document.getElementById(
    "asignaturaTipoOptativa",
  );
  const codigoInput = document.getElementById("asignaturaCodigoReferencia");
  const nombreInput = document.getElementById("asignaturaNombreReferencia");

  const actualizarAyudaTipo = () => {
    const tipo = tipoSelect?.value || asignatura?.tipo || "OBLIGATORIA";
    const esOptativa = tipo === "OPTATIVA";

    if (tipoHelp) {
      tipoHelp.textContent = obtenerAyudaTipoAsignatura(tipo);
    }

    tipoOptativaField?.classList.add("hidden");

    if (tipoOptativaSelect) {
      tipoOptativaSelect.disabled = true;
      tipoOptativaSelect.required = false;
    }

    if (!vinculadaACurso && codigoInput && nombreInput) {
      const ejemplos = {
        OBLIGATORIA: { codigo: "Ej. EIF201", nombre: "Ej. Programación I" },
        GENERAL: { codigo: "Ej. GEN-01", nombre: "Ej. Estudios Generales I" },
        OPTATIVA: { codigo: "Ej. OPT-01", nombre: "Ej. Optativa I" },
        OTRA: { codigo: "Ej. ESP-01", nombre: "Ej. Espacio curricular" },
      };

      const ejemplo = ejemplos[tipo] || ejemplos.OTRA;
      codigoInput.placeholder = ejemplo.codigo;
      nombreInput.placeholder = ejemplo.nombre;
    }
  };

  tipoSelect?.addEventListener("change", actualizarAyudaTipo);
  actualizarAyudaTipo();

  const camposHoras = [
    "asignaturaHorasTeoria",
    "asignaturaHorasPractica",
    "asignaturaHorasLaboratorio",
    "asignaturaHorasGira",
    "asignaturaHorasEI",
  ];

  const actualizarReferenciaHoras = () => {
    const referencia = document.getElementById("horasReferencia");
    if (!referencia) {
      return;
    }

    const valores = camposHoras
      .map((id) => {
        const input = document.getElementById(id);
        if (!input || input.value.trim() === "") {
          return null;
        }
        return Number(input.value);
      })
      .filter((valor) => valor !== null && !Number.isNaN(valor));

    if (!valores.length) {
      referencia.textContent = "";
      referencia.classList.add("hidden");
      return;
    }

    const suma = valores.reduce((total, valor) => total + valor, 0);
    referencia.textContent = `Referencia: T + P + L + G + EI = ${Number(
      suma.toFixed(2),
    )}. HT se guarda según el documento oficial.`;
    referencia.classList.remove("hidden");
  };

  for (const id of camposHoras) {
    document
      .getElementById(id)
      ?.addEventListener("input", actualizarReferenciaHoras);
  }

  actualizarReferenciaHoras();

  const cerrar = () => dialog.close();
  document
    .getElementById("cancelarAsignaturaButton")
    ?.addEventListener("click", cerrar);

  document
    .getElementById("asignaturaForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await guardarAsignatura(asignatura, cerrar);
    });
}

async function guardarAsignatura(asignatura, cerrar) {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("asignaturaFormError");
  const button = document.getElementById("guardarAsignaturaButton");

  if (!errorBox || !button || !planSeleccionado) {
    return;
  }


  const editando = Boolean(asignatura);
  const codigoInput = document.getElementById("asignaturaCodigoReferencia");
  const nombreInput = document.getElementById("asignaturaNombreReferencia");
  const codigoReferencia = codigoInput?.value?.trim().toUpperCase() || "";
  const nombreReferencia = nombreInput?.value?.trim() || "";

  if (!codigoReferencia) {
    errorBox.textContent = "Debe indicar el código de la asignatura.";
    errorBox.classList.remove("hidden");
    return;
  }

  if (!nombreReferencia) {
    errorBox.textContent = "Debe indicar el nombre de la asignatura.";
    errorBox.classList.remove("hidden");
    return;
  }

  if (nombreReferencia.length > MAX_NOMBRE_ASIGNATURA) {
    errorBox.textContent =
      `El nombre de la asignatura no puede superar ${MAX_NOMBRE_ASIGNATURA} caracteres.`;
    errorBox.classList.remove("hidden");
    nombreInput?.focus();
    return;
  }

  const creditos = Number(
    document.getElementById("asignaturaCreditos")?.value,
  );
  const orden = editando
    ? Number(document.getElementById("asignaturaOrden")?.value)
    : undefined;

  if (
    !Number.isInteger(creditos) ||
    creditos < MIN_CREDITOS_ASIGNATURA ||
    creditos > MAX_CREDITOS_ASIGNATURA
  ) {
    errorBox.textContent =
      `Los créditos deben estar entre ${MIN_CREDITOS_ASIGNATURA} y ${MAX_CREDITOS_ASIGNATURA}.`;
    errorBox.classList.remove("hidden");
    document.getElementById("asignaturaCreditos")?.focus();
    return;
  }

  if (editando && (
    !Number.isInteger(orden) ||
    orden < 1 ||
    orden > MAX_ORDEN_ASIGNATURA
  )) {
    errorBox.textContent =
      `El orden debe estar entre 1 y ${MAX_ORDEN_ASIGNATURA}.`;
    errorBox.classList.remove("hidden");
    document.getElementById("asignaturaOrden")?.focus();
    return;
  }

  const tipo =
    document.getElementById("asignaturaTipo")?.value || "OBLIGATORIA";
  const tipoOptativa =
    document.getElementById("asignaturaTipoOptativa")?.value || "";

  const errorCupoOptativa = validarCupoOptativaFrontend(
    tipo,
    null,
    asignatura,
  );

  if (errorCupoOptativa) {
    errorBox.textContent = errorCupoOptativa;
    errorBox.classList.remove("hidden");
    return;
  }

  const datos = {
    codigoReferencia,
    nombreReferencia,
    nivel: Number(document.getElementById("asignaturaNivel")?.value),
    ciclo: Number(document.getElementById("asignaturaCiclo")?.value),
    creditos,
    ...(editando ? { orden } : {}),
    tipo,
    tipoOptativa: null,
  };

  const horas = {
    horasTeoria: leerNumeroOpcional("asignaturaHorasTeoria"),
    horasPractica: leerNumeroOpcional("asignaturaHorasPractica"),
    horasLaboratorio: leerNumeroOpcional("asignaturaHorasLaboratorio"),
    horasGira: leerNumeroOpcional("asignaturaHorasGira"),
    horasEstudioIndependiente: leerNumeroOpcional("asignaturaHorasEI"),
    horasTotales: leerNumeroOpcional("asignaturaHorasTotales"),
    horasDocente: leerNumeroOpcional("asignaturaHorasDocente"),
  };

  for (const [campo, valor] of Object.entries(horas)) {
    if (asignatura || (valor !== null && valor !== undefined)) {
      datos[campo] = valor;
    }
  }

  const observacionHoras =
    document.getElementById("asignaturaObservacionHoras")?.value?.trim() || "";
  if (asignatura || observacionHoras) {
    datos.observacionHoras = observacionHoras || null;
  }


  button.disabled = true;
  errorBox.classList.add("hidden");

  try {
    const resultado = esAsistente()
      ? editando
        ? await proponerActualizarAsignaturaPlan(
            planSeleccionado.id,
            asignatura.id,
            datos,
          )
        : await proponerAsignaturaPlan(planSeleccionado.id, datos)
      : editando
        ? await actualizarPlanAsignatura(
            planSeleccionado.id,
            asignatura.id,
            datos,
          )
        : await crearPlanAsignatura(planSeleccionado.id, datos);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible guardar la asignatura.",
      );
    }

    if (
      Number.isInteger(datos.nivel) &&
      datos.nivel >= 1 &&
      datos.nivel <= 4
    ) {
      nivelPaginaPlan = datos.nivel;
    }

    cerrar();
    if (!esAsistente()) {
      await recargarAsignaturasPlan();
    }

    mostrarExito({
      titulo: esAsistente() ? "Propuesta enviada" : (editando ? "Asignatura actualizada" : "Asignatura agregada"),
      mensaje: esAsistente()
        ? `La propuesta para "${nombreReferencia}" quedó pendiente de aprobación.`
        : (editando
            ? `"${nombreReferencia}" se actualizó correctamente.`
            : `"${nombreReferencia}" se agregó correctamente al Nivel ${datos.nivel}, Ciclo ${datos.ciclo}.`),
    });
  } catch (error) {
    errorBox.textContent =
      error?.message || "No fue posible guardar la asignatura.";
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
}

async function recargarAsignaturasPlan() {
  if (!planSeleccionado) {
    return;
  }

  const resultado = await listarPlanAsignaturas(planSeleccionado.id);

  if (!resultado?.ok) {
    throw new Error(resultado?.message || "No fue posible actualizar el plan.");
  }

  asignaturasPlan = Array.isArray(resultado.asignaturas)
    ? resultado.asignaturas
    : [];

  await Promise.all([
    recargarResumenPlan(),
    recargarReglaOptativasPlan(),
  ]);

  renderizarDetallePlan();
}

function mostrarFeedbackDetalle(mensaje) {
  const feedback = document.getElementById("planDetalleFeedback");

  if (!feedback) {
    return;
  }

  feedback.textContent = mensaje;
  feedback.className = "planes-feedback planes-feedback-error";
}

function obtenerAsignaturaPorId(id) {
  return (
    asignaturasPlan.find((item) => Number(item.id) === Number(id)) || null
  );
}

async function ejecutarAccionAsignatura(accion, id) {
  const asignatura = obtenerAsignaturaPorId(id);

  if (!asignatura || !planSeleccionado) {
    return;
  }

  if (accion === "requisitos") {
    abrirFormularioRequisitos(asignatura);
    return;
  }

  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  if (accion === "editar") {
    abrirFormularioAsignatura(asignatura);
    return;
  }

  if (accion !== "estado") {
    return;
  }

  const nuevoEstado = !asignatura.activo;
  const datos = obtenerDatosAsignatura(asignatura);
  const confirmado = await confirmarAccion({
    titulo: nuevoEstado ? "Activar asignatura" : "Desactivar asignatura",
    mensaje: `¿Desea ${nuevoEstado ? "activar" : "desactivar"} "${
      datos.nombre
    }"?`,
    textoConfirmar: nuevoEstado ? "Activar" : "Desactivar",
    peligro: !nuevoEstado,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await (esAsistente()
      ? proponerEstadoAsignaturaPlan
      : cambiarEstadoPlanAsignatura)(
      planSeleccionado.id,
      asignatura.id,
      nuevoEstado,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          "No fue posible cambiar el estado de la asignatura.",
      );
    }

    if (esAsistente()) {
      mostrarFeedbackDetalle(
        "La solicitud de cambio de estado de la asignatura quedó pendiente de aprobación.",
      );
    } else {
      await recargarAsignaturasPlan();
    }
  } catch (error) {
    mostrarFeedbackDetalle(
      error?.message || "No fue posible cambiar el estado de la asignatura.",
    );
  }
}

function conectarEventosDetallePlan(contenedor) {
  detalleEventosController?.abort();
  const controller = new AbortController();
  detalleEventosController = controller;
  const { signal } = controller;

  window.addEventListener("resize", programarDibujoMalla, { signal });
  // El SVG comparte el sistema de coordenadas del canvas: el scroll mueve
  // ambos juntos, sin medir el DOM ni recalcular rutas durante el gesto.

  contenedor.addEventListener(
    "click",
    async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) {
        return;
      }

      const accionAsignatura = target.closest("[data-asignatura-action]");
      if (accionAsignatura && contenedor.contains(accionAsignatura)) {
        event.preventDefault();
        event.stopPropagation();
        await ejecutarAccionAsignatura(
          accionAsignatura.dataset.asignaturaAction,
          accionAsignatura.dataset.id,
        );
        return;
      }

      const ojoMalla = target.closest("[data-malla-eye]");
      if (ojoMalla && contenedor.contains(ojoMalla)) {
        event.preventDefault();
        event.stopPropagation();
        const asignatura = obtenerAsignaturaPorId(ojoMalla.dataset.mallaEye);
        if (asignatura) {
          abrirFormularioRequisitos(asignatura);
        }
        return;
      }

      const cardMalla = target.closest("[data-malla-asignatura]");
      if (cardMalla && contenedor.contains(cardMalla)) {
        event.preventDefault();
        const id = Number(cardMalla.dataset.mallaAsignatura);

        mallaAsignaturaSeleccionadaId =
          Number(mallaAsignaturaSeleccionadaId) === id ? null : id;

        actualizarEstadoVisualMalla();
        if (mallaAsignaturaSeleccionadaId) mostrarTarjetaMallaCompleta(cardMalla);
        return;
      }

      const agregarCiclo = target.closest("[data-agregar-ciclo]");
      if (agregarCiclo && contenedor.contains(agregarCiclo)) {
        event.preventDefault();
        const nivel = Number(agregarCiclo.dataset.nivel);
        const ciclo = Number(agregarCiclo.dataset.ciclo);
        abrirFormularioAsignatura(null, { nivel, ciclo });
        return;
      }

      const paginaNivel = target.closest("[data-plan-level-page]");
      if (paginaNivel && contenedor.contains(paginaNivel)) {
        if (paginaNivel.disabled) {
          return;
        }

        const nivel = Number(paginaNivel.dataset.planLevelPage);
        if (
          !Number.isInteger(nivel) ||
          nivel < 1 ||
          nivel > 4 ||
          nivel === nivelPaginaPlan
        ) {
          return;
        }

        nivelPaginaPlan = nivel;
        renderizarDetallePlan();

        window.requestAnimationFrame(() => {
          document.getElementById("planVistaContenido")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
        return;
      }

      const vistaButton = target.closest("[data-plan-view]");
      if (vistaButton && contenedor.contains(vistaButton)) {
        const vista = vistaButton.dataset.planView;
        if (vista !== "LISTA" && vista !== "MALLA") {
          return;
        }
        vistaDetallePlan = vista;
        renderizarDetallePlan();
        return;
      }

      if (target.closest("#togglePapeleraPlanButton")) {
        vistaPapeleraPlan = !vistaPapeleraPlan;
        renderizarDetallePlan();
        return;
      }

      const button = target.closest("button");
      if (!button || !contenedor.contains(button)) {
        return;
      }

      switch (button.id) {
        case "volverPlanesButton":
          volverListadoPlanes();
          break;
        case "verDetalleResumenButton":
          abrirDetalleResumenPlan();
          break;
        case "salidasAcademicasButton":
          abrirAdministradorSalidas();
          break;
        case "reglaOptativasButton":
          abrirReglaOptativasPlan();
          break;
        case "cargaRapidaButton":
          abrirCargaRapida();
          break;
        case "requisitosRapidosButton":
          abrirRequisitosRapidos();
          break;
        case "revisarPlanButton":
          abrirRevisionPlan();
          break;
        case "importarExcelPlanButton":
          seleccionarExcelParaPlan();
          break;
        case "plantillaExcelPlanButton":
          descargarPlantillaPlan();
          break;
        case "agregarAsignaturaButton":
        case "agregarPrimeraAsignaturaButton":
          abrirFormularioAsignatura();
          break;
        default:
          break;
      }
    },
    { signal },
  );


  contenedor.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;

      if (target?.closest("[data-malla-eye]")) {
        return;
      }

      const cardMalla = target?.closest("[data-malla-asignatura]");
      if (!cardMalla || !contenedor.contains(cardMalla)) {
        return;
      }

      event.preventDefault();
      const id = Number(cardMalla.dataset.mallaAsignatura);

      mallaAsignaturaSeleccionadaId =
        Number(mallaAsignaturaSeleccionadaId) === id ? null : id;

      actualizarEstadoVisualMalla();
    },
    { signal },
  );
}

async function recargarReglaOptativasPlan() {
  if (!planSeleccionado) {
    return;
  }

  const resultado = await obtenerReglaOptativasPlan(planSeleccionado.id);

  if (!resultado?.ok) {
    throw new Error(
      resultado?.message ||
        "No fue posible actualizar la regla de optativas del plan.",
    );
  }

  reglaOptativasPlan = {
    regla: resultado.regla || null,
    cantidadEspaciosOptativos: Number(
      resultado.cantidadEspaciosOptativos || 0,
    ),
    cantidadEspaciosConfigurados: Number(
      resultado.cantidadEspaciosConfigurados || 0,
    ),
    conteoActual: resultado.conteoActual || null,
  };
}

function abrirReglaOptativasPlan() {
  if (!planSeleccionado) {
    return;
  }

  renderizarReglaOptativasPlan();
}

function renderizarReglaOptativasPlan() {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");

  if (!dialog || !content || !planSeleccionado) {
    return;
  }

  const puedeGestionar = puedeGestionarPlanes(true);
  const conteoOptativas = obtenerConteoOptativasPlan();
  const regla = obtenerReglaOptativasActual();
  const puedeConfigurar = puedeGestionar && planSeleccionado.activo;

  const cantidadDisciplinarias = Number(regla?.cantidadDisciplinarias || 0);
  const cantidadAbiertas = Number(regla?.cantidadAbiertas || 0);
  const cantidadSede = Number(regla?.cantidadSede || 0);
  const totalConfigurado =
    cantidadDisciplinarias + cantidadAbiertas + cantidadSede;
  const puedeEliminarRegla =
    Boolean(regla) && puedeConfigurar && conteoOptativas.total === 0;

  const body = `
    <div class="plan-optative-rule">
      <section class="plan-optative-overview">
        <div class="plan-optative-count">
          <span>Espacios optativos definidos</span>
          <strong>${totalConfigurado}</strong>
          <small>
            ${cantidadDisciplinarias} de carrera · ${cantidadAbiertas} abierta${
              cantidadAbiertas === 1 ? "" : "s"
            } · ${cantidadSede} de sede
          </small>
        </div>

        <div class="plan-optative-rule-state ${regla ? "is-configured" : ""}">
          <i
            data-lucide="${regla ? "circle-check-big" : "circle-dashed"}"
            aria-hidden="true"
          ></i>
          <div>
            <strong>
              ${regla ? "Regla configurada" : "Regla pendiente de configurar"}
            </strong>
            <small>
              ${
                regla
                  ? "La distribución se utiliza como límite al crear, editar, reactivar o cargar asignaturas optativas."
                  : "Defina la distribución antes de registrar asignaturas OPTATIVA en el plan."
              }
            </small>
          </div>
        </div>
      </section>

      <section class="plan-optative-catalog-info">
        <header>
          <span>Tipos de optativa</span>
          <strong>Distribución académica del plan</strong>
          <p>
            La regla se configura antes de construir los espacios optativos.
            La distribución de categorías se comprueba al reconocer las optativas reales; el SGPA evita registrar
            más asignaturas de las permitidas.
          </p>
        </header>

        <div class="plan-optative-kind-grid">
          <article class="plan-optative-kind is-disciplinary">
            <span class="plan-optative-kind-icon">
              <i data-lucide="graduation-cap" aria-hidden="true"></i>
            </span>
            <div>
              <strong>De carrera / disciplinaria</strong>
              <p>
                Espacios propios de la carrera. Su cantidad se controla de
                forma independiente.
              </p>
            </div>
          </article>

          <article class="plan-optative-kind is-open">
            <span class="plan-optative-kind-icon">
              <i data-lucide="globe" aria-hidden="true"></i>
            </span>
            <div>
              <strong>Abierta</strong>
              <p>
                Espacios abiertos a otras áreas o posibilidades académicas,
                según lo definido para el plan.
              </p>
            </div>
          </article>

          <article class="plan-optative-kind is-campus">
            <span class="plan-optative-kind-icon">
              <i data-lucide="map-pinned" aria-hidden="true"></i>
            </span>
            <div>
              <strong>De sede</strong>
              <p>
                Espacios asociados a oferta de sede u otra sede, con un cupo
                propio dentro de la regla.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section class="plan-optative-rule-form">
        <header>
          <span>Regla del plan</span>
          <strong>Defina cuántos espacios habrá de cada categoría</strong>
          <p>
            Puede configurar la regla incluso cuando el plan todavía no tenga
            asignaturas. Después, al registrar una optativa, el SGPA valida
            automáticamente que exista un espacio genérico disponible.
          </p>
        </header>

        <div class="plan-optative-current-status">
          <div><span>Espacios genéricos en la malla</span><strong>${conteoOptativas.total} / ${totalConfigurado}</strong></div>
          <p>La categoría se determina por cada asignatura real reconocida al estudiante.</p>
        </div>
        <div class="sgpa-form-grid plan-optative-fields">
          <label>
            <span>Optativas de carrera</span>
            <input
              id="optativasCantidadDisciplinarias"
              type="number"
              min="0"
              max="${MAX_ESPACIOS_OPTATIVOS_REGLA}"
              value="${cantidadDisciplinarias}"
              ${puedeConfigurar ? "" : "disabled"}
              required
            >
            <small class="sgpa-field-help">
              Cantidad de espacios DISCIPLINARIA permitidos en el plan.
            </small>
          </label>

          <label>
            <span>Optativas abiertas</span>
            <input
              id="optativasCantidadAbiertas"
              type="number"
              min="0"
              max="${MAX_ESPACIOS_OPTATIVOS_REGLA}"
              value="${cantidadAbiertas}"
              ${puedeConfigurar ? "" : "disabled"}
              required
            >
            <small class="sgpa-field-help">
              Cantidad de espacios ABIERTA permitidos en el plan.
            </small>
          </label>

          <label>
            <span>Optativas de sede</span>
            <input
              id="optativasCantidadSede"
              type="number"
              min="0"
              max="${MAX_ESPACIOS_OPTATIVOS_REGLA}"
              value="${cantidadSede}"
              ${puedeConfigurar ? "" : "disabled"}
              required
            >
            <small class="sgpa-field-help">
              Cantidad de espacios SEDE permitidos en el plan.
            </small>
          </label>
        </div>

        ${
          regla && conteoOptativas.total > 0
            ? `
              <div class="plan-optative-empty-rule">
                <i data-lucide="info" aria-hidden="true"></i>
                <div>
                  <strong>La regla ya está en uso</strong>
                  <p>
                    Puede aumentar los cupos. Para reducir una categoría por
                    debajo de la cantidad actualmente registrada, primero debe
                    corregir las asignaturas optativas del plan.
                  </p>
                </div>
              </div>
            `
            : ""
        }

        ${
          !planSeleccionado.activo
            ? `
              <div class="plan-optative-empty-rule is-warning">
                <i data-lucide="lock" aria-hidden="true"></i>
                <div>
                  <strong>Plan inactivo</strong>
                  <p>
                    La regla puede consultarse, pero solo puede modificarse
                    mientras el plan esté activo.
                  </p>
                </div>
              </div>
            `
            : ""
        }
      </section>
    </div>
  `;

  const footerHtml = `
    ${
      regla && puedeGestionar
        ? `
          <button
            id="eliminarReglaOptativasButton"
            class="sgpa-form-secondary sgpa-form-footer-left plan-optative-delete"
            type="button"
            ${puedeEliminarRegla ? "" : "disabled"}
            title="${
              puedeEliminarRegla
                ? "Eliminar regla"
                : "No se puede eliminar la regla mientras existan optativas activas en el plan"
            }"
          >
            <i data-lucide="trash-2" aria-hidden="true"></i>
            Eliminar regla
          </button>
        `
        : '<span class="sgpa-form-footer-left"></span>'
    }

    <button
      id="cancelarReglaOptativasButton"
      class="sgpa-form-secondary"
      type="button"
    >
      Cerrar
    </button>

    ${
      puedeGestionar
        ? `
          <button
            id="guardarReglaOptativasButton"
            class="sgpa-form-primary"
            type="button"
            ${puedeConfigurar ? "" : "disabled"}
          >
            <i data-lucide="save" aria-hidden="true"></i>
            <span>${esAsistente() ? "Enviar propuesta" : (regla ? "Guardar cambios" : "Crear regla")}</span>
          </button>
        `
        : ""
    }
  `;

  content.innerHTML = FormDialog({
    formId: "reglaOptativasForm",
    title: "Regla de optativas",
    description: `${planSeleccionado.nombre} · ${
      planSeleccionado.carrera?.nombre || "Carrera"
    }`,
    body,
    errorId: "reglaOptativasError",
    footerHtml,
    layout: "custom",
    formClass: "regla-optativas-plan-form",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  const cerrar = () => dialog.close();

  document
    .getElementById("cancelarReglaOptativasButton")
    ?.addEventListener("click", cerrar);

  if (puedeGestionar) {
    document
      .getElementById("guardarReglaOptativasButton")
      ?.addEventListener("click", guardarReglaOptativasFrontend);

    document
      .getElementById("eliminarReglaOptativasButton")
      ?.addEventListener("click", eliminarReglaOptativasFrontend);
  }
}

async function guardarReglaOptativasFrontend() {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("reglaOptativasError");
  const button = document.getElementById("guardarReglaOptativasButton");

  if (!errorBox || !button || !planSeleccionado) {
    return;
  }

  const cantidadDisciplinarias = Number(
    document.getElementById("optativasCantidadDisciplinarias")?.value,
  );
  const cantidadAbiertas = Number(
    document.getElementById("optativasCantidadAbiertas")?.value,
  );
  const cantidadSede = Number(
    document.getElementById("optativasCantidadSede")?.value,
  );

  errorBox.textContent = "";
  errorBox.classList.add("hidden");

  const valores = [
    ["optativas de carrera", cantidadDisciplinarias],
    ["optativas abiertas", cantidadAbiertas],
    ["optativas de sede", cantidadSede],
  ];

  for (const [etiqueta, valor] of valores) {
    if (
      !Number.isInteger(valor) ||
      valor < 0 ||
      valor > MAX_ESPACIOS_OPTATIVOS_REGLA
    ) {
      errorBox.textContent =
        `La cantidad de ${etiqueta} debe ser un entero entre 0 y ${MAX_ESPACIOS_OPTATIVOS_REGLA}.`;
      errorBox.classList.remove("hidden");
      return;
    }
  }

  const totalConfigurado =
    cantidadDisciplinarias + cantidadAbiertas + cantidadSede;

  if (totalConfigurado > MAX_ESPACIOS_OPTATIVOS_REGLA) {
    errorBox.textContent =
      `La suma de espacios optativos no puede superar ${MAX_ESPACIOS_OPTATIVOS_REGLA}.`;
    errorBox.classList.remove("hidden");
    return;
  }

  const conteoOptativas = obtenerConteoOptativasPlan();

  if (conteoOptativas.total > totalConfigurado) {
    errorBox.textContent = `Hay ${conteoOptativas.total} espacios optativos activos y la nueva regla solo permite ${totalConfigurado}.`;
    errorBox.classList.remove("hidden");
    return;
  }
  try {
    const resultado = await (esAsistente()
      ? proponerGuardarReglaOptativaPlan
      : guardarReglaOptativasPlan)(planSeleccionado.id, {
      cantidadDisciplinarias,
      cantidadAbiertas,
      cantidadSede,
    });

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible guardar la regla de optativas.",
      );
    }

    document.getElementById("asignaturaDialog")?.close();
    if (!esAsistente()) {
      await recargarReglaOptativasPlan();
      renderizarDetallePlan();
    }

    mostrarExito({
      titulo: esAsistente() ? "Propuesta enviada" : "Regla de optativas guardada",
      mensaje: esAsistente()
        ? "La propuesta de regla de optativas quedó pendiente de aprobación."
        : `El plan permite ${cantidadDisciplinarias} optativa(s) de carrera, ` +
          `${cantidadAbiertas} abierta(s) y ${cantidadSede} de sede.`,
    });
  } catch (error) {
    errorBox.textContent =
      error?.message || "No fue posible guardar la regla de optativas.";
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
}

async function eliminarReglaOptativasFrontend() {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  if (!planSeleccionado || !obtenerReglaOptativasActual()) {
    return;
  }

  const conteoOptativas = obtenerConteoOptativasPlan();

  if (conteoOptativas.total > 0) {
    const errorBox = document.getElementById("reglaOptativasError");
    if (errorBox) {
      errorBox.textContent =
        "No puede eliminar la regla mientras existan asignaturas optativas activas en el plan.";
      errorBox.classList.remove("hidden");
    }
    return;
  }

  const confirmado = await confirmarAccion({
    titulo: "Eliminar regla de optativas",
    mensaje:
      "¿Desea eliminar la regla de optativas? Después deberá crear una nueva antes de registrar asignaturas OPTATIVA.",
    textoConfirmar: "Eliminar regla",
    peligro: true,
  });

  if (!confirmado) {
    return;
  }

  const errorBox = document.getElementById("reglaOptativasError");
  const button = document.getElementById("eliminarReglaOptativasButton");

  if (button) {
    button.disabled = true;
  }

  try {
    const resultado = await (esAsistente()
      ? proponerEliminarReglaOptativaPlan
      : eliminarReglaOptativasPlan)(planSeleccionado.id);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible eliminar la regla de optativas.",
      );
    }

    document.getElementById("asignaturaDialog")?.close();
    if (!esAsistente()) {
      await recargarReglaOptativasPlan();
      renderizarDetallePlan();
    }

    mostrarExito({
      titulo: esAsistente() ? "Propuesta enviada" : "Regla eliminada",
      mensaje: esAsistente()
        ? "La propuesta para eliminar la regla de optativas quedó pendiente de aprobación."
        : "La regla fue eliminada. Configure una nueva antes de registrar optativas.",
    });
  } catch (error) {
    if (errorBox) {
      errorBox.textContent =
        error?.message || "No fue posible eliminar la regla de optativas.";
      errorBox.classList.remove("hidden");
    } else {
      mostrarError({
        titulo: "No se pudo eliminar la regla",
        mensaje:
          error?.message || "No fue posible eliminar la regla de optativas.",
      });
    }
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

function crearFilaRequisitoRapido() {
  return {
    id: `${Date.now()}-${Math.random()}`,
    asignaturaId: "",
    requisitoAsignaturaId: "",
    tipo: "REQUISITO",
  };
}

function abrirRequisitosRapidos() {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  if (!planSeleccionado) {
    return;
  }

  filasRequisitosRapidos = [crearFilaRequisitoRapido()];
  renderizarRequisitosRapidos();
}

function renderizarRequisitosRapidos() {
  const content = document.getElementById("asignaturaDialogContent");

  if (!content || !planSeleccionado) {
    return;
  }

  const body = `
    <div class="requisitos-rapidos-intro">
      Configure varias relaciones académicas y guárdelas en una sola operación.
    </div>

    <div class="requisitos-rapidos-table-wrapper">
      <table class="requisitos-rapidos-table">
        <thead>
          <tr>
            <th>Asignatura</th>
            <th>Relación</th>
            <th>Asignatura relacionada</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="requisitosRapidosBody"></tbody>
      </table>
    </div>

    <button
      id="agregarFilaRequisitoRapido"
      class="sgpa-form-secondary"
      type="button"
    >
      <i data-lucide="plus" aria-hidden="true"></i>
      Agregar relación
    </button>
  `;

  content.innerHTML = FormDialog({
    formId: "requisitosRapidosForm",
    title: "Requisitos rápidos",
    description: planSeleccionado.nombre,
    body,
    errorId: "requisitosRapidosError",
    cancelButtonId: "cancelarRequisitosRapidos",
    cancelText: "Cancelar",
    submitButtonId: "guardarRequisitosRapidos",
    submitText: "Guardar relaciones",
    submitButtonType: "button",
    submitIcon: "save",
    layout: "custom",
    formClass: "requisitos-rapidos",
  });

  renderizarFilasRequisitosRapidos();
  renderizarIconos();
  mostrarDialogHerramienta();

  const cerrar = () => document.getElementById("asignaturaDialog")?.close();

  document
    .getElementById("cancelarRequisitosRapidos")
    ?.addEventListener("click", cerrar);
  document
    .getElementById("agregarFilaRequisitoRapido")
    ?.addEventListener("click", agregarFilaRequisitoRapido);
  document
    .getElementById("guardarRequisitosRapidos")
    ?.addEventListener("click", guardarRequisitosRapidos);
}

function renderizarFilasRequisitosRapidos() {
  const body = document.getElementById("requisitosRapidosBody");

  if (!body) {
    return;
  }

  const asignaturas = obtenerAsignaturasParaRequisitos();
  const renderizarOpciones = (valorSeleccionado) =>
    asignaturas
      .map(
        (asignatura) => `
          <option
            value="${asignatura.id}"
            ${
              Number(valorSeleccionado) === Number(asignatura.id)
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(obtenerEtiquetaAsignatura(asignatura))}
          </option>
        `,
      )
      .join("");

  body.innerHTML = filasRequisitosRapidos
    .map(
      (fila) => `
        <tr data-fila-requisito="${fila.id}">
          <td>
            <select data-campo="asignaturaId">
              <option value="">Seleccionar</option>
              ${renderizarOpciones(fila.asignaturaId)}
            </select>
          </td>

          <td>
            <select data-campo="tipo">
              <option
                value="REQUISITO"
                ${fila.tipo === "REQUISITO" ? "selected" : ""}
              >
                Requisito
              </option>
              <option
                value="CORREQUISITO"
                ${fila.tipo === "CORREQUISITO" ? "selected" : ""}
              >
                Correquisito
              </option>
            </select>
          </td>

          <td>
            <select data-campo="requisitoAsignaturaId">
              <option value="">Seleccionar</option>
              ${renderizarOpciones(fila.requisitoAsignaturaId)}
            </select>
          </td>

          <td>
            <button
              type="button"
              class="planes-icon-button"
              data-eliminar-requisito="${fila.id}"
              title="Quitar relación"
              aria-label="Quitar relación"
            >
              <i data-lucide="trash-2" aria-hidden="true"></i>
            </button>
          </td>
        </tr>
      `,
    )
    .join("");

  body.querySelectorAll("[data-fila-requisito]").forEach((row) => {
    const id = row.dataset.filaRequisito;

    row.querySelectorAll("[data-campo]").forEach((input) => {
      input.addEventListener("change", () => {
        actualizarFilaRequisitoRapido(id, input.dataset.campo, input.value);
      });
    });
  });

  body.querySelectorAll("[data-eliminar-requisito]").forEach((button) => {
    button.addEventListener("click", () => {
      eliminarFilaRequisitoRapido(button.dataset.eliminarRequisito);
    });
  });

  renderizarIconos();
}

function actualizarFilaRequisitoRapido(id, campo, valor) {
  const fila = filasRequisitosRapidos.find((item) => item.id === id);

  if (fila) {
    fila[campo] = valor;
  }
}

function agregarFilaRequisitoRapido() {
  filasRequisitosRapidos.push(crearFilaRequisitoRapido());
  renderizarFilasRequisitosRapidos();
}

function eliminarFilaRequisitoRapido(id) {
  if (filasRequisitosRapidos.length <= 1) {
    return;
  }

  filasRequisitosRapidos = filasRequisitosRapidos.filter(
    (fila) => fila.id !== id,
  );
  renderizarFilasRequisitosRapidos();
}

function construirRequisitosRapidos() {
  const relaciones = new Set();

  return filasRequisitosRapidos.map((fila, index) => {
    const asignaturaId = Number(fila.asignaturaId);
    const requisitoAsignaturaId = Number(fila.requisitoAsignaturaId);

    if (!Number.isInteger(asignaturaId) || asignaturaId < 1) {
      throw new Error(`Fila ${index + 1}: seleccione la asignatura.`);
    }

    if (!Number.isInteger(requisitoAsignaturaId) || requisitoAsignaturaId < 1) {
      throw new Error(
        `Fila ${index + 1}: seleccione la asignatura relacionada.`,
      );
    }

    if (asignaturaId === requisitoAsignaturaId) {
      throw new Error(
        `Fila ${index + 1}: una asignatura no puede relacionarse consigo misma.`,
      );
    }

    const clave = `${asignaturaId}-${requisitoAsignaturaId}`;

    if (relaciones.has(clave)) {
      throw new Error(`Fila ${index + 1}: la relación está repetida.`);
    }

    relaciones.add(clave);

    return {
      asignaturaId,
      requisitoAsignaturaId,
      tipo: fila.tipo === "CORREQUISITO" ? "CORREQUISITO" : "REQUISITO",
    };
  });
}

async function guardarRequisitosRapidos() {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("requisitosRapidosError");
  const button = document.getElementById("guardarRequisitosRapidos");
  const dialog = document.getElementById("asignaturaDialog");

  if (!errorBox || !button || !planSeleccionado) {
    return;
  }

  errorBox.textContent = "";
  errorBox.classList.add("hidden");

  try {
    const requisitos = construirRequisitosRapidos();

    if (requisitos.length === 0) {
      throw new Error("Debe agregar al menos una relación.");
    }

    button.disabled = true;
    button.textContent = "Guardando...";

    const resultado = await cargarRequisitosMasivamente(
      planSeleccionado.id,
      requisitos,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible guardar los requisitos.",
      );
    }

    await recargarRequisitosPlan();

    if (dialog?.open) {
      dialog.close();
    }
  } catch (error) {
    errorBox.textContent =
      error?.message || "No fue posible guardar los requisitos.";
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false;
    button.textContent = "Guardar relaciones";
  }
}

function actualizarListaRequisitos(asignatura) {
  const lista = document.querySelector("#requisitoForm .plan-requirements-list");
  const contador = document.querySelector("#requisitoForm .plan-requirements-count");
  if (!lista || !contador) return;

  const relaciones = obtenerRequisitosDeAsignatura(asignatura.id);
  const filas = relaciones.map((relacion) => {
    const requisito = asignaturasPlan.find(
      (item) => Number(item.id) === Number(relacion.requisitoAsignaturaId),
    ) || relacion.requisitoAsignatura;
    const datos = requisito
      ? obtenerDatosAsignatura(requisito)
      : { codigo: "", nombre: "Asignatura no disponible" };
    return `
      <article class="plan-requirement-row">
        <div class="plan-requirement-row-info">
          <span class="plan-requirement-type ${relacion.tipo === "CORREQUISITO" ? "plan-requirement-coreq" : ""}">
            ${relacion.tipo === "CORREQUISITO" ? "Correquisito" : "Requisito"}
          </span>
          <strong>${datos.codigo ? `${escapeHtml(datos.codigo)} - ` : ""}${escapeHtml(datos.nombre)}</strong>
        </div>
        ${puedeGestionarPlanes() ? `<button class="plan-requirement-delete" data-eliminar-requisito="${relacion.id}" type="button" aria-label="Quitar ${escapeHtml(datos.nombre)}"><i data-lucide="trash-2" aria-hidden="true"></i><span>Quitar</span></button>` : ""}
      </article>`;
  });
  lista.innerHTML = filas.length ? filas.join("") : `<div class="plan-requirements-empty plan-requirements-empty-modern">Sin relaciones académicas.</div>`;
  contador.textContent = String(relaciones.length);
  renderizarIconos();
}

function abrirFormularioRequisitos(asignatura) {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");

  if (!dialog || !content || !planSeleccionado || !asignatura) {
    return;
  }

  const puedeGestionar = puedeGestionarPlanes(true);
  const datosAsignatura = obtenerDatosAsignatura(asignatura);
  const relaciones = obtenerRequisitosDeAsignatura(asignatura.id);

  const candidatas = asignaturasPlan
    .filter(
      (item) =>
        item.activo === true && Number(item.id) !== Number(asignatura.id),
    )
    .sort(
      (a, b) =>
        Number(a.nivel) - Number(b.nivel) ||
        Number(a.ciclo) - Number(b.ciclo) ||
        Number(a.orden || 0) - Number(b.orden || 0),
    );

  const opciones = candidatas
    .map((item) => {
      const datos = obtenerDatosAsignatura(item);
      return `
        <option value="${item.id}">
          ${datos.codigo ? `${escapeHtml(datos.codigo)} - ` : ""}${escapeHtml(
            datos.nombre,
          )} · Nivel ${item.nivel} · Ciclo ${item.ciclo}
        </option>
      `;
    })
    .join("");

  const relacionesHtml = relaciones.length
    ? relaciones
        .map((relacion) => {
          const requisito =
            asignaturasPlan.find(
              (item) =>
                Number(item.id) === Number(relacion.requisitoAsignaturaId),
            ) || relacion.requisitoAsignatura;
          const datos = requisito
            ? obtenerDatosAsignatura(requisito)
            : { codigo: "", nombre: "Asignatura no disponible" };
          const esCorrequisito = relacion.tipo === "CORREQUISITO";

          return `
            <article class="plan-requirement-row">
              <div class="plan-requirement-row-info">
                <span class="plan-requirement-type ${
                  esCorrequisito ? "plan-requirement-coreq" : ""
                }">
                  ${esCorrequisito ? "Correquisito" : "Requisito"}
                </span>
                <strong>
                  ${datos.codigo ? `${escapeHtml(datos.codigo)} - ` : ""}${escapeHtml(
                    datos.nombre,
                  )}
                </strong>
              </div>

              ${
                puedeGestionar
                  ? `
                    <button
                      class="plan-requirement-delete"
                      data-eliminar-requisito="${relacion.id}"
                      type="button"
                      aria-label="Quitar ${escapeHtml(datos.nombre)}"
                    >
                      <i data-lucide="trash-2" aria-hidden="true"></i>
                      <span>Quitar</span>
                    </button>
                  `
                  : ""
              }
            </article>
          `;
        })
        .join("")
    : `
        <div class="plan-requirements-empty plan-requirements-empty-modern">
          <div class="plan-requirements-empty-icon">
            <i data-lucide="git-branch" aria-hidden="true"></i>
          </div>
          <div>
            <strong>Sin relaciones académicas</strong>
            <p>
              Esta asignatura todavía no tiene requisitos ni correquisitos registrados.
            </p>
          </div>
        </div>
      `;

  const seccionNuevaRelacion = puedeGestionar
    ? `
      <section class="plan-add-requirement">
        <div class="plan-requirements-section-heading">
          <div>
            <span>Nueva relación</span>
            <strong>Agregar relación académica</strong>
          </div>
        </div>

        ${
          candidatas.length
            ? `
                <div class="plan-requirement-form">
                  <label>
                    <span>Tipo</span>
                    <select id="requisitoTipo" required>
                      <option value="REQUISITO">Requisito</option>
                      <option value="CORREQUISITO">Correquisito</option>
                    </select>
                  </label>

                  <label>
                    <span>Asignatura</span>
                    <select id="requisitoAsignatura" required>
                      <option value="" selected disabled>
                        Seleccione una asignatura...
                      </option>
                      ${opciones}
                    </select>
                  </label>

                  <button
                    id="agregarRequisitoButton"
                    class="sgpa-form-primary plan-requirement-add-button"
                    type="submit"
                  >
                    <i data-lucide="plus" aria-hidden="true"></i>
                    <span>${esAsistente() ? "Proponer" : "Agregar"}</span>
                  </button>
                </div>
              `
            : `
                <div class="plan-requirements-empty plan-requirements-empty-modern">
                  No existen otras asignaturas activas disponibles para crear una relación.
                </div>
              `
        }
      </section>
    `
    : "";

  const body = `
    <div class="plan-requirements-modern">
      <section class="plan-current-requirements">
        <div class="plan-requirements-section-heading">
          <div>
            <span>Relaciones actuales</span>
            <strong>Requisitos y correquisitos</strong>
          </div>
          <span class="plan-requirements-count">${relaciones.length}</span>
        </div>

        <div class="plan-requirements-list">
          ${relacionesHtml}
        </div>
      </section>

      ${seccionNuevaRelacion}
    </div>
  `;

  const descripcion = `${
    datosAsignatura.codigo ? `${datosAsignatura.codigo} - ` : ""
  }${datosAsignatura.nombre}`;

  content.innerHTML = FormDialog({
    formId: "requisitoForm",
    title: "Requisitos académicos",
    description: descripcion,
    body,
    errorId: "requisitosFormError",
    cancelButtonId: "cerrarRequisitosFooter",
    cancelText: "Cerrar",
    layout: "custom",
    formClass: "plan-requirements-dialog",
  });

  /*
   * Abrimos primero el dialog. El modal no debe depender de que Lucide
   * pueda renderizar todos los iconos correctamente.
   */
  mostrarDialogHerramienta();

  try {
    renderizarIconos();
  } catch (error) {
    console.error("No fue posible renderizar los iconos de requisitos:", error);
  }

  document
    .getElementById("cerrarRequisitosFooter")
    ?.addEventListener("click", () => dialog.close());

  if (puedeGestionar) {
    document
      .getElementById("requisitoForm")
      ?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!candidatas.length) {
          return;
        }
        await agregarRequisitoFrontend(asignatura);
      });

    document.querySelector("#requisitoForm .plan-requirements-list")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-eliminar-requisito]");
      if (button) {
        await eliminarRequisitoFrontend(
          Number(button.dataset.eliminarRequisito),
          asignatura,
        );
      }
    });
  }
}

async function agregarRequisitoFrontend(asignatura) {
  if (!puedeGestionarPlanes()) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("requisitosFormError");
  const button = document.getElementById("agregarRequisitoButton");
  const tipo = document.getElementById("requisitoTipo")?.value;
  const requisitoAsignaturaId = Number(
    document.getElementById("requisitoAsignatura")?.value,
  );

  if (!errorBox || !button || !planSeleccionado) {
    return;
  }

  if (!requisitoAsignaturaId) {
    errorBox.textContent = "Debe seleccionar una asignatura.";
    errorBox.classList.remove("hidden");
    return;
  }

  button.disabled = true;
  errorBox.classList.add("hidden");

  try {
    const esAsistenteActivo = typeof esAsistente === 'function' && esAsistente();
    const resultado = esAsistenteActivo
      ? await proponerRequisitoPlan(planSeleccionado.id, {
          planAsignaturaId: Number(asignatura.id),
          asignaturaRequisitoId: Number(requisitoAsignaturaId),
          tipo,
        })
      : await crearPlanRequisito(planSeleccionado.id, {
          asignaturaId: asignatura.id,
          requisitoAsignaturaId,
          tipo,
        });

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible registrar el requisito.",
      );
    }

    if (typeof esAsistente === 'function' && esAsistente()) {
      mostrarExito({
        titulo: "Propuesta enviada",
        mensaje: "La propuesta de requisito académico quedó pendiente de aprobación.",
        duracion: 2500,
      });
    } else {
      await recargarRequisitosPlan({ preservarDialogo: true });
      const actualizada = obtenerAsignaturaPorId(asignatura.id) || asignatura;
      actualizarListaRequisitos(actualizada);
      button.focus();
      mostrarExito({
        titulo: "Relación agregada",
        mensaje: "El requisito o correquisito se registró correctamente.",
        duracion: 2500,
      });
    }
  } catch (error) {
    const actualErrorBox = document.getElementById("requisitosFormError");
    if (actualErrorBox) {
      actualErrorBox.textContent =
        error?.message || "No fue posible registrar el requisito.";
      actualErrorBox.classList.remove("hidden");
    }
  } finally {
    if (button.isConnected) {
      button.disabled = false;
    }
  }
}

async function eliminarRequisitoFrontend(relacionId, asignatura) {
  if (!puedeGestionarPlanes()) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const relacion = requisitosPlan.find(
    (item) => Number(item.id) === Number(relacionId),
  );

  if (!relacion || !planSeleccionado) {
    return;
  }

  const requisito = asignaturasPlan.find(
    (item) => Number(item.id) === Number(relacion.requisitoAsignaturaId),
  );
  const datos = requisito
    ? obtenerDatosAsignatura(requisito)
    : { nombre: "esta asignatura" };

  const confirmado = await confirmarAccion({
    titulo: "Quitar relación académica",
    mensaje: `¿Desea quitar "${datos.nombre}" como ${
      relacion.tipo === "CORREQUISITO" ? "correquisito" : "requisito"
    }?`,
    textoConfirmar: "Quitar",
    peligro: true,
  });

  if (!confirmado) {
    return;
  }

  try {
    const esAsistenteActivo = typeof esAsistente === 'function' && esAsistente();
    const resultado = esAsistenteActivo
      ? await proponerEliminarRequisitoPlan(planSeleccionado.id, relacionId)
      : await eliminarPlanRequisito(planSeleccionado.id, relacionId);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible quitar la relación.",
      );
    }

    if (typeof esAsistente === 'function' && esAsistente()) {
      mostrarExito({
        titulo: "Propuesta enviada",
        mensaje: "La propuesta para quitar la relación quedó pendiente de aprobación.",
        duracion: 2500,
      });
    } else {
      await recargarRequisitosPlan({ preservarDialogo: true });
      const actualizada = obtenerAsignaturaPorId(asignatura.id) || asignatura;
      actualizarListaRequisitos(actualizada);
      document.getElementById("requisitoAsignatura")?.focus();
    }
  } catch (error) {
    const errorBox = document.getElementById("requisitosFormError");

    if (errorBox) {
      errorBox.textContent =
        error?.message || "No fue posible quitar la relación.";
      errorBox.classList.remove("hidden");
    } else {
      mostrarFeedbackDetalle(
        error?.message || "No fue posible quitar la relación.",
      );
    }
  }
}

async function recargarRequisitosPlan({ preservarDialogo = false } = {}) {
  if (!planSeleccionado) {
    return;
  }

  const planId = planSeleccionado.id;
  const resultado = await listarPlanRequisitos(planId);

  if (!resultado?.ok) {
    throw new Error(
      resultado?.message || "No fue posible actualizar los requisitos.",
    );
  }

  requisitosPlan = Array.isArray(resultado.requisitos)
    ? resultado.requisitos
    : [];
  await recargarResumenPlan();
  const dialog = document.getElementById("asignaturaDialog");
  if (preservarDialogo && dialog?.open) {
    if (!dialog.dataset.requisitosDetallePendiente) {
      dialog.dataset.requisitosDetallePendiente = "true";
      dialog.addEventListener("close", () => {
        if (dialog.isConnected && planSeleccionado?.id === planId) {
          renderizarDetallePlan();
        }
      }, { once: true });
    }
    return;
  }
  renderizarDetallePlan();
}

async function recargarResumenPlan() {
  if (!planSeleccionado) return;
  const resultado = await obtenerResumenPlan(planSeleccionado.id);
  if (!resultado?.ok) {
    throw new Error(
      resultado?.message || "No fue posible actualizar el resumen del plan.",
    );
  }
  resumenPlan = resultado.resumen || null;
}

function renderizarDatoResumen(nombre, valor) {
  return `<div class="plan-summary-hour"><span>${escapeHtml(nombre)}</span><strong>${Number(valor || 0)}</strong></div>`;
}

function abrirDetalleResumenPlan() {
  if (!resumenPlan || !planSeleccionado) {
    return;
  }

  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");

  if (!dialog || !content) {
    return;
  }

  const horas = resumenPlan.horas || {};
  const ciclos = Array.isArray(resumenPlan.ciclos)
    ? resumenPlan.ciclos
    : [];

  const ciclosHtml = ciclos.length
    ? ciclos
        .map(
          (grupo) => `
            <div class="plan-summary-cycle">
              <div>
                <strong>
                  Nivel ${grupo.nivel} · Ciclo ${grupo.ciclo}
                </strong>
                <small>
                  ${grupo.cantidadAsignaturas} asignatura${
                    Number(grupo.cantidadAsignaturas) === 1 ? "" : "s"
                  }
                </small>
              </div>

              <span>
                ${grupo.creditos} cr.
              </span>
            </div>
          `,
        )
        .join("")
    : `
        <div class="plan-requirements-empty">
          No hay ciclos registrados.
        </div>
      `;

  const body = `
    <div class="plan-summary-detail-content">

      <section class="plan-summary-detail-section">
        <div class="plan-summary-detail-heading">
          <span class="plan-summary-detail-icon">
            <i data-lucide="clock-3" aria-hidden="true"></i>
          </span>

          <div>
            <h4>Horas académicas</h4>
            <p>
              Distribución acumulada de horas registrada para las asignaturas del plan.
            </p>
          </div>
        </div>

        <div class="plan-summary-hours">
          ${renderizarDatoResumen("Teoría", horas.teoria)}
          ${renderizarDatoResumen("Práctica", horas.practica)}
          ${renderizarDatoResumen("Laboratorio", horas.laboratorio)}
          ${renderizarDatoResumen("Gira", horas.gira)}
          ${renderizarDatoResumen(
            "Estudio independiente",
            horas.estudioIndependiente,
          )}
          ${renderizarDatoResumen("Horas totales", horas.totales)}
          ${renderizarDatoResumen("Horas docente", horas.docente)}
        </div>
      </section>

      <section class="plan-summary-detail-section">
        <div class="plan-summary-detail-heading">
          <span class="plan-summary-detail-icon">
            <i data-lucide="layers-3" aria-hidden="true"></i>
          </span>

          <div>
            <h4>Créditos por ciclo</h4>
            <p>
              Distribución de la carga crediticia según el nivel y ciclo académico.
            </p>
          </div>
        </div>

        <div class="plan-summary-cycle-list">
          ${ciclosHtml}
        </div>
      </section>

    </div>
  `;

  content.innerHTML = FormDialog({
    formId: "resumenPlanForm",
    title: "Resumen del plan",
    description: planSeleccionado.nombre,
    body,
    cancelButtonId: "cerrarResumenPlan",
    cancelText: "Cerrar",
    layout: "custom",
    formClass: "plan-summary-dialog",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  document
    .getElementById("cerrarResumenPlan")
    ?.addEventListener("click", () => dialog.close());
}

function formatearTipoSalida(tipo) {
  const tipos = {
    ENFASIS: "Énfasis",
    SALIDA_LATERAL: "Salida lateral",
    CERTIFICADO: "Certificado",
    OTRO: "Otro",
  };

  return tipos[tipo] || tipo || "—";
}

function abrirAdministradorSalidas() {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");

  if (!dialog || !content || !planSeleccionado) {
    return;
  }

  const puedeGestionar = puedeGestionarPlanes(true);

  const salidasHtml = salidasAcademicas.length
    ? salidasAcademicas
        .slice()
        .sort((a, b) => Number(a.orden) - Number(b.orden))
        .map((salida) => {
          const asignaturas = obtenerAsignaturasSalida(salida);
          const cantidad = asignaturas.length;
          const estado = renderizarEstadoCreditosSalida(salida);
          const corte = obtenerPuntoCorteSalida(salida);

          return `
            <article class="salida-academica-card ${
              salida.activo ? "" : "salida-academica-inactive"
            }">
              <div class="salida-academica-main">
                <div class="salida-academica-title">
                  <strong>${escapeHtml(salida.nombre)}</strong>
                  <span>${escapeHtml(salida.codigo)}</span>
                </div>

                <div class="salida-academica-meta">
                  ${escapeHtml(formatearTipoSalida(salida.tipo))}
                  · ${salida.creditosRequeridos} créditos requeridos
                  · ${cantidad} asignatura${cantidad === 1 ? "" : "s"}
                </div>

                <div class="salida-academica-cut">
                  <i data-lucide="map-pin" aria-hidden="true"></i>
                  <span>
                    ${
                      corte
                        ? `Punto de corte: Nivel ${corte.nivel} · ${obtenerNombreCiclo(
                            corte.ciclo,
                          )}`
                        : "Sin punto de corte: seleccione las materias de la salida"
                    }
                  </span>
                </div>

                <div class="salida-academica-progress">
                  <div class="salida-academica-progress-bar">
                    <span style="width: ${estado.porcentaje}%;"></span>
                  </div>
                  <small>
                    ${estado.asociados} / ${estado.requeridos} créditos asociados
                  </small>
                </div>
              </div>

              ${
                puedeGestionar
                  ? `
                    <div class="salida-academica-actions">
                      <button
                        class="sgpa-form-secondary"
                        type="button"
                        data-salida-asignaturas="${salida.id}"
                      >
                        <i data-lucide="list-checks" aria-hidden="true"></i>
                        Materias
                      </button>

                      <button
                        class="planes-icon-button"
                        type="button"
                        title="Editar"
                        aria-label="Editar"
                        data-salida-editar="${salida.id}"
                      >
                        <i data-lucide="pencil" aria-hidden="true"></i>
                      </button>

                      <button
                        class="planes-icon-button"
                        type="button"
                        title="${salida.activo ? "Desactivar" : "Activar"}"
                        aria-label="${salida.activo ? "Desactivar" : "Activar"}"
                        data-salida-estado="${salida.id}"
                      >
                        <i
                          data-lucide="${
                            salida.activo ? "circle-pause" : "circle-check"
                          }"
                          aria-hidden="true"
                        ></i>
                      </button>
                    </div>
                  `
                  : ""
              }
            </article>
          `;
        })
        .join("")
    : `
        <div class="plan-requirements-empty">
          Este plan todavía no tiene salidas académicas configuradas.
        </div>
      `;

  const body = `
    <div class="salidas-academicas-content">
      <div class="sgpa-form-tool-toolbar">
        <div>
          <strong>Salidas del plan</strong>
          <small>
            Configure títulos intermedios y finales. El punto de corte se calcula
            con las materias asociadas.
          </small>
        </div>

        ${
          puedeGestionar
            ? `
              <button id="nuevaSalidaButton" class="sgpa-form-primary" type="button">
                <i data-lucide="plus" aria-hidden="true"></i>
                <span>Nueva salida</span>
              </button>
            `
            : ""
        }
      </div>

      <div class="salidas-academicas-list">${salidasHtml}</div>
    </div>
  `;

  content.innerHTML = FormDialog({
    formId: "salidasAdminForm",
    title: "Salidas académicas",
    description: planSeleccionado.nombre,
    body,
    cancelButtonId: "cerrarSalidasFooter",
    cancelText: "Cerrar",
    layout: "custom",
    formClass: "salidas-academicas-dialog",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  document
    .getElementById("cerrarSalidasFooter")
    ?.addEventListener("click", () => dialog.close());

  if (puedeGestionar) {
    document
      .getElementById("nuevaSalidaButton")
      ?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        window.requestAnimationFrame(() => {
          abrirFormularioSalida();
        });
      });

    document.querySelectorAll("[data-salida-editar]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const salida = salidasAcademicas.find(
          (item) => Number(item.id) === Number(button.dataset.salidaEditar),
        );
        if (salida) {
          abrirFormularioSalida(salida);
        }
      });
    });

    document.querySelectorAll("[data-salida-asignaturas]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const salida = salidasAcademicas.find(
          (item) => Number(item.id) === Number(button.dataset.salidaAsignaturas),
        );
        if (salida) {
          abrirAsignaturasSalida(salida);
        }
      });
    });

    document.querySelectorAll("[data-salida-estado]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const salida = salidasAcademicas.find(
          (item) => Number(item.id) === Number(button.dataset.salidaEstado),
        );
        if (salida) {
          await alternarEstadoSalida(salida);
        }
      });
    });
  }
}

function abrirFormularioSalida(salida = null) {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const content = document.getElementById("asignaturaDialogContent");

  if (!content || !planSeleccionado) {
    return;
  }

  const editando = Boolean(salida);
  const opcionesTipo = [
    ["ENFASIS", "Énfasis"],
    ["SALIDA_LATERAL", "Salida lateral"],
    ["CERTIFICADO", "Certificado"],
    ["OTRO", "Otro"],
  ];

  const body = `
    <div class="salida-form-intro sgpa-form-wide">
      <div class="salida-form-intro-icon" aria-hidden="true">
        <i data-lucide="graduation-cap"></i>
      </div>
      <div>
        <strong>Hito académico del plan</strong>
        <p>
          Primero registre la salida. Después seleccione las materias que la
          componen; con ellas SGPA determina automáticamente el nivel y ciclo
          donde se alcanza.
        </p>
      </div>
    </div>

    <label>
      <span>Código</span>
      <input
        id="salidaCodigo"
        maxlength="30"
        required
        value="${escapeHtml(salida?.codigo || "")}"
        placeholder="Ej. DIP"
      >
    </label>

    <label>
      <span>Orden</span>
      <input
        id="salidaOrden"
        type="number"
        min="1"
        max="999"
        required
        value="${salida?.orden || salidasAcademicas.length + 1}"
      >
    </label>

    <label class="sgpa-form-wide">
      <span>Nombre</span>
      <input
        id="salidaNombre"
        maxlength="160"
        required
        value="${escapeHtml(salida?.nombre || "")}"
        placeholder="Ej. Énfasis en Ciberseguridad"
      >
    </label>

    <label>
      <span>Tipo</span>
      <select id="salidaTipo" required>
        ${opcionesTipo
          .map(
            ([valor, texto]) => `
              <option
                value="${valor}"
                ${(salida?.tipo || "ENFASIS") === valor ? "selected" : ""}
              >
                ${texto}
              </option>
            `,
          )
          .join("")}
      </select>
    </label>

    <label>
      <span>Créditos requeridos</span>
      <input
        id="salidaCreditos"
        type="number"
        min="1"
        max="999"
        required
        value="${salida?.creditosRequeridos ?? ""}"
        placeholder="Ej. 88"
      >
    </label>

    <label class="sgpa-form-wide">
      <span>Descripción</span>
      <textarea
        id="salidaDescripcion"
        maxlength="500"
        rows="3"
        placeholder="Descripción opcional"
      >${escapeHtml(salida?.descripcion || "")}</textarea>
    </label>
  `;

  content.innerHTML = FormDialog({
    formId: "salidaAcademicaForm",
    title: editando ? "Editar salida académica" : "Nueva salida académica",
    description: planSeleccionado.nombre,
    body,
    errorId: "salidaAcademicaError",
    cancelButtonId: "volverSalidasButton",
    cancelText: "Volver",
    submitButtonId: "guardarSalidaButton",
    submitText: esAsistente() ? "Enviar propuesta" : (editando ? "Guardar cambios" : "Crear y seleccionar materias"),
    submitIcon: "save",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  document
    .getElementById("volverSalidasButton")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      abrirAdministradorSalidas();
    });

  document
    .getElementById("salidaAcademicaForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await guardarSalidaAcademicaFrontend(salida);
    });
}

async function guardarSalidaAcademicaFrontend(salida) {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("salidaAcademicaError");
  const button = document.getElementById("guardarSalidaButton");

  if (!errorBox || !button || !planSeleccionado) {
    return;
  }

  const datos = {
    codigo: document.getElementById("salidaCodigo")?.value.trim() || "",
    nombre: document.getElementById("salidaNombre")?.value.trim() || "",
    tipo: document.getElementById("salidaTipo")?.value,
    creditosRequeridos: Number(
      document.getElementById("salidaCreditos")?.value,
    ),
    orden: Number(document.getElementById("salidaOrden")?.value),
    descripcion:
      document.getElementById("salidaDescripcion")?.value.trim() || "",
  };

  errorBox.textContent = "";
  errorBox.classList.add("hidden");

  if (!datos.codigo || !datos.nombre) {
    errorBox.textContent = "Código y nombre son obligatorios.";
    errorBox.classList.remove("hidden");
    return;
  }

  if (
    !Number.isInteger(datos.creditosRequeridos) ||
    datos.creditosRequeridos < 1
  ) {
    errorBox.textContent = "Los créditos requeridos no son válidos.";
    errorBox.classList.remove("hidden");
    return;
  }

  if (!Number.isInteger(datos.orden) || datos.orden < 1) {
    errorBox.textContent = "El orden no es válido.";
    errorBox.classList.remove("hidden");
    return;
  }

  button.disabled = true;

  try {
    const resultado = esAsistente()
      ? salida
        ? await proponerActualizarSalidaPlan(planSeleccionado.id, salida.id, datos)
        : await proponerSalidaPlan(planSeleccionado.id, datos)
      : salida
        ? await actualizarSalidaAcademica(planSeleccionado.id, salida.id, datos)
        : await crearSalidaAcademica(planSeleccionado.id, datos);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible guardar la salida académica.",
      );
    }

    if (esAsistente()) {
      document.getElementById("asignaturaDialog")?.close();
      mostrarExito({
        titulo: "Propuesta enviada",
        mensaje: "La propuesta de salida académica quedó pendiente de aprobación.",
      });
      return;
    }

    await recargarSalidasAcademicas({ renderizar: false });

    const salidaGuardada =
      salidasAcademicas.find(
        (item) =>
          Number(item.id) ===
          Number(resultado?.salida?.id || resultado?.id || salida?.id),
      ) ||
      salidasAcademicas.find(
        (item) =>
          String(item.codigo || "").toUpperCase() === datos.codigo.toUpperCase(),
      );

    if (salida) {
      renderizarDetallePlan();
      mostrarExito({
        titulo: "Salida actualizada",
        mensaje: `"${datos.nombre}" se actualizó correctamente.`,
      });
      abrirAdministradorSalidas();
      return;
    }

    mostrarExito({
      titulo: "Salida creada",
      mensaje:
        "Ahora seleccione las materias que forman parte de esta salida académica.",
    });

    if (salidaGuardada) {
      abrirAsignaturasSalida(salidaGuardada);
      return;
    }

    renderizarDetallePlan();
    abrirAdministradorSalidas();
  } catch (error) {
    errorBox.textContent =
      error?.message || "No fue posible guardar la salida académica.";
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
}

async function recargarSalidasAcademicas({ renderizar = true } = {}) {
  if (!planSeleccionado) {
    return;
  }

  const resultado = await listarSalidasAcademicas(planSeleccionado.id);

  if (!resultado?.ok) {
    throw new Error(
      resultado?.message || "No fue posible actualizar las salidas académicas.",
    );
  }

  salidasAcademicas = Array.isArray(resultado.salidas) ? resultado.salidas : [];
  await recargarResumenPlan();

  if (renderizar) {
    renderizarDetallePlan();
  }
}

function abrirAsignaturasSalida(salida) {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const content = document.getElementById("asignaturaDialogContent");

  if (!content || !planSeleccionado) {
    return;
  }

  const idsSeleccionados = new Set(
    obtenerAsignaturasSalida(salida).map((item) => Number(item.id)),
  );

  const asignaturas = asignaturasPlan
    .filter((item) => item.activo)
    .slice()
    .sort(
      (a, b) =>
        Number(a.nivel) - Number(b.nivel) ||
        Number(a.ciclo) - Number(b.ciclo) ||
        Number(a.orden) - Number(b.orden),
    );

  const body = `
    <div class="salida-cut-helper sgpa-form-wide">
      <div class="salida-cut-helper-copy">
        <span>SELECCIÓN RÁPIDA</span>
        <strong>Seleccionar materias hasta un punto del plan</strong>
        <small>
          SGPA marcará todas las asignaturas desde el inicio del plan hasta el
          nivel y ciclo seleccionados. Puede ajustar la selección manualmente después.
        </small>
      </div>

      <div class="salida-cut-helper-controls">
        <label>
          <span>Nivel</span>
          <select id="salidaCorteNivel">
            <option value="1">Nivel 1</option>
            <option value="2">Nivel 2</option>
            <option value="3">Nivel 3</option>
            <option value="4">Nivel 4</option>
          </select>
        </label>

        <label>
          <span>Ciclo</span>
          <select id="salidaCorteCiclo">
            <option value="1">Ciclo I</option>
            <option value="2">Ciclo II</option>
          </select>
        </label>

        <button
          id="seleccionarHastaCorteSalida"
          class="sgpa-form-secondary"
          type="button"
        >
          <i data-lucide="list-checks" aria-hidden="true"></i>
          Seleccionar hasta aquí
        </button>
      </div>
    </div>

    <div class="salida-asignaturas-summary salida-asignaturas-summary-modern">
      <div>
        <strong id="salidaAsignaturasCantidad"></strong>
        <span id="salidaAsignaturasCreditos"></span>
      </div>
      <div id="salidaPuntoCortePreview" class="salida-cut-preview"></div>
    </div>

    <div class="salida-asignaturas-list">
      ${asignaturas
        .map((asignatura) => {
          const datos = obtenerDatosAsignatura(asignatura);
          return `
            <label class="salida-asignatura-option">
              <input
                type="checkbox"
                value="${asignatura.id}"
                data-salida-asignatura
                data-creditos="${asignatura.creditos}"
                data-nivel="${asignatura.nivel}"
                data-ciclo="${asignatura.ciclo}"
                data-orden="${asignatura.orden || 0}"
                ${
                  idsSeleccionados.has(Number(asignatura.id)) ? "checked" : ""
                }
              >
              <div>
                <strong>
                  ${escapeHtml(datos.codigo || "SIN CÓDIGO")} · ${escapeHtml(
                    datos.nombre,
                  )}
                </strong>
                <small>
                  Nivel ${asignatura.nivel} · Ciclo ${asignatura.ciclo} ·
                  ${asignatura.creditos} créditos
                </small>
              </div>
            </label>
          `;
        })
        .join("")}
    </div>
  `;

  content.innerHTML = FormDialog({
    formId: "salidaAsignaturasForm",
    title: `Materias de ${salida.nombre}`,
    description: `${formatearTipoSalida(salida.tipo)} · ${
      salida.creditosRequeridos
    } créditos requeridos`,
    body,
    errorId: "salidaAsignaturasError",
    cancelButtonId: "volverAsignaturasSalida",
    cancelText: "Volver",
    submitButtonId: "guardarAsignaturasSalida",
    submitText: esAsistente() ? "Enviar propuesta" : "Guardar selección",
    submitButtonType: "button",
    submitIcon: "save",
    layout: "custom",
    formClass: "salida-asignaturas-dialog",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  const actualizarResumen = () => {
    const seleccionadas = Array.from(
      document.querySelectorAll("[data-salida-asignatura]:checked"),
    );

    const creditos = seleccionadas.reduce(
      (total, input) => total + Number(input.dataset.creditos || 0),
      0,
    );

    const ordenadas = seleccionadas.slice().sort(
      (a, b) =>
        Number(a.dataset.nivel) - Number(b.dataset.nivel) ||
        Number(a.dataset.ciclo) - Number(b.dataset.ciclo) ||
        Number(a.dataset.orden || 0) - Number(b.dataset.orden || 0),
    );

    const ultima = ordenadas.at(-1) || null;
    const cantidad = document.getElementById("salidaAsignaturasCantidad");
    const creditosText = document.getElementById("salidaAsignaturasCreditos");
    const cortePreview = document.getElementById("salidaPuntoCortePreview");

    if (cantidad) {
      cantidad.textContent = `${seleccionadas.length} asignatura${
        seleccionadas.length === 1 ? "" : "s"
      }`;
    }

    if (creditosText) {
      creditosText.textContent = `${creditos} / ${salida.creditosRequeridos} créditos`;
    }

    if (cortePreview) {
      cortePreview.innerHTML = ultima
        ? `
            <i data-lucide="map-pin" aria-hidden="true"></i>
            <span>
              Punto de corte: <strong>Nivel ${ultima.dataset.nivel} · ${obtenerNombreCiclo(
                ultima.dataset.ciclo,
              )}</strong>
            </span>
          `
        : `
            <i data-lucide="map-pin" aria-hidden="true"></i>
            <span>Sin punto de corte definido</span>
          `;

      renderizarIconos();
    }
  };

  const corteActual = obtenerPuntoCorteSalida(salida);
  if (corteActual) {
    const nivelSelect = document.getElementById("salidaCorteNivel");
    const cicloSelect = document.getElementById("salidaCorteCiclo");
    if (nivelSelect) nivelSelect.value = String(corteActual.nivel);
    if (cicloSelect) cicloSelect.value = String(corteActual.ciclo);
  }

  document
    .getElementById("seleccionarHastaCorteSalida")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const nivel = Number(document.getElementById("salidaCorteNivel")?.value);
      const ciclo = Number(document.getElementById("salidaCorteCiclo")?.value);

      document.querySelectorAll("[data-salida-asignatura]").forEach((input) => {
        const nivelAsignatura = Number(input.dataset.nivel);
        const cicloAsignatura = Number(input.dataset.ciclo);

        input.checked =
          nivelAsignatura < nivel ||
          (nivelAsignatura === nivel && cicloAsignatura <= ciclo);
      });

      actualizarResumen();
    });

  document.querySelectorAll("[data-salida-asignatura]").forEach((input) => {
    input.addEventListener("change", actualizarResumen);
  });

  actualizarResumen();

  document
    .getElementById("volverAsignaturasSalida")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      abrirAdministradorSalidas();
    });

  document
    .getElementById("guardarAsignaturasSalida")
    ?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await guardarAsignaturasSalidaFrontend(salida);
    });
}

async function guardarAsignaturasSalidaFrontend(salida) {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("salidaAsignaturasError");
  const button = document.getElementById("guardarAsignaturasSalida");

  if (!errorBox || !button || !planSeleccionado) {
    return;
  }

  const seleccionadas = Array.from(
    document.querySelectorAll("[data-salida-asignatura]:checked"),
  );
  const asignaturaIds = seleccionadas.map((input) => Number(input.value));

  if (!asignaturaIds.length) {
    errorBox.textContent =
      "Debe seleccionar al menos una asignatura para ubicar la salida académica.";
    errorBox.classList.remove("hidden");
    return;
  }

  const ultima = seleccionadas
    .slice()
    .sort(
      (a, b) =>
        Number(a.dataset.nivel) - Number(b.dataset.nivel) ||
        Number(a.dataset.ciclo) - Number(b.dataset.ciclo) ||
        Number(a.dataset.orden || 0) - Number(b.dataset.orden || 0),
    )
    .at(-1);

  button.disabled = true;
  errorBox.textContent = "";
  errorBox.classList.add("hidden");

  try {
    const resultado = await (esAsistente()
      ? proponerAsignarAsignaturasSalidaPlan
      : reemplazarAsignaturasSalida)(
      planSeleccionado.id,
      salida.id,
      { asignaturaIds },
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          "No fue posible guardar las asignaturas de la salida.",
      );
    }

    if (esAsistente()) {
      document.getElementById("asignaturaDialog")?.close();
      mostrarExito({
        titulo: "Propuesta enviada",
        mensaje: "La propuesta de asignaturas para la salida académica quedó pendiente de aprobación.",
      });
      return;
    }

    if (ultima) {
      nivelPaginaPlan = normalizarNivelPaginaPlan(ultima.dataset.nivel);
    }

    await recargarSalidasAcademicas({ renderizar: false });
    renderizarDetallePlan();

    mostrarExito({
      titulo: "Salida académica configurada",
      mensaje: `"${salida.nombre}" quedó ubicada en Nivel ${
        ultima?.dataset.nivel || "—"
      }, ${
        ultima ? obtenerNombreCiclo(ultima.dataset.ciclo) : "sin ciclo"
      } con ${salida.creditosRequeridos} créditos requeridos.`,
    });
  } catch (error) {
    errorBox.textContent =
      error?.message || "No fue posible guardar la selección.";
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
}

async function alternarEstadoSalida(salida) {
  if (!puedeGestionarPlanes(true)) {
    mostrarFeedbackDetalle("No posee permiso para modificar el plan.");
    return;
  }

  const nuevoEstado = !salida.activo;
  const confirmado = await confirmarAccion({
    titulo: nuevoEstado
      ? "Activar salida académica"
      : "Desactivar salida académica",
    mensaje: `¿Desea ${nuevoEstado ? "activar" : "desactivar"} "${
      salida.nombre
    }"?`,
    textoConfirmar: nuevoEstado ? "Activar" : "Desactivar",
    peligro: !nuevoEstado,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await (esAsistente()
      ? proponerEstadoSalidaPlan
      : cambiarEstadoSalidaAcademica)(
      planSeleccionado.id,
      salida.id,
      nuevoEstado,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible cambiar el estado.",
      );
    }

    if (esAsistente()) {
      mostrarFeedbackDetalle(
        "La solicitud de cambio de estado de la salida académica quedó pendiente de aprobación.",
      );
    } else {
      await recargarSalidasAcademicas();
      abrirAdministradorSalidas();
    }
  } catch (error) {
    mostrarFeedbackDetalle(
      error?.message || "No fue posible cambiar el estado de la salida.",
    );
  }
}


/* =========================================================
   COMPARADOR VISUAL DE PLANES Y EQUIVALENCIAS
   ========================================================= */

async function abrirComparadorPlanes(carreraIdInicial = null, planOrigenIdInicial = null) {
  const dialog = document.getElementById("comparadorPlanesDialog");
  const content = document.getElementById("comparadorPlanesDialogContent");
  if (!dialog || !content) return;
  if (dialog.open) return;

  let carreraId = carreraIdInicial || (carrerasDisponibles.length > 0 ? carrerasDisponibles[0].id : null);
  let planOrigenId = planOrigenIdInicial || null;
  let planDestinoId = null;
  let asignaturasOrigen = [];
  let asignaturasDestino = [];
  let equivalencias = [];
  let seleccionadasOrigen = new Set();
  let seleccionadasDestino = new Set();
  let solicitudActual = 0;
  let vigente = true;
  let cargando = false;
  let errorCarga = "";
  dialog.addEventListener("close", () => {
    vigente = false;
    solicitudActual += 1;
  }, { once: true });

  function normalizarPlanes() {
    const planesCarrera = planes.filter((p) => !carreraId || Number(p.carreraId) === Number(carreraId));
    if (!planesCarrera.some((p) => Number(p.id) === Number(planOrigenId))) {
      planOrigenId = planesCarrera[0]?.id || null;
    }
    if (planDestinoId === null && planesCarrera.length > 1) {
      planDestinoId = planesCarrera.find((p) => Number(p.id) !== Number(planOrigenId))?.id || null;
    }
    return planesCarrera;
  }

  async function refrescarDatosPlanes() {
    normalizarPlanes();
    const solicitud = ++solicitudActual;
    asignaturasOrigen = [];
    asignaturasDestino = [];
    equivalencias = [];
    seleccionadasOrigen.clear();
    seleccionadasDestino.clear();
    errorCarga = "";
    if (planOrigenId && planDestinoId && Number(planOrigenId) !== Number(planDestinoId)) {
      const origenConsultado = planOrigenId;
      const destinoConsultado = planDestinoId;
      cargando = true;
      renderVistaComparador();
      try {
        const [resOrigen, resDestino, resEq] = await Promise.all([
          listarPlanAsignaturas(origenConsultado),
          listarPlanAsignaturas(destinoConsultado),
          listarEquivalenciasPlanes(origenConsultado, destinoConsultado),
        ]);
        if (!vigente || solicitud !== solicitudActual) return;
        if (resOrigen?.ok === false || resDestino?.ok === false || resEq?.ok === false) {
          throw new Error(resOrigen?.message || resDestino?.message || resEq?.message || "No fue posible consultar las asignaturas y equivalencias.");
        }
        asignaturasOrigen = Array.isArray(resOrigen?.asignaturas) ? resOrigen.asignaturas : [];
        asignaturasDestino = Array.isArray(resDestino?.asignaturas) ? resDestino.asignaturas : [];
        equivalencias = Array.isArray(resEq?.data) ? resEq.data : (Array.isArray(resEq) ? resEq : []);
      } catch (error) {
        if (!vigente || solicitud !== solicitudActual) return;
        errorCarga = error?.message || "No fue posible consultar el comparador de planes.";
      }
    } else {
      cargando = false;
      if (planOrigenId && planDestinoId && Number(planOrigenId) === Number(planDestinoId)) {
        mostrarFeedback("El plan de origen y destino deben ser diferentes.", "error");
      }
    }
    if (!vigente || solicitud !== solicitudActual) return;
    cargando = false;
    renderVistaComparador();
  }

  function renderVistaComparador() {
    const planesCarrera = normalizarPlanes();

    const eqOrigenIds = new Set(equivalencias.map((e) => e.asignaturaOrigenId));
    const eqDestinoIds = new Set(equivalencias.map((e) => e.asignaturaDestinoId));

    const body = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; background: #f8fafc; padding: 12px; border-radius: 8px;">
          <label>
            <span style="font-weight: 600; font-size: 13px;">Carrera</span>
            <select id="compCarreraSelect" class="planes-select" style="width: 100%; margin-top: 4px;">
              ${carrerasDisponibles.map((c) => `<option value="${c.id}" ${Number(c.id) === Number(carreraId) ? 'selected' : ''}>${escapeHtml(c.codigo)} - ${escapeHtml(c.nombre)}</option>`).join('')}
            </select>
          </label>
          <label>
            <span style="font-weight: 600; font-size: 13px;">Plan Origen</span>
            <select id="compPlanOrigenSelect" class="planes-select" style="width: 100%; margin-top: 4px;">
              <option value="">Seleccione plan origen...</option>
              ${planesCarrera.map((p) => `<option value="${p.id}" ${Number(p.id) === Number(planOrigenId) ? 'selected' : ''}>${escapeHtml(p.codigo)} - ${escapeHtml(p.nombre)} (${p.activo ? 'Vigente' : 'Inactivo'})</option>`).join('')}
            </select>
          </label>
          <label>
            <span style="font-weight: 600; font-size: 13px;">Plan Destino</span>
            <select id="compPlanDestinoSelect" class="planes-select" style="width: 100%; margin-top: 4px;">
              <option value="">Seleccione plan destino...</option>
              ${planesCarrera.map((p) => `<option value="${p.id}" ${Number(p.id) === Number(planDestinoId) ? 'selected' : ''}>${escapeHtml(p.codigo)} - ${escapeHtml(p.nombre)} (${p.activo ? 'Vigente' : 'Inactivo'})</option>`).join('')}
            </select>
          </label>
        </div>

        ${errorCarga ? `<div class="planes-message planes-error" role="alert">${escapeHtml(errorCarga)}</div>` : ''}
        ${cargando ? '<div class="planes-message" role="status">Consultando asignaturas y equivalencias...</div>' : ''}
        ${!cargando && planOrigenId && planDestinoId && Number(planOrigenId) !== Number(planDestinoId) ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- Columna Izquierda: Plan Origen -->
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff;">
              <div style="font-weight: 700; color: #1e293b; margin-bottom: 8px; display: flex; justify-content: space-between;">
                <span>Malla Plan Origen (${asignaturasOrigen.length} asignaturas)</span>
                <span style="font-size: 12px; color: #64748b;">Seleccionadas: <strong id="countSelOrigen">${seleccionadasOrigen.size}</strong></span>
              </div>
              <div style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                ${asignaturasOrigen.length === 0 ? '<p>No hay asignaturas en el plan de origen.</p>' : asignaturasOrigen.map((a) => {
                  const tieneEq = eqOrigenIds.has(a.id);
                  const isChecked = seleccionadasOrigen.has(a.id);
                  return `
                    <label style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; background: ${isChecked ? '#eff6ff' : (tieneEq ? '#f8fafc' : '#fffbeb')}; border: 1px solid ${isChecked ? '#93c5fd' : '#e2e8f0'}; cursor: pointer;">
                      <input type="checkbox" data-origen-id="${a.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer;">
                      <div style="flex: 1; font-size: 13px;">
                        <strong>${escapeHtml(a.curso?.codigo || a.codigoReferencia || '—')}</strong> ${escapeHtml(a.curso?.nombre || a.nombreReferencia || '—')}
                        <small style="color: #64748b; margin-left: 6px;">(${a.creditos} créditos)</small>
                      </div>
                      ${tieneEq ? `<span style="font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px;">Vinculada</span>` : `<span style="font-size: 11px; background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px;">Sin eq.</span>`}
                    </label>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Columna Derecha: Plan Destino -->
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff;">
              <div style="font-weight: 700; color: #1e293b; margin-bottom: 8px; display: flex; justify-content: space-between;">
                <span>Malla Plan Destino (${asignaturasDestino.length} asignaturas)</span>
                <span style="font-size: 12px; color: #64748b;">Seleccionadas: <strong id="countSelDestino">${seleccionadasDestino.size}</strong></span>
              </div>
              <div style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                ${asignaturasDestino.length === 0 ? '<p>No hay asignaturas en el plan de destino.</p>' : asignaturasDestino.map((a) => {
                  const tieneEq = eqDestinoIds.has(a.id);
                  const isChecked = seleccionadasDestino.has(a.id);
                  return `
                    <label style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; background: ${isChecked ? '#f0fdf4' : (tieneEq ? '#f8fafc' : '#f8fafc')}; border: 1px solid ${isChecked ? '#86efac' : '#e2e8f0'}; cursor: pointer;">
                      <input type="checkbox" data-destino-id="${a.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer;">
                      <div style="flex: 1; font-size: 13px;">
                        <strong>${escapeHtml(a.curso?.codigo || a.codigoReferencia || '—')}</strong> ${escapeHtml(a.curso?.nombre || a.nombreReferencia || '—')}
                        <small style="color: #64748b; margin-left: 6px;">(${a.creditos} créditos)</small>
                      </div>
                      ${tieneEq ? `<span style="font-size: 11px; background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px;">Equivalente</span>` : ''}
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <!-- Barra de Creación de Equivalencia -->
          ${puedeGestionarPlanes() ? `
          <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 250px;">
              <input type="text" id="compEqJustificacion" placeholder="Justificación o resolución institucional (opcional)..." class="planes-input" style="width: 100%; min-height: 38px; padding: 0 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
            </div>
            <button id="compBtnCrearEq" type="button" class="planes-primary-button" style="min-height: 38px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
              <i data-lucide="link" aria-hidden="true"></i> Vincular Equivalencia (${seleccionadasOrigen.size} a ${seleccionadasDestino.size})
            </button>
          </div>
          ` : ''}

          <!-- Tabla de Equivalencias Registradas -->
          <div style="margin-top: 8px;">
            <div style="font-weight: 700; color: #1e293b; margin-bottom: 6px;">Equivalencias Registradas entre estos Planes (${equivalencias.length})</div>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0;">
                  <tr>
                    <th style="padding: 8px; text-align: left;">Materia Origen</th>
                    <th style="padding: 8px; text-align: left;">Materia Destino</th>
                    <th style="padding: 8px; text-align: left;">Tipo / Justificación</th>
                    <th style="padding: 8px; text-align: center; width: 60px;">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${equivalencias.length === 0 ? `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #64748b;">No hay equivalencias registradas entre estos dos planes.</td></tr>` : equivalencias.map((eq) => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px;"><strong>${escapeHtml(eq.asignaturaOrigen?.curso?.codigo || eq.asignaturaOrigen?.codigoReferencia || '#' + eq.asignaturaOrigenId)}</strong> — ${escapeHtml(eq.asignaturaOrigen?.curso?.nombre || eq.asignaturaOrigen?.nombreReferencia || '')}</td>
                      <td style="padding: 8px;"><strong>${escapeHtml(eq.asignaturaDestino?.curso?.codigo || eq.asignaturaDestino?.codigoReferencia || '#' + eq.asignaturaDestinoId)}</strong> — ${escapeHtml(eq.asignaturaDestino?.curso?.nombre || eq.asignaturaDestino?.nombreReferencia || '')}</td>
                      <td style="padding: 8px; font-size: 12px; color: #475569;">${escapeHtml(eq.justificacion || 'Equivalencia 1:1')}</td>
                      <td style="padding: 8px; text-align: center;">
                        ${puedeGestionarPlanes() ? `<button type="button" data-del-eq="${eq.id}" class="planes-icon-button planes-danger-button" title="Eliminar equivalencia" style="padding: 4px 6px;">
                          <i data-lucide="trash-2" aria-hidden="true"></i>
                        </button>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : cargando ? '' : `
          <div style="text-align: center; padding: 32px; background: #f8fafc; border-radius: 8px; color: #64748b;">
            ${planOrigenId && planDestinoId && Number(planOrigenId) === Number(planDestinoId)
              ? '<span style="color: #b45309; font-weight: 600;">El plan de origen y de destino no pueden ser el mismo. Seleccione dos planes distintos para realizar la comparación.</span>'
              : (planesCarrera.length === 0 ? 'No hay planes de estudio disponibles para esta carrera.' : 'Se necesitan al menos dos planes de estudio distintos para comparar sus asignaturas.')}
          </div>
        `}
      </div>
    `;

    content.innerHTML = FormDialog({
      formId: "comparadorPlanesForm",
      title: "Comparador Visual de Planes y Equivalencias Institucionales",
      description: "Visualice de forma paralela el plan origen y destino para vincular equivalencias (1:1, N:1 o 1:N) y detectar materias sin equivalencia.",
      body,
      cancelButtonId: "cerrarComparadorBtn",
      cancelText: "Cerrar",
      layout: "custom",
      formClass: "comparador-dialog",
    });

    renderizarIconos();
    if (!dialog.open) dialog.showModal();
    habilitarCierreExterior(dialog);

    document.getElementById("cerrarComparadorBtn")?.addEventListener("click", () => dialog.close());

    document.getElementById("compCarreraSelect")?.addEventListener("change", (e) => {
      carreraId = e.target.value ? Number(e.target.value) : null;
      planOrigenId = null;
      planDestinoId = null;
      refrescarDatosPlanes();
    });

    document.getElementById("compPlanOrigenSelect")?.addEventListener("change", (e) => {
      planOrigenId = e.target.value ? Number(e.target.value) : null;
      if (planOrigenId && planDestinoId && Number(planOrigenId) === Number(planDestinoId)) {
        const planesCarrera = planes.filter((p) => !carreraId || Number(p.carreraId) === Number(carreraId));
        planDestinoId = planesCarrera.find((p) => Number(p.id) !== Number(planOrigenId))?.id || null;
      }
      refrescarDatosPlanes();
    });

    document.getElementById("compPlanDestinoSelect")?.addEventListener("change", (e) => {
      planDestinoId = e.target.value ? Number(e.target.value) : null;
      refrescarDatosPlanes();
    });

    content.querySelectorAll("[data-origen-id]").forEach((chk) => {
      chk.addEventListener("change", (e) => {
        const id = Number(e.target.dataset.origenId);
        if (e.target.checked) seleccionadasOrigen.add(id);
        else seleccionadasOrigen.delete(id);
        const countSpan = document.getElementById("countSelOrigen");
        if (countSpan) countSpan.textContent = seleccionadasOrigen.size;
        const btn = document.getElementById("compBtnCrearEq");
        if (btn) btn.innerHTML = `<i data-lucide="link" aria-hidden="true"></i> Vincular Equivalencia (${seleccionadasOrigen.size} a ${seleccionadasDestino.size})`;
        renderizarIconos();
      });
    });

    content.querySelectorAll("[data-destino-id]").forEach((chk) => {
      chk.addEventListener("change", (e) => {
        const id = Number(e.target.dataset.destinoId);
        if (e.target.checked) seleccionadasDestino.add(id);
        else seleccionadasDestino.delete(id);
        const countSpan = document.getElementById("countSelDestino");
        if (countSpan) countSpan.textContent = seleccionadasDestino.size;
        const btn = document.getElementById("compBtnCrearEq");
        if (btn) btn.innerHTML = `<i data-lucide="link" aria-hidden="true"></i> Vincular Equivalencia (${seleccionadasOrigen.size} a ${seleccionadasDestino.size})`;
        renderizarIconos();
      });
    });

    content.querySelectorAll("[data-del-eq]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!puedeGestionarPlanes()) return;
        const id = Number(btn.dataset.delEq);
        const conf = await confirmarAccion({
          titulo: "Eliminar equivalencia",
          mensaje: "¿Desea desactivar esta equivalencia institucional entre los planes?",
          peligro: true,
          textoConfirmar: "Eliminar",
        });
        if (!conf) return;
        try {
          const res = await eliminarEquivalenciaPlan(id);
          if (res?.ok === false) throw new Error(res.message);
          mostrarFeedback("Equivalencia eliminada correctamente.");
          await refrescarDatosPlanes();
        } catch (err) {
          mostrarFeedback(err?.message || "No fue posible eliminar la equivalencia.", "error");
        }
      });
    });

    document.getElementById("compBtnCrearEq")?.addEventListener("click", async () => {
      if (!puedeGestionarPlanes()) return;
      if (seleccionadasOrigen.size === 0 || seleccionadasDestino.size === 0) {
        mostrarFeedback("Debe seleccionar al menos una materia de origen y una de destino.", "error");
        return;
      }

      const origenIds = Array.from(seleccionadasOrigen);
      const destinoIds = Array.from(seleccionadasDestino);
      const justificacion = document.getElementById("compEqJustificacion")?.value?.trim() || "";

      let payload = {
        carreraOrigenId: carreraId,
        planOrigenId,
        carreraDestinoId: carreraId,
        planDestinoId,
        justificacion,
      };

      if (origenIds.length === 1 && destinoIds.length === 1) {
        payload.asignaturaOrigenId = origenIds[0];
        payload.asignaturaDestinoId = destinoIds[0];
        payload.tipoEquivalencia = 'INDIVIDUAL';
      } else if (origenIds.length > 1 && destinoIds.length === 1) {
        payload.asignaturasOrigenIds = origenIds;
        payload.asignaturaDestinoId = destinoIds[0];
        payload.tipoEquivalencia = 'N_A_1';
      } else if (origenIds.length === 1 && destinoIds.length > 1) {
        payload.asignaturaOrigenId = origenIds[0];
        payload.asignaturasDestinoIds = destinoIds;
        payload.tipoEquivalencia = '1_A_N';
      } else {
        mostrarFeedback("Las equivalencias complejas deben ser N a 1 o 1 a N.", "error");
        return;
      }

      try {
        const res = await crearEquivalenciaPlan(payload);
        if (res?.ok === false) throw new Error(res.message);
        mostrarFeedback("Equivalencia institucional registrada correctamente.");
        await refrescarDatosPlanes();
      } catch (err) {
        mostrarFeedback(err?.message || "No fue posible registrar la equivalencia.", "error");
      }
    });
  }

  await refrescarDatosPlanes();
}

/* =========================================================
   TRANSICIÓN CURRICULAR INSTITUCIONAL
   ========================================================= */

async function abrirTransicionCurricular(planOrigenIdInicial = null) {
  const dialog = document.getElementById("transicionCurricularDialog");
  const content = document.getElementById("transicionCurricularDialogContent");
  if (!dialog || !content) return;

  let carreraId = planes.find((plan) => Number(plan.id) === Number(planOrigenIdInicial))?.carreraId
    || carrerasDisponibles[0]?.id || null;
  let planOrigenId = planOrigenIdInicial || null;
  let planDestinoId = null;
  let simulacion = null;
  let poblacion = null;
  let transicionEjecucionEnCurso = false;
  const estudiantesSeleccionados = new Set();

  async function cargarPoblacion() {
    if (!carreraId || !planOrigenId) {
      mostrarFeedback("Seleccione carrera y plan origen.", "error");
      return;
    }
    try {
      const res = await consultarPoblacionTransicion(planOrigenId, carreraId);
      if (res?.ok === false) throw new Error(res.message);
      const candidatos = res.data || res;
      if (!Array.isArray(candidatos)) throw new Error("La consulta no devolvió una lista válida.");
      poblacion = candidatos;
      estudiantesSeleccionados.clear();
      candidatos.forEach((estudiante) => estudiantesSeleccionados.add(Number(estudiante.id)));
      simulacion = null;
      renderVistaTransicion();
    } catch (err) {
      mostrarFeedback(err?.message || "No fue posible cargar los estudiantes.", "error");
    }
  }

  async function ejecutarSimulacion() {
    if (!carreraId || !planOrigenId || !planDestinoId) {
      mostrarFeedback("Seleccione carrera, plan origen y plan destino.", "error");
      return;
    }
    if (planOrigenId === planDestinoId) {
      mostrarFeedback("El plan de origen y destino deben ser diferentes.", "error");
      return;
    }

    if (!poblacion || estudiantesSeleccionados.size === 0) {
      mostrarFeedback("Cargue y seleccione al menos un estudiante antes de simular.", "error");
      return;
    }
    try {
      const res = await simularTransicionCurricular({
        carreraId,
        planOrigenId,
        planDestinoId,
        estudianteIds: Array.from(estudiantesSeleccionados),
      });
      if (res?.ok === false) throw new Error(res.message);
      simulacion = res.data || res;
      if (!Array.isArray(simulacion?.estudiantes)) {
        throw new Error("La simulación no devolvió una lista de estudiantes válida.");
      }
      renderVistaTransicion();
    } catch (err) {
      mostrarFeedback(err?.message || "Error al simular la transición curricular.", "error");
    }
  }

  async function confirmarYEjecutarTransicion() {
    if (transicionEjecucionEnCurso) return;
    if (!simulacion || !carreraId || !planOrigenId || !planDestinoId) return;
    const elegibles = simulacion.estudiantes.filter((estudiante) => estudiante.puedeMigrar);
    const motivo = document.getElementById('tcMotivoEjecucion')?.value?.trim();
    if (!elegibles.length) { mostrarFeedback('No hay estudiantes sin conflictos listos para trasladar.', 'error'); return; }
    if (!motivo || motivo.length < 5) { mostrarFeedback('Indique un motivo institucional de al menos cinco caracteres.', 'error'); return; }
    transicionEjecucionEnCurso = true;
    const botonEjecutar = document.getElementById('tcBtnEjecutar');
    if (botonEjecutar) {
      botonEjecutar.disabled = true;
      botonEjecutar.textContent = 'Confirmación en curso…';
    }
    try {
      const planOrigen = planes.find((plan) => Number(plan.id) === Number(planOrigenId));
      const planDestino = planes.find((plan) => Number(plan.id) === Number(planDestinoId));
      const primeraConfirmacion = await confirmarAccion({
        titulo: 'Revisar traslado curricular',
        mensaje: `Estudiantes seleccionados: ${estudiantesSeleccionados.size}. Plan origen: ${planOrigen?.codigo || planOrigen?.nombre || planOrigenId}. Plan destino: ${planDestino?.codigo || planDestino?.nombre || planDestinoId}. Resumen: ${elegibles.length} elegible(s) de ${simulacion.estudiantes.length}; ${simulacion.estudiantes.length - elegibles.length} con conflicto(s). Se procesará cada estudiante elegible de forma independiente. Motivo: ${motivo}`,
        textoConfirmar: 'Continuar a confirmación final', peligro: false,
      });
      if (!primeraConfirmacion) return;

      const confirmacionFinal = await confirmarAccion({
        titulo: 'Autorizar ejecución definitiva',
        mensaje: `Esta confirmación autoriza definitivamente el traslado de ${elegibles.length} estudiante(s) elegible(s) al plan ${planDestino?.codigo || planDestino?.nombre || planDestinoId}.`,
        textoConfirmar: 'Sí, ejecutar traslado', peligro: true,
      });
      if (!confirmacionFinal) return;

      const response = await ejecutarTransicionCurricular({ carreraId, planOrigenId, planDestinoId,
        estudianteIds: elegibles.map((estudiante) => Number(estudiante.estudianteId)), motivo });
      if (response?.ok === false) throw new Error(response.message || 'No fue posible ejecutar la transición.');
      const result = response?.data || response;
      const failures = Array.isArray(result.fallidos) ? result.fallidos : [];
      const summary = `Traslado procesado: ${result.migrados || 0}/${result.solicitados || elegibles.length} estudiantes; ${failures.length} con error individual.`;
      simulacion = null;
      await cargarPoblacion();
      mostrarFeedback(summary, failures.length ? 'error' : 'success');
    } catch (error) {
      mostrarFeedback(error?.message || 'No fue posible ejecutar la transición curricular.', 'error');
    } finally {
      transicionEjecucionEnCurso = false;
      const botonActual = document.getElementById('tcBtnEjecutar');
      if (botonActual) {
        botonActual.disabled = !simulacion || !simulacion.estudiantes.some((estudiante) => estudiante.puedeMigrar);
        botonActual.textContent = `Ejecutar traslado de ${simulacion?.totalMigrables || 0} estudiante(s) elegible(s)`;
      }
    }
  }

  function renderVistaTransicion() {
    const planesCarrera = planes.filter((p) => !carreraId || Number(p.carreraId) === Number(carreraId));
    if (!planOrigenId && planesCarrera.length > 0) planOrigenId = planesCarrera[0].id;
    if (!planDestinoId && planesCarrera.length > 1) {
      planDestinoId = planesCarrera.find((p) => Number(p.id) !== Number(planOrigenId))?.id || planesCarrera[1].id;
    }

    const body = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; background: #f8fafc; padding: 12px; border-radius: 8px;">
          <label>
            <span style="font-weight: 600; font-size: 13px;">Carrera</span>
            <select id="tcCarreraSelect" class="planes-select" style="width: 100%; margin-top: 4px;">
              ${carrerasDisponibles.map((c) => `<option value="${c.id}" ${Number(c.id) === Number(carreraId) ? 'selected' : ''}>${escapeHtml(c.codigo)} - ${escapeHtml(c.nombre)}</option>`).join('')}
            </select>
          </label>
          <label>
            <span style="font-weight: 600; font-size: 13px;">Plan Origen (Plan a cerrar o migrar)</span>
            <select id="tcPlanOrigenSelect" class="planes-select" style="width: 100%; margin-top: 4px;">
              <option value="">Seleccione plan origen...</option>
              ${planesCarrera.map((p) => `<option value="${p.id}" ${Number(p.id) === Number(planOrigenId) ? 'selected' : ''}>${escapeHtml(p.codigo)} - ${escapeHtml(p.nombre)}</option>`).join('')}
            </select>
          </label>
          <label>
            <span style="font-weight: 600; font-size: 13px;">Plan Destino (Nuevo plan vigente)</span>
            <select id="tcPlanDestinoSelect" class="planes-select" style="width: 100%; margin-top: 4px;">
              <option value="">Seleccione plan destino...</option>
              ${planesCarrera.map((p) => `<option value="${p.id}" ${Number(p.id) === Number(planDestinoId) ? 'selected' : ''}>${escapeHtml(p.codigo)} - ${escapeHtml(p.nombre)}</option>`).join('')}
            </select>
          </label>
          <div style="display: flex; align-items: flex-end;">
            <button id="tcBtnSimular" type="button" class="planes-primary-button" style="width: 100%; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
              <i data-lucide="zap" aria-hidden="true"></i> Simular Transición
            </button>
          </div>
        </div>

        ${planesCarrera.length < 2 ? `<div class="planes-message">${planesCarrera.length === 0 ? 'No hay planes de estudio disponibles para esta carrera.' : 'Se necesitan al menos dos planes de estudio para simular una transición.'}</div>` : ''}
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
          <button id="tcBtnCargarPoblacion" type="button" class="planes-primary-button">Cargar estudiantes del plan origen</button>
          ${poblacion ? `<div style="margin-top: 12px;">
            <label><input id="tcSeleccionarTodos" type="checkbox" ${poblacion.length > 0 && estudiantesSeleccionados.size === poblacion.length ? 'checked' : ''}> Seleccionar todos (${poblacion.length})</label>
            <span style="margin-left: 12px;">Seleccionados: ${estudiantesSeleccionados.size}</span>
            <div style="max-height: 180px; overflow-y: auto; margin-top: 8px;">
              ${poblacion.map((estudiante) => `<label style="display: block; padding: 4px;"><input type="checkbox" data-tc-estudiante="${Number(estudiante.id)}" ${estudiantesSeleccionados.has(Number(estudiante.id)) ? 'checked' : ''}> ${escapeHtml(estudiante.nombreCompleto)} (${escapeHtml(estudiante.cedula)})</label>`).join('') || '<p>No hay estudiantes activos en este plan.</p>'}
            </div>
          </div>` : '<p>Consulte la población para seleccionar expedientes antes de simular.</p>'}
        </div>
        ${simulacion ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
            <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; border-left: 4px solid #64748b;">
              <small style="color: #64748b; font-weight: 600;">TOTAL ANALIZADOS</small>
              <div style="font-size: 22px; font-weight: 700; color: #1e293b;">${simulacion.totalAnalizados}</div>
            </div>
            <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; border-left: 4px solid #22c55e;">
              <small style="color: #16a34a; font-weight: 600;">SIN CONFLICTOS EN LA SIMULACIÓN</small>
              <div style="font-size: 22px; font-weight: 700; color: #15803d;">${simulacion.totalMigrables}</div>
            </div>
            <div style="background: ${simulacion.totalConflictos > 0 ? '#fef2f2' : '#f8fafc'}; padding: 12px; border-radius: 8px; border-left: 4px solid ${simulacion.totalConflictos > 0 ? '#ef4444' : '#cbd5e1'};">
              <small style="color: ${simulacion.totalConflictos > 0 ? '#dc2626' : '#64748b'}; font-weight: 600;">CON CONFLICTOS (N:1 incompleta)</small>
              <div style="font-size: 22px; font-weight: 700; color: ${simulacion.totalConflictos > 0 ? '#b91c1c' : '#475569'};">${simulacion.totalConflictos}</div>
            </div>
          </div>

          <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background: #f8fafc; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
              <span><strong>Estudiantes candidatos</strong> (${simulacion.estudiantes.length})</span>
            </div>
            <div style="max-height: 260px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead style="background: #ffffff; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0;">
                  <tr>
                    <th style="padding: 8px; text-align: left;">Estudiante</th>
                    <th style="padding: 8px; text-align: left;">Reconocidas en Destino</th>
                    <th style="padding: 8px; text-align: left;">Sin Equivalencia (Historial)</th>
                    <th style="padding: 8px; text-align: left;">Diagnóstico / Conflictos</th>
                  </tr>
                </thead>
                <tbody>
                  ${simulacion.estudiantes.length === 0 ? '<tr><td colspan="4" style="padding: 16px; text-align: center;">No hay estudiantes en el plan de origen para esta simulación.</td></tr>' : simulacion.estudiantes.map((est) => `
                      <tr style="border-bottom: 1px solid #f1f5f9; background: ${est.puedeMigrar ? '#ffffff' : '#fff5f5'};">
                        <td style="padding: 8px;">
                          <strong>${escapeHtml(est.nombreCompleto)}</strong>
                          <div style="font-size: 11px; color: #64748b;">${escapeHtml(est.cedula)}</div>
                        </td>
                        <td style="padding: 8px;">
                          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                            ${est.asignaturasReconocidas.length === 0 ? '<span style="color: #94a3b8; font-size: 12px;">Ninguna</span>' : est.asignaturasReconocidas.map((r) => `<span style="font-size: 11px; background: #dcfce7; color: #166534; padding: 2px 5px; border-radius: 4px;" title="${escapeHtml(r.nombre)}">${escapeHtml(r.codigo)}</span>`).join('')}
                          </div>
                        </td>
                        <td style="padding: 8px;">
                          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                            ${est.asignaturasSinEquivalencia.length === 0 ? '<span style="color: #94a3b8; font-size: 12px;">Ninguna</span>' : est.asignaturasSinEquivalencia.map((s) => `<span style="font-size: 11px; background: #f1f5f9; color: #475569; padding: 2px 5px; border-radius: 4px;" title="${escapeHtml(s.nombre)}">${escapeHtml(s.codigo)}</span>`).join('')}
                          </div>
                        </td>
                        <td style="padding: 8px;">
                          ${est.puedeMigrar ? `<span style="font-size: 12px; color: #16a34a; font-weight: 600;">✓ Sin conflictos en la simulación</span>` : `<div style="font-size: 11px; color: #dc2626;">${est.conflictos.map((c) => escapeHtml(c)).join('<br>')}</div>`}
                        </td>
                      </tr>
                    `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 8px;">
            <p>Se trasladarán únicamente los estudiantes elegibles. Los demás quedarán identificados como fallidos sin cancelar a los estudiantes confirmados.</p>
            <label>Motivo institucional
              <textarea id="tcMotivoEjecucion" class="planes-input" minlength="5" maxlength="500" style="display:block; width:100%; min-height:64px;"></textarea>
            </label>
            <button id="tcBtnEjecutar" type="button" class="planes-primary-button" ${simulacion.totalMigrables ? '' : 'disabled'}>
              Ejecutar traslado de ${simulacion.totalMigrables} estudiante(s) elegible(s)
            </button>
          </div>
        ` : ''}
      </div>
    `;

    content.innerHTML = FormDialog({
      formId: "transicionCurricularForm",
      title: "Transición Curricular Institucional",
      description: "Simule el impacto de una transición entre planes. La simulación es de solo lectura y no modifica expedientes.",
      body,
      cancelButtonId: "cerrarTransicionBtn",
      cancelText: "Cerrar",
      layout: "custom",
      formClass: "transicion-dialog",
    });

    renderizarIconos();
    if (!dialog.open) dialog.showModal();
    habilitarCierreExterior(dialog);

    document.getElementById("cerrarTransicionBtn")?.addEventListener("click", () => dialog.close());

    document.getElementById("tcCarreraSelect")?.addEventListener("change", (e) => {
      carreraId = e.target.value ? Number(e.target.value) : null;
      planOrigenId = null;
      planDestinoId = null;
      simulacion = null;
      poblacion = null;
      estudiantesSeleccionados.clear();
      renderVistaTransicion();
    });

    document.getElementById("tcPlanOrigenSelect")?.addEventListener("change", (e) => {
      planOrigenId = e.target.value ? Number(e.target.value) : null;
      simulacion = null;
      poblacion = null;
      estudiantesSeleccionados.clear();
      renderVistaTransicion();
    });

    document.getElementById("tcPlanDestinoSelect")?.addEventListener("change", (e) => {
      planDestinoId = e.target.value ? Number(e.target.value) : null;
      simulacion = null;
      renderVistaTransicion();
    });

    document.getElementById("tcBtnCargarPoblacion")?.addEventListener("click", cargarPoblacion);
    document.getElementById("tcSeleccionarTodos")?.addEventListener("change", (event) => {
      estudiantesSeleccionados.clear();
      if (event.target.checked) poblacion.forEach((estudiante) => estudiantesSeleccionados.add(Number(estudiante.id)));
      simulacion = null;
      renderVistaTransicion();
    });
    content.querySelectorAll("[data-tc-estudiante]").forEach((checkbox) => {
      checkbox.addEventListener("change", (event) => {
        const id = Number(event.target.dataset.tcEstudiante);
        if (event.target.checked) estudiantesSeleccionados.add(id);
        else estudiantesSeleccionados.delete(id);
        simulacion = null;
        renderVistaTransicion();
      });
    });
    document.getElementById("tcBtnSimular")?.addEventListener("click", ejecutarSimulacion);
    document.getElementById("tcBtnEjecutar")?.addEventListener("click", confirmarYEjecutarTransicion);


  }

  renderVistaTransicion();
}


async function abrirBandejaConvalidacionesExternas() {
  const dialog = document.getElementById('convalidacionesExternasDialog');
  const content = document.getElementById('convalidacionesExternasDialogContent');
  if (!dialog || !content) return;
  let carreraId = carrerasDisponibles[0]?.id || null;
  let solicitudes = [];
  const revisadasEnEstaSesion = new Set();

  async function cargar() {
    try {
      const response = await listarConvalidacionesExternas(carreraId, 'PENDIENTE');
      if (response?.ok === false) throw new Error(response.message || 'No fue posible consultar las solicitudes.');
      const rows = response?.data || response;
      if (!Array.isArray(rows)) throw new Error('La respuesta de la bandeja no es válida.');
      solicitudes = rows;
      render();
    } catch (error) {
      mostrarFeedback(error?.message || 'No fue posible cargar las convalidaciones externas.', 'error');
    }
  }

  function render() {
    content.innerHTML = `
      <div style="padding:20px; display:flex; flex-direction:column; gap:14px;">
        <header style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
          <div><h2 style="margin:0;">Convalidaciones externas pendientes</h2>
            <p style="margin:6px 0 0; color:#475467;">Abra cada documento en la fuente institucional, coteje su contenido y registre la revisión antes de decidir.</p></div>
          <button id="cerrarConvalidacionesExternas" type="button" class="planes-secondary-button">Cerrar</button>
        </header>
        <label style="max-width:420px;">Carrera
          <select id="convalidacionesCarrera" class="planes-select" style="display:block; width:100%; margin-top:4px;">
            ${carrerasDisponibles.map((c) => `<option value="${Number(c.id)}" ${Number(c.id) === Number(carreraId) ? 'selected' : ''}>${escapeHtml(c.codigo)} - ${escapeHtml(c.nombre)}</option>`).join('')}
          </select>
        </label>
        ${solicitudes.length ? solicitudes.map((row) => {
          const docs = Array.isArray(row.documentacion) ? row.documentacion : [];
          const revisada = revisadasEnEstaSesion.has(Number(row.id));
          return `<article style="border:1px solid #d0d5dd; border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:10px;">
            <div><strong>Solicitud #${Number(row.id)} · Estudiante #${Number(row.estudianteId)}</strong>
              <div>${escapeHtml(row.institucionOrigen)} — ${escapeHtml(row.asignaturaOrigen)} (${escapeHtml(row.identificacionAsignatura)})</div>
              <small>Plan #${Number(row.planDestinoId)} · asignatura destino #${Number(row.planAsignaturaDestinoId)} · ${Number(row.creditosOrigen)} créditos de origen</small>
            </div>
            <p style="margin:0;">Motivo de solicitud: ${escapeHtml(row.motivoSolicitud)}</p>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${docs.map((doc, index) => {
                let link = '';
                try { const url = new URL(doc.referencia); if (url.protocol === 'https:' && !url.username && !url.password) link = `<button type="button" class="planes-secondary-button" data-ext-open="${Number(row.id)}" data-ext-index="${index}">Abrir documento HTTPS</button>`; } catch {}
                return `<label style="display:grid; grid-template-columns:auto 1fr; gap:8px; align-items:start; padding:8px; background:#f8fafc; border-radius:6px;">
                  <input type="checkbox" class="ext-doc-check" data-ext-id="${Number(row.id)}" data-ext-hash="${escapeHtml(doc.sha256)}">
                  <span><strong>${escapeHtml(doc.nombre)}</strong><br><small>Referencia: <code>${escapeHtml(doc.referencia)}</code></small><br><small>SHA-256: <code>${escapeHtml(doc.sha256)}</code></small>${link}</span>
                </label>`;
              }).join('') || '<p>No hay evidencia documental; la solicitud no podrá aprobarse.</p>'}
            </div>
            <label>Constancia de revisión documental<textarea class="planes-input" data-ext-review-reason="${Number(row.id)}" minlength="5" maxlength="500" placeholder="Indique qué verificó en los documentos" style="display:block; width:100%; min-height:64px;"></textarea></label>
            <button type="button" class="planes-secondary-button" data-ext-verify="${Number(row.id)}" ${!docs.length ? 'disabled' : ''}>Registrar revisión de evidencia</button>
            <label>Motivo de la decisión<textarea class="planes-input" data-ext-decision-reason="${Number(row.id)}" minlength="5" maxlength="500" style="display:block; width:100%; min-height:64px;"></textarea></label>
            <div style="display:flex; gap:8px;">
              <button type="button" class="planes-primary-button" data-ext-decision="APROBADA" data-ext-id="${Number(row.id)}" ${revisada ? '' : 'disabled'}>Aprobar</button>
              <button type="button" class="planes-secondary-button" data-ext-decision="RECHAZADA" data-ext-id="${Number(row.id)}" ${revisada ? '' : 'disabled'}>Rechazar</button>
            </div>
          </article>`;
        }).join('') : '<p>No hay solicitudes pendientes para esta carrera.</p>'}
      </div>`;
    renderizarIconos();
    if (!dialog.open) dialog.showModal();
    document.getElementById('cerrarConvalidacionesExternas')?.addEventListener('click', () => dialog.close());
    document.getElementById('convalidacionesCarrera')?.addEventListener('change', (event) => {
      carreraId = event.target.value ? Number(event.target.value) : null;
      revisadasEnEstaSesion.clear();
      void cargar();
    });
    content.querySelectorAll('.ext-doc-check').forEach((checkbox) => checkbox.addEventListener('change', () => {
      const id = checkbox.dataset.extId;
      const button = content.querySelector(`[data-ext-verify="${id}"]`);
      const all = [...content.querySelectorAll(`.ext-doc-check[data-ext-id="${id}"]`)];
      if (button) button.disabled = !all.length || all.some((item) => !item.checked);
    }));
    content.querySelectorAll('[data-ext-open]').forEach((button) => button.addEventListener('click', async () => {
      const row = solicitudes.find((item) => Number(item.id) === Number(button.dataset.extOpen));
      const reference = row?.documentacion?.[Number(button.dataset.extIndex)]?.referencia;
      try {
        const result = await window.sgpa.abrirReferenciaEvidenciaConvalidacion(reference);
        if (!result?.ok) throw new Error(result?.message || 'No se pudo abrir el documento.');
      } catch (error) { mostrarFeedback(error?.message || 'No se pudo abrir el documento.', 'error'); }
    }));
    content.querySelectorAll('[data-ext-verify]').forEach((button) => button.addEventListener('click', async () => {
      const id = Number(button.dataset.extVerify);
      const docs = solicitudes.find((item) => Number(item.id) === id)?.documentacion || [];
      const checks = [...content.querySelectorAll(`.ext-doc-check[data-ext-id="${id}"]`)];
      const reason = content.querySelector(`[data-ext-review-reason="${id}"]`)?.value?.trim();
      if (!checks.length || checks.some((item) => !item.checked) || !reason || reason.length < 5) {
        mostrarFeedback('Abra y coteje todos los documentos e indique el resultado de la revisión.', 'error');
        return;
      }
      try {
        const response = await verificarEvidenciaConvalidacionExterna(id, {
          hashesVerificados: docs.map((doc) => doc.sha256), motivoRevision: reason,
          confirmacion: 'CONFIRMO_REVISION_DOCUMENTAL',
        });
        if (response?.ok === false) throw new Error(response.message || 'No se registró la revisión.');
        revisadasEnEstaSesion.add(id);
        render();
        mostrarFeedback('Revisión documental registrada. Ya puede emitir la decisión.', 'success');
      } catch (error) { mostrarFeedback(error?.message || 'No fue posible registrar la revisión documental.', 'error'); }
    }));
    content.querySelectorAll('[data-ext-decision]').forEach((button) => button.addEventListener('click', async () => {
      const id = Number(button.dataset.extId);
      const reason = content.querySelector(`[data-ext-decision-reason="${id}"]`)?.value?.trim();
      if (!revisadasEnEstaSesion.has(id)) return;
      if (!reason || reason.length < 5) { mostrarFeedback('Indique un motivo de al menos cinco caracteres.', 'error'); return; }
      try {
        const response = await decidirConvalidacionExterna(id, { decision: button.dataset.extDecision, motivo: reason });
        if (response?.ok === false) throw new Error(response.message || 'No se registró la decisión.');
        revisadasEnEstaSesion.delete(id);
        mostrarFeedback(`Solicitud ${button.dataset.extDecision.toLowerCase()} correctamente.`, 'success');
        await cargar();
      } catch (error) { mostrarFeedback(error?.message || 'No fue posible decidir la solicitud.', 'error'); }
    }));
  }

  if (!dialog.open) dialog.showModal();
  habilitarCierreExterior(dialog);
  await cargar();
}

export function iniciarPlanesEstudioPage() {
  instanciaActual += 1;
  const instancia = instanciaActual;
  const pagina = document.getElementById("planesEstudioPage");

  if (!pagina) {
    return;
  }

  detalleEventosController?.abort();
  detalleEventosController = null;
  paginaEventosController?.abort();
  paginaEventosController = new AbortController();
  const { signal } = paginaEventosController;

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
    void abrirBandejaConvalidacionesExternas();
  }, { signal });

  document
    .getElementById("planesBuscar")
    ?.addEventListener("input", renderizarPlanes, { signal });
  document
    .getElementById("planesEstado")
    ?.addEventListener("change", renderizarPlanes, { signal });
  document
    .getElementById("planesCarrera")
    ?.addEventListener("change", renderizarPlanes, { signal });

  document
    .getElementById("planesContent")
    ?.addEventListener("click", async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest("[data-action]");

      if (!button) {
        return;
      }

      const id = Number(button.dataset.id);
      const plan = planes.find((item) => Number(item.id) === id);

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
