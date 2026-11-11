/**
 * SGPA — Comparador Visual de Planes y Transición Curricular Institucional.
 * FRONTEND-REF-DEEP-002
 */

import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  crearEquivalenciaPlan,
  listarEquivalenciasPlanes,
  eliminarEquivalenciaPlan,
} from '../../services/equivalencias.service.js';
import {
  consultarPoblacionTransicion,
  simularTransicionCurricular,
  ejecutarTransicionCurricular,
} from '../../services/transiciones-curriculares.service.js';
import {
  listarPlanAsignaturas,
} from '../../services/plan-asignaturas.service.js';
import { obtenerPresentacionEstadoPlan } from './plan-status-presentation.mjs';

export async function abrirComparadorPlanes(paramsOrCarreraId = null, maybePlanOrigenId = null) {
  let planes = [];
  let carrerasDisponibles = [];
  let carreraIdInicial = null;
  let planOrigenIdInicial = null;
  let puedeGestionarPlanes = () => false;
  let mostrarFeedback = () => { };

  if (paramsOrCarreraId && typeof paramsOrCarreraId === 'object' && !('id' in paramsOrCarreraId)) {
    planes = paramsOrCarreraId.planes || [];
    carrerasDisponibles = paramsOrCarreraId.carrerasDisponibles || [];
    carreraIdInicial = paramsOrCarreraId.carreraIdInicial || null;
    planOrigenIdInicial = paramsOrCarreraId.planOrigenIdInicial || null;
    const puedeRaw = paramsOrCarreraId.puedeGestionarPlanes ?? paramsOrCarreraId.puedeGestionar;
    puedeGestionarPlanes = typeof puedeRaw === 'function' ? puedeRaw : () => Boolean(puedeRaw);
    mostrarFeedback = typeof paramsOrCarreraId.mostrarFeedback === 'function' ? paramsOrCarreraId.mostrarFeedback : () => { };
  } else {
    carreraIdInicial = paramsOrCarreraId;
    planOrigenIdInicial = maybePlanOrigenId;
  }
  const dialog = document.getElementById("comparadorPlanesDialog");
  const content = document.getElementById("comparadorPlanesDialogContent");
  if (!dialog || !content) return;
  if (dialog.open) return;

  let carreraId = carreraIdInicial || (carrerasDisponibles.length > 0 ? carrerasDisponibles[0].id : null);
  let planOrigenId = planOrigenIdInicial || null;
  let planDestinoId = null;
  let asignaturasOrigen = [];
  let asignaturasDestino = [];
  let equivalencias = [];
  let seleccionadasOrigen = new Set();
  let seleccionadasDestino = new Set();
  let solicitudActual = 0;
  let vigente = true;
  let cargando = false;
  let errorCarga = "";
  dialog.addEventListener("close", () => {
    vigente = false;
    solicitudActual += 1;
  }, { once: true });

  function normalizarPlanes() {
    const planesCarrera = planes.filter((p) => !carreraId || Number(p.carreraId) === Number(carreraId));
    if (!planesCarrera.some((p) => Number(p.id) === Number(planOrigenId))) {
      planOrigenId = planesCarrera[0]?.id || null;
    }
    if (planDestinoId === null && planesCarrera.length > 1) {
      planDestinoId = planesCarrera.find((p) => Number(p.id) !== Number(planOrigenId))?.id || null;
    }
    return planesCarrera;
  }

  async function refrescarDatosPlanes() {
    normalizarPlanes();
    const solicitud = ++solicitudActual;
    asignaturasOrigen = [];
    asignaturasDestino = [];
    equivalencias = [];
    seleccionadasOrigen.clear();
    seleccionadasDestino.clear();
    errorCarga = "";
    if (planOrigenId && planDestinoId && Number(planOrigenId) !== Number(planDestinoId)) {
      const origenConsultado = planOrigenId;
      const destinoConsultado = planDestinoId;
      cargando = true;
      renderVistaComparador();
      try {
        const [resOrigen, resDestino, resEq] = await Promise.all([
          listarPlanAsignaturas(origenConsultado),
          listarPlanAsignaturas(destinoConsultado),
          listarEquivalenciasPlanes(origenConsultado, destinoConsultado),
        ]);
        if (!vigente || solicitud !== solicitudActual) return;
        if (resOrigen?.ok === false || resDestino?.ok === false || resEq?.ok === false) {
          throw new Error(resOrigen?.message || resDestino?.message || resEq?.message || "No fue posible consultar las asignaturas y equivalencias.");
        }
        asignaturasOrigen = Array.isArray(resOrigen?.asignaturas) ? resOrigen.asignaturas : [];
        asignaturasDestino = Array.isArray(resDestino?.asignaturas) ? resDestino.asignaturas : [];
        equivalencias = Array.isArray(resEq?.data) ? resEq.data : (Array.isArray(resEq) ? resEq : []);
      } catch (error) {
        if (!vigente || solicitud !== solicitudActual) return;
        errorCarga = error?.message || "No fue posible consultar el comparador de planes.";
      }
    } else {
      cargando = false;
      if (planOrigenId && planDestinoId && Number(planOrigenId) === Number(planDestinoId)) {
        mostrarFeedback("El plan de origen y destino deben ser diferentes.", "error");
      }
    }
    if (!vigente || solicitud !== solicitudActual) return;
    cargando = false;
    renderVistaComparador();
  }

  function renderVistaComparador() {
    const planesCarrera = normalizarPlanes();

    const eqOrigenIds = new Set(equivalencias.map((e) => e.asignaturaOrigenId));
    const eqDestinoIds = new Set(equivalencias.map((e) => e.asignaturaDestinoId));

    const body = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; background: #f8fafc; padding: 12px; border-radius: 8px;">
          <label>
            <span style="font-weight: 600; font-size: 13px;">Carrera</span>
            <select id="compCarreraSelect" class="planes-select" style="width: 100%; margin-top: 4px;">
              ${carrerasDisponibles.map((c) => `<option value="${c.id}" ${Number(c.id) === Number(carreraId) ? 'selected' : ''}>${escapeHtml(c.codigo)} - ${escapeHtml(c.nombre)}</option>`).join('')}
            </select>
          </label>
          <label>
            <span style="font-weight: 600; font-size: 13px;">Plan Origen</span>
            <select id="compPlanOrigenSelect" class="planes-select" style="width: 100%; margin-top: 4px;">
              <option value="">Seleccione plan origen...</option>
              ${planesCarrera.map((p) => `<option value="${p.id}" ${Number(p.id) === Number(planOrigenId) ? 'selected' : ''}>${escapeHtml(p.codigo)} - ${escapeHtml(p.nombre)} (${escapeHtml(obtenerPresentacionEstadoPlan(p).etiqueta)})</option>`).join('')}
            </select>
          </label>
          <label>
            <span style="font-weight: 600; font-size: 13px;">Plan Destino</span>
            <select id="compPlanDestinoSelect" class="planes-select" style="width: 100%; margin-top: 4px;">
              <option value="">Seleccione plan destino...</option>
              ${planesCarrera.map((p) => `<option value="${p.id}" ${Number(p.id) === Number(planDestinoId) ? 'selected' : ''}>${escapeHtml(p.codigo)} - ${escapeHtml(p.nombre)} (${escapeHtml(obtenerPresentacionEstadoPlan(p).etiqueta)})</option>`).join('')}
            </select>
          </label>
        </div>

        ${errorCarga ? `<div class="planes-message planes-error" role="alert">${escapeHtml(errorCarga)}</div>` : ''}
        ${cargando ? '<div class="planes-message" role="status">Consultando asignaturas y equivalencias...</div>' : ''}
        ${!cargando && planOrigenId && planDestinoId && Number(planOrigenId) !== Number(planDestinoId) ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- Columna Izquierda: Plan Origen -->
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff;">
              <div style="font-weight: 700; color: #1e293b; margin-bottom: 8px; display: flex; justify-content: space-between;">
                <span>Malla Plan Origen (${asignaturasOrigen.length} asignaturas)</span>
                <span style="font-size: 12px; color: #64748b;">Seleccionadas: <strong id="countSelOrigen">${seleccionadasOrigen.size}</strong></span>
              </div>
              <div style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                ${asignaturasOrigen.length === 0 ? '<p>No hay asignaturas en el plan de origen.</p>' : asignaturasOrigen.map((a) => {
      const tieneEq = eqOrigenIds.has(a.id);
      const isChecked = seleccionadasOrigen.has(a.id);
      return `
                    <label style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; background: ${isChecked ? '#eff6ff' : (tieneEq ? '#f8fafc' : '#fffbeb')}; border: 1px solid ${isChecked ? '#93c5fd' : '#e2e8f0'}; cursor: pointer;">
                      <input type="checkbox" data-origen-id="${a.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer;">
                      <div style="flex: 1; font-size: 13px;">
                        <strong>${escapeHtml(a.curso?.codigo || a.codigoReferencia || '—')}</strong> ${escapeHtml(a.curso?.nombre || a.nombreReferencia || '—')}
                        <small style="color: #64748b; margin-left: 6px;">(${a.creditos} créditos)</small>
                      </div>
                      ${tieneEq ? `<span style="font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px;">Vinculada</span>` : `<span style="font-size: 11px; background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px;">Sin eq.</span>`}
                    </label>
                  `;
    }).join('')}
              </div>
            </div>

            <!-- Columna Derecha: Plan Destino -->
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff;">
              <div style="font-weight: 700; color: #1e293b; margin-bottom: 8px; display: flex; justify-content: space-between;">
                <span>Malla Plan Destino (${asignaturasDestino.length} asignaturas)</span>
                <span style="font-size: 12px; color: #64748b;">Seleccionadas: <strong id="countSelDestino">${seleccionadasDestino.size}</strong></span>
              </div>
              <div style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                ${asignaturasDestino.length === 0 ? '<p>No hay asignaturas en el plan de destino.</p>' : asignaturasDestino.map((a) => {
      const tieneEq = eqDestinoIds.has(a.id);
      const isChecked = seleccionadasDestino.has(a.id);
      return `
                    <label style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; background: ${isChecked ? '#f0fdf4' : (tieneEq ? '#f8fafc' : '#f8fafc')}; border: 1px solid ${isChecked ? '#86efac' : '#e2e8f0'}; cursor: pointer;">
                      <input type="checkbox" data-destino-id="${a.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer;">
                      <div style="flex: 1; font-size: 13px;">
                        <strong>${escapeHtml(a.curso?.codigo || a.codigoReferencia || '—')}</strong> ${escapeHtml(a.curso?.nombre || a.nombreReferencia || '—')}
                        <small style="color: #64748b; margin-left: 6px;">(${a.creditos} créditos)</small>
                      </div>
                      ${tieneEq ? `<span style="font-size: 11px; background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px;">Equivalente</span>` : ''}
                    </label>
                  `;
    }).join('')}
              </div>
            </div>
          </div>

          <!-- Barra de Creación de Equivalencia -->
          ${puedeGestionarPlanes() ? `
          <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 250px;">
              <input type="text" id="compEqJustificacion" placeholder="Justificación o resolución institucional (opcional)..." class="planes-input" style="width: 100%; min-height: 38px; padding: 0 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
            </div>
            <button id="compBtnCrearEq" type="button" class="planes-primary-button" style="min-height: 38px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
              <i data-lucide="link" aria-hidden="true"></i> Vincular Equivalencia (${seleccionadasOrigen.size} a ${seleccionadasDestino.size})
            </button>
          </div>
          ` : ''}

          <!-- Tabla de Equivalencias Registradas -->
          <div style="margin-top: 8px;">
            <div style="font-weight: 700; color: #1e293b; margin-bottom: 6px;">Equivalencias Registradas entre estos Planes (${equivalencias.length})</div>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0;">
                  <tr>
                    <th style="padding: 8px; text-align: left;">Materia Origen</th>
                    <th style="padding: 8px; text-align: left;">Materia Destino</th>
                    <th style="padding: 8px; text-align: left;">Tipo / Justificación</th>
                    <th style="padding: 8px; text-align: center; width: 60px;">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${equivalencias.length === 0 ? `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #64748b;">No hay equivalencias registradas entre estos dos planes.</td></tr>` : equivalencias.map((eq) => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px;"><strong>${escapeHtml(eq.asignaturaOrigen?.curso?.codigo || eq.asignaturaOrigen?.codigoReferencia || '#' + eq.asignaturaOrigenId)}</strong> — ${escapeHtml(eq.asignaturaOrigen?.curso?.nombre || eq.asignaturaOrigen?.nombreReferencia || '')}</td>
                      <td style="padding: 8px;"><strong>${escapeHtml(eq.asignaturaDestino?.curso?.codigo || eq.asignaturaDestino?.codigoReferencia || '#' + eq.asignaturaDestinoId)}</strong> — ${escapeHtml(eq.asignaturaDestino?.curso?.nombre || eq.asignaturaDestino?.nombreReferencia || '')}</td>
                      <td style="padding: 8px; font-size: 12px; color: #475569;">${escapeHtml(eq.justificacion || 'Equivalencia 1:1')}</td>
                      <td style="padding: 8px; text-align: center;">
                        ${puedeGestionarPlanes() ? `<button type="button" data-del-eq="${eq.id}" class="planes-icon-button planes-danger-button" title="Eliminar equivalencia" style="padding: 4px 6px;">
                          <i data-lucide="trash-2" aria-hidden="true"></i>
                        </button>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : cargando ? '' : `
          <div style="text-align: center; padding: 32px; background: #f8fafc; border-radius: 8px; color: #64748b;">
            ${planOrigenId && planDestinoId && Number(planOrigenId) === Number(planDestinoId)
          ? '<span style="color: #b45309; font-weight: 600;">El plan de origen y de destino no pueden ser el mismo. Seleccione dos planes distintos para realizar la comparación.</span>'
          : (planesCarrera.length === 0 ? 'No hay planes de estudio disponibles para esta carrera.' : 'Se necesitan al menos dos planes de estudio distintos para comparar sus asignaturas.')}
          </div>
        `}
      </div>
    `;

    content.innerHTML = FormDialog({
      formId: "comparadorPlanesForm",
      title: "Comparador Visual de Planes y Equivalencias Institucionales",
      description: "Visualice de forma paralela el plan origen y destino para vincular equivalencias (1:1, N:1 o 1:N) y detectar materias sin equivalencia.",
      body,
      cancelButtonId: "cerrarComparadorBtn",
      cancelText: "Cerrar",
      layout: "custom",
      formClass: "comparador-dialog",
    });

    renderizarIconos();
    if (!dialog.open) dialog.showModal();
    habilitarCierreExterior(dialog);

    document.getElementById("cerrarComparadorBtn")?.addEventListener("click", () => dialog.close());

    document.getElementById("compCarreraSelect")?.addEventListener("change", (e) => {
      carreraId = e.target.value ? Number(e.target.value) : null;
      planOrigenId = null;
      planDestinoId = null;
      refrescarDatosPlanes();
    });

    document.getElementById("compPlanOrigenSelect")?.addEventListener("change", (e) => {
      planOrigenId = e.target.value ? Number(e.target.value) : null;
      if (planOrigenId && planDestinoId && Number(planOrigenId) === Number(planDestinoId)) {
        const planesCarrera = planes.filter((p) => !carreraId || Number(p.carreraId) === Number(carreraId));
        planDestinoId = planesCarrera.find((p) => Number(p.id) !== Number(planOrigenId))?.id || null;
      }
      refrescarDatosPlanes();
    });

    document.getElementById("compPlanDestinoSelect")?.addEventListener("change", (e) => {
      planDestinoId = e.target.value ? Number(e.target.value) : null;
      refrescarDatosPlanes();
    });

    content.querySelectorAll("[data-origen-id]").forEach((chk) => {
      chk.addEventListener("change", (e) => {
        const id = Number(e.target.dataset.origenId);
        if (e.target.checked) seleccionadasOrigen.add(id);
        else seleccionadasOrigen.delete(id);
        const countSpan = document.getElementById("countSelOrigen");
        if (countSpan) countSpan.textContent = seleccionadasOrigen.size;
        const btn = document.getElementById("compBtnCrearEq");
        if (btn) btn.innerHTML = `<i data-lucide="link" aria-hidden="true"></i> Vincular Equivalencia (${seleccionadasOrigen.size} a ${seleccionadasDestino.size})`;
        renderizarIconos();
      });
    });

    content.querySelectorAll("[data-destino-id]").forEach((chk) => {
      chk.addEventListener("change", (e) => {
        const id = Number(e.target.dataset.destinoId);
        if (e.target.checked) seleccionadasDestino.add(id);
        else seleccionadasDestino.delete(id);
        const countSpan = document.getElementById("countSelDestino");
        if (countSpan) countSpan.textContent = seleccionadasDestino.size;
        const btn = document.getElementById("compBtnCrearEq");
        if (btn) btn.innerHTML = `<i data-lucide="link" aria-hidden="true"></i> Vincular Equivalencia (${seleccionadasOrigen.size} a ${seleccionadasDestino.size})`;
        renderizarIconos();
      });
    });

    content.querySelectorAll("[data-del-eq]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!puedeGestionarPlanes()) return;
        const id = Number(btn.dataset.delEq);
        const conf = await confirmarAccion({
          titulo: "Eliminar equivalencia",
          mensaje: "¿Desea desactivar esta equivalencia institucional entre los planes?",
          peligro: true,
          textoConfirmar: "Eliminar",
        });
        if (!conf) return;
        try {
          const res = await eliminarEquivalenciaPlan(id);
          if (res?.ok === false) throw new Error(res.message);
          mostrarFeedback("Equivalencia eliminada correctamente.");
          await refrescarDatosPlanes();
        } catch (err) {
          mostrarFeedback(err?.message || "No fue posible eliminar la equivalencia.", "error");
        }
      });
    });

    document.getElementById("compBtnCrearEq")?.addEventListener("click", async () => {
      if (!puedeGestionarPlanes()) return;
      if (seleccionadasOrigen.size === 0 || seleccionadasDestino.size === 0) {
        mostrarFeedback("Debe seleccionar al menos una materia de origen y una de destino.", "error");
        return;
      }

      const origenIds = Array.from(seleccionadasOrigen);
      const destinoIds = Array.from(seleccionadasDestino);
      const justificacion = document.getElementById("compEqJustificacion")?.value?.trim() || "";

      let payload = {
        carreraOrigenId: carreraId,
        planOrigenId,
        carreraDestinoId: carreraId,
        planDestinoId,
        justificacion,
      };

      if (origenIds.length === 1 && destinoIds.length === 1) {
        payload.asignaturaOrigenId = origenIds[0];
        payload.asignaturaDestinoId = destinoIds[0];
        payload.tipoEquivalencia = 'INDIVIDUAL';
      } else if (origenIds.length > 1 && destinoIds.length === 1) {
        payload.asignaturasOrigenIds = origenIds;
        payload.asignaturaDestinoId = destinoIds[0];
        payload.tipoEquivalencia = 'N_A_1';
      } else if (origenIds.length === 1 && destinoIds.length > 1) {
        payload.asignaturaOrigenId = origenIds[0];
        payload.asignaturasDestinoIds = destinoIds;
        payload.tipoEquivalencia = '1_A_N';
      } else {
        mostrarFeedback("Las equivalencias complejas deben ser N a 1 o 1 a N.", "error");
        return;
      }

      try {
        const res = await crearEquivalenciaPlan(payload);
        if (res?.ok === false) throw new Error(res.message);
        mostrarFeedback("Equivalencia institucional registrada correctamente.");
        await refrescarDatosPlanes();
      } catch (err) {
        mostrarFeedback(err?.message || "No fue posible registrar la equivalencia.", "error");
      }
    });
  }

  await refrescarDatosPlanes();
}


/* =========================================================
   TRANSICIÓN CURRICULAR INSTITUCIONAL
   ========================================================= */

let transicionGlobalEnVuelo = null;
let contadorInstanciasTransicion = 0;
let instanciaActivaTransicionId = 0;

export async function abrirTransicionCurricular(paramsOrPlanOrigenId = null) {
  let planes = [];
  let carrerasDisponibles = [];
  let planOrigenIdInicial = null;
  let puedeGestionarPlanes = () => false;
  let mostrarFeedback = () => { };

  if (paramsOrPlanOrigenId && typeof paramsOrPlanOrigenId === 'object' && !('id' in paramsOrPlanOrigenId)) {
    planes = paramsOrPlanOrigenId.planes || [];
    carrerasDisponibles = paramsOrPlanOrigenId.carrerasDisponibles || [];
    planOrigenIdInicial = paramsOrPlanOrigenId.planOrigenIdInicial || null;
    const puedeRaw = paramsOrPlanOrigenId.puedeGestionarPlanes ?? paramsOrPlanOrigenId.puedeGestionar;
    puedeGestionarPlanes = typeof puedeRaw === 'function' ? puedeRaw : () => Boolean(puedeRaw);
    mostrarFeedback = typeof paramsOrPlanOrigenId.mostrarFeedback === 'function' ? paramsOrPlanOrigenId.mostrarFeedback : () => { };
  } else {
    planOrigenIdInicial = paramsOrPlanOrigenId;
  }
  const dialog = document.getElementById("transicionCurricularDialog");
  const content = document.getElementById("transicionCurricularDialogContent");
  if (!dialog || !content) return;

  const miInstanciaId = ++contadorInstanciasTransicion;
  instanciaActivaTransicionId = miInstanciaId;

  let carreraId = planes.find((plan) => Number(plan.id) === Number(planOrigenIdInicial))?.carreraId
    || carrerasDisponibles[0]?.id || null;
  let planOrigenId = planOrigenIdInicial || null;
  let planDestinoId = null;
  let simulacion = null;
  let simulacionContexto = null;
  let poblacion = null;
  let poblacionContexto = null;
  let tokenPoblacion = 0;
  let tokenSimulacion = 0;
  let cargandoPoblacion = false;
  let simulacionEnCurso = false;
  let transicionEjecucionEnCurso = false;
  const estudiantesSeleccionados = new Set();

  function invalidarSimulacion() {
    tokenSimulacion += 1;
    simulacion = null;
    simulacionContexto = null;
    simulacionEnCurso = false;
  }

  function invalidarPoblacion() {
    tokenPoblacion += 1;
    poblacion = null;
    poblacionContexto = null;
    cargandoPoblacion = false;
    estudiantesSeleccionados.clear();
    invalidarSimulacion();
  }

  dialog.addEventListener("close", () => {
    if (instanciaActivaTransicionId === miInstanciaId) {
      instanciaActivaTransicionId = 0;
    }
    invalidarPoblacion();
    invalidarSimulacion();
    transicionEjecucionEnCurso = false;
  });

  function esSimulacionVigente() {
    if (!simulacion || !simulacionContexto || simulacionEnCurso) return false;
    return (
      instanciaActivaTransicionId === miInstanciaId &&
      Number(carreraId) === Number(simulacionContexto.carreraId) &&
      Number(planOrigenId) === Number(simulacionContexto.planOrigenId) &&
      Number(planDestinoId) === Number(simulacionContexto.planDestinoId)
    );
  }

  async function cargarPoblacion() {
    if (!carreraId || !planOrigenId) {
      mostrarFeedback("Seleccione carrera y plan origen.", "error");
      return;
    }

    tokenPoblacion += 1;
    const solicitudToken = tokenPoblacion;
    const snapshotPoblacion = {
      token: solicitudToken,
      instanciaId: miInstanciaId,
      carreraId: Number(carreraId),
      planOrigenId: Number(planOrigenId),
    };

    cargandoPoblacion = true;
    poblacion = null;
    poblacionContexto = null;
    estudiantesSeleccionados.clear();
    invalidarSimulacion();
    renderVistaTransicion();

    try {
      const res = await consultarPoblacionTransicion(snapshotPoblacion.planOrigenId, snapshotPoblacion.carreraId);

      if (
        !dialog.open ||
        instanciaActivaTransicionId !== miInstanciaId ||
        solicitudToken !== tokenPoblacion
      ) {
        return;
      }
      if (
        Number(carreraId) !== snapshotPoblacion.carreraId ||
        Number(planOrigenId) !== snapshotPoblacion.planOrigenId
      ) {
        return;
      }

      if (res?.ok === false) throw new Error(res.message);
      const candidatos = res.data || res;
      if (!Array.isArray(candidatos)) throw new Error("La consulta no devolvió una lista válida.");

      poblacion = candidatos;
      poblacionContexto = snapshotPoblacion;
      cargandoPoblacion = false;
      estudiantesSeleccionados.clear();
      candidatos.forEach((estudiante) => estudiantesSeleccionados.add(Number(estudiante.id)));
      invalidarSimulacion();
      renderVistaTransicion();
    } catch (err) {
      if (
        !dialog.open ||
        instanciaActivaTransicionId !== miInstanciaId ||
        solicitudToken !== tokenPoblacion
      ) {
        return;
      }
      if (
        Number(carreraId) !== snapshotPoblacion.carreraId ||
        Number(planOrigenId) !== snapshotPoblacion.planOrigenId
      ) {
        return;
      }
      cargandoPoblacion = false;
      renderVistaTransicion();
      mostrarFeedback(err?.message || "No fue posible cargar los estudiantes.", "error");
    } finally {
      if (solicitudToken === tokenPoblacion && instanciaActivaTransicionId === miInstanciaId) {
        cargandoPoblacion = false;
      }
    }
  }

  async function ejecutarSimulacion() {
    if (!carreraId || !planOrigenId || !planDestinoId) {
      mostrarFeedback("Seleccione carrera, plan origen y plan destino.", "error");
      return;
    }
    if (planOrigenId === planDestinoId) {
      mostrarFeedback("El plan de origen y destino deben ser diferentes.", "error");
      return;
    }

    if (cargandoPoblacion) {
      mostrarFeedback("La carga de estudiantes está en curso. Espere a que finalice.", "error");
      return;
    }

    if (
      !poblacion ||
      !poblacionContexto ||
      Number(carreraId) !== Number(poblacionContexto.carreraId) ||
      Number(planOrigenId) !== Number(poblacionContexto.planOrigenId)
    ) {
      mostrarFeedback("Debe consultar la población del plan seleccionado antes de simular.", "error");
      return;
    }

    if (estudiantesSeleccionados.size === 0) {
      mostrarFeedback("Cargue y seleccione al menos un estudiante antes de simular.", "error");
      return;
    }

    const idsValidos = new Set(poblacion.map((e) => Number(e.id)));
    const hayObsoletos = Array.from(estudiantesSeleccionados).some((id) => !idsValidos.has(id));
    if (hayObsoletos) {
      mostrarFeedback("La selección contiene estudiantes no vigentes en la población actual.", "error");
      return;
    }

    tokenSimulacion += 1;
    const solicitudToken = tokenSimulacion;
    const snapshotContexto = {
      token: solicitudToken,
      instanciaId: miInstanciaId,
      carreraId: Number(carreraId),
      planOrigenId: Number(planOrigenId),
      planDestinoId: Number(planDestinoId),
      estudianteIds: Array.from(estudiantesSeleccionados).map(Number).sort((a, b) => a - b),
    };

    simulacion = null;
    simulacionContexto = null;
    simulacionEnCurso = true;

    try {
      const res = await simularTransicionCurricular({
        carreraId: snapshotContexto.carreraId,
        planOrigenId: snapshotContexto.planOrigenId,
        planDestinoId: snapshotContexto.planDestinoId,
        estudianteIds: snapshotContexto.estudianteIds,
      });

      if (
        !dialog.open ||
        instanciaActivaTransicionId !== miInstanciaId ||
        solicitudToken !== tokenSimulacion
      ) {
        return;
      }
      if (
        Number(carreraId) !== snapshotContexto.carreraId ||
        Number(planOrigenId) !== snapshotContexto.planOrigenId ||
        Number(planDestinoId) !== snapshotContexto.planDestinoId
      ) {
        return;
      }

      if (res?.ok === false) throw new Error(res.message);
      const data = res.data || res;
      if (!Array.isArray(data?.estudiantes)) {
        throw new Error("La simulación no devolvió una lista de estudiantes válida.");
      }

      simulacion = data;
      simulacionContexto = snapshotContexto;
      simulacionEnCurso = false;
      renderVistaTransicion();
    } catch (err) {
      if (
        !dialog.open ||
        instanciaActivaTransicionId !== miInstanciaId ||
        solicitudToken !== tokenSimulacion
      ) {
        return;
      }
      simulacionEnCurso = false;
      mostrarFeedback(err?.message || "Error al simular la transición curricular.", "error");
    } finally {
      if (solicitudToken === tokenSimulacion) {
        simulacionEnCurso = false;
      }
    }
  }

  async function confirmarYEjecutarTransicion() {
    if (!puedeGestionarPlanes()) {
      mostrarFeedback("No tiene permisos para ejecutar transiciones curriculares.", "error");
      return;
    }
    if (transicionGlobalEnVuelo !== null) {
      mostrarFeedback("Ya existe una transición curricular en proceso en el servidor. Espere a que finalice.", "error");
      return;
    }
    if (transicionEjecucionEnCurso) return;
    if (simulacionEnCurso) {
      mostrarFeedback("Hay una simulación en curso. Espere a que finalice.", "error");
      return;
    }
    if (!simulacion || !simulacionContexto) {
      mostrarFeedback("Debe ejecutar una simulación válida antes de trasladar.", "error");
      return;
    }
    if (
      Number(carreraId) !== Number(simulacionContexto.carreraId) ||
      Number(planOrigenId) !== Number(simulacionContexto.planOrigenId) ||
      Number(planDestinoId) !== Number(simulacionContexto.planDestinoId)
    ) {
      mostrarFeedback("La simulación no coincide con los planes seleccionados. Simule nuevamente.", "error");
      return;
    }

    const elegibles = (simulacion.estudiantes || []).filter((estudiante) => estudiante.puedeMigrar);
    const motivo = document.getElementById("tcMotivoEjecucion")?.value?.trim();
    if (!elegibles.length) {
      mostrarFeedback("No hay estudiantes sin conflictos listos para trasladar.", "error");
      return;
    }
    if (!motivo || motivo.length < 5) {
      mostrarFeedback("Indique un motivo institucional de al menos cinco caracteres.", "error");
      return;
    }

    const ejecucionContexto = {
      token: simulacionContexto.token,
      instanciaId: miInstanciaId,
      carreraId: Number(carreraId),
      planOrigenId: Number(planOrigenId),
      planDestinoId: Number(planDestinoId),
      estudianteIds: elegibles.map((estudiante) => Number(estudiante.estudianteId)),
      motivo,
      totalElegibles: elegibles.length,
      totalSimulados: simulacion.estudiantes.length,
      conflictosCount: simulacion.estudiantes.length - elegibles.length,
    };

    transicionEjecucionEnCurso = true;
    const botonEjecutar = document.getElementById('tcBtnEjecutar');
    if (botonEjecutar) {
      botonEjecutar.disabled = true;
      botonEjecutar.textContent = 'Confirmación en curso…';
    }
    try {
      const planOrigen = planes.find((plan) => Number(plan.id) === Number(planOrigenId));
      const planDestino = planes.find((plan) => Number(plan.id) === Number(planDestinoId));
      const primeraConfirmacion = await confirmarAccion({
        titulo: 'Revisar traslado curricular',
        mensaje: `Estudiantes seleccionados: ${estudiantesSeleccionados.size}. Plan origen: ${planOrigen?.codigo || planOrigen?.nombre || planOrigenId}. Plan destino: ${planDestino?.codigo || planDestino?.nombre || planDestinoId}. Resumen: ${elegibles.length} elegible(s) de ${simulacion.estudiantes.length}; ${simulacion.estudiantes.length - elegibles.length} con conflicto(s). Se procesará cada estudiante elegible de forma independiente. Motivo: ${motivo}`,
        textoConfirmar: 'Continuar a confirmación final', peligro: false,
      });
      if (!primeraConfirmacion) return;

      if (!dialog.open || instanciaActivaTransicionId !== miInstanciaId || !puedeGestionarPlanes()) {
        mostrarFeedback("Operación cancelada: el estado de la sesión o diálogo ha cambiado.", "error");
        return;
      }
      if (
        Number(carreraId) !== ejecucionContexto.carreraId ||
        Number(planOrigenId) !== ejecucionContexto.planOrigenId ||
        Number(planDestinoId) !== ejecucionContexto.planDestinoId ||
        !simulacionContexto ||
        simulacionContexto.token !== ejecucionContexto.token
      ) {
        mostrarFeedback("La selección de planes cambió durante la confirmación. Traslado cancelado.", "error");
        return;
      }

      const confirmacionFinal = await confirmarAccion({
        titulo: 'Autorizar ejecución definitiva',
        mensaje: `Esta confirmación autoriza definitivamente el traslado de ${elegibles.length} estudiante(s) elegible(s) al plan ${planDestino?.codigo || planDestino?.nombre || planDestinoId}.`,
        textoConfirmar: 'Sí, ejecutar traslado', peligro: true,
      });
      if (!confirmacionFinal) return;

      if (!dialog.open || instanciaActivaTransicionId !== miInstanciaId || !puedeGestionarPlanes()) {
        mostrarFeedback("Operación cancelada: el estado de la sesión o diálogo ha cambiado.", "error");
        return;
      }
      if (
        Number(carreraId) !== ejecucionContexto.carreraId ||
        Number(planOrigenId) !== ejecucionContexto.planOrigenId ||
        Number(planDestinoId) !== ejecucionContexto.planDestinoId ||
        !simulacionContexto ||
        simulacionContexto.token !== ejecucionContexto.token
      ) {
        mostrarFeedback("La selección de planes cambió durante la confirmación final. Traslado cancelado.", "error");
        return;
      }

      // Adquirir bloqueo global antes de enviar solicitud al servidor
      transicionGlobalEnVuelo = {
        instanciaId: miInstanciaId,
        carreraId: ejecucionContexto.carreraId,
        planOrigenId: ejecucionContexto.planOrigenId,
        planDestinoId: ejecucionContexto.planDestinoId,
        estudianteIds: [...ejecucionContexto.estudianteIds],
      };

      const response = await ejecutarTransicionCurricular({
        carreraId: ejecucionContexto.carreraId,
        planOrigenId: ejecucionContexto.planOrigenId,
        planDestinoId: ejecucionContexto.planDestinoId,
        estudianteIds: ejecucionContexto.estudianteIds,
        motivo: ejecucionContexto.motivo,
      });
      if (response?.ok === false) throw new Error(response.message || 'No fue posible ejecutar la transición.');
      const result = response?.data || response;
      const failures = Array.isArray(result.fallidos) ? result.fallidos : [];
      const summary = `Traslado procesado: ${result.migrados || 0}/${result.solicitados || ejecucionContexto.totalElegibles} estudiantes; ${failures.length} con error individual.`;

      const sigueInstanciaVigente = (
        dialog.open &&
        instanciaActivaTransicionId === miInstanciaId &&
        Number(carreraId) === ejecucionContexto.carreraId &&
        Number(planOrigenId) === ejecucionContexto.planOrigenId &&
        Number(planDestinoId) === ejecucionContexto.planDestinoId
      );

      if (sigueInstanciaVigente) {
        invalidarSimulacion();
        await cargarPoblacion();
        mostrarFeedback(summary, failures.length ? "error" : "success");
      }
    } catch (error) {
      const sigueInstanciaVigente = (
        dialog.open &&
        instanciaActivaTransicionId === miInstanciaId
      );
      if (sigueInstanciaVigente) {
        mostrarFeedback(error?.message || "No fue posible ejecutar la transición curricular.", "error");
      }
    } finally {
      transicionGlobalEnVuelo = null;
      transicionEjecucionEnCurso = false;
      if (dialog.open && instanciaActivaTransicionId === miInstanciaId) {
        const botonActual = document.getElementById("tcBtnEjecutar");
        if (botonActual) {
          const puedeMigrar = simulacion && (simulacion.estudiantes || []).some((estudiante) => estudiante.puedeMigrar);
          botonActual.disabled = !puedeMigrar || !esSimulacionVigente() || !puedeGestionarPlanes();
          botonActual.textContent = `Ejecutar traslado de ${simulacion?.totalMigrables || 0} estudiante(s) elegible(s)`;
        }
      }
    }
  }

  function renderVistaTransicion() {
    const planesCarrera = planes.filter((p) => !carreraId || Number(p.carreraId) === Number(carreraId));
    if (!planOrigenId && planesCarrera.length > 0) planOrigenId = planesCarrera[0].id;
    if (!planDestinoId && planesCarrera.length > 1) {
      planDestinoId = planesCarrera.find((p) => Number(p.id) !== Number(planOrigenId))?.id || planesCarrera[1].id;
    }

    const body = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; background: #f8fafc; padding: 12px; border-radius: 8px;">
          <label>
            <span style="font-weight: 600; font-size: 13px;">Carrera</span>
            <select id="tcCarreraSelect" class="planes-select" style="width: 100%; margin-top: 4px;">
              ${carrerasDisponibles.map((c) => `<option value="${c.id}" ${Number(c.id) === Number(carreraId) ? 'selected' : ''}>${escapeHtml(c.codigo)} - ${escapeHtml(c.nombre)}</option>`).join('')}
            </select>
          </label>
          <label>
            <span style="font-weight: 600; font-size: 13px;">Plan Origen (Plan a cerrar o migrar)</span>
            <select id="tcPlanOrigenSelect" class="planes-select" style="width: 100%; margin-top: 4px;">
              <option value="">Seleccione plan origen...</option>
              ${planesCarrera.map((p) => `<option value="${p.id}" ${Number(p.id) === Number(planOrigenId) ? 'selected' : ''}>${escapeHtml(p.codigo)} - ${escapeHtml(p.nombre)}</option>`).join('')}
            </select>
          </label>
          <label>
            <span style="font-weight: 600; font-size: 13px;">Plan Destino (Nuevo plan vigente)</span>
            <select id="tcPlanDestinoSelect" class="planes-select" style="width: 100%; margin-top: 4px;">
              <option value="">Seleccione plan destino...</option>
              ${planesCarrera.map((p) => `<option value="${p.id}" ${Number(p.id) === Number(planDestinoId) ? 'selected' : ''}>${escapeHtml(p.codigo)} - ${escapeHtml(p.nombre)}</option>`).join('')}
            </select>
          </label>
          <div style="display: flex; align-items: flex-end;">
            <button id="tcBtnSimular" type="button" class="planes-primary-button" style="width: 100%; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
              <i data-lucide="zap" aria-hidden="true"></i> Simular Transición
            </button>
          </div>
        </div>

        ${planesCarrera.length < 2 ? `<div class="planes-message">${planesCarrera.length === 0 ? 'No hay planes de estudio disponibles para esta carrera.' : 'Se necesitan al menos dos planes de estudio para simular una transición.'}</div>` : ''}
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
          <button id="tcBtnCargarPoblacion" type="button" class="planes-primary-button" ${cargandoPoblacion ? 'disabled' : ''}>${cargandoPoblacion ? 'Consultando población…' : 'Cargar estudiantes del plan origen'}</button>
          ${cargandoPoblacion ? `<p style="margin-top: 8px; color: #64748b;">Consultando estudiantes del plan origen…</p>` : poblacion ? `<div style="margin-top: 12px;">
            <label><input id="tcSeleccionarTodos" type="checkbox" ${poblacion.length > 0 && estudiantesSeleccionados.size === poblacion.length ? 'checked' : ''}> Seleccionar todos (${poblacion.length})</label>
            <span style="margin-left: 12px;">Seleccionados: ${estudiantesSeleccionados.size}</span>
            <div style="max-height: 180px; overflow-y: auto; margin-top: 8px;">
              ${poblacion.map((estudiante) => `<label style="display: block; padding: 4px;"><input type="checkbox" data-tc-estudiante="${Number(estudiante.id)}" ${estudiantesSeleccionados.has(Number(estudiante.id)) ? 'checked' : ''}> ${escapeHtml(estudiante.nombreCompleto)} (${escapeHtml(estudiante.cedula)})</label>`).join('') || '<p>No hay estudiantes activos en este plan.</p>'}
            </div>
          </div>` : '<p>Consulte la población para seleccionar expedientes antes de simular.</p>'}
        </div>
        ${simulacion ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
            <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; border-left: 4px solid #64748b;">
              <small style="color: #64748b; font-weight: 600;">TOTAL ANALIZADOS</small>
              <div style="font-size: 22px; font-weight: 700; color: #1e293b;">${simulacion.totalAnalizados}</div>
            </div>
            <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; border-left: 4px solid #22c55e;">
              <small style="color: #16a34a; font-weight: 600;">SIN CONFLICTOS EN LA SIMULACIÓN</small>
              <div style="font-size: 22px; font-weight: 700; color: #15803d;">${simulacion.totalMigrables}</div>
            </div>
            <div style="background: ${simulacion.totalConflictos > 0 ? '#fef2f2' : '#f8fafc'}; padding: 12px; border-radius: 8px; border-left: 4px solid ${simulacion.totalConflictos > 0 ? '#ef4444' : '#cbd5e1'};">
              <small style="color: ${simulacion.totalConflictos > 0 ? '#dc2626' : '#64748b'}; font-weight: 600;">CON CONFLICTOS (N:1 incompleta)</small>
              <div style="font-size: 22px; font-weight: 700; color: ${simulacion.totalConflictos > 0 ? '#b91c1c' : '#475569'};">${simulacion.totalConflictos}</div>
            </div>
          </div>

          <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background: #f8fafc; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
              <span><strong>Estudiantes candidatos</strong> (${simulacion.estudiantes.length})</span>
            </div>
            <div style="max-height: 260px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead style="background: #ffffff; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0;">
                  <tr>
                    <th style="padding: 8px; text-align: left;">Estudiante</th>
                    <th style="padding: 8px; text-align: left;">Reconocidas en Destino</th>
                    <th style="padding: 8px; text-align: left;">Sin Equivalencia (Historial)</th>
                    <th style="padding: 8px; text-align: left;">Diagnóstico / Conflictos</th>
                  </tr>
                </thead>
                <tbody>
                  ${simulacion.estudiantes.length === 0 ? '<tr><td colspan="4" style="padding: 16px; text-align: center;">No hay estudiantes en el plan de origen para esta simulación.</td></tr>' : simulacion.estudiantes.map((est) => `
                      <tr style="border-bottom: 1px solid #f1f5f9; background: ${est.puedeMigrar ? '#ffffff' : '#fff5f5'};">
                        <td style="padding: 8px;">
                          <strong>${escapeHtml(est.nombreCompleto)}</strong>
                          <div style="font-size: 11px; color: #64748b;">${escapeHtml(est.cedula)}</div>
                        </td>
                        <td style="padding: 8px;">
                          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                            ${est.asignaturasReconocidas.length === 0 ? '<span style="color: #94a3b8; font-size: 12px;">Ninguna</span>' : est.asignaturasReconocidas.map((r) => `<span style="font-size: 11px; background: #dcfce7; color: #166534; padding: 2px 5px; border-radius: 4px;" title="${escapeHtml(r.nombre)}">${escapeHtml(r.codigo)}</span>`).join('')}
                          </div>
                        </td>
                        <td style="padding: 8px;">
                          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                            ${est.asignaturasSinEquivalencia.length === 0 ? '<span style="color: #94a3b8; font-size: 12px;">Ninguna</span>' : est.asignaturasSinEquivalencia.map((s) => `<span style="font-size: 11px; background: #f1f5f9; color: #475569; padding: 2px 5px; border-radius: 4px;" title="${escapeHtml(s.nombre)}">${escapeHtml(s.codigo)}</span>`).join('')}
                          </div>
                        </td>
                        <td style="padding: 8px;">
                          ${est.puedeMigrar ? `<span style="font-size: 12px; color: #16a34a; font-weight: 600;">✓ Sin conflictos en la simulación</span>` : `<div style="font-size: 11px; color: #dc2626;">${est.conflictos.map((c) => escapeHtml(c)).join('<br>')}</div>`}
                        </td>
                      </tr>
                    `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 8px;">
            <p>Se trasladarán únicamente los estudiantes elegibles. Los demás quedarán identificados como fallidos sin cancelar a los estudiantes confirmados.</p>
            <label>Motivo institucional
              <textarea id="tcMotivoEjecucion" class="planes-input" minlength="5" maxlength="500" style="display:block; width:100%; min-height:64px;"></textarea>
            </label>
            <button id="tcBtnEjecutar" type="button" class="planes-primary-button" ${simulacion?.totalMigrables && esSimulacionVigente() && puedeGestionarPlanes() && transicionGlobalEnVuelo === null ? '' : 'disabled'}>
              Ejecutar traslado de ${simulacion.totalMigrables} estudiante(s) elegible(s)
            </button>
            ${!puedeGestionarPlanes() ? `<p style="font-size: 12px; color: #64748b; margin: 0;">Modo consulta: no dispone de permisos para autorizar traslados curriculares definitivos.</p>` : ''}
          </div>
        ` : ''}
      </div>
    `;

    content.innerHTML = FormDialog({
      formId: "transicionCurricularForm",
      title: "Transición Curricular Institucional",
      description: "Simule el impacto de una transición entre planes. La simulación es de solo lectura y no modifica expedientes.",
      body,
      cancelButtonId: "cerrarTransicionBtn",
      cancelText: "Cerrar",
      layout: "custom",
      formClass: "transicion-dialog",
    });

    renderizarIconos();
    if (!dialog.open) dialog.showModal();
    habilitarCierreExterior(dialog);

    document.getElementById("cerrarTransicionBtn")?.addEventListener("click", () => dialog.close());

    document.getElementById("tcCarreraSelect")?.addEventListener("change", (e) => {
      carreraId = e.target.value ? Number(e.target.value) : null;
      planOrigenId = null;
      planDestinoId = null;
      invalidarPoblacion();
      renderVistaTransicion();
    });

    document.getElementById("tcPlanOrigenSelect")?.addEventListener("change", (e) => {
      planOrigenId = e.target.value ? Number(e.target.value) : null;
      invalidarPoblacion();
      renderVistaTransicion();
    });

    document.getElementById("tcPlanDestinoSelect")?.addEventListener("change", (e) => {
      planDestinoId = e.target.value ? Number(e.target.value) : null;
      invalidarSimulacion();
      renderVistaTransicion();
    });

    document.getElementById("tcBtnCargarPoblacion")?.addEventListener("click", cargarPoblacion);
    document.getElementById("tcSeleccionarTodos")?.addEventListener("change", (event) => {
      estudiantesSeleccionados.clear();
      if (event.target.checked && poblacion) poblacion.forEach((estudiante) => estudiantesSeleccionados.add(Number(estudiante.id)));
      invalidarSimulacion();
      renderVistaTransicion();
    });
    content.querySelectorAll("[data-tc-estudiante]").forEach((checkbox) => {
      checkbox.addEventListener("change", (event) => {
        const id = Number(event.target.dataset.tcEstudiante);
        if (event.target.checked) estudiantesSeleccionados.add(id);
        else estudiantesSeleccionados.delete(id);
        invalidarSimulacion();
        renderVistaTransicion();
      });
    });
    document.getElementById("tcBtnSimular")?.addEventListener("click", ejecutarSimulacion);
    document.getElementById("tcBtnEjecutar")?.addEventListener("click", confirmarYEjecutarTransicion);


  }

  renderVistaTransicion();
}
