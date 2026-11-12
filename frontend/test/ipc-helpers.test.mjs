import assert from 'node:assert/strict';
import test from 'node:test';

import {
  construirRutaConFiltros,
  normalizarMensajeBackend,
  normalizarPayloadColeccion,
} from '../src/electron/ipc-helpers.js';

test('normalizarMensajeBackend une arreglos, respeta cadenas y usa respaldo ante vacío', () => {
  assert.equal(
    normalizarMensajeBackend({ message: ['Campo requerido', 'Formato inválido'] }, 'Respaldo'),
    'Campo requerido. Formato inválido',
  );
  assert.equal(
    normalizarMensajeBackend({ message: 'Credenciales inválidas' }, 'Respaldo'),
    'Credenciales inválidas',
  );
  assert.equal(normalizarMensajeBackend({ message: '' }, 'Respaldo'), 'Respaldo');
  assert.equal(normalizarMensajeBackend(null, 'Respaldo'), 'Respaldo');
  assert.equal(normalizarMensajeBackend('texto plano', 'Respaldo'), 'Respaldo');
  assert.equal(normalizarMensajeBackend({}), '');
});

test('construirRutaConFiltros serializa todas las entradas definidas y no vacías por defecto', () => {
  assert.equal(construirRutaConFiltros('/aulas', {}), '/aulas');
  assert.throws(
    () => construirRutaConFiltros('/aulas', null),
    /Cannot convert undefined or null to object|Cannot read properties of null/,
    'Debe conservar el comportamiento previo para el objeto de filtros nulo.',
  );
  assert.equal(
    construirRutaConFiltros('/aulas', {
      carreraId: 3,
      capacidadMinima: 0,
      soloActivos: false,
      vacio: '',
      nulo: null,
      indefinido: undefined,
    }),
    '/aulas?carreraId=3&capacidadMinima=0&soloActivos=false',
  );
});

test('construirRutaConFiltros respeta lista blanca de claves y clavesTrim', () => {
  assert.equal(
    construirRutaConFiltros(
      '/estudiantes',
      {
        texto: '  Ana Soto  ',
        carreraId: 2,
        planEstudioId: 0,
        periodoIngresoId: '',
        estado: 'ACTIVO',
        extraIgnorado: 'nope',
      },
      {
        claves: ['texto', 'carreraId', 'planEstudioId', 'periodoIngresoId', 'estado'],
        clavesTrim: ['texto'],
      },
    ),
    '/estudiantes?texto=Ana+Soto&carreraId=2&estado=ACTIVO',
  );

  assert.equal(
    construirRutaConFiltros(
      '/estudiantes',
      { texto: '   ' },
      { claves: ['texto'], clavesTrim: ['texto'] },
    ),
    '/estudiantes',
  );

  assert.equal(
    construirRutaConFiltros(
      '/planes-estudio/transiciones/lotes',
      { carreraId: 1, planOrigenId: undefined, planDestinoId: 5 },
      { claves: ['carreraId', 'planOrigenId', 'planDestinoId'] },
    ),
    '/planes-estudio/transiciones/lotes?carreraId=1&planDestinoId=5',
  );
  assert.equal(
    construirRutaConFiltros(
      '/planes-estudio/transiciones/lotes',
      { carreraId: 'A&B', planOrigenId: 'plan/1', planDestinoId: 'ciclo 2' },
      { claves: ['carreraId', 'planOrigenId', 'planDestinoId'], codificar: false },
    ),
    '/planes-estudio/transiciones/lotes?carreraId=A&B&planOrigenId=plan/1&planDestinoId=ciclo 2',
    'Debe conservar la query manual histórica en la ruta de lotes.',
  );

  assert.equal(
    construirRutaConFiltros('/profesores', { nombre: 'A&B / C' }),
    '/profesores?nombre=A%26B+%2F+C',
    'Las rutas que usaban URLSearchParams deben mantener la codificación.',
  );

  assert.throws(
    () => construirRutaConFiltros(
      '/estudiantes',
      { texto: 7 },
      { claves: ['texto'], clavesTrim: ['texto'] },
    ),
    /trim/,
    'Debe conservar el fallo previo ante texto con tipo incompatible.',
  );
});

test('normalizarPayloadColeccion envuelve arreglos y conserva payloads ya envueltos', () => {
  assert.deepEqual(normalizarPayloadColeccion([1, 2, 3], 'registroIds'), {
    registroIds: [1, 2, 3],
  });
  assert.deepEqual(
    normalizarPayloadColeccion({ registroIds: [4], motivo: 'ok' }, 'registroIds'),
    { registroIds: [4], motivo: 'ok' },
  );
  assert.deepEqual(normalizarPayloadColeccion(undefined, 'rechazos'), {
    rechazos: undefined,
  });
});
