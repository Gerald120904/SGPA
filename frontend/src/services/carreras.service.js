function validarApi(metodo) {
  if (!window.sgpa || typeof window.sgpa[metodo] !== 'function') {
    throw new Error('La API segura de Electron no está disponible.');
  }
}

export async function listarCarreras() {
  validarApi('listarCarreras');
  return window.sgpa.listarCarreras();
}

export async function obtenerCarrera(id) {
  validarApi('obtenerCarrera');
  return window.sgpa.obtenerCarrera(id);
}

export async function crearCarrera(datos) {
  validarApi('crearCarrera');
  return window.sgpa.crearCarrera(datos);
}

export async function actualizarCarrera(id, datos) {
  validarApi('actualizarCarrera');
  return window.sgpa.actualizarCarrera(id, datos);
}

export async function cambiarEstadoCarrera(id, activo) {
  validarApi('cambiarEstadoCarrera');
  return window.sgpa.cambiarEstadoCarrera(id, activo);
}
