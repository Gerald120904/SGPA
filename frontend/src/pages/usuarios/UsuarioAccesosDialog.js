/**
 * SGPA — Consulta de solo lectura de roles, permisos y alcance académico de Usuarios.
 * FRONTEND-ORDER-003
 */

import { ROLES } from '../../config/permissions.js';
import { escapeHtml } from '../../utils/html.js';
import {
  agruparPermisosPorModulo,
  nombreVisibleRol,
  normalizarRolesUsuario,
  obtenerCodigosPermisos,
  obtenerInformacionPermiso,
  obtenerNombreCompletoUsuario,
} from './usuarios.helpers.js';

export function construirDialogoConsultaAccesos({
  usuario,
  permisosUsuario = [],
  alcance = null,
  errorAlcance = '',
  carreras = [],
}) {
  const roles = normalizarRolesUsuario(usuario);
  const esAdminGlobal = roles.some((rol) => rol.nombre === ROLES.ADMIN_GLOBAL);
  const esCoordinador = roles.some((rol) => rol.nombre === ROLES.COORDINADOR);
  const codigos = Array.from(obtenerCodigosPermisos(permisosUsuario)).sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
  const grupos = agruparPermisosPorModulo(codigos);
  const nombre = obtenerNombreCompletoUsuario(usuario) || 'Usuario';

  const resumenPermisos = esAdminGlobal
    ? `<div class="usuarios-accesos-admin-note" role="note">
         <i data-lucide="shield-check" aria-hidden="true"></i>
         <div><strong>Acceso administrativo global</strong>
           <p>Este rol dispone de acceso administrativo total. No depende de permisos granulares individuales.</p>
         </div>
       </div>`
    : codigos.length
      ? Array.from(grupos.entries())
          .map(
            ([grupo, permisos]) => `
            <section class="usuarios-accesos-permission-group">
              <h5>${escapeHtml(grupo)} <span>${permisos.length}</span></h5>
              <ul>${permisos
                .map(
                  (permiso) => `
                <li title="${escapeHtml(permiso)}">
                  <i data-lucide="circle-check" aria-hidden="true"></i>
                  <div><strong>${escapeHtml(obtenerInformacionPermiso(permiso).nombre)}</strong>
                    <small>${escapeHtml(permiso)}</small>
                  </div>
                </li>`,
                )
                .join('')}</ul>
            </section>`,
          )
          .join('')
      : `<p class="usuarios-accesos-empty">No hay permisos individuales registrados para este usuario.</p>`;

  const mapaCarreras = new Map(
    (Array.isArray(carreras) ? carreras : []).map((carrera) => [Number(carrera.id), carrera]),
  );
  const asignaciones = Array.isArray(alcance?.carreras) ? alcance.carreras : [];
  const resumenAlcance = !esCoordinador
    ? ''
    : `
      <section class="usuarios-accesos-section">
        <div class="usuarios-accesos-section-header">
          <i data-lucide="graduation-cap" aria-hidden="true"></i>
          <div><h4>Permisos por carrera</h4>
            <p>Alcance académico configurado específicamente para el coordinador.</p></div>
        </div>
        ${
          errorAlcance
            ? `<p class="usuarios-accesos-warning" role="status">No fue posible consultar los permisos por carrera: ${escapeHtml(errorAlcance)}</p>`
            : asignaciones.length
              ? `<div class="usuarios-accesos-career-list">${asignaciones
                  .map((asignacion) => {
                    const carrera = mapaCarreras.get(Number(asignacion.carreraId));
                    const permisos = Array.isArray(asignacion.permisos)
                      ? asignacion.permisos
                      : [];
                    return `<div class="usuarios-accesos-career">
                  <strong>${escapeHtml(carrera?.nombre || `Carrera ${asignacion.carreraId}`)}</strong>
                  <span>${permisos.length} ${permisos.length === 1 ? 'permiso' : 'permisos'}</span>
                  <ul>${
                    permisos.length
                      ? permisos
                          .map(
                            (permiso) =>
                              `<li>${escapeHtml(obtenerInformacionPermiso(permiso).nombre)}</li>`,
                          )
                          .join('')
                      : '<li>Sin permisos configurados.</li>'
                  }</ul>
                </div>`;
                  })
                  .join('')}</div>`
              : '<p class="usuarios-accesos-empty">No hay carreras con permisos configurados.</p>'
        }
      </section>`;

  return {
    formId: 'usuarioConsultaAccesosForm',
    title: 'Roles y permisos del usuario',
    description: 'Consulta de solo lectura de los accesos registrados en el SGPA.',
    userId: usuario.id,
    body: `
      <div class="usuarios-accesos-summary">
        <span class="usuarios-accesos-avatar" aria-hidden="true">${escapeHtml(nombre.charAt(0).toUpperCase() || 'U')}</span>
        <div>
          <strong>${escapeHtml(nombre)}</strong>
          <span>${escapeHtml(usuario.correo || '')}</span>
          <small>${usuario.activo ? 'Cuenta activa' : 'Cuenta inactiva'}</small>
        </div>
      </div>
      <section class="usuarios-accesos-section">
        <div class="usuarios-accesos-section-header">
          <i data-lucide="users" aria-hidden="true"></i>
          <div><h4>Roles asignados <span class="usuarios-accesos-count">${roles.length}</span></h4>
            <p>Perfiles asociados a la cuenta.</p></div>
        </div>
        <div class="usuarios-accesos-roles">
          ${
            roles.length
              ? roles
                  .map(
                    (rol) => `
              <div class="usuarios-accesos-role">
                <i data-lucide="shield-check" aria-hidden="true"></i>
                <div><strong>${escapeHtml(nombreVisibleRol(rol.nombre))}</strong>
                  ${rol.descripcion ? `<small>${escapeHtml(rol.descripcion)}</small>` : ''}
                </div>
              </div>`,
                  )
                  .join('')
              : '<p class="usuarios-accesos-empty">Sin roles asignados.</p>'
          }
        </div>
      </section>
      <section class="usuarios-accesos-section">
        <div class="usuarios-accesos-section-header">
          <i data-lucide="shield-check" aria-hidden="true"></i>
          <div><h4>Permisos del sistema ${esAdminGlobal ? '' : `<span class="usuarios-accesos-count">${codigos.length}</span>`}</h4>
            <p>${esAdminGlobal ? 'Privilegios asociados al rol administrador global.' : 'Permisos registrados para esta cuenta, agrupados por módulo.'}</p></div>
        </div>
        <div class="usuarios-accesos-permissions">${resumenPermisos}</div>
      </section>
      ${resumenAlcance}
    `,
    footerHtml: `
      <button class="sgpa-form-secondary" type="button" data-action="cerrar-dialogo">
        Cerrar
      </button>
    `,
  };
}
