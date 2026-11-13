/**
 * SGPA — Vista de Detalle de un Plan de Estudio (navegación Lista/Malla, filtros y eventos).
 */

import {
  listarPlanAsignaturas,
} from "../../services/plan-asignaturas.service.js";
import {
  listarPlanRequisitos,
} from "../../services/plan-requisitos.service.js";
import {
  listarSalidasAcademicas,
} from "../../services/salidas-academicas.service.js";
import {
  obtenerResumenPlan,
} from "../../services/plan-resumen.service.js";
import {
  obtenerReglaOptativasPlan,
} from "../../services/plan-reglas-optativas.service.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import { VerPlanPage } from "./VerPlanPage.js";
import {
  calcularCreditosAsignaturas,
  normalizarNivelPaginaPlan,
  obtenerDatosAsignatura,
  obtenerNombreAnioNivel,
  obtenerNombreCiclo,
  obtenerPresentacionTipoAsignatura,
  obtenerRequisitosDeAsignatura,
  obtenerResumenHoras,
  puedeGestionarPlanes,
  separarAsignaturasPlan,
} from "./planes.helpers.js";
import {
  actualizarEstadoVisualMalla,
  dibujarConexionesMalla,
  mostrarTarjetaMallaCompleta,
  programarDibujoMalla,
  renderizarMallaCurricular,
} from "./PlanMallaCurricularView.js";
import {
  renderizarHitosSalidaLista,
  renderizarSalidasMalla,
} from "./PlanSalidasDialog.js";

export function mostrarFeedbackDetalle(mensaje) {
  const feedback = document.getElementById("planDetalleFeedback");

  if (!feedback) {
    return;
  }

  feedback.textContent = mensaje;
  feedback.className = "planes-feedback planes-feedback-error";
}

