function invocar(metodo, ...argumentos) {
  if (typeof window.sgpa?.[metodo] !== 'function') {
    throw new Error('La API segura de Electron no está disponible.');
  }
  return window.sgpa[metodo](...argumentos);
}

export const listarMisCarrerasJerarquia = () => invocar('listarMisCarrerasJerarquia');
export const listarMisAlcancesJerarquia = () => invocar('listarMisAlcancesJerarquia');
export const obtenerConfiguracionAsistentesJerarquia = () => invocar('obtenerConfiguracionAsistentesJerarquia');
export const obtenerCatalogoEstudiantesJerarquia = () => invocar('obtenerCatalogoEstudiantesJerarquia');
export const obtenerCoordinadorJerarquia = (id) => invocar('obtenerCoordinadorJerarquia', id);
export const obtenerAsistenteAdminJerarquia = (id) => invocar('obtenerAsistenteAdminJerarquia', id);
export const previsualizarAsistenteAdminJerarquia = (id, carreras) => invocar('previsualizarAsistenteAdminJerarquia', id, carreras);
export const configurarAsistenteAdminJerarquia = (id, carreras, firmaImpacto) => invocar('configurarAsistenteAdminJerarquia', id, carreras, firmaImpacto);
export const previsualizarCoordinadorJerarquia = (id, carreras) => invocar('previsualizarCoordinadorJerarquia', id, carreras);
export const configurarCoordinadorJerarquia = (id, carreras, firmaImpacto) => invocar('configurarCoordinadorJerarquia', id, carreras, firmaImpacto);
export const listarMisAsistentes = () => invocar('listarMisAsistentes');
export const obtenerAsistenteJerarquia = (id) => invocar('obtenerAsistenteJerarquia', id);
export const crearAsistenteJerarquia = (datos) => invocar('crearAsistenteJerarquia', datos);
export const configurarAsistenteJerarquia = (id, carreras) => invocar('configurarAsistenteJerarquia', id, carreras);
export const procesarInvitacionAsistenteJerarquia = (id) => invocar('procesarInvitacionAsistenteJerarquia', id);
export const listarAuditoriaJerarquia = (id) => invocar('listarAuditoriaJerarquia', id);
export const obtenerCatalogoCursosJerarquia = () => invocar('obtenerCatalogoCursosJerarquia');
export const obtenerCatalogoPlanesJerarquia = () => invocar('obtenerCatalogoPlanesJerarquia');
