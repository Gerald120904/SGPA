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
