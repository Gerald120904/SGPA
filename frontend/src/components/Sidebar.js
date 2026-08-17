import {
  MODULES
} from '../config/modules.js';

import {
  puedeAcceder
} from '../config/permissions.js';

import {
  formatearRol
} from '../app/session.js';

import {
  escapeHtml
} from '../utils/html.js';


function renderNavItem(
  module
) {

  return `
    <button
      class="nav-item"
      data-module="${module.id}"
      data-route="${module.route}"
      type="button"
    >

      <i
        data-lucide="${module.icon}"
        aria-hidden="true"
      ></i>

      <span>
        ${module.title}
      </span>

    </button>
  `;

}


export function Sidebar({
  usuario,
  rol
}) {

  const nombre =
    usuario?.nombres ||
    'Administrador';


  const inicial =
    nombre
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'A';


  const modulosVisibles =
    MODULES.filter(
      (module) =>
        puedeAcceder(
          rol,
          module.id
        )
    );


  const dashboard =
    modulosVisibles.find(
      (module) =>
        module.id ===
        'dashboard'
    );


  const secciones = [
    ...new Set(
      modulosVisibles
        .filter(
          (module) =>
            module.section
        )
        .map(
          (module) =>
            module.section
        )
    )
  ];


  const navegacionSecciones =
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
              ${section}
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

      <div class="sidebar-header">

        <img
          src="/AVI_horizontal.png"
          alt="AVI Universidad Nacional"
          class="sidebar-logo"
          draggable="false"
        />

      </div>


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


      <nav class="sidebar-nav">

        ${
          dashboard
            ? renderNavItem(
                dashboard
              )
            : ''
        }

        ${navegacionSecciones}

      </nav>


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
                formatearRol(rol)
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