import {
  MODULES
} from '../config/modules.js';

import {
  puedeAcceder
} from '../config/permissions.js';

import {
  formatearRol,
  obtenerRolPrincipal
} from '../app/session.js';

import {
  escapeHtml
} from '../utils/html.js';


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
  roles
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


  const rolPrincipal =
    obtenerRolPrincipal(
      usuario
    );


  const modulosVisibles =
    MODULES.filter(
      (module) =>
        puedeAcceder(
          roles,
          module.id
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
            src="/Logo-UNA-Rojo_FondoTransparente.png"
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
                  rolPrincipal
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