import { MODULES } from '../config/modules.js';
import { puedeAcceder } from '../config/permissions.js';
import {
  obtenerRolActivo,
  obtenerPermisosUsuario,
} from '../app/session.js';
import { obtenerIconoRol, iniciarSelectorRol } from './RoleSelector.js';
import { escapeHtml } from '../utils/html.js';
import { logoUnaUrl } from '../utils/brand-assets.js';
import { renderizarIconos } from '../utils/icons.js';
import { crearGestorEventos } from '../utils/event-lifecycle.js';

export { obtenerIconoRol };

export const BREAKPOINT_SIDEBAR_COMPACTO = 900;

let sidebarActivaInstancia = null;

/**
 * Indica si el ancho del viewport corresponde al modo responsive compacto.
 */
export function esViewportCompacto(ancho = typeof window !== 'undefined' ? window.innerWidth : 1200) {
  return Number.isFinite(ancho) && ancho <= BREAKPOINT_SIDEBAR_COMPACTO;
}

/**
 * Calcula los módulos y secciones visibles del Sidebar para el rol activo del usuario.
 */
export function obtenerModulosVisiblesSidebar(usuario, permisos = []) {
  const rolActivo = obtenerRolActivo(usuario) || usuario?.rolActivo || null;
  const rolesEfectivos = rolActivo ? [rolActivo] : [];
  const permisosLista = Array.isArray(permisos)
    ? permisos
    : obtenerPermisosUsuario(usuario);

  const modulosDisponiblesTotal = MODULES.filter(
    (m) =>
      m.id !== 'home' &&
      m.id !== 'dashboard' &&
      puedeAcceder(rolesEfectivos, m.id, permisosLista),
  );

  const modulosVisibles = MODULES.filter((module) => {
    if (module.id === 'dashboard' && modulosDisponiblesTotal.length === 0) {
      return false;
    }
    return puedeAcceder(rolesEfectivos, module.id, permisosLista);
  });

  const secciones = [
    ...new Set(modulosVisibles.map((module) => module.section).filter(Boolean)),
  ];

  return {
    rolActivo,
    rolesEfectivos,
    modulosVisibles,
    secciones,
  };
}

function esRutaOIdActivo(module, rutaActiva) {
  if (!rutaActiva) return false;
  return module.id === rutaActiva || module.route === rutaActiva;
}

function renderNavItem(module, rutaActiva = null) {
  const label = module.navLabel || module.title;
  const activo = esRutaOIdActivo(module, rutaActiva);

  return `
    <button
      class="nav-item${activo ? ' active' : ''}"
      data-module="${module.id}"
      data-route="${module.route}"
      type="button"
      title="${escapeHtml(label)}"${activo ? ' aria-current="page"' : ''}
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

/**
 * Renderiza el contenido de secciones e ítems de navegación del Sidebar.
 */
export function renderizarNavegacionSidebar({
  usuario,
  permisos = [],
  rutaActiva = null,
}) {
  const { modulosVisibles, secciones } = obtenerModulosVisiblesSidebar(
    usuario,
    permisos,
  );

  return secciones
    .map((section) => {
      const modules = modulosVisibles.filter(
        (module) => module.section === section,
      );

      return `
            <div class="nav-section-title">
              ${escapeHtml(section)}
            </div>

            ${modules.map((module) => renderNavItem(module, rutaActiva)).join('')}
          `;
    })
    .join('');
}

/**
 * Renderiza la estructura completa del menú lateral institucional.
 */
export function Sidebar({
  usuario,
  roles,
  permisos,
  rutaActiva = null,
  isCollapsed = false,
}) {
  const nombre = usuario?.nombres || 'Usuario';
  const inicial = nombre.trim().charAt(0).toUpperCase() || 'A';
  const permisosLista =
    permisos !== undefined ? permisos : obtenerPermisosUsuario(usuario);
  const navegacion = renderizarNavegacionSidebar({
    usuario,
    permisos: permisosLista,
    rutaActiva,
  });

  return `
    <aside
      id="sidebar"
      class="sidebar ${isCollapsed ? 'collapsed' : ''}"
    >

      <!-- =============================================== -->
      <!-- LOGO UNIVERSIDAD NACIONAL; EXPANSIÓN AUTOMÁTICA AL PASAR EL MOUSE -->
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

/**
 * Sincroniza la clase activa y aria-current de los ítems de navegación del Sidebar.
 */
export function sincronizarRutaSidebar(moduleIdORoute, root = null) {
  const ambito =
    root ||
    (typeof document !== 'undefined'
      ? document.getElementById?.('sidebar') || document
      : null);
  if (!ambito || typeof ambito.querySelectorAll !== 'function') {
    return;
  }

  ambito.querySelectorAll('.nav-item').forEach((item) => {
    const activo =
      Boolean(moduleIdORoute) &&
      (item.dataset?.module === moduleIdORoute ||
        item.dataset?.route === moduleIdORoute);
    item.classList?.toggle('active', activo);
    if (activo) {
      item.setAttribute?.('aria-current', 'page');
    } else {
      item.removeAttribute?.('aria-current');
    }
  });
}

/**
 * Limpia el estado colapsado heredado en #appShell, #sidebar y localStorage
 * para preservar la expansión automática por hover del diseño institucional.
 */
export function limpiarEstadoColapsadoSidebar({ appShell = null, sidebar = null } = {}) {
  if (appShell && sidebar) {
    appShell.classList?.remove('sidebar-collapsed');
    sidebar.classList?.remove('collapsed');
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sgpa_sidebar_collapsed', 'false');
      }
    } catch (_) {}
  }
}

