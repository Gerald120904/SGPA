import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../src/pages/planes-estudio/PlanesEstudioPage.js', import.meta.url),
  'utf8',
);

function functionSource(start, next) {
  const from = source.indexOf(start);
  const to = source.indexOf(next, from);
  assert.ok(from >= 0 && to > from, `No se encontró ${start}`);
  return source.slice(from, to);
}

const functions = [
  ['function renderizarDetallePlan()', 'function crearFilaCargaRapidaAsignatura('],
  ['function actualizarListaRequisitos(', 'function abrirFormularioRequisitos('],
  ['async function agregarRequisitoFrontend(', 'async function eliminarRequisitoFrontend('],
  ['async function eliminarRequisitoFrontend(', 'async function recargarRequisitosPlan('],
  ['async function recargarRequisitosPlan(', 'async function recargarResumenPlan('],
  ['async function recargarResumenPlan(', 'function renderizarDatoResumen('],
].map(([start, next]) => functionSource(start, next)).join('\n');

function fixture() {
  const eventos = new Map();
  const llamadas = { render: 0, exito: [], crear: [], eliminar: [], resumen: 0 };
  let relaciones = [];
  let nextId = 1;
  let focused = null;

  const classList = () => ({ add() {}, remove() {} });
  const error = { textContent: '', classList: classList() };
  const button = {
    disabled: false,
    isConnected: true,
    focus() { focused = this; },
  };
  const tipo = { value: 'REQUISITO' };
  const select = {
    value: '2',
    focus() { focused = this; },
  };
  const list = { innerHTML: '' };
  const count = { textContent: '0' };
  const form = { isConnected: true, marker: 'contexto-original' };
  const dialog = {
    open: true,
    isConnected: true,
    dataset: {},
    addEventListener(name, callback) {
      const handlers = eventos.get(name) || [];
      handlers.push(callback);
      eventos.set(name, handlers);
    },
    close() {
      this.open = false;
      for (const callback of eventos.get('close') || []) callback();
    },
  };
  const container = {
    set innerHTML(value) {
      this.html = value;
      llamadas.render++;
      dialog.isConnected = false;
      form.isConnected = false;
      button.isConnected = false;
    },
  };
  const elements = {
    planesEstudioPage: container,
    asignaturaDialog: dialog,
    requisitoForm: form,
    requisitosFormError: error,
    agregarRequisitoButton: button,
    requisitoTipo: tipo,
    requisitoAsignatura: select,
  };
  const document = {
    getElementById(id) { return elements[id] ?? null; },
    querySelector(selector) {
      if (!form.isConnected) return null;
      if (selector === '#requisitoForm .plan-requirements-list') return list;
      if (selector === '#requisitoForm .plan-requirements-count') return count;
      return null;
    },
  };
  const asignaturasPlan = [
    { id: 1, activo: true, nivel: 1, ciclo: 1, orden: 1, creditos: 3, curso: { codigo: 'A', nombre: 'Principal' } },
    { id: 2, activo: true, nivel: 1, ciclo: 1, orden: 2, creditos: 3, curso: { codigo: 'B', nombre: 'Anterior' } },
    { id: 3, activo: true, nivel: 1, ciclo: 1, orden: 3, creditos: 3, curso: { codigo: 'C', nombre: 'Paralela' } },
  ];
  const planSeleccionado = { id: 7 };
  const context = vm.createContext({
    document,
    window: {},
    planSeleccionado,
    asignaturasPlan,
    requisitosPlan: [],
    resumenPlan: null,
    reglaOptativasPlan: null,
    vistaDetallePlan: 'LISTA',
    observerMalla: null,
    frameDibujoMalla: null,
    puedeGestionarPlanes: () => true,
    obtenerAsignaturaPorId: (id) => asignaturasPlan.find((item) => item.id === id),
    obtenerRequisitosDeAsignatura: (id) => vm.runInContext('requisitosPlan', context).filter((item) => item.asignaturaId === id),
    obtenerDatosAsignatura: (item) => item.curso || item,
    escapeHtml: (value) => String(value),
    renderizarIconos() {},
    renderizarListaAsignaturas: () => '<section>Detalle actualizado</section>',
    VerPlanPage: ({ contenidoVista }) => contenidoVista,
    conectarEventosDetallePlan() {},
    mostrarFeedbackDetalle() {},
    mostrarExito: (args) => llamadas.exito.push(args),
    confirmarAccion: async () => true,
    crearPlanRequisito: async (planId, datos) => {
      llamadas.crear.push({ planId, ...datos });
      if (datos.asignaturaId === datos.requisitoAsignaturaId ||
          relaciones.some((item) => item.asignaturaId === datos.asignaturaId && item.requisitoAsignaturaId === datos.requisitoAsignaturaId) ||
          relaciones.some((item) => item.asignaturaId === datos.requisitoAsignaturaId && item.requisitoAsignaturaId === datos.asignaturaId)) {
        return { ok: false, message: 'Relación inválida o circular' };
      }
      relaciones.push({ id: nextId++, ...datos });
      return { ok: true };
    },
    eliminarPlanRequisito: async (planId, id) => {
      llamadas.eliminar.push({ planId, id });
      relaciones = relaciones.filter((item) => item.id !== id);
      return { ok: true };
    },
    listarPlanRequisitos: async () => ({ ok: true, requisitos: structuredClone(relaciones) }),
    obtenerResumenPlan: async () => {
      llamadas.resumen++;
      return { ok: true, resumen: { relaciones: relaciones.length } };
    },
  });
  vm.runInContext(`${functions}\nglobalThis.flujo = { agregarRequisitoFrontend, eliminarRequisitoFrontend };`, context);

  return {
    context, dialog, form, button, select, tipo, list, count, error, llamadas,
    asignatura: asignaturasPlan[0],
    get focused() { return focused; },
    get relaciones() { return relaciones; },
  };
}

