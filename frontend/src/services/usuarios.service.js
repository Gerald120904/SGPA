function validarApi(metodo) {
  if (
    !window.sgpa ||
    typeof window.sgpa[metodo] !== 'function'
  ) {
    throw new Error(
      'La API segura de Electron no está disponible.',
    );
  }
}

export async function listarUsuarios() {
  validarApi('listarUsuarios');
  return window.sgpa.listarUsuarios();
}

export async function obtenerUsuario(id) {
  validarApi('obtenerUsuario');
  return window.sgpa.obtenerUsuario(id);
}

export async function crearUsuario(datos) {
  validarApi('crearUsuario');
  return window.sgpa.crearUsuario(datos);
}

export async function actualizarUsuario(id, datos) {
  validarApi('actualizarUsuario');
  return window.sgpa.actualizarUsuario(id, datos);
}

export async function cambiarEstadoUsuario(id, activo) {
  validarApi('cambiarEstadoUsuario');
  return window.sgpa.cambiarEstadoUsuario(id, activo);
}

export async function asignarRolUsuario(usuarioId, rol) {
  validarApi('asignarRolUsuario');
  return window.sgpa.asignarRolUsuario(usuarioId, rol);
}

export async function revocarRolUsuario(usuarioId, rolId) {
  validarApi('revocarRolUsuario');
  return window.sgpa.revocarRolUsuario(usuarioId, rolId);
}

export async function listarRoles() {
  validarApi('listarRoles');
  return window.sgpa.listarRoles();
}
