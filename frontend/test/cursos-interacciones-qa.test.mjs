import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CursosPage,
  iniciarCursosPage,
} from '../src/pages/cursos/CursosPage.js';
import { abrirRequisitosCurso } from '../src/pages/cursos/CursoRequisitosDialog.js';
import { abrirFormularioCurso } from '../src/pages/cursos/CursoForm.js';
import { guardarSesion, limpiarSesion } from '../src/app/session.js';
import { ROLES, PERMISOS } from '../src/config/permissions.js';

/* =========================================================
   MOCK DOM ENVIRONMENT COMPATIBLE CON LUCIDE Y SGPA
   ========================================================= */

class MockElement extends EventTarget {
  constructor(id = '', doc = null, tag = 'div') {
    super();
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.doc = doc;
    this.parentElement = null;
    this.open = false;
    this.value = '';
    this.dataset = {};
    const classes = new Set();
    this.classList = {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      contains: (x) => classes.has(x),
    };
    this.attributes = new Map();
    this.disabled = false;
    this.textContent = '';
    this._listeners = new Map();
    this._html = '';
  }

  get innerHTML() {
    return this._html;
  }

  set innerHTML(html) {
    this._html = html;
    if (this.doc) {
      this.doc.indexarElementos(this, html);
    }
  }

  getAttribute(name) {
    if (this.attributes.has(name)) return this.attributes.get(name);
    if (name.startsWith('data-')) {
      const camel = name.replace(/^data-/, '').replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      if (this.dataset[camel] !== undefined) return String(this.dataset[camel]);
    }
    return null;
  }

  setAttribute(name, val) {
    this.attributes.set(name, String(val));
    if (name.startsWith('data-')) {
      const camel = name.replace(/^data-/, '').replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      this.dataset[camel] = String(val);
    }
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith('data-')) {
      const camel = name.replace(/^data-/, '').replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      delete this.dataset[camel];
    }
  }

  appendChild(child) {
    child.parentElement = this;
    if (this.doc && !this.doc.elementosDinamicos.includes(child)) {
      this.doc.elementosDinamicos.push(child);
      if (child.id) this.doc.elementosFijos.set(child.id, child);
    }
    return child;
  }

  replaceWith(newEl) {
    if (this.parentElement && this.doc) {
      newEl.parentElement = this.parentElement;
      const idx = this.doc.elementosDinamicos.indexOf(this);
      if (idx !== -1) {
        this.doc.elementosDinamicos[idx] = newEl;
      }
    }
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    this._listeners.get(type).push(handler);
    super.addEventListener(type, handler);
  }

  dispatchEvent(event) {
    if (!event.target) {
      Object.defineProperty(event, 'target', { value: this, writable: true, configurable: true });
    }
    const handlers = this._listeners.get(event.type) || [];
    for (const h of handlers) {
      try {
        h.call(this, event);
      } catch (err) {
        console.error('Handler error:', err);
      }
    }
    if (this.parentElement) {
      this.parentElement.dispatchEvent(event);
    }
    return true;
  }

  click() {
    const evt = new Event('click', { bubbles: true });
    Object.defineProperty(evt, 'target', { value: this, writable: true, configurable: true });
    this.dispatchEvent(evt);
  }

  change(val) {
    if (val !== undefined) this.value = String(val);
    const evt = new Event('change', { bubbles: true });
    Object.defineProperty(evt, 'target', { value: this, writable: true, configurable: true });
    this.dispatchEvent(evt);
  }

  input(val) {
    if (val !== undefined) this.value = String(val);
    const evt = new Event('input', { bubbles: true });
    Object.defineProperty(evt, 'target', { value: this, writable: true, configurable: true });
    this.dispatchEvent(evt);
  }

  submit() {
    const evt = new Event('submit', { bubbles: true });
    Object.defineProperty(evt, 'target', { value: this, writable: true, configurable: true });
    this.dispatchEvent(evt);
  }

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  scrollIntoView() {}

  closest(selector) {
    if (this.matches(selector)) {
      return this;
    }
    return this.parentElement ? this.parentElement.closest(selector) : null;
  }

  matches(sel) {
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
    if (sel.startsWith('[')) {
      const attrRegex = /\[([a-z0-9-]+)(?:="([^"]*)")?\]/gi;
      let m;
      let matchedAny = false;
      while ((m = attrRegex.exec(sel)) !== null) {
        matchedAny = true;
        const attr = m[1];
        const val = m[2];
        const camel = attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, l) => l.toUpperCase());
        if (attr.startsWith('data-')) {
          if (this.dataset[camel] === undefined) return false;
          if (val !== undefined && String(this.dataset[camel]) !== String(val)) return false;
        } else {
          if (!this.attributes.has(attr)) return false;
          if (val !== undefined && this.attributes.get(attr) !== val) return false;
        }
      }
      if (matchedAny) return true;
    }
    return this.tagName.toLowerCase() === sel.toLowerCase();
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    if (!this.doc) return [];
    return this.doc.buscarEnSubarbol(this, sel);
  }
}

const VOID_TAGS = new Set(['INPUT', 'IMG', 'BR', 'HR', 'META', 'LINK']);

class MockDocument {
  constructor() {
    this.elementosFijos = new Map();
    this.elementosDinamicos = [];
    this.body = new MockElement('body', this, 'body');
    this.body.appendChild = (el) => {
      el.parentElement = this.body;
      this.elementosDinamicos.push(el);
      if (el.id) this.elementosFijos.set(el.id, el);
      return el;
    };
  }

  createElement(tag) {
    const el = new MockElement('', this, tag);
    el.remove = () => {
      if (el.parentElement) el.parentElement = null;
      if (el.id) this.elementosFijos.delete(el.id);
    };
    return el;
  }

  createElementNS(_ns, tag) {
    return this.createElement(tag);
  }

