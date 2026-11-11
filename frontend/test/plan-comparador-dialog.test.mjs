import test from 'node:test';
import assert from 'node:assert/strict';
import {
  abrirComparadorPlanes,
  abrirTransicionCurricular,
} from '../src/pages/planes-estudio/PlanComparadorDialog.js';

test('PlanComparadorDialog — abrirComparadorPlanes monta diálogo y selectores de planes', async () => {
  const content = { innerHTML: '', querySelectorAll: () => [] };
  const dialog = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    addEventListener() {},
  };

  global.document = {
    getElementById: (id) => {
      if (id === 'comparadorPlanesDialog') return dialog;
      if (id === 'comparadorPlanesDialogContent') return content;
      return null;
    },
    querySelectorAll: () => [],
  };

  const planesMock = [
    { id: 1, carreraId: 10, codigo: 'INF-2018', nombre: 'Plan 2018', activo: true },
    { id: 2, carreraId: 10, codigo: 'INF-2024', nombre: 'Plan 2024', activo: true },
  ];
  const carrerasMock = [
    { id: 10, codigo: 'EIF', nombre: 'Ingeniería en Informática' },
  ];

  await abrirComparadorPlanes({
    planes: planesMock,
    carrerasDisponibles: carrerasMock,
    carreraIdInicial: 10,
    planOrigenIdInicial: 1,
    puedeGestionar: true,
  });

  assert.match(content.innerHTML, /Comparador Visual de Planes/);
  assert.match(content.innerHTML, /id="compCarreraSelect"/);
  assert.match(content.innerHTML, /id="compPlanOrigenSelect"/);
  assert.match(content.innerHTML, /id="compPlanDestinoSelect"/);
  assert.match(content.innerHTML, /INF-2018/);
  assert.match(content.innerHTML, /INF-2024/);
});

test('PlanComparadorDialog — abrirTransicionCurricular monta herramienta de transición', async () => {
  const content = { innerHTML: '', querySelectorAll: () => [] };
  const dialog = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    addEventListener() {},
  };

  global.document = {
    getElementById: (id) => {
      if (id === 'transicionCurricularDialog') return dialog;
      if (id === 'transicionCurricularDialogContent') return content;
      return null;
    },
    querySelectorAll: () => [],
  };

  const planesMock = [
    { id: 1, carreraId: 10, codigo: 'INF-2018', nombre: 'Plan 2018', activo: true },
    { id: 2, carreraId: 10, codigo: 'INF-2024', nombre: 'Plan 2024', activo: true },
  ];
  const carrerasMock = [
    { id: 10, codigo: 'EIF', nombre: 'Ingeniería en Informática' },
  ];

  await abrirTransicionCurricular({
    planes: planesMock,
    carrerasDisponibles: carrerasMock,
    planOrigenIdInicial: 1,
    puedeGestionar: true,
  });

  assert.match(content.innerHTML, /Transición Curricular Institucional/);
  assert.match(content.innerHTML, /tcBtnCargarPoblacion/);
});
