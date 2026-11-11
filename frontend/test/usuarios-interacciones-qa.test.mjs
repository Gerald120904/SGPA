import test from 'node:test';
import assert from 'node:assert/strict';
import { UsuariosPage, iniciarUsuariosPage } from '../src/pages/usuarios/UsuariosPage.js';
import {
  MisAsistentesPage,
  iniciarMisAsistentesPage,
} from '../src/pages/usuarios/MisAsistentesPage.js';
import { guardarSesion, limpiarSesion } from '../src/app/session.js';
import { ROLES } from '../src/config/permissions.js';

/* =========================================================
   ENTORNO DOM SIMULADO PARA FLUJOS DE USUARIOS Y ASISTENTES
   ========================================================= */

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
    this.hidden = false;
    this.open = false;
    this.checked = false;
    this.indeterminate = false;
    this.noValidate = false;
    this.value = '';
    this.textContent = '';
    this._className = '';
    this._html = '';
    this.isConnected = true;
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
      toggle: (c, force) => {
        const s = set();
        const add = force === undefined ? !s.has(c) : Boolean(force);
        if (add) s.add(c);
        else s.delete(c);
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

  insertAdjacentHTML(_pos, html) {
    this._html += html;
    if (this.doc) {
      this.doc.indexFromHtml(this, this._html);
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, val) {
    this.attributes.set(name, String(val));
    if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      this.dataset[camel] = String(val);
    }
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  remove() {
    this.isConnected = false;
    const limpiarIds = (el) => {
      if (this.doc && el.id) {
        this.doc.byId.delete(el.id);
      }
      for (const ch of el.children || []) {
        limpiarIds(ch);
      }
    };
    limpiarIds(this);
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    if (this.doc && child.id) {
      this.doc.byId.set(child.id, child);
    }
    return child;
  }

  focus() {}

  reportValidity() {
    return true;
  }

  getBoundingClientRect() {
    return { left: 0, right: 100, top: 0, bottom: 100 };
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  async dispatch(type, event = {}) {
    event.target = event.target || this;
    event.preventDefault = event.preventDefault || (() => {});
    const handlers = this.listeners.get(type) || [];
    for (const fn of handlers) {
      await fn(event);
    }
    if (this.parentElement && type !== 'submit') {
      await this.parentElement.dispatch(type, event);
    }
  }

  matches(selector) {
    if (selector.startsWith('#')) {
      return this.id === selector.slice(1);
    }
    if (selector.startsWith('.')) {
      return this.classList.contains(selector.slice(1));
    }
    const attrMatch = selector.match(/^\[name="([^"]+)"\]$/);
    if (attrMatch) {
      return this.getAttribute('name') === attrMatch[1];
    }
    return false;
  }

  closest(selector) {
    let cur = this;
    while (cur) {
      if (selector.includes('[data-action]') && cur.dataset.action) return cur;
      if (selector === '.mis-asistentes-carrera' && cur.classList.contains('mis-asistentes-carrera')) {
        return cur;
      }
      if (selector === '#jerarquiaForm .usuarios-alcance' && cur.classList.contains('usuarios-alcance')) {
        return cur;
      }
      if (cur.matches(selector)) return cur;
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
        if (matchesSelector(ch, selector)) res.push(ch);
        walk(ch);
      }
    };
    walk(this);
    return res;
  }
}

function matchesSelector(el, selector) {
  const parts = selector.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  if (last === 'span') return el.tagName === 'SPAN';
  if (last.startsWith('#')) return el.id === last.slice(1);
  if (last.startsWith('.')) return el.classList.contains(last.slice(1));
  if (last === '[type="submit"]') return el.getAttribute('type') === 'submit';
  if (last === '[name="carrera"]') return el.getAttribute('name') === 'carrera';
  if (last === '[name="permiso"]') return el.getAttribute('name') === 'permiso';
  if (last === '[name="permiso"]:checked') {
    return el.getAttribute('name') === 'permiso' && el.checked;
  }
  if (last === '[name="seleccionar-todos-permisos"]') {
    return el.getAttribute('name') === 'seleccionar-todos-permisos';
  }
  if (last === '[name="jerarquia-permiso"]') return el.getAttribute('name') === 'jerarquia-permiso';
  if (last === '[name="jerarquia-todos-permisos"]') {
    return el.getAttribute('name') === 'jerarquia-todos-permisos';
  }
  const attr = last.match(/^\[data-action="([^"]+)"\]/);
  if (attr) return el.dataset.action === attr[1];
  return false;
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
        if (id === 'usuariosPage' || id === 'misAsistentesPage') {
          parent = el;
        }
      }
    }

    const buttonActionRegex = /<button([^>]*)data-action="([^"]+)"([^>]*)>([\s\S]*?)<\/button>/g;
    while ((m = buttonActionRegex.exec(html)) !== null) {
      const attrs = `${m[1]} ${m[3]}`;
      const action = m[2];
      const inner = m[4];
      const btn = new MockElement({ tagName: 'button', doc: this });
      btn.dataset.action = action;
      const userIdMatch = attrs.match(/data-user-id="([^"]+)"/);
      if (userIdMatch) btn.dataset.userId = userIdMatch[1];
      const idMatch = attrs.match(/data-id="([^"]+)"/);
      if (idMatch) btn.dataset.id = idMatch[1];
      const roleIdMatch = attrs.match(/data-role-id="([^"]*)"/);
      if (roleIdMatch) btn.dataset.roleId = roleIdMatch[1];
      btn.disabled = /\bdisabled\b/.test(attrs);
      const span = new MockElement({ tagName: 'span', doc: this });
      span.textContent = inner.replace(/<[^>]+>/g, '').trim();
      span.parentElement = btn;
      btn.children.push(span);
      btn.parentElement = parent;
      parent.children.push(btn);
    }

    const fieldsetRegex = /<fieldset class="mis-asistentes-carrera" data-carrera-id="(\d+)" data-carrera-nombre="([^"]+)">([\s\S]*?)<\/fieldset>/g;
    while ((m = fieldsetRegex.exec(html)) !== null) {
      const fs = new MockElement({ tagName: 'fieldset', doc: this });
      fs.className = 'mis-asistentes-carrera';
      fs.dataset.carreraId = m[1];
      fs.dataset.carreraNombre = m[2];
      fs.parentElement = parent;
      parent.children.push(fs);

      const fsBody = m[3];
      const carreraChecked = /name="carrera"[^>]*checked/.test(fsBody);
      const cbCarrera = new MockElement({ tagName: 'input', doc: this });
      cbCarrera.setAttribute('name', 'carrera');
      cbCarrera.value = m[1];
      cbCarrera.checked = carreraChecked;
      cbCarrera.parentElement = fs;
      fs.children.push(cbCarrera);

      const cbAll = new MockElement({ tagName: 'input', doc: this });
      cbAll.setAttribute('name', 'seleccionar-todos-permisos');
      cbAll.parentElement = fs;
      fs.children.push(cbAll);

      const permRegex = /<input type="checkbox" name="permiso" value="([^"]+)"([^>]*)>/g;
      let pm;
      while ((pm = permRegex.exec(fsBody)) !== null) {
        const cbPerm = new MockElement({ tagName: 'input', doc: this });
        cbPerm.setAttribute('name', 'permiso');
        cbPerm.value = pm[1];
        cbPerm.checked = /\bchecked\b/.test(pm[2]);
        cbPerm.parentElement = fs;
        fs.children.push(cbPerm);
      }
    }

    if (html.includes('id="formAsistente"')) {
      const form = this.byId.get('formAsistente');
      if (form) {
        form.children = parent.children.filter((c) => c !== form);
        form.children.forEach((c) => {
          c.parentElement = form;
        });
        const submit = new MockElement({ tagName: 'button', doc: this });
        submit.setAttribute('type', 'submit');
        submit.parentElement = form;
        form.children.push(submit);
      }
    }
  }
}