  getElementById(id) {
    if (this.elementosFijos.has(id)) {
      return this.elementosFijos.get(id);
    }
    for (const el of this.elementosDinamicos) {
      if (el.id === id) return el;
    }
    return null;
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    const todos = [...this.elementosFijos.values(), ...this.elementosDinamicos];
    return todos.filter((el) => el.matches(sel));
  }

  buscarEnSubarbol(raiz, sel) {
    const hijos = this.elementosDinamicos.filter((el) => {
      let p = el.parentElement;
      const visitados = new Set();
      while (p && !visitados.has(p)) {
        visitados.add(p);
        if (p === raiz) return true;
        p = p.parentElement;
      }
      return false;
    });
    return hijos.filter((el) => el.matches(sel));
  }

  indexarElementos(contenedor, html) {
    const hijosPrevios = new Set();
    this.elementosDinamicos = this.elementosDinamicos.filter((el) => {
      let p = el.parentElement;
      const visitados = new Set();
      while (p && !visitados.has(p)) {
        visitados.add(p);
        if (p === contenedor) {
          hijosPrevios.add(el);
          return false;
        }
        p = p.parentElement;
      }
      return true;
    });

    for (const h of hijosPrevios) {
      if (h.id && this.elementosFijos.get(h.id) === h) {
        this.elementosFijos.delete(h.id);
      }
    }

    const tagRegex = /<(\/)?([a-zA-Z0-9-]+)([^>]*)>/g;
    const stack = [];
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
      const isClosing = match[1] === '/';
      const tag = match[2].toUpperCase();
      const attrsStr = match[3];

      if (isClosing) {
        if (stack.length > 0 && stack[stack.length - 1].tagName === tag) {
          stack.pop();
        }
        continue;
      }

      const idMatch = attrsStr.match(/\bid="([^"]+)"/);
      const id = idMatch ? idMatch[1] : '';

      const classMatch = attrsStr.match(/\bclass="([^"]+)"/);
      const classes = classMatch ? classMatch[1].split(/\s+/).filter(Boolean) : [];

      const parent = stack.length > 0 ? stack[stack.length - 1] : contenedor;
      const el = new MockElement(id, this, tag);
      el.parentElement = parent;
      classes.forEach((c) => el.classList.add(c));

      const dataRegex = /\b(data-[a-zA-Z0-9-]+)="([^"]*)"/g;
      let dMatch;
      while ((dMatch = dataRegex.exec(attrsStr)) !== null) {
        el.setAttribute(dMatch[1], dMatch[2]);
      }

      const valMatch = attrsStr.match(/\bvalue="([^"]*)"/);
      if (valMatch) el.value = valMatch[1];

      if (/\bdisabled\b/.test(attrsStr)) el.disabled = true;

      this.elementosDinamicos.push(el);
      if (id) {
        this.elementosFijos.set(id, el);
      }

      if (!VOID_TAGS.has(tag) && !attrsStr.trim().endsWith('/')) {
        stack.push(el);
      }
    }
  }
}

/* =========================================================
   FIXTURES Y DATOS DE PRUEBA
   ========================================================= */

const CARRERAS_FIXTURE = [
  { id: 1, codigo: 'INF', nombre: 'Informática', activo: true, puedeGestionarCursos: true },
  { id: 2, codigo: 'MAT', nombre: 'Matemática', activo: true, puedeGestionarCursos: true },
];

const PLANES_FIXTURE = [
  { id: 10, carreraId: 1, codigo: 'INF-2026', nombre: 'Plan 2026', activo: true },
  { id: 20, carreraId: 2, codigo: 'MAT-2026', nombre: 'Plan 2026', activo: true },
];

const CURSOS_FIXTURE = [
  {
    id: 101,
    codigo: 'INF-1',
    nombre: 'Programación I',
    descripcion: 'Fundamentos',
    creditos: 4,
    activo: true,
    carreras: [{ id: 1 }],
    puedeGestionarGlobal: true,
  },
  {
    id: 102,
    codigo: 'INF-2',
    nombre: 'Estructuras de Datos',
    descripcion: 'Avanzado',
    creditos: 4,
    activo: true,
    carreras: [{ id: 1 }],
    puedeGestionarGlobal: true,
  },
  {
    id: 103,
    codigo: 'INF-3',
    nombre: 'Sistemas Operativos',
    descripcion: 'Bajo nivel',
    creditos: 4,
    activo: false,
    carreras: [{ id: 1 }],
    puedeGestionarGlobal: true,
  },
  {
    id: 201,
    codigo: 'MAT-1',
    nombre: 'Cálculo I',
    descripcion: 'Análisis matemático',
    creditos: 5,
    activo: true,
    carreras: [{ id: 2 }],
    puedeGestionarGlobal: true,
  },
];

const ASIGNATURAS_PLAN_FIXTURE = [
  { id: 1001, planId: 10, cursoId: 101, codigoReferencia: 'INF-1', nombreReferencia: 'Programación I', nivel: 1, ciclo: 1, creditos: 4 },
  { id: 1002, planId: 10, cursoId: 102, codigoReferencia: 'INF-2', nombreReferencia: 'Estructuras de Datos', nivel: 2, ciclo: 1, creditos: 4 },
  { id: 1003, planId: 10, cursoId: 103, codigoReferencia: 'INF-3', nombreReferencia: 'Sistemas Operativos', nivel: 2, ciclo: 2, creditos: 4 },
  { id: 2001, planId: 20, cursoId: 201, codigoReferencia: 'MAT-1', nombreReferencia: 'Cálculo I', nivel: 1, ciclo: 1, creditos: 5 },
];

const REQUISITOS_PLAN_FIXTURE = [
  {
    id: 501,
    asignaturaId: 1002,
    requisitoAsignaturaId: 1001,
    tipo: 'REQUISITO',
  },
  {
    id: 601,
    asignaturaId: 2001,
    requisitoAsignaturaId: 2000,
    tipo: 'CORREQUISITO',
  },
];

