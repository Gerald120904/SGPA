import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAutogestionProfesores } from '../src/pages/profesores/ProfesoresAutogestion.js';
import { crearGestionDetalleProfesores } from '../src/pages/profesores/ProfesoresDetalle.js';
import { crearPaginaGestionProfesores } from '../src/pages/profesores/ProfesoresGestionPage.js';
import { crearListadoProfesores } from '../src/pages/profesores/ProfesoresListado.js';
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

test('autogestión de Profesores no permite que un error obsoleto sustituya la vista actual', async () => {
  const vista = { innerHTML: '' };
  const anteriorDocument = globalThis.document;
  const anteriorWindow = globalThis.window;
  const perfilObsoleto = deferred();
  const perfilActual = deferred();
  const solicitudesPerfil = [perfilObsoleto, perfilActual];

  globalThis.document = {
    getElementById: (id) => (id === 'profesoresVista' ? vista : null),
    querySelectorAll: () => [],
  };
  globalThis.window = {
    sgpa: {
      obtenerMiPerfilProfesor: () => solicitudesPerfil.shift().promise,
      listarPerfilesDisponiblesProfesor: async () => ({ ok: true, data: [] }),
      listarPeriodosMiDisponibilidadProfesor: async () => ({ ok: true, data: [] }),
    },
  };

  try {
    let instancia = 0;
    const autogestion = crearAutogestionProfesores({
      crearNuevaInstancia: () => ++instancia,
      esInstanciaActual: (id) => id === instancia,
      renderizarSelectorModo: () => '',
      habilitarSelectorModo() {},
    });

    const cargaAnterior = autogestion.iniciarMiPerfilDocente();
    const cargaActual = autogestion.iniciarMiPerfilDocente();
    const vistaActual = vista.innerHTML;

    perfilObsoleto.reject(new Error('error obsoleto'));
    await cargaAnterior;
    assert.equal(vista.innerHTML, vistaActual);

    perfilActual.reject(new Error('error vigente'));
    await cargaActual;
    assert.match(vista.innerHTML, /error vigente/);
    assert.doesNotMatch(vista.innerHTML, /error obsoleto/);
  } finally {
    globalThis.document = anteriorDocument;
    globalThis.window = anteriorWindow;
  }
});

test('autogestión renderiza el perfil vigente con sus carreras, perfiles y cursos', async () => {
  const listenersClick = [];
  const vista = {
    innerHTML: '',
    addEventListener: (tipo, handler) => {
      if (tipo === 'click') listenersClick.push(handler);
    },
    querySelectorAll: () => [],
  };
  const anteriorDocument = globalThis.document;
  const anteriorWindow = globalThis.window;
  globalThis.document = {
    getElementById: (id) => (id === 'profesoresVista' ? vista : { addEventListener() {} }),
    querySelectorAll: () => [],
  };
  globalThis.window = {
    sgpa: {
      obtenerMiPerfilProfesor: async () => ({
        ok: true,
        data: {
          nombres: 'Ana',
          apellido1: 'Rojas',
          correo: 'ana@example.test',
          activo: true,
          carreras: [{ id: 1, codigo: 'INF', nombre: 'Informática' }],
          perfilesAcademicos: [],
          cursosHabilitados: [{ id: 8, codigo: 'INF-101', nombre: 'Programación' }],
          atestados: [],
          proyectos: [],
        },
      }),
      listarPerfilesDisponiblesProfesor: async () => ({ ok: true, data: [] }),
      listarPeriodosMiDisponibilidadProfesor: async () => ({ ok: true, data: [] }),
    },
  };

  try {
    let instancia = 0;
    const autogestion = crearAutogestionProfesores({
      crearNuevaInstancia: () => ++instancia,
      esInstanciaActual: (id) => id === instancia,
      renderizarSelectorModo: () => '',
      habilitarSelectorModo() {},
      abrirMiExpedientePerfil() {},
    });

    await autogestion.iniciarMiPerfilDocente();
    assert.match(vista.innerHTML, /Ana Rojas/);
    assert.match(vista.innerHTML, /Informática/);
    assert.match(vista.innerHTML, /INF-101/);
    assert.match(vista.innerHTML, /Carreras asociadas/);

    await autogestion.iniciarMiPerfilDocente();
    assert.equal(listenersClick.length, 1);
  } finally {
    globalThis.document = anteriorDocument;
    globalThis.window = anteriorWindow;
  }
});