function setupEnv(sgpaOverrides = {}) {
  const doc = new MockDocument();
  global.document = doc;
  global.FormData = class MockFormData {
    constructor(form) {
      this._form = form;
    }
    get() {
      return '';
    }
    getAll() {
      return [];
    }
  };
  global.window = {
    lucide: { createIcons: () => {} },
    sgpa: sgpaOverrides,
  };
  return doc;
}

function mountPage(doc, html) {
  const container = new MockElement({ id: 'appRoot', doc });
  container.innerHTML = html;
  doc.body.appendChild(container);
  return container;
}

test('UsuariosPage — carga catálogo, filtro en vivo y consulta de accesos en modo solo lectura', async () => {
  let revocarLlamado = false;
  const doc = setupEnv({
    listarRoles: async () => ({
      ok: true,
      data: [{ id: 1, nombre: ROLES.COORDINADOR, descripcion: 'Coordina carrera' }],
    }),
    listarCarreras: async () => ({
      ok: true,
      carreras: [{ id: 10, codigo: 'INF', nombre: 'Ingeniería en Sistemas', activo: true }],
    }),
    listarCatalogoPermisos: async () => ({ ok: true, permisos: ['CURSOS_VER', 'CURSOS_GESTIONAR'] }),
    listarPlantillasPermisos: async () => ({ ok: true, plantillas: {} }),
    listarUsuarios: async () => ({
      ok: true,
      usuarios: [
        {
          id: 7,
          cedula: '501110222',
          nombres: 'Elena',
          apellido1: 'Rojas',
          correo: 'elena@una.ac.cr',
          roles: [{ id: 1, nombre: ROLES.COORDINADOR }],
          activo: true,
        },
      ],
    }),
    obtenerUsuario: async () => ({
      ok: true,
      data: {
        id: 7,
        cedula: '501110222',
        nombres: 'Elena',
        apellido1: 'Rojas',
        correo: 'elena@una.ac.cr',
        roles: [{ id: 1, nombre: ROLES.COORDINADOR }],
        activo: true,
      },
    }),
    listarPermisosUsuario: async () => ({ ok: true, permisos: ['CURSOS_VER'] }),
    obtenerCoordinadorJerarquia: async () => ({
      ok: false,
      message: 'Sin alcance disponible en consulta',
    }),
    revocarRolUsuario: async () => {
      revocarLlamado = true;
      return { ok: true };
    },
  });

  mountPage(doc, UsuariosPage());
  await iniciarUsuariosPage();

  const content = doc.getElementById('usuariosContent');
  assert.match(content.innerHTML, /Elena Rojas/);
  assert.equal(doc.getElementById('usuariosContador').textContent, '1 usuario');

  const buscar = doc.getElementById('usuariosBuscar');
  buscar.value = 'inexistente';
  await doc.getElementById('usuariosPage').dispatch('input', { target: buscar });
  assert.match(content.innerHTML, /No hay usuarios que coincidan con la búsqueda/);
  assert.equal(doc.getElementById('usuariosContador').textContent, '0 de 1 usuarios');

  buscar.value = '';
  await doc.getElementById('usuariosPage').dispatch('input', { target: buscar });
  const btnVer = content.querySelector('[data-action="ver-roles-permisos"]');
  assert.ok(btnVer);
  await doc.getElementById('usuariosPage').dispatch('click', { target: btnVer });

  const dialogContent = doc.getElementById('usuarioDialogContent');
  assert.equal(doc.getElementById('usuarioDialog').open, true);
  assert.match(dialogContent.innerHTML, /usuarioConsultaAccesosForm/);
  assert.match(dialogContent.innerHTML, /Sin alcance disponible en consulta/);
  assert.doesNotMatch(dialogContent.innerHTML, /data-action="guardar-permisos"/);
  assert.equal(revocarLlamado, false);
});

