/**
 * SGPA — Diálogos y gestión de Requisitos y Correquisitos de Planes de Estudio.
 */

import {
  cargarRequisitosMasivamente,
  crearPlanRequisito,
  eliminarPlanRequisito,
  listarPlanRequisitos,
} from "../../services/plan-requisitos.service.js";
import {
  proponerEliminarRequisitoPlan,
  proponerRequisitoPlan,
} from "../../services/solicitudes-cambio.service.js";
import { FormDialog } from "../../components/FormDialog.js";
import { mostrarExito } from "../../components/AlertModal.js";
import { confirmarAccion } from "../../utils/confirm.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import {
  esAsistente,
  obtenerAsignaturasParaRequisitos,
  obtenerDatosAsignatura,
  obtenerEtiquetaAsignatura,
  obtenerRequisitosDeAsignatura,
  puedeGestionarPlanes,
} from "./planes.helpers.js";
import { mostrarDialogHerramienta } from "./PlanAsignaturaDialog.js";

export function crearFilaRequisitoRapido() {
  return {
    id: `${Date.now()}-${Math.random()}`,
    asignaturaId: "",
    requisitoAsignaturaId: "",
    tipo: "REQUISITO",
  };
}

export function abrirRequisitosRapidos(
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  if (!contexto.estado.planSeleccionado) {
    return;
  }

  contexto.estado.filasRequisitosRapidos = [crearFilaRequisitoRapido()];
  renderizarRequisitosRapidos(contexto, { onRecargar, onFeedback });
}

export function renderizarRequisitosRapidos(
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  const content = document.getElementById("asignaturaDialogContent");
  const planSeleccionado = contexto.estado.planSeleccionado;

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

  renderizarFilasRequisitosRapidos(contexto);
  renderizarIconos();
  mostrarDialogHerramienta();

  const cerrar = () => document.getElementById("asignaturaDialog")?.close();

  document
    .getElementById("cancelarRequisitosRapidos")
    ?.addEventListener("click", cerrar);
  document
    .getElementById("agregarFilaRequisitoRapido")
    ?.addEventListener("click", () => {
      agregarFilaRequisitoRapido(contexto);
    });
  document
    .getElementById("guardarRequisitosRapidos")
    ?.addEventListener("click", async () => {
      await guardarRequisitosRapidos(contexto, { onRecargar, onFeedback });
    });
}

export function renderizarFilasRequisitosRapidos(contexto) {
  if (typeof document === "undefined") {
    return;
  }
  const body = document.getElementById("requisitosRapidosBody");

  if (!body) {
    return;
  }

  const asignaturas = obtenerAsignaturasParaRequisitos(
    contexto.estado.asignaturasPlan,
  );
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

  body.innerHTML = contexto.estado.filasRequisitosRapidos
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
        actualizarFilaRequisitoRapido(
          contexto,
          id,
          input.dataset.campo,
          input.value,
        );
      });
    });
  });

  body.querySelectorAll("[data-eliminar-requisito]").forEach((button) => {
    button.addEventListener("click", () => {
      eliminarFilaRequisitoRapido(contexto, button.dataset.eliminarRequisito);
    });
  });

  renderizarIconos();
}

export function actualizarFilaRequisitoRapido(contexto, id, campo, valor) {
  const fila = contexto.estado.filasRequisitosRapidos.find(
    (item) => item.id === id,
  );

  if (fila) {
    fila[campo] = valor;
  }
}

export function agregarFilaRequisitoRapido(contexto) {
  contexto.estado.filasRequisitosRapidos.push(crearFilaRequisitoRapido());
  renderizarFilasRequisitosRapidos(contexto);
}

export function eliminarFilaRequisitoRapido(contexto, id) {
  if (contexto.estado.filasRequisitosRapidos.length <= 1) {
    return;
  }

  contexto.estado.filasRequisitosRapidos =
    contexto.estado.filasRequisitosRapidos.filter((fila) => fila.id !== id);
  renderizarFilasRequisitosRapidos(contexto);
}

