import {
  LoginPage,
  iniciarLoginPage
} from '../pages/login/LoginPage.js';

import {
  DashboardPage
} from '../pages/dashboard/DashboardPage.js';

import {
  UsuariosPage,
  iniciarUsuariosPage
} from '../pages/usuarios/UsuariosPage.js';

import {
  ModulePlaceholderPage
} from '../pages/shared/ModulePlaceholderPage.js';

import {
  AppLayout
} from '../layouts/AppLayout.js';

import {
  obtenerModuloPorRuta
} from '../config/modules.js';

import {
  puedeAcceder
} from '../config/permissions.js';

import {
  guardarSesion,
  obtenerUsuario,
  obtenerRolesUsuario,
  tieneRolValido,
  limpiarSesion
} from './session.js';

import {
  navegar,
  reemplazarRuta,
  observarRutas,
  limpiarRuta
} from './router.js';

import {
  renderizarIconos
} from '../utils/icons.js';

import {
  logout
} from '../services/auth.service.js';


let appRoot = null;

let detenerObservadorRutas =
  null;


/* =========================================================
   PÁGINAS IMPLEMENTADAS
   ========================================================= */

const PAGE_RENDERERS = {

  dashboard:
    DashboardPage,

  usuarios:
    UsuariosPage

};


/* =========================================================
   INICIAR APLICACIÓN
   ========================================================= */

export function iniciarAplicacion() {

  appRoot =
    document.getElementById(
      'app'
    );


  if (!appRoot) {

    throw new Error(
      'No se encontró el elemento #app.'
    );

  }


  /*
   * Listener global único.
   */

  appRoot.addEventListener(
    'click',
    manejarClickGlobal
  );


  mostrarLogin();

}


/* =========================================================
   LOGIN
   ========================================================= */

function mostrarLogin() {

  desmontarRouter();

  limpiarRuta();


  appRoot.innerHTML =
    LoginPage();


  document.title =
    'SGPA | Acceso';


  renderizarIconos();


  iniciarLoginPage({

    onLoginSuccess:
      (resultado) => {

        guardarSesion(
          resultado
        );


        reemplazarRuta(
          '/dashboard'
        );


        mostrarAplicacion();

      }

  });

}


/* =========================================================
   APLICACIÓN
   ========================================================= */

function mostrarAplicacion() {

  const usuario =
    obtenerUsuario();


  if (!usuario) {

    mostrarLogin();

    return;

  }


  if (
    !tieneRolValido(
      usuario
    )
  ) {

    console.error(
      'Acceso rechazado: el usuario no posee un rol válido en SGPA.'
    );


    limpiarSesion();


    mostrarLogin();


    return;

  }


  const roles =
    obtenerRolesUsuario(
      usuario
    );


  appRoot.innerHTML =
    AppLayout({
      usuario,
      roles
    });


  /*
   * Aplicar estado inicial del sidebar.
   */

  aplicarEstadoInicialSidebar();


  renderizarIconos();


  desmontarRouter();


  detenerObservadorRutas =
    observarRutas(
      renderizarRuta
    );

}


/* =========================================================
   ESTADO INICIAL SIDEBAR
   ========================================================= */

function aplicarEstadoInicialSidebar() {

  const appShell =
    document.getElementById(
      'appShell'
    );


  if (!appShell) {
    return;
  }


  const estadoGuardado =
    localStorage.getItem(
      'sgpa-sidebar-collapsed'
    );


  let collapsed;


  /*
   * Si el usuario ya eligió una opción,
   * respetamos su elección.
   */

  if (estadoGuardado !== null) {

    collapsed =
      estadoGuardado === 'true';

  } else {

    /*
     * En pantallas más pequeñas iniciamos
     * contraído automáticamente.
     */

    collapsed =
      window.innerWidth <= 900;

  }


  appShell.classList.toggle(
    'sidebar-collapsed',
    collapsed
  );


  actualizarBotonSidebar(
    collapsed
  );

}


/* =========================================================
   ALTERNAR SIDEBAR
   ========================================================= */

function alternarSidebar() {

  const appShell =
    document.getElementById(
      'appShell'
    );


  if (!appShell) {
    return;
  }


  const collapsed =
    appShell.classList.toggle(
      'sidebar-collapsed'
    );


  localStorage.setItem(
    'sgpa-sidebar-collapsed',
    String(collapsed)
  );


  actualizarBotonSidebar(
    collapsed
  );

}