function crearEntornoPruebas({ rol = ROLES.ADMIN_GLOBAL, permisos = [PERMISOS.CURSOS_GESTIONAR, PERMISOS.CURSOS_VER] } = {}) {
  guardarSesion({
    usuario: {
      id: 1,
      nombres: 'Usuario Pruebas',
      roles: [rol],
      rolActivo: rol,
      permisos,
    },
  });

  const doc = new MockDocument();
  globalThis.document = doc;
  globalThis.window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    requestAnimationFrame: (cb) => {
      cb();
      return 1;
    },
    sgpa: {},
  };

  const htmlBase = CursosPage();
  const root = new MockElement('cursosPageRoot', doc);
  root.innerHTML = htmlBase;

  return { doc, root };
}

/* =========================================================
   TESTS DE CORRECCIÓN 1: MANEJO DE ERRORES EN REQUISITOS
   ========================================================= */

test('CORRECCIÓN 1 — Escenario A: Agregar requisito exitoso con actualización exitosa', async () => {
  const { doc } = crearEntornoPruebas();

  let requisitoCreado = null;
  let catalogoActualizado = false;

  window.sgpa.listarRequisitosCurso = async () => ({
    ok: true,
    requisitos: [],
  });
  window.sgpa.crearRequisitoCurso = async (cursoId, datos) => {
    requisitoCreado = { cursoId, datos };
    return { ok: true, requisito: { id: 99 } };
  };

  const curso = { id: 101, codigo: 'INF-1', nombre: 'Programación I' };
  const candidatos = [{ id: 102, codigo: 'INF-2', nombre: 'Estructuras de Datos', activo: true }];

  await abrirRequisitosCurso({
    curso,
    cursos: candidatos,
    puedeGestionar: true,
    onActualizado: async () => {
      catalogoActualizado = true;
    },
  });

  const selectCurso = doc.getElementById('nuevoRequisitoCursoId');
  const selectTipo = doc.getElementById('nuevoRequisitoTipo');
  const btnAgregar = doc.getElementById('btnAgregarRequisito');

  assert.ok(selectCurso, 'Select de curso requisito existe');
  assert.ok(btnAgregar, 'Boton agregar existe');

  selectCurso.value = '102';
  selectTipo.value = 'REQUISITO';
  await btnAgregar.click();
  await new Promise((r) => setTimeout(r, 40));

  assert.ok(requisitoCreado, 'Se llamó al servicio de crear requisito');
  assert.equal(requisitoCreado.datos.requisitoCursoId, 102);
  assert.equal(catalogoActualizado, true, 'Se ejecutó el callback onActualizado');

  const alertModal = doc.getElementById('sgpaAlertDialog');
  assert.ok(alertModal, 'AlertModal existe');
  assert.match(alertModal.innerHTML, /Requisito agregado/, 'Mensaje de éxito mostrado');
  assert.doesNotMatch(alertModal.innerHTML, /Vista no actualizada/, 'No se mostró error de vista');

  limpiarSesion();
});

test('CORRECCIÓN 1 — Escenario B: Mutación fallida no llama a onActualizado ni reporta éxito', async () => {
  const { doc } = crearEntornoPruebas();

  let intentoActualizar = false;

  window.sgpa.listarRequisitosCurso = async () => ({
    ok: true,
    requisitos: [],
  });
  window.sgpa.crearRequisitoCurso = async () => ({
    ok: false,
    message: 'Este requisito ya fue asignado previamente.',
  });

  const curso = { id: 101, codigo: 'INF-1', nombre: 'Programación I' };
  const candidatos = [{ id: 102, codigo: 'INF-2', nombre: 'Estructuras de Datos', activo: true }];

  await abrirRequisitosCurso({
    curso,
    cursos: candidatos,
    puedeGestionar: true,
    onActualizado: async () => {
      intentoActualizar = true;
    },
  });

  const selectCurso = doc.getElementById('nuevoRequisitoCursoId');
  const btnAgregar = doc.getElementById('btnAgregarRequisito');
  const errorBox = doc.getElementById('cursoRequisitosError');

  selectCurso.value = '102';
  await btnAgregar.click();
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(intentoActualizar, false, 'NO se debe llamar a onActualizado si la mutación falló');
  assert.match(errorBox.textContent, /Este requisito ya fue asignado previamente/, 'Error visible en formulario');

  const alertModal = doc.getElementById('sgpaAlertDialog');
  if (alertModal) {
    assert.doesNotMatch(alertModal.innerHTML, /Requisito agregado/);
  }

  limpiarSesion();
});

test('CORRECCIÓN 1 — Escenario C: Mutación exitosa con actualización fallida informa guardado pero advierte vista desactualizada sin contradecirse', async () => {
  const { doc } = crearEntornoPruebas();

  let mutacionGuardada = false;

  window.sgpa.listarRequisitosCurso = async () => ({
    ok: true,
    requisitos: [],
  });
  window.sgpa.crearRequisitoCurso = async () => {
    mutacionGuardada = true;
    return { ok: true, requisito: { id: 99 } };
  };

  const curso = { id: 101, codigo: 'INF-1', nombre: 'Programación I' };
  const candidatos = [{ id: 102, codigo: 'INF-2', nombre: 'Estructuras de Datos', activo: true }];

  await abrirRequisitosCurso({
    curso,
    cursos: candidatos,
    puedeGestionar: true,
    onActualizado: async () => {
      throw new Error('Fallo de red al recargar el catálogo');
    },
  });

  const selectCurso = doc.getElementById('nuevoRequisitoCursoId');
  const btnAgregar = doc.getElementById('btnAgregarRequisito');

  selectCurso.value = '102';
  await btnAgregar.click();
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(mutacionGuardada, true, 'La mutación se guardó con éxito en el servidor');

  const alertModal = doc.getElementById('sgpaAlertDialog');
  assert.ok(alertModal, 'AlertModal existe');
  assert.match(alertModal.innerHTML, /Vista no actualizada/, 'Informa que la vista no pudo actualizarse');
  assert.match(alertModal.innerHTML, /El requisito se guardó correctamente, pero no fue posible actualizar la vista/, 'Mensaje claro y no contradictorio');

  limpiarSesion();
});

