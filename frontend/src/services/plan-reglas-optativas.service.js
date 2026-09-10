function validarApi(metodo) {
  if (!window.sgpa || typeof window.sgpa[metodo] !== "function") {
    throw new Error(`La API de Electron no tiene disponible "${metodo}".`);
  }
}

export async function obtenerReglaOptativasPlan(planId) {
  validarApi("obtenerReglaOptativasPlan");
  return window.sgpa.obtenerReglaOptativasPlan(planId);
}

export async function guardarReglaOptativasPlan(planId, datos) {
  validarApi("guardarReglaOptativasPlan");
  return window.sgpa.guardarReglaOptativasPlan(planId, datos);
}

export async function eliminarReglaOptativasPlan(planId) {
  validarApi("eliminarReglaOptativasPlan");
  return window.sgpa.eliminarReglaOptativasPlan(planId);
}
