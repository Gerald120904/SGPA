/**
 * SGPA — Diálogos de Revisión Académica y Diagnósticos de Planes de Estudio.
 */

import { validarPlanEstudio } from "../../services/plan-validaciones.service.js";
import { FormDialog } from "../../components/FormDialog.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import {
  renderizarDatoResumen,
  renderizarEstadoGeneralRevision,
  renderizarGrupoRevision,
} from "./planes.helpers.js";
import { mostrarDialogHerramienta } from "./PlanAsignaturaDialog.js";

export async function abrirRevisionPlan(contexto) {
  const planSeleccionado = contexto.estado.planSeleccionado;
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

    mostrarResultadoRevision(resultado.validacion, contexto);
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

export function mostrarResultadoRevision(validacion, contexto) {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");
  const planSeleccionado = contexto.estado.planSeleccionado;

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
      abrirRevisionPlan(contexto);
    });
}

export function mostrarErrorRevision(mensaje) {
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

export function abrirDetalleResumenPlan(contexto) {
  const resumenPlan = contexto.estado.resumenPlan;
  const planSeleccionado = contexto.estado.planSeleccionado;

  if (!resumenPlan || !planSeleccionado) {
    return;
  }

  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");

  if (!dialog || !content) {
    return;
  }

  const horas = resumenPlan.horas || {};
  const ciclos = Array.isArray(resumenPlan.ciclos) ? resumenPlan.ciclos : [];

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
