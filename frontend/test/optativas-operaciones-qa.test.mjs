import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OptativasPage,
  iniciarOptativasPage,
} from '../src/pages/optativas/OptativasPage.js';
import { guardarSesion, limpiarSesion } from '../src/app/session.js';
import { ROLES, PERMISOS } from '../src/config/permissions.js';

class MockEl extends EventTarget {
  constructor(id = '', doc = null, tag = 'div') {
    super();
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.doc = doc;
    this.parentElement = null;
    this.open = false;
    this.value = '';
    this.disabled = false;
    this.textContent = '';
    this.dataset = {};
    this.elements = {};
    this.options = [];
    this._listeners = new Map();
    this._html = '';
    const cls = new Set();
    this.classList = {
      add: (...c) => c.forEach((x) => cls.add(x)),
      remove: (...c) => c.forEach((x) => cls.delete(x)),
      contains: (x) => cls.has(x),
    };
    this.attributes = new Map();
  }

  get innerHTML() {
    return this._html;
  }

  set innerHTML(html) {
    this._html = String(html || '');
    if (this.doc) this.doc.indexar(this, this._html);
  }

  getAttribute(n) {
    return this.attributes.get(n) ?? null;
  }

  setAttribute(n, v) {
    this.attributes.set(n, String(v));
  }

  removeAttribute(n) {
    this.attributes.delete(n);
  }

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  reset() {
    for (const k of Object.keys(this.elements)) {
      if (this.elements[k]) {
        this.elements[k].value = '';
        this.elements[k].disabled = false;
      }
    }
  }

  remove() {
    if (this.doc && this.id) this.doc.byId.delete(this.id);
    this.parentElement = null;
  }

  appendChild(ch) {
    ch.parentElement = this;
    if (this.doc) {
      if (ch.id) this.doc.byId.set(ch.id, ch);
      if (!this.doc.all.includes(ch)) this.doc.all.push(ch);
    }
    return ch;
  }

  getBoundingClientRect() {
    return { left: 0, right: 100, top: 0, bottom: 100 };
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(handler);
  }

  dispatchEvent(event) {
    if (!event.target) {
      Object.defineProperty(event, 'target', { value: this, writable: true, configurable: true });
    }
    const handlers = this._listeners.get(event.type) || [];
    for (const h of handlers) {
      Object.defineProperty(event, 'currentTarget', { value: this, writable: true, configurable: true });
      h.call(this, event);
    }
    if (this.parentElement && event.type !== 'submit') {
      this.parentElement.dispatchEvent(event);
    }
    return true;
  }

  closest(sel) {
    let cur = this;
    while (cur) {
      if (cur.matches(sel)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  matches(sel) {
    return sel.split(',').some((p) => {
      const s = p.trim();
      if (s.startsWith('#')) return this.id === s.slice(1);
      if (s.startsWith('.')) return this.classList.contains(s.slice(1));
      const m = s.match(/^\[([a-z-]+)(?:="([^"]*)")?\]$/);
      if (m) {
        const camel = m[1].replace(/^data-/, '').replace(/-([a-z])/g, (_, l) => l.toUpperCase());
        const val = this.dataset[camel] ?? this.getAttribute(m[1]);
        return m[2] !== undefined ? String(val) === m[2] : val !== undefined && val !== null;
      }
      return this.tagName === s.toUpperCase();
    });
  }

  querySelector(sel) {
    return this.doc?.all.find((e) => e.matches(sel) && this.contains(e)) || null;
  }

  contains(el) {
    let cur = el;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  }
}

class MockDoc {
  constructor() {
    this.byId = new Map();
    this.all = [];
    this.body = new MockEl('body', this, 'body');
  }

  createElement(tag) {
    return new MockEl('', this, tag);
  }

  getElementById(id) {
    return this.byId.get(id) || null;
  }

  querySelector(sel) {
    return this.all.find((e) => e.matches(sel)) || null;
  }

  querySelectorAll() {
    return [];
  }

  indexar(root, html) {
    this.all = this.all.filter((e) => {
      let cur = e.parentElement;
      while (cur) {
        if (cur === root) {
          if (e.id) this.byId.delete(e.id);
          return false;
        }
        cur = cur.parentElement;
      }
      return true;
    });

    const stack = [root];
    const tagRegex = /<\/?([a-zA-Z0-9-]+)([^>]*)>/g;
    let m;
    while ((m = tagRegex.exec(html)) !== null) {
      const full = m[0];
      const tag = m[1].toUpperCase();
      const attrs = m[2];
      if (full.startsWith('</')) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const idM = attrs.match(/\bid="([^"]+)"/);
      const el = new MockEl(idM?.[1] || '', this, tag);
      el.parentElement = stack[stack.length - 1];
      const clsM = attrs.match(/\bclass="([^"]+)"/);
      if (clsM) clsM[1].split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
      const dataRegex = /\bdata-([a-z-]+)="([^"]*)"/g;
      let dm;
      while ((dm = dataRegex.exec(attrs)) !== null) {
        const camel = dm[1].replace(/-([a-z])/g, (_, l) => l.toUpperCase());
        el.dataset[camel] = dm[2];
      }
      const nameM = attrs.match(/\bname="([^"]+)"/);
      if (nameM) {
        const form = stack.slice().reverse().find((p) => p.tagName === 'FORM');
        if (form) form.elements[nameM[1]] = el;
      }
      const valM = attrs.match(/\bvalue="([^"]*)"/);
      if (valM) el.value = valM[1];
      if (tag === 'OPTION') {
        const sel = stack.slice().reverse().find((p) => p.tagName === 'SELECT');
        if (sel) sel.options.push(el);
      }
      if (el.id) this.byId.set(el.id, el);
      this.all.push(el);
      if (!['INPUT', 'IMG', 'BR', 'HR'].includes(tag) && !attrs.endsWith('/')) {
        stack.push(el);
      }
    }
  }
}

