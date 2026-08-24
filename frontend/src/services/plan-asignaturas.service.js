function validarApi(metodo) {
  if (!window.sgpa || typeof window.sgpa[metodo] !== "function") {
    throw new Error(`La API de Electron no tiene disponible "${metodo}".`);
  }
}

export async function listarPlanAsignaturas(planId) {
  validarApi("listarPlanAsignaturas");
  return window.sgpa.listarPlanAsignaturas(planId);
}

export async function obtenerPlanAsignatura(planId, id) {
  validarApi("obtenerPlanAsignatura");
  return window.sgpa.obtenerPlanAsignatura(planId, id);
}

export async function crearPlanAsignatura(planId, datos) {
  validarApi("crearPlanAsignatura");
  return window.sgpa.crearPlanAsignatura(planId, datos);
}

export async function actualizarPlanAsignatura(planId, id, datos) {
  validarApi("actualizarPlanAsignatura");
  return window.sgpa.actualizarPlanAsignatura(planId, id, datos);
}

export async function cambiarEstadoPlanAsignatura(planId, id, activo) {
  validarApi("cambiarEstadoPlanAsignatura");
  return window.sgpa.cambiarEstadoPlanAsignatura(planId, id, activo);
}

export async function cargarAsignaturasMasivamente(planId, asignaturas) {
  validarApi("cargarAsignaturasMasivamente");
  return window.sgpa.cargarAsignaturasMasivamente(planId, {
    asignaturas,
  });
}
