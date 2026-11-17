import { obtenerRolActivo } from '../../app/session.js';
import { escapeHtml } from '../../utils/html.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import {
  TRANSICIONES_PERIODO as TRANSICIONES,
  obtenerNombreCicloPeriodo as obtenerNombreCiclo,
  formatearFechaPeriodo as formatearFecha,
  obtenerNombreEstadoPeriodo as obtenerNombreEstado,
  obtenerTonoEstadoPeriodo as obtenerTonoEstado,
  esPeriodoEditable as periodoEditable,
} from './periodos.helpers.js';

/** Renderiza las filas del cat?logo usando las reglas visuales ya vigentes. */
export function construirFilasPeriodosHtml(filtrados, puedeGestionar) {
  const filas =
    filtrados
      .map(
        (periodo) => {

          const transiciones =
            TRANSICIONES[
              periodo.estado
            ] || [];


          const informacionBackend =
            Array.isArray(
              periodo.transicionesEstado,
            )
              ? periodo.transicionesEstado
              : [];


          const accionesEstado =
            puedeGestionar
              ? transiciones
                  .map(
                    (transicion) => {
                      const informacion =
                        informacionBackend.find(
                          (item) =>
                            item.estado ===
                            transicion.estado,
                        );

                      const disponible =
                        informacion
                          ?.disponible !==
                        false;

                      const motivo =
                        informacion?.motivo ||
                        "";

                      return `
                        <div
                          class="periodos-transition-wrapper"
                        >
                          <button
                            class="
                              periodos-transition-button
                              ${
                                transicion.peligro
                                  ? "periodos-danger-button"
                                  : ""
                              }
                            "
                            type="button"
                            data-action="estado"
                            data-id="${periodo.id}"
                            data-estado="${transicion.estado}"
                            aria-disabled="${disponible ? "false" : "true"}"
                            title="${escapeHtml(
                              motivo ||
                                transicion.titulo,
                            )}"
                          >
                            ${escapeHtml(
                              transicion.texto,
                            )}
                          </button>

                        </div>
                      `;
                    },
                  )
                  .join("")
              : "";


          return `
            <tr>

              <td data-label="Código">
                <strong
                  class="periodos-code"
                >
                  ${escapeHtml(
                    periodo.codigo,
                  )}
                </strong>
              </td>


              <td data-label="Periodo">

                <div
                  class="periodos-name"
                >

                  <strong>
                    ${escapeHtml(
                      periodo.nombre,
                    )}
                  </strong>

                  <small>
                    Año
                    ${escapeHtml(
                      periodo.anio,
                    )}
                    ·
                    ${escapeHtml(
                      obtenerNombreCiclo(
                        periodo.ciclo,
                      ),
                    )}
                  </small>

                </div>

              </td>


              <td data-label="Fechas">

                <div
                  class="periodos-dates"
                >

                  <strong>
                    ${formatearFecha(
                      periodo.fechaInicio,
                    )}
                    —
                    ${formatearFecha(
                      periodo.fechaFin,
                    )}
                  </strong>

                  <small>
                    Límite disponibilidad:
                    ${formatearFecha(
                      periodo.fechaLimiteDisponibilidad,
                    )}
                  </small>

                </div>

              </td>


              <td data-label="Estado">

                ${StatusBadge({
                  label:
                    obtenerNombreEstado(
                      periodo.estado,
                    ),
                  tone:
                    obtenerTonoEstado(
                      periodo.estado,
                    ),
                })}

              </td>


              <td data-label="Acciones">

                <div
                  class="periodos-actions"
                >

                  ${
                    puedeGestionar &&
                    periodoEditable(
                      periodo,
                    )
                      ? `
                        <button
                          class="periodos-icon-button"
                          type="button"
                          data-action="editar"
                          data-id="${periodo.id}"
                          title="Editar periodo"
                        >

                          <i
                            data-lucide="pencil"
                            aria-hidden="true"
                          ></i>

                        </button>
                      `
                      : ""
                  }


                  ${accionesEstado}
                  ${puedeGestionar && periodo.estado === 'CERRADO' && obtenerRolActivo() === 'ADMIN_GLOBAL'
                    ? `<button class="periodos-icon-button" type="button" data-action="corregir-cerrado"
                        data-id="${periodo.id}" title="Corrección excepcional auditada">
                        <i data-lucide="pencil" aria-hidden="true"></i>
                      </button>` : ''}

                </div>

              </td>

            </tr>
          `;

        },
      )
      .join("");
  return filas;
}
