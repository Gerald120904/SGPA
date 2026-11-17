/**
 * SGPA — Diálogos y gestión de Asignaturas de un Plan de Estudio (individual y carga rápida).
 */

import {
  actualizarPlanAsignatura,
  cambiarEstadoPlanAsignatura,
  cargarAsignaturasMasivamente,
  crearPlanAsignatura,
  listarPlanAsignaturas,
} from "../../services/plan-asignaturas.service.js";
import {
  proponerActualizarAsignaturaPlan,
  proponerAsignaturaPlan,
  proponerEstadoAsignaturaPlan,
} from "../../services/solicitudes-cambio.service.js";
import { FormDialog } from "../../components/FormDialog.js";
import { mostrarExito } from "../../components/AlertModal.js";
import { confirmarAccion } from "../../utils/confirm.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import {
  MAX_CREDITOS_ASIGNATURA,
  MAX_NOMBRE_ASIGNATURA,
  MAX_ORDEN_ASIGNATURA,
  MIN_CREDITOS_ASIGNATURA,
  esAsistente,
  leerNumeroOpcional,
  obtenerAyudaTipoAsignatura,
  obtenerDatosAsignatura,
  obtenerEstadoCupoOptativa,
  obtenerNombreAnioNivel,
  obtenerNombreCiclo,
  obtenerReglaOptativasActual,
  puedeGestionarPlanes,
  validarCargaRapidaOptativas,
  validarCupoOptativaFrontend,
} from "./planes.helpers.js";

export function mostrarDialogHerramienta() {
  const dialog = document.getElementById("asignaturaDialog");

  if (!dialog) {
    return null;
  }

  if (!dialog.open) {
    dialog.showModal();
  }

  return dialog;
}

export function crearFilaCargaRapidaAsignatura(indice) {
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

export function actualizarTipoOptativaFilaCarga(fila) {
  if (!fila) {
    return;
  }

  const tipoSelect = fila.querySelector(".carga-asignatura-tipo");
  const campo = fila.querySelector(".carga-asignatura-tipo-optativa-field");
  const tipoOptativaSelect = fila.querySelector(
    ".carga-asignatura-tipo-optativa",
  );

  campo?.classList.add("hidden");

  if (tipoOptativaSelect) {
    tipoOptativaSelect.disabled = true;
    tipoOptativaSelect.required = false;
  }
}

export function abrirCargaRapida(contexto, { onRecargar = async () => {}, onFeedback = () => {} } = {}) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  if (!contexto.estado.planSeleccionado) {
    return;
  }

  renderizarCargaRapida(contexto, { onRecargar, onFeedback });
}

export function renderizarCargaRapida(contexto, { onRecargar = async () => {}, onFeedback = () => {} } = {}) {
  const content = document.getElementById("asignaturaDialogContent");
  const planSeleccionado = contexto.estado.planSeleccionado;

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

      actualizarTipoOptativaFilaCarga(filasContainer.lastElementChild);
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
    ?.addEventListener("click", async () => {
      await guardarCargaRapida(contexto, { onRecargar, onFeedback });
    });
}

export function construirCargaRapida(contexto) {
  const nivel = Number(document.getElementById("cargaAsignaturaNivel")?.value);
  const ciclo = Number(document.getElementById("cargaAsignaturaCiclo")?.value);
  const filas = [...document.querySelectorAll("[data-asignatura-carga]")];

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

  validarCargaRapidaOptativas(
    asignaturas,
    contexto.estado.reglaOptativasPlan,
    contexto.estado.asignaturasPlan,
  );
  return asignaturas;
}

export async function guardarCargaRapida(contexto, { onRecargar = async () => {}, onFeedback = () => {} } = {}) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("cargaRapidaError");
  const button = document.getElementById("guardarCargaRapida");
  const planSeleccionado = contexto.estado.planSeleccionado;

  if (!errorBox || !button || !planSeleccionado) {
    return;
  }

  errorBox.classList.add("hidden");
  errorBox.textContent = "";

  try {
    const asignaturas = construirCargaRapida(contexto);
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
    await onRecargar();
  } catch (error) {
    errorBox.textContent =
      error?.message || "No fue posible realizar la carga rápida.";
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false;
    button.textContent = "Cargar asignaturas";
  }
}

