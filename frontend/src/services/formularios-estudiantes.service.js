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

export async function obtenerEstadoGoogleFormularios() {
  validarApi(
    'obtenerEstadoGoogleFormularios'
  );

  return window.sgpa
    .obtenerEstadoGoogleFormularios();
}

export async function conectarGoogleFormularios() {
  validarApi(
    'conectarGoogleFormularios'
  );

  return window.sgpa
    .conectarGoogleFormularios();
}

export async function desconectarGoogleFormularios() {
  validarApi(
    'desconectarGoogleFormularios'
  );

  return window.sgpa
    .desconectarGoogleFormularios();
}

export async function crearFormularioEstudiantes(
  datos
) {
  validarApi(
    'crearFormularioEstudiantes'
  );

  return window.sgpa
    .crearFormularioEstudiantes(
      datos
    );
}
