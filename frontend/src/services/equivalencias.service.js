function validarApi(metodo) {
  if (!window.sgpa || typeof window.sgpa[metodo] !== 'function') {
    throw new Error(`La API de Electron no tiene disponible "${metodo}".`);
  }
}

export async function crearEquivalenciaPlan(datos) {
  validarApi('crearEquivalenciaPlan');
  return window.sgpa.crearEquivalenciaPlan(datos);
}

export async function listarEquivalenciasPlanes(planOrigenId, planDestinoId) {
  validarApi('listarEquivalenciasPlanes');
  return window.sgpa.listarEquivalenciasPlanes(planOrigenId, planDestinoId);
}

export async function eliminarEquivalenciaPlan(id) {
  validarApi('eliminarEquivalenciaPlan');
  return window.sgpa.eliminarEquivalenciaPlan(id);
}

export async function sugerirEquivalenciasEstudiante(estudianteId, nuevoPlanId) {
  validarApi('sugerirEquivalenciasEstudiante');
  return window.sgpa.sugerirEquivalenciasEstudiante(estudianteId, nuevoPlanId);
}

export async function aplicarEquivalenciasEstudiante(estudianteId, datos) {
  validarApi('aplicarEquivalenciasEstudiante');
  return window.sgpa.aplicarEquivalenciasEstudiante(estudianteId, datos);
}

