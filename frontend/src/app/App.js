import {
  LoginPage,
  iniciarLoginPage
} from '../pages/login/LoginPage.js';

import {
  HomePage,
  iniciarHomePage
} from '../pages/home/HomePage.js';

import {
  ModulesPage
} from '../pages/modules/ModulesPage.js';

import {
  UsuariosPage,
  iniciarUsuariosPage
} from '../pages/usuarios/UsuariosPage.js';
import { MisAsistentesPage, iniciarMisAsistentesPage } from '../pages/usuarios/MisAsistentesPage.js';

import {
  CarrerasPage,
  iniciarCarrerasPage
} from '../pages/carreras/CarrerasPage.js';

import {
  PlanesEstudioPage,
  iniciarPlanesEstudioPage
} from '../pages/planes-estudio/PlanesEstudioPage.js';

import {
  PerfilesAcademicosPage,
  iniciarPerfilesAcademicosPage
} from '../pages/perfiles-academicos/PerfilesAcademicosPage.js';

import {
  CursosPage,
  iniciarCursosPage
} from '../pages/cursos/CursosPage.js';

import {
  PeriodosPage,
  iniciarPeriodosPage
} from '../pages/periodos/PeriodosPage.js';

import {
  ProfesoresPage,
  iniciarProfesoresPage
} from '../pages/profesores/ProfesoresPage.js';

import {
  AulasPage,
  iniciarAulasPage
} from '../pages/aulas/AulasPage.js';

import {
  FormulariosEstudiantesPage,
  iniciarFormulariosEstudiantesPage
} from '../pages/formularios-estudiantes/FormulariosEstudiantesPage.js';

import {
  EstudiantesPage,
  iniciarEstudiantesPage
} from '../pages/estudiantes/EstudiantesPage.js';

import {
  ModulePlaceholderPage
} from '../pages/shared/ModulePlaceholderPage.js';

import {
  AppLayout
} from '../layouts/AppLayout.js';

import {
  iniciarSidebar
} from '../components/Sidebar.js';

import {
  obtenerModuloPorRuta
} from '../config/modules.js';

import {
  puedeAcceder, ROLES
} from '../config/permissions.js';

