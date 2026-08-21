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
    'dashboard',
    'estudiantes',
    'carreras',
    'cursos',
    'profesores',
    'aulas',
    'periodos',
    'proyeccion',
    'oferta'
  ],

  [ROLES.PROFESOR]: [
    'dashboard'
  ],

  [ROLES.ESTUDIANTE]: [
    'dashboard'
  ]

};


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
