function validarApi(metodo) {
  if (!window.sgpa || typeof window.sgpa[metodo] !== "function") {
    throw new Error(`La API de Electron no tiene disponible "${metodo}".`);
  }
}

export async function listarBloquesPlan(planId) {
  validarApi("listarBloquesPlan");
  return window.sgpa.listarBloquesPlan(planId);
}

export async function crearBloquePlan(planId, datos) {
  validarApi("crearBloquePlan");
  return window.sgpa.crearBloquePlan(planId, datos);
}

export async function actualizarBloquePlan(planId, bloqueId, datos) {
  validarApi("actualizarBloquePlan");
  return window.sgpa.actualizarBloquePlan(planId, bloqueId, datos);
}

export async function cambiarEstadoBloquePlan(planId, bloqueId, activo) {
  validarApi("cambiarEstadoBloquePlan");
  return window.sgpa.cambiarEstadoBloquePlan(planId, bloqueId, activo);
}
