import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPOS_REQUISITO_PERFIL,
  CONDICIONES_PERFIL,
  filtrarPerfilesAcademicos,
  formatearEtiquetaTipo,
  formatearFechaPerfil,
  extraerLineasTexto,
  encontrarDuplicadoEnLineas,
} from '../src/pages/perfiles-academicos/perfiles-academicos.helpers.js';

test('perfiles-academicos.helpers — constantes y condiciones oficiales', () => {
  assert.ok(TIPOS_REQUISITO_PERFIL.includes('FORMACION_ACADEMICA'));
  assert.ok(TIPOS_REQUISITO_PERFIL.includes('JORNADA'));
  assert.ok(CONDICIONES_PERFIL.has('JORNADA'));
  assert.ok(CONDICIONES_PERFIL.has('HORARIO'));
  assert.ok(CONDICIONES_PERFIL.has('CAMPUS'));
  assert.equal(CONDICIONES_PERFIL.has('FORMACION_ACADEMICA'), false);
});

test('perfiles-academicos.helpers — formateo de etiquetas y fechas', () => {
  assert.equal(formatearEtiquetaTipo('FORMACION_ACADEMICA'), 'Formacion Academica');
  assert.equal(formatearEtiquetaTipo(''), 'No registrado');
  assert.equal(formatearEtiquetaTipo(null), 'No registrado');

  assert.equal(formatearFechaPerfil('2026-05-18T00:00:00.000Z'), '18/05/2026');
  assert.equal(formatearFechaPerfil('2026-10-31'), '31/10/2026');
  assert.equal(formatearFechaPerfil(''), null);
  assert.equal(formatearFechaPerfil(null), null);
});

test('perfiles-academicos.helpers — extracción de líneas y detección de duplicados case-insensitive', () => {
  const lineas = extraerLineasTexto('  Línea 1 \n\n Línea 2  \n  ');
  assert.deepEqual(lineas, ['Línea 1', 'Línea 2']);

  assert.equal(encontrarDuplicadoEnLineas(['Inglés B2', 'francés b1', 'INGLÉS b2']), 'INGLÉS b2');
  assert.equal(encontrarDuplicadoEnLineas(['Área 1', 'Área 2', 'Área 3']), null);
});

test('perfiles-academicos.helpers — filtrado de perfiles por texto y estado', () => {
  const perfiles = [
    { id: 1, codigo: 'PER-001', nombre: 'Docente Programación', numeroPerfil: 'NP-10', activo: true, carrera: { nombre: 'Informática' } },
    { id: 2, codigo: 'PER-002', nombre: 'Docente Cálculo', numeroPerfil: 'NP-20', activo: false, carrera: { nombre: 'Matemática' } },
    { id: 3, codigo: 'PER-003', nombre: 'Docente Redes', numeroPerfil: null, activo: true, carrera: { nombre: 'Informática' } },
  ];

  assert.equal(filtrarPerfilesAcademicos(perfiles, '', 'TODOS').length, 3);
  assert.equal(filtrarPerfilesAcademicos(perfiles, 'programación', 'TODOS').length, 1);
  assert.equal(filtrarPerfilesAcademicos(perfiles, 'informática', 'TODOS').length, 2);
  assert.equal(filtrarPerfilesAcademicos(perfiles, '', 'ACTIVOS').length, 2);
  assert.equal(filtrarPerfilesAcademicos(perfiles, '', 'INACTIVOS').length, 1);
  assert.equal(filtrarPerfilesAcademicos(perfiles, 'NP-20', 'INACTIVOS').length, 1);
});
