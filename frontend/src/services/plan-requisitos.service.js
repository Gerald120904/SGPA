function validarApi(metodo) {
  if (!window.sgpa || typeof window.sgpa[metodo] !== "function") {
    throw new Error(`La API de Electron no tiene disponible "${metodo}".`);
  }
}

export async function listarPlanRequisitos(planId) {
  validarApi("listarPlanRequisitos");
  return window.sgpa.listarPlanRequisitos(planId);
}

export async function crearPlanRequisito(planId, datos) {
  validarApi("crearPlanRequisito");
  return window.sgpa.crearPlanRequisito(planId, datos);
}

export async function eliminarPlanRequisito(planId, id) {
  validarApi("eliminarPlanRequisito");
  return window.sgpa.eliminarPlanRequisito(planId, id);
}

export async function cargarRequisitosMasivamente(planId, requisitos) {
  validarApi("cargarRequisitosMasivamente");
  return window.sgpa.cargarRequisitosMasivamente(planId, {
    requisitos,
  });
}
