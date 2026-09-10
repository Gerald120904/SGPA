function validarApi(
  metodo,
) {
  if (
    !window.sgpa ||
    typeof window.sgpa[metodo] !==
      'function'
  ) {
    throw new Error(
      'La API segura de Electron no está disponible.',
    );
  }
}


export function listarAulas(
  filtros = {},
) {
  validarApi(
    'listarAulas',
  );

  return window.sgpa.listarAulas(
    filtros,
  );
}


export function obtenerAula(
  id,
) {
  validarApi(
    'obtenerAula',
  );

  return window.sgpa.obtenerAula(
    id,
  );
}


export function crearAula(
  datos,
) {
  validarApi(
    'crearAula',
  );

  return window.sgpa.crearAula(
    datos,
  );
}


export function actualizarAula(
  id,
  datos,
) {
  validarApi(
    'actualizarAula',
  );

  return window.sgpa.actualizarAula(
    id,
    datos,
  );
}


export function cambiarEstadoAula(
  id,
  activo,
) {
  validarApi(
    'cambiarEstadoAula',
  );

  return window.sgpa
    .cambiarEstadoAula(
      id,
      activo,
    );
}


export function listarEquipamientos() {
  validarApi(
    'listarEquipamientos',
  );

  return window.sgpa
    .listarEquipamientos();
}


export function crearEquipamiento(
  datos,
) {
  validarApi(
    'crearEquipamiento',
  );

  return window.sgpa
    .crearEquipamiento(
      datos,
    );
}


export function actualizarEquipamiento(
  id,
  datos,
) {
  validarApi(
    'actualizarEquipamiento',
  );

  return window.sgpa
    .actualizarEquipamiento(
      id,
      datos,
    );
}


export function cambiarEstadoEquipamiento(
  id,
  activo,
) {
  validarApi(
    'cambiarEstadoEquipamiento',
  );

  return window.sgpa
    .cambiarEstadoEquipamiento(
      id,
      activo,
    );
}


export function listarEquipamientoAula(
  aulaId,
) {
  validarApi(
    'listarEquipamientoAula',
  );

  return window.sgpa
    .listarEquipamientoAula(
      aulaId,
    );
}


export function asignarEquipamientoAula(
  aulaId,
  datos,
) {
  validarApi(
    'asignarEquipamientoAula',
  );

  return window.sgpa
    .asignarEquipamientoAula(
      aulaId,
      datos,
    );
}


export function actualizarEquipamientoAula(
  aulaId,
  equipamientoId,
  datos,
) {
  validarApi(
    'actualizarEquipamientoAula',
  );

  return window.sgpa
    .actualizarEquipamientoAula(
      aulaId,
      equipamientoId,
      datos,
    );
}


export function cambiarEstadoEquipamientoAula(
  aulaId,
  equipamientoId,
  activo,
) {
  validarApi(
    'cambiarEstadoEquipamientoAula',
  );

  return window.sgpa
    .cambiarEstadoEquipamientoAula(
      aulaId,
      equipamientoId,
      activo,
    );
}


export function listarIndisponibilidadesAula(
  aulaId,
) {
  validarApi(
    'listarIndisponibilidadesAula',
  );

  return window.sgpa
    .listarIndisponibilidadesAula(
      aulaId,
    );
}


export function obtenerIndisponibilidadAula(
  aulaId,
  id,
) {
  validarApi(
    'obtenerIndisponibilidadAula',
  );

  return window.sgpa
    .obtenerIndisponibilidadAula(
      aulaId,
      id,
    );
}


export function crearIndisponibilidadAula(
  aulaId,
  datos,
) {
  validarApi(
    'crearIndisponibilidadAula',
  );

  return window.sgpa
    .crearIndisponibilidadAula(
      aulaId,
      datos,
    );
}


export function actualizarIndisponibilidadAula(
  aulaId,
  id,
  datos,
) {
  validarApi(
    'actualizarIndisponibilidadAula',
  );

  return window.sgpa
    .actualizarIndisponibilidadAula(
      aulaId,
      id,
      datos,
    );
}


export function cambiarEstadoIndisponibilidadAula(
  aulaId,
  id,
  activo,
) {
  validarApi(
    'cambiarEstadoIndisponibilidadAula',
  );

  return window.sgpa
    .cambiarEstadoIndisponibilidadAula(
      aulaId,
      id,
      activo,
    );
}


export function listarReservasAula(
  aulaId,
) {
  validarApi('listarReservasAula');

  return window.sgpa
    .listarReservasAula(aulaId);
}


export function obtenerReservaAula(
  aulaId,
  id,
) {
  validarApi('obtenerReservaAula');

  return window.sgpa
    .obtenerReservaAula(
      aulaId,
      id,
    );
}


export function crearReservaAula(
  aulaId,
  datos,
) {
  validarApi('crearReservaAula');

  return window.sgpa
    .crearReservaAula(
      aulaId,
      datos,
    );
}


export function actualizarReservaAula(
  aulaId,
  id,
  datos,
) {
  validarApi('actualizarReservaAula');

  return window.sgpa
    .actualizarReservaAula(
      aulaId,
      id,
      datos,
    );
}


export function cambiarEstadoReservaAula(
  aulaId,
  id,
  activo,
) {
  validarApi(
    'cambiarEstadoReservaAula',
  );

  return window.sgpa
    .cambiarEstadoReservaAula(
      aulaId,
      id,
      activo,
    );
}


export function consultarOcupacionAula(
  aulaId,
  filtros,
) {
  validarApi(
    'consultarOcupacionAula',
  );

  return window.sgpa
    .consultarOcupacionAula(
      aulaId,
      filtros,
    );
}


export function listarDisponibilidadesAula(
  aulaId,
  periodoId,
) {
  validarApi(
    'listarDisponibilidadesAula',
  );

  return window.sgpa
    .listarDisponibilidadesAula(
      aulaId,
      periodoId,
    );
}


export function crearDisponibilidadAula(
  aulaId,
  datos,
) {
  validarApi(
    'crearDisponibilidadAula',
  );

  return window.sgpa
    .crearDisponibilidadAula(
      aulaId,
      datos,
    );
}


export function actualizarDisponibilidadAula(
  aulaId,
  id,
  datos,
) {
  validarApi(
    'actualizarDisponibilidadAula',
  );

  return window.sgpa
    .actualizarDisponibilidadAula(
      aulaId,
      id,
      datos,
    );
}


export function eliminarDisponibilidadAula(
  aulaId,
  id,
) {
  validarApi(
    'eliminarDisponibilidadAula',
  );

  return window.sgpa
    .eliminarDisponibilidadAula(
      aulaId,
      id,
    );
}


export function buscarAulasDisponibles(
  criterios,
) {
  validarApi(
    'buscarAulasDisponibles',
  );

  return window.sgpa
    .buscarAulasDisponibles(
      criterios,
    );
}


export function evaluarAulaParaAsignacion(
  aulaId,
  criterios,
) {
  validarApi(
    'evaluarAulaParaAsignacion',
  );

  return window.sgpa
    .evaluarAulaParaAsignacion(
      aulaId,
      criterios,
    );
}


export function listarAuditoriaAula(
  aulaId,
) {
  validarApi(
    'listarAuditoriaAula',
  );

  return window.sgpa
    .listarAuditoriaAula(
      aulaId,
    );
}