function setupOptativas(rol = ROLES.COORDINADOR, permisos = [PERMISOS.OPTATIVAS_GESTIONAR]) {
  limpiarSesion();
  guardarSesion({
    usuario: { id: 1, roles: [rol], rolActivo: rol, permisos },
  });
  const doc = new MockDoc();
  globalThis.document = doc;
  globalThis.window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    sgpa: {},
  };
  const root = new MockEl('app', doc);
  root.innerHTML = OptativasPage();
  doc.body.appendChild(root);
  return doc;
}

const tick = () => new Promise((r) => setTimeout(r, 15));

test('optativas operaciones — edición de optativa existente, filtros en vivo y refresco', async () => {
  const doc = setupOptativas(ROLES.ADMIN_GLOBAL);
  const lista = [
    {
      id: 7,
      curso: { codigo: 'OPT-007', nombre: 'Astronomía', descripcion: 'Inicial' },
      tipo: 'ABIERTA',
      carreraOrigenId: null,
      activo: true,
    },
    {
      id: 8,
      curso: { codigo: 'OPT-008', nombre: 'Bases NoSQL', descripcion: '' },
      tipo: 'DISCIPLINARIA',
      carreraOrigenId: 1,
      carreraOrigen: { id: 1, nombre: 'Informática' },
      activo: false,
    },
  ];

  let actualizado = null;
  globalThis.window.sgpa = {
    listarOptativas: async () => ({ ok: true, optativas: lista }),
    listarCarrerasElegiblesOptativa: async () => ({
      ok: true,
      carreras: [{ id: 1, nombre: 'Informática' }],
    }),
    actualizarOptativa: async (id, datos) => {
      actualizado = { id, datos };
      lista[0].curso.descripcion = datos.descripcion;
      return { ok: true };
    },
  };

  iniciarOptativasPage();
  await tick();

  // Filtrar por categoría y estado
  const selTipo = doc.getElementById('tipoOptativaFiltro');
  selTipo.value = 'DISCIPLINARIA';
  selTipo.dispatchEvent(new Event('change', { bubbles: true }));
  assert.match(doc.getElementById('optativasResultado').innerHTML, /Bases NoSQL/);
  assert.doesNotMatch(doc.getElementById('optativasResultado').innerHTML, /Astronomía/);

  selTipo.value = '';
  selTipo.dispatchEvent(new Event('change', { bubbles: true }));

  const buscar = doc.getElementById('buscarOptativa');
  buscar.value = 'astro';
  buscar.dispatchEvent(new Event('input', { bubbles: true }));
  assert.match(doc.getElementById('optativasResultado').innerHTML, /Astronomía/);
  assert.doesNotMatch(doc.getElementById('optativasResultado').innerHTML, /Bases NoSQL/);

  // Editar optativa 7
  const btnEditar = doc.querySelector('[data-editar-optativa="7"]');
  btnEditar.dispatchEvent(new Event('click', { bubbles: true }));
  const form = doc.getElementById('optativaForm');
  assert.equal(form.elements.codigo.disabled, true);
  assert.equal(form.elements.nombre.disabled, true);

  form.elements.descripcion.value = 'Descripción actualizada';
  form.dispatchEvent(new Event('submit'));
  await tick();

  assert.deepEqual(actualizado, {
    id: 7,
    datos: { tipo: 'ABIERTA', carreraOrigenId: null, descripcion: 'Descripción actualizada' },
  });
  assert.equal(doc.getElementById('optativaDialog').open, false);
  limpiarSesion();
});