export function renderizarAsignaturaLista(asignatura, contexto) {
  const datos = obtenerDatosAsignatura(asignatura);
  const creditos = Number(asignatura.creditos || 0);
  const requisitos = obtenerRequisitosDeAsignatura(
    asignatura.id,
    contexto.estado.requisitosPlan,
  );
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
                <div class="plan-subject-hours">
                  <span>${escapeHtml(resumenHoras)}</span>
                </div>
              `
              : ""
          }

          ${
            asignatura.observacionHoras
              ? `
                <div class="plan-subject-hours-note">
                  <span>Nota de horas:</span>
                  ${escapeHtml(asignatura.observacionHoras)}
                </div>
              `
              : ""
          }

          <div class="plan-subject-requirements">
            ${
              requisitos.length
                ? requisitos
                    .map((relacion) => {
                      const requisito =
                        contexto.estado.asignaturasPlan.find(
                          (item) =>
                            Number(item.id) ===
                            Number(relacion.requisitoAsignaturaId),
                        ) || relacion.requisitoAsignatura;
                      const datosRequisito = requisito
                        ? obtenerDatosAsignatura(requisito)
                        : {
                            codigo: "",
                            nombre: "Asignatura no disponible",
                          };
                      const esCorrequisito = relacion.tipo === "CORREQUISITO";

                      return `
                        <span
                          class="plan-requirement-badge ${
                            esCorrequisito ? "is-corequisite" : ""
                          }"
                          title="${
                            esCorrequisito
                              ? "Correquisito (se cursa en paralelo)"
                              : "Requisito previo"
                          }"
                        >
                          <i
                            data-lucide="${
                              esCorrequisito ? "git-fork" : "arrow-left"
                            }"
                            aria-hidden="true"
                          ></i>
                          ${
                            datosRequisito.codigo
                              ? `${escapeHtml(datosRequisito.codigo)} · `
                              : ""
                          }${escapeHtml(datosRequisito.nombre)}
                        </span>
                      `;
                    })
                    .join("")
                : `<span class="plan-requirements-none">Sin requisitos</span>`
            }
          </div>
        </div>
      </div>

      <div class="plan-subject-side">
        <div class="plan-subject-credits">
          <strong>${creditos}</strong>
          <span>créditos</span>
        </div>

        <div class="plan-subject-actions">
          <button
            class="planes-icon-button"
            data-asignatura-action="requisitos"
            data-id="${asignatura.id}"
            type="button"
            title="Requisitos"
            aria-label="Requisitos de ${escapeHtml(datos.nombre)}"
          >
            <i data-lucide="git-branch" aria-hidden="true"></i>
          </button>

          ${
            puedeGestionarPlanes(true)
              ? `
                <button
                  class="planes-icon-button"
                  data-asignatura-action="editar"
                  data-id="${asignatura.id}"
                  type="button"
                  title="Editar asignatura"
                  aria-label="Editar ${escapeHtml(datos.nombre)}"
                >
                  <i data-lucide="pencil" aria-hidden="true"></i>
                </button>

                <button
                  class="planes-icon-button ${
                    asignatura.activo
                      ? "planes-danger-button"
                      : "planes-success-button"
                  }"
                  data-asignatura-action="estado"
                  data-id="${asignatura.id}"
                  type="button"
                  title="${
                    asignatura.activo
                      ? "Desactivar asignatura"
                      : "Activar asignatura"
                  }"
                  aria-label="${
                    asignatura.activo
                      ? "Desactivar "
                      : "Activar "
                  }${escapeHtml(datos.nombre)}"
                >
                  <i
                    data-lucide="${
                      asignatura.activo ? "circle-pause" : "circle-check"
                    }"
                    aria-hidden="true"
                  ></i>
                </button>
              `
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

export function renderizarCicloAcademico(nivel, ciclo, asignaturas, contexto) {
  const cantidad = asignaturas.length;
  const creditos = calcularCreditosAsignaturas(asignaturas);
  const puedeGestionar = puedeGestionarPlanes(true);

  return `
    <section class="plan-cycle">
      <header class="plan-cycle-header">
        <div>
          <h4>${obtenerNombreCiclo(ciclo)}</h4>
          <span class="plan-cycle-subtitle">Ciclo académico</span>
        </div>

        <div class="plan-cycle-summary">
          <span>${cantidad} materia${cantidad === 1 ? "" : "s"}</span>
          <span class="plan-cycle-summary-divider" aria-hidden="true"></span>
          <strong>${creditos} créditos</strong>

          ${
            puedeGestionar
              ? `
                <button
                  class="plan-cycle-add-button"
                  data-agregar-ciclo
                  data-nivel="${nivel}"
                  data-ciclo="${ciclo}"
                  type="button"
                  title="Agregar asignatura al ${obtenerNombreCiclo(ciclo)}"
                >
                  <i data-lucide="plus" aria-hidden="true"></i>
                  <span>Agregar</span>
                </button>
              `
              : ""
          }
        </div>
      </header>

      <div class="plan-cycle-subjects">
        ${
          asignaturas.length
            ? asignaturas
                .slice()
                .sort((a, b) => Number(a.orden) - Number(b.orden))
                .map((asignatura) =>
                  renderizarAsignaturaLista(asignatura, contexto),
                )
                .join("")
            : `
              <div class="plan-cycle-empty">
                No hay asignaturas registradas para este ciclo.
              </div>
            `
        }
      </div>

      ${renderizarHitosSalidaLista(nivel, ciclo, contexto)}
    </section>
  `;
}

export function renderizarNivelAcademico(nivel, asignaturas, contexto) {
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
        ${renderizarCicloAcademico(nivel, 1, cicloUno, contexto)}
        ${renderizarCicloAcademico(nivel, 2, cicloDos, contexto)}
      </div>
    </section>
  `;
}

