import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordenarAsignaturasMalla, separarAsignaturasPlan } from '../src/pages/planes-estudio/PlanesEstudioPage.js';

test('activos antes de inactivos sin modificar el orden almacenado', () => {
  const datos = [
    { id: 1, activo: false, orden: 1 },
    { id: 2, activo: true, orden: 3 },
    { id: 3, activo: true, orden: 2 },
    { id: 4, activo: false, orden: 4 },
  ];
  assert.deepEqual(ordenarAsignaturasMalla(datos).map((item) => item.id), [3, 2, 1, 4]);
  assert.deepEqual(datos.map((item) => item.id), [1, 2, 3, 4]);
});

test('lista activa y papelera conservan las mismas asignaturas e identificadores', () => {
  const datos = [
    { id: 1, activo: true },
    { id: 2, activo: false },
    { id: 3, activo: true },
  ];
  const { activas, papelera } = separarAsignaturasPlan(datos);
  assert.deepEqual(activas.map((item) => item.id), [1, 3]);
  assert.deepEqual(papelera.map((item) => item.id), [2]);
  assert.equal(activas.length + papelera.length, datos.length);
});
