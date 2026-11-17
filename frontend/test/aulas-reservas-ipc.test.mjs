import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarAulasReservasIpc } from '../src/electron/ipc/aulas-reservas.ipc.js';

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

const CANALES_RESERVAS_AULAS = [
  'aulas:reservas:crear',
  'aulas:reservas:actualizar',
  'aulas:reservas:cambiar-estado',
];

function crearArnesReservas(respuestaOImplementacion) {
  const handlers = new Map();
  const llamadas = [];
  const ipcMain = {
    handle(canal, fn) {
      assert.equal(handlers.has(canal), false, `Canal duplicado: ${canal}`);
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

  registrarAulasReservasIpc({ ipcMain, ejecutarPeticionAutenticada });
  return { handlers, llamadas };
}

test('valida dependencias requeridas antes de registrar reservas extraordinarias de Aulas', () => {
  assert.throws(
    () =>
      registrarAulasReservasIpc({
        ipcMain: null,
        ejecutarPeticionAutenticada: async () => ({ ok: true }),
      }),
    /ipcMain/,
  );
  assert.throws(
    () =>
      registrarAulasReservasIpc({
        ipcMain: { handle() {} },
        ejecutarPeticionAutenticada: null,
      }),
    /ejecutarPeticionAutenticada/,
  );
});

test('registra exactamente una vez los 3 canales de reservas compatibles con preload.js', () => {
  const { handlers } = crearArnesReservas({ ok: true });
  assert.deepEqual([...handlers.keys()], CANALES_RESERVAS_AULAS);
  assert.equal(new Set(handlers.keys()).size, 3);

  assert.match(
    preloadSource,
    /crearReservaAula:\s*\(aulaId,\s*datos\)\s*=>[\s\S]*?'aulas:reservas:crear',\s*aulaId,\s*datos/,
  );
  assert.match(
    preloadSource,
    /actualizarReservaAula:\s*\([\s\S]*?aulaId,\s*id,\s*datos[\s\S]*?\)\s*=>[\s\S]*?'aulas:reservas:actualizar',\s*aulaId,\s*id,\s*datos/,
  );
  assert.match(
    preloadSource,
    /cambiarEstadoReservaAula:\s*\([\s\S]*?aulaId,\s*id,\s*activo[\s\S]*?\)\s*=>[\s\S]*?'aulas:reservas:cambiar-estado',\s*aulaId,\s*id,\s*activo/,
  );
});

test('envía métodos, rutas, cuerpos JSON y respuestas equivalentes para crear, actualizar y cambiar estado', async () => {
  const respuestaOk = { ok: true, data: { id: 31, aulaId: 9, activo: false } };
  const { handlers, llamadas } = crearArnesReservas(respuestaOk);

  const datosCrear = {
    fechaHoraInicio: '2026-11-20T14:00:00Z',
    fechaHoraFin: '2026-11-20T17:00:00Z',
    motivo: 'Examen extraordinario',
  };
  const datosActualizar = {
    motivo: 'Defensa de tesis reprogramada',
  };

  assert.deepEqual(
    await handlers.get('aulas:reservas:crear')(null, 9, datosCrear),
    respuestaOk,
  );
  assert.deepEqual(
    await handlers.get('aulas:reservas:actualizar')(null, 9, 31, datosActualizar),
    respuestaOk,
  );
  assert.deepEqual(
    await handlers.get('aulas:reservas:cambiar-estado')(null, 9, 31, false),
    respuestaOk,
  );

  assert.deepEqual(llamadas, [
    {
      ruta: '/aulas/9/reservas',
      opciones: { method: 'POST', body: datosCrear },
    },
    {
      ruta: '/aulas/9/reservas/31',
      opciones: { method: 'PATCH', body: datosActualizar },
    },
    {
      ruta: '/aulas/9/reservas/31/estado',
      opciones: { method: 'PATCH', body: { activo: false } },
    },
  ]);
});

test('conserva casos límite null/undefined, errores HTTP y rechazos sin alterarlos', async () => {
  const { handlers: handlersEdge, llamadas } = crearArnesReservas({
    ok: true,
    data: null,
  });

  await handlersEdge.get('aulas:reservas:crear')(null, undefined, null);
  await handlersEdge.get('aulas:reservas:actualizar')(null, 9, undefined, undefined);
  await handlersEdge.get('aulas:reservas:cambiar-estado')(null, 9, 31, undefined);

  assert.deepEqual(llamadas, [
    {
      ruta: '/aulas/undefined/reservas',
      opciones: { method: 'POST', body: null },
    },
    {
      ruta: '/aulas/9/reservas/undefined',
      opciones: { method: 'PATCH', body: undefined },
    },
    {
      ruta: '/aulas/9/reservas/31/estado',
      opciones: { method: 'PATCH', body: { activo: undefined } },
    },
  ]);

  for (const errorHttp of [
    { ok: false, status: 400, message: 'Rango horario inválido.' },
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permisos para reservar aulas.' },
    { ok: false, status: 404, message: 'Reserva no encontrada.' },
    { ok: false, status: 409, message: 'Conflicto con ocupación existente.' },
    { ok: false, status: 0, message: 'No se pudo conectar con el sistema.' },
  ]) {
    const { handlers } = crearArnesReservas(errorHttp);
    for (const [canal, args] of [
      ['aulas:reservas:crear', [null, 9, {}]],
      ['aulas:reservas:actualizar', [null, 9, 31, {}]],
      ['aulas:reservas:cambiar-estado', [null, 9, 31, true]],
    ]) {
      assert.deepEqual(await handlers.get(canal)(...args), errorHttp);
    }
  }

  const rechazo = new Error('Fallo de red');
  const { handlers: handlersRechazo } = crearArnesReservas(() => Promise.reject(rechazo));
  await assert.rejects(
    handlersRechazo.get('aulas:reservas:crear')(null, 9, {}),
    (err) => err === rechazo,
  );
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
  for (const canal of CANALES_RESERVAS_AULAS) {
    assert.ok(canales.includes(canal));
  }
  assert.equal((mainSource.match(/registrarAulasReservasIpc\s*\(/g) || []).length, 1);
});
