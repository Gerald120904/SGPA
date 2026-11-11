import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FormulariosEstudiantesPage,
  iniciarFormulariosEstudiantesPage,
} from '../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js';
import { guardarSesion, limpiarSesion } from '../src/app/session.js';
import { PERMISOS, ROLES } from '../src/config/permissions.js';

class MockElement {
  constructor({ id = '', tagName = 'div', doc = null } = {}) {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.doc = doc;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.parentElement = null;
    this.disabled = false;
    this.open = false;
    this.textContent = '';
    this._className = '';
    this._html = '';
  }

  get className() {
    return this._className;
  }

  set className(val) {
    this._className = String(val || '');
  }

  get classList() {
    const self = this;
    const set = () => new Set(self._className.split(/\s+/).filter(Boolean));
    const sync = (s) => {
      self._className = [...s].join(' ');
    };
    return {
      add: (...cls) => {
        const s = set();
        cls.forEach((c) => s.add(c));
        sync(s);
      },
      remove: (...cls) => {
        const s = set();
        cls.forEach((c) => s.delete(c));
        sync(s);
      },
      contains: (c) => set().has(c),
    };
  }

  get innerHTML() {
    return this._html;
  }

  set innerHTML(html) {
    this._html = String(html || '');
    this.children = [];
    if (this.doc) {
      this.doc.indexFromHtml(this, this._html);
    }
  }

  getAttribute(name) {
    if (this.attributes.has(name)) return this.attributes.get(name);
    if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      if (this.dataset[camel] !== undefined) return String(this.dataset[camel]);
    }
    return null;
  }

  setAttribute(name, val) {
    this.attributes.set(name, String(val));
    if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      this.dataset[camel] = String(val);
    }
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    if (this.doc && child.id) this.doc.byId.set(child.id, child);
    return child;
  }

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  remove() {
    const limpiar = (el) => {
      if (this.doc && el.id) this.doc.byId.delete(el.id);
      for (const ch of el.children || []) limpiar(ch);
    };
    limpiar(this);
  }

  getBoundingClientRect() {
    return { left: 0, right: 100, top: 0, bottom: 100 };
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  removeEventListener(type, fn) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      list.filter((h) => h !== fn),
    );
  }

  async dispatch(type, event = {}) {
    event.target = event.target || this;
    event.preventDefault = event.preventDefault || (() => {});
    for (const fn of this.listeners.get(type) || []) {
      await fn(event);
    }
    if (this.parentElement) {
      await this.parentElement.dispatch(type, event);
    }
  }

  closest(selector) {
    let cur = this;
    while (cur) {
      if (selector === '[data-action][data-id]' && cur.dataset.action && cur.dataset.id) {
        return cur;
      }
      if (selector === 'tr' && cur.tagName === 'TR') return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const res = [];
    const walk = (el) => {
      for (const ch of el.children) {
        if (selector === 'button' && ch.tagName === 'BUTTON') res.push(ch);
        else if (selector.startsWith('#') && ch.id === selector.slice(1)) res.push(ch);
        else if (selector.startsWith('.') && ch.classList.contains(selector.slice(1))) res.push(ch);
        else if (selector.startsWith('[data-action=')) {
          const act = selector.match(/^\[data-action="([^"]+)"\]/)?.[1];
          if (act && ch.dataset.action === act) res.push(ch);
        }
        walk(ch);
      }
    };
    walk(this);
    return res;
  }
}

class MockDocument {
  constructor() {
    this.byId = new Map();
    this.body = new MockElement({ id: 'body', tagName: 'body', doc: this });
  }

  createElement(tag) {
    return new MockElement({ tagName: tag, doc: this });
  }

  getElementById(id) {
    return this.byId.get(id) || null;
  }

  querySelectorAll() {
    return [];
  }

