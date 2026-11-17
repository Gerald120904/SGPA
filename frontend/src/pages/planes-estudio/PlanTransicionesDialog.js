/**
 * SGPA — Diálogos de Transición Curricular, Comparador y Convalidaciones Externas.
 */

import {
  abrirComparadorPlanes as abrirComparadorPlanesComponente,
  abrirTransicionCurricular as abrirTransicionCurricularComponente,
} from "./PlanComparadorDialog.js";
import {
  decidirConvalidacionExterna,
  listarConvalidacionesExternas,
  verificarEvidenciaConvalidacionExterna,
} from "../../services/transiciones-curriculares.service.js";
import { habilitarCierreExterior } from "../../components/FormDialog.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import { puedeGestionarPlanes } from "./planes.helpers.js";
import { mostrarFeedback } from "./PlanesListadoView.js";

export async function abrirComparadorPlanes(
  contexto,
  {
    carreraIdInicial = null,
    planOrigenIdInicial = null,
    onFeedback = mostrarFeedback,
  } = {},
) {
  return abrirComparadorPlanesComponente({
    planes: contexto.estado.planes,
    carrerasDisponibles: contexto.estado.carrerasDisponibles,
    carreraIdInicial,
    planOrigenIdInicial,
    puedeGestionar: puedeGestionarPlanes(),
    mostrarFeedback: onFeedback,
  });
}

export async function abrirTransicionCurricular(
  contexto,
  {
    planOrigenIdInicial = null,
    onFeedback = mostrarFeedback,
  } = {},
) {
  return abrirTransicionCurricularComponente({
    planes: contexto.estado.planes,
    carrerasDisponibles: contexto.estado.carrerasDisponibles,
    planOrigenIdInicial,
    puedeGestionar: puedeGestionarPlanes(),
    mostrarFeedback: onFeedback,
  });
}

