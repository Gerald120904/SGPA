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
  clasificarAreasPerfil,
  clasificarRequisitosPerfil,
  obtenerCursosCarreraOrdenados,
  filtrarCursosPerfilPorBusqueda,
} from '../src/pages/perfiles-academicos/perfiles-academicos.helpers.js';
import { renderizarTablaPerfiles } from '../src/pages/perfiles-academicos/PerfilesCatalogo.js';
import { renderizarDetallePerfilHtml } from '../src/pages/perfiles-academicos/PerfilDetalleView.js';

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

test('perfiles-academicos.helpers — clasificación de áreas, requisitos y cursos de la carrera', () => {
  const areas = clasificarAreasPerfil([
    { tipo: 'DISCIPLINAR', descripcion: 'Algoritmos' },
    { tipo: 'ESTRATEGICA', descripcion: 'Investigación' },
  ]);
  assert.equal(areas.disciplinares.length, 1);
  assert.equal(areas.estrategicas.length, 1);

  const reqs = clasificarRequisitosPerfil([
    { tipo: 'FORMACION_ACADEMICA', obligatorio: true, descripcion: 'Licenciatura' },
    { tipo: 'CAPACITACIONES', obligatorio: false, descripcion: 'Docencia' },
    { tipo: 'JORNADA', obligatorio: true, descripcion: 'Tiempo completo' },
  ]);
  assert.equal(reqs.obligatorios.length, 1);
  assert.equal(reqs.facultativos.length, 1);
  assert.equal(reqs.condiciones.length, 1);

  const cursos = obtenerCursosCarreraOrdenados(
    [
      { id: 1, codigo: 'EIF-202', nombre: 'B', activo: true, carreras: [{ id: 10 }] },
      { id: 2, codigo: 'EIF-101', nombre: 'A', activo: true, carreras: [{ id: 10 }] },
      { id: 3, codigo: 'MAT-101', nombre: 'C', activo: true, carreras: [{ id: 99 }] },
      { id: 4, codigo: 'EIF-999', nombre: 'Inactivo', activo: false, carreras: [{ id: 10 }] },
    ],
    10,
  );
  assert.deepEqual(
    cursos.map((c) => c.codigo),
    ['EIF-101', 'EIF-202'],
  );
  assert.equal(filtrarCursosPerfilPorBusqueda(cursos, '202').length, 1);
});

test('PerfilesCatalogo y PerfilDetalleView — catálogo y detalle respetan bloqueo estructural y solo lectura', () => {
  const tabla = renderizarTablaPerfiles({
    perfiles: [
      { id: 8, codigo: 'PD-08', nombre: 'Redes', activo: true, carrera: { nombre: 'Sistemas' } },
    ],
  });
  assert.match(tabla, /PD-08/);
  assert.match(tabla, /data-ver-perfil="8"/);

  const detalleBloqueado = renderizarDetallePerfilHtml({
    perfil: {
      id: 8,
      codigo: 'PD-08',
      nombre: 'Redes',
      activo: true,
      utilizado: true,
      estructuraEditable: false,
      carrera: { nombre: 'Sistemas' },
      cursos: [{ cursoId: 1, activo: true, curso: { codigo: 'EIF-300' } }],
    },
    areas: [{ tipo: 'DISCIPLINAR', descripcion: 'Telecomunicaciones' }],
    requisitos: [{ tipo: 'HORARIO', obligatorio: true, descripcion: 'Diurno' }],
    puedeGestionar: true,
  });
  assert.match(detalleBloqueado, /Configuración bloqueada/);
  assert.match(detalleBloqueado, /EIF-300/);
  assert.doesNotMatch(detalleBloqueado, /data-editar-areas|data-editar-requisitos/);
  assert.match(detalleBloqueado, /data-gestionar-cursos[\s\S]*disabled/);

  const detalleLectura = renderizarDetallePerfilHtml({
    perfil: {
      id: 9,
      codigo: 'PD-09',
      nombre: 'Datos',
      activo: true,
      utilizado: false,
      estructuraEditable: true,
    },
    puedeGestionar: false,
  });
  assert.doesNotMatch(
    detalleLectura,
    /data-editar-perfil|data-cambiar-estado-perfil|data-gestionar-cursos/,
  );
});
