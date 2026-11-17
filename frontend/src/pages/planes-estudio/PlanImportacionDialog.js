/**
 * SGPA — Diálogos y flujos de importación de planes desde Excel y descarga de plantilla.
 */

import {
  ejecutarImportacionPlanCompleta,
  guardarPlantillaExcelPlan,
  seleccionarExcelPlan,
  validarImportacionPlan,
} from "../../services/plan-importacion.service.js";
import { proponerImportarPlan } from "../../services/solicitudes-cambio.service.js";
import { mostrarExito } from "../../components/AlertModal.js";
import { confirmarAccion } from "../../utils/confirm.js";
import { escapeHtml } from "../../utils/html.js";
import { renderizarIconos } from "../../utils/icons.js";
import { esAsistente, puedeGestionarPlanes } from "./planes.helpers.js";

export async function descargarPlantillaPlan() {
  const button = document.getElementById("plantillaExcelPlanButton");
  const htmlOriginal = button?.innerHTML || "";

  const cambiarContenido = (icono, texto) => {
    if (!button) {
      return;
    }

    button.innerHTML = `
      <span class="ver-plan-tool-icon">
        <i data-lucide="${icono}" aria-hidden="true"></i>
      </span>
      <span class="ver-plan-tool-label">${texto}</span>
    `;
    renderizarIconos();
  };

  if (button) {
    button.disabled = true;
    button.classList.add("is-loading");
    cambiarContenido("loader-circle", "Generando...");
  }

  try {
    const resultado = await guardarPlantillaExcelPlan();

    if (resultado?.cancelado) {
      if (button) {
        button.innerHTML = htmlOriginal;
        renderizarIconos();
      }
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible crear la plantilla.",
      );
    }

    if (button) {
      button.classList.remove("is-loading");
      cambiarContenido("check", "Guardada");
      window.setTimeout(() => {
        if (button.isConnected) {
          button.innerHTML = htmlOriginal;
          renderizarIconos();
        }
      }, 1800);
    }
  } catch (error) {
    console.error("Error generando plantilla:", error);

    if (button) {
      button.classList.remove("is-loading");
      cambiarContenido("circle-x", "Error");
      window.setTimeout(() => {
        if (button.isConnected) {
          button.innerHTML = htmlOriginal;
          renderizarIconos();
        }
      }, 1800);
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }
}

export async function seleccionarExcelParaPlan(
  contexto,
  { onError = () => {}, onDetalle = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    onError("No posee permiso para modificar el plan.");
    return;
  }

  const button = document.getElementById("importarExcelPlanButton");
  if (button) button.disabled = true;

  try {
    const resultado = await seleccionarExcelPlan();
    if (resultado?.cancelado) return;
    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible leer el archivo Excel.",
      );
    }
    mostrarPrevisualizacionExcel(
      resultado.archivo,
      resultado.datos,
      contexto,
      { onDetalle },
    );
  } catch (error) {
    console.error("Error importando Excel:", error);
    onError(error?.message || "No fue posible leer el archivo Excel.");
  } finally {
    if (button) button.disabled = false;
  }
}

export function renderizarContadorImportacion(icono, cantidad, nombre) {
  return `<article class="plan-import-counter"><i data-lucide="${icono}"></i><div><strong>${cantidad}</strong><span>${escapeHtml(
    nombre,
  )}</span></div></article>`;
}

export function renderizarVistaPreviaAsignaturasExcel(asignaturas) {
  if (!asignaturas.length) {
    return '<div class="plan-requirements-empty">El archivo no contiene asignaturas.</div>';
  }

  const primeras = asignaturas.slice(0, 10);
  return `
    <section class="plan-import-preview-section">
      <header><strong>Vista previa de asignaturas</strong><small>Mostrando ${
        primeras.length
      } de ${asignaturas.length}</small></header>
      <div class="plan-import-table-wrapper"><table class="plan-import-table"><thead><tr><th>Clave</th><th>Código</th><th>Asignatura</th><th>Tipo</th><th>Tipo optativa</th><th>Nivel</th><th>Ciclo</th><th>Cr.</th></tr></thead><tbody>
        ${primeras
          .map(
            (fila) => `
              <tr>
                <td>${escapeHtml(fila.CLAVE || "")}</td>
                <td>${escapeHtml(fila.CODIGO || "—")}</td>
                <td>${escapeHtml(fila.NOMBRE || "—")}</td>
                <td>${escapeHtml(fila.TIPO || "—")}</td>
                <td>${escapeHtml(fila.TIPO_OPTATIVA || "—")}</td>
                <td>${escapeHtml(fila.NIVEL || "")}</td>
                <td>${escapeHtml(fila.CICLO || "")}</td>
                <td>${escapeHtml(fila.CREDITOS || "")}</td>
              </tr>`,
          )
          .join("")}
      </tbody></table></div>
    </section>`;
}

