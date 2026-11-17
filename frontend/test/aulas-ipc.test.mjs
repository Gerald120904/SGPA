import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarAulasConsultasIpc } from '../src/electron/ipc/aulas.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const preloadSource = readFileSync(
  path.join(testDir, '..', 'src', 'preload.js'),
  'utf8',
);

const CANALES_CONSULTA_AULAS = [
  'aulas:listar',
  'aulas:obtener',
  'aulas:equipamientos:listar',
  'aulas:equipo-aula:listar',
  'aulas:indisponibilidades:listar',
  'aulas:indisponibilidades:obtener',
  'aulas:reservas:listar',
  'aulas:reservas:obtener',
  'aulas:ocupacion',
  'aulas:disponibilidades:listar',
  'aulas:auditoria:listar',
];

function crearArnesAulas(respuestaOImplementacion) {
  const handlers = new Map();
  const llamadas = [];
  const ipcMain = {
    handle(canal, fn) {
      handlers.set(canal, fn);
    },
  };
  const ejecutarPeticionAutenticada = async (ruta, opciones) => {
    llamadas.push({ ruta, opciones });
    if (typeof respuestaOImplementacion === 'function') {
      return respuestaOImplementacion(ruta, opciones);
    }
    return respuestaOImplementacion;
  };

  registrarAulasConsultasIpc({ ipcMain, ejecutarPeticionAutenticada });
  return { handlers, llamadas };
}

test('valida dependencias requeridas antes de registrar handlers de Aulas', () => {
  assert.throws(
    () => registrarAulasConsultasIpc({ ipcMain: null, ejecutarPeticionAutenticada: async () => ({ ok: true }) }),
    /ipcMain/,
  );
  assert.throws(
    () => registrarAulasConsultasIpc({ ipcMain: { handle() {} }, ejecutarPeticionAutenticada: null }),
    /ejecutarPeticionAutenticada/,
  );
});

test('registra exactamente los 11 canales de consulta y listado compatibles con preload.js', () => {
  const ordenRegistrado = [];
  registrarAulasConsultasIpc({
    ipcMain: {
      handle(canal) {
        ordenRegistrado.push(canal);
      },
    },
    ejecutarPeticionAutenticada: async () => ({ ok: true, data: [] }),
  });

  assert.deepEqual(ordenRegistrado, CANALES_CONSULTA_AULAS);
  for (const canal of CANALES_CONSULTA_AULAS) {
    assert.match(preloadSource, new RegExp(`['"]${canal}['"]`));
  }
});

test('handlers de listado envuelven resultado.data bajo su clave esperada y preservan rutas y filtros', async () => {
  const datosPrueba = [{ id: 10, nombre: 'A-101' }];
  const { handlers, llamadas } = crearArnesAulas({ ok: true, data: datosPrueba });

  assert.deepEqual(
    await handlers.get('aulas:listar')(null, {
      piso: 2,
      activas: true,
      capacidadMinima: 0,
      vacio: '',
      nulo: null,
      indefinido: undefined,
    }),
    { ok: true, aulas: datosPrueba },
  );
  assert.deepEqual(await handlers.get('aulas:listar')(null), {
    ok: true,
    aulas: datosPrueba,
  });
  assert.deepEqual(await handlers.get('aulas:equipamientos:listar')(null), {
    ok: true,
    equipamientos: datosPrueba,
  });
  assert.deepEqual(await handlers.get('aulas:equipo-aula:listar')(null, 7), {
    ok: true,
    equipamientos: datosPrueba,
  });
  assert.deepEqual(await handlers.get('aulas:indisponibilidades:listar')(null, 7), {
    ok: true,
    indisponibilidades: datosPrueba,
  });
  assert.deepEqual(await handlers.get('aulas:reservas:listar')(null, 7), {
    ok: true,
    reservas: datosPrueba,
  });
  assert.deepEqual(await handlers.get('aulas:disponibilidades:listar')(null, 7, 15), {
    ok: true,
    disponibilidades: datosPrueba,
  });
  assert.deepEqual(await handlers.get('aulas:auditoria:listar')(null, 7), {
    ok: true,
    auditoria: datosPrueba,
  });

  assert.deepEqual(
    llamadas.map((entry) => entry.ruta),
    [
      '/aulas?piso=2&activas=true&capacidadMinima=0',
      '/aulas',
      '/aulas/equipamientos',
      '/aulas/7/equipamientos',
      '/aulas/7/indisponibilidades',
      '/aulas/7/reservas',
      '/aulas/7/disponibilidades?periodoId=15',
      '/aulas/7/auditoria',
    ],
  );
  assert.ok(llamadas.every((entry) => entry.opciones === undefined));
});