  indexFromHtml(root, html) {
    let parent = root;
    const idRegex = /id="([^"]+)"/g;
    let m;
    while ((m = idRegex.exec(html)) !== null) {
      const id = m[1];
      let el = this.byId.get(id);
      if (!el || el.parentElement !== parent) {
        el = new MockElement({ id, doc: this });
        el.parentElement = parent;
        parent.children.push(el);
        this.byId.set(id, el);
        if (id === 'formulariosEstudiantesPage') parent = el;
      }
    }

    const rowBtnRegex = /<button([\s\S]*?)data-action="([^"]+)"([\s\S]*?)data-id="(\d+)"([\s\S]*?)>/g;
    while ((m = rowBtnRegex.exec(html)) !== null) {
      const btn = new MockElement({ tagName: 'button', doc: this });
      btn.dataset.action = m[2];
      btn.dataset.id = m[4];
      btn.parentElement = parent;
      parent.children.push(btn);
    }

    const respBtnRegex = /<button([\s\S]*?)class="([^"]*btn-accion-(?:aprobar|rechazar)-resp[^"]*)"([\s\S]*?)data-id="(\d+)"([\s\S]*?)data-estudiante="([^"]*)"/g;
    while ((m = respBtnRegex.exec(html)) !== null) {
      const tr = new MockElement({ tagName: 'tr', doc: this });
      tr.parentElement = parent;
      parent.children.push(tr);

      const btn = new MockElement({ tagName: 'button', doc: this });
      btn.className = m[2];
      btn.dataset.id = m[4];
      btn.dataset.estudiante = m[6];
      btn.parentElement = tr;
      tr.children.push(btn);
    }
  }
}

function setupEnv(sgpa = {}) {
  const doc = new MockDocument();
  global.document = doc;
  let copiedText = null;
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      clipboard: {
        writeText: async (text) => {
          copiedText = text;
        },
      },
    },
    configurable: true,
  });
  global.window = {
    lucide: { createIcons: () => {} },
    addEventListener: () => {},
    setTimeout,
    clearTimeout,
    prompt: () => null,
    sgpa,
  };
  const root = new MockElement({ id: 'appRoot', doc });
  root.innerHTML = FormulariosEstudiantesPage();
  doc.body.appendChild(root);
  return { doc, getCopied: () => copiedText };
}

async function esperarConfirm(doc, botonId) {
  for (let i = 0; i < 20; i += 1) {
    const el = doc.getElementById(botonId);
    if (el) return el;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`No apareció ${botonId}`);
}

test('FormulariosEstudiantesPage — carga estado Google, oculta acciones en modo consulta y copia enlace seguro', async () => {
  guardarSesion({
    usuario: {
      rolActivo: ROLES.COORDINADOR,
      roles: [ROLES.COORDINADOR],
      permisos: [PERMISOS.FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS],
    },
  });

  let urlAbierta = null;
  const { doc, getCopied } = setupEnv({
    obtenerEstadoGoogleFormularios: async () => ({
      ok: true,
      data: { conectado: false, estado: 'REQUIERE_REAUTENTICACION' },
    }),
    listarFormulariosEstudiantes: async () => ({
      ok: true,
      data: [
        {
          id: 5,
          titulo: 'Prematrícula 2027',
          proveedor: 'INTERNO',
          estado: 'PUBLICADO',
          responderUri: 'https://sgpa.example.invalid/formularios/p/tok',
          carrera: { nombre: 'Ingeniería' },
          planEstudio: { nombre: 'Plan 2024' },
          totalRespuestas: 2,
          pendientes: 1,
          requierenRevision: 0,
        },
      ],
    }),
    obtenerUrlPublicaFormulario: async (uri) => ({
      ok: true,
      url: `${uri}?seguro=1`,
    }),
    obtenerTicketVistaPreviaFormulario: async () => ({
      data: { url: 'https://sgpa.example.invalid/formularios/p/tok?ticket=xyz' },
    }),
    abrirEnlaceFormularioEstudiantes: async (url) => {
      urlAbierta = url;
      return { ok: true };
    },
  });

  await iniciarFormulariosEstudiantesPage();

  assert.match(doc.getElementById('estadoGoogleFormularios').innerHTML, /Google requiere reconexión/);
  assert.equal(doc.getElementById('accionesFormularios').innerHTML.trim(), '');

  const content = doc.getElementById('formulariosEstudiantesContent');
  assert.match(content.innerHTML, /Prematrícula 2027/);
  assert.doesNotMatch(content.innerHTML, /data-action="cerrar"/);
  assert.doesNotMatch(content.innerHTML, /data-action="publicar"/);

  const btnCopiar = content.querySelector('[data-action="copiar-enlace"]');
  await content.dispatch('click', { target: btnCopiar });
  assert.equal(getCopied(), 'https://sgpa.example.invalid/formularios/p/tok?seguro=1');

  const btnPreview = content.querySelector('[data-action="vista-previa"]');
  await content.dispatch('click', { target: btnPreview });
  assert.equal(urlAbierta, 'https://sgpa.example.invalid/formularios/p/tok?ticket=xyz');

  // El fallo al generar el ticket no debe abrir el formulario público normal.
  const previewOriginal = urlAbierta;
  global.window.sgpa.obtenerTicketVistaPreviaFormulario = async () => ({
    ok: false,
    message: 'No se pudo emitir el ticket.',
  });
  await content.dispatch('click', { target: btnPreview });
  assert.equal(urlAbierta, previewOriginal);
  assert.match(
    doc.getElementById('sgpaAlertDialog').innerHTML,
    /No fue posible abrir la vista previa/,
  );

  limpiarSesion();
});

