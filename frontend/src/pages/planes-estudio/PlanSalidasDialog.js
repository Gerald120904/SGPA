/**
 * SGPA — Diálogos y vistas de Salidas Académicas del Plan de Estudio.
 */

import {
  actualizarSalidaAcademica,
  cambiarEstadoSalidaAcademica,
  crearSalidaAcademica,
  listarSalidasAcademicas,
  reemplazarAsignaturasSalida,
} from "../../services/salidas-academicas.service.js";
import {
  proponerActualizarSalidaPlan,
  proponerAsignarAsignaturasSalidaPlan,
  proponerEstadoSalidaPlan,
  proponerSalidaPlan,
} from "../../services/solicitudes-cambio.service.js";
import { FormDialog } from "../../components/FormDialog.js";
import { mostrarExito } from "../../components/AlertModal.js";
import { confirmarAccion } from "../../utils/confirm.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import {
  esAsistente,
  formatearTipoSalida,
  normalizarNivelPaginaPlan,
  obtenerAsignaturasSalida,
  obtenerDatosAsignatura,
  obtenerNombreCiclo,
  obtenerPuntoCorteSalida,
  obtenerSalidasEnPuntoCorte,
  puedeGestionarPlanes,
  renderizarEstadoCreditosSalida,
} from "./planes.helpers.js";
import { mostrarDialogHerramienta } from "./PlanAsignaturaDialog.js";

export function renderizarHitosSalidaLista(nivel, ciclo, contexto) {
  const salidas = obtenerSalidasEnPuntoCorte(
    nivel,
    ciclo,
    contexto.estado.salidasAcademicas,
    contexto.estado.asignaturasPlan,
  );

  if (!salidas.length) {
    return "";
  }

  return `
    <div class="plan-cycle-outcomes">
      ${salidas
        .map((salida) => {
          const estado = renderizarEstadoCreditosSalida(
            salida,
            contexto.estado.asignaturasPlan,
          );
          return `
            <article class="plan-outcome-milestone">
              <div class="plan-outcome-milestone-icon" aria-hidden="true">
                <i data-lucide="graduation-cap"></i>
              </div>

              <div class="plan-outcome-milestone-content">
                <span class="plan-outcome-milestone-kicker">
                  Salida académica · ${escapeHtml(
                    formatearTipoSalida(salida.tipo),
                  )}
                </span>
                <strong>${escapeHtml(salida.nombre)}</strong>
                <small>
                  Se alcanza al completar el Nivel ${nivel}, ${obtenerNombreCiclo(
            ciclo,
          )}.
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

export function renderizarSalidasMalla(contexto) {
  const salidas = contexto.estado.salidasAcademicas
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
            const corte = obtenerPuntoCorteSalida(
              salida,
              contexto.estado.asignaturasPlan,
            );
            const estado = renderizarEstadoCreditosSalida(
              salida,
              contexto.estado.asignaturasPlan,
            );

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
                        ? `Nivel ${corte.nivel} · ${obtenerNombreCiclo(
                            corte.ciclo,
                          )}`
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

export function abrirAdministradorSalidas(
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");
  const planSeleccionado = contexto.estado.planSeleccionado;

  if (!dialog || !content || !planSeleccionado) {
    return;
  }

  const puedeGestionar = puedeGestionarPlanes(true);
  const salidasAcademicas = contexto.estado.salidasAcademicas;

  const salidasHtml = salidasAcademicas.length
    ? salidasAcademicas
        .slice()
        .sort((a, b) => Number(a.orden) - Number(b.orden))
        .map((salida) => {
          const asignaturas = obtenerAsignaturasSalida(
            salida,
            contexto.estado.asignaturasPlan,
          );
          const cantidad = asignaturas.length;
          const estado = renderizarEstadoCreditosSalida(
            salida,
            contexto.estado.asignaturasPlan,
          );
          const corte = obtenerPuntoCorteSalida(
            salida,
            contexto.estado.asignaturasPlan,
          );

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
          abrirFormularioSalida(null, contexto, { onRecargar, onFeedback });
        });
      });

    document.querySelectorAll("[data-salida-editar]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const salida = contexto.estado.salidasAcademicas.find(
          (item) => Number(item.id) === Number(button.dataset.salidaEditar),
        );
        if (salida) {
          abrirFormularioSalida(salida, contexto, { onRecargar, onFeedback });
        }
      });
    });

    document.querySelectorAll("[data-salida-asignaturas]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const salida = contexto.estado.salidasAcademicas.find(
          (item) =>
            Number(item.id) === Number(button.dataset.salidaAsignaturas),
        );
        if (salida) {
          abrirAsignaturasSalida(salida, contexto, {
            onRecargar,
            onFeedback,
          });
        }
      });
    });

    document.querySelectorAll("[data-salida-estado]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const salida = contexto.estado.salidasAcademicas.find(
          (item) => Number(item.id) === Number(button.dataset.salidaEstado),
        );
        if (salida) {
          await alternarEstadoSalida(salida, contexto, {
            onRecargar,
            onFeedback,
          });
        }
      });
    });
  }
}

