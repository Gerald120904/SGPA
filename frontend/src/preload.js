
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sgpa", {
  login: (credenciales) => ipcRenderer.invoke("auth:login", credenciales),
  solicitarRecuperacion: (datos) =>
    ipcRenderer.invoke("auth:recuperar-password", datos),
  restablecerPassword: (datos) =>
    ipcRenderer.invoke("auth:restablecer-password", datos),
  obtenerPerfil: () => ipcRenderer.invoke("auth:perfil"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  listarUsuarios: () => ipcRenderer.invoke("usuarios:listar"),
  obtenerUsuario: (id) => ipcRenderer.invoke("usuarios:obtener", id),
  crearUsuario: (datos) => ipcRenderer.invoke("usuarios:crear", datos),
  actualizarUsuario: (id, datos) =>
    ipcRenderer.invoke("usuarios:actualizar", id, datos),
  cambiarEstadoUsuario: (id, activo) =>
    ipcRenderer.invoke("usuarios:cambiar-estado", id, activo),
  asignarRolUsuario: (id, rol) =>
    ipcRenderer.invoke("usuarios:asignar-rol", id, rol),
  revocarRolUsuario: (usuarioId, rolId) =>
    ipcRenderer.invoke("usuarios:revocar-rol", usuarioId, rolId),
  listarRoles: () => ipcRenderer.invoke("roles:listar"),
  listarCarreras: () => ipcRenderer.invoke("carreras:listar"),
  obtenerCarrera: (id) => ipcRenderer.invoke("carreras:obtener", id),
  crearCarrera: (datos) => ipcRenderer.invoke("carreras:crear", datos),
  actualizarCarrera: (id, datos) =>
    ipcRenderer.invoke("carreras:actualizar", id, datos),
  cambiarEstadoCarrera: (id, activo) =>
    ipcRenderer.invoke("carreras:cambiar-estado", id, activo),
  listarCursos: () => ipcRenderer.invoke("cursos:listar"),
  listarAsignaturasDisponiblesCurso: (filtros) =>
    ipcRenderer.invoke("cursos:asignaturas-disponibles", filtros),
  obtenerCurso: (id) => ipcRenderer.invoke("cursos:obtener", id),
  crearCurso: (datos) => ipcRenderer.invoke("cursos:crear", datos),
  actualizarCurso: (id, datos) =>
    ipcRenderer.invoke("cursos:actualizar", id, datos),
  cambiarEstadoCurso: (id, activo) =>
    ipcRenderer.invoke("cursos:cambiar-estado", id, activo),
  listarPeriodosAcademicos: () =>
    ipcRenderer.invoke(
      "periodos:listar",
    ),

  obtenerPeriodoAcademico: (id) =>
    ipcRenderer.invoke(
      "periodos:obtener",
      id,
    ),

  crearPeriodoAcademico: (datos) =>
    ipcRenderer.invoke(
      "periodos:crear",
      datos,
    ),

  actualizarPeriodoAcademico: (
    id,
    datos,
  ) =>
    ipcRenderer.invoke(
      "periodos:actualizar",
      id,
      datos,
    ),

  cambiarEstadoPeriodoAcademico: (
    id,
    estado,
  ) =>
    ipcRenderer.invoke(
      "periodos:cambiar-estado",
      id,
      estado,
    ),
  listarPlanesEstudio: () => ipcRenderer.invoke("planes-estudio:listar"),
  obtenerPlanEstudio: (id) => ipcRenderer.invoke("planes-estudio:obtener", id),
  crearPlanEstudio: (datos) =>
    ipcRenderer.invoke("planes-estudio:crear", datos),
  actualizarPlanEstudio: (id, datos) =>
    ipcRenderer.invoke("planes-estudio:actualizar", id, datos),
  cambiarEstadoPlanEstudio: (id, activo) =>
    ipcRenderer.invoke("planes-estudio:cambiar-estado", id, activo),
  obtenerReglaOptativasPlan: (planId) =>
    ipcRenderer.invoke("plan-reglas-optativas:obtener", planId),
  guardarReglaOptativasPlan: (planId, datos) =>
    ipcRenderer.invoke("plan-reglas-optativas:guardar", planId, datos),
  eliminarReglaOptativasPlan: (planId) =>
    ipcRenderer.invoke("plan-reglas-optativas:eliminar", planId),
  listarPlanAsignaturas: (planId) =>
    ipcRenderer.invoke("plan-asignaturas:listar", planId),
  obtenerPlanAsignatura: (planId, id) =>
    ipcRenderer.invoke("plan-asignaturas:obtener", planId, id),
  crearPlanAsignatura: (planId, datos) =>
    ipcRenderer.invoke("plan-asignaturas:crear", planId, datos),
  actualizarPlanAsignatura: (planId, id, datos) =>
    ipcRenderer.invoke("plan-asignaturas:actualizar", planId, id, datos),
  cambiarEstadoPlanAsignatura: (planId, id, activo) =>
    ipcRenderer.invoke("plan-asignaturas:cambiar-estado", planId, id, activo),
  cargarAsignaturasMasivamente: (planId, datos) =>
    ipcRenderer.invoke("plan-asignaturas:carga-masiva", planId, datos),
  listarPlanRequisitos: (planId) =>
    ipcRenderer.invoke("plan-requisitos:listar", planId),
  crearPlanRequisito: (planId, datos) =>
    ipcRenderer.invoke("plan-requisitos:crear", planId, datos),
  eliminarPlanRequisito: (planId, id) =>
    ipcRenderer.invoke("plan-requisitos:eliminar", planId, id),
  cargarRequisitosMasivamente: (planId, datos) =>
    ipcRenderer.invoke("plan-requisitos:carga-masiva", planId, datos),
  listarSalidasAcademicas: (planId) =>
    ipcRenderer.invoke("salidas-academicas:listar", planId),
  crearSalidaAcademica: (planId, datos) =>
    ipcRenderer.invoke("salidas-academicas:crear", planId, datos),
  actualizarSalidaAcademica: (planId, salidaId, datos) =>
    ipcRenderer.invoke(
      "salidas-academicas:actualizar",
      planId,
      salidaId,
      datos,
    ),
  cambiarEstadoSalidaAcademica: (planId, salidaId, activo) =>
    ipcRenderer.invoke(
      "salidas-academicas:cambiar-estado",
      planId,
      salidaId,
      activo,
    ),
  reemplazarAsignaturasSalida: (planId, salidaId, datos) =>
    ipcRenderer.invoke(
      "salidas-academicas:asignaturas",
      planId,
      salidaId,
      datos,
    ),
  obtenerResumenPlan: (planId) =>
    ipcRenderer.invoke("plan-resumen:obtener", planId),
  validarPlanEstudio: (planId) =>
    ipcRenderer.invoke("plan-validaciones:validar", planId),
  seleccionarExcelPlan: () =>
    ipcRenderer.invoke("plan-importacion:seleccionar-excel"),
  validarImportacionPlan: (planId, datos) =>
    ipcRenderer.invoke("plan-importacion:validar", planId, datos),
  ejecutarImportacionPlan: (planId, datos) =>
    ipcRenderer.invoke("plan-importacion:ejecutar", planId, datos),
  guardarPlantillaExcelPlan: () =>
    ipcRenderer.invoke("plan-importacion:guardar-plantilla"),
  listarBloquesPlan: (planId) =>
    ipcRenderer.invoke("bloques-plan:listar", planId),
  crearBloquePlan: (planId, datos) =>
    ipcRenderer.invoke("bloques-plan:crear", planId, datos),
  actualizarBloquePlan: (planId, bloqueId, datos) =>
    ipcRenderer.invoke("bloques-plan:actualizar", planId, bloqueId, datos),
  cambiarEstadoBloquePlan: (planId, bloqueId, activo) =>
    ipcRenderer.invoke("bloques-plan:cambiar-estado", planId, bloqueId, activo),
  listarProfesores: (filtros = {}) =>
    ipcRenderer.invoke(
      'profesores:listar',
      filtros,
    ),

  obtenerProfesor: (id) =>
    ipcRenderer.invoke(
      'profesores:obtener',
      id,
    ),

  obtenerDisponibilidadProfesor: (
    profesorId,
    periodoId,
  ) =>
    ipcRenderer.invoke(
      'profesores:disponibilidad',
      profesorId,
      periodoId,
    ),

  revisarPerfilProfesor: (
    profesorId,
    perfilId,
    datos,
  ) =>
    ipcRenderer.invoke(
      'profesores:revisar-perfil',
      profesorId,
      perfilId,
      datos,
    ),

  inactivarPerfilProfesor: (
    profesorId,
    perfilId,
    observacion,
  ) =>
    ipcRenderer.invoke(
      'profesores:inactivar-perfil',
      profesorId,
      perfilId,
      observacion,
    ),

  revisarAtestadoProfesor: (
    profesorId,
    atestadoId,
    datos,
  ) =>
    ipcRenderer.invoke(
      'profesores:revisar-atestado',
      profesorId,
      atestadoId,
      datos,
    ),

  obtenerMiPerfilProfesor: () =>
    ipcRenderer.invoke(
      'profesores:mi-perfil',
    ),

  listarCarrerasDisponiblesProfesor: () =>
    ipcRenderer.invoke(
      'profesores:mis-carreras-disponibles',
    ),

  actualizarMisCarrerasProfesor: (
    carreraIds,
  ) =>
    ipcRenderer.invoke(
      'profesores:actualizar-mis-carreras',
      carreraIds,
    ),

  listarMisPerfilesProfesor: () =>
    ipcRenderer.invoke(
      'profesores:mis-perfiles',
    ),

  listarPerfilesDisponiblesProfesor: () =>
    ipcRenderer.invoke(
      'profesores:perfiles-disponibles',
    ),

  solicitarPerfilProfesor: (
    perfilAcademicoId,
  ) =>
    ipcRenderer.invoke(
      'profesores:solicitar-perfil',
      perfilAcademicoId,
    ),

  listarMisAtestadosProfesor: () =>
    ipcRenderer.invoke(
      'profesores:mis-atestados',
    ),

  crearAtestadoProfesor: (datos) =>
    ipcRenderer.invoke(
      'profesores:crear-atestado',
      datos,
    ),

  actualizarAtestadoProfesor: (
    atestadoId,
    datos,
  ) =>
    ipcRenderer.invoke(
      'profesores:actualizar-atestado',
      atestadoId,
      datos,
    ),

  inactivarMiAtestadoProfesor: (
    atestadoId,
  ) =>
    ipcRenderer.invoke(
      'profesores:inactivar-mi-atestado',
      atestadoId,
    ),

  listarMisProyectosProfesor: () =>
    ipcRenderer.invoke(
      'profesores:mis-proyectos',
    ),

  crearProyectoProfesor: (datos) =>
    ipcRenderer.invoke(
      'profesores:crear-proyecto',
      datos,
    ),

  actualizarProyectoProfesor: (
    proyectoId,
    datos,
  ) =>
    ipcRenderer.invoke(
      'profesores:actualizar-proyecto',
      proyectoId,
      datos,
    ),

  cambiarEstadoProyectoProfesor: (
    proyectoId,
    activo,
  ) =>
    ipcRenderer.invoke(
      'profesores:cambiar-estado-proyecto',
      proyectoId,
      activo,
    ),

  listarPeriodosMiDisponibilidadProfesor: () =>
    ipcRenderer.invoke(
      'profesores:periodos-mi-disponibilidad',
    ),

  consultarMiDisponibilidadProfesor: (
    periodoId,
  ) =>
    ipcRenderer.invoke(
      'profesores:consultar-mi-disponibilidad',
      periodoId,
    ),

  guardarMiDisponibilidadProfesor: (
    datos,
  ) =>
    ipcRenderer.invoke(
      'profesores:guardar-mi-disponibilidad',
      datos,
    ),

  copiarMiDisponibilidadProfesor: (
    datos,
  ) =>
    ipcRenderer.invoke(
      'profesores:copiar-mi-disponibilidad',
      datos,
    ),

  obtenerHistorialMiDisponibilidadProfesor: (
    periodoId,
  ) =>
    ipcRenderer.invoke(
      'profesores:historial-mi-disponibilidad',
      periodoId,
    ),

  listarAulas: (filtros = {}) =>
    ipcRenderer.invoke(
      'aulas:listar',
      filtros,
    ),

  obtenerAula: (id) =>
    ipcRenderer.invoke(
      'aulas:obtener',
      id,
    ),

  crearAula: (datos) =>
    ipcRenderer.invoke(
      'aulas:crear',
      datos,
    ),

  actualizarAula: (id, datos) =>
    ipcRenderer.invoke(
      'aulas:actualizar',
      id,
      datos,
    ),

  cambiarEstadoAula: (
    id,
    activo,
  ) =>
    ipcRenderer.invoke(
      'aulas:cambiar-estado',
      id,
      activo,
    ),

  listarEquipamientos: () =>
    ipcRenderer.invoke(
      'aulas:equipamientos:listar',
    ),

  crearEquipamiento: (datos) =>
    ipcRenderer.invoke(
      'aulas:equipamientos:crear',
      datos,
    ),

  actualizarEquipamiento: (
    id,
    datos,
  ) =>
    ipcRenderer.invoke(
      'aulas:equipamientos:actualizar',
      id,
      datos,
    ),

  cambiarEstadoEquipamiento: (
    id,
    activo,
  ) =>
    ipcRenderer.invoke(
      'aulas:equipamientos:cambiar-estado',
      id,
      activo,
    ),

  listarEquipamientoAula: (
    aulaId,
  ) =>
    ipcRenderer.invoke(
      'aulas:equipo-aula:listar',
      aulaId,
    ),

  asignarEquipamientoAula: (
    aulaId,
    datos,
  ) =>
    ipcRenderer.invoke(
      'aulas:equipo-aula:asignar',
      aulaId,
      datos,
    ),

  actualizarEquipamientoAula: (
    aulaId,
    equipamientoId,
    datos,
  ) =>
    ipcRenderer.invoke(
      'aulas:equipo-aula:actualizar',
      aulaId,
      equipamientoId,
      datos,
    ),

  cambiarEstadoEquipamientoAula: (
    aulaId,
    equipamientoId,
    activo,
  ) =>
    ipcRenderer.invoke(
      'aulas:equipo-aula:cambiar-estado',
      aulaId,
      equipamientoId,
      activo,
    ),

  listarIndisponibilidadesAula: (
    aulaId,
  ) =>
    ipcRenderer.invoke(
      'aulas:indisponibilidades:listar',
      aulaId,
    ),

  obtenerIndisponibilidadAula: (
    aulaId,
    id,
  ) =>
    ipcRenderer.invoke(
      'aulas:indisponibilidades:obtener',
      aulaId,
      id,
    ),

  crearIndisponibilidadAula: (
    aulaId,
    datos,
  ) =>
    ipcRenderer.invoke(
      'aulas:indisponibilidades:crear',
      aulaId,
      datos,
    ),

  actualizarIndisponibilidadAula: (
    aulaId,
    id,
    datos,
  ) =>
    ipcRenderer.invoke(
      'aulas:indisponibilidades:actualizar',
      aulaId,
      id,
      datos,
    ),

  cambiarEstadoIndisponibilidadAula: (
    aulaId,
    id,
    activo,
  ) =>
    ipcRenderer.invoke(
      'aulas:indisponibilidades:cambiar-estado',
      aulaId,
      id,
      activo,
    ),

  listarReservasAula: (aulaId) =>
    ipcRenderer.invoke(
      'aulas:reservas:listar',
      aulaId,
    ),

  obtenerReservaAula: (aulaId, id) =>
    ipcRenderer.invoke(
      'aulas:reservas:obtener',
      aulaId,
      id,
    ),

  crearReservaAula: (aulaId, datos) =>
    ipcRenderer.invoke(
      'aulas:reservas:crear',
      aulaId,
      datos,
    ),

  actualizarReservaAula: (
    aulaId,
    id,
    datos,
  ) =>
    ipcRenderer.invoke(
      'aulas:reservas:actualizar',
      aulaId,
      id,
      datos,
    ),

  cambiarEstadoReservaAula: (
    aulaId,
    id,
    activo,
  ) =>
    ipcRenderer.invoke(
      'aulas:reservas:cambiar-estado',
      aulaId,
      id,
      activo,
    ),

  consultarOcupacionAula: (
    aulaId,
    filtros,
  ) =>
    ipcRenderer.invoke(
      'aulas:ocupacion',
      aulaId,
      filtros,
    ),

  listarDisponibilidadesAula: (
    aulaId,
    periodoId,
  ) =>
    ipcRenderer.invoke(
      'aulas:disponibilidades:listar',
      aulaId,
      periodoId,
    ),

  crearDisponibilidadAula: (
    aulaId,
    datos,
  ) =>
    ipcRenderer.invoke(
      'aulas:disponibilidades:crear',
      aulaId,
      datos,
    ),

  actualizarDisponibilidadAula: (
    aulaId,
    id,
    datos,
  ) =>
    ipcRenderer.invoke(
      'aulas:disponibilidades:actualizar',
      aulaId,
      id,
      datos,
    ),

  eliminarDisponibilidadAula: (
    aulaId,
    id,
  ) =>
    ipcRenderer.invoke(
      'aulas:disponibilidades:eliminar',
      aulaId,
      id,
    ),

  buscarAulasDisponibles: (
    criterios,
  ) =>
    ipcRenderer.invoke(
      'aulas:buscar-disponibles',
      criterios,
    ),

  evaluarAulaParaAsignacion: (
    aulaId,
    criterios,
  ) =>
    ipcRenderer.invoke(
      'aulas:evaluar-asignacion',
      aulaId,
      criterios,
    ),

  listarAuditoriaAula: (aulaId) =>
    ipcRenderer.invoke(
      'aulas:auditoria:listar',
      aulaId,
    ),
});
