import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS_PERIODO,
  TRANSICIONES_PERIODO,
  obtenerTonoEstadoPeriodo,
  obtenerNombreEstadoPeriodo,
  obtenerNombreCicloPeriodo,
  formatearFechaPeriodo,
  esPeriodoEditable,
  filtrarPeriodosAcademicos,
} from '../src/pages/periodos/periodos.helpers.js';

test('periodos.helpers — mapeo de nombres de estados', () => {
  assert.equal(obtenerNombreEstadoPeriodo('BORRADOR'), 'Borrador');
  assert.equal(obtenerNombreEstadoPeriodo('EN_PREPARACION'), 'En preparación');
  assert.equal(obtenerNombreEstadoPeriodo('EN_CURSO'), 'En curso');
  assert.equal(obtenerNombreEstadoPeriodo('CERRADO'), 'Cerrado');
  assert.equal(obtenerNombreEstadoPeriodo('CANCELADO'), 'Cancelado');
  assert.equal(obtenerNombreEstadoPeriodo('OTRO'), 'OTRO');
  assert.equal(obtenerNombreEstadoPeriodo(null), 'Sin estado');
});

test('periodos.helpers — tonos de estado institucionales', () => {
  assert.equal(obtenerTonoEstadoPeriodo('BORRADOR'), 'neutral');
  assert.equal(obtenerTonoEstadoPeriodo('EN_PREPARACION'), 'info');
  assert.equal(obtenerTonoEstadoPeriodo('EN_CURSO'), 'success');
  assert.equal(obtenerTonoEstadoPeriodo('CERRADO'), 'neutral');
  assert.equal(obtenerTonoEstadoPeriodo('CANCELADO'), 'danger');
  assert.equal(obtenerTonoEstadoPeriodo('DESCONOCIDO'), 'neutral');
});

test('periodos.helpers — nombres de ciclo oficiales', () => {
  assert.equal(obtenerNombreCicloPeriodo(1), 'I Ciclo');
  assert.equal(obtenerNombreCicloPeriodo(2), 'II Ciclo');
  assert.equal(obtenerNombreCicloPeriodo(3), 'Verano');
  assert.equal(obtenerNombreCicloPeriodo(4), 'Ciclo 4');
});

test('periodos.helpers — formatear fechas a DD/MM/AAAA', () => {
  assert.equal(formatearFechaPeriodo('2026-03-01'), '01/03/2026');
  assert.equal(formatearFechaPeriodo(''), '—');
  assert.equal(formatearFechaPeriodo(null), '—');
  assert.equal(formatearFechaPeriodo('invalida'), 'invalida');
});

test('periodos.helpers — editabilidad de periodos', () => {
  assert.equal(esPeriodoEditable({ estado: 'BORRADOR' }), true);
  assert.equal(esPeriodoEditable({ estado: 'EN_PREPARACION' }), true);
  assert.equal(esPeriodoEditable({ estado: 'EN_CURSO' }), false);
  assert.equal(esPeriodoEditable({ estado: 'CERRADO' }), false);
  assert.equal(esPeriodoEditable({ estado: 'CANCELADO' }), false);
  assert.equal(esPeriodoEditable(null), false);
});

test('periodos.helpers — filtrado por texto y estado', () => {
  const lista = [
    { id: 1, codigo: 'PER-2026-1', nombre: 'I Ciclo 2026', anio: 2026, ciclo: 1, estado: 'BORRADOR' },
    { id: 2, codigo: 'PER-2026-2', nombre: 'II Ciclo 2026', anio: 2026, ciclo: 2, estado: 'EN_CURSO' },
    { id: 3, codigo: 'PER-2025-1', nombre: 'I Ciclo 2025', anio: 2025, ciclo: 1, estado: 'CERRADO' },
  ];

  assert.equal(filtrarPeriodosAcademicos(lista, '', '').length, 3);
  assert.equal(filtrarPeriodosAcademicos(lista, '2026', '').length, 2);
  assert.equal(filtrarPeriodosAcademicos(lista, '', 'EN_CURSO').length, 1);
  assert.equal(filtrarPeriodosAcademicos(lista, 'II Ciclo', 'EN_CURSO').length, 1);
  assert.equal(filtrarPeriodosAcademicos(lista, 'inexistente', '').length, 0);
});

test('periodos.helpers — transiciones de estado oficiales', () => {
  assert.deepEqual(TRANSICIONES_PERIODO.BORRADOR.map((t) => t.estado), ['EN_PREPARACION', 'CANCELADO']);
  assert.deepEqual(TRANSICIONES_PERIODO.EN_PREPARACION.map((t) => t.estado), ['EN_CURSO', 'CANCELADO']);
  assert.deepEqual(TRANSICIONES_PERIODO.EN_CURSO.map((t) => t.estado), ['CERRADO']);
  assert.deepEqual(TRANSICIONES_PERIODO.CERRADO, []);
  assert.deepEqual(TRANSICIONES_PERIODO.CANCELADO, []);
});
