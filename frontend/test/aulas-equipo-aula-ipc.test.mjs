import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarAulasEquipoAulaIpc } from '../src/electron/ipc/aulas-equipo-aula.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const preloadSource = readFileSync(path.join(frontendDir, 'src', 'preload.js'), 'utf8');
const mainSource = readFileSync(path.join(frontendDir, 'src', 'main.js'), 'utf8');

const CANALES_EQUIPO_AULA = [
  'aulas:equipo-aula:asignar',
  'aulas:equipo-aula:actualizar',
  'aulas:equipo-aula:desasignar',
  'aulas:equipo-aula:cambiar-estado',
];

function crearArnes(resolverPeticion) {
  const handlers = new Map();
  const llamadas = [];
  registrarAulasEquipoAulaIpc({
    ipcMain: {
      handle(canal, handler) {
        assert.equal(handlers.has(canal), false, `Canal duplicado: ${canal}`);
        handlers.set(canal, handler);
      },
    },
    ejecutarPeticionAutenticada(ruta, opciones) {
      llamadas.push({ ruta, opciones });
      return resolverPeticion(ruta, opciones);
    },
  });
  return { handlers, llamadas };
}

test('registra una sola vez los cuatro canales y conserva sus contratos de preload', () => {
  const { handlers } = crearArnes(() => ({ ok: true }));
  assert.deepEqual([...handlers.keys()], CANALES_EQUIPO_AULA);
  assert.equal(new Set(handlers.keys()).size, 4);

  for (const canal of CANALES_EQUIPO_AULA) {
    assert.match(preloadSource, new RegExp(`['"]${canal}['"]`));
  }
  assert.match(mainSource, /registrarAulasEquipoAulaIpc\s*\(\s*\{/);
});

test('conserva los métodos, rutas, cuerpos y argumentos originales', async () => {
  const respuesta = { ok: true, data: { aulaId: 6, equipamientoId: 12 } };
  const { handlers, llamadas } = crearArnes(() => respuesta);
  const datosAsignacion = { equipamientoId: 12, cantidad: 2 };
  const datosActualizacion = { cantidad: 3 };

  assert.deepEqual(
    await handlers.get('aulas:equipo-aula:asignar')(null, 6, datosAsignacion),
    respuesta,
  );
  assert.deepEqual(
    await handlers.get('aulas:equipo-aula:actualizar')(null, 6, 12, datosActualizacion),
    respuesta,
  );
  assert.deepEqual(
    await handlers.get('aulas:equipo-aula:desasignar')(null, 6, 12),
    respuesta,
  );
  assert.deepEqual(
    await handlers.get('aulas:equipo-aula:cambiar-estado')(null, 6, 12, false),
    respuesta,
  );

  assert.deepEqual(llamadas, [
    {
      ruta: '/aulas/6/equipamientos',
      opciones: { method: 'POST', body: datosAsignacion },
    },
    {
      ruta: '/aulas/6/equipamientos/12',
      opciones: { method: 'PATCH', body: datosActualizacion },
    },
    {
      ruta: '/aulas/6/equipamientos/12',
      opciones: { method: 'DELETE' },
    },
    {
      ruta: '/aulas/6/equipamientos/12/estado',
      opciones: { method: 'PATCH', body: { activo: false } },
    },
  ]);
});

test('conserva null/undefined y propaga sin cambios respuestas de error y rechazos', async () => {
  const resultadoError = { ok: false, status: 403, message: 'Sin permisos.' };
  const { handlers, llamadas } = crearArnes(() => resultadoError);

  assert.equal(await handlers.get('aulas:equipo-aula:asignar')(null, undefined, null), resultadoError);
  assert.equal(await handlers.get('aulas:equipo-aula:actualizar')(null, null, undefined, null), resultadoError);
  assert.equal(await handlers.get('aulas:equipo-aula:desasignar')(null, null, undefined), resultadoError);
  assert.equal(await handlers.get('aulas:equipo-aula:cambiar-estado')(null, 2, 4, undefined), resultadoError);
  assert.deepEqual(llamadas, [
    { ruta: '/aulas/undefined/equipamientos', opciones: { method: 'POST', body: null } },
    { ruta: '/aulas/null/equipamientos/undefined', opciones: { method: 'PATCH', body: null } },
    { ruta: '/aulas/null/equipamientos/undefined', opciones: { method: 'DELETE' } },
    { ruta: '/aulas/2/equipamientos/4/estado', opciones: { method: 'PATCH', body: { activo: undefined } } },
  ]);

  const error = new Error('Fallo de transporte');
  const { handlers: handlersRechazo } = crearArnes(() => Promise.reject(error));
  await assert.rejects(
    handlersRechazo.get('aulas:equipo-aula:asignar')(null, 1, {}),
    (recibido) => recibido === error,
  );
});

test('mantiene los 32 canales de Aulas registrados una sola vez y los cuatro delegados desde main', () => {
  const ipcDir = path.join(frontendDir, 'src', 'electron', 'ipc');
  const aulasFiles = [
    'src/main.js',
    ...readdirSync(ipcDir)
      .filter((name) => /^aulas.*\.ipc\.js$/.test(name))
      .sort()
      .map((name) => path.join('src', 'electron', 'ipc', name)),
  ];
  const canales = [];
  for (const relativeFile of aulasFiles) {
    const source = readFileSync(path.join(frontendDir, relativeFile), 'utf8');
    for (const match of source.matchAll(/['"](aulas:[^'"]+)['"]/g)) canales.push(match[1]);
  }

  assert.equal(canales.length, 32);
  assert.equal(new Set(canales).size, 32);
  for (const canal of CANALES_EQUIPO_AULA) assert.ok(canales.includes(canal));
  assert.equal((mainSource.match(/registrarAulasEquipoAulaIpc\s*\(/g) || []).length, 1);
});
