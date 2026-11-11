import test from 'node:test';
import assert from 'node:assert/strict';

import {
  iniciarAplicacion,
  destruirAplicacion,
} from '../src/app/App.js';
import {
  limpiarSesion,
  obtenerUsuario,
  obtenerRolActivo,
} from '../src/app/session.js';
import { ROLES, PERMISOS } from '../src/config/permissions.js';

const VOID_TAGS = new Set(['img', 'input', 'br', 'hr', 'meta', 'link']);

class SimElement {
  constructor(tagName = 'div', doc = null) {
    this.tagName = tagName.toUpperCase();
    this.doc = doc;
    this.id = '';
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.parentElement = null;
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.type = '';
    this.textContent = '';
    this.style = {};
    this._classSet = new Set();
    this._listeners = new Map();
    this._innerHTML = '';
    this.classList = {
      add: (...cls) => cls.forEach((c) => c && this._classSet.add(c)),
      remove: (...cls) => cls.forEach((c) => this._classSet.delete(c)),
      toggle: (c, force) => {
        const add = force === undefined ? !this._classSet.has(c) : Boolean(force);
        if (add) this._classSet.add(c);
        else this._classSet.delete(c);
        return add;
      },
      contains: (c) => this._classSet.has(c),
    };
  }

  get className() {
    return [...this._classSet].join(' ');
  }

  set className(val) {
    this._classSet = new Set(String(val || '').split(/\s+/).filter(Boolean));
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(html) {
    this._innerHTML = String(html || '');
    this.children = [];
    if (this._innerHTML) {
      for (const node of parseHtmlNodes(this._innerHTML, this.doc)) {
        this.appendChild(node);
      }
    }
    this.doc?._reindex?.();
  }

  get outerHTML() {
    return `<${this.tagName.toLowerCase()}>${this._innerHTML}</${this.tagName.toLowerCase()}>`;
  }

  set outerHTML(html) {
    const parent = this.parentElement;
    if (!parent) return;
    const nodes = parseHtmlNodes(String(html || ''), this.doc);
    const idx = parent.children.indexOf(this);
    if (idx === -1) return;
    parent.children.splice(idx, 1, ...nodes);
    nodes.forEach((n) => {
      n.parentElement = parent;
      n.parentNode = parent;
    });
    this.parentElement = null;
    this.parentNode = null;
    this.doc?._reindex?.();
  }

  insertAdjacentHTML(pos, html) {
    if (pos === 'afterbegin') {
      this._innerHTML = `${html}${this._innerHTML}`;
      const newNodes = parseHtmlNodes(html, this.doc);
      newNodes.forEach((n) => {
        n.parentElement = this;
        n.parentNode = this;
      });
      this.children = [...newNodes, ...this.children];
    } else {
      this._innerHTML = `${this._innerHTML}${html}`;
      for (const node of parseHtmlNodes(html, this.doc)) {
        this.appendChild(node);
      }
    }
    this.doc?._reindex?.();
  }

  appendChild(child) {
    child.parentElement = this;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...nodes) {
    nodes.forEach((n) => this.appendChild(n));
  }

  replaceChildren(...nodes) {
    this.children = [];
    nodes.forEach((n) => this.appendChild(n));
    this.doc?._reindex?.();
  }

  setAttribute(name, val) {
    const str = String(val);
    this.attributes.set(name, str);
    if (name === 'id') this.id = str;
    if (name === 'class') this.className = str;
    if (name === 'value') this.value = str;
    if (name === 'type') this.type = str;
    if (name === 'disabled') this.disabled = true;
    if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      this.dataset[camel] = str;
    }
  }

  getAttribute(name) {
    if (name === 'id' && this.id) return this.id;
    if (name === 'class' && this.className) return this.className;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'disabled') this.disabled = false;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  focus() {
    if (this.doc) this.doc.activeElement = this;
  }

