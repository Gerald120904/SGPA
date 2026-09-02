import {
  actualizarPlanEstudio,
  cambiarEstadoPlanEstudio,
  crearPlanEstudio,
  listarPlanesEstudio,
} from "../../services/planes-estudio.service.js";
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
  actualizarBloquePlan,
  cambiarEstadoBloquePlan,
  crearBloquePlan,
  listarBloquesPlan,
} from "../../services/bloques-plan.service.js";
import {
  actualizarSalidaAcademica,
  cambiarEstadoSalidaAcademica,
  crearSalidaAcademica,
  listarSalidasAcademicas,
  reemplazarAsignaturasSalida,
} from "../../services/salidas-academicas.service.js";
import { listarCarreras } from "../../services/carreras.service.js";
import { obtenerResumenPlan } from "../../services/plan-resumen.service.js";
import { validarPlanEstudio } from "../../services/plan-validaciones.service.js";
import {
  ejecutarImportacionPlanCompleta,
  guardarPlantillaExcelPlan,
  seleccionarExcelPlan,
  validarImportacionPlan,
} from "../../services/plan-importacion.service.js";
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

let planes = [];
let carrerasDisponibles = [];
let asignaturasPlan = [];
let filasRequisitosRapidos = [];
let requisitosPlan = [];
let bloquesPlan = [];
let salidasAcademicas = [];
let resumenPlan = null;
let planSeleccionado = null;
let instanciaActual = 0;
let vistaDetallePlan = "LISTA";
let filtroBloquePlan = "";
let observerMalla = null;
let nivelPaginaPlan = 1;
let detalleEventosController = null;

