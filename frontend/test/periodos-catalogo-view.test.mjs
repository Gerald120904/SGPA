import test from 'node:test';
import assert from 'node:assert/strict';
import { construirFilasPeriodosHtml } from '../src/pages/periodos/PeriodosCatalogo.js';
import { ejecutarCambioEstadoPeriodo } from '../src/pages/periodos/PeriodoAcciones.js';
import { iniciarPeriodosPage, destruirPeriodosPage } from '../src/pages/periodos/PeriodosPage.js';
import { guardarSesion } from '../src/app/session.js';

test('el catálogo conserva etiquetas, fechas, estados y controles según los permisos efectivos', () => {
  const filas = construirFilasPeriodosHtml([{
    id: 3,
    codigo: '<PER-3>',
    nombre: 'Ciclo de prueba',
    anio: 2026,
    ciclo: 1,
    fechaInicio: '2026-03-01',
    fechaFin: '2026-06-30',
    fechaLimiteDisponibilidad: '2026-02-28',
    estado: 'BORRADOR',
    transicionesEstado: [{ estado: 'EN_PREPARACION', disponible: false, motivo: 'Falta validar' }],
  }], true);

  for (const label of ['Código', 'Periodo', 'Fechas', 'Estado', 'Acciones']) {
    assert.match(filas, new RegExp(`<td data-label="${label}">`));
  }
  assert.match(filas, /&lt;PER-3&gt;/);
  assert.match(filas, /01\/03\/2026/);
  assert.match(filas, /data-action="editar"[\s\S]*?data-id="3"/);
  assert.match(filas, /aria-disabled="true"/);
  assert.match(filas, /Falta validar/);

  const soloLectura = construirFilasPeriodosHtml([{
    id: 4, estado: 'BORRADOR', transicionesEstado: [],
  }], false);
  assert.doesNotMatch(soloLectura, /data-action="editar"|data-action="estado"/);
});

class Dialog {
  constructor(registro) {
    this.registro = registro;
    this.listeners = new Map();
    this.open = false;
    this.classList = { add() {}, remove() {} };
  }
  set innerHTML(html) {
    this.html = html;
    for (const [, id] of html.matchAll(/id="([^"]+)"/g)) {
      this.registro.set(id, new Button());
    }
  }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }
  querySelector(selector) { return this.registro.get(selector.slice(1)) || null; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  remove() {
    for (const [id, element] of this.registro) if (element === this) this.registro.delete(id);
  }
  getBoundingClientRect() { return { left: 0, right: 100, top: 0, bottom: 100 }; }
}

class Button {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }
  async click() {
    for (const callback of this.listeners.get('click') || []) await callback({ target: this });
  }
}

class Element {
  constructor() {
    this.listeners = new Map();
    this.value = '';
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }
  async emitir(type, event = {}) {
    for (const callback of this.listeners.get(type) || []) {
      await callback({ preventDefault() {}, ...event });
    }
  }
}

async function conDialogs(callback) {
  const anteriorDocument = globalThis.document;
  const anteriorWindow = globalThis.window;
  const registro = new Map();
  globalThis.document = {
    getElementById: (id) => registro.get(id) || null,
    createElement: () => new Dialog(registro),
    querySelectorAll: () => [],
    body: { appendChild(dialog) { registro.set(dialog.id, dialog); } },
  };
  globalThis.window = { setTimeout: () => 1, clearTimeout() {} };
  try {
    await callback(registro);
  } finally {
    globalThis.document = anteriorDocument;
    globalThis.window = anteriorWindow;
  }
}

const periodo = {
  id: 8,
  nombre: 'Periodo de prueba',
  estado: 'BORRADOR',
  transicionesEstado: [{ estado: 'EN_PREPARACION', disponible: true }],
};

function iniciar(cambios = {}) {
  let vigente = true;
  const servicios = [];
  const recargas = [];
  const tarea = ejecutarCambioEstadoPeriodo({
    periodo,
    nuevoEstado: 'EN_PREPARACION',
    operacionId: cambios.operacionId ?? 1,
    vigente: () => vigente,
    recargarPeriodos: async () => { recargas.push(true); },
  });
  return {
    tarea,
    servicios,
    recargas,
    invalidar() { vigente = false; },
    permitir() { vigente = true; },
  };
}

test('Periodo: confirmar después de invalidar la instancia no envía la transición', async () => {
  await conDialogs(async (registro) => {
    let llamadas = 0;
    window.sgpa = { cambiarEstadoPeriodoAcademico: async () => { llamadas += 1; return { ok: true }; } };
    const flujo = iniciar();
    flujo.invalidar();
    await registro.get('sgpaConfirmAccept').click();
    await flujo.tarea;
    assert.equal(llamadas, 0);
    assert.equal(flujo.recargas.length, 0);
    assert.equal(registro.has('sgpaAlertDialog'), false);
  });
});

