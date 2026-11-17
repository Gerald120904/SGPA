/**
 * Keeps the main process authentication credential and its lifecycle together.
 * Each login/logout starts a new epoch; context changes are ordered within it.
 */
export function crearEstadoSesionAutenticada() {
  let token = null;
  let epoca = 0;
  let secuenciaOperacion = 0;

  return {
    obtenerToken() {
      return token;
    },

    capturarSesion() {
      return token ? { epoca, operacion: secuenciaOperacion, token } : null;
    },

    iniciarLogin() {
      epoca += 1;
      secuenciaOperacion += 1;
      token = null;
      return { epoca, operacion: secuenciaOperacion };
    },

    confirmarLogin(contexto, nuevoToken) {
      if (!nuevoToken || contexto.epoca !== epoca || contexto.operacion !== secuenciaOperacion) return false;
      token = nuevoToken;
      return true;
    },

    loginSigueVigente(contexto) {
      return Boolean(contexto && contexto.epoca === epoca && contexto.operacion === secuenciaOperacion);
    },

    iniciarOperacionContexto() {
      if (!token) return null;
      secuenciaOperacion += 1;
      return { epoca, operacion: secuenciaOperacion, token };
    },

    sigueVigente(contexto) {
      return Boolean(
        contexto
        && contexto.epoca === epoca
        && contexto.token === token
        && contexto.operacion === secuenciaOperacion,
      );
    },

    confirmarTokenContexto(contexto, nuevoToken) {
      if (!nuevoToken || !this.sigueVigente(contexto) || contexto.operacion !== secuenciaOperacion) return false;
      token = nuevoToken;
      return true;
    },

    invalidarSiVigente(contexto) {
      if (!this.sigueVigente(contexto)) return false;
      epoca += 1;
      secuenciaOperacion += 1;
      token = null;
      return true;
    },

    cerrarSesion() {
      epoca += 1;
      secuenciaOperacion += 1;
      token = null;
    },
  };
}

export function invalidarSesionPor401(estadoSesion, contexto, status) {
  return status === 401 && estadoSesion.invalidarSiVigente(contexto);
}

const respuestaObsoleta = () => ({
  ok: false,
  status: 409,
  message: 'La sesión cambió durante la operación. Vuelva a intentarlo.',
});

/** Registers the existing context IPC channels with main-process freshness checks. */
export function registrarCambiosContextoAutenticado(ipcMain, estadoSesion, ejecutarPeticion) {
  ipcMain.handle('auth:cambiar-rol-activo', async (event, nuevoRol) => {
    const rendererDisponible = () => !event?.sender?.isDestroyed?.();
    const contexto = estadoSesion.iniciarOperacionContexto();
    if (!contexto) return { ok: false, status: 401, message: 'No existe una sesión activa.' };

    try {
      const resultado = await ejecutarPeticion('/auth/cambiar-rol-activo', {
        method: 'POST', body: { rol: nuevoRol }, contextoSesion: contexto,
      });
      if (!rendererDisponible() || !estadoSesion.sigueVigente(contexto)) return respuestaObsoleta();
      if (!resultado.ok) return resultado;

      if (!resultado.data?.accessToken) {
        return { ok: false, status: 502, message: 'El backend no devolvió la credencial del rol activo.' };
      }
      if (!estadoSesion.confirmarTokenContexto(contexto, resultado.data.accessToken)) {
        return respuestaObsoleta();
      }
      return {
        ok: true,
        usuario: resultado.data?.usuario,
        accessToken: resultado.data?.accessToken,
      };
    } catch {
      return estadoSesion.sigueVigente(contexto)
        ? { ok: false, status: 0, message: 'No se pudo cambiar el rol activo.' }
        : respuestaObsoleta();
    }
  });

  ipcMain.handle('auth:cambiar-carrera-activa', async (event, carreraId) => {
    const rendererDisponible = () => !event?.sender?.isDestroyed?.();
    const contexto = estadoSesion.iniciarOperacionContexto();
    if (!contexto) return { ok: false, status: 401, message: 'No existe una sesión activa.' };

    try {
      const resultado = await ejecutarPeticion('/auth/cambiar-carrera-activa', {
        method: 'POST', body: { carreraId }, contextoSesion: contexto,
      });
      if (!rendererDisponible() || !estadoSesion.sigueVigente(contexto)) return respuestaObsoleta();
      if (!resultado.ok) return resultado;

      if (!estadoSesion.confirmarTokenContexto(contexto, resultado.data?.accessToken)) return respuestaObsoleta();
      return { ok: true, usuario: resultado.data?.usuario };
    } catch {
      return estadoSesion.sigueVigente(contexto)
        ? { ok: false, status: 0, message: 'No fue posible cambiar la carrera activa.' }
        : respuestaObsoleta();
    }
  });
}