test('CORRECCIÓN 1 — Eliminación: Mutación exitosa con actualización fallida informa eliminación sin mensaje contradictorio', async () => {
  const { doc } = crearEntornoPruebas();

  let requisitoEliminado = false;

  window.sgpa.listarRequisitosCurso = async () => ({
    ok: true,
    requisitos: [
      {
        id: 77,
        tipo: 'REQUISITO',
        requisitoCurso: { codigo: 'INF-2', nombre: 'Estructuras de Datos' },
      },
    ],
  });
  window.sgpa.eliminarRequisitoCurso = async () => {
    requisitoEliminado = true;
    return { ok: true };
  };

  const curso = { id: 101, codigo: 'INF-1', nombre: 'Programación I' };

  await abrirRequisitosCurso({
    curso,
    cursos: [],
    puedeGestionar: true,
    onActualizado: async () => {
      throw new Error('Error al recargar catálogo');
    },
  });

  const btnEliminar = doc.querySelector('[data-eliminar-requisito="77"]');
  assert.ok(btnEliminar, 'Boton eliminar requisito existe');
  btnEliminar.click();
  await new Promise((r) => setTimeout(r, 40));

  const btnConfirmar = doc.getElementById('sgpaConfirmAccept');
  assert.ok(btnConfirmar, 'Boton confirmar eliminación existe');
  btnConfirmar.click();
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(requisitoEliminado, true, 'Se eliminó con éxito en el backend');

  const alertModal = doc.getElementById('sgpaAlertDialog');
  assert.ok(alertModal, 'AlertModal existe');
  assert.match(alertModal.innerHTML, /Vista no actualizada/);
  assert.match(alertModal.innerHTML, /El requisito se eliminó correctamente, pero no fue posible actualizar la vista/);

  limpiarSesion();
});

/* =========================================================
   TESTS DE CORRECCIÓN 2: INTERACCIONES REALES DEL USUARIO
   ========================================================= */

test('CORRECCIÓN 2 — Flujo completo: Carga inicial, selección de carrera, catálogo y datos', async () => {
  const { doc } = crearEntornoPruebas();

  window.sgpa.listarCursos = async () => ({ ok: true, cursos: CURSOS_FIXTURE });
  window.sgpa.listarCarreras = async () => ({ ok: true, carreras: CARRERAS_FIXTURE });
  window.sgpa.listarPlanesEstudio = async () => ({ ok: true, planes: PLANES_FIXTURE });
  window.sgpa.listarPlanAsignaturas = async () => ({ ok: true, asignaturas: ASIGNATURAS_PLAN_FIXTURE });
  window.sgpa.listarPlanRequisitos = async () => ({ ok: true, requisitos: REQUISITOS_PLAN_FIXTURE });

  iniciarCursosPage();
  await new Promise((r) => setTimeout(r, 40));

  const carrerasContainer = doc.getElementById('cursosCarreras');
  assert.match(carrerasContainer.innerHTML, /Informática/);
  assert.match(carrerasContainer.innerHTML, /Matemática/);

  const cardCarrera1 = doc.querySelector('[data-curso-carrera="1"]');
  assert.ok(cardCarrera1, 'Tarjeta de Informática existe');
  await cardCarrera1.click();
  await new Promise((r) => setTimeout(r, 50));

  const catalogo = doc.getElementById('cursosCatalogo');
  assert.equal(catalogo.classList.contains('hidden'), false, 'Catálogo visible tras seleccionar carrera');

  const contenido = doc.getElementById('cursosContent');
  assert.match(contenido.innerHTML, /INF-1/);
  assert.match(contenido.innerHTML, /INF-2/);
  assert.match(contenido.innerHTML, /INF-3/);

  limpiarSesion();
});

test('CORRECCIÓN 2 — Búsqueda en vivo y filtrado por estado con restablecimiento', async () => {
  const { doc } = crearEntornoPruebas();

  window.sgpa.listarCursos = async () => ({ ok: true, cursos: CURSOS_FIXTURE });
  window.sgpa.listarCarreras = async () => ({ ok: true, carreras: CARRERAS_FIXTURE });
  window.sgpa.listarPlanesEstudio = async () => ({ ok: true, planes: PLANES_FIXTURE });
  window.sgpa.listarPlanAsignaturas = async () => ({ ok: true, asignaturas: ASIGNATURAS_PLAN_FIXTURE });
  window.sgpa.listarPlanRequisitos = async () => ({ ok: true, requisitos: REQUISITOS_PLAN_FIXTURE });

  iniciarCursosPage();
  await new Promise((r) => setTimeout(r, 40));

  const cardCarrera1 = doc.querySelector('[data-curso-carrera="1"]');
  assert.ok(cardCarrera1, 'Tarjeta de carrera existe');
  await cardCarrera1.click();
  await new Promise((r) => setTimeout(r, 50));

  const buscarInput = doc.getElementById('cursosBuscar');
  const estadoSelect = doc.getElementById('cursosEstado');
  const btnRestablecer = doc.getElementById('restablecerCursosFiltros');
  const contenido = doc.getElementById('cursosContent');

  // Filtrar por texto
  buscarInput.input('Estructuras');
  await new Promise((r) => setTimeout(r, 30));
  assert.match(contenido.innerHTML, /<strong class="curso-code">\s*INF-2\s*<\/strong>/);
  assert.doesNotMatch(contenido.innerHTML, /<strong class="curso-code">\s*INF-1\s*<\/strong>/);
  assert.doesNotMatch(contenido.innerHTML, /<strong class="curso-code">\s*INF-3\s*<\/strong>/);

  // Filtrar por estado INACTIVOS
  buscarInput.input('');
  estadoSelect.change('INACTIVOS');
  await new Promise((r) => setTimeout(r, 30));
  assert.match(contenido.innerHTML, /<strong class="curso-code">\s*INF-3\s*<\/strong>/);
  assert.doesNotMatch(contenido.innerHTML, /<strong class="curso-code">\s*INF-1\s*<\/strong>/);
  assert.doesNotMatch(contenido.innerHTML, /<strong class="curso-code">\s*INF-2\s*<\/strong>/);

  // Restablecer filtros
  btnRestablecer.click();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(buscarInput.value, '');
  assert.equal(estadoSelect.value, 'TODOS');
  assert.match(contenido.innerHTML, /<strong class="curso-code">\s*INF-1\s*<\/strong>/);
  assert.match(contenido.innerHTML, /<strong class="curso-code">\s*INF-2\s*<\/strong>/);
  assert.match(contenido.innerHTML, /<strong class="curso-code">\s*INF-3\s*<\/strong>/);

  limpiarSesion();
});