export function abrirFormularioSalida(
  salida = null,
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  const content = document.getElementById("asignaturaDialogContent");
  const planSeleccionado = contexto.estado.planSeleccionado;

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
        value="${salida?.orden || contexto.estado.salidasAcademicas.length + 1}"
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
    submitText: esAsistente()
      ? "Enviar propuesta"
      : editando
      ? "Guardar cambios"
      : "Crear y seleccionar materias",
    submitIcon: "save",
  });

  renderizarIconos();
  mostrarDialogHerramienta();

  document
    .getElementById("volverSalidasButton")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      abrirAdministradorSalidas(contexto, { onRecargar, onFeedback });
    });

  document
    .getElementById("salidaAcademicaForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await guardarSalidaAcademicaFrontend(salida, contexto, {
        onRecargar,
        onFeedback,
      });
    });
}

export async function guardarSalidaAcademicaFrontend(
  salida,
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("salidaAcademicaError");
  const button = document.getElementById("guardarSalidaButton");
  const planSeleccionado = contexto.estado.planSeleccionado;

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
        ? await proponerActualizarSalidaPlan(
            planSeleccionado.id,
            salida.id,
            datos,
          )
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
        mensaje:
          "La propuesta de salida académica quedó pendiente de aprobación.",
      });
      return;
    }

    await recargarSalidasAcademicas(contexto, { renderizar: false });

    const salidaGuardada =
      contexto.estado.salidasAcademicas.find(
        (item) =>
          Number(item.id) ===
          Number(resultado?.salida?.id || resultado?.id || salida?.id),
      ) ||
      contexto.estado.salidasAcademicas.find(
        (item) =>
          String(item.codigo || "").toUpperCase() ===
          datos.codigo.toUpperCase(),
      );

    if (salida) {
      await onRecargar();
      mostrarExito({
        titulo: "Salida actualizada",
        mensaje: `"${datos.nombre}" se actualizó correctamente.`,
      });
      abrirAdministradorSalidas(contexto, { onRecargar, onFeedback });
      return;
    }

    mostrarExito({
      titulo: "Salida creada",
      mensaje:
        "Ahora seleccione las materias que forman parte de esta salida académica.",
    });

    if (salidaGuardada) {
      abrirAsignaturasSalida(salidaGuardada, contexto, {
        onRecargar,
        onFeedback,
      });
      return;
    }

    await onRecargar();
    abrirAdministradorSalidas(contexto, { onRecargar, onFeedback });
  } catch (error) {
    errorBox.textContent =
      error?.message || "No fue posible guardar la salida académica.";
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
}

