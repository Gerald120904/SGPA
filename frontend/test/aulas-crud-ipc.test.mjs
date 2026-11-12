import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarAulasCrudIpc } from '../src/electron/ipc/aulas-crud.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const preloadSource = readFileSync(
  path.join(testDir, '..', 'src', 'preload.js'),
  'utf8',
);

const CANALES_CRUD_AULAS = [
  'aulas:crear',
  'aulas:actualizar',
  'aulas:cambiar-estado',
];

function crearArnesCrudAulas(respuestaOImplementacion) {
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

  registrarAulasCrudIpc({ ipcMain, ejecutarPeticionAutenticada });
  return { handlers, llamadas };
}

test('valida dependencias requeridas antes de registrar CRUD de Aulas', () => {
  assert.throws(
    () => registrarAulasCrudIpc({ ipcMain: null, ejecutarPeticionAutenticada: async () => ({ ok: true }) }),
    /ipcMain/,
  );
  assert.throws(
    () => registrarAulasCrudIpc({ ipcMain: { handle() {} }, ejecutarPeticionAutenticada: null }),
    /ejecutarPeticionAutenticada/,
  );
});

test('registra exactamente una vez los 3 canales CRUD de Aulas compatibles con preload.js', () => {
  const registrados = [];
  registrarAulasCrudIpc({
    ipcMain: {
      handle(canal) {
        registrados.push(canal);
      },
    },
    ejecutarPeticionAutenticada: async () => ({ ok: true }),
  });

  assert.deepEqual(registrados, CANALES_CRUD_AULAS);
  assert.equal(new Set(registrados).size, 3);
  assert.match(preloadSource, /crearAula:\s*\(datos\)\s*=>[\s\S]*?'aulas:crear',\s*datos/);
  assert.match(preloadSource, /actualizarAula:\s*\(id,\s*datos\)\s*=>[\s\S]*?'aulas:actualizar',\s*id,\s*datos/);
  assert.match(preloadSource, /cambiarEstadoAula:\s*\([\s\S]*?id,\s*activo[\s\S]*?\)\s*=>[\s\S]*?'aulas:cambiar-estado',\s*id,\s*activo/);
});

test('envía métodos HTTP, rutas, cuerpos y respuestas equivalentes para crear, actualizar y cambiar estado', async () => {
  const respuestaOk = { ok: true, data: { id: 12, codigo: 'LAB-201', activo: false } };
  const { handlers, llamadas } = crearArnesCrudAulas(respuestaOk);

  const datosCrear = { codigo: 'LAB-201', nombre: 'Laboratorio 201', capacidad: 30 };
  const datosActualizar = { nombre: 'Laboratorio Renovado', capacidad: 35 };

  assert.deepEqual(await handlers.get('aulas:crear')(null, datosCrear), respuestaOk);
  assert.deepEqual(await handlers.get('aulas:actualizar')(null, 12, datosActualizar), respuestaOk);
  assert.deepEqual(await handlers.get('aulas:cambiar-estado')(null, 12, false), respuestaOk);

  assert.deepEqual(llamadas, [
    {
      ruta: '/aulas',
      opciones: { method: 'POST', body: datosCrear },
    },
    {
      ruta: '/aulas/12',
      opciones: { method: 'PATCH', body: datosActualizar },
    },
    {
      ruta: '/aulas/12/estado',
      opciones: { method: 'PATCH', body: { activo: false } },
    },
  ]);
});

test('conserva casos límite sin introducir validaciones ni mutaciones y propaga errores HTTP', async () => {
  const { handlers: handlersEdge, llamadas } = crearArnesCrudAulas({ ok: true, data: null });

  await handlersEdge.get('aulas:crear')(null, undefined);
  await handlersEdge.get('aulas:actualizar')(null, undefined, null);
  await handlersEdge.get('aulas:cambiar-estado')(null, 5, undefined);

  assert.deepEqual(llamadas, [
    { ruta: '/aulas', opciones: { method: 'POST', body: undefined } },
    { ruta: '/aulas/undefined', opciones: { method: 'PATCH', body: null } },
    { ruta: '/aulas/5/estado', opciones: { method: 'PATCH', body: { activo: undefined } } },
  ]);

  for (const errorHttp of [
    { ok: false, status: 400, message: 'Código duplicado.' },
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permisos para modificar aulas.' },
    { ok: false, status: 404, message: 'Aula no encontrada.' },
    { ok: false, status: 409, message: 'El aula tiene horarios asignados.' },
    { ok: false, status: 0, message: 'No se pudo conectar con el sistema.' },
  ]) {
    const { handlers } = crearArnesCrudAulas(errorHttp);
    for (const [canal, args] of [
      ['aulas:crear', [null, {}]],
      ['aulas:actualizar', [null, 1, {}]],
      ['aulas:cambiar-estado', [null, 1, true]],
    ]) {
      assert.deepEqual(await handlers.get(canal)(...args), errorHttp);
    }
  }
});

