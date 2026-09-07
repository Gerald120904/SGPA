import {
  actualizarCurso,
  crearCurso,
  listarAsignaturasDisponiblesCurso,
} from "../../services/cursos.service.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import {
  FormDialog,
  habilitarCierreExterior,
} from "../../components/FormDialog.js";
import {
  mostrarExito,
  mostrarError,
} from "../../components/AlertModal.js";

/* =========================================================
   FORMULARIO DE CURSO
   ========================================================= */

export async function abrirFormularioCurso({
  curso = null,
  carreraInicialId = null,
  carrerasDisponibles = [],
  planesDisponibles = [],
  onGuardado = null,
}) {
  const dialog =
    document.getElementById("cursoDialog");

  const content =
    document.getElementById(
      "cursoDialogContent",
    );

  if (!dialog || !content) {
    return;
  }

  const editando = Boolean(curso);

  if (editando) {
    abrirFormularioEdicion({
      dialog,
      content,
      curso,
      onGuardado,
    });

    return;
  }

  abrirFormularioCreacion({
    dialog,
    content,
    carreraInicialId,
    carrerasDisponibles,
    planesDisponibles,
    onGuardado,
  });
}

/* =========================================================
   EDITAR
   ========================================================= */

function abrirFormularioEdicion({
  dialog,
  content,
  curso,
  onGuardado,
}) {
  const body = `
    <label>
      <span>
        Código
      </span>

      <input
        type="text"
        value="${escapeHtml(curso.codigo)}"
        disabled
      >
    </label>

    <label>
      <span>
        Nombre
      </span>

      <input
        type="text"
        value="${escapeHtml(curso.nombre)}"
        disabled
      >
    </label>

    <label class="sgpa-form-wide">
      <span>
        Descripción
      </span>

      <textarea
        id="cursoDescripcion"
        maxlength="500"
        rows="4"
        placeholder="Descripción opcional del curso"
      >${
        curso.descripcion
          ? escapeHtml(curso.descripcion)
          : ""
      }</textarea>
    </label>
  `;

  content.innerHTML = FormDialog({
    formId: "cursoForm",
    title: "Editar curso",
    description:
      "El código, nombre y créditos provienen del plan de estudio. Puede modificar la descripción del catálogo.",
    body,
    errorId: "cursoFormError",
    cancelButtonId: "cancelarCursoButton",
    cancelText: "Cancelar",
    submitButtonId: "guardarCursoButton",
    submitText: "Guardar cambios",
    submitIcon: "save",
  });

  renderizarIconos();

  if (!dialog.open) {
    dialog.showModal();
  }

  habilitarCierreExterior(dialog);

  const cerrar = () => dialog.close();

  document
    .getElementById("cancelarCursoButton")
    ?.addEventListener("click", cerrar);

  document
    .getElementById("cursoForm")
    ?.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const descripcionInput =
          document.getElementById(
            "cursoDescripcion",
          );

        const guardarButton =
          document.getElementById(
            "guardarCursoButton",
          );

        const errorBox =
          document.getElementById(
            "cursoFormError",
          );

        if (!descripcionInput || !guardarButton) {
          return;
        }

        guardarButton.disabled = true;
        errorBox?.classList.add("hidden");

        try {
          const resultado =
            await actualizarCurso(curso.id, {
              descripcion:
                descripcionInput.value.trim(),
            });

          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                "No fue posible actualizar el curso.",
            );
          }

          cerrar();

          mostrarExito({
            titulo: "Curso actualizado",
            mensaje: `"${curso.nombre}" se actualizó correctamente.`,
          });

          if (typeof onGuardado === "function") {
            await onGuardado();
          }
        } catch (error) {
          if (errorBox) {
            errorBox.textContent =
              error?.message ||
              "No fue posible actualizar el curso.";

            errorBox.classList.remove("hidden");
          } else {
            mostrarError({
              titulo:
                "No se pudo actualizar el curso",
              mensaje:
                error?.message ||
                "No fue posible actualizar el curso.",
            });
          }
        } finally {
          guardarButton.disabled = false;
        }
      },
    );
}

/* =========================================================
   CREAR
   ========================================================= */

