import {
  LoginPage,
  iniciarLoginPage
} from '../pages/login/LoginPage.js';

import {
  HomePage
} from '../pages/home/HomePage.js';

import {
  ModulesPage
} from '../pages/modules/ModulesPage.js';

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
  obtenerRolUsuario,
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


let appRoot = null;

let detenerObservadorRutas =
  null;


/* =========================================================
   PÁGINAS IMPLEMENTADAS
   =========================================================

   IMPORTANTE:

   home
       ↓
   HomePage
       ↓
   estadísticas / indicadores


   dashboard
       ↓
   ModulesPage
       ↓
   cards de módulos

   ========================================================= */

const PAGE_RENDERERS = {

  home:
    HomePage,

  dashboard:
    ModulesPage

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


        /*
         * Al iniciar sesión SIEMPRE
         * entramos a Home.
         */

        reemplazarRuta(
          '/home'
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


  const rol =
    obtenerRolUsuario(
      usuario
    );


  appRoot.innerHTML =
    AppLayout({
      usuario,
      rol
    });


  aplicarEstadoInicialSidebar();


  renderizarIconos();


  desmontarRouter();


  detenerObservadorRutas =
    observarRutas(
      renderizarRuta
    );

}


/* =========================================================
   SIDEBAR - ESTADO INICIAL
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


  if (
    estadoGuardado !== null
  ) {

    collapsed =
      estadoGuardado ===
      'true';

  } else {

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
   SIDEBAR - ALTERNAR
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
   BOTÓN SIDEBAR
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


  const rol =
    obtenerRolUsuario(
      usuario
    );


  let module =
    obtenerModuloPorRuta(
      route
    );


  /* =======================================================
     RUTA INVÁLIDA
     ======================================================= */

  if (!module) {

    reemplazarRuta(
      '/home'
    );


    module =
      obtenerModuloPorRuta(
        '/home'
      );

  }


  /* =======================================================
     PERMISOS
     ======================================================= */

  if (
    !puedeAcceder(
      rol,
      module.id
    )
  ) {

    reemplazarRuta(
      '/home'
    );


    module =
      obtenerModuloPorRuta(
        '/home'
      );

  }


  const contentArea =
    document.getElementById(
      'contentArea'
    );


  if (!contentArea) {
    return;
  }


  /* =======================================================
     BUSCAR RENDERER
     ======================================================= */

  const renderer =
    PAGE_RENDERERS[
      module.id
    ];


  /*
   * Para verificar visualmente durante desarrollo:
   */

  console.log(
    '[SGPA ROUTER]',
    {
      route,
      module:
        module.id,

      renderer:
        renderer?.name ||
        'placeholder'
    }
  );


  /* =======================================================
     RENDER
     ======================================================= */

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


  contentArea.scrollTop = 0;


  renderizarIconos();

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
   EVENTOS
   ========================================================= */

function manejarClickGlobal(
  event
) {

  /* =======================================================
     SIDEBAR
     ======================================================= */

  const sidebarToggle =
    event.target.closest(
      '#sidebarToggle'
    );


  if (sidebarToggle) {

    alternarSidebar();

    return;

  }


  /* =======================================================
     CERRAR SESIÓN
     ======================================================= */

  const logoutButton =
    event.target.closest(
      '#logoutButton'
    );


  if (logoutButton) {

    cerrarSesion();

    return;

  }


  /* =======================================================
     NAVEGACIÓN
     ======================================================= */

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


  const rol =
    obtenerRolUsuario(
      usuario
    );


  if (
    !puedeAcceder(
      rol,
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

function cerrarSesion() {

  desmontarRouter();

  limpiarSesion();

  mostrarLogin();

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