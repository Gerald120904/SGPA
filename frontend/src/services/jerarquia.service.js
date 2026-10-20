function invocar(metodo, ...argumentos) {
  if (typeof window.sgpa?.[metodo] !== 'function') {
    throw new Error('La API segura de Electron no está disponible.');
  }
  return window.sgpa[metodo](...argumentos);
}

export const listarMisCarrerasJerarquia = () => invocar('listarMisCarrerasJerarquia');
export const listarMisAlcancesJerarquia = () => invocar('listarMisAlcancesJerarquia');
export const obtenerCatalogoEstudiantesJerarquia = () => invocar('obtenerCatalogoEstudiantesJerarquia');
export const obtenerCoordinadorJerarquia = (id) => invocar('obtenerCoordinadorJerarquia', id);
export const configurarCoordinadorJerarquia = (id, carreras) => invocar('configurarCoordinadorJerarquia', id, carreras);
export const listarMisAsistentes = () => invocar('listarMisAsistentes');
export const obtenerAsistenteJerarquia = (id) => invocar('obtenerAsistenteJerarquia', id);
export const crearAsistenteJerarquia = (datos) => invocar('crearAsistenteJerarquia', datos);
export const configurarAsistenteJerarquia = (id, carreras) => invocar('configurarAsistenteJerarquia', id, carreras);
export const listarAuditoriaJerarquia = (id) => invocar('listarAuditoriaJerarquia', id);
export const obtenerCatalogoCursosJerarquia = () => invocar('obtenerCatalogoCursosJerarquia');
export const obtenerCatalogoPlanesJerarquia = () => invocar('obtenerCatalogoPlanesJerarquia');
