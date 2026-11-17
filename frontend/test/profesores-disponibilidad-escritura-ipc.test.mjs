import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarProfesoresDisponibilidadEscrituraIpc } from '../src/electron/ipc/profesores-disponibilidad-escritura.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const preloadSource = readFileSync(path.join(frontendDir, 'src', 'preload.js'), 'utf8');
const mainSource = readFileSync(path.join(frontendDir, 'src', 'main.js'), 'utf8');

const CANALES_DISPONIBILIDAD_ESCRITURA = [
  'profesores:guardar-mi-disponibilidad',
  'profesores:copiar-mi-disponibilidad',
];

function crearArnes(respuestaOImplementacion) {
  const handlers = new Map();
  const llamadas = [];
  registrarProfesoresDisponibilidadEscrituraIpc({
    ipcMain: {
      handle(canal, fn) {
        assert.equal(handlers.has(canal), false, `Canal duplicado: ${canal}`);
        handlers.set(canal, fn);
      },
    },
    ejecutarPeticionAutenticada(ruta, opciones) {
      llamadas.push({ ruta, opciones });
      if (typeof respuestaOImplementacion === 'function') {
        return respuestaOImplementacion(ruta, opciones);
      }
      return respuestaOImplementacion;
    },
  });
  return { handlers, llamadas };
}

test('registra una sola vez los 2 canales de disponibilidad escritura compatibles con preload.js y main.js', () => {
  const { handlers } = crearArnes({ ok: true });
  assert.deepEqual([...handlers.keys()], CANALES_DISPONIBILIDAD_ESCRITURA);
  assert.equal(new Set(handlers.keys()).size, 2);

  assert.match(
    preloadSource,
    /guardarMiDisponibilidadProfesor:\s*\([\s\S]*?datos[\s\S]*?\)\s*=>[\s\S]*?'profesores:guardar-mi-disponibilidad',\s*datos/,
  );
  assert.match(
    preloadSource,
    /copiarMiDisponibilidadProfesor:\s*\([\s\S]*?datos[\s\S]*?\)\s*=>[\s\S]*?'profesores:copiar-mi-disponibilidad',\s*datos/,
  );
  assert.equal(
    (mainSource.match(/registrarProfesoresDisponibilidadEscrituraIpc\s*\(/g) || []).length,
    1,
  );
});

test('envía PUT y POST con rutas, cuerpos y respuestas exactas sin alterar datos', async () => {
  const respuestaOk = { ok: true, data: { guardados: 4 } };
  const { handlers, llamadas } = crearArnes(respuestaOk);

  const datosGuardar = { periodoId: 9, bloques: [{ dia: 'LUNES', franja: '08:00-10:00' }] };
  const datosCopiar = { periodoOrigenId: 8, periodoDestinoId: 9 };

  assert.equal(
    await handlers.get('profesores:guardar-mi-disponibilidad')(null, datosGuardar),
    respuestaOk,
  );
  assert.equal(
    await handlers.get('profesores:copiar-mi-disponibilidad')(null, datosCopiar),
    respuestaOk,
  );

  assert.deepEqual(llamadas, [
    {
      ruta: '/profesores/mi-disponibilidad',
      opciones: { method: 'PUT', body: datosGuardar },
    },
    {
      ruta: '/profesores/mi-disponibilidad/copiar',
      opciones: { method: 'POST', body: datosCopiar },
    },
  ]);
});

test('conserva casos límite null/undefined, errores HTTP, rechazos, 29 canales de Profesores y 32 de Aulas', async () => {
  const { handlers: hEdge, llamadas } = crearArnes({ ok: true, data: null });

  await hEdge.get('profesores:guardar-mi-disponibilidad')(null, null);
  await hEdge.get('profesores:copiar-mi-disponibilidad')(null, undefined);

  assert.deepEqual(llamadas, [
    { ruta: '/profesores/mi-disponibilidad', opciones: { method: 'PUT', body: null } },
    { ruta: '/profesores/mi-disponibilidad/copiar', opciones: { method: 'POST', body: undefined } },
  ]);

  for (const errorHttp of [
    { ok: false, status: 400, message: 'Bloques inválidos.' },
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permiso docente.' },
    { ok: false, status: 409, message: 'Conflicto de horario.' },
    { ok: false, status: 0, message: 'Sin conexión.' },
  ]) {
    const { handlers } = crearArnes(errorHttp);
    assert.equal(await handlers.get('profesores:guardar-mi-disponibilidad')(null, {}), errorHttp);
    assert.equal(await handlers.get('profesores:copiar-mi-disponibilidad')(null, {}), errorHttp);
  }

  const rechazo = new Error('Fallo de red');
  const { handlers: hRechazo } = crearArnes(() => Promise.reject(rechazo));
  await assert.rejects(
    hRechazo.get('profesores:guardar-mi-disponibilidad')(null, {}),
    (err) => err === rechazo,
  );

  assert.deepEqual(mainSource.match(/['"]profesores:[^'"]+['"]/g) || [], []);

  const ipcDir = path.join(frontendDir, 'src', 'electron', 'ipc');
  const canalesAulas = [];
  for (const archivo of readdirSync(ipcDir).filter((n) => /^aulas.*\.ipc\.js$/.test(n)).sort()) {
    const src = readFileSync(path.join(ipcDir, archivo), 'utf8');
    for (const match of src.matchAll(/['"](aulas:[^'"]+)['"]/g)) canalesAulas.push(match[1]);
  }
  assert.equal(canalesAulas.length, 32);
  assert.equal(new Set(canalesAulas).size, 32);
});
