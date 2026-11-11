/**
 * SGPA — Plantillas de campos, roles y permisos para formularios de Usuarios.
 * FRONTEND-ORDER-003
 */

import { escapeHtml } from '../../utils/html.js';
import {
  nombreVisibleRol,
  obtenerCodigosPermisos,
  obtenerInformacionPermiso,
} from './usuarios.helpers.js';

export function renderizarOpcionesCarrerasHtml(carreras = [], seleccionados = new Set()) {
  if (!carreras.length) {
    return '<p class="usuarios-muted">No hay carreras registradas o activas.</p>';
  }

  return carreras
    .map(
      (carrera) => `
        <label class="usuario-carrera-option">
          <input
            type="checkbox"
            name="carreras"
            value="${carrera.id}"
            ${seleccionados.has(carrera.id) ? 'checked' : ''}
          >
          <span>
            <strong>${escapeHtml(carrera.codigo)}</strong>
            <small>${escapeHtml(carrera.nombre)}</small>
          </span>
        </label>
      `,
    )
    .join('');
}

export function renderizarOpcionesPermisosHtml(
  permisosCatalogo = [],
  seleccionados = new Set(),
) {
  return permisosCatalogo
    .map((permiso) => {
      const informacion = obtenerInformacionPermiso(permiso);

      return `
        <label class="usuario-permission-option">
          <input
            type="checkbox"
            name="permisos"
            value="${escapeHtml(permiso)}"
            ${seleccionados.has(permiso) ? 'checked' : ''}
          >
          <span>
            <strong>${escapeHtml(informacion.nombre)}</strong>
            <small>${escapeHtml(informacion.descripcion)}</small>
            <code>${escapeHtml(permiso)}</code>
          </span>
        </label>
      `;
    })
    .join('');
}

export function renderizarCamposUsuarioHtml(usuario = null, limites = {}) {
  return `
    <div class="usuario-form-info">Los campos marcados con <strong>*</strong> son obligatorios.</div>
    <div class="usuario-form-grid">
      <label class="usuario-campo">
        <span>Cédula <b class="usuario-obligatorio" aria-hidden="true">*</b></span>
        <input
          name="cedula"
          type="text"
          inputmode="numeric"
          pattern="[0-9]{1,9}"
          required
          maxlength="${limites.cedula}"
          aria-describedby="usuario-cedula-ayuda usuario-cedula-error"
          autocomplete="off"
          placeholder="Ej: 208570524"
          value="${escapeHtml(usuario?.cedula || '')}"
        >
        <small id="usuario-cedula-ayuda">Solo números, hasta 9 dígitos, sin guiones.</small>
        <small id="usuario-cedula-error" class="usuario-campo-error hidden" role="alert"></small>
      </label>

      <label class="usuario-campo">
        <span>Correo electrónico <b class="usuario-obligatorio" aria-hidden="true">*</b></span>
        <input
          name="correo"
          type="email"
          required
          maxlength="${limites.correo}"
          aria-describedby="usuario-correo-ayuda usuario-correo-error"
          autocomplete="email"
          placeholder="Ej: usuario@una.cr"
          value="${escapeHtml(usuario?.correo || '')}"
        >
        <small id="usuario-correo-ayuda">Correo institucional · máximo 150 caracteres.</small>
        <small id="usuario-correo-error" class="usuario-campo-error hidden" role="alert"></small>
      </label>

      <label class="usuario-campo">
        <span>Nombres <b class="usuario-obligatorio" aria-hidden="true">*</b></span>
        <input
          name="nombres"
          required
          maxlength="${limites.nombres}"
          aria-describedby="usuario-nombres-ayuda usuario-nombres-error"
          autocomplete="given-name"
          placeholder="Primer y segundo nombre"
          value="${escapeHtml(usuario?.nombres || '')}"
        >
        <small id="usuario-nombres-ayuda">Hasta 60 caracteres, únicamente letras.</small>
        <small id="usuario-nombres-error" class="usuario-campo-error hidden" role="alert"></small>
      </label>

      <label class="usuario-campo">
        <span>Primer apellido <b class="usuario-obligatorio" aria-hidden="true">*</b></span>
        <input
          name="apellido1"
          required
          maxlength="${limites.apellido1}"
          aria-describedby="usuario-apellido1-ayuda usuario-apellido1-error"
          autocomplete="family-name"
          placeholder="Primer apellido"
          value="${escapeHtml(usuario?.apellido1 || '')}"
        >
        <small id="usuario-apellido1-ayuda">Hasta 50 caracteres, sin números.</small>
        <small id="usuario-apellido1-error" class="usuario-campo-error hidden" role="alert"></small>
      </label>

      <label class="usuario-campo usuario-form-full">
        <span>Segundo apellido <small class="usuario-opcional">Opcional</small></span>
        <input
          name="apellido2"
          maxlength="${limites.apellido2}"
          aria-describedby="usuario-apellido2-ayuda usuario-apellido2-error"
          autocomplete="additional-name"
          placeholder="Segundo apellido (opcional)"
          value="${escapeHtml(usuario?.apellido2 || '')}"
        >
        <small id="usuario-apellido2-ayuda">Hasta 50 caracteres, sin números.</small>
        <small id="usuario-apellido2-error" class="usuario-campo-error hidden" role="alert"></small>
      </label>
    </div>
  `;
}

