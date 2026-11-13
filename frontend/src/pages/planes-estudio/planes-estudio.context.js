/**
 * SGPA — Contenedor de estado compartido y ciclo de vida para Planes de Estudio.
 *
 * Gestiona variables de estado, sincronización de instancias concurrentes,
 * controladores de eventos con AbortController y observadores DOM.
 */

import { puedeGestionarPlanes } from "./planes.helpers.js";

export function crearContextoPlanesEstudio() {
  const estado = {
    planes: [],
    carrerasDisponibles: [],
    asignaturasPlan: [],
    filasRequisitosRapidos: [],
    requisitosPlan: [],
    salidasAcademicas: [],
    resumenPlan: null,
    reglaOptativasPlan: {
      regla: null,
      cantidadEspaciosOptativos: 0,
      cantidadEspaciosConfigurados: 0,
      conteoActual: null,
    },
    planSeleccionado: null,
    instanciaActual: 0,
    cargaDetalleActual: 0,
    vistaDetallePlan: "LISTA",
    vistaPapeleraPlan: false,
    observerMalla: null,
    frameDibujoMalla: null,
    mallaAsignaturaSeleccionadaId: null,
    nivelPaginaPlan: 1,
    detalleEventosController: null,
    paginaEventosController: null,
  };

  return {
    estado,

    iniciarInstancia() {
      estado.instanciaActual += 1;
      estado.cargaDetalleActual += 1;
      const instancia = estado.instanciaActual;

      estado.detalleEventosController?.abort();
      estado.detalleEventosController = null;
      estado.paginaEventosController?.abort();
      estado.paginaEventosController = new AbortController();

      return {
        instancia,
        signal: estado.paginaEventosController.signal,
      };
    },

    esInstanciaVigente(instancia) {
      return instancia === estado.instanciaActual;
    },

    iniciarCargaDetalle(plan) {
      estado.cargaDetalleActual += 1;
      estado.planSeleccionado = plan;
      return {
        token: estado.cargaDetalleActual,
        instancia: estado.instanciaActual,
        planId: plan?.id,
      };
    },

    esCargaDetalleVigente(carga) {
      return Boolean(
        carga &&
          carga.token === estado.cargaDetalleActual &&
          carga.instancia === estado.instanciaActual &&
          estado.planSeleccionado?.id === carga.planId,
      );
    },

    iniciarDetalleEventos() {
      estado.detalleEventosController?.abort();
      estado.detalleEventosController = new AbortController();
      return estado.detalleEventosController;
    },

    cancelarDetalleEventos() {
      estado.detalleEventosController?.abort();
      estado.detalleEventosController = null;
    },

    limpiarObserverMalla() {
      if (estado.observerMalla) {
        try {
          estado.observerMalla.disconnect();
        } catch {
          // No-op ante desconexiones previas
        }
        estado.observerMalla = null;
      }
      if (estado.frameDibujoMalla !== null) {
        try {
          if (
            typeof window !== "undefined" &&
            typeof window.cancelAnimationFrame === "function"
          ) {
            window.cancelAnimationFrame(estado.frameDibujoMalla);
          }
        } catch {
          // No-op
        }
        estado.frameDibujoMalla = null;
      }
    },

    obtenerAsignaturaPorId(id) {
      return estado.asignaturasPlan.find(
        (item) => Number(item.id) === Number(id),
      );
    },

    puedeGestionar() {
      return puedeGestionarPlanes();
    },

    resetearDetalle() {
      estado.cargaDetalleActual += 1;
      this.cancelarDetalleEventos();
      this.limpiarObserverMalla();
      estado.planSeleccionado = null;
      estado.asignaturasPlan = [];
      estado.requisitosPlan = [];
      estado.salidasAcademicas = [];
      estado.resumenPlan = null;
      estado.mallaAsignaturaSeleccionadaId = null;
      estado.vistaPapeleraPlan = false;
      estado.nivelPaginaPlan = 1;
    },
  };
}
