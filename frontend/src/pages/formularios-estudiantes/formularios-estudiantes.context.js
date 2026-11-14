/**
 * SGPA — Contexto central reactivo, tokens de concurrencia y ciclo de vida de Formularios de Estudiantes.
 * FRONTEND-REFACTOR-FORMULARIOS-ESTUDIANTES-INTEGRAL-001
 */

export function crearContextoFormularios() {
  let generacionInstancia = 0;
  let generacionCarreraPlan = 0;
  let generacionEstadoGoogle = 0;
  let focusHandler = null;
  let activo = false;
  let desconexionGoogleActiva = null;
  let cancelarConfirmacionDesconexion = null;

  const estado = {
    formularios: [],
    carrerasDisponibles: [],
    planesDisponibles: [],
    estadoGoogle: {
      conectado: false,
      requiereReautenticacion: false,
      estado: 'DESCONECTADO',
      googleEmail: null,
    },
    estaCargando: false,
    desconectandoGoogle: false,
    dialogoActivo: null,
  };

  return {
    estado,

    get generacionInstancia() {
      return generacionInstancia;
    },

    get generacionCarreraPlan() {
      return generacionCarreraPlan;
    },

    get generacionEstadoGoogle() {
      return generacionEstadoGoogle;
    },

    get activo() {
      return activo;
    },

    reservarDesconexionGoogle() {
      if (desconexionGoogleActiva) return null;
      const token = {};
      desconexionGoogleActiva = { token, fase: 'confirmacion' };
      cancelarConfirmacionDesconexion = null;
      return token;
    },

    registrarCanceladorDesconexion(token, callback) {
      if (desconexionGoogleActiva?.token !== token || typeof callback !== 'function') {
        return false;
      }
      cancelarConfirmacionDesconexion = callback;
      return true;
    },

    retirarCanceladorDesconexion(token) {
      if (desconexionGoogleActiva?.token !== token) return false;
      cancelarConfirmacionDesconexion = null;
      return true;
    },

    marcarDesconexionGoogleEnviada(token) {
      if (desconexionGoogleActiva?.token !== token) return false;
      desconexionGoogleActiva.fase = 'en-vuelo';
      return true;
    },

    liberarDesconexionGoogle(token) {
      if (desconexionGoogleActiva?.token !== token) return false;
      desconexionGoogleActiva = null;
      cancelarConfirmacionDesconexion = null;
      return true;
    },

    iniciar() {
      generacionInstancia += 1;
      generacionCarreraPlan += 1;
      generacionEstadoGoogle += 1;
      activo = true;
      estado.estaCargando = false;
      return generacionInstancia;
    },

    incrementarGeneracionCarreraPlan() {
      generacionCarreraPlan += 1;
      return generacionCarreraPlan;
    },

    incrementarGeneracionEstadoGoogle() {
      generacionEstadoGoogle += 1;
      return generacionEstadoGoogle;
    },

    esInstanciaActiva(gen) {
      return activo && gen === generacionInstancia;
    },

    esCarreraPlanActiva(genPlan, genInst = generacionInstancia) {
      return activo && genInst === generacionInstancia && genPlan === generacionCarreraPlan;
    },

    esEstadoGoogleActivo(genGoogle, genInst = generacionInstancia) {
      return activo && genInst === generacionInstancia && genGoogle === generacionEstadoGoogle;
    },

    registrarListenerFoco(callback) {
      if (typeof window === 'undefined') return;
      if (focusHandler) {
        if (typeof window.removeEventListener === 'function') {
          window.removeEventListener('focus', focusHandler);
        }
        focusHandler = null;
      }

      focusHandler = async () => {
        if (!activo) return;
        try {
          await callback();
        } catch (error) {
          console.error('Error al actualizar Formularios al recuperar foco:', error);
        }
      };

      if (typeof window.addEventListener === 'function') {
        window.addEventListener('focus', focusHandler);
      }
    },

    retirarListenerFoco() {
      if (typeof window === 'undefined') return;
      if (focusHandler) {
        if (typeof window.removeEventListener === 'function') {
          window.removeEventListener('focus', focusHandler);
        }
        focusHandler = null;
      }
    },

    destruir() {
      activo = false;
      generacionInstancia += 1;
      generacionCarreraPlan += 1;
      generacionEstadoGoogle += 1;
      if (desconexionGoogleActiva?.fase === 'confirmacion') {
        try {
          cancelarConfirmacionDesconexion?.();
        } catch (error) {
          console.error('No se pudo cerrar la confirmación de desconexión de Google:', error);
        }
        desconexionGoogleActiva = null;
        cancelarConfirmacionDesconexion = null;
      }
      this.retirarListenerFoco();

      if (typeof document !== 'undefined') {
        const dialog = document.getElementById('formularioEstudianteDialog');
        if (dialog && typeof dialog.close === 'function' && dialog.open) {
          try {
            dialog.close();
          } catch (_) {}
        }
      }

      estado.formularios = [];
      estado.carrerasDisponibles = [];
      estado.planesDisponibles = [];
      estado.dialogoActivo = null;
      estado.estaCargando = false;
      estado.desconectandoGoogle = false;
    },
  };
}

export const contextoFormulariosGlobal = crearContextoFormularios();
