function validarApi(metodo) {
  if (!window.sgpa || typeof window.sgpa[metodo] !== 'function') {
    throw new Error('La API segura de Electron no está disponible.');
  }
}

export function listarPerfilesAcademicos() {
  validarApi('listarPerfilesAcademicos');
  return window.sgpa.listarPerfilesAcademicos();
}

export function obtenerPerfil(id) {
  validarApi('obtenerPerfilAcademico');
  return window.sgpa.obtenerPerfilAcademico(id);
}

export function actualizarPerfil(id, datos) {
  validarApi('actualizarPerfilAcademico');
  return window.sgpa.actualizarPerfilAcademico(id, datos);
}

export function listarAreasPerfil(id) {
  validarApi('listarAreasPerfil');
  return window.sgpa.listarAreasPerfil(id);
}

export function guardarAreasPerfil(id, areas) {
  validarApi('guardarAreasPerfil');
  return window.sgpa.guardarAreasPerfil(id, areas);
}

export function listarRequisitosPerfil(id) {
  validarApi('listarRequisitosPerfil');
  return window.sgpa.listarRequisitosPerfil(id);
}

export function guardarRequisitosPerfil(id, requisitos) {
  validarApi('guardarRequisitosPerfil');
  return window.sgpa.guardarRequisitosPerfil(id, requisitos);
}
