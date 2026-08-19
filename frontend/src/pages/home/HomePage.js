import {
  DASHBOARD_MOCK
} from '../../data/dashboard.mock.js';

import {
  escapeHtml
} from '../../utils/html.js';


/* =========================================================
   HOME
   =========================================================
   Esta es la página inicial del SGPA.

   Actualmente utiliza datos MOCK / TEMPORALES
   mientras el Product Owner entrega los datos reales.

   Cuando exista el backend correspondiente,
   dashboard.mock.js será sustituido por un servicio.
   ========================================================= */


/* =========================================================
   ESTADO DEL PERIODO
   ========================================================= */

function obtenerClaseEstado(
  estado
) {

  switch (estado) {

    case 'ABIERTA':
      return 'period-status-open';

    case 'ADMINISTRATIVA':
      return 'period-status-admin';

    case 'CERRADA':
      return 'period-status-closed';

    default:
      return 'period-status-open';

  }

}


/* =========================================================
   INDICADORES
   ========================================================= */

function renderIndicadores() {

  return DASHBOARD_MOCK
    .indicadores
    .map(
      (item) => {

        return `
          <article class="dashboard-stat-card">

            <div class="dashboard-stat-icon">

              <i
                data-lucide="${item.icon}"
                aria-hidden="true"
              ></i>

            </div>


            <div class="dashboard-stat-data">

              <strong>
                ${escapeHtml(item.value)}
              </strong>

              <span>
                ${escapeHtml(item.label)}
              </span>

              <small>
                ${escapeHtml(item.detail)}
              </small>

            </div>

          </article>
        `;

      }
    )
    .join('');

}


/* =========================================================
   DEMANDA
   ========================================================= */

function renderDemanda() {

  const valores =
    DASHBOARD_MOCK
      .demandaCarreras
      .map(
        (item) =>
          item.estudiantes
      );


  const maximo =
    Math.max(
      ...valores,
      1
    );


  return DASHBOARD_MOCK
    .demandaCarreras
    .map(
      (item) => {

        const porcentaje =
          Math.round(
            (
              item.estudiantes /
              maximo
            ) * 100
          );


        return `
          <div class="demand-row">

            <span class="demand-name">
              ${escapeHtml(
                item.carrera
              )}
            </span>


            <div class="demand-track">

              <div
                class="demand-bar"
                style="--demand-width: ${porcentaje}%"
              ></div>

            </div>


            <span class="demand-value">
              ${item.estudiantes}
            </span>

          </div>
        `;

      }
    )
    .join('');

}


/* =========================================================
   ALERTAS
   ========================================================= */

function renderAlertas() {

  return DASHBOARD_MOCK
    .alertas
    .map(
      (alerta) => {

        return `
          <div class="academic-alert">

            <i
              data-lucide="triangle-alert"
              class="alert-${alerta.type}"
              aria-hidden="true"
            ></i>


            <span>
              ${escapeHtml(
                alerta.text
              )}
            </span>


            <i
              data-lucide="chevron-right"
              class="alert-arrow"
              aria-hidden="true"
            ></i>

          </div>
        `;

      }
    )
    .join('');

}


/* =========================================================
   ACTIVIDAD
   ========================================================= */

function renderActividad() {

  return DASHBOARD_MOCK
    .actividad
    .map(
      (item) => {

        return `
          <div class="activity-row">

            <div class="activity-icon">

              <i
                data-lucide="${item.icon}"
                aria-hidden="true"
              ></i>

            </div>


            <span class="activity-time">
              ${escapeHtml(
                item.time
              )}
            </span>


            <span class="activity-text">
              ${escapeHtml(
                item.text
              )}
            </span>

          </div>
        `;

      }
    )
    .join('');

}


/* =========================================================
   ACCIONES
   ========================================================= */

function renderAcciones() {

  return DASHBOARD_MOCK
    .acciones
    .map(
      (action) => {

        return `
          <button
            class="dashboard-action"
            data-route="${action.route}"
            type="button"
          >

            <i
              data-lucide="${action.icon}"
              aria-hidden="true"
            ></i>


            <span>
              ${escapeHtml(
                action.title
              )}
            </span>


            <i
              data-lucide="chevron-right"
              class="action-arrow"
              aria-hidden="true"
            ></i>

          </button>
        `;

      }
    )
    .join('');

}


/* =========================================================
   HOME PAGE
   ========================================================= */