  contains(target) {
    let cur = target;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  addEventListener(type, fn, opts) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    const set = this._listeners.get(type);
    set.add(fn);
    if (opts && typeof opts === 'object' && opts.signal) {
      if (opts.signal.aborted) {
        set.delete(fn);
      } else {
        opts.signal.addEventListener?.('abort', () => set.delete(fn), { once: true });
      }
    }
  }

  removeEventListener(type, fn) {
    this._listeners.get(type)?.delete(fn);
  }

  listenerCount(type) {
    return this._listeners.get(type)?.size || 0;
  }

  async dispatch(type, data = {}) {
    const event = {
      type,
      target: data.target || this,
      currentTarget: this,
      _stopped: false,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this._stopped = true;
      },
      ...data,
    };

    let cur = this;
    while (cur) {
      event.currentTarget = cur;
      for (const fn of [...(cur._listeners.get(type) || [])]) {
        await fn(event);
      }
      if (event._stopped || type === 'submit') break;
      cur = cur.parentElement;
    }
    return event;
  }

  matches(selector) {
    return matchesSimpleSelector(this, selector);
  }

  closest(selector) {
    let cur = this;
    while (cur) {
      if (cur.matches?.(selector)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const out = [];
    const walk = (el) => {
      for (const ch of el.children) {
        if (matchesSimpleSelector(ch, selector)) out.push(ch);
        walk(ch);
      }
    };
    walk(this);
    return out;
  }
}

function matchesSimpleSelector(el, selector) {
  const s = selector.trim();
  if (s.startsWith('#')) return el.id === s.slice(1);
  if (s.startsWith('.')) return el.classList.contains(s.slice(1));
  if (s === '[data-route]') return Boolean(el.dataset?.route);
  if (s === '[data-seleccionar-carrera]') return Boolean(el.dataset?.seleccionarCarrera);
  if (s === '[data-module]') return Boolean(el.dataset?.module);
  const attrVal = s.match(/^\[([a-zA-Z0-9-]+)="([^"]*)"\]$/);
  if (attrVal) return el.getAttribute(attrVal[1]) === attrVal[2];
  return false;
}

function parseAttributes(raw) {
  const attrs = [];
  const rx = /([a-zA-Z0-9:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
  let m;
  while ((m = rx.exec(raw)) !== null) {
    attrs.push([m[1], m[2] ?? m[3] ?? '']);
  }
  return attrs;
}

function parseHtmlNodes(html, doc) {
  const clean = String(html).replace(/<!--[\s\S]*?-->/g, '');
  const roots = [];
  const stack = [];
  const rx = /<(\/?)([a-zA-Z0-9-]+)([^>]*?)(\/?)>/g;
  let lastIndex = 0;
  let m;

  while ((m = rx.exec(clean)) !== null) {
    const textChunk = clean.slice(lastIndex, m.index).trim();
    if (textChunk && stack.length > 0) {
      const top = stack[stack.length - 1];
      top.textContent = top.textContent ? `${top.textContent} ${textChunk}` : textChunk;
    }
    lastIndex = rx.lastIndex;

    const isClose = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrStr = m[3] || '';
    const selfClosing = m[4] === '/' || VOID_TAGS.has(tag);

    if (isClose) {
      while (stack.length > 0) {
        const popped = stack.pop();
        if (popped.tagName.toLowerCase() === tag) break;
      }
      continue;
    }

    const node = new SimElement(tag, doc);
    for (const [k, v] of parseAttributes(attrStr)) {
      node.setAttribute(k, v);
      if (k === 'selected' && tag === 'option' && stack.length > 0) {
        const sel = stack[stack.length - 1];
        if (sel.tagName === 'SELECT') sel.value = node.value;
      }
    }

    if (stack.length > 0) {
      stack[stack.length - 1].appendChild(node);
    } else {
      roots.push(node);
    }

    if (!selfClosing) stack.push(node);
  }

  return roots;
}

class SimDocument {
  constructor() {
    this.title = '';
    this.activeElement = null;
    this.byId = new Map();
    this._listeners = new Map();
    this.body = new SimElement('body', this);
  }

  _reindex() {
    this.byId.clear();
    const walk = (el) => {
      if (el.id) this.byId.set(el.id, el);
      for (const ch of el.children) walk(ch);
    };
    walk(this.body);
  }

  createElement(tag) {
    return new SimElement(tag, this);
  }

  getElementById(id) {
    return this.byId.get(id) || null;
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  addEventListener(type, fn, opts) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    const set = this._listeners.get(type);
    set.add(fn);
    if (opts && typeof opts === 'object' && opts.signal) {
      if (opts.signal.aborted) {
        set.delete(fn);
      } else {
        opts.signal.addEventListener?.('abort', () => set.delete(fn), { once: true });
      }
    }
  }

  removeEventListener(type, fn) {
    this._listeners.get(type)?.delete(fn);
  }

  listenerCount(type) {
    return this._listeners.get(type)?.size || 0;
  }
}

function crearEntornoApp(sgpaOverrides = {}) {
  const doc = new SimDocument();
  const app = doc.createElement('div');
  app.id = 'app';
  doc.body.appendChild(app);
  doc._reindex();

  const storage = new Map();
  const winListeners = new Map();
  const sgpaCallbacks = [];
  const intervalos = [];
  let nextTimerId = 1;

  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;

  globalThis.setInterval = (fn, ms) => {
    const id = nextTimerId++;
    intervalos.push({ id, fn, ms, cleared: false });
    return id;
  };
  globalThis.clearInterval = (id) => {
    const entry = intervalos.find((x) => x.id === id);
    if (entry) entry.cleared = true;
  };

  let currentHash = '';
  const win = {
    innerWidth: 1280,
    location: {
      pathname: '/',
      search: '',
      get hash() {
        return currentHash;
      },
      set hash(val) {
        const next = val.startsWith('#') ? val : `#${val}`;
        if (next === currentHash) return;
        currentHash = next;
        for (const fn of [...(winListeners.get('hashchange') || [])]) {
          fn({ type: 'hashchange' });
        }
      },
    },
    history: {
      replaceState: (_state, _title, url) => {
        const hashIdx = String(url).indexOf('#');
        currentHash = hashIdx >= 0 ? String(url).slice(hashIdx) : '';
      },
    },
    addEventListener(type, fn, opts) {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      const set = winListeners.get(type);
      set.add(fn);
      if (opts && typeof opts === 'object' && opts.signal) {
        if (opts.signal.aborted) {
          set.delete(fn);
        } else {
          opts.signal.addEventListener?.('abort', () => set.delete(fn), { once: true });
        }
      }
    },
    removeEventListener(type, fn) {
      winListeners.get(type)?.delete(fn);
    },
    dispatchEvent(evt) {
      for (const fn of [...(winListeners.get(evt.type) || [])]) {
        fn(evt);
      }
    },
    listenerCount(type) {
      return winListeners.get(type)?.size || 0;
    },
    sgpa: {
      obtenerPerfil: async () => ({ ok: true, usuario: obtenerUsuario() }),
      onSesionInvalidada: (cb) => {
        sgpaCallbacks.push(cb);
        return () => {
          const idx = sgpaCallbacks.indexOf(cb);
          if (idx >= 0) sgpaCallbacks.splice(idx, 1);
        };
      },
      logout: async () => ({ ok: true }),
      listarEstudiantes: async () => ({ ok: true, estudiantes: [] }),
      listarCarreras: async () => ({ ok: true, carreras: [] }),
      ...sgpaOverrides,
    },
  };

  globalThis.document = doc;
  globalThis.window = win;
  globalThis.localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };

  async function realizarLogin(correo = 'admin@una.cr', password = 'Secret123!') {
    doc.getElementById('correo').value = correo;
    doc.getElementById('password').value = password;
    await doc.getElementById('loginForm').dispatch('submit');
    await tickAsync();
  }

  function restaurar() {
    destruirAplicacion();
    limpiarSesion();
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }

  return {
    doc,
    win,
    app,
    sgpaCallbacks,
    intervalos,
    realizarLogin,
    restaurar,
  };
}

function tickAsync() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

/* =========================================================
   PRUEBAS DE INTEGRACIÓN DEL SHELL EN APP.JS
   ========================================================= */

test('App + Layout: login, cambio de rol actualiza menú sin reiniciar app y bloquea rutas no autorizadas', async () => {
  const usuarioAdmin = {
    id: 100,
    nombres: 'Gerald Dual',
    correo: 'gerald@una.cr',
    roles: [ROLES.ADMIN_GLOBAL, ROLES.COORDINADOR],
    rolActivo: ROLES.ADMIN_GLOBAL,
    permisos: [PERMISOS.CARRERAS_VER],
  };

  let carrerasConsultas = 0;
  let logoutCalls = 0;

  const env = crearEntornoApp({
    login: async () => ({ ok: true, usuario: { ...usuarioAdmin } }),
    cambiarRolActivo: async (rol) => ({
      ok: true,
      accessToken: `tok-${rol}`,
      usuario: {
        ...usuarioAdmin,
        rolActivo: rol,
        permisos: rol === ROLES.COORDINADOR ? [PERMISOS.CARRERAS_VER] : [],
      },
    }),
    listarCarreras: async () => {
      carrerasConsultas += 1;
      return { ok: true, carreras: [] };
    },
    logout: async () => {
      logoutCalls += 1;
      return { ok: true };
    },
  });

  try {
    iniciarAplicacion();
    assert.equal(env.app.listenerCount('click'), 1);
    assert.equal(env.sgpaCallbacks.length, 1);

    await env.realizarLogin();

    assert.equal(obtenerRolActivo(), ROLES.ADMIN_GLOBAL);
    assert.ok(env.doc.querySelector('[data-module="usuarios"]'));
    assert.equal(env.win.listenerCount('hashchange'), 1);
    assert.equal(env.win.listenerCount('resize'), 1);
    assert.equal(env.doc.listenerCount('click'), 1);

    const appShellInicial = env.doc.getElementById('appShell');
    const contentInicial = env.doc.getElementById('contentArea');

    // Navegación autorizada a /carreras
    await env.doc.querySelector('[data-module="carreras"]').dispatch('click');
    await tickAsync();
    assert.equal(env.win.location.hash, '#/carreras');
    assert.equal(carrerasConsultas, 1);
    assert.equal(
      env.doc.querySelector('[data-module="carreras"]').classList.contains('active'),
      true,
    );

    // Cambiar rol activo a COORDINADOR desde Topbar
    const opcionCoord = env.doc.querySelector('[data-rol="COORDINADOR"]');
    await opcionCoord.dispatch('click');
    await tickAsync();

    // App no se reinició ni duplicó listeners, pero el menú lateral cambió
    assert.equal(obtenerRolActivo(), ROLES.COORDINADOR);
    assert.equal(env.doc.getElementById('appShell'), appShellInicial);
    assert.equal(env.doc.getElementById('contentArea'), contentInicial);
    assert.equal(env.app.listenerCount('click'), 1);
    assert.equal(env.sgpaCallbacks.length, 1);
    assert.equal(env.win.listenerCount('hashchange'), 1);
    assert.equal(env.win.listenerCount('resize'), 1);
    assert.equal(env.doc.listenerCount('click'), 1);
    assert.equal(env.doc.querySelector('[data-module="usuarios"]'), null);
    assert.equal(env.win.location.hash, '#/home');

    // Intentar navegar manualmente a /usuarios estando en COORDINADOR debe redirigir a /home
    env.win.location.hash = '#/usuarios';
    await tickAsync();
    assert.equal(env.win.location.hash, '#/home');
    assert.match(env.doc.title, /Sistema de Gestión/);

    // Clic sobre un botón con data-route="/usuarios" no autorizado tampoco debe navegar
    const botonProhibido = env.doc.createElement('button');
    botonProhibido.setAttribute('data-route', '/usuarios');
    env.doc.getElementById('contentArea').appendChild(botonProhibido);
    await botonProhibido.dispatch('click');
    await tickAsync();
    assert.equal(env.win.location.hash, '#/home');

    // Doble clic rápido en logout ejecuta cierre una sola vez
    const logoutBtn = env.doc.getElementById('logoutButton');
    await Promise.all([logoutBtn.dispatch('click'), logoutBtn.dispatch('click')]);
    await tickAsync();
    assert.equal(logoutCalls, 1);
  } finally {
    env.restaurar();
  }
});

test('App: una respuesta 401 iniciada en una sesiÃ³n anterior no cierra la sesiÃ³n nueva', async () => {
  const usuarioAnterior = {
    id: 201,
    nombres: 'Cuenta anterior',
    correo: 'anterior@una.cr',
    roles: [ROLES.ADMIN_GLOBAL],
    rolActivo: ROLES.ADMIN_GLOBAL,
    permisos: [],
  };
  const usuarioNuevo = {
    id: 202,
    nombres: 'Cuenta nueva',
    correo: 'nueva@una.cr',
    roles: [ROLES.COORDINADOR],
    rolActivo: ROLES.COORDINADOR,
    permisos: [],
  };
  let usuarioLogin = usuarioAnterior;
  let resolverPerfilAnterior;
  let resolverLogoutAnterior;

  const env = crearEntornoApp({
    login: async () => ({ ok: true, usuario: { ...usuarioLogin } }),
    obtenerPerfil: () => new Promise((resolve) => { resolverPerfilAnterior = resolve; }),
    logout: () => new Promise((resolve) => { resolverLogoutAnterior = resolve; }),
  });

  try {
    iniciarAplicacion();
    await env.realizarLogin();

    const vigilanteAnterior = env.intervalos.find((timer) => !timer.cleared);
    const verificacionAnterior = vigilanteAnterior.fn();
    assert.equal(typeof resolverPerfilAnterior, 'function');

    // Invalidar A y autenticar B antes de recibir el 401 que solicitÃ³ A.
    env.sgpaCallbacks[0]();
    usuarioLogin = usuarioNuevo;
    await env.realizarLogin(usuarioNuevo.correo, 'ClaveSoloDePrueba');
    assert.equal(obtenerUsuario().id, usuarioNuevo.id);

    resolverPerfilAnterior({ ok: false, status: 401 });
    await verificacionAnterior;

    assert.equal(obtenerUsuario().id, usuarioNuevo.id);
    assert.ok(env.doc.querySelector('[data-module="dashboard"]'));
    assert.equal(env.intervalos.filter((timer) => !timer.cleared).length, 1);

    // Un logout antiguo que termina después de una nueva autenticación tampoco
    // debe borrar la sesión que entró mientras la respuesta anterior estaba pendiente.
    await env.doc.getElementById('logoutButton').dispatch('click');
    assert.equal(typeof resolverLogoutAnterior, 'function');
    env.sgpaCallbacks[0]();
    const usuarioSiguiente = {
      ...usuarioNuevo,
      id: 203,
      nombres: 'Cuenta posterior',
      correo: 'posterior@una.cr',
    };
    usuarioLogin = usuarioSiguiente;
    await env.realizarLogin(usuarioSiguiente.correo, 'ClaveSoloDePrueba');
    resolverLogoutAnterior({ ok: true });
    await tickAsync();

    assert.equal(obtenerUsuario().id, usuarioSiguiente.id);
    assert.ok(env.doc.querySelector('[data-module="dashboard"]'));
  } finally {
    env.restaurar();
  }
});

test('App + Layout: múltiples ciclos de navegación y cambio de rol no duplican acciones', async () => {
  const usuario = {
    id: 101,
    nombres: 'Ciclo Prueba',
    correo: 'ciclo@una.cr',
    roles: [ROLES.ADMIN_GLOBAL, ROLES.COORDINADOR],
    rolActivo: ROLES.ADMIN_GLOBAL,
    permisos: [PERMISOS.CARRERAS_VER],
  };

  let carrerasConsultas = 0;

  const env = crearEntornoApp({
    login: async () => ({ ok: true, usuario: { ...usuario } }),
    cambiarRolActivo: async (rol) => ({
      ok: true,
      usuario: { ...usuario, rolActivo: rol, permisos: [PERMISOS.CARRERAS_VER] },
    }),
    listarCarreras: async () => {
      carrerasConsultas += 1;
      return { ok: true, carreras: [] };
    },
  });

  try {
    iniciarAplicacion();
    await env.realizarLogin();

    for (let i = 0; i < 4; i += 1) {
      await env.doc.querySelector('[data-module="dashboard"]').dispatch('click');
      await tickAsync();
      await env.doc.querySelector('[data-module="home"]').dispatch('click');
      await tickAsync();
      const targetRole = i % 2 === 0 ? ROLES.COORDINADOR : ROLES.ADMIN_GLOBAL;
      await env.doc.querySelector(`[data-rol="${targetRole}"]`).dispatch('click');
      await tickAsync();
    }

    assert.equal(env.win.listenerCount('resize'), 1);
    assert.equal(env.doc.listenerCount('click'), 1);
    assert.equal(env.win.listenerCount('hashchange'), 1);

    carrerasConsultas = 0;
    await env.doc.querySelector('[data-module="carreras"]').dispatch('click');
    await tickAsync();
    assert.equal(
      carrerasConsultas,
      1,
      'Un único clic tras varios ciclos debe cargar el módulo una sola vez',
    );
  } finally {
    env.restaurar();
  }
});

test('App + Layout: asistente multicarrera actualiza menú por carrera y rol sin permisos desmonta listeners', async () => {
  const carrerasDisponibles = [
    { id: 1, nombre: 'Ingeniería', permisos: [PERMISOS.CARRERAS_VER] },
    { id: 2, nombre: 'Administración', permisos: [PERMISOS.PERIODOS_VER] },
  ];
  const usuario = {
    id: 102,
    nombres: 'Asistente Multi',
    correo: 'asistente@una.cr',
    roles: [ROLES.ASISTENTE_ESTUDIANTIL, ROLES.COORDINADOR],
    rolActivo: ROLES.ASISTENTE_ESTUDIANTIL,
    carreraActiva: 1,
    carrerasDisponibles,
    permisos: carrerasDisponibles[0].permisos,
  };

  const env = crearEntornoApp({
    login: async () => ({ ok: true, usuario: { ...usuario } }),
    cambiarCarreraActiva: async (id) => ({
      ok: true,
      usuario: {
        ...usuario,
        carreraActiva: id,
        permisos: carrerasDisponibles.find((c) => c.id === id).permisos,
      },
    }),
    cambiarRolActivo: async (rol) => ({
      ok: true,
      usuario: {
        ...usuario,
        rolActivo: rol,
        carrerasDisponibles: rol === ROLES.ASISTENTE_ESTUDIANTIL ? [] : carrerasDisponibles,
        permisos: [],
      },
    }),
  });

  try {
    iniciarAplicacion();
    await env.realizarLogin();

    assert.ok(env.doc.querySelector('[data-module="carreras"]'));
    assert.equal(env.doc.querySelector('[data-module="periodos"]'), null);

    // Cambiar carrera activa desde el Topbar
    const selector = env.doc.getElementById('carreraActivaSelector');
    selector.value = '2';
    await selector.dispatch('change');
    await tickAsync();

    assert.equal(env.doc.querySelector('[data-module="carreras"]'), null);
    assert.ok(env.doc.querySelector('[data-module="periodos"]'));
    assert.equal(env.win.listenerCount('resize'), 1);

    // Cambiar a rol COORDINADOR y luego volver a ASISTENTE sin carreras -> pantallaSinPermisos
    await env.doc.querySelector('[data-rol="COORDINADOR"]').dispatch('click');
    await tickAsync();
    await env.doc.querySelector('[data-rol="ASISTENTE_ESTUDIANTIL"]').dispatch('click');
    await tickAsync();

    assert.match(env.app.innerHTML, /Acceso pendiente/);
    assert.equal(env.doc.getElementById('sidebar'), null);
    assert.equal(env.win.listenerCount('resize'), 0);
    assert.equal(env.doc.listenerCount('click'), 0);
    assert.equal(env.win.listenerCount('hashchange'), 0);
  } finally {
    env.restaurar();
  }
});

test('App + Layout: sesión caducada (push IPC y 401/desactivación) y cierre limpian listeners y regresan a login', async () => {
  const usuario = {
    id: 103,
    nombres: 'Usuario Sesión',
    correo: 'sesion@una.cr',
    roles: [ROLES.ADMIN_GLOBAL, ROLES.PROFESOR],
    rolActivo: ROLES.ADMIN_GLOBAL,
    permisos: [],
  };

  let respuestaPerfil = { ok: true, usuario: { ...usuario } };

  const env = crearEntornoApp({
    login: async () => ({ ok: true, usuario: { ...usuario } }),
    obtenerPerfil: async () => respuestaPerfil,
  });

  try {
    iniciarAplicacion();
    await env.realizarLogin();

    assert.equal(env.doc.listenerCount('click'), 1);
    assert.equal(env.win.listenerCount('resize'), 1);
    assert.equal(env.win.listenerCount('hashchange'), 1);
    assert.equal(env.intervalos.some((t) => !t.cleared), true);

    // 1. Caducidad vía evento push auth:invalidada desde Electron
    env.sgpaCallbacks[0]();
    assert.equal(obtenerUsuario(), null);
    assert.match(env.app.innerHTML, /Tu sesión cambió/);
    assert.equal(env.doc.listenerCount('click'), 0);
    assert.equal(env.win.listenerCount('resize'), 0);
    assert.equal(env.win.listenerCount('hashchange'), 0);
    assert.equal(env.intervalos.every((t) => t.cleared), true);

    // 2. Nuevo login + detección por vigilancia 401 / usuario desactivado
    await env.realizarLogin();
    const timerActivo = env.intervalos.find((t) => !t.cleared);
    assert.ok(timerActivo);

    respuestaPerfil = { ok: false, status: 401 };
    await timerActivo.fn();
    assert.equal(obtenerUsuario(), null);
    assert.match(env.app.innerHTML, /Tu sesión cambió/);
    assert.equal(env.doc.listenerCount('click'), 0);
    assert.equal(env.win.listenerCount('resize'), 0);

    // 3. Re-inicio completo de aplicación no duplica listeners en #app ni onSesionInvalidada
    iniciarAplicacion();
    assert.equal(env.app.listenerCount('click'), 1);
    assert.equal(env.sgpaCallbacks.length, 1);

    // 4. Usuario desactivado (activo === false) detectado por vigilarSesion
    respuestaPerfil = { ok: true, usuario: { ...usuario, activo: false } };
    await env.realizarLogin();
    const timerDesactivado = env.intervalos.find((t) => !t.cleared);
    await timerDesactivado.fn();
    assert.equal(obtenerUsuario(), null);
    assert.equal(env.doc.listenerCount('click'), 0);
    assert.equal(env.win.listenerCount('resize'), 0);
  } finally {
    env.restaurar();
  }
});
