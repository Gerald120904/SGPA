import {
  Sidebar,
  iniciarSidebar,
} from '../components/Sidebar.js';
import {
  Topbar,
  iniciarTopbar,
} from '../components/Topbar.js';
import {
  obtenerRolesEfectivos,
  obtenerPermisosUsuario,
} from '../app/session.js';
import { crearGestorEventos } from '../utils/event-lifecycle.js';

let layoutActivoInstancia = null;

/**
 * Renderiza el marco principal del sistema (Sidebar, Topbar y contenedor de módulo).
 */
export function AppLayout({
  usuario,
  roles,
  permisos,
  rutaActiva = null,
  isCollapsed = false,
}) {
  return `
    <main
      id="appShell"
      class="app-shell ${isCollapsed ? 'sidebar-collapsed' : ''}"
    >

      ${Sidebar({
        usuario,
        roles,
        permisos,
        rutaActiva,
        isCollapsed,
      })}


      <section class="app-main">

        ${Topbar({
          usuario,
        })}


        <div
          id="contentArea"
          class="content-area"
        ></div>

      </section>

    </main>
  `;
}

function reemplazarRegionShell(elemento, nuevoHtml) {
  if (!elemento || typeof nuevoHtml !== 'string') return false;
  try {
    if ('outerHTML' in elemento && typeof elemento.parentNode !== 'undefined') {
      elemento.outerHTML = nuevoHtml;
      return true;
    }
  } catch (_) {}
  return false;
}

/**
 * Monta y coordina el ciclo de vida compartido de Sidebar, Topbar y estado
 * responsive dentro de un único controlador para evitar listeners acumulados
 * o estados contradictorios.
 */
export function montarAppLayout(
  contenedor,
  {
    usuario,
    rutaActiva = '/home',
    onNavegar,
    onCerrarSesion,
    onCambiarRol,
    onCambiarCarrera,
    onError,
    onRenderizarIconos,
  } = {},
) {
  if (!contenedor) {
    throw new Error('Se requiere un contenedor para montar AppLayout.');
  }

  layoutActivoInstancia?.desmontar();

  const gestor = crearGestorEventos();
  const win = typeof window !== 'undefined' ? window : null;

  let usuarioActual = usuario;
  let rutaSeleccionada = rutaActiva;
  let sidebarCtrl = null;
  let topbarCtrl = null;
  let estadoSidebarSnapshot = {
    expandido: false,
    colapsado: false,
    viewportCompacto: false,
    rutaActiva: rutaSeleccionada,
  };

  function inicializarControles() {
    sidebarCtrl?.destruir();
    topbarCtrl?.destruir();

    sidebarCtrl = iniciarSidebar({
      container: contenedor,
      rutaActiva: rutaSeleccionada,
      gestionarSelectorRol: false,
      gestionarResize: false,
      onNavegar,
      onCerrarSesion,
      onError,
      onCambioEstado: (estadoSidebar) => {
        estadoSidebarSnapshot = estadoSidebar;
      },
    });

    topbarCtrl = iniciarTopbar({
      usuario: usuarioActual,
      container: contenedor,
      gestionarResize: false,
      onCambiarRol,
      onCambiarCarrera,
      onError,
    });

    estadoSidebarSnapshot = sidebarCtrl.obtenerEstado();
  }

  function renderCompleto() {
    const roles = obtenerRolesEfectivos(usuarioActual);
    const permisos = obtenerPermisosUsuario(usuarioActual);

    contenedor.innerHTML = AppLayout({
      usuario: usuarioActual,
      roles,
      permisos,
      rutaActiva: rutaSeleccionada,
      isCollapsed: false,
    });

    try {
      onRenderizarIconos?.();
    } catch (_) {}

    inicializarControles();
  }

  renderCompleto();

  if (win) {
    gestor.escuchar(win, 'resize', () => {
      sidebarCtrl?.actualizarResponsive(win.innerWidth);
      topbarCtrl?.reposicionarMenus();
    });
  }

  const instancia = {
    actualizar({ usuario: nuevoUsuario = usuarioActual, rutaActiva: nuevaRuta = rutaSeleccionada } = {}) {
      if (gestor.destruido) return;
      usuarioActual = nuevoUsuario;
      rutaSeleccionada = nuevaRuta;

      const roles = obtenerRolesEfectivos(usuarioActual);
      const permisos = obtenerPermisosUsuario(usuarioActual);

      const sidebarActual =
        contenedor.querySelector?.('#sidebar') ||
        (typeof document !== 'undefined' ? document.getElementById?.('sidebar') : null);
      const topbarActual =
        contenedor.querySelector?.('.topbar') ||
        (typeof document !== 'undefined' ? document.querySelector?.('.topbar') : null);

      sidebarCtrl?.destruir();
      topbarCtrl?.destruir();

      const actualizoParcial =
        reemplazarRegionShell(
          sidebarActual,
          Sidebar({
            usuario: usuarioActual,
            roles,
            permisos,
            rutaActiva: rutaSeleccionada,
            isCollapsed: false,
          }),
        ) &&
        reemplazarRegionShell(
          topbarActual,
          Topbar({
            usuario: usuarioActual,
          }),
        );

      if (!actualizoParcial) {
        renderCompleto();
        return;
      }

      try {
        onRenderizarIconos?.();
      } catch (_) {}

      inicializarControles();
    },

    sincronizarRuta(moduleIdORoute) {
      if (gestor.destruido) return;
      rutaSeleccionada = moduleIdORoute || null;
      sidebarCtrl?.sincronizarRuta(moduleIdORoute);
      estadoSidebarSnapshot = sidebarCtrl?.obtenerEstado() || estadoSidebarSnapshot;
    },

    expandirSidebar() {
      sidebarCtrl?.establecerExpandido(true);
    },

    contraerSidebar() {
      sidebarCtrl?.establecerExpandido(false);
    },

    establecerColapsadoSidebar(colapsado) {
      sidebarCtrl?.establecerColapsado(colapsado);
    },

    cerrarMenus() {
      topbarCtrl?.cerrarMenus();
    },

    obtenerEstado() {
      return {
        usuario: usuarioActual,
        roles: obtenerRolesEfectivos(usuarioActual),
        permisos: obtenerPermisosUsuario(usuarioActual),
        rutaActiva: rutaSeleccionada,
        sidebar: { ...estadoSidebarSnapshot },
        desmontado: gestor.destruido,
      };
    },

    desmontar() {
      sidebarCtrl?.destruir();
      topbarCtrl?.destruir();
      sidebarCtrl = null;
      topbarCtrl = null;
      gestor.destruir();
      if (layoutActivoInstancia === instancia) {
        layoutActivoInstancia = null;
      }
      contenedor = null;
      usuarioActual = null;
    },
  };

  gestor.registrarLimpieza(() => {
    sidebarCtrl?.destruir();
    topbarCtrl?.destruir();
    sidebarCtrl = null;
    topbarCtrl = null;
    if (layoutActivoInstancia === instancia) {
      layoutActivoInstancia = null;
    }
    contenedor = null;
    usuarioActual = null;
  });

  layoutActivoInstancia = instancia;
  return instancia;
}