export function renderizarProblemasImportacion(titulo, items, esError) {
  return `
    <section class="plan-review-group">
      <header><div><strong>${escapeHtml(titulo)}</strong><small>${
    esError
      ? "Debe corregirlos antes de importar."
      : "Revise estos puntos antes de continuar."
  }</small></div><span>${items.length}</span></header>
      <div class="plan-review-list">
        ${items
          .map(
            (item) => `
              <article class="plan-review-item ${
                esError ? "is-error" : "is-warning"
              }">
                <div class="plan-review-item-icon"><i data-lucide="${
                  esError ? "circle-x" : "triangle-alert"
                }"></i></div>
                <div class="plan-review-item-content"><strong>${escapeHtml(
                  item.hoja || "Archivo",
                )}${
              item.fila ? ` · Fila ${escapeHtml(item.fila)}` : ""
            }</strong><p>${escapeHtml(
              item.mensaje || "Inconsistencia detectada.",
            )}</p></div>
              </article>`,
          )
          .join("")}
      </div>
    </section>`;
}

export function mostrarPrevisualizacionExcel(
  archivo,
  datos,
  contexto,
  { onDetalle = () => {} } = {},
) {
  const dialog = document.getElementById("asignaturaDialog");
  const content = document.getElementById("asignaturaDialogContent");
  if (!dialog || !content) return;

  const asignaturas = Array.isArray(datos?.asignaturas)
    ? datos.asignaturas
    : [];
  const requisitos = Array.isArray(datos?.requisitos) ? datos.requisitos : [];
  const salidas = Array.isArray(datos?.salidas) ? datos.salidas : [];
  const salidaAsignaturas = Array.isArray(datos?.salidaAsignaturas)
    ? datos.salidaAsignaturas
    : [];

  content.innerHTML = `
    <div class="plan-form plan-import-preview">
      <header class="plan-dialog-header"><div><h3>Importar plan desde Excel</h3><p>${escapeHtml(
        archivo,
      )}</p></div><button id="cerrarImportPreview" class="planes-icon-button" type="button"><i data-lucide="x"></i></button></header>
      <div class="plan-import-content">
        <div class="plan-import-notice"><i data-lucide="info"></i><div><strong>Previsualización</strong><p>Todavía no se ha guardado ningún dato en el plan.</p></div></div>
        <div class="plan-import-counters">
          ${renderizarContadorImportacion(
            "book-open",
            asignaturas.length,
            "Asignaturas",
          )}
          ${renderizarContadorImportacion(
            "git-branch",
            requisitos.length,
            "Requisitos",
          )}
          ${renderizarContadorImportacion(
            "graduation-cap",
            salidas.length,
            "Salidas",
          )}
          ${renderizarContadorImportacion(
            "list-checks",
            salidaAsignaturas.length,
            "Asignaciones a salidas",
          )}
        </div>
        ${renderizarVistaPreviaAsignaturasExcel(asignaturas)}
      </div>
      <footer class="plan-dialog-footer"><button id="cancelarImportacionExcel" class="planes-secondary-button" type="button">Cancelar</button><button id="validarImportacionExcel" class="planes-primary-button" type="button"><i data-lucide="shield-check"></i> Validar archivo</button></footer>
    </div>`;

  renderizarIconos();
  if (!dialog.open) dialog.showModal();
  const cerrar = () => dialog.close();
  document
    .getElementById("cerrarImportPreview")
    ?.addEventListener("click", cerrar);
  document
    .getElementById("cancelarImportacionExcel")
    ?.addEventListener("click", cerrar);
  document
    .getElementById("validarImportacionExcel")
    ?.addEventListener("click", () =>
      prepararValidacionImportacion(datos, contexto, { onDetalle }),
    );
}

