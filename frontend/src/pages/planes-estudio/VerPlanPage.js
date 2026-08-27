import {
  escapeHtml
} from "../../utils/html.js";


/* =========================================================
   HERRAMIENTA DEL PLAN
   ========================================================= */

function renderizarHerramienta({

  id,

  icono,

  texto,

  title

}) {

  return `
    <button
      id="${id}"
      class="ver-plan-tool"
      type="button"
      title="${escapeHtml(
        title || texto
      )}"
    >

      <span class="ver-plan-tool-icon">

        <i
          data-lucide="${icono}"
          aria-hidden="true"
        ></i>

      </span>


      <span class="ver-plan-tool-label">
        ${escapeHtml(texto)}
      </span>

    </button>
  `;

}


/* =========================================================
   TARJETA DE RESUMEN
   ========================================================= */

function renderizarResumenCard({

  icono,

  valor,

  titulo,

  detalle

}) {

  return `
    <article class="ver-plan-stat">

      <div class="ver-plan-stat-icon">

        <i
          data-lucide="${icono}"
          aria-hidden="true"
        ></i>

      </div>


      <div class="ver-plan-stat-content">

        <div class="ver-plan-stat-value">
          ${escapeHtml(
            String(valor)
          )}
        </div>


        <div class="ver-plan-stat-title">
          ${escapeHtml(titulo)}
        </div>


        <small>
          ${escapeHtml(detalle)}
        </small>

      </div>

    </article>
  `;

}


/* =========================================================
   RESUMEN DEL PLAN
   ========================================================= */

function renderizarResumen(

  resumenPlan,

  creditosTotales

) {

  const resumen =
    resumenPlan || {};


  const asignaturas =
    resumen.asignaturas || {};


  const creditos =
    resumen.creditos || {};


  const relaciones =
    resumen.relaciones || {};


  const bloques =
    resumen.bloques || {};


  const salidas =
    Array.isArray(
      resumen.salidas
    )
      ? resumen.salidas
      : [];


  const totalCreditos =
    creditos.total ??
    creditosTotales ??
    0;


  const salidasActivas =
    salidas.filter(
      (salida) =>
        salida.activo
    ).length;


  return `
    <section class="ver-plan-summary">

      <!-- =============================================== -->
      <!-- ENCABEZADO -->
      <!-- =============================================== -->

      <header class="ver-plan-section-header">

        <div>

          <span class="ver-plan-section-eyebrow">
            Resumen
          </span>


          <h3>
            Estado académico del plan
          </h3>

        </div>


        <button
          id="verDetalleResumenButton"
          class="ver-plan-text-action"
          type="button"
        >

          <i
            data-lucide="chart-no-axes-column"
            aria-hidden="true"
          ></i>

          Ver detalle

        </button>

      </header>


      <!-- =============================================== -->
      <!-- KPI -->
      <!-- =============================================== -->

      <div class="ver-plan-stats">

        ${renderizarResumenCard({

          icono:
            "book-open",

          valor:
            asignaturas.activas ?? 0,

          titulo:
            "Asignaturas",

          detalle:
            asignaturas.inactivas
              ? `${asignaturas.inactivas} inactivas`
              : "Activas"

        })}


        ${renderizarResumenCard({

          icono:
            "badge-check",

          valor:
            totalCreditos,

          titulo:
            "Créditos",

          detalle:
            "Registrados"

        })}


        ${renderizarResumenCard({

          icono:
            "construction",

          valor:
            relaciones.requisitos ?? 0,

          titulo:
            "Requisitos",

          detalle:
            `${relaciones.correquisitos ?? 0} correquisitos`

        })}


        ${renderizarResumenCard({

          icono:
            "blocks",

          valor:
            bloques.activos ?? 0,

          titulo:
            "Bloques",

          detalle:
            `${bloques.total ?? 0} registrados`

        })}


        ${renderizarResumenCard({

          icono:
            "square-arrow-right-exit",

          valor:
            salidasActivas,

          titulo:
            "Salidas",

          detalle:
            `${salidas.length} registradas`

        })}

      </div>


      <!-- =============================================== -->
      <!-- ADVERTENCIA -->
      <!-- =============================================== -->

      ${
        Number(
          asignaturas.sinBloque || 0
        ) > 0

          ? `
              <div class="ver-plan-warning">

                <i
                  data-lucide="triangle-alert"
                  aria-hidden="true"
                ></i>


                <span>

                  ${asignaturas.sinBloque}

                  asignatura${
                    Number(
                      asignaturas.sinBloque
                    ) === 1
                      ? ""
                      : "s"
                  }

                  sin bloque académico.

                </span>

              </div>
            `

          : ""
      }

    </section>
  `;

}


