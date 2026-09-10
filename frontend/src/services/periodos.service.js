function validarApi(metodo) {
  if (
    !window.sgpa ||
    typeof window.sgpa[metodo] !==
      "function"
  ) {
    throw new Error(
      "La API segura de Electron no está disponible.",
    );
  }
}

export async function listarPeriodosAcademicos() {
  validarApi(
    "listarPeriodosAcademicos",
  );

  return window.sgpa
    .listarPeriodosAcademicos();
}

export async function obtenerPeriodoAcademico(
  id,
) {
  validarApi(
    "obtenerPeriodoAcademico",
  );

  return window.sgpa
    .obtenerPeriodoAcademico(id);
}

export async function crearPeriodoAcademico(
  datos,
) {
  validarApi(
    "crearPeriodoAcademico",
  );

  return window.sgpa
    .crearPeriodoAcademico(datos);
}

export async function actualizarPeriodoAcademico(
  id,
  datos,
) {
  validarApi(
    "actualizarPeriodoAcademico",
  );

  return window.sgpa
    .actualizarPeriodoAcademico(
      id,
      datos,
    );
}

export async function cambiarEstadoPeriodoAcademico(
  id,
  estado,
) {
  validarApi(
    "cambiarEstadoPeriodoAcademico",
  );

  return window.sgpa
    .cambiarEstadoPeriodoAcademico(
      id,
      estado,
    );
}
