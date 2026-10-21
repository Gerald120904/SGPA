function invocar(metodo, ...argumentos) {
  if (typeof window.sgpa?.[metodo] !== 'function') {
    throw new Error('La API segura de Electron no está disponible.');
  }
  return window.sgpa[metodo](...argumentos);
}

export const proponerCrearEstudiante = (datos) => invocar('proponerCrearEstudiante', datos);
export const proponerActualizarEstudiante = (id, datos) => invocar('proponerActualizarEstudiante', id, datos);
export const proponerEstadoEstudiante = (id, estado) => invocar('proponerEstadoEstudiante', id, estado);
export const proponerCambioPlanEstudiante = (id, datos) => invocar('proponerCambioPlanEstudiante', id, datos);
export const proponerResultadoEstudiante = (id, datos) => invocar('proponerResultadoEstudiante', id, datos);
export const proponerImportacionEstudiantes = (datos) => invocar('proponerImportacionEstudiantes', datos);
export const proponerCrearCurso = (datos) => invocar('proponerCrearCurso', datos);
export const proponerActualizarCurso = (id, datos) => invocar('proponerActualizarCurso', id, datos);
export const proponerEstadoCurso = (id, activo) => invocar('proponerEstadoCurso', id, activo);
export const proponerRequisitoCurso = (id, datos) => invocar('proponerRequisitoCurso', id, datos);
export const proponerEliminarRequisitoCurso = (id, relacionId) => invocar('proponerEliminarRequisitoCurso', id, relacionId);
export const proponerCrearPlan = (datos) => invocar('proponerCrearPlan', datos);
export const proponerActualizarPlan = (id, datos) => invocar('proponerActualizarPlan', id, datos);
export const proponerEstadoPlan = (id, activo) => invocar('proponerEstadoPlan', id, activo);
export const proponerAsignaturaPlan = (planId, datos) => invocar('proponerAsignaturaPlan', planId, datos);
export const proponerActualizarAsignaturaPlan = (planId, id, datos) => invocar('proponerActualizarAsignaturaPlan', planId, id, datos);
export const proponerEstadoAsignaturaPlan = (planId, id, activo) => invocar('proponerEstadoAsignaturaPlan', planId, id, activo);
export const proponerCargaMasivaAsignaturasPlan = (planId, datos) => invocar('proponerCargaMasivaAsignaturasPlan', planId, datos);
export const proponerRequisitoPlan = (planId, datos) => invocar('proponerRequisitoPlan', planId, datos);
export const proponerEliminarRequisitoPlan = (planId, id) => invocar('proponerEliminarRequisitoPlan', planId, id);
export const proponerCargaMasivaRequisitosPlan = (planId, datos) => invocar('proponerCargaMasivaRequisitosPlan', planId, datos);
export const proponerSalidaPlan = (planId, datos) => invocar('proponerSalidaPlan', planId, datos);
export const proponerActualizarSalidaPlan = (planId, id, datos) => invocar('proponerActualizarSalidaPlan', planId, id, datos);
export const proponerEstadoSalidaPlan = (planId, id, activo) => invocar('proponerEstadoSalidaPlan', planId, id, activo);
export const proponerAsignarAsignaturasSalidaPlan = (planId, id, datos) => invocar('proponerAsignarAsignaturasSalidaPlan', planId, id, datos);
export const proponerGuardarReglaOptativaPlan = (planId, datos) => invocar('proponerGuardarReglaOptativaPlan', planId, datos);
export const proponerEliminarReglaOptativaPlan = (planId) => invocar('proponerEliminarReglaOptativaPlan', planId);
export const proponerImportarPlan = (planId, datos) => invocar('proponerImportarPlan', planId, datos);
export const proponerCrearOptativa = (datos) => invocar('proponerCrearOptativa', datos);
export const proponerActualizarOptativa = (id, datos) => invocar('proponerActualizarOptativa', id, datos);
export const proponerEstadoOptativa = (id, activo) => invocar('proponerEstadoOptativa', id, activo);
export const listarMisSolicitudesCambio = () => invocar('listarMisSolicitudesCambio');
export const listarSolicitudesPendientesCambio = () => invocar('listarSolicitudesPendientesCambio');
export const aprobarSolicitudCambio = (id) => invocar('aprobarSolicitudCambio', id);
export const rechazarSolicitudCambio = (id, motivo) => invocar('rechazarSolicitudCambio', id, motivo);
