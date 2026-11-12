/**
 * SGPA — Vista de detalle integral de un aula y coordinación de sus subsecciones.
 */

import { mostrarError } from '../../components/AlertModal.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  listarEquipamientoAula,
  listarEquipamientos,
  listarIndisponibilidadesAula,
  listarReservasAula,
  obtenerAula,
} from '../../services/aulas.service.js';
import { listarPeriodosAcademicos } from '../../services/periodos.service.js';
import {
  nombreMobiliario,
  nombreOrigen,
  nombreTipoAula,
  nombreVisibleAula,
  obtenerNumeroAula,
} from './aulas.helpers.js';
import { inicializarControlesHorario } from './aulas.horarios.js';
import {
  puedeConsultarAuditoriaAula,
  puedeGestionarAulas,
  puedeVerPeriodos,
  validarGestionAulas,
} from './aulas.context.js';
import {
  abrirFormularioEquipamientoAula as abrirFormularioEquipamientoAulaComponente,
  desasignarEquipamientoDelAula as desasignarEquipamientoDelAulaComponente,
  renderizarEquipamientoDelAula as renderizarEquipamientoDelAulaComponente,
} from './AulaEquipamientoDialog.js';
import {
  configurarDisponibilidadBaseAula,
  renderizarSeccionDisponibilidadBase,
} from './AulaDisponibilidadView.js';
import {
  abrirFormularioIndisponibilidad,
  cambiarEstadoIndisponibilidad,
  renderizarIndisponibilidades,
} from './AulaIndisponibilidadesView.js';
import {
  configurarOcupacionAula,
  renderizarSeccionOcupacion,
} from './AulaOcupacionView.js';
import {
  cargarAuditoriaAula,
  renderizarSeccionAuditoriaAula,
} from './AulaAuditoriaView.js';

