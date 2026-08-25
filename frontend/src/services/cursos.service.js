function validarApi(metodo) {
  if (!window.sgpa || typeof window.sgpa[metodo] !== 'function') {
    throw new Error('La API segura de Electron no está disponible.');
  }
}

export async function listarCursos() {
  validarApi('listarCursos');
  return window.sgpa.listarCursos();
}

export async function listarAsignaturasDisponiblesCurso(filtros = {}) {
  validarApi('listarAsignaturasDisponiblesCurso');
  return window.sgpa.listarAsignaturasDisponiblesCurso(filtros);
}

export async function obtenerCurso(id) {
  validarApi('obtenerCurso');
  return window.sgpa.obtenerCurso(id);
}

export async function crearCurso(datos) {
  validarApi('crearCurso');
  return window.sgpa.crearCurso(datos);
}

export async function actualizarCurso(id, datos) {
  validarApi('actualizarCurso');
  return window.sgpa.actualizarCurso(id, datos);
}

export async function cambiarEstadoCurso(id, activo) {
  validarApi('cambiarEstadoCurso');
  return window.sgpa.cambiarEstadoCurso(id, activo);
}
