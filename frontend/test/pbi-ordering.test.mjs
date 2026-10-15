import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compararCursosPorEstadoYCodigo,
} from '../src/pages/cursos/CursosPage.js';
import {
  compararAulasPorEstadoYNumero,
} from '../src/pages/aulas/AulasPage.js';

test('cursos: activos primero y código numérico dentro de cada estado', () => {
  const resultado = [
    { codigo: 'TEST-20', activo: false },
    { codigo: 'TEST-10', activo: true },
    { codigo: 'TEST-3', activo: false },
    { codigo: 'TEST-2', activo: true },
  ].sort(compararCursosPorEstadoYCodigo);

  assert.deepEqual(
    resultado.map((curso) => `${curso.activo}:${curso.codigo}`),
    [
      'true:TEST-2',
      'true:TEST-10',
      'false:TEST-3',
      'false:TEST-20',
    ],
  );
});

test('aulas: activas primero y número natural dentro de cada estado', () => {
  const resultado = [
    { codigo: 'TEST-20', nombre: 'Aula 20', activo: false },
    { codigo: 'TEST-10', nombre: 'Aula 10', activo: true },
    { codigo: 'TEST-3', nombre: 'Aula 3', activo: false },
    { codigo: 'TEST-2', nombre: 'Aula 2', activo: true },
  ].sort(compararAulasPorEstadoYNumero);

  assert.deepEqual(
    resultado.map((aula) => `${aula.activo}:${aula.codigo}`),
    [
      'true:TEST-2',
      'true:TEST-10',
      'false:TEST-3',
      'false:TEST-20',
    ],
  );
});