function mostrarDialogHerramienta() {
  const dialog = document.getElementById("asignaturaDialog");

  if (!dialog) {
    return null;
  }

  if (!dialog.open) {
    dialog.showModal();
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
        <div>
          <h2>Planes de estudio</h2>
          <p>Administración de los planes académicos asociados a cada carrera.</p>
        </div>

        <button
          id="nuevoPlanButton"
          class="planes-primary-button"
          type="button"
        >
          <i data-lucide="plus" aria-hidden="true"></i>
          Nuevo plan
        </button>
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
      coincideEstado = plan.activo === true;
    }

    if (estado === "INACTIVOS") {
      coincideEstado = plan.activo === false;
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
            <span class="plan-status ${
              plan.activo ? "plan-status-active" : "plan-status-inactive"
            }">
              ${plan.activo ? "Activo" : "Inactivo"}
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
                plan.activo ? "planes-danger-button" : "planes-success-button"
              }"
              data-action="estado"
              data-id="${plan.id}"
              type="button"
              title="${plan.activo ? "Desactivar plan" : "Activar plan"}"
            >
              <i
                data-lucide="${
                  plan.activo ? "circle-pause" : "circle-check"
                }"
                aria-hidden="true"
              ></i>
            </button>
          </td>
        </tr>
      `,
    )
    .join("");

  contenedor.innerHTML = DataTable({
    columns: ["Código", "Plan de estudio", "Carrera", "Estado", "Acciones"],
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
      listarCarreras(),
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
    carrerasDisponibles = Array.isArray(resultadoCarreras.carreras)
      ? resultadoCarreras.carreras
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
  const dialog = document.getElementById("planDialog");
  const content = document.getElementById("planDialogContent");

  if (!dialog || !content) {
    return;
  }

  const editando = Boolean(plan);

  const opcionesCarreras = carrerasDisponibles
    .filter((carrera) => carrera.activo === true)
    .map(
      (carrera) => `
        <option value="${carrera.id}">
          ${escapeHtml(carrera.codigo)} - ${escapeHtml(carrera.nombre)}
        </option>
      `,
    )
    .join("");

  const carreraField = editando
    ? `
        <label class="sgpa-form-wide">
          <span>Carrera</span>
          <input
            type="text"
            value="${escapeHtml(
              `${plan.carrera?.codigo || ""} - ${plan.carrera?.nombre || ""}`,
            )}"
            disabled
          >
          <small class="sgpa-field-help">
            La carrera de un plan no se puede cambiar después de crearlo.
          </small>
        </label>
      `
    : `
        <label class="sgpa-form-wide">
          <span>Carrera</span>
          <select id="planCarrera" name="carreraId" required>
            <option value="" selected disabled>
              Seleccione una carrera...
            </option>
            ${opcionesCarreras}
          </select>
        </label>
      `;

  const body = `
    ${carreraField}

    <label>
      <span>Código</span>
      <input
        id="planCodigo"
        name="codigo"
        type="text"
        maxlength="40"
        value="${plan ? escapeHtml(plan.codigo) : ""}"
        placeholder="Ej. BA-INFORM 2012-10"
        required
      >
    </label>

    <label>
      <span>Nombre</span>
      <input
        id="planNombre"
        name="nombre"
        type="text"
        maxlength="180"
        value="${plan ? escapeHtml(plan.nombre) : ""}"
        placeholder="Ej. Plan de Bachillerato 2012-10"
        required
      >
    </label>

    <label class="sgpa-form-wide">
      <span>Descripción</span>
      <textarea
        id="planDescripcion"
        name="descripcion"
        maxlength="500"
        rows="4"
        placeholder="Descripción opcional del plan"
      >${plan?.descripcion ? escapeHtml(plan.descripcion) : ""}</textarea>
    </label>
  `;

  content.innerHTML = FormDialog({
    formId: "planForm",
    title: editando ? "Editar plan de estudio" : "Nuevo plan de estudio",
    description: editando
      ? "Actualice la información general del plan de estudio."
      : "Registre un nuevo plan asociado a una carrera existente.",
    body,
    errorId: "planFormError",
    cancelButtonId: "cancelarPlanButton",
    submitButtonId: "guardarPlanButton",
    submitText: editando ? "Guardar cambios" : "Crear plan",
  });

  renderizarIconos();
  dialog.showModal();
  habilitarCierreExterior(dialog);

  const cerrar = () => dialog.close();

  document
    .getElementById("cancelarPlanButton")
    ?.addEventListener("click", cerrar);

  document
    .getElementById("planForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const errorBox = document.getElementById("planFormError");
      const guardarButton = document.getElementById("guardarPlanButton");
      const codigoInput = document.getElementById("planCodigo");
      const nombreInput = document.getElementById("planNombre");
      const descripcionInput = document.getElementById("planDescripcion");

      if (!guardarButton || !codigoInput || !nombreInput || !descripcionInput) {
        return;
      }

      const datos = {
        codigo: codigoInput.value.trim(),
        nombre: nombreInput.value.trim(),
        descripcion: descripcionInput.value.trim(),
      };

      if (!editando) {
        const carreraInput = document.getElementById("planCarrera");

        if (!carreraInput?.value) {
          if (errorBox) {
            errorBox.textContent = "Debe seleccionar una carrera.";
            errorBox.classList.remove("hidden");
          }
          return;
        }

        datos.carreraId = Number(carreraInput.value);
      }

      errorBox?.classList.add("hidden");
      guardarButton.disabled = true;

      try {
        const resultado = editando
          ? await actualizarPlanEstudio(plan.id, datos)
          : await crearPlanEstudio(datos);

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || "No fue posible guardar el plan de estudio.",
          );
        }

        cerrar();
        mostrarFeedback(
          editando
            ? "Plan actualizado correctamente."
            : "Plan creado correctamente.",
        );
        await cargarDatos(instanciaActual);
      } catch (error) {
        if (errorBox) {
          errorBox.textContent =
            error?.message || "No fue posible guardar el plan de estudio.";
          errorBox.classList.remove("hidden");
        }
      } finally {
        guardarButton.disabled = false;
      }
    });
}

async function alternarEstado(plan) {
  const nuevoEstado = !plan.activo;
  const accion = nuevoEstado ? "activar" : "desactivar";
  const confirmado = await confirmarAccion({
    titulo: nuevoEstado
      ? "Activar plan de estudio"
      : "Desactivar plan de estudio",
    mensaje: `¿Desea ${accion} el plan "${plan.nombre}"?`,
    textoConfirmar: nuevoEstado ? "Activar" : "Desactivar",
    peligro: !nuevoEstado,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await cambiarEstadoPlanEstudio(plan.id, nuevoEstado);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible cambiar el estado del plan.",
      );
    }

    mostrarFeedback(
      nuevoEstado
        ? "Plan activado correctamente."
        : "Plan desactivado correctamente.",
    );
    await cargarDatos(instanciaActual);
  } catch (error) {
    mostrarFeedback(
      error?.message || "No fue posible cambiar el estado del plan.",
      "error",
    );
  }
}

async function abrirDetallePlan(plan) {
  vistaDetallePlan = "LISTA";
  filtroBloquePlan = "";
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
      resultadoBloques,
      resultadoSalidas,
      resultadoResumen,
    ] = await Promise.all([
      listarPlanAsignaturas(plan.id),
      listarPlanRequisitos(plan.id),
      listarBloquesPlan(plan.id),
      listarSalidasAcademicas(plan.id),
      obtenerResumenPlan(plan.id),
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

    if (!resultadoBloques?.ok) {
      throw new Error(
        resultadoBloques?.message ||
          "No fue posible consultar los bloques del plan.",
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

    asignaturasPlan = Array.isArray(resultadoAsignaturas.asignaturas)
      ? resultadoAsignaturas.asignaturas
      : [];
    requisitosPlan = Array.isArray(resultadoRequisitos.requisitos)
      ? resultadoRequisitos.requisitos
      : [];
    bloquesPlan = Array.isArray(resultadoBloques.bloques)
      ? resultadoBloques.bloques
      : [];
    salidasAcademicas = Array.isArray(resultadoSalidas.salidas)
      ? resultadoSalidas.salidas
      : [];
    resumenPlan = resultadoResumen.resumen || null;

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
  filtroBloquePlan = "";
  nivelPaginaPlan = 1;
  planSeleccionado = null;
  asignaturasPlan = [];
  filasRequisitosRapidos = [];
  requisitosPlan = [];
  bloquesPlan = [];
  salidasAcademicas = [];
  resumenPlan = null;

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
  return asignaturasPlan.filter((asignatura) => {
    if (!filtroBloquePlan) {
      return true;
    }

    if (filtroBloquePlan === "SIN_BLOQUE") {
      return asignatura.bloqueId === null || asignatura.bloqueId === undefined;
    }

    return Number(asignatura.bloqueId) === Number(filtroBloquePlan);
  });
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
      asignaturas: grupo.asignaturas.sort((a, b) => a.orden - b.orden),
    }))
    .sort((a, b) => a.nivel - b.nivel || a.ciclo - b.ciclo);
}

function obtenerBloqueAsignatura(asignatura) {
  if (asignatura.bloque) {
    return asignatura.bloque;
  }

  if (asignatura.bloqueId === null || asignatura.bloqueId === undefined) {
    return null;
  }

  return (
    bloquesPlan.find(
      (bloque) => Number(bloque.id) === Number(asignatura.bloqueId),
    ) || null
  );
}

function agruparAsignaturasPorBloque() {
  const gruposBloque = new Map();

  for (const asignatura of obtenerAsignaturasVisibles()) {
    const bloque = obtenerBloqueAsignatura(asignatura);
    const clave = bloque ? `BLOQUE-${bloque.id}` : "SIN_BLOQUE";

    if (!gruposBloque.has(clave)) {
      gruposBloque.set(clave, {
        bloque,
        asignaturas: [],
      });
    }

    gruposBloque.get(clave).asignaturas.push(asignatura);
  }

  return Array.from(gruposBloque.values()).sort((a, b) => {
    if (!a.bloque && b.bloque) {
      return 1;
    }

    if (a.bloque && !b.bloque) {
      return -1;
    }

    if (!a.bloque && !b.bloque) {
      return 0;
    }

    return Number(a.bloque.orden || 0) - Number(b.bloque.orden || 0);
  });
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
  const bloque = obtenerBloqueAsignatura(asignatura);
  const resumenHoras = obtenerResumenHoras(asignatura);

  return `
    <article
      class="plan-subject-card ${
        asignatura.activo ? "" : "plan-subject-inactive"
      }"
    >
      <div class="plan-subject-main">
        <div class="plan-subject-code">
          ${escapeHtml(datos.codigo || asignatura.tipo)}
        </div>

        <div class="plan-subject-description">
          <strong>${escapeHtml(datos.nombre)}</strong>

          ${
            bloque
              ? `
                  <small class="plan-subject-block">
                    ${escapeHtml(bloque.nombre)}
                  </small>
                `
              : `
                  <small class="plan-subject-block plan-subject-no-block">
                    Sin bloque
                  </small>
                `
          }

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
      </div>
    </article>
  `;
}

function renderizarCicloAcademico(nivel, ciclo, asignaturas = []) {
  const asignaturasOrdenadas = asignaturas
    .slice()
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
  const cantidad = asignaturasOrdenadas.length;
  const creditos = calcularCreditosAsignaturas(asignaturasOrdenadas);

  let bloqueInicial = "";
  if (filtroBloquePlan && filtroBloquePlan !== "SIN_BLOQUE") {
    bloqueInicial = String(filtroBloquePlan);
  }

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

                  <button
                    class="plan-cycle-add-button"
                    data-agregar-ciclo
                    data-nivel="${nivel}"
                    data-ciclo="${ciclo}"
                    data-bloque="${bloqueInicial}"
                    type="button"
                  >
                    <i data-lucide="plus" aria-hidden="true"></i>
                    Agregar asignatura
                  </button>
                </div>
              `
        }
      </div>
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
  const asignaturas = obtenerAsignaturasVisibles();
  nivelPaginaPlan = normalizarNivelPaginaPlan(nivelPaginaPlan);

  return `
    <div class="plan-level-list-page">
      <div class="plan-levels">
        ${renderizarNivelAcademico(nivelPaginaPlan, asignaturas)}
      </div>
      ${renderizarPaginacionNiveles()}
    </div>
  `;
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

  return `
    <article
      class="malla-card ${asignatura.activo ? "" : "malla-card-inactive"}"
      data-malla-asignatura="${asignatura.id}"
      tabindex="0"
      role="button"
      title="Ver requisitos de esta asignatura"
      aria-label="Ver requisitos de ${escapeHtml(datos.nombre)}"
    >
      <span class="malla-card-decoration" aria-hidden="true"></span>

      <div class="malla-card-top">
        <strong>${escapeHtml(datos.codigo || asignatura.tipo)}</strong>
        <span class="malla-card-credits">${creditos} cr.</span>
      </div>

      <div class="malla-card-name">${escapeHtml(datos.nombre)}</div>

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
      </div>

      <span class="malla-card-hover-line" aria-hidden="true"></span>
    </article>
  `;
}