test('UsuariosPage — error al cargar módulo muestra alerta institucional en contenido', async () => {
  const doc = setupEnv({
    listarRoles: async () => ({ ok: false, message: 'Servicio de roles caído' }),
    listarCarreras: async () => ({ ok: true, carreras: [] }),
    listarCatalogoPermisos: async () => ({ ok: true, permisos: [] }),
    listarPlantillasPermisos: async () => ({ ok: true, plantillas: {} }),
    listarUsuarios: async () => ({ ok: true, usuarios: [] }),
  });

  mountPage(doc, UsuariosPage());
  await iniciarUsuariosPage();

  assert.match(doc.getElementById('usuariosFeedback').textContent, /Servicio de roles caído/);
  assert.match(doc.getElementById('usuariosContent').innerHTML, /No fue posible cargar Usuarios/);
});

test('MisAsistentesPage — modo asistente (solo lectura) oculta controles de gestión y delegación', async () => {
  guardarSesion({
    usuario: {
      id: 99,
      nombres: 'Sofía',
      apellido1: 'Méndez',
      rolActivo: ROLES.ASISTENTE_ESTUDIANTIL,
      roles: [ROLES.ASISTENTE_ESTUDIANTIL],
    },
  });

  let llamoListarAsistentes = false;
  const doc = setupEnv({
    listarMisSolicitudesCambio: async () => ({
      ok: true,
      data: [
        {
          id: 3,
          modulo: 'CURSOS',
          operacion: 'ACTUALIZAR',
          estado: 'PENDIENTE',
          carreraId: 1,
          createdAt: '2026-03-01T12:00:00.000Z',
          datosPropuestos: { nombre: 'Nuevo nombre curso' },
        },
      ],
    }),
    listarMisAsistentes: async () => {
      llamoListarAsistentes = true;
      return { ok: true, data: [] };
    },
  });

  mountPage(doc, MisAsistentesPage());
  await iniciarMisAsistentesPage();

  assert.equal(llamoListarAsistentes, false);
  assert.equal(doc.getElementById('crearAsistenteButton').hidden, true);
  const contenido = doc.getElementById('misAsistentesContenido').innerHTML;
  assert.match(contenido, /Mis solicitudes/);
  assert.doesNotMatch(contenido, /data-action="aprobar"/);
  assert.doesNotMatch(contenido, /data-action="editar-asistente"/);
  assert.doesNotMatch(contenido, /data-action="procesar-invitacion"/);
  limpiarSesion();
});

