/**
 * SGPA — Diálogo modal para configuración y visualización de la Regla de Optativas.
 */

import {
  eliminarReglaOptativasPlan,
  guardarReglaOptativasPlan,
  obtenerReglaOptativasPlan,
} from "../../services/plan-reglas-optativas.service.js";
import {
  proponerEliminarReglaOptativaPlan,
  proponerGuardarReglaOptativaPlan,
} from "../../services/solicitudes-cambio.service.js";
import { FormDialog } from "../../components/FormDialog.js";
import { mostrarExito, mostrarError } from "../../components/AlertModal.js";
import { confirmarAccion } from "../../utils/confirm.js";
import { renderizarIconos } from "../../utils/icons.js";
import {
  MAX_ESPACIOS_OPTATIVOS_REGLA,
  esAsistente,
  obtenerConteoOptativasPlan,
  obtenerReglaOptativasActual,
  puedeGestionarPlanes,
} from "./planes.helpers.js";
import { mostrarDialogHerramienta } from "./PlanAsignaturaDialog.js";

export async function recargarReglaOptativasPlan(contexto) {
  const planSeleccionado = contexto.estado.planSeleccionado;
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

  contexto.estado.reglaOptativasPlan = {
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

export function abrirReglaOptativasPlan(
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!contexto.estado.planSeleccionado) {
    return;
  }

  renderizarReglaOptativasPlan(contexto, { onRecargar, onFeedback });
}

export function renderizarReglaOptativasPlan(
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
  const conteoOptativas = obtenerConteoOptativasPlan(
    contexto.estado.asignaturasPlan,
  );
  const regla = obtenerReglaOptativasActual(contexto.estado.reglaOptativasPlan);
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
          <div><span>Espacios genéricos en la malla</span><strong>${
            conteoOptativas.total
          } / ${totalConfigurado}</strong></div>
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
            <span>${
              esAsistente()
                ? "Enviar propuesta"
                : regla
                ? "Guardar cambios"
                : "Crear regla"
            }</span>
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
      ?.addEventListener("click", async () => {
        await guardarReglaOptativasFrontend(contexto, {
          onRecargar,
          onFeedback,
        });
      });

    document
      .getElementById("eliminarReglaOptativasButton")
      ?.addEventListener("click", async () => {
        await eliminarReglaOptativasFrontend(contexto, {
          onRecargar,
          onFeedback,
        });
      });
  }
}

export async function guardarReglaOptativasFrontend(
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("reglaOptativasError");
  const button = document.getElementById("guardarReglaOptativasButton");
  const planSeleccionado = contexto.estado.planSeleccionado;

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
      errorBox.textContent = `La cantidad de ${etiqueta} debe ser un entero entre 0 y ${MAX_ESPACIOS_OPTATIVOS_REGLA}.`;
      errorBox.classList.remove("hidden");
      return;
    }
  }

  const totalConfigurado =
    cantidadDisciplinarias + cantidadAbiertas + cantidadSede;

  if (totalConfigurado > MAX_ESPACIOS_OPTATIVOS_REGLA) {
    errorBox.textContent = `La suma de espacios optativos no puede superar ${MAX_ESPACIOS_OPTATIVOS_REGLA}.`;
    errorBox.classList.remove("hidden");
    return;
  }

  const conteoOptativas = obtenerConteoOptativasPlan(
    contexto.estado.asignaturasPlan,
  );

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
      await onRecargar();
    }

    mostrarExito({
      titulo: esAsistente()
        ? "Propuesta enviada"
        : "Regla de optativas guardada",
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

export async function eliminarReglaOptativasFrontend(
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  const planSeleccionado = contexto.estado.planSeleccionado;
  if (!planSeleccionado || !obtenerReglaOptativasActual(contexto.estado.reglaOptativasPlan)) {
    return;
  }

  const conteoOptativas = obtenerConteoOptativasPlan(
    contexto.estado.asignaturasPlan,
  );

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
      await onRecargar();
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
