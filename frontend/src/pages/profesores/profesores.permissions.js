import { usuarioTienePermiso, obtenerRolActivo } from '../../app/session.js';
import { ROLES, PERMISOS } from '../../config/permissions.js';

export function puedeGestionarProfesores() {
  return usuarioTienePermiso(PERMISOS.PROFESORES_VER);
}

export function puedeValidarPerfilesDocentes() {
  return usuarioTienePermiso(PERMISOS.PERFILES_DOCENTES_VALIDAR);
}

export function puedeValidarAtestados() {
  return usuarioTienePermiso(PERMISOS.ATESTADOS_VALIDAR);
}

export function esProfesorActual() {
  return obtenerRolActivo() === ROLES.PROFESOR;
}
