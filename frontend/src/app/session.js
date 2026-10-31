import {
  ROLES
} from '../config/permissions.js';


let sesionActual = null;


const ROLE_PRIORITY = [
  ROLES.ADMIN_GLOBAL,
  ROLES.COORDINADOR,
  ROLES.PROFESOR,
  ROLES.ASISTENTE_ESTUDIANTIL
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
      resultado?.usuario || null,
    rolActivo:
      resultado?.usuario?.rolActivo || null

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
   ROL PRINCIPAL Y ESPACIO ACTIVO
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


export function obtenerRolActivo(
  usuario = obtenerUsuario()
) {

  if (sesionActual?.rolActivo) {

    const roles =
      obtenerRolesUsuario(
        usuario
      );

    if (roles.includes(sesionActual.rolActivo)) {

      return sesionActual.rolActivo;

    }

  }

  return null;

}


export async function cambiarRolActivo(
  nuevoRol,
  usuario = obtenerUsuario()
) {

  const roles =
    obtenerRolesUsuario(
      usuario
    );

  if (!roles.includes(nuevoRol)) {
    return false;
  }

  if (typeof window !== 'undefined' && window.sgpa && typeof window.sgpa.cambiarRolActivo === 'function') {
    const res = await window.sgpa.cambiarRolActivo(nuevoRol);
    if (!res || !res.ok) {
      throw new Error(res?.message || 'No fue posible cambiar al espacio seleccionado en el backend.');
    }
    if (res.usuario) {
      if (!sesionActual) {
        sesionActual = {};
      }
      sesionActual.usuario = res.usuario;
      sesionActual.rolActivo = nuevoRol;
      if (res.accessToken) {
        sesionActual.token = res.accessToken;
      }
      return true;
    }
  }

  throw new Error('El cambio de rol requiere una conexión verificada con el backend.');

}


export function obtenerEspaciosDisponibles(
  usuario = obtenerUsuario()
) {

  return obtenerRolesUsuario(usuario);

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

    [ROLES.ASISTENTE_ESTUDIANTIL]:
      'Estudiante asistente'

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
   PERMISOS DEL USUARIO
   ========================================================= */

export function obtenerPermisosUsuario(
  usuario = obtenerUsuario(),
) {

  if (!usuario) {
    return [];
  }


  const permisos =
    Array.isArray(
      usuario.permisos,
    )
      ? usuario.permisos
      : [];


  return [
    ...new Set(
      permisos
        .map(
          (permiso) => {

            if (
              typeof permiso ===
              'string'
            ) {
              return permiso.trim();
            }


            if (
              typeof permiso
                ?.permiso ===
              'string'
            ) {
              return permiso.permiso
                .trim();
            }


            return null;

          },
        )
        .filter(Boolean),
    ),
  ];

}


export function usuarioTienePermiso(
  permiso,
  usuario = obtenerUsuario(),
) {

  if (!permiso) {
    return false;
  }


  const rolActivo = obtenerRolActivo(usuario);
  if (!rolActivo) return false;

  if (rolActivo === ROLES.ADMIN_GLOBAL) {
    return true;
  }


  return obtenerPermisosUsuario(
    usuario,
  ).includes(
    permiso,
  );

}


/* =========================================================
   LIMPIAR SESIÓN
   ========================================================= */

export function limpiarSesion() {

  sesionActual = null;

}
