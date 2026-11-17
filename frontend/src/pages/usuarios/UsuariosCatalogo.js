/**
 * SGPA — Catálogo, tarjetas de resumen y tabla de Usuarios.
 * FRONTEND-ORDER-003
 */

import { ROLES } from '../../config/permissions.js';
import { DataTable } from '../../components/DataTable.js';
import { StatCard } from '../../components/StatCard.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { escapeHtml } from '../../utils/html.js';
import {
  filtrarListaUsuarios,
  normalizarRolesUsuario,
  obtenerNombreCompletoUsuario,
} from './usuarios.helpers.js';

export function renderizarResumenUsuarios(usuarios = []) {
  const lista = Array.isArray(usuarios) ? usuarios : [];
  const total = lista.length;
  const activos = lista.filter((usuario) => usuario.activo).length;
  const inactivos = total - activos;
  const coordinadores = lista.filter((usuario) =>
    normalizarRolesUsuario(usuario).some((rol) => rol.nombre === ROLES.COORDINADOR),
  ).length;

  return [
    StatCard({
      icon: 'users',
      title: 'Usuarios registrados',
      value: String(total),
      description: 'Cuentas en el directorio',
    }),
    StatCard({
      icon: 'circle-check',
      title: 'Cuentas activas',
      value: String(activos),
      description: 'Accesos habilitados',
    }),
    StatCard({
      icon: 'circle-pause',
      title: 'Cuentas inactivas',
      value: String(inactivos),
      description: 'Accesos deshabilitados',
    }),
    StatCard({
      icon: 'shield-check',
      title: 'Coordinadores',
      value: String(coordinadores),
      description: 'Con rol de coordinación',
    }),
  ].join('');
}

export function renderizarFilasUsuarios(usuarios = []) {
  return usuarios
    .map((usuario) => {
      const roles = normalizarRolesUsuario(usuario);
      const nombre = obtenerNombreCompletoUsuario(usuario);
      const inicial = nombre.trim().charAt(0).toUpperCase() || 'U';

      return `
        <tr>
          <td><span class="usuarios-cedula">${escapeHtml(usuario.cedula)}</span></td>
          <td>
            <div class="usuarios-persona">
              <span class="usuarios-avatar" aria-hidden="true">${escapeHtml(inicial)}</span>
              <strong>${escapeHtml(nombre)}</strong>
            </div>
          </td>
          <td><span class="usuarios-correo">${escapeHtml(usuario.correo)}</span></td>
          <td>
            <button class="usuarios-role-view-button" type="button"
              data-action="ver-roles-permisos" data-user-id="${usuario.id}"
              aria-label="Ver roles y permisos de ${escapeHtml(nombre)}"
              title="Ver roles y permisos de ${escapeHtml(nombre)}">
              <i data-lucide="eye" aria-hidden="true"></i>
              <span>Ver</span>
              <span class="usuarios-role-view-count" aria-label="${roles.length} roles asignados">${roles.length}</span>
            </button>
          </td>
          <td>${StatusBadge({
            label: usuario.activo ? 'Activo' : 'Inactivo',
            tone: usuario.activo ? 'success' : 'neutral',
          })}</td>
          <td>
            <div class="usuarios-actions">
              <button class="usuarios-icon-button" type="button"
                data-action="editar" data-user-id="${usuario.id}"
                aria-label="Editar ${escapeHtml(nombre)}" title="Editar usuario">
                <i data-lucide="pencil" aria-hidden="true"></i>
              </button>
              ${roles.some((rol) => rol.nombre === ROLES.COORDINADOR) ? `
                <button class="usuarios-icon-button" type="button"
                  data-action="configurar-jerarquia" data-user-id="${usuario.id}"
                  aria-label="Configurar carreras y permisos de ${escapeHtml(nombre)}"
                  title="Carreras y permisos por carrera">
                  <i data-lucide="shield-check" aria-hidden="true"></i>
                </button>
              ` : ''}
              ${roles.some((rol) => rol.nombre === ROLES.ASISTENTE_ESTUDIANTIL) ? `
                <button class="usuarios-icon-button" type="button"
                  data-action="configurar-asistente-admin" data-user-id="${usuario.id}"
                  aria-label="Configurar carreras y permisos de ${escapeHtml(nombre)}"
                  title="Carreras y permisos del asistente">
                  <i data-lucide="shield-check" aria-hidden="true"></i>
                </button>
              ` : ''}
              <button
                class="usuarios-icon-button ${usuario.activo ? 'is-danger' : 'is-success'}"
                type="button" data-action="estado" data-user-id="${usuario.id}"
                data-active="${usuario.activo}"
                aria-label="${usuario.activo ? 'Desactivar' : 'Activar'} usuario"
                title="${usuario.activo ? 'Desactivar' : 'Activar'}">
                <i data-lucide="power" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

export function renderizarCatalogoUsuarios({ usuarios = [], filtro = '' } = {}) {
  const lista = Array.isArray(usuarios) ? usuarios : [];
  const total = lista.length;
  const termino = String(filtro || '').trim();
  const filtrados = filtrarListaUsuarios(lista, termino);

  const contadorTexto = termino
    ? `${filtrados.length} de ${total} usuarios`
    : `${total} ${total === 1 ? 'usuario' : 'usuarios'}`;

  const tablaHtml = DataTable({
    columns: [
      { label: 'Cédula' },
      { label: 'Usuario' },
      { label: 'Correo institucional' },
      { label: 'Roles' },
      { label: 'Estado' },
      { label: 'Acciones' },
    ],
    rows: renderizarFilasUsuarios(filtrados),
    emptyMessage: termino
      ? 'No hay usuarios que coincidan con la búsqueda.'
      : 'No hay usuarios registrados.',
    ariaLabel: 'Directorio institucional de usuarios',
  });

  return {
    resumenHtml: renderizarResumenUsuarios(lista),
    contadorTexto,
    tablaHtml,
  };
}
