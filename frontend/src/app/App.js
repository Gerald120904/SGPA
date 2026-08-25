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
  UsuariosPage,
  iniciarUsuariosPage
} from '../pages/usuarios/UsuariosPage.js';

import {
  CarrerasPage,
  iniciarCarrerasPage
} from '../pages/carreras/CarrerasPage.js';

import {
  PlanesEstudioPage,
  iniciarPlanesEstudioPage
} from '../pages/planes-estudio/PlanesEstudioPage.js';

import {
  CursosPage,
  iniciarCursosPage
} from '../pages/cursos/CursosPage.js';

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

let detenerObservadorRutas = null;


/* =========================================================
   PÁGINAS IMPLEMENTADAS
   ========================================================= */

const PAGE_RENDERERS = {

  home:
    HomePage,

  dashboard:
    ModulesPage,

  usuarios:
    UsuariosPage,

  carreras:
    CarrerasPage,

  'planes-estudio':
    PlanesEstudioPage,

  cursos:
    CursosPage

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


  const roles =
    obtenerRolesUsuario(
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
      roles,
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


  /* =======================================================
     INICIALIZADORES DE PÁGINAS
     ======================================================= */

  if (
    module.id === 'usuarios'
  ) {

    iniciarUsuariosPage();

  }


  if (
    module.id === 'carreras'
  ) {

    iniciarCarrerasPage();

  }


  if (
    module.id ===
    'planes-estudio'
  ) {

    iniciarPlanesEstudioPage();

  }


  if (
    module.id === 'cursos'
  ) {

    iniciarCursosPage();

  }

}


/* =========================================================
   ACTUALIZAR NAVEGACIÓN
   ========================================================= */

function actualizarNavegacion(
  module
) {

  /*
   * El Topbar mantiene siempre el nombre
   * completo del sistema.
   *
   * El nombre del módulo se muestra dentro
   * de su propia página.
   */

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
   EVENTOS GLOBALES
   ========================================================= */

function manejarClickGlobal(
  event
) {

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