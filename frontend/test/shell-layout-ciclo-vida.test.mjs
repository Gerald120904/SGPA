import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Sidebar,
  iniciarSidebar,
  esViewportCompacto,
  BREAKPOINT_SIDEBAR_COMPACTO,
} from '../src/components/Sidebar.js';
import { Topbar, iniciarTopbar } from '../src/components/Topbar.js';
import {
  SelectorRolActivo,
  iniciarSelectorRol,
  obtenerIconoRol,
} from '../src/components/RoleSelector.js';
import { AppLayout, montarAppLayout } from '../src/layouts/AppLayout.js';
import {
  cambiarCarreraActiva,
  cambiarRolActivo,
  guardarSesion,
  obtenerUsuario,
  limpiarSesion,
} from '../src/app/session.js';
import { crearGestorEventos } from '../src/utils/event-lifecycle.js';
import { ROLES, PERMISOS } from '../src/config/permissions.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(testDir, '../src');

test('crearGestorEventos: fallback legacy elimina listener y destruir es idempotente', () => {
  const argumentosAdd = [];
  let listenerRegistrado = null;
  let capturaEliminada = null;
  const target = {
    addEventListener(_tipo, listener, options) {
      argumentosAdd.push(options);
      if (options && typeof options === 'object') {
        throw new TypeError('AbortSignal no soportado');
      }
      listenerRegistrado = listener;
    },
    removeEventListener(_tipo, listener, capture) {
      assert.equal(listener, listenerRegistrado);
      capturaEliminada = capture;
      listenerRegistrado = null;
    },
  };
  const gestor = crearGestorEventos();
  let llamadas = 0;

  gestor.escuchar(target, 'click', () => { llamadas += 1; }, { capture: true });
  assert.equal(argumentosAdd.length, 2);
  assert.equal(typeof argumentosAdd[0], 'object');
  assert.equal(argumentosAdd[1], true);
  listenerRegistrado({ type: 'click' });
  assert.equal(llamadas, 1);

  gestor.destruir();
  gestor.destruir();
  assert.equal(capturaEliminada, true);
  assert.equal(listenerRegistrado, null);
  assert.equal(gestor.destruido, true);
});

test('session: una respuesta de cambio de contexto obsoleta no reemplaza otra sesion', async () => {
  const windowAnterior = globalThis.window;
  const usuarioAnterior = {
    id: 900,
    roles: [ROLES.PROFESOR, ROLES.COORDINADOR],
    rolActivo: ROLES.PROFESOR,
  };
  const usuarioNuevo = {
    id: 901,
    roles: [ROLES.ADMIN_GLOBAL],
    rolActivo: ROLES.ADMIN_GLOBAL,
  };
  let resolverRol;
  let resolverCarrera;
  globalThis.window = {
    sgpa: {
      cambiarRolActivo: () => new Promise((resolve) => { resolverRol = resolve; }),
      cambiarCarreraActiva: () => new Promise((resolve) => { resolverCarrera = resolve; }),
    },
  };

  try {
    guardarSesion({ usuario: usuarioAnterior });
    const cambioRolAntiguo = cambiarRolActivo(ROLES.COORDINADOR);
    await Promise.resolve();
    limpiarSesion();
    guardarSesion({ usuario: usuarioNuevo });
    resolverRol({ ok: true, usuario: { ...usuarioAnterior, rolActivo: ROLES.COORDINADOR } });
    assert.equal(await cambioRolAntiguo, false);
    assert.equal(obtenerUsuario(), usuarioNuevo);

    const cambioCarreraAntiguo = cambiarCarreraActiva(2);
    await Promise.resolve();
    const usuarioSiguiente = {
      id: 902,
      roles: [ROLES.COORDINADOR],
      rolActivo: ROLES.COORDINADOR,
    };
    guardarSesion({ usuario: usuarioSiguiente });
    resolverCarrera({ ok: true, usuario: { ...usuarioNuevo, carreraActiva: 2 } });
    await assert.rejects(cambioCarreraAntiguo, /La sesión cambió/);
    assert.equal(obtenerUsuario(), usuarioSiguiente);
  } finally {
    limpiarSesion();
    if (windowAnterior === undefined) delete globalThis.window;
    else globalThis.window = windowAnterior;
  }
});

