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
  obtenerCurso: (id) => ipcRenderer.invoke("cursos:obtener", id),
  crearCurso: (datos) => ipcRenderer.invoke("cursos:crear", datos),
  actualizarCurso: (id, datos) =>
    ipcRenderer.invoke("cursos:actualizar", id, datos),
  cambiarEstadoCurso: (id, activo) =>
    ipcRenderer.invoke("cursos:cambiar-estado", id, activo),
  listarPlanesEstudio: () => ipcRenderer.invoke("planes-estudio:listar"),
  obtenerPlanEstudio: (id) => ipcRenderer.invoke("planes-estudio:obtener", id),
  crearPlanEstudio: (datos) =>
    ipcRenderer.invoke("planes-estudio:crear", datos),
  actualizarPlanEstudio: (id, datos) =>
    ipcRenderer.invoke("planes-estudio:actualizar", id, datos),
  cambiarEstadoPlanEstudio: (id, activo) =>
    ipcRenderer.invoke("planes-estudio:cambiar-estado", id, activo),
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
});