test('listado de Profesores renderiza datos y descarta errores de una carga anterior', async () => {
  const contenido = { innerHTML: '' };
  const busqueda = { value: '' };
  const anteriorDocument = globalThis.document;
  const anteriorWindow = globalThis.window;
  let vigente = true;
  const solicitud = deferred();

  globalThis.document = {
    getElementById: (id) => ({
      profesoresContent: contenido,
      profesoresBuscar: busqueda,
    })[id] || null,
    querySelectorAll: () => [],
  };
  globalThis.window = {
    sgpa: {
      listarProfesores: async () => ({
        ok: true,
        profesores: [{
          id: 8,
          cedula: '123',
          nombres: 'Ana',
          apellido1: 'Rojas',
          correo: 'ana@example.test',
          activo: true,
          carreras: [],
          perfilesAcademicos: [],
          cursosHabilitados: [],
        }],
      }),
    },
  };

  try {
    const listado = crearListadoProfesores({ esInstanciaActual: () => vigente });
    await listado.cargarProfesores(1);
    assert.match(contenido.innerHTML, /Ana Rojas/);
    assert.match(contenido.innerHTML, /123/);

    globalThis.window.sgpa.listarProfesores = () => solicitud.promise;
    const cargaObsoleta = listado.cargarProfesores(2);
    vigente = false;
    contenido.innerHTML = 'vista actual';
    solicitud.reject(new Error('error obsoleto'));
    await cargaObsoleta;
    assert.equal(contenido.innerHTML, 'vista actual');
  } finally {
    globalThis.document = anteriorDocument;
    globalThis.window = anteriorWindow;
  }
});

test('vista de gestión monta filtros y delega la apertura de detalle una sola vez', async () => {
  const listeners = new Map();
  const vista = { innerHTML: '' };
  const pagina = {};
  const busqueda = {
    addEventListener: (tipo, handler) => listeners.set(`buscar:${tipo}`, handler),
  };
  const contenido = {
    addEventListener: (tipo, handler) => listeners.set(`contenido:${tipo}`, handler),
  };
  const anteriorDocument = globalThis.document;
  const llamadas = { render: 0, cargar: [], abrir: [], modos: 0 };
  globalThis.document = {
    getElementById: (id) => ({
      profesoresPage: pagina,
      profesoresVista: vista,
      profesoresBuscar: busqueda,
      profesoresContent: contenido,
    })[id] || null,
    querySelectorAll: () => [],
  };

  try {
    const gestion = crearPaginaGestionProfesores({
      puedeGestionarProfesores: () => true,
      crearNuevaInstancia: () => 7,
      renderizarSelectorModo: (modo) => `<nav>${modo}</nav>`,
      habilitarSelectorModo: () => { llamadas.modos += 1; },
      renderizarProfesores: () => { llamadas.render += 1; },
      cargarProfesores: async (instancia) => { llamadas.cargar.push(instancia); },
      abrirProfesor: async (id) => { llamadas.abrir.push(id); },
    });

    gestion.iniciarGestionProfesores();
    assert.match(vista.innerHTML, /profesoresContent/);
    assert.equal(llamadas.modos, 1);
    assert.deepEqual(llamadas.cargar, [7]);

    listeners.get('buscar:input')();
    await listeners.get('contenido:click')({
      target: { closest: () => ({ dataset: { profesorId: '25' } }) },
    });

    assert.equal(llamadas.render, 1);
    assert.deepEqual(llamadas.abrir, [25]);
  } finally {
    globalThis.document = anteriorDocument;
  }
});

test('detalle administrativo descarta respuestas después de abrir otro profesor o salir de la vista', async () => {
  const vista = { innerHTML: '' };
  const anteriorDocument = globalThis.document;
  const anteriorWindow = globalThis.window;
  const solicitudA = deferred();
  const solicitudB = deferred();
  const solicitudes = [solicitudA, solicitudB];
  guardarSesion({ usuario: { roles: ['ADMIN_GLOBAL'], rolActivo: 'ADMIN_GLOBAL' } });
  globalThis.document = {
    getElementById: (id) => (id === 'profesoresVista' ? vista : null),
  };
  globalThis.window = {
    sgpa: {
      obtenerProfesor: () => solicitudes.shift().promise,
      listarPeriodosAcademicos: async () => ({ ok: true, periodos: [] }),
    },
  };

  try {
    const detalle = crearGestionDetalleProfesores({ volverAListado() {} });
    const respuestaA = detalle.abrirProfesor(10);
    const respuestaB = detalle.abrirProfesor(20);
    const vistaCargando = vista.innerHTML;

    solicitudA.resolve({ ok: true, data: { id: 10 } });
    await respuestaA;
    assert.equal(vista.innerHTML, vistaCargando);

    detalle.invalidarDetalle();
    solicitudB.resolve({ ok: true, data: { id: 20 } });
    await respuestaB;
    assert.equal(vista.innerHTML, vistaCargando);
  } finally {
    limpiarSesion();
    globalThis.document = anteriorDocument;
    globalThis.window = anteriorWindow;
  }
});