import {
  guardarSesion,
  cambiarCarreraActiva,
  cambiarRolActivo,
  obtenerUsuario,
  obtenerRolesUsuario,
  obtenerRolesEfectivos,
  obtenerPermisosUsuario,
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
import { escapeHtml } from '../utils/html.js';


let appRoot = null;

let detenerObservadorRutas = null;
let intervaloSesion = null;
let comprobandoSesion = false;

function detenerVigilanciaSesion() {
  if (intervaloSesion) clearInterval(intervaloSesion);
  intervaloSesion = null;
}

function sesionInvalidada() {
  if (!obtenerUsuario()) return;
  detenerVigilanciaSesion();
  desmontarRouter();
  limpiarSesion();
  mostrarLogin();
  appRoot.insertAdjacentHTML('afterbegin',
    '<p role="alert" class="session-expired">Tu sesión cambió. Ingresá nuevamente.</p>');
}

function vigilarSesion() {
  detenerVigilanciaSesion();
  intervaloSesion = setInterval(async () => {
    if (comprobandoSesion || !obtenerUsuario()) return;
    comprobandoSesion = true;
    try {
      const respuesta = await window.sgpa.obtenerPerfil();
      if (respuesta?.status === 401) sesionInvalidada();
    } finally {
      comprobandoSesion = false;
    }
  }, 30000);
}

function mostrarSeleccionCarrera(usuario, carreras) {
  desmontarRouter();
  appRoot.innerHTML = `<main class="content-area"><h1>Seleccioná una carrera</h1>
    <p>Elegí la carrera con la que vas a trabajar.</p>
    ${carreras.map((c) => `<button type="button" data-seleccionar-carrera="${Number(c.id)}">${escapeHtml(c.nombre)}</button>`).join(' ')}
    <button type="button" id="logoutButton">Cerrar sesión</button></main>`;
}

export function pantallaSinPermisos() {
  return `<main class="content-area"><h1>Acceso pendiente</h1>
    <p>No tenés permisos asignados. Contactá a tu coordinador para solicitar acceso.</p>
    <button type="button" id="logoutButton">Cerrar sesión</button></main>`;
}

function mostrarSinPermisos() {
  desmontarRouter();
  appRoot.innerHTML = pantallaSinPermisos();
}


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

  'mis-asistentes':
    MisAsistentesPage,

  carreras:
    CarrerasPage,

  'planes-estudio':
    PlanesEstudioPage,

  'perfiles-academicos':
    PerfilesAcademicosPage,

  cursos:
    CursosPage,

  periodos:
    PeriodosPage,

  profesores:
    ProfesoresPage,

  aulas:
    AulasPage,

  'formularios-estudiantes':
    FormulariosEstudiantesPage,

  estudiantes:
    EstudiantesPage

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
  window.sgpa?.onSesionInvalidada?.(sesionInvalidada);


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
        vigilarSesion();


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

  if (usuario.rolActivo === ROLES.ASISTENTE_ESTUDIANTIL) {
    const carreras = (usuario.carrerasDisponibles || []).filter((c) => c.permisos?.length);
    if (!carreras.length) { mostrarSinPermisos(); return; }
    if (!usuario.carreraActiva) {
      if (carreras.length > 1) { mostrarSeleccionCarrera(usuario, carreras); return; }
      cambiarCarreraActiva(carreras[0].id).then(() => mostrarAplicacion())
        .catch(() => mostrarSinPermisos());
      return;
    }
  }


  const roles =
    obtenerRolesEfectivos(
      usuario
    );

  const permisos =
    obtenerPermisosUsuario(
      usuario
    );


  const isCollapsed =
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('sgpa_sidebar_collapsed') === 'true';

  appRoot.innerHTML =
    AppLayout({
      usuario,
      roles,
      permisos,
      isCollapsed
    });

  appRoot.querySelector('#carreraActivaSelector')?.addEventListener('change', async (event) => {
    const selector = event.target;
    selector.disabled = true;
    try {
      await cambiarCarreraActiva(Number(selector.value));
      reemplazarRuta('/home');
      mostrarAplicacion();
    } catch (error) {
      selector.disabled = false;
      selector.value = String(usuario.carreraActiva);
      alert(error.message);
    }
  });


  renderizarIconos();

  iniciarSidebar({
    onCambiarRol: async () => {
      reemplazarRuta('/home');
      mostrarAplicacion();
    }
  });


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
    obtenerRolesEfectivos(
      usuario
    );

  const permisos =
    obtenerPermisosUsuario(
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
      module.id,
      permisos
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

  if (module.id === 'home') {
    iniciarHomePage();
  }

  if (
    module.id === 'usuarios'
  ) {

    iniciarUsuariosPage();

  }

  if (module.id === 'mis-asistentes') {
    iniciarMisAsistentesPage();
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
    module.id ===
    'perfiles-academicos'
  ) {

    iniciarPerfilesAcademicosPage();

  }


  if (
    module.id === 'cursos'
  ) {

    iniciarCursosPage();

  }


  if (
    module.id === 'periodos'
  ) {

    iniciarPeriodosPage();

  }


  if (
    module.id === 'profesores'
  ) {

    iniciarProfesoresPage();

  }


  if (
    module.id === 'aulas'
  ) {

    iniciarAulasPage();

  }


  if (
    module.id ===
    'formularios-estudiantes'
  ) {

    iniciarFormulariosEstudiantesPage();

  }


  if (
    module.id === 'estudiantes'
  ) {

    iniciarEstudiantesPage();

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
  const carrera = event.target.closest('[data-seleccionar-carrera]');
  if (carrera) {
    carrera.disabled = true;
    cambiarCarreraActiva(Number(carrera.dataset.seleccionarCarrera))
      .then(() => { reemplazarRuta('/home'); mostrarAplicacion(); })
      .catch((error) => { carrera.disabled = false; alert(error.message); });
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


  const roles =
    obtenerRolesEfectivos(
      usuario
    );

  const permisos =
    obtenerPermisosUsuario(
      usuario
    );


  if (
    !puedeAcceder(
      roles,
      module.id,
      permisos
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
  detenerVigilanciaSesion();

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