test('crearGestorEventos: usa fallback booleano y destruye listeners de forma idempotente', () => {
  const argumentosAdd = [];
  let listenerRegistrado = null;
  let capturaEliminada = null;
  const target = {
    addEventListener(_tipo, listener, options) {
      argumentosAdd.push(options);
      if (options && typeof options === 'object') {
        throw new TypeError('AbortSignal no soportado');
      }
      listenerRegistrado = listener;
    },
    removeEventListener(_tipo, listener, capture) {
      assert.equal(listener, listenerRegistrado);
      capturaEliminada = capture;
      listenerRegistrado = null;
    },
  };
  const gestor = crearGestorEventos();
  let llamadas = 0;

  gestor.escuchar(target, 'click', () => { llamadas += 1; }, { capture: true });
  assert.equal(argumentosAdd.length, 2);
  assert.equal(typeof argumentosAdd[0], 'object');
  assert.equal(argumentosAdd[1], true);
  listenerRegistrado({ type: 'click' });
  assert.equal(llamadas, 1);

  gestor.destruir();
  gestor.destruir();
  assert.equal(capturaEliminada, true);
  assert.equal(listenerRegistrado, null);
  assert.equal(gestor.destruido, true);
});

test('session: respuestas de rol y carrera de una sesiÃ³n reemplazada no la sobrescriben', async () => {
  const windowAnterior = globalThis.window;
  const usuarioAnterior = {
    id: 900,
    roles: [ROLES.PROFESOR, ROLES.COORDINADOR],
    rolActivo: ROLES.PROFESOR,
  };
  const usuarioNuevo = {
    id: 901,
    roles: [ROLES.ADMIN_GLOBAL],
    rolActivo: ROLES.ADMIN_GLOBAL,
  };
  let resolverRol;
  let resolverCarrera;
  globalThis.window = {
    sgpa: {
      cambiarRolActivo: () => new Promise((resolve) => { resolverRol = resolve; }),
      cambiarCarreraActiva: () => new Promise((resolve) => { resolverCarrera = resolve; }),
    },
  };

  try {
    guardarSesion({ usuario: usuarioAnterior });
    const cambioRolAntiguo = cambiarRolActivo(ROLES.COORDINADOR);
    await Promise.resolve();
    limpiarSesion();
    guardarSesion({ usuario: usuarioNuevo });
    resolverRol({ ok: true, usuario: { ...usuarioAnterior, rolActivo: ROLES.COORDINADOR } });
    assert.equal(await cambioRolAntiguo, false);
    assert.equal(obtenerUsuario(), usuarioNuevo);

    const cambioCarreraAntiguo = cambiarCarreraActiva(2);
    await Promise.resolve();
    const usuarioSiguiente = { id: 902, roles: [ROLES.COORDINADOR], rolActivo: ROLES.COORDINADOR };
    guardarSesion({ usuario: usuarioSiguiente });
    resolverCarrera({ ok: true, usuario: { ...usuarioNuevo, carreraActiva: 2 } });
    await assert.rejects(cambioCarreraAntiguo, /durante la operaci/);
    assert.equal(obtenerUsuario(), usuarioSiguiente);
  } finally {
    limpiarSesion();
    if (windowAnterior === undefined) delete globalThis.window;
    else globalThis.window = windowAnterior;
  }
});