export function construirRequisitosRapidos(contexto) {
  const relaciones = new Set();

  return contexto.estado.filasRequisitosRapidos.map((fila, index) => {
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

export async function guardarRequisitosRapidos(
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("requisitosRapidosError");
  const button = document.getElementById("guardarRequisitosRapidos");
  const dialog = document.getElementById("asignaturaDialog");
  const planSeleccionado = contexto.estado.planSeleccionado;

  if (!errorBox || !button || !planSeleccionado) {
    return;
  }

  errorBox.textContent = "";
  errorBox.classList.add("hidden");

  try {
    const requisitos = construirRequisitosRapidos(contexto);

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

    await onRecargar();

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

export function actualizarListaRequisitos(
  asignatura,
  contexto = null,
) {
  const lista = document.querySelector(
    "#requisitoForm .plan-requirements-list",
  );
  const contador = document.querySelector(
    "#requisitoForm .plan-requirements-count",
  );
  if (!lista || !contador) return;

  const requisitosPlan = contexto?.estado?.requisitosPlan || [];
  const asignaturasPlan = contexto?.estado?.asignaturasPlan || [];

  const relaciones = obtenerRequisitosDeAsignatura(
    asignatura.id,
    requisitosPlan,
  );
  const filas = relaciones.map((relacion) => {
    const requisito =
      asignaturasPlan.find(
        (item) => Number(item.id) === Number(relacion.requisitoAsignaturaId),
      ) || relacion.requisitoAsignatura;
    const datos = requisito
      ? obtenerDatosAsignatura(requisito)
      : { codigo: "", nombre: "Asignatura no disponible" };
    return `
      <article class="plan-requirement-row">
        <div class="plan-requirement-row-info">
          <span class="plan-requirement-type ${
            relacion.tipo === "CORREQUISITO" ? "plan-requirement-coreq" : ""
          }">
            ${relacion.tipo === "CORREQUISITO" ? "Correquisito" : "Requisito"}
          </span>
          <strong>${datos.codigo ? `${escapeHtml(datos.codigo)} - ` : ""}${escapeHtml(
      datos.nombre,
    )}</strong>
        </div>
        ${
          puedeGestionarPlanes()
            ? `<button class="plan-requirement-delete" data-eliminar-requisito="${
                relacion.id
              }" type="button" aria-label="Quitar ${escapeHtml(
                datos.nombre,
              )}"><i data-lucide="trash-2" aria-hidden="true"></i><span>Quitar</span></button>`
            : ""
        }
      </article>`;
  });
  lista.innerHTML = filas.length
    ? filas.join("")
    : `<div class="plan-requirements-empty plan-requirements-empty-modern">Sin relaciones académicas.</div>`;
  contador.textContent = String(relaciones.length);
  renderizarIconos();
}

export function abrirFormularioRequisitos(
  asignatura,
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");
  const planSeleccionado = contexto.estado.planSeleccionado;

  if (!dialog || !content || !planSeleccionado || !asignatura) {
    return;
  }

  const puedeGestionar = puedeGestionarPlanes(true);
  const datosAsignatura = obtenerDatosAsignatura(asignatura);
  const relaciones = obtenerRequisitosDeAsignatura(
    asignatura.id,
    contexto.estado.requisitosPlan,
  );

  const candidatas = contexto.estado.asignaturasPlan
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
            contexto.estado.asignaturasPlan.find(
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
                  ${
                    datos.codigo ? `${escapeHtml(datos.codigo)} - ` : ""
                  }${escapeHtml(datos.nombre)}
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
        await agregarRequisitoFrontend(asignatura, contexto, {
          onRecargar,
          onFeedback,
        });
      });

    document
      .querySelector("#requisitoForm .plan-requirements-list")
      ?.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-eliminar-requisito]");
        if (button) {
          await eliminarRequisitoFrontend(
            Number(button.dataset.eliminarRequisito),
            asignatura,
            contexto,
            { onRecargar, onFeedback },
          );
        }
      });
  }
}

export async function agregarRequisitoFrontend(
  asignatura,
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes()) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("requisitosFormError");
  const button = document.getElementById("agregarRequisitoButton");
  const tipo = document.getElementById("requisitoTipo")?.value;
  const requisitoAsignaturaId = Number(
    document.getElementById("requisitoAsignatura")?.value,
  );
  const planSeleccionado = contexto?.estado?.planSeleccionado;

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
    const esAsistenteActivo =
      typeof esAsistente === "function" && esAsistente();
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

    if (typeof esAsistente === "function" && esAsistente()) {
      mostrarExito({
        titulo: "Propuesta enviada",
        mensaje:
          "La propuesta de requisito académico quedó pendiente de aprobación.",
        duracion: 2500,
      });
    } else {
      await onRecargar({ preservarDialogo: true });
      const actualizada =
        contexto.obtenerAsignaturaPorId(asignatura.id) || asignatura;
      actualizarListaRequisitos(actualizada, contexto);
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

export async function eliminarRequisitoFrontend(
  relacionId,
  asignatura,
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes()) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  const planSeleccionado = contexto?.estado?.planSeleccionado;
  const relacion = contexto?.estado?.requisitosPlan.find(
    (item) => Number(item.id) === Number(relacionId),
  );

  if (!relacion || !planSeleccionado) {
    return;
  }

  const requisito = contexto.estado.asignaturasPlan.find(
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
    const esAsistenteActivo =
      typeof esAsistente === "function" && esAsistente();
    const resultado = esAsistenteActivo
      ? await proponerEliminarRequisitoPlan(planSeleccionado.id, relacionId)
      : await eliminarPlanRequisito(planSeleccionado.id, relacionId);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible quitar la relación.",
      );
    }

    if (typeof esAsistente === "function" && esAsistente()) {
      mostrarExito({
        titulo: "Propuesta enviada",
        mensaje:
          "La propuesta para quitar la relación quedó pendiente de aprobación.",
        duracion: 2500,
      });
    } else {
      await onRecargar({ preservarDialogo: true });
      const actualizada =
        contexto.obtenerAsignaturaPorId(asignatura.id) || asignatura;
      actualizarListaRequisitos(actualizada, contexto);
      document.getElementById("requisitoAsignatura")?.focus();
    }
  } catch (error) {
    const errorBox = document.getElementById("requisitosFormError");

    if (errorBox) {
      errorBox.textContent =
        error?.message || "No fue posible quitar la relación.";
      errorBox.classList.remove("hidden");
    } else {
      onFeedback(
        error?.message || "No fue posible quitar la relación.",
      );
    }
  }
}

export async function recargarRequisitosPlan(
  contexto,
  { preservarDialogo = false, onRecargarResumen = async () => {}, onRenderizar = () => {} } = {},
) {
  const planSeleccionado = contexto.estado.planSeleccionado;
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

  contexto.estado.requisitosPlan = Array.isArray(resultado.requisitos)
    ? resultado.requisitos
    : [];
  await onRecargarResumen();
  const dialog = document.getElementById("asignaturaDialog");
  if (preservarDialogo && dialog?.open) {
    if (!dialog.dataset.requisitosDetallePendiente) {
      dialog.dataset.requisitosDetallePendiente = "true";
      dialog.addEventListener(
        "close",
        () => {
          if (dialog.isConnected && contexto.estado.planSeleccionado?.id === planId) {
            onRenderizar();
          }
        },
        { once: true },
      );
    }
    return;
  }
  onRenderizar();
}
