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

export async function sincronizarFormularioEstudiantes(id) {
  validarApi(
    'sincronizarFormularioEstudiantes'
  );

  return window.sgpa
    .sincronizarFormularioEstudiantes(id);
}

export async function listarSolicitudesFormularios(
  filtros = {}
) {
  validarApi(
    'listarSolicitudesFormularios'
  );

  return window.sgpa
    .listarSolicitudesFormularios(
      filtros
    );
}

export async function aceptarSolicitudFormulario(
  respuestaId
) {
  validarApi(
    'aceptarSolicitudFormulario'
  );

  return window.sgpa
    .aceptarSolicitudFormulario(
      respuestaId
    );
}

export async function rechazarSolicitudFormulario(
  respuestaId,
  motivo
) {
  validarApi(
    'rechazarSolicitudFormulario'
  );

  return window.sgpa
    .rechazarSolicitudFormulario(
      respuestaId,
      motivo
    );
}

export async function cerrarFormularioEstudiantes(id) {
  validarApi(
    'cerrarFormularioEstudiantes'
  );

  return window.sgpa
    .cerrarFormularioEstudiantes(id);
}

export async function listarRespuestasFormularioEstudiantes(
  id
) {
  validarApi(
    'listarRespuestasFormularioEstudiantes'
  );

  return window.sgpa
    .listarRespuestasFormularioEstudiantes(
      id
    );
}

export async function abrirEnlaceFormularioEstudiantes(
  url
) {
  validarApi(
    'abrirEnlaceFormularioEstudiantes'
  );

  return window.sgpa
    .abrirEnlaceFormularioEstudiantes(
      url
    );
}