export function HomePage() {

  const periodo =
    DASHBOARD_MOCK.periodo;


  const estadoClass =
    obtenerClaseEstado(
      periodo.estado
    );


  return `
    <section class="dashboard-page">

      <!-- =================================================
           DATOS TEMPORALES

           Todos los valores numéricos mostrados actualmente
           provienen de:

           src/data/dashboard.mock.js

           Se eliminarán cuando existan datos reales.
           ================================================= -->


      <!-- =============================================== -->
      <!-- ENCABEZADO -->
      <!-- =============================================== -->

      <div class="dashboard-page-header">

        <div>

          <h2>
            SGPA
          </h2>

          <p>
            Periodo actual:
            ${escapeHtml(
              periodo.nombre
            )}
            ·
            ${escapeHtml(
              periodo.campus
            )}
          </p>

        </div>


        <div class="dashboard-updated">

          <i
            data-lucide="clock"
            aria-hidden="true"
          ></i>

          <span>
            ${escapeHtml(
              DASHBOARD_MOCK
                .ultimaActualizacion
            )}
          </span>

        </div>

      </div>


      <!-- =============================================== -->
      <!-- INDICADORES -->
      <!-- =============================================== -->

      <div class="dashboard-kpis">

        ${renderIndicadores()}

      </div>


      <!-- =============================================== -->
      <!-- INFORMACIÓN -->
      <!-- =============================================== -->

      <div class="dashboard-insights-grid">


        <!-- DEMANDA -->

        <article class="dashboard-card">

          <header class="dashboard-card-header">

            <h3>
              Demanda por carrera
            </h3>

          </header>


          <div class="dashboard-card-body">

            <div class="demand-list">

              ${renderDemanda()}

            </div>

          </div>

        </article>



        <!-- ESTADO DEL PERIODO -->

        <article class="dashboard-card">

          <header class="dashboard-card-header">

            <h3>
              Estado del periodo
            </h3>

          </header>


          <div class="dashboard-card-body">

            <div
              class="period-status ${estadoClass}"
            >

              <span
                class="period-status-dot"
              ></span>

              ${escapeHtml(
                periodo.estadoTexto
              )}

            </div>


            <div class="period-meta">

              <span>

                <strong>
                  Inicio:
                </strong>

                ${escapeHtml(
                  periodo.fechaInicio
                )}

              </span>


              <span>

                <strong>
                  Fin:
                </strong>

                ${escapeHtml(
                  periodo.fechaFin
                )}

              </span>

            </div>

          </div>

        </article>



        <!-- OFERTA ACADÉMICA -->

        <article class="dashboard-card">

          <header class="dashboard-card-header">

            <h3>
              Oferta académica
            </h3>

          </header>


          <div class="dashboard-card-body">

            <div class="offer-summary">

              <div class="offer-row">

                <strong>
                  ${
                    DASHBOARD_MOCK
                      .oferta
                      .cursosOfertados
                  }
                </strong>

                <span>
                  cursos ofertados
                </span>

              </div>


              <div class="offer-row">

                <strong>
                  ${
                    DASHBOARD_MOCK
                      .oferta
                      .gruposAbiertos
                  }
                </strong>

                <span>
                  grupos abiertos
                </span>

              </div>


              <div class="offer-row">

                <strong>
                  ${
                    DASHBOARD_MOCK
                      .oferta
                      .pendientes
                  }
                </strong>

                <span>
                  pendientes
                </span>

              </div>

            </div>

          </div>

        </article>



        <!-- ALERTAS -->

        <article class="dashboard-card">

          <header class="dashboard-card-header">

            <h3>
              Alertas académicas
            </h3>

          </header>


          <div class="dashboard-card-body">

            <div class="alert-list">

              ${renderAlertas()}

            </div>

          </div>

        </article>


      </div>


      <!-- =============================================== -->
      <!-- PARTE INFERIOR -->
      <!-- =============================================== -->

      <div class="dashboard-bottom-grid">


        <!-- ACTIVIDAD -->

        <article class="dashboard-card">

          <header class="dashboard-card-header">

            <h3>
              Actividad reciente
            </h3>

          </header>


          <div class="dashboard-card-body">

            <div class="activity-list">

              ${renderActividad()}

            </div>

          </div>

        </article>



        <!-- ACCIONES -->

        <article class="dashboard-card">

          <header class="dashboard-card-header">

            <h3>
              Accesos rápidos
            </h3>

          </header>


          <div class="dashboard-card-body">

            <div class="dashboard-actions">

              ${renderAcciones()}

            </div>

          </div>

        </article>


      </div>

    </section>
  `;

}