export function renderizarPaginacionNiveles(contexto) {
  const niveles = [1, 2, 3, 4];
  const nivelActual = contexto.estado.nivelPaginaPlan;
  const anterior = nivelActual - 1;
  const siguiente = nivelActual + 1;

  return `
    <nav class="plan-level-pagination" aria-label="Navegación por año académico">
      <div class="plan-level-pagination-info">
        <span>Año académico</span>
        <strong>${obtenerNombreAnioNivel(nivelActual)}</strong>
      </div>

      <div class="plan-level-pagination-controls">
        <button
          class="plan-level-nav-button"
          data-plan-level-page="${anterior}"
          type="button"
          ${nivelActual === 1 ? "disabled" : ""}
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
                    nivel === nivelActual ? "is-active" : ""
                  }"
                  data-plan-level-page="${nivel}"
                  type="button"
                  aria-label="${obtenerNombreAnioNivel(nivel)}"
                  aria-current="${nivel === nivelActual ? "page" : "false"}"
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
          ${nivelActual === 4 ? "disabled" : ""}
          aria-label="Año siguiente"
        >
          <span>Siguiente</span>
          <i data-lucide="chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    </nav>
  `;
}

export function renderizarListaAsignaturas(contexto) {
  const { activas, papelera } = separarAsignaturasPlan(
    contexto.estado.asignaturasPlan,
  );
  contexto.estado.nivelPaginaPlan = normalizarNivelPaginaPlan(
    contexto.estado.nivelPaginaPlan,
  );

  return `
    <div class="plan-level-list-page">
      <button id="togglePapeleraPlanButton" class="sgpa-form-secondary" type="button"
        aria-pressed="${contexto.estado.vistaPapeleraPlan}">
        ${
          contexto.estado.vistaPapeleraPlan
            ? "Volver a asignaturas activas"
            : `Papelera (${papelera.length})`
        }
      </button>
      ${
        contexto.estado.vistaPapeleraPlan
          ? `<div class="plan-levels">
            ${
              papelera.length
                ? papelera
                    .slice()
                    .sort(
                      (a, b) =>
                        Number(a.nivel) - Number(b.nivel) ||
                        Number(a.ciclo) - Number(b.ciclo) ||
                        Number(a.orden) - Number(b.orden),
                    )
                    .map(
                      (asignatura) => `
                    <section class="plan-cycle">
                      <header class="plan-cycle-header">
                        <h4>${escapeHtml(
                          obtenerNombreAnioNivel(asignatura.nivel),
                        )} ·
                          ${escapeHtml(
                            obtenerNombreCiclo(asignatura.ciclo),
                          )}</h4>
                      </header>
                      ${renderizarAsignaturaLista(asignatura, contexto)}
                    </section>`,
                    )
                    .join("")
                : '<div class="planes-message">La papelera está vacía.</div>'
            }
          </div>`
          : `<div class="plan-levels">
            ${renderizarNivelAcademico(
              contexto.estado.nivelPaginaPlan,
              activas,
              contexto,
            )}
          </div>
          ${renderizarPaginacionNiveles(contexto)}`
      }
    </div>
  `;
}