test('MisAsistentesPage — estados de invitación, envío autorizado, errores y edición de asistente', async () => {
  guardarSesion({
    usuario: {
      id: 1,
      nombres: 'Carlos',
      apellido1: 'Coord',
      rolActivo: ROLES.COORDINADOR,
      roles: [ROLES.COORDINADOR],
    },
  });

  let procesoCalls = 0;
  let resolverProceso;
  let edicionGuardada = null;

  const doc = setupEnv({
    listarMisAlcancesJerarquia: async () => ({
      ok: true,
      data: [{ id: 10, nombre: 'Informática', permisos: ['CURSOS_VER', 'CURSOS_GESTIONAR'] }],
    }),
    listarMisAsistentes: async () => ({
      ok: true,
      data: [
        {
          id: 50,
          nombres: 'Ana',
          apellido1: 'López',
          correo: 'ana@una.ac.cr',
          activo: false,
          invitacion: { estado: 'PENDIENTE', puedeProcesar: true },
        },
        {
          id: 51,
          nombres: 'Luis',
          apellido1: 'Díaz',
          correo: 'luis@una.ac.cr',
          activo: false,
          invitacion: { estado: 'INCIERTA', puedeProcesar: false },
        },
      ],
    }),
    listarSolicitudesPendientesCambio: async () => ({ ok: true, data: [] }),
    obtenerConfiguracionAsistentesJerarquia: async () => ({
      ok: true,
      data: { envioInvitacionHabilitado: true },
    }),
    procesarInvitacionAsistenteJerarquia: async () => {
      procesoCalls += 1;
      return new Promise((resolve) => {
        resolverProceso = resolve;
      });
    },
    obtenerAsistenteJerarquia: async (id) => {
      if (id === 51) return { ok: false, message: 'No autorizado para editar' };
      return {
        ok: true,
        data: { carreras: [{ carreraId: 10, permisos: ['CURSOS_VER'] }] },
      };
    },
    configurarAsistenteJerarquia: async (id, carreras) => {
      edicionGuardada = { id, carreras };
      return { ok: true, data: {} };
    },
  });

  mountPage(doc, MisAsistentesPage());
  await iniciarMisAsistentesPage();

  const contenido = doc.getElementById('misAsistentesContenido');
  assert.match(contenido.innerHTML, /Invitación pendiente/);
  assert.match(contenido.innerHTML, /Resultado incierto/);

  const botonesProcesar = contenido.querySelectorAll('[data-action="procesar-invitacion"]');
  assert.equal(botonesProcesar.length, 1);
  assert.equal(botonesProcesar[0].dataset.id, '50');

  const pagina = doc.getElementById('misAsistentesPage');
  const primerClick = pagina.dispatch('click', { target: botonesProcesar[0] });
  await pagina.dispatch('click', { target: botonesProcesar[0] });
  assert.equal(procesoCalls, 1);

  resolverProceso({ ok: true, data: { estado: 'INCIERTA' } });
  await primerClick;
  assert.match(
    doc.getElementById('misAsistentesFeedback').textContent,
    /No se pudo confirmar el envío/,
  );

  // Error al abrir edición de asistente 51
  const btnsEditar = contenido.querySelectorAll('[data-action="editar-asistente"]');
  await pagina.dispatch('click', { target: btnsEditar[1] });
  assert.match(doc.getElementById('misAsistentesFeedback').textContent, /No autorizado para editar/);

  // Edición válida de asistente 50
  await pagina.dispatch('click', { target: btnsEditar[0] });
  assert.equal(doc.getElementById('misAsistentesDialog').open, true);
  const form = doc.getElementById('formAsistente');
  assert.equal(form.dataset.id, '50');
  await pagina.dispatch('submit', { target: form });

  assert.deepEqual(edicionGuardada, {
    id: 50,
    carreras: [{ carreraId: 10, permisos: ['CURSOS_VER'] }],
  });
  assert.equal(doc.getElementById('misAsistentesDialog').open, false);
  assert.match(doc.getElementById('misAsistentesFeedback').textContent, /Delegación actualizada/);
  limpiarSesion();
});