function resolverElemento(container, doc, id) {
  if (container && typeof container.querySelector === 'function') {
    const encontrado = container.querySelector(`#${id}`);
    if (encontrado) return encontrado;
  }
  return doc?.getElementById?.(id) || null;
}

/**
 * Inicializa el ciclo de vida del menú lateral, su estado de expansión/responsive
 * y, en invocaciones directas heredadas, delega el selector de rol sin acumular listeners.
 */
export function iniciarSidebar({
  onCambiarRol,
  onNavegar,
  onCerrarSesion,
  onCambioEstado,
  onError,
  container = null,
  gestionarSelectorRol = true,
  gestionarResize = true,
  rutaActiva = null,
} = {}) {
  sidebarActivaInstancia?.destruir();

  const gestor = crearGestorEventos();
  const doc = typeof document !== 'undefined' ? document : null;
  const win = typeof window !== 'undefined' ? window : null;

  let appShell = resolverElemento(container, doc, 'appShell');
  let sidebar = resolverElemento(container, doc, 'sidebar');
  let navEl = sidebar?.querySelector?.('.sidebar-nav') || null;
  let logoutButton =
    sidebar?.querySelector?.('#logoutButton') ||
    resolverElemento(container, doc, 'logoutButton');

  limpiarEstadoColapsadoSidebar({ appShell, sidebar });

  const estado = {
    expandido: false,
    colapsado: false,
    viewportCompacto: esViewportCompacto(win?.innerWidth),
    rutaActiva,
  };

  function aplicarEstadoAtributos() {
    if (sidebar?.dataset) {
      sidebar.dataset.sidebarExpanded = String(estado.expandido);
      sidebar.dataset.viewportCompacto = String(estado.viewportCompacto);
    }
    if (appShell?.dataset) {
      appShell.dataset.sidebarExpanded = String(estado.expandido);
      appShell.dataset.viewportCompacto = String(estado.viewportCompacto);
    }
  }

  function notificarCambioEstado() {
    if (typeof onCambioEstado === 'function' && !gestor.destruido) {
      onCambioEstado({ ...estado });
    }
  }

  function establecerExpandido(valor) {
    if (gestor.destruido) return;
    const siguiente = Boolean(valor);
    if (siguiente && estado.colapsado) {
      estado.colapsado = false;
      appShell?.classList?.remove('sidebar-collapsed');
      sidebar?.classList?.remove('collapsed');
    }
    estado.expandido = siguiente;
    aplicarEstadoAtributos();
    notificarCambioEstado();
  }

  function establecerColapsado(valor) {
    if (gestor.destruido) return;
    estado.colapsado = Boolean(valor);
    if (estado.colapsado) {
      estado.expandido = false;
    }
    appShell?.classList?.toggle('sidebar-collapsed', estado.colapsado);
    sidebar?.classList?.toggle('collapsed', estado.colapsado);
    aplicarEstadoAtributos();
    notificarCambioEstado();
  }

  function actualizarResponsive(ancho = win?.innerWidth) {
    if (gestor.destruido) return;
    const compacto = esViewportCompacto(ancho);
    if (estado.viewportCompacto !== compacto) {
      estado.viewportCompacto = compacto;
      if (compacto && estado.expandido) {
        estado.expandido = false;
      }
      aplicarEstadoAtributos();
      notificarCambioEstado();
    } else {
      aplicarEstadoAtributos();
    }
  }

  function sincronizarRuta(moduleIdORoute) {
    if (gestor.destruido) return;
    estado.rutaActiva = moduleIdORoute || null;
    sincronizarRutaSidebar(moduleIdORoute, sidebar || container || doc);
  }

  aplicarEstadoAtributos();
  if (rutaActiva) {
    sincronizarRuta(rutaActiva);
  }

  if (sidebar) {
    gestor.escuchar(sidebar, 'mouseenter', () => establecerExpandido(true));
    gestor.escuchar(sidebar, 'mouseleave', () => establecerExpandido(false));
  }

  if (navEl && typeof onNavegar === 'function') {
    gestor.escuchar(navEl, 'click', (event) => {
      const boton = event?.target?.closest?.('[data-route]');
      const route = boton?.dataset?.route;
      if (!route) return;
      event?.stopPropagation?.();
      onNavegar(route, boton);
    });
  }

  if (logoutButton && typeof onCerrarSesion === 'function') {
    gestor.escuchar(logoutButton, 'click', (event) => {
      event?.stopPropagation?.();
      onCerrarSesion();
    });
  }

  const hayControlesSelector = Boolean(
    resolverElemento(container, doc, 'btnRolActivoExpanded') ||
      resolverElemento(container, doc, 'btnRolActivoCollapsed') ||
      resolverElemento(container, doc, 'menuRolesFlotante'),
  );

  const selectorRolCompat =
    gestionarSelectorRol && hayControlesSelector
      ? iniciarSelectorRol({
          onCambiarRol,
          onError,
          container,
          gestionarResize: false,
        })
      : null;

  if (gestionarResize && win) {
    gestor.escuchar(win, 'resize', () => {
      actualizarResponsive(win.innerWidth);
      if (selectorRolCompat?.estaAbierto()) {
        selectorRolCompat.posicionarMenu();
      }
    });
  }

  const instancia = {
    sincronizarRuta,
    establecerExpandido,
    establecerColapsado,
    actualizarResponsive,
    actualizarMenu({ usuario, permisos = [], rutaActiva: nuevaRuta = estado.rutaActiva } = {}) {
      if (gestor.destruido || !navEl) return;
      const permisosLista =
        permisos !== undefined ? permisos : obtenerPermisosUsuario(usuario);
      estado.rutaActiva = nuevaRuta || null;
      navEl.innerHTML = renderizarNavegacionSidebar({
        usuario,
        permisos: permisosLista,
        rutaActiva: estado.rutaActiva,
      });
      if (typeof doc !== 'undefined' && typeof doc.querySelectorAll === 'function') {
        try {
          renderizarIconos();
        } catch (_) {}
      }
    },
    obtenerEstado: () => ({ ...estado }),
    destruir() {
      selectorRolCompat?.destruir();
      gestor.destruir();
      if (sidebarActivaInstancia === instancia) {
        sidebarActivaInstancia = null;
      }
      appShell = null;
      sidebar = null;
      navEl = null;
      logoutButton = null;
    },
  };

  gestor.registrarLimpieza(() => {
    selectorRolCompat?.destruir();
    if (sidebarActivaInstancia === instancia) {
      sidebarActivaInstancia = null;
    }
    appShell = null;
    sidebar = null;
    navEl = null;
    logoutButton = null;
  });

  sidebarActivaInstancia = instancia;
  return instancia;
}
