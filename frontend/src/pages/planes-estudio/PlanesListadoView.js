/**
 * SGPA — Vista de listado, filtros y operaciones generales de Planes de Estudio.
 */

import {
  activarVersionPlanEstudio,
  cambiarEstadoPlanEstudio,
  crearVersionPlanEstudio,
  listarPlanesEstudio,
} from "../../services/planes-estudio.service.js";
import { listarCarreras } from "../../services/carreras.service.js";
import { obtenerCatalogoPlanesJerarquia } from "../../services/jerarquia.service.js";
import {
  proponerEstadoPlan,
} from "../../services/solicitudes-cambio.service.js";
import { DataTable } from "../../components/DataTable.js";
import {
  FormDialog,
  habilitarCierreExterior,
} from "../../components/FormDialog.js";
import { mostrarExito, mostrarError } from "../../components/AlertModal.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import { obtenerPresentacionEstadoPlan } from "./plan-status-presentation.mjs";
import {
  esAsistente,
  esCuentaJerarquica,
  formatearGradoPlan,
  puedeGestionarPlanes,
} from "./planes.helpers.js";

export function mostrarFeedback(mensaje, tipo = "success") {
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

export function obtenerPlanesFiltrados(contexto) {
  const busqueda =
    document.getElementById("planesBuscar")?.value?.trim().toLowerCase() || "";
  const carreraId = document.getElementById("planesCarrera")?.value || "";
  const estado = document.getElementById("planesEstado")?.value || "TODOS";

  return contexto.estado.planes.filter((plan) => {
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
      coincideEstado =
        (plan.estado || (plan.activo ? "VIGENTE" : "CERRADO")) === "VIGENTE";
    }

    if (estado === "INACTIVOS") {
      coincideEstado =
        (plan.estado || (plan.activo ? "VIGENTE" : "CERRADO")) !== "VIGENTE";
    }

    return coincideBusqueda && coincideCarrera && coincideEstado;
  });
}

export function renderizarPlanes(contexto) {
  const contenedor = document.getElementById("planesContent");

  if (!contenedor) {
    return;
  }

  const filtrados = obtenerPlanesFiltrados(contexto);
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
            ${(() => {
              const presentacionEstado = obtenerPresentacionEstadoPlan(plan);
              const claseEstado =
                presentacionEstado.clase === "is-active"
                  ? "plan-status-active"
                  : "plan-status-inactive";
              return `<span class="plan-status ${claseEstado}">${escapeHtml(
                presentacionEstado.etiqueta,
              )} · v${Number(plan.numeroVersion || 1)}</span>`;
            })()}
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
                  ${
                    !esAsistente() && plan.estado === "VIGENTE"
                      ? `<button class="planes-icon-button" data-action="crear-version" data-id="${plan.id}" type="button" title="Crear nueva versión curricular" aria-label="Crear nueva versión curricular"><i data-lucide="git-branch-plus" aria-hidden="true"></i></button>`
                      : ""
                  }
                  ${
                    !esAsistente() &&
                    plan.estado === "BORRADOR" &&
                    plan.versionAnteriorId
                      ? `<button class="planes-icon-button planes-success-button" data-action="activar-version" data-id="${plan.id}" data-parent-id="${plan.versionAnteriorId}" type="button" title="Activar esta versión" aria-label="Activar esta versión"><i data-lucide="circle-check" aria-hidden="true"></i></button>`
                      : ""
                  }
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
                      (plan.estado || (plan.activo ? "VIGENTE" : "CERRADO")) ===
                      "VIGENTE"
                        ? "planes-danger-button"
                        : "planes-success-button"
                    }"
                    data-action="estado"
                    data-id="${plan.id}"
                    type="button"
                    title="${
                      (plan.estado || (plan.activo ? "VIGENTE" : "CERRADO")) ===
                      "VIGENTE"
                        ? "Cerrar a nuevos ingresos"
                        : "Reabrir plan"
                    }"
                  >
                    <i
                      data-lucide="${
                        (plan.estado ||
                          (plan.activo ? "VIGENTE" : "CERRADO")) === "VIGENTE"
                          ? "circle-pause"
                          : "circle-check"
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
    columns: [
      "Código",
      "Plan de estudio",
      "Carrera",
      "Grado",
      "Estado",
      "Acciones",
    ],
    rows: filas,
    emptyMessage:
      "No se encontraron planes de estudio con los filtros seleccionados.",
    ariaLabel: "Listado de planes de estudio",
  });

  renderizarIconos();
}

