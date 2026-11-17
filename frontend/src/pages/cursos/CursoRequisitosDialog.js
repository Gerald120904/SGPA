/* =========================================================
   SGPA — MÓDULO CURSOS: DIÁLOGO DE REQUISITOS GENERALES
   frontend/src/pages/cursos/CursoRequisitosDialog.js
   ========================================================= */

import {
  crearRequisitoCurso,
  eliminarRequisitoCurso,
  listarRequisitosCurso,
} from "../../services/cursos.service.js";
import {
  proponerRequisitoCurso,
  proponerEliminarRequisitoCurso,
} from "../../services/solicitudes-cambio.service.js";
import { usuarioTienePermiso, obtenerRolActivo } from "../../app/session.js";
import { PERMISOS, ROLES } from "../../config/permissions.js";
import { confirmarAccion } from "../../utils/confirm.js";
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

const puedeGestionarPermiso = () =>
  usuarioTienePermiso(PERMISOS.CURSOS_GESTIONAR);

const esAsistente = () =>
  obtenerRolActivo() === ROLES.ASISTENTE_ESTUDIANTIL;

/* =========================================================
   ABRIR REQUISITOS DEL CURSO
   ========================================================= */

export async function abrirRequisitosCurso(cursoOParametros, opciones = {}) {
  const parametros =
    cursoOParametros &&
    typeof cursoOParametros === "object" &&
    "curso" in cursoOParametros
      ? cursoOParametros
      : { curso: cursoOParametros, ...opciones };

  const {
    curso,
    cursos = [],
    puedeGestionar: puedeGestionarParam = null,
    dialogId = "cursoDialog",
    contentId = "cursoDialogContent",
    onActualizado = null,
  } = parametros;

  const dialog = document.getElementById(dialogId);
  const content = document.getElementById(contentId);

  if (!dialog || !content || !curso) {
    return;
  }

  const puedeGestionar =
    puedeGestionarParam !== null
      ? Boolean(puedeGestionarParam)
      : (curso.puedeGestionarGlobal ?? puedeGestionarPermiso());

  const candidatos = (Array.isArray(cursos) ? cursos : []).filter(
    (item) =>
      item?.activo === true &&
      Number(item.id) !== Number(curso.id) &&
      (item.puedeGestionarGlobal ?? true),
  );

  const renderModal = (requisitos = [], cargando = false, errorMensaje = "") => {
    let requisitosHtml = "";

    if (cargando) {
      requisitosHtml = `
        <div class="cursos-message" style="margin: 0; padding: 1.5rem;">
          Cargando requisitos del curso...
        </div>
      `;
    } else if (requisitos.length === 0) {
      requisitosHtml = `
        <div class="cursos-message" style="margin: 0; padding: 1.5rem;">
          No tiene requisitos generales registrados.
        </div>
      `;
    } else {
      requisitosHtml = `
        <div class="curso-requisitos-lista" style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${requisitos
            .map(
              (item) => `
                <div
                  class="curso-requisito-card"
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                    background: var(--bg-surface-secondary, rgba(255, 255, 255, 0.05));
                    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
                    gap: 1rem;
                  "
                >
                  <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span
                        class="curso-requirement-badge ${
                          item.tipo === "CORREQUISITO" ? "is-corequisite" : ""
                        }"
                        style="cursor: default;"
                      >
                        ${
                          item.tipo === "CORREQUISITO"
                            ? "Correquisito"
                            : "Requisito"
                        }
                      </span>
                      <strong style="font-size: 0.95rem;">
                        ${escapeHtml(
                          item.requisitoCurso?.codigo || "SIN CÓDIGO",
                        )}
                      </strong>
                    </div>
                    <span style="font-size: 0.875rem; color: var(--text-secondary, #94a3b8);">
                      ${escapeHtml(item.requisitoCurso?.nombre || "")}
                    </span>
                  </div>

                  ${
                    puedeGestionar
                      ? `
                        <button
                          class="cursos-icon-button cursos-danger-button"
                          data-eliminar-requisito="${item.id}"
                          data-requisito-nombre="${escapeHtml(
                            item.requisitoCurso?.nombre || "",
                          )}"
                          type="button"
                          title="Eliminar requisito"
                        >
                          <i data-lucide="trash-2" aria-hidden="true"></i>
                        </button>
                      `
                      : ""
                  }
                </div>
              `,
            )
            .join("")}
        </div>
      `;
    }

    const formAgregarHtml = puedeGestionar
      ? `
        <div style="border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1)); padding-top: 1rem; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem;">
          <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600;">
            Agregar requisito o correquisito
          </h4>

          <div style="display: grid; grid-template-columns: 2fr 1fr auto; gap: 0.75rem; align-items: flex-end;">
            <label style="margin: 0;">
              <span style="display: block; font-size: 0.8rem; margin-bottom: 0.25rem;">
                Curso requisito
              </span>
              <select
                id="nuevoRequisitoCursoId"
                class="cursos-select"
                style="width: 100%;"
              >
                <option value="">
                  Seleccione un curso...
                </option>
                ${candidatos
                  .map(
                    (c) => `
                      <option value="${c.id}">
                        ${escapeHtml(c.codigo)} — ${escapeHtml(c.nombre)}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>

            <label style="margin: 0;">
              <span style="display: block; font-size: 0.8rem; margin-bottom: 0.25rem;">
                Tipo
              </span>
              <select
                id="nuevoRequisitoTipo"
                class="cursos-select"
                style="width: 100%;"
              >
                <option value="REQUISITO">
                  Requisito
                </option>
                <option value="CORREQUISITO">
                  Correquisito
                </option>
              </select>
            </label>

            <button
              id="btnAgregarRequisito"
              class="cursos-primary-button"
              type="button"
              style="height: 38px; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0 1rem; white-space: nowrap;"
            >
              <i data-lucide="plus" aria-hidden="true"></i>
              <span>Agregar</span>
            </button>
          </div>
        </div>
      `
      : "";

    const body = `
      <div style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
        <div id="requisitosListaContainer">
          ${requisitosHtml}
        </div>

        ${formAgregarHtml}
      </div>
    `;

    content.innerHTML = FormDialog({
      formId: "cursoRequisitosForm",
      title: `Requisitos de ${curso.codigo}`,
      description: `Requisitos y correquisitos generales del curso ${curso.nombre}.`,
      body,
      errorId: "cursoRequisitosError",
      showFooter: true,
      footerHtml: `
        <button
          id="cerrarCursoRequisitosButton"
          class="sgpa-form-secondary"
          type="button"
        >
          Cerrar
        </button>
      `,
    });

    if (errorMensaje) {
      const errorBox = document.getElementById("cursoRequisitosError");
      if (errorBox) {
        errorBox.textContent = errorMensaje;
        errorBox.classList.remove("hidden");
      }
    }

    renderizarIconos();

    if (!dialog.open) {
      dialog.showModal();
    }

    habilitarCierreExterior(dialog);

    const cerrar = () => dialog.close();

    document
      .getElementById("cerrarCursoRequisitosButton")
      ?.addEventListener("click", cerrar);

    if (puedeGestionar) {
      document
        .getElementById("btnAgregarRequisito")
        ?.addEventListener("click", async () => {
          if (!puedeGestionarPermiso()) {
            mostrarError({
              titulo: "Acceso denegado",
              mensaje: "No posee permiso para gestionar cursos.",
            });
            return;
          }

          const requisitoCursoSelect = document.getElementById(
            "nuevoRequisitoCursoId",
          );
          const tipoSelect = document.getElementById(
            "nuevoRequisitoTipo",
          );
          const btnAgregar = document.getElementById(
            "btnAgregarRequisito",
          );
          const errorBox = document.getElementById(
            "cursoRequisitosError",
          );

          const requisitoCursoId = Number(
            requisitoCursoSelect?.value,
          );
          const tipo = tipoSelect?.value;

          if (!requisitoCursoId) {
            if (errorBox) {
              errorBox.textContent =
                "Debe seleccionar un curso como requisito.";
              errorBox.classList.remove("hidden");
            }
            return;
          }

          if (btnAgregar) {
            btnAgregar.disabled = true;
          }
          errorBox?.classList.add("hidden");

          let res;

          try {
            res = await (esAsistente() ? proponerRequisitoCurso : crearRequisitoCurso)(curso.id, {
              requisitoCursoId,
              tipo,
            });

            if (!res?.ok) {
              throw new Error(
                res?.message || "No fue posible agregar el requisito.",
              );
            }
          } catch (err) {
            if (errorBox) {
              errorBox.textContent =
                err?.message || "No fue posible agregar el requisito.";
              errorBox.classList.remove("hidden");
            } else {
              mostrarError({
                titulo: "Error",
                mensaje:
                  err?.message || "No fue posible agregar el requisito.",
              });
            }
            return;
          } finally {
            if (btnAgregar) {
              btnAgregar.disabled = false;
            }
          }

          // Mutación completada exitosamente
          try {
            mostrarExito({
              titulo: esAsistente() ? "Solicitud enviada" : "Requisito agregado",
              mensaje: esAsistente()
                ? "El requisito quedó pendiente de aprobación."
                : "El requisito se agregó correctamente.",
            });
          } catch (errorModal) {
            console.error("Error al mostrar confirmación:", errorModal);
          }

          if (typeof onActualizado === "function") {
            try {
              await onActualizado();
            } catch (errorActualizacion) {
              console.error("Error al actualizar catálogo tras agregar requisito:", errorActualizacion);
              mostrarError({
                titulo: "Vista no actualizada",
                mensaje:
                  "El requisito se guardó correctamente, pero no fue posible actualizar la vista del catálogo. Por favor recargue la página.",
              });
            }
          }

          try {
            await cargarRequisitos();
          } catch (errorCarga) {
            console.error("Error al recargar requisitos:", errorCarga);
          }
        });
    }

    document
      .getElementById("requisitosListaContainer")
      ?.addEventListener("click", async (event) => {
        const btnEliminar = event.target.closest(
          "[data-eliminar-requisito]",
        );
        if (!btnEliminar) {
          return;
        }

        if (!puedeGestionarPermiso()) {
          mostrarError({
            titulo: "Acceso denegado",
            mensaje: "No posee permiso para gestionar cursos.",
          });
          return;
        }

        const requisitoId = Number(btnEliminar.dataset.eliminarRequisito);
        const reqNombre = btnEliminar.dataset.requisitoNombre || "este requisito";

        const confirmado = await confirmarAccion({
          titulo: "Eliminar requisito",
          mensaje: `¿Desea eliminar a "${reqNombre}" de los requisitos del curso?`,
          textoConfirmar: "Eliminar",
          peligro: true,
        });

        if (!confirmado) {
          return;
        }

        let res;

        try {
          res = await (esAsistente() ? proponerEliminarRequisitoCurso : eliminarRequisitoCurso)(curso.id, requisitoId);
          if (!res?.ok) {
            throw new Error(
              res?.message || "No fue posible eliminar el requisito.",
            );
          }
        } catch (err) {
          mostrarError({
            titulo: "Error al eliminar",
            mensaje:
              err?.message || "No fue posible eliminar el requisito.",
          });
          return;
        }

        // Eliminación completada exitosamente
        try {
          mostrarExito({
            titulo: esAsistente() ? "Solicitud enviada" : "Requisito eliminado",
            mensaje: esAsistente()
              ? "La eliminación quedó pendiente de aprobación."
              : "El requisito se eliminó correctamente.",
          });
        } catch (errorModal) {
          console.error("Error al mostrar confirmación:", errorModal);
        }

        if (typeof onActualizado === "function") {
          try {
            await onActualizado();
          } catch (errorActualizacion) {
            console.error("Error al actualizar catálogo tras eliminar requisito:", errorActualizacion);
            mostrarError({
              titulo: "Vista no actualizada",
              mensaje:
                "El requisito se eliminó correctamente, pero no fue posible actualizar la vista del catálogo. Por favor recargue la página.",
            });
          }
        }

        try {
          await cargarRequisitos();
        } catch (errorCarga) {
          console.error("Error al recargar requisitos:", errorCarga);
        }
      });
  };

  const cargarRequisitos = async () => {
    renderModal([], true);

    try {
      const res = await listarRequisitosCurso(curso.id);
      if (!res?.ok) {
        throw new Error(
          res?.message || "No fue posible consultar los requisitos.",
        );
      }

      const lista = Array.isArray(res.requisitos) ? res.requisitos : [];
      renderModal(lista, false);
    } catch (err) {
      renderModal(
        [],
        false,
        err?.message || "No fue posible consultar los requisitos del curso.",
      );
    }
  };

  await cargarRequisitos();
}
