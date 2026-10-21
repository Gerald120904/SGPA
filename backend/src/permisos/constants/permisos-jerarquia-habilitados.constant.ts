import { PermisoSistema } from './permisos.constant';

/** Módulos que ya comprueban carrera, recurso y flujo de aprobación. */
export const PERMISOS_JERARQUIA_HABILITADOS = new Set<PermisoSistema>([
  PermisoSistema.ESTUDIANTES_VER,
  PermisoSistema.ESTUDIANTES_GESTIONAR,
  PermisoSistema.CURSOS_VER,
  PermisoSistema.CURSOS_GESTIONAR,
  PermisoSistema.PLANES_ESTUDIO_VER,
  PermisoSistema.PLANES_ESTUDIO_GESTIONAR,
  PermisoSistema.OPTATIVAS_VER,
  PermisoSistema.OPTATIVAS_GESTIONAR,
]);
