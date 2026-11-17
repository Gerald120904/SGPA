/**
 * SGPA — Diálogo modal para creación y edición de planes de estudio.
 */

import {
  actualizarPlanEstudio,
  crearPlanEstudio,
} from "../../services/planes-estudio.service.js";
import {
  proponerActualizarPlan,
  proponerCrearPlan,
} from "../../services/solicitudes-cambio.service.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import {
  FormDialog,
  habilitarCierreExterior,
} from "../../components/FormDialog.js";
import {
  GRADOS_PLAN,
  esAsistente,
  puedeGestionarPlanes,
} from "./planes.helpers.js";

export function abrirFormularioPlan({
  plan = null,
  carrerasDisponibles = [],
  puedeGestionar = puedeGestionarPlanes(),
  onGuardado = async () => {},
  onFeedback = () => {},
} = {}) {
  if (!puedeGestionar) {
    onFeedback("No posee permiso para gestionar planes de estudio.", "error");
    return;
  }

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
          <select
            id="planCarrera"
            name="carreraId"
            required
          >
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
      <span>Grado académico</span>
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
                ${(plan?.grado || "BACHILLERATO") === valor ? "selected" : ""}
              >
                ${nombre}
              </option>
            `,
          )
          .join("")}
      </select>
    </label>

    <label>
      <span>Código</span>
      <input
        id="planCodigo"
        name="codigo"
        type="text"
        maxlength="40"
        value="${plan ? escapeHtml(plan.codigo) : ""}"
        placeholder="Ej. BA-INFORM 2026"
        required
      >
    </label>

    <label class="sgpa-form-wide">
      <span>Nombre</span>
      <input
        id="planNombre"
        name="nombre"
        type="text"
        maxlength="180"
        value="${plan ? escapeHtml(plan.nombre) : ""}"
        placeholder="Ej. Plan de Bachillerato 2026"
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
    submitText: esAsistente()
      ? "Enviar solicitud"
      : editando
      ? "Guardar cambios"
      : "Crear plan",
  });

  renderizarIconos();
  dialog.showModal();
  habilitarCierreExterior(dialog);

  const cerrar = () => {
    dialog.close();
  };

  document
    .getElementById("cancelarPlanButton")
    ?.addEventListener("click", cerrar);

  document
    .getElementById("planForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const errorBox = document.getElementById("planFormError");
      const guardarButton = document.getElementById("guardarPlanButton");
      const gradoInput = document.getElementById("planGrado");
      const codigoInput = document.getElementById("planCodigo");
      const nombreInput = document.getElementById("planNombre");
      const descripcionInput = document.getElementById("planDescripcion");

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
          errorBox.textContent = "Debe seleccionar el grado académico del plan.";
          errorBox.classList.remove("hidden");
        }
        return;
      }

      const datos = {
        grado: gradoInput.value,
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
          ? await (esAsistente() ? proponerActualizarPlan : actualizarPlanEstudio)(
              plan.id,
              datos,
            )
          : await (esAsistente() ? proponerCrearPlan : crearPlanEstudio)(
              datos,
            );

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message || "No fue posible guardar el plan de estudio.",
          );
        }

        cerrar();

        onFeedback(
          esAsistente()
            ? "La solicitud quedó pendiente de aprobación."
            : editando
            ? "Plan actualizado correctamente."
            : "Plan creado correctamente.",
        );

        await onGuardado();
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