/* =========================================================
   ENTORNO DOM SIMULADO CON REGISTRO DE LISTENERS Y OUTERHTML
   ========================================================= */

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
    this.value = '';
    this.textContent = '';
    this.style = {};
    this._classSet = new Set();
    this._listeners = new Map();
    this._innerHTML = '';
    this._focused = false;
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
      const fragment = parseHtmlNodes(this._innerHTML, this.doc);
      for (const node of fragment) {
        this.appendChild(node);
      }
    }
    this.doc?._reindex?.();
  }

  get outerHTML() {
    const attrs = [];
    if (this.id) attrs.push(`id="${this.id}"`);
    if (this.className) attrs.push(`class="${this.className}"`);
    return `<${this.tagName.toLowerCase()} ${attrs.join(' ')}>${this._innerHTML}</${this.tagName.toLowerCase()}>`;
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

  appendChild(child) {
    child.parentElement = this;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...nodes) {
    nodes.forEach((n) => this.appendChild(n));
  }

  replaceWith(node) {
    const parent = this.parentElement;
    if (!parent || !node) return;
    const idx = parent.children.indexOf(this);
    if (idx >= 0) {
      parent.children.splice(idx, 1, node);
      node.parentElement = parent;
      node.parentNode = parent;
    }
  }

  setAttribute(name, val) {
    const str = String(val);
    this.attributes.set(name, str);
    if (name === 'id') this.id = str;
    if (name === 'class') this.className = str;
    if (name === 'value') this.value = str;
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
    this._focused = true;
    if (this.doc) this.doc.activeElement = this;
  }

  contains(target) {
    if (!target) return false;
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
      const list = [...(cur._listeners.get(type) || [])];
      for (const fn of list) {
        await fn(event);
      }
      if (event._stopped) break;
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
  if (s === '.nav-item[data-route]') {
    return el.classList.contains('nav-item') && Boolean(el.dataset?.route);
  }
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

    if (!selfClosing) {
      stack.push(node);
    }
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

  createElementNS(_ns, tag) {
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

  async dispatch(type, data = {}) {
    const event = {
      type,
      target: data.target || this.body,
      preventDefault() {},
      stopPropagation() {},
      ...data,
    };
    for (const fn of [...(this._listeners.get(type) || [])]) {
      await fn(event);
    }
  }
}

class SimWindow {
  constructor({ innerWidth = 1280, sgpa = {} } = {}) {
    this.innerWidth = innerWidth;
    this.sgpa = sgpa;
    this._listeners = new Map();
    this.location = { pathname: '/', search: '', hash: '' };
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
    const event = { type, ...data };
    for (const fn of [...(this._listeners.get(type) || [])]) {
      await fn(event);
    }
  }
}

function crearEntorno({ innerWidth = 1280, sgpa = {} } = {}) {
  const doc = new SimDocument();
  const win = new SimWindow({ innerWidth, sgpa });
  const app = doc.createElement('div');
  app.id = 'app';
  doc.body.appendChild(app);
  doc._reindex();

  const storage = new Map();
  globalThis.document = doc;
  globalThis.window = win;
  globalThis.localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };

  return { doc, win, app, storage };
}

/* =========================================================
   1. ANÁLISIS ESTÁTICO DE DEPENDENCIAS Y CICLOS
   ========================================================= */

test('arquitectura shell: ausencia total de ciclos de importación y Topbar desacoplado de Sidebar', () => {
  const graph = new Map();
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.js')) {
        const rel = path.relative(srcDir, full).replace(/\\/g, '/');
        const txt = fs.readFileSync(full, 'utf8');
        const deps = [];
        for (const m of txt.matchAll(/(?:import|export)[\s\S]*?from\s+['"](\.[^'"]+)['"]/g)) {
          const target = path
            .relative(srcDir, path.resolve(path.dirname(full), m[1]))
            .replace(/\\/g, '/');
          deps.push(target);
        }
        graph.set(rel, deps);
      }
    }
  }
  walk(srcDir);

  const state = new Map();
  const cycles = [];
  function dfs(node, stack) {
    state.set(node, 1);
    for (const dep of graph.get(node) || []) {
      if (state.get(dep) === 1) {
        cycles.push([...stack.slice(stack.indexOf(dep)), dep].join(' -> '));
      } else if (!state.get(dep)) {
        dfs(dep, [...stack, dep]);
      }
    }
    state.set(node, 2);
  }
  for (const node of graph.keys()) {
    if (!state.get(node)) dfs(node, [node]);
  }

  assert.deepEqual(cycles, [], `Se detectaron ciclos de importación: ${cycles.join('; ')}`);

  // Verificar que Topbar NO depende de Sidebar directa ni transitivamente
  const topbarDeps = graph.get('components/Topbar.js') || [];
  assert.equal(topbarDeps.includes('components/Sidebar.js'), false);
  assert.equal(topbarDeps.includes('components/RoleSelector.js'), true);

  const visited = new Set();
  const stack = [...topbarDeps];
  while (stack.length > 0) {
    const dep = stack.pop();
    if (visited.has(dep)) continue;
    visited.add(dep);
    for (const next of graph.get(dep) || []) {
      stack.push(next);
    }
  }
  assert.equal(
    visited.has('components/Sidebar.js'),
    false,
    'Topbar no debe depender ni transitivamente de Sidebar',
  );
});