test('optativas operaciones — asistente propone cambios y descarta cargas obsoletas', async () => {
  const doc = setupOptativas(ROLES.ASISTENTE_ESTUDIANTIL);
  let propuestaCreada = null;
  let propuestaEstado = null;
  let resolverPrimera;

  let llamadasLista = 0;
  globalThis.window.sgpa = {
    listarOptativas: async () => {
      llamadasLista += 1;
      if (llamadasLista === 1) {
        return new Promise((r) => {
          resolverPrimera = r;
        });
      }
      return {
        ok: true,
        optativas: [
          {
            id: 21,
            curso: { codigo: 'OPT-21', nombre: 'Vigente' },
            tipo: 'DISCIPLINARIA',
            carreraOrigenId: 2,
            activo: true,
          },
        ],
      };
    },
    listarCarrerasElegiblesOptativa: async () => ({
      ok: true,
      carreras: [{ id: 2, nombre: 'Administración' }],
    }),
    proponerCrearOptativa: async (datos) => {
      propuestaCreada = datos;
      return { ok: true };
    },
    proponerEstadoOptativa: async (id, activo) => {
      propuestaEstado = { id, activo };
      return { ok: true };
    },
  };

  iniciarOptativasPage();
  // Reiniciar instancia antes de que resuelva la primera consulta
  iniciarOptativasPage();
  await tick();

  // Resolver la primera consulta obsoleta con datos distintos
  resolverPrimera({
    ok: true,
    optativas: [
      { id: 99, curso: { codigo: 'OBS', nombre: 'Obsoleta' }, tipo: 'DISCIPLINARIA', activo: true },
    ],
  });
  await tick();

  const html = doc.getElementById('optativasResultado').innerHTML;
  assert.match(html, /Vigente/);
  assert.doesNotMatch(html, /Obsoleta/);

  // Proponer creación
  doc.getElementById('nuevaOptativa').dispatchEvent(new Event('click', { bubbles: true }));
  const form = doc.getElementById('optativaForm');
  form.elements.codigo.value = 'opt-88';
  form.elements.nombre.value = 'Gestión Pública';
  form.elements.tipo.value = 'DISCIPLINARIA';
  form.elements.carreraOrigenId.value = '2';
  form.dispatchEvent(new Event('submit'));
  await tick();

  assert.equal(propuestaCreada.codigo, 'OPT-88');

  // Proponer desactivación
  doc.querySelector('[data-estado-optativa="21"]').dispatchEvent(new Event('click', { bubbles: true }));
  await tick();
  doc.getElementById('sgpaConfirmAccept').dispatchEvent(new Event('click'));
  await tick();
  assert.deepEqual(propuestaEstado, { id: 21, activo: false });

  limpiarSesion();
});

test('optativas operaciones — errores en carga y guardado informan al usuario sin cerrar diálogo', async () => {
  const doc = setupOptativas(ROLES.COORDINADOR);
  globalThis.window.sgpa = {
    listarOptativas: async () => ({ ok: false, message: 'Error de red en optativas' }),
    listarCarrerasElegiblesOptativa: async () => ({
      ok: true,
      carreras: [{ id: 1, nombre: 'Informática' }],
    }),
    crearOptativa: async () => ({ ok: false, message: 'Código duplicado' }),
  };

  iniciarOptativasPage();
  await tick();
  assert.match(doc.getElementById('optativasResultado').textContent, /Error de red en optativas/);

  doc.getElementById('nuevaOptativa').dispatchEvent(new Event('click', { bubbles: true }));
  const form = doc.getElementById('optativaForm');
  form.elements.codigo.value = 'OPT-DUP';
  form.elements.nombre.value = 'Duplicada';
  form.elements.tipo.value = 'DISCIPLINARIA';
  form.elements.carreraOrigenId.value = '1';
  form.dispatchEvent(new Event('submit'));
  await tick();

  assert.equal(doc.getElementById('optativaDialog').open, true);
  assert.match(doc.getElementById('sgpaAlertDialog').innerHTML, /Código duplicado/);
  limpiarSesion();
});
