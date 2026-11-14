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
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; writes += 1; },
    get writes() { return writes; },
  };
}

function prepararRouter({ usuario, api }) {
  const anteriorDocument = globalThis.document;
  const anteriorWindow = globalThis.window;
  const anteriorLog = console.log;
  const contentArea = node();
  let ruta = null;
  let vista = null;
  let contenido = null;
  let busqueda = null;

  Object.defineProperty(contentArea, 'innerHTML', {
    get() { return this._html || ''; },
    set(value) {
      this._html = value;
      ruta = value.includes('id="profesoresPage"') ? 'profesores' : 'otra';
      vista = ruta === 'profesores' ? node() : null;
      contenido = ruta === 'profesores' ? node() : null;
      busqueda = ruta === 'profesores' ? { value: '', ...node() } : null;
    },
  });

  globalThis.document = {
    title: '',
    getElementById(id) {
      if (id === 'contentArea') return contentArea;
      if (ruta !== 'profesores') return null;
      return {
        profesoresPage: node(),
        profesoresVista: vista,
        profesoresContent: contenido,
        profesoresBuscar: busqueda,
      }[id] || null;
    },
    querySelectorAll() { return []; },
  };
  globalThis.window = { sgpa: api };
  console.log = () => {};
  guardarSesion({ usuario });

  return {
    contentArea,
    get vista() { return vista; },
    get contenido() { return contenido; },
    get busqueda() { return busqueda; },
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
  id: 10,
  roles: ['ADMIN_GLOBAL'],
  rolActivo: 'ADMIN_GLOBAL',
};

test('router: desmonta listado antes de salir y descarta respuesta exitosa tardía', async () => {
  const listado = deferred();
  const app = prepararRouter({
    usuario: admin,
    api: { listarProfesores: () => listado.promise },
  });
  try {
    app.navegar('/profesores');
    const contenidoAnterior = app.contenido;
    const htmlAntes = contenidoAnterior.innerHTML;
    app.navegar('/dashboard');
    assert.match(app.contentArea.innerHTML, /Módulos del sistema/);

    listado.resolve({ ok: true, profesores: [{ id: 7, nombres: 'Obsoleto' }] });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(contenidoAnterior.innerHTML, htmlAntes);

    const cargaNueva = deferred();
    globalThis.window.sgpa.listarProfesores = () => cargaNueva.promise;
    app.navegar('/profesores');
    app.busqueda.value = 'Obsoleto';
    app.busqueda.listeners.get('input')?.forEach((handler) => handler());
    assert.doesNotMatch(app.contenido.innerHTML, /Obsoleto/);
    cargaNueva.resolve({ ok: true, profesores: [] });
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    app.restaurar();
  }
});

test('router: desmonta detalle y evita aplicar respuesta tardía tras cambiar de módulo', async () => {
  const detalle = deferred();
  const app = prepararRouter({
    usuario: admin,
    api: {
      listarProfesores: async () => ({ ok: true, profesores: [{ id: 7 }] }),
      obtenerProfesor: () => detalle.promise,
    },
  });
  try {
    app.navegar('/profesores');
    await new Promise((resolve) => setImmediate(resolve));
    const contenidoActual = app.contenido;
    const abrir = contenidoActual.listeners.get('click').values().next().value;
    const apertura = abrir({
      target: { closest: () => ({ dataset: { profesorId: '7' } }) },
    });
    const vistaAnterior = app.vista;
    const htmlCarga = vistaAnterior.innerHTML;

    app.navegar('/dashboard');
    assert.equal(vistaAnterior.listeners.get('click')?.size || 0, 0);
    detalle.resolve({ ok: true, data: { id: 7, nombres: 'Detalle obsoleto' } });
    await apertura;
    assert.equal(vistaAnterior.innerHTML, htmlCarga);
    assert.match(app.contentArea.innerHTML, /Módulos del sistema/);
    assert.doesNotMatch(app.contentArea.innerHTML, /Detalle obsoleto/);
  } finally {
    app.restaurar();
  }
});

test('router: ignora errores tardíos del listado y no reemplaza la página actual', async () => {
  const listado = deferred();
  const app = prepararRouter({ usuario: admin, api: { listarProfesores: () => listado.promise } });
  try {
    app.navegar('/profesores');
    const contenidoAnterior = app.contenido;
    const htmlAntes = contenidoAnterior.innerHTML;
    app.navegar('/dashboard');
    const dashboard = app.contentArea.innerHTML;
    listado.reject(new Error('error fuera de ruta'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(contenidoAnterior.innerHTML, htmlAntes);
    assert.equal(app.contentArea.innerHTML, dashboard);
  } finally {
    app.restaurar();
  }
});

test('router: invalida autogestión pendiente y limpia listener delegado al salir', async () => {
  const perfil = deferred();
  const perfiles = deferred();
  const periodos = deferred();
  const profesor = { id: 20, roles: ['PROFESOR'], rolActivo: 'PROFESOR' };
  const app = prepararRouter({
    usuario: profesor,
    api: {
      obtenerMiPerfilProfesor: () => perfil.promise,
      listarPerfilesDisponiblesProfesor: () => perfiles.promise,
      listarPeriodosMiDisponibilidadProfesor: () => periodos.promise,
    },
  });
  try {
    app.navegar('/profesores');
    const vistaAnterior = app.vista;
    const escriturasAntes = vistaAnterior.writes;
    app.navegar('/dashboard');
    assert.equal(vistaAnterior.listeners.get('click')?.size || 0, 0);

    perfil.resolve({ ok: true, data: { nombres: 'Perfil antiguo' } });
    perfiles.resolve({ ok: true, data: [] });
    periodos.resolve({ ok: true, data: [] });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(vistaAnterior.writes, escriturasAntes);
    assert.doesNotMatch(app.contentArea.innerHTML, /Perfil antiguo/);
  } finally {
    app.restaurar();
  }
});

test('router: una nueva entrada acepta su consulta y no hereda la instancia anterior', async () => {
  const antigua = deferred();
  const nueva = deferred();
  let llamadas = 0;
  const app = prepararRouter({
    usuario: admin,
    api: { listarProfesores: () => (++llamadas === 1 ? antigua.promise : nueva.promise) },
  });
  try {
    app.navegar('/profesores');
    app.navegar('/dashboard');
    app.navegar('/profesores');

    antigua.resolve({ ok: true, profesores: [{ id: 1, nombres: 'Anterior' }] });
    await new Promise((resolve) => setImmediate(resolve));
    assert.doesNotMatch(app.contenido.innerHTML, /Anterior/);

    nueva.resolve({ ok: true, profesores: [{
      id: 2,
      cedula: '200',
      nombres: 'Vigente',
      apellido1: 'Actual',
      correo: 'vigente@example.test',
      activo: true,
      carreras: [],
      perfilesAcademicos: [],
      cursosHabilitados: [],
    }] });
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(app.contenido.innerHTML, /Vigente Actual/);
  } finally {
    app.restaurar();
  }
});

test('router: una autogestión nueva prevalece sobre el perfil pendiente de la entrada anterior', async () => {
  const perfilAnterior = deferred();
  const perfilVigente = deferred();
  const solicitudes = [perfilAnterior, perfilVigente];
  const app = prepararRouter({
    usuario: { id: 20, roles: ['PROFESOR'], rolActivo: 'PROFESOR' },
    api: {
      obtenerMiPerfilProfesor: () => solicitudes.shift().promise,
      listarPerfilesDisponiblesProfesor: async () => ({ ok: true, data: [] }),
      listarPeriodosMiDisponibilidadProfesor: async () => ({ ok: true, data: [] }),
    },
  });
  try {
    app.navegar('/profesores');
    app.navegar('/dashboard');
    app.navegar('/profesores');
    const vistaVigente = app.vista;
    const htmlCargando = vistaVigente.innerHTML;

    perfilAnterior.resolve({ ok: true, data: { nombres: 'Perfil antiguo' } });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(vistaVigente.innerHTML, htmlCargando);

    perfilVigente.resolve({ ok: true, data: {
      nombres: 'Perfil vigente',
      activo: true,
      carreras: [],
      perfilesAcademicos: [],
      cursosHabilitados: [],
      atestados: [],
      proyectos: [],
    } });
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(vistaVigente.innerHTML, /Perfil vigente/);
    assert.doesNotMatch(vistaVigente.innerHTML, /Perfil antiguo/);
  } finally {
    app.restaurar();
  }
});

test('router: la navegación repetida conserva el comportamiento de páginas sin destructor', () => {
  const app = prepararRouter({ usuario: admin, api: { listarProfesores: async () => ({ ok: true, profesores: [] }) } });
  try {
    for (let i = 0; i < 3; i += 1) {
      app.navegar('/profesores');
      app.navegar('/dashboard');
    }
    assert.match(app.contentArea.innerHTML, /Módulos del sistema/);
  } finally {
    app.restaurar();
  }
});