export async function recargarSalidasAcademicas(
  contexto,
  { renderizar = true, onRecargarResumen = async () => {}, onRenderizar = () => {} } = {},
) {
  const planSeleccionado = contexto.estado.planSeleccionado;
  if (!planSeleccionado) {
    return;
  }

  const resultado = await listarSalidasAcademicas(planSeleccionado.id);

  if (!resultado?.ok) {
    throw new Error(
      resultado?.message || "No fue posible actualizar las salidas académicas.",
    );
  }

  contexto.estado.salidasAcademicas = Array.isArray(resultado.salidas)
    ? resultado.salidas
    : [];
  await onRecargarResumen();

  if (renderizar) {
    onRenderizar();
  }
}

export function abrirAsignaturasSalida(
  salida,
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  const content = document.getElementById("asignaturaDialogContent");
  const planSeleccionado = contexto.estado.planSeleccionado;

  if (!content || !planSeleccionado) {
    return;
  }

  const idsSeleccionados = new Set(
    obtenerAsignaturasSalida(salida, contexto.estado.asignaturasPlan).map(
      (item) => Number(item.id),
    ),
  );

  const asignaturas = contexto.estado.asignaturasPlan
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
    const creditosBox = document.getElementById("salidaAsignaturasCreditos");
    const corteBox = document.getElementById("salidaPuntoCortePreview");

    if (cantidad) {
      cantidad.textContent = `${seleccionadas.length} materia${
        seleccionadas.length === 1 ? "" : "s"
      } seleccionada${seleccionadas.length === 1 ? "" : "s"}`;
    }

    if (creditosBox) {
      creditosBox.textContent = `${creditos} de ${salida.creditosRequeridos} créditos requeridos`;
    }

    if (corteBox) {
      corteBox.textContent = ultima
        ? `Punto de corte: Nivel ${ultima.dataset.nivel} · ${obtenerNombreCiclo(
            ultima.dataset.ciclo,
          )}`
        : "Sin materias seleccionadas";
    }
  };

  document
    .getElementById("seleccionarHastaCorteSalida")
    ?.addEventListener("click", () => {
      const nivel = Number(
        document.getElementById("salidaCorteNivel")?.value || 1,
      );
      const ciclo = Number(
        document.getElementById("salidaCorteCiclo")?.value || 1,
      );

      document.querySelectorAll("[data-salida-asignatura]").forEach((input) => {
        const nivelAsignatura = Number(input.dataset.nivel || 1);
        const cicloAsignatura = Number(input.dataset.ciclo || 1);

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
      abrirAdministradorSalidas(contexto, { onRecargar, onFeedback });
    });

  document
    .getElementById("guardarAsignaturasSalida")
    ?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await guardarAsignaturasSalidaFrontend(salida, contexto, {
        onRecargar,
        onFeedback,
      });
    });
}

export async function guardarAsignaturasSalidaFrontend(
  salida,
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("salidaAsignaturasError");
  const button = document.getElementById("guardarAsignaturasSalida");
  const planSeleccionado = contexto.estado.planSeleccionado;

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
        mensaje:
          "La propuesta de asignaturas para la salida académica quedó pendiente de aprobación.",
      });
      return;
    }

    if (ultima) {
      contexto.estado.nivelPaginaPlan = normalizarNivelPaginaPlan(
        ultima.dataset.nivel,
      );
    }

    await recargarSalidasAcademicas(contexto, { renderizar: false });
    await onRecargar();

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

export async function alternarEstadoSalida(
  salida,
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
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
      contexto.estado.planSeleccionado.id,
      salida.id,
      nuevoEstado,
    );

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible cambiar el estado.",
      );
    }

    if (esAsistente()) {
      onFeedback(
        "La solicitud de cambio de estado de la salida académica quedó pendiente de aprobación.",
      );
    } else {
      await recargarSalidasAcademicas(contexto);
      abrirAdministradorSalidas(contexto, { onRecargar, onFeedback });
    }
  } catch (error) {
    onFeedback(
      error?.message || "No fue posible cambiar el estado de la salida.",
    );
  }
}
