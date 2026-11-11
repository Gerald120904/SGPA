import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CursosPage,
  compararCursosPorEstadoYCodigo,
  calcularPaginacionCursos,
  CURSOS_POR_PAGINA,
  iniciarCursosPage,
} from '../src/pages/cursos/CursosPage.js';

import {
  filtrarCursos,
  obtenerCreditosCurso,
  obtenerCarreraCursoIds,
  cursoPerteneceACarrera,
  encontrarAsignaturaPlanCurso,
  obtenerRequisitosCurso,
} from '../src/pages/cursos/cursos.helpers.js';

import {
  CarrerasCursosCards,
  CursosCatalogoHeading,
  CursosTabla,
  renderizarPaginacionCursos,
  abrirDetalleRequisito,
} from '../src/pages/cursos/CursosCatalogo.js';

import { abrirRequisitosCurso } from '../src/pages/cursos/CursoRequisitosDialog.js';
import { abrirFormularioCurso } from '../src/pages/cursos/CursoForm.js';

/* =========================================================
   1. CONTRATOS PÚBLICOS Y EXPORTACIONES
   ========================================================= */

test('CursosPage: expone las funciones públicas y constantes requeridas', () => {
  assert.equal(typeof CursosPage, 'function');
  assert.equal(typeof iniciarCursosPage, 'function');
  assert.equal(typeof compararCursosPorEstadoYCodigo, 'function');
  assert.equal(typeof calcularPaginacionCursos, 'function');
  assert.equal(CURSOS_POR_PAGINA, 10);
});

test('CursoRequisitosDialog y CursoForm: exponen sus puntos de entrada modales', () => {
  assert.equal(typeof abrirRequisitosCurso, 'function');
  assert.equal(typeof abrirFormularioCurso, 'function');
});

/* =========================================================
   2. FUNCIONES PURAS DE ORDENAMIENTO
   ========================================================= */

test('compararCursosPorEstadoYCodigo: activos primero y código alfanumérico natural', () => {
  const lista = [
    { codigo: 'MAT-20', activo: false },
    { codigo: 'MAT-10', activo: true },
    { codigo: 'MAT-2', activo: true },
    { codigo: 'MAT-1', activo: false },
    { codigo: 'BIO-100', activo: true },
  ];

  const ordenados = [...lista].sort(compararCursosPorEstadoYCodigo);

  assert.deepEqual(
    ordenados.map((c) => `${c.activo}:${c.codigo}`),
    [
      'true:BIO-100',
      'true:MAT-2',
      'true:MAT-10',
      'false:MAT-1',
      'false:MAT-20',
    ],
  );
});

/* =========================================================
   3. FUNCIONES PURAS DE PAGINACIÓN
   ========================================================= */

test('calcularPaginacionCursos: calcula límites, rangos y páginas visibles correctamente', () => {
  // Caso 0 cursos
  const vacio = calcularPaginacionCursos(0, 1);
  assert.deepEqual(vacio, {
    total: 0,
    pagina: 1,
    totalPaginas: 1,
    inicio: 0,
    fin: 0,
    paginasVisibles: [1],
  });

  // Caso 25 cursos, página 2
  const p2 = calcularPaginacionCursos(25, 2);
  assert.equal(p2.total, 25);
  assert.equal(p2.totalPaginas, 3);
  assert.equal(p2.pagina, 2);
  assert.equal(p2.inicio, 10);
  assert.equal(p2.fin, 20);
  assert.deepEqual(p2.paginasVisibles, [1, 2, 3]);

  // Caso página fuera de rango superior
  const exceso = calcularPaginacionCursos(25, 99);
  assert.equal(exceso.pagina, 3);
  assert.equal(exceso.inicio, 20);
  assert.equal(exceso.fin, 25);

  // Caso muchas páginas (ventana máxima de 5 páginas visibles)
  const muchas = calcularPaginacionCursos(100, 6);
  assert.equal(muchas.totalPaginas, 10);
  assert.equal(muchas.pagina, 6);
  assert.deepEqual(muchas.paginasVisibles, [4, 5, 6, 7, 8]);
});

/* =========================================================
   4. FUNCIONES PURAS DE FILTRADO
   ========================================================= */

