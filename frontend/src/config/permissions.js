export const ROLES =
  Object.freeze({

    ADMIN_GLOBAL:
      'ADMIN_GLOBAL',

    COORDINADOR:
      'COORDINADOR',

    PROFESOR:
      'PROFESOR',

    ASISTENTE_ESTUDIANTIL:
      'ASISTENTE_ESTUDIANTIL',

  });


export const PERMISOS =
  Object.freeze({

    FORMULARIOS_ESTUDIANTES_VER:
      'FORMULARIOS_ESTUDIANTES_VER',

    FORMULARIOS_ESTUDIANTES_CREAR:
      'FORMULARIOS_ESTUDIANTES_CREAR',

    FORMULARIOS_ESTUDIANTES_GESTIONAR:
      'FORMULARIOS_ESTUDIANTES_GESTIONAR',

    FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS:
      'FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS',

    ESTUDIANTES_VER:
      'ESTUDIANTES_VER',

    ESTUDIANTES_GESTIONAR:
      'ESTUDIANTES_GESTIONAR',

    CARRERAS_VER:
      'CARRERAS_VER',

    CARRERAS_GESTIONAR:
      'CARRERAS_GESTIONAR',

    PLANES_ESTUDIO_VER:
      'PLANES_ESTUDIO_VER',

    PLANES_ESTUDIO_GESTIONAR:
      'PLANES_ESTUDIO_GESTIONAR',

    CURSOS_VER:
      'CURSOS_VER',

    CURSOS_GESTIONAR:
      'CURSOS_GESTIONAR',

    OPTATIVAS_VER:
      'OPTATIVAS_VER',

    OPTATIVAS_GESTIONAR:
      'OPTATIVAS_GESTIONAR',

    PROFESORES_VER:
      'PROFESORES_VER',

    ATESTADOS_VALIDAR:
      'ATESTADOS_VALIDAR',

    PERFILES_DOCENTES_VALIDAR:
      'PERFILES_DOCENTES_VALIDAR',

    PERFILES_ACADEMICOS_VER:
      'PERFILES_ACADEMICOS_VER',

    PERFILES_ACADEMICOS_GESTIONAR:
      'PERFILES_ACADEMICOS_GESTIONAR',

    PERIODOS_VER:
      'PERIODOS_VER',

    PERIODOS_GESTIONAR:
      'PERIODOS_GESTIONAR',

    AULAS_VER:
      'AULAS_VER',

    AULAS_GESTIONAR:
      'AULAS_GESTIONAR',

    ESTRUCTURA_ACADEMICA_VER:
      'ESTRUCTURA_ACADEMICA_VER',

    ESTRUCTURA_ACADEMICA_GESTIONAR:
      'ESTRUCTURA_ACADEMICA_GESTIONAR',

    PROYECCION_VER:
      'PROYECCION_VER',

    PROYECCION_GESTIONAR:
      'PROYECCION_GESTIONAR',

    OFERTA_VER:
      'OFERTA_VER',

    OFERTA_GESTIONAR:
      'OFERTA_GESTIONAR',

    PROFESORES_ASIGNAR:
      'PROFESORES_ASIGNAR',

    AULAS_ASIGNAR:
      'AULAS_ASIGNAR',

    AULAS_CAMBIO_AUTORIZAR:
      'AULAS_CAMBIO_AUTORIZAR',

  });


const PERMISO_MODULO = {

  'formularios-estudiantes':
    PERMISOS.FORMULARIOS_ESTUDIANTES_VER,

  estudiantes:
    PERMISOS.ESTUDIANTES_VER,

  carreras:
    PERMISOS.CARRERAS_VER,

  'planes-estudio':
    PERMISOS.PLANES_ESTUDIO_VER,

  cursos:
    PERMISOS.CURSOS_VER,

  profesores:
    PERMISOS.PROFESORES_VER,

  aulas:
    PERMISOS.AULAS_VER,

  periodos:
    PERMISOS.PERIODOS_VER,

  oferta:
    PERMISOS.OFERTA_VER,

  proyeccion:
    PERMISOS.PROYECCION_VER,

};


/*
 * Seguridad visual solamente.
 * NestJS sigue siendo la autoridad.
 */
export function puedeAcceder(
  roles,
  modulo,
  permisos = [],
) {

  if (
    !Array.isArray(roles) ||
    roles.length === 0 ||
    !modulo
  ) {
    return false;
  }


  /*
   * Cualquier cuenta válida entra
   * al shell principal.
   */
  if (
    modulo === 'home' ||
    modulo === 'dashboard'
  ) {
    return true;
  }


  /*
   * Superusuario.
   */
  if (
    roles.includes(
      ROLES.ADMIN_GLOBAL,
    )
  ) {
    return true;
  }


  /*
   * Administración de usuarios
   * permanece exclusiva del admin.
   */
  if (
    modulo === 'usuarios'
  ) {
    return false;
  }


  /*
   * Un profesor conserva acceso
   * a su propio perfil docente.
   *
   * PROFESORES_VER controla la
   * gestión administrativa.
   */
  if (
    modulo === 'profesores' &&
    roles.includes(
      ROLES.PROFESOR,
    )
  ) {
    return true;
  }


  const requerido =
    PERMISO_MODULO[
      modulo
    ];


  if (!requerido) {
    return false;
  }


  return Array.isArray(
    permisos,
  ) &&
    permisos.includes(
      requerido,
    );

}
