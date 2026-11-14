import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciarLoginPage } from '../src/pages/login/LoginPage.js';
import { crearEstadoSesionAutenticada } from '../src/electron/ipc/auth-session-state.js';

class Elemento {
  constructor() {
    this.listeners = new Map();
    this.attributes = new Map();
    this.value = '';
    this.type = 'password';
    this.textContent = '';
    this.disabled = false;
    this.checked = false;
    this.classList = {
      values: new Set(),
      add: (...items) => items.forEach((item) => this.classList.values.add(item)),
      remove: (...items) => items.forEach((item) => this.classList.values.delete(item)),
      contains: (item) => this.classList.values.has(item),
      toggle: (item, force) => {
        const next = force ?? !this.classList.values.has(item);
        if (next) this.classList.values.add(item);
        else this.classList.values.delete(item);
      },
    };
  }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  append(...elements) { this.children = [...(this.children || []), ...elements]; }
  appendChild(element) { this.children = [...(this.children || []), element]; }
  replaceChildren() { this.children = []; }
  querySelector() { return this.children?.[0] || null; }
  querySelectorAll() { return this.children || []; }
  closest() { return { contains: () => true }; }
  focus() { globalThis.document.activeElement = this; }
  async emitir(type, event = {}) {
    for (const handler of this.listeners.get(type) || []) await handler({ preventDefault() {}, ...event });
  }
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function conLoginPage(callback) {
  const anteriorDocument = globalThis.document;
  const anteriorWindow = globalThis.window;
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const ids = [
    'loginView', 'loginForm', 'correo', 'password', 'togglePassword', 'loginError',
    'loginButton', 'loginButtonText', 'rememberMe', 'cuentasRecordadasToggle',
    'cuentasRecordadasMenu', 'forgotPasswordButton', 'loginHeader', 'recoveryPanel',
    'recoveryRequestForm', 'recoveryEmail', 'recoveryRequestError', 'recoveryRequestButton',
    'recoveryRequestButtonText', 'recoveryResetSection', 'recoveryMessage', 'recoverySuccess',
    'resetPasswordForm', 'recoveryCode', 'newPassword', 'confirmPassword',
    'resetPasswordError', 'resetPasswordButton', 'resetPasswordButtonText', 'backToLoginButton',
  ];
  const elementos = new Map(ids.map((id) => [id, new Elemento()]));
  let loginVistaActual = elementos.get('loginView');
  globalThis.document = {
    activeElement: null,
    createElement: () => new Elemento(),
    querySelectorAll: () => [],
    getElementById(id) {
      if (id === 'loginView') return loginVistaActual;
      return elementos.get(id) || null;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => key === 'sgpa-cuentas-recordadas' ? '["cuenta-b@una.invalid"]' : null, setItem() {}, removeItem() {} },
  });
  globalThis.window = { sgpa: {} };
  try {
    await callback({ elementos, establecerVista: (vista) => { loginVistaActual = vista; } });
  } finally {
    globalThis.document = anteriorDocument;
    globalThis.window = anteriorWindow;
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else delete globalThis.localStorage;
  }
}

