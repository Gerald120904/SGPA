function validarApi(metodo) {
  if (
    !window.sgpa ||
    typeof window.sgpa[metodo] !== 'function'
  ) {
    throw new Error(
      `La API de Electron no tiene disponible "${metodo}".`
    );
  }
}

export async function listarFormulariosEstudiantes() {
  validarApi(
    'listarFormulariosEstudiantes'
  );

  return window.sgpa
    .listarFormulariosEstudiantes();
}
