import test from 'node:test';
import assert from 'node:assert/strict';
import { guardarSesion, limpiarSesion } from '../src/app/session.js';
import { iniciarPlanesEstudioPage } from '../src/pages/planes-estudio/PlanesEstudioPage.js';

class NodoPrueba extends EventTarget {
  constructor(id, documento) {
    super();
    this.id = id;
    this.documento = documento;
    this.open = false;
    this.value = '';
    this.dataset = {};
    this._html = '';
  }
  set innerHTML(html) {
    this._html = html;
    if (this.id.endsWith('DialogContent')) this.documento.limpiarDinamicos();
  }
  get innerHTML() { return this._html; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
  click() { this.dispatchEvent(new Event('click')); }
  change(value) { this.value = value; this.dispatchEvent(new Event('change')); }
  querySelectorAll() { return []; }
  querySelector() { return null; }
}

function crearDocumento() {
  const fijos = new Map();
  const dinamicos = new Map();
  const documento = {
    limpiarDinamicos() { dinamicos.clear(); },
    getElementById(id) {
      if (fijos.has(id)) return fijos.get(id);
      for (const nombre of ['comparadorPlanesDialogContent', 'transicionCurricularDialogContent']) {
        if (fijos.get(nombre)?.innerHTML.includes(`id="${id}"`)) {
          if (!dinamicos.has(id)) dinamicos.set(id, new NodoPrueba(id, documento));
          return dinamicos.get(id);
        }
      }
      return null;
    },
    querySelectorAll() { return []; },
  };
  for (const id of [
    'planesEstudioPage', 'nuevoPlanButton', 'comparadorPlanesButton',
    'transicionCurricularButton', 'planesBuscar', 'planesCarrera', 'planesEstado',
    'planesContent', 'comparadorPlanesDialog', 'comparadorPlanesDialogContent',
    'transicionCurricularDialog', 'transicionCurricularDialogContent',
  ]) fijos.set(id, new NodoPrueba(id, documento));
  fijos.get('planesEstado').value = 'TODOS';
  return documento;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('los clics reales abren y cierran comparador y transición sin duplicar listeners', async () => {
  const documentoAnterior = globalThis.document;
  const ventanaAnterior = globalThis.window;
  const documento = crearDocumento();
  globalThis.document = documento;
  const consultas = { asignaturas: [], equivalencias: [], simulaciones: 0, escrituras: 0 };
  let planesDisponibles = [
    { id: 1, carreraId: 10, codigo: 'P1', nombre: 'Plan uno', activo: true },
    { id: 2, carreraId: 10, codigo: 'P2', nombre: 'Plan dos', activo: true },
  ];
  globalThis.window = { sgpa: {
    listarPlanesEstudio: async () => ({ ok: true, planes: planesDisponibles }),
    listarCarreras: async () => ({ ok: true, carreras: [{ id: 10, codigo: 'C', nombre: 'Carrera' }] }),
    listarPlanAsignaturas: async (id) => {
      consultas.asignaturas.push(id);
      return { ok: true, asignaturas: [{ id: id * 100, creditos: 3, curso: { codigo: `C${id}`, nombre: `Curso ${id}` } }] };
    },
    listarEquivalenciasPlanes: async (origen, destino) => {
      consultas.equivalencias.push([origen, destino]);
      return { ok: true, data: [{ id: 7, asignaturaOrigenId: 100, asignaturaDestinoId: 200, justificacion: 'Registrada' }] };
    },
    simularTransicionCurricular: async () => {
      consultas.simulaciones += 1;
      return { ok: true, data: { totalAnalizados: 0, totalMigrables: 0, totalConflictos: 0, estudiantes: [] } };
    },
    crearEquivalenciaPlan: async () => { consultas.escrituras += 1; },
    eliminarEquivalenciaPlan: async () => { consultas.escrituras += 1; },
    ejecutarTransicionCurricular: async () => { consultas.escrituras += 1; },
  } };
  guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL' } });
  try {
    iniciarPlanesEstudioPage();
    await tick();
    iniciarPlanesEstudioPage();
    await tick();

    documento.getElementById('comparadorPlanesButton').click();
    await tick();
    assert.equal(documento.getElementById('comparadorPlanesDialog').open, true);
    assert.deepEqual(consultas.asignaturas, [1, 2]);
    assert.deepEqual(consultas.equivalencias, [[1, 2]]);
    assert.match(documento.getElementById('comparadorPlanesDialogContent').innerHTML, /Curso 1/);
    assert.match(documento.getElementById('comparadorPlanesDialogContent').innerHTML, /Registrada/);
    documento.getElementById('compPlanOrigenSelect').change('2');
    await tick();
    assert.deepEqual(consultas.equivalencias.at(-1), [2, 1]);
    assert.match(documento.getElementById('comparadorPlanesDialogContent').innerHTML, /Curso 2/);
    documento.getElementById('cerrarComparadorBtn').click();
    assert.equal(documento.getElementById('comparadorPlanesDialog').open, false);

    documento.getElementById('transicionCurricularButton').click();
    await tick();
    assert.equal(documento.getElementById('transicionCurricularDialog').open, true);
    documento.getElementById('tcBtnSimular').click();
    await tick();
    assert.equal(consultas.simulaciones, 1);
    assert.match(documento.getElementById('transicionCurricularDialogContent').innerHTML, /No hay estudiantes/);
    assert.doesNotMatch(documento.getElementById('transicionCurricularDialogContent').innerHTML, /id="tcBtnEjecutar"/);
    documento.getElementById('cerrarTransicionBtn').click();
    assert.equal(documento.getElementById('transicionCurricularDialog').open, false);
    assert.equal(consultas.escrituras, 0);

    guardarSesion({ usuario: { rol: 'PROFESOR', rolActivo: 'PROFESOR', permisos: ['PLANES_ESTUDIO_VER'] } });
    iniciarPlanesEstudioPage();
    await tick();
    documento.getElementById('comparadorPlanesButton').click();
    await tick();
    assert.doesNotMatch(documento.getElementById('comparadorPlanesDialogContent').innerHTML, /id="compBtnCrearEq"|data-del-eq=/);
    documento.getElementById('cerrarComparadorBtn').click();

    planesDisponibles = planesDisponibles.slice(0, 1);
    iniciarPlanesEstudioPage();
    await tick();
    documento.getElementById('comparadorPlanesButton').click();
    await tick();
    assert.match(documento.getElementById('comparadorPlanesDialogContent').innerHTML, /Se necesitan al menos dos planes/);
    documento.getElementById('cerrarComparadorBtn').click();
    documento.getElementById('transicionCurricularButton').click();
    await tick();
    assert.match(documento.getElementById('transicionCurricularDialogContent').innerHTML, /Se necesitan al menos dos planes/);
    assert.equal(consultas.escrituras, 0);
  } finally {
    limpiarSesion();
    globalThis.document = documentoAnterior;
    globalThis.window = ventanaAnterior;
  }
});

test('una respuesta tardía no reemplaza los planes seleccionados después', async () => {
  const documentoAnterior = globalThis.document;
  const ventanaAnterior = globalThis.window;
  const documento = crearDocumento();
  globalThis.document = documento;
  let resolverPlanLento;
  const planLento = new Promise((resolve) => { resolverPlanLento = resolve; });
  globalThis.window = { sgpa: {
    listarPlanesEstudio: async () => ({ ok: true, planes: [1, 2, 3].map((id) => ({ id, carreraId: 10, codigo: `P${id}`, nombre: `Plan ${id}`, activo: true })) }),
    listarCarreras: async () => ({ ok: true, carreras: [{ id: 10, codigo: 'C', nombre: 'Carrera' }] }),
    listarPlanAsignaturas: async (id) => id === 3 ? planLento : { ok: true, asignaturas: [{ id: id * 10, creditos: 3, curso: { codigo: `C${id}`, nombre: `Curso ${id}` } }] },
    listarEquivalenciasPlanes: async () => ({ ok: true, data: [] }),
  } };
  guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL' } });
  try {
    iniciarPlanesEstudioPage();
    await tick();
    documento.getElementById('comparadorPlanesButton').click();
    await tick();
    documento.getElementById('compPlanDestinoSelect').change('3');
    documento.getElementById('compPlanDestinoSelect').change('2');
    await tick();
    resolverPlanLento({ ok: true, asignaturas: [{ id: 30, creditos: 3, curso: { codigo: 'C3', nombre: 'Curso 3' } }] });
    await tick();
    const html = documento.getElementById('comparadorPlanesDialogContent').innerHTML;
    assert.match(html, /Curso 2/);
    assert.doesNotMatch(html, /Curso 3/);
  } finally {
    limpiarSesion();
    globalThis.document = documentoAnterior;
    globalThis.window = ventanaAnterior;
  }
});

test('el comparador ignora la respuesta tras cerrar y limpia datos ante un fallo de red', async () => {
  const documentoAnterior = globalThis.document;
  const ventanaAnterior = globalThis.window;
  const documento = crearDocumento();
  globalThis.document = documento;
  let resolverPendiente;
  let modo = 'pendiente';
  let consultas = 0;
  const pendiente = new Promise((resolve) => { resolverPendiente = resolve; });
  globalThis.window = { sgpa: {
    listarPlanesEstudio: async () => ({ ok: true, planes: [1, 2, 3].map((id) => ({ id, carreraId: 10, codigo: `P${id}`, nombre: `Plan ${id}`, activo: true })) }),
    listarCarreras: async () => ({ ok: true, carreras: [{ id: 10, codigo: 'C', nombre: 'Carrera' }] }),
    listarPlanAsignaturas: async (id) => {
      consultas += 1;
      if (id === 3 && modo === 'pendiente') return pendiente;
      if (id === 3 && modo === 'fallo') throw new Error('Fallo de red QA');
      return { ok: true, asignaturas: [{ id: id * 10, creditos: 3, curso: { codigo: `C${id}`, nombre: `Curso ${id}` } }] };
    },
    listarEquivalenciasPlanes: async () => ({ ok: true, data: [] }),
  } };
  guardarSesion({ usuario: { rol: 'ADMIN_GLOBAL', rolActivo: 'ADMIN_GLOBAL' } });
  try {
    iniciarPlanesEstudioPage();
    await tick();
    documento.getElementById('comparadorPlanesButton').click();
    await tick();
    assert.equal(consultas, 2);
    documento.getElementById('comparadorPlanesButton').click();
    await tick();
    assert.equal(consultas, 2, 'otro clic con el diálogo abierto no inicia consultas duplicadas');

    documento.getElementById('compPlanDestinoSelect').change('3');
    assert.match(documento.getElementById('comparadorPlanesDialogContent').innerHTML, /Consultando asignaturas/);
    assert.doesNotMatch(documento.getElementById('comparadorPlanesDialogContent').innerHTML, /Curso 2/);
    documento.getElementById('cerrarComparadorBtn').click();
    assert.equal(documento.getElementById('comparadorPlanesDialog').open, false);
    resolverPendiente({ ok: true, asignaturas: [{ id: 30, creditos: 3, curso: { codigo: 'C3', nombre: 'Curso 3' } }] });
    await tick();
    assert.doesNotMatch(documento.getElementById('comparadorPlanesDialogContent').innerHTML, /Curso 3/);

    modo = 'fallo';
    documento.getElementById('comparadorPlanesButton').click();
    await tick();
    documento.getElementById('compPlanDestinoSelect').change('3');
    await tick();
    const html = documento.getElementById('comparadorPlanesDialogContent').innerHTML;
    assert.match(html, /Fallo de red QA/);
    assert.doesNotMatch(html, /Curso 2|Curso 3/);
  } finally {
    limpiarSesion();
    globalThis.document = documentoAnterior;
    globalThis.window = ventanaAnterior;
  }
});
