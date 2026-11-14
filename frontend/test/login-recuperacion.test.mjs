import test from 'node:test';
import assert from 'node:assert/strict';
import { inicializarRecuperacionLogin } from '../src/pages/login/LoginRecuperacion.js';

class Elemento {
  constructor() {
    this.listeners = new Map();
    this.attributes = new Map();
    this.value = '';
    this.textContent = '';
    this.disabled = false;
    this.classList = {
      values: new Set(),
      add: (...items) => items.forEach((item) => this.classList.values.add(item)),
      remove: (...items) => items.forEach((item) => this.classList.values.delete(item)),
      contains: (item) => this.classList.values.has(item),
    };
  }
  addEventListener(type, listener) {
    const callbacks = this.listeners.get(type) || new Set();
    callbacks.add(listener);
    this.listeners.set(type, callbacks);
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  focus() { globalThis.document.activeElement = this; }
  async emitir(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) await listener({ preventDefault() {}, ...event });
  }
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

function preparar() {
  const anterior = globalThis.document;
  const ids = [
    'loginView', 'forgotPasswordButton', 'loginHeader', 'recoveryPanel',
    'recoveryRequestForm', 'recoveryEmail', 'recoveryRequestError',
    'recoveryRequestButton', 'recoveryRequestButtonText', 'recoveryResetSection',
    'recoveryMessage', 'recoverySuccess', 'resetPasswordForm', 'recoveryCode',
    'newPassword', 'confirmPassword', 'resetPasswordError', 'resetPasswordButton',
    'resetPasswordButtonText', 'backToLoginButton',
  ];
  const elementos = new Map(ids.map((id) => [id, new Elemento()]));
  globalThis.document = { activeElement: null, getElementById: (id) => elementos.get(id) || null };
  const correoInput = new Elemento();
  const loginForm = new Elemento();
  const restablecer = [];
  let llamadasRecuperacion = 0;
  const limpiar = () => { globalThis.document = anterior; };
  inicializarRecuperacionLogin({
    correoInput,
    loginForm,
    renderizarIconos() {},
    solicitarRecuperacionApi: (...args) => {
      llamadasRecuperacion += 1;
      return restablecer.shift()(...args);
    },
    restablecerPasswordApi: async (...args) => {
      restablecer.args = args;
      return { ok: true };
    },
  });
  return { elementos, correoInput, loginForm, restablecer, get llamadasRecuperacion() { return llamadasRecuperacion; }, limpiar };
}

test('recuperación ignora resultado obsoleto, evita doble envío y reporta la solicitud vigente', async () => {
  const app = preparar();
  const primera = deferred();
  app.restablecer.push(() => primera.promise, async () => ({ ok: true, message: 'Revise su correo institucional.' }));
  try {
    app.correoInput.value = 'login@una.ac.cr';
    await app.elementos.get('forgotPasswordButton').emitir('click');
    const correo = app.elementos.get('recoveryEmail');
    assert.equal(correo.value, 'login@una.ac.cr');
    assert.equal(app.loginForm.classList.contains('hidden'), true);

    correo.value = 'anterior@una.ac.cr';
    const form = app.elementos.get('recoveryRequestForm');
    const solicitudAnterior = form.emitir('submit');
    await form.emitir('submit');
    assert.equal(app.llamadasRecuperacion, 1);
    correo.value = 'vigente@una.ac.cr';
    await correo.emitir('input');
    primera.resolve({ ok: true, message: 'Respuesta de cuenta anterior.' });
    await solicitudAnterior;
    assert.equal(app.elementos.get('recoveryMessage').textContent, '');

    await form.emitir('submit');
    assert.equal(app.llamadasRecuperacion, 2);
    assert.equal(app.elementos.get('recoveryMessage').textContent, 'Revise su correo institucional.');
    assert.equal(form.classList.contains('hidden'), true);
  } finally {
    app.limpiar();
  }
});

test('restablecimiento valida el código antes de llamar al servicio y aplica una respuesta válida', async () => {
  const app = preparar();
  try {
    const email = app.elementos.get('recoveryEmail');
    email.value = 'persona@una.ac.cr';
    const form = app.elementos.get('resetPasswordForm');
    app.elementos.get('recoveryCode').value = '123';
    await form.emitir('submit');
    assert.match(app.elementos.get('resetPasswordError').textContent, /6 dígitos/);
    assert.equal(app.restablecer.args, undefined);

    app.elementos.get('recoveryCode').value = '123456';
    app.elementos.get('newPassword').value = 'ClaveFicticia123';
    app.elementos.get('confirmPassword').value = 'ClaveFicticia123';
    await form.emitir('submit');
    assert.deepEqual(app.restablecer.args, ['persona@una.ac.cr', '123456', 'ClaveFicticia123']);
    assert.match(app.elementos.get('recoverySuccess').textContent, /Contraseña actualizada/);
    assert.equal(app.correoInput.value, 'persona@una.ac.cr');
  } finally {
    app.limpiar();
  }
});
