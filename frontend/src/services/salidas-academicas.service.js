function validarApi(metodo) {
  if (!window.sgpa || typeof window.sgpa[metodo] !== "function") {
    throw new Error(`La API "${metodo}" no está disponible.`);
  }
}

export async function listarSalidasAcademicas(planId) {
  validarApi("listarSalidasAcademicas");
  return window.sgpa.listarSalidasAcademicas(planId);
}

export async function crearSalidaAcademica(planId, datos) {
  validarApi("crearSalidaAcademica");
  return window.sgpa.crearSalidaAcademica(planId, datos);
}

export async function actualizarSalidaAcademica(planId, salidaId, datos) {
  validarApi("actualizarSalidaAcademica");
  return window.sgpa.actualizarSalidaAcademica(planId, salidaId, datos);
}

export async function cambiarEstadoSalidaAcademica(planId, salidaId, activo) {
  validarApi("cambiarEstadoSalidaAcademica");
  return window.sgpa.cambiarEstadoSalidaAcademica(planId, salidaId, activo);
}

export async function reemplazarAsignaturasSalida(
  planId,
  salidaId,
  asignaturaIds,
) {
  validarApi("reemplazarAsignaturasSalida");
  return window.sgpa.reemplazarAsignaturasSalida(planId, salidaId, {
    asignaturaIds,
  });
}
