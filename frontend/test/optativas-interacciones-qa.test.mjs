import test from 'node:test';
import assert from 'node:assert/strict';
import { OptativasPage, iniciarOptativasPage } from '../src/pages/optativas/OptativasPage.js';
import { guardarSesion, limpiarSesion } from '../src/app/session.js';
import { ROLES, PERMISOS } from '../src/config/permissions.js';

/* =========================================================
   MOCK DOM ENVIRONMENT PARA OPTATIVAS CON DIÁLOGOS REALES
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
    this.elements = {};
    this.options = [];
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

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  reset() {
    this.value = '';
    for (const key of Object.keys(this.elements)) {
      if (this.elements[key]) {
        this.elements[key].value = '';
        this.elements[key].disabled = false;
      }
    }
  }

  remove() {
    if (this.parentElement) {
      this.parentElement = null;
    }
    if (this.doc) {
      if (this.id) this.doc.elementosFijos.delete(this.id);
      const idx = this.doc.elementosDinamicos.indexOf(this);
      if (idx !== -1) this.doc.elementosDinamicos.splice(idx, 1);
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
      Object.defineProperty(event, 'currentTarget', { value: this, writable: true, configurable: true });
      h.call(this, event);
    }
    if (this.parentElement) {
      this.parentElement.dispatchEvent(event);
    }
    return true;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches && curr.matches(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    const dataMatch = selector.match(/^\[data-([a-zA-Z0-9-]+)(?:="([^"]*)")?\]$/);
    if (dataMatch) {
      const camel = dataMatch[1].replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      if (this.dataset[camel] !== undefined) {
        if (dataMatch[2] !== undefined) return this.dataset[camel] === dataMatch[2];
        return true;
      }
      return false;
    }
    if (selector.includes(',')) {
      return selector.split(',').some((s) => this.matches(s.trim()));
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  querySelector(sel) {
    if (!this.doc) return null;
    return this.doc.buscarEnSubarbol(this, sel)[0] || null;
  }

  querySelectorAll(sel) {
    if (!this.doc) return [];
    return this.doc.buscarEnSubarbol(this, sel);
  }
}

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
    const todos = [this.body, ...this.elementosFijos.values(), ...this.elementosDinamicos];
    const unicos = [...new Set(todos)];
    return unicos.filter((el) => el.matches(sel));
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

      const nameMatch = attrsStr.match(/\bname="([^"]*)"/);
      if (nameMatch) {
        el.name = nameMatch[1];
        if (parent && parent.elements) {
          parent.elements[el.name] = el;
        }
        // Buscar form ancestro en el stack
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tagName === 'FORM') {
            stack[i].elements[el.name] = el;
            break;
          }
        }
      }

      const valMatch = attrsStr.match(/\bvalue="([^"]*)"/);
      if (valMatch) el.value = valMatch[1];

      if (tag === 'OPTION') {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tagName === 'SELECT') {
            stack[i].options.push(el);
            break;
          }
        }
      }

      if (id) {
        this.elementosFijos.set(id, el);
      }
      this.elementosDinamicos.push(el);

      const isVoid = ['INPUT', 'IMG', 'BR', 'HR', 'META', 'LINK'].includes(tag);
      if (!isVoid && !attrsStr.endsWith('/')) {
        stack.push(el);
      }
    }
  }
}

function crearEntornoOptativas({ rol = ROLES.COORDINADOR, permisos = [PERMISOS.OPTATIVAS_GESTIONAR] } = {}) {
  limpiarSesion();
  guardarSesion({
    usuario: {
      id: 10,
      email: 'coordinador@una.ac.cr',
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
    requestAnimationFrame: (cb) => { cb(); return 1; },
    sgpa: {},
  };

  const html = OptativasPage();
  const root = new MockElement('optativasPageRoot', doc);
  root.innerHTML = html;
  doc.body.appendChild(root);

  return { doc, root };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

/* =========================================================
   TESTS DE INTERACCIÓN: CONFIRMACIONES Y MUTACIONES
   ========================================================= */

