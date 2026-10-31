import {
  MODULES
} from '../config/modules.js';

import {
  puedeAcceder
} from '../config/permissions.js';

import {
  formatearRol,
  obtenerRolActivo,
  obtenerEspaciosDisponibles
} from '../app/session.js';

import {
  escapeHtml
} from '../utils/html.js';

import { logoUnaUrl } from '../utils/brand-assets.js';


function renderNavItem(module) {

  const label =
    module.navLabel ||
    module.title;


  return `
    <button
      class="nav-item"
      data-module="${module.id}"
      data-route="${module.route}"
      type="button"
      title="${escapeHtml(label)}"
    >

      <i
        data-lucide="${module.icon}"
        aria-hidden="true"
      ></i>

      <span class="nav-item-label">
        ${escapeHtml(label)}
      </span>

    </button>
  `;
}


export function Sidebar({
  usuario,
  roles,
  permisos,
}) {

  const nombre =
    usuario?.nombres ||
    'Usuario';


  const inicial =
    nombre
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'A';


  const rolActivo =
    obtenerRolActivo(
      usuario
    );

  const espacios =
    obtenerEspaciosDisponibles(
      usuario
    );

  const rolesEfectivos =
    rolActivo ? [rolActivo] : [];

  const modulosVisibles =
    MODULES.filter(
      (module) =>
        puedeAcceder(
          rolesEfectivos,
          module.id,
          permisos,
        )
    );


  const secciones = [
    ...new Set(
      modulosVisibles
        .map(
          (module) =>
            module.section
        )
        .filter(Boolean)
    )
  ];


  const navegacion =
    secciones
      .map(
        (section) => {

          const modules =
            modulosVisibles.filter(
              (module) =>
                module.section ===
                section
            );


          return `
            <div class="nav-section-title">
              ${escapeHtml(section)}
            </div>

            ${modules
              .map(renderNavItem)
              .join('')}
          `;

        }
      )
      .join('');


  return `
    <aside
      id="sidebar"
      class="sidebar"
    >

      <!-- =============================================== -->
      <!-- LOGO UNIVERSIDAD NACIONAL -->
      <!-- =============================================== -->

      <div class="sidebar-header">

        <div class="sidebar-header-brand">

          <img
            src="${logoUnaUrl}"
            alt="Universidad Nacional de Costa Rica"
            class="sidebar-logo"
            draggable="false"
          />

        </div>

      </div>


      <!-- =============================================== -->
      <!-- CONTEXTO DEL SISTEMA -->
      <!-- =============================================== -->

      <div class="sidebar-context">

        <span class="sidebar-context-label">
          Sistema
        </span>

        <strong>
          SGPA
        </strong>

        <small>
          Campus Nicoya
        </small>

      </div>

      ${espacios.length > 1 ? `
      <div class="sidebar-space-selector" style="padding: 0.5rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <label for="selectEspacioActivo" style="font-size: 0.75rem; color: #a0aec0; display: block; margin-bottom: 0.25rem;">
          Espacio Activo
        </label>
        <select id="selectEspacioActivo" class="space-selector-dropdown" style="width: 100%; background: #2d3748; color: #fff; border: 1px solid #4a5568; border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.8rem;">
          ${espacios.map((espacio) => `
            <option value="${escapeHtml(espacio)}" ${espacio === rolActivo ? 'selected' : ''}>
              ${escapeHtml(formatearRol(espacio))}
            </option>
          `).join('')}
        </select>
      </div>
      ` : ''}


      <!-- =============================================== -->
      <!-- NAVEGACIÓN -->
      <!-- =============================================== -->

      <nav class="sidebar-nav">

        ${navegacion}

      </nav>


      <!-- =============================================== -->
      <!-- USUARIO -->
      <!-- =============================================== -->

      <div class="sidebar-footer">

        <div class="sidebar-user">

          <div class="user-avatar">
            ${escapeHtml(inicial)}
          </div>


          <div class="sidebar-user-info">

            <strong>
              ${escapeHtml(nombre)}
            </strong>

            <span>
              ${escapeHtml(
                formatearRol(
                  rolActivo || 'Sin espacio activo'
                )
              )}
            </span>

          </div>

        </div>


        <button
          id="logoutButton"
          class="logout-button"
          type="button"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >

          <i
            data-lucide="log-out"
            aria-hidden="true"
          ></i>

        </button>

      </div>

    </aside>
  `;
}