test('FormulariosEstudiantesPage — publicación/cierre con confirmación y bandeja de respuestas', async () => {
  guardarSesion({
    usuario: {
      rolActivo: ROLES.COORDINADOR,
      roles: [ROLES.COORDINADOR],
      permisos: [
        PERMISOS.FORMULARIOS_ESTUDIANTES_CREAR,
        PERMISOS.FORMULARIOS_ESTUDIANTES_GESTIONAR,
        PERMISOS.FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS,
      ],
    },
  });

  let estadoActual = 'CREADO';
  let publicoLlamado = 0;
  let aprobadoId = null;
  let rechazadoPayload = null;

  const { doc } = setupEnv({
    obtenerEstadoGoogleFormularios: async () => ({
      ok: true,
      data: { conectado: true, googleEmail: 'coord@una.ac.cr' },
    }),
    listarFormulariosEstudiantes: async () => ({
      ok: true,
      data: [
        {
          id: 9,
          titulo: 'Formulario Interno',
          proveedor: 'INTERNO',
          estado: estadoActual,
          responderUri: 'https://sgpa.example.invalid/formularios/p/abc',
          carrera: { nombre: 'Sistemas' },
          planEstudio: { nombre: 'Plan 2025' },
        },
      ],
    }),
    publicarFormularioEstudiantes: async () => {
      publicoLlamado += 1;
      estadoActual = 'PUBLICADO';
      return { ok: true };
    },
    listarRespuestasFormularioEstudiantes: async () => ({
      ok: true,
      data: [
        {
          id: 77,
          estado: 'PENDIENTE',
          datosNormalizadosJson: {
            primerNombre: 'Sofía',
            primerApellido: 'Vega',
            identificacion: '501230456',
            correoEstudiantil: 'sofia@est.una.ac.cr',
            asignaturasAprobadas: [{ codigo: 'EIF-200', nombre: 'Estructuras' }],
          },
        },
      ],
    }),
    aceptarSolicitudFormulario: async (id) => {
      aprobadoId = id;
      return { ok: true };
    },
    rechazarSolicitudFormulario: async (id, motivo) => {
      rechazadoPayload = { id, motivo };
      return { ok: true };
    },
  });

  await iniciarFormulariosEstudiantesPage();
  const content = doc.getElementById('formulariosEstudiantesContent');

  // 1. Publicar: cancelar primero, confirmar después
  const btnPublicar = content.querySelector('[data-action="publicar"]');
  const pCancel = content.dispatch('click', { target: btnPublicar });
  (await esperarConfirm(doc, 'sgpaConfirmCancel')).dispatch('click', {});
  await pCancel;
  assert.equal(publicoLlamado, 0);

  const pConfirm = content.dispatch('click', { target: btnPublicar });
  (await esperarConfirm(doc, 'sgpaConfirmAccept')).dispatch('click', {});
  await pConfirm;
  assert.equal(publicoLlamado, 1);

  // 2. Ver respuestas y validar rechazo con motivo vacío vs válido
  const btnResp = content.querySelector('[data-action="ver-respuestas"]');
  await content.dispatch('click', { target: btnResp });
  const respBox = doc.getElementById('respuestasFormularioContent');
  assert.match(respBox.innerHTML, /Sofía Vega/);

  global.window.prompt = () => '   ';
  const btnRechazar = respBox.querySelector('.btn-accion-rechazar-resp');
  await btnRechazar.dispatch('click', {});
  assert.equal(rechazadoPayload, null);
  assert.match(doc.getElementById('sgpaAlertDialog').innerHTML, /Motivo obligatorio/);

  global.window.prompt = () => 'Certificación incompleta';
  await btnRechazar.dispatch('click', {});
  assert.deepEqual(rechazadoPayload, { id: 77, motivo: 'Certificación incompleta' });

  // 3. Aprobar respuesta
  const btnAprobar = respBox.querySelector('.btn-accion-aprobar-resp');
  const pAprobar = btnAprobar.dispatch('click', {});
  (await esperarConfirm(doc, 'sgpaConfirmAccept')).dispatch('click', {});
  await pAprobar;
  assert.equal(aprobadoId, 77);

  limpiarSesion();
});