export async function abrirDetalleAula(
  aulaId,
  contexto,
  { onVolver = null } = {},
) {
  const vista = document.getElementById('aulasVista');

  if (!vista) {
    return;
  }

  const { instancia, subvistaToken } = contexto.iniciarSubvista();

  vista.innerHTML = `
    <div class="aulas-message">
      Cargando aula...
    </div>
  `;

  try {
    const [
      resultadoAula,
      resultadoEquipamiento,
      resultadoCatalogo,
      resultadoIndisponibilidades,
      resultadoReservas,
      resultadoPeriodos,
    ] = await Promise.all([
      obtenerAula(aulaId),
      listarEquipamientoAula(aulaId),
      listarEquipamientos(),
      listarIndisponibilidadesAula(aulaId),
      listarReservasAula(aulaId),
      puedeVerPeriodos()
        ? listarPeriodosAcademicos()
        : Promise.resolve({ ok: true, periodos: [] }),
    ]);

    if (!contexto.esSubvistaVigente(instancia, subvistaToken)) {
      return;
    }

    if (!resultadoAula?.ok) {
      throw new Error(
        resultadoAula?.message || 'No fue posible consultar el aula.',
      );
    }

    if (!resultadoEquipamiento?.ok) {
      throw new Error(
        resultadoEquipamiento?.message ||
          'No fue posible consultar el equipamiento del aula.',
      );
    }

    if (!resultadoCatalogo?.ok) {
      throw new Error(
        resultadoCatalogo?.message ||
          'No fue posible consultar el catálogo de equipamientos.',
      );
    }

    if (!resultadoIndisponibilidades?.ok) {
      throw new Error(
        resultadoIndisponibilidades?.message ||
          'No fue posible consultar las indisponibilidades.',
      );
    }

    if (!resultadoReservas?.ok) {
      throw new Error(
        resultadoReservas?.message || 'No fue posible consultar las reservas.',
      );
    }

    if (!resultadoPeriodos?.ok) {
      throw new Error(
        resultadoPeriodos?.message ||
          'No fue posible consultar los periodos académicos.',
      );
    }

    const { estado } = contexto;
    estado.aulaDetalleActual = resultadoAula.data;
    estado.equipamientoAulaActual = Array.isArray(
      resultadoEquipamiento.equipamientos,
    )
      ? resultadoEquipamiento.equipamientos
      : [];
    estado.catalogoEquipamientos = Array.isArray(
      resultadoCatalogo.equipamientos,
    )
      ? resultadoCatalogo.equipamientos
      : [];
    estado.indisponibilidadesAulaActual = Array.isArray(
      resultadoIndisponibilidades.indisponibilidades,
    )
      ? resultadoIndisponibilidades.indisponibilidades
      : [];
    estado.reservasAulaActual = Array.isArray(resultadoReservas.reservas)
      ? resultadoReservas.reservas
      : [];
    estado.periodosDisponibilidadAula = Array.isArray(
      resultadoPeriodos.periodos,
    )
      ? resultadoPeriodos.periodos
      : [];
    estado.auditoriaAulaActual = [];

    const aula = estado.aulaDetalleActual;
    const puedeGestionar = puedeGestionarAulas();

    vista.innerHTML = `
      <div class="aulas-detail-header">
        <button
          id="volverAulasButton"
          class="aulas-back-button"
          type="button"
        >
          <i
            data-lucide="arrow-left"
            aria-hidden="true"
          ></i>
          Volver
        </button>

        <div>
          <h2>
            ${escapeHtml(nombreVisibleAula(aula))}
          </h2>

          <p>
            ${escapeHtml(aula.ubicacion || 'Sin ubicación especificada')}
          </p>
        </div>

        <span
          class="aulas-status ${aula.activo ? 'is-active' : 'is-inactive'}"
        >
          ${aula.activo ? 'Activa' : 'Inactiva'}
        </span>
      </div>

      <section class="aulas-detail-card">
        <h3>Información general</h3>

        <div class="aulas-info-grid">
          <div>
            <span>Número de aula</span>
            <strong>
              ${escapeHtml(obtenerNumeroAula(aula) ?? aula.codigo)}
            </strong>
          </div>

          <div>
            <span>Capacidad</span>
            <strong>
              ${escapeHtml(aula.capacidad)} personas
            </strong>
          </div>

          <div>
            <span>Tipo</span>
            <strong>
              ${escapeHtml(nombreTipoAula(aula.tipo))}
            </strong>
          </div>

          <div>
            <span>Mobiliario</span>
            <strong>
              ${escapeHtml(nombreMobiliario(aula.tipoMobiliario))}
            </strong>
          </div>

          <div>
            <span>Origen</span>
            <strong>
              ${escapeHtml(nombreOrigen(aula.origen))}
            </strong>
          </div>

          <div>
            <span>Ubicación</span>
            <strong>
              ${escapeHtml(aula.ubicacion || 'No especificada')}
            </strong>
          </div>
        </div>
      </section>

      <section class="aulas-detail-card">
        <div class="aulas-section-header">
          <div>
            <h3>Equipamiento</h3>
            <p class="aulas-muted">
              Equipos y recursos disponibles
              en este espacio.
            </p>
          </div>

          ${
            puedeGestionar && aula.activo
              ? `
                <button
                  id="asignarEquipamientoButton"
                  class="aulas-primary-button"
                  type="button"
                >
                  <i data-lucide="plus"></i>
                  Asignar equipamiento
                </button>
              `
              : ''
          }
        </div>

        ${renderizarEquipamientoDelAulaComponente(
          estado.equipamientoAulaActual,
          puedeGestionar,
        )}
      </section>

      ${renderizarSeccionDisponibilidadBase(contexto)}

      <section class="aulas-detail-card">
        <div class="aulas-section-header">
          <div>
            <h3>Indisponibilidades</h3>
            <p class="aulas-muted">
              Periodos en los que el aula
              no puede utilizarse.
            </p>
          </div>

          ${
            puedeGestionar && aula.activo
              ? `
                <button
                  id="nuevaIndisponibilidadButton"
                  class="aulas-primary-button"
                  type="button"
                >
                  <i
                    data-lucide="plus"
                    aria-hidden="true"
                  ></i>
                  Nueva indisponibilidad
                </button>
              `
              : ''
          }
        </div>

        ${renderizarIndisponibilidades(estado.indisponibilidadesAulaActual)}
      </section>

      ${renderizarSeccionOcupacion()}

      ${
        puedeConsultarAuditoriaAula()
          ? renderizarSeccionAuditoriaAula()
          : ''
      }
    `;

    inicializarControlesHorario(vista);

    const recargarDetalle = async () => {
      await abrirDetalleAula(estado.aulaDetalleActual.id, contexto, {
        onVolver,
      });
    };

    document
      .getElementById('volverAulasButton')
      ?.addEventListener('click', () => {
        if (typeof onVolver === 'function') {
          onVolver();
        }
      });

    document
      .getElementById('asignarEquipamientoButton')
      ?.addEventListener('click', () => {
        abrirFormularioEquipamientoAulaComponente({
          aula: estado.aulaDetalleActual,
          relacion: null,
          equipamientoAulaActual: estado.equipamientoAulaActual,
          catalogoEquipamientos: estado.catalogoEquipamientos,
          onActualizado: recargarDetalle,
          puedeGestionar: validarGestionAulas(),
        });
      });

    vista.querySelectorAll('[data-aula-equipo-action]').forEach((boton) => {
      boton.addEventListener('click', async () => {
        const id = Number(boton.dataset.equipamientoId);
        const relacion = estado.equipamientoAulaActual.find(
          (item) => item.equipamientoId === id,
        );

        if (!relacion) {
          return;
        }

        if (boton.dataset.aulaEquipoAction === 'editar') {
          abrirFormularioEquipamientoAulaComponente({
            aula: estado.aulaDetalleActual,
            relacion,
            equipamientoAulaActual: estado.equipamientoAulaActual,
            catalogoEquipamientos: estado.catalogoEquipamientos,
            onActualizado: recargarDetalle,
            puedeGestionar: validarGestionAulas(),
          });
          return;
        }

        if (boton.dataset.aulaEquipoAction === 'desasignar') {
          await desasignarEquipamientoDelAulaComponente({
            aula: estado.aulaDetalleActual,
            relacion,
            onActualizado: recargarDetalle,
            puedeGestionar: validarGestionAulas(),
          });
        }
      });
    });

    document
      .getElementById('nuevaIndisponibilidadButton')
      ?.addEventListener('click', () => {
        abrirFormularioIndisponibilidad(null, contexto, {
          onActualizado: recargarDetalle,
        });
      });

    vista
      .querySelectorAll('[data-indisponibilidad-action]')
      .forEach((boton) => {
        boton.addEventListener('click', async () => {
          const id = Number(boton.dataset.indisponibilidadId);
          const indisponibilidad = estado.indisponibilidadesAulaActual.find(
            (item) => item.id === id,
          );

          if (!indisponibilidad) {
            return;
          }

          if (boton.dataset.indisponibilidadAction === 'editar') {
            abrirFormularioIndisponibilidad(indisponibilidad, contexto, {
              onActualizado: recargarDetalle,
            });
            return;
          }

          await cambiarEstadoIndisponibilidad(indisponibilidad, contexto, {
            onActualizado: recargarDetalle,
          });
        });
      });

    configurarOcupacionAula(contexto);
    configurarDisponibilidadBaseAula(contexto);

    document
      .getElementById('cargarAuditoriaAulaButton')
      ?.addEventListener('click', () => cargarAuditoriaAula(contexto));

    if (typeof document !== 'undefined') {
      renderizarIconos();
    }
  } catch (error) {
    if (!contexto.esSubvistaVigente(instancia, subvistaToken)) {
      return;
    }

    mostrarError({
      titulo: 'No se pudo cargar el aula',
      mensaje: error?.message || 'No fue posible consultar la información.',
    });

    if (typeof onVolver === 'function') {
      onVolver();
    }
  }
}