export async function prepararValidacionImportacion(
  datos,
  contexto,
  { onDetalle = () => {} } = {},
) {
  const planSeleccionado = contexto.estado.planSeleccionado;
  if (!planSeleccionado) return;
  const button = document.getElementById("validarImportacionExcel");
  if (button) {
    button.disabled = true;
    button.textContent = "Validando...";
  }

  try {
    const resultado = await validarImportacionPlan(planSeleccionado.id, datos);
    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible validar el archivo.",
      );
    }
    mostrarResultadoValidacionExcel(datos, resultado.validacion, contexto, {
      onDetalle,
    });
  } catch (error) {
    console.error("Error validando importación:", error);
    mostrarErrorImportacion(
      error?.message || "No fue posible validar el archivo.",
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Validar archivo";
    }
  }
}

export function mostrarResultadoValidacionExcel(
  datos,
  validacion,
  contexto,
  { onDetalle = () => {} } = {},
) {
  const content = document.getElementById("asignaturaDialogContent");
  const planSeleccionado = contexto.estado.planSeleccionado;
  if (!content || !planSeleccionado) return;
  const errores = Array.isArray(validacion?.errores) ? validacion.errores : [];
  const advertencias = Array.isArray(validacion?.advertencias)
    ? validacion.advertencias
    : [];
  const puedeImportar = validacion?.puedeImportar === true;
  const estado = puedeImportar
    ? advertencias.length
      ? "plan-review-status-warning"
      : "plan-review-status-ok"
    : "plan-review-status-error";
  const icono = puedeImportar
    ? advertencias.length
      ? "triangle-alert"
      : "circle-check-big"
    : "circle-x";

  content.innerHTML = `
    <div class="plan-form plan-import-preview">
      <header class="plan-dialog-header"><div><h3>Validación de importación</h3><p>${escapeHtml(
        planSeleccionado.nombre,
      )}</p></div></header>
      <div class="plan-import-content">
        <div class="plan-review-status ${estado}"><i data-lucide="${icono}"></i><div><strong>${
    puedeImportar
      ? "Archivo listo para importar"
      : "El archivo contiene errores"
  }</strong><p>${errores.length} errores · ${
    advertencias.length
  } advertencias</p></div></div>
        ${
          errores.length
            ? renderizarProblemasImportacion("Errores", errores, true)
            : ""
        }
        ${
          advertencias.length
            ? renderizarProblemasImportacion(
                "Advertencias",
                advertencias,
                false,
              )
            : ""
        }
      </div>
      <footer class="plan-dialog-footer"><button id="volverImportPreview" class="planes-secondary-button" type="button">Volver</button>${
        puedeImportar
          ? '<button id="confirmarImportacionPlan" class="planes-primary-button" type="button"><i data-lucide="database"></i> Confirmar importación</button>'
          : ""
      }</footer>
    </div>`;
  renderizarIconos();
  document
    .getElementById("volverImportPreview")
    ?.addEventListener("click", () => {
      mostrarPrevisualizacionExcel(
        "Archivo seleccionado",
        datos,
        contexto,
        { onDetalle },
      );
    });
  document
    .getElementById("confirmarImportacionPlan")
    ?.addEventListener("click", () => {
      ejecutarImportacionPlan(datos, contexto, { onDetalle });
    });
}

