function validarApi(metodo) {
  if (!window.sgpa || typeof window.sgpa[metodo] !== 'function') {
    throw new Error(`La API de Electron no tiene disponible "${metodo}".`);
  }
}

export async function listarPlanesEstudio() {
  validarApi('listarPlanesEstudio');
  return window.sgpa.listarPlanesEstudio();
}

export async function obtenerPlanEstudio(id) {
  validarApi('obtenerPlanEstudio');
  return window.sgpa.obtenerPlanEstudio(id);
}

export async function crearPlanEstudio(datos) {
  validarApi('crearPlanEstudio');
  return window.sgpa.crearPlanEstudio(datos);
}

export async function actualizarPlanEstudio(id, datos) {
  validarApi('actualizarPlanEstudio');
  return window.sgpa.actualizarPlanEstudio(id, datos);
}

export async function cambiarEstadoPlanEstudio(id, activo) {
  validarApi('cambiarEstadoPlanEstudio');
  return window.sgpa.cambiarEstadoPlanEstudio(id, activo);
}