test('UsuariosPage — revocación de rol respeta cancelación y ejecuta con firma al confirmar', async () => {
  let revocarArgs = null;
  const doc = setupEnv({
    listarRoles: async () => ({ ok: true, data: [{ id: 2, nombre: ROLES.COORDINADOR }] }),
    listarCarreras: async () => ({
      ok: true,
      carreras: [{ id: 1, codigo: 'INF', nombre: 'Informática', activo: true }],
    }),
    listarCatalogoPermisos: async () => ({ ok: true, permisos: ['CURSOS_VER'] }),
    listarPlantillasPermisos: async () => ({ ok: true, plantillas: {} }),
    listarUsuarios: async () => ({
      ok: true,
      usuarios: [
        {
          id: 7,
          cedula: '501110222',
          nombres: 'Elena',
          apellido1: 'Rojas',
          correo: 'elena@una.ac.cr',
          roles: [{ id: 2, nombre: ROLES.COORDINADOR }],
          activo: true,
        },
      ],
    }),
    obtenerUsuario: async () => ({
      ok: true,
      data: {
        id: 7,
        cedula: '501110222',
        nombres: 'Elena',
        apellido1: 'Rojas',
        correo: 'elena@una.ac.cr',
        roles: [{ id: 2, nombre: ROLES.COORDINADOR }],
        activo: true,
      },
    }),
    listarPermisosUsuario: async () => ({ ok: true, permisos: [] }),
    previsualizarRevocacionRol: async () => ({
      ok: true,
      data: {
        rol: ROLES.COORDINADOR,
        usuario: 'Elena Rojas',
        permisosRevocados: [{ carreraId: 1, permiso: 'CURSOS_VER' }],
        asistentesAfectados: [],
        totalAsistentes: 0,
        totalAsistentesActivos: 0,
        sesionesInvalidadas: [],
        totalSolicitudes: 0,
        firma: 'firma-segura-123',
      },
    }),
    revocarRolUsuario: async (id, rolId, firma) => {
      revocarArgs = { id, rolId, firma };
      return { ok: true };
    },
  });

  mountPage(doc, UsuariosPage());
  await iniciarUsuariosPage();

  const pagina = doc.getElementById('usuariosPage');
  const btnEditar = doc.getElementById('usuariosContent').querySelector('[data-action="editar"]');
  await pagina.dispatch('click', { target: btnEditar });

  const btnRevocar = doc.getElementById('usuarioDialogContent').querySelector('[data-action="revocar-rol"]');
  assert.ok(btnRevocar);

  const esperarConfirmDialog = async (botonId) => {
    for (let i = 0; i < 20; i += 1) {
      const el = doc.getElementById(botonId);
      if (el) return el;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error(`No apareció ${botonId}`);
  };

  // Primer intento: usuario cancela el diálogo de confirmación
  const promesaCancel = pagina.dispatch('click', { target: btnRevocar });
  const btnCancelar = await esperarConfirmDialog('sgpaConfirmCancel');
  await btnCancelar.dispatch('click', {});
  await promesaCancel;
  assert.equal(revocarArgs, null);

  // Segundo intento: usuario confirma la revocación
  const promesaConfirm = pagina.dispatch('click', { target: btnRevocar });
  const btnAceptar = await esperarConfirmDialog('sgpaConfirmAccept');
  await btnAceptar.dispatch('click', {});
  await promesaConfirm;
  assert.deepEqual(revocarArgs, { id: 7, rolId: 2, firma: 'firma-segura-123' });
});
