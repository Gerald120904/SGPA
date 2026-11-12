import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarAulasDisponibilidadesIpc } from '../src/electron/ipc/aulas-disponibilidades.ipc.js';

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

const CANALES_DISPONIBILIDADES_AULAS = [
  'aulas:disponibilidades:crear',
  'aulas:disponibilidades:actualizar',
  'aulas:disponibilidades:eliminar',
];

function crearArnesDisponibilidades(respuestaOImplementacion) {
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

  registrarAulasDisponibilidadesIpc({ ipcMain, ejecutarPeticionAutenticada });
  return { handlers, llamadas };
}

test('valida dependencias requeridas antes de registrar disponibilidades base de Aulas', () => {
  assert.throws(
    () =>
      registrarAulasDisponibilidadesIpc({
        ipcMain: null,
        ejecutarPeticionAutenticada: async () => ({ ok: true }),
      }),
    /ipcMain/,
  );
  assert.throws(
    () =>
      registrarAulasDisponibilidadesIpc({
        ipcMain: { handle() {} },
        ejecutarPeticionAutenticada: null,
      }),
    /ejecutarPeticionAutenticada/,
  );
});

test('registra exactamente una vez los 3 canales de disponibilidad base compatibles con preload.js', () => {
  const { handlers } = crearArnesDisponibilidades({ ok: true });
  assert.deepEqual([...handlers.keys()], CANALES_DISPONIBILIDADES_AULAS);
  assert.equal(new Set(handlers.keys()).size, 3);

  assert.match(
    preloadSource,
    /crearDisponibilidadAula:\s*\([\s\S]*?aulaId,\s*datos[\s\S]*?\)\s*=>[\s\S]*?'aulas:disponibilidades:crear',\s*aulaId,\s*datos/,
  );
  assert.match(
    preloadSource,
    /actualizarDisponibilidadAula:\s*\([\s\S]*?aulaId,\s*id,\s*datos[\s\S]*?\)\s*=>[\s\S]*?'aulas:disponibilidades:actualizar',\s*aulaId,\s*id,\s*datos/,
  );
  assert.match(
    preloadSource,
    /eliminarDisponibilidadAula:\s*\([\s\S]*?aulaId,\s*id[\s\S]*?\)\s*=>[\s\S]*?'aulas:disponibilidades:eliminar',\s*aulaId,\s*id/,
  );
});

test('envía métodos, rutas, cuerpos JSON y respuestas equivalentes para crear, actualizar y eliminar', async () => {
  const respuestaOk = { ok: true, data: { id: 27, aulaId: 11, diaSemana: 'LUNES' } };
  const { handlers, llamadas } = crearArnesDisponibilidades(respuestaOk);

  const datosCrear = {
    periodoId: 5,
    diaSemana: 'LUNES',
    horaInicio: '08:00',
    horaFin: '12:00',
  };
  const datosActualizar = {
    horaFin: '13:00',
  };

  assert.deepEqual(
    await handlers.get('aulas:disponibilidades:crear')(null, 11, datosCrear),
    respuestaOk,
  );
  assert.deepEqual(
    await handlers.get('aulas:disponibilidades:actualizar')(null, 11, 27, datosActualizar),
    respuestaOk,
  );
  assert.deepEqual(
    await handlers.get('aulas:disponibilidades:eliminar')(null, 11, 27),
    respuestaOk,
  );

  assert.deepEqual(llamadas, [
    {
      ruta: '/aulas/11/disponibilidades',
      opciones: { method: 'POST', body: datosCrear },
    },
    {
      ruta: '/aulas/11/disponibilidades/27',
      opciones: { method: 'PATCH', body: datosActualizar },
    },
    {
      ruta: '/aulas/11/disponibilidades/27',
      opciones: { method: 'DELETE' },
    },
  ]);
  assert.equal('body' in llamadas[2].opciones, false);
});

test('conserva casos límite null/undefined, errores HTTP y rechazos sin alterarlos', async () => {
  const { handlers: handlersEdge, llamadas } = crearArnesDisponibilidades({
    ok: true,
    data: null,
  });

  await handlersEdge.get('aulas:disponibilidades:crear')(null, undefined, null);
  await handlersEdge.get('aulas:disponibilidades:actualizar')(null, 11, undefined, undefined);
  await handlersEdge.get('aulas:disponibilidades:eliminar')(null, null, undefined);

  assert.deepEqual(llamadas, [
    {
      ruta: '/aulas/undefined/disponibilidades',
      opciones: { method: 'POST', body: null },
    },
    {
      ruta: '/aulas/11/disponibilidades/undefined',
      opciones: { method: 'PATCH', body: undefined },
    },
    {
      ruta: '/aulas/null/disponibilidades/undefined',
      opciones: { method: 'DELETE' },
    },
  ]);

  for (const errorHttp of [
    { ok: false, status: 400, message: 'Franja horaria inválida.' },
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permisos para modificar disponibilidades.' },
    { ok: false, status: 404, message: 'Disponibilidad no encontrada.' },
    { ok: false, status: 409, message: 'Solapamiento con otra disponibilidad.' },
    { ok: false, status: 0, message: 'No se pudo conectar con el sistema.' },
  ]) {
    const { handlers } = crearArnesDisponibilidades(errorHttp);
    for (const [canal, args] of [
      ['aulas:disponibilidades:crear', [null, 11, {}]],
      ['aulas:disponibilidades:actualizar', [null, 11, 27, {}]],
      ['aulas:disponibilidades:eliminar', [null, 11, 27]],
    ]) {
      assert.deepEqual(await handlers.get(canal)(...args), errorHttp);
    }
  }

  const rechazo = new Error('Fallo de conexión');
  const { handlers: handlersRechazo } = crearArnesDisponibilidades(() => Promise.reject(rechazo));
  await assert.rejects(
    handlersRechazo.get('aulas:disponibilidades:eliminar')(null, 11, 27),
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
  for (const canal of CANALES_DISPONIBILIDADES_AULAS) {
    assert.ok(canales.includes(canal));
  }
  assert.equal((mainSource.match(/registrarAulasDisponibilidadesIpc\s*\(/g) || []).length, 1);
});