export function renderizarDetallePlan(contexto, handlers = {}) {
  const contenedor = document.getElementById("planesEstudioPage");

  if (!contenedor || !contexto.estado.planSeleccionado) {
    return;
  }

  const creditosTotales = contexto.estado.asignaturasPlan
    .filter((item) => item.activo)
    .reduce((total, item) => total + Number(item.creditos || 0), 0);

  const contenidoVista =
    contexto.estado.vistaDetallePlan === "MALLA"
      ? renderizarMallaCurricular(contexto, () =>
          renderizarSalidasMalla(contexto),
        )
      : renderizarListaAsignaturas(contexto);

  contenedor.innerHTML = VerPlanPage({
    plan: contexto.estado.planSeleccionado,
    resumenPlan: contexto.estado.resumenPlan,
    reglaOptativasPlan: contexto.estado.reglaOptativasPlan,
    creditosTotales,
    vista: contexto.estado.vistaDetallePlan,
    contenidoVista,
    puedeGestionar: puedeGestionarPlanes(true),
  });

  conectarEventosDetallePlan(contenedor, contexto, handlers);

  try {
    renderizarIconos();
  } catch (error) {
    console.error(
      "No fue posible renderizar todos los iconos del plan:",
      error,
    );
  }

  contexto.limpiarObserverMalla();

  if (contexto.estado.vistaDetallePlan === "MALLA") {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        dibujarConexionesMalla(contexto);

        const canvas = document.getElementById("mallaCanvas");

        if (canvas && typeof ResizeObserver !== "undefined") {
          contexto.estado.observerMalla = new ResizeObserver(() => {
            programarDibujoMalla(contexto);
          });

          contexto.estado.observerMalla.observe(canvas);
          canvas
            .querySelectorAll("[data-malla-asignatura]")
            .forEach((card) => contexto.estado.observerMalla.observe(card));
        }
      });
    } else {
      dibujarConexionesMalla(contexto);
    }
  }
}

export function conectarEventosDetallePlan(contenedor, contexto, handlers = {}) {
  const controller = contexto.iniciarDetalleEventos();
  const { signal } = controller;

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener(
      "resize",
      () => programarDibujoMalla(contexto),
      { signal },
    );
  }

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
        if (handlers.onEjecutarAccionAsignatura) {
          await handlers.onEjecutarAccionAsignatura(
            accionAsignatura.dataset.asignaturaAction,
            accionAsignatura.dataset.id,
          );
        }
        return;
      }

      const ojoMalla = target.closest("[data-malla-eye]");
      if (ojoMalla && contenedor.contains(ojoMalla)) {
        event.preventDefault();
        event.stopPropagation();
        const asignatura = contexto.obtenerAsignaturaPorId(
          ojoMalla.dataset.mallaEye,
        );
        if (asignatura && handlers.onAbrirRequisitos) {
          handlers.onAbrirRequisitos(asignatura);
        }
        return;
      }

      const cardMalla = target.closest("[data-malla-asignatura]");
      if (cardMalla && contenedor.contains(cardMalla)) {
        event.preventDefault();
        const id = Number(cardMalla.dataset.mallaAsignatura);

        contexto.estado.mallaAsignaturaSeleccionadaId =
          Number(contexto.estado.mallaAsignaturaSeleccionadaId) === id
            ? null
            : id;

        actualizarEstadoVisualMalla(contexto);
        if (contexto.estado.mallaAsignaturaSeleccionadaId) {
          mostrarTarjetaMallaCompleta(cardMalla);
        }
        return;
      }

      const agregarCiclo = target.closest("[data-agregar-ciclo]");
      if (agregarCiclo && contenedor.contains(agregarCiclo)) {
        event.preventDefault();
        const nivel = Number(agregarCiclo.dataset.nivel);
        const ciclo = Number(agregarCiclo.dataset.ciclo);
        if (handlers.onAbrirFormularioAsignatura) {
          handlers.onAbrirFormularioAsignatura(null, { nivel, ciclo });
        }
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
          nivel === contexto.estado.nivelPaginaPlan
        ) {
          return;
        }

        contexto.estado.nivelPaginaPlan = nivel;
        renderizarDetallePlan(contexto, handlers);

        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => {
            document.getElementById("planVistaContenido")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          });
        }
        return;
      }

      const vistaButton = target.closest("[data-plan-view]");
      if (vistaButton && contenedor.contains(vistaButton)) {
        const vista = vistaButton.dataset.planView;
        if (vista !== "LISTA" && vista !== "MALLA") {
          return;
        }
        contexto.estado.vistaDetallePlan = vista;
        renderizarDetallePlan(contexto, handlers);
        return;
      }

      if (target.closest("#togglePapeleraPlanButton")) {
        contexto.estado.vistaPapeleraPlan =
          !contexto.estado.vistaPapeleraPlan;
        renderizarDetallePlan(contexto, handlers);
        return;
      }

      const button = target.closest("button");
      if (!button || !contenedor.contains(button)) {
        return;
      }

      switch (button.id) {
        case "volverPlanesButton":
          if (handlers.onVolver) handlers.onVolver();
          break;
        case "verDetalleResumenButton":
          if (handlers.onVerDetalleResumen) handlers.onVerDetalleResumen();
          break;
        case "salidasAcademicasButton":
          if (handlers.onSalidasAcademicas) handlers.onSalidasAcademicas();
          break;
        case "reglaOptativasButton":
          if (handlers.onReglaOptativas) handlers.onReglaOptativas();
          break;
        case "cargaRapidaButton":
          if (handlers.onCargaRapida) handlers.onCargaRapida();
          break;
        case "requisitosRapidosButton":
          if (handlers.onRequisitosRapidos) handlers.onRequisitosRapidos();
          break;
        case "revisarPlanButton":
          if (handlers.onRevisarPlan) handlers.onRevisarPlan();
          break;
        case "importarExcelPlanButton":
          if (handlers.onImportarExcel) handlers.onImportarExcel();
          break;
        case "plantillaExcelPlanButton":
          if (handlers.onPlantillaExcel) handlers.onPlantillaExcel();
          break;
        case "agregarAsignaturaButton":
        case "agregarPrimeraAsignaturaButton":
          if (handlers.onAbrirFormularioAsignatura) {
            handlers.onAbrirFormularioAsignatura();
          }
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

      contexto.estado.mallaAsignaturaSeleccionadaId =
        Number(contexto.estado.mallaAsignaturaSeleccionadaId) === id
          ? null
          : id;

      actualizarEstadoVisualMalla(contexto);
    },
    { signal },
  );
}