test('Periodo: cancelar una confirmación vigente no escribe', async () => {
  await conDialogs(async (registro) => {
    let llamadas = 0;
    window.sgpa = { cambiarEstadoPeriodoAcademico: async () => { llamadas += 1; return { ok: true }; } };
    const flujo = iniciar();
    await registro.get('sgpaConfirmCancel').click();
    await flujo.tarea;
    assert.equal(llamadas, 0);
    assert.equal(flujo.recargas.length, 0);
  });
});

test('Periodo: una confirmación vigente escribe una vez con los argumentos originales', async () => {
  await conDialogs(async (registro) => {
    const llamadas = [];
    window.sgpa = { cambiarEstadoPeriodoAcademico: async (...args) => { llamadas.push(args); return { ok: true }; } };
    const flujo = iniciar();
    await registro.get('sgpaConfirmAccept').click();
    await flujo.tarea;
    assert.deepEqual(llamadas, [[8, 'EN_PREPARACION']]);
    assert.equal(flujo.recargas.length, 1);
  });
});

test('Periodo: una nueva instancia y un cambio de permisos invalidan la confirmación anterior', async () => {
  await conDialogs(async (registro) => {
    let instancia = 1;
    let versionPermiso = 1;
    let llamadas = 0;
    const operacionVigente = () => instancia === 1 && versionPermiso === 1;
    window.sgpa = { cambiarEstadoPeriodoAcademico: async () => { llamadas += 1; return { ok: true }; } };
    const tarea = ejecutarCambioEstadoPeriodo({
      periodo, nuevoEstado: 'EN_PREPARACION', operacionId: 1,
      vigente: operacionVigente, recargarPeriodos: async () => {},
    });
    instancia = 2; // A fue desmontada y B ya se creó.
    versionPermiso = 2; // el contexto autorizado de A también cambió.
    await registro.get('sgpaConfirmAccept').click();
    await tarea;
    assert.equal(llamadas, 0);
  });
});

test('Periodo: respuesta IPC tardía tras desmontaje no actualiza ni recarga la vista nueva', async () => {
  await conDialogs(async (registro) => {
    let resolver;
    const respuesta = new Promise((resolve) => { resolver = resolve; });
    let llamadas = 0;
    window.sgpa = { cambiarEstadoPeriodoAcademico: async () => { llamadas += 1; return respuesta; } };
    const flujo = iniciar();
    const aceptar = registro.get('sgpaConfirmAccept').click();
    await Promise.resolve();
    assert.equal(llamadas, 1);
    flujo.invalidar();
    resolver({ ok: true });
    await aceptar;
    await flujo.tarea;
    assert.equal(flujo.recargas.length, 0);
    assert.equal(registro.has('sgpaAlertDialog'), false);
  });
});

test('Periodo: doble activación para la misma instancia no crea operaciones duplicadas', async () => {
  await conDialogs(async (registro) => {
    let llamadas = 0;
    window.sgpa = { cambiarEstadoPeriodoAcademico: async () => { llamadas += 1; return { ok: true }; } };
    const primero = iniciar();
    const segundo = ejecutarCambioEstadoPeriodo({
      periodo, nuevoEstado: 'EN_PREPARACION', operacionId: 1,
      vigente: () => true, recargarPeriodos: async () => {},
    });
    await registro.get('sgpaConfirmAccept').click();
    await Promise.all([primero.tarea, segundo]);
    assert.equal(llamadas, 1);
  });
});

test('PeriodosPage: confirmación de A no puede usar la instancia B tras salir y reentrar', async () => {
  await conDialogs(async (registro) => {
    const elementos = new Map([
      ['periodosPage', new Element()],
      ['periodosContent', new Element()],
      ['nuevoPeriodoButton', new Element()],
      ['periodosBuscar', new Element()],
      ['periodosEstado', new Element()],
    ]);
    globalThis.document.getElementById = (id) => registro.get(id) || elementos.get(id) || null;
    globalThis.document.body.appendChild = (dialog) => { registro.set(dialog.id, dialog); };
    guardarSesion({ usuario: { rolActivo: 'ADMIN_GLOBAL', roles: [{ nombre: 'ADMIN_GLOBAL' }] } });
    let listados = 0;
    let cambios = 0;
    window.sgpa = {
      async listarPeriodosAcademicos() {
        listados += 1;
        return { ok: true, periodos: [periodo] };
      },
      async cambiarEstadoPeriodoAcademico() { cambios += 1; return { ok: true }; },
    };

    iniciarPeriodosPage();
    await new Promise((resolve) => setImmediate(resolve));
    const eventoViejo = elementos.get('periodosContent').emitir('click', {
      target: { closest: () => ({ dataset: { action: 'estado', id: '8', estado: 'EN_PREPARACION' } }) },
    });
    assert.ok(registro.get('sgpaConfirmAccept'));

    destruirPeriodosPage();
    elementos.set('periodosPage', new Element());
    iniciarPeriodosPage();
    await new Promise((resolve) => setImmediate(resolve));
    await registro.get('sgpaConfirmAccept').click();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(listados, 2);
    assert.equal(cambios, 0);
    void eventoViejo;
  });
});
