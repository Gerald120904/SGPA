import {
  MODULES
} from '../config/modules.js';

import {
  puedeAcceder
} from '../config/permissions.js';

import {
  formatearRol,
  obtenerRolActivo,
  obtenerEspaciosDisponibles,
  cambiarRolActivo
} from '../app/session.js';

import {
  escapeHtml
} from '../utils/html.js';

import { logoUnaUrl } from '../utils/brand-assets.js';
import { renderizarIconos } from '../utils/icons.js';


export function obtenerIconoRol(rol) {
  switch (rol) {
    case 'ADMIN_GLOBAL':
      return 'shield-check';
    case 'COORDINADOR':
      return 'briefcase';
    case 'PROFESOR':
      return 'graduation-cap';
    case 'ASISTENTE_ESTUDIANTIL':
      return 'user-cog';
    default:
      return 'user-cog';
  }
}


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
  isCollapsed = false
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
    ) ||
    usuario?.rolActivo ||
    null;

  const espacios =
    obtenerEspaciosDisponibles(
      usuario
    );

  const tieneVariosRoles =
    espacios.length > 1;

  const rolesEfectivos =
    rolActivo ? [rolActivo] : [];

  const modulosDisponiblesTotal =
    MODULES.filter(
      (m) =>
        m.id !== 'home' &&
        m.id !== 'dashboard' &&
        puedeAcceder(
          rolesEfectivos,
          m.id,
          permisos,
        )
    );

  const modulosVisibles =
    MODULES.filter(
      (module) => {
        if (
          module.id === 'dashboard' &&
          modulosDisponiblesTotal.length === 0
        ) {
          return false;
        }

        return puedeAcceder(
          rolesEfectivos,
          module.id,
          permisos,
        );
      }
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

  const nombreRolFormateado =
    rolActivo ? formatearRol(rolActivo) : 'Sin rol activo';

  const iconoRolActivo =
    obtenerIconoRol(rolActivo);


  return `
    <aside
      id="sidebar"
      class="sidebar ${isCollapsed ? 'collapsed' : ''}"
    >

      <!-- =============================================== -->
      <!-- LOGO UNIVERSIDAD NACIONAL Y TOGGLE -->
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

        <button
          id="sidebarToggle"
          class="sidebar-toggle"
          type="button"
          aria-label="${isCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}"
          title="${isCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}"
        >
          <i
            data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-left'}"
            aria-hidden="true"
          ></i>
        </button>

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
      <!-- SELECTOR INSTITUCIONAL DE ROL ACTIVO -->
      <!-- =============================================== -->

      <div
        class="sidebar-role-container"
        id="sidebarRoleContainer"
        data-rol-activo="${escapeHtml(rolActivo || '')}"
      >

        <!-- Control select semántico/accesible para compatibilidad -->
        <select
          id="selectEspacioActivo"
          class="sr-only"
          aria-hidden="true"
          tabindex="-1"
          style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;"
        >
          ${espacios.map((espacio) => `
            <option value="${escapeHtml(espacio)}" ${espacio === rolActivo ? 'selected' : ''}>
              ${escapeHtml(formatearRol(espacio))}
            </option>
          `).join('')}
        </select>

        <!-- Vista Expandida: selector institucional discreto -->
        <div class="role-selector-expanded">

          <div class="role-selector-header-row">
            <span class="role-selector-label" id="roleSelectorLabel">
              Rol activo
            </span>

            ${tieneVariosRoles ? `
              <span class="role-selector-badge" title="${espacios.length} roles disponibles">
                ${espacios.length} roles
              </span>
            ` : ''}
          </div>

          <button
            id="btnRolActivoExpanded"
            class="role-selector-trigger ${tieneVariosRoles ? '' : 'is-single'}"
            type="button"
            aria-haspopup="${tieneVariosRoles ? 'listbox' : 'false'}"
            aria-expanded="false"
            aria-labelledby="roleSelectorLabel btnRolActivoExpanded"
            ${tieneVariosRoles ? 'title="Cambiar rol activo"' : `title="Rol activo: ${escapeHtml(nombreRolFormateado)}"`}
          >

            <span class="role-trigger-icon-wrap" aria-hidden="true">
              <i data-lucide="${iconoRolActivo}"></i>
            </span>

            <span class="role-trigger-content">
              <span class="role-trigger-name" title="${escapeHtml(nombreRolFormateado)}">
                ${escapeHtml(nombreRolFormateado)}
              </span>

              ${tieneVariosRoles ? `
                <span class="role-trigger-action">
                  Cambiar rol
                </span>
              ` : `
                <span class="role-trigger-meta">
                  Rol asignado
                </span>
              `}
            </span>

            ${tieneVariosRoles ? `
              <span class="role-trigger-chevron" aria-hidden="true">
                <i data-lucide="chevron-down"></i>
              </span>
            ` : ''}

          </button>

        </div>


        <!-- Vista Contraída: ícono compacto para menú flotante -->
        <div class="role-selector-collapsed">

          <button
            id="btnRolActivoCollapsed"
            class="role-selector-compact-btn ${tieneVariosRoles ? '' : 'is-single'}"
            type="button"
            aria-haspopup="${tieneVariosRoles ? 'listbox' : 'false'}"
            aria-expanded="false"
            aria-label="Rol activo: ${escapeHtml(nombreRolFormateado)}${tieneVariosRoles ? '. Cambiar rol' : ''}"
            title="Rol activo: ${escapeHtml(nombreRolFormateado)}${tieneVariosRoles ? ' (clic para cambiar)' : ''}"
          >
            <i data-lucide="${iconoRolActivo}" aria-hidden="true"></i>
          </button>

        </div>


        <!-- Menú flotante / Desplegable de roles -->
        ${tieneVariosRoles ? `
        <div
          id="menuRolesFlotante"
          class="role-dropdown-menu dropdown-expanded"
          role="listbox"
          aria-label="Roles asignados disponibles"
          tabindex="-1"
          hidden
        >

          <div class="role-menu-header">
            <span class="role-menu-title">
              Cambiar rol activo
            </span>
            <span class="role-menu-subtitle">
              Seleccione el espacio de trabajo
            </span>
          </div>

          <div class="role-menu-list">
            ${espacios.map((espacio) => {
              const esActivo = espacio === rolActivo;
              const nombreEspacio = formatearRol(espacio);
              const iconoEspacio = obtenerIconoRol(espacio);

              return `
                <button
                  type="button"
                  role="option"
                  class="role-menu-item ${esActivo ? 'active' : ''}"
                  data-rol="${escapeHtml(espacio)}"
                  aria-selected="${esActivo ? 'true' : 'false'}"
                  aria-label="${escapeHtml(nombreEspacio)}${esActivo ? ' (Rol actual)' : ''}"
                  tabindex="-1"
                >

                  <span class="role-item-icon ${esActivo ? 'active' : ''}" aria-hidden="true">
                    <i data-lucide="${iconoEspacio}"></i>
                  </span>

                  <div class="role-item-text">
                    <strong class="role-item-title">
                      ${escapeHtml(nombreEspacio)}
                    </strong>
                    <span class="role-item-desc">
                      ${esActivo ? 'Rol actual en uso' : 'Cambiar a este espacio'}
                    </span>
                  </div>

                  ${esActivo ? `
                    <span class="role-item-check" aria-hidden="true" title="Rol actual">
                      <i data-lucide="check"></i>
                    </span>
                  ` : ''}

                </button>
              `;
            }).join('')}
          </div>

        </div>
        ` : ''}

      </div>


      <!-- =============================================== -->
      <!-- NAVEGACIÓN -->
      <!-- =============================================== -->

      <nav class="sidebar-nav">

        ${navegacion}

      </nav>


      <!-- =============================================== -->
      <!-- USUARIO (CUENTA) -->
      <!-- =============================================== -->

      <div class="sidebar-footer">

        <div class="sidebar-user">

          <div class="user-avatar" title="${escapeHtml(nombre)}">
            ${escapeHtml(inicial)}
          </div>


          <div class="sidebar-user-info">

            <strong class="sidebar-user-name" title="${escapeHtml(nombre)}">
              ${escapeHtml(nombre)}
            </strong>

            <span
              class="sidebar-user-account"
              title="${escapeHtml(usuario?.correo || 'Cuenta institucional')}"
            >
              ${escapeHtml(usuario?.correo || 'Cuenta institucional')}
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


export function iniciarSidebar({ onCambiarRol } = {}) {
  const appShell = document.getElementById('appShell');
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  const btnExpanded = document.getElementById('btnRolActivoExpanded');
  const btnCollapsed = document.getElementById('btnRolActivoCollapsed');
  const menu = document.getElementById('menuRolesFlotante');
  const container = document.getElementById('sidebarRoleContainer');
  const selectEspacio = document.getElementById('selectEspacioActivo');

  let ultimoBotonDisparador = null;

  // 1. Toggle contraer / expandir barra lateral
  if (toggleBtn && appShell && sidebar) {
    toggleBtn.addEventListener('click', () => {
      const colapsando = !appShell.classList.contains('sidebar-collapsed');
      appShell.classList.toggle('sidebar-collapsed', colapsando);
      sidebar.classList.toggle('collapsed', colapsando);

      try {
        localStorage.setItem(
          'sgpa_sidebar_collapsed',
          colapsando ? 'true' : 'false'
        );
      } catch (_) {}

      toggleBtn.setAttribute(
        'aria-label',
        colapsando ? 'Expandir barra lateral' : 'Contraer barra lateral'
      );
      toggleBtn.setAttribute(
        'title',
        colapsando ? 'Expandir barra lateral' : 'Contraer barra lateral'
      );
      toggleBtn.innerHTML = `
        <i
          data-lucide="${colapsando ? 'chevron-right' : 'chevron-left'}"
          aria-hidden="true"
        ></i>
      `;
      renderizarIconos();

      if (menu && !menu.hasAttribute('hidden')) {
        cerrarMenu();
      }
    });
  }

  // 2. Control del menú flotante de roles
  function estaColapsado() {
    return (
      appShell?.classList.contains('sidebar-collapsed') ||
      sidebar?.classList.contains('collapsed') ||
      window.innerWidth <= 760
    );
  }

  function posicionarMenu() {
    if (!menu) return;

    const colapsado = estaColapsado();

    if (colapsado) {
      menu.classList.remove('dropdown-expanded');
      menu.classList.add('dropdown-collapsed');

      const trigger = btnCollapsed || btnExpanded;
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${Math.max(8, rect.top)}px`;
        menu.style.left = `${rect.right + 10}px`;
      }
    } else {
      menu.classList.remove('dropdown-collapsed');
      menu.classList.add('dropdown-expanded');
      menu.style.position = 'absolute';
      menu.style.top = '';
      menu.style.left = '';
    }
  }

  function abrirMenu(disparador) {
    if (!menu) return;

    ultimoBotonDisparador = disparador;
    posicionarMenu();
    menu.removeAttribute('hidden');
    disparador?.setAttribute('aria-expanded', 'true');

    // Mover foco a la opción activa o primera opción
    const opcionActiva =
      menu.querySelector('.role-menu-item.active') ||
      menu.querySelector('.role-menu-item');

    if (opcionActiva) {
      setTimeout(() => opcionActiva.focus(), 15);
    }
  }

  function cerrarMenu() {
    if (!menu) return;

    menu.setAttribute('hidden', '');
    btnExpanded?.setAttribute('aria-expanded', 'false');
    btnCollapsed?.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu(disparador) {
    if (!menu) return;

    const estaAbierto = !menu.hasAttribute('hidden');
    if (estaAbierto) {
      cerrarMenu();
    } else {
      abrirMenu(disparador);
    }
  }

  if (btnExpanded && !btnExpanded.classList.contains('is-single')) {
    btnExpanded.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(btnExpanded);
    });

    btnExpanded.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirMenu(btnExpanded);
      }
    });
  }

  if (btnCollapsed && !btnCollapsed.classList.contains('is-single')) {
    btnCollapsed.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(btnCollapsed);
    });

    btnCollapsed.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirMenu(btnCollapsed);
      }
    });
  }

  // 3. Ejecución de cambio de rol activo
  async function seleccionarRol(nuevoRol) {
    const rolActual = container?.dataset.rolActivo;

    if (!nuevoRol || nuevoRol === rolActual) {
      cerrarMenu();
      ultimoBotonDisparador?.focus();
      return;
    }

    if (btnExpanded) btnExpanded.disabled = true;
    if (btnCollapsed) btnCollapsed.disabled = true;

    try {
      if (selectEspacio) {
        selectEspacio.value = nuevoRol;
      }

      const ok = await cambiarRolActivo(nuevoRol);
      if (ok) {
        cerrarMenu();
        if (typeof onCambiarRol === 'function') {
          await onCambiarRol(nuevoRol);
        }
      } else {
        cerrarMenu();
        if (btnExpanded) btnExpanded.disabled = false;
        if (btnCollapsed) btnCollapsed.disabled = false;
        alert('No fue posible cambiar al rol seleccionado.');
      }
    } catch (err) {
      cerrarMenu();
      if (btnExpanded) btnExpanded.disabled = false;
      if (btnCollapsed) btnCollapsed.disabled = false;
      alert(err?.message || 'Error al cambiar de rol activo.');
    }
  }

  if (menu) {
    const opciones = Array.from(menu.querySelectorAll('.role-menu-item'));

    opciones.forEach((item) => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const rol = item.dataset.rol;
        await seleccionarRol(rol);
      });
    });

    menu.addEventListener('keydown', async (e) => {
      const items = Array.from(menu.querySelectorAll('.role-menu-item'));
      const currentIndex = items.indexOf(document.activeElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % items.length;
        items[nextIndex]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + items.length) % items.length;
        items[prevIndex]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const rol = document.activeElement?.dataset.rol;
        if (rol) {
          await seleccionarRol(rol);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cerrarMenu();
        ultimoBotonDisparador?.focus();
      } else if (e.key === 'Tab') {
        cerrarMenu();
      }
    });
  }

  // Cierre global al hacer click fuera o cambiar de tamaño
  document.addEventListener('click', (e) => {
    if (!menu || menu.hasAttribute('hidden')) return;

    if (
      !menu.contains(e.target) &&
      !btnExpanded?.contains(e.target) &&
      !btnCollapsed?.contains(e.target)
    ) {
      cerrarMenu();
    }
  });

  window.addEventListener('resize', () => {
    if (menu && !menu.hasAttribute('hidden')) {
      posicionarMenu();
    }
  });
}
