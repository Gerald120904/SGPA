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
