import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registrarProfesoresDisponibilidadConsultasIpc } from '../src/electron/ipc/profesores-disponibilidad-consultas.ipc.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, '..');
const preloadSource = readFileSync(path.join(frontendDir, 'src', 'preload.js'), 'utf8');
const mainSource = readFileSync(path.join(frontendDir, 'src', 'main.js'), 'utf8');

const CANALES_DISPONIBILIDAD = [
  'profesores:periodos-mi-disponibilidad',
  'profesores:consultar-mi-disponibilidad',
  'profesores:historial-mi-disponibilidad',
];

function crearArnes(respuestaOImplementacion) {
  const handlers = new Map();
  const llamadas = [];
  registrarProfesoresDisponibilidadConsultasIpc({
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

test('registra una sola vez los tres canales de disponibilidad personal compatibles con preload.js y main.js', () => {
  const { handlers } = crearArnes({ ok: true, data: [] });
  assert.deepEqual([...handlers.keys()], CANALES_DISPONIBILIDAD);
  assert.equal(new Set(handlers.keys()).size, 3);

  assert.match(
    preloadSource,
    /listarPeriodosMiDisponibilidadProfesor:\s*\(\)\s*=>[\s\S]*?'profesores:periodos-mi-disponibilidad'/,
  );
  assert.match(
    preloadSource,
    /consultarMiDisponibilidadProfesor:\s*\([\s\S]*?periodoId[\s\S]*?\)\s*=>[\s\S]*?'profesores:consultar-mi-disponibilidad',\s*periodoId/,
  );
  assert.match(
    preloadSource,
    /obtenerHistorialMiDisponibilidadProfesor:\s*\([\s\S]*?periodoId[\s\S]*?\)\s*=>[\s\S]*?'profesores:historial-mi-disponibilidad',\s*periodoId/,
  );
  assert.equal(
    (mainSource.match(/registrarProfesoresDisponibilidadConsultasIpc\s*\(/g) || []).length,
    1,
  );
});

test('ejecuta GET con manejo exacto de periodoId (incluidos null y undefined) y sin validaciones extra', async () => {
  const respuesta = { ok: true, data: { bloques: [] } };
  const { handlers, llamadas } = crearArnes(respuesta);

  assert.equal(await handlers.get('profesores:periodos-mi-disponibilidad')(null), respuesta);
  assert.equal(await handlers.get('profesores:consultar-mi-disponibilidad')(null, 9), respuesta);
  assert.equal(await handlers.get('profesores:historial-mi-disponibilidad')(null, 9), respuesta);
  assert.equal(await handlers.get('profesores:consultar-mi-disponibilidad')(null, null), respuesta);
  assert.equal(
    await handlers.get('profesores:historial-mi-disponibilidad')(null, undefined),
    respuesta,
  );

  assert.deepEqual(llamadas, [
    { ruta: '/profesores/mi-disponibilidad/periodos', opciones: undefined },
    { ruta: '/profesores/mi-disponibilidad/9', opciones: undefined },
    { ruta: '/profesores/mi-disponibilidad/9/historial', opciones: undefined },
    { ruta: '/profesores/mi-disponibilidad/null', opciones: undefined },
    { ruta: '/profesores/mi-disponibilidad/undefined/historial', opciones: undefined },
  ]);
});

test('propaga errores HTTP, conserva escritura en main y preserva los 32 canales de Aulas', async () => {
  for (const errorHttp of [
    { ok: false, status: 401, message: 'No existe una sesión activa.' },
    { ok: false, status: 403, message: 'Sin permiso docente.' },
    { ok: false, status: 404, message: 'Período no encontrado.' },
    { ok: false, status: 0, message: 'No se pudo conectar con el sistema.' },
  ]) {
    const { handlers } = crearArnes(errorHttp);
    assert.equal(await handlers.get('profesores:periodos-mi-disponibilidad')(null), errorHttp);
    assert.equal(await handlers.get('profesores:consultar-mi-disponibilidad')(null, 9), errorHttp);
    assert.equal(await handlers.get('profesores:historial-mi-disponibilidad')(null, 9), errorHttp);
  }

  for (const canal of CANALES_DISPONIBILIDAD) {
    assert.equal((mainSource.match(new RegExp(`['"]${canal}['"]`, 'g')) || []).length, 0);
  }
  for (const escritura of [
    'profesores:guardar-mi-disponibilidad',
    'profesores:copiar-mi-disponibilidad',
  ]) {
    assert.match(mainSource, new RegExp(`['"]${escritura}['"]`));
  }

  const ipcDir = path.join(frontendDir, 'src', 'electron', 'ipc');
  const aulasModules = readdirSync(ipcDir)
    .filter((name) => /^aulas.*\.ipc\.js$/.test(name))
    .sort();
  assert.equal(aulasModules.length, 8);
  const canalesAulas = [];
  for (const archivo of aulasModules) {
    const src = readFileSync(path.join(ipcDir, archivo), 'utf8');
    for (const match of src.matchAll(/['"](aulas:[^'"]+)['"]/g)) canalesAulas.push(match[1]);
  }
  assert.equal(canalesAulas.length, 32);
  assert.equal(new Set(canalesAulas).size, 32);
});