test('optativas interacciones — Confirmación de cambio de estado ACEPTADA ejecuta mutación y actualiza vista', async () => {
  const { doc } = crearEntornoOptativas();

  const optativasMock = [
    {
      id: 1,
      curso: { id: 101, codigo: 'OPT-01', nombre: 'Robótica Educativa' },
      tipo: 'DISCIPLINARIA',
      carreraOrigen: { id: 1, nombre: 'Informática' },
      activo: true,
    },
  ];

  let cambioLlamado = 0;
  let paramsCambio = null;

  globalThis.window.sgpa.listarOptativas = async () => ({
    ok: true,
    optativas: optativasMock,
  });

  globalThis.window.sgpa.listarCarrerasElegiblesOptativa = async () => ({
    ok: true,
    carreras: [{ id: 1, nombre: 'Informática' }],
  });

  globalThis.window.sgpa.cambiarEstadoOptativa = async (id, nuevoActivo) => {
    cambioLlamado++;
    paramsCambio = { id, nuevoActivo };
    optativasMock[0].activo = nuevoActivo;
    return { ok: true, optativa: optativasMock[0] };
  };

  iniciarOptativasPage();
  await tick();

  // Buscar el botón de alternar estado para la optativa 1
  const botonEstado = doc.querySelector('[data-estado-optativa="1"]');
  assert.ok(botonEstado, 'El botón de estado para la optativa 1 debe existir');

  // Clic en el botón para solicitar desactivación
  botonEstado.dispatchEvent(new Event('click'));
  await tick();

  // Comprobar que el diálogo de confirmación institucional fue abierto
  const confirmDialog = doc.getElementById('sgpaConfirmDialog');
  assert.ok(confirmDialog, 'El diálogo institucional sgpaConfirmDialog debe haber sido creado');
  assert.equal(confirmDialog.open, true, 'El diálogo debe estar abierto');

  // Al estar la optativa activa, la acción a confirmar es "Desactivar" (peligro = true)
  const botonAceptar = confirmDialog.querySelector('#sgpaConfirmAccept');
  assert.ok(botonAceptar, 'El botón de aceptar del diálogo debe existir');

  // Aceptar la acción
  botonAceptar.dispatchEvent(new Event('click'));
  await tick();
  await tick();

  // Validaciones
  assert.equal(cambioLlamado, 1, 'La mutación cambiarEstadoOptativa debe ejecutarse exactamente una vez');
  assert.deepEqual(paramsCambio, { id: 1, nuevoActivo: false }, 'Debe solicitar desactivar la optativa 1');
  assert.equal(confirmDialog.open, false, 'El diálogo de confirmación debe cerrarse');

  // Verificar estado visual actualizado en la tabla
  const resultado = doc.getElementById('optativasResultado');
  assert.ok(resultado.innerHTML.includes('Inactiva'), 'La tabla debe reflejar el nuevo estado Inactiva');
});

test('optativas interacciones — Confirmación CANCELADA no ejecuta mutación ni altera la vista', async () => {
  const { doc } = crearEntornoOptativas();

  const optativasMock = [
    {
      id: 2,
      curso: { id: 102, codigo: 'OPT-02', nombre: 'Diseño Gráfico' },
      tipo: 'DISCIPLINARIA',
      carreraOrigen: { id: 1, nombre: 'Informática' },
      activo: true,
    },
  ];

  let cambioLlamado = 0;

  globalThis.window.sgpa.listarOptativas = async () => ({
    ok: true,
    optativas: optativasMock,
  });

  globalThis.window.sgpa.listarCarrerasElegiblesOptativa = async () => ({
    ok: true,
    carreras: [{ id: 1, nombre: 'Informática' }],
  });

  globalThis.window.sgpa.cambiarEstadoOptativa = async () => {
    cambioLlamado++;
    return { ok: true };
  };

  iniciarOptativasPage();
  await tick();

  const botonEstado = doc.querySelector('[data-estado-optativa="2"]');
  assert.ok(botonEstado, 'Debe existir el botón de estado');

  botonEstado.dispatchEvent(new Event('click'));
  await tick();

  const confirmDialog = doc.getElementById('sgpaConfirmDialog');
  assert.ok(confirmDialog, 'El diálogo de confirmación debe presentarse');

  // Cancelar la acción
  const botonCancelar = confirmDialog.querySelector('#sgpaConfirmCancel');
  assert.ok(botonCancelar, 'El botón de cancelar debe existir');
  botonCancelar.dispatchEvent(new Event('click'));
  await tick();

  // La mutación NO debe haberse ejecutado
  assert.equal(cambioLlamado, 0, 'No debe llamarse a cambiarEstadoOptativa si se cancela');
  assert.equal(confirmDialog.open, false, 'El diálogo debe haberse cerrado');
  assert.equal(optativasMock[0].activo, true, 'El estado en datos debe permanecer inalterado');
});

