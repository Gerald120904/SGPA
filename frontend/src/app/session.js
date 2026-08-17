let sesionActual = null;


/* =========================================================
   GUARDAR SESIÓN
   ========================================================= */

export function guardarSesion(
  resultado
) {

  sesionActual = {

    usuario:
      resultado?.usuario || null,

    accessToken:
      resultado?.accessToken ||
      resultado?.token ||
      null

  };

}


/* =========================================================
   USUARIO
   ========================================================= */

export function obtenerUsuario() {

  return sesionActual?.usuario || null;

}


/* =========================================================
   TOKEN
   ========================================================= */

export function obtenerAccessToken() {

  return sesionActual?.accessToken || null;

}


/* =========================================================
   LIMPIAR
   ========================================================= */

export function limpiarSesion() {

  sesionActual = null;

}


/* =========================================================
   ROL
   ========================================================= */

export function obtenerRolUsuario(
  usuario
) {

  if (!usuario) {

    /*
     * Temporal durante el desarrollo.
     */
    return 'ADMINISTRADOR';

  }


  if (
    typeof usuario.rol === 'string'
  ) {

    return usuario.rol;

  }


  if (
    usuario.rol?.nombre
  ) {

    return usuario.rol.nombre;

  }


  if (
    Array.isArray(usuario.roles) &&
    usuario.roles.length > 0
  ) {

    const rol =
      usuario.roles[0];


    if (
      typeof rol === 'string'
    ) {

      return rol;

    }


    if (
      rol?.nombre
    ) {

      return rol.nombre;

    }


    if (
      rol?.rol?.nombre
    ) {

      return rol.rol.nombre;

    }

  }


  if (
    Array.isArray(usuario.usuarioRoles) &&
    usuario.usuarioRoles.length > 0
  ) {

    const relacion =
      usuario.usuarioRoles[0];


    if (
      relacion?.rol?.nombre
    ) {

      return relacion.rol.nombre;

    }

  }


  /*
   * Mientras Gerald termina la estructura
   * definitiva de roles.
   */
  return 'ADMINISTRADOR';

}


/* =========================================================
   FORMATO ROL
   ========================================================= */

export function formatearRol(
  rol
) {

  if (!rol) {
    return 'Administrador';
  }


  return rol
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );

}