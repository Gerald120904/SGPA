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