/* =========================================================
   2. SIDEBAR: MONTAJE REPETIDO, UN SOLO LISTENER Y LIMPIEZA
   ========================================================= */

test('Sidebar: montaje y desmontaje repetido mantiene 1 listener global y limpia al desmontar', async () => {
  const { doc, win, app } = crearEntorno({ innerWidth: 1200 });
  const usuario = {
    id: 1,
    nombres: 'Gerald',
    correo: 'gerald@una.cr',
    roles: [ROLES.ADMIN_GLOBAL, ROLES.COORDINADOR],
    rolActivo: ROLES.ADMIN_GLOBAL,
    permisos: [],
  };
  guardarSesion({ usuario });

  let ultimaInstancia = null;
  for (let i = 0; i < 6; i += 1) {
    app.innerHTML = AppLayout({
      usuario,
      roles: [ROLES.ADMIN_GLOBAL],
      permisos: [],
    });
    ultimaInstancia = iniciarSidebar({ onCambiarRol: async () => {} });
    assert.equal(doc.listenerCount('click'), 1, `Ciclo ${i}: document.click debe ser 1`);
    assert.equal(win.listenerCount('resize'), 1, `Ciclo ${i}: window.resize debe ser 1`);
  }

  // En modo AppLayout coordinado (sin duplicar resize), solo debe existir exactamente 1 resize en window
  ultimaInstancia.destruir();
  assert.equal(doc.listenerCount('click'), 0);
  assert.equal(win.listenerCount('resize'), 0);

  // Referencias destruidas no reaccionan si se vuelve a disparar evento en el DOM anterior
  const menuAnterior = doc.getElementById('menuRolesFlotante');
  const btnAnterior = doc.getElementById('btnRolActivoExpanded');
  await btnAnterior.dispatch('click');
  assert.equal(menuAnterior.hasAttribute('hidden'), true);

  limpiarSesion();
});

/* =========================================================
   3. SIDEBAR: EXPANSIÓN, CONTRACCIÓN Y RESPONSIVE
   ========================================================= */