test('CORRECCIÓN 2 — Paginación interactiva al hacer clic en botones de página', async () => {
  const { doc } = crearEntornoPruebas();

  const muchosCursos = Array.from({ length: 15 }, (_, i) => ({
    id: 200 + i,
    codigo: `CURSO-${String(i + 1).padStart(2, '0')}`,
    nombre: `Materia ${i + 1}`,
    activo: true,
    carreras: [{ id: 1 }],
  }));

  window.sgpa.listarCursos = async () => ({ ok: true, cursos: muchosCursos });
  window.sgpa.listarCarreras = async () => ({ ok: true, carreras: CARRERAS_FIXTURE });
  window.sgpa.listarPlanesEstudio = async () => ({ ok: true, planes: PLANES_FIXTURE });
  window.sgpa.listarPlanAsignaturas = async () => ({ ok: true, asignaturas: [] });
  window.sgpa.listarPlanRequisitos = async () => ({ ok: true, requisitos: [] });

  iniciarCursosPage();
  await new Promise((r) => setTimeout(r, 40));

  doc.querySelector('[data-curso-carrera="1"]').click();
  await new Promise((r) => setTimeout(r, 50));

  const contenido = doc.getElementById('cursosContent');
  assert.match(contenido.innerHTML, /CURSO-01\s*<\/strong>/);
  assert.doesNotMatch(contenido.innerHTML, /CURSO-11\s*<\/strong>/);

  const btnP2 = doc.querySelector('[data-cursos-pagina="2"]');
  assert.ok(btnP2, 'Boton pagina 2 existe');
  btnP2.click();
  await new Promise((r) => setTimeout(r, 40));

  assert.match(contenido.innerHTML, /CURSO-11\s*<\/strong>/);
  assert.doesNotMatch(contenido.innerHTML, /CURSO-01\s*<\/strong>/);

  limpiarSesion();
});

test('CORRECCIÓN 2 — Diálogo de confirmación para alternar estado (aceptar y cancelar)', async () => {
  const { doc } = crearEntornoPruebas();

  let estadoLlamado = null;

  window.sgpa.listarCursos = async () => ({ ok: true, cursos: CURSOS_FIXTURE });
  window.sgpa.listarCarreras = async () => ({ ok: true, carreras: CARRERAS_FIXTURE });
  window.sgpa.listarPlanesEstudio = async () => ({ ok: true, planes: PLANES_FIXTURE });
  window.sgpa.listarPlanAsignaturas = async () => ({ ok: true, asignaturas: ASIGNATURAS_PLAN_FIXTURE });
  window.sgpa.listarPlanRequisitos = async () => ({ ok: true, requisitos: REQUISITOS_PLAN_FIXTURE });
  window.sgpa.cambiarEstadoCurso = async (id, activo) => {
    estadoLlamado = { id, activo };
    return { ok: true };
  };

  iniciarCursosPage();
  await new Promise((r) => setTimeout(r, 40));

  doc.querySelector('[data-curso-carrera="1"]').click();
  await new Promise((r) => setTimeout(r, 50));

  const btnEstado = doc.querySelector('[data-action="estado"][data-id="101"]');
  assert.ok(btnEstado, 'Boton estado de curso 101 existe');

  // Cancelar en confirm.js
  btnEstado.click();
  await new Promise((r) => setTimeout(r, 30));

  const confirmCancel = doc.getElementById('sgpaConfirmCancel');
  assert.ok(confirmCancel, 'Boton cancelar confirmacion existe');
  confirmCancel.click();

  await new Promise((r) => setTimeout(r, 40));
  assert.equal(estadoLlamado, null, 'No se debe llamar a cambiarEstadoCurso al cancelar');

  // Aceptar en confirm.js
  btnEstado.click();
  await new Promise((r) => setTimeout(r, 30));

  const confirmAccept = doc.getElementById('sgpaConfirmAccept');
  assert.ok(confirmAccept, 'Boton aceptar confirmacion existe');
  confirmAccept.click();

  await new Promise((r) => setTimeout(r, 40));
  assert.ok(estadoLlamado, 'Se llamó al servicio cambiarEstadoCurso');
  assert.equal(estadoLlamado.id, 101);
  assert.equal(estadoLlamado.activo, false, 'Cambió de activo a inactivo');

  limpiarSesion();
});

