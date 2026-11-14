/**
 * SGPA — Contenedor de estado compartido y ciclo de vida para Perfiles Académicos.
 */

export function crearContextoPerfilesAcademicos() {
  const estado = {
    perfiles: [],
    carreras: [],
    perfilActual: null,
    areasActuales: [],
    requisitosActuales: [],
    instanciaActual: 0,
    detalleToken: 0,
    eventosController: null,
    operacionesPendientes: new Map(),
  };

  return {
    estado,

    iniciarInstancia() {
      estado.instanciaActual += 1;
      estado.detalleToken += 1;
      if (estado.eventosController) {
        try {
          estado.eventosController.abort();
        } catch {
          // No-op
        }
      }
      estado.eventosController = new AbortController();
      return {
        instancia: estado.instanciaActual,
        signal: estado.eventosController.signal,
      };
    },

    esInstanciaVigente(instancia) {
      return instancia === estado.instanciaActual;
    },

    iniciarDetalle(id) {
      estado.detalleToken += 1;
      return {
        token: estado.detalleToken,
        instancia: estado.instanciaActual,
        id,
      };
    },

    esDetalleVigente(marca) {
      return Boolean(
        marca &&
        marca.instancia === estado.instanciaActual &&
        marca.token === estado.detalleToken
      );
    },

    resetear() {
      estado.perfiles = [];
      estado.carreras = [];
      estado.perfilActual = null;
      estado.areasActuales = [];
      estado.requisitosActuales = [];
    },

    reservarOperacion(clave, instancia) {
      if (estado.operacionesPendientes.has(clave)) return null;
      const token = Symbol(clave);
      estado.operacionesPendientes.set(clave, {
        token,
        instancia,
        enviada: false,
      });
      return token;
    },

    marcarOperacionEnviada(clave, token) {
      const operacion = estado.operacionesPendientes.get(clave);
      if (!operacion || operacion.token !== token) return false;
      operacion.enviada = true;
      return true;
    },

    liberarOperacion(clave, token) {
      if (estado.operacionesPendientes.get(clave)?.token !== token) return false;
      estado.operacionesPendientes.delete(clave);
      return true;
    },

    destruir() {
      const instanciaDestruida = estado.instanciaActual;
      estado.instanciaActual += 1;
      estado.detalleToken += 1;
      if (estado.eventosController) {
        try {
          estado.eventosController.abort();
        } catch {
          // No-op
        }
        estado.eventosController = null;
      }
      this.resetear();
      for (const [clave, operacion] of estado.operacionesPendientes) {
        if (operacion.instancia === instanciaDestruida && !operacion.enviada) {
          estado.operacionesPendientes.delete(clave);
        }
      }
    },
  };
}
