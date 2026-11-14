import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAVE_CUENTAS_RECORDADAS,
  CLAVE_CORREO_ANTERIOR,
  MAXIMO_CUENTAS_RECORDADAS,
  obtenerCuentasRecordadas,
  guardarCuentasRecordadas,
} from '../src/pages/login/login.cuentas.js';

class MockElement {
  constructor() {
    this.listeners = new Map();
    this.attributes = new Map();
    this.children = [];
    this.value = '';
    this.type = '';
    this.className = '';
    this.classList = {
      values: new Set(),
      add: (...items) => items.forEach((item) => this.classList.values.add(item)),
      remove: (...items) => items.forEach((item) => this.classList.values.delete(item)),
      contains: (item) => this.classList.values.has(item),
      toggle: (item, force) => {
        const next = force ?? !this.classList.values.has(item);
        if (next) this.classList.values.add(item);
        else this.classList.values.delete(item);
        return next;
      },
    };
  }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  append(...items) { this.children.push(...items); }
  appendChild(item) { this.children.push(item); }
  replaceChildren(...items) { this.children = items; }
  querySelector() { return this.children[0] || null; }
  querySelectorAll() { return this.children; }
  focus() { globalThis.document.activeElement = this; }
  closest() { return globalThis.__loginAccountContainer; }
  contains(target) { return this === target || this.children.includes(target); }
}

function almacenamiento(datos = {}) {
  const valores = new Map(Object.entries(datos));
  return {
    valores,
    getItem(clave) { return valores.get(clave) ?? null; },
    setItem(clave, valor) { valores.set(clave, valor); },
    removeItem(clave) { valores.delete(clave); },
  };
}

test('las cuentas recordadas migran la clave anterior, normalizan duplicados y limitan a ocho', () => {
  const items = Array.from({ length: 10 }, (_, index) => `cuenta${index}@una.ac.cr`);
  const storage = almacenamiento({
    [CLAVE_CUENTAS_RECORDADAS]: JSON.stringify([' ana@una.ac.cr ', 'ana@una.ac.cr', ...items]),
    [CLAVE_CORREO_ANTERIOR]: 'ana@una.ac.cr',
  });
  const cuentas = obtenerCuentasRecordadas(storage);
  assert.equal(cuentas[0], 'ana@una.ac.cr');
  assert.equal(cuentas.length, MAXIMO_CUENTAS_RECORDADAS);
  assert.equal(cuentas.filter((correo) => correo === 'ana@una.ac.cr').length, 1);
  assert.equal(storage.getItem(CLAVE_CORREO_ANTERIOR), null);
});

test('una lista local inválida falla de forma cerrada y guardar mantiene el formato existente', () => {
  const storage = almacenamiento({ [CLAVE_CUENTAS_RECORDADAS]: '{' });
  assert.deepEqual(obtenerCuentasRecordadas(storage), []);
  guardarCuentasRecordadas(['persona@una.ac.cr'], storage);
  assert.equal(storage.getItem(CLAVE_CUENTAS_RECORDADAS), '["persona@una.ac.cr"]');
});

test('el selector monta opciones accesibles y seleccionarlas enfoca la contraseña', async () => {
  const { inicializarSelectorCuentas } = await import('../src/pages/login/login.cuentas.js');
  const anteriorDocumento = globalThis.document;
  const anterioresContainer = globalThis.__loginAccountContainer;
  const storage = almacenamiento({ [CLAVE_CUENTAS_RECORDADAS]: '["persona@una.ac.cr"]' });
  globalThis.document = {
    activeElement: null,
    createElement: () => new MockElement(),
  };
  const contenedor = { contains: () => true };
  globalThis.__loginAccountContainer = contenedor;
  const correo = new MockElement();
  correo.closest = () => contenedor;
  const password = new MockElement();
  const toggle = new MockElement();
  const menu = new MockElement();
  const view = new MockElement();
  let renderizados = 0;

  try {
    const selector = inicializarSelectorCuentas({
      correoInput: correo,
      passwordInput: password,
      toggle,
      menu,
      loginView: view,
      renderizarIconos: () => { renderizados += 1; },
      storage,
    });
    assert.equal(menu.children.length, 1);
    assert.equal(menu.children[0].attributes.get('role'), 'option');
    menu.children[0].listeners.get('click').values().next().value();
    assert.equal(correo.value, 'persona@una.ac.cr');
    assert.equal(globalThis.document.activeElement, password);
    assert.equal(menu.classList.contains('hidden'), true);
    selector.agregar('nueva@una.ac.cr');
    assert.equal(menu.children[0].children[1].children[0].textContent, 'nueva@una.ac.cr');
    assert.ok(renderizados >= 2);
  } finally {
    globalThis.document = anteriorDocumento;
    globalThis.__loginAccountContainer = anterioresContainer;
  }
});
