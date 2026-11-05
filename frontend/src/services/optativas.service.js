function invocar(metodo, ...argumentos) {
  if (typeof window.sgpa?.[metodo] !== 'function') {
    throw new Error('La API segura de Electron no está disponible.');
  }
  return window.sgpa[metodo](...argumentos);
}

export const listarOptativas = () => invocar('listarOptativas');
export const listarCarrerasElegiblesOptativa = () => invocar('listarCarrerasElegiblesOptativa');
export const crearOptativa = (datos) => invocar('crearOptativa', datos);
export const actualizarOptativa = (id, datos) => invocar('actualizarOptativa', id, datos);
export const cambiarEstadoOptativa = (id, activo) => invocar('cambiarEstadoOptativa', id, activo);
