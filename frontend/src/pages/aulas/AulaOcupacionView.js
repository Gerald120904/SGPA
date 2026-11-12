/**
 * SGPA — Consulta y representación de ocupación del aula.
 */

import { mostrarError } from '../../components/AlertModal.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { consultarOcupacionAula } from '../../services/aulas.service.js';
import {
  formatearFechaHora,
  nombreOrigenOcupacion,
  normalizarFechaHoraInput,
  obtenerRangoOcupacionInicial,
} from './aulas.helpers.js';
import { renderizarControlFechaHoraCompacto } from './aulas.horarios.js';

export function renderizarSeccionOcupacion() {
  const rango = obtenerRangoOcupacionInicial();

  return `
    <section class="aulas-detail-card">
      <div class="aulas-section-header">
        <div>
          <h3>Ocupación del aula</h3>
          <p class="aulas-muted">
            Consulte reservas e
            indisponibilidades que afectan
            un rango de tiempo.
          </p>
        </div>
      </div>

      <form
        id="ocupacionAulaForm"
        class="aulas-occupancy-form"
      >
        <label>
          <span>Desde</span>

          ${renderizarControlFechaHoraCompacto(
            'ocupacionInicio',
            rango.inicio,
          )}
        </label>

        <label>
          <span>Hasta</span>

          ${renderizarControlFechaHoraCompacto(
            'ocupacionFin',
            rango.fin,
          )}
        </label>

        <button
          class="aulas-primary-button"
          type="submit"
        >
          <i
            data-lucide="search"
            aria-hidden="true"
          ></i>
          Consultar
        </button>
      </form>

      <div
        id="ocupacionAulaContent"
        class="aulas-occupancy-content"
      >
        <p class="aulas-muted">
          Consulte un rango para ver
          la ocupación registrada.
        </p>
      </div>
    </section>
  `;
}

export function configurarOcupacionAula(contexto) {
  document
    .getElementById('ocupacionAulaForm')
    ?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const inicio = document.getElementById('ocupacionInicio')?.value;
      const fin = document.getElementById('ocupacionFin')?.value;

      if (!inicio || !fin) {
        return;
      }

      if (fin <= inicio) {
        mostrarError({
          titulo: 'Rango inválido',
          mensaje:
            'La fecha y hora de finalización debe ser posterior al inicio.',
        });
        return;
      }

      await cargarOcupacionAula(inicio, fin, contexto);
    });
}

export async function cargarOcupacionAula(inicio, fin, contexto) {
  const { aulaDetalleActual } = contexto.estado;

  if (!aulaDetalleActual) {
    return;
  }

  const contenido = document.getElementById('ocupacionAulaContent');

  if (!contenido) {
    return;
  }

  const marca = contexto.siguienteTokenOcupacion();
  const aulaIdConsultada = aulaDetalleActual.id;

  contenido.innerHTML = `
    <div class="aulas-message-inline">
      Consultando ocupación...
    </div>
  `;

  try {
    const resultado = await consultarOcupacionAula(aulaIdConsultada, {
      fechaHoraInicio: normalizarFechaHoraInput(inicio),
      fechaHoraFin: normalizarFechaHoraInput(fin),
    });

    if (!contexto.esOcupacionVigente(marca)) {
      return;
    }

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible consultar la ocupación.',
      );
    }

    contexto.estado.ocupacionAulaActual = resultado.data;
    renderizarOcupacionAula(contexto);
  } catch (error) {
    if (!contexto.esOcupacionVigente(marca)) {
      return;
    }

    contenido.innerHTML = `
      <div class="aulas-message-inline aulas-error">
        ${escapeHtml(
          error?.message || 'No fue posible consultar la ocupación.',
        )}
      </div>
    `;
  }
}

export function renderizarOcupacionAula(contexto) {
  const contenido = document.getElementById('ocupacionAulaContent');
  const { ocupacionAulaActual } = contexto.estado;

  if (!contenido || !ocupacionAulaActual) {
    return;
  }

  const ocupaciones = Array.isArray(ocupacionAulaActual.ocupaciones)
    ? ocupacionAulaActual.ocupaciones
    : [];

  if (!ocupaciones.length) {
    contenido.innerHTML = `
      <div class="aulas-occupancy-free">
        <i
          data-lucide="circle-check"
          aria-hidden="true"
        ></i>

        <div>
          <strong>Sin ocupaciones registradas</strong>
          <p>
            No existen reservas
            extraordinarias ni
            indisponibilidades activas
            dentro de este rango.
          </p>
        </div>
      </div>
    `;

    if (typeof document !== 'undefined') {
      renderizarIconos();
    }

    return;
  }

  contenido.innerHTML = `
    <div class="aulas-occupancy-summary">
      <span>
        ${ocupaciones.length}
        ${
          ocupaciones.length === 1
            ? 'ocupación encontrada'
            : 'ocupaciones encontradas'
        }
      </span>
    </div>

    <div class="aulas-occupancy-list">
      ${ocupaciones
        .map(
          (ocupacion) => `
            <article class="aulas-occupancy-item">
              <div class="aulas-equipment-main">
                <div>
                  <strong>
                    ${escapeHtml(ocupacion.titulo)}
                  </strong>

                  <span>
                    ${escapeHtml(nombreOrigenOcupacion(ocupacion.origen))}
                    ·
                    ${escapeHtml(ocupacion.tipo || '—')}
                  </span>
                </div>

                <span
                  class="aulas-occupancy-origin aulas-occupancy-${String(
                    ocupacion.origen,
                  ).toLowerCase()}"
                >
                  ${escapeHtml(nombreOrigenOcupacion(ocupacion.origen))}
                </span>
              </div>

              <div class="aulas-reservation-dates">
                <div>
                  <span>Desde</span>
                  <strong>
                    ${escapeHtml(formatearFechaHora(ocupacion.fechaHoraInicio))}
                  </strong>
                </div>

                <i
                  data-lucide="arrow-right"
                  aria-hidden="true"
                ></i>

                <div>
                  <span>Hasta</span>
                  <strong>
                    ${escapeHtml(formatearFechaHora(ocupacion.fechaHoraFin))}
                  </strong>
                </div>
              </div>

              ${
                ocupacion.descripcion
                  ? `
                    <p class="aulas-equipment-note">
                      ${escapeHtml(ocupacion.descripcion)}
                    </p>
                  `
                  : ''
              }
            </article>
          `,
        )
        .join('')}
    </div>
  `;

  if (typeof document !== 'undefined') {
    renderizarIconos();
  }
}
