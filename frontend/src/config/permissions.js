export const ROLES = Object.freeze({

  ADMIN_GLOBAL:
    'ADMIN_GLOBAL',

  COORDINADOR:
    'COORDINADOR',

  PROFESOR:
    'PROFESOR',

  ESTUDIANTE:
    'ESTUDIANTE'

});


export const ROLE_PERMISSIONS = {

  [ROLES.ADMIN_GLOBAL]: [
    '*'
  ],

  [ROLES.COORDINADOR]: [
    'home',
    'dashboard',
    'estudiantes',
    'carreras',
    'planes-estudio',
    'cursos',
    'profesores',
    'aulas',
    'periodos',
    'oferta',
    'proyeccion'
  ],

  [ROLES.PROFESOR]: [
    'home',
    'dashboard'
  ],

  [ROLES.ESTUDIANTE]: [
    'home',
    'dashboard'
  ]

};


/*
 * IMPORTANTE:
 *
 * Esto solamente controla la visibilidad
 * de opciones en frontend.
 *
 * La autorización real debe ser validada
 * también por NestJS.
 */

export function rolPuedeAcceder(
  rol,
  modulo
) {

  if (
    !rol ||
    !modulo
  ) {

    return false;

  }


  const permisos =
    ROLE_PERMISSIONS[rol] || [];


  return (
    permisos.includes('*') ||
    permisos.includes(modulo)
  );

}


/* =========================================================
   PERMISOS DEL USUARIO
   ========================================================= */

export function puedeAcceder(
  roles,
  modulo
) {

  if (
    !Array.isArray(roles) ||
    roles.length === 0 ||
    !modulo
  ) {

    return false;

  }


  return roles.some(
    (rol) =>
      rolPuedeAcceder(
        rol,
        modulo
      )
  );

}
