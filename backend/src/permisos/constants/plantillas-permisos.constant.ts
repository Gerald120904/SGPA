import {
  RolSistema,
} from '../../auth/constants/roles.constants';

import {
  PermisoSistema,
} from './permisos.constant';


export const PERMISOS_PREDETERMINADOS_POR_ROL:
  Record<
    RolSistema,
    readonly PermisoSistema[]
  > = {

  /* =======================================================
     ADMIN GLOBAL
     ======================================================= */

  [RolSistema.ADMIN_GLOBAL]: [],


  /* =======================================================
     COORDINADOR
     ======================================================= */

  [RolSistema.COORDINADOR]: [

    PermisoSistema.ESTUDIANTES_VER,
    PermisoSistema.ESTUDIANTES_GESTIONAR,

    PermisoSistema.CARRERAS_VER,
    PermisoSistema.CARRERAS_GESTIONAR,

    PermisoSistema.PLANES_ESTUDIO_VER,
    PermisoSistema.PLANES_ESTUDIO_GESTIONAR,

    PermisoSistema.CURSOS_VER,
    PermisoSistema.CURSOS_GESTIONAR,

    PermisoSistema.OPTATIVAS_VER,
    PermisoSistema.OPTATIVAS_GESTIONAR,

    PermisoSistema.PROFESORES_VER,

    PermisoSistema.ATESTADOS_VALIDAR,

    PermisoSistema.PERFILES_DOCENTES_VALIDAR,

    PermisoSistema.PERFILES_ACADEMICOS_VER,
    PermisoSistema.PERFILES_ACADEMICOS_GESTIONAR,

    PermisoSistema.PERIODOS_VER,
    PermisoSistema.PERIODOS_GESTIONAR,

    PermisoSistema.AULAS_VER,
    PermisoSistema.AULAS_GESTIONAR,

    PermisoSistema.ESTRUCTURA_ACADEMICA_VER,

    PermisoSistema.PROYECCION_VER,
    PermisoSistema.PROYECCION_GESTIONAR,

    PermisoSistema.OFERTA_VER,
    PermisoSistema.OFERTA_GESTIONAR,

    PermisoSistema.PROFESORES_ASIGNAR,

    PermisoSistema.AULAS_ASIGNAR,

    PermisoSistema.AULAS_CAMBIO_AUTORIZAR,

  ],


  /* =======================================================
     PROFESOR
     ======================================================= */

  [RolSistema.PROFESOR]: [

    PermisoSistema.PERIODOS_VER,

    PermisoSistema.AULAS_VER,

  ],


  /* =======================================================
     ESTUDIANTE
     ======================================================= */

  [RolSistema.ESTUDIANTE]: [],

};


export function obtenerPermisosPredeterminadosPorRoles(
  roles: RolSistema[],
): PermisoSistema[] {

  /*
   * ADMIN_GLOBAL no necesita registros
   * individuales.
   *
   * Además es más seguro dejarlo vacío:
   * si algún día pierde ADMIN_GLOBAL,
   * no conserva implícitamente acceso total.
   */
  if (
    roles.includes(
      RolSistema.ADMIN_GLOBAL,
    )
  ) {
    return [];
  }


  return [
    ...new Set(
      roles.flatMap(
        (rol) =>
          PERMISOS_PREDETERMINADOS_POR_ROL[
            rol
          ] ?? [],
      ),
    ),
  ];

}