export function abrirFormularioAsignatura(
  asignatura = null,
  valoresIniciales = {},
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");
  const planSeleccionado = contexto.estado.planSeleccionado;

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

  const reglaOptativas = obtenerReglaOptativasActual(
    contexto.estado.reglaOptativasPlan,
  );
  const excluirIdCupo =
    editando && asignatura?.activo !== false ? asignatura.id : null;
  const cupoDisciplinaria = obtenerEstadoCupoOptativa(
    "DISCIPLINARIA",
    contexto.estado.reglaOptativasPlan,
    contexto.estado.asignaturasPlan,
    excluirIdCupo,
  );
  const cupoAbierta = obtenerEstadoCupoOptativa(
    "ABIERTA",
    contexto.estado.reglaOptativasPlan,
    contexto.estado.asignaturasPlan,
    excluirIdCupo,
  );
  const cupoSede = obtenerEstadoCupoOptativa(
    "SEDE",
    contexto.estado.reglaOptativasPlan,
    contexto.estado.asignaturasPlan,
    excluirIdCupo,
  );

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

      ${
        editando
          ? `<label>
        <span>Orden</span>
        <input
          id="asignaturaOrden"
          type="number"
          min="1"
          max="${MAX_ORDEN_ASIGNATURA}"
          value="${ordenInicial}"
          required
        >
      </label>`
          : ""
      }

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
        class="sgpa-form-wide hidden"
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
            ${asignatura?.tipoOptativa === "DISCIPLINARIA" ? "selected" : ""}
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
              <span>G · Giras</span>
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
              <span>EI · Autoestudio</span>
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
              <span>HT · Total</span>
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
              <span>HD · Docente</span>
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
    submitText: esAsistente()
      ? "Enviar propuesta"
      : editando
      ? "Guardar cambios"
      : "Agregar asignatura",
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
      await guardarAsignatura(asignatura, cerrar, contexto, {
        onRecargar,
        onFeedback,
      });
    });
}

export async function guardarAsignatura(
  asignatura,
  cerrar,
  contexto,
  { onRecargar = async () => {}, onFeedback = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  const errorBox = document.getElementById("asignaturaFormError");
  const button = document.getElementById("guardarAsignaturaButton");
  const planSeleccionado = contexto.estado.planSeleccionado;

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
    errorBox.textContent = `El nombre de la asignatura no puede superar ${MAX_NOMBRE_ASIGNATURA} caracteres.`;
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
    errorBox.textContent = `Los créditos deben estar entre ${MIN_CREDITOS_ASIGNATURA} y ${MAX_CREDITOS_ASIGNATURA}.`;
    errorBox.classList.remove("hidden");
    document.getElementById("asignaturaCreditos")?.focus();
    return;
  }

  if (
    editando &&
    (!Number.isInteger(orden) || orden < 1 || orden > MAX_ORDEN_ASIGNATURA)
  ) {
    errorBox.textContent = `El orden debe estar entre 1 y ${MAX_ORDEN_ASIGNATURA}.`;
    errorBox.classList.remove("hidden");
    document.getElementById("asignaturaOrden")?.focus();
    return;
  }

  const tipo =
    document.getElementById("asignaturaTipo")?.value || "OBLIGATORIA";

  const errorCupoOptativa = validarCupoOptativaFrontend(
    tipo,
    null,
    contexto.estado.reglaOptativasPlan,
    contexto.estado.asignaturasPlan,
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
      contexto.estado.nivelPaginaPlan = datos.nivel;
    }

    cerrar();
    if (!esAsistente()) {
      await onRecargar();
    }

    mostrarExito({
      titulo: esAsistente()
        ? "Propuesta enviada"
        : editando
        ? "Asignatura actualizada"
        : "Asignatura agregada",
      mensaje: esAsistente()
        ? `La propuesta para "${nombreReferencia}" quedó pendiente de aprobación.`
        : editando
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

export async function recargarAsignaturasPlan(
  contexto,
  { onRecargarResumen = async () => {}, onRecargarRegla = async () => {}, onRenderizar = () => {} } = {},
) {
  const planSeleccionado = contexto.estado.planSeleccionado;
  if (!planSeleccionado) {
    return;
  }

  const resultado = await listarPlanAsignaturas(planSeleccionado.id);

  if (!resultado?.ok) {
    throw new Error(resultado?.message || "No fue posible actualizar el plan.");
  }

  contexto.estado.asignaturasPlan = Array.isArray(resultado.asignaturas)
    ? resultado.asignaturas
    : [];

  await Promise.all([onRecargarResumen(), onRecargarRegla()]);
  onRenderizar();
}

export async function ejecutarAccionAsignatura(
  accion,
  id,
  contexto,
  {
    onAbrirRequisitos = () => {},
    onAbrirFormulario = () => {},
    onRecargar = async () => {},
    onFeedback = () => {},
  } = {},
) {
  const asignatura = contexto.obtenerAsignaturaPorId(id);

  if (!asignatura || !contexto.estado.planSeleccionado) {
    return;
  }

  if (accion === "requisitos") {
    onAbrirRequisitos(asignatura);
    return;
  }

  if (!puedeGestionarPlanes(true)) {
    onFeedback("No posee permiso para modificar el plan.");
    return;
  }

  if (accion === "editar") {
    onAbrirFormulario(asignatura);
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
      contexto.estado.planSeleccionado.id,
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
      onFeedback(
        "La solicitud de cambio de estado de la asignatura quedó pendiente de aprobación.",
      );
    } else {
      await onRecargar();
    }
  } catch (error) {
    onFeedback(
      error?.message || "No fue posible cambiar el estado de la asignatura.",
    );
  }
}