test('prerrequisito y correquisito consecutivos actualizan el DOM sin perder diálogo, selección ni foco', async () => {
  const ui = fixture();
  await ui.context.flujo.agregarRequisitoFrontend(ui.asignatura);
  assert.equal(ui.llamadas.crear[0].tipo, 'REQUISITO');
  assert.equal(ui.count.textContent, '1');
  assert.match(ui.list.innerHTML, /Anterior/);
  assert.equal(ui.llamadas.render, 0);
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.form.isConnected, true);
  assert.equal(ui.form.marker, 'contexto-original');
  assert.equal(ui.select.value, '2');
  assert.equal(ui.focused, ui.button);

  ui.tipo.value = 'CORREQUISITO';
  ui.select.value = '3';
  await ui.context.flujo.agregarRequisitoFrontend(ui.asignatura);
  assert.equal(ui.llamadas.crear[1].tipo, 'CORREQUISITO');
  assert.equal(ui.count.textContent, '2');
  assert.equal((ui.list.innerHTML.match(/class="plan-requirement-row"/g) || []).length, 2);
  assert.match(ui.list.innerHTML, /Paralela/);
  assert.equal(ui.llamadas.exito.length, 2);
  assert.equal(ui.llamadas.exito[1].titulo, 'Relación agregada');
  assert.equal(ui.llamadas.resumen, 2);
  assert.equal(ui.llamadas.render, 0);
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.form.isConnected, true);
  assert.equal(ui.select.value, '3');

  ui.dialog.close();
  assert.equal(ui.llamadas.render, 1);
  assert.equal(ui.context.resumenPlan.relaciones, 2);
});

test('relaciones inválidas se rechazan sin perder datos; después se puede eliminar una relación', async () => {
  const ui = fixture();
  await ui.context.flujo.agregarRequisitoFrontend(ui.asignatura);
  await ui.context.flujo.agregarRequisitoFrontend(ui.asignatura);
  assert.equal(ui.relaciones.length, 1);
  assert.match(ui.error.textContent, /inválida o circular/);
  assert.equal(ui.llamadas.exito.length, 1);
  assert.equal(ui.count.textContent, '1');
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.form.isConnected, true);

  ui.select.value = '1';
  await ui.context.flujo.agregarRequisitoFrontend(ui.asignatura);
  assert.equal(ui.relaciones.length, 1);
  assert.equal(ui.llamadas.exito.length, 1);

  await ui.context.flujo.eliminarRequisitoFrontend(ui.relaciones[0].id, ui.asignatura);
  assert.equal(ui.llamadas.eliminar.length, 1);
  assert.equal(ui.relaciones.length, 0);
  assert.equal(ui.count.textContent, '0');
  assert.doesNotMatch(ui.list.innerHTML, /class="plan-requirement-row"/);
  assert.equal(ui.llamadas.render, 0);
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.form.isConnected, true);
  assert.equal(ui.focused, ui.select);
});