test('CORRECCIÓN 2 — Apertura y cierre de formulario de creación de curso con selectores en cascada', async () => {
  const { doc } = crearEntornoPruebas();

  window.sgpa.listarAsignaturasDisponiblesCurso = async ({ carreraId, planId }) => ({
    ok: true,
    asignaturas: [
      { id: 999, codigoReferencia: 'PROG-X', nombreReferencia: 'Programación Especial', nivel: 1, ciclo: 1, creditos: 3 },
    ],
  });

  await abrirFormularioCurso({
    carreraInicialId: 1,
    carrerasDisponibles: CARRERAS_FIXTURE,
    planesDisponibles: PLANES_FIXTURE,
  });

  const dialog = doc.getElementById('cursoDialog');
  assert.equal(dialog.open, true, 'Diálogo de nuevo curso abierto');

  const carreraSelect = doc.getElementById('cursoCarrera');
  const planSelect = doc.getElementById('cursoPlan');
  const btnCancelar = doc.getElementById('cancelarCursoButton');

  assert.ok(carreraSelect, 'Selector de carrera existe');
  assert.ok(planSelect, 'Selector de plan existe');

  await carreraSelect.change('1');
  assert.equal(planSelect.disabled, false, 'Plan habilitado tras seleccionar carrera');

  await btnCancelar.click();
  assert.equal(dialog.open, false, 'Diálogo cerrado tras cancelar');

  limpiarSesion();
});

test('CORRECCIÓN 2 — Apertura de detalle de requisito (modal informativo pequeño)', async () => {
  const { doc } = crearEntornoPruebas();

  window.sgpa.listarCursos = async () => ({ ok: true, cursos: CURSOS_FIXTURE });
  window.sgpa.listarCarreras = async () => ({ ok: true, carreras: CARRERAS_FIXTURE });
  window.sgpa.listarPlanesEstudio = async () => ({ ok: true, planes: PLANES_FIXTURE });
  window.sgpa.listarPlanAsignaturas = async () => ({ ok: true, asignaturas: ASIGNATURAS_PLAN_FIXTURE });
  window.sgpa.listarPlanRequisitos = async () => ({ ok: true, requisitos: REQUISITOS_PLAN_FIXTURE });

  iniciarCursosPage();
  await new Promise((r) => setTimeout(r, 40));

  await doc.querySelector('[data-curso-carrera="1"]').click();
  await new Promise((r) => setTimeout(r, 50));

  const badgeReq = doc.querySelector('[data-requisito-curso="102"]');
  assert.ok(badgeReq, 'Badge de requisito en tabla existe');
  await badgeReq.click();

  const reqDialog = doc.getElementById('cursoRequisitoDialog');
  assert.equal(reqDialog.open, true, 'Modal de detalle de requisito abierto');

  const btnCerrar = doc.getElementById('cerrarCursoRequisito');
  assert.ok(btnCerrar, 'Boton cerrar detalle de requisito existe');
  await btnCerrar.click();
  assert.equal(reqDialog.open, false, 'Modal de detalle cerrado');

  limpiarSesion();
});

test('CORRECCIÓN 2 — Rechazo de operaciones para usuarios sin permiso CURSOS_GESTIONAR', async () => {
  const { doc } = crearEntornoPruebas({
    rol: ROLES.PROFESOR,
    permisos: [PERMISOS.CURSOS_VER],
  });

  const cursosSoloLectura = CURSOS_FIXTURE.map((c) => ({
    ...c,
    puedeGestionarGlobal: false,
  }));

  window.sgpa.listarCursos = async () => ({ ok: true, cursos: cursosSoloLectura });
  window.sgpa.listarCarreras = async () => ({
    ok: true,
    carreras: CARRERAS_FIXTURE.map((c) => ({ ...c, puedeGestionarCursos: false })),
  });
  window.sgpa.listarPlanesEstudio = async () => ({ ok: true, planes: PLANES_FIXTURE });
  window.sgpa.listarPlanAsignaturas = async () => ({ ok: true, asignaturas: ASIGNATURAS_PLAN_FIXTURE });
  window.sgpa.listarPlanRequisitos = async () => ({ ok: true, requisitos: REQUISITOS_PLAN_FIXTURE });

  iniciarCursosPage();
  await new Promise((r) => setTimeout(r, 40));

  const btnNuevo = doc.getElementById('nuevoCursoButton');
  assert.equal(btnNuevo, null, 'Boton nuevo curso no se renderiza sin permiso');

  doc.querySelector('[data-curso-carrera="1"]').click();
  await new Promise((r) => setTimeout(r, 50));

  const btnEditar = doc.querySelector('[data-action="editar"]');
  const btnEstado = doc.querySelector('[data-action="estado"]');
  assert.equal(btnEditar, null, 'Boton editar no visible');
  assert.equal(btnEstado, null, 'Boton estado no visible');

  limpiarSesion();
});

test('CORRECCIÓN 2 — Manejo de errores cuando el servicio inicial falla', async () => {
  const { doc } = crearEntornoPruebas();

  window.sgpa.listarCursos = async () => ({
    ok: false,
    message: 'Error de conexión con la base de datos institucional',
  });
  window.sgpa.listarCarreras = async () => ({ ok: true, carreras: [] });
  window.sgpa.listarPlanesEstudio = async () => ({ ok: true, planes: [] });

  iniciarCursosPage();
  await new Promise((r) => setTimeout(r, 40));

  const contenedor = doc.getElementById('cursosCarreras');
  assert.match(contenedor.innerHTML, /cursos-error/, 'Se muestra mensaje de error');
  assert.match(contenedor.innerHTML, /Error de conexión con la base de datos institucional/);

  limpiarSesion();
});

test('CORRECCIÓN 2 — Navegación y ausencia de listeners duplicados tras reinicializaciones', async () => {
  const { doc } = crearEntornoPruebas();

  let llamadasListar = 0;
  window.sgpa.listarCursos = async () => {
    llamadasListar += 1;
    return { ok: true, cursos: CURSOS_FIXTURE };
  };
  window.sgpa.listarCarreras = async () => ({ ok: true, carreras: CARRERAS_FIXTURE });
  window.sgpa.listarPlanesEstudio = async () => ({ ok: true, planes: PLANES_FIXTURE });
  window.sgpa.listarPlanAsignaturas = async () => ({ ok: true, asignaturas: ASIGNATURAS_PLAN_FIXTURE });
  window.sgpa.listarPlanRequisitos = async () => ({ ok: true, requisitos: REQUISITOS_PLAN_FIXTURE });

  iniciarCursosPage();
  await new Promise((r) => setTimeout(r, 30));

  iniciarCursosPage();
  await new Promise((r) => setTimeout(r, 30));

  assert.equal(llamadasListar, 2, 'Cada inicialización genera su propia carga');

  await doc.querySelector('[data-curso-carrera="1"]').click();
  await new Promise((r) => setTimeout(r, 40));

  const contenido = doc.getElementById('cursosContent');
  assert.match(contenido.innerHTML, /INF-1/);

  limpiarSesion();
});