test('filtrarCursos: filtra por término de búsqueda y por estado', () => {
  const cursos = [
    { id: 1, codigo: 'INF-101', nombre: 'Programación I', descripcion: 'Fundamentos', activo: true },
    { id: 2, codigo: 'INF-102', nombre: 'Estructuras de Datos', descripcion: 'Avanzado', activo: true },
    { id: 3, codigo: 'MAT-201', nombre: 'Cálculo', descripcion: 'Diferencial', activo: false },
    { id: 4, codigo: 'HUM-301', nombre: 'Ética', descripcion: 'Filosofía e informática', activo: false },
  ];

  // Sin filtros -> devuelve todos ordenados (activos primero)
  const todos = filtrarCursos(cursos);
  assert.equal(todos.length, 4);
  assert.equal(todos[0].codigo, 'INF-101');

  // Filtro por búsqueda textual (nombre o código o descripción)
  const busqueda1 = filtrarCursos(cursos, { busqueda: 'informática' });
  assert.equal(busqueda1.length, 1);
  assert.equal(busqueda1[0].codigo, 'HUM-301');

  const busqueda2 = filtrarCursos(cursos, { busqueda: 'inf' });
  assert.equal(busqueda2.length, 3); // INF-101, INF-102 y HUM-301 por su descripción

  // Filtro por estado ACTIVOS
  const soloActivos = filtrarCursos(cursos, { estado: 'ACTIVOS' });
  assert.equal(soloActivos.length, 2);
  assert.ok(soloActivos.every((c) => c.activo === true));

  // Filtro por estado INACTIVOS
  const soloInactivos = filtrarCursos(cursos, { estado: 'INACTIVOS' });
  assert.equal(soloInactivos.length, 2);
  assert.ok(soloInactivos.every((c) => c.activo === false));

  // Búsqueda combinada con estado
  const combinada = filtrarCursos(cursos, { busqueda: 'datos', estado: 'ACTIVOS' });
  assert.equal(combinada.length, 1);
  assert.equal(combinada[0].codigo, 'INF-102');
});

/* =========================================================
   5. HELPERS DE RELACIONES ACADÉMICAS
   ========================================================= */

test('obtenerCreditosCurso: resuelve créditos con fallback', () => {
  assert.equal(obtenerCreditosCurso(null), 0);
  assert.equal(obtenerCreditosCurso({ creditos: 4 }), 4);
  assert.equal(obtenerCreditosCurso({ creditos: 3 }, { creditos: 5 }), 5);
  assert.equal(obtenerCreditosCurso({ planAsignatura: { creditos: 2 } }), 2);
});

test('obtenerCarreraCursoIds: extrae identificadores válidos', () => {
  assert.deepEqual(obtenerCarreraCursoIds(null), []);
  assert.deepEqual(obtenerCarreraCursoIds({ carreras: [{ id: 1 }, { id: '2' }, { id: -1 }, { id: null }] }), [1, 2]);
});

test('cursoPerteneceACarrera: determina pertenencia directa o por asignatura de plan', () => {
  const curso = { id: 10, codigo: 'INF-101', carreras: [{ id: 1 }] };

  assert.equal(cursoPerteneceACarrera(curso, 1), true);
  assert.equal(cursoPerteneceACarrera(curso, 2), false);

  // Por asignatura de plan vinculada por cursoId
  const asignaturas = [
    { id: 100, cursoId: 10, codigoReferencia: 'INF-101' },
  ];
  assert.equal(cursoPerteneceACarrera(curso, 2, asignaturas), true);

  // Por coincidencia de código de referencia
  const cursoSinCarreras = { id: 20, codigo: 'EIF-200', carreras: [] };
  const asignaturasRef = [
    { id: 200, cursoId: null, codigoReferencia: 'EIF-200' },
  ];
  assert.equal(cursoPerteneceACarrera(cursoSinCarreras, 3, asignaturasRef), true);
});

