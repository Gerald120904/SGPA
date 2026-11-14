/**
 * SGPA — Selector académico dependiente (Carrera -> Plan -> Asignaturas) con protección de concurrencia.
 * FRONTEND-REFACTOR-FORMULARIOS-ESTUDIANTES-INTEGRAL-001
 */

import { listarPlanAsignaturas } from '../../services/plan-asignaturas.service.js';
import { escapeHtml } from '../../utils/html.js';
import {
  MODALIDADES_FORMULARIO,
  asignaturasElegiblesParaFormulario,
  agruparAsignaturasVistaPrevia,
} from './formularios-estudiantes.helpers.js';

export function inicializarSelectorAcademico(dialog, contexto, { onEstadoPlanCambiado, onLimpiarErrorPlan } = {}) {
  const buscarElemento = (selector) => {
    if (dialog && typeof dialog.querySelector === 'function') {
      const el = dialog.querySelector(selector);
      if (el) return el;
    }
    if (typeof document !== 'undefined') {
      return document.querySelector(selector);
    }
    return null;
  };

  const carreraInput = buscarElemento('#formularioCarrera');
  const planInput = buscarElemento('#formularioPlan');
  const proveedorInput = buscarElemento('#formularioProveedor');
  const resumen = buscarElemento('#formularioPlanResumen');

  let planSeleccionadoValido = false;
  let versionConsultaPlan = 0;

  const notificarEstado = (valido) => {
    planSeleccionadoValido = valido;
    onEstadoPlanCambiado?.(valido);
  };

  carreraInput?.addEventListener('change', () => {
    versionConsultaPlan += 1;
    contexto.incrementarGeneracionCarreraPlan();
    notificarEstado(false);
    onLimpiarErrorPlan?.();

    const carreraId = Number(carreraInput.value);
    const planesDisponibles = contexto?.estado?.planesDisponibles || [];
    const planesCarrera = planesDisponibles.filter((plan) => plan.carreraId === carreraId);

    if (planInput) {
      planInput.innerHTML = `
        <option value="" selected disabled>
          Seleccione un plan...
        </option>
        ${planesCarrera
          .map(
            (plan) => `
              <option value="${plan.id}">
                ${escapeHtml(plan.codigo)} - ${escapeHtml(plan.nombre)}
              </option>
            `,
          )
          .join('')}
      `;
      planInput.disabled = planesCarrera.length === 0;
    }

    if (resumen) {
      resumen.innerHTML = planesCarrera.length
        ? ''
        : `
            <small class="sgpa-field-help">
              Esta carrera no posee planes activos disponibles.
            </small>
          `;
    }
  });

  planInput?.addEventListener('change', async () => {
    const planId = Number(planInput.value);
    const versionActual = ++versionConsultaPlan;
    const tokenContexto = contexto.incrementarGeneracionCarreraPlan();
    const genInstancia = contexto.generacionInstancia;

    notificarEstado(false);

    if (!resumen || !planId) {
      return;
    }

    if (!MODALIDADES_FORMULARIO.has(proveedorInput?.value)) {
      resumen.innerHTML = `
        <div class="formularios-plan-preview formularios-plan-preview-warning">
          Seleccione la modalidad antes de consultar las asignaturas del plan.
        </div>
      `;
      return;
    }

    const consultaSigueVigente = () =>
      contexto.esCarreraPlanActiva(tokenContexto, genInstancia) &&
      versionActual === versionConsultaPlan &&
      Boolean(planInput.isConnected) &&
      Number(planInput.value) === planId;

    resumen.innerHTML = `
      <div class="formularios-plan-preview formularios-plan-preview-loading">
        Consultando estructura del plan...
      </div>
    `;

    try {
      const resultado = await listarPlanAsignaturas(planId);

      if (!consultaSigueVigente()) return;

      if (!resultado?.ok) {
        throw new Error(
          resultado?.message || 'No fue posible consultar las asignaturas.',
        );
      }

      const asignaturas = Array.isArray(resultado.asignaturas)
        ? resultado.asignaturas
        : [];

      const proveedor = proveedorInput?.value;
      const reales = asignaturasElegiblesParaFormulario(asignaturas, proveedor);

      notificarEstado(reales.length > 0);

      const estructura = agruparAsignaturasVistaPrevia(reales);
      const planesDisponibles = contexto?.estado?.planesDisponibles || [];
      const planSeleccionado = planesDisponibles.find((plan) => plan.id === planId);

      const tarjetas = [...estructura.entries()]
        .sort(([nivelA], [nivelB]) => nivelA - nivelB)
        .map(([nivel, ciclosNivel]) => `
          <article class="formularios-plan-preview-card">
            <h5>Año ${nivel}</h5>
            ${[...ciclosNivel.entries()]
              .sort(([cicloA], [cicloB]) => cicloA - cicloB)
              .map(([ciclo, cursos]) => `
                <div class="formularios-plan-preview-cycle">
                  <strong>Ciclo ${ciclo}</strong>
                  <ul>
                    ${cursos
                      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
                      .map((asignatura) => `
                        <li>
                          ${escapeHtml(asignatura.curso?.nombre || asignatura.nombreReferencia || '')}
                          <small>${escapeHtml(asignatura.curso?.codigo || asignatura.codigoReferencia || '')}</small>
                        </li>
                      `)
                      .join('')}
                  </ul>
                </div>
              `)
              .join('')}
          </article>
        `)
        .join('');

      resumen.innerHTML = `
        <section class="formularios-plan-preview ${
          reales.length ? '' : 'formularios-plan-preview-warning'
        }">
          <div class="formularios-plan-preview-heading">
            <div>
              <small>Plan seleccionado</small>
              <strong>${escapeHtml(
                planSeleccionado?.nombre || 'Plan de estudio',
              )}</strong>
            </div>
            <span>
              ${reales.length} asignatura${reales.length === 1 ? '' : 's'}
            </span>
          </div>
          ${
            reales.length
              ? `<div class="formularios-plan-preview-grid">${tarjetas}</div>`
              : `
                  <p>
                    Este plan no tiene asignaturas compatibles con la modalidad seleccionada
                    y no puede utilizarse para generar el formulario.
                  </p>
                `
          }
        </section>
      `;
    } catch (error) {
      if (!consultaSigueVigente()) return;
      notificarEstado(false);
      resumen.innerHTML = `
        <div class="formularios-plan-preview formularios-plan-preview-warning">
          No fue posible consultar las asignaturas de este plan.
          Cambie el plan o intente seleccionarlo nuevamente.
        </div>
      `;
    }
  });

  proveedorInput?.addEventListener('change', () => {
    const ayuda = buscarElemento('#formularioProveedorAyuda');
    if (ayuda) {
      ayuda.textContent = proveedorInput.value === 'INTERNO'
        ? 'El formulario institucional usa el plan de estudios del SGPA y se publica en este servidor.'
        : 'Google Forms requiere una cuenta Google conectada y solo admite asignaturas vinculadas a Curso.';
    }
    if (planInput?.value) {
      planInput.dispatchEvent(new Event('change'));
    }
  });

  return {
    esValido: () => planSeleccionadoValido,
  };
}
