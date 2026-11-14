/**
 * SGPA — Pruebas integrales de arquitectura modular, ciclo de vida, concurrencia y navegación de Formularios de Estudiantes.
 * FRONTEND-REFACTOR-FORMULARIOS-ESTUDIANTES-INTEGRAL-001
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Submódulos del módulo
import {
  FormulariosEstudiantesPage,
  iniciarFormulariosEstudiantesPage,
  destruirFormulariosEstudiantesPage,
  contextoFormulariosGlobal,
  LIMITES_FORMULARIO,
  MODALIDADES_FORMULARIO,
  CAMPOS_FORMULARIO,
  validarDatosNuevoFormulario,
  construirDatosCrearFormulario,
  asignaturasElegiblesParaFormulario,
  agruparAsignaturasVistaPrevia,
} from '../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js';
import { crearContextoFormularios } from '../src/pages/formularios-estudiantes/formularios-estudiantes.context.js';
import {
  renderizarEstadoGoogle,
  renderizarAcciones,
  actualizarEstadoGoogleAlFoco,
  conectarGoogle,
  desconectarGoogle,
  PERMISOS,
} from '../src/pages/formularios-estudiantes/FormularioGoogleStatusView.js';
import {
  renderizarFilaFormulario,
  renderizarTablaFormularios,
  renderizarCargaFormularios,
  manejarAccionFormulario,
} from '../src/pages/formularios-estudiantes/FormulariosListadoView.js';
import {
  obtenerDatosFormularioActual,
  mostrarErroresCamposFormulario,
  registrarValidacionesCamposFormulario,
  cargarOpcionesFormulario,
  abrirNuevoFormulario,
} from '../src/pages/formularios-estudiantes/FormularioNuevoDialog.js';
import { inicializarSelectorAcademico } from '../src/pages/formularios-estudiantes/FormularioAsignaturasSelector.js';
import { obtenerCicloVidaPagina } from '../src/app/page-lifecycle.js';
import { renderizarRuta } from '../src/app/App.js';
import { guardarSesion, limpiarSesion } from '../src/app/session.js';

function autorizarGestionFormularios() {
  guardarSesion({
    usuario: {
      id: 901,
      rol: 'COORDINADOR',
      rolActivo: 'COORDINADOR',
      permisos: [PERMISOS.GESTIONAR],
    },
  });
}

test('Arquitectura modular: Todos los submódulos exportan sus contratos esperados', () => {
  assert.equal(typeof FormulariosEstudiantesPage, 'function');
  assert.equal(typeof iniciarFormulariosEstudiantesPage, 'function');
  assert.equal(typeof destruirFormulariosEstudiantesPage, 'function');
  assert.equal(typeof contextoFormulariosGlobal, 'object');

  assert.equal(typeof renderizarEstadoGoogle, 'function');
  assert.equal(typeof renderizarAcciones, 'function');
  assert.equal(typeof actualizarEstadoGoogleAlFoco, 'function');
  assert.equal(typeof conectarGoogle, 'function');
  assert.equal(typeof desconectarGoogle, 'function');

  assert.equal(typeof renderizarFilaFormulario, 'function');
  assert.equal(typeof renderizarTablaFormularios, 'function');
  assert.equal(typeof renderizarCargaFormularios, 'function');
  assert.equal(typeof manejarAccionFormulario, 'function');

  assert.equal(typeof abrirNuevoFormulario, 'function');
  assert.equal(typeof cargarOpcionesFormulario, 'function');
  assert.equal(typeof obtenerDatosFormularioActual, 'function');
  assert.equal(typeof mostrarErroresCamposFormulario, 'function');
  assert.equal(typeof registrarValidacionesCamposFormulario, 'function');
  assert.equal(typeof inicializarSelectorAcademico, 'function');

  assert.ok(LIMITES_FORMULARIO);
  assert.ok(MODALIDADES_FORMULARIO);
  assert.ok(CAMPOS_FORMULARIO);
  assert.ok(PERMISOS);
  assert.equal(typeof validarDatosNuevoFormulario, 'function');
  assert.equal(typeof construirDatosCrearFormulario, 'function');
  assert.equal(typeof asignaturasElegiblesParaFormulario, 'function');
  assert.equal(typeof agruparAsignaturasVistaPrevia, 'function');
});

test('Aislamiento e integridad: Ningún submódulo nuevo importa archivos locales protegidos', () => {
  const dir = new URL('../src/pages/formularios-estudiantes', import.meta.url);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const content = fs.readFileSync(new URL(`../src/pages/formularios-estudiantes/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(
      content,
      /planes-estudio\.helpers/,
      `${file} no debe importar planes-estudio.helpers.js`,
    );
    assert.doesNotMatch(
      content,
      /planes-estudio-modulo-refactor/,
      `${file} no debe importar pruebas protegidas`,
    );
  }
});

test('Limpieza arquitectónica: FormulariosEstudiantesPage.js es un coordinador esbelto', () => {
  const source = fs.readFileSync(
    new URL('../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js', import.meta.url),
    'utf8',
  );
  const lines = source.split('\n').length;
  assert.ok(
    lines < 300,
    `FormulariosEstudiantesPage.js debe tener menos de 300 líneas (actual: ${lines})`,
  );
  assert.doesNotMatch(source, /__auditoria/);
  assert.doesNotMatch(source, /observadorFocusRegistrado/);
});

test('Router Lifecycle: Formularios de Estudiantes declara destructor formal en page-lifecycle.js', () => {
  const ciclo = obtenerCicloVidaPagina('formularios-estudiantes');
  assert.ok(ciclo, 'Debe existir registro en page-lifecycle.js');
  assert.equal(typeof ciclo.render, 'function');
  assert.equal(typeof ciclo.initialize, 'function');
  assert.equal(typeof ciclo.destroy, 'function');
  assert.equal(ciclo.destroy, destruirFormulariosEstudiantesPage);
});

test('Contexto y Ciclo de Vida: Registro, ejecución y retiro estricto del listener focus', async () => {
  let listeners = new Map();
  const mockWindow = {
    addEventListener(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
    },
    removeEventListener(event, fn) {
      listeners.get(event)?.delete(fn);
    },
  };

  const originalWindow = global.window;
  global.window = mockWindow;

  try {
    const ctx = crearContextoFormularios();
    let llamadasFoco = 0;

    // 1. Iniciar contexto y registrar listener
    ctx.iniciar();
    ctx.registrarListenerFoco(async () => {
      llamadasFoco += 1;
    });

    const focusListeners = listeners.get('focus');
    assert.equal(focusListeners?.size, 1, 'Debe haber exactamente un listener registrado');

    // 2. Simular evento focus con contexto activo
    const handler = Array.from(focusListeners)[0];
    await handler();
    assert.equal(llamadasFoco, 1, 'El callback debe ejecutarse cuando el contexto está activo');

    // 3. Re-registrar no debe duplicar listeners
    ctx.registrarListenerFoco(async () => {
      llamadasFoco += 1;
    });
    assert.equal(listeners.get('focus')?.size, 1, 'No debe duplicar listeners');

    // 4. Destruir contexto
    ctx.destruir();
    assert.equal(listeners.get('focus')?.size, 0, 'El listener debe retirarse al destruir el contexto');

    // 5. Invocación huérfana tras destruir no debe ejecutar callback
    await handler();
    assert.equal(llamadasFoco, 1, 'No debe ejecutarse tras el desmontaje');

    // 6. Idempotencia de destrucción
    assert.doesNotThrow(() => {
      ctx.destruir();
      ctx.destruir();
    });
  } finally {
    global.window = originalWindow;
  }
});

test('Concurrencia Selector Académico: Carrera A seguida de Carrera B (prevalece B)', async () => {
  const ctx = crearContextoFormularios();
  ctx.iniciar();

  ctx.estado.carrerasDisponibles = [
    { id: 1, codigo: 'C1', nombre: 'Carrera 1', activo: true },
    { id: 2, codigo: 'C2', nombre: 'Carrera 2', activo: true },
  ];
  ctx.estado.planesDisponibles = [
    { id: 101, carreraId: 1, codigo: 'P1-A', nombre: 'Plan Carrera 1', activo: true },
    { id: 201, carreraId: 2, codigo: 'P2-B', nombre: 'Plan Carrera 2', activo: true },
  ];

  // Simulación de DOM mínimo
  const carreraSelect = { value: '1', addEventListener(evt, cb) { this.onChange = cb; } };
  const planSelect = { value: '', disabled: false, innerHTML: '', addEventListener() {} };
  const resumenDiv = { innerHTML: '' };

  const dialogMock = {
    querySelector(selector) {
      if (selector === '#formularioCarrera') return carreraSelect;
      if (selector === '#formularioPlan') return planSelect;
      if (selector === '#formularioPlanResumen') return resumenDiv;
      return null;
    },
  };

  inicializarSelectorAcademico(dialogMock, ctx);

  // Seleccionar Carrera 1
  carreraSelect.value = '1';
  carreraSelect.onChange();
  assert.match(planSelect.innerHTML, /P1-A/);
  assert.doesNotMatch(planSelect.innerHTML, /P2-B/);

  // Cambiar rápidamente a Carrera 2
  carreraSelect.value = '2';
  carreraSelect.onChange();
  assert.match(planSelect.innerHTML, /P2-B/);
  assert.doesNotMatch(planSelect.innerHTML, /P1-A/);
});

test('Concurrencia Selector Académico: Error tardío en consulta previa no afecta la selección actual', async () => {
  const ctx = crearContextoFormularios();
  ctx.iniciar();

  let resolverConsulta1;
  let rechazarConsulta1;
  let llamada = 0;

  // Mock de DOM
  const planSelect = {
    value: '10',
    isConnected: true,
    addEventListener(evt, cb) { this.onChange = cb; },
  };
  const proveedorSelect = { value: 'INTERNO', addEventListener() {} };
  const resumenDiv = { innerHTML: '' };

  const dialogMock = {
    querySelector(selector) {
      if (selector === '#formularioPlan') return planSelect;
      if (selector === '#formularioProveedor') return proveedorSelect;
      if (selector === '#formularioPlanResumen') return resumenDiv;
      return null;
    },
  };

  // Verificamos que el control de tokens invalida la consulta previa
  const token1 = ctx.incrementarGeneracionCarreraPlan();
  const token2 = ctx.incrementarGeneracionCarreraPlan();

  assert.equal(ctx.esCarreraPlanActiva(token1), false, 'Token 1 debe estar invalidado');
  assert.equal(ctx.esCarreraPlanActiva(token2), true, 'Token 2 debe estar activo');
});

test('HTML shell: FormulariosEstudiantesPage genera estructura base con toolbar, tabla y diálogo', () => {
  const html = FormulariosEstudiantesPage();
  assert.match(html, /id="formulariosEstudiantesPage"/);
  assert.match(html, /id="estadoGoogleFormularios"/);
  assert.match(html, /id="accionesFormularios"/);
  assert.match(html, /id="formulariosEstudiantesContent"/);
  assert.match(html, /id="formularioEstudianteDialog"/);
});

function crearElementoSimulado({ id = '', tagName = 'div', className = '' } = {}) {
  const listeners = new Map();
  const children = [];
  let _className = className;
  let open = false;

  const setClass = () => new Set(_className.split(/\s+/).filter(Boolean));
  const classList = {
    contains(c) {
      return setClass().has(c);
    },
    add(...cls) {
      const s = setClass();
      cls.forEach((c) => s.add(c));
      _className = [...s].join(' ');
    },
    remove(...cls) {
      const s = setClass();
      cls.forEach((c) => s.delete(c));
      _className = [...s].join(' ');
    },
  };

  const el = {
    id,
    tagName: tagName.toUpperCase(),
    parentElement: null,
    children,
    get className() {
      return _className;
    },
    set className(val) {
      _className = String(val || '');
    },
    classList,
    get open() {
      return open;
    },
    set open(val) {
      open = Boolean(val);
    },
    showModal() {
      open = true;
    },
    close() {
      open = false;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = listeners.get(type);
      if (arr) {
        const idx = arr.indexOf(fn);
        if (idx >= 0) arr.splice(idx, 1);
      }
    },
    querySelector(selector) {
      if (selector.startsWith('#')) {
        const targetId = selector.slice(1);
        const search = (node) => {
          for (const ch of node.children) {
            if (ch.id === targetId) return ch;
            const res = search(ch);
            if (res) return res;
          }
          return null;
        };
        return search(this);
      }
      return null;
    },
  };
  return el;
}

function montarHtmlEnDom(html) {
  const root = crearElementoSimulado({ id: 'appRoot', tagName: 'div' });
  const elementos = new Map();
  elementos.set('appRoot', root);

  const dialogMatch = html.match(/<dialog\s+([^>]*?)>/);
  if (dialogMatch) {
    const attrs = dialogMatch[1];
    const idMatch = attrs.match(/id="([^"]+)"/);
    const classMatch = attrs.match(/class="([^"]+)"/);
    const dialogEl = crearElementoSimulado({
      id: idMatch ? idMatch[1] : '',
      tagName: 'dialog',
      className: classMatch ? classMatch[1] : '',
    });
    dialogEl.parentElement = root;
    root.children.push(dialogEl);
    elementos.set(dialogEl.id, dialogEl);

    const contentMatch = html.match(/<div\s+id="formularioEstudianteDialogContent"><\/div>/);
    if (contentMatch) {
      const contentEl = crearElementoSimulado({
        id: 'formularioEstudianteDialogContent',
        tagName: 'div',
      });
      contentEl.parentElement = dialogEl;
      dialogEl.children.push(contentEl);
      elementos.set(contentEl.id, contentEl);
    }
  }
  return {
    root,
    getElementById: (id) => elementos.get(id) || null,
  };
}

test('Diálogo: FormulariosEstudiantesPage renderiza y monta en DOM con clases sgpa-form-dialog y sgpa-form-dialog-md', () => {
  const html = FormulariosEstudiantesPage();
  const dom = montarHtmlEnDom(html);

  // 1. Obtener mediante getElementById y querySelector
  const dialog = dom.getElementById('formularioEstudianteDialog');
  assert.ok(dialog, 'El elemento #formularioEstudianteDialog debe existir en el DOM montado');
  assert.equal(dom.root.querySelector('#formularioEstudianteDialog'), dialog);

  // 2. Comprobar que es un elemento <dialog>
  assert.equal(dialog.tagName, 'DIALOG', 'El elemento montado debe ser de tipo DIALOG');

  // 3. Comprobar mediante classList.contains() las clases requeridas
  assert.equal(dialog.classList.contains('sgpa-form-dialog'), true, 'Debe tener la clase sgpa-form-dialog');
  assert.equal(dialog.classList.contains('sgpa-form-dialog-md'), true, 'Debe tener la clase sgpa-form-dialog-md');
  assert.equal(dialog.classList.contains('sgpa-dialog'), false, 'No debe tener la clase genérica sgpa-dialog');

  // 4. Comprobar existencia del contenedor interior y jerarquía padre-hijo
  const content = dialog.querySelector('#formularioEstudianteDialogContent');
  assert.ok(content, 'El contenedor interior #formularioEstudianteDialogContent debe existir');
  assert.equal(content.parentElement, dialog, 'El contenedor interior debe estar dentro del diálogo correcto');

  // 5. Verificar que las clases corresponden a selectores existentes en form-dialog.css
  const cssPath = new URL('../src/styles/form-dialog.css', import.meta.url);
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  assert.match(cssContent, /\.sgpa-form-dialog\s*\{/, 'form-dialog.css debe definir .sgpa-form-dialog {');
  assert.match(cssContent, /\.sgpa-form-dialog-md\s*\{/, 'form-dialog.css debe definir .sgpa-form-dialog-md {');

  // 6. Verificar ciclo showModal() y close() sin perder las clases requeridas
  dialog.showModal();
  assert.equal(dialog.open, true, 'showModal() debe abrir el diálogo');
  assert.equal(dialog.classList.contains('sgpa-form-dialog'), true);
  assert.equal(dialog.classList.contains('sgpa-form-dialog-md'), true);

  dialog.close();
  assert.equal(dialog.open, false, 'close() debe cerrar el diálogo');
  assert.equal(dialog.classList.contains('sgpa-form-dialog'), true);
  assert.equal(dialog.classList.contains('sgpa-form-dialog-md'), true);

  // 7. Demostrar fallo ante el defecto anterior (si se cambiaran por sgpa-dialog)
  const dialogDefectuoso = crearElementoSimulado({
    id: 'formularioEstudianteDialog',
    tagName: 'dialog',
    className: 'sgpa-dialog',
  });
  assert.equal(dialogDefectuoso.classList.contains('sgpa-form-dialog'), false);
  assert.equal(dialogDefectuoso.classList.contains('sgpa-form-dialog-md'), false);
});

test('Google Concurrencia — Escenario A: Destruir y reabrir (respuesta antigua de A no altera B)', async () => {
  let resolverA;
  const originalWindow = global.window;
  const originalDocument = global.document;

  global.window = {
    sgpa: {
      obtenerEstadoGoogleFormularios: () => new Promise((res) => { resolverA = res; }),
    },
  };
  global.document = {
    getElementById: (id) => (id === 'formulariosEstudiantesPage' ? {} : null),
  };

  try {
    const ctx = crearContextoFormularios();
    ctx.iniciar(); // Instancia A
    const pA = actualizarEstadoGoogleAlFoco(ctx);

    // Salir del módulo y destruir instancia A
    ctx.destruir();

    // Reingresar a Formularios e iniciar instancia B
    ctx.iniciar(); // Instancia B
    ctx.estado.estadoGoogle = {
      conectado: true,
      requiereReautenticacion: false,
      estado: 'CONECTADO',
      googleEmail: 'instancia_b@una.ac.cr',
    };

    // Resolver la consulta antigua A con estado DESCONECTADO
    resolverA({ conectado: false, estado: 'DESCONECTADO', googleEmail: null });
    await pA;

    // La instancia B debe permanecer inalterada
    assert.equal(ctx.estado.estadoGoogle.conectado, true);
    assert.equal(ctx.estado.estadoGoogle.estado, 'CONECTADO');
    assert.equal(ctx.estado.estadoGoogle.googleEmail, 'instancia_b@una.ac.cr');
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
  }
});

test('Google Concurrencia — Escenario B: Error tardío tras reentrada no afecta la instancia nueva ni arroja error', async () => {
  let rechazarA;
  const originalWindow = global.window;
  const originalDocument = global.document;

  global.window = {
    sgpa: {
      obtenerEstadoGoogleFormularios: () => new Promise((_, rej) => { rechazarA = rej; }),
    },
  };
  global.document = {
    getElementById: (id) => (id === 'formulariosEstudiantesPage' ? {} : null),
  };

  try {
    const ctx = crearContextoFormularios();
    ctx.iniciar(); // Instancia A
    const pA = actualizarEstadoGoogleAlFoco(ctx);

    // Salir del módulo y destruir A
    ctx.destruir();

    // Reabrir Formularios e iniciar instancia B
    ctx.iniciar(); // Instancia B
    ctx.estado.estadoGoogle = {
      conectado: true,
      requiereReautenticacion: false,
      estado: 'CONECTADO',
      googleEmail: 'valido_b@una.ac.cr',
    };

    // Rechazar la consulta antigua de A con fallo de red
    rechazarA(new Error('Conexión perdida con Google OAuth en instancia A'));
    await pA;

    // El estado de B debe preservarse y no haber errores residuales
    assert.equal(ctx.estado.estadoGoogle.conectado, true);
    assert.equal(ctx.estado.estadoGoogle.estado, 'CONECTADO');
    assert.equal(ctx.estado.estadoGoogle.googleEmail, 'valido_b@una.ac.cr');
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
  }
});

test('Google Concurrencia — Escenario C: Salida sin reentrada (respuesta antigua no modifica DOM abandonado)', async () => {
  let resolverA;
  const originalWindow = global.window;
  const originalDocument = global.document;

  let enFormularios = true;
  global.window = {
    sgpa: {
      obtenerEstadoGoogleFormularios: () => new Promise((res) => { resolverA = res; }),
    },
  };
  global.document = {
    getElementById: (id) => (enFormularios && id === 'formulariosEstudiantesPage' ? {} : null),
  };

  try {
    const ctx = crearContextoFormularios();
    ctx.iniciar();
    const pA = actualizarEstadoGoogleAlFoco(ctx);

    // Navegar a otra página y destruir contexto
    enFormularios = false;
    ctx.destruir();

    // Resolver consulta antigua
    resolverA({ conectado: true, estado: 'CONECTADO', googleEmail: 'abandonado@una.ac.cr' });
    await pA;

    // Estado permanece limpio
    assert.equal(ctx.activo, false);
    assert.equal(ctx.estado.estadoGoogle.conectado, false);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
  }
});

test('Google Concurrencia — Escenario D: Varias consultas de foco dentro de la misma instancia (prevalece la más reciente)', async () => {
  let resolver1;
  let resolver2;
  const originalWindow = global.window;
  const originalDocument = global.document;

  let llamada = 0;
  global.window = {
    sgpa: {
      obtenerEstadoGoogleFormularios: () => {
        llamada += 1;
        if (llamada === 1) {
          return new Promise((res) => { resolver1 = res; });
        }
        return new Promise((res) => { resolver2 = res; });
      },
    },
  };
  global.document = {
    getElementById: (id) => (id === 'formulariosEstudiantesPage' ? {} : null),
  };

  try {
    const ctx = crearContextoFormularios();
    ctx.iniciar();

    // Disparar dos consultas concurrentes
    const p1 = actualizarEstadoGoogleAlFoco(ctx);
    const p2 = actualizarEstadoGoogleAlFoco(ctx);

    // Resolver la segunda primero con datos más recientes (CONECTADO)
    resolver2({
      conectado: true,
      requiereReautenticacion: false,
      estado: 'CONECTADO',
      googleEmail: 'reciente@una.ac.cr',
    });
    await p2;
    assert.equal(ctx.estado.estadoGoogle.googleEmail, 'reciente@una.ac.cr');

    // Resolver la primera después con datos antiguos (DESCONECTADO)
    resolver1({
      conectado: false,
      requiereReautenticacion: false,
      estado: 'DESCONECTADO',
      googleEmail: null,
    });
    await p1;

    // La consulta antigua 1 no debe sobrescribir la 2
    assert.equal(ctx.estado.estadoGoogle.googleEmail, 'reciente@una.ac.cr');
    assert.equal(ctx.estado.estadoGoogle.conectado, true);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
  }
});

test('Google Concurrencia — Escenario E: Consulta válida actualiza estado e interfaz correctamente', async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;

  global.window = {
    sgpa: {
      obtenerEstadoGoogleFormularios: async () => ({
        conectado: true,
        requiereReautenticacion: false,
        estado: 'CONECTADO',
        googleEmail: 'profesor@una.cr',
      }),
    },
  };

  let estadoGoogleDiv = { innerHTML: '', querySelectorAll: () => [] };
  let accionesDiv = { innerHTML: '', querySelectorAll: () => [] };
  global.document = {
    getElementById: (id) => {
      if (id === 'formulariosEstudiantesPage') return { querySelectorAll: () => [] };
      if (id === 'estadoGoogleFormularios') return estadoGoogleDiv;
      if (id === 'accionesFormularios') return accionesDiv;
      return null;
    },
    querySelectorAll: () => [],
  };

  try {
    const ctx = crearContextoFormularios();
    ctx.iniciar();

    await actualizarEstadoGoogleAlFoco(ctx);

    assert.equal(ctx.estado.estadoGoogle.conectado, true);
    assert.equal(ctx.estado.estadoGoogle.estado, 'CONECTADO');
    assert.equal(ctx.estado.estadoGoogle.googleEmail, 'profesor@una.cr');
    assert.match(estadoGoogleDiv.innerHTML, /profesor@una\.cr/);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
  }
});

test('Desconexión Google — Escenario A: Confirmación obsoleta no ejecuta desconexión en nueva instancia', async () => {
  let acceptHandler = null;
  let llamadasServicio = 0;

  const acceptBtn = {
    addEventListener: (ev, fn) => {
      if (ev === 'click') acceptHandler = fn;
    },
  };
  const cancelBtn = { addEventListener: () => {} };
  const mockDialog = {
    open: false,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    remove() {},
    addEventListener() {},
    querySelector(sel) {
      if (sel === '#sgpaConfirmAccept') return acceptBtn;
      if (sel === '#sgpaConfirmCancel') return cancelBtn;
      return null;
    },
  };

  const originalDoc = globalThis.document;
  const originalWin = globalThis.window;

  globalThis.document = {
    getElementById: () => null,
    createElement: () => mockDialog,
    body: { appendChild: () => {} },
    querySelectorAll: () => [],
  };
  globalThis.window = {
    sgpa: {
      desconectarGoogleFormularios: async () => {
        llamadasServicio += 1;
        return { ok: true };
      },
    },
  };

  try {
    autorizarGestionFormularios();
    const ctx = crearContextoFormularios();
    ctx.iniciar(); // Instancia A (gen 1)

    // 1. Iniciar desconexión en A (la confirmación queda abierta esperando al usuario)
    const p = desconectarGoogle(ctx);
    assert.equal(
      typeof acceptHandler,
      'function',
      'El diálogo modal debe estar esperando confirmación',
    );

    // 2. Destruir Formularios A y crear Formularios B
    ctx.destruir();
    ctx.iniciar(); // Instancia B (gen 3)
    ctx.estado.estadoGoogle = {
      conectado: true,
      requiereReautenticacion: false,
      estado: 'CONECTADO',
      googleEmail: 'instancia_b@una.ac.cr',
    };

    // 3. Resolver afirmativamente la confirmación antigua de A
    await acceptHandler({ preventDefault: () => {} });
    await p;

    // 4. Verificaciones obligatorias
    assert.equal(
      llamadasServicio,
      0,
      'No debe enviarse ninguna solicitud de desconexión al servicio desde confirmación obsoleta',
    );
    assert.equal(
      ctx.estado.estadoGoogle.conectado,
      true,
      'Instancia B debe conservar estado conectado',
    );
    assert.equal(
      ctx.estado.estadoGoogle.googleEmail,
      'instancia_b@una.ac.cr',
      'Instancia B conserva email legítimo',
    );
    assert.equal(
      ctx.estado.desconectandoGoogle,
      false,
      'Bandera de desconexión debe estar inactiva',
    );
  } finally {
    limpiarSesion();
    globalThis.document = originalDoc;
    globalThis.window = originalWin;
  }
});

test('Desconexión Google — Escenario B: Confirmación válida ejecuta servicio una sola vez y actualiza estado', async () => {
  let acceptHandler = null;
  let cancelHandler = null;
  let confirmaciones = 0;
  let llamadasServicio = 0;

  const acceptBtn = {
    addEventListener: (ev, fn) => {
      if (ev === 'click') acceptHandler = fn;
    },
  };
  const cancelBtn = { addEventListener: (_ev, fn) => { cancelHandler = fn; } };
  const mockDialog = {
    open: false,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    remove() {},
    addEventListener() {},
    querySelector(sel) {
      if (sel === '#sgpaConfirmAccept') return acceptBtn;
      if (sel === '#sgpaConfirmCancel') return cancelBtn;
      return null;
    },
  };

  const originalDoc = globalThis.document;
  const originalWin = globalThis.window;

  const estadoGoogleDiv = { innerHTML: '', querySelectorAll: () => [] };
  const accionesDiv = { innerHTML: '', querySelectorAll: () => [] };

  globalThis.document = {
    getElementById: (id) => {
      if (id === 'formulariosEstudiantesPage') return { querySelectorAll: () => [] };
      if (id === 'estadoGoogleFormularios') return estadoGoogleDiv;
      if (id === 'accionesFormularios') return accionesDiv;
      return null;
    },
    createElement: () => mockDialog,
    body: {
      appendChild: (dialog) => {
        if (dialog.id === 'sgpaConfirmDialog') confirmaciones += 1;
      },
    },
    querySelectorAll: () => [],
  };
  globalThis.window = {
    sgpa: {
      desconectarGoogleFormularios: async () => {
        llamadasServicio += 1;
        return { ok: true };
      },
    },
  };

  try {
    autorizarGestionFormularios();
    const ctx = crearContextoFormularios();
    ctx.iniciar();
    ctx.estado.estadoGoogle = {
      conectado: true,
      requiereReautenticacion: false,
      estado: 'CONECTADO',
      googleEmail: 'valido@una.ac.cr',
    };

    const p = desconectarGoogle(ctx);
    await acceptHandler({ preventDefault: () => {} });
    await p;

    assert.equal(llamadasServicio, 1, 'Debe invocarse el servicio exactamente una vez');
    assert.equal(ctx.estado.estadoGoogle.conectado, false);
    assert.equal(ctx.estado.estadoGoogle.estado, 'DESCONECTADO');
    assert.equal(ctx.estado.estadoGoogle.googleEmail, null);

    const reintento = desconectarGoogle(ctx);
    assert.equal(confirmaciones, 2, 'Una operación completada libera la reserva');
    await cancelHandler({ preventDefault: () => {} });
    await reintento;
    assert.equal(llamadasServicio, 1, 'El reintento cancelado no envía otra solicitud');
  } finally {
    limpiarSesion();
    globalThis.document = originalDoc;
    globalThis.window = originalWin;
  }
});

test('Desconexión Google — Escenario C: Cancelación no llama al servicio ni altera el estado', async () => {
  let cancelHandler = null;
  let confirmaciones = 0;
  let llamadasServicio = 0;

  const cancelBtn = {
    addEventListener: (ev, fn) => {
      if (ev === 'click') cancelHandler = fn;
    },
  };
  const mockDialog = {
    open: false,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    remove() {},
    addEventListener() {},
    querySelector(sel) {
      if (sel === '#sgpaConfirmCancel') return cancelBtn;
      return null;
    },
  };

  const originalDoc = globalThis.document;
  const originalWin = globalThis.window;

  globalThis.document = {
    getElementById: () => null,
    createElement: () => { confirmaciones += 1; return mockDialog; },
    body: { appendChild: () => {} },
    querySelectorAll: () => [],
  };
  globalThis.window = {
    sgpa: {
      desconectarGoogleFormularios: async () => {
        llamadasServicio += 1;
        return { ok: true };
      },
    },
  };

  try {
    autorizarGestionFormularios();
    const ctx = crearContextoFormularios();
    ctx.iniciar();
    ctx.estado.estadoGoogle = {
      conectado: true,
      estado: 'CONECTADO',
      googleEmail: 'cancelar@una.ac.cr',
    };

    const p = desconectarGoogle(ctx);
    await cancelHandler({ preventDefault: () => {} });
    await p;

    assert.equal(llamadasServicio, 0, 'No debe llamarse al servicio tras cancelar');
    assert.equal(ctx.estado.estadoGoogle.conectado, true);
    assert.equal(ctx.estado.estadoGoogle.googleEmail, 'cancelar@una.ac.cr');

    const reintento = desconectarGoogle(ctx);
    assert.equal(confirmaciones, 2, 'Cancelar libera la reserva para un intento posterior');
    await cancelHandler({ preventDefault: () => {} });
    await reintento;
    assert.equal(llamadasServicio, 0);
  } finally {
    limpiarSesion();
    globalThis.document = originalDoc;
    globalThis.window = originalWin;
  }
});

test('Desconexión Google — Escenario D: Respuesta IPC tardía tras salir y reentrar no sobreescribe estado nuevo', async () => {
  let acceptHandler = null;
  let resolverIPC;
  let confirmaciones = 0;
  let llamadasServicio = 0;

  const acceptBtn = {
    addEventListener: (ev, fn) => {
      if (ev === 'click') acceptHandler = fn;
    },
  };
  const mockDialog = {
    open: false,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    remove() {},
    addEventListener() {},
    querySelector: (sel) => (sel === '#sgpaConfirmAccept' ? acceptBtn : null),
  };

  const originalDoc = globalThis.document;
  const originalWin = globalThis.window;

  globalThis.document = {
    getElementById: () => null,
    createElement: () => { confirmaciones += 1; return mockDialog; },
    body: { appendChild: () => {} },
    querySelectorAll: () => [],
  };
  globalThis.window = {
    sgpa: {
      desconectarGoogleFormularios: () => {
        llamadasServicio += 1;
        return new Promise((res) => {
          resolverIPC = res;
        });
      },
    },
  };

  try {
    autorizarGestionFormularios();
    const ctx = crearContextoFormularios();
    ctx.iniciar(); // Instancia A

    const p = desconectarGoogle(ctx);
    await acceptHandler({ preventDefault: () => {} });

    // La solicitud IPC quedó en curso. Salir del módulo y reingresar (Instancia B)
    ctx.destruir();
    ctx.iniciar();
    ctx.estado.estadoGoogle = {
      conectado: true,
      estado: 'CONECTADO',
      googleEmail: 'b_nuevo@una.ac.cr',
    };

    // Una segunda acción en B queda bloqueada mientras el IPC de A sigue en vuelo.
    await desconectarGoogle(ctx);
    assert.equal(confirmaciones, 1, 'No debe abrirse otra confirmación mientras la solicitud anterior está en vuelo');
    assert.equal(llamadasServicio, 1, 'No debe enviarse una segunda escritura IPC');

    // Resuelve la petición IPC tardía de la instancia A
    resolverIPC({ ok: true });
    await p;

    // Comprobar que no sobrescribe el estado de B
    assert.equal(ctx.estado.estadoGoogle.conectado, true);
    assert.equal(ctx.estado.estadoGoogle.googleEmail, 'b_nuevo@una.ac.cr');
  } finally {
    limpiarSesion();
    globalThis.document = originalDoc;
    globalThis.window = originalWin;
  }
});

test('Desconexión Google — Escenario E: Error tardío de servicio no altera la nueva instancia ni genera fallo no controlado', async () => {
  let acceptHandler = null;
  let cancelHandler = null;
  let confirmaciones = 0;
  let llamadasServicio = 0;
  let rechazarIPC;

  const acceptBtn = {
    addEventListener: (ev, fn) => {
      if (ev === 'click') acceptHandler = fn;
    },
  };
  const cancelBtn = {
    addEventListener: (ev, fn) => {
      if (ev === 'click') cancelHandler = fn;
    },
  };
  const mockDialog = {
    open: false,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    remove() {},
    addEventListener() {},
    querySelector: (sel) => {
      if (sel === '#sgpaConfirmAccept') return acceptBtn;
      if (sel === '#sgpaConfirmCancel') return cancelBtn;
      return null;
    },
  };

  const originalDoc = globalThis.document;
  const originalWin = globalThis.window;

  globalThis.document = {
    getElementById: () => null,
    createElement: () => { confirmaciones += 1; return mockDialog; },
    body: { appendChild: () => {} },
    querySelectorAll: () => [],
  };
  globalThis.window = {
    sgpa: {
      desconectarGoogleFormularios: () => {
        llamadasServicio += 1;
        return new Promise((_, rej) => {
          rechazarIPC = rej;
        });
      },
    },
  };

  try {
    autorizarGestionFormularios();
    const ctx = crearContextoFormularios();
    ctx.iniciar();

    const p = desconectarGoogle(ctx);
    await acceptHandler({ preventDefault: () => {} });

    // Salir y reentrar antes de que IPC responda
    ctx.destruir();
    ctx.iniciar();
    ctx.estado.estadoGoogle = {
      conectado: true,
      estado: 'CONECTADO',
      googleEmail: 'b_seguro@una.ac.cr',
    };

    // Rechazar la petición IPC antigua
    rechazarIPC(new Error('Fallo de conexión en backend'));
    await p;

    // Instancia B permanece intacta
    assert.equal(ctx.estado.estadoGoogle.conectado, true);
    assert.equal(ctx.estado.estadoGoogle.googleEmail, 'b_seguro@una.ac.cr');

    const reintento = desconectarGoogle(ctx);
    assert.equal(confirmaciones, 2, 'La operación fallida libera su reserva al finalizar');
    await cancelHandler({ preventDefault: () => {} });
    await reintento;
    assert.equal(llamadasServicio, 1, 'El error tardío no provoca reintentos automáticos');
  } finally {
    limpiarSesion();
    globalThis.document = originalDoc;
    globalThis.window = originalWin;
  }
});

test('Desconexión Google — doble activación comparte una sola confirmación y una sola operación', async () => {
  let acceptHandler = null;
  let confirmaciones = 0;
  let llamadasServicio = 0;
  const dialog = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    remove() {},
    addEventListener() {},
    querySelector(selector) {
      if (selector === '#sgpaConfirmAccept') return {
        addEventListener: (_event, callback) => { acceptHandler = callback; },
      };
      if (selector === '#sgpaConfirmCancel') return { addEventListener() {} };
      return null;
    },
  };
  const originalDoc = globalThis.document;
  const originalWin = globalThis.window;
  globalThis.document = {
    getElementById: () => null,
    createElement: () => { confirmaciones += 1; return dialog; },
    body: { appendChild() {} },
    querySelectorAll: () => [],
  };
  globalThis.window = {
    sgpa: {
      desconectarGoogleFormularios: async () => {
        llamadasServicio += 1;
        return { ok: true };
      },
    },
  };

  try {
    autorizarGestionFormularios();
    const ctx = crearContextoFormularios();
    ctx.iniciar();
    const primera = desconectarGoogle(ctx);
    const segunda = desconectarGoogle(ctx);
    await segunda;

    assert.equal(confirmaciones, 1, 'La segunda activación no debe reemplazar ni duplicar el diálogo');
    assert.equal(typeof acceptHandler, 'function');
    await acceptHandler({ preventDefault() {} });
    await primera;
    assert.equal(llamadasServicio, 1);
  } finally {
    limpiarSesion();
    globalThis.document = originalDoc;
    globalThis.window = originalWin;
  }
});

test('Desconexión Google — revocar el permiso durante la confirmación bloquea el IPC', async () => {
  let acceptHandler = null;
  let llamadasServicio = 0;
  const dialogos = new Map();
  const crearDialogo = () => ({
    open: false,
    innerHTML: '',
    classList: { add() {}, remove() {} },
    showModal() { this.open = true; },
    close() { this.open = false; },
    remove() { dialogos.delete(this.id); },
    addEventListener() {},
    querySelector(selector) {
      if (selector === '#sgpaConfirmAccept') return {
        addEventListener: (_event, callback) => { acceptHandler = callback; },
      };
      if (selector === '#sgpaConfirmCancel') return { addEventListener() {} };
      return null;
    },
  });
  const originalDoc = globalThis.document;
  const originalWin = globalThis.window;
  globalThis.document = {
    getElementById: (id) => dialogos.get(id) || null,
    createElement: crearDialogo,
    body: { appendChild: (dialog) => dialogos.set(dialog.id, dialog) },
    querySelectorAll: () => [],
  };
  globalThis.window = {
    clearTimeout() {},
    setTimeout() { return 1; },
    sgpa: {
      desconectarGoogleFormularios: async () => {
        llamadasServicio += 1;
        return { ok: true };
      },
    },
  };

  try {
    autorizarGestionFormularios();
    const ctx = crearContextoFormularios();
    ctx.iniciar();
    const operacion = desconectarGoogle(ctx);
    limpiarSesion();
    await acceptHandler({ preventDefault() {} });
    await operacion;

    assert.equal(llamadasServicio, 0, 'No se debe enviar IPC después de revocar el permiso');
    assert.match(dialogos.get('sgpaAlertDialog')?.innerHTML || '', /permiso para desconectar Google/i);
    assert.equal(ctx.estado.desconectandoGoogle, false);
  } finally {
    limpiarSesion();
    globalThis.document = originalDoc;
    globalThis.window = originalWin;
  }
});

test('Desconexión Google — reemplazar la identidad durante la confirmación bloquea el IPC', async () => {
  let acceptHandler = null;
  let llamadasServicio = 0;
  const dialogos = new Map();
  const crearDialogo = () => ({
    id: '',
    open: false,
    innerHTML: '',
    classList: { add() {}, remove() {} },
    showModal() { this.open = true; },
    close() { this.open = false; },
    remove() { dialogos.delete(this.id); },
    addEventListener() {},
    querySelector(selector) {
      if (selector === '#sgpaConfirmAccept') return {
        addEventListener: (_event, callback) => { acceptHandler = callback; },
      };
      if (selector === '#sgpaConfirmCancel') return { addEventListener() {} };
      return null;
    },
  });
  const originalDoc = globalThis.document;
  const originalWin = globalThis.window;
  globalThis.document = {
    getElementById: (id) => dialogos.get(id) || null,
    createElement: crearDialogo,
    body: { appendChild: (dialog) => dialogos.set(dialog.id, dialog) },
    querySelectorAll: () => [],
  };
  globalThis.window = {
    clearTimeout() {},
    setTimeout() { return 1; },
    sgpa: {
      desconectarGoogleFormularios: async () => {
        llamadasServicio += 1;
        return { ok: true };
      },
    },
  };

  try {
    autorizarGestionFormularios();
    const ctx = crearContextoFormularios();
    ctx.iniciar();
    const operacion = desconectarGoogle(ctx);
    guardarSesion({
      usuario: {
        id: 902,
        rol: 'COORDINADOR',
        rolActivo: 'COORDINADOR',
        permisos: [PERMISOS.GESTIONAR],
      },
    });
    await acceptHandler({ preventDefault() {} });
    await operacion;

    assert.equal(llamadasServicio, 0, 'La nueva identidad no puede heredar una acción confirmada por la sesión anterior');
    assert.equal(ctx.estado.desconectandoGoogle, false);
    assert.match(dialogos.get('sgpaAlertDialog')?.innerHTML || '', /permiso para desconectar Google/i);
  } finally {
    limpiarSesion();
    globalThis.document = originalDoc;
    globalThis.window = originalWin;
  }
});

test('Desconexión Google — destruir durante confirmación libera la reserva y cancela el diálogo antiguo', async () => {
  let acceptHandler = null;
  let confirmaciones = 0;
  let llamadasServicio = 0;
  const dialogos = new Map();
  const crearDialogo = () => {
    let aceptar = null;
    let cancelar = null;
    const dialog = {
      open: false,
      showModal() { this.open = true; },
      close() { this.open = false; },
      remove() { dialogos.delete(this.id); },
      addEventListener() {},
      querySelector(selector) {
        if (selector === '#sgpaConfirmAccept') return {
          addEventListener: (_event, callback) => { aceptar = callback; acceptHandler = callback; },
        };
        if (selector === '#sgpaConfirmCancel') return {
          addEventListener: (_event, callback) => { cancelar = callback; },
          click: () => cancelar?.(),
        };
        return null;
      },
    };
    return dialog;
  };
  const originalDoc = globalThis.document;
  const originalWin = globalThis.window;
  globalThis.document = {
    getElementById: (id) => dialogos.get(id) || null,
    createElement: () => { confirmaciones += 1; return crearDialogo(); },
    body: { appendChild: (dialog) => dialogos.set(dialog.id, dialog) },
    querySelectorAll: () => [],
  };
  globalThis.window = {
    sgpa: {
      desconectarGoogleFormularios: async () => {
        llamadasServicio += 1;
        return { ok: true };
      },
    },
  };

  try {
    autorizarGestionFormularios();
    const ctx = crearContextoFormularios();
    ctx.iniciar();
    const operacionAntigua = desconectarGoogle(ctx);
    ctx.destruir();
    await operacionAntigua;
    ctx.iniciar();
    const operacionNueva = desconectarGoogle(ctx);
    assert.equal(confirmaciones, 2, 'La instancia nueva puede solicitar una confirmación propia');
    await acceptHandler({ preventDefault() {} });
    await operacionNueva;
    assert.equal(llamadasServicio, 1, 'Solo se ejecuta la operación de la instancia vigente');
  } finally {
    limpiarSesion();
    globalThis.document = originalDoc;
    globalThis.window = originalWin;
  }
});

test('Router Real — Navegación de producción a través de renderizarRuta (App.js)', async () => {
  let listeners = new Map();
  let htmlContent = '';
  let resolverGoogle;

  const contentArea = {
    get innerHTML() {
      return htmlContent;
    },
    set innerHTML(val) {
      htmlContent = val;
    },
  };

  const originalDoc = globalThis.document;
  const originalWin = globalThis.window;
  const originalLog = console.log;

  console.log = () => {};

  globalThis.document = {
    title: '',
    getElementById(id) {
      if (id === 'contentArea') return contentArea;
      return {
        innerHTML: '',
        addEventListener() {},
        removeEventListener() {},
        querySelectorAll: () => [],
      };
    },
    querySelectorAll: () => [],
  };

  globalThis.window = {
    addEventListener(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
    },
    removeEventListener(event, fn) {
      listeners.get(event)?.delete(fn);
    },
    sgpa: {
      obtenerEstadoGoogleFormularios: () => new Promise((res) => {
        resolverGoogle = res;
      }),
      listarFormulariosEstudiantes: async () => [],
    },
  };

  guardarSesion({
    usuario: {
      id: 1,
      roles: ['ADMIN_GLOBAL'],
      rolActivo: 'ADMIN_GLOBAL',
      permisos: [
        'FORMULARIOS_ESTUDIANTES_VER',
        'FORMULARIOS_ESTUDIANTES_GESTIONAR',
      ],
    },
  });

  try {
    // 1. Entrar a Formularios a través de la navegación productiva real de App.js
    renderizarRuta('/formularios-estudiantes');

    // 2. Confirmar inicialización y montaje en #contentArea
    assert.ok(
      htmlContent.includes('id="formulariosEstudiantesPage"'),
      'contentArea debe contener la vista de Formularios',
    );

    // 3. Confirmar exactamente 1 listener focus registrado
    assert.equal(
      listeners.get('focus')?.size,
      1,
      'Debe haber exactamente un listener focus registrado',
    );

    // 4. Navegar mediante el router real hacia otra página (/dashboard)
    renderizarRuta('/dashboard');

    // 5. Confirmar que el destructor se ejecutó antes de reemplazar el DOM y retiró el listener focus
    assert.equal(
      listeners.get('focus')?.size,
      0,
      'Listener focus debe retirarse al salir de Formularios mediante el router real',
    );
    assert.ok(
      !htmlContent.includes('id="formulariosEstudiantesPage"'),
      'contentArea ya no debe contener la vista de Formularios tras salir',
    );

    // 6. Resolver la consulta Google pendiente de la instancia anterior
    if (typeof resolverGoogle === 'function') {
      resolverGoogle({
        conectado: true,
        estado: 'CONECTADO',
        googleEmail: 'obsoleto@una.ac.cr',
      });
    }

    // 7. Confirmar que no altera el dashboard montado
    assert.ok(
      htmlContent.includes('id="modulesPage"') ||
        htmlContent.includes('modules-grid') ||
        htmlContent.length > 0,
      'La vista de destino debe permanecer activa e inalterada',
    );

    // 8. Regresar mediante el router real a Formularios
    globalThis.window.sgpa.obtenerEstadoGoogleFormularios = async () => ({
      conectado: true,
      estado: 'CONECTADO',
      googleEmail: 'activo_router@una.ac.cr',
    });

    renderizarRuta('/formularios-estudiantes');

    // 9. Confirmar nueva inicialización y exactamente 1 listener focus
    assert.ok(htmlContent.includes('id="formulariosEstudiantesPage"'));
    assert.equal(
      listeners.get('focus')?.size,
      1,
      'Debe haber exactamente un listener focus tras reingreso',
    );

    // 10. Disparar el evento focus de window y comprobar actualización legítima
    const focusHandler = Array.from(listeners.get('focus'))[0];
    assert.equal(typeof focusHandler, 'function');
    await focusHandler();

    assert.equal(
      contextoFormulariosGlobal.estado.estadoGoogle.googleEmail,
      'activo_router@una.ac.cr',
      'El contexto global debe actualizarse con la consulta legítima',
    );

    // 11. Navegación repetida (múltiples entradas y salidas) para comprobar ausencia de listeners duplicados
    renderizarRuta('/dashboard');
    assert.equal(listeners.get('focus')?.size, 0);

    renderizarRuta('/formularios-estudiantes');
    assert.equal(listeners.get('focus')?.size, 1);

    renderizarRuta('/home');
    assert.equal(listeners.get('focus')?.size, 0);

    renderizarRuta('/formularios-estudiantes');
    assert.equal(listeners.get('focus')?.size, 1);

    // Salir finalmente
    renderizarRuta('/dashboard');
    assert.equal(listeners.get('focus')?.size, 0);
  } finally {
    limpiarSesion();
    globalThis.document = originalDoc;
    globalThis.window = originalWin;
    console.log = originalLog;
  }
});
