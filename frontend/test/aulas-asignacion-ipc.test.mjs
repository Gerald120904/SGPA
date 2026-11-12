import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarAulasAsignacionIpc } from '../src/electron/ipc/aulas-asignacion.ipc.js';

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

const CANALES_ASIGNACION_AULAS = [
  'aulas:buscar-disponibles',
  'aulas:evaluar-asignacion',
];

function crearArnesAsignacion(respuestaOImplementacion) {
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

  registrarAulasAsignacionIpc({ ipcMain, ejecutarPeticionAutenticada });
  return { handlers, llamadas };
}

test('valida dependencias requeridas antes de registrar búsqueda y evaluación de Aulas', () => {
  assert.throws(
    () =>
      registrarAulasAsignacionIpc({
        ipcMain: null,
        ejecutarPeticionAutenticada: async () => ({ ok: true }),
      }),
    /ipcMain/,
  );
  assert.throws(
    () =>
      registrarAulasAsignacionIpc({
        ipcMain: { handle() {} },
        ejecutarPeticionAutenticada: null,
      }),
    /ejecutarPeticionAutenticada/,
  );
});

test('registra exactamente una vez los 2 canales de búsqueda/evaluación compatibles con preload.js', () => {
  const { handlers } = crearArnesAsignacion({ ok: true, data: [] });
  assert.deepEqual([...handlers.keys()], CANALES_ASIGNACION_AULAS);
  assert.equal(new Set(handlers.keys()).size, 2);

  assert.match(
    preloadSource,
    /buscarAulasDisponibles:\s*\([\s\S]*?criterios[\s\S]*?\)\s*=>[\s\S]*?'aulas:buscar-disponibles',\s*criterios/,
  );
  assert.match(
    preloadSource,
    /evaluarAulaParaAsignacion:\s*\([\s\S]*?aulaId,\s*criterios[\s\S]*?\)\s*=>[\s\S]*?'aulas:evaluar-asignacion',\s*aulaId,\s*criterios/,
  );
});

test('envía métodos, rutas, cuerpos y formatos de retorno equivalentes para buscar disponibles y evaluar asignación', async () => {
  const aulasEncontradas = [{ id: 1, codigo: 'A-101' }];
  const evaluacionDetalle = { compatible: true, conflictos: [] };

  const { handlers: hBuscar, llamadas: llamadasBuscar } = crearArnesAsignacion({
    ok: true,
    data: aulasEncontradas,
  });
  const criteriosBusqueda = { capacidadMinima: 25, fechaHoraInicio: '2026-11-22T08:00:00Z' };
  assert.deepEqual(
    await hBuscar.get('aulas:buscar-disponibles')(null, criteriosBusqueda),
    { ok: true, aulas: aulasEncontradas },
  );
  assert.deepEqual(llamadasBuscar, [
    {
      ruta: '/aulas/buscar-disponibles',
      opciones: { method: 'POST', body: criteriosBusqueda },
    },
  ]);

  const { handlers: hEvaluar, llamadas: llamadasEvaluar } = crearArnesAsignacion({
    ok: true,
    data: evaluacionDetalle,
  });
  const criteriosEval = { fechaHoraInicio: '2026-11-22T08:00:00Z', requiereProyector: true };
  assert.deepEqual(
    await hEvaluar.get('aulas:evaluar-asignacion')(null, 14, criteriosEval),
    { ok: true, data: evaluacionDetalle },
  );
  assert.deepEqual(llamadasEvaluar, [
    {
      ruta: '/aulas/14/evaluar-asignacion',
      opciones: { method: 'POST', body: criteriosEval },
    },
  ]);
});

test('conserva casos límite null/undefined, errores HTTP y rechazos sin alterarlos', async () => {
  const { handlers: handlersEdge, llamadas } = crearArnesAsignacion({
    ok: true,
    data: null,
  });

  assert.deepEqual(await handlersEdge.get('aulas:buscar-disponibles')(null, undefined), {
    ok: true,
    aulas: null,
  });
  assert.deepEqual(await handlersEdge.get('aulas:evaluar-asignacion')(null, undefined, null), {
    ok: true,
    data: null,
  });

  assert.deepEqual(llamadas, [
    { ruta: '/aulas/buscar-disponibles', opciones: { method: 'POST', body: undefined } },
    { ruta: '/aulas/undefined/evaluar-asignacion', opciones: { method: 'POST', body: null } },
  ]);

  for (const errorHttp of [
    { ok: false, status: 400, message: 'Criterios inválidos.' },
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permisos para evaluar aulas.' },
    { ok: false, status: 404, message: 'Aula no encontrada.' },
    { ok: false, status: 409, message: 'Conflicto horario.' },
    { ok: false, status: 0, message: 'No se pudo conectar con el sistema.' },
  ]) {
    const { handlers } = crearArnesAsignacion(errorHttp);
    assert.deepEqual(await handlers.get('aulas:buscar-disponibles')(null, {}), errorHttp);
    assert.deepEqual(await handlers.get('aulas:evaluar-asignacion')(null, 1, {}), errorHttp);
  }

  const { handlers: handlersNullResp } = crearArnesAsignacion(null);
  await assert.rejects(
    handlersNullResp.get('aulas:buscar-disponibles')(null, {}),
    /Cannot read properties of null/,
  );

  const rechazo = new Error('Fallo de red');
  const { handlers: handlersRechazo } = crearArnesAsignacion(() => Promise.reject(rechazo));
  await assert.rejects(
    handlersRechazo.get('aulas:evaluar-asignacion')(null, 1, {}),
    (err) => err === rechazo,
  );
});

test('conserva los 32 canales de Aulas fuera de main.js en sus 8 módulos IPC sin duplicados', () => {
  const ipcDir = path.join(frontendDir, 'src', 'electron', 'ipc');
  const modulosAulas = readdirSync(ipcDir)
    .filter((name) => /^aulas.*\.ipc\.js$/.test(name))
    .sort();

  assert.equal(modulosAulas.length, 8);
  assert.deepEqual(mainSource.match(/['"]aulas:[^'"]+['"]/g) || [], []);
  assert.equal((mainSource.match(/registrarAulasAsignacionIpc\s*\(/g) || []).length, 1);

  const canales = [];
  for (const archivo of modulosAulas) {
    const source = readFileSync(path.join(ipcDir, archivo), 'utf8');
    for (const match of source.matchAll(/['"](aulas:[^'"]+)['"]/g)) {
      canales.push(match[1]);
    }
  }

  assert.equal(canales.length, 32);
  assert.equal(new Set(canales).size, 32);
  for (const canal of CANALES_ASIGNACION_AULAS) {
    assert.ok(canales.includes(canal));
  }
});
