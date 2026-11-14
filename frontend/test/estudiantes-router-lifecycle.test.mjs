import test from 'node:test';
import assert from 'node:assert/strict';
import { renderizarRuta } from '../src/app/App.js';
import { guardarSesion, limpiarSesion } from '../src/app/session.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function elemento() {
  const listeners = new Map();
  let html = '';
  let writes = 0;
  return {
    listeners,
    writes: () => writes,
    addEventListener(tipo, callback) {
      const callbacks = listeners.get(tipo) || new Set();
      callbacks.add(callback);
      listeners.set(tipo, callbacks);
    },
    removeEventListener(tipo, callback) {
      listeners.get(tipo)?.delete(callback);
    },
    querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {} },
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; writes += 1; },
  };
}

function prepararRouter(api, { rolActivo = 'ADMIN_GLOBAL', roles = ['ADMIN_GLOBAL'], permisos = ['ESTUDIANTES_VER', 'ESTUDIANTES_GESTIONAR'] } = {}) {
  const anteriorDocument = globalThis.document;
  const anteriorWindow = globalThis.window;
  const anteriorLog = console.log;
  const contentArea = elemento();
  const navegacion = elemento();
  const dialog = elemento();
  const elementos = new Map();
  let moduloActual = null;
  let nextTimer = 0;

  Object.defineProperty(contentArea, 'innerHTML', {
    get() { return this._html || ''; },
    set(value) {
      this._html = value;
      moduloActual = value.includes('id="estudiantesPage"')
        ? 'estudiantes'
        : 'otro';
    },
  });

  globalThis.document = {
    title: '',
    querySelector() { return null; },
    getElementById(id) {
      if (id === 'contentArea') return contentArea;
      if (moduloActual !== 'estudiantes') return null;
      if (id === 'estudiantesNavegacion') return navegacion;
      if (id === 'estudianteDialog') return dialog;
      if (!elementos.has(id)) elementos.set(id, elemento());
      return elementos.get(id);
    },
    querySelectorAll() { return []; },
  };
  globalThis.window = {
    sgpa: api,
    setInterval() { nextTimer += 1; return nextTimer; },
    clearInterval() {},
    setTimeout(callback) { nextTimer += 1; return nextTimer; },
    clearTimeout() {},
  };
  console.log = () => {};
  guardarSesion({
    usuario: {
      id: 1,
      roles,
      rolActivo,
      permisos,
    },
  });

  return {
    contentArea,
    navegacion,
    elementos,
    navegar: renderizarRuta,
    restaurar() {
      if (moduloActual === 'estudiantes') renderizarRuta('/dashboard');
      limpiarSesion();
      globalThis.document = anteriorDocument;
      globalThis.window = anteriorWindow;
      console.log = anteriorLog;
    },
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('router: descarta la carga tardía de carreras al salir de Estudiantes', async () => {
  const carreras = deferred();
  const planes = deferred();
  const conteos = deferred();
  const app = prepararRouter({
    listarCarreras: () => carreras.promise,
    listarPlanesEstudio: () => planes.promise,
    contarEstudiantesPorCarrera: () => conteos.promise,
  });
  try {
    app.navegar('/estudiantes');
    const writesAntes = app.navegacion.writes();
    app.navegar('/dashboard');
    const dashboard = app.contentArea.innerHTML;

    carreras.resolve({ ok: true, carreras: [{ id: 4, nombre: 'Obsoleta' }] });
    planes.resolve({ ok: true, planes: [] });
    conteos.resolve([]);
    await tick();

    assert.equal(app.navegacion.writes(), writesAntes);
    assert.equal(app.contentArea.innerHTML, dashboard);
  } finally {
    app.restaurar();
  }
});

test('router: ignora errores tardíos y permite reentrar con una carga vigente', async () => {
  const antiguaCarreras = deferred();
  const antiguaPlanes = deferred();
  const antiguoConteo = deferred();
  const actualCarreras = deferred();
  const actualPlanes = deferred();
  const actualConteo = deferred();
  const cargasCarreras = [antiguaCarreras, actualCarreras];
  const cargasPlanes = [antiguaPlanes, actualPlanes];
  const cargasConteos = [antiguoConteo, actualConteo];
  const app = prepararRouter({
    listarCarreras: () => cargasCarreras.shift().promise,
    listarPlanesEstudio: () => cargasPlanes.shift().promise,
    contarEstudiantesPorCarrera: () => cargasConteos.shift().promise,
  });
  try {
    app.navegar('/estudiantes');
    const escrituraInicial = app.navegacion.writes();
    app.navegar('/dashboard');
    app.navegar('/estudiantes');

    actualCarreras.resolve({ ok: true, carreras: [{ id: 9, nombre: 'Vigente' }] });
    actualPlanes.resolve({ ok: true, planes: [] });
    actualConteo.resolve([]);
    await tick();
    assert.match(app.navegacion.innerHTML, /Vigente/);

    antiguaCarreras.reject(new Error('Error de carrera obsoleto'));
    antiguaPlanes.resolve({ ok: true, planes: [] });
    antiguoConteo.resolve([]);
    await tick();

    assert.ok(app.navegacion.writes() > escrituraInicial);
    assert.match(app.navegacion.innerHTML, /Vigente/);
    assert.doesNotMatch(app.navegacion.innerHTML, /Error de carrera obsoleto|Obsoleta/);
  } finally {
    app.restaurar();
  }
});

test('router: permite entrar a la lista del plan y conserva las acciones autorizadas', async () => {
  const app = prepararRouter({
    listarCarreras: async () => ({ ok: true, carreras: [{ id: 4, nombre: 'Ingeniería' }] }),
    contarEstudiantesPorCarrera: async () => [{ carreraId: 4, total: 1 }],
    listarPlanesEstudio: async () => ({ ok: true, planes: [{ id: 8, carreraId: 4, nombre: 'Plan 2026', activo: true }] }),
    contarEstudiantesPorPlan: async () => [],
    contarSolicitudesPorPlan: async () => [],
    listarEstudiantes: async () => ({ ok: true, estudiantes: [{
      id: 19,
      cedula: 'A-19',
      nombres: 'Estudiante',
      apellido1: 'Activo',
      apellido2: '',
      correoInstitucional: 'estudiante@example.test',
      estado: 'ACTIVO',
      carrera: { id: 4, nombre: 'Ingeniería' },
      planEstudio: { id: 8, nombre: 'Plan 2026' },
    }] }),
    listarBandejaRevisionEstudiantes: async () => ({ ok: true, data: [] }),
    listarSolicitudesFormularios: async () => ({ ok: true, data: [] }),
  });
  const disparar = async (selector, dataset) => {
    const handler = [...app.navegacion.listeners.get('click')].at(-1);
    await handler({
      target: {
        closest: (candidato) => candidato === selector ? { dataset } : null,
      },
    });
  };
  try {
    app.navegar('/estudiantes');
    await tick();
    await disparar('[data-carrera-id]', { carreraId: '4' });
    await disparar('[data-plan-id]', { planId: '8' });

    assert.match(app.navegacion.innerHTML, /Estudiantes de este plan/);
    assert.match(app.navegacion.innerHTML, /id="nuevoEstudianteButton"/);
    assert.match(app.navegacion.innerHTML, /id="importarEstudiantesExcelButton"/);
    assert.match(app.elementos.get('estudiantesContent').innerHTML, /Estudiante Activo/);
    assert.match(app.elementos.get('estudiantesContent').innerHTML, /data-action="editar"/);
  } finally {
    app.restaurar();
  }
});

test('router: el rol de asistente conserva propuestas y oculta importación y cambio de plan', async () => {
  const app = prepararRouter({
    obtenerCatalogoEstudiantesJerarquia: async () => ({ ok: true, data: {
      carreras: [{ id: 4, nombre: 'Ingeniería' }],
      planes: [{ id: 8, carreraId: 4, nombre: 'Plan 2026', activo: true }],
      periodos: [],
    } }),
    listarCarreras: async () => ({ ok: true, carreras: [{ id: 4, nombre: 'Ingeniería' }] }),
    contarEstudiantesPorCarrera: async () => [],
    listarPlanesEstudio: async () => ({ ok: true, planes: [{ id: 8, carreraId: 4, nombre: 'Plan 2026', activo: true }] }),
    contarEstudiantesPorPlan: async () => [],
    contarSolicitudesPorPlan: async () => [],
    listarEstudiantes: async () => ({ ok: true, estudiantes: [{
      id: 19, cedula: 'A-19', nombres: 'Estudiante', apellido1: 'Activo',
      correoInstitucional: 'estudiante@example.test', estado: 'ACTIVO',
    }] }),
    listarBandejaRevisionEstudiantes: async () => ({ ok: true, data: [] }),
    listarSolicitudesFormularios: async () => ({ ok: true, data: [] }),
  }, { rolActivo: 'ASISTENTE_ESTUDIANTIL', roles: ['ADMIN_GLOBAL', 'ASISTENTE_ESTUDIANTIL'] });
  const disparar = async (selector, dataset) => {
    const handler = [...app.navegacion.listeners.get('click')].at(-1);
    await handler({ target: { closest: (candidato) => candidato === selector ? { dataset } : null } });
  };
  try {
    app.navegar('/estudiantes');
    await tick();
    await disparar('[data-carrera-id]', { carreraId: '4' });
    await disparar('[data-plan-id]', { planId: '8' });

    assert.match(app.navegacion.innerHTML, /Solicitar nuevo estudiante/);
    assert.doesNotMatch(app.navegacion.innerHTML, /importarEstudiantesExcelButton/);
    assert.doesNotMatch(app.elementos.get('estudiantesContent').innerHTML, /data-action="plan"/);
  } finally {
    app.restaurar();
  }
});

test('router: descarta el listado tardío al abandonar el plan', async () => {
  const listado = deferred();
  const app = prepararRouter({
    listarCarreras: async () => ({ ok: true, carreras: [{ id: 4, nombre: 'Ingeniería' }] }),
    contarEstudiantesPorCarrera: async () => [],
    listarPlanesEstudio: async () => ({ ok: true, planes: [{ id: 8, carreraId: 4, nombre: 'Plan 2026' }] }),
    contarEstudiantesPorPlan: async () => [],
    contarSolicitudesPorPlan: async () => [],
    listarEstudiantes: () => listado.promise,
    listarBandejaRevisionEstudiantes: async () => ({ ok: true, data: [] }),
    listarSolicitudesFormularios: async () => ({ ok: true, data: [] }),
  });
  const disparar = async (selector, dataset) => {
    const handler = [...app.navegacion.listeners.get('click')].at(-1);
    return handler({ target: { closest: (candidato) => candidato === selector ? { dataset } : null } });
  };
  try {
    app.navegar('/estudiantes');
    await tick();
    await disparar('[data-carrera-id]', { carreraId: '4' });
    const cargaPlan = disparar('[data-plan-id]', { planId: '8' });
    await tick();
    const writesAntesDeSalir = app.navegacion.writes();
    app.navegar('/dashboard');
    listado.resolve({ ok: true, estudiantes: [{ id: 19, nombres: 'Tardío' }] });
    await cargaPlan;
    await tick();

    assert.equal(app.navegacion.writes(), writesAntesDeSalir);
    assert.doesNotMatch(app.navegacion.innerHTML, /Tardío/);
  } finally {
    app.restaurar();
  }
});