/* =========================================================
   VER PLAN PAGE
   ========================================================= */

export function VerPlanPage({

  plan,

  resumenPlan,

  creditosTotales = 0,

  vista = "LISTA",

  filtroBloque = "",

  bloques = [],

  contenidoVista = ""

}) {

  if (!plan) {

    return `
      <div class="planes-message planes-error">

        No fue posible cargar
        el plan de estudio.

      </div>
    `;

  }


  const bloquesActivos =
    bloques
      .filter(
        (bloque) =>
          bloque.activo
      )
      .slice()
      .sort(
        (a, b) =>
          Number(a.orden) -
          Number(b.orden)
      );


  return `
    <section class="ver-plan-page">


      <!-- =================================================
           INFORMACIÓN PRINCIPAL
           ================================================= -->

      <header class="ver-plan-hero">


        <!-- ============================================= -->
        <!-- FILA SUPERIOR -->
        <!-- ============================================= -->

        <div class="ver-plan-hero-top">

          <button
            id="volverPlanesButton"
            class="ver-plan-back"
            type="button"
          >

            <span
              class="ver-plan-back-arrow"
              aria-hidden="true"
            >
              ←
            </span>

            Planes de estudio

          </button>


          <!--
            Se reutiliza el botón principal de Planes
            para que sea idéntico a Nuevo plan.
          -->

          <button
            id="agregarAsignaturaButton"
            class="
              planes-primary-button
              ver-plan-add-button
            "
            type="button"
          >

            <i
              data-lucide="plus"
              aria-hidden="true"
            ></i>

            Agregar asignatura

          </button>

        </div>


        <!-- ============================================= -->
        <!-- TÍTULO -->
        <!-- ============================================= -->

        <div class="ver-plan-title">

          <span class="ver-plan-eyebrow">
            Plan académico
          </span>


          <h2>
            ${escapeHtml(
              plan.nombre
            )}
          </h2>


          <div class="ver-plan-meta">

            <span class="ver-plan-meta-code">

              ${escapeHtml(
                plan.codigo
              )}

            </span>


            ${
              plan.carrera?.nombre
                ? `
                    <span>

                      ${escapeHtml(
                        plan.carrera.nombre
                      )}

                    </span>
                  `
                : ""
            }


            <span
              class="
                ver-plan-status
                ${
                  plan.activo
                    ? "is-active"
                    : "is-inactive"
                }
              "
            >

              ${
                plan.activo
                  ? "Activo"
                  : "Inactivo"
              }

            </span>

          </div>

        </div>

      </header>


      <!-- =================================================
           HERRAMIENTAS
           ================================================= -->

      <section class="ver-plan-tools">


        <!-- ============================================= -->
        <!-- ETIQUETA -->
        <!-- ============================================= -->

        <div class="ver-plan-tools-title">

          <span>
            Herramientas
          </span>

        </div>


        <!-- ============================================= -->
        <!-- OPCIONES -->
        <!-- ============================================= -->

        <div class="ver-plan-tools-grid">


          ${renderizarHerramienta({

            id:
              "administrarBloquesButton",

            icono:
              "blocks",

            texto:
              "Bloques",

            title:
              "Administrar bloques"

          })}


          ${renderizarHerramienta({

            id:
              "salidasAcademicasButton",

            icono:
              "square-arrow-right-exit",

            texto:
              "Salidas",

            title:
              "Salidas académicas"

          })}


          ${renderizarHerramienta({

            id:
              "cargaRapidaButton",

            icono:
              "zap",

            texto:
              "Carga rápida",

            title:
              "Carga rápida de asignaturas"

          })}


          ${renderizarHerramienta({

            id:
              "requisitosRapidosButton",

            icono:
              "construction",

            texto:
              "Requisitos",

            title:
              "Requisitos rápidos"

          })}


          ${renderizarHerramienta({

            id:
              "revisarPlanButton",

            icono:
              "shield-check",

            texto:
              "Revisar",

            title:
              "Revisar consistencia del plan"

          })}


          ${renderizarHerramienta({

            id:
              "importarExcelPlanButton",

            icono:
              "import",

            texto:
              "Importar",

            title:
              "Importar plan desde Excel"

          })}


          ${renderizarHerramienta({

            id:
              "plantillaExcelPlanButton",

            icono:
              "book-marked",

            texto:
              "Plantilla",

            title:
              "Descargar plantilla"

          })}

        </div>

      </section>


      <!-- =================================================
           RESUMEN
           ================================================= -->

      ${renderizarResumen(

        resumenPlan,

        creditosTotales

      )}


      <div
        id="planDetalleFeedback"
        class="planes-feedback hidden"
        role="status"
      ></div>


      <!-- =================================================
           ESTRUCTURA CURRICULAR
           ================================================= -->

      <section class="ver-plan-content">


        <!-- ============================================= -->
        <!-- ENCABEZADO -->
        <!-- ============================================= -->

        <header class="ver-plan-content-header">

          <div>

            <span class="ver-plan-section-eyebrow">
              Estructura curricular
            </span>


            <h3>
              Asignaturas del plan
            </h3>

          </div>

        </header>


        <!-- ============================================= -->
        <!-- CONTROLES -->
        <!-- ============================================= -->

        <div class="ver-plan-controls">


          <!-- =========================================== -->
          <!-- LISTA / MALLA -->
          <!-- =========================================== -->

          <div
            class="ver-plan-tabs"
            aria-label="Vista del plan"
          >

            <button
              class="
                ver-plan-tab
                ${
                  vista === "LISTA"
                    ? "active"
                    : ""
                }
              "
              data-plan-view="LISTA"
              type="button"
              aria-pressed="${
                vista === "LISTA"
              }"
            >

              <i
                data-lucide="list"
                aria-hidden="true"
              ></i>

              Lista

            </button>


            <button
              class="
                ver-plan-tab
                ${
                  vista === "MALLA"
                    ? "active"
                    : ""
                }
              "
              data-plan-view="MALLA"
              type="button"
              aria-pressed="${
                vista === "MALLA"
              }"
            >

              <i
                data-lucide="git-branch"
                aria-hidden="true"
              ></i>

              Malla

            </button>

          </div>


          <!-- =========================================== -->
          <!-- FILTRO -->
          <!-- =========================================== -->

          <label class="ver-plan-filter">

            <span>
              Bloque
            </span>


            <select
              id="filtroBloquePlan"
            >

              <option value="">
                Todos los bloques
              </option>


              <option
                value="SIN_BLOQUE"
                ${
                  filtroBloque ===
                  "SIN_BLOQUE"
                    ? "selected"
                    : ""
                }
              >

                Sin bloque

              </option>


              ${
                bloquesActivos
                  .map(
                    (bloque) => `
                      <option
                        value="${bloque.id}"
                        ${
                          String(
                            bloque.id
                          ) ===
                          String(
                            filtroBloque
                          )

                            ? "selected"

                            : ""
                        }
                      >

                        ${escapeHtml(
                          bloque.nombre
                        )}

                      </option>
                    `
                  )
                  .join("")
              }

            </select>

          </label>

        </div>


        <!-- ============================================= -->
        <!-- LISTA / MALLA -->
        <!-- ============================================= -->

        <div
          id="planVistaContenido"
          class="ver-plan-stage"
        >

          ${contenidoVista}

        </div>

      </section>


      <!-- =================================================
           DIALOGS
           ================================================= -->

<dialog
  id="asignaturaDialog"
  class="
    sgpa-form-dialog
    sgpa-form-dialog-tools
  "
>

  <div
    id="asignaturaDialogContent"
    class="sgpa-form-dialog-content"
  ></div>

</dialog>

    </section>
  `;

}