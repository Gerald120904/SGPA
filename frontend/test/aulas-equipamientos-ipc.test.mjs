import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarAulasEquipamientosIpc } from '../src/electron/ipc/aulas-equipamientos.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const preloadSource = readFileSync(
  path.join(testDir, '..', 'src', 'preload.js'),
  'utf8',
);

const CANALES_EQUIPAMIENTOS_AULAS = [
  'aulas:equipamientos:crear',
  'aulas:equipamientos:actualizar',
  'aulas:equipamientos:cambiar-estado',
];

function crearArnesEquipamientos(respuestaOImplementacion) {
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

  registrarAulasEquipamientosIpc({ ipcMain, ejecutarPeticionAutenticada });
  return { handlers, llamadas };
}

test('valida dependencias requeridas antes de registrar catálogo de equipamientos', () => {
  assert.throws(
    () =>
      registrarAulasEquipamientosIpc({
        ipcMain: null,
        ejecutarPeticionAutenticada: async () => ({ ok: true }),
      }),
    /ipcMain/,
  );
  assert.throws(
    () =>
      registrarAulasEquipamientosIpc({
        ipcMain: { handle() {} },
        ejecutarPeticionAutenticada: null,
      }),
    /ejecutarPeticionAutenticada/,
  );
});

test('registra exactamente una vez los 3 canales del catálogo compatibles con preload.js', () => {
  const registrados = [];
  registrarAulasEquipamientosIpc({
    ipcMain: {
      handle(canal) {
        registrados.push(canal);
      },
    },
    ejecutarPeticionAutenticada: async () => ({ ok: true }),
  });

  assert.deepEqual(registrados, CANALES_EQUIPAMIENTOS_AULAS);
  assert.equal(new Set(registrados).size, 3);
  assert.match(
    preloadSource,
    /crearEquipamiento:\s*\(datos\)\s*=>[\s\S]*?'aulas:equipamientos:crear',\s*datos/,
  );
  assert.match(
    preloadSource,
    /actualizarEquipamiento:\s*\([\s\S]*?id,\s*datos[\s\S]*?\)\s*=>[\s\S]*?'aulas:equipamientos:actualizar',\s*id,\s*datos/,
  );
  assert.match(
    preloadSource,
    /cambiarEstadoEquipamiento:\s*\([\s\S]*?id,\s*activo[\s\S]*?\)\s*=>[\s\S]*?'aulas:equipamientos:cambiar-estado',\s*id,\s*activo/,
  );
});

test('envía métodos, rutas, cuerpos y respuestas equivalentes para crear, actualizar y cambiar estado', async () => {
  const respuestaOk = { ok: true, data: { id: 8, nombre: 'Proyector 4K', activo: false } };
  const { handlers, llamadas } = crearArnesEquipamientos(respuestaOk);

  const datosCrear = { nombre: 'Proyector 4K', categoria: 'Audiovisual' };
  const datosActualizar = { nombre: 'Proyector Láser', activo: true };

  assert.deepEqual(await handlers.get('aulas:equipamientos:crear')(null, datosCrear), respuestaOk);
  assert.deepEqual(
    await handlers.get('aulas:equipamientos:actualizar')(null, 8, datosActualizar),
    respuestaOk,
  );
  assert.deepEqual(
    await handlers.get('aulas:equipamientos:cambiar-estado')(null, 8, false),
    respuestaOk,
  );

  assert.deepEqual(llamadas, [
    {
      ruta: '/aulas/equipamientos',
      opciones: { method: 'POST', body: datosCrear },
    },
    {
      ruta: '/aulas/equipamientos/8',
      opciones: { method: 'PATCH', body: datosActualizar },
    },
    {
      ruta: '/aulas/equipamientos/8/estado',
      opciones: { method: 'PATCH', body: { activo: false } },
    },
  ]);
});

test('conserva casos límite null/undefined y propaga errores HTTP sin modificarlos', async () => {
  const { handlers: handlersEdge, llamadas } = crearArnesEquipamientos({ ok: true, data: null });

  await handlersEdge.get('aulas:equipamientos:crear')(null, undefined);
  await handlersEdge.get('aulas:equipamientos:actualizar')(null, undefined, null);
  await handlersEdge.get('aulas:equipamientos:cambiar-estado')(null, 3, undefined);

  assert.deepEqual(llamadas, [
    { ruta: '/aulas/equipamientos', opciones: { method: 'POST', body: undefined } },
    { ruta: '/aulas/equipamientos/undefined', opciones: { method: 'PATCH', body: null } },
    { ruta: '/aulas/equipamientos/3/estado', opciones: { method: 'PATCH', body: { activo: undefined } } },
  ]);

  for (const errorHttp of [
    { ok: false, status: 400, message: 'Nombre requerido.' },
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permisos para gestionar equipamientos.' },
    { ok: false, status: 404, message: 'Equipamiento no encontrado.' },
    { ok: false, status: 409, message: 'El equipamiento ya existe.' },
    { ok: false, status: 0, message: 'No se pudo conectar con el sistema.' },
  ]) {
    const { handlers } = crearArnesEquipamientos(errorHttp);
    for (const [canal, args] of [
      ['aulas:equipamientos:crear', [null, {}]],
      ['aulas:equipamientos:actualizar', [null, 1, {}]],
      ['aulas:equipamientos:cambiar-estado', [null, 1, true]],
    ]) {
      assert.deepEqual(await handlers.get(canal)(...args), errorHttp);
    }
  }
});
