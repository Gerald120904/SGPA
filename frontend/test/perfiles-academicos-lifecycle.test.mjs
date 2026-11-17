/**
 * SGPA — Pruebas de integración del router, ciclo de vida y concurrencia de Perfiles Académicos.
 * AUDITORIA-GLOBAL-FRONTEND-ESTABILIZACION-INTEGRAL-001
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderizarRuta } from '../src/app/App.js';
import { guardarSesion, limpiarSesion } from '../src/app/session.js';
import { obtenerCicloVidaPagina } from '../src/app/page-lifecycle.js';
import { destruirPerfilesAcademicosPage } from '../src/pages/perfiles-academicos/PerfilesAcademicosPage.js';
import {
  abrirEditorAreasDialog,
  abrirEditorRequisitosDialog,
  cambiarEstadoPerfilActual,
} from '../src/pages/perfiles-academicos/PerfilDialogs.js';
import { crearContextoPerfilesAcademicos } from '../src/pages/perfiles-academicos/perfiles-academicos.context.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function crearOperacionesContexto() {
  const contexto = crearContextoPerfilesAcademicos();
  return {
    contexto,
    iniciar(esAutorizada = () => true) {
      const { instancia } = contexto.iniciarInstancia();
      return {
        esVigente: () => contexto.esInstanciaVigente(instancia) && esAutorizada(),
        reservar: (clave) => contexto.reservarOperacion(clave, instancia),
        marcarEnviada: (clave, token) => contexto.marcarOperacionEnviada(clave, token),
        liberar: (clave, token) => contexto.liberarOperacion(clave, token),
      };
    },
    destruir() {
      contexto.destruir();
    },
  };
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
    classList: {
      add() {},
      remove() {},
      contains() { return false; },
      toggle() {},
    },
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; writes += 1; },
    get writes() { return writes; },
  };
}

function prepararDialogoEscritura({ areas = false, requisitoRows = [] } = {}) {
  const anteriorDocument = globalThis.document;
  const anteriorWindow = globalThis.window;
  const elementos = new Map();
  const modalConfirmacion = {
    open: true,
    listeners: new Map(),
    addEventListener(tipo, callback) { this.listeners.set(tipo, callback); },
    removeEventListener() {},
    showModal() {},
    close() { this.open = false; },
    remove() {},
    querySelector(selector) {
      return {
        addEventListener: (_tipo, callback) => {
          if (selector === '#sgpaConfirmAccept') this.aceptar = callback;
          if (selector === '#sgpaConfirmCancel') this.cancelar = callback;
        },
      };
    },
  };
  let dialogosConfirmacion = 0;
  const dialog = { ...node(), showModal() {}, close() {} };
  const content = node();
  const form = node();
  const submit = { ...node(), disabled: false };
  const rows = { ...node() };
  elementos.set('perfilAcademicoDialog', dialog);
  elementos.set('perfilAcademicoDialogContent', content);
  elementos.set(areas ? 'perfilAreasForm' : 'perfilRequisitosForm', form);
  elementos.set('guardarPerfilForm', submit);
  elementos.set('cancelarPerfilForm', node());
  elementos.set('requisitosEditorRows', rows);
  elementos.set('agregarRequisito', node());
  if (areas) {
    elementos.set('areasDisciplinares', { value: 'Matemática' });
    elementos.set('areasEstrategicas', { value: '' });
  }

  globalThis.document = {
    body: { appendChild(element) { if (element.id === 'sgpaConfirmDialog') this.modal = element; } },
    createElement() { dialogosConfirmacion += 1; return modalConfirmacion; },
    getElementById(id) { return elementos.get(id) || null; },
    querySelectorAll(selector) {
      return selector === '[data-requisito-row]' ? requisitoRows : [];
    },
  };
  globalThis.window = { setTimeout, clearTimeout, sgpa: {} };
  return {
    form,
    modalConfirmacion,
    get dialogosConfirmacion() { return dialogosConfirmacion; },
    restaurar() {
      globalThis.document = anteriorDocument;
      globalThis.window = anteriorWindow;
    },
  };
}

async function comprobarGuardadoObsoletoDeEstructura({ areas }) {
  let calls = 0;
  const operaciones = crearOperacionesContexto();
  const controlOperacion = operaciones.iniciar();
  const ui = prepararDialogoEscritura({ areas });
  try {
    if (areas) {
      window.sgpa.guardarAreasPerfil = async () => { calls += 1; return { ok: true }; };
      abrirEditorAreasDialog({
        perfil: { id: 61, estructuraEditable: true },
        areasActuales: [],
        controlOperacion,
      });
    } else {
      window.sgpa.guardarRequisitosPerfil = async () => { calls += 1; return { ok: true }; };
      abrirEditorRequisitosDialog({
        perfil: { id: 62, estructuraEditable: true },
        requisitosActuales: [],
        controlOperacion,
      });
    }
    const submit = ui.form.listeners.get('submit')?.values().next().value;
    assert.equal(typeof submit, 'function');
    const pending = submit({ preventDefault() {} });
    await submit({ preventDefault() {} });
    assert.equal(ui.dialogosConfirmacion, 1, 'El segundo envío no debe abrir una confirmación duplicada');
    const confirmPending = ui.modalConfirmacion.aceptar;
    assert.equal(typeof confirmPending, 'function');
    operaciones.destruir();
    confirmPending();
    await pending;
    assert.equal(calls, 0);
  } finally {
    ui.restaurar();
  }
}

async function comprobarEscrituraPendienteEnReentrada({ areas }) {
  const perfilId = areas ? 81 : 82;
  const clave = `${areas ? 'areas' : 'requisitos'}:${perfilId}`;
  const servicioPendiente = deferred();
  const llamadas = [];
  const operaciones = crearOperacionesContexto();
  const controlA = operaciones.iniciar();
  const filasRequisitos = areas ? [] : [{
    querySelector(selector) {
      return selector === '[data-campo="tipo"]'
        ? { value: 'DOCUMENTO' }
        : selector === '[data-campo="obligatorio"]'
          ? { checked: true }
          : { value: 'Título universitario' };
    },
  }];
  const uiA = prepararDialogoEscritura({ areas, requisitoRows: filasRequisitos });
  const nombreServicio = areas ? 'guardarAreasPerfil' : 'guardarRequisitosPerfil';
  const expectedPayload = areas
    ? [{ tipo: 'DISCIPLINAR', descripcion: 'Matemática', orden: 1 }]
    : [{ tipo: 'DOCUMENTO', obligatorio: true, orden: 1, descripcion: 'Título universitario' }];
  window.sgpa[nombreServicio] = async (...args) => {
    llamadas.push(args);
    return servicioPendiente.promise;
  };

  function abrirYEnviar(control, ui) {
    if (areas) {
      abrirEditorAreasDialog({ perfil: { id: perfilId, estructuraEditable: true }, areasActuales: [], controlOperacion: control });
    } else {
      abrirEditorRequisitosDialog({ perfil: { id: perfilId, estructuraEditable: true }, requisitosActuales: [], controlOperacion: control });
    }
    const submit = ui.form.listeners.get('submit')?.values().next().value;
    return submit({ preventDefault() {} });
  }

  try {
    const primera = abrirYEnviar(controlA, uiA);
    uiA.modalConfirmacion.aceptar();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(llamadas, [[perfilId, expectedPayload]], 'La escritura legítima debe conservar id y payload');

    operaciones.destruir();
    const controlB = operaciones.iniciar();
    const uiB = prepararDialogoEscritura({ areas, requisitoRows: filasRequisitos });
    const segunda = abrirYEnviar(controlB, uiB);
    await segunda;
    assert.equal(llamadas.length, 1, 'La reentrada debe bloquear una escritura equivalente en vuelo');
    assert.equal(uiB.dialogosConfirmacion, 0, 'La reserva en vuelo debe bloquear antes de confirmar');

    servicioPendiente.resolve({ ok: true });
    await primera;
    const tokenLiberado = controlB.reservar(clave);
    assert.ok(tokenLiberado, 'Al finalizar la escritura anterior, la reserva debe liberarse');
    controlB.liberar(clave, tokenLiberado);
    uiB.restaurar();
  } finally {
    uiA.restaurar();
  }
}

test('PerfilDialogs: guardado de áreas obsoleto no escribe después de destruir la página', async () => {
  await comprobarGuardadoObsoletoDeEstructura({ areas: true });
});

test('PerfilDialogs: guardado de requisitos obsoleto no escribe después de destruir la página', async () => {
  await comprobarGuardadoObsoletoDeEstructura({ areas: false });
});

test('PerfilDialogs: áreas conserva una sola escritura y su bloqueo durante reentrada', async () => {
  await comprobarEscrituraPendienteEnReentrada({ areas: true });
});

test('PerfilDialogs: requisitos conserva una sola escritura y su bloqueo durante reentrada', async () => {
  await comprobarEscrituraPendienteEnReentrada({ areas: false });
});

function prepararRouterPerfiles({ usuario, api }) {
  const anteriorDocument = globalThis.document;
  const anteriorWindow = globalThis.window;
  const anteriorLog = console.log;
  const contentArea = node();
  let ruta = null;
  let vista = null;
  let listado = null;
  let contenido = null;
  let detalle = null;
  let busqueda = null;
  let estadoSelect = null;
  let btnNuevo = null;
  let dialog = null;
  let dialogContent = null;

  Object.defineProperty(contentArea, 'innerHTML', {
    get() { return this._html || ''; },
    set(value) {
      this._html = value;
      ruta = value.includes('id="perfilesAcademicosPage"') ? 'perfiles-academicos' : 'otra';
      if (ruta === 'perfiles-academicos') {
        vista = node();
        listado = node();
        contenido = node();
        detalle = node();
        busqueda = { value: '', ...node() };
        estadoSelect = { value: 'TODOS', ...node() };
        btnNuevo = node();
        dialog = { ...node(), showModal() {}, close() {} };
        dialogContent = node();
      } else {
        vista = null;
        listado = null;
        contenido = null;
        detalle = null;
        busqueda = null;
        estadoSelect = null;
        btnNuevo = null;
        dialog = null;
        dialogContent = null;
      }
    },
  });

  globalThis.document = {
    title: '',
    getElementById(id) {
      if (id === 'contentArea') return contentArea;
      if (ruta !== 'perfiles-academicos') return null;
      return {
        perfilesAcademicosPage: vista,
        perfilesListado: listado,
        perfilesContent: contenido,
        perfilDetalle: detalle,
        perfilesBuscar: busqueda,
        perfilesEstado: estadoSelect,
        nuevoPerfilButton: btnNuevo,
        perfilAcademicoDialog: dialog,
        perfilAcademicoDialogContent: dialogContent,
      }[id] || null;
    },
    querySelectorAll() { return []; },
  };
  globalThis.window = { sgpa: api };
  console.log = () => {};
  guardarSesion({ usuario });

  return {
    contentArea,
    document: globalThis.document,
    get vista() { return vista; },
    get contenido() { return contenido; },
    get detalle() { return detalle; },
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
  permisos: ['PERFILES_ACADEMICOS_VER', 'PERFILES_ACADEMICOS_GESTIONAR'],
};

test('perfiles-academicos: ciclo de vida registrado correctamente en PAGE_LIFECYCLES', () => {
  const ciclo = obtenerCicloVidaPagina('perfiles-academicos');
  assert.ok(ciclo, 'El ciclo de vida de perfiles-academicos debe existir');
  assert.equal(typeof ciclo.render, 'function', 'debe tener render');
  assert.equal(typeof ciclo.initialize, 'function', 'debe tener initialize');
  assert.equal(typeof ciclo.destroy, 'function', 'debe tener destroy');
});

test('router: desmonta Perfiles Académicos al navegar y descarta respuesta en vuelo', async () => {
  const perfilesDeferred = deferred();
  const carrerasDeferred = deferred();

  const app = prepararRouterPerfiles({
    usuario: admin,
    api: {
      listarPerfilesAcademicos: () => perfilesDeferred.promise,
      listarCarreras: () => carrerasDeferred.promise,
    },
  });

  try {
    await app.navegar('/perfiles-academicos');
    const contenidoPerfiles = app.contenido;
    assert.ok(contenidoPerfiles);

    // Navegar fuera mientras la carga inicial sigue en vuelo
    await app.navegar('/dashboard');
    assert.match(app.contentArea.innerHTML, /Módulos del sistema/);

    // Resolver la respuesta extemporánea
    perfilesDeferred.resolve({
      ok: true,
      data: [{ id: 88, codigo: 'PER-TARDE', nombre: 'Perfil Extemporáneo' }],
    });
    carrerasDeferred.resolve({ ok: true, carreras: [] });

    await new Promise((resolve) => setImmediate(resolve));

    // El contenido desmontado no debe recibir los datos obsoletos
    assert.doesNotMatch(contenidoPerfiles.innerHTML, /PER-TARDE/);
    assert.match(app.contentArea.innerHTML, /Módulos del sistema/);
  } finally {
    app.restaurar();
  }
});

test('router: reentrada en Perfiles Académicos registra listeners únicos y permite nueva carga', async () => {
  const app = prepararRouterPerfiles({
    usuario: admin,
    api: {
      listarPerfilesAcademicos: async () => ({
        ok: true,
        data: [{ id: 1, codigo: 'PER-001', nombre: 'Docente Programación', activo: true }],
      }),
      listarCarreras: async () => ({ ok: true, carreras: [] }),
    },
  });

  try {
    // Entrada 1
    await app.navegar('/perfiles-academicos');
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(app.btnNuevo);
    const count1 = app.btnNuevo.listeners.get('click')?.size || 0;
    assert.equal(count1, 1, 'Entrada inicial debe registrar 1 listener');

    // Salida
    await app.navegar('/dashboard');

    // Reentrada
    await app.navegar('/perfiles-academicos');
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(app.btnNuevo);
    const count2 = app.btnNuevo.listeners.get('click')?.size || 0;
    assert.equal(count2, 1, 'Reentrada no debe acumular listeners duplicados');
  } finally {
    app.restaurar();
  }
});

test('perfiles-academicos: destruirPerfilesAcademicosPage es idempotente y limpia estado', () => {
  assert.doesNotThrow(() => {
    destruirPerfilesAcademicosPage();
    destruirPerfilesAcademicosPage();
  });
});

test('PerfilDialogs: cambiarEstadoPerfilActual previene ejecuciones concurrentes simultáneas', async () => {
  let llamadasCambio = 0;
  let argumentosCambio;
  const def = deferred();

  const anteriorWindow = globalThis.window;
  const anteriorDoc = globalThis.document;

  globalThis.window = {
    setTimeout,
    clearTimeout,
    sgpa: {
      cambiarEstadoPerfilAcademico: async (...args) => {
        llamadasCambio += 1;
        argumentosCambio = args;
        return def.promise;
      },
    },
  };

  // Mock confirmación
  globalThis.document = {
    getElementById() { return null; },
    querySelectorAll() { return []; },
    createElement() {
      return {
        showModal() {},
        close() {},
        remove() {},
        addEventListener() {},
        removeEventListener() {},
        querySelectorAll() { return []; },
        querySelector(sel) {
          if (sel === '#sgpaConfirmAccept') {
            return { addEventListener(ev, cb) { setImmediate(cb); } };
          }
          if (sel === '#sgpaConfirmCancel') {
            return { addEventListener() {} };
          }
          return null;
        },
      };
    },
    body: { appendChild() {} },
  };

  try {
    const perfil = { id: 5, nombre: 'Docente Algoritmos', activo: true };
    const operaciones = crearOperacionesContexto();
    const controlOperacion = operaciones.iniciar();

    // Disparar dos invocaciones concurrentes
    const p1 = cambiarEstadoPerfilActual({ perfil, controlOperacion, onUpdated: async () => {} });
    const p2 = cambiarEstadoPerfilActual({ perfil, controlOperacion, onUpdated: async () => {} });

    def.resolve({ ok: true, data: { id: 5, activo: false } });
    await Promise.all([p1, p2]);

    assert.equal(llamadasCambio, 1, 'Solo debe ejecutar 1 llamada IPC ante invocaciones simultáneas');
    assert.deepEqual(argumentosCambio, [5, false], 'Debe conservar el perfil y el estado solicitado');
  } finally {
    globalThis.window = anteriorWindow;
    globalThis.document = anteriorDoc;
  }
});

test('PerfilDialogs: cancelar estado libera la operación y permite reintentar', async () => {
  let calls = 0;
  let confirmar = false;
  const anteriorWindow = globalThis.window;
  const anteriorDoc = globalThis.document;
  globalThis.window = {
    setTimeout,
    clearTimeout,
    sgpa: { cambiarEstadoPerfilAcademico: async () => { calls += 1; return { ok: true }; } },
  };
  globalThis.document = {
    getElementById() { return null; },
    querySelectorAll() { return []; },
    createElement() {
      return {
        showModal() {}, close() {}, remove() {}, addEventListener() {}, removeEventListener() {},
        querySelector(sel) {
          if (sel === '#sgpaConfirmAccept') return { addEventListener(_ev, cb) { if (confirmar) setImmediate(cb); } };
          if (sel === '#sgpaConfirmCancel') return { addEventListener(_ev, cb) { if (!confirmar) setImmediate(cb); } };
          return null;
        },
      };
    },
    body: { appendChild() {} },
  };
  try {
    const operaciones = crearOperacionesContexto();
    const controlOperacion = operaciones.iniciar();
    const perfil = { id: 51, nombre: 'Perfil', activo: true };
    await cambiarEstadoPerfilActual({ perfil, controlOperacion });
    confirmar = true;
    await cambiarEstadoPerfilActual({ perfil, controlOperacion });
    assert.equal(calls, 1);
  } finally {
    globalThis.window = anteriorWindow;
    globalThis.document = anteriorDoc;
  }
});

test('PerfilDialogs: pérdida de autorización durante la confirmación bloquea el estado', async () => {
  let calls = 0;
  const anteriorWindow = globalThis.window;
  const anteriorDoc = globalThis.document;
  globalThis.window = {
    setTimeout,
    clearTimeout,
    sgpa: { cambiarEstadoPerfilAcademico: async () => { calls += 1; return { ok: true }; } },
  };
  globalThis.document = {
    getElementById() { return null; },
    querySelectorAll() { return []; },
    createElement() {
      return {
        showModal() {}, close() {}, remove() {}, addEventListener() {}, removeEventListener() {},
        querySelector(sel) {
          return sel === '#sgpaConfirmAccept'
            ? { addEventListener(_ev, cb) { setImmediate(cb); } }
            : { addEventListener() {} };
        },
      };
    },
    body: { appendChild() {} },
  };
  try {
    let autorizada = true;
    const operaciones = crearOperacionesContexto();
    const controlOperacion = operaciones.iniciar(() => autorizada);
    const pendiente = cambiarEstadoPerfilActual({
      perfil: { id: 52, nombre: 'Perfil', activo: true },
      controlOperacion,
    });
    autorizada = false;
    await pendiente;
    assert.equal(calls, 0, 'No debe persistir cuando la autorización capturada deja de ser vigente');
  } finally {
    globalThis.window = anteriorWindow;
    globalThis.document = anteriorDoc;
  }
});

test('router: una sesión nueva invalida la confirmación de cambio de estado', async () => {
  let calls = 0;
  let aceptar;
  const app = prepararRouterPerfiles({
    usuario: admin,
    api: {
      listarPerfilesAcademicos: async () => ({ ok: true, data: [{ id: 73, codigo: 'P-73', nombre: 'Perfil', activo: true }] }),
      listarCarreras: async () => ({ ok: true, carreras: [] }),
      obtenerPerfilAcademico: async () => ({ ok: true, data: { id: 73, codigo: 'P-73', nombre: 'Perfil', activo: true } }),
      listarAreasPerfil: async () => ({ ok: true, data: [] }),
      listarRequisitosPerfil: async () => ({ ok: true, data: [] }),
      cambiarEstadoPerfilAcademico: async () => { calls += 1; return { ok: true }; },
    },
  });
  app.document.createElement = () => ({
    open: true,
    addEventListener() {},
    removeEventListener() {},
    showModal() {},
    close() { this.open = false; },
    remove() {},
    querySelector(selector) {
      return { addEventListener(_tipo, callback) { if (selector === '#sgpaConfirmAccept') aceptar = callback; } };
    },
  });
  app.document.body = { appendChild() {} };

  try {
    await app.navegar('/perfiles-academicos');
    await new Promise((resolve) => setImmediate(resolve));
    app.contenido.listeners.get('click')?.forEach((handler) => handler({
      target: { closest: (selector) => selector === '[data-ver-perfil]' ? { dataset: { verPerfil: '73' } } : null },
    }));
    await new Promise((resolve) => setImmediate(resolve));

    app.detalle.listeners.get('click')?.forEach((handler) => handler({
      target: { closest: (selector) => selector === '[data-cambiar-estado-perfil]' ? {} : null },
    }));
    assert.equal(typeof aceptar, 'function');
    guardarSesion({ usuario: { ...admin, roles: ['ADMIN_GLOBAL', 'COORDINADOR'], rolActivo: 'COORDINADOR' } });
    aceptar();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 0);
  } finally {
    app.restaurar();
  }
});

test('router: la confirmación de estado se invalida al salir y reentrar antes de aceptarla', async () => {
  let calls = 0;
  let aceptar;
  const app = prepararRouterPerfiles({
    usuario: admin,
    api: {
      listarPerfilesAcademicos: async () => ({ ok: true, data: [{ id: 77, codigo: 'P-77', nombre: 'Perfil', activo: true }] }),
      listarCarreras: async () => ({ ok: true, carreras: [] }),
      obtenerPerfilAcademico: async () => ({ ok: true, data: { id: 77, codigo: 'P-77', nombre: 'Perfil', activo: true } }),
      listarAreasPerfil: async () => ({ ok: true, data: [] }),
      listarRequisitosPerfil: async () => ({ ok: true, data: [] }),
      cambiarEstadoPerfilAcademico: async () => { calls += 1; return { ok: true }; },
    },
  });
  app.document.createElement = () => ({
    open: true, addEventListener() {}, removeEventListener() {}, showModal() {},
    close() { this.open = false; }, remove() {},
    querySelector(selector) {
      return { addEventListener(_tipo, callback) { if (selector === '#sgpaConfirmAccept') aceptar = callback; } };
    },
  });
  app.document.body = { appendChild() {} };
  try {
    await app.navegar('/perfiles-academicos');
    await new Promise((resolve) => setImmediate(resolve));
    await app.contenido.listeners.get('click').values().next().value({
      target: { closest: (selector) => selector === '[data-ver-perfil]' ? { dataset: { verPerfil: '77' } } : null },
    });
    const pendiente = app.detalle.listeners.get('click').values().next().value({
      target: { closest: (selector) => selector === '[data-cambiar-estado-perfil]' ? {} : null },
    });
    await app.navegar('/dashboard');
    await app.navegar('/perfiles-academicos');
    assert.equal(typeof aceptar, 'function');
    aceptar();
    await pendiente;
    assert.equal(calls, 0, 'La nueva instancia no debe autorizar la confirmación anterior');
  } finally {
    app.restaurar();
  }
});

test('router: revocar el permiso en la sesión activa invalida el cambio de estado pendiente', async () => {
  let calls = 0;
  let aceptar;
  const usuario = {
    id: 3,
    roles: ['COORDINADOR'],
    rolActivo: 'COORDINADOR',
    permisos: [...admin.permisos],
  };
  const app = prepararRouterPerfiles({
    usuario,
    api: {
      listarPerfilesAcademicos: async () => ({ ok: true, data: [{ id: 75, codigo: 'P-75', nombre: 'Perfil', activo: true }] }),
      listarCarreras: async () => ({ ok: true, carreras: [] }),
      obtenerPerfilAcademico: async () => ({ ok: true, data: { id: 75, codigo: 'P-75', nombre: 'Perfil', activo: true } }),
      listarAreasPerfil: async () => ({ ok: true, data: [] }),
      listarRequisitosPerfil: async () => ({ ok: true, data: [] }),
      cambiarEstadoPerfilAcademico: async () => { calls += 1; return { ok: true }; },
    },
  });
  app.document.createElement = () => ({
    open: true, addEventListener() {}, removeEventListener() {}, showModal() {},
    close() { this.open = false; }, remove() {},
    querySelector(selector) {
      return { addEventListener(_tipo, callback) { if (selector === '#sgpaConfirmAccept') aceptar = callback; } };
    },
  });
  app.document.body = { appendChild() {} };
  try {
    await app.navegar('/perfiles-academicos');
    await new Promise((resolve) => setImmediate(resolve));
    const clickListado = app.contenido.listeners.get('click').values().next().value;
    await clickListado({ target: { closest: (selector) => selector === '[data-ver-perfil]' ? { dataset: { verPerfil: '75' } } : null } });
    const clickDetalle = app.detalle.listeners.get('click').values().next().value;
    const pendiente = clickDetalle({ target: { closest: (selector) => selector === '[data-cambiar-estado-perfil]' ? {} : null } });
    usuario.permisos = usuario.permisos.filter((permiso) => permiso !== 'PERFILES_ACADEMICOS_GESTIONAR');
    aceptar();
    await pendiente;
    assert.equal(calls, 0, 'El permiso vigente debe revalidarse luego de confirmar');
  } finally {
    app.restaurar();
  }
});

test('PerfilDialogs: un error de servicio tardío se descarta después de destruir la instancia', async () => {
  const servicio = deferred();
  let calls = 0;
  let elementsCreated = 0;
  const anteriorWindow = globalThis.window;
  const anteriorDocument = globalThis.document;
  const modal = {
    open: true, addEventListener() {}, removeEventListener() {}, showModal() {},
    close() { this.open = false; }, remove() {},
    querySelector(selector) {
      return {
        owner: this,
        addEventListener(_tipo, callback) {
          if (selector === '#sgpaConfirmAccept') this.owner.aceptar = callback;
        },
      };
    },
  };
  globalThis.window = {
    setTimeout, clearTimeout,
    sgpa: { cambiarEstadoPerfilAcademico: () => { calls += 1; return servicio.promise; } },
  };
  globalThis.document = {
    getElementById() { return null; }, querySelectorAll() { return []; },
    createElement() { elementsCreated += 1; return modal; },
    body: { appendChild() {} },
  };
  try {
    const operaciones = crearOperacionesContexto();
    const controlOperacion = operaciones.iniciar();
    const pending = cambiarEstadoPerfilActual({ perfil: { id: 76, nombre: 'Perfil', activo: true }, controlOperacion });
    await new Promise((resolve) => setImmediate(resolve));
    modal.aceptar();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
    operaciones.destruir();
    servicio.reject(new Error('Fallo tardío simulado'));
    await pending;
    assert.equal(elementsCreated, 1, 'El error tardío no debe abrir una alerta de una instancia destruida');
  } finally {
    globalThis.window = anteriorWindow;
    globalThis.document = anteriorDocument;
  }
});

test('router: una escritura de estado pendiente bloquea duplicados al reentrar y se libera al finalizar', async () => {
  const respuestas = [deferred(), deferred()];
  const llamadas = [];
  const confirmaciones = [];
  const app = prepararRouterPerfiles({
    usuario: { ...admin, permisos: [...admin.permisos] },
    api: {
      listarPerfilesAcademicos: async () => ({ ok: true, data: [{ id: 74, codigo: 'P-74', nombre: 'Perfil', activo: true }] }),
      listarCarreras: async () => ({ ok: true, carreras: [] }),
      obtenerPerfilAcademico: async () => ({ ok: true, data: { id: 74, codigo: 'P-74', nombre: 'Perfil', activo: true } }),
      listarAreasPerfil: async () => ({ ok: true, data: [] }),
      listarRequisitosPerfil: async () => ({ ok: true, data: [] }),
      cambiarEstadoPerfilAcademico: (...args) => { llamadas.push(args); return respuestas[llamadas.length - 1].promise; },
    },
  });
  app.document.createElement = () => {
    const confirmacion = {
      open: true,
      addEventListener() {}, removeEventListener() {}, showModal() {},
      close() { this.open = false; }, remove() {},
      querySelector(selector) {
        return { addEventListener(_tipo, callback) { if (selector === '#sgpaConfirmAccept') confirmacion.aceptar = callback; } };
      },
    };
    confirmaciones.push(confirmacion);
    return confirmacion;
  };
  app.document.body = { appendChild() {} };
  const click = async (host, selector, targetSelector, dataset = {}) => {
    const handler = host.listeners.get('click')?.values().next().value;
    return handler({ target: { closest: (candidate) => candidate === targetSelector ? { dataset } : null } });
  };
  const abrirPerfil = async () => {
    await click(app.contenido, '[data-ver-perfil]', '[data-ver-perfil]', { verPerfil: '74' });
    await new Promise((resolve) => setImmediate(resolve));
  };

  try {
    await app.navegar('/perfiles-academicos');
    await new Promise((resolve) => setImmediate(resolve));
    await abrirPerfil();
    const inicioA = click(app.detalle, '[data-cambiar-estado-perfil]', '[data-cambiar-estado-perfil]');
    assert.equal(confirmaciones.length, 1);
    confirmaciones[0].aceptar();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(llamadas, [[74, false]]);

    await app.navegar('/dashboard');
    await app.navegar('/perfiles-academicos');
    await new Promise((resolve) => setImmediate(resolve));
    await abrirPerfil();
    await click(app.detalle, '[data-cambiar-estado-perfil]', '[data-cambiar-estado-perfil]');
    assert.equal(confirmaciones.length, 1, 'La instancia reingresada no debe crear una confirmación duplicada');
    assert.equal(llamadas.length, 1, 'Debe permanecer una sola llamada mientras la primera escritura está pendiente');

    respuestas[0].resolve({ ok: true });
    await inicioA;
    const segundoIntento = click(app.detalle, '[data-cambiar-estado-perfil]', '[data-cambiar-estado-perfil]');
    assert.equal(confirmaciones.length, 2, 'Al completar la escritura, debe poder iniciarse otra operación');
    confirmaciones[1].aceptar();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(llamadas.length, 2);
    await app.navegar('/dashboard');
    respuestas[1].resolve({ ok: true });
    await segundoIntento;
  } finally {
    app.restaurar();
  }
});

test('perfiles-academicos: destrucción invalida confirmaciones pendientes y conserva bloqueos ya enviados', () => {
  const operaciones = crearOperacionesContexto();
  const anterior = operaciones.iniciar();
  const pendiente = anterior.reservar('areas:60');
  const enviada = anterior.reservar('requisitos:60');
  anterior.marcarEnviada('requisitos:60', enviada);
  operaciones.destruir();

  const actual = operaciones.iniciar();
  assert.equal(anterior.esVigente(), false);
  assert.equal(actual.reservar('areas:60') != null, true, 'La confirmación vieja no debe bloquear la reentrada');
  assert.equal(actual.reservar('requisitos:60'), null, 'Una escritura en vuelo debe mantener el bloqueo');
  assert.equal(anterior.liberar('requisitos:60', enviada), true);
  assert.ok(pendiente);
});

test('perfiles-academicos: cargarDetalle descarta respuestas de perfiles obsoletos cuando el usuario cambia de perfil', async () => {
  const reqPerfilA = deferred();
  const reqAreasA = deferred();
  const reqRequisitosA = deferred();

  let llamadoA = false;
  let llamadoB = false;

  const app = prepararRouterPerfiles({
    usuario: admin,
    api: {
      listarPerfilesAcademicos: async () => ({
        ok: true,
        data: [
          { id: 10, codigo: 'PER-A', nombre: 'Perfil Antiguo' },
          { id: 20, codigo: 'PER-B', nombre: 'Perfil Reciente' },
        ],
      }),
      listarCarreras: async () => ({ ok: true, carreras: [] }),
      obtenerPerfilAcademico: async (id) => {
        if (id === 10) {
          llamadoA = true;
          return reqPerfilA.promise;
        }
        llamadoB = true;
        return { ok: true, data: { id: 20, codigo: 'PER-B', nombre: 'Perfil Reciente', activo: true } };
      },
      listarAreasPerfil: async (id) => {
        if (id === 10) return reqAreasA.promise;
        return { ok: true, data: [{ tipo: 'DISCIPLINAR', descripcion: 'Área B' }] };
      },
      listarRequisitosPerfil: async (id) => {
        if (id === 10) return reqRequisitosA.promise;
        return { ok: true, data: [] };
      },
    },
  });

  try {
    await app.navegar('/perfiles-academicos');
    await new Promise((resolve) => setImmediate(resolve));

    // Simular clic en Perfil A (10)
    const btnVerA = { closest: () => ({ dataset: { verPerfil: '10' } }), target: {} };
    btnVerA.target.closest = btnVerA.closest;
    const content = app.contenido;
    content.listeners.get('click')?.forEach((h) => h(btnVerA));
    assert.ok(llamadoA, 'Debe haber llamado a obtener Perfil A');

    // Inmediatamente simular clic en Perfil B (20)
    const btnVerB = { closest: () => ({ dataset: { verPerfil: '20' } }), target: {} };
    btnVerB.target.closest = btnVerB.closest;
    content.listeners.get('click')?.forEach((h) => h(btnVerB));
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(llamadoB, 'Debe haber llamado a obtener Perfil B');

    // En este momento, Perfil B ya resolvió
    assert.match(app.detalle.innerHTML, /PER-B/);
    assert.match(app.detalle.innerHTML, /Perfil Reciente/);

    // Ahora resuelve tardíamente Perfil A
    reqPerfilA.resolve({ ok: true, data: { id: 10, codigo: 'PER-A', nombre: 'Perfil Antiguo', activo: true } });
    reqAreasA.resolve({ ok: true, data: [{ tipo: 'DISCIPLINAR', descripcion: 'Área A' }] });
    reqRequisitosA.resolve({ ok: true, data: [] });

    await new Promise((resolve) => setImmediate(resolve));

    // La respuesta tardía de A no debe sobreescribir los datos de B
    assert.match(app.detalle.innerHTML, /PER-B/);
    assert.match(app.detalle.innerHTML, /Perfil Reciente/);
    assert.doesNotMatch(app.detalle.innerHTML, /PER-A/);
    assert.doesNotMatch(app.detalle.innerHTML, /Perfil Antiguo/);
  } finally {
    app.restaurar();
  }
});
