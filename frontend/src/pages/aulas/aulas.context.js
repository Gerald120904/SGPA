/**
 * SGPA — Contexto interno, estado compartido, permisos y ciclo de vida de Aulas.
 */

import { usuarioTienePermiso } from '../../app/session.js';
import { PERMISOS } from '../../config/permissions.js';
import { mostrarError } from '../../components/AlertModal.js';

export const AULAS_POR_PAGINA = 10;

export function puedeGestionarAulas() {
  return usuarioTienePermiso(PERMISOS.AULAS_GESTIONAR);
}

export function puedeAsignarAulas() {
  return usuarioTienePermiso(PERMISOS.AULAS_ASIGNAR);
}

export function puedeVerPeriodos() {
  return usuarioTienePermiso(PERMISOS.PERIODOS_VER);
}

export function puedeBuscarAulasDisponibles() {
  return usuarioTienePermiso(PERMISOS.AULAS_VER) && puedeVerPeriodos();
}

export function puedeUsarEvaluacionAula() {
  return puedeAsignarAulas() && puedeVerPeriodos();
}

export function puedeEvaluarAulaParaAsignacion() {
  return puedeAsignarAulas();
}

export function puedeConsultarAuditoriaAula() {
  return puedeGestionarAulas();
}

export function validarGestionAulas() {
  if (puedeGestionarAulas()) {
    return true;
  }

  mostrarError({
    titulo: 'Acceso restringido',
    mensaje: 'No posee permiso para gestionar aulas.',
  });

  return false;
}

/**
 * Crea una fuente única de estado y control de concurrencia/limpieza para el módulo Aulas.
 */
export function crearContextoAulas() {
  const limpiezasVista = [];

  const estado = {
    aulas: [],
    catalogoEquipamientos: [],
    equipamientoAulaActual: [],
    indisponibilidadesAulaActual: [],
    reservasAulaActual: [],
    ocupacionAulaActual: null,
    periodosDisponibilidadAula: [],
    periodoDisponibilidadActual: null,
    disponibilidadBaseAulaActual: [],
    periodosBusquedaAulas: [],
    equipamientosBusquedaAulas: [],
    aulasDisponiblesActual: [],
    criteriosBusquedaAulasActual: null,
    auditoriaAulaActual: [],
    aulaDetalleActual: null,
    instanciaActual: 0,
    subvistaToken: 0,
    disponibilidadToken: 0,
    ocupacionToken: 0,
    auditoriaToken: 0,
    busquedaToken: 0,
    vistaAulasActual: 'LISTA',
    paginaAulasActual: 1,
    aulaPlanoSeleccionadaId: null,
    pisoEdificio2Actual: 3,
    selectorPisoEdificio2Abierto: false,
  };

  function registrarLimpiezaVista(fn) {
    if (typeof fn === 'function') {
      limpiezasVista.push(fn);
    }
  }

  function limpiarVista() {
    while (limpiezasVista.length) {
      const limpiar = limpiezasVista.pop();
      try {
        limpiar();
      } catch {
        // Evitar que la limpieza de una vista anterior bloquee el siguiente montaje.
      }
    }

    if (typeof document !== 'undefined') {
      document.getElementById('aulasPlanoActionDialog')?.remove();
    }
  }

  function iniciarInstancia() {
    estado.instanciaActual += 1;
    estado.subvistaToken += 1;
    estado.disponibilidadToken += 1;
    estado.ocupacionToken += 1;
    estado.auditoriaToken += 1;
    estado.busquedaToken += 1;
    estado.paginaAulasActual = 1;
    limpiarVista();

    return {
      instancia: estado.instanciaActual,
      subvistaToken: estado.subvistaToken,
    };
  }

  function iniciarSubvista() {
    estado.subvistaToken += 1;
    estado.disponibilidadToken += 1;
    estado.ocupacionToken += 1;
    estado.auditoriaToken += 1;
    estado.busquedaToken += 1;
    limpiarVista();

    return {
      instancia: estado.instanciaActual,
      subvistaToken: estado.subvistaToken,
    };
  }

  function esInstanciaVigente(instancia) {
    return instancia === estado.instanciaActual;
  }

  function esSubvistaVigente(instancia, subvistaToken) {
    return (
      instancia === estado.instanciaActual &&
      subvistaToken === estado.subvistaToken
    );
  }

  function siguienteTokenDisponibilidad() {
    estado.disponibilidadToken += 1;
    return {
      instancia: estado.instanciaActual,
      subvistaToken: estado.subvistaToken,
      token: estado.disponibilidadToken,
    };
  }

  function esDisponibilidadVigente(marca) {
    return (
      esSubvistaVigente(marca.instancia, marca.subvistaToken) &&
      marca.token === estado.disponibilidadToken
    );
  }

  function siguienteTokenOcupacion() {
    estado.ocupacionToken += 1;
    return {
      instancia: estado.instanciaActual,
      subvistaToken: estado.subvistaToken,
      token: estado.ocupacionToken,
    };
  }

  function esOcupacionVigente(marca) {
    return (
      esSubvistaVigente(marca.instancia, marca.subvistaToken) &&
      marca.token === estado.ocupacionToken
    );
  }

  function siguienteTokenAuditoria() {
    estado.auditoriaToken += 1;
    return {
      instancia: estado.instanciaActual,
      subvistaToken: estado.subvistaToken,
      token: estado.auditoriaToken,
    };
  }

  function esAuditoriaVigente(marca) {
    return (
      esSubvistaVigente(marca.instancia, marca.subvistaToken) &&
      marca.token === estado.auditoriaToken
    );
  }

  function siguienteTokenBusqueda() {
    estado.busquedaToken += 1;
    return {
      instancia: estado.instanciaActual,
      subvistaToken: estado.subvistaToken,
      token: estado.busquedaToken,
    };
  }

  function esBusquedaVigente(marca) {
    return (
      esSubvistaVigente(marca.instancia, marca.subvistaToken) &&
      marca.token === estado.busquedaToken
    );
  }

  return {
    estado,
    registrarLimpiezaVista,
    limpiarVista,
    iniciarInstancia,
    iniciarSubvista,
    esInstanciaVigente,
    esSubvistaVigente,
    siguienteTokenDisponibilidad,
    esDisponibilidadVigente,
    siguienteTokenOcupacion,
    esOcupacionVigente,
    siguienteTokenAuditoria,
    esAuditoriaVigente,
    siguienteTokenBusqueda,
    esBusquedaVigente,
  };
}