export async function abrirDetallePlan(
  plan,
  contexto,
  { onVolver = () => {}, handlers = {}, consultas = {} } = {},
) {
  contexto.estado.vistaDetallePlan = "LISTA";
  contexto.estado.vistaPapeleraPlan = false;
  contexto.estado.mallaAsignaturaSeleccionadaId = null;
  contexto.estado.nivelPaginaPlan = 1;
  const carga = contexto.iniciarCargaDetalle(plan);

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
      (consultas.listarPlanAsignaturas || listarPlanAsignaturas)(plan.id),
      (consultas.listarPlanRequisitos || listarPlanRequisitos)(plan.id),
      (consultas.listarSalidasAcademicas || listarSalidasAcademicas)(plan.id),
      (consultas.obtenerResumenPlan || obtenerResumenPlan)(plan.id),
      (consultas.obtenerReglaOptativasPlan || obtenerReglaOptativasPlan)(plan.id),
    ]);

    if (!contexto.esCargaDetalleVigente(carga)) {
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

    contexto.estado.asignaturasPlan = Array.isArray(
      resultadoAsignaturas.asignaturas,
    )
      ? resultadoAsignaturas.asignaturas
      : [];
    contexto.estado.requisitosPlan = Array.isArray(
      resultadoRequisitos.requisitos,
    )
      ? resultadoRequisitos.requisitos
      : [];
    contexto.estado.salidasAcademicas = Array.isArray(
      resultadoSalidas.salidas,
    )
      ? resultadoSalidas.salidas
      : [];
    contexto.estado.resumenPlan = resultadoResumen.resumen || null;
    contexto.estado.reglaOptativasPlan = {
      regla: resultadoReglaOptativas.regla || null,
      cantidadEspaciosOptativos: Number(
        resultadoReglaOptativas.cantidadEspaciosOptativos || 0,
      ),
    };

    renderizarDetallePlan(contexto, handlers);
  } catch (error) {
    if (!contexto.esCargaDetalleVigente(carga)) {
      return;
    }

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
      ?.addEventListener("click", onVolver);
  }
}