test('handlers de detalle y ocupación devuelven la respuesta directa de ejecutarPeticionAutenticada con parámetros exactos', async () => {
  const respuestaDirecta = { ok: true, data: { id: 9, ocupado: false } };
  const { handlers, llamadas } = crearArnesAulas(respuestaDirecta);

  assert.deepEqual(await handlers.get('aulas:obtener')(null, 9), respuestaDirecta);
  assert.deepEqual(
    await handlers.get('aulas:indisponibilidades:obtener')(null, 9, 44),
    respuestaDirecta,
  );
  assert.deepEqual(await handlers.get('aulas:reservas:obtener')(null, 9, 55), respuestaDirecta);
  assert.deepEqual(
    await handlers.get('aulas:ocupacion')(null, 9, {
      fechaHoraInicio: '2026-11-11T08:00:00Z',
      fechaHoraFin: '2026-11-11T10:00:00Z',
    }),
    respuestaDirecta,
  );

  assert.deepEqual(
    llamadas.map((entry) => entry.ruta),
    [
      '/aulas/9',
      '/aulas/9/indisponibilidades/44',
      '/aulas/9/reservas/55',
      '/aulas/9/ocupacion?fechaHoraInicio=2026-11-11T08%3A00%3A00Z&fechaHoraFin=2026-11-11T10%3A00%3A00Z',
    ],
  );
});

test('conserva casos límite y propaga errores HTTP sin modificarlos', async () => {
  const error403 = { ok: false, status: 403, message: 'Sin permiso para consultar aulas.' };
  const { handlers: handlersError } = crearArnesAulas(error403);

  for (const [canal, args] of [
    ['aulas:listar', [null, {}]],
    ['aulas:obtener', [null, 1]],
    ['aulas:equipamientos:listar', [null]],
    ['aulas:equipo-aula:listar', [null, 1]],
    ['aulas:indisponibilidades:listar', [null, 1]],
    ['aulas:indisponibilidades:obtener', [null, 1, 2]],
    ['aulas:reservas:listar', [null, 1]],
    ['aulas:reservas:obtener', [null, 1, 2]],
    ['aulas:ocupacion', [null, 1, { fechaHoraInicio: 'a', fechaHoraFin: 'b' }]],
    ['aulas:disponibilidades:listar', [null, 1, 2]],
    ['aulas:auditoria:listar', [null, 1]],
  ]) {
    assert.deepEqual(await handlersError.get(canal)(...args), error403);
  }

  const { handlers: handlersEdge, llamadas } = crearArnesAulas({ ok: true, data: [] });
  await assert.rejects(
    () => handlersEdge.get('aulas:listar')(null, null),
    /Cannot convert undefined or null to object|Cannot read properties of null/,
  );
  await assert.rejects(
    () => handlersEdge.get('aulas:ocupacion')(null, 1, null),
    /Cannot read properties of null/,
  );
  await handlersEdge.get('aulas:disponibilidades:listar')(null, 1, undefined);
  assert.equal(llamadas.at(-1).ruta, '/aulas/1/disponibilidades?periodoId=undefined');
});