test('Sidebar: controla expansión/contracción sincronizada y responde a viewport responsive', async () => {
  const { doc, win, app, storage } = crearEntorno({ innerWidth: 1280 });
  const usuario = {
    id: 2,
    nombres: 'Ana',
    roles: [ROLES.COORDINADOR],
    rolActivo: ROLES.COORDINADOR,
    permisos: [PERMISOS.ESTUDIANTES_VER],
  };

  app.innerHTML = Sidebar({
    usuario,
    roles: [ROLES.COORDINADOR],
    permisos: usuario.permisos,
    rutaActiva: '/estudiantes',
    isCollapsed: true,
  });

  // Wrapping mínimo con appShell para probar sincronización de clases y dataset
  const wrapper = doc.createElement('main');
  wrapper.id = 'appShell';
  wrapper.classList.add('sidebar-collapsed');
  const sidebarEl = doc.getElementById('sidebar');
  wrapper.appendChild(sidebarEl);
  app.innerHTML = '';
  app.appendChild(wrapper);
  doc._reindex();

  const eventosEstado = [];
  const ctrl = iniciarSidebar({
    gestionarSelectorRol: false,
    rutaActiva: 'estudiantes',
    onCambioEstado: (e) => eventosEstado.push(e),
  });

  assert.equal(wrapper.classList.contains('sidebar-collapsed'), false);
  assert.equal(sidebarEl.classList.contains('collapsed'), false);
  assert.equal(storage.get('sgpa_sidebar_collapsed'), 'false');
  assert.equal(esViewportCompacto(1280), false);
  assert.equal(esViewportCompacto(BREAKPOINT_SIDEBAR_COMPACTO), true);
  assert.equal(sidebarEl.dataset.viewportCompacto, 'false');

  // Expansión y contracción por hover
  await sidebarEl.dispatch('mouseenter');
  assert.equal(ctrl.obtenerEstado().expandido, true);
  assert.equal(sidebarEl.dataset.sidebarExpanded, 'true');

  await sidebarEl.dispatch('mouseleave');
  assert.equal(ctrl.obtenerEstado().expandido, false);
  assert.equal(sidebarEl.dataset.sidebarExpanded, 'false');

  // Cambio responsive a <= 900px
  win.innerWidth = 760;
  await win.dispatch('resize');
  assert.equal(ctrl.obtenerEstado().viewportCompacto, true);
  assert.equal(sidebarEl.dataset.viewportCompacto, 'true');

  // Sincronización explícita de estado colapsado entre #appShell y #sidebar
  ctrl.establecerColapsado(true);
  assert.equal(wrapper.classList.contains('sidebar-collapsed'), true);
  assert.equal(sidebarEl.classList.contains('collapsed'), true);
  ctrl.establecerExpandido(true);
  assert.equal(wrapper.classList.contains('sidebar-collapsed'), false);
  assert.equal(sidebarEl.classList.contains('collapsed'), false);
  assert.equal(ctrl.obtenerEstado().expandido, true);

  assert.ok(eventosEstado.length >= 4);
  ctrl.destruir();
  assert.equal(win.listenerCount('resize'), 0);
});

/* =========================================================
   4. TOPBAR + ROLESECTOR: MENÚ FLOTANTE, TECLADO Y CARRERA
   ========================================================= */

test('Topbar + RoleSelector: apertura/cierre por clic fuera, Tab/Escape y cambio de carrera con rollback', async () => {
  const carrerasDisponibles = [
    { id: 1, nombre: 'Ingeniería', permisos: [PERMISOS.ESTUDIANTES_VER] },
    { id: 2, nombre: 'Administración', permisos: [PERMISOS.CURSOS_VER] },
  ];
  const usuario = {
    id: 3,
    nombres: 'Asistente Dual',
    roles: [ROLES.ASISTENTE_ESTUDIANTIL, ROLES.PROFESOR],
    rolActivo: ROLES.ASISTENTE_ESTUDIANTIL,
    carreraActiva: 1,
    carrerasDisponibles,
    permisos: carrerasDisponibles[0].permisos,
  };
  guardarSesion({ usuario });

  let modoBackend = 'ok';
  const { doc, win, app } = crearEntorno({
    innerWidth: 1100,
    sgpa: {
      cambiarCarreraActiva: async (id) => {
        if (modoBackend === 'error') {
          return { ok: false, message: 'Carrera no autorizada' };
        }
        return {
          ok: true,
          usuario: {
            ...usuario,
            carreraActiva: id,
            permisos: carrerasDisponibles.find((c) => c.id === id).permisos,
          },
        };
      },
    },
  });

  app.innerHTML = Topbar({ usuario });
  const errores = [];
  let carreraNotificada = null;

  const ctrl = iniciarTopbar({
    usuario,
    container: app,
    onCambiarCarrera: async (u) => {
      carreraNotificada = u.carreraActiva;
    },
    onError: (msg) => errores.push(msg),
  });

  const btnExpanded = doc.getElementById('btnRolActivoExpanded');
  const menu = doc.getElementById('menuRolesFlotante');
  const selectCarrera = doc.getElementById('carreraActivaSelector');

  // Abrir con ArrowDown y cerrar con clic fuera en document
  await btnExpanded.dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(menu.hasAttribute('hidden'), false);
  await win.dispatch('resize');
  assert.equal(menu.style.position, 'absolute');

  await doc.dispatch('click', { target: app });
  assert.equal(menu.hasAttribute('hidden'), true);

  // Abrir con click y cerrar con Tab
  await btnExpanded.dispatch('click');
  assert.equal(menu.hasAttribute('hidden'), false);
  await menu.dispatch('keydown', { key: 'Tab' });
  assert.equal(menu.hasAttribute('hidden'), true);

  // Cambio de carrera exitoso y error con rollback
  selectCarrera.value = '2';
  await selectCarrera.dispatch('change');
  assert.equal(carreraNotificada, 2);

  modoBackend = 'error';
  selectCarrera.value = '1';
  await selectCarrera.dispatch('change');
  assert.equal(errores.length, 1);
  assert.match(errores[0], /Carrera no autorizada/);
  assert.equal(selectCarrera.disabled, false);
  assert.equal(selectCarrera.value, '2');

  ctrl.destruir();
  assert.equal(doc.listenerCount('click'), 0);
  assert.equal(win.listenerCount('resize'), 0);
  limpiarSesion();
});