export function renderizarFiltroCarreras(contexto) {
  const select = document.getElementById("planesCarrera");

  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="">Todas las carreras</option>
    ${contexto.estado.carrerasDisponibles
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

export async function cargarDatos(instancia, contexto) {
  const contenedor = document.getElementById("planesContent");

  if (!contenedor) {
    return;
  }

  try {
    const [resultadoPlanes, resultadoCarreras] = await Promise.all([
      listarPlanesEstudio(),
      esCuentaJerarquica() ? obtenerCatalogoPlanesJerarquia() : listarCarreras(),
    ]);

    if (!contexto.esInstanciaVigente(instancia)) {
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

    contexto.estado.planes = Array.isArray(resultadoPlanes.planes)
      ? resultadoPlanes.planes
      : [];
    const datosCarreras = resultadoCarreras.data ?? resultadoCarreras;
    contexto.estado.carrerasDisponibles = Array.isArray(datosCarreras.carreras)
      ? datosCarreras.carreras.filter(
          (carrera) => !esAsistente() || carrera.puedeGestionarPlanes,
        )
      : [];

    renderizarFiltroCarreras(contexto);
    renderizarPlanes(contexto);
  } catch (error) {
    console.error("Error cargando planes de estudio:", error);

    if (!contexto.esInstanciaVigente(instancia)) {
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

export async function alternarEstado(plan, contexto, onActualizado = async () => {}) {
  if (!puedeGestionarPlanes()) {
    mostrarFeedback(
      "No posee permiso para gestionar planes de estudio.",
      "error",
    );
    return;
  }

  const dialog = document.getElementById("estadoPlanDialog");
  const content = document.getElementById("estadoPlanDialogContent");
  if (!dialog || !content) {
    return;
  }

  const cerrando =
    (plan.estado || (plan.activo ? "VIGENTE" : "CERRADO")) === "VIGENTE";
  const titulo = cerrando
    ? "Cerrar plan a nuevos ingresos"
    : "Reabrir plan de estudio";
  const descripcion = cerrando
    ? `El plan "${plan.nombre}" dejará de aceptar nuevos estudiantes. Los estudiantes actuales podrán continuar y graduarse con su plan.`
    : `La reapertura del plan "${plan.nombre}" permitirá nuevos ingresos autorizados y quedará registrada en auditoría.`;

  const body = `
    <div class="sgpa-form-grid">
      <div class="sgpa-form-wide">
        <div class="planes-message ${
          cerrando ? "planes-warning" : "planes-info"
        }" style="margin-bottom: 12px; padding: 12px; background: ${
          cerrando ? "#fffbeb" : "#f0fdf4"
        }; border-radius: 8px; border: 1px solid ${
          cerrando ? "#fde68a" : "#bbf7d0"
        };">
          <p><strong>Plan:</strong> ${escapeHtml(plan.codigo)} — ${escapeHtml(
            plan.nombre,
          )}</p>
          <p style="margin-top: 4px; font-size: 13px; color: #475569;">${escapeHtml(
            descripcion,
          )}</p>
        </div>
      </div>
      <label class="sgpa-form-wide">
        <span class="required">Motivo o resolución del ${
          cerrando ? "cierre" : "reapertura"
        }</span>
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

  document
    .getElementById("cancelarEstadoPlan")
    ?.addEventListener("click", () => dialog.close());

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
        throw new Error(
          resultado?.message || "No fue posible cambiar el estado del plan.",
        );
      }

      dialog.close();
      mostrarFeedback(
        esAsistente()
          ? "La solicitud de cambio de estado quedó pendiente de aprobación."
          : cerrando
          ? "Plan cerrado a nuevos ingresos. Los estudiantes actuales pueden continuar. Cambio auditado."
          : "Plan reabierto correctamente y registrado en auditoría.",
      );
      await onActualizado();
    } catch (error) {
      const msg =
        error?.message || "No fue posible cambiar el estado del plan.";
      if (errorCont) {
        errorCont.textContent = msg;
        errorCont.classList.remove("hidden");
      }
    }
  });
}

export async function crearVersionDesdePlan(
  plan,
  contexto,
  onActualizado = async () => {},
) {
  if (!puedeGestionarPlanes() || esAsistente()) return;
  const dialog = document.getElementById("estadoPlanDialog");
  const content = document.getElementById("estadoPlanDialogContent");
  if (!dialog || !content) return;
  content.innerHTML = FormDialog({
    formId: "crearVersionPlanForm",
    title: "Crear versión curricular",
    description: `Se conservará el plan ${plan.codigo} y sus estudiantes. La nueva versión comenzará como borrador.`,
    body: `<div class="sgpa-form-grid">
      <label><span class="required">Código de la nueva versión</span><input id="codigoNuevaVersion" maxlength="40" required></label>
      <label><span class="required">Nombre</span><input id="nombreNuevaVersion" maxlength="180" required></label>
      <label class="sgpa-form-wide"><span class="required">Motivo</span><textarea id="motivoNuevaVersion" minlength="5" maxlength="500" required></textarea></label>
      <div id="versionPlanError" class="sgpa-form-error hidden sgpa-form-wide"></div>
    </div>`,
    errorId: "versionPlanError",
    cancelButtonId: "cancelarVersionPlan",
    submitButtonId: "confirmarVersionPlan",
    submitText: "Crear borrador",
    submitIcon: "git-branch-plus",
  });
  renderizarIconos();
  if (!dialog.open) dialog.showModal();
  habilitarCierreExterior(dialog);
  document
    .getElementById("cancelarVersionPlan")
    ?.addEventListener("click", () => dialog.close());
  document
    .getElementById("crearVersionPlanForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const codigo = document
        .getElementById("codigoNuevaVersion")
        ?.value?.trim();
      const nombre = document
        .getElementById("nombreNuevaVersion")
        ?.value?.trim();
      const motivo = document
        .getElementById("motivoNuevaVersion")
        ?.value?.trim();
      const error = document.getElementById("versionPlanError");
      try {
        const resultado = await crearVersionPlanEstudio(plan.id, {
          codigo,
          nombre,
          motivo,
        });
        if (!resultado?.ok)
          throw new Error(
            resultado?.message || "No fue posible crear la versión.",
          );
        dialog.close();
        mostrarExito({
          mensaje:
            "Se creó el borrador curricular con una copia de la malla y sus relaciones.",
        });
        await onActualizado();
      } catch (err) {
        if (error) {
          error.textContent =
            err?.message || "No fue posible crear la versión.";
          error.classList.remove("hidden");
        }
      }
    });
}

export async function activarVersionDesdePlan(
  version,
  origenId,
  contexto,
  onActualizado = async () => {},
) {
  if (!puedeGestionarPlanes() || esAsistente()) return;
  const origen = contexto.estado.planes.find(
    (item) => Number(item.id) === Number(origenId),
  );
  if (!origen) {
    mostrarError({
      mensaje: "No se encontró el plan anterior de esta versión.",
    });
    return;
  }
  const dialog = document.getElementById("estadoPlanDialog");
  const content = document.getElementById("estadoPlanDialogContent");
  if (!dialog || !content) return;
  content.innerHTML = FormDialog({
    formId: "activarVersionPlanForm",
    title: "Activar versión curricular",
    description: `La versión ${version.codigo} recibirá nuevos ingresos. ${origen.codigo} pasará a EN TRANSICIÓN; sus estudiantes continuarán con su historial.`,
    body: `<div class="sgpa-form-grid"><label class="sgpa-form-wide"><span class="required">Motivo de activación</span><textarea id="motivoActivarVersion" minlength="5" maxlength="500" required></textarea></label><div id="activarVersionError" class="sgpa-form-error hidden sgpa-form-wide"></div></div>`,
    errorId: "activarVersionError",
    cancelButtonId: "cancelarActivarVersion",
    submitButtonId: "confirmarActivarVersion",
    submitText: "Activar versión",
    submitIcon: "circle-check",
  });
  renderizarIconos();
  if (!dialog.open) dialog.showModal();
  habilitarCierreExterior(dialog);
  document
    .getElementById("cancelarActivarVersion")
    ?.addEventListener("click", () => dialog.close());
  document
    .getElementById("activarVersionPlanForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const motivo = document
        .getElementById("motivoActivarVersion")
        ?.value?.trim();
      const error = document.getElementById("activarVersionError");
      try {
        const resultado = await activarVersionPlanEstudio(
          origenId,
          version.id,
          motivo,
        );
        if (!resultado?.ok)
          throw new Error(
            resultado?.message || "No fue posible activar la versión.",
          );
        dialog.close();
        mostrarExito({
          mensaje: "Versión activada; el cambio quedó registrado en auditoría.",
        });
        await onActualizado();
      } catch (err) {
        if (error) {
          error.textContent =
            err?.message || "No fue posible activar la versión.";
          error.classList.remove("hidden");
        }
      }
    });
}
