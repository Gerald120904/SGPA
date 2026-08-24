import {
  ROLES
} from '../config/permissions.js';


let sesionActual = null;


const ROLE_PRIORITY = [
  ROLES.ADMIN_GLOBAL,
  ROLES.COORDINADOR,
  ROLES.PROFESOR,
  ROLES.ESTUDIANTE
];


const ROLES_VALIDOS =
  new Set(
    ROLE_PRIORITY
  );


/* =========================================================
   GUARDAR SESIÓN
   ========================================================= */

export function guardarSesion(
  resultado
) {

  sesionActual = {

    usuario:
      resultado?.usuario || null

  };

}


/* =========================================================
   USUARIO
   ========================================================= */

export function obtenerUsuario() {

  return sesionActual?.usuario || null;

}


/* =========================================================
   ROLES DEL USUARIO
   ========================================================= */

export function obtenerRolesUsuario(
  usuario = obtenerUsuario()
) {

  if (!usuario) {
    return [];
  }


  const roles = [];


  if (
    typeof usuario.rol === 'string'
  ) {

    roles.push(
      usuario.rol.trim()
    );

  } else if (
    typeof usuario.rol?.nombre === 'string'
  ) {

    roles.push(
      usuario.rol.nombre.trim()
    );

  }


  if (
    Array.isArray(usuario.roles)
  ) {

    roles.push(
      ...usuario.roles
        .map(
          (rol) => {

            if (
              typeof rol === 'string'
            ) {
              return rol.trim();
            }


            if (
              typeof rol?.nombre === 'string'
            ) {
              return rol.nombre.trim();
            }


            if (
              typeof rol?.rol?.nombre === 'string'
            ) {
              return rol.rol.nombre.trim();
            }


            return null;

          }
        )
        .filter(Boolean)
    );

  }


  if (
    Array.isArray(usuario.usuarioRoles)
  ) {

    roles.push(
      ...usuario.usuarioRoles
        .map(
          (relacion) =>
            relacion?.rol?.nombre
              ?.trim() ||
            null
        )
        .filter(Boolean)
    );

  }


  return [
    ...new Set(
      roles.filter(
        (rol) =>
          ROLES_VALIDOS.has(rol)
      )
    )
  ];

}


/* =========================================================
   VALIDAR ROLES
   ========================================================= */

export function tieneRolValido(
  usuario = obtenerUsuario()
) {

  return obtenerRolesUsuario(
    usuario
  ).length > 0;

}


/* =========================================================
   ROL PRINCIPAL
   ========================================================= */

export function obtenerRolPrincipal(
  usuario = obtenerUsuario()
) {

  const roles =
    obtenerRolesUsuario(
      usuario
    );


  for (
    const rol of ROLE_PRIORITY
  ) {

    if (
      roles.includes(rol)
    ) {

      return rol;

    }

  }


  return null;

}


/* =========================================================
   FORMATEAR ROL
   ========================================================= */

export function formatearRol(
  rol
) {

  const nombres = {

    [ROLES.ADMIN_GLOBAL]:
      'Administrador global',

    [ROLES.COORDINADOR]:
      'Coordinador',

    [ROLES.PROFESOR]:
      'Profesor',

    [ROLES.ESTUDIANTE]:
      'Estudiante'

  };


  return (
    nombres[rol] ||
    'Rol no reconocido'
  );

}


/* =========================================================
   FORMATEAR TODOS LOS ROLES
   ========================================================= */

export function formatearRoles(
  usuario = obtenerUsuario()
) {

  const roles =
    obtenerRolesUsuario(
      usuario
    );


  if (
    roles.length === 0
  ) {

    return 'Sin rol asignado';

  }


  return roles
    .map(formatearRol)
    .join(', ');

}


/* =========================================================
   LIMPIAR SESIÓN
   ========================================================= */

export function limpiarSesion() {

  sesionActual = null;

}
