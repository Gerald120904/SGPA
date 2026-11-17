import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarAulasIndisponibilidadesIpc } from '../src/electron/ipc/aulas-indisponibilidades.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const preloadSource = readFileSync(
  path.join(frontendDir, 'src', 'preload.js'),
  'utf8',
);
const mainSource = readFileSync(
  path.join(frontendDir, 'src', 'main.js'),
  'utf8',
);

const CANALES_INDISPONIBILIDADES_AULAS = [
  'aulas:indisponibilidades:crear',
  'aulas:indisponibilidades:actualizar',
  'aulas:indisponibilidades:cambiar-estado',
];

function crearArnesIndisponibilidades(respuestaOImplementacion) {
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

  registrarAulasIndisponibilidadesIpc({ ipcMain, ejecutarPeticionAutenticada });
  return { handlers, llamadas };
}

test('valida dependencias requeridas antes de registrar indisponibilidades de Aulas', () => {
  assert.throws(
    () =>
      registrarAulasIndisponibilidadesIpc({
        ipcMain: null,
        ejecutarPeticionAutenticada: async () => ({ ok: true }),
      }),
    /ipcMain/,
  );
  assert.throws(
    () =>
      registrarAulasIndisponibilidadesIpc({
        ipcMain: { handle() {} },
        ejecutarPeticionAutenticada: null,
      }),
    /ejecutarPeticionAutenticada/,
  );
});

test('registra exactamente una vez los 3 canales de indisponibilidades compatibles con preload.js', () => {
  const registrados = [];
  registrarAulasIndisponibilidadesIpc({
    ipcMain: {
      handle(canal) {
        registrados.push(canal);
      },
    },
    ejecutarPeticionAutenticada: async () => ({ ok: true }),
  });

  assert.deepEqual(registrados, CANALES_INDISPONIBILIDADES_AULAS);
  assert.equal(new Set(registrados).size, 3);
  assert.match(
    preloadSource,
    /crearIndisponibilidadAula:\s*\([\s\S]*?aulaId,\s*datos[\s\S]*?\)\s*=>[\s\S]*?'aulas:indisponibilidades:crear',\s*aulaId,\s*datos/,
  );
  assert.match(
    preloadSource,
    /actualizarIndisponibilidadAula:\s*\([\s\S]*?aulaId,\s*id,\s*datos[\s\S]*?\)\s*=>[\s\S]*?'aulas:indisponibilidades:actualizar',\s*aulaId,\s*id,\s*datos/,
  );
  assert.match(
    preloadSource,
    /cambiarEstadoIndisponibilidadAula:\s*\([\s\S]*?aulaId,\s*id,\s*activo[\s\S]*?\)\s*=>[\s\S]*?'aulas:indisponibilidades:cambiar-estado',\s*aulaId,\s*id,\s*activo/,
  );
});

test('envía métodos, rutas, cuerpos y respuestas equivalentes para crear, actualizar y cambiar estado', async () => {
  const respuestaOk = { ok: true, data: { id: 19, aulaId: 4, activo: false } };
  const { handlers, llamadas } = crearArnesIndisponibilidades(respuestaOk);

  const datosCrear = {
    fechaInicio: '2026-11-15T08:00:00Z',
    fechaFin: '2026-11-15T12:00:00Z',
    motivo: 'Mantenimiento eléctrico',
  };
  const datosActualizar = {
    motivo: 'Mantenimiento reprogramado',
  };

  assert.deepEqual(
    await handlers.get('aulas:indisponibilidades:crear')(null, 4, datosCrear),
    respuestaOk,
  );
  assert.deepEqual(
    await handlers.get('aulas:indisponibilidades:actualizar')(null, 4, 19, datosActualizar),
    respuestaOk,
  );
  assert.deepEqual(
    await handlers.get('aulas:indisponibilidades:cambiar-estado')(null, 4, 19, false),
    respuestaOk,
  );

  assert.deepEqual(llamadas, [
    {
      ruta: '/aulas/4/indisponibilidades',
      opciones: { method: 'POST', body: datosCrear },
    },
    {
      ruta: '/aulas/4/indisponibilidades/19',
      opciones: { method: 'PATCH', body: datosActualizar },
    },
    {
      ruta: '/aulas/4/indisponibilidades/19/estado',
      opciones: { method: 'PATCH', body: { activo: false } },
    },
  ]);
});

test('conserva casos límite null/undefined y propaga errores HTTP sin modificarlos', async () => {
  const { handlers: handlersEdge, llamadas } = crearArnesIndisponibilidades({
    ok: true,
    data: null,
  });

  await handlersEdge.get('aulas:indisponibilidades:crear')(null, undefined, null);
  await handlersEdge.get('aulas:indisponibilidades:actualizar')(null, 4, undefined, undefined);
  await handlersEdge.get('aulas:indisponibilidades:cambiar-estado')(null, 4, 19, undefined);

  assert.deepEqual(llamadas, [
    {
      ruta: '/aulas/undefined/indisponibilidades',
      opciones: { method: 'POST', body: null },
    },
    {
      ruta: '/aulas/4/indisponibilidades/undefined',
      opciones: { method: 'PATCH', body: undefined },
    },
    {
      ruta: '/aulas/4/indisponibilidades/19/estado',
      opciones: { method: 'PATCH', body: { activo: undefined } },
    },
  ]);

  for (const errorHttp of [
    { ok: false, status: 400, message: 'Rango de fechas inválido.' },
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permisos para gestionar indisponibilidades.' },
    { ok: false, status: 404, message: 'Indisponibilidad no encontrada.' },
    { ok: false, status: 409, message: 'Existe una reserva conflictiva en ese horario.' },
    { ok: false, status: 0, message: 'No se pudo conectar con el sistema.' },
  ]) {
    const { handlers } = crearArnesIndisponibilidades(errorHttp);
    for (const [canal, args] of [
      ['aulas:indisponibilidades:crear', [null, 4, {}]],
      ['aulas:indisponibilidades:actualizar', [null, 4, 19, {}]],
      ['aulas:indisponibilidades:cambiar-estado', [null, 4, 19, true]],
    ]) {
      assert.deepEqual(await handlers.get(canal)(...args), errorHttp);
    }
  }
});

test('conserva los 32 canales de Aulas registrados una sola vez y delega los tres desde main', () => {
  const ipcDir = path.join(frontendDir, 'src', 'electron', 'ipc');
  const archivosAulas = [
    'src/main.js',
    ...readdirSync(ipcDir)
      .filter((name) => /^aulas.*\.ipc\.js$/.test(name))
      .sort()
      .map((name) => path.join('src', 'electron', 'ipc', name)),
  ];

  const canales = [];
  for (const relativeFile of archivosAulas) {
    const source = readFileSync(path.join(frontendDir, relativeFile), 'utf8');
    for (const match of source.matchAll(/['"](aulas:[^'"]+)['"]/g)) {
      canales.push(match[1]);
    }
  }

  assert.equal(canales.length, 32);
  assert.equal(new Set(canales).size, 32);
  for (const canal of CANALES_INDISPONIBILIDADES_AULAS) {
    assert.ok(canales.includes(canal));
  }
  assert.equal((mainSource.match(/registrarAulasIndisponibilidadesIpc\s*\(/g) || []).length, 1);
});
