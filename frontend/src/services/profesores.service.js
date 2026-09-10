function validarApi(metodo) {
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

export function listarProfesores(
  filtros = {},
) {
  validarApi(
    'listarProfesores',
  );

  return window.sgpa.listarProfesores(
    filtros,
  );
}

export function obtenerProfesor(id) {
  validarApi(
    'obtenerProfesor',
  );

  return window.sgpa.obtenerProfesor(
    id,
  );
}

export function obtenerDisponibilidadProfesor(
  profesorId,
  periodoId,
) {
  validarApi(
    'obtenerDisponibilidadProfesor',
  );

  return window.sgpa
    .obtenerDisponibilidadProfesor(
      profesorId,
      periodoId,
    );
}

export function revisarPerfilProfesor(
  profesorId,
  perfilId,
  datos,
) {
  validarApi(
    'revisarPerfilProfesor',
  );

  return window.sgpa
    .revisarPerfilProfesor(
      profesorId,
      perfilId,
      datos,
    );
}

export function inactivarPerfilProfesor(
  profesorId,
  perfilId,
  observacion = '',
) {
  validarApi(
    'inactivarPerfilProfesor',
  );

  return window.sgpa
    .inactivarPerfilProfesor(
      profesorId,
      perfilId,
      observacion,
    );
}

export function revisarAtestadoProfesor(
  profesorId,
  atestadoId,
  datos,
) {
  validarApi(
    'revisarAtestadoProfesor',
  );

  return window.sgpa
    .revisarAtestadoProfesor(
      profesorId,
      atestadoId,
      datos,
    );
}

export function obtenerMiPerfilProfesor() {
  validarApi(
    'obtenerMiPerfilProfesor',
  );

  return window.sgpa
    .obtenerMiPerfilProfesor();
}

export function listarCarrerasDisponiblesProfesor() {
  validarApi(
    'listarCarrerasDisponiblesProfesor',
  );

  return window.sgpa
    .listarCarrerasDisponiblesProfesor();
}

export function actualizarMisCarrerasProfesor(
  carreraIds,
) {
  validarApi(
    'actualizarMisCarrerasProfesor',
  );

  return window.sgpa
    .actualizarMisCarrerasProfesor(
      carreraIds,
    );
}

export function listarMisPerfilesProfesor() {
  validarApi(
    'listarMisPerfilesProfesor',
  );

  return window.sgpa
    .listarMisPerfilesProfesor();
}

export function listarPerfilesDisponiblesProfesor() {
  validarApi(
    'listarPerfilesDisponiblesProfesor',
  );

  return window.sgpa
    .listarPerfilesDisponiblesProfesor();
}

export function solicitarPerfilProfesor(
  perfilAcademicoId,
) {
  validarApi(
    'solicitarPerfilProfesor',
  );

  return window.sgpa
    .solicitarPerfilProfesor(
      perfilAcademicoId,
    );
}

export function listarMisAtestadosProfesor() {
  validarApi(
    'listarMisAtestadosProfesor',
  );

  return window.sgpa
    .listarMisAtestadosProfesor();
}

export function crearAtestadoProfesor(
  datos,
) {
  validarApi(
    'crearAtestadoProfesor',
  );

  return window.sgpa
    .crearAtestadoProfesor(
      datos,
    );
}

export function actualizarAtestadoProfesor(
  atestadoId,
  datos,
) {
  validarApi(
    'actualizarAtestadoProfesor',
  );

  return window.sgpa
    .actualizarAtestadoProfesor(
      atestadoId,
      datos,
    );
}

export function inactivarMiAtestadoProfesor(
  atestadoId,
) {
  validarApi(
    'inactivarMiAtestadoProfesor',
  );

  return window.sgpa
    .inactivarMiAtestadoProfesor(
      atestadoId,
    );
}

export function listarMisProyectosProfesor() {
  validarApi(
    'listarMisProyectosProfesor',
  );

  return window.sgpa
    .listarMisProyectosProfesor();
}

export function crearProyectoProfesor(
  datos,
) {
  validarApi(
    'crearProyectoProfesor',
  );

  return window.sgpa
    .crearProyectoProfesor(
      datos,
    );
}

export function actualizarProyectoProfesor(
  proyectoId,
  datos,
) {
  validarApi(
    'actualizarProyectoProfesor',
  );

  return window.sgpa
    .actualizarProyectoProfesor(
      proyectoId,
      datos,
    );
}

export function cambiarEstadoProyectoProfesor(
  proyectoId,
  activo,
) {
  validarApi(
    'cambiarEstadoProyectoProfesor',
  );

  return window.sgpa
    .cambiarEstadoProyectoProfesor(
      proyectoId,
      activo,
    );
}

export function listarPeriodosMiDisponibilidadProfesor() {
  validarApi(
    'listarPeriodosMiDisponibilidadProfesor',
  );

  return window.sgpa
    .listarPeriodosMiDisponibilidadProfesor();
}

export function consultarMiDisponibilidadProfesor(
  periodoId,
) {
  validarApi(
    'consultarMiDisponibilidadProfesor',
  );

  return window.sgpa
    .consultarMiDisponibilidadProfesor(
      periodoId,
    );
}

export function guardarMiDisponibilidadProfesor(
  datos,
) {
  validarApi(
    'guardarMiDisponibilidadProfesor',
  );

  return window.sgpa
    .guardarMiDisponibilidadProfesor(
      datos,
    );
}

export function copiarMiDisponibilidadProfesor(
  datos,
) {
  validarApi(
    'copiarMiDisponibilidadProfesor',
  );

  return window.sgpa
    .copiarMiDisponibilidadProfesor(
      datos,
    );
}

export function obtenerHistorialMiDisponibilidadProfesor(
  periodoId,
) {
  validarApi(
    'obtenerHistorialMiDisponibilidadProfesor',
  );

  return window.sgpa
    .obtenerHistorialMiDisponibilidadProfesor(
      periodoId,
    );
}