export async function abrirBandejaConvalidacionesExternas(
  contexto,
  { onFeedback = mostrarFeedback } = {},
) {
  const dialog = document.getElementById("convalidacionesExternasDialog");
  const content = document.getElementById(
    "convalidacionesExternasDialogContent",
  );
  if (!dialog || !content) return;

  const carrerasDisponibles = contexto.estado.carrerasDisponibles;
  let carreraId = carrerasDisponibles[0]?.id || null;
  let solicitudes = [];
  const revisadasEnEstaSesion = new Set();

  async function cargar() {
    try {
      const response = await listarConvalidacionesExternas(
        carreraId,
        "PENDIENTE",
      );
      if (response?.ok === false)
        throw new Error(
          response.message || "No fue posible consultar las solicitudes.",
        );
      const rows = response?.data || response;
      if (!Array.isArray(rows))
        throw new Error("La respuesta de la bandeja no es válida.");
      solicitudes = rows;
      render();
    } catch (error) {
      onFeedback(
        error?.message ||
          "No fue posible cargar las convalidaciones externas.",
        "error",
      );
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
            ${carrerasDisponibles
              .map(
                (c) =>
                  `<option value="${Number(c.id)}" ${
                    Number(c.id) === Number(carreraId) ? "selected" : ""
                  }>${escapeHtml(c.codigo)} - ${escapeHtml(
                    c.nombre,
                  )}</option>`,
              )
              .join("")}
          </select>
        </label>
        ${
          solicitudes.length
            ? solicitudes
                .map((row) => {
                  const docs = Array.isArray(row.documentacion)
                    ? row.documentacion
                    : [];
                  const revisada = revisadasEnEstaSesion.has(Number(row.id));
                  return `<article style="border:1px solid #d0d5dd; border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:10px;">
            <div><strong>Solicitud #${Number(row.id)} · Estudiante #${Number(
                    row.estudianteId,
                  )}</strong>
              <div>${escapeHtml(row.institucionOrigen)} — ${escapeHtml(
                    row.asignaturaOrigen,
                  )} (${escapeHtml(row.identificacionAsignatura)})</div>
              <small>Plan #${Number(row.planDestinoId)} · asignatura destino #${Number(
                    row.planAsignaturaDestinoId,
                  )} · ${Number(row.creditosOrigen)} créditos de origen</small>
            </div>
            <p style="margin:0;">Motivo de solicitud: ${escapeHtml(
              row.motivoSolicitud,
            )}</p>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${
                docs
                  .map((doc, index) => {
                    let link = "";
                    try {
                      const url = new URL(doc.referencia);
                      if (
                        url.protocol === "https:" &&
                        !url.username &&
                        !url.password
                      )
                        link = `<button type="button" class="planes-secondary-button" data-ext-open="${Number(
                          row.id,
                        )}" data-ext-index="${index}">Abrir documento HTTPS</button>`;
                    } catch {}
                    return `<label style="display:grid; grid-template-columns:auto 1fr; gap:8px; align-items:start; padding:8px; background:#f8fafc; border-radius:6px;">
                  <input type="checkbox" class="ext-doc-check" data-ext-id="${Number(
                    row.id,
                  )}" data-ext-hash="${escapeHtml(doc.sha256)}">
                  <span><strong>${escapeHtml(
                    doc.nombre,
                  )}</strong><br><small>Referencia: <code>${escapeHtml(
                      doc.referencia,
                    )}</code></small><br><small>SHA-256: <code>${escapeHtml(
                      doc.sha256,
                    )}</code></small>${link}</span>
                </label>`;
                  })
                  .join("") ||
                "<p>No hay evidencia documental; la solicitud no podrá aprobarse.</p>"
              }
            </div>
            <label>Constancia de revisión documental<textarea class="planes-input" data-ext-review-reason="${Number(
              row.id,
            )}" minlength="5" maxlength="500" placeholder="Indique qué verificó en los documentos" style="display:block; width:100%; min-height:64px;"></textarea></label>
            <button type="button" class="planes-secondary-button" data-ext-verify="${Number(
              row.id,
            )}" ${
                    !docs.length ? "disabled" : ""
                  }>Registrar revisión de evidencia</button>
            <label>Motivo de la decisión<textarea class="planes-input" data-ext-decision-reason="${Number(
              row.id,
            )}" minlength="5" maxlength="500" style="display:block; width:100%; min-height:64px;"></textarea></label>
            <div style="display:flex; gap:8px;">
              <button type="button" class="planes-primary-button" data-ext-decision="APROBADA" data-ext-id="${Number(
                row.id,
              )}" ${revisada ? "" : "disabled"}>Aprobar</button>
              <button type="button" class="planes-secondary-button" data-ext-decision="RECHAZADA" data-ext-id="${Number(
                row.id,
              )}" ${revisada ? "" : "disabled"}>Rechazar</button>
            </div>
          </article>`;
                })
                .join("")
            : "<p>No hay solicitudes pendientes para esta carrera.</p>"
        }
      </div>`;
    renderizarIconos();
    if (!dialog.open) dialog.showModal();
    document
      .getElementById("cerrarConvalidacionesExternas")
      ?.addEventListener("click", () => dialog.close());
    document
      .getElementById("convalidacionesCarrera")
      ?.addEventListener("change", (event) => {
        carreraId = event.target.value ? Number(event.target.value) : null;
        revisadasEnEstaSesion.clear();
        void cargar();
      });
    content.querySelectorAll(".ext-doc-check").forEach((checkbox) =>
      checkbox.addEventListener("change", () => {
        const id = checkbox.dataset.extId;
        const button = content.querySelector(`[data-ext-verify="${id}"]`);
        const all = [
          ...content.querySelectorAll(`.ext-doc-check[data-ext-id="${id}"]`),
        ];
        if (button)
          button.disabled = !all.length || all.some((item) => !item.checked);
      }),
    );
    content.querySelectorAll("[data-ext-open]").forEach((button) =>
      button.addEventListener("click", async () => {
        const row = solicitudes.find(
          (item) => Number(item.id) === Number(button.dataset.extOpen),
        );
        const reference =
          row?.documentacion?.[Number(button.dataset.extIndex)]?.referencia;
        try {
          const result =
            await window.sgpa.abrirReferenciaEvidenciaConvalidacion(
              reference,
            );
          if (!result?.ok)
            throw new Error(
              result?.message || "No se pudo abrir el documento.",
            );
        } catch (error) {
          onFeedback(
            error?.message || "No se pudo abrir el documento.",
            "error",
          );
        }
      }),
    );
    content.querySelectorAll("[data-ext-verify]").forEach((button) =>
      button.addEventListener("click", async () => {
        const id = Number(button.dataset.extVerify);
        const docs =
          solicitudes.find((item) => Number(item.id) === id)?.documentacion ||
          [];
        const checks = [
          ...content.querySelectorAll(`.ext-doc-check[data-ext-id="${id}"]`),
        ];
        const reason = content
          .querySelector(`[data-ext-review-reason="${id}"]`)
          ?.value?.trim();
        if (
          !checks.length ||
          checks.some((item) => !item.checked) ||
          !reason ||
          reason.length < 5
        ) {
          onFeedback(
            "Abra y coteje todos los documentos e indique el resultado de la revisión.",
            "error",
          );
          return;
        }
        try {
          const response = await verificarEvidenciaConvalidacionExterna(
            id,
            {
              hashesVerificados: docs.map((doc) => doc.sha256),
              motivoRevision: reason,
              confirmacion: "CONFIRMO_REVISION_DOCUMENTAL",
            },
          );
          if (response?.ok === false)
            throw new Error(
              response.message || "No se registró la revisión.",
            );
          revisadasEnEstaSesion.add(id);
          render();
          onFeedback(
            "Revisión documental registrada. Ya puede emitir la decisión.",
            "success",
          );
        } catch (error) {
          onFeedback(
            error?.message ||
              "No fue posible registrar la revisión documental.",
            "error",
          );
        }
      }),
    );
    content.querySelectorAll("[data-ext-decision]").forEach((button) =>
      button.addEventListener("click", async () => {
        const id = Number(button.dataset.extId);
        const reason = content
          .querySelector(`[data-ext-decision-reason="${id}"]`)
          ?.value?.trim();
        if (!revisadasEnEstaSesion.has(id)) return;
        if (!reason || reason.length < 5) {
          onFeedback(
            "Indique un motivo de al menos cinco caracteres.",
            "error",
          );
          return;
        }
        try {
          const response = await decidirConvalidacionExterna(id, {
            decision: button.dataset.extDecision,
            motivo: reason,
          });
          if (response?.ok === false)
            throw new Error(
              response.message || "No se registró la decisión.",
            );
          revisadasEnEstaSesion.delete(id);
          onFeedback(
            `Solicitud ${button.dataset.extDecision.toLowerCase()} correctamente.`,
            "success",
          );
          await cargar();
        } catch (error) {
          onFeedback(
            error?.message || "No fue posible decidir la solicitud.",
            "error",
          );
        }
      }),
    );
  }

  if (!dialog.open) dialog.showModal();
  habilitarCierreExterior(dialog);
  await cargar();
}