/* =========================================================
   TESTS FRONTEND-FIX-002: CONCURRENCIA EN SELECCIÓN DE CARRERAS
   ========================================================= */

function crearDiferido() {
  let resolver;
  let rechazar;
  const promesa = new Promise((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

const vaciarMicrotareas = () => new Promise((resolve) => setTimeout(resolve, 0));

test('FRONTEND-FIX-002 — Carrera A responde antes que B (secuencia ordenada normal)', async () => {
  const { doc } = crearEntornoPruebas();

  const diferidoA = crearDiferido();
  const diferidoB = crearDiferido();

  window.sgpa.listarCursos = async () => ({ ok: true, cursos: CURSOS_FIXTURE });
  window.sgpa.listarCarreras = async () => ({ ok: true, carreras: CARRERAS_FIXTURE });
  window.sgpa.listarPlanesEstudio = async () => ({ ok: true, planes: PLANES_FIXTURE });

  window.sgpa.listarPlanAsignaturas = (planId) => {
    if (planId === 10) return diferidoA.promesa;
    if (planId === 20) return diferidoB.promesa;
    return Promise.resolve({ ok: true, asignaturas: [] });
  };
  window.sgpa.listarPlanRequisitos = async () => ({ ok: true, requisitos: [] });

  iniciarCursosPage();
  await vaciarMicrotareas();

  // 1. Clic en Carrera A (Informática)
  doc.querySelector('[data-curso-carrera="1"]').click();
  await vaciarMicrotareas();

  // Carrera A responde primero
  diferidoA.resolver({
    ok: true,
    asignaturas: [{ id: 1001, cursoId: 101, codigoReferencia: 'INF-1', nombreReferencia: 'Programación I' }],
  });
  await vaciarMicrotareas();

  const heading = doc.getElementById('cursosCatalogoHeading');
  const contenido = doc.getElementById('cursosContent');
  assert.match(heading.innerHTML, /Informática/);
  assert.match(contenido.innerHTML, /INF-1/);
  assert.doesNotMatch(contenido.innerHTML, /MAT-1/);

  // 2. Clic en Carrera B (Matemática)
  doc.querySelector('[data-curso-carrera="2"]').click();
  await vaciarMicrotareas();

  // Carrera B responde después
  diferidoB.resolver({
    ok: true,
    asignaturas: [{ id: 2001, cursoId: 201, codigoReferencia: 'MAT-1', nombreReferencia: 'Cálculo I' }],
  });
  await vaciarMicrotareas();

  assert.match(heading.innerHTML, /Matemática/);
  assert.match(contenido.innerHTML, /MAT-1/);
  assert.doesNotMatch(contenido.innerHTML, /INF-1/);

  limpiarSesion();
});

test('FRONTEND-FIX-002 — Carrera B responde antes que A y respuesta tardía de A se descarta', async () => {
  const { doc } = crearEntornoPruebas();

  const diferidoA_asig = crearDiferido();
  const diferidoA_req = crearDiferido();
  const diferidoB_asig = crearDiferido();
  const diferidoB_req = crearDiferido();

  window.sgpa.listarCursos = async () => ({ ok: true, cursos: CURSOS_FIXTURE });
  window.sgpa.listarCarreras = async () => ({ ok: true, carreras: CARRERAS_FIXTURE });
  window.sgpa.listarPlanesEstudio = async () => ({ ok: true, planes: PLANES_FIXTURE });

  window.sgpa.listarPlanAsignaturas = (planId) => {
    if (planId === 10) return diferidoA_asig.promesa;
    if (planId === 20) return diferidoB_asig.promesa;
    return Promise.resolve({ ok: true, asignaturas: [] });
  };

  window.sgpa.listarPlanRequisitos = (planId) => {
    if (planId === 10) return diferidoA_req.promesa;
    if (planId === 20) return diferidoB_req.promesa;
    return Promise.resolve({ ok: true, requisitos: [] });
  };

  iniciarCursosPage();
  await vaciarMicrotareas();

  // 1. Clic en Carrera A (Plan 10)
  doc.querySelector('[data-curso-carrera="1"]').click();
  await vaciarMicrotareas();

  // 2. Clic inmediato en Carrera B (Plan 20)
  doc.querySelector('[data-curso-carrera="2"]').click();
  await vaciarMicrotareas();

  // 3. Carrera B responde PRIMERO (rápida)
  diferidoB_asig.resolver({
    ok: true,
    asignaturas: [{ id: 2001, cursoId: 201, codigoReferencia: 'MAT-1', nombreReferencia: 'Cálculo I', nivel: 1, ciclo: 1, creditos: 5 }],
  });
  diferidoB_req.resolver({
    ok: true,
    requisitos: [{ id: 601, asignaturaId: 2001, requisitoAsignaturaId: 2000, tipo: 'CORREQUISITO' }],
  });
  await vaciarMicrotareas();

  const heading = doc.getElementById('cursosCatalogoHeading');
  const contenido = doc.getElementById('cursosContent');

  assert.match(heading.innerHTML, /Matemática/, 'Encabezado muestra Carrera B');
  assert.match(contenido.innerHTML, /MAT-1/, 'Contenido muestra curso de Carrera B');
  assert.doesNotMatch(contenido.innerHTML, /INF-1/, 'No debe mostrar curso de Carrera A');
  assert.match(contenido.innerHTML, /is-corequisite/, 'Muestra requisitos del plan de Carrera B');

  // 4. AHORA llega la respuesta antigua y demorada de Carrera A
  diferidoA_asig.resolver({
    ok: true,
    asignaturas: [{ id: 1001, cursoId: 101, codigoReferencia: 'INF-1', nombreReferencia: 'Programación I', nivel: 1, ciclo: 1, creditos: 4 }],
  });
  diferidoA_req.resolver({
    ok: true,
    requisitos: [{ id: 501, asignaturaId: 1001, requisitoAsignaturaId: 1002, tipo: 'REQUISITO' }],
  });
  await vaciarMicrotareas();

  // 5. Verificación estricta: B continúa vigente y los datos de A fueron descartados
  assert.match(heading.innerHTML, /Matemática/, 'La carrera seleccionada continúa siendo B');
  assert.doesNotMatch(heading.innerHTML, /Informática/, 'Informática no debe haber reemplazado el encabezado');
  assert.match(contenido.innerHTML, /MAT-1/, 'Las asignaturas corresponden exclusivamente a B');
  assert.doesNotMatch(contenido.innerHTML, /INF-1/, 'INF-1 rezagado no debe aparecer en el catálogo');
  assert.doesNotMatch(contenido.innerHTML, /INF-2/, 'Requisitos de A no deben contaminar la vista de B');

  limpiarSesion();
});

test('FRONTEND-FIX-002 — Error tardío de Carrera A no afecta la selección ni el catálogo de Carrera B', async () => {
  const { doc } = crearEntornoPruebas();

  const diferidoA = crearDiferido();
  const diferidoB = crearDiferido();

  window.sgpa.listarCursos = async () => ({ ok: true, cursos: CURSOS_FIXTURE });
  window.sgpa.listarCarreras = async () => ({ ok: true, carreras: CARRERAS_FIXTURE });
  window.sgpa.listarPlanesEstudio = async () => ({ ok: true, planes: PLANES_FIXTURE });

  window.sgpa.listarPlanAsignaturas = (planId) => {
    if (planId === 10) return diferidoA.promesa;
    if (planId === 20) return diferidoB.promesa;
    return Promise.resolve({ ok: true, asignaturas: [] });
  };
  window.sgpa.listarPlanRequisitos = async () => ({ ok: true, requisitos: [] });

  iniciarCursosPage();
  await vaciarMicrotareas();

  // Iniciar A y luego B
  doc.querySelector('[data-curso-carrera="1"]').click();
  await vaciarMicrotareas();

  doc.querySelector('[data-curso-carrera="2"]').click();
  await vaciarMicrotareas();

  // B responde con éxito
  diferidoB.resolver({
    ok: true,
    asignaturas: [{ id: 2001, cursoId: 201, codigoReferencia: 'MAT-1', nombreReferencia: 'Cálculo I' }],
  });
  await vaciarMicrotareas();

  const contenido = doc.getElementById('cursosContent');
  assert.match(contenido.innerHTML, /MAT-1/, 'Catálogo de B renderizado con éxito');

  // Ahora A falla tarde con error de servicio
  diferidoA.rechazar(new Error('Fallo de red en Carrera A'));
  await vaciarMicrotareas();

  // Comprobar que no se disparó AlertModal de error para la selección anterior
  const alertModal = doc.getElementById('sgpaAlertDialog');
  if (alertModal) {
    assert.doesNotMatch(alertModal.innerHTML, /Fallo de red en Carrera A/, 'No debe mostrarse error de solicitud antigua');
  }

  // Comprobar que el catálogo sigue intacto mostrando B
  assert.match(contenido.innerHTML, /MAT-1/, 'El catálogo de B continúa visible e intacto');
  assert.doesNotMatch(contenido.innerHTML, /cursos-error/, 'No deben quedar errores visuales en el catálogo');

  limpiarSesion();
});

test('FRONTEND-FIX-002 — Reinicialización de página descarta solicitudes anteriores en vuelo', async () => {
  const { doc } = crearEntornoPruebas();

  const diferidoA = crearDiferido();

  window.sgpa.listarCursos = async () => ({ ok: true, cursos: CURSOS_FIXTURE });
  window.sgpa.listarCarreras = async () => ({ ok: true, carreras: CARRERAS_FIXTURE });
  window.sgpa.listarPlanesEstudio = async () => ({ ok: true, planes: PLANES_FIXTURE });

  window.sgpa.listarPlanAsignaturas = (planId) => {
    if (planId === 10) return diferidoA.promesa;
    return Promise.resolve({ ok: true, asignaturas: [] });
  };
  window.sgpa.listarPlanRequisitos = async () => ({ ok: true, requisitos: [] });

  iniciarCursosPage();
  await vaciarMicrotareas();

  // Seleccionar Carrera A -> queda pendiente
  doc.querySelector('[data-curso-carrera="1"]').click();
  await vaciarMicrotareas();

  // El usuario navega o se reinicializa la página mientras la consulta estaba en vuelo
  iniciarCursosPage();
  await vaciarMicrotareas();

  const catalogo = doc.getElementById('cursosCatalogo');
  assert.equal(catalogo.classList.contains('hidden'), true, 'El catálogo vuelve a estar oculto al reiniciar');

  // Ahora la consulta de la sesión previa finalmente resuelve
  diferidoA.resolver({
    ok: true,
    asignaturas: [{ id: 1001, cursoId: 101, codigoReferencia: 'INF-1', nombreReferencia: 'Programación I' }],
  });
  await vaciarMicrotareas();

  // Verificar que la respuesta rezagada no modificó la nueva instancia
  assert.equal(catalogo.classList.contains('hidden'), true, 'El catálogo permanece oculto');
  const contenido = doc.getElementById('cursosContent');
  assert.equal(contenido.innerHTML, '', 'No se insertaron datos residuales de la instancia previa');

  limpiarSesion();
});
