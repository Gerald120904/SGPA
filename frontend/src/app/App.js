import {
  LoginPage,
  iniciarLoginPage
} from '../pages/login/LoginPage.js';

import {
  DashboardPage
} from '../pages/dashboard/DashboardPage.js';

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
   PÁGINAS REALES
   =========================================================
   Cuando desarrollemos un módulo real se agrega aquí.
   ========================================================= */

const PAGE_RENDERERS = {

  dashboard:
    DashboardPage

};


/* =========================================================
   INICIAR
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
   * Listener global.
   * Se crea una sola vez.
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


  const rol =
    obtenerRolUsuario(
      usuario
    );


  appRoot.innerHTML =
    AppLayout({
      usuario,
      rol
    });


  renderizarIconos();


  desmontarRouter();


  detenerObservadorRutas =
    observarRutas(
      renderizarRuta
    );

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
      rol,
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

}


/* =========================================================
   ACTUALIZAR TOPBAR / SIDEBAR
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
   * Cerrar sesión
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
   * Navegación.
   * Sirve tanto para Sidebar como accesos rápidos.
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
   LOGOUT
   ========================================================= */

function cerrarSesion() {

  desmontarRouter();


  limpiarSesion();


  mostrarLogin();

}


/* =========================================================
   LIMPIEZA ROUTER
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