test('optativas interacciones — Mutación ejecutada una sola vez y orden estricto de confirmación', async () => {
  const { doc } = crearEntornoOptativas();

  let pasos = [];

  globalThis.window.sgpa.listarOptativas = async () => ({
    ok: true,
    optativas: [
      { id: 3, curso: { id: 103, codigo: 'OPT-03', nombre: 'Bioética' }, tipo: 'DISCIPLINARIA', carreraOrigen: { id: 1, nombre: 'Informática' }, activo: false },
    ],
  });

  globalThis.window.sgpa.listarCarrerasElegiblesOptativa = async () => ({ ok: true, carreras: [{ id: 1, nombre: 'Informática' }] });

  globalThis.window.sgpa.cambiarEstadoOptativa = async (id, nuevoActivo) => {
    pasos.push(`mutacion-${id}-${nuevoActivo}`);
    return { ok: true };
  };

  iniciarOptativasPage();
  await tick();

  const botonEstado = doc.querySelector('[data-estado-optativa="3"]');
  botonEstado.dispatchEvent(new Event('click'));
  pasos.push('click-boton');
  await tick();

  const confirmDialog = doc.getElementById('sgpaConfirmDialog');
  pasos.push('dialogo-mostrado');

  const botonAceptar = confirmDialog.querySelector('#sgpaConfirmAccept');
  botonAceptar.dispatchEvent(new Event('click'));
  pasos.push('click-aceptar');
  await tick();
  await tick();

  // Verificar secuencia estricta: primero se muestra confirmación, luego el usuario acepta, luego se muta
  assert.deepEqual(pasos, [
    'click-boton',
    'dialogo-mostrado',
    'click-aceptar',
    'mutacion-3-true',
  ], 'La mutación debe ejecutarse únicamente después de que la confirmación fue aceptada');
});

test('optativas interacciones — Manejo de error cuando el servicio de cambio de estado falla', async () => {
  const { doc } = crearEntornoOptativas();

  globalThis.window.sgpa.listarOptativas = async () => ({
    ok: true,
    optativas: [
      { id: 4, curso: { id: 104, codigo: 'OPT-04', nombre: 'Ciberseguridad' }, tipo: 'DISCIPLINARIA', activo: true },
    ],
  });

  globalThis.window.sgpa.listarCarrerasElegiblesOptativa = async () => ({ ok: true, carreras: [] });

  globalThis.window.sgpa.cambiarEstadoOptativa = async () => {
    return { ok: false, message: 'Fallo al cambiar estado: la optativa está asignada en períodos activos' };
  };

  iniciarOptativasPage();
  await tick();

  const botonEstado = doc.querySelector('[data-estado-optativa="4"]');
  botonEstado.dispatchEvent(new Event('click'));
  await tick();

  const confirmDialog = doc.getElementById('sgpaConfirmDialog');
  confirmDialog.querySelector('#sgpaConfirmAccept').dispatchEvent(new Event('click'));
  await tick();
  await tick();

  // El mensaje de error debe presentarse en el contenedor de resultados
  const resultado = doc.getElementById('optativasResultado');
  assert.ok(
    resultado.textContent.includes('Fallo al cambiar estado'),
    'El error devuelto por el servicio debe informarse en la interfaz'
  );
});