test('obtenerRequisitosCurso: mapea requisitos y correquisitos del plan', () => {
  const curso = { id: 5, codigo: 'PROG-2' };
  const asignaturasPlan = [
    { id: 50, cursoId: 5, codigoReferencia: 'PROG-2', nombreReferencia: 'Programación II' },
    { id: 40, cursoId: 4, codigoReferencia: 'PROG-1', nombreReferencia: 'Programación I', creditos: 4, nivel: 1, ciclo: 1 },
    { id: 41, cursoId: null, codigoReferencia: 'MAT-1', nombreReferencia: 'Matemática', creditos: 3, nivel: 1, ciclo: 1 },
  ];
  const requisitosPlan = [
    { id: 1, asignaturaId: 50, requisitoAsignaturaId: 40, tipo: 'REQUISITO' },
    { id: 2, asignaturaId: 50, requisitoAsignaturaId: 41, tipo: 'CORREQUISITO' },
  ];

  const requisitos = obtenerRequisitosCurso(curso, asignaturasPlan, requisitosPlan);
  assert.equal(requisitos.length, 2);

  assert.equal(requisitos[0].codigo, 'PROG-1');
  assert.equal(requisitos[0].tipo, 'REQUISITO');
  assert.equal(requisitos[0].creditos, 4);

  assert.equal(requisitos[1].codigo, 'MAT-1');
  assert.equal(requisitos[1].tipo, 'CORREQUISITO');
  assert.equal(requisitos[1].creditos, 3);
});

/* =========================================================
   6. RENDERIZADO VISUAL Y ESTRUCTURA DOM
   ========================================================= */

test('CursosPage: genera el marcado HTML completo con los selectores requeridos', () => {
  const html = CursosPage();

  assert.match(html, /id="cursosPage"/);
  assert.match(html, /id="cursosCarreras"/);
  assert.match(html, /id="cursosCatalogo"/);
  assert.match(html, /id="cursosCatalogoHeading"/);
  assert.match(html, /id="cursosBuscar"/);
  assert.match(html, /id="cursosEstado"/);
  assert.match(html, /id="restablecerCursosFiltros"/);
  assert.match(html, /id="cursosContent"/);
  assert.match(html, /id="cursoDialog"/);
  assert.match(html, /id="cursoRequisitoDialog"/);
});

test('CarrerasCursosCards: renderiza tarjetas de carreras con atributos data-curso-carrera', () => {
  const carreras = [
    { id: 1, codigo: 'INF', nombre: 'Informática', activo: true },
    { id: 2, codigo: 'ADM', nombre: 'Administración', activo: true },
  ];
  const cursos = [
    { id: 10, carreras: [{ id: 1 }] },
    { id: 20, carreras: [{ id: 1 }] },
  ];

  const html = CarrerasCursosCards({ carreras, cursos, carreraSeleccionadaId: 1 });

  assert.match(html, /data-curso-carrera="1"/);
  assert.match(html, /data-curso-carrera="2"/);
  assert.match(html, /is-selected/);
  assert.match(html, /Informática/);
  assert.match(html, /2\s+cursos/);
  assert.match(html, /0\s+cursos/);
});

test('CursosCatalogoHeading: renderiza título y código institucional', () => {
  const carrera = { id: 1, codigo: 'EIF', nombre: 'Ingeniería en Sistemas' };
  const plan = { id: 10, nombre: 'Plan 2026' };

  const html = CursosCatalogoHeading({ carrera, plan, cantidad: 15 });

  assert.match(html, /Ingeniería en Sistemas/);
  assert.match(html, /15\s+cursos\s+registrados/);
  assert.match(html, /Requisitos según Plan 2026/);
  assert.match(html, /EIF/);
});

test('renderizarPaginacionCursos: genera controles semánticos y botones accesibles', () => {
  const paginacion = {
    total: 25,
    pagina: 2,
    totalPaginas: 3,
    inicio: 10,
    fin: 20,
    paginasVisibles: [1, 2, 3],
  };

  const html = renderizarPaginacionCursos(paginacion);

  assert.match(html, /plan-level-pagination/);
  assert.match(html, /data-cursos-pagina="1"/);
  assert.match(html, /data-cursos-pagina="2"/);
  assert.match(html, /data-cursos-pagina="3"/);
  assert.match(html, /is-active/);
  assert.match(html, /Mostrando 11–20 de 25 cursos/);
});

test('CursosTabla: utiliza DataTable e incluye columnas, filas y acciones', () => {
  const cursos = [
    { id: 1, codigo: 'INF-101', nombre: 'Programación', creditos: 4, activo: true, puedeGestionarGlobal: true },
  ];

  const html = CursosTabla({ cursos, puedeGestionar: true });

  assert.match(html, /sgpa-data-table/);
  assert.match(html, /INF-101/);
  assert.match(html, /Programación/);
  assert.match(html, /data-action="requisitos"/);
  assert.match(html, /data-action="editar"/);
  assert.match(html, /data-action="estado"/);
  assert.match(html, /curso-status-active/);
});