export async function ejecutarImportacionPlan(
  datos,
  contexto,
  { onDetalle = () => {} } = {},
) {
  if (!puedeGestionarPlanes(true)) {
    return;
  }

  const planSeleccionado = contexto.estado.planSeleccionado;
  if (!planSeleccionado) return;
  const confirmado = await confirmarAccion({
    titulo: "Importar plan de estudio",
    mensaje:
      "Se crearán las asignaturas, requisitos y salidas académicas del archivo. La operación se guardará completa o se revertirá por completo.",
    textoConfirmar: "Importar plan",
    peligro: false,
  });
  if (!confirmado) return;

  const button = document.getElementById("confirmarImportacionPlan");
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader-circle"></i> Importando...';
    renderizarIconos();
  }

  try {
    const resultado = await (esAsistente()
      ? proponerImportarPlan
      : ejecutarImportacionPlanCompleta)(planSeleccionado.id, datos);
    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || "No fue posible importar el plan.",
      );
    }
    if (esAsistente()) {
      document.getElementById("asignaturaDialog")?.close();
      mostrarExito({
        titulo: "Propuesta enviada",
        mensaje:
          "La propuesta de importación del plan quedó pendiente de aprobación.",
      });
    } else {
      mostrarImportacionCompletada(resultado.importacion, contexto, {
        onDetalle,
      });
    }
  } catch (error) {
    console.error("Error ejecutando importación:", error);
    mostrarErrorImportacion(
      error?.message || "No fue posible completar la importación.",
    );
  } finally {
    if (button) button.disabled = false;
  }
}

export function mostrarImportacionCompletada(
  resultado,
  contexto,
  { onDetalle = () => {} } = {},
) {
  const content = document.getElementById("asignaturaDialogContent");
  const planSeleccionado = contexto.estado.planSeleccionado;
  if (!content || !planSeleccionado) return;
  const resumen = resultado?.resumen || {};
  const advertencias = Array.isArray(resultado?.advertencias)
    ? resultado.advertencias
    : [];
  content.innerHTML = `
    <div class="plan-form plan-import-preview">
      <header class="plan-dialog-header"><div><h3>Importación completada</h3><p>${escapeHtml(
        planSeleccionado.nombre,
      )}</p></div></header>
      <div class="plan-import-content">
        <div class="plan-review-status plan-review-status-ok"><i data-lucide="circle-check-big"></i><div><strong>Plan importado correctamente</strong><p>Todos los datos fueron guardados dentro de una única transacción.</p></div></div>
        <div class="plan-import-counters">
          ${renderizarContadorImportacion(
            "book-open",
            resumen.asignaturas ?? 0,
            "Asignaturas",
          )}
          ${renderizarContadorImportacion(
            "git-branch",
            resumen.requisitos ?? 0,
            "Requisitos",
          )}
          ${renderizarContadorImportacion(
            "graduation-cap",
            resumen.salidas ?? 0,
            "Salidas",
          )}
          ${renderizarContadorImportacion(
            "list-checks",
            resumen.asignacionesSalidas ?? 0,
            "Asignaciones",
          )}
        </div>
        ${
          advertencias.length
            ? renderizarProblemasImportacion(
                "Advertencias",
                advertencias,
                false,
              )
            : ""
        }
      </div>
      <footer class="plan-dialog-footer"><button id="finalizarImportacionPlan" class="planes-primary-button" type="button">Ver plan importado</button></footer>
    </div>`;
  renderizarIconos();
  document
    .getElementById("finalizarImportacionPlan")
    ?.addEventListener("click", async () => {
      document.getElementById("asignaturaDialog")?.close();
      if (planSeleccionado) await onDetalle(planSeleccionado);
    });
}

export function mostrarErrorImportacion(mensaje) {
  const content = document.getElementById("asignaturaDialogContent");
  const dialog = document.getElementById("asignaturaDialog");
  if (!content || !dialog) return;
  content.innerHTML = `
    <div class="plan-form plan-import-preview">
      <header class="plan-dialog-header"><div><h3>Importación no completada</h3><p>No se modificó el plan.</p></div></header>
      <div class="plan-import-content"><div class="plan-review-status plan-review-status-error"><i data-lucide="circle-x"></i><div><strong>La importación fue cancelada</strong><p>${escapeHtml(
        mensaje,
      )}</p></div></div><div class="plan-import-rollback-info"><i data-lucide="database-backup"></i><div><strong>Rollback aplicado</strong><p>Si la operación inició una transacción, todos sus cambios fueron revertidos.</p></div></div></div>
      <footer class="plan-dialog-footer"><button id="cerrarErrorImportacion" class="planes-primary-button" type="button">Cerrar</button></footer>
    </div>`;
  renderizarIconos();
  document
    .getElementById("cerrarErrorImportacion")
    ?.addEventListener("click", () => dialog.close());
}