function abrirFormularioCreacion({
  dialog,
  content,
  carreraInicialId,
  carrerasDisponibles,
  planesDisponibles,
  onGuardado,
}) {
  let asignaturasDisponibles = [];

  const carrerasActivas =
    carrerasDisponibles
      .filter(
        (carrera) =>
          carrera.activo === true,
      )
      .slice()
      .sort((a, b) =>
        String(a.nombre || "").localeCompare(
          String(b.nombre || ""),
          "es",
        ),
      );

  const opcionesCarrera =
    carrerasActivas
      .map(
        (carrera) => `
          <option
            value="${carrera.id}"
            ${
              Number(carreraInicialId) ===
              Number(carrera.id)
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(carrera.codigo)}
            -
            ${escapeHtml(carrera.nombre)}
          </option>
        `,
      )
      .join("");

  const body = `
    <label class="sgpa-form-wide">
      <span>
        Carrera
      </span>

      <select
        id="cursoCarrera"
        required
      >
        <option value="">
          Seleccione una carrera
        </option>

        ${opcionesCarrera}
      </select>
    </label>

    <label class="sgpa-form-wide">
      <span>
        Plan de estudio
      </span>

      <select
        id="cursoPlan"
        required
        disabled
      >
        <option value="">
          Primero seleccione una carrera
        </option>
      </select>
    </label>

    <label>
      <span>
        Nivel / Año
      </span>

      <select
        id="cursoNivel"
        required
        disabled
      >
        <option value="">
          Seleccione un plan
        </option>
      </select>
    </label>

    <label>
      <span>
        Ciclo
      </span>

      <select
        id="cursoCiclo"
        required
        disabled
      >
        <option value="">
          Seleccione un nivel
        </option>
      </select>
    </label>

    <label class="sgpa-form-wide">
      <span>
        Asignatura del plan
      </span>

      <select
        id="cursoAsignatura"
        required
        disabled
      >
        <option value="">
          Seleccione un ciclo
        </option>
      </select>
    </label>

    <div
      id="cursoAsignaturaDetalle"
      class="
        sgpa-form-wide
        curso-asignatura-detalle
      "
    ></div>

    <label class="sgpa-form-wide">
      <span>
        Descripción
      </span>

      <textarea
        id="cursoDescripcion"
        maxlength="500"
        rows="4"
        placeholder="Descripción opcional del curso"
      ></textarea>
    </label>
  `;

  content.innerHTML = FormDialog({
    formId: "cursoForm",
    title: "Nuevo curso",
    description:
      "Seleccione una asignatura existente dentro del plan de estudio de la carrera.",
    body,
    errorId: "cursoFormError",
    cancelButtonId: "cancelarCursoButton",
    cancelText: "Cancelar",
    submitButtonId: "guardarCursoButton",
    submitText: "Crear curso",
    submitIcon: "save",
  });

  renderizarIconos();

  if (!dialog.open) {
    dialog.showModal();
  }

  habilitarCierreExterior(dialog);

  const carreraSelect =
    document.getElementById(
      "cursoCarrera",
    );

  const planSelect =
    document.getElementById("cursoPlan");

  const nivelSelect =
    document.getElementById("cursoNivel");

  const cicloSelect =
    document.getElementById("cursoCiclo");

  const asignaturaSelect =
    document.getElementById(
      "cursoAsignatura",
    );

  const detalle =
    document.getElementById(
      "cursoAsignaturaDetalle",
    );

  const descripcionInput =
    document.getElementById(
      "cursoDescripcion",
    );

  const errorBox =
    document.getElementById(
      "cursoFormError",
    );

  const guardarButton =
    document.getElementById(
      "guardarCursoButton",
    );

  const cerrar = () => dialog.close();

  document
    .getElementById("cancelarCursoButton")
    ?.addEventListener("click", cerrar);

  const limpiarDesdePlan = () => {
    asignaturasDisponibles = [];

    nivelSelect.innerHTML =
      '<option value="">Seleccione un plan</option>';

    nivelSelect.disabled = true;

    cicloSelect.innerHTML =
      '<option value="">Seleccione un nivel</option>';

    cicloSelect.disabled = true;

    asignaturaSelect.innerHTML =
      '<option value="">Seleccione un ciclo</option>';

    asignaturaSelect.disabled = true;

    detalle.innerHTML = "";
  };

  const actualizarPlanesCarrera = () => {
    const carreraId =
      Number(carreraSelect.value);

    limpiarDesdePlan();

    errorBox?.classList.add("hidden");

    if (!carreraId) {
      planSelect.innerHTML =
        '<option value="">Primero seleccione una carrera</option>';

      planSelect.disabled = true;

      return;
    }

    const planesCarrera =
      planesDisponibles
        .filter(
          (plan) =>
            plan.activo === true &&
            Number(plan.carreraId) ===
              carreraId,
        )
        .slice()
        .sort(
          (a, b) =>
            Number(b.id) - Number(a.id),
        );

    if (planesCarrera.length === 0) {
      planSelect.innerHTML = `
        <option value="">
          No existen planes activos para esta carrera
        </option>
      `;

      planSelect.disabled = true;

      return;
    }

    planSelect.innerHTML = `
      <option value="">
        Seleccione un plan
      </option>

      ${planesCarrera
        .map(
          (plan) => `
            <option value="${plan.id}">
              ${escapeHtml(plan.codigo)}
              -
              ${escapeHtml(plan.nombre)}
            </option>
          `,
        )
        .join("")}
    `;

    planSelect.disabled = false;

    if (planesCarrera.length === 1) {
      planSelect.value =
        String(planesCarrera[0].id);

      planSelect.dispatchEvent(
        new Event("change"),
      );
    }
  };

  carreraSelect?.addEventListener(
    "change",
    actualizarPlanesCarrera,
  );

  planSelect?.addEventListener(
    "change",
    async () => {
      const carreraId =
        Number(carreraSelect.value);

      const planId =
        Number(planSelect.value);

      asignaturasDisponibles = [];

      nivelSelect.disabled = true;

      cicloSelect.innerHTML =
        '<option value="">Seleccione un nivel</option>';

      cicloSelect.disabled = true;

      asignaturaSelect.innerHTML =
        '<option value="">Seleccione un ciclo</option>';

      asignaturaSelect.disabled = true;

      detalle.innerHTML = "";

      errorBox?.classList.add("hidden");

      if (!planId) {
        nivelSelect.innerHTML =
          '<option value="">Seleccione un plan</option>';

        return;
      }

      nivelSelect.innerHTML =
        '<option value="">Cargando...</option>';

      try {
        const resultado =
          await listarAsignaturasDisponiblesCurso({
            carreraId,
            planId,
          });

        if (
          Number(planSelect.value) !==
          planId
        ) {
          return;
        }

        if (!resultado?.ok) {
          throw new Error(
            resultado?.message ||
              "No fue posible consultar las asignaturas.",
          );
        }

        asignaturasDisponibles =
          Array.isArray(
            resultado.asignaturas,
          )
            ? resultado.asignaturas
            : [];

        if (
          asignaturasDisponibles.length === 0
        ) {
          nivelSelect.innerHTML = `
            <option value="">
              Este plan no tiene asignaturas disponibles
            </option>
          `;

          return;
        }

        const niveles = [
          ...new Set(
            asignaturasDisponibles.map(
              (item) =>
                Number(item.nivel),
            ),
          ),
        ].sort((a, b) => a - b);

        nivelSelect.innerHTML = `
          <option value="">
            Seleccione un nivel
          </option>

          ${niveles
            .map(
              (nivel) => `
                <option value="${nivel}">
                  Nivel ${nivel}
                </option>
              `,
            )
            .join("")}
        `;

        nivelSelect.disabled = false;
      } catch (error) {
        if (
          Number(planSelect.value) !==
          planId
        ) {
          return;
        }

        nivelSelect.innerHTML =
          '<option value="">Error cargando asignaturas</option>';

        if (errorBox) {
          errorBox.textContent =
            error?.message ||
            "No fue posible consultar las asignaturas.";

          errorBox.classList.remove("hidden");
        }
      }
    },
  );

  nivelSelect?.addEventListener(
    "change",
    () => {
      const nivel =
        Number(nivelSelect.value);

      detalle.innerHTML = "";

      asignaturaSelect.innerHTML =
        '<option value="">Seleccione un ciclo</option>';

      asignaturaSelect.disabled = true;

      if (!nivel) {
        cicloSelect.innerHTML =
          '<option value="">Seleccione un nivel</option>';

        cicloSelect.disabled = true;

        return;
      }

      const ciclos = [
        ...new Set(
          asignaturasDisponibles
            .filter(
              (item) =>
                Number(item.nivel) ===
                nivel,
            )
            .map((item) =>
              Number(item.ciclo),
            ),
        ),
      ].sort((a, b) => a - b);

      cicloSelect.innerHTML = `
        <option value="">
          Seleccione un ciclo
        </option>

        ${ciclos
          .map(
            (ciclo) => `
              <option value="${ciclo}">
                Ciclo ${ciclo}
              </option>
            `,
          )
          .join("")}
      `;

      cicloSelect.disabled = false;
    },
  );

  cicloSelect?.addEventListener(
    "change",
    () => {
      const nivel =
        Number(nivelSelect.value);

      const ciclo =
        Number(cicloSelect.value);

      detalle.innerHTML = "";

      if (!ciclo) {
        asignaturaSelect.innerHTML =
          '<option value="">Seleccione un ciclo</option>';

        asignaturaSelect.disabled = true;

        return;
      }

      const asignaturas =
        asignaturasDisponibles.filter(
          (item) =>
            Number(item.nivel) === nivel &&
            Number(item.ciclo) === ciclo,
        );

      asignaturaSelect.innerHTML = `
        <option value="">
          Seleccione una asignatura
        </option>

        ${asignaturas
          .map(
            (item) => `
              <option value="${item.id}">
                ${escapeHtml(
                  item.codigoReferencia,
                )}
                -
                ${escapeHtml(
                  item.nombreReferencia,
                )}
              </option>
            `,
          )
          .join("")}
      `;

      asignaturaSelect.disabled =
        asignaturas.length === 0;
    },
  );

  asignaturaSelect?.addEventListener(
    "change",
    () => {
      const asignaturaId =
        Number(asignaturaSelect.value);

      const asignatura =
        asignaturasDisponibles.find(
          (item) =>
            Number(item.id) ===
            asignaturaId,
        );

      if (!asignatura) {
        detalle.innerHTML = "";
        return;
      }

      detalle.innerHTML = `
        <div class="curso-selected-subject">
          <strong>
            ${escapeHtml(
              asignatura.codigoReferencia,
            )}
            -
            ${escapeHtml(
              asignatura.nombreReferencia,
            )}
          </strong>

          <small>
            Nivel ${asignatura.nivel}
            · Ciclo ${asignatura.ciclo}
            · ${asignatura.creditos} créditos
          </small>
        </div>
      `;
    },
  );

  document
    .getElementById("cursoForm")
    ?.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const planAsignaturaId =
          Number(asignaturaSelect.value);

        if (!planAsignaturaId) {
          if (errorBox) {
            errorBox.textContent =
              "Debe seleccionar una asignatura del plan.";

            errorBox.classList.remove("hidden");
          }

          return;
        }

        if (!guardarButton) {
          return;
        }

        errorBox?.classList.add("hidden");
        guardarButton.disabled = true;

        try {
          const resultado =
            await crearCurso({
              planAsignaturaId,
              descripcion:
                descripcionInput?.value?.trim() ||
                "",
            });

          if (!resultado?.ok) {
            throw new Error(
              resultado?.message ||
                "No fue posible crear el curso.",
            );
          }

          const asignatura =
            asignaturasDisponibles.find(
              (item) =>
                Number(item.id) ===
                planAsignaturaId,
            );

          cerrar();

          mostrarExito({
            titulo: "Curso creado",
            mensaje: `"${asignatura?.nombreReferencia || "El curso"}" se agregó correctamente al catálogo.`,
          });

          if (typeof onGuardado === "function") {
            await onGuardado();
          }
        } catch (error) {
          if (errorBox) {
            errorBox.textContent =
              error?.message ||
              "No fue posible crear el curso.";

            errorBox.classList.remove("hidden");
          } else {
            mostrarError({
              titulo:
                "No se pudo crear el curso",
              mensaje:
                error?.message ||
                "No fue posible crear el curso.",
            });
          }
        } finally {
          guardarButton.disabled = false;
        }
      },
    );

  if (
    carreraInicialId &&
    carreraSelect?.value
  ) {
    actualizarPlanesCarrera();
  }
}
