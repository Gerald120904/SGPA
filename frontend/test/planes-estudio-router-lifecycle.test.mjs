/**
 * SGPA — Pruebas de integración del router y ciclo de vida de Planes de Estudio.
 * AUDITORIA-GLOBAL-FRONTEND-ESTABILIZACION-INTEGRAL-001
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderizarRuta } from '../src/app/App.js';
import { guardarSesion, limpiarSesion } from '../src/app/session.js';
import { obtenerCicloVidaPagina } from '../src/app/page-lifecycle.js';
import { destruirPlanesEstudioPage } from '../src/pages/planes-estudio/PlanesEstudioPage.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function node() {
  const listeners = new Map();
  let html = '';
  let writes = 0;
  return {
    listeners,
    addEventListener(type, handler) {
      const entries = listeners.get(type) || new Set();
      entries.add(handler);
      listeners.set(type, entries);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    closest() { return null; },
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; writes += 1; },
    get writes() { return writes; },
  };
}

function prepararRouterPlanes({ usuario, api }) {
  const anteriorDocument = globalThis.document;
  const anteriorWindow = globalThis.window;
  const anteriorLog = console.log;
  const contentArea = node();
  let ruta = null;
  let vista = null;
  let contenido = null;
  let busqueda = null;
  let selectEstado = null;
  let selectCarrera = null;
  let btnNuevo = null;
  let btnComparador = null;
  let btnTransicion = null;
  let btnConvalidaciones = null;

  Object.defineProperty(contentArea, 'innerHTML', {
    get() { return this._html || ''; },
    set(value) {
      this._html = value;
      ruta = value.includes('id="planesEstudioPage"') ? 'planes-estudio' : 'otra';
      if (ruta === 'planes-estudio') {
        vista = node();
        contenido = node();
        busqueda = { value: '', ...node() };
        selectEstado = { value: 'TODOS', ...node() };
        selectCarrera = { value: '', ...node() };
        btnNuevo = node();
        btnComparador = node();
        btnTransicion = node();
        btnConvalidaciones = node();
      } else {
        vista = null;
        contenido = null;
        busqueda = null;
        selectEstado = null;
        selectCarrera = null;
        btnNuevo = null;
        btnComparador = null;
        btnTransicion = null;
        btnConvalidaciones = null;
      }
    },
  });

  globalThis.document = {
    title: '',
    getElementById(id) {
      if (id === 'contentArea') return contentArea;
      if (ruta !== 'planes-estudio') return null;
      return {
        planesEstudioPage: vista,
        planesContent: contenido,
        planesBuscar: busqueda,
        planesEstado: selectEstado,
        planesCarrera: selectCarrera,
        nuevoPlanButton: btnNuevo,
        comparadorPlanesButton: btnComparador,
        transicionCurricularButton: btnTransicion,
        convalidacionesExternasButton: btnConvalidaciones,
      }[id] || null;
    },
    querySelectorAll() { return []; },
  };
  globalThis.window = { sgpa: api, cancelAnimationFrame: () => {} };
  console.log = () => {};
  guardarSesion({ usuario });

  return {
    contentArea,
    get vista() { return vista; },
    get contenido() { return contenido; },
    get busqueda() { return busqueda; },
    get btnNuevo() { return btnNuevo; },
    navegar: renderizarRuta,
    restaurar() {
      limpiarSesion();
      globalThis.document = anteriorDocument;
      globalThis.window = anteriorWindow;
      console.log = anteriorLog;
    },
  };
}

const admin = {
  id: 1,
  roles: ['ADMIN_GLOBAL'],
  rolActivo: 'ADMIN_GLOBAL',
  permisos: ['PLANES_ESTUDIO_VER', 'PLANES_ESTUDIO_GESTIONAR'],
};

test('planes-estudio: ciclo de vida registrado correctamente en PAGE_LIFECYCLES', () => {
  const ciclo = obtenerCicloVidaPagina('planes-estudio');
  assert.ok(ciclo, 'El ciclo de vida de planes-estudio debe existir');
  assert.equal(typeof ciclo.render, 'function', 'debe tener render');
  assert.equal(typeof ciclo.initialize, 'function', 'debe tener initialize');
  assert.equal(typeof ciclo.destroy, 'function', 'debe tener destroy');
});

test('router: desmonta Planes de Estudio al navegar y descarta respuesta diferida', async () => {
  const planesDeferred = deferred();
  const carrerasDeferred = deferred();

  const app = prepararRouterPlanes({
    usuario: admin,
    api: {
      listarPlanesEstudio: () => planesDeferred.promise,
      listarCarreras: () => carrerasDeferred.promise,
    },
  });

  try {
    await app.navegar('/planes-estudio');
    const contenidoPlanes = app.contenido;
    assert.ok(contenidoPlanes, 'El contenedor de planes debe existir tras renderizar');

    // Navegar fuera a /dashboard mientras la consulta está en vuelo
    await app.navegar('/dashboard');
    assert.match(app.contentArea.innerHTML, /Módulos del sistema/);

    // Resolver la consulta diferida que quedó en vuelo
    planesDeferred.resolve({
      ok: true,
      planes: [{ id: 99, codigo: 'PLAN-OBSOLETO', nombre: 'Plan Descartado' }],
    });
    carrerasDeferred.resolve({
      ok: true,
      carreras: [{ id: 10, nombre: 'Informática' }],
    });

    await new Promise((resolve) => setImmediate(resolve));

    // El contenido de la página desmontada no debe haber recibido el plan obsoleto
    assert.doesNotMatch(contenidoPlanes.innerHTML, /PLAN-OBSOLETO/);
    assert.match(app.contentArea.innerHTML, /Módulos del sistema/);
  } finally {
    app.restaurar();
  }
});

test('router: reentrada en Planes de Estudio limpia recursos anteriores y permite nueva carga', async () => {
  const app = prepararRouterPlanes({
    usuario: admin,
    api: {
      listarPlanesEstudio: async () => ({
        ok: true,
        planes: [{ id: 1, codigo: 'PLAN-ACTUAL', nombre: 'Ingeniería de Software' }],
      }),
      listarCarreras: async () => ({
        ok: true,
        carreras: [{ id: 10, nombre: 'Informática' }],
      }),
    },
  });

  try {
    // Primera entrada
    await app.navegar('/planes-estudio');
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(app.btnNuevo, 'Botón nuevo plan debe existir');
    const listenersEntrada1 = app.btnNuevo.listeners.get('click')?.size || 0;
    assert.equal(listenersEntrada1, 1, 'Debe registrar exactamente 1 listener en entrada inicial');

    // Salida
    await app.navegar('/dashboard');

    // Reentrada
    await app.navegar('/planes-estudio');
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(app.btnNuevo, 'Botón nuevo plan debe existir tras reentrada');
    const listenersEntrada2 = app.btnNuevo.listeners.get('click')?.size || 0;
    assert.equal(listenersEntrada2, 1, 'Reentrada no debe duplicar listeners de eventos');
  } finally {
    app.restaurar();
  }
});

test('planes-estudio: destruirPlanesEstudioPage invalida tokens e instancias sin lanzar excepción', () => {
  assert.doesNotThrow(() => {
    destruirPlanesEstudioPage();
    destruirPlanesEstudioPage(); // Idempotencia de destrucción repetida
  });
});