/* =========================================================
   5. APPLAYOUT: COORDINACIÓN ÚNICA Y ACTUALIZACIÓN SIN FUGAS
   ========================================================= */

test('AppLayout: coordina Sidebar y Topbar con 1 listener global y actualiza menú in-place', async () => {
  const { doc, win, app } = crearEntorno({ innerWidth: 1200 });
  const usuarioAdmin = {
    id: 10,
    nombres: 'Admin Multi',
    correo: 'multi@una.cr',
    roles: [ROLES.ADMIN_GLOBAL, ROLES.COORDINADOR],
    rolActivo: ROLES.ADMIN_GLOBAL,
    permisos: [PERMISOS.ESTUDIANTES_VER, PERMISOS.PERIODOS_VER],
  };
  guardarSesion({ usuario: usuarioAdmin });

  const navegaciones = [];
  let cierres = 0;

  const layout = montarAppLayout(app, {
    usuario: usuarioAdmin,
    rutaActiva: '/usuarios',
    onNavegar: (route) => navegaciones.push(route),
    onCerrarSesion: () => {
      cierres += 1;
    },
  });

  // Un solo listener global por evento compartido en todo el shell
  assert.equal(win.listenerCount('resize'), 1);
  assert.equal(doc.listenerCount('click'), 1);

  const contentAntes = doc.getElementById('contentArea');
  assert.ok(doc.querySelector('[data-module="usuarios"]'));
  assert.equal(
    doc.querySelector('[data-module="usuarios"]').classList.contains('active'),
    true,
  );

  // Sincronización de ruta activa
  layout.sincronizarRuta('estudiantes');
  assert.equal(
    doc.querySelector('[data-module="estudiantes"]').classList.contains('active'),
    true,
  );
  assert.equal(
    doc.querySelector('[data-module="estudiantes"]').getAttribute('aria-current'),
    'page',
  );
  assert.equal(
    doc.querySelector('[data-module="usuarios"]').classList.contains('active'),
    false,
  );

  // Clic de navegación desde Sidebar y logout desde Sidebar
  await doc.querySelector('[data-module="periodos"]').dispatch('click');
  await doc.getElementById('logoutButton').dispatch('click');
  assert.deepEqual(navegaciones, ['/periodos']);
  assert.equal(cierres, 1);

  // Actualización al cambiar rol a COORDINADOR sin destruir #contentArea ni multiplicar listeners
  const usuarioCoord = { ...usuarioAdmin, rolActivo: ROLES.COORDINADOR };
  guardarSesion({ usuario: usuarioCoord });
  layout.actualizar({ usuario: usuarioCoord, rutaActiva: '/home' });

  const contentDespues = doc.getElementById('contentArea');
  assert.equal(contentAntes, contentDespues, 'El contenedor #contentArea debe preservarse');
  assert.equal(doc.querySelector('[data-module="usuarios"]'), null);
  assert.ok(doc.querySelector('[data-module="estudiantes"]'));
  assert.equal(win.listenerCount('resize'), 1);
  assert.equal(doc.listenerCount('click'), 1);
  assert.equal(
    doc.getElementById('sidebarRoleContainer').dataset.rolActivo,
    ROLES.COORDINADOR,
  );

  // Desmontaje total
  layout.desmontar();
  assert.equal(layout.obtenerEstado().desmontado, true);
  assert.equal(win.listenerCount('resize'), 0);
  assert.equal(doc.listenerCount('click'), 0);
  limpiarSesion();
});