test('optativas interacciones — Formulario de optativas: apertura, cierre y validaciones institucionales', async () => {
  const { doc } = crearEntornoOptativas({ rol: ROLES.COORDINADOR });

  globalThis.window.sgpa.listarOptativas = async () => ({ ok: true, optativas: [] });
  globalThis.window.sgpa.listarCarrerasElegiblesOptativa = async () => ({
    ok: true,
    carreras: [{ id: 1, nombre: 'Informática' }],
  });

  let creacionLlamada = 0;
  globalThis.window.sgpa.crearOptativa = async (datos) => {
    creacionLlamada++;
    return { ok: true, optativa: { id: 10, ...datos } };
  };

  iniciarOptativasPage();
  await tick();

  // 1. Apertura con botón Nueva optativa
  const btnNuevo = doc.getElementById('nuevaOptativa');
  assert.ok(btnNuevo, 'El botón Nueva optativa debe existir para usuarios autorizados');
  btnNuevo.dispatchEvent(new Event('click'));
  await tick();

  const dialog = doc.getElementById('optativaDialog');
  assert.equal(dialog.open, true, 'El diálogo de formulario debe estar abierto');

  // 2. Cierre mediante cancelar
  const btnCancelar = doc.getElementById('cancelarOptativa');
  btnCancelar.dispatchEvent(new Event('click'));
  assert.equal(dialog.open, false, 'El diálogo debe cerrarse al hacer clic en cancelar');

  // 3. Reabrir y probar validación de carrera requerida para disciplinaria
  btnNuevo.dispatchEvent(new Event('click'));
  await tick();

  const form = doc.getElementById('optativaForm');
  form.elements.tipo.value = 'DISCIPLINARIA';
  form.elements.carreraOrigenId.value = ''; // Falta carrera de origen obligatoria

  form.dispatchEvent(new Event('submit'));
  await tick();

  // No debe haberse llamado al servicio de creación
  assert.equal(creacionLlamada, 0, 'No debe llamarse a crearOptativa si falta la carrera de origen requerida');
  assert.equal(dialog.open, true, 'El diálogo debe permanecer abierto tras advertencia');

  // 4. Completar campos y guardar exitosamente
  form.elements.codigo.value = 'OPT-999';
  form.elements.nombre.value = 'Machine Learning';
  form.elements.carreraOrigenId.value = '1';
  form.elements.descripcion.value = 'Curso introductorio de ML';

  form.dispatchEvent(new Event('submit'));
  await tick();
  await tick();

  assert.equal(creacionLlamada, 1, 'Debe crearse la optativa con los datos válidos');
  assert.equal(dialog.open, false, 'El diálogo debe cerrarse tras guardar exitosamente');
});

test('optativas interacciones — Usuario sin permiso OPTATIVAS_GESTIONAR opera en modo solo lectura', async () => {
  const { doc } = crearEntornoOptativas({
    rol: ROLES.PROFESOR,
    permisos: [PERMISOS.OPTATIVAS_VER], // Sin OPTATIVAS_GESTIONAR
  });

  globalThis.window.sgpa.listarOptativas = async () => ({
    ok: true,
    optativas: [
      { id: 5, curso: { id: 105, codigo: 'OPT-05', nombre: 'Redes Avanzadas' }, tipo: 'DISCIPLINARIA', activo: true },
    ],
  });

  iniciarOptativasPage();
  await tick();

  // El botón "Nueva optativa" no debe haberse renderizado
  const btnNuevo = doc.getElementById('nuevaOptativa');
  assert.equal(btnNuevo, null, 'No debe existir el botón Nueva optativa para usuarios sin permiso');

  // Tampoco deben existir botones de cambiar estado ni de editar
  const btnEstado = doc.querySelector('[data-estado-optativa]');
  assert.equal(btnEstado, null, 'No deben existir botones de mutación de estado');

  const btnEditar = doc.querySelector('[data-editar-optativa]');
  assert.equal(btnEditar, null, 'No deben existir botones de edición');

  // La tabla solo muestra datos en modo lectura
  const resultado = doc.getElementById('optativasResultado');
  assert.ok(resultado.innerHTML.includes('Redes Avanzadas'), 'Debe mostrarse el curso en la tabla');
  assert.ok(!resultado.innerHTML.includes('sgpa-table-actions-cell'), 'No debe renderizarse la columna de acciones');
});
