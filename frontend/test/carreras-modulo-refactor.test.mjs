import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filtrarCarreras,
  validarDatosCarrera,
} from '../src/pages/carreras/carreras.helpers.js';

test('carreras.helpers — filtrado por texto y estado', () => {
  const lista = [
    { id: 1, codigo: 'INF', nombre: 'Informática', descripcion: 'Ingeniería en Sistemas', activo: true },
    { id: 2, codigo: 'MAT', nombre: 'Matemática', descripcion: 'Ciencias Exactas', activo: false },
    { id: 3, codigo: 'ADM', nombre: 'Administración', descripcion: null, activo: true },
  ];

  assert.equal(filtrarCarreras(lista, '', 'TODAS').length, 3);
  assert.equal(filtrarCarreras(lista, '', 'ACTIVAS').length, 2);
  assert.equal(filtrarCarreras(lista, '', 'INACTIVAS').length, 1);
  assert.equal(filtrarCarreras(lista, 'Sistemas', 'TODAS').length, 1);
  assert.equal(filtrarCarreras(lista, 'inf', 'ACTIVAS').length, 1);
  assert.equal(filtrarCarreras(lista, 'inf', 'INACTIVAS').length, 0);
});

test('carreras.helpers — validación de datos de carrera', () => {
  const resValido = validarDatosCarrera({
    codigo: 'info',
    nombre: 'Ingeniería en Informática',
    descripcion: 'Plan de estudios de la carrera',
  });
  assert.equal(resValido.valido, true);
  assert.equal(resValido.datos.codigo, 'INFO');

  const resInvalido = validarDatosCarrera({
    codigo: '',
    nombre: '',
    descripcion: 'D'.repeat(501),
  });
  assert.equal(resInvalido.valido, false);
  assert.ok(resInvalido.errores.codigo);
  assert.ok(resInvalido.errores.nombre);
  assert.ok(resInvalido.errores.descripcion);
});
