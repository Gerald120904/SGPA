export enum PermisoSistema {
  /* =======================================================
     ESTUDIANTES
     ======================================================= */

  ESTUDIANTES_VER = 'ESTUDIANTES_VER',
  ESTUDIANTES_GESTIONAR = 'ESTUDIANTES_GESTIONAR',

  /* =======================================================
     FORMULARIOS DE ESTUDIANTES
     ======================================================= */

  FORMULARIOS_ESTUDIANTES_VER = 'FORMULARIOS_ESTUDIANTES_VER',
  FORMULARIOS_ESTUDIANTES_CREAR = 'FORMULARIOS_ESTUDIANTES_CREAR',
  FORMULARIOS_ESTUDIANTES_GESTIONAR = 'FORMULARIOS_ESTUDIANTES_GESTIONAR',
  FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS = 'FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS',

  /* =======================================================
     CARRERAS
     ======================================================= */

  CARRERAS_VER = 'CARRERAS_VER',
  CARRERAS_GESTIONAR = 'CARRERAS_GESTIONAR',

  /* =======================================================
     PLANES DE ESTUDIO
     ======================================================= */

  PLANES_ESTUDIO_VER = 'PLANES_ESTUDIO_VER',
  PLANES_ESTUDIO_GESTIONAR = 'PLANES_ESTUDIO_GESTIONAR',

  /* =======================================================
     CURSOS
     ======================================================= */

  CURSOS_VER = 'CURSOS_VER',
  CURSOS_GESTIONAR = 'CURSOS_GESTIONAR',

  /* =======================================================
     OPTATIVAS
     ======================================================= */

  OPTATIVAS_VER = 'OPTATIVAS_VER',
  OPTATIVAS_GESTIONAR = 'OPTATIVAS_GESTIONAR',

  /* =======================================================
     PROFESORES
     ======================================================= */

  PROFESORES_VER = 'PROFESORES_VER',

  ATESTADOS_VALIDAR = 'ATESTADOS_VALIDAR',

  PERFILES_DOCENTES_VALIDAR =
    'PERFILES_DOCENTES_VALIDAR',

  PROFESORES_ASIGNAR =
    'PROFESORES_ASIGNAR',

  /* =======================================================
     PERFILES ACADÉMICOS
     ======================================================= */

  PERFILES_ACADEMICOS_VER =
    'PERFILES_ACADEMICOS_VER',

  PERFILES_ACADEMICOS_GESTIONAR =
    'PERFILES_ACADEMICOS_GESTIONAR',

  /* =======================================================
     PERIODOS ACADÉMICOS
     ======================================================= */

  PERIODOS_VER = 'PERIODOS_VER',
  PERIODOS_GESTIONAR = 'PERIODOS_GESTIONAR',

  /* =======================================================
     AULAS
     ======================================================= */

  AULAS_VER = 'AULAS_VER',
  AULAS_GESTIONAR = 'AULAS_GESTIONAR',

  AULAS_ASIGNAR = 'AULAS_ASIGNAR',

  AULAS_CAMBIO_AUTORIZAR =
    'AULAS_CAMBIO_AUTORIZAR',

  /* =======================================================
     ESTRUCTURA ACADÉMICA
     ======================================================= */

  ESTRUCTURA_ACADEMICA_VER =
    'ESTRUCTURA_ACADEMICA_VER',

  ESTRUCTURA_ACADEMICA_GESTIONAR =
    'ESTRUCTURA_ACADEMICA_GESTIONAR',

  /* =======================================================
     PROYECCIÓN
     ======================================================= */

  PROYECCION_VER = 'PROYECCION_VER',

  PROYECCION_GESTIONAR =
    'PROYECCION_GESTIONAR',

  /* =======================================================
     OFERTA
     ======================================================= */

  OFERTA_VER = 'OFERTA_VER',

  OFERTA_GESTIONAR =
    'OFERTA_GESTIONAR',
}


export const PERMISOS_SISTEMA =
  Object.values(
    PermisoSistema,
  );
