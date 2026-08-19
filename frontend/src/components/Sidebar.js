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

      <span>
        ${escapeHtml(label)}
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


  /*
   * Solamente módulos a los que tiene
   * acceso visual el usuario.
   */

  const modulosVisibles =
    MODULES.filter(
      (module) =>
        puedeAcceder(
          rol,
          module.id
        )
    );


  /*
   * Secciones en el mismo orden
   * definido en modules.js.
   */

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
      <!-- LOGO -->
      <!-- =============================================== -->

      <div class="sidebar-header">

        <div class="sidebar-header-brand">

          <img
            src="/AVI_horizontal.png"
            alt="Universidad Nacional"
            class="sidebar-logo"
            draggable="false"
          />

        </div>


        <!-- ============================================= -->
        <!-- COLAPSAR -->
        <!-- ============================================= -->

        <button
          id="sidebarToggle"
          class="sidebar-toggle"
          type="button"
          aria-label="Contraer menú lateral"
          title="Contraer menú"
        >

          <i
            data-lucide="chevron-left"
            aria-hidden="true"
          ></i>

        </button>

      </div>


      <!-- =============================================== -->
      <!-- SISTEMA -->
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


      <!-- =============================================== -->
      <!-- MENÚ CON SCROLL -->
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