function renderizarColumnasMalla(asignaturas) {
  return agruparAsignaturas(asignaturas)
    .map(
      (grupo) => `
        <section class="malla-column">
          <header class="malla-column-header">
            <span>NIVEL ${grupo.nivel}</span>
            <strong>Ciclo ${grupo.ciclo}</strong>
          </header>
          <div class="malla-column-body">
            ${grupo.asignaturas.map(renderizarTarjetaMalla).join("")}
          </div>
        </section>
      `,
    )
    .join("");
}

function renderizarMallaCurricular() {
  const gruposBloque = agruparAsignaturasPorBloque();

  if (gruposBloque.length === 0) {
    return `
      <div class="planes-message">
        No hay asignaturas para mostrar en esta malla.
      </div>
    `;
  }

  const secciones = gruposBloque
    .map(({ bloque, asignaturas }) => {
      const nombre = bloque ? bloque.nombre : "Asignaturas sin bloque";
      const tipo = bloque ? formatearTipoBloque(bloque.tipo) : "Sin clasificar";
      const creditos = asignaturas
        .filter((item) => item.activo)
        .reduce((total, item) => total + Number(item.creditos || 0), 0);

      return `
        <section
          class="malla-block-section ${bloque ? "" : "malla-block-unassigned"}"
        >
          <header class="malla-block-header">
            <div>
              <div class="malla-block-title-row">
                <h3>${escapeHtml(nombre)}</h3>
                ${
                  bloque?.codigo
                    ? `
                        <span class="malla-block-code">
                          ${escapeHtml(bloque.codigo)}
                        </span>
                      `
                    : ""
                }
              </div>

              <p>
                ${escapeHtml(tipo)} · ${asignaturas.length}
                asignatura${asignaturas.length === 1 ? "" : "s"} ·
                ${creditos} créditos
              </p>
            </div>

            ${
              bloque && !bloque.activo
                ? `
                    <span class="malla-block-inactive">
                      Bloque inactivo
                    </span>
                  `
                : ""
            }
          </header>

          <div class="malla-block-grid">
            ${renderizarColumnasMalla(asignaturas)}
          </div>
        </section>
      `;
    })
    .join("");

  return `
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

    <div id="mallaScroll" class="malla-scroll">
      <div id="mallaCanvas" class="malla-canvas">
        <svg
          id="mallaConnections"
          class="malla-connections"
          aria-hidden="true"
        ></svg>
        ${secciones}
      </div>
    </div>
  `;
}