export function renderizarRolesEdicionHtml({ usuarioId, rolesUsuario = [], rolesDisponibles = [] }) {
  return `
    <section class="usuario-role-manager">
      <div class="usuario-section-heading">
        <span class="usuario-section-icon"><i data-lucide="users" aria-hidden="true"></i></span>
        <div><h4>Roles asignados</h4><p>Administre los perfiles de acceso del usuario.</p></div>
      </div>
      <div class="usuario-assigned-roles">
        ${
          rolesUsuario.length
            ? rolesUsuario
                .map(
                  (rol) => `
              <span class="usuarios-role-badge is-removable">
                ${escapeHtml(nombreVisibleRol(rol.nombre))}
                <button type="button" data-action="revocar-rol"
                  data-user-id="${usuarioId}" data-role-id="${rol.id ?? ''}"
                  aria-label="Revocar ${escapeHtml(nombreVisibleRol(rol.nombre))}"
                  title="Revocar rol" ${rol.id == null ? 'disabled' : ''}>
                  <i data-lucide="x" aria-hidden="true"></i>
                </button>
              </span>
            `,
                )
                .join('')
            : '<span class="usuarios-no-role">Sin rol asignado</span>'
        }
      </div>

      <div class="usuario-add-role">
        <select id="rolParaAsignar" aria-label="Rol para asignar"
          ${rolesDisponibles.length ? '' : 'disabled'}>
          ${
            rolesDisponibles.length
              ? rolesDisponibles
                  .map(
                    (rol) => `
                <option value="${escapeHtml(rol.nombre)}">${escapeHtml(nombreVisibleRol(rol.nombre))}</option>
              `,
                  )
                  .join('')
              : '<option>Todos los roles están asignados</option>'
          }
        </select>
        <button class="usuarios-secondary-button" type="button"
          data-action="asignar-rol" data-user-id="${usuarioId}"
          ${rolesDisponibles.length ? '' : 'disabled'}>
          <i data-lucide="plus" aria-hidden="true"></i>Agregar rol
        </button>
      </div>
    </section>
  `;
}

export function renderizarPermisosGranularesHtml({
  usuarioId,
  permisosUsuario = [],
  permisosCatalogo = [],
}) {
  const asignados = obtenerCodigosPermisos(permisosUsuario);
  return `
    <section class="usuario-permission-manager">
      <div class="usuario-permission-header">
        <div>
          <h4>Permisos granulares</h4>
          <p>Defina las operaciones administrativas adicionales permitidas para este usuario.</p>
        </div>
        <span class="usuario-permission-count">
          ${asignados.size} asignados
        </span>
      </div>

      <div class="usuario-permission-grid">
        ${renderizarOpcionesPermisosHtml(permisosCatalogo, asignados)}
      </div>

      <div class="usuario-permission-actions">
        <small>Los permisos no seleccionados serán removidos al guardar.</small>
        <button
          type="button"
          class="usuarios-secondary-button"
          data-action="guardar-permisos"
          data-user-id="${usuarioId}"
        >
          <i data-lucide="shield-check" aria-hidden="true"></i>
          Guardar permisos
        </button>
      </div>
    </section>
  `;
}

export function renderizarAuditoriaJerarquiaHtml(auditoria = []) {
  return `
    <section class="usuarios-auditoria">
      <div class="usuario-section-heading">
        <span class="usuario-section-icon"><i data-lucide="history" aria-hidden="true"></i></span>
        <div><h4>Historial reciente</h4><p>Registro de las últimas modificaciones al alcance.</p></div>
      </div>
      ${
        auditoria.length
          ? `<ul>${auditoria
              .map(
                (item) => `
          <li>${escapeHtml(item.accion)} · ${escapeHtml(new Date(item.createdAt).toLocaleString('es-CR'))}</li>
        `,
              )
              .join('')}</ul>`
          : '<p class="usuarios-muted">Sin cambios registrados.</p>'
      }
    </section>
  `;
}