test('RoleSelector: mantiene obtenerIconoRol consistente', () => {
  assert.equal(obtenerIconoRol('ADMIN_GLOBAL'), 'shield-check');
  assert.equal(obtenerIconoRol('COORDINADOR'), 'briefcase');
  assert.equal(obtenerIconoRol('PROFESOR'), 'graduation-cap');
  assert.equal(obtenerIconoRol('OTRO'), 'user-cog');
  const singleHtml = SelectorRolActivo({
    usuario: { nombres: 'Uno', roles: ['PROFESOR'], rolActivo: 'PROFESOR' },
  });
  assert.match(singleHtml, /is-single/);
});

test('RoleSelector: respuesta posterior al desmontaje no cambia la sesion activa', async () => {
  const globals = {
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
  };
  const usuario = {
    id: 44,
    nombres: 'Rol pendiente',
    roles: [ROLES.ASISTENTE_ESTUDIANTIL, ROLES.COORDINADOR],
    rolActivo: ROLES.ASISTENTE_ESTUDIANTIL,
    carreraActiva: 1,
    carrerasDisponibles: [
      { id: 1, nombre: 'Carrera Uno', permisos: [PERMISOS.ESTUDIANTES_VER] },
      { id: 2, nombre: 'Carrera Dos', permisos: [PERMISOS.CURSOS_VER] },
    ],
    permisos: [PERMISOS.ESTUDIANTES_VER],
  };
  let resolverCambio;
  let resolverCarrera;
  let controlCarrera = null;
  const env = crearEntorno({
    sgpa: {
      cambiarRolActivo: () => new Promise((resolve) => { resolverCambio = resolve; }),
      cambiarCarreraActiva: () => new Promise((resolve) => { resolverCarrera = resolve; }),
    },
  });
  guardarSesion({ usuario });

  const contenedor = env.doc.createElement('div');
  contenedor.innerHTML = Topbar({ usuario });
  env.app.appendChild(contenedor);
  env.doc._reindex();
  const control = iniciarTopbar({ usuario, container: contenedor });

  try {
    const opcion = env.doc.querySelector('[data-rol="COORDINADOR"]');
    const seleccion = opcion.dispatch('click');
    await Promise.resolve();
    assert.equal(typeof resolverCambio, 'function');

    control.destruir();
    resolverCambio({
      ok: true,
      usuario: { ...usuario, rolActivo: ROLES.COORDINADOR },
    });
    await seleccion;

    assert.equal(obtenerUsuario(), usuario);

    contenedor.innerHTML = Topbar({ usuario });
    env.doc._reindex();
    controlCarrera = iniciarTopbar({ usuario, container: contenedor });
    const selectorCarrera = env.doc.getElementById('carreraActivaSelector');
    selectorCarrera.value = '2';
    const seleccionCarrera = selectorCarrera.dispatch('change');
    await Promise.resolve();
    assert.equal(typeof resolverCarrera, 'function');

    controlCarrera.destruir();
    resolverCarrera({
      ok: true,
      usuario: { ...usuario, carreraActiva: 2, permisos: [PERMISOS.CURSOS_VER] },
    });
    await seleccionCarrera;
    assert.equal(obtenerUsuario(), usuario);
  } finally {
    controlCarrera?.destruir();
    control.destruir();
    limpiarSesion();
    if (globals.window === undefined) delete globalThis.window;
    else globalThis.window = globals.window;
    if (globals.document === undefined) delete globalThis.document;
    else globalThis.document = globals.document;
    if (globals.localStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = globals.localStorage;
  }
});
