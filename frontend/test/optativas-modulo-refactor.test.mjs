import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIAS_OPTATIVA,
  obtenerEtiquetaCategoria,
  filtrarOptativas,
} from '../src/pages/optativas/optativas.helpers.js';

test('optativas.helpers — etiquetas de categorías', () => {
  assert.equal(obtenerEtiquetaCategoria('DISCIPLINARIA'), 'Disciplinaria');
  assert.equal(obtenerEtiquetaCategoria('ABIERTA'), 'Abierta');
  assert.equal(obtenerEtiquetaCategoria('SEDE'), 'Sede');
  assert.equal(obtenerEtiquetaCategoria('OTRA'), 'OTRA');
  assert.equal(obtenerEtiquetaCategoria(null), '—');
});

test('optativas.helpers — filtrado por búsqueda, categoría y estado', () => {
  const lista = [
    { id: 1, curso: { codigo: 'OPT-101', nombre: 'Inteligencia Artificial' }, tipo: 'DISCIPLINARIA', activo: true },
    { id: 2, curso: { codigo: 'OPT-202', nombre: 'Fotografía Digital' }, tipo: 'ABIERTA', activo: false },
    { id: 3, curso: { codigo: 'OPT-303', nombre: 'Ecología Aplicada' }, tipo: 'SEDE', activo: true },
  ];

  assert.equal(filtrarOptativas(lista, {}).length, 3);
  assert.equal(filtrarOptativas(lista, { busqueda: 'artificial' }).length, 1);
  assert.equal(filtrarOptativas(lista, { tipo: 'ABIERTA' }).length, 1);
  assert.equal(filtrarOptativas(lista, { estado: 'ACTIVA' }).length, 2);
  assert.equal(filtrarOptativas(lista, { estado: 'INACTIVA' }).length, 1);
  assert.equal(filtrarOptativas(lista, { busqueda: 'OPT-101', tipo: 'DISCIPLINARIA', estado: 'ACTIVA' }).length, 1);
});