function dibujarConexionesMalla() {
  const canvas = document.getElementById("mallaCanvas");
  const svg = document.getElementById("mallaConnections");

  if (!canvas || !svg) {
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const ancho = canvas.scrollWidth;
  const alto = canvas.scrollHeight;

  svg.setAttribute("width", String(ancho));
  svg.setAttribute("height", String(alto));
  svg.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);

  let contenido = `
    <defs>
      <marker
        id="mallaArrow"
        markerWidth="8"
        markerHeight="8"
        refX="7"
        refY="4"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path
          d="M 0 0 L 8 4 L 0 8 z"
          class="malla-arrow-head"
        ></path>
      </marker>
      <marker
        id="mallaArrowCoreq"
        markerWidth="8"
        markerHeight="8"
        refX="7"
        refY="4"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path
          d="M 0 0 L 8 4 L 0 8 z"
          class="malla-arrow-head-coreq"
        ></path>
      </marker>
    </defs>
  `;

  for (const relacion of requisitosPlan) {
    const origen = canvas.querySelector(
      `[data-malla-asignatura="${relacion.requisitoAsignaturaId}"]`,
    );
    const destino = canvas.querySelector(
      `[data-malla-asignatura="${relacion.asignaturaId}"]`,
    );

    if (!origen || !destino) {
      continue;
    }

    const rectOrigen = origen.getBoundingClientRect();
    const rectDestino = destino.getBoundingClientRect();
    const x1 = rectOrigen.right - canvasRect.left;
    const y1 = rectOrigen.top - canvasRect.top + rectOrigen.height / 2;
    const x2 = rectDestino.left - canvasRect.left;
    const y2 = rectDestino.top - canvasRect.top + rectDestino.height / 2;
    const distancia = Math.max(45, Math.abs(x2 - x1) * 0.45);
    const control1 = x2 >= x1 ? x1 + distancia : x1 - distancia;
    const control2 = x2 >= x1 ? x2 - distancia : x2 + distancia;
    const esCorrequisito = relacion.tipo === "CORREQUISITO";

    contenido += `
      <path
        d="M ${x1} ${y1} C ${control1} ${y1}, ${control2} ${y2}, ${x2} ${y2}"
        class="malla-connection ${
          esCorrequisito ? "malla-connection-coreq" : ""
        }"
        marker-end="url(#${esCorrequisito ? "mallaArrowCoreq" : "mallaArrow"})"
      ></path>
    `;
  }

  svg.innerHTML = contenido;
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
      <div class="plan-import-table-wrapper"><table class="plan-import-table"><thead><tr><th>Clave</th><th>Curso</th><th>Bloque</th><th>Nivel</th><th>Ciclo</th><th>Cr.</th></tr></thead><tbody>
        ${primeras
          .map(
            (fila) => `
              <tr>
                <td>${escapeHtml(fila.CLAVE || "")}</td>
                <td>${escapeHtml(fila.CODIGO_CURSO || fila.NOMBRE_REFERENCIA || "—")}</td>
                <td>${escapeHtml(fila.BLOQUE || "—")}</td>
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
  if (!planSeleccionado) return;
  const confirmado = await confirmarAccion({
    titulo: "Importar plan de estudio",
    mensaje:
      "Se crearán los bloques, asignaturas, requisitos y salidas académicas del archivo. La operación se guardará completa o se revertirá por completo.",
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
    const resultado = await ejecutarImportacionPlanCompleta(
      planSeleccionado.id,
      datos,
    );
    if (!resultado?.ok) {
      throw new Error(resultado?.message || "No fue posible importar el plan.");
    }
    mostrarImportacionCompletada(resultado.importacion);
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
          ${renderizarContadorImportacion("layers", resumen.bloques ?? 0, "Bloques")}
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

  const bloques = Array.isArray(datos?.bloques) ? datos.bloques : [];
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
          ${renderizarContadorImportacion("layers", bloques.length, "Bloques")}
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
    ASIGNATURA_SIN_BLOQUE: "Asignatura sin bloque",
    BLOQUE_VACIO: "Bloque vacío",
    HORAS_NO_COINCIDEN: "Horas inconsistentes",
    CURSO_DUPLICADO: "Curso duplicado",
    REQUISITO_POSTERIOR: "Requisito posterior",
    REQUISITO_INACTIVO: "Requisito inactivo",
    CICLO_REQUISITOS: "Ciclo de requisitos",
    SALIDA_SIN_ASIGNATURAS: "Salida académica vacía",
    CREDITOS_SALIDA_NO_COINCIDEN: "Créditos de salida",
  };

  return nombres[codigo] || codigo?.replaceAll("_", " ") || "Validación";
}

function renderizarItemRevision(item, tipo) {
  const esError = tipo === "ERROR";
  return `
    <article class="plan-review-item ${esError ? "is-error" : "is-warning"}">
      <div class="plan-review-item-icon"><i data-lucide="${esError ? "circle-x" : "triangle-alert"}"></i></div>
      <div class="plan-review-item-content">
        <strong>${escapeHtml(formatearCodigoValidacion(item.codigo))}</strong>
        <p>${escapeHtml(item.mensaje || "Inconsistencia detectada.")}</p>
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
    creditosTotales,
    vista: vistaDetallePlan,
    filtroBloque: filtroBloquePlan,
    bloques: bloquesPlan,
    contenidoVista,
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

  if (vistaDetallePlan === "MALLA") {
    window.requestAnimationFrame(() => {
      dibujarConexionesMalla();

      const canvas = document.getElementById("mallaCanvas");
      const scroll = document.getElementById("mallaScroll");

      if (canvas && typeof ResizeObserver !== "undefined") {
        observerMalla = new ResizeObserver(() => {
          dibujarConexionesMalla();
        });

        observerMalla.observe(canvas);

        if (scroll) {
          observerMalla.observe(scroll);
        }
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
          maxlength="150"
          placeholder="Programación I"
          required
        >
      </label>

      <label>
        <span>Créditos</span>
        <input
          type="number"
          class="carga-asignatura-creditos"
          min="0"
          max="30"
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
          max="999"
          value="${indice + 1}"
          required
        >
      </label>

      <label>
        <span>Tipo</span>
        <select class="carga-asignatura-tipo" required>
          <option value="OBLIGATORIA">Obligatoria</option>
          <option value="OPTATIVA">Optativa</option>
          <option value="OTRA">Otra</option>
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

function abrirCargaRapida() {
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

  const bloques = bloquesPlan
    .filter((bloque) => bloque.activo)
    .sort((a, b) => a.orden - b.orden);

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

      <label class="sgpa-form-wide">
        <span>Bloque</span>
        <select id="cargaAsignaturaBloque">
          <option value="">Sin bloque</option>
          ${bloques
            .map(
              (bloque) => `
                <option value="${bloque.id}">
                  ${escapeHtml(bloque.codigo)} - ${escapeHtml(bloque.nombre)}
                </option>
              `,
            )
            .join("")}
        </select>
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
      renderizarIconos();
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
  const bloqueValue =
    document.getElementById("cargaAsignaturaBloque")?.value || "";
  const bloqueId = bloqueValue ? Number(bloqueValue) : undefined;
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

  return filas.map((fila, index) => {
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

    if (!codigoReferencia) {
      throw new Error(`Fila ${index + 1}: debe indicar el código.`);
    }

    if (!nombreReferencia) {
      throw new Error(`Fila ${index + 1}: debe indicar el nombre.`);
    }

    if (codigosUtilizados.has(codigoReferencia)) {
      throw new Error(
        `Fila ${index + 1}: el código ${codigoReferencia} está repetido.`,
      );
    }

    codigosUtilizados.add(codigoReferencia);

    if (!Number.isInteger(creditos) || creditos < 0 || creditos > 30) {
      throw new Error(
        `Fila ${index + 1}: los créditos deben estar entre 0 y 30.`,
      );
    }

    if (!Number.isInteger(orden) || orden < 1 || orden > 999) {
      throw new Error(`Fila ${index + 1}: el orden debe estar entre 1 y 999.`);
    }

    const datos = {
      codigoReferencia,
      nombreReferencia,
      nivel,
      ciclo,
      orden,
      creditos,
      tipo,
    };

    if (bloqueId) {
      datos.bloqueId = bloqueId;
    }

    return datos;
  });
}

async function guardarCargaRapida() {
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
  const bloqueInicialId = editando
    ? asignatura.bloqueId
    : valoresIniciales.bloqueId;

  const asignaturasMismoCiclo = asignaturasPlan.filter(
    (item) =>
      Number(item.nivel) === nivelInicial &&
      Number(item.ciclo) === cicloInicial,
  );

  const ordenSugerido = asignaturasMismoCiclo.length
    ? Math.max(
        ...asignaturasMismoCiclo.map((item) => Number(item.orden || 0)),
      ) + 1
    : 1;
  const ordenInicial = editando
    ? Number(asignatura.orden || 1)
    : ordenSugerido;

  const opcionesBloques = bloquesPlan
    .filter(
      (bloque) =>
        bloque.activo === true ||
        Number(bloque.id) === Number(bloqueInicialId),
    )
    .sort((a, b) => Number(a.orden) - Number(b.orden))
    .map(
      (bloque) => `
        <option
          value="${bloque.id}"
          ${
            Number(bloqueInicialId) === Number(bloque.id)
              ? "selected"
              : ""
          }
        >
          ${escapeHtml(bloque.nombre)} · ${escapeHtml(
            formatearTipoBloque(bloque.tipo),
          )}${bloque.activo ? "" : " (Inactivo)"}
        </option>
      `,
    )
    .join("");

  const body = `
    <div class="sgpa-form-grid">
      <label class="sgpa-form-wide">
        <span>Bloque del plan</span>
        <select id="asignaturaBloque">
          <option
            value=""
            ${
              bloqueInicialId === null ||
              bloqueInicialId === undefined ||
              bloqueInicialId === ""
                ? "selected"
                : ""
            }
          >
            Sin bloque
          </option>
          ${opcionesBloques}
        </select>
        ${
          bloquesPlan.length === 0
            ? `
                <small class="sgpa-field-help">
                  Este plan todavía no tiene bloques. Puede dejar la asignatura
                  sin bloque y organizarla después.
                </small>
              `
            : ""
        }
      </label>

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
            maxlength="150"
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
          min="0"
          max="30"
          value="${asignatura?.creditos ?? 0}"
          required
        >
      </label>

      <label>
        <span>Orden</span>
        <input
          id="asignaturaOrden"
          type="number"
          min="1"
          max="999"
          value="${ordenInicial}"
          required
        >
      </label>

      <label class="sgpa-form-wide">
        <span>Tipo</span>
        <select id="asignaturaTipo" required>
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
    submitText: editando ? "Guardar cambios" : "Agregar asignatura",
    submitIcon: "save",
    layout: "custom",
    formClass: "asignatura-plan-form",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

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

  const datos = {
    codigoReferencia,
    nombreReferencia,
    nivel: Number(document.getElementById("asignaturaNivel")?.value),
    ciclo: Number(document.getElementById("asignaturaCiclo")?.value),
    creditos: Number(document.getElementById("asignaturaCreditos")?.value),
    orden: Number(document.getElementById("asignaturaOrden")?.value),
    tipo: document.getElementById("asignaturaTipo")?.value,
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

  const bloqueValue = document.getElementById("asignaturaBloque")?.value || "";
  if (bloqueValue) {
    datos.bloqueId = Number(bloqueValue);
  } else if (asignatura) {
    datos.bloqueId = null;
  }

  button.disabled = true;
  errorBox.classList.add("hidden");

  try {
    const resultado = editando
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
    await recargarAsignaturasPlan();

    mostrarExito({
      titulo: editando ? "Asignatura actualizada" : "Asignatura agregada",
      mensaje: editando
        ? `"${nombreReferencia}" se actualizó correctamente.`
        : `"${nombreReferencia}" se agregó correctamente al Nivel ${datos.nivel}, Ciclo ${datos.ciclo}.`,
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
  await recargarResumenPlan();
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
    const resultado = await cambiarEstadoPlanAsignatura(
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

    await recargarAsignaturasPlan();
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

      const cardMalla = target.closest("[data-malla-asignatura]");
      if (cardMalla && contenedor.contains(cardMalla)) {
        event.preventDefault();
        const asignatura = obtenerAsignaturaPorId(
          cardMalla.dataset.mallaAsignatura,
        );
        if (asignatura) {
          abrirFormularioRequisitos(asignatura);
        }
        return;
      }

      const agregarCiclo = target.closest("[data-agregar-ciclo]");
      if (agregarCiclo && contenedor.contains(agregarCiclo)) {
        event.preventDefault();
        const nivel = Number(agregarCiclo.dataset.nivel);
        const ciclo = Number(agregarCiclo.dataset.ciclo);
        const bloqueValue = agregarCiclo.dataset.bloque || "";
        const bloqueId = bloqueValue ? Number(bloqueValue) : undefined;
        abrirFormularioAsignatura(null, { nivel, ciclo, bloqueId });
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
        case "administrarBloquesButton":
          abrirAdministradorBloques();
          break;
        case "salidasAcademicasButton":
          abrirAdministradorSalidas();
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
    "change",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }

      if (target.id === "filtroBloquePlan") {
        filtroBloquePlan = target.value;
        renderizarDetallePlan();
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
      const cardMalla = target?.closest("[data-malla-asignatura]");
      if (!cardMalla || !contenedor.contains(cardMalla)) {
        return;
      }

      event.preventDefault();
      const asignatura = obtenerAsignaturaPorId(
        cardMalla.dataset.mallaAsignatura,
      );
      if (asignatura) {
        abrirFormularioRequisitos(asignatura);
      }
    },
    { signal },
  );
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

function abrirFormularioRequisitos(asignatura) {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");

  if (!dialog || !content || !planSeleccionado || !asignatura) {
    return;
  }

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

              <button
                class="plan-requirement-delete"
                data-eliminar-requisito="${relacion.id}"
                type="button"
                aria-label="Quitar ${escapeHtml(datos.nombre)}"
              >
                <i data-lucide="trash-2" aria-hidden="true"></i>
                <span>Quitar</span>
              </button>
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
                    <span>Agregar</span>
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

  document
    .getElementById("requisitoForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!candidatas.length) {
        return;
      }
      await agregarRequisitoFrontend(asignatura);
    });

  document.querySelectorAll("[data-eliminar-requisito]").forEach((button) => {
    button.addEventListener("click", async () => {
      await eliminarRequisitoFrontend(
        Number(button.dataset.eliminarRequisito),
        asignatura,
      );
    });
  });
}

async function agregarRequisitoFrontend(asignatura) {
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
    const resultado = await crearPlanRequisito(planSeleccionado.id, {
      asignaturaId: asignatura.id,
      requisitoAsignaturaId,
      tipo,
    });

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible registrar el requisito.",
      );
    }

    await recargarRequisitosPlan();
    const actualizada = obtenerAsignaturaPorId(asignatura.id) || asignatura;
    abrirFormularioRequisitos(actualizada);
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
    const resultado = await eliminarPlanRequisito(
      planSeleccionado.id,
      relacionId,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible quitar la relación.",
      );
    }

    await recargarRequisitosPlan();
    const actualizada = obtenerAsignaturaPorId(asignatura.id) || asignatura;
    abrirFormularioRequisitos(actualizada);
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

async function recargarRequisitosPlan() {
  if (!planSeleccionado) {
    return;
  }

  const resultado = await listarPlanRequisitos(planSeleccionado.id);

  if (!resultado?.ok) {
    throw new Error(
      resultado?.message || "No fue posible actualizar los requisitos.",
    );
  }

  requisitosPlan = Array.isArray(resultado.requisitos)
    ? resultado.requisitos
    : [];
  await recargarResumenPlan();
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
  if (!resumenPlan) return;
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");
  if (!dialog || !content) return;
  const horas = resumenPlan.horas || {};
  const ciclos = Array.isArray(resumenPlan.ciclos) ? resumenPlan.ciclos : [];
  const bloques = Array.isArray(resumenPlan.bloques?.detalle)
    ? resumenPlan.bloques.detalle
    : [];
  const lista = (items, render, vacio) =>
    items.length
      ? items.map(render).join("")
      : `<div class="plan-requirements-empty">${vacio}</div>`;
  content.innerHTML = `
    <div class="plan-form plan-summary-detail">
      <header class="plan-dialog-header"><div><h3>Resumen del plan</h3><p>${escapeHtml(planSeleccionado.nombre)}</p></div><button id="cerrarResumenPlan" class="planes-icon-button" type="button"><i data-lucide="x"></i></button></header>
      <div class="plan-summary-detail-content">
        <section class="plan-summary-detail-section"><h4>Horas académicas</h4><div class="plan-summary-hours">${renderizarDatoResumen("Teoría", horas.teoria)}${renderizarDatoResumen("Práctica", horas.practica)}${renderizarDatoResumen("Laboratorio", horas.laboratorio)}${renderizarDatoResumen("Gira", horas.gira)}${renderizarDatoResumen("Estudio independiente", horas.estudioIndependiente)}${renderizarDatoResumen("Horas totales", horas.totales)}${renderizarDatoResumen("Horas docente", horas.docente)}</div></section>
        <section class="plan-summary-detail-section"><h4>Créditos por ciclo</h4><div class="plan-summary-cycle-list">${lista(ciclos, (grupo) => `<div class="plan-summary-cycle"><div><strong>Nivel ${grupo.nivel} · Ciclo ${grupo.ciclo}</strong><small>${grupo.cantidadAsignaturas} asignaturas</small></div><span>${grupo.creditos} cr.</span></div>`, "No hay ciclos registrados.")}</div></section>
        <section class="plan-summary-detail-section"><h4>Bloques</h4><div class="plan-summary-cycle-list">${lista(bloques, (bloque) => `<div class="plan-summary-cycle"><div><strong>${escapeHtml(bloque.nombre)}</strong><small>${bloque.cantidadAsignaturas} asignaturas</small></div><span>${bloque.creditos} cr.</span></div>`, "No hay bloques registrados.")}</div></section>
      </div>
      <footer class="plan-dialog-footer"><button id="cerrarResumenPlanFooter" class="planes-secondary-button" type="button">Cerrar</button></footer>
    </div>`;
  renderizarIconos();
  if (!dialog.open) dialog.showModal();
  const cerrar = () => dialog.close();
  document
    .getElementById("cerrarResumenPlan")
    ?.addEventListener("click", cerrar);
  document
    .getElementById("cerrarResumenPlanFooter")
    ?.addEventListener("click", cerrar);
}

function formatearTipoSalida(tipo) {
  const tipos = {
    DIPLOMADO: "Diplomado",
    BACHILLERATO: "Bachillerato",
    LICENCIATURA: "Licenciatura",
    CERTIFICADO: "Certificado",
    OTRO: "Otro",
  };

  return tipos[tipo] || tipo;
}

function abrirAdministradorSalidas() {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");

  if (!dialog || !content || !planSeleccionado) {
    return;
  }

  const salidasHtml = salidasAcademicas.length
    ? salidasAcademicas
        .slice()
        .sort((a, b) => Number(a.orden) - Number(b.orden))
        .map((salida) => {
          const asignaturas = Array.isArray(salida.asignaturas)
            ? salida.asignaturas
            : [];
          const cantidad = asignaturas.length;
          const creditos = asignaturas
            .filter((item) => item.activo)
            .reduce((total, item) => total + Number(item.creditos || 0), 0);
          const porcentaje = salida.creditosRequeridos
            ? Math.min(100, (creditos / salida.creditosRequeridos) * 100)
            : 0;

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

                <div class="salida-academica-progress">
                  <div class="salida-academica-progress-bar">
                    <span style="width: ${porcentaje}%;"></span>
                  </div>
                  <small>
                    ${creditos} / ${salida.creditosRequeridos} créditos asociados
                  </small>
                </div>
              </div>

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
          <small>Administre títulos, certificaciones y salidas académicas.</small>
        </div>

        <button id="nuevaSalidaButton" class="sgpa-form-primary" type="button">
          <i data-lucide="plus" aria-hidden="true"></i>
          <span>Nueva salida</span>
        </button>
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
  document
    .getElementById("nuevaSalidaButton")
    ?.addEventListener("click", () => abrirFormularioSalida());

  document.querySelectorAll("[data-salida-editar]").forEach((button) => {
    button.addEventListener("click", () => {
      const salida = salidasAcademicas.find(
        (item) => Number(item.id) === Number(button.dataset.salidaEditar),
      );
      if (salida) {
        abrirFormularioSalida(salida);
      }
    });
  });

  document.querySelectorAll("[data-salida-asignaturas]").forEach((button) => {
    button.addEventListener("click", () => {
      const salida = salidasAcademicas.find(
        (item) => Number(item.id) === Number(button.dataset.salidaAsignaturas),
      );
      if (salida) {
        abrirAsignaturasSalida(salida);
      }
    });
  });

  document.querySelectorAll("[data-salida-estado]").forEach((button) => {
    button.addEventListener("click", async () => {
      const salida = salidasAcademicas.find(
        (item) => Number(item.id) === Number(button.dataset.salidaEstado),
      );
      if (salida) {
        await alternarEstadoSalida(salida);
      }
    });
  });
}

function abrirFormularioSalida(salida = null) {
  const content = document.getElementById("asignaturaDialogContent");

  if (!content || !planSeleccionado) {
    return;
  }

  const editando = Boolean(salida);
  const opcionesTipo = [
    ["DIPLOMADO", "Diplomado"],
    ["BACHILLERATO", "Bachillerato"],
    ["LICENCIATURA", "Licenciatura"],
    ["CERTIFICADO", "Certificado"],
    ["OTRO", "Otro"],
  ];

  const body = `
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
        placeholder="Ej. Diplomado"
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
                ${(salida?.tipo || "BACHILLERATO") === valor ? "selected" : ""}
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
    submitText: editando ? "Guardar cambios" : "Crear salida",
    submitIcon: "save",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  document
    .getElementById("volverSalidasButton")
    ?.addEventListener("click", abrirAdministradorSalidas);
  document
    .getElementById("salidaAcademicaForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await guardarSalidaAcademicaFrontend(salida);
    });
}

async function guardarSalidaAcademicaFrontend(salida) {
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
    const resultado = salida
      ? await actualizarSalidaAcademica(planSeleccionado.id, salida.id, datos)
      : await crearSalidaAcademica(planSeleccionado.id, datos);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible guardar la salida académica.",
      );
    }

    await recargarSalidasAcademicas();
    abrirAdministradorSalidas();
  } catch (error) {
    errorBox.textContent =
      error?.message || "No fue posible guardar la salida académica.";
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
}

async function recargarSalidasAcademicas() {
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
  renderizarDetallePlan();
}

function abrirAsignaturasSalida(salida) {
  const content = document.getElementById("asignaturaDialogContent");

  if (!content) {
    return;
  }

  const idsSeleccionados = new Set(
    (salida.asignaturas || []).map((item) => Number(item.id)),
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
    <div class="salida-asignaturas-summary">
      <strong id="salidaAsignaturasCantidad"></strong>
      <span id="salidaAsignaturasCreditos"></span>
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
    description:
      "Seleccione las asignaturas que forman parte de esta salida académica.",
    body,
    errorId: "salidaAsignaturasError",
    cancelButtonId: "volverAsignaturasSalida",
    cancelText: "Volver",
    submitButtonId: "guardarAsignaturasSalida",
    submitText: "Guardar selección",
    submitButtonType: "button",
    submitIcon: "save",
    layout: "custom",
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

    const cantidad = document.getElementById("salidaAsignaturasCantidad");
    const creditosText = document.getElementById("salidaAsignaturasCreditos");

    if (cantidad) {
      cantidad.textContent = `${seleccionadas.length} asignaturas`;
    }
    if (creditosText) {
      creditosText.textContent = `${creditos} / ${salida.creditosRequeridos} créditos`;
    }
  };

  document.querySelectorAll("[data-salida-asignatura]").forEach((input) => {
    input.addEventListener("change", actualizarResumen);
  });
  actualizarResumen();

  document
    .getElementById("volverAsignaturasSalida")
    ?.addEventListener("click", abrirAdministradorSalidas);
  document
    .getElementById("guardarAsignaturasSalida")
    ?.addEventListener("click", async () => {
      await guardarAsignaturasSalidaFrontend(salida);
    });
}

async function guardarAsignaturasSalidaFrontend(salida) {
  const errorBox = document.getElementById("salidaAsignaturasError");
  const button = document.getElementById("guardarAsignaturasSalida");

  if (!errorBox || !button || !planSeleccionado) {
    return;
  }

  const asignaturaIds = Array.from(
    document.querySelectorAll("[data-salida-asignatura]:checked"),
  ).map((input) => Number(input.value));

  button.disabled = true;
  errorBox.textContent = "";
  errorBox.classList.add("hidden");

  try {
    const resultado = await reemplazarAsignaturasSalida(
      planSeleccionado.id,
      salida.id,
      asignaturaIds,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message ||
          "No fue posible guardar las asignaturas de la salida.",
      );
    }

    await recargarSalidasAcademicas();
    abrirAdministradorSalidas();
  } catch (error) {
    errorBox.textContent =
      error?.message || "No fue posible guardar la selección.";
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
}

async function alternarEstadoSalida(salida) {
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
    const resultado = await cambiarEstadoSalidaAcademica(
      planSeleccionado.id,
      salida.id,
      nuevoEstado,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible cambiar el estado.",
      );
    }

    await recargarSalidasAcademicas();
    abrirAdministradorSalidas();
  } catch (error) {
    mostrarFeedbackDetalle(
      error?.message || "No fue posible cambiar el estado de la salida.",
    );
  }
}

function formatearTipoBloque(tipo) {
  const nombres = {
    TRONCO_COMUN: "Tronco común",
    ENFASIS: "Énfasis",
    SALIDA_LATERAL: "Salida lateral",
    GRADO: "Grado",
    OTRO: "Otro",
  };

  return nombres[tipo] || tipo;
}

function abrirAdministradorBloques() {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");

  if (!dialog || !content || !planSeleccionado) {
    return;
  }

  const bloquesHtml = bloquesPlan.length
    ? bloquesPlan
        .map(
          (bloque) => `
            <article class="bloque-plan-row ${
              bloque.activo ? "" : "bloque-plan-inactive"
            }">
              <div class="bloque-plan-info">
                <div>
                  <strong>${escapeHtml(bloque.nombre)}</strong>
                  <span>${escapeHtml(bloque.codigo)}</span>
                </div>
                <small>
                  ${escapeHtml(formatearTipoBloque(bloque.tipo))} · Orden ${
                    bloque.orden
                  }
                </small>
              </div>

              <div class="bloque-plan-actions">
                <button
                  class="planes-icon-button"
                  data-bloque-editar="${bloque.id}"
                  type="button"
                  title="Editar bloque"
                  aria-label="Editar ${escapeHtml(bloque.nombre)}"
                >
                  <i data-lucide="pencil" aria-hidden="true"></i>
                </button>

                <button
                  class="planes-icon-button"
                  data-bloque-estado="${bloque.id}"
                  type="button"
                  title="${bloque.activo ? "Desactivar" : "Activar"}"
                  aria-label="${bloque.activo ? "Desactivar" : "Activar"} ${escapeHtml(
                    bloque.nombre,
                  )}"
                >
                  <i
                    data-lucide="${
                      bloque.activo ? "circle-pause" : "circle-check"
                    }"
                    aria-hidden="true"
                  ></i>
                </button>
              </div>
            </article>
          `,
        )
        .join("")
    : `
        <div class="plan-requirements-empty">
          Este plan todavía no tiene bloques.
        </div>
      `;

  const body = `
    <div class="bloques-plan-content">
      <div class="sgpa-form-tool-toolbar">
        <div>
          <strong>Estructura curricular</strong>
          <small>Organice las asignaturas por bloques académicos.</small>
        </div>

        <button id="nuevoBloqueButton" class="sgpa-form-primary" type="button">
          <i data-lucide="plus" aria-hidden="true"></i>
          <span>Nuevo bloque</span>
        </button>
      </div>

      <div class="bloques-plan-list">${bloquesHtml}</div>
    </div>
  `;

  content.innerHTML = FormDialog({
    formId: "bloquesAdminForm",
    title: "Bloques del plan",
    description: planSeleccionado.nombre,
    body,
    errorId: "bloquesPlanError",
    cancelButtonId: "cerrarBloquesFooter",
    cancelText: "Cerrar",
    layout: "custom",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  document
    .getElementById("cerrarBloquesFooter")
    ?.addEventListener("click", () => dialog.close());
  document
    .getElementById("nuevoBloqueButton")
    ?.addEventListener("click", () => abrirFormularioBloque());

  document.querySelectorAll("[data-bloque-editar]").forEach((button) => {
    button.addEventListener("click", () => {
      const bloque = bloquesPlan.find(
        (item) => Number(item.id) === Number(button.dataset.bloqueEditar),
      );
      if (bloque) {
        abrirFormularioBloque(bloque);
      }
    });
  });

  document.querySelectorAll("[data-bloque-estado]").forEach((button) => {
    button.addEventListener("click", async () => {
      const bloque = bloquesPlan.find(
        (item) => Number(item.id) === Number(button.dataset.bloqueEstado),
      );
      if (bloque) {
        await alternarEstadoBloque(bloque);
      }
    });
  });
}

function abrirFormularioBloque(bloque = null) {
  const content = document.getElementById("asignaturaDialogContent");

  if (!content || !planSeleccionado) {
    return;
  }

  const editando = Boolean(bloque);
  const tipos = [
    ["TRONCO_COMUN", "Tronco común"],
    ["ENFASIS", "Énfasis"],
    ["SALIDA_LATERAL", "Salida lateral"],
    ["GRADO", "Grado"],
    ["OTRO", "Otro"],
  ];

  const body = `
    <label>
      <span>Código</span>
      <input
        id="bloqueCodigo"
        maxlength="30"
        value="${escapeHtml(bloque?.codigo || "")}"
        placeholder="Ej. TC"
        required
      >
    </label>

    <label>
      <span>Orden</span>
      <input
        id="bloqueOrden"
        type="number"
        min="1"
        max="999"
        value="${bloque?.orden || bloquesPlan.length + 1}"
        required
      >
    </label>

    <label class="sgpa-form-wide">
      <span>Nombre</span>
      <input
        id="bloqueNombre"
        maxlength="150"
        value="${escapeHtml(bloque?.nombre || "")}"
        placeholder="Ej. Tronco común"
        required
      >
    </label>

    <label class="sgpa-form-wide">
      <span>Tipo</span>
      <select id="bloqueTipo" required>
        ${tipos
          .map(
            ([valor, texto]) => `
              <option
                value="${valor}"
                ${(bloque?.tipo || "TRONCO_COMUN") === valor ? "selected" : ""}
              >
                ${texto}
              </option>
            `,
          )
          .join("")}
      </select>
    </label>

    <label class="sgpa-form-wide">
      <span>Descripción</span>
      <textarea
        id="bloqueDescripcion"
        maxlength="500"
        rows="3"
        placeholder="Descripción opcional"
      >${escapeHtml(bloque?.descripcion || "")}</textarea>
    </label>
  `;

  content.innerHTML = FormDialog({
    formId: "bloquePlanForm",
    title: editando ? "Editar bloque" : "Nuevo bloque",
    description: planSeleccionado.nombre,
    body,
    errorId: "bloqueFormError",
    cancelButtonId: "volverBloquesButton",
    cancelText: "Volver",
    submitButtonId: "guardarBloqueButton",
    submitText: editando ? "Guardar cambios" : "Crear bloque",
    submitIcon: "save",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  document
    .getElementById("volverBloquesButton")
    ?.addEventListener("click", abrirAdministradorBloques);
  document
    .getElementById("bloquePlanForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await guardarBloque(bloque);
    });
}

async function guardarBloque(bloque) {
  const errorBox = document.getElementById("bloqueFormError");
  const button = document.getElementById("guardarBloqueButton");

  if (!errorBox || !button || !planSeleccionado) {
    return;
  }

  const datos = {
    codigo: document.getElementById("bloqueCodigo")?.value.trim() || "",
    nombre: document.getElementById("bloqueNombre")?.value.trim() || "",
    tipo: document.getElementById("bloqueTipo")?.value,
    orden: Number(document.getElementById("bloqueOrden")?.value),
    descripcion:
      document.getElementById("bloqueDescripcion")?.value.trim() || "",
  };

  if (!datos.codigo || !datos.nombre) {
    errorBox.textContent = "Código y nombre son obligatorios.";
    errorBox.classList.remove("hidden");
    return;
  }

  button.disabled = true;
  errorBox.classList.add("hidden");

  try {
    const resultado = bloque
      ? await actualizarBloquePlan(planSeleccionado.id, bloque.id, datos)
      : await crearBloquePlan(planSeleccionado.id, datos);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible guardar el bloque.",
      );
    }

    await recargarBloquesPlan();
    abrirAdministradorBloques();
  } catch (error) {
    errorBox.textContent =
      error?.message || "No fue posible guardar el bloque.";
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
}

async function recargarBloquesPlan() {
  if (!planSeleccionado) {
    return;
  }

  const resultado = await listarBloquesPlan(planSeleccionado.id);

  if (!resultado?.ok) {
    throw new Error(
      resultado?.message || "No fue posible actualizar los bloques.",
    );
  }

  bloquesPlan = Array.isArray(resultado.bloques) ? resultado.bloques : [];

  if (
    filtroBloquePlan &&
    filtroBloquePlan !== "SIN_BLOQUE" &&
    !bloquesPlan.some(
      (bloque) =>
        bloque.activo && String(bloque.id) === String(filtroBloquePlan),
    )
  ) {
    filtroBloquePlan = "";
  }

  await recargarResumenPlan();
  renderizarDetallePlan();
}

async function alternarEstadoBloque(bloque) {
  if (!planSeleccionado) {
    return;
  }

  const nuevoEstado = !bloque.activo;
  const confirmado = await confirmarAccion({
    titulo: nuevoEstado ? "Activar bloque" : "Desactivar bloque",
    mensaje: `¿Desea ${nuevoEstado ? "activar" : "desactivar"} "${
      bloque.nombre
    }"?`,
    textoConfirmar: nuevoEstado ? "Activar" : "Desactivar",
    peligro: !nuevoEstado,
  });

  if (!confirmado) {
    return;
  }

  try {
    const resultado = await cambiarEstadoBloquePlan(
      planSeleccionado.id,
      bloque.id,
      nuevoEstado,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible cambiar el estado del bloque.",
      );
    }

    await recargarBloquesPlan();
    abrirAdministradorBloques();
  } catch (error) {
    const errorBox = document.getElementById("bloquesPlanError");

    if (errorBox) {
      errorBox.textContent =
        error?.message || "No fue posible cambiar el estado del bloque.";
      errorBox.classList.remove("hidden");
    } else {
      mostrarFeedbackDetalle(
        error?.message || "No fue posible cambiar el estado del bloque.",
      );
    }
  }
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

  document.getElementById("nuevoPlanButton")?.addEventListener("click", () => {
    abrirFormulario();
  });

  document
    .getElementById("planesBuscar")
    ?.addEventListener("input", renderizarPlanes);
  document
    .getElementById("planesEstado")
    ?.addEventListener("change", renderizarPlanes);
  document
    .getElementById("planesCarrera")
    ?.addEventListener("change", renderizarPlanes);

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
      }
    });

  void cargarDatos(instancia);
}
