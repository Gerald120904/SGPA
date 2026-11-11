import {
  LoginPage,
  iniciarLoginPage
} from '../pages/login/LoginPage.js';

import {
  ModulePlaceholderPage
} from '../pages/shared/ModulePlaceholderPage.js';

import { obtenerCicloVidaPagina } from './page-lifecycle.js';

import {
  montarAppLayout
} from '../layouts/AppLayout.js';

import {
  crearGestorEventos
} from '../utils/event-lifecycle.js';

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
  obtenerVersionSesion,
  limpiarSesion
} from './session.js';

import {
  obtenerRutaActual,
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
let layoutActivo = null;
let appEventos = null;
let desuscribirSesionInvalidada = null;

let detenerObservadorRutas = null;
let intervaloSesion = null;
let comprobandoSesion = false;
let cerrandoSesionEnCurso = false;
let generacionVigilanciaSesion = 0;
let generacionAplicacion = 0;

function desmontarLayoutActual() {
  layoutActivo?.desmontar();
  layoutActivo = null;
}

export function destruirAplicacion() {
  generacionAplicacion += 1;
  detenerVigilanciaSesion();
  desmontarRouter();
  desmontarLayoutActual();
  appEventos?.destruir();
  appEventos = null;
  if (typeof desuscribirSesionInvalidada === 'function') {
    desuscribirSesionInvalidada();
  }
  desuscribirSesionInvalidada = null;
  appRoot = null;
  comprobandoSesion = false;
  cerrandoSesionEnCurso = false;
}

function detenerVigilanciaSesion() {
  generacionVigilanciaSesion += 1;
  if (intervaloSesion) clearInterval(intervaloSesion);
  intervaloSesion = null;
  comprobandoSesion = false;
}

function sesionInvalidada() {
  if (!obtenerUsuario()) return;
  detenerVigilanciaSesion();
  desmontarRouter();
  desmontarLayoutActual();
  limpiarSesion();
  if (!appRoot) return;
  mostrarLogin();
  appRoot.insertAdjacentHTML('afterbegin',
    '<p role="alert" class="session-expired">Tu sesión cambió. Ingresá nuevamente.</p>');
}

function vigilarSesion() {
  detenerVigilanciaSesion();
  const generacion = generacionVigilanciaSesion;
  intervaloSesion = setInterval(async () => {
    if (generacion !== generacionVigilanciaSesion || comprobandoSesion) return;
    const usuarioConsultado = obtenerUsuario();
    if (!usuarioConsultado) return;
    const versionConsultada = obtenerVersionSesion();
    comprobandoSesion = true;
    try {
      const respuesta = await window.sgpa?.obtenerPerfil?.();
      if (
        generacion !== generacionVigilanciaSesion ||
        versionConsultada !== obtenerVersionSesion() ||
        usuarioConsultado !== obtenerUsuario()
      ) return;
      const usuarioPerfil = respuesta?.usuario;
      const cuentaInvalida =
        respuesta?.status === 401 ||
        usuarioPerfil?.activo === false ||
        (respuesta?.ok && usuarioPerfil && !tieneRolValido(usuarioPerfil));
      if (cuentaInvalida) {
        sesionInvalidada();
      }
    } catch (_) {
    } finally {
      if (generacion === generacionVigilanciaSesion) {
        comprobandoSesion = false;
      }
    }
  }, 30000);
}

function mostrarSeleccionCarrera(usuario, carreras) {
  desmontarRouter();
  desmontarLayoutActual();
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
  desmontarLayoutActual();
  appRoot.innerHTML = pantallaSinPermisos();
}



/* =========================================================
   INICIAR APLICACIÓN
   ========================================================= */

export function iniciarAplicacion({ rootElement = null } = {}) {
  const raiz =
    rootElement ||
    document.getElementById('app');

  if (!raiz) {
    throw new Error(
      'No se encontró el elemento #app.'
    );
  }

  generacionAplicacion += 1;
  detenerVigilanciaSesion();
  appEventos?.destruir();
  if (typeof desuscribirSesionInvalidada === 'function') {
    desuscribirSesionInvalidada();
  }

  appRoot = raiz;
  cerrandoSesionEnCurso = false;
  appEventos = crearGestorEventos();
  appEventos.escuchar(appRoot, 'click', manejarClickGlobal);

  const desuscribir = window.sgpa?.onSesionInvalidada?.(sesionInvalidada);
  desuscribirSesionInvalidada =
    typeof desuscribir === 'function' ? desuscribir : null;

  mostrarLogin();
}


/* =========================================================
   LOGIN
   ========================================================= */

function mostrarLogin() {

  desmontarRouter();
  desmontarLayoutActual();

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

function resolverEstadoAccesoUsuario(usuario) {
  if (!usuario) {
    return { estado: 'LOGIN' };
  }

  if (!tieneRolValido(usuario)) {
    console.error(
      'Acceso rechazado: el usuario no posee un rol válido en SGPA.'
    );
    detenerVigilanciaSesion();
    limpiarSesion();
    return { estado: 'LOGIN' };
  }

  if (usuario.rolActivo === ROLES.ASISTENTE_ESTUDIANTIL) {
    const carreras = (usuario.carrerasDisponibles || []).filter((c) => c.permisos?.length);
    if (!carreras.length) {
      return { estado: 'SIN_PERMISOS' };
    }
    if (!usuario.carreraActiva) {
      if (carreras.length > 1) {
        return { estado: 'SELECCIONAR_CARRERA', carreras };
      }
      return { estado: 'AUTO_CARRERA', carreraId: carreras[0].id };
    }
  }

  return { estado: 'SHELL' };
}

async function manejarCambioContextoShell() {
  reemplazarRuta('/home');
  mostrarAplicacion();
}

function mostrarAplicacion() {

  const usuario =
    obtenerUsuario();

  const decision =
    resolverEstadoAccesoUsuario(usuario);

  if (decision.estado === 'LOGIN') {
    mostrarLogin();
    return;
  }

  if (decision.estado === 'SIN_PERMISOS') {
    mostrarSinPermisos();
    return;
  }

  if (decision.estado === 'SELECCIONAR_CARRERA') {
    mostrarSeleccionCarrera(usuario, decision.carreras);
    return;
  }

  if (decision.estado === 'AUTO_CARRERA') {
    const generacion = generacionAplicacion;
    cambiarCarreraActiva(decision.carreraId, {
      vigente: () => generacion === generacionAplicacion && Boolean(appRoot),
    })
      .then((usuarioActualizado) => {
        if (
          generacion !== generacionAplicacion ||
          obtenerUsuario() !== usuarioActualizado
        ) return;
        mostrarAplicacion();
      })
      .catch(() => {
        if (
          generacion === generacionAplicacion &&
          obtenerUsuario() === usuario
        ) mostrarSinPermisos();
      });
    return;
  }

  const shellMontado =
    layoutActivo &&
    !layoutActivo.obtenerEstado().desmontado &&
    Boolean(appRoot?.querySelector?.('#appShell'));

  if (shellMontado) {
    layoutActivo.actualizar({
      usuario,
      rutaActiva: obtenerRutaActual(),
    });
    renderizarRuta(obtenerRutaActual());
    return;
  }

  desmontarLayoutActual();

  layoutActivo = montarAppLayout(appRoot, {
    usuario,
    rutaActiva: obtenerRutaActual(),
    onNavegar: manejarNavegacionAutorizada,
    onCerrarSesion: cerrarSesion,
    onCambiarRol: manejarCambioContextoShell,
    onCambiarCarrera: manejarCambioContextoShell,
    onRenderizarIconos: renderizarIconos,
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

  const page = obtenerCicloVidaPagina(module.id);


  console.log(
    '[SGPA ROUTER]',
    {
      route,

      module:
        module.id,

      renderer:
        page?.render?.name ||
        'placeholder'
    }
  );


  /* =======================================================
     RENDER
     ======================================================= */

  if (page) {

    contentArea.innerHTML =
      page.render();

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

  page?.initialize?.();

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

  if (layoutActivo) {
    layoutActivo.sincronizarRuta(module.id);
    return;
  }

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

function manejarNavegacionAutorizada(
  route
) {

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

  layoutActivo?.cerrarMenus?.();

  navegar(
    route
  );

}

function manejarClickGlobal(
  event
) {
  const carrera = event.target.closest('[data-seleccionar-carrera]');
  if (carrera) {
    if (carrera.disabled) return;
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


  manejarNavegacionAutorizada(
    routeElement.dataset.route
  );

}


/* =========================================================
   CERRAR SESIÓN
   ========================================================= */

async function cerrarSesion() {
  if (cerrandoSesionEnCurso) {
    return;
  }

  cerrandoSesionEnCurso = true;
  const generacion = generacionAplicacion;
  const versionSesionInicial = obtenerVersionSesion();
  detenerVigilanciaSesion();

  desmontarRouter();
  desmontarLayoutActual();


  try {

    await logout();

  } catch (error) {

    console.error(
      'Error al cerrar la sesión en Electron:',
      error
    );

  } finally {

    cerrandoSesionEnCurso = false;

    if (
      generacion !== generacionAplicacion ||
      versionSesionInicial !== obtenerVersionSesion()
    ) {
      return;
    }

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