/* =========================================================
   ACTUALIZAR BOTÓN SIDEBAR
   ========================================================= */

function actualizarBotonSidebar(
  collapsed
) {

  const button =
    document.getElementById(
      'sidebarToggle'
    );


  if (!button) {
    return;
  }


  button.setAttribute(
    'aria-label',
    collapsed
      ? 'Expandir menú lateral'
      : 'Contraer menú lateral'
  );


  button.setAttribute(
    'title',
    collapsed
      ? 'Expandir menú'
      : 'Contraer menú'
  );


  button.innerHTML =
    collapsed
      ? `
        <i
          data-lucide="chevron-right"
          aria-hidden="true"
        ></i>
      `
      : `
        <i
          data-lucide="chevron-left"
          aria-hidden="true"
        ></i>
      `;


  renderizarIconos();

}


/* =========================================================
   RENDERIZAR RUTA
   ========================================================= */

function renderizarRuta(
  route
) {

  const usuario =
    obtenerUsuario();


  if (!usuario) {

    mostrarLogin();

    return;

  }


  const roles =
    obtenerRolesUsuario(
      usuario
    );


  let module =
    obtenerModuloPorRuta(
      route
    );


  /*
   * Ruta inexistente.
   */

  if (!module) {

    reemplazarRuta(
      '/dashboard'
    );


    module =
      obtenerModuloPorRuta(
        '/dashboard'
      );

  }


  /*
   * Sin permiso visual.
   */

  if (
    !puedeAcceder(
      roles,
      module.id
    )
  ) {

    reemplazarRuta(
      '/dashboard'
    );


    module =
      obtenerModuloPorRuta(
        '/dashboard'
      );

  }


  const contentArea =
    document.getElementById(
      'contentArea'
    );


  if (!contentArea) {
    return;
  }


  const renderer =
    PAGE_RENDERERS[
      module.id
    ];


  if (renderer) {

    contentArea.innerHTML =
      renderer();

  } else {

    contentArea.innerHTML =
      ModulePlaceholderPage({
        titulo:
          module.title
      });

  }


  actualizarNavegacion(
    module
  );


  renderizarIconos();


  if (
    module.id === 'usuarios'
  ) {

    iniciarUsuariosPage();

  }

}


/* =========================================================
   ACTUALIZAR NAVEGACIÓN
   ========================================================= */

function actualizarNavegacion(
  module
) {

  const pageTitle =
    document.getElementById(
      'pageTitle'
    );


  if (pageTitle) {

    pageTitle.textContent =
      module.title;

  }


  document.title =
    `SGPA | ${module.title}`;


  document
    .querySelectorAll(
      '.nav-item'
    )
    .forEach(
      (item) => {

        item.classList.toggle(
          'active',
          item.dataset.module ===
            module.id
        );

      }
    );

}


/* =========================================================
   CLICS GENERALES
   ========================================================= */

function manejarClickGlobal(
  event
) {

  /*
   * BOTÓN SIDEBAR
   */

  const sidebarToggle =
    event.target.closest(
      '#sidebarToggle'
    );


  if (sidebarToggle) {

    alternarSidebar();

    return;

  }


  /*
   * CERRAR SESIÓN
   */

  const logoutButton =
    event.target.closest(
      '#logoutButton'
    );


  if (logoutButton) {

    cerrarSesion();

    return;

  }


  /*
   * NAVEGACIÓN
   */

  const routeElement =
    event.target.closest(
      '[data-route]'
    );


  if (!routeElement) {
    return;
  }


  const route =
    routeElement.dataset.route;


  if (!route) {
    return;
  }


  const module =
    obtenerModuloPorRuta(
      route
    );


  if (!module) {
    return;
  }


  const usuario =
    obtenerUsuario();


  const roles =
    obtenerRolesUsuario(
      usuario
    );


  if (
    !puedeAcceder(
      roles,
      module.id
    )
  ) {

    return;

  }


  navegar(
    route
  );

}


/* =========================================================
   CERRAR SESIÓN
   ========================================================= */

async function cerrarSesion() {

  desmontarRouter();

  try {

    await logout();

  } catch (error) {

    console.error(
      'Error al cerrar la sesión en Electron:',
      error
    );

  } finally {

    limpiarSesion();

    mostrarLogin();

  }


}


/* =========================================================
   LIMPIAR ROUTER
   ========================================================= */

function desmontarRouter() {

  if (
    detenerObservadorRutas
  ) {

    detenerObservadorRutas();

    detenerObservadorRutas =
      null;

  }

}