test('Login consume la sesión confirmada aunque cambie el correo y falle el guardado opcional de cuenta', async () => {
  await conLoginPage(async ({ elementos }) => {
    globalThis.localStorage.setItem = () => { throw new Error('Storage no disponible'); };
    const respuestaServicio = deferred();
    const estadoMain = crearEstadoSesionAutenticada();
    let llamadas = 0;
    let credencialesEnviadas;
    let recibido;
    globalThis.window.sgpa.login = async (credenciales) => {
      llamadas += 1;
      credencialesEnviadas = credenciales;
      const contexto = estadoMain.iniciarLogin();
      const servicio = await respuestaServicio.promise;
      assert.equal(estadoMain.confirmarLogin(contexto, servicio.accessToken), true);
      return { ok: true, usuario: servicio.usuario };
    };
    elementos.get('correo').value = 'cuenta-a@una.invalid';
    elementos.get('password').value = 'clave-ficticia';
    elementos.get('rememberMe').checked = true;
    iniciarLoginPage({ onLoginSuccess: (resultado) => { recibido = resultado; } });

    const form = elementos.get('loginForm');
    await elementos.get('cuentasRecordadasToggle').emitir('click');
    const submit = form.emitir('submit');
    await form.emitir('submit');
    assert.equal(llamadas, 1);
    assert.equal(elementos.get('correo').disabled, true);
    assert.equal(elementos.get('cuentasRecordadasToggle').disabled, true);
    await elementos.get('cuentasRecordadasMenu').children[0].emitir('click');
    assert.equal(elementos.get('correo').value, 'cuenta-a@una.invalid');
    assert.deepEqual(credencialesEnviadas, { correo: 'cuenta-a@una.invalid', password: 'clave-ficticia' });

    // Simula un cambio programático que no puede impedir consumir la sesión confirmada.
    elementos.get('correo').value = 'cuenta-b@una.invalid';
    respuestaServicio.resolve({
      accessToken: 'token-simulado-a',
      usuario: { id: 41, correo: 'cuenta-a@una.invalid' },
    });
    await submit;

    assert.equal(estadoMain.obtenerToken(), 'token-simulado-a');
    assert.equal(recibido.usuario.correo, 'cuenta-a@una.invalid');
    assert.equal(elementos.get('correo').value, 'cuenta-a@una.invalid');
    assert.equal(elementos.get('correo').disabled, false);
  });
});

test('Login ignora un rechazo obsoleto del proceso principal tras iniciar otro intento de sesión', async () => {
  await conLoginPage(async ({ elementos }) => {
    const respuesta = deferred();
    const estadoMain = crearEstadoSesionAutenticada();
    let exitos = 0;
    globalThis.window.sgpa.login = async () => {
      const contextoViejo = estadoMain.iniciarLogin();
      const contextoNuevo = estadoMain.iniciarLogin();
      assert.equal(estadoMain.loginSigueVigente(contextoNuevo), true);
      const servicio = await respuesta.promise;
      const confirmada = estadoMain.confirmarLogin(contextoViejo, servicio.accessToken);
      return confirmada
        ? { ok: true, usuario: servicio.usuario }
        : { ok: false, status: 409, message: 'La sesión cambió durante la operación.' };
    };
    elementos.get('correo').value = 'cuenta-a@una.invalid';
    elementos.get('password').value = 'clave-ficticia';
    iniciarLoginPage({ onLoginSuccess: () => { exitos += 1; } });
    const submit = elementos.get('loginForm').emitir('submit');
    respuesta.resolve({ accessToken: 'token-obsoleto', usuario: { id: 41 } });
    await submit;
    assert.equal(estadoMain.obtenerToken(), null);
    assert.equal(exitos, 0);
    assert.match(elementos.get('loginError').textContent, /sesión cambió/i);
    assert.equal(elementos.get('loginButton').disabled, false);
  });
});

test('Login rehabilita controles tras un error y permite reintentar', async () => {
  await conLoginPage(async ({ elementos }) => {
    let llamadas = 0;
    globalThis.window.sgpa.login = async () => {
      llamadas += 1;
      return llamadas === 1
        ? { ok: false, status: 401, message: 'Credenciales incorrectas.' }
        : { ok: true, usuario: { id: 41 } };
    };
    elementos.get('correo').value = 'cuenta-a@una.invalid';
    elementos.get('password').value = 'clave-ficticia';
    let exitos = 0;
    iniciarLoginPage({ onLoginSuccess: () => { exitos += 1; } });
    const form = elementos.get('loginForm');
    await form.emitir('submit');
    assert.equal(elementos.get('correo').disabled, false);
    assert.equal(elementos.get('loginButton').disabled, false);
    assert.match(elementos.get('loginError').textContent, /credenciales incorrectas/i);
    await form.emitir('submit');
    assert.equal(llamadas, 2);
    assert.equal(exitos, 1);
  });
});