test('FormularioRespuestasDialog — una respuesta tardía no reemplaza el formulario abierto después', async () => {
  guardarSesion({
    usuario: {
      rolActivo: ROLES.COORDINADOR,
      roles: [ROLES.COORDINADOR],
      permisos: [PERMISOS.FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS],
    },
  });

  let resolverPrimeraConsulta;
  const { doc } = setupEnv({
    obtenerEstadoGoogleFormularios: async () => ({ ok: true, data: { conectado: false } }),
    listarFormulariosEstudiantes: async () => ({
      ok: true,
      data: [
        { id: 31, titulo: 'Formulario A', proveedor: 'INTERNO', estado: 'PUBLICADO' },
        { id: 32, titulo: 'Formulario B', proveedor: 'INTERNO', estado: 'PUBLICADO' },
      ],
    }),
    listarRespuestasFormularioEstudiantes: async (id) => {
      if (id === 31) {
        return new Promise((resolve) => {
          resolverPrimeraConsulta = resolve;
        });
      }
      return {
        ok: true,
        data: [
          {
            id: 320,
            estado: 'PENDIENTE',
            datosNormalizadosJson: { primerNombre: 'Brenda', primerApellido: 'B' },
          },
        ],
      };
    },
  });

  await iniciarFormulariosEstudiantesPage();
  const content = doc.getElementById('formulariosEstudiantesContent');
  const botones = content.querySelectorAll('[data-action="ver-respuestas"]');
  assert.equal(botones.length, 2);

  const consultaA = content.dispatch('click', { target: botones[0] });
  for (let intento = 0; intento < 20 && !resolverPrimeraConsulta; intento += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(typeof resolverPrimeraConsulta, 'function');

  await doc.getElementById('cerrarRespuestasFormularioButton').dispatch('click', {});
  await content.dispatch('click', { target: botones[1] });
  const respuestas = doc.getElementById('respuestasFormularioContent');
  assert.match(respuestas.innerHTML, /Brenda B/);

  resolverPrimeraConsulta({
    ok: true,
    data: [
      {
        id: 310,
        estado: 'PENDIENTE',
        datosNormalizadosJson: { primerNombre: 'Alicia', primerApellido: 'A' },
      },
    ],
  });
  await consultaA;

  assert.match(respuestas.innerHTML, /Brenda B/);
  assert.doesNotMatch(respuestas.innerHTML, /Alicia A/);
  doc.getElementById('cerrarRespuestasFormularioButton')?.dispatch('click', {});
  limpiarSesion();
});

test('FormularioRespuestasDialog — informa un error de actualización sin ocultar la aprobación', async () => {
  guardarSesion({
    usuario: {
      rolActivo: ROLES.COORDINADOR,
      roles: [ROLES.COORDINADOR],
      permisos: [PERMISOS.FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS],
    },
  });

  let consultas = 0;
  let aprobacionRealizada = false;
  const { doc } = setupEnv({
    obtenerEstadoGoogleFormularios: async () => ({ ok: true, data: { conectado: false } }),
    listarFormulariosEstudiantes: async () => ({
      ok: true,
      data: [{ id: 41, titulo: 'Formulario de prueba', proveedor: 'INTERNO', estado: 'PUBLICADO' }],
    }),
    listarRespuestasFormularioEstudiantes: async () => {
      consultas += 1;
      return consultas === 1
        ? {
            ok: true,
            data: [{
              id: 410,
              estado: 'PENDIENTE',
              datosNormalizadosJson: { primerNombre: 'Ana', primerApellido: 'A' },
            }],
          }
        : { ok: false, message: 'Error de lectura al actualizar.' };
    },
    aceptarSolicitudFormulario: async () => {
      aprobacionRealizada = true;
      return { ok: true };
    },
  });

  await iniciarFormulariosEstudiantesPage();
  const content = doc.getElementById('formulariosEstudiantesContent');
  await content.dispatch('click', {
    target: content.querySelector('[data-action="ver-respuestas"]'),
  });

  const aprobar = doc
    .getElementById('respuestasFormularioContent')
    .querySelector('.btn-accion-aprobar-resp');
  const aprobacion = aprobar.dispatch('click', {});
  (await esperarConfirm(doc, 'sgpaConfirmAccept')).dispatch('click', {});
  await aprobacion;

  const alert = doc.getElementById('sgpaAlertDialog').innerHTML;
  assert.equal(aprobacionRealizada, true);
  assert.match(alert, /No fue posible actualizar las respuestas/);
  assert.match(alert, /Error de lectura al actualizar/);
  limpiarSesion();
});
