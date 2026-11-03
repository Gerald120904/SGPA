function validarApi(metodo) {
  if (!window.sgpa || typeof window.sgpa[metodo] !== 'function') {
    throw new Error(`La API de Electron no tiene disponible "${metodo}".`);
  }
}

export async function consultarPoblacionTransicion(planOrigenId, carreraId) {
  validarApi('consultarPoblacionTransicion');
  return window.sgpa.consultarPoblacionTransicion(planOrigenId, carreraId);
}

export async function simularTransicionCurricular(datos) {
  validarApi('simularTransicionCurricular');
  return window.sgpa.simularTransicionCurricular(datos);
}

export async function ejecutarTransicionCurricular(datos) {
  validarApi('ejecutarTransicionCurricular');
  return window.sgpa.ejecutarTransicionCurricular(datos);
}

export async function listarLotesTransicionCurricular(carreraId, planOrigenId, planDestinoId) {
  validarApi('listarLotesTransicionCurricular');
  return window.sgpa.listarLotesTransicionCurricular(carreraId, planOrigenId, planDestinoId);
}

