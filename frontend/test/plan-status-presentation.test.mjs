import test from 'node:test';
import assert from 'node:assert/strict';
import { obtenerPresentacionEstadoPlan } from '../src/pages/planes-estudio/plan-status-presentation.mjs';

test('presenta un plan borrador como Borrador y no como Vigente', () => {
  assert.deepEqual(obtenerPresentacionEstadoPlan({ estado: 'BORRADOR', activo: true }), {
    estado: 'BORRADOR', etiqueta: 'Borrador', clase: 'is-inactive',
  });
});

test('presenta correctamente los estados vigentes, en transición y cerrados', () => {
  assert.equal(obtenerPresentacionEstadoPlan({ estado: 'VIGENTE' }).etiqueta, 'Vigente');
  assert.equal(obtenerPresentacionEstadoPlan({ estado: 'EN_TRANSICION', activo: true }).etiqueta, 'Cerrado a nuevos ingresos');
  assert.equal(obtenerPresentacionEstadoPlan({ estado: 'CERRADO' }).etiqueta, 'Cerrado definitivamente');
});

test('usa activo como respaldo cuando no hay estado explícito', () => {
  assert.equal(obtenerPresentacionEstadoPlan({ activo: true }).etiqueta, 'Vigente');
  assert.equal(obtenerPresentacionEstadoPlan({ activo: false }).etiqueta, 'Cerrado definitivamente');
});
