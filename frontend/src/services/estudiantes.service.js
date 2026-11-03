function validarApi(metodo) {
  if (
    !window.sgpa ||
    typeof window.sgpa[metodo] !==
      'function'
  ) {
    throw new Error(
      `La API de Electron no tiene disponible "${metodo}".`
    );
  }
}

export async function contarEstudiantesPorCarrera() {
  validarApi(
    'contarEstudiantesPorCarrera'
  );

  return window.sgpa
    .contarEstudiantesPorCarrera();
}

export async function contarEstudiantesPorPlan(
  carreraId
) {
  validarApi(
    'contarEstudiantesPorPlan'
  );

  return window.sgpa
    .contarEstudiantesPorPlan(
      carreraId
    );
}

export async function listarEstudiantes(
  filtros = {}
) {
  validarApi(
    'listarEstudiantes'
  );

  return window.sgpa
    .listarEstudiantes(
      filtros
    );
}

export async function obtenerEstudiante(id) {
  validarApi('obtenerEstudiante');

  return window.sgpa
    .obtenerEstudiante(id);
}

export async function actualizarEstudiante(
  id,
  datos
) {
  validarApi('actualizarEstudiante');

  return window.sgpa
    .actualizarEstudiante(
      id,
      datos
    );
}

export async function crearEstudiante(datos) {
  validarApi('crearEstudiante');

  return window.sgpa
    .crearEstudiante(datos);
}

export async function cambiarEstadoEstudiante(
  id,
  estado
) {
  validarApi(
    'cambiarEstadoEstudiante'
  );

  return window.sgpa
    .cambiarEstadoEstudiante(
      id,
      estado
    );
}

export async function cambiarPlanEstudiante(
  id,
  datos
) {
  validarApi(
    'cambiarPlanEstudiante'
  );

  return window.sgpa
    .cambiarPlanEstudiante(
      id,
      datos
    );
}

export async function obtenerHistorialAcademicoEstudiante(
  id
) {
  validarApi(
    'obtenerHistorialAcademicoEstudiante'
  );

  return window.sgpa
    .obtenerHistorialAcademicoEstudiante(
      id
    );
}

export async function obtenerHistorialPlanesEstudiante(
  id
) {
  validarApi(
    'obtenerHistorialPlanesEstudiante'
  );

  return window.sgpa
    .obtenerHistorialPlanesEstudiante(
      id
    );
}

export async function obtenerProgresoEstudiante(
  id,
  periodoReferenciaId
) {
  validarApi(
    'obtenerProgresoEstudiante'
  );

  return window.sgpa
    .obtenerProgresoEstudiante(
      id,
      periodoReferenciaId
    );
}

export async function registrarResultadoAcademicoEstudiante(
  id,
  datos
) {
  validarApi(
    'registrarResultadoAcademicoEstudiante'
  );

  return window.sgpa
    .registrarResultadoAcademicoEstudiante(
      id,
      datos
    );
}


export async function reingresarEstudiante(id, datos = {}) {
  validarApi('reingresarEstudiante');
  return window.sgpa.reingresarEstudiante(id, datos);
}

export async function graduarEstudiante(id, observacion) {
  validarApi('graduarEstudiante');
  return window.sgpa.graduarEstudiante(id, observacion);
}

export async function evaluarGraduacionEstudiante(id) {
  validarApi('evaluarGraduacionEstudiante');
  return window.sgpa.evaluarGraduacionEstudiante(id);
}

export async function confirmarGraduacionEstudiante(id, observacion) {
  validarApi('confirmarGraduacionEstudiante');
  return window.sgpa.confirmarGraduacionEstudiante(id, observacion);
}

export async function obtenerDiagnosticoReingreso(id) {
  validarApi('obtenerDiagnosticoReingreso');
  return window.sgpa.obtenerDiagnosticoReingreso(id);
}

export async function compararPlanesEstudiante(id, planNuevoId) {
  validarApi('compararPlanesEstudiante');
  return window.sgpa.compararPlanesEstudiante(id, planNuevoId);
}

export async function corregirResultadoAcademicoEstudiante(id, historialId, datos) {
  validarApi('corregirResultadoAcademicoEstudiante');
  return window.sgpa.corregirResultadoAcademicoEstudiante(id, historialId, datos);
}

export async function listarCorreccionesHistorialEstudiante(id) {
  validarApi('listarCorreccionesHistorialEstudiante');
  return window.sgpa.listarCorreccionesHistorialEstudiante(id);
}

export async function listarBandejaRevisionEstudiantes(filtros = {}) {
  validarApi('listarBandejaRevisionEstudiantes');
  return window.sgpa.listarBandejaRevisionEstudiantes(filtros);
}

export async function obtenerRegistroRevisionEstudiante(id) {
  validarApi('obtenerRegistroRevisionEstudiante');
  return window.sgpa.obtenerRegistroRevisionEstudiante(id);
}

export async function cargarLoteExcelRevision(payload) {
  validarApi('cargarLoteExcelRevision');
  return window.sgpa.cargarLoteExcelRevision(payload);
}

export async function aprobarRegistrosRevision(registroIds) {
  validarApi('aprobarRegistrosRevision');
  return window.sgpa.aprobarRegistrosRevision(registroIds);
}

export async function rechazarRegistrosRevision(rechazos) {
  validarApi('rechazarRegistrosRevision');
  return window.sgpa.rechazarRegistrosRevision(rechazos);
}

export async function devolverRegistrosRevision(registroIds, observacion) {
  validarApi('devolverRegistrosRevision');
  return window.sgpa.devolverRegistrosRevision(registroIds, observacion);
}
